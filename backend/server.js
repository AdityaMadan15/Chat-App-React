import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// CORS for React development and production
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL || "http://localhost:3000"
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store io instance for use in routes
app.set('io', io);

// Import MongoDB connection and operations
const { connectDB, UserOps, MessageOps, FriendOps } = await import('./config/mongodb.js');

// Connect to MongoDB
console.log('🔄 Connecting to MongoDB...');
await connectDB();
console.log('✅ MongoDB connected successfully');

// In-memory tracking for online users
const onlineUsers = new Map();

// Import routes
let authRoutes, userRoutes, friendRoutes, messageRoutes, settingsRoutes, blockRoutes, migrateRoutes;

try {
  authRoutes = (await import('./routes/auth.js')).default;
  userRoutes = (await import('./routes/users.js')).default;
  friendRoutes = (await import('./routes/friends.js')).default;
  messageRoutes = (await import('./routes/messages.js')).default;
  settingsRoutes = (await import('./routes/settings.js')).default;
  migrateRoutes = (await import('./routes/migrate.js')).default;
  
  // Import and initialize block routes
  const blockModule = await import('./routes/block.js');
  blockRoutes = blockModule.default;
  blockModule.initBlockRoutes({ UserOps });
  
  console.log('✅ All routes imported successfully');
} catch (error) {
  console.error('❌ Error importing routes:', error);
  process.exit(1);
}

// Import middleware
import { authenticateUser, authenticateSocket } from './middleware/auth.js';

// Helper function to find user
async function findUser(identifier) {
  if (!identifier) return null;
  
  // Try by ID first
  const userById = await UserOps.findById(identifier);
  if (userById) return userById;
  
  // Try by username
  return await UserOps.findByUsername(identifier);
}

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/block', blockRoutes);
app.use('/api/migrate', migrateRoutes);

// Serve static files from React build
const buildPath = path.join(__dirname, '..', 'build');
app.use(express.static(buildPath));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const userCount = await UserOps.count();
  res.json({ 
    success: true, 
    message: 'Backend server is running!',
    users: userCount,
    online: onlineUsers.size
  });
});

// Serve React app for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(buildPath, 'index.html'));
  }
});

// Socket.io
io.use(authenticateSocket);

io.on('connection', async (socket) => {
  console.log('🟢 User connected:', socket.userId, socket.username);

  const user = await findUser(socket.userId);
  if (user) {
    await UserOps.updateOnlineStatus(user._id, true, socket.id);
    onlineUsers.set(socket.id, user._id.toString());

    // Broadcast online status to friends
    const friendsList = await FriendOps.getUserFriends(user._id.toString());

    for (const friendship of friendsList) {
      const friendId = friendship.userId.toString() === user._id.toString() ? friendship.friendId.toString() : friendship.userId.toString();
      const friend = await UserOps.findById(friendId);
      if (friend && friend.socketId) {
        const showOnline = !user.settings?.privacy || user.settings.privacy.onlineStatus !== false;
        io.to(friend.socketId).emit('friend-status-changed', {
          userId: user._id.toString(),
          username: user.username,
          isOnline: showOnline ? true : false,
          lastSeen: user.lastSeen
        });
      }
    }
  }

  socket.join(socket.userId);

  // Handle messages
  socket.on('send-message', async (data) => {
    const { receiverId, content, tempId } = data;
    const senderId = socket.userId;

    console.log('💾 SAVING MESSAGE:', {
      senderId: senderId,
      receiverId: receiverId,
      content: content
    });

    const sender = await findUser(senderId);
    const receiver = await findUser(receiverId);
    
    if (!receiver) {
      socket.emit('error', { message: 'User not found' });
      return;
    }

    // Check if blocked
    const senderBlockedUsers = sender.blockedUsers || [];
    const receiverBlockedUsers = receiver.blockedUsers || [];
    
    if (senderBlockedUsers.includes(receiverId) || receiverBlockedUsers.includes(senderId)) {
      socket.emit('error', { message: 'Cannot send message to this user' });
      return;
    }

    // Check friendship
    const isFriend = await FriendOps.areFriends(senderId, receiverId);

    if (!isFriend) {
      socket.emit('error', { message: 'You can only message friends' });
      return;
    }

    // Create and save message to MongoDB
    const message = await MessageOps.create({
      senderId: senderId,
      receiverId: receiverId,
      content: content,
      messageType: data.messageType || 'text'
    });

    // Add tempId for client tracking
    const messageObj = message.toObject();
    messageObj.id = message._id.toString();
    messageObj.tempId = tempId;
    
    console.log('✅ MESSAGE SAVED TO DATABASE');

    // Send confirmation to sender
    socket.emit('message-sent', {
      success: true,
      message: messageObj
    });

    // Check if receiver allows notifications
    const allowNotifications = !receiver.settings?.notifications || 
                              receiver.settings.notifications.messageNotifications !== false;

    // Notify receiver
    if (receiver.isOnline && receiver.socketId && allowNotifications) {
      // Mark as delivered since receiver is online
      await MessageOps.markAsDelivered(message._id);
      messageObj.status = 'delivered';
      messageObj.deliveredAt = new Date();
      
      io.to(receiver.socketId).emit('new-message', {
        message: messageObj,
        sender: { id: sender._id.toString(), username: sender.username, avatarUrl: sender.avatarUrl }
      });
      
      // Notify sender about delivery
      socket.emit('message-delivered', {
        messageId: messageObj.id,
        tempId: tempId,
        deliveredAt: messageObj.deliveredAt
      });
      
      console.log('📨 Message delivered to receiver:', receiver.username);
    } else {
      console.log('⚠️ Receiver is offline or notifications disabled');
    }

    console.log('✅ MESSAGE PROCESSING COMPLETE');
  });

  // Handle typing indicators - with privacy check
  socket.on('typing-start', async (data) => {
    const { receiverId } = data;
    const senderId = socket.userId;
    const sender = await findUser(senderId);
    const receiver = await findUser(receiverId);

    if (!sender || !receiver) return;

    // Check if sender allows typing indicator
    const allowTyping = !sender.settings?.privacy || sender.settings.privacy.typingIndicator !== false;

    if (allowTyping && receiver.socketId) {
      io.to(receiver.socketId).emit('user-typing', {
        userId: senderId,
        username: sender.username,
        isTyping: true
      });
    }
  });

  socket.on('typing-stop', async (data) => {
    const { receiverId } = data;
    const senderId = socket.userId;
    const sender = await findUser(senderId);
    const receiver = await findUser(receiverId);

    if (receiver && receiver.socketId) {
      io.to(receiver.socketId).emit('user-typing', {
        userId: senderId,
        isTyping: false
      });
    }
  });

  // Handle message read receipts - with privacy check
  socket.on('mark-as-read', async (data) => {
    const { messageIds, senderId } = data;
    const currentUserId = socket.userId;
    const currentUser = await findUser(currentUserId);
    const sender = await findUser(senderId);

    if (!currentUser || !sender) return;

    // Check if current user allows read receipts
    const allowReadReceipts = !currentUser.settings?.privacy || currentUser.settings.privacy.readReceipts !== false;

    if (allowReadReceipts) {
      // Update message status in database
      for (const msgId of messageIds) {
        await MessageOps.markAsRead(msgId, currentUserId);
      }
      
      // Notify sender about read status
      if (sender.socketId) {
        io.to(sender.socketId).emit('messages-read', {
          messageIds: messageIds,
          readBy: currentUserId,
          readAt: new Date()
        });
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log('🔴 User disconnected:', socket.userId, socket.username);
    
    const user = await findUser(socket.userId);
    if (user) {
      await UserOps.updateOnlineStatus(user._id, false, null);
      onlineUsers.delete(socket.id);

      // Broadcast offline status to friends
      const friendsList = await FriendOps.getUserFriends(user._id.toString());

      for (const friendship of friendsList) {
        const friendId = friendship.userId.toString() === user._id.toString() ? friendship.friendId.toString() : friendship.userId.toString();
        const friend = await UserOps.findById(friendId);
        if (friend && friend.socketId) {
          const showLastSeen = !user.settings?.privacy || user.settings.privacy.lastSeen !== false;
          io.to(friend.socketId).emit('friend-status-changed', {
            userId: user._id.toString(),
            username: user.username,
            isOnline: false,
            lastSeen: showLastSeen ? user.lastSeen : null
          });
        }
      }
    }
  });

  // WebRTC signaling removed: voice/video call functionality reverted

  // [Rest of your socket events - friend requests, typing, etc.]
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`💾 Data persistence: ENABLED`);
  console.log(`👥 Default users: Ani & Maddy (password: password123)`);
});
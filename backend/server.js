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

// Import database with persistence
const { users, friends, messages, friendRequests, onlineUsers, startAutoSave, saveData } = await import('./config/database.js');

// Ensure data is loaded on server start
console.log('🔄 Loading existing data...');

// Import routes
let authRoutes, userRoutes, friendRoutes, messageRoutes, settingsRoutes, blockRoutes;

try {
  authRoutes = (await import('./routes/auth.js')).default;
  userRoutes = (await import('./routes/users.js')).default;
  friendRoutes = (await import('./routes/friends.js')).default;
  messageRoutes = (await import('./routes/messages.js')).default;
  settingsRoutes = (await import('./routes/settings.js')).default;
  
  // Import and initialize block routes
  const blockModule = await import('./routes/block.js');
  blockRoutes = blockModule.default;
  blockModule.initBlockRoutes({ users, saveData });
  
  console.log('✅ All routes imported successfully');
} catch (error) {
  console.error('❌ Error importing routes:', error);
  process.exit(1);
}

// Import middleware
import { authenticateUser, authenticateSocket } from './middleware/auth.js';

// Helper function to find user
function findUser(identifier) {
  if (!identifier) return null;
  
  // Try by ID first
  const userById = users.get(identifier);
  if (userById && userById.id) {
    return userById;
  }
  
  // Try by username
  for (let [id, user] of users) {
    if (user && user.username && user.username === identifier) {
      return user;
    }
  }
  
  return null;
}

// Start auto-save functionality
startAutoSave();

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Backend server is running!',
    users: users.size,
    online: onlineUsers.size
  });
});

// Socket.io
io.use(authenticateSocket);

io.on('connection', (socket) => {
  console.log('🟢 User connected:', socket.userId, socket.username);

  const user = findUser(socket.userId);
  if (user) {
    user.isOnline = true;
    user.socketId = socket.id;
    user.lastSeen = new Date();
    onlineUsers.set(socket.id, user.id);

    // Broadcast online status to friends
    const friendsList = Array.from(friends.values())
      .filter(f => 
        (f.userId === user.id || f.friendId === user.id) && 
        f.status === 'accepted'
      )
      .map(f => f.userId === user.id ? f.friendId : f.userId);

    friendsList.forEach(friendId => {
      const friend = users.get(friendId);
      if (friend && friend.socketId) {
        const showOnline = !user.settings?.privacy || user.settings.privacy.onlineStatus !== false;
        io.to(friend.socketId).emit('friend-status-changed', {
          userId: user.id,
          username: user.username,
          isOnline: showOnline ? true : false,
          lastSeen: user.lastSeen
        });
      }
    });
  }

  socket.join(socket.userId);

  // Handle messages
  socket.on('send-message', (data) => {
    const { receiverId, content, tempId } = data;
    const senderId = socket.userId;

    console.log('💾 SAVING MESSAGE:', {
      senderId: senderId,
      receiverId: receiverId,
      content: content
    });

    const sender = findUser(senderId);
    const receiver = findUser(receiverId);
    
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
    const isFriend = Array.from(friends.values()).some(f => 
      (f.userId === senderId && f.friendId === receiverId && f.status === 'accepted') ||
      (f.userId === receiverId && f.friendId === senderId && f.status === 'accepted')
    );

    if (!isFriend) {
      socket.emit('error', { message: 'You can only message friends' });
      return;
    }

    // Create message
    const message = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      senderId: senderId,
      receiverId: receiverId,
      content: content,
      messageType: data.messageType || 'text',
      timestamp: new Date(),
      isRead: false,
      status: 'sent',
      deliveredAt: null,
      readAt: null,
      tempId: tempId
    };

    // Store in conversation
    const conversationId = [senderId, receiverId].sort().join('-');
    if (!messages.has(conversationId)) {
      messages.set(conversationId, []);
    }
    
    const conversation = messages.get(conversationId);
    conversation.push(message);

    // Save data
    saveData();
    
    console.log('✅ MESSAGE SAVED TO DATABASE');

    // Send confirmation to sender
    socket.emit('message-sent', {
      success: true,
      message: message
    });

    // Check if receiver allows notifications
    const allowNotifications = !receiver.settings?.notifications || 
                              receiver.settings.notifications.messageNotifications !== false;

    // Notify receiver
    if (receiver.isOnline && receiver.socketId && allowNotifications) {
      // Mark as delivered since receiver is online
      message.status = 'delivered';
      message.deliveredAt = new Date();
      
      io.to(receiver.socketId).emit('new-message', {
        message: message,
        sender: sender.toPublicJSON()
      });
      
      // Notify sender about delivery
      socket.emit('message-delivered', {
        messageId: message.id,
        tempId: tempId,
        deliveredAt: message.deliveredAt
      });
      
      console.log('📨 Message delivered to receiver:', receiver.username);
    }

    // Also send to sender (for multi-device sync)
    io.to(senderId).emit('new-message', {
      message: message,
      sender: sender.toPublicJSON()
    });

    console.log('✅ MESSAGE PROCESSING COMPLETE');
  });

  // Handle typing indicators - with privacy check
  socket.on('typing-start', (data) => {
    const { receiverId } = data;
    const senderId = socket.userId;
    const sender = findUser(senderId);
    const receiver = findUser(receiverId);

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

  socket.on('typing-stop', (data) => {
    const { receiverId } = data;
    const senderId = socket.userId;
    const receiver = findUser(receiverId);

    if (receiver && receiver.socketId) {
      io.to(receiver.socketId).emit('user-typing', {
        userId: senderId,
        isTyping: false
      });
    }
  });

  // Handle message read receipts - with privacy check
  socket.on('mark-as-read', (data) => {
    const { messageIds, senderId } = data;
    const currentUserId = socket.userId;
    const currentUser = findUser(currentUserId);
    const sender = findUser(senderId);

    if (!currentUser || !sender) return;

    // Check if current user allows read receipts
    const allowReadReceipts = !currentUser.settings?.privacy || currentUser.settings.privacy.readReceipts !== false;

    if (allowReadReceipts) {
      // Update message status in database
      const conversationId = [currentUserId, senderId].sort().join('-');
      const conversation = messages.get(conversationId);
      
      if (conversation) {
        messageIds.forEach(msgId => {
          const msg = conversation.find(m => m.id === msgId);
          if (msg) {
            msg.isRead = true;
            msg.status = 'read';
            msg.readAt = new Date();
          }
        });
        saveData();
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
  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.userId, socket.username);
    
    const user = findUser(socket.userId);
    if (user) {
      user.isOnline = false;
      user.lastSeen = new Date();
      onlineUsers.delete(socket.id);

      // Broadcast offline status to friends
      const friendsList = Array.from(friends.values())
        .filter(f => 
          (f.userId === user.id || f.friendId === user.id) && 
          f.status === 'accepted'
        )
        .map(f => f.userId === user.id ? f.friendId : f.userId);

      friendsList.forEach(friendId => {
        const friend = users.get(friendId);
        if (friend && friend.socketId) {
          const showLastSeen = !user.settings?.privacy || user.settings.privacy.lastSeen !== false;
          io.to(friend.socketId).emit('friend-status-changed', {
            userId: user.id,
            username: user.username,
            isOnline: false,
            lastSeen: showLastSeen ? user.lastSeen : null
          });
        }
      });

      saveData();
    }
  });

  // [Rest of your socket events - friend requests, typing, etc.]
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`💾 Data persistence: ENABLED`);
  console.log(`👥 Default users: Ani & Maddy (password: password123)`);
});
import express from 'express';
import { UserOps, FriendOps, MessageOps } from '../config/mongodb.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// Get conversation with a friend - UPDATED WITH DEBUG
router.get('/conversation/:friendId', authenticateUser, async (req, res) => {
  try {
    const { friendId } = req.params;
    const currentUser = req.user;
    const currentUserId = currentUser._id.toString();

    console.log('🔍 CONVERSATION REQUEST:', {
        currentUser: currentUser.username,
        friendId: friendId,
        currentUserId: currentUserId
    });

    // Check if friend exists
    const friend = await UserOps.findById(friendId);
    if (!friend) {
      return res.status(404).json({
        success: false,
        message: 'Friend not found'
      });
    }

    // Check if users are friends
    const isFriend = await FriendOps.areFriends(currentUserId, friendId);

    if (!isFriend) {
      return res.status(403).json({
        success: false,
        message: 'You can only view conversations with friends'
      });
    }

    // Get conversation messages
    const conversationMessages = await MessageOps.getConversation(currentUserId, friendId);

    console.log('🔍 CONVERSATION DATA:', {
        messagesCount: conversationMessages.length,
        expectedConversationId: [currentUserId, friendId].sort().join('-')
    });
    
    // Debug: Check what messages exist in DB
    const MessageSchema = (await import('../models/MessageSchema.js')).default;
    const allMessages = await MessageSchema.find({}).limit(10);
    console.log(`📊 Total messages in DB: ${await MessageSchema.countDocuments()}`);
    if (allMessages.length > 0) {
      console.log('📝 Sample messages:', allMessages.map(m => ({
        conversationId: m.conversationId,
        senderId: m.senderId.toString(),
        receiverId: m.receiverId.toString(),
        content: m.content.substring(0, 30)
      })));
    }

    // Mark messages as read
    for (const msg of conversationMessages) {
      if (msg.receiverId.toString() === currentUserId && !msg.isRead) {
        await MessageOps.markAsRead(msg._id, currentUserId);
      }
    }

    // Convert messages to plain objects
    const messagesJson = conversationMessages.map(msg => ({
      id: msg._id.toString(),
      senderId: msg.senderId.toString(),
      receiverId: msg.receiverId.toString(),
      content: msg.content,
      messageType: msg.messageType,
      timestamp: msg.timestamp,
      isRead: msg.isRead,
      status: msg.status,
      deliveredAt: msg.deliveredAt,
      readAt: msg.readAt,
      reactions: msg.reactions ? Object.fromEntries(msg.reactions) : {},
      deletedFor: msg.deletedFor || [],
      isDeletedForEveryone: msg.isDeletedForEveryone || false
    }));

    res.json({
      success: true,
      messages: messagesJson,
      friend: {
        id: friend._id.toString(),
        username: friend.username,
        email: friend.email,
        avatarUrl: friend.avatarUrl,
        isOnline: friend.isOnline,
        lastSeen: friend.lastSeen,
        bio: friend.bio
      },
      count: messagesJson.length
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching conversation'
    });
  }
});

// Get recent conversations - UPDATED WITH DEBUG
router.get('/conversations', authenticateUser, async (req, res) => {
  try {
    const currentUser = req.user;
    const currentUserId = currentUser._id.toString();
    const conversations = [];

    console.log('🔍 LOADING RECENT CONVERSATIONS FOR:', currentUser.username);

    // Get all friends
    const userFriends = await FriendOps.getUserFriends(currentUserId);

    console.log(`🔍 FOUND ${userFriends.length} FRIENDS`);

    for (let friendship of userFriends) {
      const friendId = friendship.userId.toString() === currentUserId ? friendship.friendId.toString() : friendship.userId.toString();
      const friend = await UserOps.findById(friendId);
      
      if (friend) {
        // Get last message in conversation
        const conversationMessages = await MessageOps.getConversation(currentUserId, friendId);
        const lastMessage = conversationMessages.length > 0 ? conversationMessages[conversationMessages.length - 1] : null;

        conversations.push({
          friend: {
            id: friend._id.toString(),
            username: friend.username,
            email: friend.email,
            avatarUrl: friend.avatarUrl,
            isOnline: friend.isOnline,
            lastSeen: friend.lastSeen,
            bio: friend.bio
          },
          lastMessage: lastMessage ? {
            id: lastMessage._id.toString(),
            senderId: lastMessage.senderId.toString(),
            receiverId: lastMessage.receiverId.toString(),
            content: lastMessage.content,
            messageType: lastMessage.messageType,
            timestamp: lastMessage.timestamp,
            isRead: lastMessage.isRead,
            isDeletedForEveryone: lastMessage.isDeletedForEveryone || false
          } : null,
          lastActivity: lastMessage ? lastMessage.timestamp : friendship.createdAt
        });

        console.log(`💬 Conversation with ${friend.username}: ${conversationMessages.length} messages`);
      }
    }

    // Sort by last activity
    conversations.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    console.log(`✅ RETURNING ${conversations.length} CONVERSATIONS`);

    res.json({
      success: true,
      conversations,
      count: conversations.length
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching conversations'
    });
  }
});

// Add reaction to a message
router.post('/:messageId/react', authenticateUser, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const currentUserId = req.user._id.toString();

    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: 'Emoji is required'
      });
    }

    // Add reaction using MongoDB
    const message = await MessageOps.addReaction(messageId, currentUserId, emoji);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Emit socket event
    const io = req.app.get('io');
    const user1 = await UserOps.findById(message.senderId.toString());
    const user2 = await UserOps.findById(message.receiverId.toString());
    
    if (user1 && user1.socketId) {
      io.to(user1.socketId).emit('message-reaction', {
        messageId,
        userId: currentUserId,
        emoji,
        reactions: message.reactions ? Object.fromEntries(message.reactions) : {}
      });
    }
    if (user2 && user2.socketId) {
      io.to(user2.socketId).emit('message-reaction', {
        messageId,
        userId: currentUserId,
        emoji,
        reactions: message.reactions ? Object.fromEntries(message.reactions) : {}
      });
    }

    return res.json({
      success: true,
      message: 'Reaction added',
      reactions: message.reactions ? Object.fromEntries(message.reactions) : {}
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add reaction'
    });
  }
});

// Remove reaction from a message
router.delete('/:messageId/react', authenticateUser, async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user._id.toString();

    // Remove reaction using MongoDB
    const message = await MessageOps.removeReaction(messageId, currentUserId);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Emit socket event
    const io = req.app.get('io');
    const user1 = await UserOps.findById(message.senderId.toString());
    const user2 = await UserOps.findById(message.receiverId.toString());
    
    if (user1 && user1.socketId) {
      io.to(user1.socketId).emit('message-reaction-removed', {
        messageId,
        userId: currentUserId,
        reactions: message.reactions ? Object.fromEntries(message.reactions) : {}
      });
    }
    if (user2 && user2.socketId) {
      io.to(user2.socketId).emit('message-reaction-removed', {
        messageId,
        userId: currentUserId,
        reactions: message.reactions ? Object.fromEntries(message.reactions) : {}
      });
    }

    return res.json({
      success: true,
      message: 'Reaction removed',
      reactions: message.reactions ? Object.fromEntries(message.reactions) : {}
    });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove reaction'
    });
  }
});

// Delete message for me
router.post('/:messageId/delete-for-me', authenticateUser, async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user._id.toString();

    // Delete for me using MongoDB
    const message = await MessageOps.deleteForMe(messageId, currentUserId);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    return res.json({
      success: true,
      message: 'Message deleted for you'
    });
  } catch (error) {
    console.error('Delete for me error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
});

// Delete message for everyone
router.post('/:messageId/delete-for-everyone', authenticateUser, async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user._id.toString();

    // Find the message
    const message = await MessageOps.findById(messageId);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is the sender
    if (message.senderId.toString() !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }

    // Check time limit (2 minutes)
    const twoMinutes = 2 * 60 * 1000;
    const timeSinceSent = new Date() - new Date(message.timestamp);
    if (timeSinceSent > twoMinutes) {
      return res.status(403).json({
        success: false,
        message: 'Messages can only be deleted within 2 minutes of sending'
      });
    }

    // Delete for everyone
    await MessageOps.deleteForEveryone(messageId);
    
    // Emit socket event to both users
    const io = req.app.get('io');
    const user1 = await UserOps.findById(message.senderId.toString());
    const user2 = await UserOps.findById(message.receiverId.toString());
    
    console.log('📡 Emitting delete-for-everyone event to both users');
    
    // Emit to both users' socket IDs if they're online
    if (user1 && user1.socketId) {
      io.to(user1.socketId).emit('message-deleted-everyone', {
        messageId,
        conversationId: null // Not needed with MongoDB
      });
      console.log('✅ Sent to user1:', user1.username, 'socketId:', user1.socketId);
    }
    
    if (user2 && user2.socketId) {
      io.to(user2.socketId).emit('message-deleted-everyone', {
        messageId,
        conversationId: null
      });
      console.log('✅ Sent to user2:', user2.username, 'socketId:', user2.socketId);
    }

    return res.json({
      success: true,
      message: 'Message deleted for everyone'
    });
  } catch (error) {
    console.error('Delete for everyone error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
});

export default router;
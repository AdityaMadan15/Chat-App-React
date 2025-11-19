import express from 'express';
import { users, friends, messages, saveData } from '../config/database.js';
import Message from '../models/Message.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// Get conversation with a friend - UPDATED WITH DEBUG
router.get('/conversation/:friendId', authenticateUser, (req, res) => {
  try {
    const { friendId } = req.params;
    const currentUser = req.user;

    console.log('🔍 CONVERSATION REQUEST:', {
        currentUser: currentUser.username,
        friendId: friendId,
        currentUserId: currentUser.id
    });

    // Check if friend exists
    const friend = users.get(friendId);
    if (!friend) {
      return res.status(404).json({
        success: false,
        message: 'Friend not found'
      });
    }

    // Check if users are friends
    const isFriend = Array.from(friends.values()).some(f => 
      (f.userId === currentUser.id && f.friendId === friend.id && f.status === 'accepted') ||
      (f.userId === friend.id && f.friendId === currentUser.id && f.status === 'accepted')
    );

    if (!isFriend) {
      return res.status(403).json({
        success: false,
        message: 'You can only view conversations with friends'
      });
    }

    // Get conversation messages
    const conversationId = [currentUser.id, friend.id].sort().join('-');
    const conversationMessages = messages.get(conversationId) || [];

    console.log('🔍 CONVERSATION DATA:', {
        conversationId: conversationId,
        messagesCount: conversationMessages.length,
        messages: conversationMessages.slice(0, 3) // Log first 3 messages
    });

    // Mark messages as read
    conversationMessages.forEach(msg => {
      if (msg.receiverId === currentUser.id && !msg.isRead) {
        // Handle both Message objects and plain objects
        if (typeof msg.markAsRead === 'function') {
          msg.markAsRead();
        } else {
          msg.isRead = true;
          msg.status = 'read';
          msg.readAt = new Date();
        }
      }
    });

    res.json({
      success: true,
      messages: conversationMessages.map(msg => typeof msg.toJSON === 'function' ? msg.toJSON() : msg),
      friend: friend.toPublicJSON(),
      count: conversationMessages.length
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
router.get('/conversations', authenticateUser, (req, res) => {
  try {
    const currentUser = req.user;
    const conversations = [];

    console.log('🔍 LOADING RECENT CONVERSATIONS FOR:', currentUser.username);

    // Get all friends
    const userFriends = Array.from(friends.values()).filter(f => 
      (f.userId === currentUser.id && f.status === 'accepted') ||
      (f.friendId === currentUser.id && f.status === 'accepted')
    );

    console.log(`🔍 FOUND ${userFriends.length} FRIENDS`);

    for (let friendship of userFriends) {
      const friendId = friendship.userId === currentUser.id ? friendship.friendId : friendship.userId;
      const friend = users.get(friendId);
      
      if (friend) {
        // Get last message in conversation
        const conversationId = [currentUser.id, friend.id].sort().join('-');
        const conversationMessages = messages.get(conversationId) || [];
        const lastMessage = conversationMessages[conversationMessages.length - 1];

        conversations.push({
          friend: friend.toPublicJSON(),
          lastMessage: lastMessage ? (typeof lastMessage.toJSON === 'function' ? lastMessage.toJSON() : lastMessage) : null,
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
router.post('/:messageId/react', authenticateUser, (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const currentUserId = req.user.id;

    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: 'Emoji is required'
      });
    }

    // Find the message in all conversations
    let messageFound = false;
    for (const [conversationId, msgs] of messages) {
      const message = msgs.find(m => m.id === messageId);
      if (message) {
        // Initialize reactions if needed
        if (!message.reactions) {
          message.reactions = {};
        }

        // Add or update reaction
        message.reactions[currentUserId] = emoji;
        saveData();
        messageFound = true;

        // Emit socket event
        const io = req.app.get('io');
        const [user1Id, user2Id] = conversationId.split('-');
        io.to(user1Id).to(user2Id).emit('message-reaction', {
          messageId,
          userId: currentUserId,
          emoji,
          reactions: message.reactions
        });

        return res.json({
          success: true,
          message: 'Reaction added',
          reactions: message.reactions
        });
      }
    }

    if (!messageFound) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add reaction'
    });
  }
});

// Remove reaction from a message
router.delete('/:messageId/react', authenticateUser, (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.id;

    // Find the message in all conversations
    let messageFound = false;
    for (const [conversationId, msgs] of messages) {
      const message = msgs.find(m => m.id === messageId);
      if (message && message.reactions) {
        delete message.reactions[currentUserId];
        saveData();
        messageFound = true;

        // Emit socket event
        const io = req.app.get('io');
        const [user1Id, user2Id] = conversationId.split('-');
        io.to(user1Id).to(user2Id).emit('message-reaction-removed', {
          messageId,
          userId: currentUserId,
          reactions: message.reactions
        });

        return res.json({
          success: true,
          message: 'Reaction removed',
          reactions: message.reactions
        });
      }
    }

    if (!messageFound) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove reaction'
    });
  }
});

// Delete message for me
router.post('/:messageId/delete-for-me', authenticateUser, (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.id;

    // Find the message in all conversations
    let messageFound = false;
    for (const [conversationId, msgs] of messages) {
      const message = msgs.find(m => m.id === messageId);
      if (message) {
        // Initialize deletedFor if needed
        if (!message.deletedFor) {
          message.deletedFor = [];
        }

        // Add current user to deletedFor array
        if (!message.deletedFor.includes(currentUserId)) {
          message.deletedFor.push(currentUserId);
        }

        saveData();
        messageFound = true;

        return res.json({
          success: true,
          message: 'Message deleted for you'
        });
      }
    }

    if (!messageFound) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
  } catch (error) {
    console.error('Delete for me error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
});

// Delete message for everyone
router.post('/:messageId/delete-for-everyone', authenticateUser, (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.id;

    // Find the message in all conversations
    let messageFound = false;
    for (const [conversationId, msgs] of messages) {
      const message = msgs.find(m => m.id === messageId);
      if (message) {
        // Check if user is the sender
        if (message.senderId !== currentUserId) {
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
        message.isDeletedForEveryone = true;
        message.deletedAt = new Date();
        saveData();
        messageFound = true;

        // Emit socket event to both users
        const io = req.app.get('io');
        const [user1Id, user2Id] = conversationId.split('-');
        
        // Get actual users to find their socket IDs
        const user1 = users.get(user1Id);
        const user2 = users.get(user2Id);
        
        console.log('📡 Emitting delete-for-everyone event to both users');
        
        // Emit to both users' socket IDs if they're online
        if (user1 && user1.socketId) {
          io.to(user1.socketId).emit('message-deleted-everyone', {
            messageId,
            conversationId
          });
          console.log('✅ Sent to user1:', user1.username, 'socketId:', user1.socketId);
        }
        
        if (user2 && user2.socketId) {
          io.to(user2.socketId).emit('message-deleted-everyone', {
            messageId,
            conversationId
          });
          console.log('✅ Sent to user2:', user2.username, 'socketId:', user2.socketId);
        }

        return res.json({
          success: true,
          message: 'Message deleted for everyone'
        });
      }
    }

    if (!messageFound) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
  } catch (error) {
    console.error('Delete for everyone error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
});

export default router;
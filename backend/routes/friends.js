import express from 'express';
import { UserOps, FriendOps } from '../config/mongodb.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// Helper function to find user by username
function findUserByUsername(username) {
  if (!username) return null;
  const searchUsername = username.toLowerCase().trim();
  for (let [id, user] of users) {
    if (user.username.toLowerCase() === searchUsername) {
      return user;
    }
  }
  return null;
}

// Send friend request
router.post('/request', authenticateUser, async (req, res) => {
  try {
    const { friendUsername } = req.body;
    const currentUser = req.user;
    const currentUserId = currentUser._id.toString();

    console.log('🔍 Sending friend request to:', friendUsername);

    if (!friendUsername) {
      return res.status(400).json({
        success: false,
        message: 'Friend username is required'
      });
    }

    // Find friend user
    const friendUser = await UserOps.findByUsername(friendUsername);
    if (!friendUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const friendId = friendUser._id.toString();

    // Prevent self-adding
    if (friendId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot add yourself'
      });
    }

    // Check if request already exists
    const existingRequest = await FriendOps.findFriendship(currentUserId, friendId);

    if (existingRequest) {
      if (existingRequest.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'You are already friends'
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Friend request already sent'
        });
      }
    }

    // Create friend request
    const friendRequest = await FriendOps.create(currentUserId, friendId);

    console.log('✅ Friend request created');

    res.json({
      success: true,
      message: `Friend request sent to ${friendUser.username}`,
      friendRequest: {
        id: friendRequest._id.toString(),
        userId: friendRequest.userId.toString(),
        friendId: friendRequest.friendId.toString(),
        status: friendRequest.status,
        createdAt: friendRequest.createdAt
      }
    });
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get pending friend requests
router.get('/requests', authenticateUser, async (req, res) => {
  try {
    const currentUser = req.user;
    const currentUserId = currentUser._id.toString();
    const pendingRequests = [];

    // Get requests where current user is the receiver
    const requests = await FriendOps.getPendingRequests(currentUserId);
    
    for (const request of requests) {
      const sender = await UserOps.findById(request.userId.toString());
      if (sender) {
        pendingRequests.push({
          id: request._id.toString(),
          userId: request.userId.toString(),
          friendId: request.friendId.toString(),
          status: request.status,
          createdAt: request.createdAt,
          sender: {
            id: sender._id.toString(),
            username: sender.username,
            email: sender.email,
            avatarUrl: sender.avatarUrl,
            isOnline: sender.isOnline,
            lastSeen: sender.lastSeen
          }
        });
      }
    }

    res.json({
      success: true,
      requests: pendingRequests,
      count: pendingRequests.length
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Accept friend request
router.post('/requests/:requestId/accept', authenticateUser, async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUser = req.user;
    const currentUserId = currentUser._id.toString();

    const friendRequest = await FriendOps.findById(requestId);
    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found'
      });
    }

    // Check if current user is the receiver
    if (friendRequest.friendId.toString() !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Accept the request
    const updated = await FriendOps.accept(requestId);

    res.json({
      success: true,
      message: 'Friend request accepted',
      friend: {
        id: updated._id.toString(),
        userId: updated.userId.toString(),
        friendId: updated.friendId.toString(),
        status: updated.status,
        createdAt: updated.createdAt
      }
    });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Decline friend request
router.post('/requests/:requestId/decline', authenticateUser, async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUser = req.user;
    const currentUserId = currentUser._id.toString();

    const friendRequest = await FriendOps.findById(requestId);
    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found'
      });
    }

    if (friendRequest.friendId.toString() !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Remove friend request
    await FriendOps.delete(requestId);

    res.json({
      success: true,
      message: 'Friend request declined'
    });
  } catch (error) {
    console.error('Decline request error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get friends list
router.get('/list', authenticateUser, async (req, res) => {
  try {
    const currentUser = req.user;
    const currentUserId = currentUser._id.toString();
    const friendsList = [];

    // Find all accepted friendships
    const friendships = await FriendOps.getUserFriends(currentUserId);
    
    for (const friendship of friendships) {
      const friendId = friendship.userId.toString() === currentUserId ? friendship.friendId.toString() : friendship.userId.toString();
      const friendUser = await UserOps.findById(friendId);

      if (friendUser) {
        friendsList.push({
          id: friendship._id.toString(),
          userId: friendship.userId.toString(),
          friendId: friendship.friendId.toString(),
          status: friendship.status,
          createdAt: friendship.createdAt,
          friend: {
            id: friendUser._id.toString(),
            username: friendUser.username,
            email: friendUser.email,
            avatarUrl: friendUser.avatarUrl,
            isOnline: friendUser.isOnline,
            lastSeen: friendUser.lastSeen,
            bio: friendUser.bio
          }
        });
      }
    }

    res.json({
      success: true,
      friends: friendsList,
      count: friendsList.length
    });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Remove friend
router.delete('/:friendId', authenticateUser, async (req, res) => {
  try {
    const { friendId } = req.params;
    const currentUser = req.user;
    const currentUserId = currentUser._id.toString();

    console.log('🗑️ Removing friend:', friendId);

    // Find the friendship
    const friendship = await FriendOps.findFriendship(currentUserId, friendId);

    if (!friendship || friendship.status !== 'accepted') {
      return res.status(404).json({
        success: false,
        message: 'Friendship not found'
      });
    }

    // Remove the friendship
    await FriendOps.delete(friendship._id.toString());

    console.log('✅ Friend removed successfully');

    res.json({
      success: true,
      message: 'Friend removed successfully'
    });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
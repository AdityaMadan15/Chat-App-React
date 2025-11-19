import express from 'express';
import { users, friends, saveData } from '../config/database.js';
import Friend from '../models/Friend.js';
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
router.post('/request', authenticateUser, (req, res) => {
  try {
    const { friendUsername } = req.body;
    const currentUser = req.user;

    console.log('🔍 Sending friend request to:', friendUsername);

    if (!friendUsername) {
      return res.status(400).json({
        success: false,
        message: 'Friend username is required'
      });
    }

    // Find friend user
    const friendUser = findUserByUsername(friendUsername);
    if (!friendUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-adding
    if (friendUser.id === currentUser.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot add yourself'
      });
    }

    // Check if request already exists
    const existingRequest = Array.from(friends.values()).find(f => 
      (f.userId === currentUser.id && f.friendId === friendUser.id) ||
      (f.userId === friendUser.id && f.friendId === currentUser.id)
    );

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
    const friendRequest = new Friend(currentUser.id, friendUser.id);
    friends.set(friendRequest.id, friendRequest);

    // Save data
    saveData();

    console.log('✅ Friend request created');

    res.json({
      success: true,
      message: `Friend request sent to ${friendUser.username}`,
      friendRequest: friendRequest.toJSON()
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
router.get('/requests', authenticateUser, (req, res) => {
  try {
    const currentUser = req.user;
    const pendingRequests = [];

    // Get requests where current user is the receiver
    for (let [id, friend] of friends) {
      if (friend.friendId === currentUser.id && friend.status === 'pending') {
        const sender = users.get(friend.userId);
        if (sender) {
          pendingRequests.push({
            ...friend.toJSON(),
            sender: sender.toPublicJSON()
          });
        }
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
router.post('/requests/:requestId/accept', authenticateUser, (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUser = req.user;

    const friendRequest = friends.get(requestId);
    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found'
      });
    }

    // Check if current user is the receiver
    if (friendRequest.friendId !== currentUser.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Accept the request
    friendRequest.accept();

    // Save data
    saveData();

    res.json({
      success: true,
      message: 'Friend request accepted',
      friend: friendRequest.toJSON()
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
router.post('/requests/:requestId/decline', authenticateUser, (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUser = req.user;

    const friendRequest = friends.get(requestId);
    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found'
      });
    }

    if (friendRequest.friendId !== currentUser.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Remove friend request
    friends.delete(requestId);

    // Save data
    saveData();

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
router.get('/list', authenticateUser, (req, res) => {
  try {
    const currentUser = req.user;
    const friendsList = [];

    // Find all accepted friendships
    for (let [id, friend] of friends) {
      if (friend.status === 'accepted') {
        let friendUser = null;
        
        if (friend.userId === currentUser.id) {
          friendUser = users.get(friend.friendId);
        } else if (friend.friendId === currentUser.id) {
          friendUser = users.get(friend.userId);
        }

        if (friendUser) {
          friendsList.push({
            ...friend.toJSON(),
            friend: friendUser.toPublicJSON()
          });
        }
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
router.delete('/:friendId', authenticateUser, (req, res) => {
  try {
    const { friendId } = req.params;
    const currentUser = req.user;

    console.log('🗑️ Removing friend:', friendId);

    // Find the friendship
    let friendshipToRemove = null;
    for (let [id, friend] of friends) {
      if (
        (friend.userId === currentUser.id && friend.friendId === friendId && friend.status === 'accepted') ||
        (friend.userId === friendId && friend.friendId === currentUser.id && friend.status === 'accepted')
      ) {
        friendshipToRemove = friend;
        break;
      }
    }

    if (!friendshipToRemove) {
      return res.status(404).json({
        success: false,
        message: 'Friendship not found'
      });
    }

    // Remove the friendship
    friends.delete(friendshipToRemove.id);

    // Save data
    saveData();

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
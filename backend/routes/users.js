import express from 'express';
import { UserOps, FriendOps } from '../config/mongodb.js';
import { authenticateUser, optionalAuth } from '../middleware/auth.js';

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

// Search users by username
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 1) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const searchTerm = q.toLowerCase().trim();
    
    // Search through all users
    const foundUsers = await UserOps.searchByUsername(searchTerm, 20);
    
    // Exclude current user from results
    const results = foundUsers
      .filter(user => !req.user || user._id.toString() !== req.user._id.toString())
      .map(user => ({
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        bio: user.bio
      }));

    res.json({
      success: true,
      results,
      count: results.length
    });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during user search'
    });
  }
});

// Get user profile by ID
router.get('/:userId', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await UserOps.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if users are friends
    let isFriend = false;
    if (req.user) {
      isFriend = await FriendOps.areFriends(req.user._id.toString(), userId);
    }

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        bio: user.bio
      },
      isFriend,
      canAddFriend: req.user && req.user._id.toString() !== user._id.toString() && !isFriend
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching user'
    });
  }
});

// Update user profile
router.put('/profile', authenticateUser, async (req, res) => {
  try {
    const { username, bio } = req.body;
    const userId = req.user._id.toString();
    
    // Validate username
    if (username && username !== req.user.username) {
      // Check if username is taken
      const existingUser = await UserOps.findByUsername(username);
      
      if (existingUser && existingUser._id.toString() !== userId) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }
    }
    
    // Update profile
    const updatedUser = await UserOps.updateProfile(userId, { username, bio });
    
    // Broadcast profile update to all friends via socket
    const io = req.app.get('io');
    const friends = await FriendOps.getUserFriends(userId);
    
    for (const friendship of friends) {
      const friendUser = await UserOps.findById(friendship.friendId);
      if (friendUser && friendUser.socketId) {
        io.to(friendUser.socketId).emit('friend-profile-updated', {
          userId: userId,
          username: updatedUser.username,
          avatarUrl: updatedUser.avatarUrl,
          bio: updatedUser.bio
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id.toString(),
        username: updatedUser.username,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatarUrl,
        isOnline: updatedUser.isOnline,
        lastSeen: updatedUser.lastSeen,
        bio: updatedUser.bio,
        settings: updatedUser.settings
      }
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating profile'
    });
  }
});

// Upload profile picture
router.post('/upload-avatar', authenticateUser, async (req, res) => {
  try {
    const { avatarData } = req.body;
    const userId = req.user._id.toString();

    console.log('📸 Uploading profile picture for:', req.user.username);

    if (!avatarData) {
      return res.status(400).json({
        success: false,
        message: 'No image data provided'
      });
    }

    // Validate base64 image data
    if (!avatarData.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image format. Please select a valid image file.'
      });
    }

    // Update user's avatar URL
    const updatedUser = await UserOps.updateAvatar(userId, avatarData);

    console.log('✅ Profile picture updated for:', updatedUser.username);

    // Broadcast profile update to all friends via socket
    const io = req.app.get('io');
    const friends = await FriendOps.getUserFriends(userId);
    
    for (const friendship of friends) {
      const friendUser = await UserOps.findById(friendship.friendId);
      if (friendUser && friendUser.socketId) {
        io.to(friendUser.socketId).emit('friend-profile-updated', {
          userId: userId,
          username: updatedUser.username,
          avatarUrl: updatedUser.avatarUrl,
          bio: updatedUser.bio
        });
      }
    }

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      user: {
        id: updatedUser._id.toString(),
        username: updatedUser.username,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatarUrl,
        isOnline: updatedUser.isOnline,
        lastSeen: updatedUser.lastSeen,
        bio: updatedUser.bio,
        settings: updatedUser.settings
      }
    });

  } catch (error) {
    console.error('❌ Upload avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile picture'
    });
  }
});

export default router;
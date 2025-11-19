import express from 'express';
import { users, friends, saveData } from '../config/database.js';
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
router.get('/search', optionalAuth, (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 1) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const searchTerm = q.toLowerCase().trim();
    const results = [];

    // Search through all users
    for (let [id, user] of users) {
      // Skip if it's the current user
      if (req.user && user.id === req.user.id) continue;

      // Check if username matches search term
      if (user.username.toLowerCase().includes(searchTerm)) {
        results.push(user.toPublicJSON());
      }

      // Limit results
      if (results.length >= 20) break;
    }

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
router.get('/:userId', optionalAuth, (req, res) => {
  try {
    const { userId } = req.params;
    const user = users.get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if users are friends
    let isFriend = false;
    if (req.user) {
      const friendRelation = Array.from(friends.values()).find(f => 
        (f.userId === req.user.id && f.friendId === user.id && f.status === 'accepted') ||
        (f.userId === user.id && f.friendId === req.user.id && f.status === 'accepted')
      );
      isFriend = !!friendRelation;
    }

    res.json({
      success: true,
      user: user.toPublicJSON(),
      isFriend,
      canAddFriend: req.user && req.user.id !== user.id && !isFriend
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
router.put('/profile', authenticateUser, (req, res) => {
  try {
    const { username, bio } = req.body;
    const user = req.user;
    
    // Validate username
    if (username && username !== user.username) {
      // Check if username is taken
      let usernameExists = false;
      for (let [id, existingUser] of users) {
        if (existingUser.username === username && existingUser.id !== user.id) {
          usernameExists = true;
          break;
        }
      }
      
      if (usernameExists) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }
      user.username = username;
    }
    
    // Update bio
    if (bio !== undefined) {
      user.bio = bio;
    }
    
    // Update last seen
    user.lastSeen = new Date();

    // Save data
    saveData();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: user.toPublicJSON()
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
router.post('/upload-avatar', authenticateUser, (req, res) => {
  try {
    const { avatarData } = req.body;
    const user = req.user;

    console.log('📸 Uploading profile picture for:', user.username);

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
    user.avatarUrl = avatarData;

    // Save data
    saveData();

    console.log('✅ Profile picture updated for:', user.username);

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      user: user.toPublicJSON()
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
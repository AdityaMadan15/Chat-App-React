import express from 'express';
import { users, saveData } from '../config/database.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// Change password
router.post('/change-password', authenticateUser, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Validate current password
    if (!user.validatePassword(currentPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = user.hashPassword(newPassword);

    // Save data
    saveData();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});

// Update notification settings
router.post('/notifications', authenticateUser, (req, res) => {
  try {
    const { settings } = req.body;
    const user = req.user;

    // Initialize user settings if not exists
    if (!user.settings) user.settings = {};
    if (!user.settings.notifications) user.settings.notifications = {};

    // Update notification settings
    user.settings.notifications = { 
      messageNotifications: true, // Defaults
      soundAlerts: true,
      desktopNotifications: false,
      ...settings 
    };

    // Save data
    saveData();

    res.json({
      success: true,
      message: 'Notification settings updated',
      settings: user.settings.notifications
    });

  } catch (error) {
    console.error('Update notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification settings'
    });
  }
});

// Update privacy settings - REAL-TIME VERSION
router.post('/privacy', authenticateUser, async (req, res) => {
  try {
    const { settings } = req.body;
    const user = req.user;

    console.log('🔒 Updating privacy settings for:', user.username, settings);

    // Initialize user settings if not exists
    if (!user.settings) user.settings = {};
    if (!user.settings.privacy) user.settings.privacy = {};

    // Store previous settings to detect changes
    const previousSettings = { ...user.settings.privacy };

    // Update privacy settings with defaults
    user.settings.privacy = {
      readReceipts: true,
      typingIndicator: true, 
      onlineStatus: true,
      lastSeen: true,
      profilePhoto: true,
      ...settings
    };

    // Save data
    saveData();

    // Get io instance
    const io = req.app.get('io');
    
    if (io) {
      // Import friends dynamically
      const { friends } = await import('../config/database.js');
      
      // Find all friends
      const friendsList = Array.from(friends.values())
        .filter(f => 
          (f.userId === user.id || f.friendId === user.id) && 
          f.status === 'accepted'
        )
        .map(f => f.userId === user.id ? f.friendId : f.userId);

      // Notify each friend about privacy changes
      friendsList.forEach(friendId => {
        const friend = users.get(friendId);
        if (friend && friend.socketId) {
          io.to(friend.socketId).emit('friend-privacy-changed', {
            userId: user.id,
            username: user.username,
            privacy: user.settings.privacy,
            isOnline: user.settings.privacy.onlineStatus ? user.isOnline : false,
            lastSeen: user.settings.privacy.lastSeen ? user.lastSeen : null
          });
          console.log('📡 Privacy update sent to:', friend.username);
        }
      });
    }

    res.json({
      success: true,
      message: 'Privacy settings updated',
      settings: user.settings.privacy
    });

  } catch (error) {
    console.error('Update privacy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update privacy settings'
    });
  }
});

// Get current settings
router.get('/', authenticateUser, (req, res) => {
  try {
    const user = req.user;
    
    // Initialize defaults if not set
    if (!user.settings) user.settings = {};
    if (!user.settings.notifications) {
      user.settings.notifications = {
        messageNotifications: true,
        soundAlerts: true,
        desktopNotifications: false
      };
    }
    if (!user.settings.privacy) {
      user.settings.privacy = {
        readReceipts: true,
        typingIndicator: true,
        onlineStatus: true,
        lastSeen: true,
        profilePhoto: true
      };
    }

    res.json({
      success: true,
      settings: user.settings
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get settings'
    });
  }
});

export default router;
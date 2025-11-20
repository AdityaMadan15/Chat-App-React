import express from 'express';
import { UserOps, FriendOps } from '../config/mongodb.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// Change password
router.post('/change-password', authenticateUser, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id.toString();

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Validate current password
    const isValid = await req.user.validatePassword(currentPassword);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    await UserOps.updatePassword(userId, newPassword);

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
router.post('/notifications', authenticateUser, async (req, res) => {
  try {
    const { settings } = req.body;
    const userId = req.user._id.toString();

    // Update notification settings
    const updatedSettings = {
      messageNotifications: true,
      soundAlerts: true,
      desktopNotifications: false,
      ...settings
    };

    await UserOps.updateNotificationSettings(userId, updatedSettings);

    res.json({
      success: true,
      message: 'Notification settings updated',
      settings: updatedSettings
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
    const userId = req.user._id.toString();

    console.log('🔒 Updating privacy settings for:', req.user.username, settings);

    // Update privacy settings with defaults
    const privacySettings = {
      readReceipts: true,
      typingIndicator: true, 
      onlineStatus: true,
      lastSeen: true,
      profilePhoto: true,
      ...settings
    };

    await UserOps.updatePrivacySettings(userId, privacySettings);

    // Get updated user
    const user = await UserOps.findById(userId);

    // Get io instance
    const io = req.app.get('io');
    
    if (io) {
      // Find all friends
      const friendsList = await FriendOps.getUserFriends(userId);

      // Notify each friend about privacy changes
      for (const friendship of friendsList) {
        const friendId = friendship.userId.toString() === userId ? friendship.friendId.toString() : friendship.userId.toString();
        const friend = await UserOps.findById(friendId);
        if (friend && friend.socketId) {
          io.to(friend.socketId).emit('friend-privacy-changed', {
            userId: user._id.toString(),
            username: user.username,
            privacy: user.settings.privacy,
            isOnline: user.settings.privacy.onlineStatus ? user.isOnline : false,
            lastSeen: user.settings.privacy.lastSeen ? user.lastSeen : null
          });
          console.log('📡 Privacy update sent to:', friend.username);
        }
      }
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
    const settings = {
      notifications: user.settings?.notifications || {
        messageNotifications: true,
        soundAlerts: true,
        desktopNotifications: false
      },
      privacy: user.settings?.privacy || {
        readReceipts: true,
        typingIndicator: true,
        onlineStatus: true,
        lastSeen: true,
        profilePhoto: true
      }
    };

    res.json({
      success: true,
      settings
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
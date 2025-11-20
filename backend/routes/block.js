import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { UserOps } from '../config/mongodb.js';

const router = express.Router();

// Block a user
router.post('/block/:userId', authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user._id.toString();
        const userIdToBlock = req.params.userId;

        if (currentUserId === userIdToBlock) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot block yourself' 
            });
        }

        const currentUser = await UserOps.findById(currentUserId);
        const userToBlock = await UserOps.findById(userIdToBlock);

        if (!currentUser || !userToBlock) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Check if already blocked
        const blockedUsers = currentUser.blockedUsers || [];
        if (blockedUsers.includes(userIdToBlock)) {
            return res.status(400).json({ 
                success: false, 
                message: 'User already blocked' 
            });
        }

        // Block the user
        await UserOps.blockUser(currentUserId, userIdToBlock);

        // Emit socket event to update UI immediately
        const io = req.app.get('io');
        if (currentUser.socketId) {
            io.to(currentUser.socketId).emit('user-blocked', {
                blockedUserId: userIdToBlock,
                timestamp: new Date()
            });
        }
        // Notify the blocked user if they're online
        if (userToBlock && userToBlock.socketId) {
            io.to(userToBlock.socketId).emit('blocked-by-user', {
                blockedByUserId: currentUserId,
                timestamp: new Date()
            });
        }

        res.json({ 
            success: true, 
            message: 'User blocked successfully',
            blockedUserId: userIdToBlock
        });
    } catch (error) {
        console.error('Block user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to block user' 
        });
    }
});

// Unblock a user
router.post('/unblock/:userId', authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user._id.toString();
        const userIdToUnblock = req.params.userId;

        const currentUser = await UserOps.findById(currentUserId);

        if (!currentUser) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Check if user is blocked
        const blockedUsers = currentUser.blockedUsers || [];
        if (!blockedUsers.includes(userIdToUnblock)) {
            return res.status(400).json({ 
                success: false, 
                message: 'User is not blocked' 
            });
        }

        // Unblock the user
        await UserOps.unblockUser(currentUserId, userIdToUnblock);

        // Emit socket event to update UI immediately
        const io = req.app.get('io');
        if (currentUser.socketId) {
            io.to(currentUser.socketId).emit('user-unblocked', {
                unblockedUserId: userIdToUnblock,
                timestamp: new Date()
            });
        }
        // Notify the unblocked user if they're online
        const unblockedUser = await UserOps.findById(userIdToUnblock);
        if (unblockedUser && unblockedUser.socketId) {
            io.to(unblockedUser.socketId).emit('unblocked-by-user', {
                unblockedByUserId: currentUserId,
                timestamp: new Date()
            });
        }

        res.json({ 
            success: true, 
            message: 'User unblocked successfully',
            unblockedUserId: userIdToUnblock
        });
    } catch (error) {
        console.error('Unblock user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to unblock user' 
        });
    }
});

// Get blocked users list
router.get('/list', authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user._id.toString();
        const currentUser = await UserOps.findById(currentUserId);

        if (!currentUser) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        const blockedUserIds = currentUser.blockedUsers || [];
        const blockedUsers = [];
        
        for (const id of blockedUserIds) {
            const user = await UserOps.findById(id);
            if (user) {
                blockedUsers.push({
                    id: user._id.toString(),
                    username: user.username,
                    avatarUrl: user.avatarUrl
                });
            }
        }

        res.json({ 
            success: true, 
            blockedUsers 
        });
    } catch (error) {
        console.error('Get blocked users error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get blocked users' 
        });
    }
});

// Check if a user is blocked
router.get('/check/:userId', authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user._id.toString();
        const otherUserId = req.params.userId;

        const currentUser = await UserOps.findById(currentUserId);
        const otherUser = await UserOps.findById(otherUserId);

        if (!currentUser || !otherUser) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        const blockedUserIds = currentUser.blockedUsers || [];
        const otherBlockedUserIds = otherUser.blockedUsers || [];

        const isBlocked = blockedUserIds.includes(otherUserId);
        const isBlockedBy = otherBlockedUserIds.includes(currentUserId);

        res.json({ 
            success: true, 
            isBlocked,
            isBlockedBy
        });
    } catch (error) {
        console.error('Check blocked error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to check blocked status' 
        });
    }
});

export function initBlockRoutes() {
    // No longer needed but keeping for backward compatibility
    return;
}

export default router;

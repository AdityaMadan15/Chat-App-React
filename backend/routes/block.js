import express from 'express';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// Get all routes need to import from database
let users, saveData;

// Initialize with database reference
export function initBlockRoutes(db) {
    users = db.users;
    saveData = db.saveData;
}

// Block a user
router.post('/block/:userId', authenticateUser, (req, res) => {
    try {
        const currentUserId = req.userId;
        const userIdToBlock = req.params.userId;

        if (currentUserId === userIdToBlock) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot block yourself' 
            });
        }

        const currentUser = users.get(currentUserId);
        const userToBlock = users.get(userIdToBlock);

        if (!currentUser || !userToBlock) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Initialize blockedUsers if not exists
        if (!currentUser.blockedUsers) {
            currentUser.blockedUsers = [];
        }

        // Check if already blocked
        if (currentUser.blockedUsers.includes(userIdToBlock)) {
            return res.status(400).json({ 
                success: false, 
                message: 'User already blocked' 
            });
        }

        // Block the user
        currentUser.blockedUsers.push(userIdToBlock);
        saveData();

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
router.post('/unblock/:userId', authenticateUser, (req, res) => {
    try {
        const currentUserId = req.userId;
        const userIdToUnblock = req.params.userId;

        const currentUser = users.get(currentUserId);

        if (!currentUser) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Initialize blockedUsers if not exists
        if (!currentUser.blockedUsers) {
            currentUser.blockedUsers = [];
        }

        // Check if user is blocked
        const index = currentUser.blockedUsers.indexOf(userIdToUnblock);
        if (index === -1) {
            return res.status(400).json({ 
                success: false, 
                message: 'User is not blocked' 
            });
        }

        // Unblock the user
        currentUser.blockedUsers.splice(index, 1);
        saveData();

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
router.get('/list', authenticateUser, (req, res) => {
    try {
        const currentUserId = req.userId;
        const currentUser = users.get(currentUserId);

        if (!currentUser) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        const blockedUserIds = currentUser.blockedUsers || [];
        const blockedUsers = blockedUserIds
            .map(id => users.get(id))
            .filter(user => user)
            .map(user => ({
                id: user.id,
                username: user.username,
                avatarUrl: user.avatarUrl
            }));

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
router.get('/check/:userId', authenticateUser, (req, res) => {
    try {
        const currentUserId = req.userId;
        const otherUserId = req.params.userId;

        const currentUser = users.get(currentUserId);
        const otherUser = users.get(otherUserId);

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

export default router;

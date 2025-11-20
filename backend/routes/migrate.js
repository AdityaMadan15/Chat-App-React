import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { UserOps, MessageOps, FriendOps } from '../config/mongodb.js';
import UserSchema from '../models/UserSchema.js';
import MessageSchema from '../models/MessageSchema.js';
import FriendSchema from '../models/FriendSchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// One-time data import from JSON files
router.post('/import-json-data', async (req, res) => {
    try {
        console.log('🔄 Starting JSON data import...');
        
        // User ID mapping: old UUID -> new MongoDB ObjectId
        const userIdMap = new Map();
        
        // Clear existing data
        await UserSchema.deleteMany({});
        await MessageSchema.deleteMany({});
        await FriendSchema.deleteMany({});
        console.log('🗑️  Cleared existing data');
        
        // Import Users
        const usersData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/users.json'), 'utf8'));
        console.log(`📊 Importing ${usersData.length} users...`);
        
        for (const oldUser of usersData) {
            const user = new UserSchema({
                username: oldUser.username,
                email: oldUser.email,
                passwordHash: oldUser.password, // Use existing bcrypt hash
                avatarUrl: oldUser.avatar || `https://ui-avatars.com/api/?name=${oldUser.username}&background=random`,
                bio: oldUser.status || 'Hey there! I am using this chat app.',
                isOnline: false,
                lastSeen: oldUser.lastSeen || new Date(),
                blockedUsers: oldUser.blockedUsers || [],
                settings: oldUser.settings || {
                    notifications: true,
                    soundEnabled: true,
                    theme: 'light'
                }
            });
            
            await user.save();
            userIdMap.set(oldUser.id, user._id.toString());
            console.log(`✅ ${oldUser.username}: ${oldUser.id} -> ${user._id}`);
        }
        
        // Import Friends
        const friendsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/friends.json'), 'utf8'));
        console.log(`👥 Importing ${friendsData.length} friend relationships...`);
        
        for (const oldFriend of friendsData) {
            const newUserId = userIdMap.get(oldFriend.userId);
            const newFriendId = userIdMap.get(oldFriend.friendId);
            
            if (newUserId && newFriendId) {
                const friend = new FriendSchema({
                    userId: newUserId,
                    friendId: newFriendId,
                    status: oldFriend.status,
                    createdAt: oldFriend.createdAt,
                    acceptedAt: oldFriend.acceptedAt
                });
                
                await friend.save();
            }
        }
        
        // Import Messages
        const messagesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/messages.json'), 'utf8'));
        console.log('💬 Importing messages...');
        
        let totalMessages = 0;
        for (const [conversationKey, messages] of Object.entries(messagesData)) {
            for (const oldMsg of messages) {
                const newSenderId = userIdMap.get(oldMsg.senderId);
                const newReceiverId = userIdMap.get(oldMsg.receiverId);
                
                if (newSenderId && newReceiverId) {
                    const conversationId = [newSenderId, newReceiverId].sort().join('-');
                    
                    const message = new MessageSchema({
                        conversationId: conversationId,
                        senderId: newSenderId,
                        receiverId: newReceiverId,
                        content: oldMsg.content,
                        messageType: oldMsg.messageType || 'text',
                        timestamp: oldMsg.timestamp,
                        isRead: oldMsg.isRead || false,
                        status: oldMsg.status || 'sent',
                        reactions: oldMsg.reactions || {},
                        deletedFor: (oldMsg.deletedFor || []).map(id => userIdMap.get(id)).filter(Boolean),
                        isDeletedForEveryone: oldMsg.isDeletedForEveryone || false
                    });
                    
                    await message.save();
                    totalMessages++;
                }
            }
        }
        
        console.log(`✅ Imported ${totalMessages} messages`);
        
        res.json({
            success: true,
            message: 'Data import completed successfully',
            stats: {
                users: usersData.length,
                friends: friendsData.length,
                messages: totalMessages
            },
            userMapping: Array.from(userIdMap.entries()).map(([oldId, newId]) => ({
                oldId,
                newId
            }))
        });
        
    } catch (error) {
        console.error('❌ Import error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

export default router;

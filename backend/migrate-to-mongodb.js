import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import UserSchema from './models/UserSchema.js';
import MessageSchema from './models/MessageSchema.js';
import FriendSchema from './models/FriendSchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';

async function migrateData() {
    try {
        console.log('🔄 Starting data migration to MongoDB...');
        
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Clear existing data
        await UserSchema.deleteMany({});
        await MessageSchema.deleteMany({});
        await FriendSchema.deleteMany({});
        console.log('🗑️  Cleared existing MongoDB data');
        
        // Migrate Users
        const usersFile = path.join(DATA_DIR, 'users.json');
        if (fs.existsSync(usersFile)) {
            const usersData = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
            console.log(`📊 Migrating ${usersData.length} users...`);
            
            for (const userData of usersData) {
                const user = new UserSchema({
                    _id: userData.id,
                    username: userData.username,
                    email: userData.email,
                    passwordHash: userData.passwordHash,
                    avatar: userData.avatar,
                    status: userData.status,
                    isOnline: false,
                    lastSeen: userData.lastSeen,
                    blockedUsers: userData.blockedUsers || [],
                    settings: userData.settings || {},
                    createdAt: userData.createdAt || new Date()
                });
                await user.save();
            }
            console.log(`✅ Migrated ${usersData.length} users`);
        }
        
        // Migrate Friends
        const friendsFile = path.join(DATA_DIR, 'friends.json');
        if (fs.existsSync(friendsFile)) {
            const friendsData = JSON.parse(fs.readFileSync(friendsFile, 'utf8'));
            console.log(`📊 Migrating ${friendsData.length} friend relationships...`);
            
            for (const friendData of friendsData) {
                const friend = new FriendSchema({
                    _id: friendData.id,
                    userId: friendData.userId,
                    friendId: friendData.friendId,
                    status: friendData.status,
                    createdAt: friendData.createdAt || new Date()
                });
                await friend.save();
            }
            console.log(`✅ Migrated ${friendsData.length} friend relationships`);
        }
        
        // Migrate Messages
        const messagesFile = path.join(DATA_DIR, 'messages.json');
        if (fs.existsSync(messagesFile)) {
            const messagesData = JSON.parse(fs.readFileSync(messagesFile, 'utf8'));
            const conversationIds = Object.keys(messagesData);
            console.log(`📊 Migrating ${conversationIds.length} conversations...`);
            
            let totalMessages = 0;
            for (const conversationId of conversationIds) {
                const messages = messagesData[conversationId];
                
                for (const msgData of messages) {
                    const message = new MessageSchema({
                        _id: msgData.id,
                        senderId: msgData.senderId,
                        receiverId: msgData.receiverId,
                        conversationId: conversationId,
                        content: msgData.content,
                        messageType: msgData.messageType || 'text',
                        timestamp: msgData.timestamp,
                        isRead: msgData.isRead || false,
                        status: msgData.status || 'sent',
                        deliveredAt: msgData.deliveredAt,
                        readAt: msgData.readAt,
                        reactions: msgData.reactions ? new Map(Object.entries(msgData.reactions)) : new Map(),
                        deletedFor: msgData.deletedFor || [],
                        isDeletedForEveryone: msgData.isDeletedForEveryone || false,
                        deletedAt: msgData.deletedAt
                    });
                    await message.save();
                    totalMessages++;
                }
            }
            console.log(`✅ Migrated ${totalMessages} messages`);
        }
        
        console.log('🎉 Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration error:', error);
        process.exit(1);
    }
}

migrateData();

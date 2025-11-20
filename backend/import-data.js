import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import UserSchema from './models/UserSchema.js';
import MessageSchema from './models/MessageSchema.js';
import FriendSchema from './models/FriendSchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://chat-app:cE4BS90MyFZ0UewV@cluster0.gubg622.mongodb.net/chatapp';

// User ID mapping: old UUID -> new MongoDB ObjectId
const userIdMap = new Map();

async function importData() {
    try {
        console.log('🔄 Starting data import to MongoDB...');
        
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Clear existing data
        await UserSchema.deleteMany({});
        await MessageSchema.deleteMany({});
        await FriendSchema.deleteMany({});
        console.log('🗑️  Cleared existing MongoDB data');
        
        // Import Users
        console.log('\n📊 Importing users...');
        const usersData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'users.json'), 'utf8'));
        
        for (const oldUser of usersData) {
            const user = new UserSchema({
                username: oldUser.username,
                email: oldUser.email,
                passwordHash: oldUser.password, // Use the existing bcrypt hash
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
            console.log(`✅ Imported user: ${user.username} (${oldUser.id} -> ${user._id})`);
        }
        
        // Import Friends
        console.log('\n👥 Importing friend relationships...');
        const friendsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'friends.json'), 'utf8'));
        
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
                console.log(`✅ Imported friendship: ${newUserId} <-> ${newFriendId}`);
            }
        }
        
        // Import Messages
        console.log('\n💬 Importing messages...');
        const messagesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'messages.json'), 'utf8'));
        
        let totalMessages = 0;
        for (const [conversationKey, messages] of Object.entries(messagesData)) {
            for (const oldMsg of messages) {
                const newSenderId = userIdMap.get(oldMsg.senderId);
                const newReceiverId = userIdMap.get(oldMsg.receiverId);
                
                if (newSenderId && newReceiverId) {
                    // Create sorted conversation ID (same format as backend)
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
        
        console.log('\n✅ Data import completed successfully!');
        console.log('\n📝 User ID Mapping:');
        for (const [oldId, newId] of userIdMap.entries()) {
            const user = await UserSchema.findById(newId);
            console.log(`   ${user.username}: ${oldId} -> ${newId}`);
        }
        
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
        
    } catch (error) {
        console.error('\n❌ Import error:', error);
        process.exit(1);
    }
}

importData();

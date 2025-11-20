import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import UserSchema from '../models/UserSchema.js';
import MessageSchema from '../models/MessageSchema.js';
import FriendSchema from '../models/FriendSchema.js';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';

// In-memory caches for faster access
export const onlineUsers = new Map();

// Connect to MongoDB
export async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Check user count
        const userCount = await UserSchema.countDocuments();
        console.log(`📊 Database has ${userCount} users`);
        
        if (userCount === 0) {
            console.log('⚠️ Database is empty! Please run: node backend/import-data.js');
        }
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

// User operations
export const UserOps = {
    async findById(id) {
        // Validate ObjectId format to prevent crashes
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            console.log('⚠️ Invalid ObjectId format:', id);
            return null;
        }
        return await UserSchema.findById(id);
    },
    
    async findByUsername(username) {
        return await UserSchema.findOne({ username });
    },
    
    async findByEmail(email) {
        return await UserSchema.findOne({ email: email.toLowerCase() });
    },
    
    async create(userData) {
        const user = new UserSchema(userData);
        if (userData.password) {
            await user.hashPassword(userData.password);
        }
        return await user.save();
    },
    
    async update(id, updates) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return null;
        }
        return await UserSchema.findByIdAndUpdate(id, updates, { new: true });
    },
    
    async getAll() {
        return await UserSchema.find({});
    },
    
    async search(query) {
        return await UserSchema.find({
            username: { $regex: query, $options: 'i' }
        }).limit(10);
    },
    
    async updateOnlineStatus(userId, isOnline, socketId = null) {
        const updates = { isOnline };
        if (!isOnline) {
            updates.lastSeen = new Date();
        }
        if (socketId) {
            updates.socketId = socketId;
        }
        return await UserSchema.findByIdAndUpdate(userId, updates, { new: true });
    },
    
    async findByUsernameOrEmail(username, email) {
        return await UserSchema.findOne({
            $or: [
                { username },
                { email: email?.toLowerCase() }
            ]
        });
    }
};

// Message operations
export const MessageOps = {
    async create(messageData) {
        const message = new MessageSchema(messageData);
        return await message.save();
    },
    
    async findByConversation(conversationId) {
        return await MessageSchema.find({ conversationId })
            .sort({ timestamp: 1 });
    },
    
    async findById(id) {
        return await MessageSchema.findById(id);
    },
    
    async update(id, updates) {
        return await MessageSchema.findByIdAndUpdate(id, updates, { new: true });
    },
    
    async updateMany(filter, updates) {
        return await MessageSchema.updateMany(filter, updates);
    },
    
    async getRecentConversations(userId) {
        const messages = await MessageSchema.aggregate([
            {
                $match: {
                    $or: [{ senderId: userId }, { receiverId: userId }]
                }
            },
            {
                $sort: { timestamp: -1 }
            },
            {
                $group: {
                    _id: '$conversationId',
                    lastMessage: { $first: '$$ROOT' }
                }
            }
        ]);
        
        return messages.map(m => m.lastMessage);
    },
    
    async getConversation(conversationId) {
        return await this.findByConversation(conversationId);
    }
};

// Friend operations
export const FriendOps = {
    async create(userId, friendId, status = 'pending') {
        const friend = new FriendSchema({ userId, friendId, status });
        return await friend.save();
    },
    
    async findByUsers(userId, friendId) {
        return await FriendSchema.findOne({
            $or: [
                { userId, friendId },
                { userId: friendId, friendId: userId }
            ]
        });
    },
    
    async findByUser(userId) {
        return await FriendSchema.find({
            $or: [{ userId }, { friendId: userId }]
        });
    },
    
    async findPendingRequests(userId) {
        return await FriendSchema.find({
            friendId: userId,
            status: 'pending'
        });
    },
    
    async update(id, updates) {
        return await FriendSchema.findByIdAndUpdate(id, updates, { new: true });
    },
    
    async delete(id) {
        return await FriendSchema.findByIdAndDelete(id);
    },
    
    async getAcceptedFriends(userId) {
        return await FriendSchema.find({
            $or: [{ userId }, { friendId: userId }],
            status: 'accepted'
        });
    },
    
    async getUserFriends(userId) {
        return await this.getAcceptedFriends(userId);
    },
    
    async getPendingRequests(userId) {
        return await this.findPendingRequests(userId);
    },
    
    async areFriends(userId1, userId2) {
        const friendship = await this.findByUsers(userId1, userId2);
        return friendship && friendship.status === 'accepted';
    }
};

// Helper to get conversation ID
export function getConversationId(userId1, userId2) {
    return [userId1, userId2].sort().join('-');
}

export default {
    connectDB,
    UserOps,
    MessageOps,
    FriendOps,
    onlineUsers,
    getConversationId
};

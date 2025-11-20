import mongoose from 'mongoose';
import UserSchema from '../models/UserSchema.js';
import MessageSchema from '../models/MessageSchema.js';
import FriendSchema from '../models/FriendSchema.js';
import bcrypt from 'bcryptjs';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';

// In-memory caches for faster access
export const onlineUsers = new Map();

// Connect to MongoDB
export async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Create default users if database is empty
        const userCount = await UserSchema.countDocuments();
        if (userCount === 0) {
            await createDefaultUsers();
        }
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

// Create default users
async function createDefaultUsers() {
    try {
        console.log('👥 Creating default users...');
        
        const user1 = new UserSchema({
            username: 'Ani',
            email: 'ani@example.com',
            passwordHash: await bcrypt.hash('password123', 10),
            status: 'Hey there! I am using ChatApp'
        });
        
        const user2 = new UserSchema({
            username: 'Maddy',
            email: 'maddy@example.com',
            passwordHash: await bcrypt.hash('password123', 10),
            status: 'Available to chat!'
        });
        
        await user1.save();
        await user2.save();
        
        console.log('✅ Created default users: Ani & Maddy (password: password123)');
    } catch (error) {
        console.error('❌ Error creating default users:', error);
    }
}

// User operations
export const UserOps = {
    async findById(id) {
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
        return await UserSchema.findByIdAndUpdate(id, updates, { new: true });
    },
    
    async getAll() {
        return await UserSchema.find({});
    },
    
    async search(query) {
        return await UserSchema.find({
            username: { $regex: query, $options: 'i' }
        }).limit(10);
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

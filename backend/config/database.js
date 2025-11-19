import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Friend from '../models/Friend.js';
import Message from '../models/Message.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Data storage
export const users = new Map();
export const friends = new Map();
export const messages = new Map();
export const friendRequests = new Map();
export const onlineUsers = new Map();

// File paths
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const FRIENDS_FILE = path.join(DATA_DIR, 'friends.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Enhanced user reconstruction that preserves methods
function reconstructUser(userData) {
    try {
        // Create new User instance with dummy password
        const user = new User(userData.username, userData.email, 'temporary');
        
        // Copy all properties from saved data
        Object.keys(userData).forEach(key => {
            user[key] = userData[key];
        });
        
        // Re-bind methods to ensure they work properly
        user.validatePassword = user._validatePassword.bind(user);
        user.hashPassword = user._hashPassword.bind(user);
        user.setOnline = user.setOnline.bind(user);
        user.setOffline = user.setOffline.bind(user);
        user.toPublicJSON = user.toPublicJSON.bind(user);
        
        return user;
    } catch (error) {
        console.error('❌ Error reconstructing user:', userData.username, error);
        return null;
    }
}

// Load data from files
export function loadData() {
    try {
        // Clear existing data
        users.clear();
        friends.clear();
        messages.clear();

        // Load users - FIXED: Proper reconstruction with method preservation
        if (fs.existsSync(USERS_FILE)) {
            const usersData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            console.log(`📊 Found ${usersData.length} users in file`);
            
            let loadedCount = 0;
            usersData.forEach(userData => {
                const user = reconstructUser(userData);
                if (user) {
                    users.set(user.id, user);
                    loadedCount++;
                    console.log(`✅ Loaded user: ${user.username}`);
                }
            });
            console.log(`✅ Successfully loaded ${loadedCount}/${usersData.length} users`);
        } else {
            console.log('📝 No users file found, starting fresh');
            // Create default users if no file exists
            createDefaultUsers();
        }

        // Load friends
        if (fs.existsSync(FRIENDS_FILE)) {
            const friendsData = JSON.parse(fs.readFileSync(FRIENDS_FILE, 'utf8'));
            console.log(`📊 Found ${friendsData.length} friends in file`);
            
            friendsData.forEach(friendData => {
                try {
                    const friend = new Friend(friendData.userId, friendData.friendId);
                    Object.assign(friend, friendData);
                    friends.set(friend.id, friend);
                } catch (error) {
                    console.error('❌ Error loading friend relationship:', error);
                }
            });
            console.log(`✅ Loaded ${friends.size} friend relationships`);
        }

        // Load messages
        if (fs.existsSync(MESSAGES_FILE)) {
            const messagesData = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
            console.log(`📊 Found ${Object.keys(messagesData).length} conversations in file`);
            
            Object.keys(messagesData).forEach(key => {
                try {
                    const conversationData = messagesData[key];
                    
                    if (Array.isArray(conversationData)) {
                        const conversationMessages = conversationData.map(msgData => {
                            try {
                                // Create base message
                                const message = new Message(
                                    msgData.senderId, 
                                    msgData.receiverId, 
                                    msgData.content, 
                                    msgData.messageType || 'text'
                                );
                                
                                // Preserve all fields including status, timestamps, etc.
                                message.id = msgData.id;
                                message.timestamp = msgData.timestamp ? new Date(msgData.timestamp) : message.timestamp;
                                message.isRead = msgData.isRead || false;
                                message.status = msgData.status || 'sent';
                                message.deliveredAt = msgData.deliveredAt ? new Date(msgData.deliveredAt) : null;
                                message.readAt = msgData.readAt ? new Date(msgData.readAt) : null;
                                message.reactions = msgData.reactions || {};
                                message.deletedFor = msgData.deletedFor || [];
                                message.isDeletedForEveryone = msgData.isDeletedForEveryone || false;
                                message.deletedAt = msgData.deletedAt ? new Date(msgData.deletedAt) : null;
                                
                                return message;
                            } catch (error) {
                                console.error('❌ Error creating message:', error);
                                return null;
                            }
                        }).filter(msg => msg !== null);
                        
                        messages.set(key, conversationMessages);
                        console.log(`💬 Loaded conversation ${key} with ${conversationMessages.length} messages`);
                    } else {
                        console.log(`⚠️ Conversation ${key} is not an array, initializing empty`);
                        messages.set(key, []);
                    }
                } catch (error) {
                    console.error(`❌ Error loading conversation ${key}:`, error);
                    messages.set(key, []);
                }
            });
            console.log(`✅ Loaded ${messages.size} conversations`);
        } else {
            console.log('📝 No messages file found, starting fresh');
        }
    } catch (error) {
        console.error('❌ Critical error loading data:', error);
        // Initialize with default users if loading fails
        createDefaultUsers();
    }
}

// Create default users for first-time setup
function createDefaultUsers() {
    console.log('👥 Creating default users...');
    
    const user1 = new User('Ani', 'ani@example.com', 'password123');
    const user2 = new User('Maddy', 'maddy@example.com', 'password123');
    
    users.set(user1.id, user1);
    users.set(user2.id, user2);
    
    console.log('✅ Created default users: Ani & Maddy (password: password123)');
    saveData();
}

// Save data to files
export function saveData() {
    try {
        const usersData = Array.from(users.values());
        const friendsData = Array.from(friends.values());
        const messagesData = Object.fromEntries(messages);

        fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2));
        fs.writeFileSync(FRIENDS_FILE, JSON.stringify(friendsData, null, 2));
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messagesData, null, 2));

        console.log(`💾 Data saved: ${usersData.length} users, ${friendsData.length} friends, ${Object.keys(messagesData).length} conversations`);
    } catch (error) {
        console.error('❌ Error saving data:', error);
    }
}

// Auto-save every 30 seconds
export function startAutoSave() {
    loadData(); // Load existing data on start
    setInterval(saveData, 30000);
    console.log('🔄 Auto-save enabled (every 30 seconds)');
}
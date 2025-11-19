import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export default class User {
    constructor(username, email, password) {
        this.id = uuidv4();
        this.username = username;
        this.email = email;
        this.password = this._hashPassword(password);
        this.avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=6366f1&color=fff`;
        this.bio = "Hey there! I'm using ChatApp";
        this.isOnline = false;
        this.socketId = null;
        this.lastSeen = new Date();
        this.blockedUsers = []; // Array of blocked user IDs
        this.settings = {
            privacy: {
                readReceipts: true,
                typingIndicator: true,
                onlineStatus: true,
                lastSeen: true,
                profilePhoto: true
            },
            notifications: {
                messageNotifications: true,
                soundAlerts: true,
                desktopNotifications: false
            }
        };
        this.createdAt = new Date();
        
        // Bind methods to ensure they work after JSON serialization
        this.validatePassword = this._validatePassword.bind(this);
        this.hashPassword = this._hashPassword.bind(this);
        this.setOnline = this.setOnline.bind(this);
        this.setOffline = this.setOffline.bind(this);
        this.toPublicJSON = this.toPublicJSON.bind(this);
    }

    _hashPassword(password) {
        try {
            const saltRounds = 10;
            return bcrypt.hashSync(password, saltRounds);
        } catch (error) {
            console.error('Password hashing error:', error);
            return password; // Fallback
        }
    }

    _validatePassword(password) {
        try {
            // Try bcrypt comparison
            if (bcrypt.compareSync(password, this.password)) {
                return true;
            }
            
            // Fallback for plain text passwords (for existing data)
            if (password === this.password) {
                console.log('🔄 Upgrading plain text password to hashed for:', this.username);
                this.password = this._hashPassword(password);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Password validation error:', error);
            return password === this.password;
        }
    }

    setOnline(socketId) {
        this.isOnline = true;
        this.socketId = socketId;
        this.lastSeen = new Date();
    }

    setOffline() {
        this.isOnline = false;
        this.socketId = null;
        this.lastSeen = new Date();
    }

    toPublicJSON() {
        // Check privacy settings for each field
        const showProfilePhoto = !this.settings?.privacy || this.settings.privacy.profilePhoto !== false;
        const showOnlineStatus = !this.settings?.privacy || this.settings.privacy.onlineStatus !== false;
        const showLastSeen = !this.settings?.privacy || this.settings.privacy.lastSeen !== false;
        
        return {
            id: this.id,
            username: this.username,
            email: this.email,
            avatarUrl: showProfilePhoto ? this.avatarUrl : null,
            bio: this.bio,
            isOnline: showOnlineStatus ? this.isOnline : false,
            lastSeen: showLastSeen ? this.lastSeen : null,
            settings: this.settings
        };
    }

    toJSON() {
        return {
            id: this.id,
            username: this.username,
            email: this.email,
            password: this.password, // Include password for persistence
            avatarUrl: this.avatarUrl,
            bio: this.bio,
            isOnline: this.isOnline,
            socketId: this.socketId,
            lastSeen: this.lastSeen,
            blockedUsers: this.blockedUsers || [],
            settings: this.settings,
            createdAt: this.createdAt
        };
    }
}
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: null
  },
  status: {
    type: String,
    default: 'Hey there! I am using ChatApp'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  socketId: {
    type: String,
    default: null
  },
  blockedUsers: [{
    type: String
  }],
  settings: {
    notifications: {
      messageNotifications: { type: Boolean, default: true },
      friendRequests: { type: Boolean, default: true }
    },
    privacy: {
      onlineStatus: { type: Boolean, default: true },
      lastSeen: { type: Boolean, default: true },
      readReceipts: { type: Boolean, default: true },
      typingIndicator: { type: Boolean, default: true }
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Method to validate password
userSchema.methods.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.passwordHash);
};

// Method to hash password
userSchema.methods.hashPassword = async function(password) {
  this.passwordHash = await bcrypt.hash(password, 10);
};

// Method to get public JSON (without sensitive data)
userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    avatar: this.avatar,
    status: this.status,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
    blockedUsers: this.blockedUsers || [],
    settings: this.settings,
    createdAt: this.createdAt
  };
};

export default mongoose.model('User', userSchema);

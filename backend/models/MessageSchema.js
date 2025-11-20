import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  senderId: {
    type: String,
    required: true,
    index: true
  },
  receiverId: {
    type: String,
    required: true,
    index: true
  },
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  messageType: {
    type: String,
    default: 'text',
    enum: ['text', 'image', 'file', 'voice']
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    default: 'sent',
    enum: ['sending', 'sent', 'delivered', 'read', 'failed']
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  readAt: {
    type: Date,
    default: null
  },
  reactions: {
    type: Map,
    of: String,
    default: new Map()
  },
  deletedFor: [{
    type: String
  }],
  isDeletedForEveryone: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index for efficient conversation queries
messageSchema.index({ conversationId: 1, timestamp: -1 });
messageSchema.index({ senderId: 1, receiverId: 1 });

export default mongoose.model('Message', messageSchema);

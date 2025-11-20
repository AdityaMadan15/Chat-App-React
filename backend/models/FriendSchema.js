import mongoose from 'mongoose';

const friendSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  friendId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'accepted', 'blocked'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate friend relationships
friendSchema.index({ userId: 1, friendId: 1 }, { unique: true });

export default mongoose.model('Friend', friendSchema);

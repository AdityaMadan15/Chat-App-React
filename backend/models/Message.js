import { v4 as uuidv4 } from 'uuid';

export default class Message {
    constructor(senderId, receiverId, content, messageType = 'text') {
        this.id = uuidv4();
        this.senderId = senderId;
        this.receiverId = receiverId;
        this.content = content;
        this.messageType = messageType;
        this.timestamp = new Date();
        this.isRead = false;
        this.status = 'sent'; // sent, delivered, read
        this.deliveredAt = null;
        this.readAt = null;
        this.reactions = {}; // {userId: emoji}
        this.deletedFor = []; // Array of user IDs who deleted this message
        this.isDeletedForEveryone = false;
        this.deletedAt = null;
    }

    markAsRead() {
        this.isRead = true;
        this.status = 'read';
        this.readAt = new Date();
    }

    markAsDelivered() {
        this.status = 'delivered';
        this.deliveredAt = new Date();
    }

    addReaction(userId, emoji) {
        this.reactions[userId] = emoji;
    }

    removeReaction(userId) {
        delete this.reactions[userId];
    }

    deleteForUser(userId) {
        if (!this.deletedFor.includes(userId)) {
            this.deletedFor.push(userId);
        }
    }

    deleteForEveryone() {
        this.isDeletedForEveryone = true;
        this.deletedAt = new Date();
    }

    canDeleteForEveryone(userId) {
        // Can delete for everyone if: sender and within 1 hour
        const oneHour = 60 * 60 * 1000;
        const timeSinceSent = new Date() - new Date(this.timestamp);
        return this.senderId === userId && timeSinceSent < oneHour;
    }

    toJSON() {
        return {
            id: this.id,
            senderId: this.senderId,
            receiverId: this.receiverId,
            content: this.content,
            messageType: this.messageType,
            timestamp: this.timestamp,
            isRead: this.isRead,
            status: this.status,
            deliveredAt: this.deliveredAt,
            readAt: this.readAt,
            reactions: this.reactions || {},
            deletedFor: this.deletedFor || [],
            isDeletedForEveryone: this.isDeletedForEveryone || false,
            deletedAt: this.deletedAt
        };
    }
}
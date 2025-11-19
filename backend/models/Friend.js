import { v4 as uuidv4 } from 'uuid';

export default class Friend {
    constructor(userId, friendId) {
        this.id = uuidv4();
        this.userId = userId;
        this.friendId = friendId;
        this.status = 'pending'; // pending, accepted, declined
        this.createdAt = new Date();
        this.acceptedAt = null;
    }

    accept() {
        this.status = 'accepted';
        this.acceptedAt = new Date();
    }

    decline() {
        this.status = 'declined';
    }

    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            friendId: this.friendId,
            status: this.status,
            createdAt: this.createdAt,
            acceptedAt: this.acceptedAt
        };
    }
}
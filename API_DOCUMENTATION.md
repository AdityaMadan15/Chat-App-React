# 📡 Chat App API Documentation

## Authentication

All API requests (except login/register) require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

---

## 🚫 Block API

### 1. Block User
**POST** `/api/block/block/:userId`

Block a specific user. Prevents all communication between you and the blocked user.

**Parameters:**
- `userId` (URL param) - ID of user to block

**Response:**
```json
{
  "message": "User blocked successfully"
}
```

**Error Responses:**
- `404` - User not found
- `400` - Cannot block yourself

---

### 2. Unblock User
**POST** `/api/block/unblock/:userId`

Unblock a previously blocked user.

**Parameters:**
- `userId` (URL param) - ID of user to unblock

**Response:**
```json
{
  "message": "User unblocked successfully"
}
```

---

### 3. Get Blocked Users List
**GET** `/api/block/list`

Get list of all users you have blocked.

**Response:**
```json
{
  "blockedUsers": ["user-id-1", "user-id-2"]
}
```

---

### 4. Check Block Status
**GET** `/api/block/check/:userId`

Check if you have blocked a user or if they have blocked you.

**Parameters:**
- `userId` (URL param) - ID of user to check

**Response:**
```json
{
  "isBlocked": false,      // You blocked them
  "isBlockedBy": false     // They blocked you
}
```

---

## 😊 Message Reactions API

### 1. Add/Update Reaction
**POST** `/api/messages/:messageId/react`

Add or update your reaction to a message. Each user can have one reaction per message.

**Parameters:**
- `messageId` (URL param) - ID of message to react to

**Request Body:**
```json
{
  "emoji": "❤️"
}
```

**Response:**
```json
{
  "message": "Reaction added",
  "reactions": {
    "user-id-1": "❤️",
    "user-id-2": "😂"
  }
}
```

**Socket Event Emitted:**
```javascript
socket.emit('message-reaction', {
  messageId: "msg-123",
  reactions: { ... }
});
```

**Supported Emojis:**
- ❤️ Love
- 😂 Laugh
- 👍 Like
- 👎 Dislike
- 😮 Wow
- 😢 Sad
- 🔥 Fire

---

### 2. Remove Reaction
**DELETE** `/api/messages/:messageId/react`

Remove your reaction from a message.

**Parameters:**
- `messageId` (URL param) - ID of message

**Response:**
```json
{
  "message": "Reaction removed",
  "reactions": {
    "user-id-2": "😂"
  }
}
```

**Socket Event Emitted:**
```javascript
socket.emit('message-reaction-removed', {
  messageId: "msg-123",
  reactions: { ... }
});
```

---

## 🗑️ Delete Messages API

### 1. Delete for Me
**POST** `/api/messages/:messageId/delete-for-me`

Hide a message from your view only. Other users can still see it.

**Parameters:**
- `messageId` (URL param) - ID of message to delete

**Response:**
```json
{
  "message": "Message deleted for you"
}
```

**Notes:**
- No time limit
- Works on any message (sent or received)
- Message persists for other users
- No socket event (only affects you)

---

### 2. Delete for Everyone
**POST** `/api/messages/:messageId/delete-for-everyone`

Delete a message for all participants in the conversation.

**Parameters:**
- `messageId` (URL param) - ID of message to delete

**Response:**
```json
{
  "message": "Message deleted for everyone"
}
```

**Error Responses:**
```json
{
  "error": "You can only delete your own messages"
}
```

```json
{
  "error": "Can only delete messages within 1 hour of sending"
}
```

**Socket Event Emitted:**
```javascript
socket.emit('message-deleted-everyone', {
  messageId: "msg-123"
});
```

**Restrictions:**
- ⏰ Only within **1 hour** of sending
- 👤 Only sender can delete
- 🔒 Server validates timestamp
- ✅ Cannot be undone

---

## 💬 Message Structure

### Message Model Fields

```javascript
{
  id: "msg-123",
  conversationId: "conv-456",
  senderId: "user-789",
  receiverId: "user-101",
  content: "Hello!",
  messageType: "text",        // text, image, file
  timestamp: "2024-01-15T10:30:00Z",
  status: "read",             // sent, delivered, read
  
  // New Fields
  reactions: {
    "user-789": "❤️",
    "user-101": "😂"
  },
  deletedFor: ["user-101"],   // Users who deleted for themselves
  isDeletedForEveryone: false,
  deletedAt: null
}
```

---

## 🔌 Socket.IO Events

### Client → Server

#### Send Message
```javascript
socket.emit('send-message', {
  receiverId: "user-123",
  content: "Hello!",
  messageType: "text",
  tempId: "temp-456"
});
```

**Server validates:**
- Neither user has blocked the other
- Both users are friends

---

### Server → Client

#### Message Sent
```javascript
socket.on('message-sent', (data) => {
  // data.success: boolean
  // data.message: Message object
  // data.message.tempId: temporary ID
});
```

#### Message Delivered
```javascript
socket.on('message-delivered', (data) => {
  // data.messageId: string
  // data.tempId: string
});
```

#### Messages Read
```javascript
socket.on('messages-read', (data) => {
  // data.messageIds: string[]
});
```

#### Message Reaction
```javascript
socket.on('message-reaction', (data) => {
  // data.messageId: string
  // data.reactions: { userId: emoji }
});
```

#### Reaction Removed
```javascript
socket.on('message-reaction-removed', (data) => {
  // data.messageId: string
  // data.reactions: { userId: emoji }
});
```

#### Message Deleted for Everyone
```javascript
socket.on('message-deleted-everyone', (data) => {
  // data.messageId: string
});
```

---

## 🔐 Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "error": "Invalid request parameters"
}
```

#### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

#### 403 Forbidden
```json
{
  "error": "Cannot send message to blocked user"
}
```

#### 404 Not Found
```json
{
  "error": "Message not found"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## 📊 Rate Limiting

Current implementation has no rate limiting. Consider adding:

```javascript
// Example rate limit
POST /api/messages/:id/react
- Max 10 reactions per minute per user
- Max 50 reactions per hour per user

POST /api/messages/:id/delete-for-everyone
- Max 5 deletions per minute per user
- Max 20 deletions per hour per user
```

---

## 🧪 Testing Examples

### cURL Examples

#### Block User
```bash
curl -X POST http://localhost:3001/api/block/block/user-123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Add Reaction
```bash
curl -X POST http://localhost:3001/api/messages/msg-456/react \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"emoji":"❤️"}'
```

#### Delete for Everyone
```bash
curl -X POST http://localhost:3001/api/messages/msg-456/delete-for-everyone \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### JavaScript Fetch Examples

#### Check Block Status
```javascript
const checkBlock = async (userId) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`http://localhost:3001/api/block/check/${userId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await response.json();
};
```

#### Add Reaction
```javascript
const addReaction = async (messageId, emoji) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`http://localhost:3001/api/messages/${messageId}/react`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ emoji })
  });
  return await response.json();
};
```

#### Delete for Me
```javascript
const deleteForMe = async (messageId) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`http://localhost:3001/api/messages/${messageId}/delete-for-me`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await response.json();
};
```

---

## 🔄 Data Persistence

All data is persisted to JSON files:

- `backend/data/users.json` - User data with blockedUsers
- `backend/data/messages.json` - Messages with reactions and deletion flags
- `backend/data/friends.json` - Friend relationships

**Reload on Server Start:**
- All message fields preserved (reactions, deletedFor, etc.)
- Blocked users list restored
- Message status maintained

---

## 🚀 Future API Endpoints (Ideas)

### Group Reactions
```
GET /api/messages/:id/reactions
- Get all reactions with user details
```

### Bulk Delete
```
POST /api/messages/bulk-delete
- Delete multiple messages at once
```

### Reaction Analytics
```
GET /api/messages/:id/reaction-stats
- Get reaction counts and most popular
```

### Block History
```
GET /api/block/history
- Get history of blocked/unblocked users
```

---

**Complete API is now documented and ready to use!** 📚

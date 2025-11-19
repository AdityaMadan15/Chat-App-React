import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket.jsx';
import DropdownMenu from './DropdownMenu.jsx';
import '../../styles/ChatWindow.css';
import API_URL from '../../config';

const ChatWindow = ({ user, chatData, onSendMessage, onRemoveFriend }) => {
  const { socket, isConnected } = useSocket();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  const [messageStatus, setMessageStatus] = useState({});
  const [pendingMessages, setPendingMessages] = useState(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, messageId: null });
  const [showReactionPicker, setShowReactionPicker] = useState({ show: false, messageId: null });
  const [messageReactions, setMessageReactions] = useState({});
  const [isBlocked, setIsBlocked] = useState(false);
  const [deletedMessages, setDeletedMessages] = useState(new Set());
  const [deletedForMeMessages, setDeletedForMeMessages] = useState(new Set());

  // Common emojis for quick access
  const commonEmojis = [
    '😀', '😂', '😊', '😍', '🥰', '😎', '🤔', '😢', '😭', '😡',
    '👍', '👎', '👏', '🙏', '💪', '❤️', '💕', '🔥', '✨', '🎉',
    '😴', '🤗', '🤩', '😱', '🥳', '🤯', '😇', '🤠', '🥺', '😏'
  ];

  // Reaction emojis
  const reactionEmojis = ['❤️', '😂', '👍', '👎', '😮', '😢', '🔥'];

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatData) {
      scrollToBottom();
      
      // Mark received messages as read
      const unreadMessages = chatData.messages.filter(
        msg => msg.type === 'received' && !msg.isRead
      );
      
      if (unreadMessages.length > 0 && socket && isConnected && chatData.friend) {
        const messageIds = unreadMessages.map(msg => msg.id);
        socket.emit('mark-as-read', {
          messageIds: messageIds,
          senderId: chatData.friend.id
        });
      }
    }
  }, [chatData, socket, isConnected]);

  // Check if user is blocked
  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!chatData || !chatData.friend) return;
      
      try {
        const loggedInUser = sessionStorage.getItem('loggedInUser');
        const userId = loggedInUser ? JSON.parse(loggedInUser).id : null;
        const response = await fetch(`${API_URL}/api/block/check/${chatData.friend.id}`, {
          headers: { 'Authorization': `Bearer ${userId}` }
        });
        const data = await response.json();
        setIsBlocked(data.isBlocked || data.isBlockedBy);
      } catch (error) {
        console.error('Error checking block status:', error);
      }
    };
    
    checkBlockStatus();
  }, [chatData]);

  // Setup socket listeners for this specific chat
  useEffect(() => {
    if (!socket || !chatData) return;

    // Listen for message delivery confirmation
    const handleMessageSent = (data) => {
      console.log('✅ Message sent confirmation:', data);
      if (data.success && data.message) {
        // Remove from pending messages
        setPendingMessages(prev => {
          const newPending = new Set(prev);
          newPending.delete(data.message.tempId);
          return newPending;
        });
        
        // Update message status
        setMessageStatus(prev => ({
          ...prev,
          [data.message.id]: 'sent',
          [data.message.tempId]: 'sent'
        }));
      }
    };

    // Listen for message delivered status
    const handleMessageDelivered = (data) => {
      console.log('📬 Message delivered:', data);
      setMessageStatus(prev => ({
        ...prev,
        [data.messageId]: 'delivered',
        [data.tempId]: 'delivered'
      }));
    };

    // Listen for message read status
    const handleMessagesRead = (data) => {
      console.log('👁️ Messages read:', data);
      const { messageIds } = data;
      setMessageStatus(prev => {
        const updated = { ...prev };
        messageIds.forEach(msgId => {
          updated[msgId] = 'read';
        });
        return updated;
      });
    };

    // Listen for message reactions
    const handleMessageReaction = (data) => {
      console.log('👍 Message reaction:', data);
      setMessageReactions(prev => ({
        ...prev,
        [data.messageId]: data.reactions
      }));
    };

    const handleReactionRemoved = (data) => {
      console.log('👎 Reaction removed:', data);
      setMessageReactions(prev => ({
        ...prev,
        [data.messageId]: data.reactions
      }));
    };

    // Listen for message deleted for everyone
    const handleMessageDeleted = (data) => {
      console.log('🗑️ Message deleted for everyone:', data);
      // Add message to deleted set for immediate UI update
      setDeletedMessages(prev => new Set(prev).add(data.messageId));
    };

    socket.on('message-sent', handleMessageSent);
    socket.on('message-delivered', handleMessageDelivered);
    socket.on('messages-read', handleMessagesRead);
    socket.on('message-reaction', handleMessageReaction);
    socket.on('message-reaction-removed', handleReactionRemoved);
    socket.on('message-deleted-everyone', handleMessageDeleted);

    return () => {
      socket.off('message-sent', handleMessageSent);
      socket.off('message-delivered', handleMessageDelivered);
      socket.off('messages-read', handleMessagesRead);
      socket.off('message-reaction', handleMessageReaction);
      socket.off('message-reaction-removed', handleReactionRemoved);
      socket.off('message-deleted-everyone', handleMessageDeleted);
    };
  }, [socket, chatData]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Early return after all hooks
  if (!chatData) {
    return <div className="no-chat-data">Select a chat to start messaging</div>;
  }

  const friend = chatData.friend;

  const handleSendMessage = (messageType = 'text', content = null) => {
    const messageContent = content || message.trim();
    if (!messageContent) return;

    // Generate unique temporary ID for local tracking
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('🚀 Sending message to:', friend.username, messageContent, 'Type:', messageType);

    // Add to pending messages for local optimistic update
    setPendingMessages(prev => new Set(prev).add(tempId));

    // Create temporary message for immediate display
    const tempMessage = {
      id: tempId,
      content: messageContent,
      senderId: user.id,
      sender: user.username,
      type: 'sent',
      messageType: messageType,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isTemp: true,
      timestamp: new Date().toISOString(),
      tempId: tempId
    };

    // Add to local state immediately for instant feedback (optimistic update)
    onSendMessage(friend.id, tempMessage);
    setMessage('');
    stopTyping();

    // Send via Socket.io
    if (socket && isConnected) {
      socket.emit('send-message', {
        receiverId: friend.id,
        content: messageContent,
        messageType: messageType,
        tempId: tempId
      });
      
      // Track message status
      setMessageStatus(prev => ({
        ...prev,
        [tempId]: 'sending'
      }));
    } else {
      console.error('❌ Socket not connected!');
      setMessageStatus(prev => ({
        ...prev,
        [tempId]: 'failed'
      }));
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage('text');
    }
  };

  const handleEmojiClick = (emoji) => {
    setMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const imageData = reader.result;
      handleSendMessage('image', imageData);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size should be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: reader.result
      };
      handleSendMessage('file', JSON.stringify(fileData));
    };
    reader.readAsDataURL(file);
  };

  const renderMessageContent = (msg) => {
    if (msg.messageType === 'image') {
      return (
        <div className="message-image">
          <img 
            src={msg.content} 
            alt="Shared image" 
            style={{ 
              maxWidth: '300px', 
              maxHeight: '300px', 
              borderRadius: '8px',
              cursor: 'pointer' 
            }}
            onClick={() => window.open(msg.content, '_blank')}
          />
        </div>
      );
    }

    if (msg.messageType === 'file') {
      try {
        const fileData = JSON.parse(msg.content);
        return (
          <div className="message-file">
            📎 <a href={fileData.data} download={fileData.name}>
              {fileData.name}
            </a>
            <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: '8px' }}>
              ({(fileData.size / 1024).toFixed(1)} KB)
            </span>
          </div>
        );
      } catch (e) {
        return <span>{msg.content}</span>;
      }
    }

    // Detect and render links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = msg.content.split(urlRegex);
    
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={i} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#4a9eff', textDecoration: 'underline' }}
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleTyping = () => {
    if (socket && isConnected && !isTyping) {
      socket.emit('typing-start', { receiverId: friend.id });
      setIsTyping(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1000);
  };

  const stopTyping = () => {
    if (socket && isConnected && isTyping) {
      socket.emit('typing-stop', { receiverId: friend.id });
      setIsTyping(false);
    }
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      const loggedInUser = sessionStorage.getItem('loggedInUser');
      const userId = loggedInUser ? JSON.parse(loggedInUser).id : null;
      const response = await fetch(`${API_URL}/api/messages/${messageId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userId}`
        },
        body: JSON.stringify({ emoji })
      });

      if (response.ok) {
        const data = await response.json();
        setMessageReactions(prev => ({
          ...prev,
          [messageId]: data.reactions
        }));
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
    setShowReactionPicker({ show: false, messageId: null });
  };

  const handleRemoveReaction = async (messageId) => {
    try {
      const loggedInUser = sessionStorage.getItem('loggedInUser');
      const userId = loggedInUser ? JSON.parse(loggedInUser).id : null;
      const response = await fetch(`${API_URL}/api/messages/${messageId}/react`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userId}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessageReactions(prev => ({
          ...prev,
          [messageId]: data.reactions
        }));
      }
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  };

  const handleDeleteForMe = async (messageId) => {
    try {
      const loggedInUser = sessionStorage.getItem('loggedInUser');
      const userId = loggedInUser ? JSON.parse(loggedInUser).id : null;
      const response = await fetch(`${API_URL}/api/messages/${messageId}/delete-for-me`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userId}`
        }
      });

      if (response.ok) {
        // Update UI immediately
        setDeletedForMeMessages(prev => new Set(prev).add(messageId));
        setContextMenu({ show: false, x: 0, y: 0, messageId: null });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
    setContextMenu({ show: false, x: 0, y: 0, messageId: null });
  };

  const handleDeleteForEveryone = async (messageId) => {
    try {
      const loggedInUser = sessionStorage.getItem('loggedInUser');
      const userId = loggedInUser ? JSON.parse(loggedInUser).id : null;
      const response = await fetch(`${API_URL}/api/messages/${messageId}/delete-for-everyone`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userId}`
        }
      });

      const data = await response.json();
      if (response.ok) {
        // Update UI immediately
        setDeletedMessages(prev => new Set(prev).add(messageId));
        setContextMenu({ show: false, x: 0, y: 0, messageId: null });
      } else {
        alert(data.message || 'Cannot delete this message');
        setContextMenu({ show: false, x: 0, y: 0, messageId: null });
      }
    } catch (error) {
      console.error('Error deleting message for everyone:', error);
      alert('Failed to delete message');
      setContextMenu({ show: false, x: 0, y: 0, messageId: null });
    }
  };

  const canDeleteForEveryone = (message) => {
    if (message.type !== 'sent') return false;
    const messageTime = new Date(message.timestamp);
    const now = new Date();
    const minutesSince = (now - messageTime) / (1000 * 60);
    return minutesSince < 2;
  };

  const handleMessageRightClick = (e, messageId) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      messageId: messageId
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ show: false, x: 0, y: 0, messageId: null });
  };

  const updateFriendStatus = () => {
    const showOnline = !friend.settings?.privacy || friend.settings.privacy.onlineStatus !== false;
    const showLastSeen = !friend.settings?.privacy || friend.settings.privacy.lastSeen !== false;

    if (friend.isOnline && showOnline) {
      return { text: '🟢 Online', className: 'chat-status online' };
    } else {
      const lastSeenText = showLastSeen && friend.lastSeen ? 
        `Last seen ${formatTime(friend.lastSeen)}` : 'Last seen recently';
      return { text: `⚫ ${lastSeenText}`, className: 'chat-status offline' };
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const getMessageStatusIcon = (message) => {
    if (message.type !== 'sent') return null;
    
    // Check message status from server or local state
    const status = message.status || messageStatus[message.id] || messageStatus[message.tempId] || 'sent';
    
    if (message.isTemp || pendingMessages.has(message.id) || pendingMessages.has(message.tempId)) {
      return <span className="status-icon sending">⏳</span>;
    }
    
    switch (status) {
      case 'read':
        return <span className="status-icon read" title="Read">✓✓</span>;
      case 'delivered':
        return <span className="status-icon delivered" title="Delivered">✓✓</span>;
      case 'failed':
        return <span className="status-icon failed" title="Failed">❌</span>;
      case 'sent':
      default:
        return <span className="status-icon sent" title="Sent">✓</span>;
    }
  };

  const handleRetrySend = (message) => {
    if (socket && isConnected) {
      const tempId = `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      socket.emit('send-message', {
        receiverId: friend.id,
        content: message.content,
        messageType: 'text',
        tempId: tempId
      });
      
      setMessageStatus(prev => ({
        ...prev,
        [message.id]: 'sending'
      }));
    }
  };

  

  const status = updateFriendStatus();

  // Active call UI removed — chat view continues

  return (
    <div className="active-chat" id={`chatWindow-${friend.id}`}>
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar" style={{ 
            background: `linear-gradient(135deg, var(--primary), var(--primary-dark))` 
          }}>
            {friend.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3>{friend.username}</h3>
            <div className={status.className} id={`chatStatus-${friend.id}`}>
              {status.text}
              {!isConnected && (
                <span style={{ 
                  marginLeft: '8px', 
                  fontSize: '0.7rem', 
                  color: 'var(--warning)',
                  opacity: 0.8 
                }}>
                  (Connecting...)
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="chat-actions">
          <DropdownMenu 
            friendId={friend.id}
            friendName={friend.username}
            onRemoveFriend={onRemoveFriend}
            user={user}
            chatData={chatData}
          />
        </div>
      </div>

      <div className="chat-messages" id={`chatMessages-${friend.id}`}>
        {chatData.messages.length === 0 ? (
          <div className="welcome-message">
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👋</div>
              <h3 style={{ marginBottom: '8px', color: 'var(--text-light)' }}>
                Start a conversation with <span style={{ color: 'var(--primary)' }}>{friend.username}</span>
              </h3>
              <p style={{ color: 'var(--text-light-secondary)', fontSize: '0.9rem' }}>
                Send your first message to get started!
              </p>
            </div>
          </div>
        ) : (
          chatData.messages
            .filter(msg => {
              // Filter out messages deleted for current user
              if (msg.deletedFor && msg.deletedFor.includes(user.id)) return false;
              // Filter out messages deleted for me locally
              if (deletedForMeMessages.has(msg.id)) return false;
              return true;
            })
            .map((msg, index) => {
              const reactions = msg.reactions || messageReactions[msg.id] || {};
              const isDeleted = msg.isDeletedForEveryone || deletedMessages.has(msg.id);
              
              return (
                <div 
                  key={msg.id || msg.tempId || index} 
                  className={`message ${msg.type}`}
                  onContextMenu={(e) => handleMessageRightClick(e, msg.id)}
                  style={{ position: 'relative' }}
                >
                  {msg.type === 'received' ? (
                    <>
                      <div className="message-content">
                        {isDeleted ? (
                          <span style={{ fontStyle: 'italic', color: '#888' }}>
                            🚫 This message was deleted
                          </span>
                        ) : msg.messageType !== 'text' ? (
                          renderMessageContent(msg)
                        ) : (
                          <>
                            <strong>{msg.sender}:</strong> {renderMessageContent(msg)}
                          </>
                        )}
                      </div>
                      {!isDeleted && (
                        <button 
                          className="reaction-button"
                          onClick={() => setShowReactionPicker({ show: true, messageId: msg.id })}
                          style={{
                            position: 'absolute',
                            right: '-30px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'var(--bg-tertiary)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            transition: 'opacity 0.2s'
                          }}
                        >
                          😊
                        </button>
                      )}
                      {Object.keys(reactions).length > 0 && (
                        <div className="message-reactions" style={{
                          display: 'flex',
                          gap: '4px',
                          marginTop: '4px',
                          flexWrap: 'wrap'
                        }}>
                          {Object.entries(reactions).map(([userId, emoji]) => (
                            <span 
                              key={userId}
                              style={{
                                background: 'var(--bg-tertiary)',
                                padding: '2px 6px',
                                borderRadius: '10px',
                                fontSize: '0.85rem',
                                cursor: userId === user.id ? 'pointer' : 'default'
                              }}
                              onClick={() => userId === user.id && handleRemoveReaction(msg.id)}
                              title={userId === user.id ? 'Click to remove' : ''}
                            >
                              {emoji}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="message-meta">
                        <span className="time">{msg.time}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="message-content">
                        {isDeleted ? (
                          <span style={{ fontStyle: 'italic', color: '#888' }}>
                            🚫 You deleted this message
                          </span>
                        ) : (
                          <>
                            {renderMessageContent(msg)}
                            {messageStatus[msg.id] === 'failed' && (
                              <button 
                                className="retry-btn"
                                onClick={() => handleRetrySend(msg)}
                                title="Retry sending"
                              >
                                🔄
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      {!isDeleted && (
                        <button 
                          className="reaction-button"
                          onClick={() => setShowReactionPicker({ show: true, messageId: msg.id })}
                          style={{
                            position: 'absolute',
                            left: '-30px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'var(--bg-tertiary)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            transition: 'opacity 0.2s'
                          }}
                        >
                          😊
                        </button>
                      )}
                      {Object.keys(reactions).length > 0 && (
                        <div className="message-reactions" style={{
                          display: 'flex',
                          gap: '4px',
                          marginTop: '4px',
                          flexWrap: 'wrap'
                        }}>
                          {Object.entries(reactions).map(([userId, emoji]) => (
                            <span 
                              key={userId}
                              style={{
                                background: 'var(--bg-tertiary)',
                                padding: '2px 6px',
                                borderRadius: '10px',
                                fontSize: '0.85rem',
                                cursor: userId === user.id ? 'pointer' : 'default'
                              }}
                              onClick={() => userId === user.id && handleRemoveReaction(msg.id)}
                              title={userId === user.id ? 'Click to remove' : ''}
                            >
                              {emoji}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="message-meta">
                        <span className="time">{msg.time}</span>
                        <span className="message-status">
                          {getMessageStatusIcon(msg)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })
        )}
        
        {chatData.isTyping && (
          <div className="typing-indicator">
            <strong>{friend.username}</strong> is typing
            <span className="typing-dots">
              <span>.</span><span>.</span><span>.</span>
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <input 
          type="file" 
          ref={imageInputRef} 
          accept="image/*" 
          style={{ display: 'none' }} 
          onChange={handleImageUpload}
        />
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileUpload}
        />
        
        <div className="chat-input-actions">
          <button 
            title="Emoji" 
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            style={{ position: 'relative' }}
          >
            😀
            {showEmojiPicker && (
              <div className="emoji-picker" onClick={(e) => e.stopPropagation()}>
                {commonEmojis.map((emoji, index) => (
                  <span 
                    key={index} 
                    className="emoji-item"
                    onClick={() => handleEmojiClick(emoji)}
                  >
                    {emoji}
                  </span>
                ))}
              </div>
            )}
          </button>
          <button 
            title="Send File" 
            onClick={() => fileInputRef.current?.click()}
          >
            📎
          </button>
          <button 
            title="Send Image" 
            onClick={() => imageInputRef.current?.click()}
          >
            🖼️
          </button>
        </div>
        <input
          type="text"
          id={`messageInput-${friend.id}`}
          placeholder={isBlocked ? "You cannot message this user" : "Type a message..."}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            handleTyping();
          }}
          onKeyPress={handleKeyPress}
          disabled={!isConnected || isBlocked}
        />
        <button 
          className="send-btn" 
          onClick={() => handleSendMessage('text')}
          disabled={!message.trim() || !isConnected || isBlocked}
          title={!isConnected ? "Connecting..." : isBlocked ? "User is blocked" : "Send message"}
        >
          {!isConnected ? '🔌' : '➤'}
        </button>
      </div>

      {/* Reaction Picker Modal */}
      {showReactionPicker.show && (
        <div 
          className="reaction-picker-overlay"
          onClick={() => setShowReactionPicker({ show: false, messageId: null })}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div 
            className="reaction-picker"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)',
              padding: '16px',
              borderRadius: '12px',
              display: 'flex',
              gap: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
          >
            {reactionEmojis.map((emoji, index) => (
              <button
                key={index}
                onClick={() => handleReaction(showReactionPicker.messageId, emoji)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                  e.currentTarget.style.transform = 'scale(1.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Context Menu for Delete Options */}
      {contextMenu.show && (
        <div
          className="context-menu-overlay"
          onClick={handleCloseContextMenu}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
        >
          <div
            className="context-menu"
            style={{
              position: 'fixed',
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: '8px 0',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              minWidth: '180px',
              zIndex: 1000
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => handleDeleteForMe(contextMenu.messageId)}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'var(--text-light)',
                fontSize: '0.9rem',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              🗑️ Delete for me
            </button>
            {canDeleteForEveryone(chatData.messages.find(m => m.id === contextMenu.messageId)) && (
              <button
                onClick={() => handleDeleteForEveryone(contextMenu.messageId)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: '#ff4444',
                  fontSize: '0.9rem',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                🚫 Delete for everyone
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
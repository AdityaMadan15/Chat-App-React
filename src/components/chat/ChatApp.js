import React, { useState, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import AddFriendModal from '../modals/AddFriendModal';
import SettingsModal from '../modals/SettingsModal';
import '../../styles/ChatApp.css';
import API_URL from '../../config';

const ChatApp = ({ user, onLogout }) => {
  const { socket } = useSocket();
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [activeChats, setActiveChats] = useState(new Map());
  const [currentChatId, setCurrentChatId] = useState(null);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Load initial data
  useEffect(() => {
    console.log('🚀 ChatApp mounted for user:', user.username);
    
    const loadInitialData = async () => {
      await loadFriends();
      await loadFriendRequests();
      await loadRecentConversations(); // Load recent chats with messages
    };
    
    loadInitialData();
  }, [user]);

  // Setup socket listeners when socket is available
  useEffect(() => {
    if (!socket) return;

    console.log('🔧 Setting up socket listeners for user:', user.username);

    // Handle new messages - FIXED: Proper duplicate prevention
    socket.on('new-message', (data) => {
      console.log('📨 REAL-TIME MESSAGE RECEIVED:', data);
      handleNewMessage(data);
    });

    // Handle friend requests
    socket.on('friend-request-received', (data) => {
      console.log('📬 Friend request received:', data);
      loadFriendRequests();
    });

    // Handle friend status changes
    socket.on('friend-status-changed', (data) => {
      console.log('🟢 Friend status changed:', data);
      updateFriendStatus(data.userId, data.isOnline, data.lastSeen);
    });

    // Handle friend privacy changes in real-time
    socket.on('friend-privacy-changed', (data) => {
      console.log('🔒 Friend privacy settings changed:', data);
      updateFriendPrivacy(data.userId, data.privacy, data.isOnline, data.lastSeen);
    });

    // Handle typing indicators
    socket.on('user-typing', (data) => {
      console.log('⌨️ Typing indicator:', data);
      if (activeChats.has(data.userId)) {
        showTypingIndicator(data.userId, data.isTyping);
      }
    });

    // Handle message sent confirmation
    socket.on('message-sent', (data) => {
      console.log('✅ Message sent confirmation:', data);
      // The optimistic update is already shown, no need to add again
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    // Cleanup
    return () => {
      socket.off('new-message');
      socket.off('friend-request-received');
      socket.off('friend-status-changed');
      socket.off('friend-privacy-changed');
      socket.off('user-typing');
      socket.off('message-sent');
      socket.off('error');
    };
  }, [socket, activeChats]);

  const loadFriends = async () => {
    try {
      console.log('👥 Loading friends...');
      const response = await fetch(`${API_URL}/api/friends/list`, {
        headers: {
          'user-id': user.id
        }
      });
      const data = await response.json();
      if (data.success) {
        console.log('✅ Friends loaded:', data.friends.length);
        setFriends(data.friends);
      } else {
        console.error('❌ Failed to load friends:', data.message);
      }
    } catch (error) {
      console.error('❌ Error loading friends:', error);
    }
  };

  const loadFriendRequests = async () => {
    try {
      console.log('📨 Loading friend requests...');
      const response = await fetch(`${API_URL}/api/friends/requests`, {
        headers: {
          'user-id': user.id
        }
      });
      const data = await response.json();
      if (data.success) {
        console.log('✅ Friend requests loaded:', data.requests.length);
        setFriendRequests(data.requests.filter(req => req.status === 'pending'));
      } else {
        console.error('❌ Failed to load friend requests:', data.message);
      }
    } catch (error) {
      console.error('❌ Error loading friend requests:', error);
    }
  };

  const loadRecentConversations = async () => {
    try {
      console.log('💬 Loading recent conversations...');
      const response = await fetch(`${API_URL}/api/messages/conversations`, {
        headers: {
          'user-id': user.id
        }
      });
      const data = await response.json();
      
      console.log('📊 Conversations API response:', data);
      
      if (data.success && data.conversations && data.conversations.length > 0) {
        console.log('✅ Recent conversations loaded:', data.conversations.length);
        
        let firstChatId = null;
        
        // Pre-load chats with messages
        for (const conv of data.conversations) {
          if (conv.lastMessage) {
            console.log('📖 Pre-loading chat with:', conv.friend.username, 'Friend ID:', conv.friend.id);
            
            // Store the first chat ID to activate it
            if (!firstChatId) {
              firstChatId = conv.friend.id;
            }
            
            // Open the chat in background (don't switch to it yet)
            await openChat(conv.friend.id, false);
            
            // Small delay to ensure state updates properly
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        // Activate the first chat with messages
        if (firstChatId) {
          console.log('🎯 Activating first chat:', firstChatId);
          setCurrentChatId(firstChatId);
        }
        
        console.log('✅ All recent chats pre-loaded. Active chats count:', activeChats.size);
      } else {
        console.log('📭 No recent conversations found');
      }
    } catch (error) {
      console.error('❌ Error loading recent conversations:', error);
    }
  };

  const openChat = async (friendId, switchToChat = true) => {
    console.log('💬 Opening chat with:', friendId);
    
    // If chat already exists, just switch to it
    if (activeChats.has(friendId)) {
      console.log('🔄 Chat already open, switching to it...');
      if (switchToChat) {
        setCurrentChatId(friendId);
      }
      return;
    }

    try {
      console.log('🔍 Fetching friend data...');
      const response = await fetch(`${API_URL}/api/users/${friendId}`, {
        headers: {
          'user-id': user.id
        }
      });
      
      const data = await response.json();
      
      if (!data.success) {
        console.error('❌ Friend not found');
        return;
      }

      const friend = data.user;
      console.log('✅ Friend found:', friend.username);
      
      // Load conversation history first
      console.log('📖 Loading conversation history...');
      const conversationResponse = await fetch(`${API_URL}/api/messages/conversation/${friendId}`, {
        headers: {
          'user-id': user.id
        }
      });
      
      const conversationData = await conversationResponse.json();
      
      // Create chat data with loaded messages
      const chatData = {
        friend: friend,
        messages: conversationData.success && conversationData.messages ? 
          conversationData.messages.map(msg => ({
            id: msg.id,
            content: msg.content,
            messageType: msg.messageType || 'text',
            senderId: msg.senderId,
            sender: msg.senderId === user.id ? user.username : friend.username,
            type: msg.senderId === user.id ? 'sent' : 'received',
            time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: msg.timestamp,
            status: msg.status || 'sent', // Preserve status from backend
            isRead: msg.isRead || false,
            deliveredAt: msg.deliveredAt,
            readAt: msg.readAt
          })) : [],
        isTyping: false,
        unreadCount: 0
      };
      
      console.log('💬 Chat data prepared with', chatData.messages.length, 'messages');
      
      // Set the chat with all data at once
      setActiveChats(prev => {
        const newChats = new Map(prev);
        newChats.set(friendId, chatData);
        console.log('📝 ActiveChats updated. Total chats:', newChats.size);
        return newChats;
      });
      
      if (switchToChat) {
        setCurrentChatId(friendId);
      }

      console.log('✅ Chat opened with:', friend.username, 'with', chatData.messages.length, 'messages');

    } catch (error) {
      console.error('❌ Open chat error:', error);
    }
  };

  const loadConversation = async (friendId) => {
    try {
      console.log('📖 Loading conversation with:', friendId);
      const response = await fetch(`${API_URL}/api/messages/conversation/${friendId}`, {
        headers: {
          'user-id': user.id
        }
      });
      
      const data = await response.json();
      
      if (data.success && data.messages) {
        console.log('✅ Conversation loaded:', data.messages.length, 'messages');
        
        // Update the activeChats with the loaded messages
        setActiveChats(prevChats => {
          const newChats = new Map(prevChats);
          const chatData = newChats.get(friendId);
          
          if (chatData) {
            // Convert backend messages to frontend format
            chatData.messages = data.messages.map(msg => ({
              id: msg.id,
              content: msg.content,
              messageType: msg.messageType || 'text',
              senderId: msg.senderId,
              sender: msg.senderId === user.id ? user.username : data.friend.username,
              type: msg.senderId === user.id ? 'sent' : 'received',
              time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              timestamp: msg.timestamp,
              status: msg.status || 'sent', // Preserve status
              isRead: msg.isRead || false,
              deliveredAt: msg.deliveredAt,
              readAt: msg.readAt
            }));
            
            console.log('💬 Messages updated in state:', chatData.messages.length);
          } else {
            console.log('❌ Chat data not found when loading messages');
          }
          return newChats;
        });
      } else {
        console.log('❌ No messages found or API error:', data.message);
      }
    } catch (error) {
      console.error('❌ Error loading conversation:', error);
    }
  };

  const handleNewMessage = (data) => {
    console.log('🔄 Processing new message from socket:', data);
    const friendId = data.message.senderId === user.id ? data.message.receiverId : data.message.senderId;
    
    setActiveChats(prevChats => {
      const newChats = new Map(prevChats);
      
      if (newChats.has(friendId)) {
        const chatData = newChats.get(friendId);
        
        // Check if message already exists to prevent duplicates
        const messageExists = chatData.messages.some(msg => 
          msg.id === data.message.id || 
          (msg.isTemp && msg.tempId === data.message.tempId)
        );
        
        if (!messageExists) {
          console.log('💬 Adding new message to chat:', data.message);
          const newMessage = {
            id: data.message.id,
            content: data.message.content,
            messageType: data.message.messageType || 'text',
            senderId: data.message.senderId,
            sender: data.sender ? data.sender.username : (data.message.senderId === user.id ? user.username : 'Unknown'),
            type: data.message.senderId === user.id ? 'sent' : 'received',
            time: new Date(data.message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: data.message.timestamp,
            tempId: data.message.tempId,
            status: data.message.status || 'sent', // Preserve status
            isRead: data.message.isRead || false,
            deliveredAt: data.message.deliveredAt,
            readAt: data.message.readAt
          };
          
          chatData.messages.push(newMessage);
          
          // Increment unread count if chat is not active
          if (currentChatId !== friendId) {
            chatData.unreadCount = (chatData.unreadCount || 0) + 1;
            console.log('🔔 Unread count increased for:', friendId);
          }
        } else {
          console.log('🔄 Skipping duplicate message:', data.message.id);
        }
      } else {
        console.log('🆕 Creating new chat for message from:', friendId);
        // Open chat for new message
        setTimeout(() => openChat(friendId, false), 100);
      }
      
      return newChats;
    });
  };

  const updateFriendStatus = (friendId, isOnline, lastSeen) => {
    setActiveChats(prevChats => {
      const newChats = new Map(prevChats);
      if (newChats.has(friendId)) {
        const chatData = newChats.get(friendId);
        chatData.friend.isOnline = isOnline;
        chatData.friend.lastSeen = lastSeen;
      }
      return newChats;
    });
    
    // Also update in friends list
    setFriends(prevFriends => 
      prevFriends.map(friend => 
        friend.id === friendId 
          ? { ...friend, isOnline, lastSeen }
          : friend
      )
    );
  };

  const updateFriendPrivacy = (friendId, privacy, isOnline, lastSeen) => {
    console.log('🔄 Updating friend privacy in real-time:', friendId, privacy);
    
    setActiveChats(prevChats => {
      const newChats = new Map(prevChats);
      if (newChats.has(friendId)) {
        const chatData = newChats.get(friendId);
        if (chatData.friend.settings) {
          chatData.friend.settings.privacy = privacy;
        } else {
          chatData.friend.settings = { privacy };
        }
        chatData.friend.isOnline = isOnline;
        chatData.friend.lastSeen = lastSeen;
      }
      return newChats;
    });
    
    // Also update in friends list
    setFriends(prevFriends => 
      prevFriends.map(friend => 
        friend.id === friendId 
          ? { 
              ...friend, 
              settings: { ...friend.settings, privacy },
              isOnline, 
              lastSeen 
            }
          : friend
      )
    );
  };

  const showTypingIndicator = (friendId, show) => {
    setActiveChats(prevChats => {
      const newChats = new Map(prevChats);
      if (newChats.has(friendId)) {
        const chatData = newChats.get(friendId);
        chatData.isTyping = show;
      }
      return newChats;
    });
  };

  const closeChat = (friendId) => {
    console.log('❌ Closing chat:', friendId);
    setActiveChats(prev => {
      const newChats = new Map(prev);
      newChats.delete(friendId);
      return newChats;
    });
    
    if (currentChatId === friendId) {
      setCurrentChatId(prev => {
        const newChats = new Map(activeChats);
        newChats.delete(friendId);
        return newChats.size > 0 ? Array.from(newChats.keys())[0] : null;
      });
    }
  };

  const sendMessage = (friendId, message) => {
    console.log('📤 Adding message to local state:', message);
    setActiveChats(prevChats => {
      const newChats = new Map(prevChats);
      if (newChats.has(friendId)) {
        const chatData = newChats.get(friendId);
        
        // Check if message already exists (for retries)
        const messageExists = chatData.messages.some(msg => 
          msg.tempId === message.tempId
        );
        
        if (!messageExists) {
          chatData.messages.push(message);
        }
      }
      return newChats;
    });
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      console.log('🗑️ Removing friend:', friendId);
      const response = await fetch(`${API_URL}/api/friends/${friendId}`, {
        method: 'DELETE',
        headers: {
          'user-id': user.id
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Friend removed successfully');
        closeChat(friendId);
        loadFriends();
        alert('Friend removed successfully!');
      } else {
        alert('Failed to remove friend: ' + data.message);
      }
    } catch (error) {
      console.error('Error removing friend:', error);
      alert('Error removing friend');
    }
  };

  return (
    <div className="chat-container">
      <Sidebar
        user={user}
        friends={friends}
        friendRequests={friendRequests}
        onOpenChat={openChat}
        onAddFriend={() => setShowAddFriend(true)}
        onOpenSettings={() => setShowSettings(true)}
        activeChats={activeChats}
        currentChatId={currentChatId}
        onFriendRequestsUpdate={loadFriendRequests}
      />
      
      <ChatArea
        user={user}
        activeChats={activeChats}
        currentChatId={currentChatId}
        onSwitchChat={setCurrentChatId}
        onCloseChat={closeChat}
        onSendMessage={sendMessage}
        onRemoveFriend={handleRemoveFriend}
      />

      {showAddFriend && (
        <AddFriendModal
          user={user}
          friends={friends}
          onClose={() => setShowAddFriend(false)}
          onFriendRequestSent={loadFriendRequests}
        />
      )}

      {showSettings && (
        <SettingsModal
          user={user}
          onClose={() => setShowSettings(false)}
          onLogout={onLogout}
        />
      )}
    </div>
  );
};

export default ChatApp;

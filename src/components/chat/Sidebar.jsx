import React, { useState, useEffect } from 'react';
import '../../styles/Sidebar.css';

const Sidebar = ({ 
  user, 
  friends, 
  friendRequests, 
  onOpenChat, 
  onAddFriend, 
  onOpenSettings,
  activeChats,
  currentChatId,
  onFriendRequestsUpdate
}) => {
  const [localFriendRequests, setLocalFriendRequests] = useState(friendRequests);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredFriends, setFilteredFriends] = useState(friends);
  const [blockedUsers, setBlockedUsers] = useState([]);

  // Fetch blocked users list
  useEffect(() => {
    const fetchBlockedUsers = async () => {
      try {
        const loggedInUser = sessionStorage.getItem('loggedInUser');
        const userId = loggedInUser ? JSON.parse(loggedInUser).id : null;
        const response = await fetch('http://localhost:3001/api/block/list', {
          headers: { 'Authorization': `Bearer ${userId}` }
        });
        const data = await response.json();
        setBlockedUsers(data.blockedUsers || []);
      } catch (error) {
        console.error('Error fetching blocked users:', error);
      }
    };
    
    fetchBlockedUsers();
  }, []);

  // Sync with parent component's friendRequests
  useEffect(() => {
    setLocalFriendRequests(friendRequests);
  }, [friendRequests]);

  // Filter friends based on search term and blocked status
  useEffect(() => {
    let filtered = friends.filter(friend => 
      !blockedUsers.includes(friend.friend.id)
    );
    
    if (searchTerm.trim()) {
      filtered = filtered.filter(friend => 
        friend.friend.username.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredFriends(filtered);
  }, [searchTerm, friends, blockedUsers]);

  const formatTime = (dateString) => {
    if (!dateString) return 'unknown';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return date.toLocaleDateString();
    } catch (error) {
      return 'unknown';
    }
  };

  const formatLastSeen = (lastSeen, isOnline) => {
    if (isOnline) return 'Online';
    if (!lastSeen) return 'Offline';
    
    try {
      const date = new Date(lastSeen);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const lastSeenDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      if (lastSeenDate.getTime() === today.getTime()) {
        return `Last seen today at ${timeStr}`;
      } else if (lastSeenDate.getTime() === yesterday.getTime()) {
        return `Last seen yesterday at ${timeStr}`;
      } else {
        return `Last seen ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${timeStr}`;
      }
    } catch (error) {
      return 'Offline';
    }
  };

  const getAvatarColor = (username) => {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];
    const index = username.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const handleFriendClick = (friendData) => {
    console.log('👆 Friend clicked in sidebar:', friendData.username, friendData.id);
    onOpenChat(friendData.id);
  };

  const acceptFriendRequest = async (requestId, senderUsername) => {
    try {
      console.log('✅ Accepting friend request:', requestId);
      
      const response = await fetch(`http://localhost:3001/api/friends/requests/${requestId}/accept`, {
        method: 'POST',
        headers: {
          'user-id': user.id,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📨 Response status:', response.status);
      
      const data = await response.json();
      console.log('📨 Response data:', data);
      
      if (data.success) {
        console.log('✅ Friend request accepted successfully');
        
        // Remove from local state immediately
        setLocalFriendRequests(prev => prev.filter(req => req.id !== requestId));
        
        // Show success message
        alert(`You are now friends with ${senderUsername}!`);
        
        // Notify parent to refresh friends list
        if (onFriendRequestsUpdate) {
          onFriendRequestsUpdate();
        }
      } else {
        console.error('❌ Failed to accept request:', data.message);
        alert('Failed to accept request: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error accepting friend request:', error);
      alert('Error accepting friend request. Please try again.');
    }
  };

  const declineFriendRequest = async (requestId, senderUsername) => {
    try {
      console.log('❌ Declining friend request:', requestId);
      
      const response = await fetch(`http://localhost:3001/api/friends/requests/${requestId}/decline`, {
        method: 'POST',
        headers: {
          'user-id': user.id,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📨 Response status:', response.status);
      
      const data = await response.json();
      console.log('📨 Response data:', data);
      
      if (data.success) {
        console.log('✅ Friend request declined successfully');
        
        // Remove from local state immediately
        setLocalFriendRequests(prev => prev.filter(req => req.id !== requestId));
        
        alert(`Friend request from ${senderUsername} declined`);
        
        // Notify parent
        if (onFriendRequestsUpdate) {
          onFriendRequestsUpdate();
        }
      } else {
        console.error('❌ Failed to decline request:', data.message);
        alert('Failed to decline request: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error declining friend request:', error);
      alert('Error declining friend request. Please try again.');
    }
  };

  const getProfileImage = (userData) => {
    if (userData.avatarUrl && userData.avatarUrl.startsWith('data:image/')) {
      return userData.avatarUrl;
    }
    return `https://ui-avatars.com/api/?name=${userData.username}&background=6366f1&color=fff`;
  };

  const getUnreadCount = (friendId) => {
    const chat = activeChats.get(friendId);
    return chat ? chat.unreadCount || 0 : 0;
  };

  const getTotalUnreadCount = () => {
    let total = 0;
    activeChats.forEach(chat => {
      total += chat.unreadCount || 0;
    });
    return total;
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="profile">
          <div className="profile-main">
            <div className="profile-pic">
              <img 
                id="profileImage" 
                src={getProfileImage(user)} 
                alt="Profile" 
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${user.username}&background=6366f1&color=fff`;
                }}
              />
              <div className="online-indicator"></div>
            </div>
            <div className="profile-info">
              <span id="profileName" className="profile-username">{user.username}</span>
              <div className="profile-status">
                🟢 Online
              </div>
            </div>
          </div>
          <button className="settings-btn" title="Settings" onClick={onOpenSettings}>⚙</button>
        </div>

        {/* Friends Search */}
        <div style={{ marginTop: '16px' }}>
          <input
            type="text"
            placeholder="Search friends..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border-dark)',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-dark)',
              fontSize: '0.9rem'
            }}
          />
        </div>
      </div>

      <div className="sidebar-content">
        <div className="friends-section">
          <div className="friends-header">
            <h2>
              Friends ({filteredFriends.length})
              {getTotalUnreadCount() > 0 && (
                <span style={{ 
                  marginLeft: '8px',
                  background: 'var(--primary)',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '2px 6px',
                  fontSize: '0.7rem'
                }}>
                  {getTotalUnreadCount()}
                </span>
              )}
            </h2>
            <button className="add-friend-btn" onClick={onAddFriend} title="Add Friend">+</button>
          </div>
          
          <div className="friends-list" id="friendsList">
            {filteredFriends.length === 0 ? (
              <div className="no-friends">
                {searchTerm ? (
                  <>
                    <div className="no-friends-icon">🔍</div>
                    <p>No friends found</p>
                    <small style={{ color: 'var(--text-dark-secondary)', marginTop: '8px' }}>
                      No friends match "{searchTerm}"
                    </small>
                  </>
                ) : (
                  <>
                    <div className="no-friends-icon">👥</div>
                    <p>No friends yet</p>
                    <button className="btn-secondary" onClick={onAddFriend}>Add Friends</button>
                  </>
                )}
              </div>
            ) : (
              filteredFriends.map(friend => {
                const friendData = friend.friend;
                const showOnline = !friendData.settings?.privacy || friendData.settings.privacy.onlineStatus !== false;
                const showLastSeen = !friendData.settings?.privacy || friendData.settings.privacy.lastSeen !== false;
                
                let statusText = formatLastSeen(
                  showLastSeen ? friendData.lastSeen : null, 
                  friendData.isOnline && showOnline
                );

                const isActiveChat = activeChats.has(friendData.id);
                const unreadCount = getUnreadCount(friendData.id);
                
                return (
                  <div 
                    key={friendData.id}
                    className={`friend-item ${isActiveChat ? 'active-chat-tab' : ''}`}
                    onClick={() => handleFriendClick(friendData)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div 
                      className="friend-avatar" 
                      style={{ background: getAvatarColor(friendData.username) }}
                    >
                      {friendData.avatarUrl && friendData.avatarUrl.startsWith('data:image/') ? (
                        <img 
                          src={friendData.avatarUrl} 
                          alt={friendData.username}
                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div style={{ 
                        display: (friendData.avatarUrl && friendData.avatarUrl.startsWith('data:image/')) ? 'none' : 'flex',
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        color: 'white',
                        fontWeight: '600'
                      }}>
                        {friendData.username.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="friend-info">
                      <div className="friend-name">{friendData.username}</div>
                      <div className={`friend-status ${friendData.isOnline && showOnline ? 'online' : 'offline'}`}>
                        {statusText}
                      </div>
                    </div>
                    {unreadCount > 0 && (
                      <div className="unread-badge">
                        {unreadCount}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Friend Requests Section */}
          {localFriendRequests.length > 0 && (
            <div className="friend-requests">
              <h3>
                Friend Requests 
                <span id="requestsCount" className="badge">{localFriendRequests.length}</span>
              </h3>
              <div id="friendRequests">
                {localFriendRequests.map(request => (
                  <div key={request.id} className="friend-request-item">
                    <div className="request-info">
                      <div 
                        className="request-avatar"
                        style={{ background: getAvatarColor(request.sender.username) }}
                      >
                        {request.sender.avatarUrl && request.sender.avatarUrl.startsWith('data:image/') ? (
                          <img 
                            src={request.sender.avatarUrl} 
                            alt={request.sender.username}
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                          />
                        ) : (
                          request.sender.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="request-details">
                        <div className="request-name">{request.sender.username}</div>
                        <div className="request-time">{formatTime(request.createdAt)}</div>
                      </div>
                    </div>
                    <div className="request-actions">
                      <button 
                        className="btn-accept" 
                        onClick={() => acceptFriendRequest(request.id, request.sender.username)}
                        title="Accept Request"
                      >
                        ✓
                      </button>
                      <button 
                        className="btn-decline" 
                        onClick={() => declineFriendRequest(request.id, request.sender.username)}
                        title="Decline Request"
                      >
                        ✗
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
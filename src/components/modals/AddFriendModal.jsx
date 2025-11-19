import React, { useState } from 'react';
import '../../styles/Modals.css';

const AddFriendModal = ({ user, friends, onClose, onFriendRequestSent }) => {
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sentRequests, setSentRequests] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const searchUsers = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:3001/api/users/search?q=${encodeURIComponent(searchTerm)}`, {
        headers: {
          'user-id': user.id
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Filter out current user from search results
        const filteredResults = data.results.filter(userResult => userResult.id !== user.id);
        setSearchResults(filteredResults);
        
        if (filteredResults.length === 0) {
          setError('No users found with that username');
        }
      } else {
        setSearchResults([]);
        setError(data.message || 'Search failed');
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (friendUsername, friendId) => {
    try {
      setError('');
      const response = await fetch('http://localhost:3001/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.id
        },
        body: JSON.stringify({ friendUsername })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Add to sent requests using both username and ID for better tracking
        setSentRequests(prev => new Set([...prev, `${friendUsername}_${friendId}`]));
        
        // Show success message
        setError(`Friend request sent to ${friendUsername}!`);
        
        // Refresh search to update status
        searchUsers();
        
        // Notify parent
        onFriendRequestSent();
        
        // Clear success message after 3 seconds
        setTimeout(() => setError(''), 3000);
      } else {
        setError(data.message || 'Failed to send friend request');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      setError('Error sending friend request. Please try again.');
    }
  };

  const isAlreadyFriend = (userResult) => {
    return friends.some(friend => friend.friend.id === userResult.id);
  };

  const hasPendingRequest = (userResult) => {
    return sentRequests.has(`${userResult.username}_${userResult.id}`);
  };

  const isCurrentUser = (userResult) => {
    return userResult.id === user.id;
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchUsers();
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    // Clear results when search term is cleared
    if (!e.target.value.trim()) {
      setSearchResults([]);
      setError('');
    }
  };

  const getAvatarColor = (username) => {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];
    const index = username.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div id="addFriendModal" className="modal">
      <div className="modal-content">
        <span className="close-btn" onClick={onClose}>&times;</span>
        <h2>👥 Add Friend</h2>
        
        {/* Error/Success Message */}
        {error && (
          <div className={`alert ${error.includes('sent') ? 'success' : 'error'}`}>
            {error}
          </div>
        )}
        
        <div className="search-section">
          <input
            type="text"
            id="friendSearch"
            placeholder="Search by username..."
            className="search-input"
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyPress={handleSearchKeyPress}
            disabled={loading}
          />
          <button 
            onClick={searchUsers} 
            className="search-btn" 
            disabled={loading || !searchTerm.trim()}
          >
            {loading ? '🔍 Searching...' : 'Search'}
          </button>
        </div>
        
        <div className="search-results" id="searchResults">
          {loading ? (
            <div className="loading">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <div className="typing-dots">
                  <span>.</span><span>.</span><span>.</span>
                </div>
                Searching users...
              </div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="no-results">
              {searchTerm ? (
                <>
                  <div className="no-results-icon">🔍</div>
                  <p>No users found matching "{searchTerm}"</p>
                  <small style={{ color: 'var(--text-light-secondary)', marginTop: '8px' }}>
                    Make sure you're typing the exact username
                  </small>
                </>
              ) : (
                <>
                  <div className="no-results-icon">👥</div>
                  <p>Enter a username to search for friends</p>
                </>
              )}
            </div>
          ) : (
            searchResults.map(userResult => {
              const alreadyFriend = isAlreadyFriend(userResult);
              const requestSent = hasPendingRequest(userResult);
              const isSelf = isCurrentUser(userResult);
              
              return (
                <div key={userResult.id} className="search-result-item">
                  <div className="user-info">
                    <div 
                      className="user-avatar"
                      style={{ background: getAvatarColor(userResult.username) }}
                    >
                      {userResult.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="user-details">
                      <div className="user-name">
                        {userResult.username}
                        {isSelf && <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: 'var(--primary)' }}>(You)</span>}
                      </div>
                      <div className={`user-status ${userResult.isOnline ? 'online' : 'offline'}`}>
                        {userResult.isOnline ? '🟢 Online' : '⚫ Offline'}
                        {userResult.lastSeen && !userResult.isOnline && (
                          <span style={{ marginLeft: '8px', fontSize: '0.7rem', opacity: 0.7 }}>
                            Last seen {new Date(userResult.lastSeen).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {isSelf ? (
                    <button className="btn-secondary" disabled>
                      This is you
                    </button>
                  ) : alreadyFriend ? (
                    <button className="btn-secondary" disabled>
                      ✓ Friends
                    </button>
                  ) : requestSent ? (
                    <button className="btn-secondary" disabled>
                      ⏳ Request Sent
                    </button>
                  ) : (
                    <button 
                      className="btn-primary" 
                      onClick={() => sendFriendRequest(userResult.username, userResult.id)}
                      style={{ minWidth: '100px' }}
                    >
                      Add Friend
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Quick Tips */}
        {searchResults.length === 0 && !loading && searchTerm && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            background: 'var(--bg-light-tertiary)', 
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.9rem',
            color: 'var(--text-light-secondary)'
          }}>
            <strong>💡 Tip:</strong> Make sure you're using the exact username. Usernames are case-sensitive.
          </div>
        )}

        {/* Recent Activity */}
        {sentRequests.size > 0 && (
          <div style={{ 
            marginTop: '20px', 
            borderTop: '1px solid var(--border-light)',
            paddingTop: '15px'
          }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-light-secondary)', marginBottom: '10px' }}>
              Recent Activity
            </h4>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-light-secondary)' }}>
              Sent {sentRequests.size} friend request{sentRequests.size > 1 ? 's' : ''} in this session
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddFriendModal;
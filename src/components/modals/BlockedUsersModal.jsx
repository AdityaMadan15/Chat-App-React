import React, { useState, useEffect } from 'react';
import '../../styles/Modals.css';
import API_URL from '../../config';

const BlockedUsersModal = ({ onClose }) => {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    try {
      const loggedInUser = sessionStorage.getItem('loggedInUser');
      const userId = loggedInUser ? JSON.parse(loggedInUser).id : null;
      
      if (!userId) {
        console.error('No logged in user');
        setLoading(false);
        return;
      }

      // Get list of blocked users with details
      const response = await fetch(`${API_URL}/api/block/list`, {
        headers: { 'Authorization': `Bearer ${userId}` }
      });
      
      if (!response.ok) {
        console.error('Failed to fetch blocked users:', response.status);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      console.log('Blocked users data:', data);
      
      setBlockedUsers(data.blockedUsers || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      setLoading(false);
    }
  };

  const handleUnblock = async (userId, username) => {
    if (window.confirm(`Unblock ${username}?\n\nYou will be able to send and receive messages from this user again. Your old chat history will be restored.`)) {
      try {
        const loggedInUser = sessionStorage.getItem('loggedInUser');
        const currentUserId = loggedInUser ? JSON.parse(loggedInUser).id : null;
        const response = await fetch(`${API_URL}/api/block/unblock/${userId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${currentUserId}` }
        });

        if (response.ok) {
          alert(`${username} has been unblocked. Your old chats are now visible.`);
          // Remove from local state
          setBlockedUsers(blockedUsers.filter(user => user.id !== userId));
          
          // Reload page to refresh sidebar and show unblocked user
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          alert('Error unblocking user');
        }
      } catch (error) {
        console.error('Error unblocking user:', error);
        alert('Error unblocking user');
      }
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <span className="close-btn" onClick={onClose}>&times;</span>
        <h2>🚫 Blocked Users</h2>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)' }}>
            Loading...
          </div>
        ) : blockedUsers.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px',
            color: 'var(--text-light-secondary)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
            <p>You haven't blocked anyone yet.</p>
            <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>
              Blocked users will appear here.
            </p>
          </div>
        ) : (
          <>
            <p style={{ 
              color: 'var(--text-light-secondary)', 
              fontSize: '0.9rem',
              marginBottom: '16px',
              padding: '0 20px'
            }}>
              You have blocked {blockedUsers.length} user{blockedUsers.length > 1 ? 's' : ''}. 
              Click "Unblock" to restore communication and view old chats.
            </p>
            
            <div className="blocked-users-list" style={{
              maxHeight: '400px',
              overflowY: 'auto',
              padding: '0 20px'
            }}>
              {blockedUsers.map(user => (
                <div 
                  key={user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    marginBottom: '12px',
                    border: '1px solid var(--border-light)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ff6b6b, #ee5a6f)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '1.2rem',
                      fontWeight: '600'
                    }}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ 
                        fontWeight: '600', 
                        color: 'var(--text-light)',
                        fontSize: '1rem'
                      }}>
                        {user.username}
                      </div>
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: 'var(--text-light-secondary)',
                        marginTop: '2px'
                      }}>
                        Blocked • Cannot message
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleUnblock(user.id, user.username)}
                    style={{
                      padding: '8px 20px',
                      background: 'var(--success)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#45a049';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--success)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.3)';
                    }}
                  >
                    ✅ Unblock
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BlockedUsersModal;

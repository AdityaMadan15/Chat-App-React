import React, { useState, useRef, useEffect } from 'react';
import '../../styles/Dropdown.css';
import API_URL from '../../config';

const DropdownMenu = ({ friendId, friendName, onRemoveFriend, user, chatData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Check if user is blocked
  useEffect(() => {
    const checkBlockStatus = async () => {
      try {
        const loggedInUser = sessionStorage.getItem('loggedInUser');
        if (!loggedInUser) {
          console.error('No logged in user found');
          return;
        }
        const userId = JSON.parse(loggedInUser).id;
        console.log('Checking block status with userId:', userId);
        const response = await fetch(`${API_URL}/api/block/check/${friendId}`, {
          headers: { 'Authorization': `Bearer ${userId}` }
        });
        const data = await response.json();
        console.log('Block status response:', data);
        setIsBlocked(data.isBlocked);
      } catch (error) {
        console.error('Error checking block status:', error);
      }
    };
    
    checkBlockStatus();
  }, [friendId]);

  // View Contact - Show friend profile
  const handleViewContact = () => {
    setIsOpen(false);
    alert(`👤 ${friendName}'s Profile\n\nUsername: ${friendName}\nStatus: ${chatData?.friend?.isOnline ? '🟢 Online' : '⚫ Offline'}\nLast Seen: ${chatData?.friend?.lastSeen ? new Date(chatData.friend.lastSeen).toLocaleString() : 'Unknown'}`);
  };

  // Search in conversation
  const handleSearch = () => {
    setIsOpen(false);
    const searchTerm = prompt(`🔍 Search in conversation with ${friendName}:`);
    if (searchTerm) {
      const messages = chatData?.messages || [];
      const foundMessages = messages.filter(msg => 
        msg.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (foundMessages.length > 0) {
        alert(`Found ${foundMessages.length} message(s) containing "${searchTerm}"`);
        console.log('Found messages:', foundMessages);
      } else {
        alert(`No messages found containing "${searchTerm}"`);
      }
    }
  };

  // Media & Files
  const handleMediaFiles = () => {
    setIsOpen(false);
    const messages = chatData?.messages || [];
    const mediaMessages = messages.filter(msg => 
      msg.content.includes('[IMAGE]') || 
      msg.content.includes('[FILE]') ||
      msg.content.match(/\.(jpg|jpeg|png|gif|pdf|doc|docx)$/i)
    );
    
    if (mediaMessages.length > 0) {
      alert(`📁 Media & Files with ${friendName}\n\nFound ${mediaMessages.length} media/file message(s)`);
    } else {
      alert(`No media or files shared with ${friendName} yet`);
    }
  };

  // Mute/Unmute
  const handleMute = () => {
    setIsOpen(false);
    setIsMuted(!isMuted);
    if (!isMuted) {
      alert(`🔕 Notifications muted for ${friendName}\n\nYou won't receive notifications from this chat.`);
    } else {
      alert(`🔔 Notifications unmuted for ${friendName}\n\nYou will receive notifications from this chat.`);
    }
  };

  // Remove Friend with safety check
  const handleRemoveFriend = () => {
    setIsOpen(false);
    
    // Safety check - make sure onRemoveFriend exists and is a function
    if (typeof onRemoveFriend !== 'function') {
      console.error('onRemoveFriend is not a function:', onRemoveFriend);
      alert('Error: Remove friend feature is not available right now.');
      return;
    }

    if (window.confirm(`Are you sure you want to remove ${friendName} from your friends?\n\nThis will delete your entire chat history with ${friendName}.`)) {
      try {
        onRemoveFriend(friendId);
      } catch (error) {
        console.error('Error removing friend:', error);
        alert('Error removing friend. Please try again.');
      }
    }
  };

  // Block/Unblock User
  const handleBlockUser = async () => {
    setIsOpen(false);
    
    const action = isBlocked ? 'unblock' : 'block';
    const confirmMsg = isBlocked 
      ? `Unblock ${friendName}?\n\nYou will be able to send and receive messages from this user again.`
      : `Block ${friendName}?\n\nYou will not be able to send or receive messages from this user.`;
    
    if (window.confirm(confirmMsg)) {
      try {
        const loggedInUser = sessionStorage.getItem('loggedInUser');
        if (!loggedInUser) {
          alert('Error: Not logged in');
          return;
        }
        const userId = JSON.parse(loggedInUser).id;
        console.log(`Attempting to ${action} user with userId:`, userId);
        
        const response = await fetch(`${API_URL}/api/block/${action}/${friendId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${userId}` }
        });
        
        console.log('Block/unblock response status:', response.status);
        const data = await response.json();
        console.log('Block/unblock response data:', data);
        
        if (response.ok) {
          setIsBlocked(!isBlocked);
          alert(isBlocked ? `${friendName} has been unblocked` : `${friendName} has been blocked`);
          window.location.reload(); // Refresh to update UI
        } else {
          alert('Error: ' + (data.message || 'Could not ' + action + ' user'));
        }
      } catch (error) {
        console.error('Error blocking/unblocking user:', error);
        alert('Error: Could not ' + action + ' user');
      }
    }
  };

  return (
    <div className="dropdown" ref={dropdownRef}>
      <button className="dropbtn" onClick={() => setIsOpen(!isOpen)}>
        ⋮
      </button>
      {isOpen && (
        <div className="dropdown-content show">
          <a href="#" onClick={(e) => { e.preventDefault(); handleViewContact(); }}>
            <span>👤</span> View Contact
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); handleSearch(); }}>
            <span>🔍</span> Search
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); handleMediaFiles(); }}>
            <span>📎</span> Media & Files
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); handleMute(); }}>
            <span>{isMuted ? '🔔' : '🔕'}</span> {isMuted ? 'Unmute' : 'Mute'}
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); handleBlockUser(); }} style={{ color: isBlocked ? '#10b981' : '#f59e0b' }}>
            <span>{isBlocked ? '✅' : '🚫'}</span> {isBlocked ? 'Unblock User' : 'Block User'}
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); handleRemoveFriend(); }} style={{ color: '#ef4444' }}>
            <span>❌</span> Remove Friend
          </a>
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;
import React from 'react';
import '../../styles/ChatTabs.css';

const ChatTabs = ({ activeChats, currentChatId, onSwitchChat, onCloseChat }) => {
  return (
    <div className="chat-tabs" id="chatTabs">
      {Array.from(activeChats.entries()).map(([friendId, chatData]) => {
        const friend = chatData.friend;
        const isActive = currentChatId === friendId;
        
        return (
          <div
            key={friendId}
            className={`chat-tab ${isActive ? 'active' : ''}`}
            data-friend-id={friendId}
            onClick={() => onSwitchChat(friendId)}
          >
            <div className="chat-tab-avatar">
              {friend.username.charAt(0).toUpperCase()}
            </div>
            <div className="chat-tab-name">{friend.username}</div>
            <button 
              className="chat-tab-close" 
              onClick={(e) => {
                e.stopPropagation();
                onCloseChat(friendId);
              }}
            >
              ×
            </button>
            {chatData.unreadCount > 0 && (
              <div className="unread-badge">{chatData.unreadCount}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ChatTabs;
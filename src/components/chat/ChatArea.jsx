import React from 'react';
import ChatTabs from './ChatTabs.jsx';
import ChatWindow from './ChatWindow.jsx';
import WelcomeScreen from './WelcomeScreen.jsx';
import '../../styles/ChatArea.css';

const ChatArea = ({ 
  user, 
  activeChats, 
  currentChatId, 
  onSwitchChat, 
  onCloseChat,
  onSendMessage,
  onRemoveFriend  // Make sure this prop is received
}) => {
  const hasActiveChats = activeChats.size > 0;

  // Debug log to check if onRemoveFriend is received properly
  console.log('🔧 ChatArea - onRemoveFriend received:', typeof onRemoveFriend, !!onRemoveFriend);

  return (
    <div className="chat-box">
      {!hasActiveChats ? (
        <WelcomeScreen onAddFriend={() => {/* Will be connected later */}} />
      ) : (
        <div id="multiChatContainer" className="chat-tabs-container">
          <ChatTabs
            activeChats={activeChats}
            currentChatId={currentChatId}
            onSwitchChat={onSwitchChat}
            onCloseChat={onCloseChat}
          />
          
          <div id="activeChatArea" className="active-chat-area">
            {currentChatId ? (
              <ChatWindow
                user={user}
                chatData={activeChats.get(currentChatId)}
                onSendMessage={onSendMessage}
                onRemoveFriend={onRemoveFriend}  // Pass it here
              />
            ) : (
              <div className="no-active-chat" id="noActiveChat">
                Select a chat tab to start messaging
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatArea;
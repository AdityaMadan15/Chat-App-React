import React from 'react';

const WelcomeScreen = ({ onAddFriend }) => {
  return (
    <div id="welcomeScreen" className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-icon">💬</div>
        <h2>Welcome to ChatApp</h2>
        <p>Select a friend to start chatting or add new friends!</p>
        <button className="btn-primary" onClick={onAddFriend}>Add Friends</button>
        <div style={{ marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-light-secondary)' }}>
          <p>💡 <strong>How to start:</strong></p>
          <p>1. Click "Add Friends" to find users</p>
          <p>2. Send friend requests</p>
          <p>3. Accept requests from others</p>
          <p>4. Start real-time chatting!</p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
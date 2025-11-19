import React, { useState, useEffect } from 'react';
import '../../styles/Modals.css';
import API_URL from '../../config';

const PrivacyModal = ({ user, onClose }) => {
  const [settings, setSettings] = useState({
    readReceipts: true,
    typingIndicator: true,
    onlineStatus: true,
    lastSeen: true,
    profilePhoto: true
  });

  useEffect(() => {
    loadCurrentSettings();
  }, []);

  const loadCurrentSettings = async () => {
    try {
      const response = await fetch('${API_URL}/api/settings', {
        headers: {
          'user-id': user.id
        }
      });
      
      const data = await response.json();
      
      if (data.success && data.settings.privacy) {
        setSettings({
          readReceipts: data.settings.privacy.readReceipts !== false,
          typingIndicator: data.settings.privacy.typingIndicator !== false,
          onlineStatus: data.settings.privacy.onlineStatus !== false,
          lastSeen: data.settings.privacy.lastSeen !== false,
          profilePhoto: data.settings.privacy.profilePhoto !== false
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleToggle = async (setting) => {
    const newSettings = {
      ...settings,
      [setting]: !settings[setting]
    };
    
    // Update state immediately for instant feedback
    setSettings(newSettings);
    
    // Save to backend in real-time
    try {
      const response = await fetch('${API_URL}/api/settings/privacy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.id
        },
        body: JSON.stringify({ settings: newSettings })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Privacy settings updated in real-time');
      } else {
        console.error('❌ Failed to save settings:', data.message);
        // Revert on error
        setSettings(settings);
      }
    } catch (error) {
      console.error('❌ Error saving privacy settings:', error);
      // Revert on error
      setSettings(settings);
    }
  };

  return (
    <div id="privacyModal" className="modal">
      <div className="modal-content privacy-modal">
        <span className="close-btn" onClick={onClose}>&times;</span>
        <h2>🔒 Privacy & Security</h2>
        
        <div className="privacy-settings">
          <div className="privacy-item">
            <div className="privacy-info">
              <span className="privacy-title">Read Receipts</span>
              <span className="privacy-desc">Let others see when you've read their messages</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                id="readReceipts" 
                checked={settings.readReceipts}
                onChange={() => handleToggle('readReceipts')}
              />
              <span className="slider"></span>
            </label>
          </div>
          
          <div className="privacy-item">
            <div className="privacy-info">
              <span className="privacy-title">Typing Indicator</span>
              <span className="privacy-desc">Show when you're typing</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                id="typingIndicator" 
                checked={settings.typingIndicator}
                onChange={() => handleToggle('typingIndicator')}
              />
              <span className="slider"></span>
            </label>
          </div>
          
          <div className="privacy-item">
            <div className="privacy-info">
              <span className="privacy-title">Online Status</span>
              <span className="privacy-desc">Show when you're online</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                id="onlineStatus" 
                checked={settings.onlineStatus}
                onChange={() => handleToggle('onlineStatus')}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="privacy-item">
            <div className="privacy-info">
              <span className="privacy-title">Last Seen</span>
              <span className="privacy-desc">Show when you were last online</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                id="lastSeen" 
                checked={settings.lastSeen}
                onChange={() => handleToggle('lastSeen')}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="privacy-item">
            <div className="privacy-info">
              <span className="privacy-title">Profile Photo</span>
              <span className="privacy-desc">Show your profile picture to others</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                id="profilePhoto" 
                checked={settings.profilePhoto}
                onChange={() => handleToggle('profilePhoto')}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        <div className="privacy-actions">
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyModal;
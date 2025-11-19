import React, { useState, useEffect } from 'react';
import '../../styles/Modals.css';
import API_URL from '../../config';

const NotificationsModal = ({ user, onClose }) => {
  const [settings, setSettings] = useState({
    messageNotifications: true,
    soundAlerts: true,
    desktopNotifications: false
  });

  useEffect(() => {
    loadCurrentSettings();
  }, []);

  const loadCurrentSettings = async () => {
    try {
      const response = await fetch(\`/api/settings', {
        headers: {
          'user-id': user.id
        }
      });
      
      const data = await response.json();
      
      if (data.success && data.settings.notifications) {
        setSettings({
          messageNotifications: data.settings.notifications.messageNotifications !== false,
          soundAlerts: data.settings.notifications.soundAlerts !== false,
          desktopNotifications: data.settings.notifications.desktopNotifications === true
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
      const response = await fetch(\`/api/settings/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.id
        },
        body: JSON.stringify({ settings: newSettings })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Notification settings updated in real-time');
      } else {
        console.error('❌ Failed to save settings:', data.message);
        // Revert on error
        setSettings(settings);
      }
    } catch (error) {
      console.error('❌ Error saving notification settings:', error);
      // Revert on error
      setSettings(settings);
    }
  };

  return (
    <div id="notificationsModal" className="modal">
      <div className="modal-content notifications-modal">
        <span className="close-btn" onClick={onClose}>&times;</span>
        <h2>🔔 Notifications</h2>
        
        <div className="notifications-settings">
          <div className="notifications-item">
            <div className="notifications-info">
              <span className="notifications-title">Message Notifications</span>
              <span className="notifications-desc">Receive notifications for new messages</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                id="messageNotifications" 
                checked={settings.messageNotifications}
                onChange={() => handleToggle('messageNotifications')}
              />
              <span className="slider"></span>
            </label>
          </div>
          
          <div className="notifications-item">
            <div className="notifications-info">
              <span className="notifications-title">Sound Alerts</span>
              <span className="notifications-desc">Play sound for new messages</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                id="soundAlerts" 
                checked={settings.soundAlerts}
                onChange={() => handleToggle('soundAlerts')}
              />
              <span className="slider"></span>
            </label>
          </div>
          
          <div className="notifications-item">
            <div className="notifications-info">
              <span className="notifications-title">Desktop Notifications</span>
              <span className="notifications-desc">Show desktop notifications</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                id="desktopNotifications" 
                checked={settings.desktopNotifications}
                onChange={() => handleToggle('desktopNotifications')}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        <div className="notifications-actions">
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default NotificationsModal;
import React, { useState } from 'react';
import EditProfileModal from './EditProfileModal.jsx';
import ChangePasswordModal from './ChangePasswordModal.jsx';
import NotificationsModal from './NotificationsModal.jsx';
import PrivacyModal from './PrivacyModal.jsx';
import BlockedUsersModal from './BlockedUsersModal.jsx';
import '../../styles/Modals.css';

const SettingsModal = ({ user, onClose, onLogout }) => {
  const [activeModal, setActiveModal] = useState(null);

  const openModal = (modalName) => {
    setActiveModal(modalName);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  const setTheme = (themeClass) => {
    document.body.className = themeClass;
    localStorage.setItem("chatTheme", themeClass);
    // Show notification logic here
    console.log(`Theme changed to ${themeClass}`);
  };

  return (
    <>
      <div id="settingsModal" className="modal">
        <div className="modal-content">
          <span className="close-btn" onClick={onClose}>&times;</span>
          <h2>Settings</h2>
          <ul className="settings-list">
            <li onClick={() => openModal('editProfile')}>👤 Edit Profile</li>
            <li onClick={() => openModal('changePassword')}>🔑 Change Password</li>
            <li onClick={() => openModal('notifications')}>🔔 Notifications</li>
            <li onClick={() => openModal('privacy')}>🔒 Privacy & Security</li>
            <li onClick={() => openModal('blockedUsers')}>🚫 Blocked Users</li>
            <li className="theme-section">
              🎨 Appearance
              <div className="theme-options">
                <button onClick={() => setTheme('theme-light')}>🌤 Light</button>
                <button onClick={() => setTheme('theme-dark')}>🌙 Dark</button>
                <button onClick={() => setTheme('theme-sunset')}>🌅 Sunset</button>
              </div>
            </li>
            <li onClick={onLogout}>🚪 Logout</li>
          </ul>
        </div>
      </div>

      {activeModal === 'editProfile' && (
        <EditProfileModal user={user} onClose={closeModal} />
      )}

      {activeModal === 'changePassword' && (
        <ChangePasswordModal user={user} onClose={closeModal} />
      )}

      {activeModal === 'notifications' && (
        <NotificationsModal user={user} onClose={closeModal} />
      )}

      {activeModal === 'privacy' && (
        <PrivacyModal user={user} onClose={closeModal} />
      )}

      {activeModal === 'blockedUsers' && (
        <BlockedUsersModal onClose={closeModal} />
      )}
    </>
  );
};

export default SettingsModal;
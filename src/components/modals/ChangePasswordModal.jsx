import React, { useState } from 'react';
import '../../styles/Modals.css';

const ChangePasswordModal = ({ user, onClose }) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [passwordMatch, setPasswordMatch] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmNewPassword) {
      setPasswordMatch('✗ Passwords do not match');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/settings/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.id
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        onClose();
        // Show success notification
      } else {
        console.error('Failed to change password:', data.message);
      }
    } catch (error) {
      console.error('Error changing password:', error);
    }
  };

  const handleConfirmPasswordChange = (value) => {
    setFormData({...formData, confirmNewPassword: value});
    if (value && formData.newPassword) {
      if (value === formData.newPassword) {
        setPasswordMatch('✓ Passwords match');
      } else {
        setPasswordMatch('✗ Passwords do not match');
      }
    } else {
      setPasswordMatch('');
    }
  };

  return (
    <div id="changePasswordModal" className="modal">
      <div className="modal-content password-modal">
        <span className="close-btn" onClick={onClose}>&times;</span>
        <h2>🔑 Change Password</h2>
        
        <form id="changePasswordForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password</label>
            <input 
              type="password" 
              id="currentPassword" 
              placeholder="Enter current password" 
              value={formData.currentPassword}
              onChange={(e) => setFormData({...formData, currentPassword: e.target.value})}
              required 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input 
              type="password" 
              id="newPassword" 
              placeholder="Enter new password" 
              value={formData.newPassword}
              onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
              required 
            />
            <small style={{ color: '#666', fontSize: '12px' }}>Must be at least 6 characters long</small>
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmNewPassword">Confirm New Password</label>
            <input 
              type="password" 
              id="confirmNewPassword" 
              placeholder="Confirm new password" 
              value={formData.confirmNewPassword}
              onChange={(e) => handleConfirmPasswordChange(e.target.value)}
              required 
            />
            <div id="passwordMatch" style={{ fontSize: '12px', marginTop: '5px', color: passwordMatch.includes('✓') ? 'green' : 'red' }}>
              {passwordMatch}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" id="changePasswordBtn">Change Password</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
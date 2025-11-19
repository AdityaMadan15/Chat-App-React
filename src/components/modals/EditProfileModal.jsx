import React, { useState } from 'react';
import '../../styles/Modals.css';

const EditProfileModal = ({ user, onClose }) => {
  const [formData, setFormData] = useState({
    username: user.username,
    email: user.email || '',
    bio: user.bio || 'Hey there! I\'m using ChatApp'
  });
  const [profileImage, setProfileImage] = useState(user.avatarUrl || '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('http://localhost:3001/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user.id
        },
        body: JSON.stringify({
          username: formData.username,
          bio: formData.bio
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update local storage
        const updatedUser = { 
          ...user, 
          username: formData.username, 
          bio: formData.bio,
          avatarUrl: profileImage 
        };
        sessionStorage.setItem('loggedInUser', JSON.stringify(updatedUser));
        
        // Force page reload to update everywhere
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

 const handleProfilePictureChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
      const imageData = e.target.result;
      setProfileImage(imageData);
      
      try {
        // Save to backend
        const response = await fetch('http://localhost:3001/api/users/upload-avatar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'user-id': user.id
          },
          body: JSON.stringify({ avatarData: imageData })
        });
        
        const data = await response.json();
        
        if (data.success) {
          console.log('✅ Profile picture saved to backend');
          // Update local storage
          const updatedUser = { ...user, avatarUrl: imageData };
          sessionStorage.setItem('loggedInUser', JSON.stringify(updatedUser));
        } else {
          console.error('Failed to save profile picture:', data.message);
        }
      } catch (error) {
        console.error('Error saving profile picture:', error);
      }
    };
    reader.readAsDataURL(file);
  }
};

  return (
    <div id="editProfileModal" className="modal">
      <div className="modal-content profile-modal">
        <span className="close-btn" onClick={onClose}>&times;</span>
        <h2>Edit Profile</h2>
        
        <div className="profile-upload-section">
          <div className="profile-image-container">
            <img 
              id="editProfileImage" 
              src={profileImage || `/uploads/avatars/default-${user.username.charAt(0).toUpperCase()}.png`} 
              alt="Profile" 
            />
            <button 
              className="upload-btn large" 
              onClick={() => document.getElementById('profilePictureInput').click()}
              type="button"
            >
              📷
              <span>Change</span>
            </button>
            <input 
              type="file" 
              id="profilePictureInput" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleProfilePictureChange} 
            />
          </div>
        </div>

        <form id="editProfileForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="editUsername">Username</label>
            <input 
              type="text" 
              id="editUsername" 
              placeholder="Enter your username" 
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              required 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="editEmail">Email</label>
            <input 
              type="email" 
              id="editEmail" 
              placeholder="Enter your email" 
              value={formData.email}
              readOnly
            />
            <small style={{ color: '#666', fontSize: '12px' }}>Email cannot be changed</small>
          </div>
          
          <div className="form-group">
            <label htmlFor="editBio">Bio</label>
            <textarea 
              id="editBio" 
              placeholder="Tell everyone about yourself..." 
              maxLength="150"
              value={formData.bio}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              <span id="bioCharCount">{formData.bio.length}</span>/150 characters
            </small>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" id="updateProfileBtn">Update Profile</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;
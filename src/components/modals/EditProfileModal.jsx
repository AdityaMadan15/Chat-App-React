import React, { useState } from 'react';
import '../../styles/Modals.css';
import API_URL from '../../config';

const EditProfileModal = ({ user, onClose, onProfileUpdate }) => {
  const [formData, setFormData] = useState({
    username: user.username,
    email: user.email || '',
    bio: user.bio || 'Hey there! I\'m using ChatApp'
  });
  const [profileImage, setProfileImage] = useState(user.avatarUrl || '');
  
  // Update profile image when user prop changes
  React.useEffect(() => {
    console.log('👤 EditProfileModal user avatarUrl:', user.avatarUrl);
    if (user.avatarUrl) {
      setProfileImage(user.avatarUrl);
    }
  }, [user.avatarUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${API_URL}/api/users/profile`, {
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
        // Update local storage with returned user data from server
        const updatedUser = data.user;
        sessionStorage.setItem('loggedInUser', JSON.stringify(updatedUser));
        
        // Close modal and notify parent of update
        if (onProfileUpdate) {
          onProfileUpdate(updatedUser);
        }
        alert('Profile updated successfully!');
        onClose();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    }
  };

 const handleProfilePictureChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    console.log('📸 File selected:', file.name, file.type, file.size);
    
    const reader = new FileReader();
    reader.onload = async function(e) {
      const imageData = e.target.result;
      console.log('📸 Image data loaded, length:', imageData.length);
      setProfileImage(imageData);
      
      try {
        console.log('📤 Uploading to backend...');
        // Save to backend
        const response = await fetch(`${API_URL}/api/users/upload-avatar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'user-id': user.id
          },
          body: JSON.stringify({ avatarData: imageData })
        });
        
        const data = await response.json();
        console.log('📥 Upload response:', data);
        console.log('📥 Returned user object:', data.user);
        console.log('📥 Returned avatarUrl:', data.user?.avatarUrl);
        
        if (data.success) {
          console.log('✅ Profile picture saved to backend');
          // Update local storage with returned user data from server
          const updatedUser = data.user;
          console.log('💾 Saving to sessionStorage:', updatedUser);
          sessionStorage.setItem('loggedInUser', JSON.stringify(updatedUser));
          
          // Notify parent component immediately
          if (onProfileUpdate) {
            console.log('🔔 Calling onProfileUpdate with:', updatedUser);
            onProfileUpdate(updatedUser);
          }
          
          alert('Profile picture updated successfully! Close this modal to see changes.');
        } else {
          console.error('Failed to save profile picture:', data.message);
          alert('Failed to save profile picture: ' + data.message);
        }
      } catch (error) {
        console.error('Error saving profile picture:', error);
        alert('Error saving profile picture. Please try again.');
      }
    };
    reader.onerror = (error) => {
      console.error('❌ FileReader error:', error);
      alert('Error reading file. Please try again.');
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
              src={profileImage || `https://ui-avatars.com/api/?name=${user.username}&background=6366f1&color=fff`} 
              alt="Profile" 
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${user.username}&background=6366f1&color=fff`;
              }}
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

          old chats are visible now 
          
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
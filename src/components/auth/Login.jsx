import React, { useState } from 'react';
import '../../styles/Login.css';

const Login = ({ onLogin }) => {
  const [showSignup, setShowSignup] = useState(false);
  const [alert, setAlert] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);

  const showAlert = (message, type = 'info') => {
    setAlert({ message, type });
    setTimeout(() => setAlert({ message: '', type: '' }), 5000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;

    if (username && password) {
      setLoading(true);
      try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ 
    username: username, 
    password: password 
  })
});
        
        const data = await response.json();
        
        if (data.success) {
          showAlert('Login successful! Redirecting...', 'success');
          setTimeout(() => {
            onLogin(data.user);
          }, 1500);
        } else {
          showAlert(data.message || 'Login failed!', 'error');
        }
      } catch (error) {
        console.error('Login error:', error);
        showAlert('Network error. Please check if server is running on port 3001', 'error');
      } finally {
        setLoading(false);
      }
    } else {
      showAlert('Please fill in all fields', 'error');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const username = e.target.newUsername.value;
    const email = e.target.newEmail.value;
    const password = e.target.newPassword.value;
    const confirmPassword = e.target.confirmPassword.value;

    if (password !== confirmPassword) {
      showAlert('Passwords do not match!', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showAlert('Account created successfully! Please login.', 'success');
        setShowSignup(false);
        e.target.reset();
      } else {
        showAlert(data.message || 'Registration failed!', 'error');
      }
    } catch (error) {
      console.error('Signup error:', error);
      showAlert('Network error. Please check if server is running on port 3001', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="logo">ChatApp</div>
          <div className="subtitle">Connect with your friends instantly</div>

          {alert.message && (
            <div className={`alert ${alert.type}`}>{alert.message}</div>
          )}

          {!showSignup ? (
            // Login Form
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input 
                  type="text" 
                  id="username" 
                  placeholder="Enter your username" 
                  required 
                  disabled={loading}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input 
                  type="password" 
                  id="password" 
                  placeholder="Enter your password" 
                  required 
                  disabled={loading}
                />
              </div>
              
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          ) : (
            // Signup Form
            <form className="auth-form" onSubmit={handleSignup}>
              <div className="form-group">
                <label htmlFor="newUsername">Username</label>
                <input 
                  type="text" 
                  id="newUsername" 
                  placeholder="Choose a username" 
                  required 
                  disabled={loading}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="newEmail">Email</label>
                <input 
                  type="email" 
                  id="newEmail" 
                  placeholder="Enter your email" 
                  required 
                  disabled={loading}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="newPassword">Password</label>
                <input 
                  type="password" 
                  id="newPassword" 
                  placeholder="Create a password" 
                  required 
                  disabled={loading}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input 
                  type="password" 
                  id="confirmPassword" 
                  placeholder="Confirm your password" 
                  required 
                  disabled={loading}
                />
              </div>
              
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          <div className="switch">
            {!showSignup ? (
              <>Don't have an account? <a onClick={() => !loading && setShowSignup(true)}>Sign Up</a></>
            ) : (
              <>Already have an account? <a onClick={() => !loading && setShowSignup(false)}>Login</a></>
            )}
          </div>

          <ul className="features">
            <li><i className="fas fa-check"></i> Real-time messaging</li>
            <li><i className="fas fa-check"></i> Add friends</li>
            <li><i className="fas fa-check"></i> Online status</li>
            <li><i className="fas fa-check"></i> Simple and fast</li>
          </ul>

          {/* Debug info */}
          <div style={{ marginTop: '20px', fontSize: '0.8rem', color: '#666', textAlign: 'center' }}>
            Backend: http://localhost:3001
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
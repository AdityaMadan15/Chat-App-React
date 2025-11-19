import React, { useState, useEffect } from 'react';
import Login from './components/auth/Login.jsx';
import ChatApp from './components/chat/ChatApp.jsx';
import { SocketProvider } from './hooks/useSocket.jsx';
import './styles/App.css';
import API_URL from './config';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      const loggedInUser = sessionStorage.getItem('loggedInUser');
      if (loggedInUser) {
        const userData = JSON.parse(loggedInUser);
        
        // Verify user still exists in backend and get fresh data
        try {
          const response = await fetch(`http://localhost:3001/api/users/${userData.id}`, {
            headers: {
              'user-id': userData.id
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              // Use backend data which has the latest avatar and info
              console.log('✅ Loaded fresh user data from backend:', data.user.username);
              setUser(data.user);
              sessionStorage.setItem('loggedInUser', JSON.stringify(data.user));
            } else {
              console.log('⚠️ Using cached user data');
              setUser(userData);
            }
          } else {
            console.log('⚠️ Using cached user data (network error)');
            setUser(userData);
          }
        } catch (error) {
          console.error('❌ Error loading user data:', error);
          console.log('⚠️ Using cached user data due to error');
          setUser(userData);
        }
      }
      setLoading(false);

      // Load saved theme
      const savedTheme = localStorage.getItem("chatTheme");
      if (savedTheme) {
        document.body.className = savedTheme;
      }
    };

    loadUserData();
  }, []);

  const handleLogin = async (userData) => {
    try {
      // Get fresh user data from backend on login
      const response = await fetch(`http://localhost:3001/api/users/${userData.id}`, {
        headers: {
          'user-id': userData.id
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('✅ Logging in with fresh user data');
          setUser(data.user);
          sessionStorage.setItem('loggedInUser', JSON.stringify(data.user));
          sessionStorage.setItem('userId', data.user.id);
          return;
        }
      }
    } catch (error) {
      console.error('Error fetching fresh user data:', error);
    }
    
    // Fallback to the provided user data
    console.log('⚠️ Using provided user data');
    setUser(userData);
    sessionStorage.setItem('loggedInUser', JSON.stringify(userData));
    sessionStorage.setItem('userId', userData.id);
  };

  const handleLogout = () => {
    console.log('🚪 Logging out user:', user?.username);
    setUser(null);
    
    // ONLY clear session storage, NOT localStorage for theme
    sessionStorage.removeItem('loggedInUser');
    sessionStorage.removeItem('userId');
    
    // Keep the theme in localStorage so it persists
    // localStorage.removeItem("chatTheme"); // REMOVE THIS LINE
    
    // Reset body class to default theme but keep the saved theme preference
    const savedTheme = localStorage.getItem("chatTheme");
    if (savedTheme) {
      document.body.className = savedTheme;
    } else {
      document.body.className = '';
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>💬</div>
          <div>Loading ChatApp...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <SocketProvider user={user}>
          <ChatApp user={user} onLogout={handleLogout} />
        </SocketProvider>
      )}
    </div>
  );
}

export default App;
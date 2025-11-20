import express from 'express';
import { UserOps } from '../config/mongodb.js';
import { authenticateUser, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Helper function to find user by username
function findUserByUsername(username) {
  if (!username) return null;
  const searchUsername = username.toLowerCase().trim();
  for (let [id, user] of users) {
    if (user.username.toLowerCase() === searchUsername) {
      return user;
    }
  }
  return null;
}

// USER REGISTRATION
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    console.log('📝 Registration attempt:', { username, email });
    
    // Check if user exists
    const existingUser = await UserOps.findByUsernameOrEmail(username, email);
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }
    
    // Create new user
    const user = await UserOps.create({ username, email, password });
    
    console.log('✅ User registered successfully:', username);
    
    res.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

// USER LOGIN - FIXED: Proper authentication
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('🔐 Login attempt for user:', username);
    
    // Find user
    const user = await UserOps.findByUsername(username);
    
    if (!user) {
      console.log('❌ User not found:', username);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    console.log('✅ User found:', user.username);
    
    // Validate password
    let isValid = false;
    try {
      isValid = await user.validatePassword(password);
      console.log('Password validation result:', isValid);
    } catch (error) {
      console.error('❌ Password validation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authentication error'
      });
    }
    
    if (!isValid) {
      console.log('❌ Invalid password for user:', username);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    console.log('✅ Login successful:', username);
    
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        bio: user.bio,
        settings: user.settings
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// [Keep all your existing routes below - they should work fine]
// Search users, get profile, update profile, etc.
export default router;
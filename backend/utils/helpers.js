const { sanitizeInput, isValidEmail, isStrongPassword } = require('../utils/security');
const { users } = require('../config/database');
const { findUser } = require('../utils/helpers');

// Validate registration data - FIXED: Better validation
const validateRegister = (req, res, next) => {
  const { username, email, password } = req.body;
  const errors = [];

  // Validate username
  if (!username || username.trim().length < 3) {
    errors.push('Username must be at least 3 characters long');
  } else if (username.length > 20) {
    errors.push('Username cannot exceed 20 characters');
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  } else {
    // Check if username already exists
    let existingUser = null;
    for (let [id, user] of users) {
      if (user.username && user.username.toLowerCase() === username.toLowerCase()) {
        existingUser = user;
        break;
      }
    }
    if (existingUser) {
      errors.push('Username already exists');
    }
  }

  // Validate email
  if (!email || !isValidEmail(email)) {
    errors.push('Please provide a valid email address');
  } else {
    // Check if email already exists
    let existingEmail = null;
    for (let [id, user] of users) {
      if (user.email && user.email.toLowerCase() === email.toLowerCase()) {
        existingEmail = user;
        break;
      }
    }
    if (existingEmail) {
      errors.push('Email already registered');
    }
  }

  // Validate password
  if (!password || !isStrongPassword(password)) {
    errors.push('Password must be at least 6 characters long');
  } else if (password.length > 100) {
    errors.push('Password cannot exceed 100 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors
    });
  }

  // Sanitize inputs
  req.body.username = sanitizeInput(username.trim());
  req.body.email = sanitizeInput(email.trim().toLowerCase());
  
  next();
};

// Validate login data
const validateLogin = (req, res, next) => {
  const { username, password } = req.body;
  const errors = [];

  if (!username || username.trim().length === 0) {
    errors.push('Username is required');
  }

  if (!password || password.trim().length === 0) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors
    });
  }

  req.body.username = sanitizeInput(username.trim());
  next();
};

// Validate message data - FIXED: Better message validation
const validateMessage = (req, res, next) => {
  const { content, receiverId } = req.body;
  const errors = [];

  if (!content || content.trim().length === 0) {
    errors.push('Message content cannot be empty');
  } else if (content.trim().length > 1000) {
    errors.push('Message cannot exceed 1000 characters');
  } else if (content.trim().length < 1) {
    errors.push('Message content cannot be empty');
  }

  if (!receiverId) {
    errors.push('Receiver ID is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors
    });
  }

  req.body.content = sanitizeInput(content.trim());
  next();
};

// Validate friend request - FIXED: Better validation
const validateFriendRequest = (req, res, next) => {
  const { friendUsername } = req.body;
  const errors = [];

  if (!friendUsername || friendUsername.trim().length === 0) {
    errors.push('Friend username is required');
  } else if (friendUsername.trim().length < 3) {
    errors.push('Username must be at least 3 characters long');
  } else if (friendUsername.trim().length > 20) {
    errors.push('Username cannot exceed 20 characters');
  }

  if (friendUsername && req.user && friendUsername.toLowerCase() === req.user.username.toLowerCase()) {
    errors.push('You cannot add yourself as a friend');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors
    });
  }

  req.body.friendUsername = sanitizeInput(friendUsername.trim());
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateMessage,
  validateFriendRequest
};
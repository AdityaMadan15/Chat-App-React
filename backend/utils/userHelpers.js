const { users } = require('../config/database');

// Find user by ID or username
const findUser = (identifier, usersMap = users) => {
  if (!identifier) return null;
  
  // Try by ID first
  const userById = usersMap.get(identifier);
  if (userById && userById.id) {
    return userById;
  }
  
  // Try by username
  for (let [id, user] of usersMap) {
    if (user && user.username && user.username === identifier) {
      return user;
    }
  }
  
  return null;
};

// Find user by username (case insensitive)
const findUserByUsername = (username, usersMap = users) => {
  if (!username) return null;
  
  const searchUsername = username.toLowerCase().trim();
  for (let [id, user] of usersMap) {
    if (user && user.username && user.username.toLowerCase() === searchUsername) {
      return user;
    }
  }
  
  return null;
};

// Check if username exists
const usernameExists = (username, excludeUserId = null) => {
  const searchUsername = username.toLowerCase().trim();
  for (let [id, user] of users) {
    if (user && user.username && user.username.toLowerCase() === searchUsername) {
      if (!excludeUserId || user.id !== excludeUserId) {
        return true;
      }
    }
  }
  return false;
};

// Check if email exists
const emailExists = (email, excludeUserId = null) => {
  const searchEmail = email.toLowerCase().trim();
  for (let [id, user] of users) {
    if (user && user.email && user.email.toLowerCase() === searchEmail) {
      if (!excludeUserId || user.id !== excludeUserId) {
        return true;
      }
    }
  }
  return false;
};

// Get user initials for avatar
const getInitials = (username) => {
  if (!username) return '??';
  return username
    .split(' ')
    .map(name => name[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

module.exports = {
  findUser,
  findUserByUsername,
  usernameExists,
  emailExists,
  getInitials
};
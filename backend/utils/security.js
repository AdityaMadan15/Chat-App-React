const bcrypt = require('bcryptjs');

// Hash password
const hashPassword = (password) => {
  try {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(password, salt);
  } catch (error) {
    console.error('Password hashing error:', error);
    return password; // Fallback for existing users
  }
};

// Compare password
const comparePassword = (password, hashedPassword) => {
  try {
    return bcrypt.compareSync(password, hashedPassword);
  } catch (error) {
    console.error('Password comparison error:', error);
    return password === hashedPassword; // Fallback for existing users
  }
};

// Sanitize user input to prevent XSS
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate password strength
const isStrongPassword = (password) => {
  return password && password.length >= 6; // Reduced for existing users
};

module.exports = {
  hashPassword,
  comparePassword,
  sanitizeInput,
  isValidEmail,
  isStrongPassword
};
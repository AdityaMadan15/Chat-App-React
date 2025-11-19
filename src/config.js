// For production, use the same origin as the frontend
// For development, use localhost:3001
const API_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3001';

export default API_URL;

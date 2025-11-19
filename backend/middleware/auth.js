import { users } from '../config/database.js';

// Helper function to find user
function findUser(identifier) {
    if (!identifier) return null;
    
    const userById = users.get(identifier);
    if (userById && userById.id) {
        return userById;
    }
    
    for (let [id, user] of users) {
        if (user && user.username && user.username === identifier) {
            return user;
        }
    }
    
    return null;
}

const authenticateUser = (req, res, next) => {
    try {
        console.log('🔐 Auth middleware - Headers:', req.headers);
        
        // Check for Authorization header with Bearer token
        const authHeader = req.headers['authorization'];
        console.log('🔐 Authorization header:', authHeader);
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7); // Remove 'Bearer ' prefix
            console.log('🔐 Extracted token (userId):', token);
            
            // Token is the userId in this simple implementation
            const user = findUser(token);
            console.log('🔐 Found user:', user ? user.username : 'NOT FOUND');
            
            if (user) {
                req.user = user;
                req.userId = user.id;
                console.log('✅ Auth successful for:', user.username);
                return next();
            } else {
                console.log('❌ User not found for token:', token);
            }
        }

        // Fallback to user-id header
        const userId = req.headers['user-id'];
        console.log('🔐 Fallback to user-id header:', userId);
        
        if (!userId) {
            console.log('❌ No authentication provided');
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const user = findUser(userId);
        if (!user) {
            console.log('❌ User not found for user-id:', userId);
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        req.user = user;
        req.userId = user.id;
        console.log('✅ Auth successful (user-id) for:', user.username);
        next();
    } catch (error) {
        console.error('❌ Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

const optionalAuth = (req, res, next) => {
    try {
        const userId = req.headers['user-id'];
        
        if (userId) {
            const user = findUser(userId);
            if (user) {
                req.user = user;
            }
        }
        
        next();
    } catch (error) {
        console.error('Optional auth error:', error);
        next();
    }
};

const authenticateSocket = (socket, next) => {
    try {
        const { userId, username } = socket.handshake.auth;
        
        if (!userId || !username) {
            return next(new Error('Authentication required'));
        }

        const user = findUser(userId);
        if (!user) {
            return next(new Error('User not found'));
        }

        socket.userId = userId;
        socket.username = username;
        next();
    } catch (error) {
        console.error('Socket auth error:', error);
        next(new Error('Authentication error'));
    }
};

// Export as named exports
export { authenticateUser, optionalAuth, authenticateSocket };
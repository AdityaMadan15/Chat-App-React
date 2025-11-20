import { UserOps } from '../config/mongodb.js';

const authenticateUser = async (req, res, next) => {
    try {
        console.log('🔐 Auth middleware - Headers:', req.headers);
        
        // Check for Authorization header with Bearer token
        const authHeader = req.headers['authorization'];
        console.log('🔐 Authorization header:', authHeader);
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7); // Remove 'Bearer ' prefix
            console.log('🔐 Extracted token (userId):', token);
            
            // Check for old UUID format (pre-MongoDB migration)
            if (token.includes('-')) {
                console.log('⚠️ Old UUID format detected, rejecting:', token);
                return res.status(401).json({
                    success: false,
                    message: 'Session expired. Please login again.'
                });
            }
            
            // Token is the userId in this simple implementation
            const user = await UserOps.findById(token);
            console.log('🔐 Found user:', user ? user.username : 'NOT FOUND');
            
            if (user) {
                req.user = user;
                req.userId = user._id.toString();
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
        
        // Check for old UUID format
        if (userId.includes('-')) {
            console.log('⚠️ Old UUID format detected in user-id, rejecting:', userId);
            return res.status(401).json({
                success: false,
                message: 'Session expired. Please login again.'
            });
        }

        const user = await UserOps.findById(userId);
        if (!user) {
            console.log('❌ User not found for user-id:', userId);
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        req.user = user;
        req.userId = user._id.toString();
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

const optionalAuth = async (req, res, next) => {
    try {
        const userId = req.headers['user-id'];
        
        if (userId) {
            const user = await UserOps.findById(userId);
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

const authenticateSocket = async (socket, next) => {
    try {
        const { userId, username } = socket.handshake.auth;
        
        if (!userId || !username) {
            return next(new Error('Authentication required'));
        }

        const user = await UserOps.findById(userId);
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
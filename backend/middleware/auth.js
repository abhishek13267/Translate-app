const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_strong_secret_32_char_studio_key_2026';

const auth = (req, res, next) => {
    const token = req.header('x-auth-token');

    if (!token) {
        console.warn('⚠️ AUTH FAILED: No token provided in header');
        return res.status(401).json({ error: '🚨 Access denied. No valid identity provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error('🛑 AUTH FAILED:', err.name, '| Token:', token ? token.substring(0, 10) + '...' : 'none');
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: '⏰ Token has expired. Please refresh your session.' });
        }
        res.status(401).json({ error: '🛑 Token is not valid for the Bodhi Engine.' });
    }
};

module.exports = auth;

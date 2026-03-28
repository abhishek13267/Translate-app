const jwt = require('jsonwebtoken');
const { validationResult, check } = require('express-validator');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_strong_secret_32_char_studio_key_2026';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'fallback_refresh_secret_extreme_long_key_987654';

// (1. Dual Token System: Access + Refresh)
const generateTokens = async (user) => {
    const accessToken = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' }); // Increased for stability
    const refreshToken = jwt.sign({ id: user._id }, REFRESH_SECRET, { expiresIn: '7d' });
    
    // Save refresh token to DB
    user.refreshToken = refreshToken;
    await user.save();
    return { accessToken, refreshToken };
};

exports.validateSignup = [
    check('username', '⚠️ Username is required').not().isEmpty().trim().escape(),
    check('email', '⚠️ Enter a valid email').isEmail().normalizeEmail(),
    check('password', '⚠️ Min 6 chars required').isLength({ min: 6 })
];

exports.validateLogin = [
    check('email', '⚠️ Enter a valid email').isEmail().normalizeEmail(),
    check('password', '⚠️ Password is required').not().isEmpty()
];

exports.signup = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        let { username, email, password } = req.body;
        email = email?.toLowerCase().trim();
        
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ error: 'Email already registered' });

        let userByUsername = await User.findOne({ username });
        if (userByUsername) return res.status(400).json({ error: 'Username already taken' });

        user = new User({ username, email, password });
        await user.save();

        const { accessToken, refreshToken } = await generateTokens(user);
        res.status(201).json({ accessToken, refreshToken, user: { id: user._id, username: user.username, email: user.email } });
    } catch (err) {
        console.error('SERVER SIGNUP ERROR:', err);
        res.status(500).json({ error: '🚨 Signup failed: ' + err.message });
    }
};

exports.login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        let { email, password } = req.body;
        email = email?.toLowerCase().trim();

        const user = await User.findOne({ email }).select('+password');
        if (!user) return res.status(400).json({ error: '⚠️ Invalid Credentials' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ error: '⚠️ Invalid Credentials' });

        user.lastLogin = Date.now();
        const { accessToken, refreshToken } = await generateTokens(user);
        
        res.json({ accessToken, refreshToken, user: { id: user._id, username: user.username, email: user.email } });
    } catch (err) {
        console.error('SERVER LOGIN ERROR:', err);
        res.status(500).json({ error: '🚨 Login failure: ' + err.message });
    }
};

exports.refresh = async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(401).json({ error: 'Refresh token missing' });

    try {
        const decoded = jwt.verify(token, REFRESH_SECRET);
        const user = await User.findById(decoded.id).select('+refreshToken');
        
        if (!user || user.refreshToken !== token) return res.status(401).json({ error: 'Invalid refresh token' });

        const { accessToken, refreshToken } = await generateTokens(user);
        res.json({ accessToken, refreshToken });
    } catch (err) {
        res.status(401).json({ error: 'Token expired or invalid' });
    }
};

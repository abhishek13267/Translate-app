const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const { Server } = require('socket.io');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const translateRoutes = require('./routes/translateRoutes');
const { speechClient } = require('./config/google');

// --- (6. Logging System: Winston) ---
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
        new winston.transports.File({ filename: path.join(logDir, 'combined.log') })
    ],
});
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const port = process.env.PORT || 5050;

// --- (7. CORS Restriction) ---
const whitelist = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3000',
    'http://127.0.0.1:3000', // Added 127.0.0.1 variant for 3000
    'http://localhost:5000', // Added 5000 variants
    'http://127.0.0.1:5000',
    'http://localhost:5050',
    'http://127.0.0.1:5050',
    'http://[::1]:5173', // IPv6 variants
    'http://[::1]:3000'
];
if (process.env.ALLOWED_ORIGINS) {
    whitelist.push(...process.env.ALLOWED_ORIGINS.split(','));
}

const corsOptions = {
    origin: (origin, callback) => {
        // Log origin for debugging CORS issues
        if (origin) logger.info(`CORS Check for Origin: ${origin}`);

        // In Development (if it's not production or if we're on a local machine)
        const isProd = process.env.NODE_ENV === 'production';
        if (!isProd) {
            return callback(null, true);
        }

        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        // Allow localhost and common local IP ranges
        const isLocalhost = origin.includes('localhost') || 
                          origin.includes('127.0.0.1') || 
                          origin.startsWith('http://192.168.') || 
                          origin.startsWith('http://10.') ||
                          origin.startsWith('http://172.');

        if (isLocalhost || whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            logger.warn(`🛑 CORS Blocked: ${origin}`);
            callback(new Error('🔒 Not allowed by CORS. Origin: ' + origin));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
};

// --- (3. Bruteforce & Rate Limiting) ---
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // (Increased for testing)
    message: { error: "⚠️ Too many attempts. Please try again in 15 minutes." }
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // Increased from 100 for smoother testing
    message: { error: "⚠️ Rate limit exceeded. Try again later." }
});

// Middleware Layer
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors(corsOptions));
app.use(morgan('combined')); // (6. Request Logging)
app.use(bodyParser.json({ limit: '10mb' }));
app.use(mongoSanitize()); // (5. Prevent NoSQL Injection)

// --- (8. Health Monitoring) ---
app.use('/api/health', (req, res) => res.status(200).json({ status: '💚 Bodhi Online', version: '2.0-Hardened' }));

// Routing Architecture
app.use('/api', (req, res, next) => {
    logger.info(`Incoming Request: ${req.method} ${req.url}`);
    next();
});
app.use('/api/auth/login', loginLimiter); // Protect login from brute-force
app.use('/api/auth', authRoutes);
app.use('/api', apiLimiter, translateRoutes); // Standard per-user rate limit

// 📡 Streaming AI Infrastructure (Socket.io)
io.on('connection', (socket) => {
    logger.info('User joined Voice Stream ID: ' + socket.id);
    let recognizeStream = null;

    socket.on('start-stream', (config) => {
        if (recognizeStream) {
            recognizeStream.end();
            recognizeStream = null;
        }

        try {
            recognizeStream = speechClient.streamingRecognize({
                config: { encoding: 'WEBM_OPUS', sampleRateHertz: 48000, languageCode: config.lang || 'en-US', interimResults: true },
            })
                .on('error', (err) => {
                    socket.emit('stream-error', err.message);
                    recognizeStream = null;
                })
                .on('data', (data) => {
                    const result = data.results[0];
                    if (result) {
                        socket.emit('transcript-update', { text: result.alternatives[0].transcript, isFinal: result.isFinal });
                    }
                });
        } catch (err) {
            logger.error('Socket stream setup error:', err);
        }
    });

    socket.on('audio-packet', (data) => {
        if (recognizeStream) recognizeStream.write(data);
    });

    socket.on('stop-stream', () => {
        if (recognizeStream) recognizeStream.end();
        recognizeStream = null;
    });

    socket.on('disconnect', () => {
        if (recognizeStream) recognizeStream.end();
    });
});

// Final Error Handling (6. Internal Errors Hider)
app.use((err, req, res, next) => {
    // Log structured error details for easier debugging
    logger.error('LuminaVox Server Error Trace:', { message: err.message, stack: err.stack });
    // Also output to console during development
    if (process.env.NODE_ENV !== 'production') console.error('LuminaVox Server Error:', err);
    res.status(500).json({ error: '🚨 A secure server error occurred: ' + err.message });
});

server.listen(port, () => logger.info(`🚀 Vaak AI Studio running at: http://localhost:${port}`));
// Handle unhandled Promise rejections
process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Promise Rejection:', { message: err.message, stack: err.stack });
    // In production, you might want to restart the server here
});

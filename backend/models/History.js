const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true // Fast filtering by User
    },
    originalText: { 
        type: String, 
        required: true 
    },
    translatedText: { 
        type: String, 
        required: true 
    },
    sourceLang: { 
        type: String, 
        required: true,
        index: true 
    },
    targetLang: { 
        type: String, 
        required: true,
        index: true 
    },
    audioBase64: { 
        type: String 
    },
    sessionMetadata: {
        ip: String,
        userAgent: String
    }
}, { timestamps: true });

// Create a composite index for fast dashboard fetching
HistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('History', HistorySchema);

const path = require('path');
const fs = require('fs');

const CREDENTIALS_PATH = path.join(__dirname, '..', '..', 'credentials.json');

// --- DEPLOYMENT OPTIMIZATION ---
// On Render/Railway, you can set GOOGLE_CREDENTIALS_JSON env var instead of uploading a file.
// Credentials are set up here, but clients are created LAZILY to avoid crashing server on startup.

if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const jsonPath = path.join(__dirname, '..', 'temp_credentials.json');
    fs.writeFileSync(jsonPath, process.env.GOOGLE_CREDENTIALS_JSON);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = jsonPath;
    console.log('✅ Google JSON loaded from Environment Variable');
} else if (fs.existsSync(CREDENTIALS_PATH)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = CREDENTIALS_PATH;
    console.log('✅ Google JSON loaded from Local File');
} else {
    console.warn('⚠️ WARNING: No Google Credentials found. Translation will be unavailable, but Auth will work fine.');
}

// Lazy client singletons — created only when first needed, NOT at startup.
// This prevents the server from crashing if credentials are missing.
let _speechClient, _translateClient, _ttsClient;

const getSpeechClient = () => {
    if (!_speechClient) {
        const speech = require('@google-cloud/speech');
        _speechClient = new speech.SpeechClient();
    }
    return _speechClient;
};

const getTranslateClient = () => {
    if (!_translateClient) {
        const translate = require('@google-cloud/translate').v2;
        _translateClient = new translate.Translate();
    }
    return _translateClient;
};

const getTtsClient = () => {
    if (!_ttsClient) {
        const textToSpeech = require('@google-cloud/text-to-speech');
        _ttsClient = new textToSpeech.TextToSpeechClient();
    }
    return _ttsClient;
};

// Keep speechClient as a getter-based proxy for socket.io in server.js
const speechClient = { streamingRecognize: (...args) => getSpeechClient().streamingRecognize(...args) };

module.exports = { speechClient, getSpeechClient, getTranslateClient, getTtsClient, CREDENTIALS_PATH };

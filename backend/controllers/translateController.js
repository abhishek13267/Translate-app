const { getSpeechClient, getTranslateClient, getTtsClient, CREDENTIALS_PATH } = require('../config/google');
const History = require('../models/History');
const fs = require('fs');

const TTS_LANGUAGE_FALLBACKS = {
    af: 'af-ZA',
    ar: 'ar-XA',
    bg: 'bg-BG',
    bn: 'bn-IN',
    ca: 'ca-ES',
    cs: 'cs-CZ',
    da: 'da-DK',
    de: 'de-DE',
    el: 'el-GR',
    en: 'en-US',
    es: 'es-ES',
    eu: 'eu-ES',
    fi: 'fi-FI',
    fil: 'fil-PH',
    fr: 'fr-FR',
    gl: 'gl-ES',
    gu: 'gu-IN',
    hi: 'hi-IN',
    bho: 'hi-IN', // Bhojpuri fallback to Hindi TTS
    hu: 'hu-HU',
    id: 'id-ID',
    is: 'is-IS',
    it: 'it-IT',
    ja: 'ja-JP',
    kn: 'kn-IN',
    ko: 'ko-KR',
    ml: 'ml-IN',
    mr: 'mr-IN',
    ms: 'ms-MY',
    nb: 'nb-NO',
    nl: 'nl-NL',
    pa: 'pa-IN',
    pl: 'pl-PL',
    pt: 'pt-BR',
    ro: 'ro-RO',
    ru: 'ru-RU',
    sk: 'sk-SK',
    sr: 'sr-RS',
    sv: 'sv-SE',
    ta: 'ta-IN',
    te: 'te-IN',
    th: 'th-TH',
    tr: 'tr-TR',
    uk: 'uk-UA',
    ur: 'ur-IN',
    vi: 'vi-VN',
    yue: 'yue-HK',
    zh: 'cmn-CN',
    'zh-TW': 'cmn-TW'
};

const normalizeTranslationText = (translationRes) => {
    if (Array.isArray(translationRes)) {
        return translationRes.join(' ');
    }

    return translationRes;
};

const getTtsLanguageCode = (langCode) => {
    if (!langCode) return 'en-US';
    if (langCode.includes('-') && langCode.length > 4) return langCode;
    return TTS_LANGUAGE_FALLBACKS[langCode] || 'en-US';
};

const normalizeTranslateLanguageCode = (langCode) => {
    if (!langCode) return '';

    const normalized = String(langCode).trim();
    if (!normalized) return '';
    
    const lowered = normalized.toLowerCase();
    if (lowered === 'auto') return ''; // Empty string means auto-detect in Google Translate API

    if (lowered === 'zh-tw') return 'zh-TW';
    if (lowered === 'zh-cn') return 'zh';
    if (lowered === 'iw') return 'he';
    if (lowered === 'jw') return 'jv';

    if (lowered.includes('-')) {
        return lowered.split('-')[0];
    }

    return lowered;
};

const saveHistorySafe = async (historyPayload) => {
    try {
        if (!historyPayload.userId) {
            console.warn('History save skipped: userId is missing');
            return;
        }
        const newHistory = new History(historyPayload);
        await newHistory.save();
    } catch (err) {
        console.warn('History save failed:', err.message);
    }
};

// Detect whether Google credentials are available (file or env var)
const GOOGLE_CONFIGURED = fs.existsSync(CREDENTIALS_PATH) || !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

// --- (9. REAL FALLBACK: MyMemory Translate API (Free, no key required for low volume)) ---
const translateWithMyMemory = (text, sourceLang, targetLang) => {
    return new Promise((resolve) => {
        const https = require('https');
        
        const source = (!sourceLang || sourceLang === 'auto') ? 'en' : sourceLang.split('-')[0];
        const target = targetLang.split('-')[0];
        const query = encodeURIComponent(text);
        
        // MyMemory likes email for higher quotas, but let's at least provide a User-Agent
        const langpair = encodeURIComponent(`${source}|${target}`);
        const url = `https://api.mymemory.translated.net/get?q=${query}&langpair=${langpair}`;
        
        console.log(`[MYMEMORY] Fetching: "${text.substring(0, 30)}..." (${source} -> ${target})`);

        const options = {
            timeout: 4000,
            headers: {
                'User-Agent': 'VaakAI/2.0 (Premium Studio; contact@vaakai.dev)',
                'Accept': 'application/json'
            }
        };

        const req = https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        console.warn(`[MYMEMORY] API returned status ${res.statusCode}`);
                        return resolve(null);
                    }
                    if (!data) return resolve(null);
                    
                    const parsed = JSON.parse(data);
                    if (parsed.responseData?.translatedText) {
                        const result = parsed.responseData.translatedText;
                        
                        // Check if it just returned the source (MyMemory does this on failure)
                        if (result.trim().toLowerCase() === text.trim().toLowerCase() && source === target) {
                             console.log('[MYMEMORY] Circular translation detected, skipping.');
                             return resolve(null);
                        }
                        
                        console.log(`[MYMEMORY] Success: "${result.substring(0, 30)}..."`);
                        resolve(result);
                    } else {
                        console.warn('[MYMEMORY] Response missing translatedText:', parsed.responseStatus);
                        resolve(null);
                    }
                } catch (e) {
                    console.warn('[MYMEMORY] Parse/Response Error:', e.message);
                    resolve(null);
                }
            });
        });

        req.on('error', (err) => {
            console.warn('[MYMEMORY] Network Error:', err.message);
            resolve(null);
        });

        req.on('timeout', () => {
            console.warn('[MYMEMORY] Request timed out');
            req.destroy();
            resolve(null);
        });
    });
};

const SIMULATED_TRANSLATIONS = {
    "hello": "नमस्ते (Namaste)",
    "hi": "नमस्ते (Namaste)",
    "how are you": "आप कैसे हैं? (Aap kaise hain?)",
    "good morning": "शुभ प्रभात (Shubh prabhat)",
    "good afternoon": "नमस्कार (Namaskar)",
    "good evening": "शुभ संध्या (Shubh sandhya)",
    "good night": "शुभ रात्रि (Shubh raatri)",
    "bye": "नमस्ते / अलविदा (Namaste / Alvida)",
    "thank you": "शुक्रिया (Shukriya)",
    "thanks": "धन्यवाद (Dhanyawad)",
    "i love you": "मैं आपसे प्यार करता हूँ (Main aapse pyaar karta hoon)",
    "what is your name": "आपका नाम क्या है? (Aapka naam kya hai?)",
    "apple": "सेब (Seb)",
    "water": "पानी (Paani)",
    "food": "खाना (Khana)",
    "i am fine": "मैं ठीक हूँ (Main theek hoon)",
    "yes": "हाँ (Haan)",
    "no": "नहीं (Nahi)",
    "please": "कृपया (Kripya)",
    "sorry": "क्षमा करें (Kshama karen)",
    "where are you": "आप कहाँ हैं? (Aap kahan hain?)",
    "what happened": "क्या हुआ? (Kya hua?)",
    "help": "मदद (Madad)",
    "wait": "इंतज़ार करें (Intezaar karen)",
    "i am going": "मैं जा रहा हूँ",
    "come here": "यहाँ आओ (Yahan aao)",
    "go there": "वहाँ जाओ (Wahan jao)",
    "who are you": "आप कौन हैं? (Aap kaun hain?)",
    "ok": "ठीक है (Theek hai)",
    "love": "प्यार (Pyaar)",
    "life": "जिंदगी (Zindagi)",
    "friend": "दोस्त (Dost)",
    "mother": "माँ (Maa)",
    "father": "पिता (Pita)",
    "brother": "भाई (Bhai)",
    "sister": "बहन (Behen)",
    "home": "घर (Ghar)",
    "world": "दुनिया (Duniya)",
    "time": "समय (Samay)",
    "what are you doing": "आप क्या कर रहे हैं? (Aap kya kar rahe hain?)",
    "i miss you": "मुझे आपकी याद आती है (Mujhe aapki yaad aati hai)",
    "happy birthday": "जन्मदिन की शुभकामनाएं (Janmdin ki shubhkamnayein)",
    "congratulations": "बधाई हो (Badhai ho)",
    "good luck": "सौभाग्य (Saubhagya)",
    "i don't know": "मुझे नहीं पता (Mujhe nahi pata)",
    "excuse me": "सुनिए (Suniye)",
    "beautiful": "सुंदर (Sundar)",
    "happy": "खुश (Khush)",
    "sad": "उदास (Udas)",
    "hungry": "भूखा (Bhukha)",
    "tired": "थका हुआ (Thaka hua)",
    "let's go": "चलो चलते हैं (Chalo chalte hain)",
    "stop": "रुको (Ruko)",
    "help": "मदद (Madad)",
    "how much": "कितना? (Kitna?)",
    "i am sorry": "मुझे क्षमा करें (Mujhe kshama karen)",
    "can you help me": "क्या आप मेरी मदद कर सकते हैं? (Kya aap meri madad kar sakte hain?)",
    "where is the bathroom": "बाथरूम कहाँ है? (Bathroom kahan hai?)",
    "the food is delicious": "खाना स्वादिष्ट है (Khana swadisht hai)",
    "it is very hot": "बहुत गर्मी है (Bahut garmi hai)",
    "it is very cold": "बहुत ठंड है (Bahut thand hai)",
    "english to hindi": "अंग्रेजी से हिंदी (Angrezi se Hindi)"
};

const simulateTranslation = (text, targetLang) => {
    if (!text) return "";
    const cleanText = text.toLowerCase().trim().replace(/[?!.]/g, '');
    
    // Only simulate if target is Hindi
    if (targetLang.startsWith('hi')) {
        if (SIMULATED_TRANSLATIONS[cleanText]) {
            return SIMULATED_TRANSLATIONS[cleanText];
        }
        return `[SIMULATED HINDI] ${text}`;
    }

    return `[MOCK ${targetLang}] ${text}`;
};

const synthesizeAudioSafe = async ({ text, targetLang, speed, gender }) => {
    const ttsClient = getTtsClient();
    const voice = {
        languageCode: getTtsLanguageCode(targetLang),
        ssmlGender: gender || 'NEUTRAL'
    };

    try {
        const [ttsRes] = await ttsClient.synthesizeSpeech({
            input: { text },
            voice,
            audioConfig: { audioEncoding: 'MP3', speakingRate: speed }
        });

        return `data:audio/mp3;base64,${ttsRes.audioContent.toString('base64')}`;
    } catch (err) {
        console.warn(`TTS synthesis failed for "${targetLang}" with gender "${voice.ssmlGender}":`, err.message);

        try {
            const [fallbackRes] = await ttsClient.synthesizeSpeech({
                input: { text },
                voice: { languageCode: voice.languageCode, ssmlGender: 'NEUTRAL' },
                audioConfig: { audioEncoding: 'MP3', speakingRate: speed }
            });

            return `data:audio/mp3;base64,${fallbackRes.audioContent.toString('base64')}`;
        } catch (fallbackErr) {
            console.warn(`TTS fallback failed for "${targetLang}":`, fallbackErr.message);
            return null;
        }
    }
};

exports.getHistory = async (req, res) => {
    try {
        const history = await History.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(10);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: 'History fetch error' });
    }
};

exports.translateVoice = async (req, res) => {
    if (!GOOGLE_CONFIGURED) {
        if (process.env.NODE_ENV === 'production') {
            return res.status(412).json({ error: '⚠️ Google Cloud credentials not configured. Please add credentials.json to the root folder.' });
        }

        // Development fallback: try REAL translation with MyMemory first, then mock dictionary
        try {
            let { text, source_lang, target_lang } = req.body;
            if (typeof text === 'string' && text.trim()) {
                const phrase = text.trim();
                
                // 1. Try MyMemory for real translation (FREE fallback)
                const realTranslation = await translateWithMyMemory(phrase, source_lang, target_lang);
                
                // 2. If MyMemory failed, use our simulation dictionary
                const finalResult = realTranslation || simulateTranslation(phrase, target_lang);
                const isMock = !realTranslation;

                console.log(`[DEV ${isMock ? 'MOCK' : 'REAL-FALLBACK'}] Translated "${phrase}" to ${target_lang}: ${finalResult}`);
                await saveHistorySafe({ userId: req.user?.id || null, originalText: phrase, translatedText: finalResult, sourceLang: source_lang, targetLang: target_lang, audioBase64: null });
                return res.json({ transcript: phrase, translated_text: finalResult, audio: null, detectedLang: source_lang });
            }

            const mockedTranscript = 'mock transcript';
            const mockedTranslation = "[DEV MOCK] Simulated translation result.";
            await saveHistorySafe({ userId: req.user?.id || null, originalText: mockedTranscript, translatedText: mockedTranslation, sourceLang: source_lang, targetLang: target_lang, audioBase64: null });
            return res.json({ transcript: mockedTranscript, translated_text: mockedTranslation, audio: null, detectedLang: source_lang });
        } catch (err) {
            console.warn('Dev mock translateVoice failed:', err.message);
            return res.status(500).json({ error: 'Dev mock translate failure' });
        }
    }

    try {
        let { audio, text, source_lang, target_lang, speed = 1.0, gender = 'NEUTRAL' } = req.body;
        const normalizedTargetLang = normalizeTranslateLanguageCode(target_lang);

        if (typeof text === 'string' && text.trim()) {
            req.body.text = text.trim();
            return exports.translateText(req, res);
        }

        if (!audio) return res.status(400).json({ error: 'Empty voice data' });
        if (audio.includes(',')) audio = audio.split(',')[1];

        // 🟢 PRO-STT (Support for Multi-Detect)
        const config = {
            encoding: 'WEBM_OPUS', sampleRateHertz: 48000,
            languageCode: source_lang === 'auto' ? 'en-US' : source_lang,
            alternativeLanguageCodes: source_lang === 'auto' ? ['hi-IN', 'es-ES', 'fr-FR', 'bho-IN', 'ta-IN'] : []
        };

        const speechClient = getSpeechClient();
        const [speechResponse] = await speechClient.recognize({ audio: { content: audio }, config });
        const result = speechResponse.results[0];
        if (!result) return res.status(406).json({ error: "Voice was too unclear. Try again." });

        const transcript = result.alternatives[0].transcript;
        const detectedLang = result.languageCode || source_lang;

        console.log(`[VOICE] Translating transcript: "${transcript}" from ${detectedLang} to ${normalizedTargetLang}`);
        const translateClient = getTranslateClient();
        if (!normalizedTargetLang || normalizedTargetLang === 'auto') {
            return res.status(400).json({ error: 'Please choose a valid target language.' });
        }

        // Pass source language if detected/provided for better accuracy
        const [translationRes] = await translateClient.translate(transcript, {
            from: normalizeTranslateLanguageCode(detectedLang),
            to: normalizedTargetLang
        });
        
        const translatedText = normalizeTranslationText(translationRes);
        console.log(`[VOICE] Translated text: "${translatedText}"`);
        
        const audioBase64 = await synthesizeAudioSafe({
            text: translatedText,
            targetLang: normalizedTargetLang,
            speed,
            gender
        });

        await saveHistorySafe({
            userId: req.user.id,
            originalText: transcript,
            translatedText,
            sourceLang: detectedLang,
            targetLang: normalizedTargetLang,
            audioBase64: audioBase64,
            sessionMetadata: {
                ip: req.ip,
                userAgent: req.headers['user-agent']
            }
        });

        res.json({ transcript, translated_text: translatedText, audio: audioBase64, detectedLang });
    } catch (err) {
        console.error('Translation Engine Failure [VOICE]:', err);
        let errorMsg = err.message || 'Translation Engine Error.';
        if (errorMsg.includes('credentials') || errorMsg.includes('API key')) {
            errorMsg = '⚠️ Translation failed: Invalid or missing Google API credentials.';
        }
        res.status(500).json({ error: errorMsg });
    }
};

exports.translateText = async (req, res) => {
    if (!GOOGLE_CONFIGURED) {
        if (process.env.NODE_ENV === 'production') {
            return res.status(412).json({ error: '⚠️ Google Cloud credentials not configured. Please add credentials.json to the root folder.' });
        }

        // Development fallback: mocked translation response
        // Development fallback: try REAL translation with MyMemory first, then mock dictionary
        try {
            const { text, source_lang, target_lang } = req.body;
            if (!text) return res.status(400).json({ error: 'Empty text data' });
            
            // 1. Try MyMemory for real translation (FREE fallback)
            const realTranslation = await translateWithMyMemory(text.trim(), source_lang, target_lang);
            
            // 2. If MyMemory failed, use our simulation dictionary
            const finalResult = realTranslation || simulateTranslation(text.trim(), target_lang);
            const isMock = !realTranslation;

            console.log(`[DEV ${isMock ? 'MOCK' : 'REAL-FALLBACK'}] Translated "${text}" to ${target_lang}: ${finalResult}`);
            await saveHistorySafe({ userId: req.user?.id || null, originalText: text, translatedText: finalResult, sourceLang: source_lang, targetLang: target_lang, audioBase64: null });
            return res.json({ transcript: text, translated_text: finalResult, audio: null, detectedLang: source_lang });
        } catch (err) {
            console.warn('Dev mock translateText failed:', err.message);
            return res.status(500).json({ error: 'Dev mock translate failure' });
        }
    }

    try {
        const { text, source_lang, target_lang, speed = 1.0, gender = 'NEUTRAL' } = req.body;
        const normalizedTargetLang = normalizeTranslateLanguageCode(target_lang);
        if (!text) return res.status(400).json({ error: 'Empty text data' });
        if (!normalizedTargetLang || normalizedTargetLang === 'auto') {
            return res.status(400).json({ error: 'Please choose a valid target language.' });
        }

        console.log(`[TEXT] Translating: "${text}" from ${source_lang} to ${normalizedTargetLang}`);
        const translateClient = getTranslateClient();
        
        let translatedText;
        try {
            const [translationRes] = await translateClient.translate(text, {
                from: normalizeTranslateLanguageCode(source_lang),
                to: normalizedTargetLang
            });
            translatedText = normalizeTranslationText(translationRes);
        } catch (apiErr) {
            console.warn('[TEXT] Google API failed, falling back to MyMemory:', apiErr.message);
            // Fallback for production if API fails but credentials exist (e.g. quota, network)
            translatedText = await translateWithMyMemory(text.trim(), source_lang, target_lang) || simulateTranslation(text.trim(), target_lang);
        }
        
        console.log(`[TEXT] Final Result: "${translatedText}"`);

        const audioBase64 = await synthesizeAudioSafe({
            text: translatedText,
            targetLang: normalizedTargetLang,
            speed,
            gender
        });

        await saveHistorySafe({
            userId: req.user.id,
            originalText: text,
            translatedText,
            sourceLang: source_lang,
            targetLang: normalizedTargetLang,
            audioBase64: audioBase64,
            sessionMetadata: {
                ip: req.ip,
                userAgent: req.headers['user-agent']
            }
        });

        res.json({ transcript: text, translated_text: translatedText, audio: audioBase64, detectedLang: source_lang });
    } catch (err) {
        console.error('Text Translation Failure [TEXT]:', err);
        let errorMsg = err.message || 'Translation Engine Error.';
        if (errorMsg.includes('credentials') || errorMsg.includes('API key')) {
            errorMsg = '⚠️ Translation failed: Invalid or missing Google API credentials.';
        }
        res.status(500).json({ error: errorMsg });
    }
};

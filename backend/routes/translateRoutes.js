const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { translateVoice, translateText, getHistory } = require('../controllers/translateController');

router.post('/translate', auth, translateVoice);
router.post('/translate-text', auth, translateText);
router.get('/history', auth, getHistory);

module.exports = router;

const express = require('express');
const router = express.Router();
const { signup, login, refresh, validateSignup, validateLogin } = require('../controllers/authController');

router.post('/signup', validateSignup, signup);
router.post('/login', validateLogin, login);
router.post('/refresh', refresh);

module.exports = router;

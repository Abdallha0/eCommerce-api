const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendOtpSchema, verifyOtpSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validation/auth.validation');
const { sendRegisterOTP, verifyRegisterOTP, login, logout, sendForgotPasswordOTP, resetPassword, getMe } = require('../controllers/auth.controller');

router.post('/register/send-otp', validate(sendOtpSchema), sendRegisterOTP);
router.post('/verify-otp', validate(verifyOtpSchema), verifyRegisterOTP);
router.post('/login', validate(loginSchema), login);
router.post('/logout', protect, logout);
router.post('/forgot-password/send-otp', validate(forgotPasswordSchema), sendForgotPasswordOTP);
router.post('/forgot-password/verify-otp', validate(resetPasswordSchema), resetPassword);
router.get('/me', protect, getMe);

module.exports = router;

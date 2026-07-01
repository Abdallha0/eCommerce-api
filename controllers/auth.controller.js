const crypto = require('crypto');
const User = require('../models/User.model');
const OTP = require('../models/OTP.model');
const { generateToken, hashToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/error');
const { sendEmail, otpEmailHtml, resetPasswordHtml } = require('../utils/sendEmail');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /auth/register/send-otp
const sendRegisterOTP = asyncHandler(async (req, res) => {
  const { username, email, password, phone } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) throw new AppError('Email already registered.', 409);

  const otp = generateOTP();
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  await OTP.findOneAndDelete({ email });
  await OTP.create({
    email,
    otp: hashedOtp,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    userData: { username, email, password, phone },
  });

  await sendEmail({ to: email, subject: 'Verify your SEF Store account', html: otpEmailHtml(otp) });

  res.status(200).json({ success: true, message: 'OTP sent to your email.' });
});

// POST /auth/verify-otp
const verifyRegisterOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const record = await OTP.findOne({ email });

  if (!record) throw new AppError('OTP not found or expired.', 400);
  if (record.expiresAt < new Date()) throw new AppError('OTP has expired.', 400);

  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  if (record.otp !== hashedOtp) throw new AppError('Invalid OTP.', 400);

  const { username, password, phone } = record.userData;
  const user = await User.create({ username, email, password, phone, isVerified: true });

  await OTP.findOneAndDelete({ email });

  const token = generateToken(user._id);
  res.status(201).json({ success: true, token, user: { _id: user._id, username, email, role: user.role } });
});

// POST /auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('password isVerified username email role');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (!user.isVerified) throw new AppError('Please verify your email first.', 403);

  const token = generateToken(user._id);
  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.status(200).json({ success: true, token, user: { _id: user._id, username: user.username, email, role: user.role } });
});

// POST /auth/logout
const logout = asyncHandler(async (req, res) => {
  if (req.user && req.token) {
    const tokenHash = hashToken(req.token);
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { blacklistedTokens: tokenHash } });
  }

  res.clearCookie('token');
  console.log('success')
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

// POST /auth/forgot-password/send-otp
const sendForgotPasswordOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw new AppError('No account found with this email.', 404);

  const otp = generateOTP();
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  await OTP.findOneAndDelete({ email });
  await OTP.create({ email, otp: hashedOtp, expiresAt: new Date(Date.now() + 15 * 60 * 1000) });

  await sendEmail({ to: email, subject: 'Reset your SEF Store password', html: resetPasswordHtml(otp) });

  res.status(200).json({ success: true, message: 'Password reset OTP sent.' });
});

// POST /auth/forgotpassword/verify-otp
const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, password } = req.body;

  const record = await OTP.findOne({ email });
  if (!record) throw new AppError('OTP not found or expired.', 400);
  if (record.expiresAt < new Date()) throw new AppError('OTP has expired.', 400);

  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  if (record.otp !== hashedOtp) throw new AppError('Invalid OTP.', 400);

  const user = await User.findOne({ email });
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  await OTP.findOneAndDelete({ email });

  res.status(200).json({ success: true, message: 'Password reset successfully.' });
});

// GET /auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("username email phone address role createdAt avatar wishlist").lean();
  res.status(200).json({ success: true, user });
});

module.exports = { sendRegisterOTP, verifyRegisterOTP, login, logout, sendForgotPasswordOTP, resetPassword, getMe };

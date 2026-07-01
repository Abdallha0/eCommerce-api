const User = require('../models/User.model');
const { asyncHandler, AppError } = require('../middleware/error');

// POST /users/add  (Admin)
const addUser = asyncHandler(async (req, res) => {
  const { username, email, password, role, phone } = req.body;
  const user = await User.create({ username, email, password, role, phone, isVerified: true });
  res.status(201).json({ success: true, user });
});

// GET /users/all  (Admin)
const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const total = await User.countDocuments();
  const users = await User.find().skip(skip).limit(limit).sort({ createdAt: -1 });

  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), users });
});

// GET /users/:id  (Admin)
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found.', 404);
  res.status(200).json({ success: true, user });
});

// PATCH /users/:id  (User – can update own; Admin can update any)
const updateUser = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
    throw new AppError('Not authorized to update this user.', 403);
  }

  const allowedFields = ['username', 'phone', 'avatar', 'addresses'];
  if (req.user.role === 'admin') allowedFields.push('role', 'isVerified');

  const updates = {};
  allowedFields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!user) throw new AppError('User not found.', 404);

  res.status(200).json({ success: true, user });
});

// DELETE /users/:id  (Admin)
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new AppError('User not found.', 404);
  res.status(200).json({ success: true, message: 'User deleted.' });
});

module.exports = { addUser, getAllUsers, getUserById, updateUser, deleteUser };

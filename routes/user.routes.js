const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { addUser, getAllUsers, getUserById, updateUser, deleteUser } = require('../controllers/user.controller');

router.post('/add', protect, adminOnly, addUser);
router.get('/all', protect, adminOnly, getAllUsers);
router.get('/:id', protect, adminOnly, getUserById);
router.patch('/:id', protect, updateUser);
router.delete('/:id', protect, adminOnly, deleteUser);

module.exports = router;

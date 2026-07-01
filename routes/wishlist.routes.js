const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { getMyWishlist, addToWishlist, removeFromWishlist, clearWishlist, adminGetAllWishlists, adminWishlistStats } = require('../controllers/wishlist.controller');

// User routes
router.get('/my', protect, getMyWishlist);
router.post('/add/:productId', protect, addToWishlist);
router.delete('/remove/:productId', protect, removeFromWishlist);
router.delete('/clear', protect, clearWishlist);

// Admin routes
router.get('/admin', protect, adminOnly, adminGetAllWishlists);
router.get('/admin/stats', protect, adminOnly, adminWishlistStats);

module.exports = router;

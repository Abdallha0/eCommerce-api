const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getCart, addItem, updateItem, removeItem, applyCoupon, removeCoupon, clearCart } = require('../controllers/cart.controller');

router.use(protect);

router.get('/', getCart);
router.post('/items', addItem);
router.patch('/items', updateItem);
router.delete('/items/:productId', removeItem);
router.post('/coupon', applyCoupon);
router.delete('/coupon', removeCoupon);
router.delete('/clear', clearCart);

module.exports = router;

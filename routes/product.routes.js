const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { createProductSchema, reviewSchema } = require('../validation/product.validation');
const {
  getProducts, searchProducts, getProductById,
  createProduct, updateProduct, deleteProduct,
  addReview, deleteReview, getReviews,
} = require('../controllers/product.controller');

router.get('/', getProducts);
router.get('/search', searchProducts);
router.get('/:id', getProductById);
router.post('/', protect, adminOnly, upload.array('images', 10), createProduct);
router.put('/update/:id', protect, adminOnly, upload.array('images', 10), updateProduct);
router.delete('/:id', protect, adminOnly, deleteProduct);

router.post('/:id/reviews', protect, validate(reviewSchema), addReview);
router.delete('/:id/reviews/:rid', protect, deleteReview);
router.get('/:id/reviews', getReviews);

module.exports = router;

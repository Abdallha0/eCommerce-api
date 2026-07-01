const Product = require('../models/Product.model');
const { asyncHandler, AppError } = require('../middleware/error');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/uploadToCloudinary');

// GET /products
const getProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;
  const skip = (page - 1) * limit;

  const filter = { isActive: true };
  if (req.query.category) filter.category = req.query.category.toLowerCase();
  if (req.query.brand) filter.brand = new RegExp(req.query.brand, 'i');
  if (req.query.minPrice || req.query.maxPrice) {
    filter.price = {};
    if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
  }
  if (req.query.featured) filter.featured = req.query.featured === 'true';

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    'price-asc': { price: 1 },
    'price-desc': { price: -1 },
    rating: { averageRating: -1 },
  };
  const sort = sortMap[req.query.sort] || { createdAt: -1 };

  const total = await Product.countDocuments(filter);
  const products = await Product.find(filter).sort(sort).skip(skip).limit(limit).select('-reviews');

  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), products });
});

// GET /products/search
const searchProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;
  const skip = (page - 1) * limit;

  const filter = { isActive: true };

  if (req.query.q) filter.$text = { $search: req.query.q };
  if (req.query.category) filter.category = req.query.category.toLowerCase();
  if (req.query.subcategory) filter.subcategory = req.query.subcategory.toLowerCase();
  if (req.query.brand) filter.brand = new RegExp(req.query.brand, 'i');
  if (req.query.tags) filter.tags = { $in: req.query.tags.split(',') };
  if (req.query.minPrice || req.query.maxPrice) {
    filter.price = {};
    if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
  }

  const sortMap = {
    newest: { createdAt: -1 },
    'price-asc': { price: 1 },
    'price-desc': { price: -1 },
    rating: { averageRating: -1 },
  };
  const sort = req.query.q
    ? { score: { $meta: 'textScore' }, ...sortMap[req.query.sort] }
    : sortMap[req.query.sort] || { createdAt: -1 };

  const total = await Product.countDocuments(filter);
  const products = await Product.find(filter, req.query.q ? { score: { $meta: 'textScore' } } : {})
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .select('-reviews');

  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), products });
});

// GET /products/:id
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('reviews.user', 'username avatar');
  if (!product) throw new AppError('Product not found.', 404);
  res.status(200).json({ success: true, product });
});

// POST /products  (Admin)
const createProduct = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) throw new AppError('At least one image is required.', 400);

  const images = await Promise.all(req.files.map((f) => uploadToCloudinary(f.buffer, 'products')));

  // Handle tags as array or comma-separated string
  let tags = req.body.tags;
  if (typeof tags === 'string') tags = tags.split(',').map((t) => t.trim());

  const product = await Product.create({
    ...req.body,
    tags,
    images,
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, product });
});

// PUT /products/update/:id  (Admin)
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found.', 404);

  // Delete specific images
  if (req.body.deleteImages) {
    const toDelete = Array.isArray(req.body.deleteImages) ? req.body.deleteImages : [req.body.deleteImages];
    await Promise.all(toDelete.map((id) => deleteFromCloudinary(id)));
    product.images = product.images.filter((img) => !toDelete.includes(img.public_id));
  }

  // Upload new images
  if (req.files && req.files.length > 0) {
    const newImages = await Promise.all(req.files.map((f) => uploadToCloudinary(f.buffer, 'products')));
    product.images.push(...newImages);
  }

  if (product.images.length === 0) throw new AppError('Product must have at least one image.', 400);

  const updatable = ['name', 'shortDescription', 'description', 'price', 'discountPrice', 'stock', 'sku', 'category', 'subcategory', 'brand', 'featured', 'isActive'];
  updatable.forEach((field) => { if (req.body[field] !== undefined) product[field] = req.body[field]; });

  if (req.body.tags) {
    product.tags = typeof req.body.tags === 'string' ? req.body.tags.split(',').map((t) => t.trim()) : req.body.tags;
  }

  await product.save();
  res.status(200).json({ success: true, product });
});

// DELETE /products/:id  (Admin)
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found.', 404);

  await Promise.all(product.images.map((img) => deleteFromCloudinary(img.public_id)));
  await product.deleteOne();

  res.status(200).json({ success: true, message: 'Product deleted.' });
});

// POST /products/:id/reviews  (User)
const addReview = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found.', 404);

  const alreadyReviewed = product.reviews.find((r) => r.user.toString() === req.user._id.toString());
  if (alreadyReviewed) throw new AppError('You have already reviewed this product.', 409);

  product.reviews.push({ user: req.user._id, rating: req.body.rating, comment: req.body.comment });
  product.calcAverageRating();
  await product.save();

  res.status(201).json({ success: true, message: 'Review added.', averageRating: product.averageRating });
});

// DELETE /products/:id/reviews/:rid
const deleteReview = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found.', 404);

  const review = product.reviews.id(req.params.rid);
  if (!review) throw new AppError('Review not found.', 404);

  const isOwner = review.user.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') throw new AppError('Not authorized.', 403);

  product.reviews.pull({ _id: req.params.rid });
  product.calcAverageRating();
  await product.save();

  res.status(200).json({ success: true, message: 'Review deleted.' });
});

// GET /products/:id/reviews
const getReviews = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('reviews.user', 'username avatar');
  if (!product) throw new AppError('Product not found.', 404);
  res.status(200).json({ success: true, reviews: product.reviews, averageRating: product.averageRating });
});

module.exports = { getProducts, searchProducts, getProductById, createProduct, updateProduct, deleteProduct, addReview, deleteReview, getReviews };

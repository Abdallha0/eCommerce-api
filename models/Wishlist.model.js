const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true }
);

// Auto-populate products on every find
wishlistSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'products',
    select: 'name slug price discountPrice images averageRating numReviews stock isActive',
  });
  next();
});

module.exports = mongoose.model('Wishlist', wishlistSchema);

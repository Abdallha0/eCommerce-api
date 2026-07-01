const mongoose = require('mongoose');
const slugify = require('slugify');

const imageSchema = new mongoose.Schema({
  public_id: { type: String, required: true },
  url: { type: String, required: true },
});

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, maxlength: 1000 },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], maxlength: 200, trim: true },
    slug: { type: String, unique: true },
    shortDescription: {
      type: String,
      required: [true, 'Short description is required'],
      maxlength: 500,
    },
    description: { type: String, required: [true, 'Description is required'] },
    price: { type: Number, required: [true, 'Price is required'], min: 0 },
    discountPrice: { type: Number, default: 0 },
    stock: { type: Number, required: [true, 'Stock is required'], min: 0 },
    sku: { type: String, unique: true, sparse: true },
    images: {
      type: [imageSchema],
      validate: [(arr) => arr.length >= 1, 'At least one image is required'],
    },
    category: { type: String, required: [true, 'Category is required'], lowercase: true, trim: true },
    subcategory: { type: String, lowercase: true, trim: true },
    brand: { type: String, trim: true },
    tags: [{ type: String }],
    reviews: [reviewSchema],
    averageRating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Auto-generate slug from name
productSchema.pre('save', async function (next) {
  if (!this.isModified('name')) return next();
  const base = slugify(this.name, { lower: true, strict: true });
  let slug = base;
  let count = 1;
  while (await mongoose.model('Product').findOne({ slug, _id: { $ne: this._id } })) {
    slug = `${base}-${count++}`;
  }
  this.slug = slug;
  next();
});

// Recalculate average rating
productSchema.methods.calcAverageRating = function () {
  if (this.reviews.length === 0) {
    this.averageRating = 0;
    this.numReviews = 0;
  } else {
    const total = this.reviews.reduce((sum, r) => sum + r.rating, 0);
    this.averageRating = Math.round((total / this.reviews.length) * 10) / 10;
    this.numReviews = this.reviews.length;
  }
};

// Indexes
productSchema.index({ name: 'text', description: 'text', brand: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ averageRating: -1 });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);

const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  image: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
});

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [cartItemSchema],
    coupon: {
      code: { type: String, uppercase: true },
      discountType: { type: String, enum: ['percentage', 'fixed'] },
      discountValue: { type: Number },
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtuals
cartSchema.virtual('subtotal').get(function () {
  return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
});

cartSchema.virtual('discountAmount').get(function () {
  if (!this.coupon || !this.coupon.code) return 0;
  const sub = this.subtotal;
  if (this.coupon.discountType === 'percentage') {
    return Math.round((sub * this.coupon.discountValue) / 100 * 100) / 100;
  }
  return Math.min(this.coupon.discountValue, sub);
});

cartSchema.virtual('total').get(function () {
  return Math.max(0, this.subtotal - this.discountAmount);
});

cartSchema.virtual('itemCount').get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

module.exports = mongoose.model('Cart', cartSchema);

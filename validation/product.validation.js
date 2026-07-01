const Joi = require('joi');

const createProductSchema = Joi.object({
  name: Joi.string().max(200).required(),
  shortDescription: Joi.string().max(500).required(),
  description: Joi.string().required(),
  price: Joi.number().min(0).required(),
  discountPrice: Joi.number().min(0).default(0),
  stock: Joi.number().integer().min(0).required(),
  sku: Joi.string().optional(),
  category: Joi.string().required(),
  subcategory: Joi.string().optional(),
  brand: Joi.string().optional(),
  tags: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
  featured: Joi.boolean().optional(),
  deleteImages: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
});

const reviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  comment: Joi.string().max(1000).required(),
});

module.exports = { createProductSchema, reviewSchema };

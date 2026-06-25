const mongoose = require('mongoose');

const VariantSchema = new mongoose.Schema({
  title:    { type: String, default: '' },
  content:  String,
  hashtags: [String]
}, { _id: false });

const LinkedInPostSchema = new mongoose.Schema({
  userPrompt: { type: String, required: true },
  variants: [VariantSchema]
}, { timestamps: true });

module.exports = mongoose.model('LinkedInPost', LinkedInPostSchema);

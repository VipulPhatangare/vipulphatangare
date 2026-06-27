const mongoose = require('mongoose');

// Kept for legacy posts that were saved before the v2 redesign
const VariantSchema = new mongoose.Schema({
  title:    { type: String, default: '' },
  content:  String,
  hashtags: [String]
}, { _id: false });

const LinkedInPostSchema = new mongoose.Schema({
  userPrompt:  { type: String, required: true },
  tone:        { type: String, default: 'professional' },
  length:      { type: String, default: 'medium' },
  finalPost:   { type: String, default: '' },
  isFavorite:  { type: Boolean, default: false },
  variants:    [VariantSchema]
}, { timestamps: true });

module.exports = mongoose.model('LinkedInPost', LinkedInPostSchema);

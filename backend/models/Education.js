const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  degree: { type: String, required: true },
  institution: { type: String, required: true },
  location: { type: String, default: '' },
  startYear: { type: String, default: '' },
  endYear: { type: String, default: '' },
  score: { type: String, default: '' },        // CGPA or percentage, free text e.g. "8.7 CGPA"
  highlights: [{ type: String }],
  order: { type: Number, default: 0 },
  isVisible: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Education', educationSchema);

const mongoose = require('mongoose');

const experienceSchema = new mongoose.Schema({
  role: { type: String, required: true },          // e.g. "Software Developer Intern"
  organization: { type: String, required: true },  // e.g. "CampusDekho.ai"
  startDate: { type: String, default: '' },        // free text, e.g. "May 2025"
  endDate: { type: String, default: '' },          // e.g. "Jul 2025" or "Present"
  bullets: [{ type: String }],                     // factual bullets (source material for AI)
  techStack: [{ type: String }],
  order: { type: Number, default: 0 },
  isVisible: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Experience', experienceSchema);

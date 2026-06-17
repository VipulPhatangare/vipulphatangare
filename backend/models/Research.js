const mongoose = require('mongoose');

const researchSchema = new mongoose.Schema({
  title: { type: String, required: true },
  authors: { type: String, required: true },
  abstract: { type: String, required: true },
  conference: { type: String, default: '' },
  paperLink: { type: String, default: '' },
  downloadLink: { type: String, default: '' },
  doiLink: { type: String, default: '' },
  order: { type: Number, default: 0 },
  isVisible: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Research', researchSchema);

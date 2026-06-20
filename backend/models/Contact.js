const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  phone:   { type: String, required: true, trim: true },
  email:   { type: String, trim: true, default: '' },
  message: { type: String, required: true, trim: true },
  isRead:  { type: Boolean, default: false },
  readAt:  { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Contact', ContactSchema);

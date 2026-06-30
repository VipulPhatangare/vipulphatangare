const mongoose = require('mongoose');

const TodoSchema = new mongoose.Schema({
  text:     { type: String, required: true, trim: true },
  done:     { type: Boolean, default: false },
  date:     { type: String, required: true },   // YYYY-MM-DD local
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
}, { timestamps: true });

module.exports = mongoose.model('Todo', TodoSchema);

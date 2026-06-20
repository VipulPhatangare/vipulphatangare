const mongoose = require('mongoose');

const promptSchema = new mongoose.Schema({
  title: { type: String, required: true },
  prompt: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Prompt', promptSchema);

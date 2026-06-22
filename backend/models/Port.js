const mongoose = require('mongoose');

const portSchema = new mongoose.Schema({
  port: { type: Number, required: true, unique: true, min: 1, max: 65535 },
  name: { type: String, required: true, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Port', portSchema);

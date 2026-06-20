const mongoose = require('mongoose');

const portSchema = new mongoose.Schema({
  port:        { type: Number, required: true, unique: true, min: 1, max: 65535 },
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  protocol:    { type: String, enum: ['TCP', 'UDP', 'TCP/UDP'], default: 'TCP' },
  category:    { type: String, enum: ['system', 'web', 'database', 'custom'], default: 'custom' },
  isPreset:    { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Port', portSchema);

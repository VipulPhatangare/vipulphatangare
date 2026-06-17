const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  description:  { type: String, default: '', trim: true },
  encryptedKey: { type: String, required: true },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('ApiKey', apiKeySchema);

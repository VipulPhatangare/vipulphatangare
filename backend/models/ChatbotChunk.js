const mongoose = require('mongoose');

const chatbotChunkSchema = new mongoose.Schema({
  text:        { type: String, required: true },
  source:      { type: String, enum: ['manual', 'pdf', 'linkedin', 'profile'], default: 'manual' },
  sourceLabel: { type: String, default: 'Manual Entry' },
  embedding:   { type: [Number], required: true },
  chunkIndex:  { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatbotChunk', chatbotChunkSchema, 'chatbot');

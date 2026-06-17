const mongoose = require('mongoose');

const chatbotConfigSchema = new mongoose.Schema({
  systemPrompt: {
    type: String,
    default: `You are Vipul Phatangare's portfolio AI assistant. Answer questions ONLY based on the provided context below. If the context does not contain enough information to answer, respond with exactly: "I don't have information about that in my knowledge base." Never guess, infer, or use outside knowledge. Format your responses clearly using markdown: use **bold** for key terms, bullet lists for multiple points, and code blocks for any code snippets.`
  },
  modelName:   { type: String, default: 'gemini-2.5-flash' },
  maxTokens:   { type: Number, default: 8192 },
  typingSpeed: { type: Number, default: 18 },
  topK:        { type: Number, default: 5 }
});

module.exports = mongoose.model('ChatbotConfig', chatbotConfigSchema);

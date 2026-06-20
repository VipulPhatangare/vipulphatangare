const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['web', 'ml', 'agentic', 'genai', 'deeplearning', 'arvr', 'nlp'], required: true },
  techStack: [{ type: String }],
  demoLink: { type: String, default: '' },
  codeLink: { type: String, default: '' },
  driveLink: { type: String, default: '' },
  order: { type: Number, default: 0 },
  isVisible: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);

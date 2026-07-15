const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  name: { type: String, default: 'Vipul Phatangare' },
  title: { type: String, default: 'AI/ML Engineer' },
  subtitle: { type: String, default: 'Aspiring AI/ML Engineer' },
  tagline: { type: String, default: '' },
  // Long-form professional bio / "about me". Also indexed into the agent knowledge
  // base so the LinkedIn + chatbot agents can ground content in it. See linkedinKnowledge.js
  bio: { type: String, default: '' },
  githubUrl: { type: String, default: '' },
  linkedinUrl: { type: String, default: '' },
  instagramUrl: { type: String, default: '' },
  whatsappUrl: { type: String, default: '' },
  leetcodeUrl: { type: String, default: '' },
  portfolioUrl: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  location: { type: String, default: '' },
  footerText: { type: String, default: '© 2026 Vipul Phatangare. All rights reserved.' }
}, { timestamps: true });

module.exports = mongoose.model('Profile', profileSchema);

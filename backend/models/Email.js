const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  gmailMessageId: { type: String, default: null, index: true },
  from:         { type: String, default: '' },
  to:           { type: String, default: '' },
  subject:      { type: String, required: true },
  body:         { type: String, required: true },
  summary:      { type: String, default: '' },
  priority:     { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  category:     { type: String, enum: ['tnp', 'college', 'personal', 'work', 'general'], default: 'general' },
  replyDraft:   { type: String, default: '' },
  deadline:     { type: Date, default: null },
  deadlineText: { type: String, default: '' },
  status:       { type: String, enum: ['unread', 'read', 'replied', 'archived'], default: 'unread' },
  direction:    { type: String, enum: ['incoming', 'outgoing'], default: 'incoming' },
  tags:         [{ type: String }],
  sentAt:       { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Email', emailSchema);

const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  gmailMessageId: { type: String, default: null, index: true },
  from:           { type: String, default: '' },
  to:             { type: String, default: '' },
  subject:        { type: String, required: true },
  body:           { type: String, required: true },
  summary:        { type: String, default: '' },
  priority:       { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  category:       { type: String, enum: ['tnp', 'college', 'personal', 'work', 'general'], default: 'general' },
  // Branch eligibility (AI-decided for TNP mail): can Vipul (CSE AI/ML) actually apply?
  eligible:         { type: Boolean, default: true },
  eligibilityReason: { type: String, default: '' },
  // Manual "important" star toggled by the user, independent of AI priority.
  marked:         { type: Boolean, default: false },
  replyDraft:     { type: String, default: '' },
  deadline:       { type: Date, default: null },
  deadlineText:   { type: String, default: '' },
  status:         { type: String, enum: ['unread', 'read', 'replied', 'archived'], default: 'unread' },
  direction:      { type: String, enum: ['incoming', 'outgoing'], default: 'incoming' },
  tags:           [{ type: String }],
  sentAt:         { type: Date, default: null },
  // AI extracted action data
  actionItems:    [{ type: String }],
  requiresReply:  { type: Boolean, default: false },
  replyUrgency:   { type: String, enum: ['immediate', 'within_24h', 'within_3days', 'none'], default: 'none' },
  // Follow-up tracker
  followUpDate:   { type: Date, default: null },
  followUpNote:   { type: String, default: '' }
}, { timestamps: true });

// After any email is saved, stage an Auto-Apply JobPosting if it's TNP mail with a
// Google Form link. Fire-and-forget: this must never block or fail a mail save, so
// errors are swallowed. Required inline to avoid a circular model dependency.
emailSchema.post('save', function (doc) {
  require('../utils/jobPostingSync')
    .syncJobPostingFromEmail(doc)
    .catch(() => { /* staging is best-effort; ignore failures */ });
});

module.exports = mongoose.model('Email', emailSchema);

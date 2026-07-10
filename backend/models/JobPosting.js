const mongoose = require('mongoose');

// A staged application derived from a TNP email that contains a Google Form link.
// Created automatically (see utils/jobPostingSync) when a TNP mail with a form is
// saved, and advanced through the Auto-Apply pipeline:
//   new → extracted (form schema parsed) → mapped (answers filled)
//       → reviewed (user approved) → submitted | failed
const jobPostingSchema = new mongoose.Schema({
  emailId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Email' },
  // Copied from the source email so the posting is useful on its own.
  subject:  { type: String, default: '' },
  from:     { type: String, default: '' },
  // Filled by later phases (schema extraction / mapping); left blank for now.
  company:  { type: String, default: '' },
  role:     { type: String, default: '' },
  deadline:     { type: Date, default: null },
  deadlineText: { type: String, default: '' },
  // The Google Form the agent will fill, plus any supporting docs (JD, etc).
  formUrl:  { type: String, default: '' },
  formUrls: [{ type: String }],
  docLinks: [{ type: String }],
  rawEmailSnippet: { type: String, default: '' },
  // Parsed Google Form schema (Phase 2). Stored loosely — the shape is owned by
  // utils/formExtractor, not queried on, so Mixed keeps it flexible.
  formTitle: { type: String, default: '' },
  questions: { type: [mongoose.Schema.Types.Mixed], default: [] },
  extractedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['new', 'extracted', 'mapped', 'reviewed', 'submitted', 'failed'],
    default: 'new'
  },
  lastError:   { type: String, default: '' },
  submittedAt: { type: Date, default: null }
}, { timestamps: true });

// One posting per source email (upsert target for jobPostingSync).
jobPostingSchema.index({ emailId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('JobPosting', jobPostingSchema);

const mongoose = require('mongoose');

// One attempt at filling a form's fields for review. Created by the mapping engine
// (Phase 3) and consumed by the review UI; Phase 4 adds the Playwright fill/submit.
const fieldSchema = new mongoose.Schema({
  entryId:    { type: String, default: null },
  text:       { type: String, default: '' },
  type:       { type: String, default: '' },
  required:   { type: Boolean, default: false },
  options:    [{ type: String }],
  answer:     { type: mongoose.Schema.Types.Mixed, default: '' },
  // Where the answer came from: key-value store, RAG, an attached file, or manual.
  source:     { type: String, enum: ['kv', 'rag', 'file', 'manual'], default: 'manual' },
  confidence: { type: Number, default: 0 },
  status:     { type: String, enum: ['ok', 'needs_review'], default: 'needs_review' },
  note:       { type: String, default: '' },
  // True once the user has explicitly looked at / edited this field.
  reviewed:   { type: Boolean, default: false }
}, { _id: false });

const formRunSchema = new mongoose.Schema({
  jobPostingId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPosting', index: true },
  formUrl:      { type: String, default: '' },
  formTitle:    { type: String, default: '' },
  fields:       { type: [fieldSchema], default: [] },
  status: {
    type: String,
    enum: ['draft', 'reviewed', 'submitted', 'failed'],
    default: 'draft'
  },
  // Phase 4 — browser fill/submit results.
  submitStatus:   { type: String, default: '' }, // '', filled, blocked, submitted, failed
  screenshotPath: { type: String, default: '' }, // /uploads/formfills/<file>.png
  warnings:       [{ type: String }],
  error:          { type: String, default: '' },
  submittedAt:    { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('FormRun', formRunSchema);

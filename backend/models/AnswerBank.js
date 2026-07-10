const mongoose = require('mongoose');

// Editable key-value store of factual answers the form filler uses — for details
// that don't live in Profile/Education (PRN, DOB, gender, 10th/12th %, etc.).
// Entries here override the model-derived ones by `key`, and add new keys.
const answerBankSchema = new mongoose.Schema({
  key:      { type: String, required: true, unique: true }, // stable id, e.g. 'prn'
  label:    { type: String, default: '' },                  // human label + embedding fallback text
  value:    { type: String, default: '' },                  // the actual answer
  aliases:  [{ type: String }],                             // keyword phrases → high-confidence match
  category: { type: String, enum: ['factual', 'essay'], default: 'factual' },
  isDate:   { type: Boolean, default: false },              // value is an ISO date (yyyy-mm-dd)
  order:    { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('AnswerBank', answerBankSchema);

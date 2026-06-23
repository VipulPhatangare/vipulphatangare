const mongoose = require('mongoose');

const dailyNoteSchema = new mongoose.Schema({
  title:   { type: String, required: true, trim: true },
  date:    { type: String, required: true },
  content: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('DailyNote', dailyNoteSchema);

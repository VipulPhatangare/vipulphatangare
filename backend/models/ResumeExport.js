const mongoose = require('mongoose');

const resumeExportSchema = new mongoose.Schema({
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true },
  company: { type: String, required: true },
  roleTitle: { type: String, default: '' },
  jdHash: { type: String, default: '' },
  format: { type: String, enum: ['pdf', 'txt'], required: true },
  kind: { type: String, enum: ['resume', 'coverletter'], default: 'resume' },
  filePath: { type: String, required: true },      // relative path under uploads/resumes/
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true } // finalized resume JSON at export time
}, { timestamps: true });

resumeExportSchema.index({ company: 1, jdHash: 1, createdAt: -1 });

module.exports = mongoose.model('ResumeExport', resumeExportSchema);

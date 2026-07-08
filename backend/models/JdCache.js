const mongoose = require('mongoose');

const jdCacheSchema = new mongoose.Schema({
  jdHash: { type: String, required: true, unique: true }, // sha256 of normalized JD text
  parsed: {
    requiredSkills: [{ type: String }],
    niceToHaveSkills: [{ type: String }],
    responsibilities: [{ type: String }],
    seniorityLevel: { type: String, default: '' },
    atsKeywords: [{ type: String }],
    roleSummary: { type: String, default: '' },
    companyName: { type: String, default: '' },
    roleTitle: { type: String, default: '' }
  },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

jdCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('JdCache', jdCacheSchema);

const mongoose = require('mongoose');

const companyResearchSchema = new mongoose.Schema({
  companyKey: { type: String, required: true, unique: true }, // lowercased, trimmed company name
  companyName: { type: String, required: true },
  provider: { type: String, default: '' },                    // serpapi | tavily
  summary: {
    industry: { type: String, default: '' },
    techStack: [{ type: String }],
    recentNews: [{ type: String }],
    culture: { type: String, default: '' },
    products: [{ type: String }],
    overview: { type: String, default: '' }
  },
  rawResultCount: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

// TTL index — MongoDB removes the document once expiresAt passes
companyResearchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('CompanyResearch', companyResearchSchema);

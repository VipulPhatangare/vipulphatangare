const mongoose = require('mongoose');

// The Resume Generator historically read its model from an env var. This singleton
// gives it parity with the other agents: a `modelName` that is either a concrete
// model id or 'inherit' (use the global default). Loaded via getResumeConfig().
const resumeAgentConfigSchema = new mongoose.Schema({
  modelName: { type: String, default: 'inherit' }
}, { timestamps: true });

const ResumeAgentConfig = mongoose.model('ResumeAgentConfig', resumeAgentConfigSchema);

// Lazily creates and returns the singleton config doc.
ResumeAgentConfig.getConfig = async function getConfig() {
  let doc = await ResumeAgentConfig.findOne();
  if (!doc) doc = await ResumeAgentConfig.create({});
  return doc;
};

module.exports = ResumeAgentConfig;

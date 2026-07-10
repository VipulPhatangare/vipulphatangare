const mongoose = require('mongoose');

// One embedded "evidence chunk" from the applicant's knowledge base — a project,
// experience, achievement, skill or education item. This is the persistent RAG
// store the resume agent retrieves from when ranking projects and explaining ATS
// gaps. contentHash lets the injection pipeline re-embed only changed items.
const knowledgeEmbeddingSchema = new mongoose.Schema({
  sourceType: {
    type: String,
    enum: ['project', 'experience', 'achievement', 'skill', 'education'],
    required: true,
    index: true
  },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: { type: String, default: '' },      // human-readable label for provenance ("Project: X")
  text: { type: String, default: '' },       // the blob that was embedded
  contentHash: { type: String, default: '' },// sha256 of `text` — skip re-embedding if unchanged
  vector: { type: [Number], default: [] },
  model: { type: String, default: '' }
}, { timestamps: true });

knowledgeEmbeddingSchema.index({ sourceType: 1, sourceId: 1 }, { unique: true });

module.exports = mongoose.model('KnowledgeEmbedding', knowledgeEmbeddingSchema);

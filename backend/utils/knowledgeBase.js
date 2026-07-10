// The RAG "project memory" pipeline.
//
// Injection: reindexAll() walks the applicant's editable profile data (projects,
// experience, achievements, skills, education), turns each item into a text blob,
// and embeds+stores any new-or-changed item into the KnowledgeEmbedding store.
// Because embeddings persist and grow across every resume the user builds, the
// agent accumulates a durable, searchable memory of the applicant's real evidence.
//
// Retrieval: retrieve(queryText, ...) embeds the query (a JD, a missing ATS
// keyword, etc.) and returns the most semantically relevant evidence chunks.

const crypto = require('crypto');

const KnowledgeEmbedding = require('../models/KnowledgeEmbedding');
const Project = require('../models/Project');
const Experience = require('../models/Experience');
const Achievement = require('../models/Achievement');
const Skill = require('../models/Skill');
const Education = require('../models/Education');

const { embedText, cosineSim } = require('./embeddings');

const hashOf = text => crypto.createHash('sha256').update(text).digest('hex');

// Turn each source record into { sourceId, title, text } describing the evidence.
async function collectSourceItems() {
  const [projects, experience, achievements, skills, education] = await Promise.all([
    Project.find({ isVisible: true }).lean(),
    Experience.find({ isVisible: true }).lean(),
    Achievement.find({ isVisible: true }).lean(),
    Skill.find({ isVisible: true }).lean(),
    Education.find({ isVisible: true }).lean()
  ]);

  const items = [];

  projects.forEach(p => items.push({
    sourceType: 'project',
    sourceId: p._id,
    title: `Project: ${p.title}`,
    text: [p.title, p.description, (p.techStack || []).join(', '), p.category].filter(Boolean).join('. ')
  }));

  experience.forEach(e => items.push({
    sourceType: 'experience',
    sourceId: e._id,
    title: `Experience: ${e.role || ''}${e.organization ? ' @ ' + e.organization : ''}`.trim(),
    text: [e.role, e.organization, (e.bullets || []).join('. '), (e.techStack || []).join(', ')].filter(Boolean).join('. ')
  }));

  achievements.forEach(a => items.push({
    sourceType: 'achievement',
    sourceId: a._id,
    title: `Achievement: ${a.title}`,
    text: [a.title, a.description].filter(Boolean).join('. ')
  }));

  skills.forEach(s => items.push({
    sourceType: 'skill',
    sourceId: s._id,
    title: `Skill: ${s.name}`,
    text: s.name
  }));

  education.forEach(ed => items.push({
    sourceType: 'education',
    sourceId: ed._id,
    title: `Education: ${ed.degree || ''}`.trim(),
    text: [ed.degree, ed.institution, ed.location, (ed.highlights || []).join('. ')].filter(Boolean).join('. ')
  }));

  return items.filter(i => i.text && i.text.trim());
}

// Injection pipeline. Embeds only new/changed items; deletes embeddings whose
// source record was removed or hidden. Returns a small summary for the UI.
async function reindexAll() {
  const items = await collectSourceItems();
  const existing = await KnowledgeEmbedding.find().lean();
  const byId = new Map(existing.map(e => [String(e.sourceId), e]));
  const liveIds = new Set(items.map(i => String(i.sourceId)));

  let embedded = 0, unchanged = 0;

  for (const item of items) {
    const contentHash = hashOf(item.text);
    const prev = byId.get(String(item.sourceId));
    if (prev && prev.contentHash === contentHash && (prev.vector || []).length) {
      unchanged++;
      continue;
    }
    const vector = await embedText(item.text);
    await KnowledgeEmbedding.findOneAndUpdate(
      { sourceType: item.sourceType, sourceId: item.sourceId },
      { ...item, contentHash, vector, model: process.env.EMBED_MODEL || 'text-embedding-3-small' },
      { upsert: true, new: true }
    );
    embedded++;
  }

  // Prune embeddings whose source is gone/hidden so retrieval never surfaces stale evidence
  const stale = existing.filter(e => !liveIds.has(String(e.sourceId)));
  if (stale.length) {
    await KnowledgeEmbedding.deleteMany({ _id: { $in: stale.map(e => e._id) } });
  }

  return { total: items.length, embedded, unchanged, pruned: stale.length };
}

// If the store is empty (e.g. first run for this JD), build it lazily so callers
// never have to force a manual reindex before retrieval works.
async function ensureIndexed() {
  const count = await KnowledgeEmbedding.estimatedDocumentCount();
  if (count === 0) return reindexAll();
  return { total: count, embedded: 0, unchanged: count, pruned: 0 };
}

// Retrieve the top-K most relevant evidence chunks for a free-text query.
// `types` optionally restricts to certain sourceTypes.
async function retrieve(queryText, { k = 6, types = null, minScore = 0 } = {}) {
  const filter = types ? { sourceType: { $in: types } } : {};
  const store = await KnowledgeEmbedding.find(filter).lean();
  if (!store.length) return [];

  const qVec = await embedText(queryText);
  return store
    .map(e => ({
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      title: e.title,
      text: e.text,
      score: cosineSim(qVec, e.vector || [])
    }))
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// Semantic similarity score (0-100) for each given projectId vs a query — used to
// blend a RAG signal into the LLM project ranking. Falls back to empty map on error.
async function projectSimilarityScores(queryText) {
  try {
    const rows = await KnowledgeEmbedding.find({ sourceType: 'project' }).lean();
    if (!rows.length) return new Map();
    const qVec = await embedText(queryText);
    const map = new Map();
    for (const r of rows) {
      const sim = cosineSim(qVec, r.vector || []);        // ~[-0.1, 0.9] in practice
      map.set(String(r.sourceId), Math.round(Math.max(0, Math.min(1, sim)) * 100));
    }
    return map;
  } catch (err) {
    console.warn('[knowledgeBase] projectSimilarityScores failed:', err.message);
    return new Map();
  }
}

module.exports = { reindexAll, ensureIndexed, retrieve, projectSimilarityScores };

// OpenAI text embeddings + cosine similarity — the vector layer behind the
// agent's RAG "project memory". No external vector DB needed: vectors are stored
// as plain arrays in MongoDB and ranked in-process (the applicant's knowledge
// base is small — tens of items — so brute-force cosine is fast and dependency-free).

const OpenAI = require('openai');

let _client = null;
function client() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set.');
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

// text-embedding-3-small: 1536 dims, cheap and strong for retrieval.
const EMBED_MODEL = () => process.env.EMBED_MODEL || 'text-embedding-3-small';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Embed one or many strings. Returns number[] for a string, number[][] for an array.
// OpenAI accepts an array `input`, so a batch is a single request. Retries transient errors.
async function embed(input) {
  const isBatch = Array.isArray(input);
  const payload = (isBatch ? input : [input])
    .map(t => String(t || '').trim().slice(0, 8000));
  if (!payload.length || payload.some(t => !t)) throw new Error('embed: empty input');

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await client().embeddings.create({ model: EMBED_MODEL(), input: payload });
      const vectors = res.data
        .sort((a, b) => a.index - b.index)   // API preserves order, but be defensive
        .map(d => d.embedding);
      if (!vectors.length || !Array.isArray(vectors[0])) throw new Error('no embedding returned');
      return isBatch ? vectors : vectors[0];
    } catch (err) {
      lastErr = err;
      console.warn(`[embeddings] attempt ${attempt} failed:`, err.message);
      if (attempt < 3) await sleep(attempt * 1500);
    }
  }
  throw new Error(`Embedding failed: ${lastErr.message}`);
}

const embedText = text => embed(text);
const embedBatch = texts => embed(texts);

// Standard cosine similarity in [-1, 1]; returns 0 for degenerate/mismatched vectors.
function cosineSim(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

module.exports = { embedText, embedBatch, cosineSim };

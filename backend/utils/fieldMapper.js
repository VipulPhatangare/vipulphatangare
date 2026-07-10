const { GoogleGenerativeAI } = require('@google/generative-ai');
const { embedBatch } = require('./embedder');
const { retrieve } = require('./retriever');
const { buildAnswerBank } = require('./answerBank');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Tuning knobs ─────────────────────────────────────────
// Cosine on text-embedding-3-small runs lower than intuition suggests, so these
// are deliberately moderate. An exact keyword (alias) hit bypasses them entirely.
const ALIAS_CONFIDENCE = 0.9;   // confidence assigned to a keyword match
const EMBED_OK        = 0.5;    // fuzzy factual match at/above this is auto-filled
const RAG_OK          = 0.55;   // top retrieval score needed to trust an essay answer

// File-upload targets. Phase 4 makes this configurable + does the actual upload;
// here we only decide *which* file each upload question wants.
const DEFAULT_DOC_MAP = [
  { key: 'resume',    path: '/docs/resume.pdf', aliases: ['resume', 'cv', 'curriculum vitae'] },
  { key: 'tenth',     path: '/docs/10th.pdf',   aliases: ['10th', 'tenth', 'ssc', 'class 10', 'x marksheet'] },
  { key: 'twelfth',   path: '/docs/12th.pdf',   aliases: ['12th', 'twelfth', 'hsc', 'class 12', 'xii'] },
  { key: 'marksheet', path: '/docs/marksheet.pdf', aliases: ['marksheet', 'mark sheet', 'grade card'] },
  { key: 'photo',     path: '/docs/photo.jpg',  aliases: ['photo', 'photograph', 'passport size'] }
];

const ESSAY_RE = /\b(why|describe|explain|tell us|what makes|reason|motivat|yourself|strength|weakness|challenge|proud|about you|cover letter|interest)\b/i;

// ── Helpers ──────────────────────────────────────────────
function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// Longest alias that appears as a whole phrase in the question wins (most specific).
function aliasMatch(qNorm, bank) {
  let best = null, bestLen = 0;
  for (const entry of bank) {
    for (const alias of entry.aliases) {
      const a = normalize(alias);
      const re = new RegExp(`(^|\\s)${a.replace(/\s+/g, '\\s+')}(\\s|$)`);
      if (re.test(qNorm) && a.length > bestLen) { best = entry; bestLen = a.length; }
    }
  }
  return best;
}

function matchDoc(qNorm) {
  for (const doc of DEFAULT_DOC_MAP) {
    if (doc.aliases.some(a => qNorm.includes(normalize(a)))) return doc;
  }
  return null;
}

// Maps a free-text factual value onto one of a choice question's options.
function mapToOption(value, options) {
  if (!value || !options?.length) return null;
  const v = normalize(value);
  // Exact / containment either direction.
  let hit = options.find(o => { const n = normalize(o); return n === v || v.includes(n) || n.includes(v); });
  if (hit) return hit;
  // Token overlap fallback (e.g. value "Computer Science (AI & ML)" vs option "CSE").
  const vTokens = new Set(v.split(' ').filter(Boolean));
  let bestOpt = null, bestOverlap = 0;
  for (const o of options) {
    const oTokens = normalize(o).split(' ').filter(Boolean);
    const overlap = oTokens.filter(t => vTokens.has(t)).length;
    if (overlap > bestOverlap) { bestOverlap = overlap; bestOpt = o; }
  }
  return bestOverlap >= 1 ? bestOpt : null;
}

function validate(key, value) {
  if (!value) return '';
  if (key === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return 'Stored email looks malformed';
  if (key === 'phone') { const d = value.replace(/\D/g, ''); if (d.length < 10 || d.length > 13) return 'Stored phone number looks malformed'; }
  return '';
}

async function composeEssayAnswer(question, chunks) {
  if (!chunks.length) return { answer: '', insufficient: true };
  const context = chunks.map(c => `[${c.sourceLabel || 'KB'}]\n${c.text}`).join('\n\n---\n\n');
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    systemInstruction:
      `You draft honest first-person answers for Vipul Phatangare on job/internship application forms. ` +
      `Use ONLY the facts in the provided context — never invent companies, numbers, or achievements. ` +
      `Keep it concise (3-5 sentences), specific, and professional. ` +
      `If the context does not contain enough to answer truthfully, reply with exactly: INSUFFICIENT_CONTEXT`,
    generationConfig: { maxOutputTokens: 400, temperature: 0.4 }
  });
  const result = await model.generateContent(`CONTEXT:\n${context}\n\nQUESTION: ${question}\n\nAnswer:`);
  const text = result.response.text().trim();
  if (/INSUFFICIENT_CONTEXT/i.test(text)) return { answer: '', insufficient: true };
  return { answer: text, insufficient: false };
}

// ── Main ─────────────────────────────────────────────────
// Maps each extracted question to an answer with a source + confidence. Anything
// uncertain is returned status:'needs_review' rather than guessed.
async function mapFormFields(questions) {
  const bank = await buildAnswerBank();
  const [bankVectors, qVectors] = await Promise.all([
    embedBatch(bank.map(b => b.label)),
    embedBatch(questions.map(q => q.text || 'untitled question'))
  ]);

  const results = [];
  for (let i = 0; i < questions.length; i++) {
    results.push(await mapOne(questions[i], qVectors[i], bank, bankVectors));
  }
  return results;
}

async function mapOne(q, qVec, bank, bankVectors) {
  const base = {
    entryId: q.entryId, text: q.text, type: q.type, required: !!q.required,
    options: q.options || [], answer: '', source: 'manual', confidence: 0,
    status: 'needs_review', note: ''
  };
  const qNorm = normalize(q.text);
  const isChoice = ['multiple_choice', 'dropdown', 'checkboxes'].includes(q.type);

  // 1) File uploads → doc map (actual upload happens in Phase 4).
  if (q.type === 'file_upload') {
    const doc = matchDoc(qNorm);
    if (doc) return { ...base, source: 'file', answer: doc.path, confidence: ALIAS_CONFIDENCE, status: 'ok' };
    return { ...base, note: 'Upload field — no matching file in the doc map.' };
  }

  // 2) Essay / open-ended → RAG (grounded, never fabricated).
  if (q.type === 'paragraph' || ESSAY_RE.test(q.text)) {
    const chunks = await retrieve(qVec, 5);
    const top = chunks[0]?.score || 0;
    const { answer, insufficient } = await composeEssayAnswer(q.text, chunks);
    if (!insufficient && answer && top >= RAG_OK)
      return { ...base, source: 'rag', answer, confidence: Math.round(top * 100) / 100, status: 'ok' };
    return { ...base, source: 'rag', answer, confidence: Math.round(top * 100) / 100,
      note: insufficient ? 'Not enough resume/project context to answer confidently.' : 'Low-confidence draft — please review.' };
  }

  // 3) Factual — keyword (alias) match first, then embedding fallback.
  let entry = aliasMatch(qNorm, bank);
  let confidence = ALIAS_CONFIDENCE;
  if (!entry) {
    let best = -1, idx = -1;
    for (let j = 0; j < bankVectors.length; j++) {
      const s = cosine(qVec, bankVectors[j]);
      if (s > best) { best = s; idx = j; }
    }
    if (best >= EMBED_OK) { entry = bank[idx]; confidence = Math.round(best * 100) / 100; }
    else return { ...base, note: 'No confident match in your saved details.' };
  }

  // Safety guard: never drop a text value (name, phone, …) into a date/time field.
  // Only an explicit date field (isDate) or a year-like field is acceptable there.
  if (['date', 'time'].includes(q.type) && !entry.isDate && entry.key !== 'gradYear')
    return { ...base, note: 'Date/time field — no matching stored value. Enter it manually.' };

  // Matched a field but there is no stored value. Optional questions are fine to
  // leave blank (never fill "NA"); required ones must be flagged.
  if (!entry.value) {
    if (!q.required) return { ...base, source: 'kv', confidence, answer: '', status: 'ok', note: 'Optional — left blank.' };
    return { ...base, source: 'kv', confidence, note: `Matched "${entry.label}" but no value is saved — fill it in.` };
  }

  // Choice questions must resolve to an actual option.
  if (isChoice) {
    const opt = mapToOption(entry.value, q.options);
    if (opt) return { ...base, source: 'kv', answer: opt, confidence, status: 'ok' };
    return { ...base, source: 'kv', answer: entry.value, confidence,
      note: `Could not match "${entry.value}" to an option — pick one.` };
  }

  const warn = validate(entry.key, entry.value);
  return { ...base, source: 'kv', answer: entry.value, confidence,
    status: warn ? 'needs_review' : 'ok', note: warn };
}

module.exports = { mapFormFields, DEFAULT_DOC_MAP };

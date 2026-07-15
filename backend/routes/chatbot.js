const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const auth = require('../middleware/auth');
const ChatbotChunk = require('../models/ChatbotChunk');
const ChatbotConfig = require('../models/ChatbotConfig');
const { DEFAULT_SYSTEM_PROMPT } = require('../models/ChatbotConfig');
const ChatMessage = require('../models/ChatMessage');
const Project = require('../models/Project');
const { chunkText } = require('../utils/chunker');
const { embed, embedBatch } = require('../utils/embedder');
const { retrieve } = require('../utils/retriever');
const { generateResponse } = require('../utils/generator');

const HISTORY_TURNS = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  }
});

async function getConfig() {
  let config = await ChatbotConfig.findOne();
  if (!config) {
    config = await ChatbotConfig.create({});
  } else if (!config.systemPrompt.includes('CONVERSATION HISTORY')) {
    // Auto-migrate: prompt missing latest template fields — replace with current default
    config.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    config.topK = Math.max(config.topK || 5, 8);
    await config.save();
  }
  return config;
}

// ── PUBLIC ──────────────────────────────────────────────────────────

// GET /api/chatbot/config  (frontend needs typingSpeed)
router.get('/config', async (req, res) => {
  try {
    const config = await getConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Find projects whose title/description matches the query
async function findRelatedProjects(message) {
  const words = message.toLowerCase().match(/\b\w{4,}\b/g) || [];
  if (words.length === 0) return [];
  const pattern = words.join('|');
  return Project.find({
    $or: [
      { title: { $regex: pattern, $options: 'i' } },
      { description: { $regex: pattern, $options: 'i' } },
      { category: { $regex: pattern, $options: 'i' } }
    ]
  }).limit(4).lean();
}

// POST /api/chatbot/chat
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });
    const sessionId = req.body.sessionId?.trim() || crypto.randomUUID();
    const trimmedMessage = message.trim();

    await ChatMessage.create({ sessionId, role: 'user', text: trimmedMessage });

    // Last HISTORY_TURNS messages preceding this one, oldest first
    const priorMessages = await ChatMessage.find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(HISTORY_TURNS + 1)
      .lean();
    const history = priorMessages
      .slice(1)
      .reverse()
      .map(m => ({ role: m.role, parts: [{ text: m.text }] }));

    const config = await getConfig();
    const queryVector = await embed(trimmedMessage);
    const [chunks, projects] = await Promise.all([
      retrieve(queryVector, config.topK),
      findRelatedProjects(trimmedMessage)
    ]);
    const result = await generateResponse(trimmedMessage, chunks, projects, config, history);

    await ChatMessage.create({ sessionId, role: 'model', text: result.rawText });
    delete result.rawText;

    res.json({ ...result, sessionId });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Failed to generate response', detail: err.message });
  }
});

// ── ADMIN ────────────────────────────────────────────────────────────

// GET /api/chatbot/chunks  (paginated + search, excludes embedding array)
router.get('/chunks', auth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 10;
    const skip  = (page - 1) * limit;
    const q     = req.query.search?.trim();
    const filter = q
      ? { $or: [
          { text:        { $regex: q, $options: 'i' } },
          { sourceLabel: { $regex: q, $options: 'i' } },
        ] }
      : {};
    const total  = await ChatbotChunk.countDocuments(filter);
    const chunks = await ChatbotChunk.find(filter, '-embedding')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    res.json({ chunks, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chatbot/chunks/text
router.post('/chunks/text', auth, async (req, res) => {
  try {
    const { text, sourceLabel } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Text is required' });

    const chunks = chunkText(text.trim());
    if (chunks.length === 0) return res.status(400).json({ error: 'No chunks generated' });

    const embeddings = await embedBatch(chunks);
    const label = sourceLabel?.trim() || 'Manual Entry';

    const docs = chunks.map((chunk, i) => ({
      text: chunk,
      source: 'manual',
      sourceLabel: label,
      embedding: embeddings[i],
      chunkIndex: i
    }));

    const saved = await ChatbotChunk.insertMany(docs);
    res.json({ message: `Stored ${saved.length} chunk(s)`, count: saved.length });
  } catch (err) {
    console.error('Text chunk error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chatbot/chunks/pdf
router.post('/chunks/pdf', auth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'PDF file required' });

    const parser = new PDFParse({ data: req.file.buffer });
    let text;
    try {
      const data = await parser.getText();
      text = data.text?.trim();
    } finally {
      await parser.destroy();
    }
    if (!text) return res.status(400).json({ error: 'Could not extract text from PDF' });

    const chunks = chunkText(text);
    if (chunks.length === 0) return res.status(400).json({ error: 'No chunks generated from PDF' });

    const embeddings = await embedBatch(chunks);
    const label = req.body.sourceLabel?.trim() || req.file.originalname || 'PDF Upload';

    const docs = chunks.map((chunk, i) => ({
      text: chunk,
      source: 'pdf',
      sourceLabel: label,
      embedding: embeddings[i],
      chunkIndex: i
    }));

    const saved = await ChatbotChunk.insertMany(docs);
    res.json({ message: `Stored ${saved.length} chunk(s) from PDF`, count: saved.length });
  } catch (err) {
    console.error('PDF error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/chatbot/chunks/:id
router.delete('/chunks/:id', auth, async (req, res) => {
  try {
    await ChatbotChunk.findByIdAndDelete(req.params.id);
    res.json({ message: 'Chunk deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/chatbot/config
router.put('/config', auth, async (req, res) => {
  try {
    let config = await ChatbotConfig.findOne();
    if (!config) config = new ChatbotConfig();
    const { systemPrompt, modelName, maxTokens, typingSpeed, topK } = req.body;
    if (systemPrompt !== undefined) config.systemPrompt = systemPrompt;
    if (modelName !== undefined) config.modelName = modelName;
    if (maxTokens !== undefined) config.maxTokens = Number(maxTokens);
    if (typingSpeed !== undefined) config.typingSpeed = Number(typingSpeed);
    if (topK !== undefined) config.topK = Number(topK);
    await config.save();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

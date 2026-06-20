const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { embed } = require('../utils/embedder');
const { retrieve } = require('../utils/retriever');
const { generateLinkedInPosts } = require('../utils/linkedinGenerator');
const LinkedInPost = require('../models/LinkedInPost');
const LinkedInAgentConfig = require('../models/LinkedInAgentConfig');

// ── CONFIG ──────────────────────────────────────────────
// GET config (needed by the agent UI)
router.get('/linkedin/config', auth, async (req, res) => {
  try {
    let config = await LinkedInAgentConfig.findOne();
    if (!config) config = await LinkedInAgentConfig.create({});
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT config (admin edits prompt / model settings)
router.put('/linkedin/config', auth, async (req, res) => {
  try {
    const { systemPrompt, modelName, maxTokens, topK } = req.body;
    let config = await LinkedInAgentConfig.findOne();
    if (!config) config = new LinkedInAgentConfig();
    if (systemPrompt !== undefined) config.systemPrompt = systemPrompt;
    if (modelName !== undefined) config.modelName = modelName;
    if (maxTokens !== undefined) config.maxTokens = Number(maxTokens);
    if (topK !== undefined) config.topK = Number(topK);
    await config.save();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GENERATE ────────────────────────────────────────────
router.post('/linkedin/generate', auth, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

    let config = await LinkedInAgentConfig.findOne();
    if (!config) config = await LinkedInAgentConfig.create({});

    const queryVector = await embed(prompt);
    const chunks = await retrieve(queryVector, config.topK);
    const variants = await generateLinkedInPosts(prompt, chunks, config);

    const post = await LinkedInPost.create({ userPrompt: prompt, variants });

    res.json({
      post,
      sources: chunks.map(c => ({ sourceLabel: c.sourceLabel, score: c.score }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POSTS (history) ─────────────────────────────────────
router.get('/linkedin/posts', auth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 10;
    const total = await LinkedInPost.countDocuments();
    const posts = await LinkedInPost.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    res.json({ posts, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/linkedin/posts/:id', auth, async (req, res) => {
  try {
    await LinkedInPost.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

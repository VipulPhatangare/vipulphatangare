const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { embed } = require('../utils/embedder');
const { retrieve } = require('../utils/retriever');
const { generateComponents, regenerateSection } = require('../utils/linkedinGenerator');
const { fetchUrlMeta } = require('../utils/urlFetcher');
const LinkedInPost = require('../models/LinkedInPost');
const LinkedInAgentConfig = require('../models/LinkedInAgentConfig');

// ── CONFIG ──────────────────────────────────────────────────────────────────
router.get('/linkedin/config', auth, async (req, res) => {
  try {
    let config = await LinkedInAgentConfig.findOne();
    if (!config) config = await LinkedInAgentConfig.create({});
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/linkedin/config', auth, async (req, res) => {
  try {
    const { systemPrompt, modelName, maxTokens, topK } = req.body;
    let config = await LinkedInAgentConfig.findOne();
    if (!config) config = new LinkedInAgentConfig();
    if (systemPrompt !== undefined) config.systemPrompt = systemPrompt;
    if (modelName   !== undefined) config.modelName = modelName;
    if (maxTokens   !== undefined) config.maxTokens = Number(maxTokens);
    if (topK        !== undefined) config.topK = Number(topK);
    await config.save();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GENERATE (returns components: 10 titles, 3 bodies, hashtags) ────────────
router.post('/linkedin/generate', auth, async (req, res) => {
  try {
    const { prompt, tone, length, projectUrl } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

    let config = await LinkedInAgentConfig.findOne();
    if (!config) config = await LinkedInAgentConfig.create({});

    const queryVector = await embed(prompt);
    const chunks = await retrieve(queryVector, config.topK);

    const urlMeta = projectUrl?.trim() ? await fetchUrlMeta(projectUrl.trim()) : null;
    const generation = await generateComponents(prompt, chunks, config, tone, length, urlMeta);

    res.json({
      generation,
      sources: chunks.map(c => ({ sourceLabel: c.sourceLabel, score: c.score })),
      urlMeta
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── REGENERATE SECTION ───────────────────────────────────────────────────────
router.post('/linkedin/regenerate', auth, async (req, res) => {
  try {
    const { prompt, tone, length, section, bodyIndex, projectUrl } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });
    if (!section)        return res.status(400).json({ error: 'Section is required' });

    let config = await LinkedInAgentConfig.findOne();
    if (!config) config = await LinkedInAgentConfig.create({});

    const queryVector = await embed(prompt);
    const chunks = await retrieve(queryVector, config.topK);
    const result = await regenerateSection(prompt, chunks, config, tone, length, section, bodyIndex, projectUrl?.trim() || '');

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SAVE COMBO TO HISTORY ───────────────────────────────────────────────────
router.post('/linkedin/save', auth, async (req, res) => {
  try {
    const { userPrompt, tone, length, finalPost, isFavorite } = req.body;
    if (!userPrompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });
    const post = await LinkedInPost.create({
      userPrompt,
      tone:       tone   || 'professional',
      length:     length || 'medium',
      finalPost:  finalPost || '',
      isFavorite: Boolean(isFavorite)
    });
    res.json({ post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── TOGGLE FAVORITE ─────────────────────────────────────────────────────────
router.patch('/linkedin/posts/:id/favorite', auth, async (req, res) => {
  try {
    const post = await LinkedInPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    post.isFavorite = !post.isFavorite;
    await post.save();
    res.json({ post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POSTS (history) ─────────────────────────────────────────────────────────
router.get('/linkedin/posts', auth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 10;
    const total = await LinkedInPost.countDocuments();
    const posts = await LinkedInPost.find()
      .sort({ isFavorite: -1, createdAt: -1 })
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

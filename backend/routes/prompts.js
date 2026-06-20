const express = require('express');
const router = express.Router();
const Prompt = require('../models/Prompt');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const prompts = await Prompt.find().sort({ createdAt: -1 });
    res.json(prompts);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const prompt = new Prompt(req.body);
    await prompt.save();
    res.status(201).json(prompt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const prompt = await Prompt.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!prompt) return res.status(404).json({ error: 'Prompt not found.' });
    res.json(prompt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const prompt = await Prompt.findByIdAndDelete(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found.' });
    res.json({ message: 'Prompt deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;

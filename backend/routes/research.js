const express = require('express');
const router = express.Router();
const Research = require('../models/Research');
const authMiddleware = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const papers = await Research.find({ isVisible: true }).sort({ order: 1, createdAt: -1 });
    res.json(papers);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/all', authMiddleware, async (req, res) => {
  try {
    const papers = await Research.find().sort({ order: 1, createdAt: -1 });
    res.json(papers);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const paper = new Research(req.body);
    await paper.save();
    res.status(201).json(paper);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const paper = await Research.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!paper) return res.status(404).json({ error: 'Paper not found.' });
    res.json(paper);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const paper = await Research.findByIdAndDelete(req.params.id);
    if (!paper) return res.status(404).json({ error: 'Paper not found.' });
    res.json({ message: 'Paper deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Experience = require('../models/Experience');
const authMiddleware = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const items = await Experience.find({ isVisible: true }).sort({ order: 1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/all', authMiddleware, async (req, res) => {
  try {
    const items = await Experience.find().sort({ order: 1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const item = new Experience(req.body);
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const item = await Experience.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: 'Experience entry not found.' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const item = await Experience.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Experience entry not found.' });
    res.json({ message: 'Experience entry deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;

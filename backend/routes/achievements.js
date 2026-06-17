const express = require('express');
const router = express.Router();
const Achievement = require('../models/Achievement');
const authMiddleware = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const achievements = await Achievement.find({ isVisible: true }).sort({ order: 1, createdAt: -1 });
    res.json(achievements);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/all', authMiddleware, async (req, res) => {
  try {
    const achievements = await Achievement.find().sort({ order: 1, createdAt: -1 });
    res.json(achievements);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const achievement = new Achievement(req.body);
    await achievement.save();
    res.status(201).json(achievement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const achievement = await Achievement.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!achievement) return res.status(404).json({ error: 'Achievement not found.' });
    res.json(achievement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const achievement = await Achievement.findByIdAndDelete(req.params.id);
    if (!achievement) return res.status(404).json({ error: 'Achievement not found.' });
    res.json({ message: 'Achievement deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;

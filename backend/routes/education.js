const express = require('express');
const router = express.Router();
const Education = require('../models/Education');
const authMiddleware = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const items = await Education.find({ isVisible: true }).sort({ order: 1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/all', authMiddleware, async (req, res) => {
  try {
    const items = await Education.find().sort({ order: 1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const item = new Education(req.body);
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const item = await Education.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: 'Education entry not found.' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const item = await Education.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Education entry not found.' });
    res.json({ message: 'Education entry deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;

const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const AnswerBank = require('../models/AnswerBank');
const { buildAnswerBank } = require('../utils/answerBank');

// GET /api/answerbank            → editable custom entries
// GET /api/answerbank?merged=1   → the full effective bank (model-derived + custom)
router.get('/', auth, async (req, res) => {
  try {
    if (req.query.merged) return res.json(await buildAnswerBank());
    res.json(await AnswerBank.find().sort({ order: 1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/answerbank/:key  { label?, value?, aliases?, isDate?, category?, order? }
// Upsert one fact by key.
router.put('/:key', auth, async (req, res) => {
  try {
    const key = String(req.params.key).trim().toLowerCase();
    if (!key) return res.status(400).json({ error: 'key is required' });
    const { label, value, aliases, isDate, category, order } = req.body;
    const update = {};
    if (label   !== undefined) update.label   = label;
    if (value   !== undefined) update.value   = value;
    if (aliases !== undefined) update.aliases = Array.isArray(aliases) ? aliases : String(aliases).split(',').map(s => s.trim()).filter(Boolean);
    if (isDate  !== undefined) update.isDate  = !!isDate;
    if (category!== undefined) update.category = category;
    if (order   !== undefined) update.order   = order;

    const entry = await AnswerBank.findOneAndUpdate({ key }, { $set: update, $setOnInsert: { key } },
      { new: true, upsert: true, setDefaultsOnInsert: true });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/answerbank/:key
router.delete('/:key', auth, async (req, res) => {
  try {
    await AnswerBank.deleteOne({ key: String(req.params.key).trim().toLowerCase() });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

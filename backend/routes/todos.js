const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const Todo    = require('../models/Todo');

// GET /api/todos?date=YYYY-MM-DD
router.get('/', auth, async (req, res) => {
  try {
    const { date } = req.query;
    const filter = date ? { date } : {};
    const todos = await Todo.find(filter).sort({ createdAt: 1 });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/todos
router.post('/', auth, async (req, res) => {
  try {
    const { text, date, priority } = req.body;
    if (!text?.trim() || !date) return res.status(400).json({ error: 'text and date are required' });
    const todo = await Todo.create({ text: text.trim(), date, priority: priority || 'medium' });
    res.status(201).json(todo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/todos/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const { text, done, priority } = req.body;
    const update = {};
    if (text     !== undefined) update.text     = text;
    if (done     !== undefined) update.done     = done;
    if (priority !== undefined) update.priority = priority;
    const todo = await Todo.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!todo) return res.status(404).json({ error: 'Not found' });
    res.json(todo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/todos/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Todo.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

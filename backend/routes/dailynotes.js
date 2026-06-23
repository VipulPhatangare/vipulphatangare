const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const DailyNote = require('../models/DailyNote');
const Settings  = require('../models/Settings');

// Seed default daily notes password if not set
Settings.findOne({ key: 'dailyNotesPassword' }).then(s => {
  if (!s) Settings.create({ key: 'dailyNotesPassword', value: '2410' })
    .then(() => console.log('Daily notes password initialised: 2410'))
    .catch(err => console.error('Settings seed error:', err.message));
});

// POST /api/dailynotes/verify — public, checks pin against DB
router.post('/verify', async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: 'dailyNotesPassword' });
    const correct = setting ? setting.value : '2410';
    if (req.body.password === correct) return res.json({ ok: true });
    res.status(401).json({ ok: false, error: 'Wrong password.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dailynotes — public
router.get('/', async (req, res) => {
  try {
    const notes = await DailyNote.find().sort({ date: -1, createdAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dailynotes — admin only
router.post('/', auth, async (req, res) => {
  try {
    const note = new DailyNote({
      title:   req.body.title,
      date:    req.body.date,
      content: req.body.content,
    });
    await note.save();
    res.status(201).json(note);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/dailynotes/:id — admin only
router.put('/:id', auth, async (req, res) => {
  try {
    const note = await DailyNote.findByIdAndUpdate(
      req.params.id,
      { title: req.body.title, date: req.body.date, content: req.body.content },
      { new: true, runValidators: true }
    );
    if (!note) return res.status(404).json({ error: 'Note not found.' });
    res.json(note);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/dailynotes/:id — admin only
router.delete('/:id', auth, async (req, res) => {
  try {
    const note = await DailyNote.findByIdAndDelete(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found.' });
    res.json({ message: 'Note deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

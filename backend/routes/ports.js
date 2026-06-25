const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Port = require('../models/Port');

// GET /api/ports — all ports sorted by number
router.get('/', auth, async (req, res) => {
  try {
    const ports = await Port.find().sort({ port: 1 });
    res.json(ports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ports — add a port
router.post('/', auth, async (req, res) => {
  try {
    const port = new Port({ port: req.body.port, name: req.body.name });
    await port.save();
    res.status(201).json(port);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: `Port ${req.body.port} already exists.` });
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/ports/:id — update
router.put('/:id', auth, async (req, res) => {
  try {
    const port = await Port.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name },
      { new: true, runValidators: true }
    );
    if (!port) return res.status(404).json({ error: 'Port not found.' });
    res.json(port);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/ports/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const port = await Port.findByIdAndDelete(req.params.id);
    if (!port) return res.status(404).json({ error: 'Port not found.' });
    res.json({ message: 'Port deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

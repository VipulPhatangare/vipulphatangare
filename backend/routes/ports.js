const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Port = require('../models/Port');

const PRESETS = [
  { port: 22,    name: 'SSH',            description: 'Secure Shell remote access',       protocol: 'TCP',     category: 'system'   },
  { port: 53,    name: 'DNS',            description: 'Domain Name System',               protocol: 'TCP/UDP', category: 'system'   },
  { port: 80,    name: 'HTTP',           description: 'Hypertext Transfer Protocol',      protocol: 'TCP',     category: 'web'      },
  { port: 443,   name: 'HTTPS',          description: 'HTTP Secure (TLS/SSL)',            protocol: 'TCP',     category: 'web'      },
  { port: 3001,  name: 'Dev Server',     description: 'Local development server',         protocol: 'TCP',     category: 'custom'   },
  { port: 4343,  name: 'Custom App',     description: 'Custom application port',          protocol: 'TCP',     category: 'custom'   },
  { port: 5000,  name: 'Flask / Dev',    description: 'Flask / general dev server',       protocol: 'TCP',     category: 'custom'   },
  { port: 5050,  name: 'pgAdmin',        description: 'pgAdmin web interface',            protocol: 'TCP',     category: 'database' },
  { port: 5665,  name: 'Backend API',    description: 'Portfolio backend server',         protocol: 'TCP',     category: 'custom'   },
  { port: 27017, name: 'MongoDB',        description: 'MongoDB database default port',    protocol: 'TCP',     category: 'database' },
];

// Seed presets once on startup (upsert so re-runs are safe)
async function seedPresets() {
  for (const p of PRESETS) {
    await Port.updateOne({ port: p.port }, { $setOnInsert: { ...p, isPreset: true } }, { upsert: true });
  }
}
seedPresets().catch(err => console.error('Port seed error:', err.message));

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
    const port = new Port(req.body);
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
    const port = await Port.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!port) return res.status(404).json({ error: 'Port not found.' });
    res.json(port);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: `Port ${req.body.port} already exists.` });
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

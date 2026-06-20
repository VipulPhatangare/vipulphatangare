const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ApiKey = require('../models/ApiKey');
const { encrypt, decrypt } = require('../utils/encryption');

// All routes require admin auth

// GET /api/apikeys — list all (name, description, id, dates — NO raw key)
// Pinned first (by pinnedAt asc), then rest (by createdAt desc)
router.get('/', auth, async (req, res) => {
  try {
    const keys = await ApiKey.find({}, '-encryptedKey');
    const pinned = keys.filter(k => k.pinned).sort((a, b) => new Date(a.pinnedAt) - new Date(b.pinnedAt));
    const rest   = keys.filter(k => !k.pinned).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json([...pinned, ...rest]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/apikeys/:id/pin — toggle pin (max 3 pinned)
router.patch('/:id/pin', auth, async (req, res) => {
  try {
    const entry = await ApiKey.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });

    if (!entry.pinned) {
      const pinnedCount = await ApiKey.countDocuments({ pinned: true });
      if (pinnedCount >= 3) return res.status(400).json({ error: 'Max 3 keys can be pinned.' });
      entry.pinned = true;
      entry.pinnedAt = new Date();
    } else {
      entry.pinned = false;
      entry.pinnedAt = null;
    }

    await entry.save();
    const { encryptedKey, ...safe } = entry.toObject();
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/apikeys/:id/reveal — return decrypted key for one entry
router.get('/:id/reveal', auth, async (req, res) => {
  try {
    const entry = await ApiKey.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    const key = decrypt(entry.encryptedKey);
    res.json({ key });
  } catch (err) {
    res.status(500).json({ error: 'Failed to decrypt key' });
  }
});

// POST /api/apikeys — create
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, apiKey } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!apiKey?.trim()) return res.status(400).json({ error: 'API key is required' });

    const entry = await ApiKey.create({
      name: name.trim(),
      description: description?.trim() || '',
      encryptedKey: encrypt(apiKey.trim())
    });

    // Return without the encrypted blob
    const { encryptedKey, ...safe } = entry.toObject();
    res.status(201).json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/apikeys/:id — update name / description / key
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, apiKey } = req.body;
    const entry = await ApiKey.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });

    if (name !== undefined) entry.name = name.trim();
    if (description !== undefined) entry.description = description.trim();
    if (apiKey?.trim()) entry.encryptedKey = encrypt(apiKey.trim());
    entry.updatedAt = Date.now();

    await entry.save();
    const { encryptedKey, ...safe } = entry.toObject();
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/apikeys/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await ApiKey.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

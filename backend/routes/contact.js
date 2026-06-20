const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const Contact = require('../models/Contact');

// POST /api/contact  — public, anyone can submit
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, message } = req.body;
    if (!name?.trim())    return res.status(400).json({ error: 'Name is required' });
    if (!phone?.trim())   return res.status(400).json({ error: 'Phone number is required' });
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

    await Contact.create({ name: name.trim(), phone: phone.trim(), email: email?.trim() || '', message: message.trim() });
    res.status(201).json({ message: 'Message sent successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contact  — admin only
router.get('/', auth, async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/contact/:id/read  — mark as read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const doc = await Contact.findByIdAndUpdate(
      req.params.id,
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Message not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contact/:id  — admin only
router.delete('/:id', auth, async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

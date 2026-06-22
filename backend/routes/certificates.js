const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Certificate = require('../models/Certificate');
const authMiddleware = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/certificates');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `cert-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// Public — visible certificates
router.get('/', async (req, res) => {
  try {
    const certs = await Certificate.find({ isVisible: true }).sort({ order: 1, createdAt: -1 });
    res.json(certs);
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Admin — all certificates
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const certs = await Certificate.find().sort({ order: 1, createdAt: -1 });
    res.json(certs);
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Admin — create
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image is required.' });
    const { title, order, isVisible } = req.body;
    const imageUrl = `/uploads/certificates/${req.file.filename}`;
    const cert = new Certificate({
      title,
      imageUrl,
      order: Number(order) || 0,
      isVisible: isVisible !== 'false'
    });
    await cert.save();
    res.status(201).json(cert);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin — update (image optional)
router.put('/:id', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const cert = await Certificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ error: 'Certificate not found.' });

    const { title, order, isVisible } = req.body;
    if (title !== undefined) cert.title = title;
    if (order !== undefined) cert.order = Number(order);
    if (isVisible !== undefined) cert.isVisible = isVisible !== 'false';

    if (req.file) {
      // Delete old image file
      const oldPath = path.join(__dirname, '../..', cert.imageUrl);
      fs.unlink(oldPath, () => {});
      cert.imageUrl = `/uploads/certificates/${req.file.filename}`;
    }

    await cert.save();
    res.json(cert);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin — delete
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const cert = await Certificate.findByIdAndDelete(req.params.id);
    if (!cert) return res.status(404).json({ error: 'Certificate not found.' });
    const filePath = path.join(__dirname, '../..', cert.imageUrl);
    fs.unlink(filePath, () => {});
    res.json({ message: 'Certificate deleted.' });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;

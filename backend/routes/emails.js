const express = require('express');
const router  = express.Router();
const nodemailer = require('nodemailer');
const auth    = require('../middleware/auth');
const Email   = require('../models/Email');
const { analyzeEmail, generateReply, generateDigest } = require('../utils/emailAnalyzer');
const { fetchGmailEmails } = require('../utils/gmailFetcher');
const emailScheduler = require('../utils/emailScheduler');

// ── NODEMAILER TRANSPORTER ───────────────────────────────
function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

// ── ANALYZE EMAIL ────────────────────────────────────────
// POST /api/emails/analyze
router.post('/analyze', auth, async (req, res) => {
  try {
    const { subject, body } = req.body;
    if (!subject?.trim() || !body?.trim())
      return res.status(400).json({ error: 'Subject and body are required' });

    const result = await analyzeEmail(subject.trim(), body.trim());
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GENERATE REPLY ───────────────────────────────────────
// POST /api/emails/generate-reply
router.post('/generate-reply', auth, async (req, res) => {
  try {
    const { subject, body } = req.body;
    if (!subject?.trim() || !body?.trim())
      return res.status(400).json({ error: 'Subject and body are required' });

    const reply = await generateReply(subject.trim(), body.trim());
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DAILY DIGEST ─────────────────────────────────────────
// GET /api/emails/digest
router.get('/digest', auth, async (req, res) => {
  try {
    const emails = await Email.find({ status: { $in: ['unread', 'read'] }, direction: 'incoming' })
      .sort({ priority: 1, createdAt: -1 })
      .limit(30)
      .select('subject from priority category summary body deadline deadlineText requiresReply replyUrgency actionItems tags');

    if (emails.length === 0) {
      return res.json({
        digest: 'Your inbox is empty. No unread emails — you\'re all caught up!',
        stats: { total: 0, high: 0, needsReply: 0, withDeadline: 0, actionCount: 0 }
      });
    }

    const digest = await generateDigest(emails);

    const stats = {
      total:        emails.length,
      high:         emails.filter(e => e.priority === 'high').length,
      needsReply:   emails.filter(e => e.requiresReply).length,
      withDeadline: emails.filter(e => e.deadline).length,
      actionCount:  emails.reduce((sum, e) => sum + (e.actionItems?.length || 0), 0)
    };

    res.json({ digest, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── BULK RE-ANALYZE ──────────────────────────────────────
// POST /api/emails/bulk-reanalyze
// Re-runs AI on emails that have no summary (analysis failed during sync)
router.post('/bulk-reanalyze', auth, async (req, res) => {
  try {
    const emails = await Email.find({ summary: '', direction: 'incoming' }).limit(20);
    if (emails.length === 0) return res.json({ reanalyzed: 0 });

    let reanalyzed = 0;
    for (const email of emails) {
      try {
        const analysis = await analyzeEmail(email.subject, email.body);
        await Email.findByIdAndUpdate(email._id, {
          summary:      analysis.summary,
          priority:     analysis.priority,
          category:     analysis.category,
          deadline:     analysis.deadline,
          deadlineText: analysis.deadlineText,
          tags:         analysis.tags,
          actionItems:  analysis.actionItems,
          requiresReply: analysis.requiresReply,
          replyUrgency:  analysis.replyUrgency
        });
        reanalyzed++;
        await new Promise(r => setTimeout(r, 350));
      } catch { /* skip individual failures */ }
    }

    res.json({ reanalyzed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AUTO-SYNC STATUS ─────────────────────────────────────
// GET /api/emails/sync-status
router.get('/sync-status', auth, (req, res) => {
  res.json(emailScheduler.getStatus());
});

// ── MANUAL TRIGGER ───────────────────────────────────────
// POST /api/emails/trigger-sync
router.post('/trigger-sync', auth, async (req, res) => {
  const s = emailScheduler.getStatus();
  if (s.running) return res.json({ message: 'Sync already in progress', status: s });
  emailScheduler.triggerNow();          // fire-and-forget
  res.json({ message: 'Auto-sync triggered', status: emailScheduler.getStatus() });
});

// ── SEND EMAIL ───────────────────────────────────────────
// POST /api/emails/send
router.post('/send', auth, async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    if (!to?.trim() || !subject?.trim() || !body?.trim())
      return res.status(400).json({ error: 'To, subject, and body are required' });

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || process.env.EMAIL_PASS === 'your_gmail_app_password_here')
      return res.status(503).json({ error: 'Email credentials not configured. Add EMAIL_USER and EMAIL_PASS (Gmail App Password) to backend/.env' });

    const transporter = getTransporter();

    await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Vipul Phatangare'}" <${process.env.EMAIL_USER}>`,
      to:      to.trim(),
      subject: subject.trim(),
      text:    body.trim()
    });

    const saved = await Email.create({
      from:      process.env.EMAIL_USER,
      to:        to.trim(),
      subject:   subject.trim(),
      body:      body.trim(),
      direction: 'outgoing',
      status:    'replied',
      sentAt:    new Date()
    });

    res.json({ message: 'Email sent successfully', email: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SAVE EMAIL ───────────────────────────────────────────
// POST /api/emails
router.post('/', auth, async (req, res) => {
  try {
    const {
      from, to, subject, body, summary, priority, category,
      replyDraft, deadline, deadlineText, tags, status, direction,
      actionItems, requiresReply, replyUrgency
    } = req.body;
    if (!subject?.trim() || !body?.trim())
      return res.status(400).json({ error: 'Subject and body are required' });

    const email = await Email.create({
      from:         from || '',
      to:           to || '',
      subject:      subject.trim(),
      body:         body.trim(),
      summary:      summary || '',
      priority:     priority || 'medium',
      category:     category || 'general',
      replyDraft:   replyDraft || '',
      deadline:     deadline ? new Date(deadline) : null,
      deadlineText: deadlineText || '',
      tags:         tags || [],
      status:       status || 'unread',
      direction:    direction || 'incoming',
      actionItems:  actionItems || [],
      requiresReply: Boolean(requiresReply),
      replyUrgency:  replyUrgency || 'none'
    });

    res.status(201).json(email);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SYNC GMAIL ───────────────────────────────────────────
// POST /api/emails/sync-gmail  { days: 7 }
router.post('/sync-gmail', auth, async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.body.days) || 7, 1), 30);

    const raw = await fetchGmailEmails(days);

    if (raw.length === 0) {
      return res.json({ fetched: 0, saved: 0, skipped: 0, emails: [] });
    }

    const existingIds = new Set(
      (await Email.find({ gmailMessageId: { $in: raw.map(e => e.gmailMessageId) } })
        .select('gmailMessageId').lean())
        .map(e => e.gmailMessageId)
    );

    const newEmails = raw.filter(e => !existingIds.has(e.gmailMessageId));
    const skipped   = raw.length - newEmails.length;

    if (newEmails.length === 0) {
      return res.json({ fetched: raw.length, saved: 0, skipped, emails: [] });
    }

    const CONCURRENCY = 4;
    const saved = [];

    for (let i = 0; i < newEmails.length; i += CONCURRENCY) {
      const batch = newEmails.slice(i, i + CONCURRENCY);

      const results = await Promise.all(batch.map(async (email) => {
        try {
          const analysis = await analyzeEmail(email.subject, email.body);

          return await Email.create({
            gmailMessageId: email.gmailMessageId,
            from:           email.from,
            subject:        email.subject,
            body:           email.body,
            summary:        analysis.summary,
            priority:       analysis.priority,
            category:       analysis.category,
            deadline:       analysis.deadline || null,
            deadlineText:   analysis.deadlineText,
            tags:           analysis.tags,
            actionItems:    analysis.actionItems,
            requiresReply:  analysis.requiresReply,
            replyUrgency:   analysis.replyUrgency,
            status:         'unread',
            direction:      'incoming',
            createdAt:      email.receivedAt
          });
        } catch {
          try {
            return await Email.create({
              gmailMessageId: email.gmailMessageId,
              from:    email.from,
              subject: email.subject,
              body:    email.body,
              status:  'unread',
              direction: 'incoming',
              createdAt: email.receivedAt
            });
          } catch { return null; }
        }
      }));

      saved.push(...results.filter(Boolean));

      if (i + CONCURRENCY < newEmails.length) {
        await new Promise(r => setTimeout(r, 400));
      }
    }

    res.json({ fetched: raw.length, saved: saved.length, skipped, emails: saved });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET ALL EMAILS ───────────────────────────────────────
// GET /api/emails?priority=high&category=tnp&status=unread&hasDeadline=true&requiresReply=true&q=search&page=1
router.get('/', auth, async (req, res) => {
  try {
    const { priority, category, status, hasDeadline, direction, requiresReply, q, page = 1 } = req.query;
    const filter = {};

    if (priority)    filter.priority  = priority;
    if (category)    filter.category  = category;
    if (status)      filter.status    = status;
    if (direction)   filter.direction = direction;
    if (hasDeadline === 'true')    filter.deadline     = { $ne: null };
    if (requiresReply === 'true')  filter.requiresReply = true;

    if (q?.trim()) {
      const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ subject: regex }, { from: regex }, { tags: regex }];
    }

    const limit = 20;
    const total = await Email.countDocuments(filter);
    const emails = await Email.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * limit)
      .limit(limit);

    res.json({ emails, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET UPCOMING DEADLINES ───────────────────────────────
// GET /api/emails/deadlines
router.get('/deadlines', auth, async (req, res) => {
  try {
    const emails = await Email.find({ deadline: { $ne: null } })
      .sort({ deadline: 1 })
      .select('subject from priority category deadline deadlineText status tags createdAt');
    res.json(emails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET FOLLOW-UPS ───────────────────────────────────────
// GET /api/emails/followups
router.get('/followups', auth, async (req, res) => {
  try {
    const emails = await Email.find({ followUpDate: { $ne: null } })
      .sort({ followUpDate: 1 })
      .select('subject from priority category followUpDate followUpNote status tags createdAt');
    res.json(emails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE EMAIL ─────────────────────────────────────────
// PATCH /api/emails/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const allowed = [
      'status', 'replyDraft', 'deadline', 'deadlineText',
      'priority', 'category', 'tags', 'summary',
      'followUpDate', 'followUpNote', 'requiresReply', 'replyUrgency', 'actionItems'
    ];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const email = await Email.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!email) return res.status(404).json({ error: 'Email not found' });
    res.json(email);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE EMAIL ─────────────────────────────────────────
// DELETE /api/emails/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Email.findByIdAndDelete(req.params.id);
    res.json({ message: 'Email deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

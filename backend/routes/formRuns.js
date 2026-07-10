const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const FormRun    = require('../models/FormRun');
const JobPosting = require('../models/JobPosting');
const { fillForm } = require('../utils/formFiller');
const { hasSession } = require('../utils/formSession');

// ── GET ONE ──────────────────────────────────────────────
// GET /api/formruns/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const run = await FormRun.findById(req.params.id);
    if (!run) return res.status(404).json({ error: 'Form run not found' });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── LATEST RUN FOR A POSTING ─────────────────────────────
// GET /api/formruns/by-posting/:postingId
router.get('/by-posting/:postingId', auth, async (req, res) => {
  try {
    const run = await FormRun.findOne({ jobPostingId: req.params.postingId }).sort({ createdAt: -1 });
    if (!run) return res.status(404).json({ error: 'No form run yet for this posting' });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── EDIT A SINGLE FIELD ──────────────────────────────────
// PATCH /api/formruns/:id/field  { index, answer?, status?, reviewed? }
// Editing an answer marks it reviewed and clears the review flag — the human is
// now the source of truth for that field.
router.patch('/:id/field', auth, async (req, res) => {
  try {
    const { index, answer, status, reviewed } = req.body;
    const run = await FormRun.findById(req.params.id);
    if (!run) return res.status(404).json({ error: 'Form run not found' });
    if (index == null || !run.fields[index]) return res.status(400).json({ error: 'Invalid field index' });

    const f = run.fields[index];
    if (answer !== undefined) {
      f.answer   = answer;
      f.source   = 'manual';
      f.reviewed = true;
      f.status   = 'ok';
      f.note     = '';
    }
    if (status !== undefined)   f.status   = status;
    if (reviewed !== undefined) f.reviewed = reviewed;

    await run.save();
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── MARK REVIEWED ────────────────────────────────────────
// POST /api/formruns/:id/review
// Gate before submission: refuses while any field is still needs_review.
router.post('/:id/review', auth, async (req, res) => {
  try {
    const run = await FormRun.findById(req.params.id);
    if (!run) return res.status(404).json({ error: 'Form run not found' });

    // Only unresolved REQUIRED fields block approval — optional blanks are fine.
    const pending = run.fields.filter(f => f.status === 'needs_review' && f.required);
    if (pending.length)
      return res.status(422).json({ error: `${pending.length} required field(s) still need review.`, pending: pending.map(f => f.text) });

    run.status = 'reviewed';
    await run.save();
    await JobPosting.findByIdAndUpdate(run.jobPostingId, { status: 'reviewed' });

    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SESSION STATUS ───────────────────────────────────────
// GET /api/formruns/session/status  — is a Google session saved?
router.get('/session/status', auth, (req, res) => {
  res.json({ hasSession: hasSession() });
});

// ── FILL (preview, no submit) ────────────────────────────
// POST /api/formruns/:id/fill
// Drives a headless browser to fill the form and screenshot it. Never submits.
router.post('/:id/fill', auth, async (req, res) => {
  try {
    const run = await FormRun.findById(req.params.id);
    if (!run) return res.status(404).json({ error: 'Form run not found' });

    const result = await fillForm(run, { submit: false });

    run.warnings       = result.warnings || [];
    run.screenshotPath = result.screenshotPath || run.screenshotPath;
    run.submitStatus   = result.ok ? 'filled' : 'blocked';
    run.error          = result.ok ? '' : (result.error || '');
    await run.save();

    if (!result.ok) return res.status(422).json({ ...result, run });
    res.json({ ...result, run });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SUBMIT (explicit, gated) ─────────────────────────────
// POST /api/formruns/:id/submit
// Only allowed after the run is approved (status 'reviewed'). Fills fresh and
// clicks Submit, so what was approved is exactly what is sent.
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const run = await FormRun.findById(req.params.id);
    if (!run) return res.status(404).json({ error: 'Form run not found' });
    if (run.status !== 'reviewed')
      return res.status(422).json({ error: 'Approve the fields (Review) before submitting.' });

    const result = await fillForm(run, { submit: true });

    run.warnings       = result.warnings || [];
    run.screenshotPath = result.screenshotPath || run.screenshotPath;

    if (result.ok && result.submitted) {
      run.status       = 'submitted';
      run.submitStatus = 'submitted';
      run.submittedAt  = new Date();
      run.error        = '';
      await run.save();
      await JobPosting.findByIdAndUpdate(run.jobPostingId, { status: 'submitted', submittedAt: new Date() });
    } else {
      run.status       = 'failed';
      run.submitStatus = 'failed';
      run.error        = result.error || 'Submission failed';
      await run.save();
      await JobPosting.findByIdAndUpdate(run.jobPostingId, { status: 'failed', lastError: run.error });
      return res.status(422).json({ ...result, run });
    }

    res.json({ ...result, run });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const Email       = require('../models/Email');
const JobPosting  = require('../models/JobPosting');
const { syncJobPostingFromEmail } = require('../utils/jobPostingSync');
const { extractFormSchema } = require('../utils/formExtractor');
const { mapFormFields } = require('../utils/fieldMapper');
const FormRun = require('../models/FormRun');

// ── LIST ─────────────────────────────────────────────────
// GET /api/jobpostings?status=new
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const postings = await JobPosting.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json(postings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET ONE ──────────────────────────────────────────────
// GET /api/jobpostings/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const posting = await JobPosting.findById(req.params.id);
    if (!posting) return res.status(404).json({ error: 'Job posting not found' });
    res.json(posting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── STAGE FROM EMAIL (Apply button) ──────────────────────
// POST /api/jobpostings/from-email/:emailId
// Ensures a JobPosting exists for the given email and returns it. Fails clearly
// when the mail has no Google Form link so the UI can explain why.
router.post('/from-email/:emailId', auth, async (req, res) => {
  try {
    const email = await Email.findById(req.params.emailId);
    if (!email) return res.status(404).json({ error: 'Email not found' });

    // Reuse an already-staged posting rather than depending on category matching,
    // so the Apply button works even if the mail was categorised before this feature.
    let posting = await JobPosting.findOne({ emailId: email._id });
    if (!posting) posting = await syncJobPostingFromEmail(email);

    if (!posting)
      return res.status(422).json({ error: 'No Google Form link was found in this email.' });

    res.json(posting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── EXTRACT FORM SCHEMA ──────────────────────────────────
// POST /api/jobpostings/:id/extract
// Fetches the Google Form and parses its questions. Optional { force } re-runs
// even if already extracted. Also usable ad-hoc via body.formUrl (no posting).
router.post('/:id/extract', auth, async (req, res) => {
  try {
    const posting = await JobPosting.findById(req.params.id);
    if (!posting) return res.status(404).json({ error: 'Job posting not found' });
    if (!posting.formUrl) return res.status(422).json({ error: 'This posting has no form URL.' });

    if (posting.questions?.length && !req.body.force) {
      return res.json(posting); // cached — Phase 6 will template these
    }

    const result = await extractFormSchema(posting.formUrl);
    if (!result.ok) {
      posting.lastError = result.error;
      await posting.save();
      return res.status(422).json({ error: result.error, posting });
    }

    posting.formTitle   = result.title || posting.formTitle;
    posting.questions   = result.questions;
    posting.extractedAt = new Date();
    posting.lastError   = '';
    if (posting.status === 'new') posting.status = 'extracted';
    await posting.save();

    res.json(posting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobpostings/extract-preview  { formUrl }
// Ad-hoc extraction for a raw URL without a stored posting (dev/testing).
router.post('/extract-preview', auth, async (req, res) => {
  try {
    const { formUrl } = req.body;
    if (!formUrl?.trim()) return res.status(400).json({ error: 'formUrl is required' });
    const result = await extractFormSchema(formUrl.trim());
    if (!result.ok) return res.status(422).json({ error: result.error });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── MAP FIELDS (build a review-ready FormRun) ────────────
// POST /api/jobpostings/:id/map
// Extracts the form if needed, maps every question to an answer (KV / RAG / file)
// with a confidence score, and stores a fresh FormRun for the review UI.
router.post('/:id/map', auth, async (req, res) => {
  try {
    const posting = await JobPosting.findById(req.params.id);
    if (!posting) return res.status(404).json({ error: 'Job posting not found' });
    if (!posting.formUrl) return res.status(422).json({ error: 'This posting has no form URL.' });

    // Ensure we have a parsed schema first.
    if (!posting.questions?.length) {
      const schema = await extractFormSchema(posting.formUrl);
      if (!schema.ok) {
        posting.lastError = schema.error;
        await posting.save();
        return res.status(422).json({ error: schema.error });
      }
      posting.formTitle   = schema.title || posting.formTitle;
      posting.questions   = schema.questions;
      posting.extractedAt = new Date();
    }

    const fields = await mapFormFields(posting.questions);

    const run = await FormRun.create({
      jobPostingId: posting._id,
      formUrl:   posting.formUrl,
      formTitle: posting.formTitle,
      fields,
      status: 'draft'
    });

    posting.status   = 'mapped';
    posting.lastError = '';
    await posting.save();

    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE ───────────────────────────────────────────────
// PATCH /api/jobpostings/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const allowed = ['company', 'role', 'status', 'deadline', 'deadlineText'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const posting = await JobPosting.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!posting) return res.status(404).json({ error: 'Job posting not found' });
    res.json(posting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE ───────────────────────────────────────────────
// DELETE /api/jobpostings/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await JobPosting.findByIdAndDelete(req.params.id);
    res.json({ message: 'Job posting deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const JobPosting = require('../models/JobPosting');
const { extractLinks } = require('./linkExtractor');

// Given a saved Email document, detect a Google Form link and stage (upsert) a
// JobPosting for the Auto-Apply pipeline. Only incoming TNP mail that actually
// carries a form link produces a posting — everything else is ignored.
//
// Idempotent: keyed on emailId, so re-saving the same mail updates rather than
// duplicates. Returns the JobPosting (or null when nothing to stage).
async function syncJobPostingFromEmail(email) {
  if (!email || email.direction === 'outgoing') return null;
  if (email.category !== 'tnp') return null;

  const { formUrl, formUrls, docLinks } = extractLinks(email.body || '');
  if (!formUrl) return null; // no form → nothing to apply to

  const doc = await JobPosting.findOneAndUpdate(
    { emailId: email._id },
    {
      $set: {
        emailId:      email._id,
        subject:      email.subject || '',
        from:         email.from || '',
        deadline:     email.deadline || null,
        deadlineText: email.deadlineText || '',
        formUrl,
        formUrls,
        docLinks,
        rawEmailSnippet: (email.body || '').slice(0, 500)
      },
      // Never downgrade a posting the user has already advanced; only seed the
      // status when the posting is first created.
      $setOnInsert: { status: 'new' }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return doc;
}

module.exports = { syncJobPostingFromEmail };

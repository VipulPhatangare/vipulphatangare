const cron = require('node-cron');
const Email  = require('../models/Email');
const { fetchGmailEmails } = require('./gmailFetcher');
const { analyzeEmail, isTrustedSender, getCandidateContext, getEmailAgentConfig } = require('./emailAnalyzer');

// In-memory status — readable via GET /api/emails/sync-status
const status = {
  enabled:     false,
  intervalHrs: 4,
  lastRunAt:   null,
  nextRunAt:   null,
  lastResult:  null,   // { fetched, saved, skipped, durationMs }
  lastError:   null,
  running:     false
};

function computeNextRun(intervalHrs) {
  return new Date(Date.now() + intervalHrs * 60 * 60 * 1000);
}

async function runSync() {
  if (status.running) {
    console.log('[AutoSync] Already running, skipping this tick');
    return;
  }

  // Skip if Gmail credentials not set
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS ||
      process.env.EMAIL_PASS === 'your_gmail_app_password_here') {
    console.log('[AutoSync] Gmail credentials not configured — skipping auto-sync');
    status.lastError = 'Gmail credentials not configured';
    status.lastRunAt = new Date();
    status.nextRunAt = computeNextRun(status.intervalHrs);
    return;
  }

  status.running = true;
  status.lastError = null;
  const t0 = Date.now();

  console.log(`[AutoSync] Starting scheduled sync at ${new Date().toISOString()}`);

  try {
    // Fetch last 1 day — deduplication handles overlaps
    const raw = await fetchGmailEmails(1);

    if (raw.length === 0) {
      status.lastResult = { fetched: 0, saved: 0, skipped: 0, durationMs: Date.now() - t0 };
      console.log('[AutoSync] No emails fetched');
      return;
    }

    // Deduplicate against DB
    const existingIds = new Set(
      (await Email.find({ gmailMessageId: { $in: raw.map(e => e.gmailMessageId) } })
        .select('gmailMessageId').lean())
        .map(e => e.gmailMessageId)
    );

    const newEmails = raw.filter(e => !existingIds.has(e.gmailMessageId));
    const skipped   = raw.length - newEmails.length;

    if (newEmails.length === 0) {
      status.lastResult = { fetched: raw.length, saved: 0, skipped, durationMs: Date.now() - t0 };
      console.log(`[AutoSync] Nothing new — ${skipped} already in DB`);
      return;
    }

    // Batch analyze with concurrency 3 (lighter than manual sync)
    const CONCURRENCY = 3;
    let saved = 0;
    const config = await getEmailAgentConfig();
    const candidateContext = await getCandidateContext();

    for (let i = 0; i < newEmails.length; i += CONCURRENCY) {
      const batch = newEmails.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(async (email) => {
        // Only trusted-sender (TNP) mail gets AI analysis — everything else is saved as-is so it still shows in Inbox.
        if (!isTrustedSender(email.from, config.trustedSenders)) {
          try {
            await Email.create({
              gmailMessageId: email.gmailMessageId,
              from: email.from, subject: email.subject, body: email.body,
              priority: 'low', category: 'general',
              status: 'unread', direction: 'incoming', createdAt: email.receivedAt
            });
            return true;
          } catch { return false; }
        }

        try {
          const analysis = await analyzeEmail(email.subject, email.body, { candidateContext, guidance: config.analysisGuidance });
          await Email.create({
            gmailMessageId: email.gmailMessageId,
            from:           email.from,
            subject:        email.subject,
            body:           email.body,
            summary:        analysis.summary,
            priority:       analysis.priority,
            category:       analysis.category,
            eligible:       analysis.eligible,
            eligibilityReason: analysis.eligibilityReason,
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
          return true;
        } catch {
          try {
            await Email.create({
              gmailMessageId: email.gmailMessageId,
              from: email.from, subject: email.subject,
              body: email.body, status: 'unread',
              direction: 'incoming', createdAt: email.receivedAt
            });
            return true;
          } catch { return false; }
        }
      }));
      saved += results.filter(Boolean).length;
      if (i + CONCURRENCY < newEmails.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    const durationMs = Date.now() - t0;
    status.lastResult = { fetched: raw.length, saved, skipped, durationMs };
    console.log(`[AutoSync] Done — fetched:${raw.length} saved:${saved} skipped:${skipped} (${(durationMs/1000).toFixed(1)}s)`);

  } catch (err) {
    status.lastError = err.message;
    console.error('[AutoSync] Error:', err.message);
  } finally {
    status.running   = false;
    status.lastRunAt = new Date();
    status.nextRunAt = computeNextRun(status.intervalHrs);
  }
}

function start() {
  // Cron: every 4 hours at :00  →  "0 */4 * * *"
  cron.schedule('0 */4 * * *', runSync, { timezone: 'Asia/Kolkata' });

  status.enabled   = true;
  status.nextRunAt = computeNextRun(status.intervalHrs);

  console.log(`[AutoSync] Scheduler started — every ${status.intervalHrs}h (IST). Next run: ${status.nextRunAt.toISOString()}`);
}

function getStatus() {
  return {
    ...status,
    lastRunAt:  status.lastRunAt  ? status.lastRunAt.toISOString()  : null,
    nextRunAt:  status.nextRunAt  ? status.nextRunAt.toISOString()  : null,
  };
}

// Allow manual trigger from API
async function triggerNow() {
  return runSync();
}

module.exports = { start, getStatus, triggerNow };

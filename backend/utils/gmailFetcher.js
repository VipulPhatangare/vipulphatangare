const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

// Strip HTML tags and decode common HTML entities
function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function fetchGmailEmails(days = 7) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || process.env.EMAIL_PASS === 'your_gmail_app_password_here') {
    throw new Error('Gmail credentials not configured. Add EMAIL_USER and EMAIL_PASS (Gmail App Password) to backend/.env');
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    logger: false
  });

  await client.connect();

  const emails = [];

  try {
    const lock = await client.getMailboxLock('INBOX');

    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      // Search for emails since the date
      const uids = await client.search({ since });

      if (!uids || uids.length === 0) {
        return [];
      }

      // Fetch messages in sequence to avoid memory overload
      for await (const msg of client.fetch(uids, { source: true, uid: true })) {
        try {
          const parsed = await simpleParser(msg.source);

          // Extract plain text body — prefer text over HTML
          let body = '';
          if (parsed.text && parsed.text.trim().length > 50) {
            body = parsed.text.trim();
          } else if (parsed.html) {
            body = stripHtml(parsed.html);
          } else if (parsed.text) {
            body = parsed.text.trim();
          }

          // Skip empty emails
          if (!body || body.length < 10) continue;

          // Truncate very long emails to avoid AI token overflow
          if (body.length > 5000) body = body.slice(0, 5000) + '\n... [email truncated]';

          const fromAddr = parsed.from?.value?.[0];
          const fromText = fromAddr
            ? `${fromAddr.name ? fromAddr.name + ' ' : ''}<${fromAddr.address}>`
            : (parsed.from?.text || '');

          emails.push({
            gmailMessageId: parsed.messageId || `uid-${msg.uid}`,
            from:    fromText.trim(),
            subject: parsed.subject || '(no subject)',
            body,
            receivedAt: parsed.date || new Date()
          });
        } catch {
          // Skip malformed individual messages
          continue;
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  // Sort newest first
  emails.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
  return emails;
}

module.exports = { fetchGmailEmails };

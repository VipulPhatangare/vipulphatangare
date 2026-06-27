const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const ANALYZE_SYSTEM = `You are an intelligent email analysis assistant for Vipul Phatangare, a college student and AI/ML engineer.
Your job is to analyze incoming emails and return structured JSON.

Priority rules:
- "high": TNP (Training & Placement) emails, college exam/result notifications, internship/job offers, urgent deadlines, official college communications
- "medium": club events, academic reminders, project-related, professor emails, moderate deadlines
- "low": newsletters, promotions, general info, no action needed

Category rules:
- "tnp": anything related to placements, internships, companies visiting campus, job drives, aptitude tests, campus recruitment
- "college": exams, results, fees, timetable, attendance, faculty, academic calendar, official college notices
- "personal": friends, family, personal matters
- "work": freelance, projects, clients, professional collaborations
- "general": everything else

Respond ONLY with a valid JSON object (no markdown, no explanation):
{
  "summary": "2-3 sentence plain-english summary of the email",
  "priority": "high|medium|low",
  "category": "tnp|college|personal|work|general",
  "deadline": "ISO date string if a deadline is found, otherwise null",
  "deadlineText": "human-readable deadline description, e.g. 'Register by 25 June 2025, 5 PM' — empty string if no deadline",
  "tags": ["array", "of", "relevant", "keyword", "tags", "max 5"],
  "actionItems": ["concrete action Vipul must take — e.g. 'Register on the placement portal by 5 PM', max 4 items, empty array if no actions needed"],
  "requiresReply": true,
  "replyUrgency": "immediate|within_24h|within_3days|none"
}

replyUrgency rules:
- "immediate": reply needed within hours (urgent deadline, direct question needing fast answer)
- "within_24h": reply expected soon (professor query, TNP confirmation, meeting request)
- "within_3days": casual follow-up or non-urgent reply expected
- "none": newsletter, FYI, notification — no reply needed`;

const REPLY_SYSTEM = `You are an email reply assistant helping Vipul Phatangare, a college student and AI/ML engineer.
Write a polite, professional, and concise reply to the given email.
- Keep it short (3-6 sentences unless detail is required)
- Use first-person as Vipul
- If it's a TNP/placement email, be enthusiastic and professional
- Start directly (no "Dear Sir/Madam" boilerplate unless appropriate)
- End with "Regards,\nVipul Phatangare"
Return ONLY the reply text, no subject line, no JSON.`;

const DIGEST_SYSTEM = `You are a smart email digest assistant for Vipul Phatangare, a college student and AI/ML engineer.
You will receive a list of unread emails. Generate a concise, actionable daily digest as plain text.

Structure:
1. One-line opener: total count + urgency level
2. URGENT (if any): list high-priority items needing immediate attention
3. TODAY'S ACTIONS: bullet list of concrete things to do
4. ALSO IN INBOX: brief mention of remaining emails grouped by type
5. End: "Total pending actions: N"

Rules:
- Under 200 words
- No markdown headers (use ALL CAPS for sections)
- Be direct and practical, like a smart assistant briefing you
- If inbox is empty or low-priority only, say so clearly`;

async function analyzeEmail(subject, body) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: ANALYZE_SYSTEM,
    generationConfig: { maxOutputTokens: 1024, temperature: 0.3 }
  });

  const prompt = `Subject: ${subject}\n\nBody:\n${body}`;
  const result = await model.generateContent(prompt);
  let raw = result.response.text().trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    const parsed = JSON.parse(raw);
    return {
      summary:      String(parsed.summary || '').trim(),
      priority:     ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
      category:     ['tnp', 'college', 'personal', 'work', 'general'].includes(parsed.category) ? parsed.category : 'general',
      deadline:     parsed.deadline ? new Date(parsed.deadline) : null,
      deadlineText: String(parsed.deadlineText || '').trim(),
      tags:         Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(t => String(t).trim()) : [],
      actionItems:  Array.isArray(parsed.actionItems) ? parsed.actionItems.slice(0, 4).map(a => String(a).trim()).filter(Boolean) : [],
      requiresReply: Boolean(parsed.requiresReply),
      replyUrgency:  ['immediate', 'within_24h', 'within_3days', 'none'].includes(parsed.replyUrgency) ? parsed.replyUrgency : 'none'
    };
  } catch {
    return {
      summary: raw.slice(0, 300), priority: 'medium', category: 'general',
      deadline: null, deadlineText: '', tags: [],
      actionItems: [], requiresReply: false, replyUrgency: 'none'
    };
  }
}

async function generateReply(subject, body) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: REPLY_SYSTEM,
    generationConfig: { maxOutputTokens: 512, temperature: 0.6 }
  });

  const prompt = `Original Email\nSubject: ${subject}\nBody:\n${body}\n\nWrite a reply:`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function generateDigest(emails) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: DIGEST_SYSTEM,
    generationConfig: { maxOutputTokens: 600, temperature: 0.4 }
  });

  const emailList = emails.map((e, i) =>
    `${i + 1}. [${(e.priority || 'medium').toUpperCase()}] "${e.subject}" from ${e.from || 'unknown'}` +
    (e.summary ? ` — ${e.summary}` : e.body ? ` — ${e.body.slice(0, 120)}` : '') +
    (e.actionItems?.length ? ` | Actions: ${e.actionItems.join(', ')}` : '') +
    (e.deadline ? ` | Deadline: ${new Date(e.deadline).toDateString()}` : '')
  ).join('\n');

  const prompt = `Unread emails (${emails.length} total):\n${emailList}\n\nGenerate the daily digest:`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

module.exports = { analyzeEmail, generateReply, generateDigest };

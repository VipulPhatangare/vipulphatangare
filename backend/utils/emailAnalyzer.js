const { GoogleGenerativeAI } = require('@google/generative-ai');
const Skill = require('../models/Skill');
const Education = require('../models/Education');
const EmailAgentConfig = require('../models/EmailAgentConfig');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Only mail from a trusted TNP (Training & Placement) sender gets AI-analysed —
// everything else is saved to the inbox as-is. The sender list is configurable in the DB.
const TNP_SENDER_EMAIL = 'srawandale@gmail.com';

// Loads (and lazily creates) the singleton EmailAgentConfig. Self-heals a blank guidance.
async function getEmailAgentConfig() {
  try {
    let config = await EmailAgentConfig.findOne();
    if (!config) config = await EmailAgentConfig.create({});
    if (!config.analysisGuidance || !config.analysisGuidance.trim()) {
      config.analysisGuidance = EmailAgentConfig.DEFAULT_GUIDANCE;
      await config.save();
    }
    if (!Array.isArray(config.trustedSenders) || config.trustedSenders.length === 0) {
      config.trustedSenders = EmailAgentConfig.DEFAULT_SENDERS;
      await config.save();
    }
    return config;
  } catch {
    return { trustedSenders: [TNP_SENDER_EMAIL], analysisGuidance: EmailAgentConfig.DEFAULT_GUIDANCE };
  }
}

// True when `from` matches any configured trusted sender. Pass the list from getEmailAgentConfig()
// so callers can load it once per sync; falls back to the default single sender.
function isTrustedSender(from, senders) {
  if (typeof from !== 'string') return false;
  const list = (Array.isArray(senders) && senders.length ? senders : [TNP_SENDER_EMAIL])
    .map(s => String(s).toLowerCase().trim()).filter(Boolean);
  const f = from.toLowerCase();
  return list.some(s => f.includes(s));
}

// Back-compat wrapper (default single sender).
function isTnpSender(from) {
  return isTrustedSender(from, [TNP_SENDER_EMAIL]);
}

// Pulls live skills/branch data from the same collections the Resume Agent reads,
// so mail priority stays in sync with whatever is on the Skills/Education pages.
async function getCandidateContext() {
  try {
    const [skills, education] = await Promise.all([
      Skill.find({ isVisible: true }).sort({ order: 1 }).select('name').lean(),
      Education.find({ isVisible: true }).sort({ order: 1 }).select('degree institution').lean()
    ]);
    const skillList = skills.map(s => s.name).join(', ');
    const branch = education[0] ? `${education[0].degree} at ${education[0].institution}` : '';
    return `Branch: ${branch || 'B.Tech Computer Science Engineering (AI & ML)'}\nCore skills: ${skillList || 'Not specified'}`;
  } catch {
    return 'Branch: B.Tech Computer Science Engineering (AI & ML)\nCore skills: Not available';
  }
}

// Composes the final system instruction. The candidate profile (top) and the strict
// JSON output schema (bottom) are always injected here, so editing `guidance` in
// Settings can tune the rules without ever breaking JSON parsing.
function buildAnalyzeSystem(candidateContext, guidance) {
  const rules = (guidance && guidance.trim()) || EmailAgentConfig.DEFAULT_GUIDANCE;
  return `You are an intelligent email analysis assistant for Vipul Phatangare, a college student and AI/ML engineer.
Your job is to analyze incoming emails and return structured JSON.

Candidate profile:
${candidateContext}
The candidate is a Computer Science (AI & ML) branch student and CANNOT apply to openings restricted to Mechanical, Electronics & Telecommunication (ENTC/E&TC), Civil, Electrical, or other non-CS/IT branches.

${rules}

Respond ONLY with a valid JSON object (no markdown, no explanation):
{
  "summary": "2-3 sentence plain-english summary of the email",
  "priority": "high|medium|low",
  "category": "tnp|college|personal|work|general",
  "eligible": true,
  "eligibilityReason": "short reason the candidate can/can't apply, e.g. 'Open to CS/IT' or 'Mechanical Engineering only' — empty string for non-TNP mail",
  "deadline": "ISO date string if a deadline is found, otherwise null",
  "deadlineText": "human-readable deadline description, e.g. 'Register by 25 June 2025, 5 PM' — empty string if no deadline",
  "tags": ["array", "of", "relevant", "keyword", "tags", "max 5"],
  "actionItems": ["concrete action Vipul must take — e.g. 'Register on the placement portal by 5 PM', max 4 items, empty array if no actions needed"],
  "requiresReply": true,
  "replyUrgency": "immediate|within_24h|within_3days|none"
}`;
}

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

// opts: { candidateContext, guidance } — both optional; loaded on demand if omitted.
async function analyzeEmail(subject, body, opts = {}) {
  // Back-compat: a plain string 3rd arg used to be candidateContext.
  const options = typeof opts === 'string' ? { candidateContext: opts } : (opts || {});
  const context  = options.candidateContext || await getCandidateContext();
  const guidance = options.guidance;

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    systemInstruction: buildAnalyzeSystem(context, guidance),
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
      eligible:     parsed.eligible === undefined ? true : Boolean(parsed.eligible),
      eligibilityReason: String(parsed.eligibilityReason || '').trim(),
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
      eligible: true, eligibilityReason: '',
      deadline: null, deadlineText: '', tags: [],
      actionItems: [], requiresReply: false, replyUrgency: 'none'
    };
  }
}

async function generateReply(subject, body) {
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    systemInstruction: REPLY_SYSTEM,
    generationConfig: { maxOutputTokens: 512, temperature: 0.6 }
  });

  const prompt = `Original Email\nSubject: ${subject}\nBody:\n${body}\n\nWrite a reply:`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function generateDigest(emails) {
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
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

module.exports = {
  analyzeEmail, generateReply, generateDigest,
  isTnpSender, isTrustedSender, getCandidateContext,
  getEmailAgentConfig, TNP_SENDER_EMAIL
};

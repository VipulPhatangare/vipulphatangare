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
  "tags": ["array", "of", "relevant", "keyword", "tags", "max 5"]
}`;

const REPLY_SYSTEM = `You are an email reply assistant helping Vipul Phatangare, a college student and AI/ML engineer.
Write a polite, professional, and concise reply to the given email.
- Keep it short (3-6 sentences unless detail is required)
- Use first-person as Vipul
- If it's a TNP/placement email, be enthusiastic and professional
- Start directly (no "Dear Sir/Madam" boilerplate unless appropriate)
- End with "Regards,\nVipul Phatangare"
Return ONLY the reply text, no subject line, no JSON.`;

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
      tags:         Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(t => String(t).trim()) : []
    };
  } catch {
    return { summary: raw.slice(0, 300), priority: 'medium', category: 'general', deadline: null, deadlineText: '', tags: [] };
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

module.exports = { analyzeEmail, generateReply };

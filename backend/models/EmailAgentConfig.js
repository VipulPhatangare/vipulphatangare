const mongoose = require('mongoose');

// The editable "rules" portion of the analysis system prompt. The candidate profile
// (live skills/education) and the strict JSON output schema are injected around this
// programmatically in emailAnalyzer.js — so editing this can't break JSON parsing.
const DEFAULT_GUIDANCE = `Priority rules:
- "high": TNP (Training & Placement) emails relevant to the candidate's branch/skills, college exam/result notifications, internship/job offers the candidate is eligible for, urgent deadlines, official college communications
- "medium": club events, academic reminders, project-related, professor emails, moderate deadlines
- "low": newsletters, promotions, general info, no action needed, OR a TNP/internship/job opportunity that explicitly excludes CS/IT/AI-ML students (e.g. "Mechanical Engineering only", "ENTC/E&TC only", "Civil Engineering only")

Eligibility rule (apply to TNP/internship/job emails):
- Set "eligible" to false ONLY when the opportunity is explicitly restricted to branches the candidate cannot apply to (Mechanical, ENTC/E&TC, Civil, Electrical, or other non-CS/IT branches) with no CS/IT/AI-ML option. In that case also set priority to "low", add "not-eligible" to tags, and write a short "eligibilityReason" like "Mechanical Engineering only".
- Set "eligible" to true when the opportunity is open to CS/IT/Computer Engineering/AI-ML/Data/"any branch"/"all branches", or clearly matches the candidate's listed skills. Weight priority higher when the role needs skills the candidate has.
- For non-TNP mail (college notices, personal, work, general), set "eligible" to true and leave "eligibilityReason" empty.

Category rules:
- "tnp": anything related to placements, internships, companies visiting campus, job drives, aptitude tests, campus recruitment
- "college": exams, results, fees, timetable, attendance, faculty, academic calendar, official college notices
- "personal": friends, family, personal matters
- "work": freelance, projects, clients, professional collaborations
- "general": everything else

replyUrgency rules:
- "immediate": reply needed within hours (urgent deadline, direct question needing fast answer)
- "within_24h": reply expected soon (professor query, TNP confirmation, meeting request)
- "within_3days": casual follow-up or non-urgent reply expected
- "none": newsletter, FYI, notification — no reply needed`;

const emailAgentConfigSchema = new mongoose.Schema({
  // Senders whose mail gets AI-analysed. Everything else is fetched straight to the inbox.
  trustedSenders:   { type: [String], default: ['srawandale@gmail.com'] },
  // Editable analysis guidance (see note above).
  analysisGuidance: { type: String, default: DEFAULT_GUIDANCE },
  // AI model for analysis/reply/digest — a concrete model id or 'inherit' (global default).
  modelName:        { type: String, default: 'inherit' }
}, { timestamps: true });

const EmailAgentConfig = mongoose.model('EmailAgentConfig', emailAgentConfigSchema);
EmailAgentConfig.DEFAULT_GUIDANCE = DEFAULT_GUIDANCE;
EmailAgentConfig.DEFAULT_SENDERS  = ['srawandale@gmail.com'];
module.exports = EmailAgentConfig;

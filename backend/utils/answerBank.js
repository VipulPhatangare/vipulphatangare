const Profile    = require('../models/Profile');
const Education  = require('../models/Education');
const Skill      = require('../models/Skill');
const AnswerBank = require('../models/AnswerBank');

// Builds the factual key-value "answer bank" from the same portfolio collections
// the rest of the site uses, so answers always reflect the live Profile/Education/
// Skills pages. Each entry carries:
//   key      – stable id
//   label    – human label (used for embedding-similarity fallback)
//   value    – the actual answer (may be '' when the data isn't filled in yet)
//   aliases  – keyword phrases; an exact keyword hit is a high-confidence match,
//              far more reliable than embeddings for standard form fields.
async function buildAnswerBank() {
  const [profile, eduList, skills] = await Promise.all([
    Profile.findOne().lean(),
    Education.find({ isVisible: true }).sort({ order: 1 }).lean(),
    Skill.find({ isVisible: true }).sort({ order: 1 }).select('name').lean()
  ]);

  const p   = profile || {};
  const edu = eduList[0] || {};                 // most recent / primary education
  const skillNames = skills.map(s => s.name).filter(Boolean);

  const entries = [
    { key: 'name',        label: 'Full Name',                value: p.name || '',
      aliases: ['full name', 'your name', 'student name', 'candidate name', 'name'] },
    { key: 'email',       label: 'Email Address',            value: p.email || '',
      aliases: ['email address', 'email id', 'e-mail', 'mail id', 'email'] },
    { key: 'phone',       label: 'Phone / Mobile Number',    value: p.phone || '',
      aliases: ['contact number', 'mobile number', 'phone number', 'whatsapp number', 'contact no', 'mobile', 'phone', 'contact'] },
    { key: 'location',    label: 'Location / City',          value: p.location || '',
      aliases: ['current city', 'home town', 'hometown', 'location', 'city', 'address'] },
    { key: 'github',      label: 'GitHub Profile',           value: p.githubUrl || '',
      aliases: ['github profile', 'github link', 'github url', 'github'] },
    { key: 'linkedin',    label: 'LinkedIn Profile',         value: p.linkedinUrl || '',
      aliases: ['linkedin profile', 'linkedin url', 'linkedin link', 'linked in', 'linkedin'] },
    { key: 'leetcode',    label: 'LeetCode Profile',         value: p.leetcodeUrl || '',
      aliases: ['leetcode profile', 'leet code', 'leetcode'] },
    { key: 'portfolio',   label: 'Portfolio / Website',      value: p.portfolioUrl || '',
      aliases: ['portfolio link', 'personal website', 'portfolio', 'website'] },
    { key: 'degree',      label: 'Degree / Course',          value: edu.degree || '',
      aliases: ['degree', 'course', 'qualification', 'program', 'programme'] },
    { key: 'branch',      label: 'Branch / Department',       value: edu.degree || '',
      aliases: ['branch', 'department', 'stream', 'specialization', 'specialisation'] },
    { key: 'institution', label: 'College / Institution',     value: edu.institution || '',
      // NOTE: no bare 'university' alias — it wrongly grabbed "University PRN Number".
      aliases: ['college name', 'institution name', 'university name', 'name of college', 'institute', 'college'] },
    { key: 'cgpa',        label: 'CGPA / Aggregate',          value: edu.score || '',
      aliases: ['current cgpa', 'cgpa', 'gpa', 'aggregate', 'academic score', 'percentage'] },
    { key: 'gradYear',    label: 'Year of Passing',           value: edu.endYear || '',
      aliases: ['year of passing', 'passing year', 'graduation year', 'expected graduation', 'batch'] },
    { key: 'skills',      label: 'Technical Skills',          value: skillNames.join(', '),
      aliases: ['technical skills', 'key skills', 'core skills', 'skills'] }
  ];

  // Merge the editable AnswerBank collection: entries override the model-derived
  // ones by key (e.g. a curated phone without +91) and add new keys (PRN, DOB…).
  try {
    const custom = await AnswerBank.find().sort({ order: 1 }).lean();
    const byKey = new Map(entries.map(e => [e.key, e]));
    for (const c of custom) {
      byKey.set(c.key, {
        key: c.key,
        label: c.label || c.key,
        value: c.value || '',
        aliases: Array.isArray(c.aliases) && c.aliases.length ? c.aliases : (byKey.get(c.key)?.aliases || []),
        isDate: !!c.isDate
      });
    }
    return [...byKey.values()];
  } catch {
    return entries; // DB unavailable → fall back to model-derived facts
  }
}

module.exports = { buildAnswerBank };

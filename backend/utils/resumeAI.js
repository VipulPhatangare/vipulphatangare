const { generateJSON, resolveModel } = require('./llm');
const ResumeAgentConfig = require('../models/ResumeAgentConfig');

// Resolves the resume agent's configured model (or the global default).
async function resumeModelId() {
  const config = await ResumeAgentConfig.getConfig();
  return resolveModel(config.modelName);
}

const TONE_INSTRUCTIONS = {
  formal: 'Formal and professional — precise, achievement-oriented, no slang, third-person-free resume voice.',
  'casual-confident': 'Casual-confident — energetic, direct, personable but still professional; strong action verbs, light personality.'
};

const LENGTH_INSTRUCTIONS = {
  '1page': 'Aim to fit ONE page, but never at the cost of clarity — each bullet is a complete, specific, easy-to-understand sentence of roughly 16-26 words. Trim filler words, not substance.',
  '2page': 'The resume may span TWO pages. Bullets can be richer — complete sentences of roughly 20-30 words with concrete detail.'
};

const APPLICANT_INSTRUCTIONS = {
  fresher: 'The applicant is a FRESHER (student / new graduate): emphasize projects, education, internships, learning velocity and potential. Never fabricate professional experience.',
  experienced: 'The applicant is EXPERIENCED: emphasize impact, ownership, scale and professional outcomes.'
};

function preferenceBlock(preferences = {}) {
  return [
    `Tone: ${TONE_INSTRUCTIONS[preferences.tone] || TONE_INSTRUCTIONS.formal}`,
    `Length constraint: ${LENGTH_INSTRUCTIONS[preferences.length] || LENGTH_INSTRUCTIONS['1page']}`,
    `Applicant type: ${APPLICANT_INSTRUCTIONS[preferences.applicantType] || APPLICANT_INSTRUCTIONS.fresher}`,
    preferences.emphasis ? `Special emphasis requested by the applicant: ${preferences.emphasis}` : ''
  ].filter(Boolean).join('\n');
}

function contextBlock(companyResearch, jdParsed) {
  let s = '';
  if (companyResearch) {
    s += `TARGET COMPANY RESEARCH:\n${JSON.stringify(companyResearch, null, 1)}\n\n`;
  }
  if (jdParsed) {
    s += `PARSED JOB DESCRIPTION:\n${JSON.stringify(jdParsed, null, 1)}\n\n`;
  }
  return s;
}

// ---------- Response schemas (structured output — no more parse-and-pray) ----------

const S = {
  str: { type: 'string' },
  strArr: { type: 'array', items: { type: 'string' } }
};

const SCHEMAS = {
  companySummary: {
    type: 'object',
    properties: {
      industry: S.str, techStack: S.strArr, recentNews: S.strArr,
      culture: S.str, products: S.strArr, overview: S.str
    },
    required: ['industry', 'techStack', 'recentNews', 'culture', 'products', 'overview']
  },
  jdParse: {
    type: 'object',
    properties: {
      requiredSkills: S.strArr, niceToHaveSkills: S.strArr, responsibilities: S.strArr,
      seniorityLevel: S.str, atsKeywords: S.strArr, roleSummary: S.str,
      companyName: S.str, roleTitle: S.str
    },
    required: ['requiredSkills', 'niceToHaveSkills', 'responsibilities', 'seniorityLevel', 'atsKeywords', 'roleSummary']
  },
  rankings: {
    type: 'object',
    properties: {
      rankings: {
        type: 'array',
        items: {
          type: 'object',
          properties: { projectId: S.str, score: { type: 'number' }, reasoning: S.str },
          required: ['projectId', 'score', 'reasoning']
        }
      }
    },
    required: ['rankings']
  },
  variants: {
    type: 'object',
    properties: { variants: S.strArr },
    required: ['variants']
  },
  items: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        // `source` is the provenance tag: the exact profile fact this bullet is
        // grounded in. Optional so older flows stay valid, but the prompts ask for it.
        items: { type: 'object', properties: { variants: S.strArr, source: S.str }, required: ['variants'] }
      }
    },
    required: ['items']
  },
  projectSection: {
    type: 'object',
    properties: {
      overview: S.str,
      items: {
        type: 'array',
        items: { type: 'object', properties: { variants: S.strArr, source: S.str }, required: ['variants'] }
      }
    },
    required: ['overview', 'items']
  },
  entries: {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            heading: S.str,
            subheading: S.str,
            items: {
              type: 'array',
              items: { type: 'object', properties: { variants: S.strArr, source: S.str }, required: ['variants'] }
            }
          },
          required: ['heading', 'subheading', 'items']
        }
      }
    },
    required: ['entries']
  },
  skills: {
    type: 'object',
    properties: {
      matched: {
        type: 'array',
        items: { type: 'object', properties: { name: S.str, relevance: { type: 'string', enum: ['high', 'medium', 'low'] } }, required: ['name', 'relevance'] }
      },
      additional: {
        type: 'array',
        items: { type: 'object', properties: { name: S.str, relevance: { type: 'string', enum: ['high', 'medium', 'low'] } }, required: ['name', 'relevance'] }
      }
    },
    required: ['matched', 'additional']
  },
  suggestions: {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: { type: 'object', properties: { type: S.str, section: S.str, message: S.str }, required: ['type', 'section', 'message'] }
      }
    },
    required: ['suggestions']
  },
  coverLetter: {
    type: 'object',
    properties: { content: S.str },
    required: ['content']
  },
  atsGap: {
    type: 'object',
    properties: {
      gaps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            keyword: S.str,
            coverage: { type: 'string', enum: ['backed', 'partial', 'absent'] },
            evidence: S.str,   // which real profile item could honestly carry it, or '' if none
            suggestion: S.str  // one concrete, honest action
          },
          required: ['keyword', 'coverage', 'evidence', 'suggestion']
        }
      }
    },
    required: ['gaps']
  }
};

// Schema to enforce when refining an existing section (must mirror its input shape)
function refineSchemaFor(sectionKey) {
  if (sectionKey === 'skills') return SCHEMAS.skills;
  if (sectionKey === 'summary') return SCHEMAS.variants;
  if (sectionKey === 'experience') return SCHEMAS.entries;
  if (sectionKey === 'project') return SCHEMAS.projectSection;
  return SCHEMAS.items;
}

// Shared JSON call: resolves the resume agent's model, then delegates to the
// unified LLM helper (which handles structured output on Gemini, json_object on
// NVIDIA/DeepSeek/Kimi, fence-stripping, truncated-JSON repair and backoff retries).
async function callGeminiJSON(prompt, { systemInstruction = '', temperature = 0.6, maxTokens = 16384, responseSchema = null } = {}) {
  const modelId = await resumeModelId();
  return generateJSON({ modelId, system: systemInstruction, prompt, temperature, maxTokens, responseSchema });
}

const SYSTEM_PROMPT = `You are an expert resume writer, ATS optimization specialist and career coach.
You only use facts provided in the input — never invent metrics, employers, dates, tools or outcomes.
If information is missing, write around it rather than fabricating.
Always respond with ONLY the requested raw JSON object — no markdown, no commentary.`;

// ---------- Research ----------

async function summarizeCompanyResearch(companyName, rawResults) {
  const resultsText = rawResults
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\n${r.link}`)
    .join('\n\n');

  const prompt = `Below are raw web search results about the company "${companyName}".
Distill them into a clean structured summary for tailoring a job application resume.

SEARCH RESULTS:
${resultsText.slice(0, 15000)}

Return JSON with EXACTLY this structure:
{
  "industry": "one-line industry description",
  "techStack": ["technologies the company is known to use"],
  "recentNews": ["up to 5 short recent news/developments"],
  "culture": "2-3 sentences on values and engineering culture",
  "products": ["main products or services"],
  "overview": "3-4 sentence company overview"
}
Only include facts supported by the search results.`;

  return callGeminiJSON(prompt, { systemInstruction: SYSTEM_PROMPT, temperature: 0.3, responseSchema: SCHEMAS.companySummary });
}

async function parseJobDescription(jdText) {
  const prompt = `Analyze this job description and extract structured data.

JOB DESCRIPTION:
${jdText.slice(0, 15000)}

Return JSON with EXACTLY this structure:
{
  "requiredSkills": ["explicitly required skills/technologies"],
  "niceToHaveSkills": ["preferred / nice-to-have skills"],
  "responsibilities": ["core responsibilities, short phrases"],
  "seniorityLevel": "intern | entry | junior | mid | senior | lead",
  "atsKeywords": ["15-25 exact keywords and phrases an ATS would scan for"],
  "roleSummary": "2 sentence summary of the role",
  "companyName": "the hiring company's name if stated in the JD, else empty string",
  "roleTitle": "the exact job title if stated in the JD, else empty string"
}`;

  return callGeminiJSON(prompt, { systemInstruction: SYSTEM_PROMPT, temperature: 0.2, responseSchema: SCHEMAS.jdParse });
}

// ---------- Project ranking ----------

async function rankProjects(projects, jdParsed) {
  const list = projects
    .map(p => `- id: ${p._id}\n  title: ${p.title}\n  description: ${p.description}`)
    .join('\n');

  const prompt = `${contextBlock(null, jdParsed)}Rate how well each of the applicant's projects matches this job.

PROJECTS:
${list}

Return JSON: { "rankings": [{ "projectId": "<id exactly as given>", "score": 0-100, "reasoning": "one short sentence" }] }
Score every project. Higher = stronger match to the JD keywords, skills and responsibilities.`;

  const out = await callGeminiJSON(prompt, { systemInstruction: SYSTEM_PROMPT, temperature: 0.2, responseSchema: SCHEMAS.rankings });
  return Array.isArray(out.rankings) ? out.rankings : [];
}

// ---------- Section generation ----------

const THREE_VARIANTS_RULE = 'For every bullet/line, provide EXACTLY 3 phrased variants (same fact, different wording — vary verbs, structure and keyword placement).';

// Provenance: every bullet must cite the real profile fact it is grounded in, so
// the UI can show a "backed by …" badge and the applicant can trust nothing was invented.
const PROVENANCE_RULE = 'For EACH item also include a "source" string: a short (2-6 word) tag naming the exact profile fact this bullet is built from (e.g. "Project: SmartCart", "Skill: Kubernetes", "Achievement: SIH winner", "Experience: Intern @ Acme"). Never invent a source — if a bullet is a neutral rephrasing not tied to one fact, use "".';

function sectionPrompt(sectionKey, rawData, companyResearch, jdParsed, preferences) {
  const base = `${contextBlock(companyResearch, jdParsed)}${preferenceBlock(preferences)}\n\n`;

  switch (sectionKey) {
    case 'summary':
      return `${base}Write the professional summary for the applicant's resume targeting this role.

APPLICANT PROFILE:
${JSON.stringify(rawData, null, 1)}

Return JSON: { "variants": ["variant 1", "variant 2", "variant 3"] }
Each variant is one complete 2-3 sentence summary weaving in top ATS keywords naturally. ${THREE_VARIANTS_RULE.replace('every bullet/line', 'the summary')}`;

    case 'skills':
      return `${base}Organize the applicant's skills for this job application.

APPLICANT SKILLS:
${JSON.stringify(rawData, null, 1)}

Return JSON:
{
  "matched": [{ "name": "skill from applicant list that matches the JD", "relevance": "high|medium|low" }],
  "additional": [{ "name": "remaining applicant skill still worth listing", "relevance": "high|medium|low" }]
}
Only use skills from the applicant's list — never add skills they don't have. "matched" = appears in or strongly relates to JD requirements.`;

    case 'experience':
      return `${base}Write the work experience section, grouped by role.

APPLICANT EXPERIENCE DATA (may be internships, roles, or project-based work):
${JSON.stringify(rawData, null, 1)}

Return JSON: { "entries": [{ "heading": "role title", "subheading": "organization | start – end dates", "items": [{ "variants": ["v1", "v2", "v3"], "source": "Experience: role @ org" }] }] }
One entry per role, most recent first, 2-4 bullets each. Keep headings/dates factual — copy them from the data. Each bullet starts with a strong action verb, quantified only where the data supports it. ${THREE_VARIANTS_RULE} ${PROVENANCE_RULE}`;

    case 'achievements':
      return `${base}Rewrite the applicant's achievements as sharp resume bullets relevant to this role.

APPLICANT ACHIEVEMENTS:
${JSON.stringify(rawData, null, 1)}

Return JSON: { "items": [{ "variants": ["v1", "v2", "v3"], "source": "Achievement: <title>" }] }
One bullet per achievement, most relevant first. ${THREE_VARIANTS_RULE} ${PROVENANCE_RULE}`;

    case 'education':
      return `${base}Format the applicant's education for the resume.

APPLICANT EDUCATION:
${JSON.stringify(rawData, null, 1)}

Return JSON: { "items": [{ "variants": ["v1", "v2", "v3"] }] }
One line per education entry: degree, institution, years, score. Keep factual — variants only differ in formatting/phrasing. ${THREE_VARIANTS_RULE}`;

    case 'project':
      return `${base}Write the resume entry for this specific project, tailored to the job.

PROJECT:
${JSON.stringify(rawData, null, 1)}

Return JSON: { "overview": "one clear sentence", "items": [ {"variants":["v1","v2","v3"],"source":"Project: <title>"}, {"variants":["v1","v2","v3"],"source":"Project: <title>"}, {"variants":["v1","v2","v3"],"source":"Project: <title>"} ] }
Rules:
- "overview": ONE recruiter-friendly NOUN-PHRASE description (14-22 words) of what the project IS and the problem it solves. It must NOT start with a verb like "Developed"/"Built" — write it like "An AI-powered platform that…" or "A full-stack MERN application for…". This is a neutral description, not an achievement.
- EXACTLY 3 bullets (items) — never fewer, never more.
- Each bullet is a complete, easy-to-understand sentence of 18-28 words that STARTS WITH A STRONG ACTION VERB describing YOUR specific contribution. Do NOT restate the overview. The three bullets cover DISTINCT aspects: (1) a core technical implementation you built, (2) a second distinct feature or integration, (3) the impact, result, or scale.
- Weave in matching ATS keywords honestly; never invent metrics. ${THREE_VARIANTS_RULE} ${PROVENANCE_RULE}`;

    default:
      throw new Error(`Unknown section: ${sectionKey}`);
  }
}

async function generateSection(sectionKey, rawData, companyResearch, jdParsed, preferences) {
  const prompt = sectionPrompt(sectionKey, rawData, companyResearch, jdParsed, preferences);
  return callGeminiJSON(prompt, { systemInstruction: SYSTEM_PROMPT, temperature: 0.7, responseSchema: refineSchemaFor(sectionKey) });
}

// ---------- Refinement (second pass) ----------

async function refineSection(sectionKey, sectionJson, companyResearch, jdParsed, preferences, extraInstruction = '') {
  const prompt = `${contextBlock(companyResearch, jdParsed)}${preferenceBlock(preferences)}

You previously drafted the "${sectionKey}" resume section below. Critique and improve it for:
1. ATS keyword density — work in missing high-value JD keywords where truthful.
2. Bullet strength — strong action verbs, concrete outcomes, no filler.
3. Conciseness — cut weak words, respect the length constraint.
${extraInstruction ? `4. SPECIFIC INSTRUCTION (highest priority): ${extraInstruction}` : ''}

CURRENT SECTION JSON:
${JSON.stringify(sectionJson, null, 1)}

Return the improved section as JSON with the IDENTICAL structure and the same number of items/variants. Preserve each item's "source" provenance tag exactly as given. Do not add or invent facts.`;

  return callGeminiJSON(prompt, { systemInstruction: SYSTEM_PROMPT, temperature: 0.4, responseSchema: refineSchemaFor(sectionKey) });
}

// ---------- Single bullet regeneration ----------

async function regenerateBullet(sectionKey, currentBullet, siblingBullets, companyResearch, jdParsed, preferences) {
  const prompt = `${contextBlock(companyResearch, jdParsed)}${preferenceBlock(preferences)}

In the "${sectionKey}" section of the resume, ONE bullet needs fresh phrasings.

CURRENT BULLET: ${currentBullet}

OTHER BULLETS IN THIS SECTION (do not duplicate their content or verbs):
${siblingBullets.map(b => `- ${b}`).join('\n') || '(none)'}

Return JSON: { "variants": ["v1", "v2", "v3"] } — 3 fresh phrasings of the SAME fact, ATS-friendly, distinct from each other and from the other bullets.`;

  return callGeminiJSON(prompt, { systemInstruction: SYSTEM_PROMPT, temperature: 0.9, responseSchema: SCHEMAS.variants });
}

// ---------- Cover letter ----------

async function generateCoverLetter(profile, resumeMaterial, companyResearch, jdParsed, preferences, company, roleTitle) {
  const prompt = `${contextBlock(companyResearch, jdParsed)}${preferenceBlock(preferences)}

Write a cover letter for this applicant applying to "${roleTitle}" at "${company}".

APPLICANT:
${JSON.stringify(profile, null, 1)}

APPLICANT'S TAILORED RESUME MATERIAL (summary, key skills, selected project bullets):
${JSON.stringify(resumeMaterial, null, 1)}

Rules:
- 250-350 words, 3-4 paragraphs, no address block or date — start with "Dear Hiring Team," (or the company's team) and end with a sign-off using the applicant's name.
- Open with a specific hook connecting the applicant to the company (use the company research: product, mission or recent news — only if research is available).
- Middle paragraphs: connect 2-3 concrete resume facts to the JD's top requirements. Never invent facts.
- Close with genuine enthusiasm and a call to action.
- Plain text only, no markdown formatting.

Return JSON: { "content": "the full cover letter text with \\n\\n between paragraphs" }`;

  return callGeminiJSON(prompt, { systemInstruction: SYSTEM_PROMPT, temperature: 0.7, responseSchema: SCHEMAS.coverLetter });
}

// ---------- Coherence check ----------

async function coherenceCheck(resumeJson) {
  const prompt = `Review this complete assembled resume for coherence issues. Do NOT rewrite anything — only report soft suggestions.

RESUME JSON:
${JSON.stringify(resumeJson, null, 1).slice(0, 20000)}

Look for: keywords repeated too often across sections, tone mismatches between sections, redundant bullets saying the same thing twice, weak orphan phrases, and section-ordering concerns.

Return JSON: { "suggestions": [{ "type": "keyword-repetition|tone-mismatch|redundancy|wording|ordering", "section": "which section(s)", "message": "one clear actionable suggestion" }] }
Return at most 8 suggestions, most important first. If the resume is clean, return an empty array.`;

  const out = await callGeminiJSON(prompt, { systemInstruction: SYSTEM_PROMPT, temperature: 0.3, responseSchema: SCHEMAS.suggestions });
  return Array.isArray(out.suggestions) ? out.suggestions : [];
}

// ---------- ATS gap analysis (explainable, grounded in the applicant's real evidence) ----------

// For each JD keyword missing from the resume, decide — using ONLY retrieved profile
// evidence — whether the applicant could honestly claim it and how. Never fabricates.
async function atsGapAnalysis(missingKeywords, evidenceChunks, jdParsed) {
  const evidenceText = (evidenceChunks || [])
    .map((e, i) => `[${i + 1}] ${e.title}\n${e.text}`)
    .join('\n\n') || '(no profile evidence retrieved)';

  const prompt = `An applicant's resume is missing these ATS keywords the target job scans for:
${missingKeywords.map(k => `- ${k}`).join('\n')}

Below is the RETRIEVED EVIDENCE from the applicant's real profile (projects, experience, skills, achievements). This is the ONLY truth you may use — never invent experience the applicant does not have.

APPLICANT EVIDENCE:
${evidenceText}

${jdParsed ? `ROLE CONTEXT: ${jdParsed.roleSummary || ''} (seniority: ${jdParsed.seniorityLevel || 'n/a'})` : ''}

For each missing keyword decide honestly:
- "backed": the evidence clearly shows the applicant has this — name the exact item in "evidence" and suggest where to surface the keyword.
- "partial": adjacent/related evidence exists — name it in "evidence" and suggest an honest way to phrase the connection (no overclaiming).
- "absent": no supporting evidence — set "evidence" to "" and suggest a concrete learning/experience step to genuinely acquire it. Do NOT suggest adding it to the resume.

Return JSON: { "gaps": [{ "keyword": "...", "coverage": "backed|partial|absent", "evidence": "profile item or ''", "suggestion": "one concrete honest action" }] }
Cover every missing keyword, most addressable (backed) first.`;

  const out = await callGeminiJSON(prompt, { systemInstruction: SYSTEM_PROMPT, temperature: 0.2, responseSchema: SCHEMAS.atsGap });
  return Array.isArray(out.gaps) ? out.gaps : [];
}

module.exports = {
  summarizeCompanyResearch,
  parseJobDescription,
  rankProjects,
  generateSection,
  refineSection,
  regenerateBullet,
  coherenceCheck,
  generateCoverLetter,
  atsGapAnalysis
};

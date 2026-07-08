const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const Resume = require('../models/Resume');
const ResumeExport = require('../models/ResumeExport');
const CompanyResearch = require('../models/CompanyResearch');
const JdCache = require('../models/JdCache');
const Profile = require('../models/Profile');
const Project = require('../models/Project');
const Skill = require('../models/Skill');
const Achievement = require('../models/Achievement');
const Education = require('../models/Education');
const Experience = require('../models/Experience');

const { searchCompany } = require('../utils/searchProvider');
const resumeAI = require('../utils/resumeAI');
const { exportResume } = require('../utils/resumeRenderer');

router.use(authMiddleware);

// ---------- helpers ----------

const jdHashOf = text => crypto.createHash('sha256')
  .update(text.replace(/\s+/g, ' ').trim().toLowerCase())
  .digest('hex');

function companyCacheDays() {
  const d = parseInt(process.env.COMPANY_CACHE_DAYS, 10);
  return Number.isFinite(d) ? Math.min(15, Math.max(7, d)) : 10;
}

// Headless-browser fallback for JS-rendered career pages (LinkedIn, Workday, Greenhouse…)
async function fetchJdTextViaBrowser(url) {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    const text = await page.evaluate(() => document.body.innerText);
    return text.replace(/\s+/g, ' ').trim();
  } finally {
    await browser.close();
  }
}

// Fetch a JD page and strip it down to readable text
async function fetchJdText(rawUrl) {
  const url = new URL(rawUrl).href;
  let text = '';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResumeAgent/1.0)', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow'
    });
    if (res.ok) {
      const html = await res.text();
      text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
    }
  } catch (err) {
    console.warn('[resumeAgent] plain JD fetch failed, trying headless browser:', err.message);
  }

  // Thin result usually means a JS-rendered page — retry with the headless browser
  if (text.length < 300) {
    try {
      const browserText = await fetchJdTextViaBrowser(url);
      if (browserText.length > text.length) text = browserText;
    } catch (err) {
      console.warn('[resumeAgent] headless JD fetch failed:', err.message);
    }
  }

  if (text.length < 100) throw new Error('Could not extract readable JD text from URL — paste the JD instead.');
  return text.slice(0, 20000);
}

// Company research with DB cache (TTL 7–15 days)
async function getCompanyResearch(companyName) {
  const companyKey = companyName.trim().toLowerCase();
  const cached = await CompanyResearch.findOne({ companyKey, expiresAt: { $gt: new Date() } });
  if (cached) return { summary: cached.summary, fromCache: true };

  const { provider, results } = await searchCompany(companyName);
  const summary = await resumeAI.summarizeCompanyResearch(companyName, results);
  const expiresAt = new Date(Date.now() + companyCacheDays() * 24 * 60 * 60 * 1000);

  await CompanyResearch.findOneAndUpdate(
    { companyKey },
    { companyKey, companyName, provider, summary, rawResultCount: results.length, expiresAt },
    { upsert: true, new: true }
  );
  return { summary, fromCache: false };
}

// JD parsing with DB cache (session-length TTL: 24h)
async function getJdParsed(jdText, jdHash) {
  const cached = await JdCache.findOne({ jdHash, expiresAt: { $gt: new Date() } });
  if (cached) return { parsed: cached.parsed, fromCache: true };

  const parsed = await resumeAI.parseJobDescription(jdText);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await JdCache.findOneAndUpdate({ jdHash }, { jdHash, parsed, expiresAt }, { upsert: true, new: true });
  return { parsed, fromCache: false };
}

const toItems = out => (out.items || []).map(it => {
  const variants = (it.variants || []).map(v => String(v).trim()).filter(Boolean).slice(0, 3);
  return { text: variants[0] || '', variants, selectedVariant: 0, matchScore: null };
});

const toEntries = out => (out.entries || []).map(e => ({
  heading: String(e.heading || '').trim(),
  subheading: String(e.subheading || '').trim(),
  items: toItems(e)
}));

const cleanSkillList = list => (Array.isArray(list) ? list : [])
  .filter(s => s && s.name)
  .map(s => ({ name: String(s.name).trim(), relevance: ['high', 'medium', 'low'].includes(s.relevance) ? s.relevance : 'medium' }));

// Raw profile data per section, read from the shared portfolio DB
async function rawDataFor(sectionKey, req) {
  switch (sectionKey) {
    case 'summary': {
      const [profile, skills, achievements, education] = await Promise.all([
        Profile.findOne().lean(),
        Skill.find({ isVisible: true }).sort({ order: 1 }).lean(),
        Achievement.find({ isVisible: true }).sort({ order: 1 }).lean(),
        Education.find({ isVisible: true }).sort({ order: 1 }).lean()
      ]);
      return {
        name: profile?.name, title: profile?.title, tagline: profile?.tagline,
        skills: skills.map(s => s.name),
        achievements: achievements.map(a => a.title),
        education: education.map(e => `${e.degree}, ${e.institution} (${e.endYear || ''})`)
      };
    }
    case 'skills': {
      const skills = await Skill.find({ isVisible: true }).sort({ order: 1 }).lean();
      return { skills: skills.map(s => s.name) };
    }
    case 'experience': {
      const experience = await Experience.find({ isVisible: true }).sort({ order: 1 }).lean();
      if (experience.length) {
        return {
          experience: experience.map(e => ({
            role: e.role, organization: e.organization,
            dates: [e.startDate, e.endDate].filter(Boolean).join(' – '),
            bullets: e.bullets, techStack: e.techStack
          }))
        };
      }
      // No experience entries yet — use free-text input from the editor if given,
      // otherwise frame visible projects as hands-on experience.
      if (req.body.rawInput?.trim()) return { experience: req.body.rawInput.trim() };
      const projects = await Project.find({ isVisible: true }).sort({ order: 1 }).lean();
      return {
        note: 'Applicant has no formal work experience data; derive honest project-based experience entries (heading = project role, e.g. "Full-Stack Developer — Personal Projects").',
        projects: projects.map(p => ({ title: p.title, description: p.description, techStack: p.techStack }))
      };
    }
    case 'achievements': {
      const achievements = await Achievement.find({ isVisible: true }).sort({ order: 1 }).lean();
      return { achievements: achievements.map(a => ({ title: a.title, description: a.description })) };
    }
    case 'education': {
      const education = await Education.find({ isVisible: true }).sort({ order: 1 }).lean();
      return {
        education: education.map(e => ({
          degree: e.degree, institution: e.institution, location: e.location,
          years: [e.startYear, e.endYear].filter(Boolean).join('–'), score: e.score, highlights: e.highlights
        }))
      };
    }
    default:
      throw new Error(`Unknown section: ${sectionKey}`);
  }
}

const STANDARD_SECTIONS = ['summary', 'skills', 'experience', 'achievements', 'education'];

// ---------- intake + research ----------

router.post('/intake', async (req, res) => {
  try {
    const { jdText: bodyJd, jdUrl, preferences = {} } = req.body;
    let company = (req.body.company || '').trim();
    let roleTitle = (req.body.roleTitle || '').trim();

    let jdText = (bodyJd || '').trim();
    if (!jdText && jdUrl) jdText = await fetchJdText(jdUrl);
    if (!jdText) return res.status(400).json({ error: 'Provide the JD as text or a fetchable URL.' });

    const jdHash = jdHashOf(jdText);

    let jdResult, companyResult;
    if (company) {
      // Both known: run company research and JD parsing in parallel (both cache-first)
      [companyResult, jdResult] = await Promise.allSettled([
        getCompanyResearch(company),
        getJdParsed(jdText, jdHash)
      ]);
    } else {
      // Company unknown: parse the JD first so we can auto-detect it, then research
      jdResult = await getJdParsed(jdText, jdHash)
        .then(v => ({ status: 'fulfilled', value: v }))
        .catch(e => ({ status: 'rejected', reason: e }));
      const detected = jdResult.status === 'fulfilled' ? jdResult.value.parsed : {};
      company = (detected.companyName || '').trim();
      if (company) {
        companyResult = await getCompanyResearch(company)
          .then(v => ({ status: 'fulfilled', value: v }))
          .catch(e => ({ status: 'rejected', reason: e }));
      } else {
        companyResult = { status: 'rejected', reason: new Error('Company name not stated in the JD — enter it manually.') };
      }
    }

    if (jdResult.status === 'rejected') {
      return res.status(502).json({ error: `JD parsing failed: ${jdResult.reason.message}` });
    }
    if (!roleTitle) roleTitle = (jdResult.value.parsed.roleTitle || '').trim();
    if (!company) return res.status(400).json({ error: 'Company name is required (could not auto-detect it from the JD).' });
    if (!roleTitle) return res.status(400).json({ error: 'Role title is required (could not auto-detect it from the JD).' });

    const resume = new Resume({ company, roleTitle, jdText, jdHash, preferences });
    resume.jdParsed = jdResult.value.parsed;

    let companyWarning = null;
    if (companyResult.status === 'fulfilled') {
      resume.companyResearch = companyResult.value.summary;
    } else {
      companyWarning = `Company research failed (${companyResult.reason.message}) — generation will proceed on JD data only.`;
      console.warn('[resumeAgent]', companyWarning);
    }

    resume.status = 'researched';
    await resume.save();

    res.status(201).json({
      resume,
      meta: {
        companyFromCache: companyResult.status === 'fulfilled' ? companyResult.value.fromCache : false,
        jdFromCache: jdResult.value.fromCache,
        companyWarning
      }
    });
  } catch (err) {
    console.error('[resumeAgent] intake:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- project ranking & selection ----------

router.post('/:id/rank-projects', async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });

    const projects = await Project.find({ isVisible: true }).sort({ order: 1 }).lean();
    if (!projects.length) return res.status(400).json({ error: 'No projects found in the portfolio DB.' });

    const rankings = await resumeAI.rankProjects(projects, resume.jdParsed);
    const byId = new Map(rankings.map(r => [String(r.projectId), r]));

    resume.projectRanking = projects.map(p => {
      const r = byId.get(String(p._id));
      return {
        projectId: p._id,
        title: p.title,
        score: Math.max(0, Math.min(100, Number(r?.score) || 0)),
        reasoning: r?.reasoning || '',
        selected: false
      };
    }).sort((a, b) => b.score - a.score);

    resume.status = 'ranked';
    await resume.save();
    res.json(resume);
  } catch (err) {
    console.error('[resumeAgent] rank:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/select-projects', async (req, res) => {
  try {
    const { projectIds = [] } = req.body;
    const resume = await Resume.findById(req.params.id);
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });

    const selectedSet = new Set(projectIds.map(String));
    resume.projectRanking.forEach(r => { r.selected = selectedSet.has(String(r.projectId)); });

    // Init/keep project sections for selected ids, preserving already-generated ones
    const existing = new Map((resume.sections.projects || []).map(p => [String(p.projectId), p]));
    const projects = await Project.find({ _id: { $in: [...selectedSet] } }).lean();
    const ranking = new Map(resume.projectRanking.map(r => [String(r.projectId), r]));

    resume.sections.projects = projectIds.map(String).map(id => {
      if (existing.has(id)) return existing.get(id);
      const p = projects.find(pr => String(pr._id) === id);
      return p ? {
        projectId: p._id, title: p.title, techStack: p.techStack || [],
        demoLink: p.demoLink || '', codeLink: p.codeLink || '', driveLink: p.driveLink || '',
        items: [], matchScore: ranking.get(id)?.score ?? null,
        isVisible: true, manuallyEdited: false, lastGeneratedAt: null
      } : null;
    }).filter(Boolean);

    resume.status = 'generating';
    await resume.save();
    res.json(resume);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- section generation (draft -> refine, two-call sequence) ----------

// NOTE: section generations run in parallel from the frontend, so every write below
// uses an atomic $set on just that section — a full-document .save() here causes
// mongoose VersionErrors when concurrent saves race on __v.
router.post('/:id/generate/project/:projectId', async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id).lean();
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });

    const section = (resume.sections.projects || []).find(p => String(p.projectId) === req.params.projectId);
    if (!section) return res.status(404).json({ error: 'Project not selected for this resume.' });

    const project = await Project.findById(req.params.projectId).lean();
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const rawData = { title: project.title, description: project.description, techStack: project.techStack, category: project.category };
    const draft = await resumeAI.generateSection('project', rawData, resume.companyResearch, resume.jdParsed, resume.preferences);
    const refined = await resumeAI.refineSection('project', draft, resume.companyResearch, resume.jdParsed, resume.preferences);
    const src = refined.items ? refined : draft;

    await Resume.updateOne(
      { _id: resume._id, 'sections.projects.projectId': project._id },
      {
        $set: {
          'sections.projects.$.overview': String(src.overview || draft.overview || '').trim(),
          'sections.projects.$.items': toItems(src),
          'sections.projects.$.manuallyEdited': false,
          'sections.projects.$.lastGeneratedAt': new Date(),
          status: 'editing'
        }
      }
    );
    res.json(await Resume.findById(resume._id).lean());
  } catch (err) {
    console.error('[resumeAgent] generate project:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/generate/:section', async (req, res) => {
  try {
    const sectionKey = req.params.section;
    if (!STANDARD_SECTIONS.includes(sectionKey)) {
      return res.status(400).json({ error: `Unknown section "${sectionKey}".` });
    }
    const resume = await Resume.findById(req.params.id).lean();
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });

    const rawData = await rawDataFor(sectionKey, req);
    const draft = await resumeAI.generateSection(sectionKey, rawData, resume.companyResearch, resume.jdParsed, resume.preferences);
    let refined;
    try {
      refined = await resumeAI.refineSection(sectionKey, draft, resume.companyResearch, resume.jdParsed, resume.preferences);
    } catch {
      refined = draft; // refine is best-effort on the initial pass
    }

    const base = `sections.${sectionKey}`;
    const set = {
      [`${base}.manuallyEdited`]: false,
      [`${base}.lastGeneratedAt`]: new Date(),
      status: 'editing'
    };
    if (sectionKey === 'skills') {
      set[`${base}.matched`] = cleanSkillList(refined.matched ?? draft.matched);
      set[`${base}.additional`] = cleanSkillList(refined.additional ?? draft.additional);
    } else if (sectionKey === 'summary') {
      const variants = (refined.variants || draft.variants || []).map(v => String(v).trim()).filter(Boolean).slice(0, 3);
      set[`${base}.items`] = [{ text: variants[0] || '', variants, selectedVariant: 0, matchScore: null }];
      set[`${base}.content`] = variants[0] || '';
    } else if (sectionKey === 'experience') {
      set[`${base}.entries`] = toEntries(refined.entries ? refined : draft);
      set[`${base}.items`] = [];
    } else {
      set[`${base}.items`] = toItems(refined.items ? refined : draft);
    }

    await Resume.updateOne({ _id: resume._id }, { $set: set });
    res.json(await Resume.findById(resume._id).lean());
  } catch (err) {
    console.error('[resumeAgent] generate:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- independent refinement pass ----------

function getSectionRef(resume, sectionKey, projectId) {
  if (sectionKey === 'project') {
    return (resume.sections.projects || []).find(p => String(p.projectId) === String(projectId));
  }
  return resume.sections[sectionKey];
}

router.post('/:id/refine/:section', async (req, res) => {
  try {
    const sectionKey = req.params.section;
    const resume = await Resume.findById(req.params.id).lean();
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });

    const section = getSectionRef(resume, sectionKey, req.body.projectId);
    if (!section) return res.status(404).json({ error: 'Section not found.' });

    let current;
    if (sectionKey === 'skills') {
      current = { matched: section.matched, additional: section.additional };
    } else if (sectionKey === 'summary') {
      current = { variants: section.items?.[0]?.variants?.length ? section.items[0].variants : [section.content] };
    } else if (sectionKey === 'experience') {
      current = { entries: (section.entries || []).map(e => ({ heading: e.heading, subheading: e.subheading, items: (e.items || []).map(i => ({ variants: i.variants })) })) };
    } else if (sectionKey === 'project') {
      current = { overview: section.overview || '', items: (section.items || []).map(i => ({ variants: i.variants })) };
    } else {
      current = { items: (section.items || []).map(i => ({ variants: i.variants })) };
    }

    const refined = await resumeAI.refineSection(sectionKey, current, resume.companyResearch, resume.jdParsed, resume.preferences, (req.body.instruction || '').slice(0, 500));

    // Atomic per-section $set — refines can run concurrently with other generations
    const now = new Date();
    let filter = { _id: resume._id };
    let base = `sections.${sectionKey}`;
    if (sectionKey === 'project') {
      filter = { _id: resume._id, 'sections.projects.projectId': section.projectId };
      base = 'sections.projects.$';
    }
    const set = { [`${base}.manuallyEdited`]: false, [`${base}.lastGeneratedAt`]: now };

    if (sectionKey === 'skills') {
      set[`${base}.matched`] = cleanSkillList(refined.matched);
      set[`${base}.additional`] = cleanSkillList(refined.additional);
    } else if (sectionKey === 'summary') {
      const variants = (refined.variants || []).map(v => String(v).trim()).filter(Boolean).slice(0, 3);
      if (variants.length) {
        set[`${base}.items`] = [{ text: variants[0], variants, selectedVariant: 0, matchScore: null }];
        set[`${base}.content`] = variants[0];
      }
    } else if (sectionKey === 'experience') {
      if (Array.isArray(refined.entries)) set[`${base}.entries`] = toEntries(refined);
    } else if (Array.isArray(refined.items)) {
      // keep matchScores where item counts line up
      const fresh = toItems(refined);
      fresh.forEach((it, i) => { if (section.items?.[i]) it.matchScore = section.items[i].matchScore; });
      set[`${base}.items`] = fresh;
      if (sectionKey === 'project' && refined.overview) set[`${base}.overview`] = String(refined.overview).trim();
    }

    await Resume.updateOne(filter, { $set: set });
    res.json(await Resume.findById(resume._id).lean());
  } catch (err) {
    console.error('[resumeAgent] refine:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- single bullet regeneration ----------

router.post('/:id/regenerate-bullet', async (req, res) => {
  try {
    const { section: sectionKey, projectId, entryIndex, itemIndex } = req.body;
    const resume = await Resume.findById(req.params.id).lean();
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });

    const section = getSectionRef(resume, sectionKey, projectId);
    // experience bullets live inside role-grouped entries; everything else is flat
    const itemList = sectionKey === 'experience'
      ? section?.entries?.[entryIndex]?.items
      : section?.items;
    const oldItem = itemList?.[itemIndex];
    if (!oldItem) return res.status(404).json({ error: 'Bullet not found.' });

    const siblings = itemList.filter((_, i) => i !== itemIndex).map(i => i.text);
    const out = await resumeAI.regenerateBullet(sectionKey, oldItem.text, siblings, resume.companyResearch, resume.jdParsed, resume.preferences);
    const variants = (out.variants || []).map(v => String(v).trim()).filter(Boolean).slice(0, 3);
    if (!variants.length) return res.status(502).json({ error: 'Model returned no variants.' });

    const item = { text: variants[0], variants, selectedVariant: 0, matchScore: oldItem.matchScore ?? null };

    // Atomic $set on the one bullet's path — safe alongside concurrent section writes
    let filter = { _id: resume._id };
    let itemPath;
    if (sectionKey === 'project') {
      filter = { _id: resume._id, 'sections.projects.projectId': section.projectId };
      itemPath = `sections.projects.$.items.${itemIndex}`;
    } else if (sectionKey === 'experience') {
      itemPath = `sections.experience.entries.${entryIndex}.items.${itemIndex}`;
    } else {
      itemPath = `sections.${sectionKey}.items.${itemIndex}`;
    }
    const set = { [itemPath]: item };
    if (sectionKey === 'summary') set['sections.summary.content'] = variants[0];

    await Resume.updateOne(filter, { $set: set });
    res.json({ entryIndex, itemIndex, item, resume: await Resume.findById(resume._id).lean() });
  } catch (err) {
    console.error('[resumeAgent] regen bullet:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- cover letter ----------

router.post('/:id/cover-letter', async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id).lean();
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });

    const profile = await Profile.findOne().lean() || {};
    const resumeMaterial = {
      summary: resume.sections.summary?.content || '',
      topSkills: (resume.sections.skills?.matched || []).map(s => s.name),
      projects: (resume.sections.projects || []).filter(p => p.isVisible).map(p => ({
        title: p.title, bullets: (p.items || []).map(i => i.text).filter(Boolean)
      })),
      achievements: (resume.sections.achievements?.items || []).map(i => i.text).filter(Boolean)
    };

    const out = await resumeAI.generateCoverLetter(
      { name: profile.name, title: profile.title, tagline: profile.tagline },
      resumeMaterial, resume.companyResearch, resume.jdParsed, resume.preferences,
      resume.company, resume.roleTitle
    );

    await Resume.updateOne(
      { _id: resume._id },
      { $set: { coverLetter: { content: out.content || '', manuallyEdited: false, lastGeneratedAt: new Date() } } }
    );
    res.json(await Resume.findById(resume._id).lean());
  } catch (err) {
    console.error('[resumeAgent] cover letter:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- coherence check ----------

router.post('/:id/coherence-check', async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id).lean();
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });

    const assembled = {
      roleTitle: resume.roleTitle,
      sectionOrder: resume.sectionOrder,
      summary: resume.sections.summary?.content,
      skills: {
        matched: (resume.sections.skills?.matched || []).map(s => s.name),
        additional: (resume.sections.skills?.additional || []).map(s => s.name)
      },
      experience: (resume.sections.experience?.entries || []).map(e => ({
        role: e.heading, org: e.subheading, bullets: (e.items || []).map(i => i.text)
      })),
      achievements: (resume.sections.achievements?.items || []).map(i => i.text),
      education: (resume.sections.education?.items || []).map(i => i.text),
      projects: (resume.sections.projects || []).map(p => ({ title: p.title, bullets: p.items.map(i => i.text) }))
    };

    const suggestions = await resumeAI.coherenceCheck(assembled);
    res.json({ suggestions });
  } catch (err) {
    console.error('[resumeAgent] coherence:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- autosave / load / list ----------

const PATCHABLE = ['sections', 'sectionOrder', 'preferences', 'status', 'projectRanking', 'coverLetter'];

router.patch('/:id', async (req, res) => {
  try {
    const set = {};
    for (const key of PATCHABLE) {
      if (req.body[key] !== undefined) set[key] = req.body[key];
    }
    if (!Object.keys(set).length) return res.status(400).json({ error: 'Nothing to update.' });

    // updateOne bypasses the version key, so autosave can't race generations into VersionErrors
    const result = await Resume.updateOne({ _id: req.params.id }, { $set: set }, { runValidators: true });
    if (!result.matchedCount) return res.status(404).json({ error: 'Resume not found.' });
    res.json(await Resume.findById(req.params.id).lean());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/exports', async (req, res) => {
  try {
    const filter = req.query.resumeId ? { resumeId: req.query.resumeId } : {};
    const exports_ = await ResumeExport.find(filter).sort({ createdAt: -1 }).select('-snapshot').lean();
    res.json(exports_);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/exports/:id/download', async (req, res) => {
  try {
    const exp = await ResumeExport.findById(req.params.id).lean();
    if (!exp) return res.status(404).json({ error: 'Export not found.' });
    const abs = path.join(__dirname, '../../uploads', exp.filePath);
    res.download(abs, path.basename(exp.filePath));
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/exports/:id', async (req, res) => {
  try {
    const exp = await ResumeExport.findByIdAndDelete(req.params.id);
    if (!exp) return res.status(404).json({ error: 'Export not found.' });
    const abs = path.join(__dirname, '../../uploads', exp.filePath);
    await fs.unlink(abs).catch(() => {}); // file may already be gone — not fatal
    res.json({ message: 'Export deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const resumes = await Resume.find()
      .select('company roleTitle status preferences createdAt updatedAt')
      .sort({ updatedAt: -1 }).lean();
    res.json(resumes);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id).lean();
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });
    res.json(resume);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const resume = await Resume.findByIdAndDelete(req.params.id);
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });
    res.json({ message: 'Resume deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ---------- export ----------

router.post('/:id/export', async (req, res) => {
  try {
    const { format = 'pdf', kind = 'resume' } = req.body;
    if (!['pdf', 'txt'].includes(format)) return res.status(400).json({ error: 'Format must be pdf or txt.' });
    if (!['resume', 'coverletter'].includes(kind)) return res.status(400).json({ error: 'Kind must be resume or coverletter.' });

    const resume = await Resume.findById(req.params.id).lean();
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });
    if (kind === 'coverletter' && !resume.coverLetter?.content) {
      return res.status(400).json({ error: 'Generate the cover letter first.' });
    }
    const profile = await Profile.findOne().lean() || {};

    const filePath = await exportResume(resume, profile, format, kind);
    const exportDoc = await ResumeExport.create({
      resumeId: resume._id,
      company: resume.company,
      roleTitle: resume.roleTitle,
      jdHash: resume.jdHash,
      format,
      kind,
      filePath,
      snapshot: kind === 'coverletter'
        ? { coverLetter: resume.coverLetter }
        : { sections: resume.sections, sectionOrder: resume.sectionOrder, preferences: resume.preferences }
    });

    await Resume.updateOne({ _id: resume._id }, { status: 'exported' });
    res.status(201).json({ export: { ...exportDoc.toObject(), snapshot: undefined } });
  } catch (err) {
    console.error('[resumeAgent] export:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

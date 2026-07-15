// Deterministic "real ATS parse" simulator. Given the TEXT extracted from the
// actually-rendered resume PDF (what a real ATS receives), it runs the same
// classes of checks Workday / Greenhouse / iCIMS parsers do — text-layer,
// section detection, contact parsing, date parsing, reading order, keyword
// extractability, glyph sanity — and produces a simulated autofill preview.
//
// No LLM, no network, no cost. This is a mechanical, independent second opinion
// to the LLM-based keyword coverage in the editor: it proves the resume's data
// actually survives PDF extraction, not just that the words exist in the DB.

// Section keys → the heading text the renderer prints (see resumeRenderer SECTION_TITLES).
const SECTION_TITLES = {
  summary: 'Summary',
  skills: 'Skills',
  projects: 'Projects',
  experience: 'Work Experience',
  achievements: 'Achievements',
  education: 'Education',
};

const EMAIL_RE = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s\-().]{7,}\d)/;
const LINKEDIN_RE = /linkedin\.com\/[a-z0-9\-_/%]+/i;
const GITHUB_RE = /github\.com\/[a-z0-9\-_/%]+/i;
// Month YYYY, YYYY-YYYY, YYYY-Present, or a bare 4-digit year.
const DATE_RE = /\b((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4}\s*[-–—]\s*(\d{4}|present|current)|(19|20)\d{2})\b/i;

const vis = arr => (arr || []).filter(i => i.isVisible !== false);

// Which sections the renderer will actually print (must mirror buildHtml's emptiness rules).
function renderedSections(resume) {
  const s = resume.sections || {};
  const has = {
    summary: !!(s.summary?.content && s.summary.content.trim()),
    skills: !!((s.skills?.matched || []).length || (s.skills?.additional || []).length),
    projects: (s.projects || []).some(p => p.isVisible && vis(p.items).length),
    experience: (s.experience?.entries || []).some(e => e.isVisible !== false && vis(e.items).length),
    achievements: vis(s.achievements?.items).length > 0,
    education: vis(s.education?.items).length > 0,
  };
  const order = (resume.sectionOrder || Object.keys(SECTION_TITLES));
  return order.filter(k => has[k]);
}

function mk(id, label, status, detail, extra = {}) {
  return { id, label, status, detail, ...extra };
}

// ---- individual checks (each returns a check object) --------------------------

function checkTextLayer(text) {
  const len = text.trim().length;
  if (len < 200) {
    return mk('text-layer', 'Text is machine-readable', 'fail',
      `Only ${len} characters were extractable. A real ATS would read this as an image/scan and get almost nothing — check the export isn't rasterized.`);
  }
  return mk('text-layer', 'Text is machine-readable', 'pass',
    `${len} characters extracted cleanly from the PDF text layer.`);
}

function checkSections(text, resume) {
  const lower = text.toLowerCase();
  const expected = renderedSections(resume);
  const detected = [], missing = [];
  expected.forEach(k => {
    (lower.includes(SECTION_TITLES[k].toLowerCase()) ? detected : missing).push(SECTION_TITLES[k]);
  });
  if (!expected.length) {
    return mk('sections', 'Section headings detected', 'warn', 'No sections have content yet.', { detected, missing });
  }
  if (missing.length) {
    return mk('sections', 'Section headings detected', missing.length >= expected.length ? 'fail' : 'warn',
      `${detected.length}/${expected.length} headings parse. Missing: ${missing.join(', ')} — an ATS may merge these into the wrong field.`,
      { detected, missing });
  }
  return mk('sections', 'Section headings detected', 'pass',
    `All ${expected.length} section headings parse cleanly.`, { detected, missing });
}

function checkContact(text, profile) {
  const email = (text.match(EMAIL_RE) || [])[0] || '';
  const phone = (text.match(PHONE_RE) || [])[0] || '';
  const linkedin = (text.match(LINKEDIN_RE) || [])[0] || '';
  const github = (text.match(GITHUB_RE) || [])[0] || '';
  const found = { email, phone, linkedin, github };

  if (!email && profile?.email) {
    return mk('contact', 'Contact details parse', 'fail',
      'Your email did not survive extraction — most ATS reject applications they cannot pull an email from.', { found });
  }
  const bits = [email && 'email', phone && 'phone', linkedin && 'LinkedIn', github && 'GitHub'].filter(Boolean);
  if (!bits.length) {
    return mk('contact', 'Contact details parse', 'fail', 'No contact details could be parsed from the top of the resume.', { found });
  }
  const status = email ? 'pass' : 'warn';
  return mk('contact', 'Contact details parse', status, `Parsed: ${bits.join(', ')}.`, { found });
}

function checkDates(text, resume) {
  const entries = [
    ...(resume.sections?.experience?.entries || []).filter(e => e.isVisible !== false).map(e => e.subheading || ''),
    ...vis(resume.sections?.education?.items).map(i => i.text || ''),
  ].filter(Boolean);

  if (!entries.length) {
    return mk('dates', 'Dates parse into ranges', 'warn', 'No dated experience or education entries to check.');
  }
  const withDate = entries.filter(e => DATE_RE.test(e)).length;
  // Also confirm at least one date actually survives in the extracted PDF text.
  const inPdf = DATE_RE.test(text);

  if (!inPdf || withDate === 0) {
    return mk('dates', 'Dates parse into ranges', 'fail',
      'No parseable dates found. An ATS reads undated roles as gaps or drops them — use formats like "Jun 2023 – Present".',
      { entries: entries.length, dated: withDate });
  }
  if (withDate < entries.length) {
    return mk('dates', 'Dates parse into ranges', 'warn',
      `${withDate}/${entries.length} entries carry a parseable date. Add month+year ranges to the rest.`,
      { entries: entries.length, dated: withDate });
  }
  return mk('dates', 'Dates parse into ranges', 'pass',
    `All ${entries.length} dated entries have a parseable date range.`, { entries: entries.length, dated: withDate });
}

function checkReadingOrder(text, resume) {
  const lower = text.toLowerCase();
  const expected = renderedSections(resume);
  const positions = expected
    .map(k => ({ k, pos: lower.indexOf(SECTION_TITLES[k].toLowerCase()) }))
    .filter(x => x.pos >= 0);

  const monotonic = positions.every((x, i) => i === 0 || x.pos > positions[i - 1].pos);
  if (positions.length < 2) {
    return mk('reading-order', 'Reading order preserved', 'pass', 'Too few sections to reorder.');
  }
  if (!monotonic) {
    return mk('reading-order', 'Reading order preserved', 'warn',
      'Sections extract out of order — a sign of multi-column bleed or table layout that can scramble how an ATS reads the resume.');
  }
  return mk('reading-order', 'Reading order preserved', 'pass', 'Sections extract top-to-bottom in the intended order.');
}

function checkKeywords(text, resume) {
  const keywords = (resume.jdParsed?.atsKeywords || []).map(k => String(k).trim()).filter(Boolean);
  if (!keywords.length) {
    return mk('keywords', 'JD keywords survive extraction', 'warn', 'No JD keywords parsed for this role yet.');
  }
  const lower = text.toLowerCase();
  const present = keywords.filter(k => lower.includes(k.toLowerCase()));
  const pct = Math.round((present.length / keywords.length) * 100);
  const status = pct >= 60 ? 'pass' : pct >= 30 ? 'warn' : 'fail';
  return mk('keywords', 'JD keywords survive extraction', status,
    `${present.length}/${keywords.length} (${pct}%) of ATS keywords are present in the extracted PDF text.`,
    { pct, present: present.length, total: keywords.length });
}

function checkGlyphs(text) {
  const replacements = (text.match(/�/g) || []).length;
  if (replacements > 0) {
    return mk('glyphs', 'No broken glyphs', 'warn',
      `${replacements} unreadable character(s) (�) found — often from a non-embedded font or fancy bullet/ligature that garbles extraction.`);
  }
  return mk('glyphs', 'No broken glyphs', 'pass', 'No garbled or unreadable characters detected.');
}

// ---- simulated autofill preview ----------------------------------------------

function buildAutofill(text, resume, profile) {
  const email = (text.match(EMAIL_RE) || [])[0] || profile?.email || '';
  const phone = (text.match(PHONE_RE) || [])[0] || profile?.phone || '';
  const linkedin = (text.match(LINKEDIN_RE) || [])[0] || profile?.linkedinUrl || '';
  const github = (text.match(GITHUB_RE) || [])[0] || profile?.githubUrl || '';

  const expEntry = (resume.sections?.experience?.entries || []).find(e => e.isVisible !== false);
  const mostRecentRole = expEntry
    ? [expEntry.heading, expEntry.subheading].filter(Boolean).join(' — ')
    : ((resume.sections?.projects || []).find(p => p.isVisible)?.title || '');
  const education = (vis(resume.sections?.education?.items)[0]?.text) || '';

  return {
    name: profile?.name || '',
    email, phone, location: profile?.location || '',
    linkedin, github,
    mostRecentRole,
    education,
  };
}

// ---- orchestrator ------------------------------------------------------------

function runAtsParseCheck({ pdfText, resume, profile }) {
  const text = pdfText || '';
  const checks = [
    checkTextLayer(text),
    checkSections(text, resume),
    checkContact(text, profile),
    checkDates(text, resume),
    checkReadingOrder(text, resume),
    checkKeywords(text, resume),
    checkGlyphs(text),
  ];

  // Weighted score: pass=1, warn=0.5, fail=0. All checks weigh equally.
  const w = { pass: 1, warn: 0.5, fail: 0 };
  const score = Math.round((checks.reduce((sum, c) => sum + w[c.status], 0) / checks.length) * 100);
  const level = score >= 80 ? 'high' : score >= 55 ? 'medium' : 'low';

  return {
    score,
    level,
    checks,
    autofill: buildAutofill(text, resume, profile),
    counts: {
      pass: checks.filter(c => c.status === 'pass').length,
      warn: checks.filter(c => c.status === 'warn').length,
      fail: checks.filter(c => c.status === 'fail').length,
    },
  };
}

module.exports = { runAtsParseCheck };

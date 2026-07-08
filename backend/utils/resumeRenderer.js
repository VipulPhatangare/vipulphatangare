// Export rendering — fully decoupled from generation. Takes a finalized
// resume doc + profile header data and produces HTML -> PDF (puppeteer) or plain text.
const path = require('path');
const fs = require('fs/promises');

const EXPORT_DIR = path.join(__dirname, '../../uploads/resumes');

const esc = s => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Only bullets the user hasn't hidden
function visibleItems(section) {
  return (section?.items || []).filter(i => i.isVisible !== false).map(i => i.text).filter(Boolean);
}

const SECTION_TITLES = {
  summary: 'Summary',
  skills: 'Skills',
  projects: 'Projects',
  experience: 'Work Experience',
  achievements: 'Achievements',
  education: 'Education'
};

// Template presets — kept in sync with the frontend preview (RESUME_TEMPLATES there).
// Each is single-column for ATS safety; they differ in font, accent and heading style.
const TEMPLATES = {
  classic: { font: "'Georgia', 'Times New Roman', serif", accent: '#1a1a1a', heading: 'rule', nameAccent: false },
  modern:  { font: "'Calibri', 'Helvetica Neue', Arial, sans-serif", accent: '#1a4fa0', heading: 'bar', nameAccent: false },
  minimal: { font: "'Helvetica Neue', Arial, sans-serif", accent: '#333', heading: 'plain', nameAccent: false },
  compact: { font: "'Calibri', Arial, sans-serif", accent: '#1a1a1a', heading: 'rule', nameAccent: false },
  accent:  { font: "'Calibri', 'Helvetica Neue', Arial, sans-serif", accent: '#0f766e', heading: 'band', nameAccent: true },
};

// Whitelisted font stacks, keyed by an id the frontend also knows (templates.js FONT_OPTIONS).
// Never interpolate a raw client-supplied font string into the HTML <style> block.
const FONT_STACKS = {
  calibri:   "'Calibri', 'Segoe UI', sans-serif",
  georgia:   "Georgia, 'Times New Roman', serif",
  helvetica: "'Helvetica Neue', Arial, sans-serif",
  garamond:  "'Garamond', 'EB Garamond', serif",
  cambria:   "Cambria, Georgia, serif",
  verdana:   "Verdana, Geneva, sans-serif",
  trebuchet: "'Trebuchet MS', sans-serif",
  times:     "'Times New Roman', Times, serif",
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// Resolve the effective accent/font: a validated user override, else the template default.
function resolveAccent(preferences, templateAccent) {
  const c = preferences?.accentColor;
  return (c && HEX_COLOR_RE.test(c)) ? c : templateAccent;
}
function resolveFont(preferences, templateFont) {
  const f = preferences?.fontFamily;
  return (f && FONT_STACKS[f]) ? FONT_STACKS[f] : templateFont;
}

function metrics(templateKey, preferences) {
  const compact = templateKey === 'compact' || preferences?.density === 'compact';
  const onePage = preferences?.length !== '2page';
  return {
    fontSize: compact ? 9.6 : (onePage ? 10.2 : 10.7),
    sectionGap: compact ? 7 : (onePage ? 9 : 13),
    itemGap: compact ? 1.5 : (onePage ? 2.5 : 4),
    entryGap: compact ? 4 : (onePage ? 6 : 9),
    lineHeight: compact ? 1.28 : 1.4,
  };
}

function headingCss(style) {
  switch (style) {
    case 'bar':
      return `border-left: 3px solid var(--accent); padding: 1px 0 2px 8px; color: var(--accent);
              text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 0.8px solid #ddd;`;
    case 'plain':
      return `text-transform: uppercase; letter-spacing: 2.5px; color: #333; font-weight: 600; padding-bottom: 3px;`;
    case 'band':
      return `background: var(--accent); color: #fff; padding: 3px 9px; text-transform: uppercase; letter-spacing: 1px;`;
    case 'rule':
    default:
      return `text-transform: uppercase; letter-spacing: 1px; border-bottom: 1.2px solid var(--accent); padding-bottom: 2px;`;
  }
}

// The project's own link: deployed demo first, then drive, then the GitHub code link.
function projHref(p) {
  return p.demoLink || p.driveLink || p.codeLink || '';
}

const REL_ORDER = { high: 0, medium: 1, low: 2 };
function orderedSkillNames(list) {
  return (list || []).slice()
    .sort((a, b) => (REL_ORDER[a.relevance] ?? 1) - (REL_ORDER[b.relevance] ?? 1))
    .map(s => esc(s.name));
}

function buildHtml(resume, profile) {
  const { sections, sectionOrder, preferences } = resume;
  const tpl = TEMPLATES[preferences?.template] || TEMPLATES.modern;
  const m = metrics(preferences?.template, preferences);
  const accent = resolveAccent(preferences, tpl.accent);
  const font = resolveFont(preferences, tpl.font);

  // Two-column contact header: plain contacts left, links right
  const leftBits = [
    profile.email && `Email: ${esc(profile.email)}`,
    profile.phone && `Phone: ${esc(profile.phone)}`,
    profile.githubUrl && `GitHub: <a href="${esc(profile.githubUrl)}">${esc(profile.githubUrl)}</a>`
  ].filter(Boolean);
  const rightBits = [
    profile.linkedinUrl && `LinkedIn: <a href="${esc(profile.linkedinUrl)}">${esc(profile.linkedinUrl)}</a>`,
    profile.portfolioUrl && `Portfolio: <a href="${esc(profile.portfolioUrl)}">${esc(profile.portfolioUrl)}</a>`,
    profile.leetcodeUrl && `Leetcode: <a href="${esc(profile.leetcodeUrl)}">${esc(profile.leetcodeUrl)}</a>`
  ].filter(Boolean);

  const blocks = [];
  for (const key of sectionOrder || Object.keys(SECTION_TITLES)) {
    const title = SECTION_TITLES[key];
    if (!title) continue;

    if (key === 'experience') {
      const sec = sections.experience;
      const entries = (sec?.entries || []).filter(e => e.isVisible !== false && visibleItems(e).length);
      if (!sec?.isVisible || !entries.length) continue;
      blocks.push(`<section><h2>${title}</h2>${entries.map(e => `
        <div class="entry">
          <div class="entry-role">${esc(e.heading)}</div>
          ${e.subheading ? `<div class="entry-sub">${esc(e.subheading)}</div>` : ''}
          <ul>${visibleItems(e).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>`).join('')}
      </section>`);
    } else if (key === 'skills') {
      const sk = sections.skills;
      if (!sk?.isVisible) continue;
      // Combined single list: JD-matched skills first, then the rest — no Core/Additional split
      const all = [...orderedSkillNames(sk.matched), ...orderedSkillNames(sk.additional)];
      if (!all.length) continue;
      blocks.push(`<section><h2>${title}</h2><p class="skills-line">${all.join(', ')}</p></section>`);
    } else if (key === 'projects') {
      const projs = (sections.projects || []).filter(p => p.isVisible && visibleItems(p).length);
      if (!projs.length) continue;
      blocks.push(`<section><h2>${title}</h2>${projs.map(p => {
        const href = projHref(p);
        const titleHtml = href
          ? `<a class="proj-title" href="${esc(href)}">${esc(p.title)}</a>`
          : `<span class="proj-title">${esc(p.title)}</span>`;
        return `<div class="entry">
          <div class="proj-head">${titleHtml}</div>
          ${p.overview ? `<div class="proj-overview">${esc(p.overview)}</div>` : ''}
          ${p.techStack?.length ? `<div class="proj-tech">${esc(p.techStack.join(', '))}</div>` : ''}
          <ul>${visibleItems(p).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>`;
      }).join('')}
      </section>`);
    } else if (key === 'summary') {
      const sec = sections.summary;
      if (!sec?.isVisible || !sec.content) continue;
      blocks.push(`<section><h2>${title}</h2><p>${esc(sec.content)}</p></section>`);
    } else {
      const sec = sections[key];
      if (!sec?.isVisible) continue;
      const items = visibleItems(sec);
      if (!items.length) continue;
      blocks.push(`<section><h2>${title}</h2><ul>${items.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>`);
    }
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --accent: ${accent}; }
  /* No body padding — equal margins on EVERY page come from Puppeteer's pdf margin option */
  body { font-family: ${font}; color: #1a1a1a; font-size: ${m.fontSize}pt;
         line-height: ${m.lineHeight}; }
  header { border-bottom: 1.4px solid #222; padding-bottom: 8px; margin-bottom: ${m.sectionGap}px; }
  h1 { font-size: 19pt; letter-spacing: 0.5px; margin-bottom: 4px; ${tpl.nameAccent ? 'color: var(--accent);' : ''} }
  .contact-grid { display: flex; justify-content: space-between; gap: 18px; font-size: 8.8pt; color: #333; }
  .contact-col { display: flex; flex-direction: column; gap: 1px; }
  a { color: var(--accent); text-decoration: none; }
  section { break-inside: auto; }
  h2 { font-size: 11pt; margin: ${m.sectionGap}px 0 5px; break-after: avoid; page-break-after: avoid; ${headingCss(tpl.heading)} }
  ul { padding-left: 16px; }
  li { margin-bottom: ${m.itemGap}px; break-inside: avoid; page-break-inside: avoid; }
  /* A whole entry (title + overview + tech + ALL bullets) moves to the next page
     intact rather than splitting — per user preference */
  .entry { margin-bottom: ${m.entryGap}px; break-inside: avoid; page-break-inside: avoid; }
  .entry-role, .entry-sub, .proj-head, .proj-overview, .proj-tech { break-after: avoid; page-break-after: avoid; }
  .entry-role { font-weight: 700; font-size: 10.4pt; }
  .entry-sub { font-weight: 600; font-size: 9.2pt; color: #333; margin-bottom: 2px; }
  .proj-head { display: flex; align-items: baseline; gap: 8px; }
  .proj-title { font-weight: 700; font-size: 10.4pt; }
  .proj-overview { font-size: 9.4pt; color: #222; margin: 1px 0; }
  .proj-tech { font-size: 8.6pt; color: #555; font-style: italic; margin: 1px 0 2px; }
  .skills-line { }
  p { margin-bottom: 2px; }
</style></head>
<body>
  <header>
    <h1>${esc(profile.name)}</h1>
    <div class="contact-grid">
      <div class="contact-col">${leftBits.map(b => `<span>${b}</span>`).join('')}</div>
      <div class="contact-col">${rightBits.map(b => `<span>${b}</span>`).join('')}</div>
    </div>
  </header>
  ${blocks.join('\n')}
</body></html>`;
}

function buildPlainText(resume, profile) {
  const { sections, sectionOrder } = resume;
  const lines = [profile.name, resume.roleTitle,
    [profile.email, profile.phone, profile.location].filter(Boolean).join(' | '), ''];

  for (const key of sectionOrder || Object.keys(SECTION_TITLES)) {
    const title = SECTION_TITLES[key];
    if (!title) continue;
    if (key === 'skills') {
      const sk = sections.skills;
      if (!sk?.isVisible) continue;
      lines.push(title.toUpperCase());
      if (sk.matched?.length) lines.push('Core: ' + sk.matched.map(s => s.name).join(', '));
      if (sk.additional?.length) lines.push('Additional: ' + sk.additional.map(s => s.name).join(', '));
      lines.push('');
    } else if (key === 'projects') {
      const projs = (sections.projects || []).filter(p => p.isVisible && visibleItems(p).length);
      if (!projs.length) continue;
      lines.push(title.toUpperCase());
      for (const p of projs) {
        const link = p.demoLink || p.driveLink || p.codeLink;
        lines.push(p.title + (p.techStack?.length ? ` (${p.techStack.join(', ')})` : '') + (link ? ` — ${link}` : ''));
        visibleItems(p).forEach(t => lines.push('- ' + t));
      }
      lines.push('');
    } else if (key === 'experience') {
      const sec = sections.experience;
      const entries = (sec?.entries || []).filter(e => e.isVisible !== false && visibleItems(e).length);
      if (!sec?.isVisible || !entries.length) continue;
      lines.push(title.toUpperCase());
      for (const e of entries) {
        lines.push(e.heading + (e.subheading ? ` | ${e.subheading}` : ''));
        visibleItems(e).forEach(t => lines.push('- ' + t));
      }
      lines.push('');
    } else if (key === 'summary') {
      if (!sections.summary?.isVisible || !sections.summary.content) continue;
      lines.push(title.toUpperCase(), sections.summary.content, '');
    } else {
      const sec = sections[key];
      if (!sec?.isVisible) continue;
      const items = visibleItems(sec);
      if (!items.length) continue;
      lines.push(title.toUpperCase());
      items.forEach(t => lines.push('- ' + t));
      lines.push('');
    }
  }
  return lines.join('\n').trim() + '\n';
}

function buildCoverLetterHtml(resume, profile) {
  const contactBits = [profile.email, profile.phone, profile.location]
    .filter(Boolean).map(esc).join(' &nbsp;|&nbsp; ');
  const paragraphs = (resume.coverLetter?.content || '')
    .split(/\n{2,}/).map(p => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Calibri', 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a;
         font-size: 11pt; line-height: 1.55; }
  header { border-bottom: 1.4px solid #222; padding-bottom: 10px; margin-bottom: 22px; }
  h1 { font-size: 17pt; letter-spacing: 0.5px; }
  .meta { font-size: 9pt; color: #444; margin-top: 3px; }
  .subject { font-weight: 600; margin-bottom: 16px; }
  p { margin-bottom: 12px; }
</style></head>
<body>
  <header>
    <h1>${esc(profile.name)}</h1>
    ${contactBits ? `<div class="meta">${contactBits}</div>` : ''}
  </header>
  <div class="subject">Re: Application for ${esc(resume.roleTitle)} — ${esc(resume.company)}</div>
  ${paragraphs}
</body></html>`;
}

function buildCoverLetterText(resume, profile) {
  const contact = [profile.email, profile.phone, profile.location].filter(Boolean).join(' | ');
  return [
    profile.name, contact, '',
    `Re: Application for ${resume.roleTitle} — ${resume.company}`, '',
    resume.coverLetter?.content || ''
  ].join('\n').trim() + '\n';
}

async function renderPdf(html, margin = { top: '34px', bottom: '34px', left: '42px', right: '42px' }) {
  const puppeteer = require('puppeteer'); // lazy — server boots even if not installed yet
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    // identical top/bottom margins repeated on EVERY page (bodies carry no padding)
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: false, margin });
  } finally {
    await browser.close();
  }
}

// Renders and writes the file; returns the path relative to uploads/
async function exportResume(resume, profile, format, kind = 'resume') {
  await fs.mkdir(EXPORT_DIR, { recursive: true });
  const safeCompany = resume.company.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40);
  const suffix = kind === 'coverletter' ? '_coverletter' : '';
  const filename = `${safeCompany}${suffix}_${Date.now()}.${format}`;
  const absPath = path.join(EXPORT_DIR, filename);

  if (format === 'pdf') {
    const html = kind === 'coverletter' ? buildCoverLetterHtml(resume, profile) : buildHtml(resume, profile);
    const margin = kind === 'coverletter'
      ? { top: '52px', bottom: '52px', left: '58px', right: '58px' }
      : undefined;
    const buffer = await renderPdf(html, margin);
    await fs.writeFile(absPath, buffer);
  } else if (format === 'txt') {
    const text = kind === 'coverletter' ? buildCoverLetterText(resume, profile) : buildPlainText(resume, profile);
    await fs.writeFile(absPath, text, 'utf8');
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }
  return `resumes/${filename}`;
}

module.exports = { exportResume, buildHtml };

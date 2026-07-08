import { useRef, useState, useLayoutEffect, useEffect } from 'react';
import { templateById, fontCssById } from './templates.js';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const SECTION_TITLES = {
  summary: 'Summary', skills: 'Skills', projects: 'Projects',
  experience: 'Work Experience', achievements: 'Achievements', education: 'Education'
};

// A4 at 96dpi
const PAGE_W = 794;
const PAGE_H = 1123;
const PAD = 44;              // page padding (top/bottom/left/right)
const CONTENT_H = PAGE_H - PAD * 2;
const PAGE_GAP = 26;

const visible = items => (items || []).filter(i => i.isVisible !== false && i.text);

// Build the resume as an ordered list of ATOMIC blocks. A section heading is bundled
// with its first content block so headings never sit alone at the bottom of a page —
// exactly mirroring the print template's break rules.
function buildBlocks(resume, profile) {
  const { sections, sectionOrder } = resume;

  // Two-column contact header, identical to the exported PDF
  const leftBits = [
    profile?.email && `Email: ${profile.email}`,
    profile?.phone && `Phone: ${profile.phone}`,
    profile?.githubUrl && <>GitHub: <a href={profile.githubUrl}>{profile.githubUrl}</a></>
  ].filter(Boolean);
  const rightBits = [
    profile?.linkedinUrl && <>LinkedIn: <a href={profile.linkedinUrl}>{profile.linkedinUrl}</a></>,
    profile?.portfolioUrl && <>Portfolio: <a href={profile.portfolioUrl}>{profile.portfolioUrl}</a></>,
    profile?.leetcodeUrl && <>Leetcode: <a href={profile.leetcodeUrl}>{profile.leetcodeUrl}</a></>
  ].filter(Boolean);

  const blocks = [{
    key: 'header',
    node: (
      <header className="rp-header">
        <h1>{profile?.name || 'Your Name'}</h1>
        <div className="rp-contact-grid">
          <div className="rp-contact-col">{leftBits.map((b, i) => <span key={i}>{b}</span>)}</div>
          <div className="rp-contact-col">{rightBits.map((b, i) => <span key={i}>{b}</span>)}</div>
        </div>
      </header>
    )
  }];

  const REL = { high: 0, medium: 1, low: 2 };
  const orderSkills = list => (list || []).slice()
    .sort((a, b) => (REL[a.relevance] ?? 1) - (REL[b.relevance] ?? 1)).map(s => s.name);

  const projHref = p => p.demoLink || p.driveLink || p.codeLink || '';

  // A whole entry (header + ALL bullets) is one atomic block — if it doesn't fit,
  // the entire entry moves to the next page, exactly like the exported PDF.
  const entryBlock = (head, bullets, key) => (
    <div className="rp-entry" key={key}>
      {head}
      <ul>{bullets.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );

  const sectionContent = (key) => {
    if (key === 'summary') {
      const s = sections.summary;
      if (!s?.isVisible || !s.content) return [];
      return [<p className="rp-text" key="s">{s.content}</p>];
    }
    if (key === 'skills') {
      const sk = sections.skills;
      if (!sk?.isVisible) return [];
      const all = [...orderSkills(sk.matched), ...orderSkills(sk.additional)];
      if (!all.length) return [];
      return [<p className="rp-text" key="s">{all.join(', ')}</p>];
    }
    if (key === 'projects') {
      return (sections.projects || []).filter(p => p.isVisible && visible(p.items).length).map((p, i) => {
        const href = projHref(p);
        const head = (
          <>
            <div className="rp-proj-head">
              {href ? <a className="rp-proj-title" href={href}>{p.title}</a> : <span className="rp-proj-title">{p.title}</span>}
            </div>
            {p.overview && <div className="rp-proj-overview">{p.overview}</div>}
            {p.techStack?.length > 0 && <div className="rp-proj-tech">{p.techStack.join(', ')}</div>}
          </>
        );
        return entryBlock(head, visible(p.items).map(it => it.text), i);
      });
    }
    if (key === 'experience') {
      const sec = sections.experience;
      if (!sec?.isVisible) return [];
      return (sec.entries || []).filter(e => e.isVisible !== false && visible(e.items).length).map((e, i) => {
        const head = (
          <>
            <div className="rp-role-head">{e.heading}</div>
            {e.subheading && <div className="rp-role-sub">{e.subheading}</div>}
          </>
        );
        return entryBlock(head, visible(e.items).map(it => it.text), i);
      });
    }
    const sec = sections[key];
    if (!sec?.isVisible) return [];
    const items = visible(sec.items);
    if (!items.length) return [];
    return items.map((it, j) => <ul key={j}><li>{it.text}</li></ul>);
  };

  for (const key of sectionOrder || Object.keys(SECTION_TITLES)) {
    if (!SECTION_TITLES[key]) continue;
    const content = sectionContent(key);
    if (!content.length) continue;
    content.forEach((node, i) => {
      blocks.push({
        key: `${key}-${i}`,
        node: i === 0
          ? <><h2 className="rp-h2">{SECTION_TITLES[key]}</h2>{node}</>
          : node
      });
    });
  }
  return blocks;
}

// Greedy packing of measured blocks into fixed-height pages
function paginate(blocks, heights) {
  const pages = [[]];
  let h = 0;
  for (const b of blocks) {
    const bh = heights[b.key] || 0;
    if (h + bh > CONTENT_H && pages[pages.length - 1].length) {
      pages.push([]);
      h = 0;
    }
    pages[pages.length - 1].push(b);
    h += bh;
  }
  return pages;
}

export default function ResumePreview({ resume, profile }) {
  const tpl = templateById(resume.preferences?.template);
  const compact = resume.preferences?.template === 'compact' || resume.preferences?.density === 'compact';
  // A user override wins over the template default — kept in sync with the backend's
  // resolveAccent()/resolveFont() in resumeRenderer.js so preview === downloaded PDF.
  const accent = HEX_RE.test(resume.preferences?.accentColor) ? resume.preferences.accentColor : tpl.accent;
  const font = fontCssById(resume.preferences?.fontFamily) || tpl.font;

  const blocks = buildBlocks(resume, profile);
  const measureRefs = useRef({});
  const wrapRef = useRef(null);
  const [heights, setHeights] = useState({});
  const [scale, setScale] = useState(1);

  // Measure each block's rendered height (offscreen) whenever content changes
  useLayoutEffect(() => {
    const next = {};
    let changed = false;
    for (const b of blocks) {
      const el = measureRefs.current[b.key];
      if (el) {
        next[b.key] = el.offsetHeight;
        if (next[b.key] !== heights[b.key]) changed = true;
      }
    }
    if (changed || Object.keys(next).length !== Object.keys(heights).length) setHeights(next);
  });

  // Fit the A4 sheet width into the available preview column
  useLayoutEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth || PAGE_W;
      setScale(Math.min(1, w / PAGE_W));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const pages = paginate(blocks, heights);
  const styleVars = { '--rp-accent': accent, fontFamily: font };

  return (
    <div className="rp-root" ref={wrapRef}>
      <div className="rp-pagecount">
        <i className="fas fa-file-lines"></i> {pages.length} page{pages.length !== 1 ? 's' : ''}
      </div>

      {/* Offscreen measurer: identical width/typography to a page's content area */}
      <div className={`rp-measurer rp-sheet-type${compact ? ' rp-compact' : ''}`} data-heading={tpl.heading}
        style={{ ...styleVars, width: PAGE_W - PAD * 2 }}>
        {blocks.map(b => (
          <div key={b.key} ref={el => { measureRefs.current[b.key] = el; }}>{b.node}</div>
        ))}
      </div>

      {/* Visible paginated sheets, scaled to fit the column */}
      <div className="rp-pages" style={{ height: (pages.length * PAGE_H + (pages.length - 1) * PAGE_GAP) * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {pages.map((page, pi) => (
            <div
              key={pi}
              className={`rp-sheet rp-sheet-type rp-tpl-${tpl.id}${compact ? ' rp-compact' : ''}`}
              data-heading={tpl.heading}
              style={{ ...styleVars, width: PAGE_W, height: PAGE_H, padding: PAD, marginBottom: pi < pages.length - 1 ? PAGE_GAP : 0 }}
            >
              {page.map(b => <div key={b.key} className="rp-block">{b.node}</div>)}
              <div className="rp-page-num">{pi + 1}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

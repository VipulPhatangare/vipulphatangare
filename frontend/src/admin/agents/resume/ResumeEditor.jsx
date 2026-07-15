import { useState, useRef, useEffect } from 'react';
import api from '../../../api/axios.js';
import ResumePreview from './ResumePreview.jsx';
import SettingsModal from './SettingsModal.jsx';
import RefineModal from './RefineModal.jsx';
import PreviewModal from './PreviewModal.jsx';

const SECTION_META = [
  { key: 'summary', label: 'Summary', icon: 'fa-align-left' },
  { key: 'skills', label: 'Skills', icon: 'fa-code' },
  { key: 'projects', label: 'Projects', icon: 'fa-diagram-project' },
  { key: 'experience', label: 'Experience', icon: 'fa-briefcase' },
  { key: 'achievements', label: 'Achievements', icon: 'fa-trophy' },
  { key: 'education', label: 'Education', icon: 'fa-graduation-cap' },
];

const RELEVANCE_ORDER = ['high', 'medium', 'low'];

// Deterministic ATS coverage — string-match JD keywords against the assembled resume text.
// Free and instant, so it can update live on every edit between refine calls.
function computeAtsCoverage(resume) {
  const keywords = resume.jdParsed?.atsKeywords || [];
  if (!keywords.length) return null;

  const vis = items => (items || []).filter(i => i.isVisible !== false);
  const parts = [resume.sections.summary?.content || ''];
  ['achievements', 'education'].forEach(k =>
    vis(resume.sections[k]?.items).forEach(i => parts.push(i.text)));
  (resume.sections.experience?.entries || []).filter(e => e.isVisible !== false).forEach(e => {
    parts.push(e.heading, e.subheading);
    vis(e.items).forEach(i => parts.push(i.text));
  });
  (resume.sections.skills?.matched || []).forEach(s => parts.push(s.name));
  (resume.sections.skills?.additional || []).forEach(s => parts.push(s.name));
  (resume.sections.projects || []).filter(p => p.isVisible).forEach(p => {
    parts.push(p.title, (p.techStack || []).join(' '));
    vis(p.items).forEach(i => parts.push(i.text));
  });
  const text = parts.join(' ').toLowerCase();

  const covered = [];
  const missing = [];
  keywords.forEach(kw => {
    (text.includes(String(kw).toLowerCase()) ? covered : missing).push(kw);
  });
  return { covered, missing, pct: Math.round((covered.length / keywords.length) * 100) };
}

const GAP_META = {
  backed:  { icon: 'fa-circle-check',        label: 'You have this',   cls: 'gap-backed' },
  partial: { icon: 'fa-circle-half-stroke',  label: 'Related evidence',cls: 'gap-partial' },
  absent:  { icon: 'fa-circle-xmark',        label: 'Not in profile',  cls: 'gap-absent' },
};

function AtsGauge({ resume, onApplyGap }) {
  const [open, setOpen] = useState(false);
  const [gaps, setGaps] = useState(null);
  const [explaining, setExplaining] = useState(false);
  const [gapErr, setGapErr] = useState('');
  const [applyingIdx, setApplyingIdx] = useState(null);
  const cov = computeAtsCoverage(resume);
  if (!cov) return null;
  const level = cov.pct >= 75 ? 'high' : cov.pct >= 45 ? 'medium' : 'low';

  // Auto-apply: hand the gap to the parent (which refines the named projects and
  // adds the skill), then drop the row so the report reflects the fix.
  const applyOne = async (g, i) => {
    setApplyingIdx(i);
    try {
      await onApplyGap(g);
      setGaps(gs => gs.filter((_, j) => j !== i));
    } catch (err) {
      setGapErr(err.response?.data?.error || err.message);
    } finally {
      setApplyingIdx(null);
    }
  };

  // AI-backed gap analysis: maps each missing keyword to the applicant's real
  // evidence (RAG) so suggestions stay honest — never "just add this keyword".
  const explainGaps = async () => {
    setExplaining(true);
    setGapErr('');
    try {
      const { data } = await api.post(`/resume-agent/${resume._id}/ats-gap`);
      setGaps(data.gaps || []);
    } catch (err) {
      setGapErr(err.response?.data?.error || err.message);
    } finally {
      setExplaining(false);
    }
  };

  return (
    <div className="ra-ats-panel">
      <button className="ra-ats-summary" onClick={() => setOpen(o => !o)}>
        <span className={`ra-score-badge ra-score-${level}`}>{cov.pct}%</span>
        <span className="ra-ats-label">ATS keywords — {cov.covered.length}/{cov.covered.length + cov.missing.length} covered</span>
        <div className="ra-ats-bar"><div className={`ra-ats-fill fill-${level}`} style={{ width: `${cov.pct}%` }} /></div>
        <i className={`fas fa-chevron-${open ? 'up' : 'down'}`}></i>
      </button>
      {open && (
        <div className="ra-ats-detail">
          {cov.missing.length > 0 && (
            <div className="ra-skill-group">
              <div className="ra-ats-gap-head">
                <h5><i className="fas fa-circle-exclamation"></i> Missing from resume</h5>
                <button className="ra-secondary-btn ra-explain-btn" onClick={explainGaps} disabled={explaining}
                  title="Analyse each gap against your real profile evidence">
                  <i className={`fas ${explaining ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i> Explain gaps
                </button>
              </div>
              <div className="ra-chip-row">{cov.missing.map((k, i) => <span key={i} className="ra-chip ra-chip-missing">{k}</span>)}</div>
              {gapErr && <p className="ra-muted ra-gap-err">{gapErr}</p>}
              {gaps && (
                <div className="ra-gap-list">
                  {gaps.length === 0 && <p className="ra-muted">No actionable gaps found.</p>}
                  {gaps.map((g, i) => {
                    const m = GAP_META[g.coverage] || GAP_META.absent;
                    const actionable = g.coverage !== 'absent';
                    return (
                      <div key={i} className={`ra-gap-row ${m.cls}`}>
                        <span className="ra-gap-kw"><i className={`fas ${m.icon}`}></i> {g.keyword}</span>
                        <span className="ra-gap-tag">{m.label}</span>
                        <span className="ra-gap-msg">
                          {g.evidence && <em>Backed by: {g.evidence}. </em>}
                          {g.suggestion}
                        </span>
                        {actionable ? (
                          <button className="ra-apply-btn ra-gap-apply" disabled={applyingIdx !== null}
                            onClick={() => applyOne(g, i)}
                            title="Rewrite the backing projects to work this keyword in (truthfully)">
                            {applyingIdx === i
                              ? <i className="fas fa-spinner fa-spin"></i>
                              : <><i className="fas fa-wand-magic-sparkles"></i> Apply</>}
                          </button>
                        ) : <span className="ra-gap-learn"><i className="fas fa-graduation-cap"></i> learn</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="ra-skill-group">
            <h5><i className="fas fa-circle-check"></i> Covered</h5>
            <div className="ra-chip-row">{cov.covered.map((k, i) => <span key={i} className="ra-chip ra-chip-covered">{k}</span>)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

const PARSE_STATUS_META = {
  pass: { icon: 'fa-circle-check',        cls: 'ats-pass' },
  warn: { icon: 'fa-triangle-exclamation',cls: 'ats-warn' },
  fail: { icon: 'fa-circle-xmark',        cls: 'ats-fail' },
};

// Real ATS parse test — renders the resume to the exact PDF an ATS receives,
// extracts its text, and mechanically verifies sections/contact/dates/order/etc.
// Independent from the LLM keyword gauge above: this proves the data survives
// PDF extraction. Runs on demand (a PDF render takes ~1-2s), no LLM cost.
function AtsParsePanel({ resume }) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    setRunning(true);
    setErr('');
    try {
      const { data } = await api.post(`/resume-agent/${resume._id}/ats-parse-check`);
      setReport(data);
      setOpen(true);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setRunning(false);
    }
  };

  const level = report?.level || 'medium';

  return (
    <div className="ra-ats-panel">
      <button className="ra-ats-summary" onClick={() => (report ? setOpen(o => !o) : run())} disabled={running}>
        <span className={`ra-score-badge ra-score-${level}`}>
          {running ? <i className="fas fa-spinner fa-spin" /> : report ? `${report.score}%` : <i className="fas fa-vial" />}
        </span>
        <span className="ra-ats-label">
          {report
            ? `ATS parse test — ${report.counts.pass} passed, ${report.counts.warn} warnings, ${report.counts.fail} failed`
            : 'Run real ATS parse test — simulate how Workday / Greenhouse read your PDF'}
        </span>
        {report && <i className={`fas fa-chevron-${open ? 'up' : 'down'}`}></i>}
      </button>
      {err && <p className="ra-muted ra-gap-err" style={{ padding: '0 1rem 0.8rem' }}>{err}</p>}
      {report && open && (
        <div className="ra-ats-detail">
          <div className="ra-parse-checks">
            {report.checks.map(c => {
              const m = PARSE_STATUS_META[c.status] || PARSE_STATUS_META.warn;
              return (
                <div key={c.id} className={`ra-parse-row ${m.cls}`}>
                  <span className="ra-parse-icon"><i className={`fas ${m.icon}`}></i></span>
                  <div className="ra-parse-body">
                    <span className="ra-parse-label">{c.label}</span>
                    <span className="ra-parse-detail">{c.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ra-skill-group ra-autofill">
            <h5><i className="fas fa-wand-magic-sparkles"></i> Simulated autofill — what an ATS would extract</h5>
            <div className="ra-autofill-grid">
              {[
                ['Name', report.autofill.name],
                ['Email', report.autofill.email],
                ['Phone', report.autofill.phone],
                ['Location', report.autofill.location],
                ['Most recent role', report.autofill.mostRecentRole],
                ['Education', report.autofill.education],
                ['LinkedIn', report.autofill.linkedin],
                ['GitHub', report.autofill.github],
              ].map(([k, v]) => (
                <div key={k} className="ra-autofill-row">
                  <span className="ra-autofill-key">{k}</span>
                  <span className={`ra-autofill-val${v ? '' : ' empty'}`}>{v || '— not detected —'}</span>
                </div>
              ))}
            </div>
          </div>

          <button className="ra-secondary-btn" onClick={run} disabled={running} style={{ alignSelf: 'flex-start' }}>
            <i className={`fas ${running ? 'fa-spinner fa-spin' : 'fa-rotate'}`}></i> Re-run test
          </button>
          <p className="ra-muted" style={{ fontSize: '0.72rem' }}>
            Simulated parse based on the known ATS failure classes — not a live run of any vendor's parser.
          </p>
        </div>
      )}
    </div>
  );
}

// Feature 2: make the live company research visible so the applicant can see WHY
// the AI phrased things the way it did (recent news, culture, tech stack all feed tailoring).
function ResearchPanel({ resume }) {
  const [open, setOpen] = useState(false);
  const r = resume.companyResearch;
  if (!r || typeof r !== 'object') return null;
  const rows = [
    ['Industry', r.industry],
    ['Tech stack', (r.techStack || []).join(', ')],
    ['Products', (r.products || []).join(', ')],
    ['Culture', r.culture],
    ['Recent news', (r.recentNews || []).join(' • ')],
  ].filter(([, v]) => v && String(v).trim());
  if (!rows.length) return null;
  return (
    <div className="ra-research-panel">
      <button className="ra-ats-summary" onClick={() => setOpen(o => !o)}>
        <span className="ra-research-badge"><i className="fas fa-magnifying-glass-chart"></i></span>
        <span className="ra-ats-label">Company research applied to {resume.company} — shapes summary, keywords & cover letter</span>
        <i className={`fas fa-chevron-${open ? 'up' : 'down'}`}></i>
      </button>
      {open && (
        <div className="ra-ats-detail ra-research-detail">
          {rows.map(([k, v]) => (
            <div key={k} className="ra-research-row"><strong>{k}:</strong> <span>{v}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditableText({ value, onCommit, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);

  useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select(); } }, [editing]);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== value) onCommit(draft.trim());
  };

  if (editing) {
    return (
      <textarea
        ref={ref} className={`ra-edit-area ${className}`} rows={2}
        value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
      />
    );
  }
  return (
    <span className={`ra-editable ${className}`} title="Click to edit" onClick={() => setEditing(true)}>
      {value || <em className="ra-muted">Click to edit…</em>}
    </span>
  );
}

function BulletRow({ item, onEdit, onCycle, onRegen, onToggleHide, onMove, first, last, regenning, dragHandlers, dragging }) {
  const total = item.variants?.length || 0;
  const hidden = item.isVisible === false;
  return (
    <div className={`ra-bullet${dragging ? ' dragging' : ''}${hidden ? ' hidden' : ''}`} draggable {...dragHandlers}>
      <span className="ra-move-btns">
        <button disabled={first} onClick={() => onMove(-1)} title="Move up"><i className="fas fa-chevron-up"></i></button>
        <button disabled={last} onClick={() => onMove(1)} title="Move down"><i className="fas fa-chevron-down"></i></button>
      </span>
      <div className="ra-bullet-main">
        <EditableText value={item.text} onCommit={onEdit} />
        <div className="ra-bullet-meta">
          {item.source && (
            <span className="ra-source-badge" title="This claim is grounded in your real profile data — not invented">
              <i className="fas fa-link"></i> {item.source}
            </span>
          )}
          {total > 1 && (
            <div className="ra-variant-switch">
              <button onClick={() => onCycle(-1)} title="Previous phrasing"><i className="fas fa-chevron-left"></i></button>
              <span>{(item.selectedVariant ?? 0) + 1}/{total}</span>
              <button onClick={() => onCycle(1)} title="Next phrasing"><i className="fas fa-chevron-right"></i></button>
            </div>
          )}
        </div>
      </div>
      <button className="ra-icon-btn" onClick={onToggleHide} title={hidden ? 'Show on resume' : 'Hide from resume'}>
        <i className={`fas ${hidden ? 'fa-eye-slash' : 'fa-eye'}`}></i>
      </button>
      <button className="ra-icon-btn" onClick={onRegen} disabled={regenning} title="Regenerate this bullet (3 fresh phrasings)">
        <i className={`fas fa-rotate${regenning ? ' fa-spin' : ''}`}></i>
      </button>
    </div>
  );
}

function SkillChip({ skill, onCycleRelevance, onRemove }) {
  return (
    <span className={`ra-skill-chip rel-${skill.relevance}`}>
      {skill.name}
      <button className="ra-rel-tag" onClick={onCycleRelevance} title="Cycle relevance (high/medium/low)">
        {skill.relevance}
      </button>
      <button className="ra-chip-x" onClick={onRemove} title="Remove skill">×</button>
    </span>
  );
}

export default function ResumeEditor({
  resume, profile, busy, saving,
  onGenerateSection, onGenerateAll, onRefineSection, onRegenBullet,
  mutate, coherence, onCoherenceCheck, onDismissSuggestion, onApplySuggestion, checkingCoherence,
  canUndo, onUndo, canRedo, onRedo, onProceedToExport,
  onPrefChange, onAddProject, addingProject, onProfileUpdate
}) {
  const [drag, setDrag] = useState(null); // { list: 'summary'|'experience'|...|'project:<id>'|'projects', index }
  const [newSkill, setNewSkill] = useState('');
  const [applying, setApplying] = useState(null); // index of suggestion being applied
  const [showAddProject, setShowAddProject] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState('');
  const [refineTarget, setRefineTarget] = useState(null); // { key, projectId, label }
  const [refineBusy, setRefineBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Refine popup Apply — runs the existing refine with the typed instruction,
  // then closes. onRefineSection swallows its own errors, so this always resolves.
  const runRefine = async (instruction) => {
    if (!refineTarget) return;
    setRefineBusy(true);
    try {
      await onRefineSection(refineTarget.key, refineTarget.projectId, instruction);
      setRefineTarget(null);
    } finally {
      setRefineBusy(false);
    }
  };

  // Auto-apply an ATS gap: the gap's evidence names the backing projects, so we
  // refine exactly those to weave the keyword in (truthfully), and — when the
  // suggestion calls for it — also surface the keyword as a skill.
  const applyGap = async (gap) => {
    const projects = resume.sections.projects || [];
    const evidence = gap.evidence || '';
    const matched = projects.filter(p => p.title && evidence.includes(p.title));
    const instruction = `Weave the keyword "${gap.keyword}" into this section wherever it is truthful and supported by the actual work. ${gap.suggestion}`;

    const jobs = matched.map(p => onRefineSection('project', String(p.projectId), instruction));

    // Only add as a skill when the suggestion explicitly asks for it (avoids turning
    // phrases like "business process automation" into odd skill chips).
    if (/\bskill\b/i.test(gap.suggestion)) {
      mutate(r => {
        const all = [...(r.sections.skills.matched || []), ...(r.sections.skills.additional || [])];
        if (!all.some(s => s.name.toLowerCase() === gap.keyword.toLowerCase())) {
          r.sections.skills.additional.push({ name: gap.keyword, relevance: 'medium' });
          r.sections.skills.manuallyEdited = true;
        }
      });
    }

    // Nothing concrete to target — fold the keyword into the summary instead.
    if (!matched.length && !/\bskill\b/i.test(gap.suggestion)) {
      jobs.push(onRefineSection('summary', null, instruction));
    }

    await Promise.allSettled(jobs);
  };

  // Rebuild the RAG "project memory" from the current profile data (projects,
  // experience, skills…). Embeds only changed items, so it's cheap to re-run.
  const rebuildMemory = async () => {
    setReindexing(true);
    setReindexMsg('');
    try {
      const { data } = await api.post('/resume-agent/reindex');
      setReindexMsg(`Memory updated — ${data.embedded} embedded, ${data.unchanged} unchanged${data.pruned ? `, ${data.pruned} pruned` : ''}.`);
    } catch (err) {
      setReindexMsg(err.response?.data?.error || err.message);
    } finally {
      setReindexing(false);
      setTimeout(() => setReindexMsg(''), 6000);
    }
  };

  // Ranked projects not currently on the resume — candidates for "+ Add project"
  const currentProjectIds = new Set((resume.sections.projects || []).map(p => String(p.projectId)));
  const availableProjects = (resume.projectRanking || []).filter(r => !currentProjectIds.has(String(r.projectId)));

  // ---- generic mutators (all go through mutate() => undo + autosave) ----

  const sectionOf = (draftResume, key, projectId) =>
    key === 'project'
      ? draftResume.sections.projects.find(p => String(p.projectId) === String(projectId))
      : draftResume.sections[key];

  // entryIdx is only used by the experience section, whose bullets live in role-grouped entries
  const itemListOf = (sec, key, entryIdx) =>
    key === 'experience' && entryIdx != null ? sec.entries[entryIdx].items : sec.items;

  const editBullet = (key, projectId, idx, text, entryIdx = null) => mutate(r => {
    const sec = sectionOf(r, key, projectId);
    itemListOf(sec, key, entryIdx)[idx].text = text;
    sec.manuallyEdited = true;
    if (key === 'summary') sec.content = text;
  });

  const cycleVariant = (key, projectId, idx, dir, entryIdx = null) => mutate(r => {
    const sec = sectionOf(r, key, projectId);
    const item = itemListOf(sec, key, entryIdx)[idx];
    const n = item.variants.length;
    item.selectedVariant = ((item.selectedVariant ?? 0) + dir + n) % n;
    item.text = item.variants[item.selectedVariant];
    if (key === 'summary') sec.content = item.text;
  });

  const toggleVisible = (key, projectId) => mutate(r => {
    const sec = sectionOf(r, key, projectId);
    sec.isVisible = !sec.isVisible;
  });

  const toggleBulletHide = (key, projectId, idx, entryIdx = null) => mutate(r => {
    const sec = sectionOf(r, key, projectId);
    const item = itemListOf(sec, key, entryIdx)[idx];
    item.isVisible = item.isVisible === false;
  });

  const toggleEntryHide = (entryIdx) => mutate(r => {
    const e = r.sections.experience.entries[entryIdx];
    e.isVisible = e.isVisible === false;
  });

  const removeProject = (projectId) => mutate(r => {
    r.sections.projects = r.sections.projects.filter(p => String(p.projectId) !== String(projectId));
  });

  // Explicit up/down reordering (more reliable than drag) for bullets, projects and entries
  const swap = (arr, i, dir) => {
    const ni = i + dir;
    if (ni < 0 || ni >= arr.length) return;
    [arr[i], arr[ni]] = [arr[ni], arr[i]];
  };
  const moveBullet = (key, projectId, idx, dir, entryIdx = null) => mutate(r => {
    const sec = sectionOf(r, key, projectId);
    swap(itemListOf(sec, key, entryIdx), idx, dir);
    sec.manuallyEdited = true;
  });
  const editProjectOverview = (projectId, text) => mutate(r => {
    const sec = sectionOf(r, 'project', projectId);
    sec.overview = text;
    sec.manuallyEdited = true;
  });
  const moveProject = (idx, dir) => mutate(r => swap(r.sections.projects, idx, dir));
  const moveEntry = (idx, dir) => mutate(r => swap(r.sections.experience.entries, idx, dir));

  const reorderList = (listId, from, to) => mutate(r => {
    let arr;
    if (listId === 'projects') arr = r.sections.projects;
    else if (listId.startsWith('project:')) arr = sectionOf(r, 'project', listId.slice(8)).items;
    else arr = r.sections[listId].items;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
  });

  const dragHandlers = (listId, index) => ({
    onDragStart: () => setDrag({ list: listId, index }),
    onDragOver: (e) => { e.preventDefault(); },
    onDrop: (e) => {
      e.preventDefault();
      if (drag && drag.list === listId && drag.index !== index) reorderList(listId, drag.index, index);
      setDrag(null);
    },
    onDragEnd: () => setDrag(null),
  });

  // ---- skills mutators ----

  const cycleRelevance = (group, idx) => mutate(r => {
    const s = r.sections.skills[group][idx];
    s.relevance = RELEVANCE_ORDER[(RELEVANCE_ORDER.indexOf(s.relevance) + 1) % 3];
    r.sections.skills.manuallyEdited = true;
  });

  const removeSkill = (group, idx) => mutate(r => {
    r.sections.skills[group].splice(idx, 1);
    r.sections.skills.manuallyEdited = true;
  });

  const addSkill = () => {
    if (!newSkill.trim()) return;
    mutate(r => {
      r.sections.skills.additional.push({ name: newSkill.trim(), relevance: 'medium' });
      r.sections.skills.manuallyEdited = true;
    });
    setNewSkill('');
  };

  // ---- section rendering ----

  const renderSectionBody = (key) => {
    if (key === 'skills') {
      const sk = resume.sections.skills;
      const hasSkills = sk.matched?.length || sk.additional?.length;
      if (!hasSkills) return <p className="ra-muted">Not generated yet.</p>;
      return (
        <div className="ra-skills-body">
          <div className="ra-skill-group">
            <h5><i className="fas fa-bullseye"></i> Matched to JD</h5>
            <div className="ra-chip-row">
              {sk.matched.map((s, i) => (
                <SkillChip key={`m${i}`} skill={s}
                  onCycleRelevance={() => cycleRelevance('matched', i)}
                  onRemove={() => removeSkill('matched', i)} />
              ))}
            </div>
          </div>
          <div className="ra-skill-group">
            <h5><i className="fas fa-layer-group"></i> Additional</h5>
            <div className="ra-chip-row">
              {sk.additional.map((s, i) => (
                <SkillChip key={`a${i}`} skill={s}
                  onCycleRelevance={() => cycleRelevance('additional', i)}
                  onRemove={() => removeSkill('additional', i)} />
              ))}
              <span className="ra-add-skill">
                <input value={newSkill} onChange={e => setNewSkill(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSkill()} placeholder="+ add skill" />
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (key === 'projects') {
      const projs = resume.sections.projects || [];
      const projCards = projs.map((p, pi) => {
        const pid = String(p.projectId);
        const busyKey = `project:${pid}`;
        return (
          <div key={pid} className={`ra-project-block${p.isVisible ? '' : ' hidden'}${drag?.list === 'projects' && drag.index === pi ? ' dragging' : ''}`}
            draggable {...dragHandlers('projects', pi)}>
            <div className="ra-project-head">
              <span className="ra-move-btns">
                <button disabled={pi === 0} onClick={() => moveProject(pi, -1)} title="Move project up"><i className="fas fa-chevron-up"></i></button>
                <button disabled={pi === projs.length - 1} onClick={() => moveProject(pi, 1)} title="Move project down"><i className="fas fa-chevron-down"></i></button>
              </span>
              <strong>{p.title}</strong>
              {p.matchScore != null && <span className={`ra-score-badge ra-score-${p.matchScore >= 70 ? 'high' : p.matchScore >= 40 ? 'medium' : 'low'}`}>{p.matchScore}</span>}
              {p.manuallyEdited && <span className="ra-edited-badge" title="Manually edited since generation">edited</span>}
              <div className="ra-section-actions">
                <button className="ra-icon-btn" disabled={!!busy[busyKey]} onClick={() => onGenerateSection('project', pid)}
                  title={p.items?.length ? 'Regenerate bullets' : 'Generate bullets'}>
                  <i className={`fas ${busy[busyKey] ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                </button>
                <button className="ra-icon-btn" disabled={!p.items?.length || !!busy[busyKey]}
                  onClick={() => setRefineTarget({ key: 'project', projectId: pid, label: p.title })}
                  title="Refine — repolish with your own instruction">
                  <i className="fas fa-broom"></i>
                </button>
                <button className="ra-icon-btn" onClick={() => toggleVisible('project', pid)} title={p.isVisible ? 'Hide from resume' : 'Show on resume'}>
                  <i className={`fas ${p.isVisible ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                </button>
                <button className="ra-icon-btn ra-icon-danger" onClick={() => removeProject(pid)} title="Remove project from this resume">
                  <i className="fas fa-xmark"></i>
                </button>
              </div>
            </div>
            {p.items?.length > 0 && (
              <div className="ra-overview-row">
                <span className="ra-overview-tag">Overview</span>
                <EditableText value={p.overview || ''} onCommit={t => editProjectOverview(pid, t)} className="ra-overview-text" />
              </div>
            )}
            {(p.items || []).map((item, i) => (
              <BulletRow key={i} item={item}
                onEdit={t => editBullet('project', pid, i, t)}
                onCycle={d => cycleVariant('project', pid, i, d)}
                onRegen={() => onRegenBullet('project', pid, i)}
                onToggleHide={() => toggleBulletHide('project', pid, i)}
                onMove={d => moveBullet('project', pid, i, d)} first={i === 0} last={i === p.items.length - 1}
                regenning={!!busy[`bullet:project:${pid}:${i}`]}
                dragging={drag?.list === `project:${pid}` && drag.index === i}
                dragHandlers={dragHandlers(`project:${pid}`, i)} />
            ))}
          </div>
        );
      });

      return (
        <>
          {projs.length ? projCards : <p className="ra-muted">No projects selected.</p>}
          <div className="ra-add-project">
            <button className="ra-secondary-btn ra-add-project-btn" disabled={!availableProjects.length || addingProject}
              onClick={() => setShowAddProject(s => !s)}>
              <i className={`fas ${addingProject ? 'fa-spinner fa-spin' : 'fa-plus'}`}></i>
              {availableProjects.length ? ` Add project (${availableProjects.length} available)` : ' All projects added'}
            </button>
            {showAddProject && availableProjects.length > 0 && (
              <div className="ra-add-project-list">
                {availableProjects.map(r => (
                  <button key={String(r.projectId)} className="ra-add-project-item" disabled={addingProject}
                    onClick={() => { setShowAddProject(false); onAddProject(String(r.projectId)); }}>
                    <span className={`ra-score-badge ra-score-${r.score >= 70 ? 'high' : r.score >= 40 ? 'medium' : 'low'}`}>{r.score}</span>
                    <span className="ra-add-project-title">{r.title}</span>
                    <i className="fas fa-plus"></i>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      );
    }

    if (key === 'experience') {
      const entries = resume.sections.experience?.entries || [];
      if (!entries.length) return <p className="ra-muted">Not generated yet.</p>;
      return entries.map((e, ei) => (
        <div key={ei} className={`ra-project-block${e.isVisible === false ? ' hidden' : ''}`}>
          <div className="ra-project-head">
            <span className="ra-move-btns">
              <button disabled={ei === 0} onClick={() => moveEntry(ei, -1)} title="Move up"><i className="fas fa-chevron-up"></i></button>
              <button disabled={ei === entries.length - 1} onClick={() => moveEntry(ei, 1)} title="Move down"><i className="fas fa-chevron-down"></i></button>
            </span>
            <strong>{e.heading}</strong>
            {e.subheading && <span className="ra-entry-sub">{e.subheading}</span>}
            <div className="ra-section-actions">
              <button className="ra-icon-btn" onClick={() => toggleEntryHide(ei)}
                title={e.isVisible === false ? 'Show on resume' : 'Hide from resume'}>
                <i className={`fas ${e.isVisible === false ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>
          {(e.items || []).map((item, i) => (
            <BulletRow key={i} item={item}
              onEdit={t => editBullet('experience', null, i, t, ei)}
              onCycle={d => cycleVariant('experience', null, i, d, ei)}
              onRegen={() => onRegenBullet('experience', null, i, ei)}
              onToggleHide={() => toggleBulletHide('experience', null, i, ei)}
              onMove={d => moveBullet('experience', null, i, d, ei)} first={i === 0} last={i === e.items.length - 1}
              regenning={!!busy[`bullet:experience:${ei}:${i}`]}
              dragging={false}
              dragHandlers={{}} />
          ))}
        </div>
      ));
    }

    const sec = resume.sections[key];
    if (!sec?.items?.length) return <p className="ra-muted">Not generated yet.</p>;
    return sec.items.map((item, i) => (
      <BulletRow key={i} item={item}
        onEdit={t => editBullet(key, null, i, t)}
        onCycle={d => cycleVariant(key, null, i, d)}
        onRegen={() => onRegenBullet(key, null, i)}
        onToggleHide={() => toggleBulletHide(key, null, i)}
        onMove={d => moveBullet(key, null, i, d)} first={i === 0} last={i === sec.items.length - 1}
        regenning={!!busy[`bullet:${key}::${i}`]}
        dragging={drag?.list === key && drag.index === i}
        dragHandlers={dragHandlers(key, i)} />
    ));
  };

  const nothingGenerated = !resume.sections.summary?.items?.length &&
    !resume.sections.skills?.matched?.length &&
    !(resume.sections.projects || []).some(p => p.items?.length);

  return (
    <div className="ra-editor-layout">
      <div className="ra-editor-form">
        <div className="ra-editor-toolbar">
          <button className="ra-primary-btn" onClick={onGenerateAll} disabled={Object.values(busy).some(Boolean)}>
            <i className="fas fa-wand-magic-sparkles"></i>
            {nothingGenerated ? 'Generate all sections' : 'Regenerate all sections'}
          </button>
          <button className="ra-secondary-btn" onClick={onCoherenceCheck} disabled={checkingCoherence || nothingGenerated}>
            <i className={`fas ${checkingCoherence ? 'fa-spinner fa-spin' : 'fa-list-check'}`}></i> Coherence check
          </button>
          <button className="ra-secondary-btn" onClick={rebuildMemory} disabled={reindexing}
            title="Re-embed your projects, experience & skills into the agent's RAG memory">
            <i className={`fas ${reindexing ? 'fa-spinner fa-spin' : 'fa-brain'}`}></i> Rebuild memory
          </button>
          <button className="ra-secondary-btn" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <i className="fas fa-rotate-left"></i> Undo
          </button>
          <button className="ra-secondary-btn" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
            <i className="fas fa-rotate-right"></i> Redo
          </button>
          <span className={`ra-save-indicator${saving ? ' saving' : ''}`}>
            <i className={`fas ${saving ? 'fa-cloud-arrow-up' : 'fa-check'}`}></i> {saving ? 'Saving…' : 'Saved'}
          </span>
          <button className="ra-icon-btn" onClick={() => setShowSettings(true)} title="Resume settings — template, colors, fonts, contact info">
            <i className="fas fa-gear"></i>
          </button>
          <button className="ra-primary-btn ra-export-cta" onClick={onProceedToExport} disabled={nothingGenerated}>
            <i className="fas fa-file-export"></i> Export
          </button>
        </div>

        {showSettings && (
          <SettingsModal resume={resume} profile={profile}
            onPrefChange={onPrefChange} onProfileUpdate={onProfileUpdate}
            onClose={() => setShowSettings(false)} />
        )}

        {refineTarget && (
          <RefineModal title={refineTarget.label} busy={refineBusy}
            onApply={runRefine} onCancel={() => setRefineTarget(null)} />
        )}

        {reindexMsg && <div className="ra-reindex-msg"><i className="fas fa-brain"></i> {reindexMsg}</div>}
        <ResearchPanel resume={resume} />
        <AtsGauge resume={resume} onApplyGap={applyGap} />
        <AtsParsePanel resume={resume} />

        {coherence?.length > 0 && (
          <div className="ra-coherence-panel">
            <h5><i className="fas fa-lightbulb"></i> Suggestions ({coherence.length})</h5>
            {coherence.map((s, i) => (
              <div key={i} className="ra-suggestion">
                <span className={`ra-suggestion-type type-${s.type?.split('-')[0]}`}>{s.type}</span>
                <span className="ra-suggestion-msg"><strong>{s.section}:</strong> {s.message}</span>
                <button className="ra-apply-btn" disabled={applying !== null}
                  onClick={async () => { setApplying(i); try { await onApplySuggestion(i); } finally { setApplying(null); } }}
                  title="Refine the named section(s) with this suggestion">
                  {applying === i ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-check"></i> Apply</>}
                </button>
                <button className="ra-chip-x" onClick={() => onDismissSuggestion(i)} title="Dismiss">×</button>
              </div>
            ))}
          </div>
        )}

        {SECTION_META.map(({ key, label, icon }) => {
          const sec = key === 'projects' ? null : resume.sections[key];
          const visible = key === 'projects' ? true : sec?.isVisible !== false;
          return (
            <div key={key} className={`ra-section-card${visible ? '' : ' hidden'}`}>
              <div className="ra-section-head">
                <h4><i className={`fas ${icon}`}></i> {label}</h4>
                {sec?.manuallyEdited && <span className="ra-edited-badge" title="Manually edited since generation">edited</span>}
                {key !== 'projects' && (
                  <div className="ra-section-actions">
                    <button className="ra-icon-btn" disabled={!!busy[key]} onClick={() => onGenerateSection(key)}
                      title="Generate (draft + refine)">
                      <i className={`fas ${busy[key] ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                    </button>
                    <button className="ra-icon-btn" disabled={!!busy[key]}
                      onClick={() => setRefineTarget({ key, projectId: null, label })}
                      title="Refine — repolish with your own instruction">
                      <i className="fas fa-broom"></i>
                    </button>
                    <button className="ra-icon-btn" onClick={() => toggleVisible(key)}
                      title={visible ? 'Hide from resume' : 'Show on resume'}>
                      <i className={`fas ${visible ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                    </button>
                  </div>
                )}
              </div>
              <div className="ra-section-body">{renderSectionBody(key)}</div>
            </div>
          );
        })}
      </div>

      <div className="ra-editor-preview">
        <div className="ra-preview-label">
          <span><i className="fas fa-eye"></i> Live preview</span>
          <button className="ra-secondary-btn ra-preview-expand" onClick={() => setShowPreview(true)}
            title="Open a larger preview">
            <i className="fas fa-up-right-and-down-left-from-center"></i> Enlarge
          </button>
        </div>
        <ResumePreview resume={resume} profile={profile} />
      </div>

      {showPreview && (
        <PreviewModal resume={resume} profile={profile} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}

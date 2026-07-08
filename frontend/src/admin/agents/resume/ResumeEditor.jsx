import { useState, useRef, useEffect } from 'react';
import ResumePreview from './ResumePreview.jsx';
import SettingsModal from './SettingsModal.jsx';

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

function AtsGauge({ resume }) {
  const [open, setOpen] = useState(false);
  const cov = computeAtsCoverage(resume);
  if (!cov) return null;
  const level = cov.pct >= 75 ? 'high' : cov.pct >= 45 ? 'medium' : 'low';
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
              <h5><i className="fas fa-circle-exclamation"></i> Missing from resume</h5>
              <div className="ra-chip-row">{cov.missing.map((k, i) => <span key={i} className="ra-chip ra-chip-missing">{k}</span>)}</div>
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
        {total > 1 && (
          <div className="ra-variant-switch">
            <button onClick={() => onCycle(-1)} title="Previous phrasing"><i className="fas fa-chevron-left"></i></button>
            <span>{(item.selectedVariant ?? 0) + 1}/{total}</span>
            <button onClick={() => onCycle(1)} title="Next phrasing"><i className="fas fa-chevron-right"></i></button>
          </div>
        )}
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
                <button className="ra-icon-btn" disabled={!p.items?.length || !!busy[busyKey]} onClick={() => onRefineSection('project', pid)} title="Refine (ATS polish pass)">
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

        <AtsGauge resume={resume} />

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
                    <button className="ra-icon-btn" disabled={!!busy[key]} onClick={() => onRefineSection(key)}
                      title="Refine — re-polish for ATS keywords, bullet strength, conciseness">
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
        <div className="ra-preview-label"><i className="fas fa-eye"></i> Live preview</div>
        <ResumePreview resume={resume} profile={profile} />
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../../api/axios.js';
import IntakeForm from './IntakeForm.jsx';
import ProjectRanking from './ProjectRanking.jsx';
import ResumeEditor from './ResumeEditor.jsx';
import ExportPanel from './ExportPanel.jsx';

const STEPS = [
  { id: 'intake', label: 'Intake', icon: 'fa-keyboard' },
  { id: 'rank', label: 'Research & projects', icon: 'fa-magnifying-glass-chart' },
  { id: 'edit', label: 'Editor', icon: 'fa-pen-ruler' },
  { id: 'export', label: 'Export', icon: 'fa-file-export' },
];

const UNDO_LIMIT = 20;
const AUTOSAVE_MS = 1200;

const stepForStatus = (status) => {
  if (status === 'intake' || status === 'researched') return 'rank';
  if (status === 'ranked') return 'rank';
  return 'edit';
};

export default function ResumeGenerator() {
  const [step, setStep] = useState('list');
  // Steps the user has already reached this session — once visited, always reachable
  // via the stepper in either direction (not just backward from the current step).
  const [visitedSteps, setVisitedSteps] = useState(() => new Set());
  const [resumes, setResumes] = useState([]);
  const [resume, setResume] = useState(null);
  const [meta, setMeta] = useState(null);
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState({});
  const [loading, setLoading] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coherence, setCoherence] = useState([]);
  const [checkingCoherence, setCheckingCoherence] = useState(false);
  const [addingProject, setAddingProject] = useState(false);
  const [error, setError] = useState('');

  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const saveTimer = useRef(null);
  const resumeRef = useRef(null);
  resumeRef.current = resume;

  useEffect(() => {
    api.get('/profile').then(r => setProfile(r.data)).catch(() => {});
    loadList();
  }, []);

  // Portfolio-wide profile (email/phone/links) is shared across the whole site, so this
  // updates it directly via the profile API rather than through the resume's own autosave.
  const updateProfile = async (patch) => {
    const { data } = await api.put('/profile', { ...profile, ...patch });
    setProfile(data);
    return data;
  };

  const loadList = () => api.get('/resume-agent').then(r => setResumes(r.data)).catch(() => {});

  // Navigate to a step and remember it as visited, so the stepper can jump back to it
  // AND forward to it again later — clicking "Research & projects" from the editor no
  // longer strands you unable to return.
  const goToStep = (id) => {
    setStep(id);
    setVisitedSteps(prev => new Set(prev).add(id));
  };

  const fail = (err) => setError(err.response?.data?.error || err.message);

  const setBusyKey = (key, val) => setBusy(b => ({ ...b, [key]: val }));

  // ---------- autosave + undo ----------

  const scheduleSave = useCallback(() => {
    setSaving(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const r = resumeRef.current;
      if (!r?._id) return setSaving(false);
      try {
        await api.patch(`/resume-agent/${r._id}`, { sections: r.sections, sectionOrder: r.sectionOrder });
      } catch (err) {
        fail(err);
      } finally {
        setSaving(false);
      }
    }, AUTOSAVE_MS);
  }, []);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  // Local mutation with undo snapshot + debounced autosave — no save button anywhere
  const mutate = useCallback((fn) => {
    setResume(prev => {
      if (!prev) return prev;
      undoStack.current.push(structuredClone(prev.sections));
      if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
      redoStack.current = []; // a fresh edit invalidates the redo branch
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    scheduleSave();
  }, [scheduleSave]);

  const undo = useCallback(() => {
    const prevSections = undoStack.current.pop();
    if (!prevSections) return;
    setResume(r => {
      redoStack.current.push(structuredClone(r.sections));
      return { ...r, sections: prevSections };
    });
    scheduleSave();
  }, [scheduleSave]);

  const redo = useCallback(() => {
    const nextSections = redoStack.current.pop();
    if (!nextSections) return;
    setResume(r => {
      undoStack.current.push(structuredClone(r.sections));
      return { ...r, sections: nextSections };
    });
    scheduleSave();
  }, [scheduleSave]);

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || step !== 'edit') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return; // let native undo work in fields
      const key = e.key.toLowerCase();
      if (key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      else if (key === 'z') { e.preventDefault(); undo(); }
      else if (key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, step]);

  // Merge only one section from a server response, so parallel generations don't clobber each other
  const mergeSection = (serverResume, key, projectId) => {
    setResume(prev => {
      if (!prev) return serverResume;
      const next = structuredClone(prev);
      if (key === 'project') {
        const fresh = serverResume.sections.projects.find(p => String(p.projectId) === String(projectId));
        const idx = next.sections.projects.findIndex(p => String(p.projectId) === String(projectId));
        if (fresh && idx !== -1) next.sections.projects[idx] = fresh;
      } else {
        next.sections[key] = serverResume.sections[key];
      }
      next.status = serverResume.status;
      return next;
    });
  };

  // ---------- flow actions ----------

  // Auto-chain: intake → rank runs immediately, no extra click
  const handleIntake = async (payload) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/resume-agent/intake', payload);
      setResume(data.resume);
      setMeta(data.meta);
      undoStack.current = [];
      redoStack.current = [];
      setVisitedSteps(new Set(['rank']));
      goToStep('rank');
      loadList();
      handleRank(data.resume._id);
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRank = async (id = resumeRef.current?._id) => {
    setRanking(true);
    setError('');
    try {
      const { data } = await api.post(`/resume-agent/${id}/rank-projects`);
      setResume(data);
    } catch (err) {
      fail(err);
    } finally {
      setRanking(false);
    }
  };

  const generateSection = async (key, projectId = null, id = resumeRef.current?._id) => {
    const busyKey = key === 'project' ? `project:${projectId}` : key;
    setBusyKey(busyKey, true);
    setError('');
    try {
      const url = key === 'project'
        ? `/resume-agent/${id}/generate/project/${projectId}`
        : `/resume-agent/${id}/generate/${key}`;
      const { data } = await api.post(url);
      mergeSection(data, key, projectId);
    } catch (err) {
      fail(err);
    } finally {
      setBusyKey(busyKey, false);
    }
  };

  // Fire every section in parallel — endpoints are independent by design
  const generateAllFor = (resumeDoc) => {
    const jobs = ['summary', 'skills', 'experience', 'achievements', 'education']
      .map(k => generateSection(k, null, resumeDoc._id));
    (resumeDoc.sections.projects || []).forEach(p => jobs.push(generateSection('project', String(p.projectId), resumeDoc._id)));
    return Promise.allSettled(jobs);
  };
  const generateAll = () => generateAllFor(resumeRef.current);

  // Auto-chain: confirming projects lands in the editor with every section already generating
  const handleConfirmProjects = async (projectIds) => {
    setConfirming(true);
    setError('');
    try {
      const { data } = await api.post(`/resume-agent/${resume._id}/select-projects`, { projectIds });
      setResume(data);
      goToStep('edit');
      const nothingGenerated = !data.sections.summary?.items?.length && !data.sections.skills?.matched?.length;
      if (nothingGenerated) generateAllFor(data);
    } catch (err) {
      fail(err);
    } finally {
      setConfirming(false);
    }
  };

  const refineSection = async (key, projectId = null, instruction = '') => {
    const busyKey = key === 'project' ? `project:${projectId}` : key;
    setBusyKey(busyKey, true);
    setError('');
    try {
      const { data } = await api.post(`/resume-agent/${resumeRef.current._id}/refine/${key}`, {
        ...(projectId ? { projectId } : {}),
        ...(instruction ? { instruction } : {})
      });
      mergeSection(data, key, projectId);
    } catch (err) {
      fail(err);
    } finally {
      setBusyKey(busyKey, false);
    }
  };

  // Turn a coherence suggestion into targeted refine calls on the sections it names
  const applySuggestion = async (index) => {
    const s = coherence[index];
    if (!s) return;
    const named = (s.section || '').toLowerCase();
    const jobs = [];
    ['summary', 'skills', 'experience', 'achievements', 'education'].forEach(k => {
      if (named.includes(k)) jobs.push(refineSection(k, null, s.message));
    });
    if (named.includes('project')) {
      (resumeRef.current.sections.projects || []).filter(p => p.isVisible && p.items?.length)
        .forEach(p => jobs.push(refineSection('project', String(p.projectId), s.message)));
    }
    if (!jobs.length) {
      // couldn't map the section name — apply as a global hint to the summary
      jobs.push(refineSection('summary', null, s.message));
    }
    await Promise.allSettled(jobs);
    setCoherence(c => c.filter((_, j) => j !== index));
  };

  const regenBullet = async (key, projectId, itemIndex, entryIndex = null) => {
    const busyKey = key === 'experience'
      ? `bullet:experience:${entryIndex}:${itemIndex}`
      : `bullet:${key}:${projectId || ''}:${itemIndex}`;
    setBusyKey(busyKey, true);
    setError('');
    try {
      const { data } = await api.post(`/resume-agent/${resumeRef.current._id}/regenerate-bullet`,
        { section: key, projectId, itemIndex, ...(entryIndex != null ? { entryIndex } : {}) });
      setResume(prev => {
        const next = structuredClone(prev);
        const sec = key === 'project'
          ? next.sections.projects.find(p => String(p.projectId) === String(projectId))
          : next.sections[key];
        const list = key === 'experience' ? sec?.entries?.[entryIndex]?.items : sec?.items;
        if (list?.[itemIndex]) list[itemIndex] = data.item;
        if (key === 'summary' && sec) sec.content = data.item.text;
        return next;
      });
    } catch (err) {
      fail(err);
    } finally {
      setBusyKey(busyKey, false);
    }
  };

  const coherenceCheck = async () => {
    setCheckingCoherence(true);
    setError('');
    try {
      const { data } = await api.post(`/resume-agent/${resume._id}/coherence-check`);
      setCoherence(data.suggestions || []);
    } catch (err) {
      fail(err);
    } finally {
      setCheckingCoherence(false);
    }
  };

  // Template / density change — persist immediately (affects only rendering, not undo history)
  const changePrefs = async (patch) => {
    const next = { ...resumeRef.current.preferences, ...patch };
    setResume(r => ({ ...r, preferences: next }));
    try {
      await api.patch(`/resume-agent/${resumeRef.current._id}`, { preferences: next });
    } catch (err) {
      fail(err);
    }
  };

  // Add another ranked project into the editor without going back a step
  const addProject = async (projectId) => {
    setAddingProject(true);
    setError('');
    try {
      const r = resumeRef.current;
      // flush pending local edits so select-projects rebuilds from the current state
      await api.patch(`/resume-agent/${r._id}`, { sections: r.sections, sectionOrder: r.sectionOrder });
      const ids = [...(r.sections.projects || []).map(p => String(p.projectId)), projectId];
      const { data } = await api.post(`/resume-agent/${r._id}/select-projects`, { projectIds: ids });
      setResume(data);
      await generateSection('project', projectId, data._id);
    } catch (err) {
      fail(err);
    } finally {
      setAddingProject(false);
    }
  };

  const openResume = async (id) => {
    setError('');
    try {
      const { data } = await api.get(`/resume-agent/${id}`);
      setResume(data);
      setMeta(null);
      undoStack.current = [];
      redoStack.current = [];
      setCoherence([]);
      const target = stepForStatus(data.status);
      const targetIdx = STEPS.findIndex(s => s.id === target);
      setVisitedSteps(new Set(STEPS.slice(0, targetIdx + 1).map(s => s.id)));
      setStep(target);
    } catch (err) {
      fail(err);
    }
  };

  const deleteResume = async (id) => {
    try {
      await api.delete(`/resume-agent/${id}`);
      loadList();
    } catch (err) {
      fail(err);
    }
  };

  const stepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <div className="ra-wrap">
      <div className="ra-header">
        <div>
          <h3><i className="fas fa-file-invoice"></i> Resume Generator</h3>
          <p className="ra-muted">Company-tailored, ATS-optimized resumes built from your portfolio data.</p>
        </div>
        {step !== 'list' && (
          <button className="ra-secondary-btn" onClick={() => { setStep('list'); setResume(null); setVisitedSteps(new Set()); loadList(); }}>
            <i className="fas fa-list"></i> My resumes
          </button>
        )}
      </div>

      {step !== 'list' && (
        <div className="ra-stepper">
          {STEPS.map((s, i) => {
            // Any step reached this session stays clickable in BOTH directions —
            // jumping to "Research & projects" from the editor no longer strands you.
            const reachable = visitedSteps.has(s.id) && resume && s.id !== 'intake';
            return (
              <div key={s.id}
                className={`ra-step${i === stepIndex ? ' active' : ''}${i < stepIndex ? ' done' : ''}${reachable ? ' reachable' : ''}`}
                onClick={() => { if (reachable) setStep(s.id); }}>
                <span className="ra-step-dot"><i className={`fas ${i < stepIndex ? 'fa-check' : s.icon}`}></i></span>
                <span className="ra-step-label">{s.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="ra-error-banner">
          <i className="fas fa-triangle-exclamation"></i> {error}
          <button className="ra-chip-x" onClick={() => setError('')}>×</button>
        </div>
      )}

      {step === 'list' && (
        <div className="ra-list">
          <button className="ra-primary-btn" onClick={() => { setResume(null); setVisitedSteps(new Set()); setStep('intake'); }}>
            <i className="fas fa-plus"></i> New tailored resume
          </button>
          {resumes.length === 0 ? (
            <p className="ra-muted ra-center-block">No resumes yet — create your first tailored resume.</p>
          ) : (
            resumes.map(r => (
              <div key={r._id} className="ra-list-row" onClick={() => openResume(r._id)}>
                <div className="ra-list-main">
                  <strong>{r.company}</strong>
                  <span>{r.roleTitle}</span>
                </div>
                <span className={`ra-status-badge status-${r.status}`}>{r.status}</span>
                <span className="ra-muted">{new Date(r.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <button className="ra-icon-btn" title="Delete"
                  onClick={e => { e.stopPropagation(); deleteResume(r._id); }}>
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {step === 'intake' && <IntakeForm onSubmit={handleIntake} loading={loading} />}

      {step === 'rank' && resume && (
        <ProjectRanking resume={resume} meta={meta}
          onRank={() => handleRank()} onConfirm={handleConfirmProjects}
          ranking={ranking} confirming={confirming} />
      )}

      {step === 'edit' && resume && (
        <ResumeEditor
          resume={resume} profile={profile} busy={busy} saving={saving}
          onGenerateSection={generateSection} onGenerateAll={generateAll}
          onRefineSection={refineSection} onRegenBullet={regenBullet}
          mutate={mutate}
          coherence={coherence} onCoherenceCheck={coherenceCheck}
          onDismissSuggestion={i => setCoherence(c => c.filter((_, j) => j !== i))}
          onApplySuggestion={applySuggestion}
          checkingCoherence={checkingCoherence}
          canUndo={undoStack.current.length > 0} onUndo={undo}
          canRedo={redoStack.current.length > 0} onRedo={redo}
          onPrefChange={changePrefs} onAddProject={addProject} addingProject={addingProject}
          onProceedToExport={() => goToStep('export')}
          onProfileUpdate={updateProfile} />
      )}

      {step === 'export' && resume && (
        <ExportPanel resume={resume} onBack={() => setStep('edit')}
          onResumeUpdate={setResume} />
      )}
    </div>
  );
}

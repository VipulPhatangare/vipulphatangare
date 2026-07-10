import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios.js';

// ── Meta ─────────────────────────────────────────────────
const SOURCE_META = {
  kv:     { label: 'Saved detail', icon: 'fa-database',   color: '#22c55e' },
  rag:    { label: 'AI (resume)',  icon: 'fa-robot',      color: '#a78bfa' },
  file:   { label: 'File',         icon: 'fa-paperclip',  color: '#38bdf8' },
  manual: { label: 'Manual',       icon: 'fa-pen',        color: '#f59e0b' }
};

const STATUS_META = {
  new:       { label: 'New',        color: '#94a3b8' },
  extracted: { label: 'Read',       color: '#38bdf8' },
  mapped:    { label: 'Filled',     color: '#a78bfa' },
  reviewed:  { label: 'Approved',   color: '#22c55e' },
  submitted: { label: 'Submitted',  color: '#10b981' },
  failed:    { label: 'Failed',     color: '#ef4444' }
};

function confColor(c) {
  if (c >= 0.8) return '#22c55e';
  if (c >= 0.55) return '#f59e0b';
  return '#ef4444';
}

// ── Field editor ─────────────────────────────────────────
function FieldRow({ field, index, onSave, saving }) {
  const [value, setValue] = useState(field.answer ?? '');
  useEffect(() => { setValue(field.answer ?? ''); }, [field.answer]);

  const src  = SOURCE_META[field.source] || SOURCE_META.manual;
  // Only required unresolved fields get the alarming amber; optional blanks are calm.
  const flagged = field.status === 'needs_review' && field.required;

  const commit = (v) => { if (v !== field.answer) onSave(index, v); };

  const renderInput = () => {
    if (field.type === 'file_upload')
      return <input className="aa-input" value={value} readOnly title="Set in the doc map (Phase 4)" />;
    if (field.type === 'paragraph')
      return <textarea className="aa-input aa-textarea" rows={4} value={value}
               onChange={e => setValue(e.target.value)} onBlur={e => commit(e.target.value)} />;
    if (field.type === 'multiple_choice' || field.type === 'dropdown')
      return (
        <select className="aa-input" value={value} onChange={e => { setValue(e.target.value); commit(e.target.value); }}>
          <option value="">— select —</option>
          {field.options.map((o, i) => <option key={i} value={o}>{o}</option>)}
        </select>
      );
    if (field.type === 'checkboxes') {
      const arr = Array.isArray(value) ? value : (value ? String(value).split(', ') : []);
      const toggle = (o) => {
        const next = arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o];
        setValue(next); commit(next);
      };
      return (
        <div className="aa-checkgroup">
          {field.options.map((o, i) => (
            <label key={i} className="aa-check">
              <input type="checkbox" checked={arr.includes(o)} onChange={() => toggle(o)} /> {o}
            </label>
          ))}
        </div>
      );
    }
    const inputType = field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text';
    return <input className="aa-input" type={inputType} value={value}
             onChange={e => setValue(e.target.value)} onBlur={e => commit(e.target.value)} />;
  };

  return (
    <div className={`aa-field${flagged ? ' aa-field-flagged' : ''}`}>
      <div className="aa-field-head">
        <span className="aa-field-q">
          {field.text || <em>(untitled)</em>}
          {field.required && <span className="aa-req" title="Required">*</span>}
        </span>
        <div className="aa-field-tags">
          <span className="aa-src" style={{ '--src': src.color }}>
            <i className={`fas ${src.icon}`}></i> {src.label}
          </span>
          <span className="aa-conf" title="Confidence">
            <span className="aa-conf-bar"><span className="aa-conf-fill"
              style={{ width: `${Math.round((field.confidence || 0) * 100)}%`, background: confColor(field.confidence || 0) }} /></span>
            {Math.round((field.confidence || 0) * 100)}%
          </span>
        </div>
      </div>
      {renderInput()}
      {field.note && (
        <div className={`aa-note${flagged ? ' aa-note-warn' : ''}`}>
          <i className={`fas ${flagged ? 'fa-triangle-exclamation' : 'fa-circle-info'}`}></i> {field.note}
        </div>
      )}
      {saving === index && <span className="aa-saving"><i className="fas fa-spinner fa-spin"></i> saving…</span>}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function AutoApply() {
  const [postings, setPostings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [run, setRun]           = useState(null);
  const [mapping, setMapping]   = useState(false);
  const [saving, setSaving]     = useState(null);
  const [approving, setApproving] = useState(false);
  const [filling, setFilling]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(null);
  const [toast, setToast]       = useState(null);

  const flash = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };

  const loadPostings = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get('/jobpostings'); setPostings(data); }
    catch { flash('error', 'Could not load job postings.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPostings(); }, [loadPostings]);

  useEffect(() => {
    api.get('/formruns/session/status').then(({ data }) => setSessionSaved(data.hasSession)).catch(() => {});
  }, []);

  const selectPosting = async (p) => {
    setSelected(p); setRun(null);
    try { const { data } = await api.get(`/formruns/by-posting/${p._id}`); setRun(data); }
    catch { /* no run yet — that's fine */ }
  };

  const runMap = async () => {
    if (!selected) return;
    setMapping(true);
    try {
      const { data } = await api.post(`/jobpostings/${selected._id}/map`);
      setRun(data);
      loadPostings();
      flash('success', 'Form filled from your details — review below.');
    } catch (err) {
      flash('error', err.response?.data?.error || 'Could not fill the form.');
    } finally { setMapping(false); }
  };

  const saveField = async (index, answer) => {
    setSaving(index);
    try { const { data } = await api.patch(`/formruns/${run._id}/field`, { index, answer }); setRun(data); }
    catch { flash('error', 'Could not save field.'); }
    finally { setSaving(null); }
  };

  const approve = async () => {
    setApproving(true);
    try {
      const { data } = await api.post(`/formruns/${run._id}/review`);
      setRun(data); loadPostings();
      flash('success', 'Approved. Submission will run through the browser agent in Phase 4.');
    } catch (err) {
      flash('error', err.response?.data?.error || 'Some fields still need review.');
    } finally { setApproving(false); }
  };

  const fillBrowser = async () => {
    setFilling(true);
    try {
      const { data } = await api.post(`/formruns/${run._id}/fill`);
      setRun(data.run);
      flash('success', `Filled ${data.filled}/${data.total} fields in the browser — preview below.`);
    } catch (err) {
      const d = err.response?.data;
      if (d?.run) setRun(d.run);
      flash('error', d?.error || 'Browser fill failed.');
    } finally { setFilling(false); }
  };

  const submitForm = async () => {
    if (!window.confirm('Submit this form for real? This sends your responses to the form owner.')) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/formruns/${run._id}/submit`);
      setRun(data.run); loadPostings();
      flash('success', 'Form submitted successfully. ✅');
    } catch (err) {
      const d = err.response?.data;
      if (d?.run) setRun(d.run);
      flash('error', d?.error || 'Submission failed — check the details.');
    } finally { setSubmitting(false); }
  };

  const needsReview = run ? run.fields.filter(f => f.status === 'needs_review') : [];
  const blocking = needsReview.filter(f => f.required).length;   // required → blocks approval
  const optionalPending = needsReview.length - blocking;          // optional → informational
  const okCount = run ? run.fields.length - needsReview.length : 0;
  const pending = blocking; // approval gate

  return (
    <div className="aa-wrap">
      {toast && <div className={`aa-toast aa-toast-${toast.type}`}>{toast.msg}</div>}

      <div className="aa-header">
        <h2><i className="fas fa-wand-magic-sparkles"></i> Auto-Apply</h2>
        <p>Fill TNP forms from your saved details and resume. Every field is staged for your review — nothing submits automatically.</p>
      </div>

      <div className="aa-grid">
        {/* Postings list */}
        <div className="aa-list">
          <div className="aa-list-head">
            <span>Job Postings</span>
            <button className="btn-secondary-sm" onClick={loadPostings}><i className="fas fa-rotate"></i></button>
          </div>
          {loading ? (
            <div className="aa-empty"><i className="fas fa-spinner fa-spin"></i> Loading…</div>
          ) : postings.length === 0 ? (
            <div className="aa-empty">No forms staged yet. Open a TNP mail with a Google Form and click <b>Apply</b>.</div>
          ) : postings.map(p => {
            const st = STATUS_META[p.status] || STATUS_META.new;
            return (
              <button key={p._id} className={`aa-post${selected?._id === p._id ? ' active' : ''}`} onClick={() => selectPosting(p)}>
                <div className="aa-post-title">{p.company || p.subject || 'Untitled form'}</div>
                <div className="aa-post-meta">
                  <span className="aa-post-status" style={{ '--st': st.color }}>{st.label}</span>
                  {p.deadline && <span><i className="fas fa-clock"></i> {new Date(p.deadline).toLocaleDateString('en-IN')}</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Review panel */}
        <div className="aa-panel">
          {!selected ? (
            <div className="aa-empty aa-empty-lg"><i className="fas fa-hand-pointer"></i> Select a posting to review its form.</div>
          ) : (
            <>
              <div className="aa-panel-head">
                <div>
                  <h3>{run?.formTitle || selected.subject || 'Form'}</h3>
                  {selected.formUrl && (
                    <a href={selected.formUrl} target="_blank" rel="noreferrer" className="aa-form-link">
                      <i className="fas fa-up-right-from-square"></i> Open the form
                    </a>
                  )}
                </div>
                <button className="btn-primary-sm aa-fill-btn" onClick={runMap} disabled={mapping}>
                  {mapping ? <><i className="fas fa-spinner fa-spin"></i> Filling…</>
                    : run ? <><i className="fas fa-rotate"></i> Re-fill</> : <><i className="fas fa-wand-magic-sparkles"></i> Fill form</>}
                </button>
              </div>

              {!run ? (
                <div className="aa-empty aa-empty-lg">
                  <i className="fas fa-list-check"></i>
                  Click <b>Fill form</b> to map this form's questions to your details.
                </div>
              ) : (
                <>
                  <div className="aa-summary">
                    <span className="aa-summary-ok"><i className="fas fa-check"></i> {okCount} ready</span>
                    {blocking > 0 && <span className="aa-summary-rev"><i className="fas fa-triangle-exclamation"></i> {blocking} required need review</span>}
                    {optionalPending > 0 && <span className="aa-summary-opt"><i className="fas fa-circle-info"></i> {optionalPending} optional blank</span>}
                  </div>

                  <div className="aa-fields">
                    {run.fields.map((f, i) => (
                      <FieldRow key={i} field={f} index={i} onSave={saveField} saving={saving} />
                    ))}
                  </div>

                  <div className="aa-footer">
                    <div className="aa-footer-note">
                      <i className="fas fa-shield-halved"></i>
                      {run.status === 'reviewed'
                        ? 'Approved — ready for the browser agent.'
                        : blocking > 0
                          ? `Resolve ${blocking} required field${blocking > 1 ? 's' : ''} to enable approval.`
                          : 'Required fields look good. Optional blanks are fine — approving stages this for submission.'}
                    </div>
                    <button className="btn-primary-sm aa-approve" onClick={approve}
                            disabled={approving || pending > 0 || run.status === 'reviewed' || run.status === 'submitted'}>
                      {run.status === 'reviewed' || run.status === 'submitted'
                        ? <><i className="fas fa-check-double"></i> Approved</>
                        : approving ? <><i className="fas fa-spinner fa-spin"></i> Approving…</>
                          : <><i className="fas fa-check"></i> Approve for submission</>}
                    </button>
                  </div>

                  {/* Browser fill / submit */}
                  <div className="aa-browser">
                    <div className="aa-browser-head">
                      <span><i className="fas fa-window-maximize"></i> Browser Agent</span>
                      <span className={`aa-session${sessionSaved ? ' on' : ''}`}>
                        <i className={`fas ${sessionSaved ? 'fa-user-check' : 'fa-user-slash'}`}></i>
                        {sessionSaved ? 'Google session saved' : 'No saved session'}
                      </span>
                    </div>
                    <p className="aa-browser-hint">
                      Fills the real form in a headless browser and screenshots it so you can verify before submitting.
                      {!sessionSaved && ' Sign-in-gated forms need a session — run '}
                      {!sessionSaved && <code>node scripts/formLogin.js</code>}
                      {!sessionSaved && ' once.'}
                    </p>

                    <div className="aa-browser-actions">
                      <button className="btn-secondary-sm" onClick={fillBrowser} disabled={filling || submitting}>
                        {filling ? <><i className="fas fa-spinner fa-spin"></i> Filling in browser…</>
                          : <><i className="fas fa-window-restore"></i> Fill in browser (preview)</>}
                      </button>
                      <button className="btn-primary-sm aa-submit-real" onClick={submitForm}
                              disabled={submitting || filling || run.status !== 'reviewed'}
                              title={run.status !== 'reviewed' ? 'Approve the fields first' : 'Submit for real'}>
                        {run.status === 'submitted'
                          ? <><i className="fas fa-circle-check"></i> Submitted</>
                          : submitting ? <><i className="fas fa-spinner fa-spin"></i> Submitting…</>
                            : <><i className="fas fa-paper-plane"></i> Submit for real</>}
                      </button>
                    </div>

                    {run.error && <div className="aa-note aa-note-warn"><i className="fas fa-triangle-exclamation"></i> {run.error}</div>}
                    {run.warnings?.length > 0 && (
                      <ul className="aa-warnings">
                        {run.warnings.map((w, i) => <li key={i}><i className="fas fa-circle-exclamation"></i> {w}</li>)}
                      </ul>
                    )}

                    {run.screenshotPath && (
                      <div className="aa-shot">
                        <div className="aa-shot-label">
                          <i className="fas fa-camera"></i> {run.status === 'submitted' ? 'Confirmation' : 'Filled preview'}
                          <a href={run.screenshotPath} target="_blank" rel="noreferrer">open full size</a>
                        </div>
                        <img src={run.screenshotPath} alt="Filled form preview" />
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

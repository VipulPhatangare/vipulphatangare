import { useState, useEffect, useRef } from 'react';
import api from '../../../api/axios.js';
import ConfirmModal from '../../ConfirmModal.jsx';

export default function ExportPanel({ resume, onBack, onResumeUpdate }) {
  const [tab, setTab] = useState('resume'); // resume | coverletter
  const [format, setFormat] = useState('pdf');
  const [exporting, setExporting] = useState(false);
  const [generatingCl, setGeneratingCl] = useState(false);
  const [clDraft, setClDraft] = useState(resume.coverLetter?.content || '');
  const [clSaving, setClSaving] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const clSaveTimer = useRef(null);

  const loadHistory = async () => {
    try {
      const { data } = await api.get('/resume-agent/exports');
      setHistory(data);
    } catch { /* non-fatal */ }
  };

  useEffect(() => { loadHistory(); }, []);
  useEffect(() => () => clearTimeout(clSaveTimer.current), []);

  const download = async (exportId, filename) => {
    const res = await api.get(`/resume-agent/exports/${exportId}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteExport = async () => {
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.delete(`/resume-agent/exports/${id}`);
      setHistory(h => h.filter(x => x._id !== id));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      const { data } = await api.post(`/resume-agent/${resume._id}/export`, { format, kind: tab });
      await download(data.export._id, data.export.filePath.split('/').pop());
      loadHistory();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setExporting(false);
    }
  };

  const generateCoverLetter = async () => {
    setGeneratingCl(true);
    setError('');
    try {
      const { data } = await api.post(`/resume-agent/${resume._id}/cover-letter`);
      setClDraft(data.coverLetter?.content || '');
      onResumeUpdate?.(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setGeneratingCl(false);
    }
  };

  // Autosave manual cover letter edits (debounced), same no-save-button philosophy as the editor
  const onClEdit = (text) => {
    setClDraft(text);
    setClSaving(true);
    clearTimeout(clSaveTimer.current);
    clSaveTimer.current = setTimeout(async () => {
      try {
        const coverLetter = { ...(resume.coverLetter || {}), content: text, manuallyEdited: true };
        const { data } = await api.patch(`/resume-agent/${resume._id}`, { coverLetter });
        onResumeUpdate?.(data);
      } catch (err) {
        setError(err.response?.data?.error || err.message);
      } finally {
        setClSaving(false);
      }
    }, 1200);
  };

  const canExport = tab === 'resume' || clDraft.trim().length > 0;

  return (
    <div className="ra-export">
      <button className="ra-secondary-btn" onClick={onBack}>
        <i className="fas fa-arrow-left"></i> Back to editor
      </button>

      <div className="ra-toggle-group ra-export-tabs">
        <button className={tab === 'resume' ? 'active' : ''} onClick={() => setTab('resume')}>
          <i className="fas fa-file-invoice"></i> Resume
        </button>
        <button className={tab === 'coverletter' ? 'active' : ''} onClick={() => setTab('coverletter')}>
          <i className="fas fa-envelope-open-text"></i> Cover letter
        </button>
      </div>

      {tab === 'coverletter' && (
        <div className="ra-export-card">
          <h4>
            <i className="fas fa-envelope-open-text"></i> Cover letter — {resume.company}
            {resume.coverLetter?.manuallyEdited && <span className="ra-edited-badge">edited</span>}
            {clDraft && (
              <span className={`ra-save-indicator${clSaving ? ' saving' : ''}`} style={{ marginLeft: 'auto' }}>
                <i className={`fas ${clSaving ? 'fa-cloud-arrow-up' : 'fa-check'}`}></i> {clSaving ? 'Saving…' : 'Saved'}
              </span>
            )}
          </h4>
          {clDraft ? (
            <>
              <textarea className="ra-cl-textarea" rows={16} value={clDraft} onChange={e => onClEdit(e.target.value)} />
              <button className="ra-secondary-btn" onClick={generateCoverLetter} disabled={generatingCl}>
                <i className={`fas ${generatingCl ? 'fa-spinner fa-spin' : 'fa-rotate'}`}></i> Regenerate
              </button>
            </>
          ) : (
            <button className="ra-primary-btn" onClick={generateCoverLetter} disabled={generatingCl}>
              {generatingCl ? (<><i className="fas fa-spinner fa-spin"></i> Writing cover letter…</>)
                            : (<><i className="fas fa-wand-magic-sparkles"></i> Generate cover letter</>)}
            </button>
          )}
        </div>
      )}

      <div className="ra-export-card">
        <h4><i className="fas fa-file-export"></i> Export {tab === 'coverletter' ? 'cover letter' : `"${resume.company} — ${resume.roleTitle}"`}</h4>
        <div className="ra-toggle-group">
          <button className={format === 'pdf' ? 'active' : ''} onClick={() => setFormat('pdf')}>
            <i className="fas fa-file-pdf"></i> PDF
          </button>
          <button className={format === 'txt' ? 'active' : ''} onClick={() => setFormat('txt')}>
            <i className="fas fa-file-lines"></i> Plain text (ATS-safe)
          </button>
        </div>
        <button className="ra-primary-btn" onClick={handleExport} disabled={exporting || !canExport}>
          {exporting ? (<><i className="fas fa-spinner fa-spin"></i> Rendering…</>)
                     : (<><i className="fas fa-download"></i> Export & download</>)}
        </button>
        {!canExport && <p className="ra-muted">Generate the cover letter first.</p>}
        {error && <p className="ra-error">{error}</p>}
      </div>

      <div className="ra-export-history">
        <h4><i className="fas fa-clock-rotate-left"></i> Export history</h4>
        {history.length === 0 ? (
          <p className="ra-muted">No exports yet.</p>
        ) : (
          history.map(h => (
            <div key={h._id} className="ra-history-row">
              <i className={`fas ${h.kind === 'coverletter' ? 'fa-envelope-open-text' : h.format === 'pdf' ? 'fa-file-pdf' : 'fa-file-lines'}`}></i>
              <div className="ra-history-meta">
                <strong>{h.company}{h.kind === 'coverletter' ? ' — cover letter' : ''}</strong>
                <span>{h.roleTitle}</span>
                <span className="ra-muted">
                  {new Date(h.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {' · '}{h.format.toUpperCase()}{' · '}JD {String(h.jdHash).slice(0, 8)}
                </span>
              </div>
              <button className="ra-icon-btn" onClick={() => download(h._id, h.filePath.split('/').pop())} title="Download">
                <i className="fas fa-download"></i>
              </button>
              <button className="ra-icon-btn ra-icon-danger" onClick={() => setDeleteTarget(h._id)} title="Delete this export">
                <i className="fas fa-trash"></i>
              </button>
            </div>
          ))
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          message="Delete this export? The generated file will be removed permanently."
          onConfirm={deleteExport}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

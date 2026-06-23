import { useState, useEffect } from 'react';
import api from '../api/axios.js';
import ConfirmModal from './ConfirmModal.jsx';

const EMPTY    = { title: '', date: '', content: '' };
const PER_PAGE = 8;

function PasswordGate({ onUnlock }) {
  const [input,    setInput]    = useState('');
  const [error,    setError]    = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setChecking(true);
    setError('');
    try {
      await api.post('/dailynotes/verify', { password: input });
      onUnlock();
    } catch {
      setError('Wrong password. Try again.');
      setInput('');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="dn-lock-box" style={{ background: 'var(--card-bg)', border: '1px solid var(--gray)', borderRadius: 12, padding: '2.5rem 2rem', minWidth: 320, textAlign: 'center' }}>
        <div className="dn-lock-icon" style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '1rem' }}>
          <i className="fas fa-lock"></i>
        </div>
        <h2 style={{ marginBottom: '0.4rem' }}>Daily Notes</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Enter the password to access this section.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            className="dn-lock-input"
            placeholder="Enter password"
            value={input}
            onChange={e => { setInput(e.target.value); setError(''); }}
            autoFocus
            style={{ width: '100%', marginBottom: '0.75rem' }}
          />
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}
          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={checking}>
            {checking
              ? <><i className="fas fa-spinner fa-spin"></i> Checking…</>
              : <><i className="fas fa-unlock-alt"></i> Unlock</>}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ManageDailyNotes() {
  const [unlocked, setUnlocked] = useState(false);
  const [notes,    setNotes]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [msg,      setMsg]      = useState(null);
  const [page,     setPage]     = useState(1);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3500); };

  const load = () =>
    api.get('/dailynotes')
      .then(r => setNotes(r.data))
      .catch(() => flash('error', 'Failed to load notes.'))
      .finally(() => setLoading(false));

  useEffect(() => { if (unlocked) load(); }, [unlocked]);

  const totalPages = Math.ceil(notes.length / PER_PAGE);
  const visible    = notes.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const openAdd = () => {
    const today = new Date().toISOString().split('T')[0];
    setForm({ ...EMPTY, date: today });
    setEditing(null);
    setError('');
    setModal(true);
  };

  const openEdit = (n) => {
    setForm({ title: n.title, date: n.date, content: n.content });
    setEditing(n._id);
    setError('');
    setModal(true);
  };

  const closeModal = () => { setModal(false); setEditing(null); setForm(EMPTY); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date || !form.content.trim()) {
      setError('Title, date, and content are required.');
      return;
    }
    setSaving(true); setError('');
    try {
      if (editing) await api.put(`/dailynotes/${editing}`, form);
      else         await api.post('/dailynotes', form);
      flash('success', editing ? 'Note updated.' : 'Note added.');
      closeModal();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/dailynotes/${id}`);
      flash('success', 'Note deleted.');
      setDeleteId(null);
      if (visible.length === 1 && page > 1) setPage(p => p - 1);
      load();
    } catch { flash('error', 'Failed to delete.'); }
  };

  const f = k => e => setForm(prev => ({ ...prev, [k]: e.target.value }));

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div>
      {msg && (
        <div className={`admin-alert admin-alert-${msg.type}`}>
          <i className={`fas ${msg.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {msg.text}
        </div>
      )}

      <div className="admin-section-header">
        <h2>Daily Notes ({notes.length})</h2>
        <button className="btn-primary" onClick={openAdd}>
          <i className="fas fa-plus"></i> Add Note
        </button>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : notes.length === 0 ? (
        <div className="prompt-empty">
          <i className="fas fa-journal-whills"></i>
          <p>No daily notes yet. Add your first one!</p>
        </div>
      ) : (
        <>
          <div className="dn-admin-list">
            {visible.map(n => (
              <div key={n._id} className="dn-admin-item">
                <div className="dn-admin-item-meta">
                  <span className="dn-admin-date">
                    <i className="fas fa-calendar-alt"></i>
                    {new Date(n.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="dn-admin-item-title">{n.title}</div>
                <p className="dn-admin-item-preview">{n.content.slice(0, 100)}{n.content.length > 100 ? '…' : ''}</p>
                <div className="dn-admin-item-actions">
                  <button className="port-action-btn" onClick={() => openEdit(n)}>
                    <i className="fas fa-pen"></i> Edit
                  </button>
                  <button className="port-action-btn port-action-danger" onClick={() => setDeleteId(n._id)}>
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                <i className="fas fa-chevron-left"></i>
              </button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          )}
        </>
      )}

      {/* Add / Edit Modal — NO outside click close */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal dn-modal">
            <h2>
              <i className="fas fa-journal-whills" style={{ color: 'var(--primary)', marginRight: 8 }}></i>
              {editing ? 'Edit Note' : 'Add Note'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title *</label>
                <input
                  value={form.title}
                  onChange={f('title')}
                  required
                  placeholder="Note title"
                />
              </div>
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={f('date')}
                  required
                />
              </div>
              <div className="form-group">
                <label>Content *</label>
                <textarea
                  value={form.content}
                  onChange={f('content')}
                  required
                  placeholder="Write your note here…"
                  rows={8}
                  className="dn-textarea"
                />
              </div>
              {error && <p className="error-msg">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Update Note' : 'Add Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <ConfirmModal
          message="Delete this note? This cannot be undone."
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

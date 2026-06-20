import { useState, useEffect } from 'react';
import api from '../api/axios.js';
import ConfirmModal from './ConfirmModal.jsx';

const EMPTY = { title: '', prompt: '' };

export default function ManagePrompts() {
  const [prompts, setPrompts] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => api.get('/prompts').then(r => setPrompts(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const filtered = prompts.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.prompt.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm(EMPTY); setEditing(null); setError(''); setModal(true); };
  const openEdit = (p) => { setForm({ title: p.title, prompt: p.prompt }); setEditing(p._id); setError(''); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editing) {
        await api.put(`/prompts/${editing}`, form);
      } else {
        await api.post('/prompts', form);
      }
      setModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    await api.delete(`/prompts/${deleteTarget}`).catch(console.error);
    setDeleteTarget(null);
    load();
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div>
      <div className="admin-section-header">
        <h2>Prompt Saver ({filtered.length})</h2>
        <button className="btn-add" onClick={openAdd}>
          <i className="fas fa-plus"></i> Add Prompt
        </button>
      </div>

      {/* Search bar */}
      <div className="prompt-search-wrap">
        <i className="fas fa-search prompt-search-icon"></i>
        <input
          className="prompt-search-input"
          placeholder="Search by title or content..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="prompt-search-clear" onClick={() => setSearch('')}>
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>

      {/* Prompt cards */}
      {filtered.length === 0 ? (
        <div className="prompt-empty">
          <i className="fas fa-scroll"></i>
          <p>{search ? 'No prompts match your search.' : 'No prompts saved yet. Add your first one!'}</p>
        </div>
      ) : (
        <div className="prompt-list">
          {filtered.map(p => (
            <div key={p._id} className="prompt-card">
              <div className="prompt-card-top">
                <h3 className="prompt-card-title">{p.title}</h3>
                <div className="prompt-card-actions">
                  <button
                    className={`prompt-action-btn${copied === p._id ? ' copied' : ''}`}
                    onClick={() => handleCopy(p._id, p.prompt)}
                    title="Copy prompt"
                  >
                    <i className={`fas ${copied === p._id ? 'fa-check' : 'fa-copy'}`}></i>
                    {copied === p._id ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    className="prompt-action-btn"
                    onClick={() => openEdit(p)}
                    title="Edit"
                  >
                    <i className="fas fa-pen"></i> Edit
                  </button>
                  <button
                    className="prompt-action-btn prompt-action-btn-danger"
                    onClick={() => setDeleteTarget(p._id)}
                    title="Delete"
                  >
                    <i className="fas fa-trash"></i> Delete
                  </button>
                </div>
              </div>
              <pre className="prompt-card-body">{p.prompt}</pre>
              <p className="prompt-card-date">
                {new Date(p.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          message="Delete this prompt? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Add / Edit modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2>{editing ? 'Edit Prompt' : 'Add New Prompt'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title *</label>
                <input value={form.title} onChange={f('title')} required placeholder="e.g. Code Review Assistant" />
              </div>
              <div className="form-group">
                <label>Prompt *</label>
                <textarea
                  value={form.prompt}
                  onChange={f('prompt')}
                  required
                  placeholder="Enter your prompt here..."
                  rows={8}
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' }}
                />
              </div>
              {error && <p className="error-msg">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn-save" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Prompt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

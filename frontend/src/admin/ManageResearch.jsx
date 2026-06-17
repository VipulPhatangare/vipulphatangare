import { useState, useEffect } from 'react';
import api from '../api/axios.js';

const EMPTY = { title: '', authors: '', abstract: '', conference: '', paperLink: '', downloadLink: '', doiLink: '', order: 0, isVisible: true };

export default function ManageResearch() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get('/research/all').then(r => setItems(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY); setEditing(null); setError(''); setModal(true); };
  const openEdit = (r) => { setForm({ ...r }); setEditing(r._id); setError(''); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (editing) await api.put(`/research/${editing}`, form);
      else await api.post('/research', form);
      setModal(false); load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this paper?')) return;
    await api.delete(`/research/${id}`).catch(console.error);
    load();
  };

  const toggleVisibility = async (r) => {
    await api.put(`/research/${r._id}`, { ...r, isVisible: !r.isVisible });
    load();
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div>
      <div className="admin-section-header">
        <h2>Research Papers ({items.length})</h2>
        <button className="btn-add" onClick={openAdd}><i className="fas fa-plus"></i> Add Paper</button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr><th>Title</th><th>Authors</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {items.map(r => (
              <tr key={r._id}>
                <td style={{ maxWidth: 300 }}><strong>{r.title}</strong></td>
                <td style={{ fontSize: '0.85rem', color: 'rgba(240,244,248,0.6)' }}>{r.authors}</td>
                <td><span className={`badge badge-${r.isVisible ? 'visible' : 'hidden'}`}>{r.isVisible ? 'Visible' : 'Hidden'}</span></td>
                <td>
                  <div className="table-actions">
                    <button className="btn-edit" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn-toggle" onClick={() => toggleVisibility(r)}>{r.isVisible ? 'Hide' : 'Show'}</button>
                    <button className="btn-delete" onClick={() => handleDelete(r._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2>{editing ? 'Edit Research Paper' : 'Add Research Paper'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title *</label>
                <input value={form.title} onChange={f('title')} required placeholder="Paper title" />
              </div>
              <div className="form-group">
                <label>Authors *</label>
                <input value={form.authors} onChange={f('authors')} required placeholder="Author 1, Author 2, ..." />
              </div>
              <div className="form-group">
                <label>Abstract *</label>
                <textarea value={form.abstract} onChange={f('abstract')} required rows={5} placeholder="Abstract text..." />
              </div>
              <div className="form-group">
                <label>Conference / Journal</label>
                <input value={form.conference} onChange={f('conference')} placeholder="IEEE Conference 2025" />
              </div>
              <div className="form-group">
                <label>Paper Link</label>
                <input value={form.paperLink} onChange={f('paperLink')} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label>Download Link</label>
                <input value={form.downloadLink} onChange={f('downloadLink')} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label>DOI Link</label>
                <input value={form.doiLink} onChange={f('doiLink')} placeholder="https://doi.org/..." />
              </div>
              <div className="form-group checkbox-row">
                <input type="checkbox" id="visibleRes" checked={form.isVisible} onChange={f('isVisible')} />
                <label htmlFor="visibleRes">Visible on portfolio</label>
              </div>
              {error && <p className="error-msg">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn-save" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

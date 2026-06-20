import { useState, useEffect } from 'react';
import api from '../api/axios.js';
import ConfirmModal from './ConfirmModal.jsx';

const EMPTY = { title: '', description: '', category: 'ml', link: '', linkText: 'Download PDF', order: 0, isVisible: true };

const CATS = [
  { value: 'ml', label: 'Machine Learning' },
  { value: 'algo', label: 'C++ and DSA' },
  { value: 'webdev', label: 'Web Development' },
  { value: 'dbms', label: 'Database' },
  { value: 'datascience', label: 'Data Science' },
];

export default function ManageNotes() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => api.get('/notes/all').then(r => setItems(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY); setEditing(null); setError(''); setModal(true); };
  const openEdit = (n) => { setForm({ ...n }); setEditing(n._id); setError(''); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (editing) await api.put(`/notes/${editing}`, form);
      else await api.post('/notes', form);
      setModal(false); load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    await api.delete(`/notes/${deleteTarget}`).catch(console.error);
    setDeleteTarget(null);
    load();
  };

  const toggleVisibility = async (n) => {
    await api.put(`/notes/${n._id}`, { ...n, isVisible: !n.isVisible });
    load();
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div>
      <div className="admin-section-header">
        <h2>Study Notes ({items.length})</h2>
        <button className="btn-add" onClick={openAdd}><i className="fas fa-plus"></i> Add Note</button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr><th>Title</th><th>Category</th><th>Link Text</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {items.map(n => (
              <tr key={n._id}>
                <td><strong>{n.title}</strong></td>
                <td><span className="badge badge-web">{CATS.find(c => c.value === n.category)?.label || n.category}</span></td>
                <td style={{ fontSize: '0.85rem' }}>{n.linkText}</td>
                <td><span className={`badge badge-${n.isVisible ? 'visible' : 'hidden'}`}>{n.isVisible ? 'Visible' : 'Hidden'}</span></td>
                <td>
                  <div className="table-actions">
                    <button className="btn-edit" onClick={() => openEdit(n)}>Edit</button>
                    <button className="btn-toggle" onClick={() => toggleVisibility(n)}>{n.isVisible ? 'Hide' : 'Show'}</button>
                    <button className="btn-delete" onClick={() => setDeleteTarget(n._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <ConfirmModal
          message="Delete this study note? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2>{editing ? 'Edit Note' : 'Add Note'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title *</label>
                <input value={form.title} onChange={f('title')} required placeholder="Note title" />
              </div>
              <div className="form-group">
                <label>Category *</label>
                <select value={form.category} onChange={f('category')}>
                  {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Description *</label>
                <textarea value={form.description} onChange={f('description')} required rows={3} placeholder="Short description..." />
              </div>
              <div className="form-group">
                <label>Link URL</label>
                <input value={form.link} onChange={f('link')} placeholder="https://drive.google.com/..." />
              </div>
              <div className="form-group">
                <label>Link Button Text</label>
                <input value={form.linkText} onChange={f('linkText')} placeholder="Download PDF / View" />
              </div>
              <div className="form-group">
                <label>Order</label>
                <input type="number" value={form.order} onChange={f('order')} min={0} />
              </div>
              <div className="form-group checkbox-row">
                <input type="checkbox" id="visibleNote" checked={form.isVisible} onChange={f('isVisible')} />
                <label htmlFor="visibleNote">Visible on portfolio</label>
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

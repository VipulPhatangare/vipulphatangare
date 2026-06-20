import { useState, useEffect } from 'react';
import api from '../api/axios.js';
import ConfirmModal from './ConfirmModal.jsx';

const EMPTY = { title: '', description: '', icon: 'fas fa-trophy', order: 0, isVisible: true };

export default function ManageAchievements() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => api.get('/achievements/all').then(r => setItems(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY); setEditing(null); setError(''); setModal(true); };
  const openEdit = (a) => { setForm({ ...a }); setEditing(a._id); setError(''); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (editing) await api.put(`/achievements/${editing}`, form);
      else await api.post('/achievements', form);
      setModal(false); load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    await api.delete(`/achievements/${deleteTarget}`).catch(console.error);
    setDeleteTarget(null);
    load();
  };

  const toggleVisibility = async (a) => {
    await api.put(`/achievements/${a._id}`, { ...a, isVisible: !a.isVisible });
    load();
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div>
      <div className="admin-section-header">
        <h2>Achievements ({items.length})</h2>
        <button className="btn-add" onClick={openAdd}><i className="fas fa-plus"></i> Add Achievement</button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr><th>Title</th><th>Icon</th><th>Order</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {items.map(a => (
              <tr key={a._id}>
                <td><strong>{a.title}</strong></td>
                <td><i className={a.icon} style={{ color: 'var(--primary)' }}></i></td>
                <td>{a.order}</td>
                <td><span className={`badge badge-${a.isVisible ? 'visible' : 'hidden'}`}>{a.isVisible ? 'Visible' : 'Hidden'}</span></td>
                <td>
                  <div className="table-actions">
                    <button className="btn-edit" onClick={() => openEdit(a)}>Edit</button>
                    <button className="btn-toggle" onClick={() => toggleVisibility(a)}>{a.isVisible ? 'Hide' : 'Show'}</button>
                    <button className="btn-delete" onClick={() => setDeleteTarget(a._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <ConfirmModal
          message="Delete this achievement? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2>{editing ? 'Edit Achievement' : 'Add Achievement'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title *</label>
                <input value={form.title} onChange={f('title')} required placeholder="Achievement title" />
              </div>
              <div className="form-group">
                <label>Description *</label>
                <textarea value={form.description} onChange={f('description')} required rows={4} placeholder="Describe the achievement..." />
              </div>
              <div className="form-group">
                <label>Icon (Font Awesome class)</label>
                <input value={form.icon} onChange={f('icon')} placeholder="fas fa-trophy" />
                <small style={{ color: 'rgba(240,244,248,0.4)', fontSize: '0.75rem' }}>
                  Preview: <i className={form.icon} style={{ color: 'var(--primary)' }}></i>
                  &nbsp; Use: fas fa-trophy, fas fa-briefcase, fas fa-graduation-cap
                </small>
              </div>
              <div className="form-group">
                <label>Order</label>
                <input type="number" value={form.order} onChange={f('order')} min={0} />
              </div>
              <div className="form-group checkbox-row">
                <input type="checkbox" id="visibleAch" checked={form.isVisible} onChange={f('isVisible')} />
                <label htmlFor="visibleAch">Visible on portfolio</label>
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

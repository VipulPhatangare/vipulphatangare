import { useState, useEffect } from 'react';
import api from '../api/axios.js';
import ConfirmModal from './ConfirmModal.jsx';

const EMPTY = { role: '', organization: '', startDate: '', endDate: '', bullets: '', techStack: '', order: 0, isVisible: true };

export default function ManageExperience() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => api.get('/experience/all').then(r => setItems(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY); setEditing(null); setError(''); setModal(true); };
  const openEdit = (item) => {
    setForm({ ...item, bullets: (item.bullets || []).join('\n'), techStack: (item.techStack || []).join(', ') });
    setEditing(item._id); setError(''); setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const payload = {
      ...form,
      bullets: String(form.bullets || '').split('\n').map(s => s.trim()).filter(Boolean),
      techStack: String(form.techStack || '').split(',').map(s => s.trim()).filter(Boolean)
    };
    try {
      if (editing) await api.put(`/experience/${editing}`, payload);
      else await api.post('/experience', payload);
      setModal(false); load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    await api.delete(`/experience/${deleteTarget}`).catch(console.error);
    setDeleteTarget(null);
    load();
  };

  const toggleVisibility = async (item) => {
    await api.put(`/experience/${item._id}`, { isVisible: !item.isVisible });
    load();
  };

  const moveItem = async (item, direction) => {
    const sorted = [...items].sort((a, b) =>
      a.order !== b.order ? a.order - b.order : new Date(b.createdAt) - new Date(a.createdAt)
    );
    const idx = sorted.findIndex(s => s._id === item._id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    await Promise.all([
      api.put(`/experience/${sorted[idx]._id}`,     { order: swapIdx }),
      api.put(`/experience/${sorted[swapIdx]._id}`, { order: idx }),
    ]);
    load();
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div>
      <div className="admin-section-header">
        <h2>Work Experience ({items.length})</h2>
        <button className="btn-add" onClick={openAdd}><i className="fas fa-plus"></i> Add Experience</button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr><th>Role</th><th>Organization</th><th>Duration</th><th>Bullets</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item._id}>
                <td><strong>{item.role}</strong></td>
                <td>{item.organization}</td>
                <td>{[item.startDate, item.endDate].filter(Boolean).join(' – ')}</td>
                <td>{(item.bullets || []).length}</td>
                <td><span className={`badge badge-${item.isVisible ? 'visible' : 'hidden'}`}>{item.isVisible ? 'Visible' : 'Hidden'}</span></td>
                <td>
                  <div className="table-actions">
                    <button className="btn-move" onClick={() => moveItem(item, 'up')} title="Move up"><i className="fas fa-arrow-up"></i></button>
                    <button className="btn-move" onClick={() => moveItem(item, 'down')} title="Move down"><i className="fas fa-arrow-down"></i></button>
                    <button className="btn-edit" onClick={() => openEdit(item)}>Edit</button>
                    <button className="btn-toggle" onClick={() => toggleVisibility(item)}>{item.isVisible ? 'Hide' : 'Show'}</button>
                    <button className="btn-delete" onClick={() => setDeleteTarget(item._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <ConfirmModal
          message="Delete this experience entry? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <h2>{editing ? 'Edit Experience' : 'Add Experience'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Role *</label>
                <input value={form.role} onChange={f('role')} required placeholder="e.g. Software Developer Intern" />
              </div>
              <div className="form-group">
                <label>Organization *</label>
                <input value={form.organization} onChange={f('organization')} required placeholder="e.g. CampusDekho.ai" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div className="form-group">
                  <label>Start</label>
                  <input value={form.startDate} onChange={f('startDate')} placeholder="May 2025" />
                </div>
                <div className="form-group">
                  <label>End</label>
                  <input value={form.endDate} onChange={f('endDate')} placeholder="Jul 2025 / Present" />
                </div>
              </div>
              <div className="form-group">
                <label>What you did (one factual bullet per line) *</label>
                <textarea rows={5} value={form.bullets} onChange={f('bullets')}
                  placeholder={"Built and deployed full-stack web products...\nDeveloped MHT-CET percentile and college predictor tools..."} />
              </div>
              <div className="form-group">
                <label>Tech stack (comma separated)</label>
                <input value={form.techStack} onChange={f('techStack')} placeholder="Node.js, MongoDB, PostgreSQL" />
              </div>
              <div className="form-group checkbox-row">
                <input type="checkbox" id="visibleExp" checked={form.isVisible} onChange={f('isVisible')} />
                <label htmlFor="visibleExp">Visible</label>
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

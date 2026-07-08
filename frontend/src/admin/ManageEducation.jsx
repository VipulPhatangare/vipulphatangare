import { useState, useEffect } from 'react';
import api from '../api/axios.js';
import ConfirmModal from './ConfirmModal.jsx';

const EMPTY = { degree: '', institution: '', location: '', startYear: '', endYear: '', score: '', highlights: '', order: 0, isVisible: true };

export default function ManageEducation() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => api.get('/education/all').then(r => setItems(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY); setEditing(null); setError(''); setModal(true); };
  const openEdit = (item) => {
    setForm({ ...item, highlights: (item.highlights || []).join('\n') });
    setEditing(item._id); setError(''); setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const payload = {
      ...form,
      highlights: String(form.highlights || '').split('\n').map(s => s.trim()).filter(Boolean)
    };
    try {
      if (editing) await api.put(`/education/${editing}`, payload);
      else await api.post('/education', payload);
      setModal(false); load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    await api.delete(`/education/${deleteTarget}`).catch(console.error);
    setDeleteTarget(null);
    load();
  };

  const toggleVisibility = async (item) => {
    await api.put(`/education/${item._id}`, { isVisible: !item.isVisible });
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
      api.put(`/education/${sorted[idx]._id}`,     { order: swapIdx }),
      api.put(`/education/${sorted[swapIdx]._id}`, { order: idx }),
    ]);
    load();
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div>
      <div className="admin-section-header">
        <h2>Education ({items.length})</h2>
        <button className="btn-add" onClick={openAdd}><i className="fas fa-plus"></i> Add Education</button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr><th>Degree</th><th>Institution</th><th>Years</th><th>Score</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item._id}>
                <td><strong>{item.degree}</strong></td>
                <td>{item.institution}</td>
                <td>{[item.startYear, item.endYear].filter(Boolean).join('–')}</td>
                <td>{item.score}</td>
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
          message="Delete this education entry? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <h2>{editing ? 'Edit Education' : 'Add Education'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Degree *</label>
                <input value={form.degree} onChange={f('degree')} required placeholder="e.g. B.E. Computer Engineering" />
              </div>
              <div className="form-group">
                <label>Institution *</label>
                <input value={form.institution} onChange={f('institution')} required placeholder="e.g. PICT, Pune" />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input value={form.location} onChange={f('location')} placeholder="e.g. Pune, India" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem' }}>
                <div className="form-group">
                  <label>Start Year</label>
                  <input value={form.startYear} onChange={f('startYear')} placeholder="2023" />
                </div>
                <div className="form-group">
                  <label>End Year</label>
                  <input value={form.endYear} onChange={f('endYear')} placeholder="2027" />
                </div>
                <div className="form-group">
                  <label>Score</label>
                  <input value={form.score} onChange={f('score')} placeholder="8.7 CGPA" />
                </div>
              </div>
              <div className="form-group">
                <label>Highlights (one per line)</label>
                <textarea rows={3} value={form.highlights} onChange={f('highlights')} placeholder={"Relevant coursework: DSA, ML\nClass representative"} />
              </div>
              <div className="form-group checkbox-row">
                <input type="checkbox" id="visibleEdu" checked={form.isVisible} onChange={f('isVisible')} />
                <label htmlFor="visibleEdu">Visible</label>
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

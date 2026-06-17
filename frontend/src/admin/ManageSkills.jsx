import { useState, useEffect } from 'react';
import api from '../api/axios.js';

const EMPTY = { name: '', order: 0, isVisible: true };

export default function ManageSkills() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get('/skills/all').then(r => setItems(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY); setEditing(null); setError(''); setModal(true); };
  const openEdit = (s) => { setForm({ ...s }); setEditing(s._id); setError(''); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (editing) await api.put(`/skills/${editing}`, form);
      else await api.post('/skills', form);
      setModal(false); load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this skill?')) return;
    await api.delete(`/skills/${id}`).catch(console.error);
    load();
  };

  const toggleVisibility = async (s) => {
    await api.put(`/skills/${s._id}`, { ...s, isVisible: !s.isVisible });
    load();
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div>
      <div className="admin-section-header">
        <h2>Skills ({items.length})</h2>
        <button className="btn-add" onClick={openAdd}><i className="fas fa-plus"></i> Add Skill</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1.5rem' }}>
        {items.filter(s => s.isVisible).map(s => (
          <span key={s._id} className="skill-box" style={{ cursor: 'default' }}>{s.name}</span>
        ))}
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr><th>Skill Name</th><th>Order</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {items.map(s => (
              <tr key={s._id}>
                <td><strong>{s.name}</strong></td>
                <td>{s.order}</td>
                <td><span className={`badge badge-${s.isVisible ? 'visible' : 'hidden'}`}>{s.isVisible ? 'Visible' : 'Hidden'}</span></td>
                <td>
                  <div className="table-actions">
                    <button className="btn-edit" onClick={() => openEdit(s)}>Edit</button>
                    <button className="btn-toggle" onClick={() => toggleVisibility(s)}>{s.isVisible ? 'Hide' : 'Show'}</button>
                    <button className="btn-delete" onClick={() => handleDelete(s._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <h2>{editing ? 'Edit Skill' : 'Add Skill'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Skill Name *</label>
                <input value={form.name} onChange={f('name')} required placeholder="e.g. Python, React, MongoDB" />
              </div>
              <div className="form-group">
                <label>Order (lower = first)</label>
                <input type="number" value={form.order} onChange={f('order')} min={0} />
              </div>
              <div className="form-group checkbox-row">
                <input type="checkbox" id="visibleSkill" checked={form.isVisible} onChange={f('isVisible')} />
                <label htmlFor="visibleSkill">Visible on portfolio</label>
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

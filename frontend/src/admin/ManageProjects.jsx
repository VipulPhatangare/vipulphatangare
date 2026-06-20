import { useState, useEffect } from 'react';
import api from '../api/axios.js';
import ConfirmModal from './ConfirmModal.jsx';

const EMPTY = {
  title: '', description: '', category: 'web',
  techStack: '', demoLink: '', codeLink: '', driveLink: '',
  order: 0, isVisible: true
};

export default function ManageProjects() {
  const [projects, setProjects] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => api.get('/projects/all').then(r => setProjects(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY); setEditing(null); setError(''); setModal(true); };
  const openEdit = (p) => {
    setForm({ ...p, techStack: p.techStack.join(', ') });
    setEditing(p._id);
    setError('');
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = { ...form, techStack: form.techStack.split(',').map(s => s.trim()).filter(Boolean) };
      if (editing) {
        await api.put(`/projects/${editing}`, payload);
      } else {
        await api.post('/projects', payload);
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
    await api.delete(`/projects/${deleteTarget}`).catch(console.error);
    setDeleteTarget(null);
    load();
  };

  const toggleVisibility = async (p) => {
    await api.put(`/projects/${p._id}`, { ...p, techStack: p.techStack, isVisible: !p.isVisible });
    load();
  };

  const moveItem = async (item, direction) => {
    const sorted = [...projects].sort((a, b) =>
      a.order !== b.order ? a.order - b.order : new Date(b.createdAt) - new Date(a.createdAt)
    );
    const idx = sorted.findIndex(p => p._id === item._id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    await Promise.all([
      api.put(`/projects/${sorted[idx]._id}`,    { ...sorted[idx],    order: swapIdx }),
      api.put(`/projects/${sorted[swapIdx]._id}`, { ...sorted[swapIdx], order: idx }),
    ]);
    load();
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div>
      <div className="admin-section-header">
        <h2>Projects ({projects.length})</h2>
        <button className="btn-add" onClick={openAdd}><i className="fas fa-plus"></i> Add Project</button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Tech Stack</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(p => (
              <tr key={p._id}>
                <td data-label="Title"><strong>{p.title}</strong></td>
                <td data-label="Category"><span className={`badge badge-${p.category}`}>{p.category}</span></td>
                <td data-label="Tech Stack" style={{ fontSize: '0.8rem', color: 'rgba(240,244,248,0.6)', maxWidth: 200 }}>
                  {p.techStack.slice(0, 3).join(', ')}{p.techStack.length > 3 ? '...' : ''}
                </td>
                <td data-label="Status">
                  <span className={`badge badge-${p.isVisible ? 'visible' : 'hidden'}`}>
                    {p.isVisible ? 'Visible' : 'Hidden'}
                  </span>
                </td>
                <td data-label="Actions">
                  <div className="table-actions">
                    <button className="btn-move" onClick={() => moveItem(p, 'up')} title="Move up"><i className="fas fa-arrow-up"></i></button>
                    <button className="btn-move" onClick={() => moveItem(p, 'down')} title="Move down"><i className="fas fa-arrow-down"></i></button>
                    <button className="btn-edit" onClick={() => openEdit(p)}>Edit</button>
                    <button className="btn-toggle" onClick={() => toggleVisibility(p)}>
                      {p.isVisible ? 'Hide' : 'Show'}
                    </button>
                    <button className="btn-delete" onClick={() => setDeleteTarget(p._id)}>Delete</button>
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
            <h2>{editing ? 'Edit Project' : 'Add New Project'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title *</label>
                <input value={form.title} onChange={f('title')} required placeholder="Project title" />
              </div>
              <div className="form-group">
                <label>Category *</label>
                <select value={form.category} onChange={f('category')}>
                  <option value="web">Web Development</option>
                  <option value="ml">Machine Learning</option>
                  <option value="agentic">Agentic AI</option>
                  <option value="genai">Generative AI</option>
                  <option value="deeplearning">Deep Learning</option>
                  <option value="arvr">AR / VR</option>
                  <option value="nlp">NLP</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description *</label>
                <textarea value={form.description} onChange={f('description')} required placeholder="Project description" rows={4} />
              </div>
              <div className="form-group">
                <label>Tech Stack (comma separated)</label>
                <input value={form.techStack} onChange={f('techStack')} placeholder="React, Node.js, MongoDB" />
              </div>
              <div className="form-group">
                <label>Demo / Website Link</label>
                <input value={form.demoLink} onChange={f('demoLink')} placeholder="https://" />
              </div>
              <div className="form-group">
                <label>GitHub Code Link</label>
                <input value={form.codeLink} onChange={f('codeLink')} placeholder="https://github.com/..." />
              </div>
              <div className="form-group">
                <label>Drive Link</label>
                <input value={form.driveLink} onChange={f('driveLink')} placeholder="https://drive.google.com/..." />
              </div>
              <div className="form-group checkbox-row">
                <input type="checkbox" id="visiblePrj" checked={form.isVisible} onChange={f('isVisible')} />
                <label htmlFor="visiblePrj">Visible on portfolio</label>
              </div>
              {error && <p className="error-msg">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn-save" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          message="Delete this project? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

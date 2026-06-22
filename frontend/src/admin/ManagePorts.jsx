import { useState, useEffect } from 'react';
import api from '../api/axios.js';
import ConfirmModal from './ConfirmModal.jsx';

const EMPTY = { port: '', name: '' };

export default function ManagePorts() {
  const [ports, setPorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [msg, setMsg] = useState(null);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3500); };
  const load = () => api.get('/ports').then(r => setPorts(r.data)).catch(() => flash('error', 'Failed to load ports')).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const filtered = ports.filter(p => {
    const q = search.toLowerCase();
    return !q || String(p.port).includes(q) || p.name.toLowerCase().includes(q);
  });

  const openAdd = () => { setForm(EMPTY); setEditing(null); setError(''); setModal(true); };
  const openEdit = (p) => {
    setForm({ port: p.port, name: p.name });
    setEditing(p._id);
    setError('');
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); setForm(EMPTY); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.port || !form.name.trim()) { setError('Port number and name are required.'); return; }
    const portNum = Number(form.port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) { setError('Port must be between 1 and 65535.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { port: portNum, name: form.name.trim() };
      if (editing) await api.put(`/ports/${editing}`, payload);
      else await api.post('/ports', payload);
      flash('success', editing ? 'Port updated.' : 'Port added.');
      closeModal();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/ports/${id}`);
      flash('success', 'Port deleted.');
      setDeleteId(null);
      load();
    } catch { flash('error', 'Failed to delete.'); }
  };

  const f = k => e => setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div>
      {msg && (
        <div className={`admin-alert admin-alert-${msg.type}`}>
          <i className={`fas ${msg.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {msg.text}
        </div>
      )}

      {/* Header */}
      <div className="admin-section-header">
        <h2>Used Ports ({ports.length})</h2>
        <button className="btn-primary" onClick={openAdd}>
          <i className="fas fa-plus"></i> Add Port
        </button>
      </div>

      {/* Search */}
      <div className="port-toolbar">
        <div className="prompt-search-wrap" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
          <i className="fas fa-search prompt-search-icon"></i>
          <input
            className="prompt-search-input"
            placeholder="Search port number or name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="prompt-search-clear" onClick={() => setSearch('')}>
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      </div>

      {/* Port grid */}
      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : filtered.length === 0 ? (
        <div className="prompt-empty">
          <i className="fas fa-plug"></i>
          <p>{search ? 'No ports match your search.' : 'No ports added yet.'}</p>
        </div>
      ) : (
        <div className="port-grid">
          {filtered.map(p => (
            <div key={p._id} className="port-card">
              <div className="port-card-accent" />
              <div className="port-card-body">
                <div className="port-card-num-row">
                  <span className="port-number">:{p.port}</span>
                </div>
                <div className="port-card-name">{p.name}</div>
              </div>
              <div className="port-card-footer">
                <button className="port-action-btn" onClick={() => openEdit(p)} title="Edit">
                  <i className="fas fa-pen"></i> Edit
                </button>
                <button className="port-action-btn port-action-danger" onClick={() => setDeleteId(p._id)} title="Delete">
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <h2><i className="fas fa-plug" style={{ color: 'var(--primary)', marginRight: 8 }}></i>{editing ? 'Edit Port' : 'Add Port'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Port Number *</label>
                <input type="number" value={form.port} onChange={f('port')} required min={1} max={65535} placeholder="e.g. 8080" disabled={!!editing} />
              </div>
              <div className="form-group">
                <label>Service / Name *</label>
                <input value={form.name} onChange={f('name')} required placeholder="e.g. HTTP, MongoDB, My App" />
              </div>
              {error && <p className="error-msg">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Update Port' : 'Add Port'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <ConfirmModal
          message="Delete this port entry? This cannot be undone."
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

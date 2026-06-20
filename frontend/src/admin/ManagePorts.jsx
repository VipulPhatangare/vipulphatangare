import { useState, useEffect } from 'react';
import api from '../api/axios.js';
import ConfirmModal from './ConfirmModal.jsx';

const EMPTY = { port: '', name: '', description: '', protocol: 'TCP', category: 'custom' };

const CAT = {
  system:   { label: 'System',   color: '#4d8ee8', icon: 'fas fa-server' },
  web:      { label: 'Web',      color: '#51cf66', icon: 'fas fa-globe' },
  database: { label: 'Database', color: '#be4bdb', icon: 'fas fa-database' },
  custom:   { label: 'Custom',   color: '#f59e0b', icon: 'fas fa-plug' },
};

const PROTO_COLOR = {
  TCP:     { bg: 'rgba(77,142,232,0.12)',  text: '#93c5fd', border: 'rgba(77,142,232,0.3)' },
  UDP:     { bg: 'rgba(251,191,36,0.12)',  text: '#fde68a', border: 'rgba(251,191,36,0.3)' },
  'TCP/UDP':{ bg: 'rgba(129,140,248,0.12)',text: '#c4b5fd', border: 'rgba(129,140,248,0.3)' },
};

export default function ManagePorts() {
  const [ports, setPorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(null);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3500); };
  const load = () => api.get('/ports').then(r => setPorts(r.data)).catch(() => flash('error', 'Failed to load ports')).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const filtered = ports.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || String(p.port).includes(q) || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    const matchCat = catFilter === 'all' || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const openAdd = () => { setForm(EMPTY); setEditing(null); setError(''); setModal(true); };
  const openEdit = (p) => {
    setForm({ port: p.port, name: p.name, description: p.description || '', protocol: p.protocol, category: p.category });
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
      const payload = { ...form, port: portNum };
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

  const copyPort = (portNum, id) => {
    navigator.clipboard.writeText(String(portNum)).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  const f = k => e => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const cats = ['all', 'system', 'web', 'database', 'custom'];

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

      {/* Stats strip */}
      {!loading && (
        <div className="port-stats">
          {Object.entries(CAT).map(([key, cfg]) => {
            const count = ports.filter(p => p.category === key).length;
            return (
              <div key={key} className="port-stat-chip" style={{ '--cat-c': cfg.color }}>
                <i className={cfg.icon}></i>
                <span>{cfg.label}</span>
                <strong>{count}</strong>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters + Search */}
      <div className="port-toolbar">
        <div className="port-cat-filters">
          {cats.map(c => (
            <button
              key={c}
              className={`port-cat-btn${catFilter === c ? ' active' : ''}`}
              onClick={() => setCatFilter(c)}
              style={catFilter === c && c !== 'all' ? { '--fc': CAT[c]?.color } : {}}
            >
              {c === 'all' ? 'All' : CAT[c].label}
            </button>
          ))}
        </div>
        <div className="prompt-search-wrap" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
          <i className="fas fa-search prompt-search-icon"></i>
          <input
            className="prompt-search-input"
            placeholder="Search port, name, description…"
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
          <p>{search || catFilter !== 'all' ? 'No ports match your filter.' : 'No ports added yet.'}</p>
        </div>
      ) : (
        <div className="port-grid">
          {filtered.map(p => {
            const cat = CAT[p.category] || CAT.custom;
            const proto = PROTO_COLOR[p.protocol] || PROTO_COLOR.TCP;
            return (
              <div key={p._id} className="port-card" style={{ '--cat-c': cat.color }}>
                {/* Top accent line */}
                <div className="port-card-accent" />

                <div className="port-card-body">
                  {/* Port number + copy */}
                  <div className="port-card-num-row">
                    <span className="port-number">:{p.port}</span>
                    <button
                      className={`port-copy-btn${copied === p._id ? ' copied' : ''}`}
                      onClick={() => copyPort(p.port, p._id)}
                      title="Copy port number"
                    >
                      <i className={`fas ${copied === p._id ? 'fa-check' : 'fa-copy'}`}></i>
                    </button>
                  </div>

                  {/* Name + badges */}
                  <div className="port-card-name">{p.name}</div>
                  <div className="port-card-badges">
                    <span className="port-badge port-badge-cat" style={{ background: `${cat.color}18`, color: cat.color, borderColor: `${cat.color}40` }}>
                      <i className={cat.icon}></i> {cat.label}
                    </span>
                    <span className="port-badge port-badge-proto" style={{ background: proto.bg, color: proto.text, borderColor: proto.border }}>
                      {p.protocol}
                    </span>
                    {p.isPreset && (
                      <span className="port-badge port-badge-preset">
                        <i className="fas fa-bookmark"></i> Preset
                      </span>
                    )}
                  </div>

                  {p.description && <p className="port-card-desc">{p.description}</p>}
                </div>

                {/* Actions */}
                <div className="port-card-footer">
                  <button className="port-action-btn" onClick={() => openEdit(p)} title="Edit">
                    <i className="fas fa-pen"></i> Edit
                  </button>
                  <button className="port-action-btn port-action-danger" onClick={() => setDeleteId(p._id)} title="Delete">
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <h2><i className="fas fa-plug" style={{ color: 'var(--primary)', marginRight: 8 }}></i>{editing ? 'Edit Port' : 'Add Port'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                <div className="form-group">
                  <label>Port Number *</label>
                  <input type="number" value={form.port} onChange={f('port')} required min={1} max={65535} placeholder="e.g. 8080" disabled={!!editing} />
                </div>
                <div className="form-group">
                  <label>Protocol</label>
                  <select value={form.protocol} onChange={f('protocol')}>
                    <option value="TCP">TCP</option>
                    <option value="UDP">UDP</option>
                    <option value="TCP/UDP">TCP/UDP</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Service / Name *</label>
                <input value={form.name} onChange={f('name')} required placeholder="e.g. HTTP, MongoDB, My App" />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={f('category')}>
                  <option value="system">System</option>
                  <option value="web">Web</option>
                  <option value="database">Database</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input value={form.description} onChange={f('description')} placeholder="Optional note about this port" />
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

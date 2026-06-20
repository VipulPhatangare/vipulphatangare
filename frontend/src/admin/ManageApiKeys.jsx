import { useState, useEffect, useRef } from 'react';
import api from '../api/axios.js';
import ConfirmModal from './ConfirmModal.jsx';

const EMPTY_FORM = { name: '', description: '', apiKey: '' };
const MAX_PINS = 3;

export default function ManageApiKeys() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [revealed, setRevealed] = useState({});
  const [revealing, setRevealing] = useState({});
  const [copied, setCopied] = useState({});
  const [pinning, setPinning] = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const nameRef = useRef(null);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/apikeys');
      setKeys(data);
    } catch { flash('error', 'Failed to load API keys'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (showModal) setTimeout(() => nameRef.current?.focus(), 80); }, [showModal]);

  const pinnedKeys = keys.filter(k => k.pinned);
  const pinnedCount = pinnedKeys.length;

  const filtered = keys.filter(k => {
    const q = search.toLowerCase();
    return k.name.toLowerCase().includes(q) || (k.description || '').toLowerCase().includes(q);
  });

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (k) => {
    setEditId(k._id);
    setForm({ name: k.name, description: k.description, apiKey: '' });
    setShowModal(true);
    setRevealed(prev => { const n = { ...prev }; delete n[k._id]; return n; });
  };
  const closeModal = () => { setShowModal(false); setEditId(null); setForm(EMPTY_FORM); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return flash('error', 'Name is required');
    if (!editId && !form.apiKey.trim()) return flash('error', 'API key is required');
    setSubmitting(true);
    try {
      if (editId) {
        await api.put(`/apikeys/${editId}`, form);
        flash('success', 'API key updated');
      } else {
        await api.post('/apikeys', form);
        flash('success', 'API key saved');
      }
      closeModal();
      load();
    } catch (err) {
      flash('error', err.response?.data?.error || 'Failed to save');
    } finally { setSubmitting(false); }
  };

  const reveal = async (id) => {
    if (revealed[id]) {
      setRevealed(prev => { const n = { ...prev }; delete n[id]; return n; });
      return;
    }
    setRevealing(prev => ({ ...prev, [id]: true }));
    try {
      const { data } = await api.get(`/apikeys/${id}/reveal`);
      setRevealed(prev => ({ ...prev, [id]: data.key }));
    } catch { flash('error', 'Failed to reveal key'); }
    finally { setRevealing(prev => ({ ...prev, [id]: false })); }
  };

  const copyKey = async (id) => {
    const key = revealed[id];
    if (!key) {
      setRevealing(prev => ({ ...prev, [id]: true }));
      try {
        const { data } = await api.get(`/apikeys/${id}/reveal`);
        await navigator.clipboard.writeText(data.key);
        setCopied(prev => ({ ...prev, [id]: true }));
        setTimeout(() => setCopied(prev => ({ ...prev, [id]: false })), 2000);
      } catch { flash('error', 'Failed to copy key'); }
      finally { setRevealing(prev => ({ ...prev, [id]: false })); }
      return;
    }
    try {
      await navigator.clipboard.writeText(key);
      setCopied(prev => ({ ...prev, [id]: true }));
      setTimeout(() => setCopied(prev => ({ ...prev, [id]: false })), 2000);
    } catch { flash('error', 'Clipboard access denied'); }
  };

  const togglePin = async (k) => {
    if (!k.pinned && pinnedCount >= MAX_PINS) {
      flash('error', `Max ${MAX_PINS} keys can be pinned. Unpin one first.`);
      return;
    }
    setPinning(prev => ({ ...prev, [k._id]: true }));
    try {
      await api.patch(`/apikeys/${k._id}/pin`);
      flash('success', k.pinned ? 'Key unpinned' : 'Key pinned');
      load();
    } catch (err) {
      flash('error', err.response?.data?.error || 'Failed to update pin');
    } finally { setPinning(prev => ({ ...prev, [k._id]: false })); }
  };

  const deleteKey = async (id) => {
    try {
      await api.delete(`/apikeys/${id}`);
      flash('success', 'API key deleted');
      setDeleteId(null);
      setRevealed(prev => { const n = { ...prev }; delete n[id]; return n; });
      load();
    } catch { flash('error', 'Failed to delete'); }
  };

  const renderCard = (k) => (
    <div key={k._id} className={`apikey-card stat-card${k.pinned ? ' apikey-card-pinned' : ''}`}>
      <div className="apikey-card-top">
        <div className="apikey-card-info">
          <div className="apikey-name">
            <i className="fas fa-key"></i>
            {k.name}
            {k.pinned && <span className="apikey-pin-badge"><i className="fas fa-thumbtack"></i> Pinned</span>}
          </div>
          {k.description && <div className="apikey-desc">{k.description}</div>}
          <div className="apikey-meta">
            Added {new Date(k.createdAt).toLocaleDateString()}
            {k.updatedAt !== k.createdAt && ` · Updated ${new Date(k.updatedAt).toLocaleDateString()}`}
          </div>
        </div>
        <div className="apikey-actions">
          {/* Pin / Unpin */}
          <button
            className={`apikey-btn${k.pinned ? ' apikey-btn-pinned' : ' apikey-btn-pin'}`}
            onClick={() => togglePin(k)}
            disabled={pinning[k._id] || (!k.pinned && pinnedCount >= MAX_PINS)}
            title={k.pinned ? 'Unpin' : pinnedCount >= MAX_PINS ? `Max ${MAX_PINS} pins reached` : 'Pin to top'}
          >
            <i className={`fas ${pinning[k._id] ? 'fa-spinner fa-spin' : 'fa-thumbtack'}`}></i>
            {k.pinned ? 'Unpin' : 'Pin'}
          </button>

          <button
            className="apikey-btn apikey-btn-reveal"
            onClick={() => reveal(k._id)}
            disabled={revealing[k._id]}
            title={revealed[k._id] ? 'Hide key' : 'Show key'}
          >
            <i className={`fas ${revealing[k._id] ? 'fa-spinner fa-spin' : revealed[k._id] ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            {revealed[k._id] ? 'Hide' : 'Show'}
          </button>

          <button
            className={`apikey-btn apikey-btn-copy${copied[k._id] ? ' copied' : ''}`}
            onClick={() => copyKey(k._id)}
            disabled={revealing[k._id]}
            title="Copy key"
          >
            <i className={`fas ${copied[k._id] ? 'fa-check' : 'fa-copy'}`}></i>
            {copied[k._id] ? 'Copied!' : 'Copy'}
          </button>

          <button className="apikey-btn apikey-btn-edit" onClick={() => openEdit(k)} title="Edit">
            <i className="fas fa-edit"></i> Edit
          </button>

          <button className="apikey-btn apikey-btn-danger" onClick={() => setDeleteId(k._id)} title="Delete">
            <i className="fas fa-trash"></i>
          </button>
        </div>
      </div>

      {revealed[k._id] && (
        <div className="apikey-revealed">
          <i className="fas fa-unlock-alt apikey-revealed-icon"></i>
          <code className="apikey-revealed-text">{revealed[k._id]}</code>
          <button className="apikey-copy-inline" onClick={() => copyKey(k._id)} title="Copy">
            <i className={`fas ${copied[k._id] ? 'fa-check' : 'fa-copy'}`}></i>
          </button>
        </div>
      )}
    </div>
  );

  const pinnedFiltered  = filtered.filter(k => k.pinned);
  const regularFiltered = filtered.filter(k => !k.pinned);

  return (
    <div>
      {msg && (
        <div className={`admin-alert admin-alert-${msg.type}`}>
          <i className={`fas ${msg.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {msg.text}
        </div>
      )}

      {/* Header */}
      <div className="apikeys-header">
        <div className="apikeys-header-info">
          <i className="fas fa-lock"></i>
          <p className="apikeys-note">All keys encrypted with AES-256-GCM. Only visible to admin.</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          <i className="fas fa-plus"></i> Add API Key
        </button>
      </div>

      {/* Pin quota bar */}
      {!loading && keys.length > 0 && (
        <div className="apikey-pin-quota">
          <i className="fas fa-thumbtack"></i>
          <span>Pinned: <strong>{pinnedCount} / {MAX_PINS}</strong></span>
          <div className="apikey-pin-track">
            {Array.from({ length: MAX_PINS }).map((_, i) => (
              <div key={i} className={`apikey-pin-dot${i < pinnedCount ? ' filled' : ''}`} />
            ))}
          </div>
        </div>
      )}

      {/* Search bar */}
      {!loading && keys.length > 0 && (
        <div className="apikeys-search-wrap">
          <i className="fas fa-search apikeys-search-icon"></i>
          <input
            type="text"
            className="apikeys-search"
            placeholder="Search by name or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="apikeys-search-clear" onClick={() => setSearch('')} title="Clear">
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : keys.length === 0 ? (
        <div className="stat-card apikeys-empty">
          <i className="fas fa-key"></i>
          <p>No API keys stored yet. Click "Add API Key" to get started.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="stat-card apikeys-empty">
          <i className="fas fa-search"></i>
          <p>No keys match "<strong>{search}</strong>".</p>
        </div>
      ) : (
        <div className="apikeys-list">
          {pinnedFiltered.length > 0 && (
            <>
              <div className="apikey-section-label">
                <i className="fas fa-thumbtack"></i> Pinned ({pinnedFiltered.length}/{MAX_PINS})
              </div>
              {pinnedFiltered.map(renderCard)}
              {regularFiltered.length > 0 && (
                <div className="apikey-section-label apikey-section-label-rest">
                  <i className="fas fa-key"></i> All Keys
                </div>
              )}
            </>
          )}
          {regularFiltered.map(renderCard)}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal apikey-modal">
            <div className="apikey-modal-header">
              <h2>
                <i className={`fas ${editId ? 'fa-edit' : 'fa-plus-circle'}`}></i>
                {editId ? 'Edit API Key' : 'Add API Key'}
              </h2>
              <button className="apikey-modal-close" onClick={closeModal} title="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={submit} className="apikey-form">
              <div className="form-group">
                <label>Name <span className="form-required">*</span></label>
                <input
                  ref={nameRef}
                  type="text"
                  className="form-input"
                  placeholder="e.g. OpenAI, Gemini, Stripe"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Used for embeddings in chatbot"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>
                  API Key
                  {editId
                    ? <span className="form-hint" style={{ marginLeft: 6 }}>— leave blank to keep existing key</span>
                    : <span className="form-required"> *</span>
                  }
                </label>
                <input
                  type="password"
                  className="form-input apikey-input"
                  placeholder={editId ? 'Enter new key to replace, or leave blank' : 'Paste your API key here'}
                  value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  autoComplete="off"
                />
              </div>

              <div className="apikey-modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  <i className="fas fa-save"></i>
                  {submitting ? 'Saving…' : editId ? 'Update Key' : 'Save Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <ConfirmModal
          message="Delete this API key? This cannot be undone."
          onConfirm={() => deleteKey(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

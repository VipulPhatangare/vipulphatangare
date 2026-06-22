import { useState, useEffect, useRef } from 'react';
import api from '../api/axios.js';
import ConfirmModal from './ConfirmModal.jsx';

const EMPTY_FORM = { title: '', order: 0, isVisible: true };

export default function ManageCertificates() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const fileRef = useRef(null);

  const load = () => api.get('/certificates/all').then(r => setItems(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setImageFile(null);
    setImagePreview('');
    setError('');
    setModal(true);
  };

  const openEdit = (cert) => {
    setForm({ title: cert.title, order: cert.order, isVisible: cert.isVisible });
    setEditing(cert._id);
    setImageFile(null);
    setImagePreview(cert.imageUrl);
    setError('');
    setModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editing && !imageFile) { setError('Please select an image.'); return; }
    setLoading(true); setError('');
    try {
      const data = new FormData();
      data.append('title', form.title);
      data.append('order', form.order);
      data.append('isVisible', form.isVisible);
      if (imageFile) data.append('image', imageFile);

      if (editing) {
        await api.put(`/certificates/${editing}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/certificates', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    await api.delete(`/certificates/${deleteTarget}`).catch(console.error);
    setDeleteTarget(null);
    load();
  };

  const toggleVisibility = async (cert) => {
    const data = new FormData();
    data.append('isVisible', !cert.isVisible);
    await api.put(`/certificates/${cert._id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }).catch(console.error);
    load();
  };

  const f = (k) => (e) => setForm(prev => ({
    ...prev,
    [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
  }));


  return (
    <div>
      <div className="admin-section-header">
        <h2>Gallery ({items.length})</h2>
        <button className="btn-add" onClick={openAdd}>
          <i className="fas fa-plus"></i> Add Image
        </button>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(240,244,248,0.4)' }}>
          <i className="fas fa-images" style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block' }}></i>
          <p>No images yet. Click "Add Image" to upload your first one.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {items.map(cert => (
            <div
              key={cert._id}
              style={{
                background: 'var(--darker)',
                border: '1px solid var(--gray)',
                borderRadius: 12,
                overflow: 'hidden',
                opacity: cert.isVisible ? 1 : 0.5
              }}
            >
              <div style={{ position: 'relative', paddingTop: '66%', background: '#111' }}>
                <img
                  src={cert.imageUrl}
                  alt={cert.title}
                  style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    objectFit: 'cover'
                  }}
                />
                <span style={{
                  position: 'absolute', top: 8, right: 8,
                  background: cert.isVisible ? 'rgba(81,207,102,0.15)' : 'rgba(255,255,255,0.08)',
                  color: cert.isVisible ? '#51cf66' : 'rgba(240,244,248,0.4)',
                  border: `1px solid ${cert.isVisible ? '#51cf6640' : 'var(--gray)'}`,
                  borderRadius: 6, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600
                }}>
                  {cert.isVisible ? 'Visible' : 'Hidden'}
                </span>
              </div>
              <div style={{ padding: '0.75rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--light)' }}>
                  {cert.title}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'rgba(240,244,248,0.4)', marginBottom: '0.75rem' }}>
                  Order: {cert.order}
                </p>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn-edit" style={{ flex: 1 }} onClick={() => openEdit(cert)}>Edit</button>
                  <button className="btn-toggle" onClick={() => toggleVisibility(cert)}>
                    {cert.isVisible ? 'Hide' : 'Show'}
                  </button>
                  <button className="btn-delete" onClick={() => setDeleteTarget(cert._id)}>
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          message="Delete this image? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2>{editing ? 'Edit Image' : 'Add Image'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title *</label>
                <input value={form.title} onChange={f('title')} required placeholder="e.g. AWS Cloud Practitioner" />
              </div>

              <div className="form-group">
                <label>{editing ? 'Replace Image (optional)' : 'Certificate Image *'}</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: '2px dashed var(--gray)',
                    borderRadius: 10,
                    padding: '1rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'var(--dark)',
                    transition: 'border-color 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray)'}
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 6, objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ color: 'rgba(240,244,248,0.4)' }}>
                      <i className="fas fa-cloud-upload-alt" style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'block' }}></i>
                      <span style={{ fontSize: '0.85rem' }}>Click to select image (JPG, PNG, WEBP — max 10MB)</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                {imageFile && (
                  <small style={{ color: 'rgba(240,244,248,0.5)', fontSize: '0.75rem' }}>
                    Selected: {imageFile.name}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Display Order</label>
                <input type="number" value={form.order} onChange={f('order')} min={0} />
              </div>

              <div className="form-group checkbox-row">
                <input type="checkbox" id="certVisible" checked={form.isVisible} onChange={f('isVisible')} />
                <label htmlFor="certVisible">Visible on portfolio</label>
              </div>

              {error && <p className="error-msg">{error}</p>}

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn-save" disabled={loading}>
                  {loading ? 'Uploading...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

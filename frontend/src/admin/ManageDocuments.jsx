import { useState, useEffect, useRef } from 'react';
import ConfirmModal from './ConfirmModal.jsx';

const STORAGE_KEY = 'admin_documents';

function loadDocs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveDocs(docs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

export default function ManageDocuments() {
  const [docs, setDocs] = useState([]);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { setDocs(loadDocs()); }, []);

  const openAdd = () => {
    setTitle('');
    setFile(null);
    setError('');
    setModal(true);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0] || null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('Please enter a title.'); return; }
    if (!file) { setError('Please select a document.'); return; }

    setLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = () => {
      const newDoc = {
        id: Date.now().toString(),
        title: title.trim(),
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        data: reader.result,
        addedAt: new Date().toISOString(),
      };
      const updated = [...loadDocs(), newDoc];
      try {
        saveDocs(updated);
        setDocs(updated);
        setModal(false);
      } catch {
        setError('Storage full. Try removing older documents first.');
      }
      setLoading(false);
    };
    reader.onerror = () => {
      setError('Failed to read file.');
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = (doc) => {
    const a = document.createElement('a');
    a.href = doc.data;
    a.download = doc.fileName;
    a.click();
  };

  const handleDelete = () => {
    const updated = loadDocs().filter(d => d.id !== deleteTarget);
    saveDocs(updated);
    setDocs(updated);
    setDeleteTarget(null);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fileIcon = (mimeType) => {
    if (mimeType.includes('pdf')) return 'fas fa-file-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'fas fa-file-word';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'fas fa-file-excel';
    if (mimeType.includes('image')) return 'fas fa-file-image';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'fas fa-file-archive';
    if (mimeType.includes('text')) return 'fas fa-file-alt';
    return 'fas fa-file';
  };

  return (
    <div>
      <div className="admin-section-header">
        <h2>Documents ({docs.length})</h2>
        <button className="btn-add" onClick={openAdd}>
          <i className="fas fa-plus"></i> Add Document
        </button>
      </div>

      {docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(240,244,248,0.4)' }}>
          <i className="fas fa-folder-open" style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block' }}></i>
          <p>No documents yet. Click "Add Document" to upload your first one.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {docs.map(doc => (
            <div
              key={doc.id}
              style={{
                background: 'var(--darker)',
                border: '1px solid var(--gray)',
                borderRadius: 12,
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <i
                className={fileIcon(doc.mimeType)}
                style={{ fontSize: '1.8rem', color: 'var(--primary)', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--light)', marginBottom: '0.2rem' }}>
                  {doc.title}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'rgba(240,244,248,0.4)' }}>
                  {doc.fileName} &nbsp;·&nbsp; {formatSize(doc.size)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  className="btn-edit"
                  onClick={() => handleDownload(doc)}
                  title="Download"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <i className="fas fa-download"></i> Download
                </button>
                <button
                  className="btn-delete"
                  onClick={() => setDeleteTarget(doc.id)}
                  title="Delete"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          message="Delete this document? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2>Add Document</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title *</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Resume, Marksheet, Offer Letter"
                />
              </div>

              <div className="form-group">
                <label>Document *</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: '2px dashed var(--gray)',
                    borderRadius: 10,
                    padding: '1.5rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'var(--dark)',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray)'}
                >
                  {file ? (
                    <div style={{ color: 'var(--light)' }}>
                      <i className={`${fileIcon(file.type)} fa-2x`} style={{ color: 'var(--primary)', marginBottom: '0.5rem', display: 'block' }}></i>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{file.name}</span>
                      <br />
                      <span style={{ fontSize: '0.75rem', color: 'rgba(240,244,248,0.45)' }}>{formatSize(file.size)}</span>
                    </div>
                  ) : (
                    <div style={{ color: 'rgba(240,244,248,0.4)' }}>
                      <i className="fas fa-cloud-upload-alt" style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'block' }}></i>
                      <span style={{ fontSize: '0.85rem' }}>Click to select any document (PDF, Word, Excel, image, etc.)</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>

              {error && <p className="error-msg">{error}</p>}

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn-save" disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

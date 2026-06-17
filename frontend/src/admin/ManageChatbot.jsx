import { useState, useEffect, useRef } from 'react';
import api from '../api/axios.js';

const DEFAULT_CONFIG = {
  systemPrompt: '',
  modelName: 'gemini-2.5-flash',
  maxTokens: 8192,
  typingSpeed: 18,
  topK: 5
};

export default function ManageChatbot() {
  const [tab, setTab] = useState('knowledge');
  const [chunks, setChunks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [textLabel, setTextLabel] = useState('');
  const [textContent, setTextContent] = useState('');
  const [pdfLabel, setPdfLabel] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'success'|'error', text }
  const [deleteId, setDeleteId] = useState(null);
  const fileInputRef = useRef(null);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const loadChunks = async (p = 1) => {
    setLoadingChunks(true);
    try {
      const { data } = await api.get(`/chatbot/chunks?page=${p}`);
      setChunks(data.chunks);
      setTotal(data.total);
      setPage(data.page);
      setPages(data.pages);
    } catch { flash('error', 'Failed to load chunks'); }
    finally { setLoadingChunks(false); }
  };

  const loadConfig = async () => {
    try {
      const { data } = await api.get('/chatbot/config');
      setConfig({ ...DEFAULT_CONFIG, ...data });
    } catch { flash('error', 'Failed to load config'); }
    finally { setLoadingConfig(false); }
  };

  useEffect(() => { loadChunks(1); loadConfig(); }, []);

  const submitText = async (e) => {
    e.preventDefault();
    if (!textContent.trim()) return flash('error', 'Text content is required');
    setSubmitting(true);
    try {
      const { data } = await api.post('/chatbot/chunks/text', {
        text: textContent,
        sourceLabel: textLabel || 'Manual Entry'
      });
      flash('success', data.message);
      setTextContent(''); setTextLabel('');
      loadChunks(1);
    } catch (err) {
      flash('error', err.response?.data?.error || 'Failed to store text');
    } finally { setSubmitting(false); }
  };

  const submitPdf = async (e) => {
    e.preventDefault();
    if (!pdfFile) return flash('error', 'Please select a PDF file');
    setSubmitting(true);
    const form = new FormData();
    form.append('pdf', pdfFile);
    form.append('sourceLabel', pdfLabel || pdfFile.name);
    try {
      const { data } = await api.post('/chatbot/chunks/pdf', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      flash('success', data.message);
      setPdfFile(null); setPdfLabel('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadChunks(1);
    } catch (err) {
      flash('error', err.response?.data?.error || 'Failed to process PDF');
    } finally { setSubmitting(false); }
  };

  const deleteChunk = async (id) => {
    try {
      await api.delete(`/chatbot/chunks/${id}`);
      flash('success', 'Chunk deleted');
      setDeleteId(null);
      loadChunks(page);
    } catch { flash('error', 'Failed to delete chunk'); }
  };

  const saveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const { data } = await api.put('/chatbot/config', config);
      setConfig({ ...DEFAULT_CONFIG, ...data });
      flash('success', 'Configuration saved');
    } catch { flash('error', 'Failed to save config'); }
    finally { setSavingConfig(false); }
  };

  return (
    <div>
      {msg && (
        <div className={`admin-alert admin-alert-${msg.type}`}>
          <i className={`fas ${msg.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="chatbot-tabs">
        <button className={`chatbot-tab${tab === 'knowledge' ? ' active' : ''}`} onClick={() => setTab('knowledge')}>
          <i className="fas fa-database"></i> Knowledge Base
        </button>
        <button className={`chatbot-tab${tab === 'config' ? ' active' : ''}`} onClick={() => setTab('config')}>
          <i className="fas fa-sliders-h"></i> Configuration
        </button>
      </div>

      {/* ── KNOWLEDGE BASE ── */}
      {tab === 'knowledge' && (
        <div className="chatbot-panel">
          <div className="chatbot-add-grid">
            {/* Add Text */}
            <div className="stat-card">
              <h3 className="chatbot-section-title"><i className="fas fa-align-left"></i> Add Text</h3>
              <form onSubmit={submitText} className="chatbot-form">
                <div className="form-group">
                  <label>Source Label</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. About Me, Resume, Skills"
                    value={textLabel}
                    onChange={e => setTextLabel(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Content <span className="form-required">*</span></label>
                  <textarea
                    className="form-input chatbot-textarea"
                    placeholder="Paste any text about Vipul — bio, skills, projects, experience..."
                    value={textContent}
                    onChange={e => setTextContent(e.target.value)}
                    rows={8}
                    required
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  <i className="fas fa-plus"></i> {submitting ? 'Processing…' : 'Add to Knowledge Base'}
                </button>
              </form>
            </div>

            {/* Upload PDF */}
            <div className="stat-card">
              <h3 className="chatbot-section-title"><i className="fas fa-file-pdf"></i> Upload PDF</h3>
              <form onSubmit={submitPdf} className="chatbot-form">
                <div className="form-group">
                  <label>Source Label</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Resume, Research Paper"
                    value={pdfLabel}
                    onChange={e => setPdfLabel(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>PDF File <span className="form-required">*</span></label>
                  <div
                    className="pdf-drop-zone"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <i className="fas fa-cloud-upload-alt"></i>
                    <span>{pdfFile ? pdfFile.name : 'Click to select PDF (max 15MB)'}</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      style={{ display: 'none' }}
                      onChange={e => setPdfFile(e.target.files[0] || null)}
                    />
                  </div>
                </div>
                <p className="chatbot-note">
                  <i className="fas fa-info-circle"></i> Text is extracted, chunked with 80-word overlap, and embedded. The PDF itself is not stored.
                </p>
                <button type="submit" className="btn-primary" disabled={submitting || !pdfFile}>
                  <i className="fas fa-upload"></i> {submitting ? 'Processing…' : 'Process & Store'}
                </button>
              </form>
            </div>
          </div>

          {/* Chunks List */}
          <div className="stat-card" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="chatbot-section-title" style={{ margin: 0 }}>
                <i className="fas fa-layer-group"></i> Stored Chunks
                <span className="chatbot-count">{total}</span>
              </h3>
              <button className="btn-secondary" onClick={() => loadChunks(page)}>
                <i className="fas fa-sync-alt"></i> Refresh
              </button>
            </div>

            {loadingChunks ? (
              <div className="loading-spinner"><div className="spinner"></div></div>
            ) : chunks.length === 0 ? (
              <div className="chatbot-empty">
                <i className="fas fa-database"></i>
                <p>No knowledge base entries yet. Add text or upload a PDF above.</p>
              </div>
            ) : (
              <>
                <div className="chunks-table-wrap">
                  <table className="chunks-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Source</th>
                        <th>Preview</th>
                        <th>Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chunks.map(c => (
                        <tr key={c._id}>
                          <td className="chunk-id">{c._id.slice(-8)}</td>
                          <td>
                            <span className={`chunk-badge chunk-badge-${c.source}`}>
                              <i className={`fas ${c.source === 'pdf' ? 'fa-file-pdf' : 'fa-align-left'}`}></i>
                              {c.sourceLabel}
                            </span>
                          </td>
                          <td className="chunk-preview">{c.text.slice(0, 100)}…</td>
                          <td className="chunk-date">{new Date(c.createdAt).toLocaleDateString()}</td>
                          <td>
                            {deleteId === c._id ? (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn-danger-sm" onClick={() => deleteChunk(c._id)}>Confirm</button>
                                <button className="btn-secondary-sm" onClick={() => setDeleteId(null)}>Cancel</button>
                              </div>
                            ) : (
                              <button className="btn-danger-sm" onClick={() => setDeleteId(c._id)}>
                                <i className="fas fa-trash"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {pages > 1 && (
                  <div className="pagination">
                    <button disabled={page <= 1} onClick={() => loadChunks(page - 1)}>
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <span>Page {page} of {pages}</span>
                    <button disabled={page >= pages} onClick={() => loadChunks(page + 1)}>
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CONFIGURATION ── */}
      {tab === 'config' && (
        <div className="chatbot-panel">
          {loadingConfig ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : (
            <form onSubmit={saveConfig} className="chatbot-config-form stat-card">
              <h3 className="chatbot-section-title"><i className="fas fa-robot"></i> Model Settings</h3>

              <div className="chatbot-config-grid">
                <div className="form-group">
                  <label>Model Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={config.modelName}
                    onChange={e => setConfig(c => ({ ...c, modelName: e.target.value }))}
                  />
                  <span className="form-hint">e.g. gemini-2.5-flash, gemini-2.0-flash</span>
                </div>

                <div className="form-group">
                  <label>Max Output Tokens</label>
                  <input
                    type="number"
                    className="form-input"
                    min={256} max={65536}
                    value={config.maxTokens}
                    onChange={e => setConfig(c => ({ ...c, maxTokens: Number(e.target.value) }))}
                  />
                  <span className="form-hint">Max tokens in each response (default: 8192)</span>
                </div>

                <div className="form-group">
                  <label>Top K Results</label>
                  <div className="slider-row">
                    <input
                      type="range" min={1} max={10}
                      value={config.topK}
                      onChange={e => setConfig(c => ({ ...c, topK: Number(e.target.value) }))}
                    />
                    <span className="slider-val">{config.topK}</span>
                  </div>
                  <span className="form-hint">Number of knowledge chunks retrieved per query</span>
                </div>

                <div className="form-group">
                  <label>Typing Speed (ms / character)</label>
                  <div className="slider-row">
                    <input
                      type="range" min={5} max={100}
                      value={config.typingSpeed}
                      onChange={e => setConfig(c => ({ ...c, typingSpeed: Number(e.target.value) }))}
                    />
                    <span className="slider-val">{config.typingSpeed}ms</span>
                  </div>
                  <span className="form-hint">Lower = faster typing animation in chat</span>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label>System Prompt</label>
                <textarea
                  className="form-input chatbot-textarea"
                  rows={8}
                  value={config.systemPrompt}
                  onChange={e => setConfig(c => ({ ...c, systemPrompt: e.target.value }))}
                />
                <span className="form-hint">Instructions given to the AI before every conversation</span>
              </div>

              <button type="submit" className="btn-primary" disabled={savingConfig}>
                <i className="fas fa-save"></i> {savingConfig ? 'Saving…' : 'Save Configuration'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

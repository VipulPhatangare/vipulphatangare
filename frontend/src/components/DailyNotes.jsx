import { useState, useEffect } from 'react';
import api from '../api/axios.js';

const PER_PAGE = 6;

export default function DailyNotes() {
  const [unlocked, setUnlocked] = useState(false);
  console.log('DailyNotes render — unlocked:', unlocked);
  const [input,    setInput]    = useState('');
  const [pwError,  setPwError]  = useState('');
  const [checking, setChecking] = useState(false);
  const [notes,    setNotes]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [page,     setPage]     = useState(1);
  const [viewed,   setViewed]   = useState(null);

  useEffect(() => {
    if (!unlocked) return;
    setLoading(true);
    api.get('/dailynotes')
      .then(r => setNotes(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [unlocked]);

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setChecking(true);
    setPwError('');
    try {
      await api.post('/dailynotes/verify', { password: input });
      setUnlocked(true);
    } catch {
      setPwError('Wrong password. Try again.');
      setInput('');
    } finally {
      setChecking(false);
    }
  };

  if (!unlocked) {
    return (
      <section className="section-page main-content">
        <div className="dn-lock-wrap">
          <div className="dn-lock-box">
            <div className="dn-lock-icon"><i className="fas fa-lock"></i></div>
            <h2 className="dn-lock-title">Daily Notes</h2>
            <p className="dn-lock-subtitle">This section is password protected.</p>
            <form onSubmit={handleUnlock} className="dn-lock-form">
              <input
                type="password"
                className="dn-lock-input"
                placeholder="Enter password"
                value={input}
                onChange={e => { setInput(e.target.value); setPwError(''); }}
                autoFocus
              />
              {pwError && <p className="dn-lock-error">{pwError}</p>}
              <button type="submit" className="dn-lock-btn" disabled={checking}>
                {checking
                  ? <><i className="fas fa-spinner fa-spin"></i> Checking…</>
                  : <><i className="fas fa-unlock-alt"></i> Unlock</>}
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  const totalPages = Math.ceil(notes.length / PER_PAGE);
  const visible    = notes.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (loading) return (
    <section className="section-page">
      <div className="loading-spinner"><div className="spinner"></div></div>
    </section>
  );

  return (
    <section className="section-page main-content">
      <div className="section-header">
        <h2 className="section-title">Daily Notes</h2>
        <p className="section-subtitle">Personal thoughts, learnings, and reflections.</p>
      </div>

      {notes.length === 0 ? (
        <div className="prompt-empty">
          <i className="fas fa-journal-whills"></i>
          <p>No notes yet.</p>
        </div>
      ) : (
        <>
          <div className="dn-grid">
            {visible.map(n => (
              <div key={n._id} className="dn-card" onClick={() => setViewed(n)}>
                <div className="dn-card-date">
                  <i className="fas fa-calendar-alt"></i>
                  {new Date(n.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <h3 className="dn-card-title">{n.title}</h3>
                <p className="dn-card-preview">{n.content.slice(0, 120)}{n.content.length > 120 ? '…' : ''}</p>
                <span className="dn-card-read">Read more <i className="fas fa-arrow-right"></i></span>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                <i className="fas fa-chevron-left"></i>
              </button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          )}
        </>
      )}

      {viewed && (
        <div className="dn-popup-overlay">
          <div className="dn-popup">
            <button className="dn-popup-close" onClick={() => setViewed(null)}>
              <i className="fas fa-times"></i>
            </button>
            <div className="dn-popup-date">
              <i className="fas fa-calendar-alt"></i>
              {new Date(viewed.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <h2 className="dn-popup-title">{viewed.title}</h2>
            <div className="dn-popup-content">{viewed.content}</div>
          </div>
        </div>
      )}
    </section>
  );
}

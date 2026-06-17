import { useState, useEffect, useRef } from 'react';
import api from '../api/axios.js';

const onSpotlight = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mouse-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
  e.currentTarget.style.setProperty('--mouse-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
};

export default function Research() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

  useEffect(() => {
    api.get('/research')
      .then(r => setPapers(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    const cards = listRef.current?.querySelectorAll('.paper-card');
    if (!cards) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.1 });
    cards.forEach((card, i) => {
      card.classList.add('reveal');
      card.style.transitionDelay = `${i * 100}ms`;
      obs.observe(card);
    });
    return () => obs.disconnect();
  }, [loading]);

  if (loading) return (
    <section className="section-page">
      <div className="loading-spinner"><div className="spinner"></div></div>
    </section>
  );

  return (
    <section className="section-page main-content">
      <div className="section-header">
        <h2 className="section-title">Research Publications</h2>
        <p className="section-subtitle">My contributions to academic research in artificial intelligence and machine learning</p>
      </div>

      <div className="papers-list" ref={listRef}>
        {papers.map(p => (
          <div key={p._id} className="paper-card" onMouseMove={onSpotlight}>
            <h3 className="paper-title">{p.title}</h3>
            <p className="paper-authors">{p.authors}</p>
            {p.conference && <span className="paper-conference">{p.conference}</span>}
            <p className="paper-abstract">{p.abstract}</p>
            <div className="paper-links">
              {p.paperLink && (
                <a href={p.paperLink} className="paper-link" target="_blank" rel="noreferrer">
                  View Paper
                </a>
              )}
              {p.downloadLink && (
                <a href={p.downloadLink} className="paper-link" target="_blank" rel="noreferrer">
                  <i className="fas fa-download"></i> Download
                </a>
              )}
              {p.doiLink && (
                <a href={p.doiLink} className="paper-link" target="_blank" rel="noreferrer">
                  <i className="fas fa-link"></i> DOI
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

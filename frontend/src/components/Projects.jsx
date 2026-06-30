import { useState, useEffect, useRef } from 'react';
import api from '../api/axios.js';


const CAT_CONFIG = {
  ml:           { label: 'ML',             color: '#4d8ee8', icon: 'fas fa-brain' },
  web:          { label: 'Web',            color: '#51cf66', icon: 'fas fa-globe' },
  agentic:      { label: 'Agentic AI',     color: '#be4bdb', icon: 'fas fa-robot' },
  genai:        { label: 'Generative AI',  color: '#f59e0b', icon: 'fas fa-wand-magic-sparkles' },
  deeplearning: { label: 'Deep Learning',  color: '#ef4444', icon: 'fas fa-network-wired' },
  arvr:         { label: 'AR / VR',        color: '#06b6d4', icon: 'fas fa-vr-cardboard' },
  nlp:          { label: 'NLP',            color: '#10b981', icon: 'fas fa-language' },
  n8n:          { label: 'n8n',           color: '#ff6d5a', icon: 'fas fa-sitemap' },
};

const onSpotlight = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mouse-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
  e.currentTarget.style.setProperty('--mouse-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
};

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [modalProject, setModalProject] = useState(null);
  const gridRef = useRef(null);

  useEffect(() => {
    api.get('/projects')
      .then(r => setProjects(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Build filter buttons dynamically from categories in the data
  const usedCategories = [...new Set(projects.map(p => p.category))];
  const filters = [
    { value: 'all', label: 'All' },
    ...usedCategories
      .filter(c => CAT_CONFIG[c])
      .map(c => ({ value: c, label: CAT_CONFIG[c].label })),
    ...usedCategories
      .filter(c => !CAT_CONFIG[c])
      .map(c => ({ value: c, label: c })),
  ];

  const filtered = filter === 'all' ? projects : projects.filter(p => p.category === filter);

  const changeFilter = (val) => {
    setFilter(val);
    setShown(PAGE_SIZE);
  };

  // Close modal on Escape key
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setModalProject(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Lock body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = modalProject ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modalProject]);

  // Staggered reveal
  useEffect(() => {
    if (loading) return;
    const cards = gridRef.current?.querySelectorAll('.pcard');
    if (!cards) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.08 });
    cards.forEach((card, i) => {
      if (!card.classList.contains('visible')) {
        card.style.transitionDelay = `${i * 60}ms`;
        obs.observe(card);
      }
    });
    return () => obs.disconnect();
  }, [loading, filter, projects]);

  if (loading) return (
    <section className="section-page">
      <div className="loading-spinner"><div className="spinner"></div></div>
    </section>
  );

  const modalCat = modalProject
    ? CAT_CONFIG[modalProject.category] || { label: modalProject.category, color: '#4d8ee8', icon: 'fas fa-code' }
    : null;

  return (
    <section className="section-page main-content">
      <div className="section-header">
        <h2 className="section-title">My Projects</h2>
        <p className="section-subtitle">A collection of my work in machine learning, data science, and full-stack development</p>
      </div>

      <div className="filter-buttons">
        {filters.map(f => (
          <button
            key={f.value}
            className={`filter-btn${filter === f.value ? ' active' : ''}`}
            onClick={() => changeFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="projects-grid" ref={gridRef}>
        {filtered.map((p, idx) => {
          const cat = CAT_CONFIG[p.category] || { label: p.category, color: '#4d8ee8', icon: 'fas fa-code' };
          return (
            <div
              key={p._id}
              className="pcard reveal spotlight-card"
              onMouseMove={onSpotlight}
              style={{ '--cat-color': cat.color }}
            >
              <div className="pcard-accent" />
              <div className="pcard-body">
                <div className="pcard-header">
                  <span className="pcard-badge" style={{ color: cat.color, borderColor: `${cat.color}40`, background: `${cat.color}14` }}>
                    <i className={cat.icon}></i> {cat.label}
                  </span>
                  <div className="pcard-header-right">
                    <button
                      className="pcard-expand-btn"
                      onClick={() => setModalProject(p)}
                      title="View full details"
                    >
                      <i className="fas fa-expand-alt"></i>
                    </button>
                    <div className="pcard-dots">
                      <span /><span /><span />
                    </div>
                  </div>
                </div>
                <h3 className="pcard-title">{p.title}</h3>
                <p className="pcard-desc">{p.description}</p>
                <div className="pcard-tech">
                  {p.techStack.slice(0, 5).map((t, i) => (
                    <span key={i} className="pcard-chip">{t}</span>
                  ))}
                  {p.techStack.length > 5 && (
                    <span className="pcard-chip pcard-chip-more">+{p.techStack.length - 5}</span>
                  )}
                </div>
              </div>
              <div className="pcard-footer">
                {p.demoLink && (
                  <a href={p.demoLink} className="pcard-btn pcard-btn-primary" target="_blank" rel="noreferrer">
                    <i className="fas fa-external-link-alt"></i> Live Demo
                  </a>
                )}
                {p.codeLink && (
                  <a href={p.codeLink} className="pcard-btn pcard-btn-ghost" target="_blank" rel="noreferrer">
                    <i className="fab fa-github"></i> Code
                  </a>
                )}
                {p.driveLink && (
                  <a href={p.driveLink} className="pcard-btn pcard-btn-ghost" target="_blank" rel="noreferrer">
                    <i className="fas fa-folder-open"></i> Drive
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Project Detail Modal */}
      {modalProject && (
        <div className="pmodal-overlay" onClick={() => setModalProject(null)}>
          <div
            className="pmodal"
            style={{ '--cat-color': modalCat.color }}
            onClick={e => e.stopPropagation()}
          >
            <div className="pmodal-accent" />
            <button className="pmodal-close" onClick={() => setModalProject(null)} aria-label="Close">
              <i className="fas fa-times"></i>
            </button>

            <div className="pmodal-body">
              <div className="pmodal-header">
                <span className="pcard-badge" style={{ color: modalCat.color, borderColor: `${modalCat.color}40`, background: `${modalCat.color}14` }}>
                  <i className={modalCat.icon}></i> {modalCat.label}
                </span>
              </div>

              <h2 className="pmodal-title">{modalProject.title}</h2>

              <div className="pmodal-section-label">About</div>
              <p className="pmodal-desc">{modalProject.description}</p>

              <div className="pmodal-section-label">
                Tech Stack <span className="pmodal-count">({modalProject.techStack.length})</span>
              </div>
              <div className="pmodal-tech">
                {modalProject.techStack.map((t, i) => (
                  <span key={i} className="pcard-chip pmodal-chip">{t}</span>
                ))}
              </div>

              {(modalProject.demoLink || modalProject.codeLink || modalProject.driveLink) && (
                <div className="pmodal-links">
                  {modalProject.demoLink && (
                    <a href={modalProject.demoLink} className="pcard-btn pcard-btn-primary" target="_blank" rel="noreferrer">
                      <i className="fas fa-external-link-alt"></i> Live Demo
                    </a>
                  )}
                  {modalProject.codeLink && (
                    <a href={modalProject.codeLink} className="pcard-btn pcard-btn-ghost" target="_blank" rel="noreferrer">
                      <i className="fab fa-github"></i> Code
                    </a>
                  )}
                  {modalProject.driveLink && (
                    <a href={modalProject.driveLink} className="pcard-btn pcard-btn-ghost" target="_blank" rel="noreferrer">
                      <i className="fas fa-folder-open"></i> Drive
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

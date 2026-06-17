import { useState, useEffect, useRef } from 'react';
import api from '../api/axios.js';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'ml', label: 'Machine Learning' },
  { value: 'web', label: 'Web Development' },
  { value: 'agentic', label: 'Agentic AI' },
];

const CAT_CONFIG = {
  ml:      { label: 'ML',         color: '#4d8ee8', icon: 'fas fa-brain' },
  web:     { label: 'Web',        color: '#51cf66', icon: 'fas fa-globe' },
  agentic: { label: 'Agentic AI', color: '#be4bdb', icon: 'fas fa-robot' },
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
  const gridRef = useRef(null);

  useEffect(() => {
    api.get('/projects')
      .then(r => setProjects(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const visible = filter === 'all' ? projects : projects.filter(p => p.category === filter);

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
      card.classList.remove('visible');
      card.style.transitionDelay = `${i * 70}ms`;
      obs.observe(card);
    });
    return () => obs.disconnect();
  }, [loading, filter, projects]);

  if (loading) return (
    <section className="section-page">
      <div className="loading-spinner"><div className="spinner"></div></div>
    </section>
  );

  return (
    <section className="section-page main-content">
      <div className="section-header">
        <h2 className="section-title">My Projects</h2>
        <p className="section-subtitle">A collection of my work in machine learning, data science, and full-stack development</p>
      </div>

      <div className="filter-buttons">
        {FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-btn${filter === f.value ? ' active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="projects-grid" ref={gridRef}>
        {visible.map(p => {
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
                  <div className="pcard-dots">
                    <span /><span /><span />
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
    </section>
  );
}

import { useState, useEffect, useRef } from 'react';
import api from '../api/axios.js';

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'ml', label: 'Machine Learning' },
  { value: 'algo', label: 'C++ and DSA' },
  { value: 'webdev', label: 'Web Development' },
  { value: 'dbms', label: 'Data Base' },
  { value: 'datascience', label: 'Data Science' },
];

const CATEGORY_LABELS = {
  ml: 'Machine Learning',
  algo: 'C++ And DSA',
  webdev: 'Web Development',
  dbms: 'Data Base',
  datascience: 'Data Science',
};

const onSpotlight = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mouse-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
  e.currentTarget.style.setProperty('--mouse-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
};

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const gridRef = useRef(null);

  useEffect(() => {
    api.get('/notes')
      .then(r => setNotes(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const visible = category === 'all' ? notes : notes.filter(n => n.category === category);

  useEffect(() => {
    if (loading) return;
    const cards = gridRef.current?.querySelectorAll('.note-card');
    if (!cards) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.1 });
    cards.forEach((card, i) => {
      card.classList.remove('visible');
      card.style.transitionDelay = `${i * 60}ms`;
      card.classList.add('reveal');
      obs.observe(card);
    });
    return () => obs.disconnect();
  }, [loading, category]);

  if (loading) return (
    <section className="section-page">
      <div className="loading-spinner"><div className="spinner"></div></div>
    </section>
  );

  return (
    <section className="section-page main-content">
      <div className="section-header">
        <h2 className="section-title">Study Material</h2>
        <p className="section-subtitle">Organized resources and summaries of key concepts in AI/ML and computer science</p>
      </div>

      <div className="notes-categories">
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            className={`category-btn${category === c.value ? ' active' : ''}`}
            onClick={() => setCategory(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="notes-grid" ref={gridRef}>
        {visible.map(n => (
          <div key={n._id} className="note-card" onMouseMove={onSpotlight}>
            <span className="note-category">{CATEGORY_LABELS[n.category] || n.category}</span>
            <h3 className="note-title">{n.title}</h3>
            <p className="note-desc">{n.description}</p>
            {n.link && (
              <a href={n.link} className="note-link" target="_blank" rel="noreferrer">
                {n.linkText || 'View'}
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

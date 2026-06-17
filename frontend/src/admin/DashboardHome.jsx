import { useState, useEffect } from 'react';
import api from '../api/axios.js';

export default function DashboardHome() {
  const [counts, setCounts] = useState({ projects: 0, achievements: 0, research: 0, skills: 0, notes: 0 });

  useEffect(() => {
    Promise.all([
      api.get('/projects/all'),
      api.get('/achievements/all'),
      api.get('/research/all'),
      api.get('/skills/all'),
      api.get('/notes/all'),
    ]).then(([p, a, r, s, n]) => {
      setCounts({
        projects: p.data.length,
        achievements: a.data.length,
        research: r.data.length,
        skills: s.data.length,
        notes: n.data.length
      });
    }).catch(console.error);
  }, []);

  const stats = [
    { label: 'Projects', count: counts.projects, icon: 'fas fa-code', color: '#4d8ee8' },
    { label: 'Achievements', count: counts.achievements, icon: 'fas fa-trophy', color: '#ffd43b' },
    { label: 'Research Papers', count: counts.research, icon: 'fas fa-file-alt', color: '#7a4ced' },
    { label: 'Skills', count: counts.skills, icon: 'fas fa-cogs', color: '#51cf66' },
    { label: 'Study Notes', count: counts.notes, icon: 'fas fa-book', color: '#ff922b' },
  ];

  return (
    <div>
      <p style={{ color: 'rgba(240,244,248,0.6)', marginBottom: '2rem' }}>
        Welcome back! Manage your portfolio content from here.
      </p>
      <div className="stats-grid">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <i className={s.icon} style={{ color: s.color }}></i>
            <div className="stat-number" style={{ color: s.color }}>{s.count}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--darker)', border: '1px solid var(--gray)', borderRadius: 12, padding: '1.5rem', marginTop: '1.5rem' }}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Quick Actions</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
          {[
            { href: '/admin/projects', label: '+ Add Project', icon: 'fas fa-code' },
            { href: '/admin/achievements', label: '+ Add Achievement', icon: 'fas fa-trophy' },
            { href: '/admin/research', label: '+ Add Paper', icon: 'fas fa-file-alt' },
            { href: '/admin/skills', label: '+ Add Skill', icon: 'fas fa-cogs' },
            { href: '/admin/notes', label: '+ Add Note', icon: 'fas fa-book' },
          ].map(a => (
            <a
              key={a.href}
              href={a.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0.6rem 1rem',
                background: 'rgba(77,142,232,0.1)',
                color: 'var(--primary)',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: '0.9rem',
                border: '1px solid rgba(77,142,232,0.2)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(77,142,232,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(77,142,232,0.1)'}
            >
              <i className={a.icon}></i> {a.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

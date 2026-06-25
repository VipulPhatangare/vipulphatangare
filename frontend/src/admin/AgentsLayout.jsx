import { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, useLocation } from 'react-router-dom';
import AgentsDashboard from './AgentsDashboard.jsx';
import LinkedInPostGenerator from './agents/LinkedInPostGenerator.jsx';
import EmailAnalyser from './agents/EmailAnalyser.jsx';

const AGENT_NAV = [
  { path: '/admin/agents', label: 'Overview', icon: 'fas fa-th-large', exact: true },
  { path: '/admin/agents/linkedin', label: 'LinkedIn Posts', icon: 'fab fa-linkedin' },
  { path: '/admin/agents/email', label: 'Email Analyser', icon: 'fas fa-envelope-open-text' },
];

export default function AgentsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentPath = location.pathname;

  const handleNav = (path) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const activeLabel = AGENT_NAV.find(n =>
    n.exact ? currentPath === n.path : currentPath.startsWith(n.path)
  )?.label || 'My Agents';

  return (
    <div className="agents-layout">
      {sidebarOpen && (
        <div className="agents-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`agents-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="agents-sidebar-header">
          <div className="agents-sidebar-title">
            <i className="fas fa-brain"></i>
            <span>My Agents</span>
          </div>
          <button className="agents-sidebar-close" onClick={() => setSidebarOpen(false)}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <nav className="agents-nav">
          {AGENT_NAV.map(n => (
            <a
              key={n.path}
              className={`agents-nav-link${
                n.exact ? currentPath === n.path ? ' active' : '' : currentPath.startsWith(n.path) ? ' active' : ''
              }`}
              href={n.path}
              onClick={(e) => { e.preventDefault(); handleNav(n.path); }}
            >
              <i className={n.icon}></i>
              {n.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="agents-content">
        <div className="agents-topbar">
          <button className="agents-back-btn" onClick={() => navigate('/admin')} title="Back to Admin">
            <i className="fas fa-arrow-left"></i>
          </button>
          <span className="agents-topbar-label">
            <i className="fas fa-brain"></i> {activeLabel}
          </span>
          <button className="agents-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle agents sidebar">
            <i className="fas fa-bars"></i>
          </button>
        </div>

        <div className="agents-page-body">
          <Routes>
            <Route path="/" element={<AgentsDashboard />} />
            <Route path="/linkedin" element={<LinkedInPostGenerator />} />
            <Route path="/email" element={<EmailAnalyser />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

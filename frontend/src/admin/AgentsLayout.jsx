import { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, useLocation } from 'react-router-dom';
import AgentsDashboard from './AgentsDashboard.jsx';
import LinkedInPostGenerator from './agents/LinkedInPostGenerator.jsx';
import EmailAnalyser from './agents/EmailAnalyser.jsx';
import ResumeGenerator from './agents/resume/ResumeGenerator.jsx';
import AutoApply from './agents/AutoApply.jsx';
import useSidebarCollapsed from './useSidebarCollapsed.js';

const AGENT_NAV = [
  { path: '/admin/agents', label: 'Overview', icon: 'fas fa-th-large', exact: true },
  { path: '/admin/agents/linkedin', label: 'LinkedIn Posts', icon: 'fab fa-linkedin' },
  { path: '/admin/agents/email', label: 'Email Analyser', icon: 'fas fa-envelope-open-text' },
  { path: '/admin/agents/autoapply', label: 'Auto-Apply', icon: 'fas fa-wand-magic-sparkles' },
  { path: '/admin/agents/resume', label: 'Resume Generator', icon: 'fas fa-file-invoice' },
];

export default function AgentsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

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

      <aside className={`agents-sidebar${sidebarOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
        <div className="agents-sidebar-header">
          <div className="agents-sidebar-title-group">
            <button className="agents-sidebar-back" onClick={() => navigate('/admin')} title="Back to Admin Panel">
              <i className="fas fa-arrow-left"></i>
            </button>
            <div className="agents-sidebar-title">
              <i className="fas fa-brain"></i>
              <span className="collapse-hide">My Agents</span>
            </div>
          </div>
          <div className="sidebar-header-actions">
            <button className="sidebar-collapse-btn" onClick={toggleCollapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <i className={`fas ${collapsed ? 'fa-angle-double-right' : 'fa-angle-double-left'}`}></i>
            </button>
            <button className="agents-sidebar-close" onClick={() => setSidebarOpen(false)}>
              <i className="fas fa-times"></i>
            </button>
          </div>
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
              title={n.label}
            >
              <i className={n.icon}></i>
              <span className="collapse-hide">{n.label}</span>
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
            <Route path="/autoapply" element={<AutoApply />} />
            <Route path="/resume" element={<ResumeGenerator />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

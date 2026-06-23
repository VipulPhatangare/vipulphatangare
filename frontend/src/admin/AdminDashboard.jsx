import { useState, useEffect } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import api from '../api/axios.js';
import DashboardHome   from './DashboardHome.jsx';
import ManageChatbot   from './ManageChatbot.jsx';
import ManageApiKeys   from './ManageApiKeys.jsx';
import AgentsLayout    from './AgentsLayout.jsx';
import ManagePrompts   from './ManagePrompts.jsx';
import ManagePorts      from './ManagePorts.jsx';
import ManageMessages   from './ManageMessages.jsx';
import ManageDailyNotes from './ManageDailyNotes.jsx';
import PortfolioLayout from './PortfolioLayout.jsx';

const NAV = [
  { path: '/admin',            label: 'Dashboard',    icon: 'fas fa-tachometer-alt', exact: true },
  { path: '/admin/portfolio',  label: 'Portfolio',    icon: 'fas fa-briefcase' },
  { path: '/admin/chatbot',    label: 'AI Chatbot',   icon: 'fas fa-robot' },
  { path: '/admin/apikeys',    label: 'API Keys',     icon: 'fas fa-key' },
  { path: '/admin/agents',     label: 'My Agents',    icon: 'fas fa-brain' },
  { path: '/admin/prompts',    label: 'Prompt Saver', icon: 'fas fa-scroll' },
  { path: '/admin/ports',       label: 'Used Ports',   icon: 'fas fa-plug' },
  { path: '/admin/dailynotes', label: 'Daily Notes',  icon: 'fas fa-journal-whills' },
  { path: '/admin/messages',   label: 'Messages',     icon: 'fas fa-envelope' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { navigate('/admin/login'); return; }
    api.get('/auth/verify').catch(() => {
      localStorage.removeItem('adminToken');
      navigate('/admin/login');
    });
  }, []);

  useEffect(() => {
    setCurrentPath(window.location.pathname);
  });

  const handleNav = (path) => {
    navigate(path);
    setCurrentPath(path);
    setSidebarOpen(false);
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  const activeLabel = NAV.find(n =>
    n.exact ? currentPath === n.path : currentPath.startsWith(n.path) && n.path !== '/admin'
  )?.label || 'Dashboard';

  return (
    <div className="admin-layout">
      {sidebarOpen && (
        <div className="admin-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Topbar is a sibling of admin-content, NOT a child —
          avoids overflow:auto clipping fixed elements on mobile */}
      <div className="admin-topbar">
        <button className="admin-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
          <i className={`fas ${sidebarOpen ? 'fa-times' : 'fa-bars'}`}></i>
        </button>
        <h1>{activeLabel}</h1>
      </div>

      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="admin-sidebar-header">
          <h2><i className="fas fa-shield-alt"></i> Admin Panel</h2>
          <p>Portfolio Manager</p>
        </div>
        <nav className="admin-nav">
          {NAV.map(n => (
            <a
              key={n.path}
              className={`admin-nav-link${
                currentPath === n.path || (!n.exact && currentPath.startsWith(n.path) && n.path !== '/admin')
                  ? ' active' : ''
              }`}
              onClick={(e) => { e.preventDefault(); handleNav(n.path); }}
              href={n.path}
            >
              <i className={n.icon}></i>
              {n.label}
            </a>
          ))}
          <hr style={{ margin: '1rem 1.5rem', borderColor: 'var(--gray)' }} />
          <a className="admin-nav-link" href="/" onClick={(e) => e.stopPropagation()}>
            <i className="fas fa-external-link-alt"></i>
            View Portfolio
          </a>
          <a className="admin-nav-link admin-nav-logout" href="#" onClick={(e) => { e.preventDefault(); logout(); }}>
            <i className="fas fa-sign-out-alt"></i>
            Logout
          </a>
        </nav>
      </aside>

      <main className="admin-content">
        <Routes>
          <Route path="/"             element={<DashboardHome />} />
          <Route path="/portfolio/*"  element={<PortfolioLayout />} />
          <Route path="/chatbot"      element={<ManageChatbot />} />
          <Route path="/apikeys"      element={<ManageApiKeys />} />
          <Route path="/agents/*"     element={<AgentsLayout />} />
          <Route path="/prompts"      element={<ManagePrompts />} />
          <Route path="/ports"        element={<ManagePorts />} />
          <Route path="/dailynotes"   element={<ManageDailyNotes />} />
          <Route path="/messages"     element={<ManageMessages />} />
        </Routes>
      </main>
    </div>
  );
}

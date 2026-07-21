import { useState, useEffect } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import api from '../api/axios.js';
import useSidebarCollapsed from './useSidebarCollapsed.js';
import DashboardHome   from './DashboardHome.jsx';
import ManageChatbot   from './ManageChatbot.jsx';
import ManageModels    from './ManageModels.jsx';
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
  { path: '/admin/models',     label: 'Model Management', icon: 'fas fa-microchip' },
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
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

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

  const isFullScreenSection = currentPath.startsWith('/admin/agents') || currentPath.startsWith('/admin/portfolio');

  return (
    <div className="admin-layout">
      {sidebarOpen && !isFullScreenSection && (
        <div className="admin-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {!isFullScreenSection && (
        <>
          {/* Topbar is a sibling of admin-content, NOT a child —
              avoids overflow:auto clipping fixed elements on mobile */}
          <div className="admin-topbar">
            <button className="admin-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
              <i className={`fas ${sidebarOpen ? 'fa-times' : 'fa-bars'}`}></i>
            </button>
            <h1>{activeLabel}</h1>
          </div>

          <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
            <div className="admin-sidebar-header">
              <div className="sidebar-header-top">
                <h2><i className="fas fa-shield-alt"></i> <span className="collapse-hide">Admin Panel</span></h2>
                <button className="sidebar-collapse-btn" onClick={toggleCollapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                  <i className={`fas ${collapsed ? 'fa-angle-double-right' : 'fa-angle-double-left'}`}></i>
                </button>
              </div>
              <p className="collapse-hide">Portfolio Manager</p>
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
                  title={n.label}
                >
                  <i className={n.icon}></i>
                  <span className="collapse-hide">{n.label}</span>
                </a>
              ))}
              <hr style={{ margin: '1rem 1.5rem', borderColor: 'var(--gray)' }} />
              <a className="admin-nav-link" href="/" onClick={(e) => e.stopPropagation()} title="View Portfolio">
                <i className="fas fa-external-link-alt"></i>
                <span className="collapse-hide">View Portfolio</span>
              </a>
              <a className="admin-nav-link admin-nav-logout" href="#" onClick={(e) => { e.preventDefault(); logout(); }} title="Logout">
                <i className="fas fa-sign-out-alt"></i>
                <span className="collapse-hide">Logout</span>
              </a>
            </nav>
          </aside>
        </>
      )}

      <main className={`admin-content${isFullScreenSection ? ' admin-content--full' : ''}`}>
        <Routes>
          <Route path="/"             element={<DashboardHome />} />
          <Route path="/portfolio/*"  element={<PortfolioLayout />} />
          <Route path="/chatbot"      element={<ManageChatbot />} />
          <Route path="/models"       element={<ManageModels />} />
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

import { useState, useEffect } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import api from '../api/axios.js';
import ManageProjects from './ManageProjects.jsx';
import ManageAchievements from './ManageAchievements.jsx';
import ManageResearch from './ManageResearch.jsx';
import ManageSkills from './ManageSkills.jsx';
import ManageNotes from './ManageNotes.jsx';
import ManageProfile from './ManageProfile.jsx';
import DashboardHome from './DashboardHome.jsx';
import ManageChatbot from './ManageChatbot.jsx';
import ManageApiKeys from './ManageApiKeys.jsx';

const NAV = [
  { path: '/admin', label: 'Dashboard', icon: 'fas fa-tachometer-alt', exact: true },
  { path: '/admin/projects', label: 'Projects', icon: 'fas fa-code' },
  { path: '/admin/achievements', label: 'Achievements', icon: 'fas fa-trophy' },
  { path: '/admin/research', label: 'Research', icon: 'fas fa-file-alt' },
  { path: '/admin/skills', label: 'Skills', icon: 'fas fa-cogs' },
  { path: '/admin/notes', label: 'Study Material', icon: 'fas fa-book' },
  { path: '/admin/profile', label: 'Profile', icon: 'fas fa-user' },
  { path: '/admin/chatbot', label: 'AI Chatbot', icon: 'fas fa-robot' },
  { path: '/admin/apikeys', label: 'API Keys', icon: 'fas fa-key' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { navigate('/admin/login'); return; }

    api.get('/auth/verify').catch(() => {
      localStorage.removeItem('adminToken');
      navigate('/admin/login');
    });
  }, []);

  const handleNav = (path) => {
    navigate(path);
    setCurrentPath(path);
  };

  useEffect(() => {
    setCurrentPath(window.location.pathname);
  });

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2><i className="fas fa-shield-alt"></i> Admin Panel</h2>
          <p>Portfolio Manager</p>
        </div>
        <nav className="admin-nav">
          {NAV.map(n => (
            <a
              key={n.path}
              className={`admin-nav-link${currentPath === n.path || (!n.exact && currentPath.startsWith(n.path) && n.path !== '/admin') ? ' active' : ''}`}
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
        </nav>
      </aside>

      <main className="admin-content">
        <div className="admin-topbar">
          <h1>
            {NAV.find(n => n.path === currentPath || (!n.exact && currentPath.startsWith(n.path) && n.path !== '/admin'))?.label || 'Dashboard'}
          </h1>
          <button className="btn-logout" onClick={logout}>
            <i className="fas fa-sign-out-alt"></i> Logout
          </button>
        </div>

        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/projects" element={<ManageProjects />} />
          <Route path="/achievements" element={<ManageAchievements />} />
          <Route path="/research" element={<ManageResearch />} />
          <Route path="/skills" element={<ManageSkills />} />
          <Route path="/notes" element={<ManageNotes />} />
          <Route path="/profile" element={<ManageProfile />} />
          <Route path="/chatbot" element={<ManageChatbot />} />
          <Route path="/apikeys" element={<ManageApiKeys />} />
        </Routes>
      </main>
    </div>
  );
}

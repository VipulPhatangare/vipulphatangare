import { useNavigate, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import DashboardHome      from './DashboardHome.jsx';
import ManageProjects     from './ManageProjects.jsx';
import ManageAchievements from './ManageAchievements.jsx';
import ManageResearch     from './ManageResearch.jsx';
import ManageSkills       from './ManageSkills.jsx';
import ManageNotes        from './ManageNotes.jsx';
import ManageProfile      from './ManageProfile.jsx';
import ManageCertificates from './ManageCertificates.jsx';
import ManageDocuments    from './ManageDocuments.jsx';
import ManageEducation    from './ManageEducation.jsx';
import ManageExperience   from './ManageExperience.jsx';
import useSidebarCollapsed from './useSidebarCollapsed.js';

const PORTFOLIO_NAV = [
  { path: '/admin/portfolio',              label: 'Dashboard',      icon: 'fas fa-tachometer-alt', exact: true },
  { path: '/admin/portfolio/projects',     label: 'Projects',       icon: 'fas fa-code' },
  { path: '/admin/portfolio/achievements', label: 'Achievements',   icon: 'fas fa-trophy' },
  { path: '/admin/portfolio/research',     label: 'Research',       icon: 'fas fa-file-alt' },
  { path: '/admin/portfolio/skills',       label: 'Skills',         icon: 'fas fa-cogs' },
  { path: '/admin/portfolio/education',    label: 'Education',      icon: 'fas fa-graduation-cap' },
  { path: '/admin/portfolio/experience',   label: 'Experience',     icon: 'fas fa-briefcase' },
  { path: '/admin/portfolio/notes',        label: 'Study Material', icon: 'fas fa-book' },
  { path: '/admin/portfolio/profile',      label: 'Profile',        icon: 'fas fa-user' },
  { path: '/admin/portfolio/certificates', label: 'Gallery',   icon: 'fas fa-images' },
  { path: '/admin/portfolio/documents',   label: 'Documents',  icon: 'fas fa-folder-open' },
];

export default function PortfolioLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  const currentPath = location.pathname;

  const handleNav = (path) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const activeLabel = PORTFOLIO_NAV.find(n =>
    n.exact ? currentPath === n.path : currentPath.startsWith(n.path)
  )?.label || 'Portfolio';

  return (
    <div className="portfolio-layout">
      {sidebarOpen && (
        <div className="portfolio-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`portfolio-sidebar${sidebarOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
        <div className="portfolio-sidebar-header">
          <div className="portfolio-sidebar-title-group">
            <button className="portfolio-sidebar-back" onClick={() => navigate('/admin')} title="Back to Admin Panel">
              <i className="fas fa-arrow-left"></i>
            </button>
            <div className="portfolio-sidebar-title">
              <i className="fas fa-briefcase"></i>
              <span className="collapse-hide">Portfolio</span>
            </div>
          </div>
          <div className="sidebar-header-actions">
            <button className="sidebar-collapse-btn" onClick={toggleCollapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <i className={`fas ${collapsed ? 'fa-angle-double-right' : 'fa-angle-double-left'}`}></i>
            </button>
            <button className="portfolio-sidebar-close" onClick={() => setSidebarOpen(false)}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        <nav className="portfolio-nav">
          {PORTFOLIO_NAV.map(n => (
            <a
              key={n.path}
              className={`portfolio-nav-link${
                n.exact
                  ? currentPath === n.path ? ' active' : ''
                  : currentPath.startsWith(n.path) ? ' active' : ''
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

      <div className="portfolio-content">
        <div className="portfolio-topbar">
          <button className="portfolio-back-btn" onClick={() => navigate('/admin')} title="Back to Admin">
            <i className="fas fa-arrow-left"></i>
          </button>
          <span className="portfolio-topbar-label">
            <i className="fas fa-briefcase"></i> {activeLabel}
          </span>
          <button className="portfolio-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle portfolio sidebar">
            <i className="fas fa-bars"></i>
          </button>
        </div>

        <div className="portfolio-page-body">
          <Routes>
            <Route path="/"              element={<DashboardHome />} />
            <Route path="/projects"      element={<ManageProjects />} />
            <Route path="/achievements"  element={<ManageAchievements />} />
            <Route path="/research"      element={<ManageResearch />} />
            <Route path="/skills"        element={<ManageSkills />} />
            <Route path="/education"     element={<ManageEducation />} />
            <Route path="/experience"    element={<ManageExperience />} />
            <Route path="/notes"         element={<ManageNotes />} />
            <Route path="/profile"       element={<ManageProfile />} />
            <Route path="/certificates"  element={<ManageCertificates />} />
            <Route path="/documents"     element={<ManageDocuments />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

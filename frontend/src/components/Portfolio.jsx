import { useState, useEffect, useRef, useCallback } from 'react';
import WelcomeAnimation from './WelcomeAnimation.jsx';
import Home from './Home.jsx';
import Projects from './Projects.jsx';
import Research from './Research.jsx';
import Notes from './Notes.jsx';
import Contact from './Contact.jsx';
import ParticleCanvas from './ParticleCanvas.jsx';
import GradientMesh from './GradientMesh.jsx';
import CustomCursor from './CustomCursor.jsx';
import ScrollProgress from './ScrollProgress.jsx';
import Chatbot from './Chatbot.jsx';
import { useToast, ToastContainer } from './Toast.jsx';

const SECTIONS = [
  { id: 'home',     label: 'Home',          icon: 'fas fa-home' },
  { id: 'projects', label: 'Projects',       icon: 'fas fa-code' },
  { id: 'research', label: 'Research',       icon: 'fas fa-file-alt' },
  { id: 'notes',    label: 'Study Material', icon: 'fas fa-book' },
  { id: 'contact',  label: 'Contact',        icon: 'fas fa-envelope' },
];

export default function Portfolio() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [active, setActive] = useState('home');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [wipePhase, setWipePhase] = useState(null);
  const { toasts, addToast } = useToast();
  const navLinksRef = useRef([]);
  const easterBufRef = useRef('');
  const pendingSectionRef = useRef(null);

  // Easter egg — type "synthomind"
  useEffect(() => {
    const onKey = (e) => {
      if (e.key.length !== 1) return;
      easterBufRef.current = (easterBufRef.current + e.key.toLowerCase()).slice(-10);
      if (easterBufRef.current === 'synthomind') {
        easterBufRef.current = '';
        document.body.classList.remove('easter-glitch');
        void document.body.offsetWidth;
        document.body.classList.add('easter-glitch');
        addToast('🎉 Welcome to SynthoMind! You found the Easter Egg!', 'special', 'fas fa-star');
        setTimeout(() => document.body.classList.remove('easter-glitch'), 1700);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addToast]);

  // Magnetic nav links
  useEffect(() => {
    const links = navLinksRef.current.filter(Boolean);
    const onMove = (e) => {
      links.forEach(link => {
        const rect = link.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < 80) {
          const pull = (80 - dist) / 80;
          link.style.transform = `translate(${dx * pull * 0.35}px, ${dy * pull * 0.35}px)`;
          link.style.transition = 'background-color 0.4s, color 0.4s';
        } else {
          link.style.transform = '';
          link.style.transition = '';
        }
      });
    };
    document.addEventListener('mousemove', onMove);
    return () => {
      document.removeEventListener('mousemove', onMove);
      links.forEach(l => { l.style.transform = ''; l.style.transition = ''; });
    };
  }, [showWelcome]);

  // Page wipe navigation
  const navigate = useCallback((id) => {
    if (id === active) { setMobileOpen(false); return; }
    pendingSectionRef.current = id;
    setWipePhase('in');
    setTimeout(() => {
      setActive(pendingSectionRef.current);
      window.scrollTo(0, 0);
      setMobileOpen(false);
      setWipePhase('out');
      setTimeout(() => setWipePhase(null), 400);
    }, 380);
  }, [active]);

  return (
    <>
      <GradientMesh />
      <ParticleCanvas />
      <div className="grain-overlay" />
      <CustomCursor />
      <ScrollProgress />
      <ToastContainer toasts={toasts} />
      <Chatbot />

      {wipePhase && (
        <div className={`page-wipe wiping-${wipePhase}`} />
      )}

      {showWelcome && <WelcomeAnimation onDone={() => setShowWelcome(false)} />}

      <button className="mobile-menu-btn" onClick={() => setMobileOpen(o => !o)}>
        <i className={`fas ${mobileOpen ? 'fa-times' : 'fa-bars'}`}></i>
      </button>

      {/* Sidebar */}
      <nav className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-header">
          <img src="/vipul.png" alt="Vipul Phatangare" className="sidebar-avatar" />
          <div>
            <div className="sidebar-name">Vipul Phatangare</div>
            <div className="sidebar-title">AI/ML Engineer</div>
          </div>
        </div>
        <div className="nav-links">
          {SECTIONS.map((s, i) => (
            <a
              key={s.id}
              ref={el => { navLinksRef.current[i] = el; }}
              className={`nav-link${active === s.id ? ' active' : ''}`}
              href={`#${s.id}`}
              onClick={(e) => { e.preventDefault(); navigate(s.id); }}
            >
              <i className={s.icon}></i>
              <span>{s.label}</span>
            </a>
          ))}
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <div className="mobile-nav-container">
          {SECTIONS.map(s => (
            <a
              key={s.id}
              className={active === s.id ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); navigate(s.id); }}
              href={`#${s.id}`}
            >
              <i className={s.icon}></i>
              <span>{s.label}</span>
            </a>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <div className="main-container" style={{ position: 'relative', zIndex: 2 }}>
        {active === 'home'     && <Home addToast={addToast} />}
        {active === 'projects' && <Projects />}
        {active === 'research' && <Research />}
        {active === 'notes'    && <Notes />}
        {active === 'contact'  && <Contact />}

        <footer className="footer">
          <p className="footer-text">© 2025 Vipul Phatangare. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}

import { useState, useEffect, useRef } from 'react';
import api from '../api/axios.js';

const ROLES = [
  'Aspiring AI/ML Engineer',
  'Hackathon Winner',
  'Research Intern',
  'Full Stack Developer',
  'Team SynthoMind Lead',
];

function useTyped(texts, typeSpeed = 80, deleteSpeed = 40, pause = 2000) {
  const [display, setDisplay] = useState('');
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('typing'); // typing | pausing | deleting

  useEffect(() => {
    const target = texts[idx];
    let timer;
    if (phase === 'typing') {
      if (display.length < target.length) {
        timer = setTimeout(() => setDisplay(target.slice(0, display.length + 1)), typeSpeed);
      } else {
        timer = setTimeout(() => setPhase('deleting'), pause);
      }
    } else if (phase === 'deleting') {
      if (display.length > 0) {
        timer = setTimeout(() => setDisplay(d => d.slice(0, -1)), deleteSpeed);
      } else {
        setIdx(i => (i + 1) % texts.length);
        setPhase('typing');
      }
    }
    return () => clearTimeout(timer);
  }, [display, phase, idx, texts, typeSpeed, deleteSpeed, pause]);

  return display;
}

function Counter({ target, label }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 1000;
        const steps = Math.ceil(duration / 16);
        let step = 0;
        const timer = setInterval(() => {
          step++;
          setCount(Math.round((target * step) / steps));
          if (step >= steps) clearInterval(timer);
        }, 16);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  return (
    <div className="counter-item" ref={ref}>
      <div className="counter-number">{count}</div>
      <div className="counter-label">{label}</div>
    </div>
  );
}

export default function Home({ addToast }) {
  const [profile, setProfile] = useState(null);
  const [skills, setSkills] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const tiltRef = useRef(null);
  const skillsRef = useRef(null);
  const achieveRef = useRef(null);
  const typedRole = useTyped(ROLES);

  useEffect(() => {
    Promise.all([
      api.get('/profile'),
      api.get('/skills'),
      api.get('/achievements')
    ]).then(([p, s, a]) => {
      setProfile(p.data);
      setSkills(s.data);
      setAchievements(a.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Reveal on scroll for skills + achievements
  useEffect(() => {
    if (loading) return;
    const targets = [skillsRef.current, achieveRef.current].filter(Boolean);
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.15 });
    targets.forEach(t => obs.observe(t));
    return () => obs.disconnect();
  }, [loading]);

  const onTiltMove = (e) => {
    const el = tiltRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const img = el.querySelector('.profile-img');
    if (img) {
      img.style.transform = `perspective(800px) rotateY(${x * 20}deg) rotateX(${-y * 20}deg) scale(1.04)`;
      img.style.boxShadow = `${-x * 18}px ${y * 18}px 40px rgba(77,142,232,0.4)`;
    }
  };

  const onTiltLeave = () => {
    const img = tiltRef.current?.querySelector('.profile-img');
    if (img) { img.style.transform = ''; img.style.boxShadow = ''; }
  };

  if (loading) return (
    <section className="home">
      <div className="loading-spinner"><div className="spinner"></div></div>
    </section>
  );

  return (
    <section className="home main-content">
      <div className="home-content">
        <div className="profile-container" ref={tiltRef} onMouseMove={onTiltMove} onMouseLeave={onTiltLeave}>
          <img src="/vipul.png" alt="Vipul Phatangare" className="profile-img" />
        </div>

        <div className="intro-text">
          <div className="greeting">Hello, I'm</div>
          <h1 className="name name-glitch" data-text={profile?.name || 'Vipul Phatangare'}>
            {profile?.name || 'Vipul Phatangare'}
          </h1>
          <h2 className="title">
            {typedRole}<span className="typed-cursor">|</span>
          </h2>
          <p className="tagline">{profile?.tagline}</p>

          <div className="counters-row">
            <Counter target={14} label="Projects" />
            <div className="counter-divider" />
            <Counter target={5} label="Achievements" />
            <div className="counter-divider" />
            <Counter target={2} label="Papers" />
          </div>

          <div className="social-links">
            {profile?.githubUrl && (
              <a href={profile.githubUrl} className="social-link" target="_blank" rel="noreferrer">
                <i className="fab fa-github"></i>
              </a>
            )}
            {profile?.linkedinUrl && (
              <a href={profile.linkedinUrl} className="social-link" target="_blank" rel="noreferrer">
                <i className="fab fa-linkedin-in"></i>
              </a>
            )}
            {profile?.instagramUrl && (
              <a href={profile.instagramUrl} className="social-link" target="_blank" rel="noreferrer">
                <i className="fab fa-instagram"></i>
              </a>
            )}
            {profile?.whatsappUrl && (
              <a href={profile.whatsappUrl} className="social-link" target="_blank" rel="noreferrer">
                <i className="fab fa-whatsapp"></i>
              </a>
            )}
          </div>
        </div>
      </div>

      {skills.length > 0 && (
        <div className="skills-section reveal" ref={skillsRef}>
          <h2><i className="fas fa-code"></i> Technical Skills</h2>
          <div className="marquee-wrapper">
            {/* Row 1 — scrolls left */}
            <div className="marquee-track">
              <div className="marquee-row marquee-left">
                {[...skills, ...skills].map((s, i) => (
                  <span key={i} className="skill-chip">{s.name}</span>
                ))}
              </div>
            </div>
            {/* Row 2 — scrolls right (reversed order) */}
            <div className="marquee-track">
              <div className="marquee-row marquee-right">
                {[...[...skills].reverse(), ...[...skills].reverse()].map((s, i) => (
                  <span key={i} className="skill-chip">{s.name}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {achievements.length > 0 && (
        <div className="achievements reveal" ref={achieveRef}>
          <h2><i className="fas fa-trophy"></i> Key Achievements</h2>
          {achievements.map(a => (
            <div key={a._id} className="achievement-item">
              <i className={`${a.icon} achievement-icon`}></i>
              <div className="achievement-content">
                <h3>{a.title}</h3>
                <p>{a.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

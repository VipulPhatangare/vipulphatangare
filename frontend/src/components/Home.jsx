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
  const [projectCount, setProjectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const tiltRef = useRef(null);
  const skillsRef = useRef(null);
  const achieveRef = useRef(null);
  const typedRole = useTyped(ROLES);

  useEffect(() => {
    Promise.all([
      api.get('/profile'),
      api.get('/skills'),
      api.get('/achievements'),
      api.get('/projects')
    ]).then(([p, s, a, proj]) => {
      setProfile(p.data);
      setSkills(s.data);
      setAchievements(a.data);
      setProjectCount(Array.isArray(proj.data) ? proj.data.length : 0);
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
            <Counter target={projectCount} label="Projects" />
            <div className="counter-divider" />
            <Counter target={skills.length} label="Skills" />
            <div className="counter-divider" />
            <Counter target={achievements.length} label="Achievements" />
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
            {profile?.leetcodeUrl && (
              <a href={profile.leetcodeUrl} className="social-link" target="_blank" rel="noreferrer">
                <svg viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z" />
                </svg>
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

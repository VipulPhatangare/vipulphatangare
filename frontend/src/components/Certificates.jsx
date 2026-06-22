import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios.js';

export default function Gallery() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);
  const [lbVisible, setLbVisible] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const gridRef = useRef(null);

  useEffect(() => {
    api.get('/certificates')
      .then(r => setItems(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Staggered reveal via IntersectionObserver
  useEffect(() => {
    if (loading) return;
    const cards = gridRef.current?.querySelectorAll('.gal-item');
    if (!cards) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('gal-item--in'); obs.unobserve(e.target); }
      }),
      { threshold: 0.06 }
    );
    cards.forEach((card, i) => {
      card.style.transitionDelay = `${i * 75}ms`;
      obs.observe(card);
    });
    return () => obs.disconnect();
  }, [loading, items]);

  // Lightbox open / close
  const openLb = (index) => {
    setLightbox(index);
    setImgLoaded(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setLbVisible(true)));
  };
  const closeLb = useCallback(() => {
    setLbVisible(false);
    setTimeout(() => setLightbox(null), 280);
  }, []);

  const goPrev = useCallback(() => {
    setImgLoaded(false);
    setLightbox(i => (i - 1 + items.length) % items.length);
  }, [items.length]);
  const goNext = useCallback(() => {
    setImgLoaded(false);
    setLightbox(i => (i + 1) % items.length);
  }, [items.length]);

  // Keyboard
  useEffect(() => {
    if (lightbox === null) return;
    const h = (e) => {
      if (e.key === 'Escape')      closeLb();
      if (e.key === 'ArrowRight')  goNext();
      if (e.key === 'ArrowLeft')   goPrev();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [lightbox, closeLb, goNext, goPrev]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = lightbox !== null ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightbox]);

  // Tilt on mouse move
  const handleMouseMove = (e, el) => {
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 14;
    const y = ((e.clientY - rect.top)  / rect.height - 0.5) * -14;
    el.style.transform = `perspective(700px) rotateY(${x}deg) rotateX(${y}deg) scale(1.03)`;
  };
  const resetTilt = (el) => { el.style.transform = ''; };

  if (loading) return (
    <section className="section-page">
      <div className="gal-skeleton-wrap">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="gal-skeleton" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </section>
  );

  if (items.length === 0) return (
    <section className="section-page main-content">
      <div className="gal-header">
        <span className="gal-eyebrow"><i className="fas fa-images"></i> Certificates &amp; Achievements</span>
        <h2 className="gal-title">My Gallery</h2>
        <p className="gal-subtitle">Click any image to view it full size</p>
        <div className="gal-header-line" />
      </div>
      <div className="gal-empty">
        <i className="fas fa-image"></i>
        <p>Nothing here yet.</p>
      </div>
    </section>
  );

  const current = lightbox !== null ? items[lightbox] : null;

  return (
    <section className="section-page main-content">
      {/* Section header */}
      <div className="gal-header">
        <span className="gal-eyebrow"><i className="fas fa-images"></i> Certificates &amp; Achievements</span>
        <h2 className="gal-title">My Gallery</h2>
        <p className="gal-subtitle">Click any image to view it full size</p>
        <div className="gal-header-line" />
      </div>

      {/* Masonry grid */}
      <div ref={gridRef} className="gal-grid">
        {items.map((cert, i) => (
          <div
            key={cert._id}
            className="gal-item"
            onClick={() => openLb(i)}
            onMouseMove={(e) => handleMouseMove(e, e.currentTarget)}
            onMouseLeave={(e) => resetTilt(e.currentTarget)}
          >
            <div className="gal-item-inner">
              <img
                src={cert.imageUrl}
                alt={cert.title}
                className="gal-img"
                loading="lazy"
              />
              <div className="gal-overlay">
                <div className="gal-overlay-icon"><i className="fas fa-expand-alt"></i></div>
                <div className="gal-overlay-title">{cert.title}</div>
              </div>
              <div className="gal-shine" />
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className={`gal-lb${lbVisible ? ' gal-lb--open' : ''}`}
          onClick={closeLb}
        >
          {/* Close */}
          <button className="gal-lb-close" onClick={closeLb} aria-label="Close">
            <i className="fas fa-times"></i>
          </button>

          {/* Counter */}
          <div className="gal-lb-counter">{lightbox + 1} / {items.length}</div>

          {/* Prev */}
          {items.length > 1 && (
            <button className="gal-lb-arrow gal-lb-arrow--prev" onClick={e => { e.stopPropagation(); goPrev(); }} aria-label="Previous">
              <i className="fas fa-chevron-left"></i>
            </button>
          )}

          {/* Image box */}
          <div className="gal-lb-box" onClick={e => e.stopPropagation()}>
            <div className={`gal-lb-img-wrap${imgLoaded ? ' loaded' : ''}`}>
              <img
                key={current?._id}
                src={current?.imageUrl}
                alt={current?.title}
                className="gal-lb-img"
                onLoad={() => setImgLoaded(true)}
              />
              {!imgLoaded && <div className="gal-lb-spinner"><div className="spinner"></div></div>}
            </div>
            <div className="gal-lb-info">
              <p className="gal-lb-title">{current?.title}</p>
              <p className="gal-lb-hint">
                <i className="fas fa-keyboard"></i> ← → to navigate &nbsp;·&nbsp;
                <i className="fas fa-times-circle"></i> Esc to close
              </p>
            </div>
          </div>

          {/* Next */}
          {items.length > 1 && (
            <button className="gal-lb-arrow gal-lb-arrow--next" onClick={e => { e.stopPropagation(); goNext(); }} aria-label="Next">
              <i className="fas fa-chevron-right"></i>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

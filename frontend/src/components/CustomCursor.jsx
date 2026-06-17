import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    // Skip on touch devices
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let px = 0, py = 0, rx = 0, ry = 0, raf;
    document.body.classList.add('has-custom-cursor');

    const onMove = (e) => {
      px = e.clientX;
      py = e.clientY;
      dot.style.left = px + 'px';
      dot.style.top = py + 'px';
      dot.style.opacity = '1';
      ring.style.opacity = '1';
    };

    const lerp = (a, b, t) => a + (b - a) * t;

    const animate = () => {
      rx = lerp(rx, px, 0.11);
      ry = lerp(ry, py, 0.11);
      ring.style.left = rx + 'px';
      ring.style.top = ry + 'px';
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onEnter = () => {
      ring.classList.add('cursor-enlarged');
      dot.style.transform = 'translate(-50%, -50%) scale(0.5)';
    };
    const onLeave = () => {
      ring.classList.remove('cursor-enlarged');
      dot.style.transform = 'translate(-50%, -50%) scale(1)';
    };

    const attach = () => {
      document.querySelectorAll('a, button, .project-card, .note-card, .paper-card, .skill-box, .filter-btn, .category-btn, .nav-link, .admin-nav-link')
        .forEach(el => {
          el.addEventListener('mouseenter', onEnter);
          el.addEventListener('mouseleave', onLeave);
        });
    };
    attach();

    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('mousemove', onMove);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousemove', onMove);
      document.body.classList.remove('has-custom-cursor');
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  );
}

import { useState, useEffect } from 'react';

export default function WelcomeAnimation({ onDone }) {
  const [text, setText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const [fading, setFading] = useState(false);
  const full = 'Explore my world!';

  useEffect(() => {
    let i = 0;
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        if (i < full.length) {
          setText(full.slice(0, ++i));
        } else {
          clearInterval(interval);
          setShowCursor(false);
          setTimeout(() => {
            setFading(true);
            setTimeout(onDone, 800);
          }, 1500);
        }
      }, 200);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`welcome-overlay${fading ? ' fade-out' : ''}`}>
      <div className="welcome-container">
        <div className="welcome-text">{text}</div>
        {showCursor && <div className="cursor">_</div>}
      </div>
    </div>
  );
}

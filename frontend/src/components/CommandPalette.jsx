import { useState, useEffect, useRef } from 'react';

const COMMANDS = [
  { id: 'home', label: 'Go to Home', desc: 'Portfolio home & achievements', icon: 'fas fa-home', section: 'home' },
  { id: 'projects', label: 'Go to Projects', desc: 'All my projects', icon: 'fas fa-code', section: 'projects' },
  { id: 'research', label: 'Go to Research', desc: 'Research publications', icon: 'fas fa-file-alt', section: 'research' },
  { id: 'notes', label: 'Go to Study Material', desc: 'Notes & resources', icon: 'fas fa-book', section: 'notes' },
  { id: 'github', label: 'Open GitHub', desc: 'github.com/VipulPhatangare', icon: 'fab fa-github', url: 'https://github.com/VipulPhatangare' },
  { id: 'linkedin', label: 'Open LinkedIn', desc: 'LinkedIn profile', icon: 'fab fa-linkedin', url: 'https://www.linkedin.com/in/vipul-phatangare-2bba15384/' },
  { id: 'whatsapp', label: 'Message on WhatsApp', desc: '+91 8999741641', icon: 'fab fa-whatsapp', url: 'https://wa.me/+918999741641' },
  { id: 'admin', label: 'Admin Panel', desc: 'Manage portfolio content', icon: 'fas fa-shield-alt', url: '/admin/login' },
];

export default function CommandPalette({ onNavigate, onClose }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);

  const filtered = COMMANDS.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.desc.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const execute = (cmd) => {
    if (cmd.section) onNavigate(cmd.section);
    else if (cmd.url) {
      if (cmd.url.startsWith('/')) window.location.href = cmd.url;
      else window.open(cmd.url, '_blank');
    }
    onClose();
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter' && filtered[selected]) execute(filtered[selected]);
    else if (e.key === 'Escape') onClose();
  };

  return (
    <div className="cmd-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cmd-palette">
        <div className="cmd-search">
          <i className="fas fa-search cmd-search-icon"></i>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search sections, links..."
            className="cmd-input"
          />
          <kbd className="cmd-esc" onClick={onClose}>ESC</kbd>
        </div>
        <div className="cmd-results">
          {filtered.length > 0 ? filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              className={`cmd-item${i === selected ? ' cmd-item-selected' : ''}`}
              onClick={() => execute(cmd)}
              onMouseEnter={() => setSelected(i)}
            >
              <i className={cmd.icon}></i>
              <div className="cmd-item-text">
                <span className="cmd-item-label">{cmd.label}</span>
                <span className="cmd-item-desc">{cmd.desc}</span>
              </div>
              {cmd.section && <kbd>↵</kbd>}
            </div>
          )) : (
            <div className="cmd-empty">
              <i className="fas fa-search"></i>
              <span>No results for "{query}"</span>
            </div>
          )}
        </div>
        <div className="cmd-footer">
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Select</span>
          <span><kbd>ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { RESUME_TEMPLATES, FONT_OPTIONS, COLOR_PRESETS } from './templates.js';
import ModelSelect from '../../ModelSelect.jsx';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function DesignTab({ resume, onPrefChange }) {
  const prefs = resume.preferences || {};
  const activeTemplate = prefs.template || 'modern';
  const tpl = RESUME_TEMPLATES.find(t => t.id === activeTemplate) || RESUME_TEMPLATES[0];
  const effectiveAccent = HEX_RE.test(prefs.accentColor) ? prefs.accentColor : tpl.accent;
  const [customHex, setCustomHex] = useState(effectiveAccent);

  useEffect(() => { setCustomHex(effectiveAccent); }, [effectiveAccent]);

  return (
    <div className="ra-settings-section">
      <h5>Template</h5>
      <div className="ra-tpl-grid">
        {RESUME_TEMPLATES.map(t => (
          <button key={t.id} type="button"
            className={`ra-tpl-card${activeTemplate === t.id ? ' active' : ''}`}
            onClick={() => onPrefChange({ template: t.id })} title={t.desc}>
            <span className="ra-tpl-swatch" style={{ background: t.accent }} />
            <span className="ra-tpl-card-label">{t.label}</span>
            {activeTemplate === t.id && <i className="fas fa-circle-check ra-tpl-check"></i>}
          </button>
        ))}
      </div>

      <h5>Density</h5>
      <div className="ra-toggle-group">
        <button className={(prefs.density || 'comfortable') === 'comfortable' ? 'active' : ''}
          onClick={() => onPrefChange({ density: 'comfortable' })}>Comfortable</button>
        <button className={prefs.density === 'compact' ? 'active' : ''}
          onClick={() => onPrefChange({ density: 'compact' })}>Compact</button>
      </div>

      <h5>
        Accent color
        {prefs.accentColor && (
          <button className="ra-settings-reset" onClick={() => onPrefChange({ accentColor: '' })}>
            Reset to template default
          </button>
        )}
      </h5>
      <div className="ra-color-grid">
        {COLOR_PRESETS.map(c => (
          <button key={c.id} type="button"
            className={`ra-color-swatch${effectiveAccent.toLowerCase() === c.hex.toLowerCase() ? ' active' : ''}`}
            style={{ background: c.hex }} title={c.label}
            onClick={() => onPrefChange({ accentColor: c.hex })} />
        ))}
        <label className="ra-color-custom" title="Custom color">
          <input type="color" value={customHex}
            onChange={e => { setCustomHex(e.target.value); onPrefChange({ accentColor: e.target.value }); }} />
          <i className="fas fa-eye-dropper"></i>
        </label>
      </div>
      <p className="ra-muted ra-settings-hint">
        Used for headings{tpl.heading === 'band' ? ', including the heading background band' : ''} and links.
      </p>

      <h5>
        Font
        {prefs.fontFamily && (
          <button className="ra-settings-reset" onClick={() => onPrefChange({ fontFamily: '' })}>
            Reset to template default
          </button>
        )}
      </h5>
      <div className="ra-font-list">
        {FONT_OPTIONS.map(f => {
          const active = (prefs.fontFamily || '') === f.id;
          return (
            <button key={f.id} type="button"
              className={`ra-font-item${active ? ' active' : ''}`}
              style={{ fontFamily: f.css }}
              onClick={() => onPrefChange({ fontFamily: f.id })}>
              <span className="ra-font-sample">Aa</span>
              <span className="ra-font-meta">
                <span className="ra-font-label">{f.label}</span>
                <span className="ra-font-kind">{f.kind}</span>
              </span>
              {active && <i className="fas fa-circle-check ra-tpl-check"></i>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ContactTab({ profile, onProfileUpdate }) {
  const [form, setForm] = useState({
    email: profile?.email || '', phone: profile?.phone || '', location: profile?.location || '',
    portfolioUrl: profile?.portfolioUrl || '', githubUrl: profile?.githubUrl || '',
    linkedinUrl: profile?.linkedinUrl || '', leetcodeUrl: profile?.leetcodeUrl || ''
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const f = (k) => (e) => { setForm(prev => ({ ...prev, [k]: e.target.value })); setSaved(false); };

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await onProfileUpdate(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ra-settings-section">
      <p className="ra-muted ra-settings-hint">
        This is your portfolio-wide contact info — shown on every resume and cover letter you export.
      </p>
      <div className="ra-settings-grid">
        <div className="ra-field">
          <label>Email</label>
          <input value={form.email} onChange={f('email')} placeholder="you@example.com" />
        </div>
        <div className="ra-field">
          <label>Phone</label>
          <input value={form.phone} onChange={f('phone')} placeholder="+91 98765 43210" />
        </div>
        <div className="ra-field">
          <label>Location</label>
          <input value={form.location} onChange={f('location')} placeholder="Pune, India" />
        </div>
        <div className="ra-field">
          <label>Portfolio URL</label>
          <input value={form.portfolioUrl} onChange={f('portfolioUrl')} placeholder="https://yoursite.com" />
        </div>
        <div className="ra-field">
          <label>GitHub URL</label>
          <input value={form.githubUrl} onChange={f('githubUrl')} placeholder="https://github.com/..." />
        </div>
        <div className="ra-field">
          <label>LinkedIn URL</label>
          <input value={form.linkedinUrl} onChange={f('linkedinUrl')} placeholder="https://linkedin.com/in/..." />
        </div>
        <div className="ra-field">
          <label>LeetCode URL</label>
          <input value={form.leetcodeUrl} onChange={f('leetcodeUrl')} placeholder="https://leetcode.com/u/..." />
        </div>
      </div>
      {error && <p className="ra-error">{error}</p>}
      <button className="ra-primary-btn" onClick={save} disabled={saving}>
        {saving ? (<><i className="fas fa-spinner fa-spin"></i> Saving…</>)
          : saved ? (<><i className="fas fa-check"></i> Saved</>)
          : (<><i className="fas fa-floppy-disk"></i> Save contact info</>)}
      </button>
    </div>
  );
}

export default function SettingsModal({ resume, profile, onPrefChange, onProfileUpdate, onClose }) {
  const [tab, setTab] = useState('design');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // Intentionally no onClick-to-close on the backdrop — only the X button (or Esc) closes this.
    <div className="ra-settings-overlay">
      <div className="ra-settings-panel">
        <div className="ra-settings-header">
          <h4><i className="fas fa-gear"></i> Resume Settings</h4>
          <button className="ra-icon-btn" onClick={onClose} title="Close"><i className="fas fa-xmark"></i></button>
        </div>

        <div className="ra-toggle-group ra-settings-tabs">
          <button className={tab === 'design' ? 'active' : ''} onClick={() => setTab('design')}>
            <i className="fas fa-palette"></i> Design
          </button>
          <button className={tab === 'contact' ? 'active' : ''} onClick={() => setTab('contact')}>
            <i className="fas fa-address-card"></i> Contact Info
          </button>
          <button className={tab === 'model' ? 'active' : ''} onClick={() => setTab('model')}>
            <i className="fas fa-microchip"></i> Model
          </button>
        </div>

        <div className="ra-settings-body">
          {tab === 'design' && <DesignTab resume={resume} onPrefChange={onPrefChange} />}
          {tab === 'contact' && <ContactTab profile={profile} onProfileUpdate={onProfileUpdate} />}
          {tab === 'model' && (
            <div className="ra-settings-section">
              <p className="ra-muted ra-settings-hint">
                Which AI model writes and tailors your resume sections and cover letters.
                Defaults to the project-wide model — manage all models in the admin
                Model Management tab.
              </p>
              <ModelSelect feature="resume" label="Resume model" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

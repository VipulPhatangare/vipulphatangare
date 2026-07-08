import { useState } from 'react';

const LENGTHS = [
  { value: '1page', label: 'One page' },
  { value: '2page', label: 'Two pages' },
];
const TONES = [
  { value: 'formal', label: 'Formal' },
  { value: 'casual-confident', label: 'Casual-confident' },
];
const APPLICANT_TYPES = [
  { value: 'fresher', label: 'Fresher' },
  { value: 'experienced', label: 'Experienced' },
];

export default function IntakeForm({ onSubmit, loading }) {
  const [company, setCompany] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [jdMode, setJdMode] = useState('text'); // text | url
  const [jdText, setJdText] = useState('');
  const [jdUrl, setJdUrl] = useState('');
  const [preferences, setPreferences] = useState({
    length: '1page', tone: 'formal', applicantType: 'fresher', emphasis: ''
  });

  const setPref = (key, value) => setPreferences(p => ({ ...p, [key]: value }));
  // Company and role are auto-detected from the JD when left blank
  const canSubmit = jdMode === 'text' ? jdText.trim().length > 50 : jdUrl.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit || loading) return;
    onSubmit({
      company: company.trim(),
      roleTitle: roleTitle.trim(),
      jdText: jdMode === 'text' ? jdText.trim() : '',
      jdUrl: jdMode === 'url' ? jdUrl.trim() : '',
      preferences
    });
  };

  return (
    <form className="ra-intake" onSubmit={handleSubmit}>
      <div className="ra-intake-grid">
        <div className="ra-field">
          <label>Company name <span className="ra-muted">(blank = auto-detect from JD)</span></label>
          <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Google" />
        </div>
        <div className="ra-field">
          <label>Target role title <span className="ra-muted">(blank = auto-detect from JD)</span></label>
          <input value={roleTitle} onChange={e => setRoleTitle(e.target.value)} placeholder="e.g. ML Engineer Intern" />
        </div>
      </div>

      <div className="ra-field">
        <div className="ra-jd-header">
          <label>Job description *</label>
          <div className="ra-toggle-group">
            <button type="button" className={jdMode === 'text' ? 'active' : ''} onClick={() => setJdMode('text')}>
              <i className="fas fa-paste"></i> Paste text
            </button>
            <button type="button" className={jdMode === 'url' ? 'active' : ''} onClick={() => setJdMode('url')}>
              <i className="fas fa-link"></i> From URL
            </button>
          </div>
        </div>
        {jdMode === 'text' ? (
          <textarea rows={9} value={jdText} onChange={e => setJdText(e.target.value)}
            placeholder="Paste the full job description here (min ~50 characters)…" />
        ) : (
          <input value={jdUrl} onChange={e => setJdUrl(e.target.value)}
            placeholder="https://careers.example.com/job/12345" />
        )}
      </div>

      <div className="ra-prefs-row">
        <div className="ra-field">
          <label>Resume length</label>
          <div className="ra-toggle-group">
            {LENGTHS.map(o => (
              <button key={o.value} type="button" className={preferences.length === o.value ? 'active' : ''}
                onClick={() => setPref('length', o.value)}>{o.label}</button>
            ))}
          </div>
        </div>
        <div className="ra-field">
          <label>Tone</label>
          <div className="ra-toggle-group">
            {TONES.map(o => (
              <button key={o.value} type="button" className={preferences.tone === o.value ? 'active' : ''}
                onClick={() => setPref('tone', o.value)}>{o.label}</button>
            ))}
          </div>
        </div>
        <div className="ra-field">
          <label>Applicant type</label>
          <div className="ra-toggle-group">
            {APPLICANT_TYPES.map(o => (
              <button key={o.value} type="button" className={preferences.applicantType === o.value ? 'active' : ''}
                onClick={() => setPref('applicantType', o.value)}>{o.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="ra-field">
        <label>Emphasis (optional)</label>
        <input value={preferences.emphasis} onChange={e => setPref('emphasis', e.target.value)}
          placeholder='e.g. "emphasize my GenAI and agentic projects"' />
      </div>

      <button type="submit" className="ra-primary-btn" disabled={!canSubmit || loading}>
        {loading ? (<><i className="fas fa-spinner fa-spin"></i> Researching company & parsing JD…</>)
                 : (<><i className="fas fa-magnifying-glass-chart"></i> Start research</>)}
      </button>
    </form>
  );
}

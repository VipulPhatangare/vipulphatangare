import { useState } from 'react';
import ModelSelect from './ModelSelect.jsx';

const FEATURES = [
  { key: 'chatbot',  label: 'Portfolio Chatbot',   icon: 'fas fa-robot',              desc: 'Answers visitors using your knowledge base.' },
  { key: 'linkedin', label: 'LinkedIn Post Agent',  icon: 'fab fa-linkedin',           desc: 'Generates LinkedIn content components.' },
  { key: 'email',    label: 'Email Analyser Agent', icon: 'fas fa-envelope-open-text', desc: 'Analyses inbox mail and drafts replies/digests.' },
  { key: 'resume',   label: 'Resume Generator',     icon: 'fas fa-file-invoice',       desc: 'Writes and tailors resume sections + cover letters.' },
];

export default function ManageModels() {
  // Bumped whenever the global default changes so each feature card refetches
  // and its "Use global default (…)" label stays accurate.
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <div className="chatbot-panel" style={{ maxWidth: 820 }}>
      <div className="stat-card" style={{ marginBottom: '1.25rem' }}>
        <h3 className="chatbot-section-title">
          <i className="fas fa-microchip"></i> Global Default Model
        </h3>
        <p className="form-hint" style={{ marginBottom: '0.9rem' }}>
          The model every feature uses unless it has its own override below. Switch this
          once to move the whole project to a different model.
        </p>
        <ModelSelect
          onSaved={() => setRefreshToken(t => t + 1)}
          hint="Applies project-wide. Available: Gemini 2.5 Flash (Google), DeepSeek V4 Flash/Pro and Kimi K2.6 (NVIDIA)."
        />
      </div>

      <div className="stat-card">
        <h3 className="chatbot-section-title">
          <i className="fas fa-sliders"></i> Per-Feature Overrides
        </h3>
        <p className="form-hint" style={{ marginBottom: '1rem' }}>
          Each feature defaults to the global model. Override any one independently —
          e.g. keep the chatbot on Gemini while the resume agent uses DeepSeek V4 Pro.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {FEATURES.map(f => (
            <div key={f.key} style={{ borderTop: '1px solid var(--gray, rgba(128,128,128,0.2))', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.15rem' }}>
                <i className={f.icon}></i>
                <strong>{f.label}</strong>
              </div>
              <p className="form-hint" style={{ margin: '0 0 0.5rem' }}>{f.desc}</p>
              <ModelSelect feature={f.key} refreshToken={refreshToken} />
            </div>
          ))}
        </div>
      </div>

      <p className="form-hint" style={{ marginTop: '1rem' }}>
        <i className="fas fa-circle-info"></i> Knowledge-base <em>embeddings</em> (used for
        retrieval) run on OpenAI <code>text-embedding-3-small</code> and are unaffected by
        this setting — only the answer-generation model changes.
      </p>
    </div>
  );
}

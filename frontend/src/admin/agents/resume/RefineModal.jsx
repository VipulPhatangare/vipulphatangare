import { useState } from 'react';

// Chatbot-style repolish popup. Opened from a section/project Refine (broom) button.
// Closes ONLY via the Cancel button — no click-outside/overlay dismiss — so a
// half-typed instruction is never lost by an accidental click.
const QUICK_CHIPS = [
  'Add measurable metrics where truthful',
  'Emphasize leadership & ownership',
  'Make it more concise',
  'Use stronger action verbs',
  'Work in more ATS keywords',
];

export default function RefineModal({ title, busy, onApply, onCancel }) {
  const [instruction, setInstruction] = useState('');

  const addChip = (c) => setInstruction(prev => (prev.trim() ? `${prev.trim()}; ${c}` : c));

  return (
    <div className="ra-modal-overlay">
      <div className="ra-refine-modal" role="dialog" aria-modal="true">
        <div className="ra-refine-head">
          <span className="ra-refine-bot"><i className="fas fa-robot"></i></span>
          <div>
            <h4>Repolish — {title}</h4>
            <p className="ra-muted">Tell the AI what to focus on, or leave blank for a standard ATS polish.</p>
          </div>
        </div>

        <textarea
          autoFocus className="ra-refine-input" rows={3}
          value={instruction} onChange={e => setInstruction(e.target.value)}
          placeholder="e.g. emphasize backend scalability and add metrics where the work supports it"
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !busy) onApply(instruction.trim()); }}
        />

        <div className="ra-refine-chips">
          {QUICK_CHIPS.map(c => (
            <button key={c} type="button" className="ra-refine-chip" onClick={() => addChip(c)} disabled={busy}>
              <i className="fas fa-plus"></i> {c}
            </button>
          ))}
        </div>

        <div className="ra-refine-actions">
          <button className="ra-secondary-btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="ra-primary-btn" onClick={() => onApply(instruction.trim())} disabled={busy}>
            {busy
              ? <><i className="fas fa-spinner fa-spin"></i> Repolishing…</>
              : <><i className="fas fa-broom"></i> Repolish</>}
          </button>
        </div>
      </div>
    </div>
  );
}

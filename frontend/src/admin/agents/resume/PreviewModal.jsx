import { useEffect } from 'react';
import ResumePreview from './ResumePreview.jsx';

// Enlarged, popup view of the live resume preview. The inner ResumePreview
// auto-fits to its container width, so a wide modal renders the sheet at (near)
// full A4 size — much bigger than the narrow editor side panel.
export default function PreviewModal({ resume, profile, onClose }) {
  // Esc closes, matching the X button and the click-outside dismiss.
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ra-modal-overlay ra-preview-overlay" onClick={onClose}>
      <div className="ra-preview-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="ra-preview-modal-head">
          <span className="ra-preview-modal-title">
            <i className="fas fa-file-lines"></i> {resume.company} — {resume.roleTitle}
          </span>
          <button className="ra-icon-btn" onClick={onClose} title="Close preview (Esc)">
            <i className="fas fa-xmark"></i>
          </button>
        </div>
        <div className="ra-preview-modal-body">
          <ResumePreview resume={resume} profile={profile} />
        </div>
      </div>
    </div>
  );
}

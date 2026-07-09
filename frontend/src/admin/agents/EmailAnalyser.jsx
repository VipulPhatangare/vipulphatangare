import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios.js';

// ── HELPERS ─────────────────────────────────────────────

const PRIORITY_META = {
  high:   { label: 'High',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: 'fas fa-fire' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: 'fas fa-minus-circle' },
  low:    { label: 'Low',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   icon: 'fas fa-arrow-down-circle' }
};

const CATEGORY_META = {
  tnp:      { label: 'TNP / Placement', icon: 'fas fa-briefcase',      color: '#8b5cf6' },
  college:  { label: 'College',         icon: 'fas fa-graduation-cap', color: '#3b82f6' },
  personal: { label: 'Personal',        icon: 'fas fa-user',           color: '#ec4899' },
  work:     { label: 'Work',            icon: 'fas fa-laptop-code',    color: '#14b8a6' },
  general:  { label: 'General',         icon: 'fas fa-envelope',       color: '#94a3b8' }
};

const REPLY_URGENCY_META = {
  immediate:    { label: 'Reply ASAP',      color: '#ef4444', icon: 'fas fa-exclamation-circle' },
  within_24h:   { label: 'Reply within 24h', color: '#f59e0b', icon: 'fas fa-clock' },
  within_3days: { label: 'Reply in 3 days', color: '#3b82f6', icon: 'fas fa-reply' },
  none:         null
};

function deadlineDays(date) {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date()) / 86400000);
}

function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60)  return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function timeUntil(iso) {
  const secs = Math.floor((new Date(iso) - Date.now()) / 1000);
  if (secs <= 0) return 'soon';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function DeadlineBadge({ deadline, deadlineText }) {
  if (!deadline) return null;
  const days = deadlineDays(deadline);
  let color = '#22c55e', bg = 'rgba(34,197,94,0.12)', icon = 'fas fa-calendar-check';
  if (days < 0)       { color = '#94a3b8'; bg = 'rgba(148,163,184,0.12)'; icon = 'fas fa-calendar-times'; }
  else if (days <= 2) { color = '#ef4444'; bg = 'rgba(239,68,68,0.12)';   icon = 'fas fa-exclamation-triangle'; }
  else if (days <= 7) { color = '#f59e0b'; bg = 'rgba(245,158,11,0.12)';  icon = 'fas fa-clock'; }

  return (
    <span className="em-badge" style={{ color, background: bg, border: `1px solid ${color}33` }}>
      <i className={icon}></i>
      <span>
        {days < 0 ? 'Overdue' : days === 0 ? 'Due Today!' : `${days}d left`}
        {deadlineText && <span style={{ opacity: 0.7, fontWeight: 400 }}> · {deadlineText}</span>}
      </span>
    </span>
  );
}

function PriorityBadge({ priority }) {
  const m = PRIORITY_META[priority] || PRIORITY_META.medium;
  return (
    <span className="em-badge" style={{ color: m.color, background: m.bg, border: `1px solid ${m.color}33` }}>
      <i className={m.icon}></i><span>{m.label}</span>
    </span>
  );
}

function CategoryBadge({ category }) {
  const m = CATEGORY_META[category] || CATEGORY_META.general;
  return (
    <span className="em-badge" style={{ color: m.color, background: `${m.color}18`, border: `1px solid ${m.color}33` }}>
      <i className={m.icon}></i><span>{m.label}</span>
    </span>
  );
}

function ReplyUrgencyBadge({ urgency }) {
  const m = REPLY_URGENCY_META[urgency];
  if (!m) return null;
  return (
    <span className="em-badge" style={{ color: m.color, background: `${m.color}15`, border: `1px solid ${m.color}33` }}>
      <i className={m.icon}></i><span>{m.label}</span>
    </span>
  );
}

function FollowUpBadge({ followUpDate }) {
  if (!followUpDate) return null;
  const days = deadlineDays(followUpDate);
  const color = days < 0 ? '#94a3b8' : days <= 1 ? '#f59e0b' : '#a78bfa';
  return (
    <span className="em-badge" style={{ color, background: `${color}15`, border: `1px solid ${color}33` }}>
      <i className="fas fa-bell"></i>
      <span>{days < 0 ? 'Follow-up overdue' : days === 0 ? 'Follow up today' : `Follow up in ${days}d`}</span>
    </span>
  );
}

function EligibilityBadge({ eligible, reason }) {
  if (eligible === false) {
    return (
      <span className="em-badge" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
        <i className="fas fa-ban"></i>
        <span>Can't apply{reason ? ` · ${reason}` : ''}</span>
      </span>
    );
  }
  // Positive badge only when the AI gave a reason (i.e. an actual TNP opportunity) —
  // avoids a meaningless "You qualify" on ordinary mail.
  if (reason) {
    return (
      <span className="em-badge" style={{ color: '#22c55e', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
        <i className="fas fa-check-circle"></i>
        <span>You qualify</span>
      </span>
    );
  }
  return null;
}

function DeadlineItem({ email, dateField = 'deadline', textField = 'deadlineText' }) {
  const rawDate = email[dateField];
  const days = deadlineDays(rawDate);
  let urgency = 'safe';
  if (days < 0) urgency = 'overdue';
  else if (days <= 2) urgency = 'urgent';
  else if (days <= 7) urgency = 'warning';

  const colors = {
    overdue: { border: '#ef444466', bg: 'rgba(239,68,68,0.05)', text: '#ef4444' },
    urgent:  { border: '#ef444466', bg: 'rgba(239,68,68,0.05)', text: '#ef4444' },
    warning: { border: '#f59e0b66', bg: 'rgba(245,158,11,0.05)', text: '#f59e0b' },
    safe:    { border: '#22c55e44', bg: 'rgba(34,197,94,0.05)', text: '#22c55e' }
  };
  const c = colors[urgency];
  const dateStr = new Date(rawDate).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });

  return (
    <div className="em-deadline-item" style={{ borderLeft: `3px solid ${c.border}`, background: c.bg }}>
      <div className="em-deadline-left">
        <div className="em-deadline-counter" style={{ color: c.text, background: `${c.text}18` }}>
          {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today!' : `${days}d`}
        </div>
        <div className="em-deadline-textwrap">
          <div className="em-deadline-subject" title={email.subject}>{email.subject}</div>
          <div className="em-deadline-meta">
            {email[textField] && <span><i className="fas fa-clock"></i> {email[textField]}</span>}
            <span><i className="fas fa-calendar-alt"></i> {dateStr}</span>
            {email.from && <span className="em-deadline-from"><i className="fas fa-user-circle"></i> {email.from}</span>}
            {email.followUpNote && <span><i className="fas fa-sticky-note"></i> {email.followUpNote}</span>}
          </div>
        </div>
      </div>
      <div className="em-deadline-right">
        <PriorityBadge priority={email.priority} />
        {email.eligible === false && <EligibilityBadge eligible={false} reason={email.eligibilityReason} />}
        {email.tags?.slice(0, 2).map((t, i) => <span key={i} className="em-tag">#{t}</span>)}
      </div>
    </div>
  );
}

// ── EMAIL CARD (compact, opens modal) ────────────────────

function EmailCard({ email, onOpen, onToggleMark }) {
  const isUnread = email.status === 'unread';
  const ineligible = email.eligible === false;
  const date = new Date(email.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div
      className={`em-card em-card-clickable${isUnread ? ' em-card-unread' : ''}${ineligible ? ' em-card-ineligible' : ''}`}
      onClick={() => onOpen(email)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onOpen(email); }}
    >
      <div className="em-card-header">

        {/* Row 1 — Subject + star + open chevron */}
        <div className="em-card-row1">
          <div className="em-card-subject-wrap">
            {isUnread && <span className="em-unread-dot" />}
            <span className="em-card-subject">{email.subject}</span>
          </div>
          <div className="em-card-row1-actions">
            <button
              className={`em-star-btn${email.marked ? ' active' : ''}`}
              title={email.marked ? 'Unmark important' : 'Mark important'}
              onClick={e => { e.stopPropagation(); onToggleMark(email); }}
            >
              <i className={`${email.marked ? 'fas' : 'far'} fa-star`}></i>
            </button>
            <i className="fas fa-chevron-right em-chevron"></i>
          </div>
        </div>

        {/* Row 2 — Sender + date */}
        <div className="em-card-meta">
          {email.from && (
            <span className="em-card-meta-item">
              <i className="fas fa-user-circle"></i>
              {email.from}
            </span>
          )}
          <span className="em-card-meta-item">
            <i className="fas fa-calendar-alt"></i>
            {date}
          </span>
          {email.direction === 'outgoing' && (
            <span className="em-direction-badge">
              <i className="fas fa-paper-plane"></i><span>Sent</span>
            </span>
          )}
        </div>

        {/* Row 3 — Badges */}
        <div className="em-card-badges">
          <PriorityBadge priority={email.priority} />
          <CategoryBadge category={email.category} />
          {(email.eligible === false || email.eligibilityReason) && <EligibilityBadge eligible={email.eligible} reason={email.eligibilityReason} />}
          {email.requiresReply && <ReplyUrgencyBadge urgency={email.replyUrgency} />}
          {email.deadline && <DeadlineBadge deadline={email.deadline} deadlineText={email.deadlineText} />}
          {email.followUpDate && <FollowUpBadge followUpDate={email.followUpDate} />}
          {email.actionItems?.length > 0 && (
            <span className="em-badge" style={{ color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}>
              <i className="fas fa-tasks"></i><span>{email.actionItems.length} action{email.actionItems.length > 1 ? 's' : ''}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── EMAIL MODAL (popup with all actions) ─────────────────
// Exported so the dashboard can reuse the same popup for quick access.

export function EmailModal({ email, onClose, onStatusChange, onUpdate, onDelete, flash }) {
  const [updating, setUpdating]     = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(
    email.followUpDate ? new Date(email.followUpDate).toISOString().slice(0, 10) : ''
  );
  const [followUpNote, setFollowUpNote] = useState(email.followUpNote || '');
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [reply, setReply]           = useState(email.replyDraft || '');
  const [genReply, setGenReply]     = useState(false);
  const [savingReply, setSavingReply] = useState(false);

  // Mark unread → read on open
  useEffect(() => {
    if (email.status === 'unread') {
      api.patch(`/emails/${email._id}`, { status: 'read' })
        .then(() => onStatusChange(email._id, 'read'))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc closes + lock background scroll while open
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const updateStatus = async (status) => {
    setUpdating(true);
    try { await api.patch(`/emails/${email._id}`, { status }); onStatusChange(email._id, status); }
    finally { setUpdating(false); }
  };

  const toggleMark = async () => {
    try {
      const { data } = await api.patch(`/emails/${email._id}`, { marked: !email.marked });
      onUpdate(email._id, data);
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    try { await api.delete(`/emails/${email._id}`); onDelete(email._id); onClose(); }
    catch { /* ignore */ }
  };

  const handleSaveFollowUp = async () => {
    setSavingFollowUp(true);
    try {
      const { data } = await api.patch(`/emails/${email._id}`, {
        followUpDate: followUpDate ? new Date(followUpDate).toISOString() : null,
        followUpNote
      });
      onUpdate(email._id, data);
      flash('success', 'Follow-up reminder saved');
    } finally { setSavingFollowUp(false); }
  };

  const handleClearFollowUp = async () => {
    setFollowUpDate('');
    setFollowUpNote('');
    setSavingFollowUp(true);
    try {
      const { data } = await api.patch(`/emails/${email._id}`, { followUpDate: null, followUpNote: '' });
      onUpdate(email._id, data);
    } finally { setSavingFollowUp(false); }
  };

  const handleGenerateReply = async () => {
    setGenReply(true);
    try {
      const { data } = await api.post('/emails/generate-reply', { subject: email.subject, body: email.body });
      setReply(data.reply);
    } catch (err) {
      flash('error', err.response?.data?.error || 'Reply generation failed');
    } finally { setGenReply(false); }
  };

  const handleSaveReply = async () => {
    setSavingReply(true);
    try {
      const { data } = await api.patch(`/emails/${email._id}`, { replyDraft: reply });
      onUpdate(email._id, data);
      flash('success', 'Reply draft saved');
    } catch { /* ignore */ }
    finally { setSavingReply(false); }
  };

  const date = new Date(email.createdAt).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="em-modal-backdrop" onClick={onClose}>
      <div className="em-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">

        {/* Header */}
        <div className="em-modal-header">
          <div className="em-modal-title-wrap">
            <h3 className="em-modal-subject">{email.subject}</h3>
            <div className="em-modal-meta">
              {email.from && <span><i className="fas fa-user-circle"></i> {email.from}</span>}
              <span><i className="fas fa-calendar-alt"></i> {date}</span>
            </div>
          </div>
          <button className="em-modal-close" onClick={onClose} title="Close (Esc)">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Badges */}
        <div className="em-modal-badges">
          <PriorityBadge priority={email.priority} />
          <CategoryBadge category={email.category} />
          {(email.eligible === false || email.eligibilityReason) && <EligibilityBadge eligible={email.eligible} reason={email.eligibilityReason} />}
          {email.requiresReply && <ReplyUrgencyBadge urgency={email.replyUrgency} />}
          {email.deadline && <DeadlineBadge deadline={email.deadline} deadlineText={email.deadlineText} />}
          {email.followUpDate && <FollowUpBadge followUpDate={email.followUpDate} />}
        </div>

        {/* Scrollable body */}
        <div className="em-modal-body">

          {email.summary && (
            <div className="em-summary-box">
              <div className="em-summary-label"><i className="fas fa-robot"></i> AI Summary</div>
              <p>{email.summary}</p>
            </div>
          )}

          {email.actionItems?.length > 0 && (
            <div className="em-action-items-box">
              <div className="em-summary-label" style={{ color: '#34d399' }}>
                <i className="fas fa-tasks"></i> Action Items
              </div>
              <ul className="em-action-list">
                {email.actionItems.map((item, i) => (
                  <li key={i} className="em-action-item">
                    <i className="fas fa-arrow-right"></i>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {email.tags?.length > 0 && (
            <div className="em-tags" style={{ marginTop: '0.6rem' }}>
              {email.tags.map((t, i) => <span key={i} className="em-tag">#{t}</span>)}
            </div>
          )}

          <div className="em-body-text">
            <div className="em-body-label"><i className="fas fa-envelope-open"></i> Email Body</div>
            <pre className="em-body-pre">{email.body}</pre>
          </div>

          {/* Reply generator */}
          <div className="em-reply-box">
            <div className="em-modal-section-head">
              <span className="em-summary-label" style={{ margin: 0 }}><i className="fas fa-reply"></i> Reply</span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className="btn-secondary-sm" onClick={handleGenerateReply} disabled={genReply}>
                  {genReply ? <><i className="fas fa-spinner fa-spin"></i> Drafting…</> : <><i className="fas fa-magic"></i> Generate</>}
                </button>
                {reply && (
                  <button className="em-followup-save" onClick={handleSaveReply} disabled={savingReply}>
                    {savingReply ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-save"></i> Save draft</>}
                  </button>
                )}
              </div>
            </div>
            <textarea
              className="form-input chatbot-textarea"
              rows={6}
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Generate an AI reply or write your own draft…"
              style={{ marginTop: '0.5rem' }}
            />
          </div>

          {/* Follow-up tracker */}
          <div className="em-followup-section">
            <div className="em-followup-header">
              <span className="em-summary-label" style={{ color: '#a78bfa', margin: 0 }}>
                <i className="fas fa-bell"></i> Follow-up Tracker
              </span>
              {email.followUpDate && (
                <button className="em-followup-clear" onClick={handleClearFollowUp} disabled={savingFollowUp}>
                  <i className="fas fa-times"></i> Clear
                </button>
              )}
            </div>
            <div className="em-followup-fields">
              <input type="date" className="em-followup-date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
              <input
                type="text" className="em-followup-note" value={followUpNote}
                onChange={e => setFollowUpNote(e.target.value)}
                placeholder="Note — e.g. 'Check if they replied'"
              />
              <button className="em-followup-save" onClick={handleSaveFollowUp} disabled={savingFollowUp || !followUpDate}>
                {savingFollowUp ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-bell"></i> Set Reminder</>}
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="em-modal-footer">
          <div className="em-status-btns">
            {[
              { val: 'unread',   icon: 'fa-circle',  label: 'Unread'   },
              { val: 'read',     icon: 'fa-check',   label: 'Read'     },
              { val: 'replied',  icon: 'fa-reply',   label: 'Replied'  },
              { val: 'archived', icon: 'fa-archive', label: 'Archived' },
            ].map(s => (
              <button
                key={s.val}
                className={`em-status-btn${email.status === s.val ? ' active' : ''}`}
                onClick={() => updateStatus(s.val)}
                disabled={updating || email.status === s.val}
              >
                <i className={`fas ${s.icon}`}></i> {s.label}
              </button>
            ))}
          </div>
          <div className="em-modal-footer-right">
            <button className={`em-mark-btn${email.marked ? ' active' : ''}`} onClick={toggleMark}>
              <i className={`${email.marked ? 'fas' : 'far'} fa-star`}></i> {email.marked ? 'Marked' : 'Mark important'}
            </button>
            {delConfirm ? (
              <>
                <button className="btn-danger-sm" onClick={handleDelete}>
                  <i className="fas fa-check"></i> Confirm
                </button>
                <button className="btn-secondary-sm" onClick={() => setDelConfirm(false)}>Cancel</button>
              </>
            ) : (
              <button className="btn-danger-sm" onClick={() => setDelConfirm(true)}>
                <i className="fas fa-trash"></i> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── IMPORTANT TAB ────────────────────────────────────────
// Shows AI-flagged high-priority mail plus a short list of the nearest deadlines —
// replaces the old manual paste-and-analyse tool (analysis now only ever runs
// automatically against TNP mail during Gmail sync).

function ImportantTab({ flash }) {
  const [emails, setEmails]       = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [active, setActive]       = useState(null); // email open in modal

  const load = async () => {
    setLoading(true);
    try {
      // High-priority mail + anything the user manually starred (marked). Merge unique.
      const [impRes, markRes, dlRes] = await Promise.all([
        api.get('/emails?priority=high&direction=incoming'),
        api.get('/emails?marked=true&direction=incoming'),
        api.get('/emails/deadlines')
      ]);
      const map = new Map();
      [...(impRes.data.emails || []), ...(markRes.data.emails || [])].forEach(e => map.set(e._id, e));
      // Ineligible (wrong-branch) mail is demoted — don't surface it as "important" unless starred.
      const merged = [...map.values()]
        .filter(e => e.eligible !== false || e.marked)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setEmails(merged);

      const now = Date.now();
      // Only deadlines Vipul can actually act on (eligible) clutter-free.
      const all = (dlRes.data || []).filter(e => e.eligible !== false);
      const overdue = all
        .filter(e => new Date(e.deadline).getTime() < now)
        .sort((a, b) => new Date(b.deadline) - new Date(a.deadline));
      const upcoming = all
        .filter(e => new Date(e.deadline).getTime() >= now)
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
      // Limited list: at most 2 most-recently-overdue, filled out with the soonest upcoming, capped at 5.
      setDeadlines([...overdue.slice(0, 2), ...upcoming].slice(0, 5));
    } catch {
      flash('error', 'Failed to load important mail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleStatusChange = (id, status) => {
    setEmails(prev => prev.map(e => e._id === id ? { ...e, status } : e));
    setActive(prev => prev && prev._id === id ? { ...prev, status } : prev);
  };
  const handleDelete = (id) => { setEmails(prev => prev.filter(e => e._id !== id)); flash('success', 'Email deleted'); };
  const handleUpdate = (id, updated) => {
    setEmails(prev => prev.map(e => e._id === id ? updated : e));
    setActive(prev => prev && prev._id === id ? updated : prev);
  };
  const toggleMark = async (email) => {
    try {
      const { data } = await api.patch(`/emails/${email._id}`, { marked: !email.marked });
      handleUpdate(email._id, data);
    } catch { /* ignore */ }
  };

  // Deadline list items carry only partial data — fetch the full email for the popup.
  const openFull = async (partial) => {
    try {
      const { data } = await api.get(`/emails/${partial._id}`);
      setActive(data);
    } catch { setActive(partial); }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  const overdueCount = deadlines.filter(e => new Date(e.deadline).getTime() < Date.now()).length;

  return (
    <div className="chatbot-panel">
      {/* Summary hero */}
      <div className="em-important-hero">
        <div className="em-important-hero-text">
          <h3><i className="fas fa-star"></i> What needs your attention</h3>
          <p>AI-flagged high-priority TNP mail and the nearest deadlines, all in one place.</p>
        </div>
        <div className="em-important-hero-stats">
          <div className="em-hero-stat" style={{ '--hc': '#ef4444' }}>
            <span className="em-hero-stat-num">{emails.length}</span>
            <span className="em-hero-stat-label">Important</span>
          </div>
          <div className="em-hero-stat" style={{ '--hc': '#f59e0b' }}>
            <span className="em-hero-stat-num">{deadlines.length}</span>
            <span className="em-hero-stat-label">Deadlines</span>
          </div>
          <div className="em-hero-stat" style={{ '--hc': overdueCount > 0 ? '#ef4444' : '#22c55e' }}>
            <span className="em-hero-stat-num">{overdueCount}</span>
            <span className="em-hero-stat-label">Overdue</span>
          </div>
        </div>
      </div>

      <div className="stat-card" style={{ marginBottom: '1rem' }}>
        <h3 className="chatbot-section-title">
          <i className="fas fa-clock"></i> Upcoming Deadlines
          {deadlines.length > 0 && <span className="chatbot-count">{deadlines.length}</span>}
        </h3>
        {deadlines.length === 0 ? (
          <div className="chatbot-empty" style={{ padding: '1rem' }}>
            <i className="fas fa-calendar-check"></i>
            <p>No deadlines to show right now.</p>
          </div>
        ) : (
          <div className="em-deadline-list">
            {deadlines.map(e => (
              <div key={e._id} className="em-deadline-clickable" onClick={() => openFull(e)}>
                <DeadlineItem email={e} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="stat-card">
        <h3 className="chatbot-section-title">
          <i className="fas fa-star"></i> Important Mail
          {emails.length > 0 && <span className="chatbot-count">{emails.length}</span>}
        </h3>
        {emails.length === 0 ? (
          <div className="chatbot-empty" style={{ padding: '1rem' }}>
            <i className="fas fa-inbox"></i>
            <p>No important mail yet — high-priority TNP mail (and anything you star) shows up here.</p>
          </div>
        ) : (
          <div className="em-email-list">
            {emails.map(email => (
              <EmailCard key={email._id} email={email} onOpen={setActive} onToggleMark={toggleMark} />
            ))}
          </div>
        )}
      </div>

      {active && (
        <EmailModal
          email={active}
          onClose={() => setActive(null)}
          onStatusChange={handleStatusChange}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          flash={flash}
        />
      )}
    </div>
  );
}

// ── INBOX TAB ────────────────────────────────────────────

const EMPTY_FILTERS = { search: '', priority: '', category: '', status: '', hasDeadline: false, requiresReply: false };

function InboxTab({ flash }) {
  const [emails, setEmails]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filters, setFilters]       = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage]             = useState(1);
  const [pages, setPages]           = useState(1);
  const [total, setTotal]           = useState(0);
  const [syncDays, setSyncDays]     = useState(7);
  const [syncing, setSyncing]       = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [autoStatus, setAutoStatus] = useState(null);
  const [active, setActive]         = useState(null); // email open in modal
  const searchTimer = useRef(null);

  const loadAutoStatus = async () => {
    try {
      const { data } = await api.get('/emails/sync-status');
      setAutoStatus(data);
    } catch { /* silent */ }
  };

  useEffect(() => {
    loadAutoStatus();
    const t = setInterval(loadAutoStatus, 60000); // refresh every 60s
    return () => clearInterval(t);
  }, []);

  const load = async (p = 1, f = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p });
      if (f.search)      params.set('q', f.search);
      if (f.priority)    params.set('priority', f.priority);
      if (f.category)    params.set('category', f.category);
      if (f.status)      params.set('status', f.status);
      if (f.hasDeadline) params.set('hasDeadline', 'true');
      if (f.requiresReply) params.set('requiresReply', 'true');
      const { data } = await api.get(`/emails?${params}`);
      setEmails(data.emails);
      setPage(data.page);
      setPages(data.pages);
      setTotal(data.total);
    } catch {
      flash('error', 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1, filters); }, []);

  const applyFilter = (key, val) => {
    const f = { ...filters, [key]: val };
    setFilters(f);
    load(1, f);
  };

  const applyToggleFilter = (key) => {
    const f = { ...filters, [key]: !filters[key] };
    setFilters(f);
    load(1, f);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchInput('');
    load(1, EMPTY_FILTERS);
  };

  const handleSearchChange = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const f = { ...filters, search: val };
      setFilters(f);
      load(1, f);
    }, 400);
  };

  const handleStatusChange = (id, status) => {
    setEmails(prev => prev.map(e => e._id === id ? { ...e, status } : e));
    setActive(prev => prev && prev._id === id ? { ...prev, status } : prev);
  };

  const handleDelete = (id) => {
    setEmails(prev => prev.filter(e => e._id !== id));
    setTotal(t => t - 1);
    flash('success', 'Email deleted');
  };

  const handleUpdate = (id, updated) => {
    setEmails(prev => prev.map(e => e._id === id ? updated : e));
    setActive(prev => prev && prev._id === id ? updated : prev);
  };

  const toggleMark = async (email) => {
    try {
      const { data } = await api.patch(`/emails/${email._id}`, { marked: !email.marked });
      handleUpdate(email._id, data);
    } catch { /* ignore */ }
  };

  const handleGmailSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data } = await api.post('/emails/sync-gmail', { days: syncDays });
      setSyncResult(data);
      if (data.saved > 0) {
        const tnpNote = data.analyzed > 0
          ? ` · ${data.analyzed} TNP mail AI-analysed`
          : ' · no TNP mail to analyse';
        flash('success', `Synced ${data.saved} new email${data.saved !== 1 ? 's' : ''}${tnpNote}`);
        load(1, filters);
      } else {
        flash('success', `All ${data.fetched} emails already in inbox — nothing new`);
      }
    } catch (err) {
      flash('error', err.response?.data?.error || 'Gmail sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkReanalyze = async () => {
    setReanalyzing(true);
    try {
      const { data } = await api.post('/emails/bulk-reanalyze');
      flash('success', `Re-analysed ${data.reanalyzed} email${data.reanalyzed !== 1 ? 's' : ''}`);
      if (data.reanalyzed > 0) load(1, filters);
    } catch (err) {
      flash('error', err.response?.data?.error || 'Re-analyse failed');
    } finally {
      setReanalyzing(false);
    }
  };

  // Compute active filters as chips
  const activeChips = [];
  if (filters.search)      activeChips.push({ key: 'search',      label: `"${filters.search}"` });
  if (filters.priority)    activeChips.push({ key: 'priority',    label: `${PRIORITY_META[filters.priority]?.label} Priority` });
  if (filters.category)    activeChips.push({ key: 'category',    label: CATEGORY_META[filters.category]?.label });
  if (filters.status)      activeChips.push({ key: 'status',      label: filters.status.charAt(0).toUpperCase() + filters.status.slice(1) });
  if (filters.hasDeadline) activeChips.push({ key: 'hasDeadline', label: 'Has Deadline' });
  if (filters.requiresReply) activeChips.push({ key: 'requiresReply', label: 'Needs Reply' });

  const removeChip = (key) => {
    const resetVal = (key === 'hasDeadline' || key === 'requiresReply') ? false : '';
    const f = { ...filters, [key]: resetVal };
    setFilters(f);
    if (key === 'search') setSearchInput('');
    load(1, f);
  };

  return (
    <div className="chatbot-panel">

      {/* ── GMAIL SYNC PANEL ── */}
      <div className="stat-card em-sync-card">

        {/* Auto-sync status bar */}
        {autoStatus?.enabled && (
          <div className="em-autosync-bar">
            <span className="em-autosync-indicator">
              <span className={`em-autosync-dot${autoStatus.running ? ' em-autosync-dot-pulse' : ''}`}></span>
              {autoStatus.running ? 'Auto-syncing now…' : 'Auto-sync ON'}
            </span>
            <span className="em-autosync-meta">
              {autoStatus.lastRunAt && (
                <span>
                  <i className="fas fa-history"></i>
                  Last: {timeAgo(autoStatus.lastRunAt)}
                  {autoStatus.lastResult && ` · ${autoStatus.lastResult.saved} new`}
                </span>
              )}
              {autoStatus.nextRunAt && !autoStatus.running && (
                <span>
                  <i className="fas fa-forward"></i>
                  Next: {timeUntil(autoStatus.nextRunAt)}
                </span>
              )}
              <span><i className="fas fa-clock"></i> every 4h</span>
            </span>
            {autoStatus.lastError && (
              <span className="em-autosync-error">
                <i className="fas fa-exclamation-triangle"></i> {autoStatus.lastError}
              </span>
            )}
          </div>
        )}

        <div className="em-sync-header">
          <div className="em-sync-title">
            <i className="fab fa-google" style={{ color: '#ea4335' }}></i>
            <span>Sync from Gmail</span>
            <span className="em-sync-subtitle">Fetches all mail from Gmail — only TNP mail (from the placement cell) gets AI-analysed for priority & deadlines</span>
          </div>
          <div className="em-sync-controls">
            <button
              className="btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.8rem' }}
              onClick={handleBulkReanalyze}
              disabled={reanalyzing}
              title="Re-run AI analysis on emails that failed during sync"
            >
              {reanalyzing
                ? <><i className="fas fa-spinner fa-spin"></i> Re-analysing…</>
                : <><i className="fas fa-redo"></i> Re-analyse</>}
            </button>
            <div className="em-sync-days-wrap">
              <span className="em-sync-days-label">Last</span>
              <select
                className="em-sync-days-select"
                value={syncDays}
                onChange={e => setSyncDays(Number(e.target.value))}
                disabled={syncing}
              >
                {[1, 3, 7, 14, 30].map(d => (
                  <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>
                ))}
              </select>
            </div>
            <button className="btn-primary" onClick={handleGmailSync} disabled={syncing}>
              {syncing
                ? <><i className="fas fa-spinner fa-spin"></i> Syncing…</>
                : <><i className="fas fa-cloud-download-alt"></i> Sync Now</>}
            </button>
          </div>
        </div>

        {syncing && (
          <div className="em-sync-progress">
            <div className="em-sync-progress-bar">
              <div className="em-sync-progress-fill"></div>
            </div>
            <div className="em-sync-steps">
              <span className="em-sync-step active"><i className="fas fa-satellite-dish"></i> Connecting to Gmail IMAP</span>
              <i className="fas fa-arrow-right em-sync-arrow"></i>
              <span className="em-sync-step active"><i className="fas fa-download"></i> Fetching last {syncDays} days</span>
              <i className="fas fa-arrow-right em-sync-arrow"></i>
              <span className="em-sync-step active"><i className="fas fa-robot"></i> AI analysing TNP mail only</span>
              <i className="fas fa-arrow-right em-sync-arrow"></i>
              <span className="em-sync-step active"><i className="fas fa-database"></i> Saving all to inbox</span>
            </div>
            <p className="em-sync-note">Only mail from the placement cell (srawandale@gmail.com) is AI-analysed — the rest is fetched straight to your inbox.</p>
          </div>
        )}

        {syncResult && !syncing && (
          <div className="em-sync-result">
            <div className="em-sync-stat">
              <span className="em-sync-stat-num">{syncResult.fetched}</span>
              <span className="em-sync-stat-label">Fetched</span>
            </div>
            <div className="em-sync-stat em-sync-stat-new">
              <span className="em-sync-stat-num">{syncResult.saved}</span>
              <span className="em-sync-stat-label">New in Inbox</span>
            </div>
            <div className="em-sync-stat em-sync-stat-tnp">
              <span className="em-sync-stat-num">{syncResult.analyzed ?? 0}</span>
              <span className="em-sync-stat-label">TNP Analysed</span>
            </div>
            <div className="em-sync-stat">
              <span className="em-sync-stat-num">{syncResult.skipped}</span>
              <span className="em-sync-stat-label">Already in Inbox</span>
            </div>
          </div>
        )}
      </div>

      {/* ── INBOX LIST ── */}
      <div className="stat-card">
        <div className="em-inbox-header">
          <h3 className="chatbot-section-title" style={{ margin: 0 }}>
            <i className="fas fa-inbox"></i> Inbox
            <span className="chatbot-count">{total}</span>
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className={`em-filter-pill${showFilters ? ' active' : ''}`}
              onClick={() => setShowFilters(s => !s)}
            >
              <i className="fas fa-sliders-h"></i> Filters
              {activeChips.length > 0 && (
                <span className="em-filter-count">{activeChips.length}</span>
              )}
            </button>
            <button className="btn-secondary" onClick={() => load(page)}>
              <i className="fas fa-sync-alt"></i>
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="em-search-wrap">
          <i className="fas fa-search em-search-icon"></i>
          <input
            type="text"
            className="em-search-input"
            placeholder="Search by subject, sender, or tag…"
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
          />
          {searchInput && (
            <button className="em-search-clear" onClick={() => handleSearchChange('')}>
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="em-active-chips">
            {activeChips.map(chip => (
              <span key={chip.key} className="em-active-chip">
                {chip.label}
                <button className="em-chip-remove" onClick={() => removeChip(chip.key)}>
                  <i className="fas fa-times"></i>
                </button>
              </span>
            ))}
            <button className="em-clear-all" onClick={clearFilters}>
              Clear all
            </button>
          </div>
        )}

        {/* Collapsible filter panel */}
        {showFilters && (
          <div className="em-filter-panel">
            <div className="em-filter-group">
              <span className="em-filter-group-label">Priority</span>
              <div className="em-filter-pills-row">
                {[{ val: '', label: 'All' }, { val: 'high', label: '🔴 High' }, { val: 'medium', label: '🟡 Medium' }, { val: 'low', label: '🟢 Low' }].map(p => (
                  <button
                    key={p.val}
                    className={`em-filter-pill${filters.priority === p.val ? ' active' : ''}`}
                    onClick={() => applyFilter('priority', p.val)}
                  >{p.label}</button>
                ))}
              </div>
            </div>
            <div className="em-filter-group">
              <span className="em-filter-group-label">Category</span>
              <div className="em-filter-pills-row">
                {[{ val: '', label: 'All' }, { val: 'tnp', label: '💼 TNP' }, { val: 'college', label: '🎓 College' }, { val: 'work', label: '💻 Work' }, { val: 'personal', label: '👤 Personal' }, { val: 'general', label: '📧 General' }].map(p => (
                  <button
                    key={p.val}
                    className={`em-filter-pill${filters.category === p.val ? ' active' : ''}`}
                    onClick={() => applyFilter('category', p.val)}
                  >{p.label}</button>
                ))}
              </div>
            </div>
            <div className="em-filter-group">
              <span className="em-filter-group-label">Status</span>
              <div className="em-filter-pills-row">
                {[{ val: '', label: 'All' }, { val: 'unread', label: 'Unread' }, { val: 'read', label: 'Read' }, { val: 'replied', label: 'Replied' }, { val: 'archived', label: 'Archived' }].map(p => (
                  <button
                    key={p.val}
                    className={`em-filter-pill${filters.status === p.val ? ' active' : ''}`}
                    onClick={() => applyFilter('status', p.val)}
                  >{p.label}</button>
                ))}
              </div>
            </div>
            <div className="em-filter-group">
              <span className="em-filter-group-label">Quick</span>
              <div className="em-filter-pills-row">
                <button
                  className={`em-filter-pill${filters.hasDeadline ? ' active' : ''}`}
                  onClick={() => applyToggleFilter('hasDeadline')}
                >
                  <i className="fas fa-clock"></i> Has Deadline
                </button>
                <button
                  className={`em-filter-pill${filters.requiresReply ? ' active' : ''}`}
                  onClick={() => applyToggleFilter('requiresReply')}
                >
                  <i className="fas fa-reply"></i> Needs Reply
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : emails.length === 0 ? (
          <div className="chatbot-empty">
            <i className="fas fa-inbox"></i>
            <p>{activeChips.length > 0 ? 'No emails match your filters.' : 'No emails yet. Click "Sync Now" above to fetch your Gmail inbox.'}</p>
          </div>
        ) : (
          <>
            <div className="em-email-list">
              {emails.map(email => (
                <EmailCard key={email._id} email={email} onOpen={setActive} onToggleMark={toggleMark} />
              ))}
            </div>
            {pages > 1 && (
              <div className="pagination" style={{ marginTop: '1rem' }}>
                <button disabled={page <= 1} onClick={() => load(page - 1)}>
                  <i className="fas fa-chevron-left"></i>
                </button>
                <span>Page {page} of {pages}</span>
                <button disabled={page >= pages} onClick={() => load(page + 1)}>
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {active && (
        <EmailModal
          email={active}
          onClose={() => setActive(null)}
          onStatusChange={handleStatusChange}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          flash={flash}
        />
      )}
    </div>
  );
}

// ── DIGEST TAB ───────────────────────────────────────────

function DigestTab({ flash }) {
  const [loading, setLoading]   = useState(false);
  const [digest, setDigest]     = useState(null);
  const [stats, setStats]       = useState(null);

  const generateDigest = async () => {
    setLoading(true);
    setDigest(null);
    setStats(null);
    try {
      const { data } = await api.get('/emails/digest');
      setDigest(data.digest);
      setStats(data.stats);
    } catch (err) {
      flash('error', err.response?.data?.error || 'Digest generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatbot-panel">
      <div className="stat-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h3 className="chatbot-section-title" style={{ margin: 0 }}>
              <i className="fas fa-newspaper"></i> Daily Digest
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.83rem', margin: '0.3rem 0 0' }}>
              AI reads all your unread emails and gives you a smart summary of what matters
            </p>
          </div>
          <button className="btn-primary" onClick={generateDigest} disabled={loading} style={{ flexShrink: 0 }}>
            {loading
              ? <><i className="fas fa-spinner fa-spin"></i> Generating…</>
              : <><i className="fas fa-magic"></i> Generate Digest</>}
          </button>
        </div>

        {!digest && !loading && (
          <div className="em-empty-state" style={{ minHeight: 180 }}>
            <i className="fas fa-newspaper"></i>
            <p>Click "Generate Digest" to get an AI-powered briefing of your unread inbox — what's urgent, what needs action, and what can wait.</p>
          </div>
        )}

        {loading && (
          <div className="em-empty-state" style={{ minHeight: 180 }}>
            <div className="spinner"></div>
            <p>Reading your inbox and generating briefing…</p>
          </div>
        )}

        {stats && !loading && (
          <div className="em-digest-stats">
            <div className="em-digest-stat">
              <i className="em-digest-stat-icon fas fa-inbox"></i>
              <span className="em-digest-stat-num">{stats.total}</span>
              <span className="em-digest-stat-label">Unread</span>
            </div>
            <div className="em-digest-stat em-digest-stat-high">
              <i className="em-digest-stat-icon fas fa-fire"></i>
              <span className="em-digest-stat-num">{stats.high}</span>
              <span className="em-digest-stat-label">High Priority</span>
            </div>
            <div className="em-digest-stat em-digest-stat-reply">
              <i className="em-digest-stat-icon fas fa-reply"></i>
              <span className="em-digest-stat-num">{stats.needsReply}</span>
              <span className="em-digest-stat-label">Needs Reply</span>
            </div>
            <div className="em-digest-stat em-digest-stat-deadline">
              <i className="em-digest-stat-icon fas fa-clock"></i>
              <span className="em-digest-stat-num">{stats.withDeadline}</span>
              <span className="em-digest-stat-label">Deadlines</span>
            </div>
            <div className="em-digest-stat em-digest-stat-action">
              <i className="em-digest-stat-icon fas fa-tasks"></i>
              <span className="em-digest-stat-num">{stats.actionCount}</span>
              <span className="em-digest-stat-label">Actions</span>
            </div>
          </div>
        )}

        {digest && !loading && (
          <div className="em-digest-output">
            <div className="em-summary-label" style={{ marginBottom: '0.6rem' }}>
              <i className="fas fa-robot"></i> AI Briefing
            </div>
            <pre className="em-digest-text">{digest}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DEADLINES TAB ────────────────────────────────────────

function DeadlinesTab({ flash }) {
  const [emails, setEmails]     = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('deadlines');
  const [active, setActive]     = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [dlRes, fuRes] = await Promise.all([
        api.get('/emails/deadlines'),
        api.get('/emails/followups')
      ]);
      setEmails(dlRes.data);
      setFollowUps(fuRes.data);
    } catch {
      flash('error', 'Failed to load deadlines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Silent refresh — refetch lists without the full-screen spinner (keeps the modal open)
  const refresh = async () => {
    try {
      const [dlRes, fuRes] = await Promise.all([api.get('/emails/deadlines'), api.get('/emails/followups')]);
      setEmails(dlRes.data);
      setFollowUps(fuRes.data);
    } catch { /* keep current data */ }
  };

  const openFull = async (partial) => {
    try { const { data } = await api.get(`/emails/${partial._id}`); setActive(data); }
    catch { setActive(partial); }
  };
  const handleStatusChange = (id, status) => setActive(prev => prev && prev._id === id ? { ...prev, status } : prev);
  const handleUpdate = (id, updated) => {
    setActive(prev => prev && prev._id === id ? updated : prev);
    refresh();
  };
  const handleDelete = () => { setActive(null); refresh(); flash('success', 'Email deleted'); };

  const now = new Date();
  const overdue  = emails.filter(e => e.deadline && new Date(e.deadline) < now);
  const upcoming = emails.filter(e => e.deadline && new Date(e.deadline) >= now);

  const fuOverdue  = followUps.filter(e => e.followUpDate && new Date(e.followUpDate) < now);
  const fuUpcoming = followUps.filter(e => e.followUpDate && new Date(e.followUpDate) >= now);

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="chatbot-panel">
      {/* Sub-tabs */}
      <div className="em-sub-tabs">
        <button
          className={`em-sub-tab${tab === 'deadlines' ? ' active' : ''}`}
          onClick={() => setTab('deadlines')}
        >
          <i className="fas fa-clock"></i> Deadlines
          {emails.length > 0 && <span className="chatbot-count" style={{ fontSize: '0.72rem', padding: '1px 6px' }}>{emails.length}</span>}
        </button>
        <button
          className={`em-sub-tab${tab === 'followups' ? ' active' : ''}`}
          onClick={() => setTab('followups')}
        >
          <i className="fas fa-bell"></i> Follow-ups
          {followUps.length > 0 && <span className="chatbot-count" style={{ fontSize: '0.72rem', padding: '1px 6px', background: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}>{followUps.length}</span>}
        </button>
      </div>

      {tab === 'deadlines' && (
        emails.length === 0 ? (
          <div className="chatbot-empty">
            <i className="fas fa-calendar-check"></i>
            <p>No deadlines found. Analyse emails with deadlines and save them to track here.</p>
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <div className="stat-card" style={{ marginBottom: '1rem' }}>
                <h3 className="chatbot-section-title" style={{ color: '#ef4444' }}>
                  <i className="fas fa-exclamation-triangle"></i> Overdue
                  <span className="chatbot-count" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>{overdue.length}</span>
                </h3>
                <div className="em-deadline-list">
                  {overdue.map(e => (
                    <div key={e._id} className="em-deadline-clickable" onClick={() => openFull(e)}>
                      <DeadlineItem email={e} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="stat-card">
                <h3 className="chatbot-section-title">
                  <i className="fas fa-calendar-alt"></i> Upcoming
                  <span className="chatbot-count">{upcoming.length}</span>
                </h3>
                <div className="em-deadline-list">
                  {upcoming.map(e => (
                    <div key={e._id} className="em-deadline-clickable" onClick={() => openFull(e)}>
                      <DeadlineItem email={e} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )
      )}

      {tab === 'followups' && (
        followUps.length === 0 ? (
          <div className="chatbot-empty">
            <i className="fas fa-bell"></i>
            <p>No follow-ups set. Open an email in your inbox and set a follow-up date using the tracker at the bottom of the email.</p>
          </div>
        ) : (
          <>
            {fuOverdue.length > 0 && (
              <div className="stat-card" style={{ marginBottom: '1rem' }}>
                <h3 className="chatbot-section-title" style={{ color: '#f59e0b' }}>
                  <i className="fas fa-bell"></i> Overdue Follow-ups
                  <span className="chatbot-count" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>{fuOverdue.length}</span>
                </h3>
                <div className="em-deadline-list">
                  {fuOverdue.map(e => (
                    <div key={e._id} className="em-deadline-clickable" onClick={() => openFull(e)}>
                      <DeadlineItem email={e} dateField="followUpDate" textField="followUpNote" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {fuUpcoming.length > 0 && (
              <div className="stat-card">
                <h3 className="chatbot-section-title" style={{ color: '#a78bfa' }}>
                  <i className="fas fa-bell"></i> Upcoming Follow-ups
                  <span className="chatbot-count" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>{fuUpcoming.length}</span>
                </h3>
                <div className="em-deadline-list">
                  {fuUpcoming.map(e => (
                    <div key={e._id} className="em-deadline-clickable" onClick={() => openFull(e)}>
                      <DeadlineItem email={e} dateField="followUpDate" textField="followUpNote" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )
      )}

      {active && (
        <EmailModal
          email={active}
          onClose={() => setActive(null)}
          onStatusChange={handleStatusChange}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          flash={flash}
        />
      )}
    </div>
  );
}

// ── COMPOSE TAB ──────────────────────────────────────────

function ComposeTab({ flash }) {
  const [form, setForm]       = useState({ to: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    setSent(false);
    try {
      await api.post('/emails/send', form);
      flash('success', `Email sent to ${form.to}`);
      setSent(true);
      setForm({ to: '', subject: '', body: '' });
    } catch (err) {
      flash('error', err.response?.data?.error || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chatbot-panel">
      <div className="stat-card">
        <h3 className="chatbot-section-title"><i className="fas fa-paper-plane"></i> Compose & Send Email</h3>

        <div className="em-smtp-info">
          <i className="fas fa-info-circle"></i>
          Sends from <strong>{import.meta.env.VITE_EMAIL_USER || 'your Gmail'}</strong> via Gmail SMTP.
          To enable, add <code>EMAIL_USER</code> and <code>EMAIL_PASS</code> (App Password) to <code>backend/.env</code>.
        </div>

        {sent && (
          <div className="admin-alert admin-alert-success">
            <i className="fas fa-check-circle"></i> Email sent successfully!
          </div>
        )}

        <form onSubmit={handleSend}>
          <div className="form-group">
            <label>To <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="email" className="form-input" placeholder="recipient@example.com"
              value={form.to} onChange={e => set('to', e.target.value)} required
            />
          </div>
          <div className="form-group">
            <label>Subject <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text" className="form-input" placeholder="Email subject..."
              value={form.subject} onChange={e => set('subject', e.target.value)} required
            />
          </div>
          <div className="form-group">
            <label>Message <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea
              className="form-input chatbot-textarea" rows={10}
              placeholder="Write your email here..."
              value={form.body} onChange={e => set('body', e.target.value)} required
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={sending}>
            {sending
              ? <><i className="fas fa-spinner fa-spin"></i> Sending…</>
              : <><i className="fas fa-paper-plane"></i> Send Email</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── SETTINGS TAB ─────────────────────────────────────────

function SettingsTab({ flash }) {
  const [senders, setSenders]   = useState([]);
  const [newSender, setNewSender] = useState('');
  const [guidance, setGuidance] = useState('');
  const [defaultGuidance, setDefaultGuidance] = useState('');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/emails/config/settings');
      setSenders(data.trustedSenders || []);
      setGuidance(data.analysisGuidance || '');
      setDefaultGuidance(data.defaultGuidance || '');
    } catch {
      flash('error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addSender = () => {
    const s = newSender.trim().toLowerCase();
    if (!s) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) { flash('error', 'Enter a valid email address'); return; }
    if (senders.includes(s)) { flash('error', 'That sender is already in the list'); return; }
    setSenders(prev => [...prev, s]);
    setNewSender('');
  };

  const removeSender = (s) => setSenders(prev => prev.filter(x => x !== s));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/emails/config/settings', { trustedSenders: senders, analysisGuidance: guidance });
      setSenders(data.trustedSenders || []);
      setGuidance(data.analysisGuidance || '');
      flash('success', 'Settings saved — applies to the next Gmail sync');
    } catch (err) {
      flash('error', err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetGuidance = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/emails/config/settings', { resetGuidance: true });
      setGuidance(data.analysisGuidance || '');
      flash('success', 'Analysis prompt reset to default');
    } catch {
      flash('error', 'Failed to reset prompt');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="chatbot-panel">
      {/* Trusted senders */}
      <div className="stat-card" style={{ marginBottom: '1rem' }}>
        <h3 className="chatbot-section-title"><i className="fas fa-user-shield"></i> Trusted TNP Senders</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.83rem', margin: '0 0 1rem' }}>
          Only mail from these addresses is AI-analysed for priority, eligibility and deadlines. Everything else goes straight to your inbox untouched. Add a backup placement-cell address here anytime — no code change needed.
        </p>

        <div className="em-sender-list">
          {senders.length === 0 ? (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No senders — analysis is effectively off.</span>
          ) : senders.map(s => (
            <span key={s} className="em-sender-chip">
              <i className="fas fa-envelope"></i> {s}
              <button onClick={() => removeSender(s)} title="Remove"><i className="fas fa-times"></i></button>
            </span>
          ))}
        </div>

        <div className="em-sender-add">
          <input
            type="email"
            className="form-input"
            placeholder="add-another@college.edu"
            value={newSender}
            onChange={e => setNewSender(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSender(); } }}
          />
          <button className="btn-secondary" onClick={addSender}><i className="fas fa-plus"></i> Add</button>
        </div>
      </div>

      {/* Analysis prompt */}
      <div className="stat-card">
        <div className="em-modal-section-head" style={{ marginBottom: '0.5rem' }}>
          <h3 className="chatbot-section-title" style={{ margin: 0 }}><i className="fas fa-robot"></i> AI Analysis Prompt</h3>
          <button className="btn-secondary-sm" onClick={resetGuidance} disabled={saving} title="Restore the built-in default rules">
            <i className="fas fa-undo"></i> Reset to default
          </button>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.83rem', margin: '0 0 0.8rem' }}>
          These are the rules Gemini follows when classifying TNP mail — priority, branch eligibility, categories and reply urgency. Your live skills &amp; education and the strict JSON output format are added automatically, so editing this can't break analysis.
        </p>
        <textarea
          className="form-input chatbot-textarea"
          rows={16}
          value={guidance}
          onChange={e => setGuidance(e.target.value)}
          spellCheck={false}
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem', lineHeight: 1.6 }}
        />
        {defaultGuidance && guidance.trim() !== defaultGuidance.trim() && (
          <p style={{ color: '#f59e0b', fontSize: '0.78rem', margin: '0.5rem 0 0' }}>
            <i className="fas fa-pen"></i> Customised — differs from the default rules.
          </p>
        )}
      </div>

      <button className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={save} disabled={saving}>
        {saving ? <><i className="fas fa-spinner fa-spin"></i> Saving…</> : <><i className="fas fa-save"></i> Save Settings</>}
      </button>
    </div>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────

export default function EmailAnalyser() {
  const [tab, setTab] = useState('important');
  const [msg, setMsg] = useState(null);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4500);
  };

  const TABS = [
    { id: 'important', label: 'Important', icon: 'fas fa-star' },
    { id: 'inbox',     label: 'Inbox',     icon: 'fas fa-inbox' },
    { id: 'digest',    label: 'Digest',    icon: 'fas fa-newspaper' },
    { id: 'deadlines', label: 'Deadlines', icon: 'fas fa-clock' },
    { id: 'compose',   label: 'Compose',   icon: 'fas fa-paper-plane' },
    { id: 'settings',  label: 'Settings',  icon: 'fas fa-cog' }
  ];

  return (
    <div className="li-generator-wrap">
      {msg && (
        <div className={`admin-alert admin-alert-${msg.type}`}>
          <i className={`fas ${msg.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {msg.text}
        </div>
      )}

      <div className="chatbot-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`chatbot-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <i className={t.icon}></i> {t.label}
          </button>
        ))}
      </div>

      {tab === 'important' && <ImportantTab flash={flash} />}
      {tab === 'inbox'     && <InboxTab flash={flash} />}
      {tab === 'digest'    && <DigestTab flash={flash} />}
      {tab === 'deadlines' && <DeadlinesTab flash={flash} />}
      {tab === 'compose'   && <ComposeTab flash={flash} />}
      {tab === 'settings'  && <SettingsTab flash={flash} />}
    </div>
  );
}

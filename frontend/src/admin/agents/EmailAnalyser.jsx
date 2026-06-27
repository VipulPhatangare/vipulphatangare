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
      {days < 0 ? 'Overdue' : days === 0 ? 'Due Today!' : `${days}d left`}
      {deadlineText && <span style={{ opacity: 0.7, marginLeft: 4, fontWeight: 400 }}>· {deadlineText}</span>}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const m = PRIORITY_META[priority] || PRIORITY_META.medium;
  return (
    <span className="em-badge" style={{ color: m.color, background: m.bg, border: `1px solid ${m.color}33` }}>
      <i className={m.icon}></i> {m.label}
    </span>
  );
}

function CategoryBadge({ category }) {
  const m = CATEGORY_META[category] || CATEGORY_META.general;
  return (
    <span className="em-badge" style={{ color: m.color, background: `${m.color}18`, border: `1px solid ${m.color}33` }}>
      <i className={m.icon}></i> {m.label}
    </span>
  );
}

function ReplyUrgencyBadge({ urgency }) {
  const m = REPLY_URGENCY_META[urgency];
  if (!m) return null;
  return (
    <span className="em-badge" style={{ color: m.color, background: `${m.color}15`, border: `1px solid ${m.color}33` }}>
      <i className={m.icon}></i> {m.label}
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
      {days < 0 ? 'Follow-up overdue' : days === 0 ? 'Follow up today' : `Follow up in ${days}d`}
    </span>
  );
}

// ── EMAIL CARD ───────────────────────────────────────────

function EmailCard({ email, onStatusChange, onDelete, onUpdate }) {
  const [expanded, setExpanded]     = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const [updating, setUpdating]     = useState(false);
  const [followUpDate, setFollowUpDate] = useState(
    email.followUpDate ? new Date(email.followUpDate).toISOString().slice(0, 10) : ''
  );
  const [followUpNote, setFollowUpNote] = useState(email.followUpNote || '');
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const updateStatus = async (status) => {
    setUpdating(true);
    try {
      await api.patch(`/emails/${email._id}`, { status });
      onStatusChange(email._id, status);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    try { await api.delete(`/emails/${email._id}`); onDelete(email._id); }
    catch { /* ignore */ }
  };

  const handleSaveFollowUp = async () => {
    setSavingFollowUp(true);
    try {
      const updated = await api.patch(`/emails/${email._id}`, {
        followUpDate: followUpDate ? new Date(followUpDate).toISOString() : null,
        followUpNote
      });
      onUpdate(email._id, updated.data);
    } finally {
      setSavingFollowUp(false);
    }
  };

  const handleClearFollowUp = async () => {
    setFollowUpDate('');
    setFollowUpNote('');
    setSavingFollowUp(true);
    try {
      const updated = await api.patch(`/emails/${email._id}`, { followUpDate: null, followUpNote: '' });
      onUpdate(email._id, updated.data);
    } finally {
      setSavingFollowUp(false);
    }
  };

  const isUnread = email.status === 'unread';
  const date = new Date(email.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className={`em-card${isUnread ? ' em-card-unread' : ''}`}>
      <div className="em-card-header" onClick={() => { setExpanded(e => !e); if (isUnread) updateStatus('read'); }}>

        {/* Row 1 — Subject + chevron */}
        <div className="em-card-row1">
          <div className="em-card-subject-wrap">
            {isUnread && <span className="em-unread-dot" />}
            <span className="em-card-subject">{email.subject}</span>
          </div>
          <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} em-chevron`}></i>
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
              <i className="fas fa-paper-plane"></i> Sent
            </span>
          )}
        </div>

        {/* Row 3 — Badges */}
        <div className="em-card-badges">
          <PriorityBadge priority={email.priority} />
          <CategoryBadge category={email.category} />
          {email.requiresReply && <ReplyUrgencyBadge urgency={email.replyUrgency} />}
          {email.deadline && <DeadlineBadge deadline={email.deadline} deadlineText={email.deadlineText} />}
          {email.followUpDate && <FollowUpBadge followUpDate={email.followUpDate} />}
          {email.actionItems?.length > 0 && (
            <span className="em-badge" style={{ color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}>
              <i className="fas fa-tasks"></i> {email.actionItems.length} action{email.actionItems.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="em-card-body">

          {/* AI Summary */}
          {email.summary && (
            <div className="em-summary-box">
              <div className="em-summary-label"><i className="fas fa-robot"></i> AI Summary</div>
              <p>{email.summary}</p>
            </div>
          )}

          {/* Action Items */}
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

          {/* Tags */}
          {email.tags?.length > 0 && (
            <div className="em-tags" style={{ marginTop: '0.6rem' }}>
              {email.tags.map((t, i) => <span key={i} className="em-tag">#{t}</span>)}
            </div>
          )}

          {/* Full body */}
          <div className="em-body-text">
            <div className="em-body-label"><i className="fas fa-envelope-open"></i> Email Body</div>
            <pre className="em-body-pre">{email.body}</pre>
          </div>

          {/* Reply draft */}
          {email.replyDraft && (
            <div className="em-reply-box">
              <div className="em-summary-label"><i className="fas fa-reply"></i> Reply Draft</div>
              <pre className="em-body-pre">{email.replyDraft}</pre>
            </div>
          )}

          {/* Follow-up Tracker */}
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
              <input
                type="date"
                className="em-followup-date"
                value={followUpDate}
                onChange={e => setFollowUpDate(e.target.value)}
              />
              <input
                type="text"
                className="em-followup-note"
                value={followUpNote}
                onChange={e => setFollowUpNote(e.target.value)}
                placeholder="Note — e.g. 'Check if they replied'"
              />
              <button
                className="em-followup-save"
                onClick={handleSaveFollowUp}
                disabled={savingFollowUp || !followUpDate}
              >
                {savingFollowUp
                  ? <i className="fas fa-spinner fa-spin"></i>
                  : <><i className="fas fa-bell"></i> Set Reminder</>}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="em-card-actions">
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
                  onClick={(e) => { e.stopPropagation(); updateStatus(s.val); }}
                  disabled={updating || email.status === s.val}
                >
                  <i className={`fas ${s.icon}`}></i> {s.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {delConfirm ? (
                <>
                  <button className="btn-danger-sm" onClick={(e) => { e.stopPropagation(); handleDelete(); }}>
                    <i className="fas fa-check"></i> Confirm
                  </button>
                  <button className="btn-secondary-sm" onClick={(e) => { e.stopPropagation(); setDelConfirm(false); }}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className="btn-danger-sm" onClick={(e) => { e.stopPropagation(); setDelConfirm(true); }}>
                  <i className="fas fa-trash"></i> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ANALYZE TAB ──────────────────────────────────────────

function AnalyzeTab({ flash }) {
  const [form, setForm]           = useState({ from: '', subject: '', body: '' });
  const [analysis, setAnalysis]   = useState(null);
  const [reply, setReply]         = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [genReply, setGenReply]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [replyVisible, setReplyVisible] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.body.trim()) return;
    setAnalyzing(true);
    setAnalysis(null);
    setReply('');
    setReplyVisible(false);
    try {
      const { data } = await api.post('/emails/analyze', { subject: form.subject, body: form.body });
      setAnalysis(data);
    } catch (err) {
      flash('error', err.response?.data?.error || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateReply = async () => {
    setGenReply(true);
    setReplyVisible(true);
    try {
      const { data } = await api.post('/emails/generate-reply', { subject: form.subject, body: form.body });
      setReply(data.reply);
    } catch (err) {
      flash('error', err.response?.data?.error || 'Reply generation failed');
    } finally {
      setGenReply(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/emails', {
        from:         form.from,
        subject:      form.subject,
        body:         form.body,
        summary:      analysis?.summary || '',
        priority:     analysis?.priority || 'medium',
        category:     analysis?.category || 'general',
        replyDraft:   reply,
        deadline:     analysis?.deadline || null,
        deadlineText: analysis?.deadlineText || '',
        tags:         analysis?.tags || [],
        actionItems:  analysis?.actionItems || [],
        requiresReply: analysis?.requiresReply || false,
        replyUrgency:  analysis?.replyUrgency || 'none',
        status:       'unread',
        direction:    'incoming'
      });
      flash('success', 'Email saved to inbox');
      setForm({ from: '', subject: '', body: '' });
      setAnalysis(null);
      setReply('');
      setReplyVisible(false);
    } catch (err) {
      flash('error', err.response?.data?.error || 'Failed to save email');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="em-analyze-layout">
      {/* Input Panel */}
      <div className="em-analyze-left">
        <div className="stat-card">
          <h3 className="chatbot-section-title"><i className="fas fa-search"></i> Paste Email to Analyse</h3>
          <form onSubmit={handleAnalyze}>
            <div className="form-group">
              <label>From (Sender)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. tnp@college.edu"
                value={form.from}
                onChange={e => set('from', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Subject <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="Email subject line..."
                value={form.subject}
                onChange={e => set('subject', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Email Body <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea
                className="form-input chatbot-textarea"
                rows={10}
                placeholder="Paste the full email content here..."
                value={form.body}
                onChange={e => set('body', e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={analyzing || !form.subject.trim() || !form.body.trim()}
              style={{ width: '100%' }}
            >
              {analyzing
                ? <><i className="fas fa-spinner fa-spin"></i> Analysing…</>
                : <><i className="fas fa-magic"></i> Analyse Email</>}
            </button>
          </form>
        </div>
      </div>

      {/* Results Panel */}
      <div className="em-analyze-right">
        {!analysis && !analyzing && (
          <div className="em-empty-state">
            <i className="fas fa-envelope-open-text"></i>
            <p>Paste an email and click Analyse to get AI insights — summary, priority, category, action items, deadline extraction and reply urgency.</p>
          </div>
        )}

        {analyzing && (
          <div className="em-empty-state">
            <div className="spinner"></div>
            <p>Analysing email with Gemini AI…</p>
          </div>
        )}

        {analysis && !analyzing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Priority + Category + Reply urgency */}
            <div className="stat-card">
              <h3 className="chatbot-section-title" style={{ marginBottom: '1rem' }}>
                <i className="fas fa-chart-bar"></i> Classification
              </h3>
              <div className="em-result-badges">
                <div className="em-result-badge-group">
                  <span className="em-result-label">Priority</span>
                  <PriorityBadge priority={analysis.priority} />
                </div>
                <div className="em-result-badge-group">
                  <span className="em-result-label">Category</span>
                  <CategoryBadge category={analysis.category} />
                </div>
                {analysis.requiresReply && (
                  <div className="em-result-badge-group">
                    <span className="em-result-label">Reply</span>
                    <ReplyUrgencyBadge urgency={analysis.replyUrgency} />
                  </div>
                )}
              </div>

              {analysis.deadline && (
                <div className="em-deadline-row">
                  <i className="fas fa-clock" style={{ color: '#f59e0b' }}></i>
                  <DeadlineBadge deadline={analysis.deadline} deadlineText={analysis.deadlineText} />
                </div>
              )}

              {analysis.tags?.length > 0 && (
                <div className="em-tags" style={{ marginTop: '0.75rem' }}>
                  {analysis.tags.map((t, i) => <span key={i} className="em-tag">#{t}</span>)}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="stat-card">
              <h3 className="chatbot-section-title" style={{ marginBottom: '0.75rem' }}>
                <i className="fas fa-robot"></i> AI Summary
              </h3>
              <p style={{ lineHeight: 1.7, color: 'var(--text-primary)', margin: 0 }}>{analysis.summary}</p>
            </div>

            {/* Action Items */}
            {analysis.actionItems?.length > 0 && (
              <div className="stat-card">
                <h3 className="chatbot-section-title" style={{ marginBottom: '0.75rem', color: '#34d399' }}>
                  <i className="fas fa-tasks"></i> Action Items
                </h3>
                <ul className="em-action-list">
                  {analysis.actionItems.map((item, i) => (
                    <li key={i} className="em-action-item">
                      <i className="fas fa-arrow-right"></i>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reply Generator */}
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 className="chatbot-section-title" style={{ margin: 0 }}>
                  <i className="fas fa-reply"></i> Reply Generator
                </h3>
                <button
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}
                  onClick={handleGenerateReply}
                  disabled={genReply}
                >
                  {genReply
                    ? <><i className="fas fa-spinner fa-spin"></i> Generating…</>
                    : <><i className="fas fa-magic"></i> Generate Reply</>}
                </button>
              </div>

              {replyVisible && (
                <div>
                  {genReply ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
                      <i className="fas fa-spinner fa-spin"></i> Drafting reply…
                    </div>
                  ) : (
                    <textarea
                      className="form-input chatbot-textarea"
                      rows={8}
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder="Reply draft will appear here…"
                    />
                  )}
                </div>
              )}

              {!replyVisible && !genReply && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                  Click "Generate Reply" to draft a professional response using AI.
                </p>
              )}
            </div>

            {/* Save Button */}
            <button
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? <><i className="fas fa-spinner fa-spin"></i> Saving…</>
                : <><i className="fas fa-save"></i> Save to Inbox</>}
            </button>
          </div>
        )}
      </div>
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
  const searchTimer = useRef(null);

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
  };

  const handleDelete = (id) => {
    setEmails(prev => prev.filter(e => e._id !== id));
    setTotal(t => t - 1);
    flash('success', 'Email deleted');
  };

  const handleUpdate = (id, updated) => {
    setEmails(prev => prev.map(e => e._id === id ? updated : e));
  };

  const handleGmailSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data } = await api.post('/emails/sync-gmail', { days: syncDays });
      setSyncResult(data);
      if (data.saved > 0) {
        flash('success', `Synced ${data.saved} new email${data.saved !== 1 ? 's' : ''} from Gmail`);
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
        <div className="em-sync-header">
          <div className="em-sync-title">
            <i className="fab fa-google" style={{ color: '#ea4335' }}></i>
            <span>Sync from Gmail</span>
            <span className="em-sync-subtitle">Fetches emails, runs AI analysis, saves to inbox automatically</span>
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
              <span className="em-sync-step active"><i className="fas fa-robot"></i> AI analysing each email</span>
              <i className="fas fa-arrow-right em-sync-arrow"></i>
              <span className="em-sync-step active"><i className="fas fa-database"></i> Saving to inbox</span>
            </div>
            <p className="em-sync-note">This may take 30–90 seconds depending on email volume. Please wait…</p>
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
              <span className="em-sync-stat-label">New & Analysed</span>
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
                <EmailCard
                  key={email._id}
                  email={email}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                />
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

  const now = new Date();
  const overdue  = emails.filter(e => e.deadline && new Date(e.deadline) < now);
  const upcoming = emails.filter(e => e.deadline && new Date(e.deadline) >= now);

  const fuOverdue  = followUps.filter(e => e.followUpDate && new Date(e.followUpDate) < now);
  const fuUpcoming = followUps.filter(e => e.followUpDate && new Date(e.followUpDate) >= now);

  const DeadlineItem = ({ email, dateField = 'deadline', textField = 'deadlineText' }) => {
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
          <div>
            <div className="em-deadline-subject">{email.subject}</div>
            <div className="em-deadline-meta">
              {email[textField] && <span><i className="fas fa-clock"></i> {email[textField]}</span>}
              <span><i className="fas fa-calendar-alt"></i> {dateStr}</span>
              {email.from && <span><i className="fas fa-user-circle"></i> {email.from}</span>}
              {email.followUpNote && <span><i className="fas fa-sticky-note"></i> {email.followUpNote}</span>}
            </div>
          </div>
        </div>
        <div className="em-deadline-right">
          <PriorityBadge priority={email.priority} />
          <CategoryBadge category={email.category} />
          {email.tags?.slice(0, 2).map((t, i) => <span key={i} className="em-tag">#{t}</span>)}
        </div>
      </div>
    );
  };

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
                  {overdue.map(e => <DeadlineItem key={e._id} email={e} />)}
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
                  {upcoming.map(e => <DeadlineItem key={e._id} email={e} />)}
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
                  {fuOverdue.map(e => <DeadlineItem key={e._id} email={e} dateField="followUpDate" textField="followUpNote" />)}
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
                  {fuUpcoming.map(e => <DeadlineItem key={e._id} email={e} dateField="followUpDate" textField="followUpNote" />)}
                </div>
              </div>
            )}
          </>
        )
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

// ── MAIN COMPONENT ───────────────────────────────────────

export default function EmailAnalyser() {
  const [tab, setTab] = useState('analyze');
  const [msg, setMsg] = useState(null);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4500);
  };

  const TABS = [
    { id: 'analyze',   label: 'Analyse',   icon: 'fas fa-search' },
    { id: 'inbox',     label: 'Inbox',     icon: 'fas fa-inbox' },
    { id: 'digest',    label: 'Digest',    icon: 'fas fa-newspaper' },
    { id: 'deadlines', label: 'Deadlines', icon: 'fas fa-clock' },
    { id: 'compose',   label: 'Compose',   icon: 'fas fa-paper-plane' }
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

      {tab === 'analyze'   && <AnalyzeTab flash={flash} />}
      {tab === 'inbox'     && <InboxTab flash={flash} />}
      {tab === 'digest'    && <DigestTab flash={flash} />}
      {tab === 'deadlines' && <DeadlinesTab flash={flash} />}
      {tab === 'compose'   && <ComposeTab flash={flash} />}
    </div>
  );
}

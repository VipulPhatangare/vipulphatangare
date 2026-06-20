import { useState, useEffect } from 'react';
import api from '../api/axios.js';
import ConfirmModal from './ConfirmModal.jsx';

export default function ManageMessages() {
  const [messages, setMessages] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [flash,        setFlash]        = useState(null);
  const [expanded,     setExpanded]     = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const showFlash = (type, text) => {
    setFlash({ type, text });
    setTimeout(() => setFlash(null), 4000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/contact');
      setMessages(data);
    } catch {
      showFlash('error', 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    try {
      const { data } = await api.patch(`/contact/${id}/read`);
      setMessages(ms => ms.map(m => m._id === id ? data : m));
    } catch {
      showFlash('error', 'Failed to mark as read');
    }
  };

  const del = async () => {
    try {
      await api.delete(`/contact/${deleteTarget}`);
      setMessages(ms => ms.filter(m => m._id !== deleteTarget));
      if (expanded === deleteTarget) setExpanded(null);
      setDeleteTarget(null);
    } catch {
      showFlash('error', 'Failed to delete message');
    }
  };

  const unread = messages.filter(m => !m.isRead).length;

  return (
    <div>
      {flash && (
        <div className={`admin-alert admin-alert-${flash.type}`}>
          <i className={`fas ${flash.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {flash.text}
        </div>
      )}

      <div className="admin-section-header">
        <h2>
          Messages ({messages.length})
          {unread > 0 && <span className="msg-unread-badge">{unread} new</span>}
        </h2>
        <button className="btn-secondary" onClick={load}>
          <i className="fas fa-sync-alt"></i> Refresh
        </button>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : messages.length === 0 ? (
        <div className="chatbot-empty">
          <i className="fas fa-inbox"></i>
          <p>No messages yet. They'll appear here once someone contacts you.</p>
        </div>
      ) : (
        <div className="msg-list">
          {messages.map(m => (
            <div key={m._id} className={`msg-card${m.isRead ? ' msg-read' : ' msg-unread'}`}>
              {/* Header row */}
              <div className="msg-header">
                <div className="msg-sender">
                  <div className="msg-avatar">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="msg-meta">
                    <span className="msg-name">{m.name}</span>
                    {!m.isRead && <span className="msg-new-dot"></span>}
                    <span className="msg-date">
                      {new Date(m.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
                <div className="msg-actions-top">
                  {!m.isRead && (
                    <button className="msg-btn-read" onClick={() => markRead(m._id)} title="Mark as read">
                      <i className="fas fa-check"></i>
                    </button>
                  )}
                  <button className="msg-btn-expand" onClick={() => setExpanded(expanded === m._id ? null : m._id)}>
                    <i className={`fas fa-chevron-${expanded === m._id ? 'up' : 'down'}`}></i>
                  </button>
                  <button className="msg-btn-delete" onClick={() => setDeleteTarget(m._id)} title="Delete">
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>

              {/* Contact info strip */}
              <div className="msg-info-strip">
                <span className="msg-info-item">
                  <i className="fas fa-phone"></i> {m.phone}
                </span>
                {m.email && (
                  <span className="msg-info-item">
                    <i className="fas fa-envelope"></i> {m.email}
                  </span>
                )}
              </div>

              {/* Message preview / full */}
              <div className="msg-body">
                {expanded === m._id
                  ? <p className="msg-text">{m.message}</p>
                  : <p className="msg-preview">{m.message.slice(0, 120)}{m.message.length > 120 ? '…' : ''}</p>
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          message="Delete this message? This cannot be undone."
          onConfirm={del}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

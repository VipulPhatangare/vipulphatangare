import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (
    <div className="dh-clock">
      <span className="dh-time">
        {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="dh-date">
        {DAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()}
      </span>
    </div>
  );
}

const PRIORITY_COLOR = { high: '#ff6b6b', medium: '#ffd43b', low: '#51cf66' };
const PRIORITY_ICON  = { high: 'fas fa-fire', medium: 'fas fa-minus', low: 'fas fa-arrow-down' };

export default function DashboardHome() {
  const navigate = useNavigate();
  const today = todayStr();

  const [todos, setTodos]       = useState([]);
  const [newTodo, setNewTodo]   = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [todoFilter, setTodoFilter]   = useState('all');
  const [addingTodo, setAddingTodo]   = useState(false);

  const [pinnedKeys, setPinnedKeys]   = useState([]);
  const [revealed, setRevealed]       = useState({});  // { id: 'keyvalue' }
  const [copiedId, setCopiedId]       = useState(null);

  const [emailStats, setEmailStats]   = useState(null);

  useEffect(() => {
    // Today's todos
    loadTodos();

    // Pinned API keys
    api.get('/apikeys').then(res => {
      setPinnedKeys(res.data.filter(k => k.pinned).slice(0, 3));
    }).catch(console.error);

    // Email info
    api.get('/emails?status=unread&direction=incoming').then(res => {
      setEmailStats({
        unread: res.data.total || 0,
        high:   (res.data.emails || []).filter(e => e.priority === 'high').length,
      });
    }).catch(() => {});
  }, []);

  function loadTodos() {
    api.get(`/todos?date=${today}`).then(res => setTodos(res.data)).catch(console.error);
  }

  async function addTodo(e) {
    e.preventDefault();
    if (!newTodo.trim()) return;
    setAddingTodo(true);
    try {
      const res = await api.post('/todos', { text: newTodo.trim(), date: today, priority: newPriority });
      setTodos(prev => [...prev, res.data]);
      setNewTodo('');
    } catch (err) { console.error(err); }
    setAddingTodo(false);
  }

  async function toggleTodo(id, done) {
    setTodos(prev => prev.map(t => t._id === id ? { ...t, done: !done } : t));
    await api.patch(`/todos/${id}`, { done: !done }).catch(console.error);
  }

  async function deleteTodo(id) {
    setTodos(prev => prev.filter(t => t._id !== id));
    await api.delete(`/todos/${id}`).catch(console.error);
  }

  async function revealKey(id) {
    if (revealed[id]) {
      setRevealed(prev => { const n = { ...prev }; delete n[id]; return n; });
      return;
    }
    try {
      const res = await api.get(`/apikeys/${id}/reveal`);
      setRevealed(prev => ({ ...prev, [id]: res.data.key }));
    } catch (err) { console.error(err); }
  }

  function copyKey(id, value) {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const QUICK_LINKS = [
    { path: '/portfolio/projects',  icon: 'fas fa-code',           label: 'Projects',    color: '#4d8ee8' },
    { path: '/portfolio/skills',    icon: 'fas fa-cogs',           label: 'Skills',      color: '#51cf66' },
    { path: '/portfolio/notes',     icon: 'fas fa-book',           label: 'Notes',       color: '#ff922b' },
    { path: '/agents/email',        icon: 'fas fa-envelope',       label: 'Emails',      color: '#7a4ced' },
    { path: '/dailynotes',          icon: 'fas fa-calendar-day',   label: 'Daily Notes', color: '#ff6b6b' },
    { path: '/apikeys',             icon: 'fas fa-key',            label: 'API Keys',    color: '#ffd43b' },
    { path: '/portfolio/achievements', icon: 'fas fa-trophy',      label: 'Achieve.',    color: '#ff922b' },
    { path: '/messages',            icon: 'fas fa-comments',       label: 'Messages',    color: '#4d8ee8' },
  ];

  const filtered = todos.filter(t => {
    if (todoFilter === 'active') return !t.done;
    if (todoFilter === 'done')   return t.done;
    return true;
  });

  const doneCount = todos.filter(t => t.done).length;
  const remaining = todos.filter(t => !t.done).length;
  const donePct   = todos.length ? Math.round((doneCount / todos.length) * 100) : 0;

  return (
    <div className="dh-root">

      {/* ── Banner ─────────────────────────────── */}
      <div className="dh-banner">
        <div className="dh-banner-left">
          <div className="dh-greeting">{getGreeting()}, Vipul</div>
          <div className="dh-subtitle">
            {todos.length === 0
              ? 'No tasks yet today — add one below'
              : remaining === 0
              ? `All ${todos.length} tasks done`
              : `${remaining} task${remaining > 1 ? 's' : ''} left today`}
          </div>
        </div>
        <LiveClock />
      </div>

      {/* ── Main Grid ──────────────────────────── */}
      <div className="dh-grid">

        {/* ── LEFT: Daily Todos ─────────────────── */}
        <div className="dh-panel">
          <div className="dh-panel-hd">
            <div className="dh-panel-title">
              <i className="fas fa-check-square"></i>
              <span>Today's Tasks</span>
            </div>
            {todos.length > 0 && (
              <div className="dh-progress">
                <div className="dh-prog-track">
                  <div className="dh-prog-fill" style={{ width: `${donePct}%` }}></div>
                </div>
                <span className="dh-prog-label">{donePct}%</span>
              </div>
            )}
          </div>

          {/* filter tabs */}
          <div className="dh-tabs">
            {[
              { id: 'all',    label: `All (${todos.length})` },
              { id: 'active', label: `Active (${remaining})` },
              { id: 'done',   label: `Done (${doneCount})` },
            ].map(f => (
              <button
                key={f.id}
                className={`dh-tab${todoFilter === f.id ? ' active' : ''}`}
                onClick={() => setTodoFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* list */}
          <div className="dh-todo-list">
            {filtered.length === 0 && (
              <div className="dh-empty">
                <i className="fas fa-clipboard-list"></i>
                <span>{todoFilter === 'done' ? 'No completed tasks' : 'No tasks — add one below'}</span>
              </div>
            )}
            {filtered.map(t => (
              <div key={t._id} className={`dh-todo${t.done ? ' done' : ''}`}>
                <button
                  className="dh-check"
                  onClick={() => toggleTodo(t._id, t.done)}
                  title={t.done ? 'Mark undone' : 'Mark done'}
                >
                  <i className={t.done ? 'fas fa-check-circle' : 'far fa-circle'}></i>
                </button>
                <span
                  className="dh-pri-dot"
                  style={{ background: PRIORITY_COLOR[t.priority] }}
                  title={t.priority}
                ></span>
                <span className="dh-todo-text">{t.text}</span>
                <button className="dh-del" onClick={() => deleteTodo(t._id)} title="Delete">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
          </div>

          {/* add form */}
          <form className="dh-add-form" onSubmit={addTodo}>
            <input
              className="dh-add-input"
              type="text"
              placeholder="Add a task..."
              value={newTodo}
              onChange={e => setNewTodo(e.target.value)}
            />
            <select
              className="dh-pri-sel"
              value={newPriority}
              onChange={e => setNewPriority(e.target.value)}
            >
              <option value="high">High</option>
              <option value="medium">Med</option>
              <option value="low">Low</option>
            </select>
            <button
              type="submit"
              className="dh-add-btn"
              disabled={addingTodo || !newTodo.trim()}
            >
              <i className={addingTodo ? 'fas fa-spinner fa-spin' : 'fas fa-plus'}></i>
            </button>
          </form>
        </div>

        {/* ── RIGHT column ──────────────────────── */}
        <div className="dh-right">

          {/* Pinned API Keys */}
          <div className="dh-panel">
            <div className="dh-panel-hd">
              <div className="dh-panel-title">
                <i className="fas fa-key"></i>
                <span>Pinned Keys</span>
              </div>
              <button className="dh-panel-link" onClick={() => navigate('/admin/apikeys')}>
                Manage <i className="fas fa-arrow-right"></i>
              </button>
            </div>

            {pinnedKeys.length === 0 ? (
              <div className="dh-empty">
                <i className="fas fa-thumbtack"></i>
                <span>Pin up to 3 keys in API Keys</span>
              </div>
            ) : (
              <div className="dh-keys">
                {pinnedKeys.map(k => (
                  <div key={k._id} className="dh-key-row">
                    <div className="dh-key-meta">
                      <span className="dh-key-name">{k.name}</span>
                      {k.description && <span className="dh-key-desc">{k.description}</span>}
                    </div>
                    <div className="dh-key-actions">
                      {revealed[k._id] && (
                        <span className="dh-key-preview">
                          {revealed[k._id].slice(0, 18)}…
                        </span>
                      )}
                      <button
                        className="dh-icon-btn"
                        onClick={() => revealKey(k._id)}
                        title={revealed[k._id] ? 'Hide' : 'Reveal'}
                      >
                        <i className={revealed[k._id] ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                      </button>
                      {revealed[k._id] && (
                        <button
                          className={`dh-icon-btn${copiedId === k._id ? ' copied' : ''}`}
                          onClick={() => copyKey(k._id, revealed[k._id])}
                          title="Copy"
                        >
                          <i className={copiedId === k._id ? 'fas fa-check' : 'fas fa-copy'}></i>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Access Nav */}
          <div className="dh-panel">
            <div className="dh-panel-hd">
              <div className="dh-panel-title">
                <i className="fas fa-bolt"></i>
                <span>Quick Access</span>
              </div>
            </div>
            <div className="dh-quick-grid">
              {QUICK_LINKS.map(l => (
                <button
                  key={l.path}
                  className="dh-quick-btn"
                  style={{ '--qc': l.color }}
                  onClick={() => navigate(`/admin${l.path}`)}
                >
                  <i className={l.icon}></i>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Email snapshot */}
          {emailStats !== null && (
            <div className="dh-panel dh-info-panel">
              <div className="dh-panel-hd">
                <div className="dh-panel-title">
                  <i className="fas fa-inbox"></i>
                  <span>Email Snapshot</span>
                </div>
                <button className="dh-panel-link" onClick={() => navigate('/admin/agents/email')}>
                  Open <i className="fas fa-arrow-right"></i>
                </button>
              </div>
              <div className="dh-info-chips">
                <div className="dh-info-chip" style={{ '--ic': '#4d8ee8' }}>
                  <i className="fas fa-envelope"></i>
                  <span>{emailStats.unread} unread</span>
                </div>
                {emailStats.high > 0 && (
                  <div className="dh-info-chip" style={{ '--ic': '#ff6b6b' }}>
                    <i className="fas fa-fire"></i>
                    <span>{emailStats.high} urgent</span>
                  </div>
                )}
                {emailStats.unread === 0 && (
                  <div className="dh-info-chip" style={{ '--ic': '#51cf66' }}>
                    <i className="fas fa-check-circle"></i>
                    <span>All caught up</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

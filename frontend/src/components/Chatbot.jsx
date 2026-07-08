import { useState, useEffect, useRef } from 'react';
import api from '../api/axios.js';

const HISTORY_KEY = 'vipul_chat_history';
const TS_KEY = 'vipul_chat_ts';
const SESSION_KEY = 'vipul_chat_session';
const EXPIRY_MS = 24 * 60 * 60 * 1000;

// Session id is tied to the same expiry window as the visible history —
// a fresh conversation client-side means a fresh session server-side too.
function getSessionId() {
  const ts = localStorage.getItem(TS_KEY);
  const expired = !ts || Date.now() - Number(ts) > EXPIRY_MS;
  if (expired) {
    const id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
    return id;
  }
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const CAT_COLORS = {
  ml: '#4d8ee8', web: '#51cf66', agentic: '#be4bdb', genai: '#f59e0b',
  deeplearning: '#ef4444', arvr: '#06b6d4', nlp: '#10b981', n8n: '#ff6d5a'
};

// Markdown → HTML for text template final render only
function parseMarkdown(raw) {
  if (!raw) return '';
  let t = raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  t = t.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, c) =>
    `<pre class="md-pre"><code>${c.trim()}</code></pre>`);
  t = t.replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>');
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  t = t.replace(/^#{1,3} (.+)$/gm, '<p class="md-heading"><strong>$1</strong></p>');
  const lines = t.split('\n');
  const out = [];
  let inList = false;
  for (const line of lines) {
    if (/^[-*•] (.+)/.test(line)) {
      if (!inList) { out.push('<ul class="md-ul">'); inList = true; }
      out.push(`<li>${line.replace(/^[-*•] /, '')}</li>`);
    } else if (/^\d+\. (.+)/.test(line)) {
      if (!inList) { out.push('<ul class="md-ul">'); inList = true; }
      out.push(`<li>${line.replace(/^\d+\. /, '')}</li>`);
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(line);
    }
  }
  if (inList) out.push('</ul>');
  t = out.join('\n');
  t = t.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
  return `<p>${t}</p>`;
}

function extractCopyText(d) {
  if (!d) return '';
  switch (d.template) {
    case 'text': return d.content || '';
    case 'list': return [d.title, ...(d.items || []).map(i => `• ${i}`)].filter(Boolean).join('\n');
    case 'project_cards': return (d.projects || []).map(p => `${p.title}: ${p.description}`).join('\n\n');
    case 'skill_grid': return (d.categories || []).map(c => `${c.name}: ${(c.skills || []).join(', ')}`).join('\n');
    case 'research_card': return (d.papers || []).map(p => `${p.title} — ${p.authors}`).join('\n\n');
    case 'achievement_list': return (d.items || []).map(i => `${i.title}: ${i.description}`).join('\n');
    case 'profile_card': return [d.name, (d.roles || []).join(', '), d.bio].filter(Boolean).join('\n');
    case 'contact_card': return (d.links || []).map(l => `${l.platform}: ${l.url}`).join('\n');
    case 'timeline': return (d.items || []).map(i => `${i.date} — ${i.title}`).join('\n');
    case 'key_value': return (d.pairs || []).map(p => `${p.key}: ${p.value}`).join('\n');
    case 'code_block': return d.code || '';
    case 'stat_cards': return (d.stats || []).map(s => `${s.label}: ${s.value}`).join(' | ');
    default: return '';
  }
}

function normalizeMsg(m) {
  if (m.role !== 'bot') return m;
  if (!m.template) {
    return {
      ...m,
      template: 'text',
      templateData: { template: 'text', content: m.text || '' },
      isTyping: false
    };
  }
  return m;
}

function loadHistory() {
  try {
    const ts = localStorage.getItem(TS_KEY);
    if (!ts || Date.now() - Number(ts) > EXPIRY_MS) {
      localStorage.removeItem(HISTORY_KEY);
      localStorage.removeItem(TS_KEY);
      return [];
    }
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored).map(normalizeMsg) : [];
  } catch { return []; }
}

function saveHistory(msgs) {
  try {
    const stable = msgs.filter(m => !m.isTyping);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(stable));
    localStorage.setItem(TS_KEY, Date.now().toString());
  } catch {}
}

// ── Template 1: Text ─────────────────────────────────────────────────
function TplText({ displayedText, isTyping }) {
  if (isTyping) {
    return (
      <div className="tpl-text">
        <span style={{ whiteSpace: 'pre-wrap' }}>{displayedText}</span>
        <span className="chat-cursor">▌</span>
      </div>
    );
  }
  return (
    <div
      className="tpl-text chat-msg-content"
      dangerouslySetInnerHTML={{ __html: parseMarkdown(displayedText) }}
    />
  );
}

// ── Template 2: List ─────────────────────────────────────────────────
function TplList({ data }) {
  return (
    <div className="tpl-list">
      {data.title && <div className="tpl-title">{data.title}</div>}
      <ul className="tpl-list-items">
        {(data.items || []).map((item, i) => (
          <li key={i} className="tpl-list-item">
            <span className="tpl-list-dot" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Template 3: Project Cards ────────────────────────────────────────
function TplProjectCards({ data }) {
  return (
    <div className="tpl-project-cards">
      {(data.projects || []).map((p, i) => {
        const color = CAT_COLORS[p.category] || '#4d8ee8';
        return (
          <div key={i} className="tpl-pcard" style={{ '--cat-color': color }}>
            <div className="tpl-pcard-top">
              <span className="tpl-pcard-badge" style={{ color, borderColor: `${color}40`, background: `${color}14` }}>
                {p.category}
              </span>
            </div>
            <div className="tpl-pcard-title">{p.title}</div>
            <div className="tpl-pcard-desc">{p.description}</div>
            {p.techStack?.length > 0 && (
              <div className="tpl-chips">
                {p.techStack.slice(0, 4).map((t, j) => <span key={j} className="tpl-chip">{t}</span>)}
                {p.techStack.length > 4 && <span className="tpl-chip tpl-chip-more">+{p.techStack.length - 4}</span>}
              </div>
            )}
            {(p.demoLink || p.codeLink || p.driveLink) && (
              <div className="tpl-pcard-links">
                {p.demoLink && (
                  <a href={p.demoLink} target="_blank" rel="noreferrer" className="tpl-link-btn">
                    <i className="fas fa-external-link-alt" /> Demo
                  </a>
                )}
                {p.codeLink && (
                  <a href={p.codeLink} target="_blank" rel="noreferrer" className="tpl-link-btn tpl-link-ghost">
                    <i className="fab fa-github" /> Code
                  </a>
                )}
                {p.driveLink && (
                  <a href={p.driveLink} target="_blank" rel="noreferrer" className="tpl-link-btn tpl-link-ghost">
                    <i className="fas fa-folder-open" /> Drive
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Template 4: Skill Grid ───────────────────────────────────────────
function TplSkillGrid({ data }) {
  return (
    <div className="tpl-skill-grid">
      {(data.categories || []).map((cat, i) => (
        <div key={i} className="tpl-skill-group">
          <div className="tpl-skill-group-name">{cat.name}</div>
          <div className="tpl-chips">
            {(cat.skills || []).map((s, j) => <span key={j} className="tpl-chip">{s}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Template 5: Research Card ────────────────────────────────────────
function TplResearchCard({ data }) {
  return (
    <div className="tpl-research">
      {(data.papers || []).map((p, i) => (
        <div key={i} className="tpl-research-card">
          <div className="tpl-research-title">{p.title}</div>
          <div className="tpl-research-meta">
            {p.conference && <span className="tpl-research-conf">{p.conference}</span>}
            {p.authors && <span className="tpl-research-authors">{p.authors}</span>}
          </div>
          {p.abstract && <p className="tpl-research-abstract">{p.abstract}</p>}
          {p.paperLink && (
            <a href={p.paperLink} target="_blank" rel="noreferrer" className="tpl-link-btn" style={{ marginTop: '0.5rem' }}>
              <i className="fas fa-file-alt" /> View Paper
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Template 6: Achievement List ─────────────────────────────────────
function TplAchievementList({ data }) {
  return (
    <div className="tpl-achievements">
      {(data.items || []).map((item, i) => (
        <div key={i} className="tpl-achievement-item">
          <div className="tpl-achievement-icon">
            <i className={item.icon || 'fas fa-star'} />
          </div>
          <div className="tpl-achievement-body">
            <div className="tpl-achievement-title">{item.title}</div>
            {item.description && <div className="tpl-achievement-desc">{item.description}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Template 7: Profile Card ─────────────────────────────────────────
function TplProfileCard({ data }) {
  return (
    <div className="tpl-profile">
      <div className="tpl-profile-name">{data.name}</div>
      {data.roles?.length > 0 && (
        <div className="tpl-chips tpl-profile-roles">
          {data.roles.map((r, i) => <span key={i} className="tpl-chip">{r}</span>)}
        </div>
      )}
      {data.bio && <p className="tpl-profile-bio">{data.bio}</p>}
      {data.stats?.length > 0 && (
        <div className="tpl-profile-stats">
          {data.stats.map((s, i) => (
            <div key={i} className="tpl-profile-stat">
              <i className={s.icon || 'fas fa-chart-bar'} />
              <span className="tpl-stat-value">{s.value}</span>
              <span className="tpl-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Template 8: Contact Card ─────────────────────────────────────────
function TplContactCard({ data }) {
  return (
    <div className="tpl-contact">
      {data.note && <p className="tpl-contact-note">{data.note}</p>}
      <div className="tpl-contact-links">
        {(data.links || []).map((link, i) => (
          <a key={i} href={link.url || '#'} target="_blank" rel="noreferrer" className="tpl-contact-link">
            <i className={link.icon || 'fas fa-link'} />
            <span className="tpl-contact-platform">{link.platform}</span>
            {link.label && <span className="tpl-contact-label">{link.label}</span>}
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Template 9: Timeline ─────────────────────────────────────────────
function TplTimeline({ data }) {
  return (
    <div className="tpl-timeline">
      {data.title && <div className="tpl-title">{data.title}</div>}
      <div className="tpl-timeline-items">
        {(data.items || []).map((item, i) => (
          <div key={i} className="tpl-timeline-item">
            <div className="tpl-timeline-dot" />
            <div className="tpl-timeline-body">
              {item.date && <div className="tpl-timeline-date">{item.date}</div>}
              <div className="tpl-timeline-title">{item.title}</div>
              {item.description && <div className="tpl-timeline-desc">{item.description}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Template 10: Key Value ───────────────────────────────────────────
function TplKeyValue({ data }) {
  return (
    <div className="tpl-kv">
      {data.title && <div className="tpl-title">{data.title}</div>}
      <div className="tpl-kv-pairs">
        {(data.pairs || []).map((pair, i) => (
          <div key={i} className="tpl-kv-row">
            <span className="tpl-kv-key">{pair.key}</span>
            <span className="tpl-kv-value">{pair.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Template 11: Code Block ──────────────────────────────────────────
function TplCodeBlock({ data }) {
  return (
    <div className="tpl-code">
      <div className="tpl-code-header">
        <span className="tpl-code-lang">{data.language || 'code'}</span>
        {data.title && <span className="tpl-code-title">{data.title}</span>}
      </div>
      <pre className="tpl-code-pre"><code>{data.code}</code></pre>
    </div>
  );
}

// ── Template 12: Stat Cards ──────────────────────────────────────────
function TplStatCards({ data }) {
  return (
    <div className="tpl-stats">
      {(data.stats || []).map((s, i) => (
        <div key={i} className="tpl-stat-card" style={{ '--stat-color': s.color || '#4d8ee8' }}>
          <i className={s.icon || 'fas fa-chart-bar'} />
          <span className="tpl-stat-val">{s.value}</span>
          <span className="tpl-stat-lbl">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Template dispatcher ──────────────────────────────────────────────
function renderTemplate(msg) {
  const { template, templateData, displayedText, isTyping } = msg;
  switch (template) {
    case 'list':            return <TplList data={templateData} />;
    case 'project_cards':   return <TplProjectCards data={templateData} />;
    case 'skill_grid':      return <TplSkillGrid data={templateData} />;
    case 'research_card':   return <TplResearchCard data={templateData} />;
    case 'achievement_list':return <TplAchievementList data={templateData} />;
    case 'profile_card':    return <TplProfileCard data={templateData} />;
    case 'contact_card':    return <TplContactCard data={templateData} />;
    case 'timeline':        return <TplTimeline data={templateData} />;
    case 'key_value':       return <TplKeyValue data={templateData} />;
    case 'code_block':      return <TplCodeBlock data={templateData} />;
    case 'stat_cards':      return <TplStatCards data={templateData} />;
    default:                return <TplText displayedText={displayedText || ''} isTyping={isTyping} />;
  }
}

// ── Main component ───────────────────────────────────────────────────
export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({ typingSpeed: 18 });
  const [showConfirm, setShowConfirm] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    api.get('/chatbot/config').then(r => setConfig(r.data)).catch(() => {});
    setMessages(loadHistory());
  }, []);

  useEffect(() => {
    if (messages.some(m => m.isTyping)) return;
    if (messages.length > 0) saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  const startTyping = (msgId, fullText) => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    let charCount = 0;
    const speed = config?.typingSpeed || 18;

    typingTimerRef.current = setInterval(() => {
      charCount++;
      setMessages(prev => prev.map(m => {
        if (m.id !== msgId) return m;
        if (charCount >= fullText.length) {
          clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
          return { ...m, displayedText: fullText, isTyping: false };
        }
        return { ...m, displayedText: fullText.slice(0, charCount) };
      }));
    }, speed);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { id: Date.now(), role: 'user', text, displayedText: text, isTyping: false };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/chatbot/chat', { message: text, sessionId: getSessionId() });
      const isTextTpl = data.template === 'text';
      const botId = Date.now() + 1;

      const botMsg = {
        id: botId,
        role: 'bot',
        template: data.template || 'text',
        templateData: data,
        text: extractCopyText(data),
        displayedText: isTextTpl ? '' : null,
        isTyping: isTextTpl,
        sources: data.sources || [],
        hasContext: data.hasContext,
        model: data.model
      };

      setMessages(prev => [...prev, botMsg]);
      if (isTextTpl) startTyping(botId, data.content || '');
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'bot',
        template: 'text',
        templateData: { template: 'text', content: 'Sorry, something went wrong. Please try again.' },
        text: 'Sorry, something went wrong. Please try again.',
        displayedText: 'Sorry, something went wrong. Please try again.',
        isTyping: false,
        sources: [],
        hasContext: false,
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const confirmClear = () => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    setMessages([]);
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(TS_KEY);
    localStorage.removeItem(SESSION_KEY);
    setShowConfirm(false);
  };

  return (
    <>
      {/* Floating button */}
      <button
        className={`chat-fab${open ? ' chat-fab-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Chat with AI"
      >
        <i className={`fas ${open ? 'fa-times' : 'fa-robot'}`}></i>
        {!open && messages.length > 0 && (
          <span className="chat-fab-badge">{messages.filter(m => m.role === 'bot').length}</span>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div className={`chat-window${expanded ? ' chat-window-expanded' : ''}`}>
          {/* Header */}
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-avatar"><i className="fas fa-robot"></i></div>
              <div>
                <div className="chat-header-name">Vipul's AI Assistant</div>
                <div className="chat-header-status">
                  <span className="chat-status-dot"></span> Powered by RAG
                </div>
              </div>
            </div>
            <div className="chat-header-actions">
              <button
                className="chat-icon-btn chat-expand-btn"
                onClick={() => setExpanded(e => !e)}
                title={expanded ? 'Collapse' : 'Expand'}
              >
                <i className={`fas ${expanded ? 'fa-compress-alt' : 'fa-expand-alt'}`}></i>
              </button>
              <button className="chat-icon-btn" onClick={() => setShowConfirm(true)} title="Clear history">
                <i className="fas fa-trash-alt"></i>
              </button>
              <button className="chat-icon-btn" onClick={() => setOpen(false)} title="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>

          {/* Confirm clear */}
          {showConfirm && (
            <div className="chat-confirm">
              <p>Clear all chat history?</p>
              <div className="chat-confirm-btns">
                <button className="chat-confirm-cancel" onClick={() => setShowConfirm(false)}>Cancel</button>
                <button className="chat-confirm-ok" onClick={confirmClear}>Clear</button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty">
                <i className="fas fa-robot"></i>
                <p>Hi! Ask me anything about Vipul.</p>
              </div>
            )}

            {messages.map(msg => {
              const isRich = msg.template && msg.template !== 'text';
              return (
                <div key={msg.id} className={`chat-msg chat-msg-${msg.role}`}>
                  {msg.role === 'bot' && (
                    <div className="chat-msg-avatar"><i className="fas fa-robot"></i></div>
                  )}
                  <div className={`chat-bubble${msg.isError ? ' chat-bubble-error' : ''}${isRich ? ' chat-bubble-rich' : ''}`}>
                    {msg.role === 'bot' ? renderTemplate(msg) : <span>{msg.text}</span>}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="chat-msg chat-msg-bot">
                <div className="chat-msg-avatar"><i className="fas fa-robot"></i></div>
                <div className="chat-bubble">
                  <div className="chat-typing-dots">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              className="chat-input"
              rows={1}
              placeholder="Ask me anything about Vipul..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={loading}
            />
            <button
              className="chat-send-btn"
              onClick={sendMessage}
              disabled={!input.trim() || loading}
            >
              <i className="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

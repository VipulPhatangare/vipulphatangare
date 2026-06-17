import { useState, useEffect, useRef } from 'react';
import api from '../api/axios.js';

const HISTORY_KEY = 'vipul_chat_history';
const TS_KEY = 'vipul_chat_ts';
const EXPIRY_MS = 24 * 60 * 60 * 1000;

// Simple markdown → HTML
function parseMarkdown(raw) {
  if (!raw) return '';
  let t = raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks
  t = t.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, c) =>
    `<pre class="md-pre"><code>${c.trim()}</code></pre>`);
  // Inline code
  t = t.replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>');
  // Bold
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  t = t.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  // Headings
  t = t.replace(/^#{1,3} (.+)$/gm, '<p class="md-heading"><strong>$1</strong></p>');

  // Lists — process line by line
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

  // Paragraphs
  t = t.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
  return `<p>${t}</p>`;
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
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveHistory(msgs) {
  try {
    const stable = msgs.filter(m => !m.isTyping);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(stable));
    localStorage.setItem(TS_KEY, Date.now().toString());
  } catch {}
}

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

  // Load config + history on mount
  useEffect(() => {
    api.get('/chatbot/config').then(r => setConfig(r.data)).catch(() => {});
    setMessages(loadHistory());
  }, []);

  // Save to localStorage whenever stable messages change
  useEffect(() => {
    if (messages.some(m => m.isTyping)) return;
    if (messages.length > 0) saveHistory(messages);
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

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
      const { data } = await api.post('/chatbot/chat', { message: text });
      const botId = Date.now() + 1;
      const botMsg = {
        id: botId,
        role: 'bot',
        text: data.answer,
        displayedText: '',
        isTyping: true,
        sources: data.sources || [],
        hasContext: data.hasContext,
        model: data.model
      };
      setMessages(prev => [...prev, botMsg]);
      startTyping(botId, data.answer);
    } catch (err) {
      const errMsg = {
        id: Date.now() + 1,
        role: 'bot',
        text: 'Sorry, something went wrong. Please try again.',
        displayedText: 'Sorry, something went wrong. Please try again.',
        isTyping: false,
        sources: [],
        hasContext: false,
        isError: true
      };
      setMessages(prev => [...prev, errMsg]);
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
    setShowConfirm(false);
  };

  return (
    <>
      {/* Floating button */}
      <button className={`chat-fab${open ? ' chat-fab-open' : ''}`} onClick={() => setOpen(o => !o)} title="Chat with AI">
        <i className={`fas ${open ? 'fa-times' : 'fa-robot'}`}></i>
        {!open && messages.length > 0 && <span className="chat-fab-badge">{messages.filter(m => m.role === 'bot').length}</span>}
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
                <div className="chat-header-status"><span className="chat-status-dot"></span> Powered by RAG</div>
              </div>
            </div>
            <div className="chat-header-actions">
              <button className="chat-icon-btn" onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse' : 'Expand'}>
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

          {/* Confirm clear dialog */}
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

            {messages.map(msg => (
              <div key={msg.id} className={`chat-msg chat-msg-${msg.role}`}>
                {msg.role === 'bot' && (
                  <div className="chat-msg-avatar"><i className="fas fa-robot"></i></div>
                )}
                <div className={`chat-bubble${msg.isError ? ' chat-bubble-error' : ''}`}>
                  {msg.role === 'bot' ? (
                    <>
                      <div
                        className="chat-msg-content"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.displayedText) }}
                      />
                      {msg.isTyping && <span className="chat-cursor">▌</span>}
                    </>
                  ) : (
                    <span>{msg.text}</span>
                  )}
                </div>
              </div>
            ))}

            {/* Loading dots */}
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

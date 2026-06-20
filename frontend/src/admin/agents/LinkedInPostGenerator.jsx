import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios.js';

const DEFAULT_CONFIG = {
  systemPrompt: '',
  modelName: 'gemini-2.5-flash',
  maxTokens: 2048,
  topK: 5
};

const FACTORY_PROMPT = `You are a LinkedIn content strategist for Vipul Phatangare, an AI/ML engineer and developer.
Using the portfolio context provided, generate exactly 3 different LinkedIn post variants about the user's request.
Rules:
- Each post must be professional, engaging, and concise (150-300 characters of main content, NOT counting hashtags)
- Use first-person voice as Vipul
- Add relevant emojis naturally inside the post content to make it expressive and eye-catching
- Make each variant meaningfully different in tone or angle (e.g. achievement-focused, insight-focused, story-focused)
- End each post with 10 to 15 relevant hashtags covering topic, skills, industry, and audience
Respond ONLY with a valid JSON array of exactly 3 objects. Each object must have:
- "content": string (the post body text including emojis, WITHOUT hashtags)
- "hashtags": array of strings (tag words without the # symbol, 10–15 per post)
No markdown, no explanation, no code fences — just the raw JSON array.`;

function PostCard({ variant, index }) {
  const [copied, setCopied] = useState(false);

  const fullText = variant.content + (variant.hashtags.length
    ? '\n\n' + variant.hashtags.map(h => `#${h}`).join(' ')
    : '');

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="li-post-card">
      <div className="li-post-card-header">
        <span className="li-post-variant-badge">Variant {index + 1}</span>
        <span className="li-post-char-count">{variant.content.length} chars</span>
        <button className={`li-copy-btn${copied ? ' copied' : ''}`} onClick={handleCopy}>
          <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`}></i>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p className="li-post-content">{variant.content}</p>
      {variant.hashtags.length > 0 && (
        <div className="li-post-hashtags">
          {variant.hashtags.map((h, i) => (
            <span key={i} className="li-hashtag">#{h}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryPostCard({ post, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  return (
    <div className="li-history-card">
      <div className="li-history-card-header" onClick={() => setExpanded(e => !e)}>
        <div className="li-history-meta">
          <span className="li-history-prompt">"{post.userPrompt}"</span>
          <span className="li-history-date">{new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="li-history-variant-count">{post.variants.length} variants</span>
          {deleteConfirm ? (
            <>
              <button className="btn-danger-sm" onClick={(e) => { e.stopPropagation(); onDelete(post._id); }}>Confirm</button>
              <button className="btn-secondary-sm" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(false); }}>Cancel</button>
            </>
          ) : (
            <button className="btn-danger-sm" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(true); }}>
              <i className="fas fa-trash"></i>
            </button>
          )}
          <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} li-history-chevron`}></i>
        </div>
      </div>
      {expanded && (
        <div className="li-history-variants">
          {post.variants.map((v, i) => <PostCard key={i} variant={v} index={i} />)}
        </div>
      )}
    </div>
  );
}

export default function LinkedInPostGenerator() {
  const [tab, setTab] = useState('generator');

  // Generator tab state
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! Tell me what you'd like to post about — a project, skill, achievement, or anything from your portfolio. I'll generate 3 LinkedIn variants for you." }
  ]);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [currentVariants, setCurrentVariants] = useState([]);
  const [sources, setSources] = useState([]);
  const chatEndRef = useRef(null);

  // History tab state
  const [posts, setPosts] = useState([]);
  const [postsPage, setPostsPage] = useState(1);
  const [postsPages, setPostsPages] = useState(1);
  const [postsTotal, setPostsTotal] = useState(0);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Settings tab state
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  const [msg, setMsg] = useState(null);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (tab === 'history') loadPosts(1);
  }, [tab]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generating]);

  const loadConfig = async () => {
    try {
      const { data } = await api.get('/agents/linkedin/config');
      setConfig({ ...DEFAULT_CONFIG, ...data });
    } catch {
      flash('error', 'Failed to load agent config');
    } finally {
      setLoadingConfig(false);
    }
  };

  const saveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const { data } = await api.put('/agents/linkedin/config', config);
      setConfig({ ...DEFAULT_CONFIG, ...data });
      flash('success', 'Agent configuration saved');
    } catch {
      flash('error', 'Failed to save config');
    } finally {
      setSavingConfig(false);
    }
  };

  const loadPosts = async (page = 1) => {
    setLoadingPosts(true);
    try {
      const { data } = await api.get(`/agents/linkedin/posts?page=${page}`);
      setPosts(data.posts);
      setPostsPage(data.page);
      setPostsPages(data.pages);
      setPostsTotal(data.total);
    } catch {
      flash('error', 'Failed to load post history');
    } finally {
      setLoadingPosts(false);
    }
  };

  const deletePost = async (id) => {
    try {
      await api.delete(`/agents/linkedin/posts/${id}`);
      flash('success', 'Post deleted');
      loadPosts(postsPage);
    } catch {
      flash('error', 'Failed to delete post');
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || generating) return;

    setMessages(m => [...m, { role: 'user', content: prompt }]);
    setInput('');
    setGenerating(true);
    setCurrentVariants([]);
    setSources([]);

    try {
      const { data } = await api.post('/agents/linkedin/generate', { prompt });
      setCurrentVariants(data.post.variants);
      setSources(data.sources || []);
      setMessages(m => [...m, {
        role: 'assistant',
        content: `Generated ${data.post.variants.length} LinkedIn post variants based on your portfolio context. Check the panel on the right!`
      }]);
    } catch (err) {
      const errText = err.response?.data?.error || 'Generation failed. Please try again.';
      setMessages(m => [...m, { role: 'assistant', content: `Error: ${errText}` }]);
      flash('error', errText);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="li-generator-wrap">
      {msg && (
        <div className={`admin-alert admin-alert-${msg.type}`}>
          <i className={`fas ${msg.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="chatbot-tabs">
        <button className={`chatbot-tab${tab === 'generator' ? ' active' : ''}`} onClick={() => setTab('generator')}>
          <i className="fas fa-magic"></i> Generator
        </button>
        <button className={`chatbot-tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
          <i className="fas fa-history"></i> History
        </button>
        <button className={`chatbot-tab${tab === 'settings' ? ' active' : ''}`} onClick={() => setTab('settings')}>
          <i className="fas fa-sliders-h"></i> Settings
        </button>
      </div>

      {/* ── GENERATOR ── */}
      {tab === 'generator' && (
        <div className="li-generator-panel">
          {/* Chat window */}
          <div className="li-chat-col">
            <div className="li-chat-window">
              <div className="li-chat-messages">
                {messages.map((m, i) => (
                  <div key={i} className={`li-msg li-msg-${m.role}`}>
                    {m.role === 'assistant' && (
                      <div className="li-msg-avatar"><i className="fab fa-linkedin"></i></div>
                    )}
                    <div className="li-msg-bubble">{m.content}</div>
                  </div>
                ))}
                {generating && (
                  <div className="li-msg li-msg-assistant">
                    <div className="li-msg-avatar"><i className="fab fa-linkedin"></i></div>
                    <div className="li-msg-bubble li-typing">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form className="li-chat-form" onSubmit={handleGenerate}>
                <input
                  className="li-chat-input"
                  type="text"
                  placeholder="e.g. My Pet Detection project, ML skills, recent achievement..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={generating}
                />
                <button type="submit" className="li-chat-send" disabled={!input.trim() || generating}>
                  {generating
                    ? <i className="fas fa-spinner fa-spin"></i>
                    : <><i className="fas fa-paper-plane"></i> Generate</>
                  }
                </button>
              </form>
            </div>

            {sources.length > 0 && (
              <div className="li-sources">
                <p className="li-sources-label"><i className="fas fa-database"></i> Context used from your knowledge base:</p>
                {sources.map((s, i) => (
                  <span key={i} className="li-source-chip">
                    {s.sourceLabel} <em>{(s.score * 100).toFixed(0)}%</em>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Variants panel */}
          <div className="li-variants-col">
            {currentVariants.length === 0 ? (
              <div className="li-variants-empty">
                <i className="fab fa-linkedin"></i>
                <p>Your 3 post variants will appear here after you send a message.</p>
              </div>
            ) : (
              <>
                <div className="li-variants-header">
                  <h3><i className="fas fa-layer-group"></i> 3 Post Variants</h3>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}
                    onClick={() => {
                      const allText = currentVariants.map((v, i) =>
                        `Variant ${i + 1}:\n${v.content}\n${v.hashtags.map(h => `#${h}`).join(' ')}`
                      ).join('\n\n---\n\n');
                      navigator.clipboard.writeText(allText);
                    }}
                  >
                    <i className="fas fa-copy"></i> Copy All
                  </button>
                </div>
                {currentVariants.map((v, i) => <PostCard key={i} variant={v} index={i} />)}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === 'history' && (
        <div className="chatbot-panel">
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="chatbot-section-title" style={{ margin: 0 }}>
                <i className="fas fa-history"></i> Saved Posts
                <span className="chatbot-count">{postsTotal}</span>
              </h3>
              <button className="btn-secondary" onClick={() => loadPosts(postsPage)}>
                <i className="fas fa-sync-alt"></i> Refresh
              </button>
            </div>

            {loadingPosts ? (
              <div className="loading-spinner"><div className="spinner"></div></div>
            ) : posts.length === 0 ? (
              <div className="chatbot-empty">
                <i className="fab fa-linkedin"></i>
                <p>No posts generated yet. Use the Generator tab to create your first LinkedIn posts.</p>
              </div>
            ) : (
              <>
                <div className="li-history-list">
                  {posts.map(post => (
                    <HistoryPostCard key={post._id} post={post} onDelete={deletePost} />
                  ))}
                </div>
                {postsPages > 1 && (
                  <div className="pagination" style={{ marginTop: '1rem' }}>
                    <button disabled={postsPage <= 1} onClick={() => loadPosts(postsPage - 1)}>
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <span>Page {postsPage} of {postsPages}</span>
                    <button disabled={postsPage >= postsPages} onClick={() => loadPosts(postsPage + 1)}>
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SETTINGS ── */}
      {tab === 'settings' && (
        <div className="chatbot-panel">
          {loadingConfig ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : (
            <form onSubmit={saveConfig} className="chatbot-config-form stat-card">
              <h3 className="chatbot-section-title"><i className="fab fa-linkedin"></i> Agent Model Settings</h3>

              <div className="chatbot-config-grid">
                <div className="form-group">
                  <label>Model Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={config.modelName}
                    onChange={e => setConfig(c => ({ ...c, modelName: e.target.value }))}
                  />
                  <span className="form-hint">e.g. gemini-2.5-flash, gemini-2.0-flash</span>
                </div>

                <div className="form-group">
                  <label>Max Output Tokens</label>
                  <input
                    type="number"
                    className="form-input"
                    min={256} max={8192}
                    value={config.maxTokens}
                    onChange={e => setConfig(c => ({ ...c, maxTokens: Number(e.target.value) }))}
                  />
                  <span className="form-hint">Tokens per generation (default: 2048)</span>
                </div>

                <div className="form-group">
                  <label>Top K Knowledge Chunks</label>
                  <div className="slider-row">
                    <input
                      type="range" min={1} max={10}
                      value={config.topK}
                      onChange={e => setConfig(c => ({ ...c, topK: Number(e.target.value) }))}
                    />
                    <span className="slider-val">{config.topK}</span>
                  </div>
                  <span className="form-hint">How many knowledge base chunks to retrieve per generation</span>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ marginBottom: 0 }}>System Prompt</label>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
                    onClick={() => setConfig(c => ({ ...c, systemPrompt: FACTORY_PROMPT }))}
                  >
                    <i className="fas fa-undo"></i> Reset to Default
                  </button>
                </div>
                <textarea
                  className="form-input chatbot-textarea"
                  rows={10}
                  value={config.systemPrompt}
                  onChange={e => setConfig(c => ({ ...c, systemPrompt: e.target.value }))}
                />
                <span className="form-hint">
                  Instructions sent to Gemini before every generation. You can control emoji usage, hashtag count (currently 10–15), tone, and length here. Must always instruct the model to return a JSON array of 3 objects with "content" and "hashtags" keys.
                </span>
              </div>

              <button type="submit" className="btn-primary" disabled={savingConfig}>
                <i className="fas fa-save"></i> {savingConfig ? 'Saving…' : 'Save Configuration'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

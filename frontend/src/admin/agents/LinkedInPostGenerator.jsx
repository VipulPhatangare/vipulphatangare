import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios.js';

const FACTORY_PROMPT = `You are an expert LinkedIn Content Strategist, Personal Branding Specialist, and Professional Copywriter. Your task is to generate modular LinkedIn content components by leveraging information retrieved from the user's portfolio knowledge base.

Before generating, always analyze the retrieved context. Use only verified information. Never invent project details, metrics, achievements, timelines, or outcomes. If specific information is unavailable, omit unsupported claims instead of guessing. Always extract the most relevant insights: project goals, challenges, technologies, milestones, measurable impact, key learnings, and business value.

Generate content that sounds natural, human, and professional. Avoid robotic language, unnecessary jargon, and excessive corporate buzzwords. Write with confidence while maintaining authenticity and credibility.

Support all LinkedIn content types: project showcases, product launches, AI updates, technical deep dives, case studies, learning journeys, startup updates, milestones, research insights, team achievements, career updates, and event summaries.

Whenever information is retrieved through the RAG system, rank by relevance, prioritize recent updates, merge related info, remove duplicates, surface measurable impact, and always preserve exact names of projects, products, and technologies.

The tone and body length will be specified in each request and must be followed precisely.

OUTPUT FORMAT — Respond ONLY with a valid JSON object with exactly 3 keys:
- "titles": array of exactly 10 unique, diverse hook headlines or opening lines (strings)
- "bodies": array of exactly 3 unique full LinkedIn post bodies (strings — NO hashtags inside bodies)
- "hashtags": array of 20 to 25 hashtag words (strings, no # prefix, no duplicates) — mix of post-specific niche hashtags AND broad high-reach viral LinkedIn hashtags (e.g. innovation, technology, ai, careers, programming)

Output ONLY the raw JSON object. No markdown fences, no code fences, no explanation outside the JSON.`;

const DEFAULT_CONFIG = {
  systemPrompt: '',
  modelName: 'gemini-2.5-flash',
  maxTokens: 8192,
  topK: 8
};

const TEMPLATES = [
  { label: 'Project showcase', icon: 'fa-rocket',   prompt: 'Showcase my latest project: ' },
  { label: 'Achievement',      icon: 'fa-trophy',   prompt: 'Share a recent achievement: ' },
  { label: 'Skill highlight',  icon: 'fa-star',     prompt: 'Highlight my expertise in: ' },
  { label: 'Learning',         icon: 'fa-lightbulb',prompt: 'Share what I recently learned about: ' },
  { label: 'Job seeking',      icon: 'fa-briefcase',prompt: 'I am open to new opportunities in: ' },
];

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'insights',     label: 'Insights' },
  { value: 'casual',       label: 'Casual' },
];

const LENGTHS = [
  { value: 'short',  label: 'Short',  sub: '~150w' },
  { value: 'medium', label: 'Medium', sub: '~220w' },
  { value: 'long',   label: 'Long',   sub: '~400w' },
];

const EMOJIS = ['🔥','💡','🚀','✅','💪','🎯','🌟','📈','🤝','👉','✨','🏆','👨‍💻','🎉','💼','🧠','📊','⚡','🎓','💻'];

function HistoryPostCard({ post, onDelete, onToggleFavorite }) {
  const [expanded, setExpanded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const toneLabel   = post.tone   ? post.tone.charAt(0).toUpperCase()   + post.tone.slice(1)   : '';
  const lengthLabel = post.length ? post.length.charAt(0).toUpperCase() + post.length.slice(1) : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(post.finalPost).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`li-history-card${post.isFavorite ? ' li-history-favorite' : ''}`}>
      <div className="li-history-card-header" onClick={() => setExpanded(e => !e)}>
        <div className="li-history-meta">
          <span className="li-history-prompt">"{post.userPrompt}"</span>
          <div className="li-history-badges">
            {toneLabel   && <span className="li-history-badge">{toneLabel}</span>}
            {lengthLabel && <span className="li-history-badge">{lengthLabel}</span>}
            <span className="li-history-date">
              {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className={`li-fav-btn${post.isFavorite ? ' active' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleFavorite(post._id); }}
            title={post.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
          >
            <i className="fas fa-star"></i>
          </button>
          {deleteConfirm ? (
            <>
              <button className="btn-danger-sm" onClick={e => { e.stopPropagation(); onDelete(post._id); }}>Confirm</button>
              <button className="btn-secondary-sm" onClick={e => { e.stopPropagation(); setDeleteConfirm(false); }}>Cancel</button>
            </>
          ) : (
            <button className="btn-danger-sm" onClick={e => { e.stopPropagation(); setDeleteConfirm(true); }}>
              <i className="fas fa-trash"></i>
            </button>
          )}
          <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} li-history-chevron`}></i>
        </div>
      </div>

      {expanded && (
        <div className="li-history-variants">
          {post.finalPost ? (
            <div className="li-history-final-post">
              <pre className="li-final-post-text">{post.finalPost}</pre>
              <button className={`li-copy-btn${copied ? ' copied' : ''}`} onClick={handleCopy}>
                <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ) : (
            post.variants && post.variants.map((v, i) => (
              <div key={i} className="li-post-card" style={{ marginBottom: '0.75rem' }}>
                {v.title && <p className="li-post-title">{v.title}</p>}
                <p className="li-post-content">{v.content}</p>
                {v.hashtags && v.hashtags.length > 0 && (
                  <div className="li-post-hashtags">
                    {v.hashtags.map((h, j) => <span key={j} className="li-hashtag">#{h}</span>)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function LinkedInPostGenerator() {
  const [tab, setTab] = useState('generator');

  // Input
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('professional');
  const [length, setLength] = useState('medium');
  const [projectUrl, setProjectUrl] = useState('');
  const [activeUrl, setActiveUrl] = useState(''); // URL locked in at generation time

  // Generation
  const [generation, setGeneration] = useState(null);
  const [sources, setSources] = useState([]);
  const [generating, setGenerating] = useState(false);

  // Selections
  const [selectedTitle, setSelectedTitle] = useState(0);
  const [selectedBody, setSelectedBody] = useState(0);
  const [activeHashtags, setActiveHashtags] = useState([]);

  // Regen loading keys: 'titles' | 'bodies' | 'body_0' | 'body_1' | 'body_2' | 'hashtags'
  const [regenLoading, setRegenLoading] = useState({});

  // Editor
  const [editorText, setEditorText] = useState('');
  const editorRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [copied, setCopied] = useState(false);

  // History
  const [posts, setPosts] = useState([]);
  const [postsPage, setPostsPage] = useState(1);
  const [postsPages, setPostsPages] = useState(1);
  const [postsTotal, setPostsTotal] = useState(0);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Settings
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  // Knowledge base (bio + retroactive sync of saved posts)
  const [bio, setBio] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const [msg, setMsg] = useState(null);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  useEffect(() => { loadConfig(); }, []);
  useEffect(() => { if (tab === 'history') loadPosts(1); }, [tab]);
  useEffect(() => { if (tab === 'settings' && !bio) loadBio(); }, [tab]);

  // Auto-assemble editor when selections change
  useEffect(() => {
    if (!generation) return;
    const title = generation.titles[selectedTitle] || '';
    const body  = generation.bodies[selectedBody]  || '';
    const tags  = activeHashtags.map(h => `#${h}`).join(' ');
    const assembled = (title ? title + '\n\n' : '') + body + (activeUrl ? '\n\nLink: ' + activeUrl : '') + (tags ? '\n\n' + tags : '');
    setEditorText(assembled);
    setSavedId(null);
  }, [generation, selectedTitle, selectedBody, activeHashtags, activeUrl]);

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

  const saveConfig = async e => {
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

  const loadBio = async () => {
    try {
      const { data } = await api.get('/profile');
      setBio(data.bio || '');
    } catch { /* non-fatal — bio just stays empty */ }
  };

  const saveBio = async () => {
    setSavingBio(true);
    try {
      await api.put('/profile', { bio });
      flash('success', 'Bio saved — run "Sync knowledge base" to feed it to the agent');
    } catch {
      flash('error', 'Failed to save bio');
    } finally {
      setSavingBio(false);
    }
  };

  // Retroactively index the bio + every saved post into the agent's knowledge
  // base so generations stop being blind to past posts and the bio.
  const syncKnowledge = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data } = await api.post('/agents/linkedin/sync-knowledge');
      setSyncResult(data);
      flash('success', `Synced ${data.posts} post(s)${data.bioIndexed ? ' + bio' : ''} into the knowledge base`);
    } catch (err) {
      flash('error', err.response?.data?.error || 'Failed to sync knowledge base');
    } finally {
      setSyncing(false);
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

  const deletePost = async id => {
    try {
      await api.delete(`/agents/linkedin/posts/${id}`);
      flash('success', 'Post deleted');
      loadPosts(postsPage);
    } catch {
      flash('error', 'Failed to delete post');
    }
  };

  const toggleFavoritePost = async id => {
    try {
      const { data } = await api.patch(`/agents/linkedin/posts/${id}/favorite`);
      setPosts(ps => ps.map(p => p._id === id ? data.post : p));
    } catch {
      flash('error', 'Failed to update favorite');
    }
  };

  const handleGenerate = async e => {
    e.preventDefault();
    const prompt = topic.trim();
    if (!prompt || generating) return;

    setGenerating(true);
    setGeneration(null);
    setSources([]);
    setSavedId(null);
    setIsFavorite(false);
    setActiveUrl('');

    try {
      const { data } = await api.post('/agents/linkedin/generate', {
        prompt, tone, length,
        projectUrl: projectUrl.trim() || undefined
      });
      setGeneration(data.generation);
      setSources(data.sources || []);
      setSelectedTitle(0);
      setSelectedBody(0);
      setActiveHashtags(data.generation.hashtags || []);
      setActiveUrl(projectUrl.trim());
    } catch (err) {
      flash('error', err.response?.data?.error || 'Generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegen = async (section, bodyIndex) => {
    const key = section === 'body' ? `body_${bodyIndex}` : section;
    setRegenLoading(r => ({ ...r, [key]: true }));
    try {
      const { data } = await api.post('/agents/linkedin/regenerate', {
        prompt: topic.trim(), tone, length, section, bodyIndex,
        projectUrl: activeUrl || undefined
      });
      setGeneration(prev => {
        if (!prev) return prev;
        if (data.titles)            return { ...prev, titles: data.titles };
        if (data.bodies)            return { ...prev, bodies: data.bodies };
        if (data.body !== undefined) {
          const nb = [...prev.bodies];
          nb[data.index] = data.body;
          return { ...prev, bodies: nb };
        }
        if (data.hashtags) {
          setActiveHashtags(data.hashtags);
          return { ...prev, hashtags: data.hashtags };
        }
        return prev;
      });
    } catch (err) {
      flash('error', err.response?.data?.error || 'Regeneration failed');
    } finally {
      setRegenLoading(r => ({ ...r, [key]: false }));
    }
  };

  const insertEmoji = emoji => {
    const ta = editorRef.current;
    if (!ta) { setEditorText(t => t + emoji + ' '); return; }
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const next  = editorText.slice(0, start) + emoji + ' ' + editorText.slice(end);
    setEditorText(next);
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + emoji.length + 1;
      ta.focus();
    }, 0);
  };

  const handleSave = async () => {
    if (!topic.trim() || !editorText.trim() || saving) return;
    setSaving(true);
    try {
      const { data } = await api.post('/agents/linkedin/save', {
        userPrompt: topic.trim(), tone, length,
        finalPost:  editorText,
        isFavorite
      });
      setSavedId(data.post._id);
      flash('success', isFavorite ? 'Saved to favorites!' : 'Post saved to history');
    } catch {
      flash('error', 'Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editorText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const charCount  = editorText.length;
  const charStatus = charCount >= 3000 ? 'danger' : charCount >= 2700 ? 'warn' : 'ok';

  return (
    <div className="li-generator-wrap">
      {msg && (
        <div className={`admin-alert admin-alert-${msg.type}`}>
          <i className={`fas ${msg.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {msg.text}
        </div>
      )}

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
        <div className="li-v2-wrap">

          {/* Input section */}
          <div className="li-input-section">
            <div className="li-templates">
              {TEMPLATES.map(t => (
                <button
                  key={t.label}
                  type="button"
                  className="li-template-btn"
                  onClick={() => setTopic(prev => prev ? prev : t.prompt)}
                >
                  <i className={`fas ${t.icon}`}></i> {t.label}
                </button>
              ))}
            </div>

            <textarea
              className="li-topic-input"
              placeholder="What do you want to post about? e.g. 'My Pet Detection ML project', 'just landed a new role', 'lessons from building my first API'..."
              value={topic}
              onChange={e => setTopic(e.target.value)}
              rows={3}
              disabled={generating}
            />

            <div className="li-url-row">
              <i className="fas fa-link li-url-icon"></i>
              <input
                type="url"
                className="li-url-input"
                placeholder="Optional: paste a project URL, GitHub repo, or live demo link…"
                value={projectUrl}
                onChange={e => setProjectUrl(e.target.value)}
                disabled={generating}
              />
              {projectUrl.trim() && (
                <button
                  type="button"
                  className="li-url-clear"
                  onClick={() => setProjectUrl('')}
                  title="Clear URL"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>

            <div className="li-controls-row">
              <div className="li-tone-group">
                <span className="li-ctrl-label">Tone</span>
                <div className="li-seg-ctrl">
                  {TONES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      className={`li-seg-btn${tone === t.value ? ' active' : ''}`}
                      onClick={() => setTone(t.value)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="li-length-group">
                <span className="li-ctrl-label">Length</span>
                <div className="li-seg-ctrl">
                  {LENGTHS.map(l => (
                    <button
                      key={l.value}
                      type="button"
                      className={`li-seg-btn${length === l.value ? ' active' : ''}`}
                      onClick={() => setLength(l.value)}
                    >
                      {l.label} <em>{l.sub}</em>
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="li-generate-btn"
                onClick={handleGenerate}
                disabled={!topic.trim() || generating}
              >
                {generating
                  ? <><i className="fas fa-spinner fa-spin"></i> Generating…</>
                  : <><i className="fas fa-magic"></i> Generate</>
                }
              </button>
            </div>
          </div>

          {/* Component picker + editor */}
          {generation && (
            <div className="li-components-panel">

              {/* LEFT: picker */}
              <div className="li-picker-col">

                {/* Titles */}
                <div className="li-picker-section">
                  <div className="li-section-header">
                    <span className="li-section-title">
                      <i className="fas fa-heading"></i> Titles <em>{generation.titles.length}</em>
                    </span>
                    <button
                      className="li-regen-btn"
                      onClick={() => handleRegen('titles')}
                      disabled={regenLoading.titles}
                    >
                      {regenLoading.titles
                        ? <><i className="fas fa-spinner fa-spin"></i> Regenerating…</>
                        : <><i className="fas fa-redo"></i> Regenerate All</>
                      }
                    </button>
                  </div>
                  <div className="li-title-grid">
                    {generation.titles.map((title, i) => (
                      <div
                        key={i}
                        className={`li-title-card${selectedTitle === i ? ' selected' : ''}`}
                        onClick={() => setSelectedTitle(i)}
                      >
                        <span className="li-title-num">{i + 1}</span>
                        <span className="li-title-text">{title}</span>
                        {selectedTitle === i && <i className="fas fa-check li-selected-check"></i>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bodies */}
                <div className="li-picker-section">
                  <div className="li-section-header">
                    <span className="li-section-title">
                      <i className="fas fa-align-left"></i> Body Content <em>3</em>
                    </span>
                    <button
                      className="li-regen-btn"
                      onClick={() => handleRegen('bodies')}
                      disabled={regenLoading.bodies}
                    >
                      {regenLoading.bodies
                        ? <><i className="fas fa-spinner fa-spin"></i> Regenerating…</>
                        : <><i className="fas fa-redo"></i> Regenerate All</>
                      }
                    </button>
                  </div>
                  <div className="li-body-list">
                    {generation.bodies.map((body, i) => (
                      <div
                        key={i}
                        className={`li-body-card${selectedBody === i ? ' selected' : ''}`}
                        onClick={() => setSelectedBody(i)}
                      >
                        <div className="li-body-card-header">
                          <span className="li-body-badge">Body {i + 1}</span>
                          <span className="li-body-wordcount">
                            {body.trim().split(/\s+/).filter(Boolean).length} words
                          </span>
                          <button
                            className="li-body-regen-btn"
                            onClick={e => { e.stopPropagation(); handleRegen('body', i); }}
                            disabled={regenLoading[`body_${i}`]}
                            title={`Regenerate body ${i + 1}`}
                          >
                            {regenLoading[`body_${i}`]
                              ? <i className="fas fa-spinner fa-spin"></i>
                              : <i className="fas fa-redo"></i>
                            }
                          </button>
                          {selectedBody === i && <i className="fas fa-check li-selected-check"></i>}
                        </div>
                        <p className="li-body-preview">{body}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hashtags */}
                <div className="li-picker-section">
                  <div className="li-section-header">
                    <span className="li-section-title">
                      <i className="fas fa-hashtag"></i> Hashtags
                    </span>
                    <button
                      className="li-regen-btn"
                      onClick={() => handleRegen('hashtags')}
                      disabled={regenLoading.hashtags}
                    >
                      {regenLoading.hashtags
                        ? <><i className="fas fa-spinner fa-spin"></i> Regenerating…</>
                        : <><i className="fas fa-redo"></i> Regenerate</>
                      }
                    </button>
                  </div>
                  <div className="li-hashtag-pool">
                    {generation.hashtags.map((h, i) => {
                      const active = activeHashtags.includes(h);
                      return (
                        <button
                          key={i}
                          className={`li-hashtag-toggle${active ? ' active' : ''}`}
                          onClick={() => setActiveHashtags(prev =>
                            active ? prev.filter(x => x !== h) : [...prev, h]
                          )}
                        >
                          #{h}
                          <i className={`fas ${active ? 'fa-times' : 'fa-plus'}`}></i>
                        </button>
                      );
                    })}
                  </div>
                  <p className="li-hashtag-hint">
                    {activeHashtags.length} selected — click to toggle on/off
                  </p>
                </div>
              </div>

              {/* RIGHT: editor */}
              <div className="li-editor-col">
                <div className="li-editor-card">
                  <div className="li-editor-top">
                    <span className="li-editor-label">
                      <i className="fas fa-edit"></i> Post Editor
                    </span>
                    <span className={`li-char-counter li-char-${charStatus}`}>
                      {charCount.toLocaleString()} / 3,000
                      {charStatus === 'warn'   && <i className="fas fa-exclamation-triangle"></i>}
                      {charStatus === 'danger' && <i className="fas fa-times-circle"></i>}
                    </span>
                  </div>

                  {/* Emoji toolbar */}
                  <div className="li-emoji-toolbar">
                    {EMOJIS.map((emoji, i) => (
                      <button
                        key={i}
                        type="button"
                        className="li-emoji-btn"
                        onClick={() => insertEmoji(emoji)}
                        title={`Insert ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <textarea
                    ref={editorRef}
                    className={`li-editor-textarea li-editor-${charStatus}`}
                    value={editorText}
                    onChange={e => setEditorText(e.target.value)}
                    placeholder="Select a title, body, and hashtags from the left panel to assemble your post. Then edit freely here."
                    rows={16}
                  />

                  {sources.length > 0 && (
                    <div className="li-sources">
                      <p className="li-sources-label">
                        <i className="fas fa-database"></i> Knowledge base context used:
                      </p>
                      {sources.map((s, i) => (
                        <span key={i} className="li-source-chip">
                          {s.sourceLabel} <em>{(s.score * 100).toFixed(0)}%</em>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="li-editor-actions">
                    <button
                      type="button"
                      className={`li-fav-toggle${isFavorite ? ' active' : ''}`}
                      onClick={() => setIsFavorite(f => !f)}
                      title={isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
                    >
                      <i className="fas fa-star"></i>
                      {isFavorite ? 'Favorited' : 'Favorite'}
                    </button>

                    <button
                      type="button"
                      className="li-save-btn"
                      onClick={handleSave}
                      disabled={saving || !editorText.trim() || !!savedId}
                    >
                      {saving  ? <><i className="fas fa-spinner fa-spin"></i> Saving…</>
                      : savedId ? <><i className="fas fa-check"></i> Saved</>
                      : <><i className="fas fa-save"></i> Save to History</>}
                    </button>

                    <button
                      type="button"
                      className={`li-copy-action${copied ? ' copied' : ''}`}
                      onClick={handleCopy}
                      disabled={!editorText.trim()}
                    >
                      <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                      {copied ? 'Copied!' : 'Copy Post'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!generation && !generating && (
            <div className="li-v2-empty">
              <i className="fab fa-linkedin"></i>
              <p>Choose a template or type a topic above, then click Generate to build your LinkedIn post components.</p>
            </div>
          )}

          {!generation && generating && (
            <div className="li-v2-empty">
              <i className="fas fa-spinner fa-spin" style={{ color: 'var(--primary)', opacity: 0.8 }}></i>
              <p>Generating 10 titles, 3 body options, and hashtags from your knowledge base…</p>
            </div>
          )}
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
                <p>No posts saved yet. Use the Generator to create and save LinkedIn posts.</p>
              </div>
            ) : (
              <>
                <div className="li-history-list">
                  {posts.map(post => (
                    <HistoryPostCard
                      key={post._id}
                      post={post}
                      onDelete={deletePost}
                      onToggleFavorite={toggleFavoritePost}
                    />
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
          {/* Knowledge base — what the agent actually knows about you */}
          <div className="chatbot-config-form stat-card" style={{ marginBottom: '1.25rem' }}>
            <h3 className="chatbot-section-title"><i className="fas fa-brain"></i> Knowledge Base</h3>
            <p className="form-hint" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
              The agent grounds every post in this knowledge base. Your bio and your saved posts are indexed here so
              generations know your background and past content — not just the chunks you added in the chatbot.
            </p>

            <div className="form-group">
              <label>Professional Bio / About</label>
              <textarea
                className="form-input chatbot-textarea"
                rows={6}
                placeholder="Write your professional bio / about-me here. This grounds the tone and facts of generated posts."
                value={bio}
                onChange={e => setBio(e.target.value)}
              />
              <span className="form-hint">Saved to your profile, then indexed on the next sync.</span>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" className="btn-secondary" onClick={saveBio} disabled={savingBio}>
                <i className="fas fa-save"></i> {savingBio ? 'Saving…' : 'Save Bio'}
              </button>
              <button type="button" className="btn-primary" onClick={syncKnowledge} disabled={syncing}>
                <i className={`fas ${syncing ? 'fa-spinner fa-spin' : 'fa-rotate'}`}></i>
                {syncing ? ' Syncing…' : ' Sync knowledge base'}
              </button>
              {syncResult && (
                <span className="form-hint" style={{ margin: 0 }}>
                  Indexed {syncResult.posts}/{syncResult.totalPosts} saved post(s){syncResult.bioIndexed ? ' + bio' : ''} · {syncResult.chunks} chunks
                </span>
              )}
            </div>
          </div>

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
                    min={256} max={65536}
                    value={config.maxTokens}
                    onChange={e => setConfig(c => ({ ...c, maxTokens: Number(e.target.value) }))}
                  />
                  <span className="form-hint">gemini-2.5-flash supports up to 65,536 (default: 8192)</span>
                </div>

                <div className="form-group">
                  <label>Input Context — Top K Chunks</label>
                  <div className="slider-row">
                    <input
                      type="range" min={1} max={20}
                      value={config.topK}
                      onChange={e => setConfig(c => ({ ...c, topK: Number(e.target.value) }))}
                    />
                    <span className="slider-val">{config.topK}</span>
                  </div>
                  <span className="form-hint">Knowledge base chunks sent as context per generation</span>
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
                  rows={12}
                  value={config.systemPrompt}
                  onChange={e => setConfig(c => ({ ...c, systemPrompt: e.target.value }))}
                />
                <span className="form-hint">
                  Must instruct Gemini to return a JSON object with "titles" (10 strings), "bodies" (3 strings), and "hashtags" (20–25 strings mixing niche + viral tags, no # prefix).
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

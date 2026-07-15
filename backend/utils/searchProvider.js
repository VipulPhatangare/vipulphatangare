// Swappable company-search provider. Set SEARCH_PROVIDER=serpapi | tavily in .env
// plus the matching key: SERPAPI_KEY or TAVILY_API_KEY.

async function searchWithSerpApi(query) {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error('SERPAPI_KEY is not set.');
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=10&api_key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`SerpAPI error ${res.status}`);
  const data = await res.json();
  const organic = data.organic_results || [];
  return organic.map(r => ({
    title: r.title || '',
    snippet: r.snippet || '',
    link: r.link || ''
  }));
}

async function searchWithTavily(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error('TAVILY_API_KEY is not set.');
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ query, max_results: 10, search_depth: 'basic', include_answer: true }),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`Tavily error ${res.status}`);
  const data = await res.json();
  const results = (data.results || []).map(r => ({
    title: r.title || '',
    snippet: r.content || '',
    link: r.url || ''
  }));
  if (data.answer) results.unshift({ title: 'Tavily summary', snippet: data.answer, link: '' });
  return results;
}

// Drop duplicate hits that appear across more than one query angle, so the same
// article isn't summarized twice (wastes Gemini tokens). Keyed by link, falling
// back to a normalized title when a result carries no link (e.g. Tavily summary).
function dedupeResults(results) {
  const seen = new Set();
  const out = [];
  for (const r of results) {
    const key = (r.link && r.link.trim())
      ? r.link.trim().toLowerCase().replace(/[?#].*$/, '')
      : `title:${(r.title || '').trim().toLowerCase()}`;
    if (!key || key === 'title:') continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

// Returns [{ title, snippet, link }] across a few company-research angles
async function searchCompany(companyName) {
  const provider = (process.env.SEARCH_PROVIDER || 'tavily').toLowerCase();
  const search = provider === 'serpapi' ? searchWithSerpApi : searchWithTavily;

  // Current year keeps the "recent news" angle from silently going stale each Jan.
  const year = new Date().getFullYear();
  const queries = [
    `${companyName} company overview industry products`,
    `${companyName} technology stack engineering culture`,
    `${companyName} recent news ${year}`
  ];

  const settled = await Promise.allSettled(queries.map(q => search(q)));
  const collected = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') collected.push(...s.value);
    else console.warn('[searchProvider]', provider, 'query failed:', s.reason?.message);
  }
  if (!collected.length) {
    const errors = settled.filter(s => s.status === 'rejected').map(s => s.reason?.message).join('; ');
    throw new Error(`Company search returned no results (${provider}): ${errors || 'empty responses'}`);
  }
  const results = dedupeResults(collected);
  console.log(`[searchProvider] ${provider}: ${results.length} unique results (${collected.length} raw) for "${companyName}"`);
  return { provider, results };
}

module.exports = { searchCompany };

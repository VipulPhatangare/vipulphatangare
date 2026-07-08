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

// Returns [{ title, snippet, link }] across a few company-research angles
async function searchCompany(companyName) {
  const provider = (process.env.SEARCH_PROVIDER || 'tavily').toLowerCase();
  const search = provider === 'serpapi' ? searchWithSerpApi : searchWithTavily;

  const queries = [
    `${companyName} company overview industry products`,
    `${companyName} technology stack engineering culture`,
    `${companyName} recent news 2026`
  ];

  const settled = await Promise.allSettled(queries.map(q => search(q)));
  const results = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') results.push(...s.value);
    else console.warn('[searchProvider]', provider, 'query failed:', s.reason?.message);
  }
  if (!results.length) {
    const errors = settled.filter(s => s.status === 'rejected').map(s => s.reason?.message).join('; ');
    throw new Error(`Company search returned no results (${provider}): ${errors || 'empty responses'}`);
  }
  console.log(`[searchProvider] ${provider}: ${results.length} results for "${companyName}"`);
  return { provider, results };
}

module.exports = { searchCompany };

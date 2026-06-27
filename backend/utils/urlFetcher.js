async function fetchUrlMeta(rawUrl) {
  let url;
  try { url = new URL(rawUrl).href; } catch { return null; }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkedInPostBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow'
    });

    if (!res.ok) return { url, title: '', description: '' };

    const html = await res.text();

    const pick = (...patterns) => {
      for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1]?.trim()) return m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
      }
      return '';
    };

    const title = pick(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,200})["']/i,
      /<meta[^>]+content=["']([^"']{1,200})["'][^>]+property=["']og:title["']/i,
      /<title[^>]*>([^<]{1,200})<\/title>/i
    );

    const description = pick(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,600})["']/i,
      /<meta[^>]+content=["']([^"']{1,600})["'][^>]+property=["']og:description["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,600})["']/i,
      /<meta[^>]+content=["']([^"']{1,600})["'][^>]+name=["']description["']/i
    );

    console.log('[urlFetcher]', url, '| title:', title.slice(0, 60), '| desc:', description.slice(0, 80));
    return { url, title, description };
  } catch (err) {
    console.warn('[urlFetcher] Failed:', url, err.message);
    return { url, title: '', description: '' };
  }
}

module.exports = { fetchUrlMeta };

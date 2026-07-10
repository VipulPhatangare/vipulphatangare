// Pulls Google Form links and supporting document links out of an email body.
// Pure string parsing — no network, no LLM — so it is safe to run on every mail.
// The body may be plain text or HTML (links inside href="..."); the generic URL
// regex below catches both.

const URL_RE = /https?:\/\/[^\s"'<>)\]}]+/gi;

// Trailing punctuation that commonly clings to a URL in prose / HTML.
function cleanUrl(u) {
  const cleaned = u.replace(/[.,;:!?)]+$/, '').replace(/&amp;/g, '&').trim();
  return unwrapGoogleRedirect(cleaned);
}

// Gmail rewrites links as https://www.google.com/url?q=<encoded>&... — unwrap to
// recover the real destination so form/doc detection works on it.
function unwrapGoogleRedirect(u) {
  try {
    const url = new URL(u);
    if (/(^|\.)google\.com$/i.test(url.hostname) && url.pathname === '/url') {
      const q = url.searchParams.get('q');
      if (q) return q;
    }
  } catch { /* not a parseable URL */ }
  return u;
}

function isFormUrl(u) {
  return /(?:^|\/\/)(?:forms\.gle\/)/i.test(u) ||
         /docs\.google\.com\/forms\//i.test(u);
}

function isDocUrl(u) {
  return /docs\.google\.com\/(?:document|spreadsheets|presentation)\//i.test(u) ||
         /drive\.google\.com\/(?:file|open|drive)/i.test(u) ||
         /\.(?:pdf|docx?|pptx?|xlsx?)(?:$|[?#])/i.test(u);
}

// Returns { formUrl, formUrls[], docLinks[] } found in `text`.
// formUrl is the first Google Form link (the one the agent will act on); formUrls
// keeps all of them in case a mail carries more than one form.
function extractLinks(text) {
  if (!text || typeof text !== 'string') return { formUrl: null, formUrls: [], docLinks: [] };

  const seen = new Set();
  const formUrls = [];
  const docLinks = [];

  const matches = text.match(URL_RE) || [];
  for (const raw of matches) {
    const u = cleanUrl(raw);
    if (!u || seen.has(u)) continue;
    seen.add(u);
    if (isFormUrl(u)) formUrls.push(u);
    else if (isDocUrl(u)) docLinks.push(u);
  }

  return { formUrl: formUrls[0] || null, formUrls, docLinks };
}

module.exports = { extractLinks, isFormUrl, isDocUrl };

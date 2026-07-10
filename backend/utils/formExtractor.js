// Google Form schema extractor — no browser required.
//
// A public Google Form renders its questions client-side from a big JSON array
// embedded in the page as `var FB_PUBLIC_LOAD_DATA_ = [...];`. We fetch the
// viewform HTML, pull that array out, and walk it into a clean question list.
//
// Array shape (the parts we rely on):
//   data[1][1]            → array of form "items" (questions + layout blocks)
//   item[0]               → item id
//   item[1]               → question text / title
//   item[2]               → description (often null)
//   item[3]               → type code (see TYPE_MAP)
//   item[4]               → array of "entries" (submit fields); grids have many
//     entry[0]            → entry id  → submits as `entry.<id>`
//     entry[1]            → options   → [[label,...], ...] for choice types, else null
//     entry[2]            → required flag ([1] = required)
//     entry[3]            → row label for grids ([label])

// Answerable question types → our internal keys. Codes not listed (6 title,
// 8 section/page-break, 11 image, 12 video) are layout/media and are skipped.
const TYPE_MAP = {
  0:  'short_text',
  1:  'paragraph',
  2:  'multiple_choice',
  3:  'dropdown',
  4:  'checkboxes',
  5:  'linear_scale',
  7:  'grid',
  9:  'date',
  10: 'time',
  13: 'file_upload'
};

// Normalise any Google Form URL to its public viewform address, following
// forms.gle short links via the fetch redirect.
function normalizeFormUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return null; }
  // Short links resolve on fetch; leave them as-is.
  if (/forms\.gle$/i.test(u.hostname)) return u.href;
  if (!/\/viewform/i.test(u.pathname)) {
    u.pathname = u.pathname.replace(/\/(edit|closedform)\/?$/i, '/').replace(/\/$/, '') + '/viewform';
  }
  return u.href;
}

async function fetchFormHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml'
    },
    signal: AbortSignal.timeout(12000),
    redirect: 'follow'
  });
  return { ok: res.ok, status: res.status, finalUrl: res.url, html: res.ok ? await res.text() : '' };
}

// Extracts and JSON-parses the FB_PUBLIC_LOAD_DATA_ array from form HTML.
function parseLoadData(html) {
  const start = html.indexOf('FB_PUBLIC_LOAD_DATA_');
  if (start === -1) return null;
  const eq = html.indexOf('=', start);
  if (eq === -1) return null;
  // The value is `[ ... ];` — scan bracket depth from the first '[' so we stop
  // at the exact matching close, ignoring brackets inside strings.
  const open = html.indexOf('[', eq);
  if (open === -1) return null;

  let depth = 0, inStr = false, esc = false;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) {
        const json = html.slice(open, i + 1);
        try { return JSON.parse(json); } catch { return null; }
      }
    }
  }
  return null;
}

function mapQuestion(item) {
  const typeCode = item[3];
  const type = TYPE_MAP[typeCode];
  if (!type) return null; // layout / media block, not a question

  const entriesRaw = Array.isArray(item[4]) ? item[4] : [];
  const entries = entriesRaw.map(e => ({
    entryId:  e?.[0] != null ? `entry.${e[0]}` : null,
    options:  Array.isArray(e?.[1]) ? e[1].map(o => (Array.isArray(o) ? o[0] : o)).filter(v => v != null) : [],
    required: e?.[2] === 1,
    rowLabel: Array.isArray(e?.[3]) ? e[3][0] : ''
  }));

  const first = entries[0] || {};
  return {
    id:        item[0],
    text:      (item[1] || '').trim(),
    description: (item[2] || '').trim(),
    typeCode,
    type,
    required:  entries.some(e => e.required),
    entryId:   first.entryId || null,
    entryIds:  entries.map(e => e.entryId).filter(Boolean),
    options:   first.options || [],
    entries    // full detail (grids expose per-row entries)
  };
}

// Main entry point. Returns { ok, error?, formUrl, title, questions[] }.
// Wraps the worker so every failure reason is logged with the URL that caused it.
async function extractFormSchema(rawUrl) {
  const result = await _extractFormSchema(rawUrl);
  if (!result.ok) console.warn(`[formExtractor] FAIL "${result.error}" | url: ${rawUrl}`);
  return result;
}

// Turns Google's FB_PUBLIC_LOAD_DATA_ array into our clean result.
function buildResult(data, finalUrl) {
  const items = data?.[1]?.[1];
  if (!Array.isArray(items)) return { ok: false, error: 'No questions found in this form.' };
  const title = (data?.[1]?.[8] || data?.[3] || '').trim();
  const questions = items.map(mapQuestion).filter(Boolean);
  console.log(`[formExtractor] OK "${title}" — ${questions.length} questions | ${finalUrl}`);
  return { ok: true, formUrl: finalUrl, title, questions };
}

const SIGNIN_RE = /ServiceLogin|accounts\.google\.com\/(?:v3\/)?signin/i;

async function _extractFormSchema(rawUrl) {
  const url = normalizeFormUrl(rawUrl);
  if (!url) return { ok: false, error: 'Invalid form URL' };

  // 1) Fast path — plain public fetch. Works for any public form.
  let data = null, finalUrl = url, fetchStatus = 0;
  try {
    const fetched = await fetchFormHtml(url);
    fetchStatus = fetched.status;
    if (fetched.ok && !SIGNIN_RE.test(fetched.finalUrl)) {
      finalUrl = fetched.finalUrl;
      data = parseLoadData(fetched.html);
    }
  } catch (err) {
    return { ok: false, error: `Could not reach the form (${err.message})` };
  }

  // 2) Reliable path for sign-in-gated forms — load in a real browser with the
  //    saved session. Raw fetch can't complete Google's auth, but Chromium can.
  if (!data) {
    const { hasSession } = require('./formSession');
    if (hasSession()) {
      const { loadFormData } = require('./formFiller');
      const br = await loadFormData(url);
      if (br.ok && br.data) { data = br.data; finalUrl = br.finalUrl; }
      else if (br.reason === 'captcha')
        return { ok: false, error: 'A CAPTCHA / bot check appeared — this form must be opened manually.' };
    }
  }

  // 3) Still nothing → explain why (status kept for logging context).
  if (!data) {
    const { hasSession } = require('./formSession');
    return { ok: false, error: hasSession()
      ? `Signed in, but this form still would not open (HTTP ${fetchStatus || 'n/a'}) — it may be limited to one specific Google account. Try scripts/formLogin.js with the exact account it was shared to, or fill it manually.`
      : 'This form requires sign-in / is restricted. Run scripts/formLogin.js with an account that can open it, then retry.' };
  }

  return buildResult(data, finalUrl);
}

module.exports = { extractFormSchema, normalizeFormUrl, TYPE_MAP };

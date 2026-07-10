const fs = require('fs');
const path = require('path');
const { hasSession, PROFILE_DIR } = require('./formSession');

// Puppeteer-driven Google Form filler. Two modes:
//   fillForm(run, { submit:false }) → fill + screenshot, DO NOT submit (preview)
//   fillForm(run, { submit:true })  → fill, then click Submit and verify
//
// Stateless: each call re-fills from the reviewed FormRun, so the preview the user
// approves is exactly what gets submitted. Fails gracefully on login walls and
// CAPTCHAs instead of hanging.

const SHOT_DIR  = path.join(__dirname, '..', '..', 'uploads', 'formfills');
const DOCS_DIR  = process.env.DOCS_DIR || path.join(__dirname, '..', '..', 'docs');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm  = s => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

// Fully clear a text input/textarea, then type — so a value doesn't append onto
// a restored draft (Google Forms saves progress for signed-in users). clickCount:3
// only selects one line, so use Ctrl+A which works for both input and textarea.
async function clearAndType(page, el, value) {
  await el.click();
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await el.type(String(value), { delay: 6 });
}

// Normalise a stored date to yyyy-mm-dd (what native date inputs expect).
// Accepts ISO already, or dd/mm/yyyy / dd-mm-yyyy (Indian order).
function toISODate(v) {
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d) ? s : d.toISOString().slice(0, 10);
}

// `ouid` pins the link to one specific Google account (often not the one we're
// signed in as → "page not found"). Drop it so Google uses our signed-in account.
function stripOuid(u) {
  try { const url = new URL(u); url.searchParams.delete('ouid'); return url.href; }
  catch { return u; }
}

// Launch options — reuse the persistent logged-in Chrome profile when one exists.
// The extra flags stop Chrome from reopening the previous session's tabs / showing
// a "restore pages?" bubble, which can hang a headless relaunch of a real profile.
function launchOpts() {
  const opts = {
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled',
      '--no-first-run', '--no-default-browser-check',
      '--hide-crash-restore-bubble', '--disable-session-crashed-bubble',
      '--restore-last-session=false'
    ]
  };
  if (hasSession()) opts.userDataDir = PROFILE_DIR;
  return opts;
}

// A relaunch of a profile that didn't close cleanly leaves a SingletonLock that
// blocks the new headless instance. Safe to clear when no Chrome is using it.
function clearStaleLock() {
  for (const name of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    try { fs.rmSync(path.join(PROFILE_DIR, name), { force: true }); } catch {}
  }
}

// Fresh blank page with hard timeouts so no step can hang indefinitely.
async function freshPage(browser) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(45000);
  page.setDefaultTimeout(20000);
  // Close any tabs Chrome restored from the profile.
  for (const p of await browser.pages()) if (p !== page) await p.close().catch(() => {});
  return page;
}

// Load the form and wait for its questions to render (they come from JS, so
// networkidle is unreliable on authed pages — wait for the DOM we need instead).
async function gotoForm(page, url) {
  await page.goto(stripOuid(url), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('div[role="listitem"]', { timeout: 20000 }).catch(() => {});
}

// Reset any saved draft (signed-in users get their previous answers restored),
// so every fill starts from a blank form. Best-effort: "Clear form" then confirm.
async function clearDraft(page) {
  try {
    const clickByText = async (re) => {
      for (const el of await page.$$('div[role="button"], a, span[role="button"]')) {
        const t = (await el.evaluate(e => (e.innerText || '').trim()).catch(() => ''));
        if (re.test(t)) { await el.click().catch(() => {}); return true; }
      }
      return false;
    };
    if (!(await clickByText(/^clear form$/i))) return;
    await sleep(500);
    await clickByText(/^clear form$/i);   // confirm dialog
    await sleep(800);
    await page.keyboard.press('Escape').catch(() => {}); // close dialog if still open
    await page.waitForSelector('div[role="listitem"]', { timeout: 10000 }).catch(() => {});
  } catch { /* non-fatal */ }
}

// Is the page a Google sign-in / permission wall rather than the form?
async function detectBlockers(page) {
  const url = page.url();
  if (/accounts\.google\.com|ServiceLogin|signin\/v\d/i.test(url)) return 'login_required';
  const body = await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
  if (/you need permission|request access|sign in to continue/i.test(body)) return 'login_required';
  if (/unusual traffic|not a robot|recaptcha/i.test(body)) return 'captcha';
  const hasCaptcha = await page.$('iframe[src*="recaptcha"], iframe[title*="captcha" i]').catch(() => null);
  if (hasCaptcha) return 'captcha';
  return null;
}

// Fill one question container based on the reviewed field's type + answer.
async function fillItem(page, item, field, warnings) {
  const t = field.type;
  const ans = field.answer;
  if (ans == null || ans === '' || (Array.isArray(ans) && ans.length === 0)) return;

  try {
    if (t === 'paragraph' || t === 'short_text' || !['multiple_choice','dropdown','checkboxes','file_upload','date','time'].includes(t)) {
      const el = await item.$('textarea') || await item.$('input[type="text"], input[type="email"], input:not([type="hidden"])');
      if (el) { await clearAndType(page, el, ans); return; }
      warnings.push(`No input found for "${field.text}"`); return;
    }

    if (t === 'multiple_choice') {
      const radios = await item.$$('[role="radio"]');
      for (const r of radios) {
        const label = await r.evaluate(e => e.getAttribute('aria-label') || e.innerText || '');
        if (norm(label) === norm(ans) || norm(label).includes(norm(ans))) { await r.click(); return; }
      }
      warnings.push(`Option "${ans}" not found for "${field.text}"`); return;
    }

    if (t === 'checkboxes') {
      const wanted = Array.isArray(ans) ? ans : String(ans).split(', ');
      const boxes = await item.$$('[role="checkbox"]');
      for (const b of boxes) {
        const label = await b.evaluate(e => e.getAttribute('aria-label') || e.innerText || '');
        if (wanted.some(w => norm(label) === norm(w) || norm(label).includes(norm(w)))) await b.click();
      }
      return;
    }

    if (t === 'dropdown') {
      const box = await item.$('[role="listbox"]');
      if (box) {
        await box.click(); await sleep(300);
        const opts = await page.$$('[role="option"]');
        for (const o of opts) {
          const label = await o.evaluate(e => e.getAttribute('data-value') || e.innerText || '');
          if (norm(label) === norm(ans) || norm(label).includes(norm(ans))) { await o.click(); return; }
        }
      }
      warnings.push(`Dropdown option "${ans}" not set for "${field.text}"`); return;
    }

    if (t === 'date' || t === 'time') {
      const el = await item.$(`input[type="${t}"]`) || await item.$('input:not([type="hidden"])');
      if (!el) { warnings.push(`Could not find ${t} input for "${field.text}"`); return; }
      // Native date/time inputs can't be reliably typed — set .value directly
      // (yyyy-mm-dd for date) and dispatch input/change so the form registers it.
      const val = t === 'date' ? toISODate(ans) : String(ans);
      await el.evaluate((e, v) => {
        e.focus(); e.value = v;
        e.dispatchEvent(new Event('input',  { bubbles: true }));
        e.dispatchEvent(new Event('change', { bubbles: true }));
      }, val);
      const after = await el.evaluate(e => e.value);
      if (!after) { // fallback: type digits only, in the input's own order
        await el.click(); await el.type(String(val).replace(/\D/g, ''), { delay: 40 });
      }
      return;
    }

    if (t === 'file_upload') {
      const file = path.join(DOCS_DIR, path.basename(String(ans)));
      if (!fs.existsSync(file)) { warnings.push(`File missing for "${field.text}": ${file}`); return; }
      const input = await item.$('input[type="file"]');
      if (input) { await input.uploadFile(file); return; }
      // Google Forms uploads open a Drive picker in an iframe — not reliably
      // automatable headless. Flag for manual attach rather than guess.
      warnings.push(`Upload for "${field.text}" needs manual attach (Google Drive picker).`);
      return;
    }
  } catch (e) {
    warnings.push(`Failed to fill "${field.text}": ${e.message}`);
  }
}

async function fillForm(run, { submit = false } = {}) {
  const puppeteer = require('puppeteer');
  ensureDir(SHOT_DIR);
  const warnings = [];
  let browser;

  try {
    clearStaleLock();
    browser = await puppeteer.launch(launchOpts());
    const page = await freshPage(browser);
    await page.setViewport({ width: 1100, height: 1400 });

    await gotoForm(page, run.formUrl);

    const blocker = await detectBlockers(page);
    if (blocker) {
      return { ok: false, reason: blocker,
        error: blocker === 'login_required'
          ? 'The form requires sign-in (domain-restricted or private). Save a Google session via scripts/formLogin.js, or fill it manually.'
          : 'A CAPTCHA / bot check appeared. This form must be completed manually.' };
    }

    await clearDraft(page); // start from a blank form, not a restored draft

    // Match each rendered question to a reviewed field by its heading text.
    const items = await page.$$('div[role="listitem"]');
    let filled = 0;
    for (const item of items) {
      const heading = await item.$eval('[role="heading"]', el => el.innerText).catch(() => '');
      if (!heading) continue;
      const hNorm = norm(heading);
      const field = run.fields.find(f => {
        const fNorm = norm(f.text);
        return fNorm && (hNorm.includes(fNorm) || fNorm.includes(hNorm));
      });
      if (!field) continue;
      await fillItem(page, item, field, warnings);
      filled++;
    }

    // Auto-tick Google's required "Record <email> as the email…" checkbox — it's
    // not a real question but blocks submission if left unchecked.
    try {
      const emailBoxes = await page.$$('[role="checkbox"]');
      for (const b of emailBoxes) {
        const label = await b.evaluate(e => e.getAttribute('aria-label') || e.innerText || '');
        const checked = await b.evaluate(e => e.getAttribute('aria-checked') === 'true');
        if (/record .*as the email|email to be included/i.test(label) && !checked) await b.click();
      }
    } catch { /* best-effort */ }

    // Screenshot the filled state for the review UI (before any submit).
    const shotName = `${run._id}-${Date.now()}.png`;
    await page.screenshot({ path: path.join(SHOT_DIR, shotName), fullPage: true });
    const screenshotPath = `/uploads/formfills/${shotName}`;

    if (!submit) {
      return { ok: true, screenshotPath, filled, total: run.fields.length, warnings, submitted: false };
    }

    // ── Submit (explicit) ──
    const buttons = await page.$$('div[role="button"], button');
    let submitBtn = null;
    for (const b of buttons) {
      const txt = await b.evaluate(e => e.innerText || '').catch(() => '');
      if (/^submit$/i.test(txt.trim())) { submitBtn = b; break; }
    }
    if (!submitBtn) return { ok: false, reason: 'no_submit', screenshotPath, error: 'Submit button not found on the form.' };

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
      submitBtn.click()
    ]);

    const confirmText = await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
    const success = /your response has been recorded|thanks for|response has been submitted/i.test(confirmText)
                    || /formResponse/i.test(page.url());

    const confShot = `${run._id}-confirm-${Date.now()}.png`;
    await page.screenshot({ path: path.join(SHOT_DIR, confShot), fullPage: true }).catch(() => {});

    return {
      ok: success, submitted: success,
      screenshotPath: `/uploads/formfills/${confShot}`,
      filled, total: run.fields.length, warnings,
      error: success ? '' : 'Submitted, but no confirmation was detected — verify the form manually.'
    };
  } catch (err) {
    return { ok: false, reason: 'error', error: err.message, warnings };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// Loads a form in a real browser with the saved session and returns Google's
// embedded FB_PUBLIC_LOAD_DATA_ array. Used by formExtractor as the reliable
// path for sign-in-gated forms (raw fetch can't complete Google's auth).
async function loadFormData(url) {
  const puppeteer = require('puppeteer');
  let browser;
  try {
    clearStaleLock();
    browser = await puppeteer.launch(launchOpts());
    const page = await freshPage(browser);
    await gotoForm(page, url);

    const blocker = await detectBlockers(page);
    if (blocker) return { ok: false, reason: blocker };

    const data = await page.evaluate(() => window.FB_PUBLIC_LOAD_DATA_ || null);
    if (!data) return { ok: false, reason: 'no_data' };
    return { ok: true, data, finalUrl: page.url() };
  } catch (err) {
    return { ok: false, reason: 'error', error: err.message };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { fillForm, loadFormData };

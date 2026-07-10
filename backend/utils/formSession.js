const fs = require('fs');
const path = require('path');

// The form filler signs into Google using a PERSISTENT Chrome profile on disk,
// shared between scripts/formLogin.js (one-time headed login) and the headless
// filler. This is far more reliable than copying cookies — Google marks copied
// cookies as "signed out", but a real profile keeps the full logged-in state.
//
// The profile lives under backend/.sessions/ (gitignored). On Windows, Chrome
// encrypts its cookie store via OS DPAPI tied to your user account.
const SESSION_DIR = process.env.FORM_SESSION_DIR || path.join(__dirname, '..', '.sessions');
const PROFILE_DIR = path.join(SESSION_DIR, 'chrome-profile');

// A usable session exists once the profile has been created by a login and holds
// Chrome's cookie store.
function hasSession() {
  try {
    if (!fs.existsSync(PROFILE_DIR)) return false;
    const cookieStore = path.join(PROFILE_DIR, 'Default', 'Network', 'Cookies');
    const legacyStore  = path.join(PROFILE_DIR, 'Default', 'Cookies');
    return fs.existsSync(cookieStore) || fs.existsSync(legacyStore) ||
           fs.readdirSync(PROFILE_DIR).length > 0;
  } catch { return false; }
}

function ensureProfileParent() {
  if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
}

function clearSession() {
  if (fs.existsSync(PROFILE_DIR)) fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
}

module.exports = { hasSession, clearSession, ensureProfileParent, PROFILE_DIR };

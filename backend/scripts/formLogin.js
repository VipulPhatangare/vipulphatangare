// One-time Google login for the form filler, using a persistent Chrome profile.
//
//   node scripts/formLogin.js
//
// A real Chrome window opens using the SAME on-disk profile the headless filler
// uses. Log into the Google account you want forms submitted as, then return to
// this terminal and press ENTER. The login persists in backend/.sessions/ and is
// reused automatically. Run again anytime the session expires. Nothing submits.
require('dotenv').config();
const readline = require('readline');
const { PROFILE_DIR, ensureProfileParent } = require('../utils/formSession');

function waitForEnter(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(msg, () => { rl.close(); res(); }));
}

(async () => {
  ensureProfileParent();
  const puppeteer = require('puppeteer');
  console.log('Opening a browser window for Google login…');
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: PROFILE_DIR,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  try {
    const page = (await browser.pages())[0] || await browser.newPage();
    await page.goto('https://accounts.google.com/', { waitUntil: 'networkidle2' });

    await waitForEnter('\n👉 Finish logging into Google in the browser (get all the way to a signed-in page), then press ENTER here…\n');

    // Confirm we can actually reach a form/Drive page as a signed-in user.
    await page.goto('https://docs.google.com/forms', { waitUntil: 'domcontentloaded' }).catch(() => {});
    const signedIn = !/accounts\.google\.com/i.test(page.url());
    console.log(signedIn
      ? `\n✅ Session saved to profile → ${PROFILE_DIR}\nThe form filler will now act as this account.`
      : `\n⚠️  Still looks signed out. Re-run and make sure you complete the Google login before pressing ENTER.`);
  } catch (err) {
    console.error('Login capture failed:', err.message);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();

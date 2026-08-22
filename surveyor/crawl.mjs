// THE CRAWL — walk an unfamiliar system read-only and write down what it is.
//
// Genericised out of the Concerto and VX passes. It knows nothing about either:
// it signs in attended, follows the navigation, and captures every screen the
// same way, so the proposer has something uniform to read.
//
// ATTENDED BY DEFAULT, AND NOT NEGOTIABLE HERE.
// A person signs in. This never sees, stores or types a password. Concerto locks
// an account after three wrong attempts and only the vendor can undo it, inside
// 24 working hours — on a client's live helpdesk account that is not our
// afternoon to gamble. Where a system genuinely permits stored credentials they
// belong in Windows Credential Manager, and still not in here.
//
// WHAT IT TOUCHES, PRECISELY.
//
// It is not true that this presses nothing — an earlier version of this comment
// said so and it was wrong. It clicks rows to open a record, clicks dropdown
// toggles to reveal what is inside them, and presses Enter and Escape. A system
// that only responds to clicks cannot be read without clicking.
//
// The line is between NAVIGATION and COMMITMENT:
//   1. It clicks to MOVE and to REVEAL — links, tabs, rows, menu toggles.
//   2. It never chooses an item INSIDE an action menu, and never presses
//      anything that saves, submits, accepts, completes, approves or cancels.
//   3. Links whose name suggests creating, deleting or accepting are not opened
//      at all, so a stray GET cannot start a workflow.
//   4. Non-GET requests that look like mutations are ABORTED in the browser,
//      which is the backstop for everything above being wrong.
//   5. Every request is logged with its method, so a client can be shown
//      exactly what we did rather than told.
//
// AND IT IS PACED. Dwells are drawn from a heavy-tailed distribution rather
// than held constant — see pace.mjs for why that is about false fraud flags on
// a client's account and about load, not about hiding anything from a vendor.
import { chromium } from 'playwright';
import { rng, dwell, settle, scrollAbout, reachAndClick, wander } from './pace.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PERSISTS = /(save|submit|commit|confirm|delete|remove|insert|update|accept|complete|reject|approve)/i;
const AVOID = /(logout|signout|delete|remove|create|new|add|accept|complete|reject|approve|cancel)/i;

const SELECTS_FN = () => Array.from(document.querySelectorAll('select')).map((s) => ({
  id: s.id || null, name: s.name || null,
  options: Array.from(s.options).map((o) => ({ value: o.value, text: (o.textContent || '').trim() })).slice(0, 300),
}));
const FIELDS_FN = () => Array.from(document.querySelectorAll('input:not([type=hidden]), textarea')).map((el) => ({
  tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || null, id: el.id || null,
  name: el.getAttribute('name') || null, placeholder: el.getAttribute('placeholder') || null,
  readOnly: el.readOnly || el.getAttribute('readonly') !== null,
}));
const TABLES_FN = () => Array.from(document.querySelectorAll('table')).slice(0, 8).map((t) => ({
  headers: Array.from(t.querySelectorAll('th')).map((h) => (h.textContent || '').trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 40),
  rows: t.querySelectorAll('tr').length,
})).filter((t) => t.headers.length);
const LINKS_FN = () => Array.from(document.querySelectorAll('a[href]'))
  .map((a) => ({ text: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60), href: a.getAttribute('href') || '' }))
  .filter((l) => l.href && !/^(#|javascript:)/i.test(l.href));
const TEXT_FN = () => (document.body ? document.body.innerText.replace(/\n{3,}/g, '\n\n') : '');
const MENUS_FN = () => Array.from(document.querySelectorAll('[aria-haspopup="true"], .dropdown-toggle, [data-toggle="dropdown"]'))
  .map((el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)).filter(Boolean).slice(0, 30);

const slug = (s) => String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 50) || 'screen';

/**
 * @param {object} o
 * @param {string} o.id        short name for the system, used for the folder
 * @param {string} o.startUrl  where sign-in lives
 * @param {string} o.outDir    where captures go
 * @param {number} o.max       how many screens to visit
 * @param {(m:string)=>void} o.onProgress
 */
export const crawl = async ({ id, startUrl, outDir, max = 0, seed, onProgress = () => {}, onStart = () => {}, isReady = () => false }) => {
  fs.mkdirSync(outDir, { recursive: true });
  const say = (m) => { onProgress(m); console.log(' ·', m); };
  // Paced like a person, not because anything is being hidden — the access is
  // authorised and read-only — but because a metronome on a client's live
  // account is what trips a vendor's abuse heuristic, and that lands on THEIR
  // relationship with the vendor. See pace.mjs.
  const r = rng(seed);
  say('pacing: human (seed ' + (seed ?? 'random') + ')');

  // Its own profile, so nothing touches the browser already open — and NOT in
  // the repo. A signed-in profile holds session cookies, which are bearer
  // credentials: "we never store your password" is true and beside the point if
  // the cookie that stands in for it is sitting in a working tree. One of those
  // reached a git remote this week. It goes to the OS temp directory and is
  // destroyed when the walk ends, however the walk ends.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'surveyor-'));
  const ctx = await chromium.launchPersistentContext(profile, { headless: false, viewport: { width: 1600, height: 950 } });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  // A handle back to whoever started this, so a walk waiting ten minutes for a
  // sign-in that is never coming can be called off rather than sat out.
  let stopped = false;
  onStart({ stop: async () => { stopped = true; await ctx.close().catch(() => {}); } });
  /** The signed-in profile, gone. Called on every exit path including failure. */
  const burn = () => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* locked; nothing else to do */ } };
  process.once('exit', burn);
  const requests = [];
  await page.route('**', (route) => {
    const r = route.request();
    const e = { method: r.method(), url: r.url() };
    requests.push(e);
    if (r.method() !== 'GET' && PERSISTS.test(r.url())) { e.blocked = true; say('BLOCKED ' + r.method() + ' ' + r.url().slice(0, 80)); return route.abort(); }
    return route.continue();
  });

  await page.goto(startUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await settle(page, r, 3000);

  // GETTING TO THE SIGN-IN PAGE.
  //
  // The old test for "signed in" was "there is no password box", which is
  // instantly true on any public page. Pointed at a marketing site it declared
  // itself signed in and crawled the brochure. So: if there is no password box,
  // go and look for the way in, and then wait to be TOLD.
  const hasPw = async () => (await page.locator('input[type="password"]:visible').count().catch(() => 0)) > 0;
  const LOGIN = /(log ?in|sign ?in|login|signin|my account|portal)/i;
  if (!(await hasPw())) {
    let found = null, label = '';
    for (const f of page.frames()) {
      const links = f.locator('a[href], button');
      const n = Math.min(await links.count().catch(() => 0), 60);
      for (let i = 0; i < n && !found; i++) {
        const t = ((await links.nth(i).textContent().catch(() => '')) || '').trim();
        const href = (await links.nth(i).getAttribute('href').catch(() => '')) || '';
        if (!LOGIN.test(t) && !LOGIN.test(href)) continue;
        if (!(await links.nth(i).isVisible().catch(() => false))) continue;
        found = links.nth(i); label = t || href;
      }
      if (found) break;
    }
    if (found) {
      say('no sign-in box on that page - following "' + label.slice(0, 40) + '"');
      await reachAndClick(page, found, r);
      await settle(page, r, 2600);
    }
  }

  // WAIT TO BE TOLD, not to be guessed at. Either the password box appears and
  // then goes - a real sign-in, which is what happens on a CAFM - or the person
  // presses "I am in" in ProofMap. Both are explicit, and neither can fire on a
  // page that simply has no password field.
  say(await hasPw()
    ? 'sign in in the browser window - I will start when you are through'
    : 'no sign-in box found. Get signed in over there, then press "I am signed in" here.');
  const deadline = Date.now() + 900_000;
  let signedIn = false, sawPw = await hasPw();
  while (Date.now() < deadline && !stopped) {
    if (isReady()) { signedIn = true; say('you say you are in - starting'); break; }
    const pw = await hasPw();
    if (pw) sawPw = true;
    else if (sawPw) { signedIn = true; say('the sign-in page is gone - starting'); break; }
    await page.waitForTimeout(dwell(r, 2000, { sigma: 0.3, min: 1200, max: 4000 }));
  }
  if (stopped) { burn(); throw new Error('stopped before sign-in'); }
  if (!signedIn) { await ctx.close(); burn(); throw new Error('nobody signed in after fifteen minutes'); }
  await settle(page, r, 3400);
  say('signed in — walking the system');

  const inEvery = async (fn) => {
    const out = [];
    for (const f of page.frames()) {
      try { const r = await f.evaluate(fn); if (typeof r === 'string') out.push(r); else out.push(...r); } catch { /* detached */ }
    }
    return out;
  };
  const screens = [];
  const capture = async (name) => {
    const data = {
      name, url: page.url(), title: await page.title().catch(() => ''), capturedAt: new Date().toISOString(),
      selects: await inEvery(SELECTS_FN), fields: await inEvery(FIELDS_FN), tables: await inEvery(TABLES_FN),
      links: (await inEvery(LINKS_FN)).slice(0, 200), menus: await inEvery(MENUS_FN),
      text: (await inEvery(TEXT_FN)).join('\n').slice(0, 16000),
    };
    const file = 'screen-' + String(screens.length).padStart(2, '0') + '-' + slug(name);
    fs.writeFileSync(path.join(outDir, file + '.json'), JSON.stringify(data, null, 2));
    await page.screenshot({ path: path.join(outDir, file + '.png'), fullPage: true }).catch(() => {});
    screens.push({ file, name, url: data.url, tables: data.tables.length, selects: data.selects.length });
    say(`${screens.length}. ${name} — ${data.tables.length} table(s), ${data.selects.length} dropdown(s)`);
    return data;
  };

  const home = await capture('home');
  const origin = new URL(page.url()).origin;
  const targets = home.links
    .map((l) => { try { return { ...l, abs: new URL(l.href, page.url()).href }; } catch { return null; } })
    .filter((l) => l && l.abs.startsWith(origin) && l.text)
    .filter((l) => !AVOID.test(l.text) && !AVOID.test(l.abs))
    .filter((l, i, a) => a.findIndex((x) => x.abs === l.abs) === i);
  fs.writeFileSync(path.join(outDir, 'nav.json'), JSON.stringify(targets, null, 2));
  // It works out how much there is to look at rather than being told. A cap is
  // only applied if somebody explicitly asks for one.
  const visiting = max > 0 ? Math.min(max, targets.length) : targets.length;
  say(`found ${targets.length} screen${targets.length === 1 ? '' : 's'} — visiting ${visiting}`);

  // Read down the menu the way a person does — mostly in order, not rigidly.
  for (const t of wander(targets.slice(0, visiting), r)) {
    if (stopped) break;
    await page.goto(t.abs, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await settle(page, r, 2800);
    await capture(t.text);
    if (r() < 0.55) await scrollAbout(page, r, 1 + Math.floor(r() * 3));
  }

  // The biggest list is almost always the work queue, and the first row of it
  // is almost always a job. Rows in these systems are frequently not links —
  // Concerto's carry role="link" and open on Enter — so both are tried.
  const biggest = screens.slice().sort((a, b) => b.tables - a.tables)[0];
  if (biggest) {
    const j = JSON.parse(fs.readFileSync(path.join(outDir, biggest.file + '.json'), 'utf8'));
    await page.goto(j.url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await settle(page, r, 3200);
    await scrollAbout(page, r, 2);
    for (const f of page.frames()) {
      const row = f.locator('tr[role="link"], tbody tr').first();
      if (!(await row.count().catch(() => 0))) continue;
      const before = (await inEvery(TEXT_FN)).join('\n').length;
      await row.scrollIntoViewIfNeeded().catch(() => {});
      await row.focus().catch(() => {});
      await page.waitForTimeout(dwell(r, 900, { sigma: 0.5, min: 400 }));
      await row.press('Enter').catch(() => {});
      await settle(page, r, 3200);
      let after = (await inEvery(TEXT_FN)).join('\n').length;
      if (Math.abs(after - before) < 200) { await reachAndClick(page, row, r); await settle(page, r, 3000); }
      after = (await inEvery(TEXT_FN)).join('\n').length;
      if (Math.abs(after - before) > 200) { await capture('a record'); say('opened a record'); }
      else say('could not open a record from the list — worth a human look');
      break;
    }
    // Whatever menus the record offers, opened to be read and closed again.
    for (const f of page.frames()) {
      const t = f.locator('[aria-haspopup="true"], .dropdown-toggle, [data-toggle="dropdown"]');
      const n = await t.count().catch(() => 0);
      for (let i = 0; i < Math.min(n, 4); i++) {
        const b = t.nth(i);
        if (!(await b.isVisible().catch(() => false))) continue;
        await reachAndClick(page, b, r);
        await page.waitForTimeout(dwell(r, 1500, { sigma: 0.5, min: 600 }));
        await capture('menu ' + (i + 1));
        await page.waitForTimeout(dwell(r, 800, { sigma: 0.5, min: 300 }));
        await page.keyboard.press('Escape').catch(() => {});
      }
      break;
    }
  }

  fs.writeFileSync(path.join(outDir, 'requests.log'),
    requests.map((r) => (r.blocked ? 'BLOCKED ' : 'ok      ') + r.method + ' ' + r.url).join('\n'));
  fs.writeFileSync(path.join(outDir, 'survey.json'), JSON.stringify({
    id, startUrl, capturedAt: new Date().toISOString(), screens,
    requests: requests.length, blocked: requests.filter((r) => r.blocked).length,
  }, null, 2));
  say(`done — ${screens.length} screens, ${requests.filter((r) => r.blocked).length} requests blocked`);
  await ctx.close();
  burn();
  say('session profile destroyed');
  return { screens, requests: requests.length, blocked: requests.filter((r) => r.blocked).length };
};

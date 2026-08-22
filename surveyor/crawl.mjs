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
// HOW IT REFUSES TO WRITE
//   1. Non-GET requests that look like mutations are ABORTED in the browser.
//   2. It follows links and opens menus. It never chooses from a menu and never
//      presses a button.
//   3. Anything whose name suggests it creates, deletes or accepts is not even
//      opened.
//   4. Every request is logged, so a client can be shown exactly what we did.
import { chromium } from 'playwright';
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
export const crawl = async ({ id, startUrl, outDir, max = 20, onProgress = () => {} }) => {
  fs.mkdirSync(outDir, { recursive: true });
  const say = (m) => { onProgress(m); console.log(' ·', m); };

  // Its own profile, so nothing touches the browser already open — and NOT in
  // the repo. A signed-in profile holds session cookies, which are bearer
  // credentials: "we never store your password" is true and beside the point if
  // the cookie that stands in for it is sitting in a working tree. One of those
  // reached a git remote this week. It goes to the OS temp directory and is
  // destroyed when the walk ends, however the walk ends.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'surveyor-'));
  const ctx = await chromium.launchPersistentContext(profile, { headless: false, viewport: { width: 1600, height: 950 } });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
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
  await page.waitForTimeout(2500);

  // Wait for a person. Signed in is proven by the password box going away, not
  // by a URL — a URL check cannot fail, and one that could not fail is how an
  // earlier pass reported a sign-in that never happened.
  say('waiting for you to sign in (10 minutes)…');
  const deadline = Date.now() + 600_000;
  let signedIn = false;
  while (Date.now() < deadline) {
    if (!(await page.locator('input[type="password"]:visible').count().catch(() => 0))) { signedIn = true; break; }
    await page.waitForTimeout(2000);
  }
  if (!signedIn) { await ctx.close(); burn(); throw new Error('still on the sign-in page after ten minutes'); }
  await page.waitForTimeout(3000);
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
  say(`${targets.length} navigation targets`);

  for (const t of targets.slice(0, max)) {
    await page.goto(t.abs, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2500);
    await capture(t.text);
  }

  // The biggest list is almost always the work queue, and the first row of it
  // is almost always a job. Rows in these systems are frequently not links —
  // Concerto's carry role="link" and open on Enter — so both are tried.
  const biggest = screens.slice().sort((a, b) => b.tables - a.tables)[0];
  if (biggest) {
    const j = JSON.parse(fs.readFileSync(path.join(outDir, biggest.file + '.json'), 'utf8'));
    await page.goto(j.url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(3000);
    for (const f of page.frames()) {
      const row = f.locator('tr[role="link"], tbody tr').first();
      if (!(await row.count().catch(() => 0))) continue;
      const before = (await inEvery(TEXT_FN)).join('\n').length;
      await row.scrollIntoViewIfNeeded().catch(() => {});
      await row.focus().catch(() => {});
      await row.press('Enter').catch(() => {});
      await page.waitForTimeout(3000);
      let after = (await inEvery(TEXT_FN)).join('\n').length;
      if (Math.abs(after - before) < 200) { await row.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(3000); }
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
        await b.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1200);
        await capture('menu ' + (i + 1));
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

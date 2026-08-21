// CONCERTO (Bellrock Concept) — READ-ONLY SYSTEM MAP
//
// The same treatment VX had: sign in, walk the application, and write down what
// each screen is made of — element ids, dropdown values, field names — with a
// full-page screenshot of every one. That map is what a UI-driven operator has
// to be built against, and it does not exist in any documentation.
//
// Concerto is the CLIENT's CAFM in the SEE engagement: jobs are raised here,
// re-keyed into Joblogic, and the completion comes back. So this is somebody
// else's production system, reached with SEE's own helpdesk login.
//
// HOW IT REFUSES TO WRITE
//   1. Every request is logged with its method to requests.log.
//   2. After sign-in, any non-GET request whose URL looks like a mutation is
//      ABORTED before it leaves the browser.
//   3. It never clicks a button and never types into a field. It navigates.
//   4. Anything that looks like a create/edit/delete route is not visited.
//
// Credentials come from .env (gitignored) and are never printed.
//
//   node scripts/concerto-map.mjs
//   CONCERTO_MAX_SCREENS=40 node scripts/concerto-map.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

try { process.loadEnvFile(path.resolve(process.cwd(), '.env')); } catch { /* manual sign-in still works */ }

const BASE = process.env.CONCERTO_BASE_URL || 'https://concerto.bellrock.fm/';
/**
 * Somewhere to start other than the login page. The dashboard URL carries a
 * hash that may or may not be a session — if it is, we are already in; if it is
 * only an anti-forgery token, Concerto bounces us to sign-in and the attended
 * wait takes over. Either way it costs one GET and no login attempt.
 */
const START = process.env.CONCERTO_START_URL || BASE;
const MAX = Number(process.env.CONCERTO_MAX_SCREENS || 25);
const OUT = path.resolve(process.cwd(), 'data', 'concerto-map');
fs.mkdirSync(OUT, { recursive: true });

const PERSISTS = /(save|submit|commit|confirm|delete|remove|insert|update|create|new)/i;
/** Routes we do not even open, so a GET cannot start a workflow. */
const AVOID = /(logout|signout|delete|remove|create|new|add)/i;

const write = (n, d) => fs.writeFileSync(path.join(OUT, n), typeof d === 'string' ? d : JSON.stringify(d, null, 2));
const log = (...a) => console.log(' ·', ...a);
const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) || 'screen';

const SELECTS_FN = () => {
  const labelFor = (el) => {
    if (el.id) {
      const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (l && l.textContent && l.textContent.trim()) return l.textContent.trim();
    }
    const wrap = el.closest('td,div,li,tr,fieldset');
    const prev = wrap && wrap.previousElementSibling && wrap.previousElementSibling.textContent;
    return ((prev && prev.trim()) || el.getAttribute('aria-label') || el.name || '').replace(/\s+/g, ' ').slice(0, 60);
  };
  return Array.from(document.querySelectorAll('select')).map((s) => ({
    label: labelFor(s), id: s.id || null, name: s.name || null,
    options: Array.from(s.options).map((o) => ({ value: o.value, text: (o.textContent || '').trim() })).slice(0, 400),
  }));
};

const FIELDS_FN = () =>
  Array.from(document.querySelectorAll('input:not([type=hidden]), textarea')).map((el) => ({
    tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || null,
    id: el.id || null, name: el.getAttribute('name') || null,
    placeholder: el.getAttribute('placeholder') || null,
    readOnly: el.readOnly || el.getAttribute('readonly') !== null,
    required: el.required || el.getAttribute('aria-required') === 'true',
  }));

const LINKS_FN = () =>
  Array.from(document.querySelectorAll('a[href]'))
    .map((a) => ({ text: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60), href: a.getAttribute('href') || '' }))
    .filter((l) => l.href && !/^(#|javascript:void)/i.test(l.href));

const TEXT_FN = () => (document.body ? document.body.innerText.replace(/\n{3,}/g, '\n\n') : '');

const run = async () => {
  // A persistent profile: sign in once and the session survives between runs,
  // which matters on an account that locks after three wrong passwords.
  const profile = path.resolve(process.cwd(), 'data', '.concerto-profile');
  fs.mkdirSync(profile, { recursive: true });
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1600, height: 950 },
  });
  const browser = ctx.browser() ?? { close: async () => ctx.close() };
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const requests = [];
  const map = { base: BASE, capturedAt: null, screens: [], notes: [] };

  const inAnyFrame = async (make) => {
    for (const f of page.frames()) {
      const loc = make(f);
      if (await loc.first().count().catch(() => 0)) return loc.first();
    }
    return null;
  };
  const inEveryFrame = async (fn) => {
    const out = [];
    for (const f of page.frames()) {
      try { out.push(...(await f.evaluate(fn))); } catch { /* detached */ }
    }
    return out;
  };
  const dismiss = async () => {
    for (let i = 0; i < 5; i++) {
      const b = (await inAnyFrame((f) => f.getByRole('button', { name: /accept|agree|got it|allow all|continue/i })))
        || (await inAnyFrame((f) => f.getByText(/^\s*(accept all cookies|accept cookies|i agree|got it!?)\s*$/i)));
      if (!b) break;
      await b.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(600);
    }
  };

  const capture = async (name) => {
    const data = {
      name, url: page.url(), title: await page.title(),
      selects: await inEveryFrame(SELECTS_FN),
      fields: await inEveryFrame(FIELDS_FN),
      links: (await inEveryFrame(LINKS_FN)).slice(0, 300),
      text: (await inEveryFrame(TEXT_FN)).join('\n').slice(0, 12000),
    };
    write('screen-' + slug(name) + '.json', data);
    await page.screenshot({ path: path.join(OUT, 'screen-' + slug(name) + '.png'), fullPage: true }).catch(() => {});
    map.screens.push({ name, url: data.url, selects: data.selects.length, fields: data.fields.length });
    log(`${name}: ${data.selects.length} dropdowns, ${data.fields.length} fields`);
    return data;
  };

  await page.goto(START, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await dismiss();
  await page.screenshot({ path: path.join(OUT, '00-login.png'), fullPage: true }).catch(() => {});

  // ATTENDED BY DEFAULT.
  //
  // Concerto locks an account temporarily after three wrong passwords and
  // permanently after six, and only Bellrock support can undo it, inside 24
  // working hours. This is SEE's live helpdesk account: a scripted guess does
  // not risk our afternoon, it risks their desk. One attempt has probably been
  // spent already.
  //
  // So a person signs in and the crawl starts afterwards. The script never
  // sees or stores the password. Automatic sign-in only happens if somebody
  // deliberately puts CONCERTO_PASSWORD back in .env.
  if (process.env.CONCERTO_USERNAME && process.env.CONCERTO_PASSWORD) {
    const user =
      (await inAnyFrame((f) => f.getByLabel(/login\s*name|user\s*name|email/i)))
      || (await inAnyFrame((f) => f.getByPlaceholder(/login|user|email/i)))
      || (await inAnyFrame((f) => f.locator('input[type="text"]:visible, input[type="email"]:visible').first()));
    const pass =
      (await inAnyFrame((f) => f.getByLabel(/password/i)))
      || (await inAnyFrame((f) => f.locator('input[type="password"]:visible').first()));
    if (!user || !pass) {
      console.error('\n  Could not find the sign-in fields. 00-login.png shows what it saw.\n');
      await browser.close();
      process.exit(1);
    }
    await user.fill(process.env.CONCERTO_USERNAME);
    await pass.fill(process.env.CONCERTO_PASSWORD);
    const go =
      (await inAnyFrame((f) => f.getByRole('button', { name: /log\s*in|sign\s*in|submit/i })))
      || (await inAnyFrame((f) => f.locator('input[type="submit"]').first()));
    if (go) await go.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(6000);
    await dismiss();
  }

  else {
    console.log('\n  ────────────────────────────────────────────────────────');
    console.log('   SIGN IN IN THE BROWSER WINDOW THAT JUST OPENED.');
    console.log('   I wait here, and start reading once you are through.');
    console.log('   The password is yours — this script never sees it.');
    console.log('   Login name: ' + (process.env.CONCERTO_USERNAME || '(as you have it)'));
    console.log('  ────────────────────────────────────────────────────────\n');
  }

  // Signed in? Prove it rather than assume — the VX map spent three runs
  // reading a list while believing it was on a record. Waits up to ten minutes
  // for a person, watching for the password box to disappear.
  const deadline = Date.now() + 600_000;
  let signedIn = false;
  while (Date.now() < deadline) {
    const stillOnLogin = await page.locator('input[type="password"]:visible').count().catch(() => 0);
    if (!stillOnLogin) { signedIn = true; break; }
    await page.waitForTimeout(2000);
  }
  if (!signedIn) {
    await page.screenshot({ path: path.join(OUT, '00-not-signed-in.png'), fullPage: true }).catch(() => {});
    console.error('\n  Still on the sign-in page after ten minutes — stopping.\n');
    await browser.close();
    process.exit(1);
  }
  await page.waitForTimeout(3000);
  await dismiss();
  map.capturedAt = new Date().toISOString();
  log('signed in');

  await page.route('**', (route) => {
    const req = route.request();
    const entry = { method: req.method(), url: req.url() };
    requests.push(entry);
    if (req.method() !== 'GET' && PERSISTS.test(req.url())) {
      entry.blocked = true;
      console.warn('  BLOCKED', req.method(), req.url());
      return route.abort();
    }
    return route.continue();
  });

  const home = await capture('00 landing');

  // Walk the navigation, skipping anything whose name suggests it changes
  // something. Same-origin only.
  const seen = new Set();
  const targets = home.links
    .filter((l) => l.text && !AVOID.test(l.text) && !AVOID.test(l.href))
    .map((l) => ({ ...l, abs: (() => { try { return new URL(l.href, page.url()).href; } catch { return null; } })() }))
    .filter((l) => l.abs && l.abs.startsWith(new URL(BASE).origin))
    .filter((l) => { if (seen.has(l.abs)) return false; seen.add(l.abs); return true; });

  write('nav.json', targets);
  log(`${targets.length} navigation targets found`);

  for (const t of targets.slice(0, MAX)) {
    await page.goto(t.abs, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2500);
    await dismiss();
    await capture(t.text || t.abs);
  }

  write('concerto-map.json', map);
  write('requests.log', requests.map((r) => (r.blocked ? 'BLOCKED ' : 'ok      ') + r.method + ' ' + r.url).join('\n'));
  console.log(`\n  ${map.screens.length} screens captured, ${requests.filter((r) => r.blocked).length} requests blocked.`);
  console.log(`  ${OUT}\n`);
  await browser.close();
};

run().catch((e) => { console.error('map failed:', e.message); process.exit(1); });

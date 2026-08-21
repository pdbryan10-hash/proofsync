// CONCERTO — READ THE SIGNED-IN SESSION (attach over CDP, read-only)
//
// Chrome 136+ refuses --remote-debugging-port on the default profile, so this
// attaches to a Chrome started with its own profile and the port open, which
// Paul signed into by hand. The password is never seen, stored or typed here.
//
// FIRST PASS DOES NOT CLICK. It opens its own tab, navigates to each menu
// destination by URL, and reads. Menus, buttons and row actions are left alone
// entirely — a supplier portal has one-click Accept and Complete actions and no
// automation should be anywhere near them on a first look.
//
//   node scripts/concerto-attach.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const CDP = process.env.CDP_URL || 'http://localhost:9222';
const OUT = path.resolve(process.cwd(), 'data', 'concerto-map');
fs.mkdirSync(OUT, { recursive: true });

const PERSISTS = /(save|submit|commit|confirm|delete|remove|insert|update|accept|complete)/i;
const AVOID = /(logout|signout|delete|remove|create|new|add|accept|complete|reject)/i;

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
    options: Array.from(s.options).map((o) => ({ value: o.value, text: (o.textContent || '').trim() })).slice(0, 300),
  }));
};

const FIELDS_FN = () =>
  Array.from(document.querySelectorAll('input:not([type=hidden]), textarea')).map((el) => ({
    tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || null,
    id: el.id || null, name: el.getAttribute('name') || null,
    placeholder: el.getAttribute('placeholder') || null,
    readOnly: el.readOnly || el.getAttribute('readonly') !== null,
  }));

const LINKS_FN = () =>
  Array.from(document.querySelectorAll('a[href]'))
    .map((a) => ({ text: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60), href: a.getAttribute('href') || '' }))
    .filter((l) => l.href && !/^(#|javascript:)/i.test(l.href));

/** Column headers, which is what tells us what a list actually holds. */
const TABLES_FN = () =>
  Array.from(document.querySelectorAll('table')).slice(0, 6).map((t) => ({
    headers: Array.from(t.querySelectorAll('th')).map((h) => (h.textContent || '').trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 40),
    rows: t.querySelectorAll('tr').length,
  })).filter((t) => t.headers.length);

const TEXT_FN = () => (document.body ? document.body.innerText.replace(/\n{3,}/g, '\n\n') : '');

const run = async () => {
  const browser = await chromium.connectOverCDP(CDP);
  const ctx = browser.contexts()[0];
  if (!ctx) { console.error('no browser context'); process.exit(1); }

  // Our own tab, so Paul's window is left exactly where he had it.
  const page = await ctx.newPage();
  const requests = [];
  await page.route('**', (route) => {
    const r = route.request();
    const e = { method: r.method(), url: r.url() };
    requests.push(e);
    if (r.method() !== 'GET' && PERSISTS.test(r.url())) {
      e.blocked = true;
      console.warn('  BLOCKED', r.method(), r.url());
      return route.abort();
    }
    return route.continue();
  });

  const inEveryFrame = async (fn) => {
    const out = [];
    for (const f of page.frames()) {
      try { out.push(...(await f.evaluate(fn))); } catch { /* detached */ }
    }
    return out;
  };

  const capture = async (name) => {
    const data = {
      name, url: page.url(), title: await page.title(),
      selects: await inEveryFrame(SELECTS_FN),
      fields: await inEveryFrame(FIELDS_FN),
      tables: await inEveryFrame(TABLES_FN),
      links: (await inEveryFrame(LINKS_FN)).slice(0, 200),
      text: (await inEveryFrame(TEXT_FN)).join('\n').slice(0, 14000),
    };
    write('screen-' + slug(name) + '.json', data);
    await page.screenshot({ path: path.join(OUT, 'screen-' + slug(name) + '.png'), fullPage: true }).catch(() => {});
    log(`${name}: ${data.selects.length} dropdowns, ${data.fields.length} fields, ${data.tables.length} table(s)`);
    return data;
  };

  const go = async (url, settle = 4000) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(settle);
  };

  // Start where he is, then walk the menu.
  const start = ctx.pages().find((p) => /concerto\.bellrock/i.test(p.url()))?.url()
    || 'https://concerto.bellrock.fm/content/SupplierDashboard.aspx';
  await go(start);
  const home = await capture('00 dashboard');

  const nav = home.links
    .map((l) => { try { return { ...l, abs: new URL(l.href, page.url()).href }; } catch { return null; } })
    .filter((l) => l && l.abs.includes('concerto.bellrock.fm'))
    .filter((l) => l.text && !AVOID.test(l.text) && !AVOID.test(l.abs))
    .filter((l, i, a) => a.findIndex((x) => x.abs === l.abs) === i);
  write('nav.json', nav);
  log(`${nav.length} navigation targets`);

  for (const t of nav.slice(0, Number(process.env.CONCERTO_MAX || 12))) {
    await go(t.abs);
    await capture(t.text);
  }

  write('requests.log', requests.map((r) => (r.blocked ? 'BLOCKED ' : 'ok      ') + r.method + ' ' + r.url).join('\n'));
  console.log(`\n  Done. ${requests.filter((r) => r.blocked).length} requests blocked, tab left open.\n`);
  await page.close().catch(() => {});
  await browser.close().catch(() => {});   // detaches; does NOT close his Chrome
};

run().catch((e) => { console.error('failed:', e.message); process.exit(1); });

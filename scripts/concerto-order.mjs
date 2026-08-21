// CONCERTO — an order, top to bottom, and the menus (read-only, attached)
//
// Pass two. The first pass navigated the menu; this one opens a single order
// from the list and reads the whole thing, then photographs the ACTIONS menu
// without ever choosing anything from it.
//
// THE ONE CLICK. A dropdown toggle is clicked to reveal what it contains, and
// Escape closes it. Nothing inside a menu is ever clicked: a supplier portal
// has one-click Accept and Complete, and those belong to a person. Everything
// else here is navigation.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const CDP = process.env.CDP_URL || 'http://localhost:9222';
const OUT = path.resolve(process.cwd(), 'data', 'concerto-map');
fs.mkdirSync(OUT, { recursive: true });
const PORTAL = 'https://concerto.bellrock.fm/content/supplier_portal.aspx';
const PERSISTS = /(save|submit|commit|confirm|delete|remove|insert|update|accept|complete|reject)/i;

const write = (n, d) => fs.writeFileSync(path.join(OUT, n), typeof d === 'string' ? d : JSON.stringify(d, null, 2));
const log = (...a) => console.log(' ·', ...a);

const DEEP_FN = () => {
  const val = (el) => (el.tagName === 'SELECT'
    ? { options: Array.from(el.options).map((o) => ({ value: o.value, text: (o.textContent || '').trim() })).slice(0, 200) }
    : {});
  return Array.from(document.querySelectorAll('input:not([type=hidden]), textarea, select, button')).map((el) => ({
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute('type') || null,
    id: el.id || null,
    name: el.getAttribute('name') || null,
    text: (el.textContent || '').trim().slice(0, 40) || null,
    value: el.tagName === 'BUTTON' ? null : (el.getAttribute('value') || null),
    visible: !!(el.getBoundingClientRect().width && el.getBoundingClientRect().height),
    ...val(el),
  }));
};
const TEXT_FN = () => (document.body ? document.body.innerText.replace(/\n{3,}/g, '\n\n') : '');
const ORDER_LINKS_FN = () =>
  Array.from(document.querySelectorAll('a[href]'))
    .map((a) => ({ text: (a.textContent || '').trim(), href: a.getAttribute('href') || '' }))
    .filter((l) => /order|job/i.test(l.href) && l.text && l.text.length < 40);

const run = async () => {
  const browser = await chromium.connectOverCDP(CDP);
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  const requests = [];
  await page.route('**', (route) => {
    const r = route.request();
    const e = { method: r.method(), url: r.url() };
    requests.push(e);
    if (r.method() !== 'GET' && PERSISTS.test(r.url())) { e.blocked = true; console.warn('  BLOCKED', r.method(), r.url()); return route.abort(); }
    return route.continue();
  });
  const inEvery = async (fn) => {
    const out = [];
    for (const f of page.frames()) { try { out.push(...(await f.evaluate(fn))); } catch { /* detached */ } }
    return out;
  };
  const shot = async (n) => { await page.screenshot({ path: path.join(OUT, n + '.png'), fullPage: true }).catch(() => {}); };

  await page.goto(PORTAL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // The rows are not anchors — the same lesson VX taught. An href sweep here
  // followed a nav link called Cost referral, because its URL happens to
  // contain "job". So the order number is clicked as text instead.
  const REF = /^[A-Z]{2,6}\d{5,}\/\d+$/;
  let opened = false;
  for (const f of page.frames()) {
    const cells = f.getByText(REF);
    const n = await cells.count().catch(() => 0);
    if (!n) continue;
    const ref = ((await cells.first().textContent().catch(() => '')) || '').trim();
    await cells.first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(5000);
    // Prove it opened rather than assume: an order screen names the field.
    const onOrder = (await inEvery(TEXT_FN)).join('\n');
    if (!/order number/i.test(onOrder)) { log('clicked ' + ref + ' but did not land on an order'); break; }
    log('opened order ' + ref);
    opened = true;
    break;
  }
  const target = opened ? { text: 'first order in the list' } : null;
  if (target) {
    const controls = await inEvery(DEEP_FN);
    const text = (await inEvery(TEXT_FN)).join('\n');
    write('order-detail.json', { url: page.url(), reference: target.text, controls, text: text.slice(0, 20000) });
    await shot('order-detail');
    log(`order ${target.text}: ${controls.length} controls, ${text.length} chars`);

    // The ACTIONS menu: opened, photographed, closed. Nothing chosen.
    for (const f of page.frames()) {
      const btn = f.getByText(/^\s*ACTIONS\s*$/i).first();
      if (!(await btn.count().catch(() => 0))) continue;
      await btn.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const menu = (await inEvery(() =>
        Array.from(document.querySelectorAll('[role=menu] a, [role=menu] li, .dropdown-menu a, .dropdown-menu li'))
          .map((e) => (e.textContent || '').trim()).filter(Boolean),
      ));
      write('order-actions-menu.json', menu);
      await shot('order-actions-menu');
      log(`ACTIONS menu: ${menu.length} items — ${menu.slice(0, 12).join(' | ')}`);
      await page.keyboard.press('Escape').catch(() => {});
      break;
    }
  } else {
    log('no order link found on the list');
  }

  write('requests-order.log', requests.map((r) => (r.blocked ? 'BLOCKED ' : 'ok      ') + r.method + ' ' + r.url).join('\n'));
  console.log(`\n  ${requests.filter((r) => r.blocked).length} requests blocked.\n`);
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
};

run().catch((e) => { console.error('failed:', e.message); process.exit(1); });

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
    for (const f of page.frames()) {
      try {
        const r = await f.evaluate(fn);
        if (typeof r === 'string') out.push(r); else out.push(...r);
      } catch { /* detached */ }
    }
    return out;
  };
  const shot = async (n) => { await page.screenshot({ path: path.join(OUT, n + '.png'), fullPage: true }).catch(() => {}); };

  await page.goto(PORTAL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // The rows are not anchors — the same lesson VX taught. An href sweep here
  // followed a nav link called Cost referral, because its URL happens to
  // contain "job". So the order number is clicked as text instead.
  // HOW A CONCERTO ROW OPENS.
  //
  // Not by clicking. The markup is
  //   <tr role="link" tabindex="0"
  //       onkeypress="PblActions.selectRowOnEnterKey(event,'RenderOrderSummaryConst')">
  // so the row is focusable and responds to ENTER. Three click attempts did
  // nothing because there was nothing bound to a click — which is worth knowing
  // for the connector as much as for this script.
  const REF = /^[A-Z]{2,6}\d{5,}\/\d+$/;
  let opened = false;
  let ref = '';
  let orderPage = page;
  /** Read across the frames of whichever tab the order actually opened in. */
  const inOrder = async (fn) => {
    const out = [];
    for (const f of orderPage.frames()) { try { out.push(...(await f.evaluate(fn))); } catch { /* detached */ } }
    return out;
  };
  for (const f of page.frames()) {
    const rows = f.locator('tr[role="link"]');
    const n = await rows.count().catch(() => 0);
    for (let i = 0; i < Math.min(n, 5) && !opened; i++) {
      const row = rows.nth(i);
      const txt = ((await row.textContent().catch(() => '')) || '').trim();
      const m = txt.match(/[A-Z]{2,6}\d{5,}\/\d+/);
      if (!m) continue;
      ref = m[0];
      await row.scrollIntoViewIfNeeded().catch(() => {});
      await row.focus().catch(() => {});
      await row.press('Enter').catch(() => {});
      // The order opens in a NEW TAB. Polling the list page is why this kept
      // reporting "did not open" while the order was on screen the whole time,
      // in a window the script was not looking at.
      for (let w = 0; w < 10 && !opened; w++) {
        await page.waitForTimeout(2000);
        for (const p2 of ctx.pages()) {
          const t = await p2.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');
          if (/order number/i.test(t)) { orderPage = p2; opened = true; break; }
        }
      }
      log(opened ? 'opened order ' + ref : 'pressed Enter on ' + ref + ' — did not open');
    }
    if (opened) break;
  }

  const target = opened ? { text: 'first order in the list' } : null;
  if (target) {
    const controls = await inEvery(DEEP_FN);
    const text = (await inEvery(TEXT_FN)).join('\n');
    write('order-detail.json', { url: orderPage.url(), reference: ref, controls, text: text.slice(0, 20000) });
    await orderPage.screenshot({ path: path.join(OUT, 'order-detail.png'), fullPage: true }).catch(() => {});
    log(`order ${target.text}: ${controls.length} controls, ${text.length} chars`);

    // The ACTIONS menu: opened, photographed, closed. Nothing chosen.
    for (const f of orderPage.frames()) {
      // By id, because the label rendered as "Actions" with an icon inside and
      // a text match kept missing it.
      const btn = f.locator('#dropdownMenuButton').first();
      if (!(await btn.count().catch(() => 0))) continue;
      await btn.click({ timeout: 5000 }).catch(() => {});
      await orderPage.waitForTimeout(1500);
      // Find the menu by what APPEARED, rather than by guessing its class. The
      // first attempt matched the page's accessibility skip-links.
      const after = (await inOrder(TEXT_FN)).join('\n');
      const before = text;
      const menu = after.split('\n').map((l) => l.trim()).filter((l) => l && !before.includes(l));
      write('order-actions-menu.json', menu);
      await orderPage.screenshot({ path: path.join(OUT, 'order-actions-menu.png'), fullPage: true }).catch(() => {});
      log(`ACTIONS menu: ${menu.length} items — ${menu.slice(0, 12).join(' | ')}`);
      await orderPage.keyboard.press('Escape').catch(() => {});
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

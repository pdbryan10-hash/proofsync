// CONCERTO (Bellrock) — a recorded tour of the supplier portal, read-only.
//
// The VX tour launched its own browser and let Playwright record it. That is not
// available here: Concerto locks the account after three bad passwords, so a
// person signs in and this ATTACHES to that Chrome over CDP — and Playwright
// only records contexts it created. So the video is taken from Chrome itself,
// with Page.startScreencast, and ffmpeg lays the frames back down at the pace
// they arrived. The recording therefore shows exactly what was on screen.
//
// It captures the map at the same time: a full-page PNG and a JSON reading of
// every stop, so the tour and the map can never drift apart.
//
// HOW IT REFUSES TO WRITE
//   1. Non-GET requests that look like mutations are ABORTED in the browser.
//   2. It navigates and it opens menus. It never chooses anything from a menu,
//      and never presses a button.
//   3. It types once, into the search box, holds it long enough to be read, and
//      clears it — the point being that typing is not saving. fill() is used,
//      never Enter, because Enter submits.
//   4. Tabs it will open are named explicitly. Nothing else is clicked.
//
//   node scripts/concerto-tour.mjs
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CDP = process.env.CDP_URL || 'http://localhost:9222';
const OUT = path.resolve(process.cwd(), 'data', 'concerto-map');
const FR = path.join(OUT, 'frames');
fs.rmSync(FR, { recursive: true, force: true });
fs.mkdirSync(FR, { recursive: true });

const PERSISTS = /(save|submit|commit|confirm|delete|remove|insert|update|accept|complete|reject)/i;
const HOLD = Number(process.env.CONCERTO_HOLD || 4200);   // how long a screen stays up
const log = (...a) => console.log(' ·', ...a);
const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 50);

// ── what a stop is made of, read out of every frame ───────────────────────────
const SELECTS_FN = () => Array.from(document.querySelectorAll('select')).map((s) => ({
  id: s.id || null, name: s.name || null,
  options: Array.from(s.options).map((o) => ({ value: o.value, text: (o.textContent || '').trim() })).slice(0, 300),
}));
const FIELDS_FN = () => Array.from(document.querySelectorAll('input:not([type=hidden]), textarea')).map((el) => ({
  tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || null, id: el.id || null,
  name: el.getAttribute('name') || null, placeholder: el.getAttribute('placeholder') || null,
  readOnly: el.readOnly || el.getAttribute('readonly') !== null,
}));
const TABLES_FN = () => Array.from(document.querySelectorAll('table')).slice(0, 6).map((t) => ({
  headers: Array.from(t.querySelectorAll('th')).map((h) => (h.textContent || '').trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 40),
  rows: t.querySelectorAll('tr').length,
})).filter((t) => t.headers.length);
const LINKS_FN = () => Array.from(document.querySelectorAll('a[href]'))
  .map((a) => ({ text: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60), href: a.getAttribute('href') || '' }))
  .filter((l) => l.href && !/^(#|javascript:)/i.test(l.href));
const TEXT_FN = () => (document.body ? document.body.innerText.replace(/\n{3,}/g, '\n\n') : '');

// ── the caption bar, drawn into the page we opened ────────────────────────────
// A DOM node in our own tab. It issues no request and touches no record; it is
// there so the recording explains itself to somebody who has never seen this
// system, which is the entire point of making one.
const CAPTION_FN = ([title, body, n]) => {
  const id = '__pw_caption';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    document.documentElement.appendChild(el);
    el.style.cssText = [
      'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:2147483647',
      'font:16px/1.45 -apple-system,Segoe UI,Roboto,sans-serif', 'color:#fff',
      'background:linear-gradient(transparent,rgba(10,14,20,.93) 38%)',
      'padding:52px 30px 22px', 'pointer-events:none', 'letter-spacing:.1px',
    ].join(';');
  }
  const badge = '<span style="float:right;background:#1c6b4a;color:#fff;font:600 12px/1 sans-serif;'
    + 'padding:7px 11px;border-radius:4px;letter-spacing:.6px">READ ONLY — NOTHING IS SAVED</span>';
  el.innerHTML = badge
    + '<div style="font:600 13px/1 sans-serif;color:#7fd4b0;letter-spacing:1.4px;margin-bottom:7px">'
    + String(n).padStart(2, '0') + ' · CONCERTO — BELLROCK SUPPLIER PORTAL</div>'
    + '<div style="font-size:25px;font-weight:650;margin-bottom:4px">' + title + '</div>'
    + '<div style="font-size:16px;opacity:.86;max-width:1080px">' + body + '</div>';
};

const run = async () => {
  const browser = await chromium.connectOverCDP(CDP);
  const ctx = browser.contexts()[0];
  if (!ctx) { console.error('no browser context — is Chrome still up on 9222?'); process.exit(1); }

  const frames = [];
  const casts = new Map();
  const startCast = async (p) => {
    if (casts.has(p)) return;
    const s = await ctx.newCDPSession(p);
    s.on('Page.screencastFrame', async (f) => {
      const file = path.join(FR, 'f' + String(frames.length).padStart(6, '0') + '.jpg');
      try { fs.writeFileSync(file, Buffer.from(f.data, 'base64')); frames.push({ file, t: Date.now() }); } catch { /* shutting down */ }
      try { await s.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* gone */ }
    });
    await s.send('Page.startScreencast', { format: 'jpeg', quality: 82, maxWidth: 1600, maxHeight: 900, everyNthFrame: 1 });
    casts.set(p, s);
  };
  const stopCast = async (p) => {
    const s = casts.get(p);
    if (!s) return;
    try { await s.send('Page.stopScreencast'); } catch { /* gone */ }
    try { await s.detach(); } catch { /* gone */ }
    casts.delete(p);
  };

  const requests = [];
  const guard = async (p) => p.route('**', (route) => {
    const r = route.request();
    const e = { method: r.method(), url: r.url() };
    requests.push(e);
    if (r.method() !== 'GET' && PERSISTS.test(r.url())) { e.blocked = true; console.warn('  BLOCKED', r.method(), r.url()); return route.abort(); }
    return route.continue();
  });

  const before = new Set(ctx.pages());
  const page = await ctx.newPage();
  await guard(page);
  await page.bringToFront();
  await startCast(page);

  const stops = [];
  let n = 0;
  const inEvery = async (p, fn) => {
    const out = [];
    for (const f of p.frames()) { try { const r = await f.evaluate(fn); if (typeof r === 'string') out.push(r); else out.push(...r); } catch { /* detached */ } }
    return out;
  };
  /** Caption it, hold it, photograph it, read it. The four things a stop is. */
  const stop = async (p, title, body, hold = HOLD) => {
    n += 1;
    await p.evaluate(CAPTION_FN, [title, body, n]).catch(() => {});
    await p.waitForTimeout(700);
    const name = String(n).padStart(2, '0') + '-' + slug(title);
    await p.screenshot({ path: path.join(OUT, 'tour-' + name + '.png'), fullPage: true }).catch(() => {});
    const data = {
      n, name, title, body, url: p.url(), capturedAt: new Date().toISOString(),
      selects: await inEvery(p, SELECTS_FN), fields: await inEvery(p, FIELDS_FN),
      tables: await inEvery(p, TABLES_FN), links: (await inEvery(p, LINKS_FN)).slice(0, 200),
      text: (await inEvery(p, TEXT_FN)).join('\n').slice(0, 16000),
    };
    fs.writeFileSync(path.join(OUT, 'tour-' + name + '.json'), JSON.stringify(data, null, 2));
    stops.push({ n, name, title, body, url: data.url, selects: data.selects.length, fields: data.fields.length, tables: data.tables.length });
    log(n + '. ' + title + ' — ' + data.selects.length + ' dropdowns, ' + data.fields.length + ' fields');
    await p.waitForTimeout(hold);
  };
  /** Scroll in steps rather than jumping, so the recording reads as browsing. */
  const scroll = async (p, steps = 3, px = 460) => {
    for (let i = 0; i < steps; i++) {
      await p.evaluate((d) => window.scrollBy({ top: d, behavior: 'smooth' }), px).catch(() => {});
      await p.waitForTimeout(1250);
    }
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })).catch(() => {});
    await p.waitForTimeout(900);
  };
  const go = async (url, settle = 3800) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(settle);
  };

  const B = 'https://concerto.bellrock.fm/content/';

  // ── the walk ────────────────────────────────────────────────────────────────
  await go(B + 'SupplierDashboard.aspx');
  await stop(page, 'The dashboard', 'Every tile is a leg of the loop: Awaiting Acceptance is intake, Breaching SLA is the accept clock, Requiring Action to Complete is the completion, Awaiting Certificate is the paperwork.', 5200);
  await scroll(page, 3);

  await go(B + 'supplier_portal.aspx');
  await stop(page, 'The order list — 12,207 live', 'Response and completion each show required AND actual, side by side. Mandate is the spend limit. Supplier&rsquo;s ref is the second column.', 5200);
  await scroll(page, 2, 380);

  // The search panel, and the one piece of typing.
  await stop(page, 'What a driver can query', 'Search by Supplier reference or Client reference; filter by type, status, appointment, PPM discipline — and by Client workspace, which holds nineteen clients, not one.', 3600);
  // BY ID. The first visible text box on this page is the global site search in
  // the header, not the portal's own — the first recording typed into that one.
  const SEARCH = '#pbl_form_dba_search';
  const searchBox = await (async () => {
    for (const f of page.frames()) {
      const box = f.locator(SEARCH).first();
      if (await box.count().catch(() => 0)) return box;
    }
    return null;
  })();
  if (searchBox) {
    await searchBox.scrollIntoViewIfNeeded().catch(() => {});
    await searchBox.fill('JL-2026-118422').catch(() => {});
    await stop(page, 'Typing is not saving', 'Search field is set to Supplier reference, and this is the cross-system key: ProofSync writes the Joblogic number into Supplier&rsquo;s ref, then finds the order again by searching it. Nothing is submitted — the search is never run.', 5600);
    await searchBox.fill('').catch(() => {});
    await page.waitForTimeout(900);
  }

  // ── an order, which opens on Enter — sometimes here, sometimes in a new tab ──
  //
  // HOW WE KNOW WE ARE ON A RECORD. Not by the words "order number": the list's
  // own column header says that, so the test can never fail and the first
  // recording reported an order it never opened. The Actions control only
  // exists on a record, so that is the proof.
  await go(B + 'supplier_portal.aspx', 6000);   // a clean grid, given time to wire itself up

  // The row's own ⋮ menu, which is a second and quite different route into a
  // job — audit trail, notes, permits, attachments — reachable without opening
  // the order at all. Best effort: if it will not reveal itself, the tour moves
  // on rather than clicking around a live system looking for it.
  for (const f of page.frames()) {
    const row = f.locator('tr[role="link"]').first();
    if (!(await row.count().catch(() => 0))) continue;
    const toggle = row.locator('a.dropdown-toggle, button.dropdown-toggle, [data-toggle="dropdown"], [aria-haspopup="true"]').first();
    if (!(await toggle.count().catch(() => 0))) break;
    await row.scrollIntoViewIfNeeded().catch(() => {});
    await toggle.click({ timeout: 3500 }).catch(() => {});
    await page.waitForTimeout(1500);
    const open = await f.evaluate(() => Array.from(document.querySelectorAll('.dropdown-menu,[role="menu"]'))
      .some((m) => getComputedStyle(m).display !== 'none' && m.getBoundingClientRect().height > 0
        && /audit trail|attachments/i.test(m.textContent || ''))).catch(() => false);
    if (open) {
      await stop(page, 'The row menu — a second way in', 'Audit trail / detail · Notes and messages · Print order · Permits · Attachments. Every row offers these without opening the job, which is where a reader goes for history rather than for the current state.', 5600);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(700);
    } else { log('row menu did not reveal itself — moving on'); }
    break;
  }

  // The record REPLACES the grid, at the same URL — there is no new tab and no
  // navigation. So it is recognised by fields only a record has. Neither the
  // words "order number" nor the Actions control will do: the list has both,
  // and each of them in turn reported an order that was never opened.
  const isRecord = async (p) => {
    const t = await p.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');
    return /priority of response/i.test(t) && /location of work/i.test(t);
  };
  let order = null;
  for (const f of page.frames()) {
    const rows = f.locator('tr[role="link"]');
    const c = await rows.count().catch(() => 0);
    log(c + ' openable rows');
    for (let i = 0; i < Math.min(c, 3) && !order; i++) {
      const row = rows.nth(i);
      if (!/[A-Z]{2,6}\d{5,}\/\d+/.test(((await row.textContent().catch(() => '')) || ''))) continue;
      await row.scrollIntoViewIfNeeded().catch(() => {});
      await row.focus().catch(() => {});
      await page.waitForTimeout(900);
      await row.press('Enter').catch(() => {});
      for (let w = 0; w < 8 && !order; w++) {
        await page.waitForTimeout(1200);
        if (await isRecord(page)) order = page;
      }
      if (!order) log('row ' + i + ' did not open — trying the next one');
    }
    if (order) break;
  }
  const orderIsHere = order === page;   // in place: nothing to switch to, nothing to close

  if (order) {
    if (!orderIsHere) {
      await guard(order);
      await order.bringToFront();
      await startCast(order);
      await stopCast(page);
    }
    await order.waitForTimeout(1200);
    await stop(order, 'An order', 'The rows are not links — they carry role="link" and open on Enter, in a tab of their own. Priority of response is a phrase, not a code: &ldquo;3 Working Day (excluding weekends)&rdquo;.', 5600);
    await scroll(order, 3, 420);
    await stop(order, 'How a job actually arrives', 'The feed says it: order added against a helpdesk reference, emailed to the SEE helpdesk mailbox, accepted 26 minutes later. Intake is an email, and Concerto records that it sent it.', 6200);

    for (const tab of ['Permits', 'Invoices and Applications', 'Notes and Activities']) {
      let hit = null;
      for (const f of order.frames()) {
        const t = f.getByRole('tab', { name: new RegExp(tab, 'i') }).first();
        if (await t.count().catch(() => 0)) { hit = t; break; }
        const l = f.getByRole('link', { name: new RegExp('^' + tab + '$', 'i') }).first();
        if (await l.count().catch(() => 0)) { hit = l; break; }
      }
      if (!hit) { log('tab not found: ' + tab); continue; }
      await hit.click({ timeout: 4000 }).catch(() => {});
      await order.waitForTimeout(2600);
      await stop(order, 'Tab — ' + tab, tab === 'Permits' ? 'Permits sit on the order itself, alongside the notes.'
        : tab === 'Invoices and Applications' ? 'The money leg, on the same record as the work.'
        : 'Notes, documents and photographs — where a certificate or job sheet is attached.', 4200);
    }

    // The Actions menu: opened to be read, closed again. Nothing chosen.
    for (const f of order.frames()) {
      const all = f.locator('#dropdownMenuButton');
      const c = await all.count().catch(() => 0);
      let done = false;
      for (let i = 0; i < c && !done; i++) {
        const btn = all.nth(i);
        if (!(await btn.isVisible().catch(() => false))) continue;   // duplicate ids: take the visible one
        await btn.click({ timeout: 4000 }).catch(() => {});
        await order.waitForTimeout(1600);
        done = true;
      }
      if (done) {
        await stop(order, 'The write path — ten actions', 'Add Appointment · Cost uplift · Mark job as attended · Parts On Order · Assign operative · Add Note/Document/Photo · Work complete · Quote required. The completion is TWO actions: the evidence, then the close.', 7000);
        await order.keyboard.press('Escape').catch(() => {});
        await order.waitForTimeout(900);
        break;
      }
    }
  } else {
    log('no order opened — the list may have been filtered');
  }

  // ── the rest of the estate ──────────────────────────────────────────────────
  if (order && !orderIsHere) {
    await order.close().catch(() => {});
    await stopCast(order);
    await page.bringToFront();
    await startCast(page);
  }
  const rest = [
    ['Quote.aspx', 'Quotes — 103 awaiting', 'A hundred and three quotation requests waiting on a supplier response, each one a job that has not started.'],
    ['PPMSupplierReview.aspx', 'PPM certificate reviews', 'The certificate leg. UPRN is here — a property identifier, and a better join key than a site name.'],
    ['PermitRegisterSupplier.aspx', 'Permit register', 'Permits across the estate rather than on one order.'],
    ['ContractJobSupplier.aspx', 'Cost referral', '&ldquo;Currently with&rdquo; states whose court the ball is in — which is precisely what Terri has to infer on VX.'],
    ['site_scheduler_supplier.aspx', 'PPM and activities', 'The planned side: 371 PPMs due inside six weeks with no appointment. A scheduling problem, not a chasing one.'],
    ['SupplierPortalDocs.aspx', 'Documents', 'What Bellrock publishes to its suppliers.'],
  ];
  for (const [rel, title, body] of rest) {
    await go(B + rel);
    await stop(page, title, body);
    await scroll(page, 2, 420);
  }

  await go(B + 'SupplierDashboard.aspx');
  await stop(page, 'Nineteen clients, one connector', 'Everything here was read, nothing was written. The same portal serves ADI Global, Arriva, Bidfood, Costa, Hertz, Pizza Express, wagamama, YODEL and eleven more — so this is built once.', 7000);

  // ── stop recording, hand the frames to ffmpeg ───────────────────────────────
  for (const p of [...casts.keys()]) await stopCast(p);
  await page.waitForTimeout(400);
  fs.writeFileSync(path.join(OUT, 'tour-stops.json'), JSON.stringify(stops, null, 2));
  fs.writeFileSync(path.join(OUT, 'requests-tour.log'), requests.map((r) => (r.blocked ? 'BLOCKED ' : 'ok      ') + r.method + ' ' + r.url).join('\n'));

  // Screencast frames arrive only when the picture changes, so a still screen
  // is one frame with a long gap after it. The concat demuxer replays those
  // gaps as duration, which is what makes the holds hold.
  const list = [];
  for (let i = 0; i < frames.length; i++) {
    const d = Math.min(i + 1 < frames.length ? (frames[i + 1].t - frames[i].t) / 1000 : 1.6, 6);
    list.push("file '" + frames[i].file.replace(/\\/g, '/') + "'", 'duration ' + Math.max(d, 0.03).toFixed(3));
  }
  if (frames.length) list.push("file '" + frames[frames.length - 1].file.replace(/\\/g, '/') + "'");
  const listFile = path.join(FR, 'frames.txt');
  fs.writeFileSync(listFile, list.join('\n'));

  const mp4 = path.join(OUT, 'concerto-tour.mp4');
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', 'scale=1600:-2:flags=lanczos,format=yuv420p', '-r', '24',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', mp4], { stdio: 'ignore' });
  const secs = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', mp4]).toString().trim()).toFixed(0);

  console.log('\n  ' + stops.length + ' stops · ' + frames.length + ' frames · '
    + requests.filter((r) => r.blocked).length + ' requests blocked');
  console.log('  ' + mp4 + '  —  ' + secs + 's\n');
  await page.close().catch(() => {});
  await browser.close().catch(() => {});   // detaches. Does NOT close his Chrome.
};

run().catch((e) => { console.error('tour failed:', e.message); process.exit(1); });

// Build a browsable HTML map of Concerto from the captures — the twin of
// scripts/build-vx-map-html.mjs in mml-portal, so the two systems can be read
// side by side in the same shape.
//
// Screenshots are BAKED IN as data URIs. The VX map referenced them from the
// folder beside it and the first thing that happened was somebody copying the
// one file they were told to open, and finding a page of broken images.
//
//   node scripts/build-concerto-map-html.mjs             →  concerto-map.html
//   node scripts/build-concerto-map-html.mjs --redacted  →  concerto-map-redacted.html
//
// The redacted build is the one that can leave this machine. It drops the
// screenshots — a grab of a live queue cannot be sanitised, and pretending
// otherwise is how client data escapes — and scrubs clients, sites, people,
// addresses, order numbers, emails and phone numbers out of every caption and
// excerpt, using the captures themselves as the dictionary. What survives is
// the structure: screens, element ids, dropdown values, action names, filters.
import fs from 'node:fs';
import path from 'node:path';

const REDACT = process.argv.includes('--redacted');
const MAP = path.resolve(process.cwd(), 'data', 'concerto-map');
const OUT = path.join(MAP, REDACT ? 'concerto-map-redacted.html' : 'concerto-map.html');

const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(MAP, f), 'utf8')); } catch { return null; } };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dataUri = (png) => {
  try { return 'data:image/png;base64,' + fs.readFileSync(path.join(MAP, png)).toString('base64'); } catch { return null; }
};

// ── everything on disk ────────────────────────────────────────────────────────
const files = fs.readdirSync(MAP);
const stops = files.filter((f) => /^tour-\d\d-.*\.json$/.test(f)).sort()
  .map((f) => ({ file: f, png: f.replace(/\.json$/, '.png'), d: read(f) })).filter((s) => s.d);
const others = files.filter((f) => /^screen-.*\.json$/.test(f)).sort()
  .map((f) => ({ file: f, png: f.replace(/\.json$/, '.png'), d: read(f) })).filter((s) => s.d);

const findSelect = (id) => {
  for (const s of [...stops, ...others]) for (const sel of s.d.selects || []) if (sel.id === id) return sel;
  return null;
};
const clients = (findSelect('pbl_form_dba_portfolioid')?.options || [])
  .map((o) => o.text).filter((t) => t && !/^(all|select|please)/i.test(t));

// ── the scrubber, built from the captures rather than from a guess ────────────
const buildScrubber = () => {
  const people = new Set();
  const sites = new Set();
  const STOP = new Set(['the', 'and', 'group', 'company', 'limited', 'ltd', 'services', 'centre', 'coffee', 'costa coffee']);
  /** Whole phrases AND their parts: the same address turns up tidily punctuated
   *  on the record and as lowercase free text in Access details, so a dictionary
   *  of neat strings misses it. Over-scrubbing is the safe direction. */
  const addPlace = (v) => {
    const whole = String(v || '').trim();
    if (whole.length > 3) sites.add(whole);
    for (const part of whole.split(/[,\n]/)) {
      const p = part.trim();
      if (p.length >= 5 && !STOP.has(p.toLowerCase())) sites.add(p);
    }
  };
  for (const s of [...stops, ...others]) {
    const t = s.d.text || '';
    for (const m of t.matchAll(/Posted by ([A-Z][\w'-]+(?: [A-Z][\w'-]+){1,2}) on/g)) people.add(m[1]);
    // The block after Location of work is TWO lines: the site, then its address.
    for (const m of t.matchAll(/Location of work\s*\n?\s*(.+)\n(.+)/g)) { addPlace(m[1]); addPlace(m[2]); }
  }
  // A client is also referred to by its first word — "Costa" for Costa Coffee.
  for (const c of clients) {
    const head = c.split(/\s+/)[0];
    if (head.length >= 5 && !STOP.has(head.toLowerCase())) sites.add(head);
  }
  const dict = [...clients, ...sites, ...people].filter((v) => v && v.length > 3)
    .sort((a, b) => b.length - a.length);
  const rx = dict.length ? new RegExp(dict.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi') : null;
  return (text) => String(text ?? '')
    .replace(/[\w.+-]+@[\w.-]+\.\w+/g, '[email]')
    .replace(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/gi, '[postcode]')
    .replace(/\b(?:0\d{3,4}[ -]?\d{5,6}|\+44\s?\d{9,10})\b/g, '[phone]')
    .replace(/\b[A-Z]{2,6}\d{5,}\/\d+\b/g, '[ORDER]')
    .replace(/\b[A-Z]{2,6}\d{5,}\b/g, '[REF]')
    .replace(/\b\d{1,4}[a-z]? [A-Z][a-z]+(?: [A-Z][a-z]+)*, [A-Z][a-z]+/g, '[address]')
    .replace(rx || /(?!)/g, '[client/site]');
};
const scrub = REDACT ? buildScrubber() : ((t) => t);
const S = (t) => esc(scrub(t));

// ── a screen, drawn ───────────────────────────────────────────────────────────
const optionList = (sel) => {
  const opts = (sel.options || []).filter((o) => o.text);
  if (!opts.length) return '';
  return `<details><summary>${opts.length} values</summary><ul class="opts">`
    + opts.slice(0, 200).map((o) => `<li>${S(o.text)}${o.value ? ` <code>${esc(o.value)}</code>` : ''}</li>`).join('')
    + '</ul></details>';
};

const section = (s, i) => {
  const d = s.d;
  const shot = REDACT ? null : dataUri(s.png);
  const tables = (d.tables || []).filter((t) => t.headers.length);
  const named = (d.selects || []).filter((x) => x.id);
  const fields = (d.fields || []).filter((f) => f.id && f.type !== 'hidden' && f.type !== 'button');
  return `<div class="screen" id="s${i}">
  <h3>${d.n ? String(d.n).padStart(2, '0') + ' · ' : ''}${S(d.title || d.name || s.file)}</h3>
  ${d.body ? `<p class="muted">${scrub(d.body)}</p>` : ''}
  <div class="url">${esc(REDACT ? String(d.url || '').split('?')[0] : (d.url || ''))}</div>
  ${shot ? `<div class="shot"><img loading="lazy" src="${shot}" alt=""></div>`
    : '<p class="muted">Screenshot withheld — a grab of a live queue cannot be sanitised.</p>'}
  <div class="cols">
    <div>
      ${tables.length ? '<h4>Columns</h4>' + tables.map((t) => `<div class="row">${t.headers.map((h) => S(h)).join(' · ')}
        <span class="lbl">${t.rows} rows</span></div>`).join('') : ''}
      ${named.length ? '<h4>Dropdowns</h4>' + named.map((x) => `<div class="row"><code>${esc(x.id)}</code>${optionList(x)}</div>`).join('') : ''}
    </div>
    <div>
      ${fields.length ? '<h4>Fields</h4>' + fields.slice(0, 40).map((f) => `<div class="row"><code>${esc(f.id)}</code>
        <span class="lbl">${esc(f.type || f.tag)}${f.readOnly ? ' · read-only' : ''}</span></div>`).join('') : ''}
      ${d.text ? `<h4>On screen</h4><details><summary>read</summary><pre>${S((d.text || '').slice(0, 3000))}</pre></details>` : ''}
    </div>
  </div>
</div>`;
};

// ── the facts worth stating before any screenshot ─────────────────────────────
const FACTS = [
  ['Intake', 'Concerto <strong>emails the order</strong> to the SEE helpdesk mailbox and records in the feed that it did, against a helpdesk reference. So intake can be driven from the mailbox or the portal, and the two reconcile.'],
  ['Acceptance', 'A named, timed event — <code>Accept within SLA</code> — not a status to be inferred. Compare another CAFM, where acceptance had to be reconstructed from an assignment date.'],
  ['The matching key', '<code>Supplier&rsquo;s ref</code> is a column on the grid <em>and</em> a search field. The Joblogic number goes there; the order is found again by searching it. No custom field, nothing to ask Bellrock for.'],
  ['The clocks', 'Response and completion each show <strong>required and actual</strong> side by side. Priority is a phrase, not a code — &ldquo;3 Working Day (excluding weekends)&rdquo; — so any clock we run has to do the client&rsquo;s working-day arithmetic, not count hours.'],
  ['The write path', 'Ten actions. The completion is <strong>two</strong> of them: <code>Add Note/Document/Photo</code> puts the evidence on, <code>Work complete</code> closes it — so &ldquo;completed but the certificate has not arrived&rdquo; is a state the system can express.'],
  ['Parts On Order', 'A first-class action <em>and</em> a filterable status. Another CAFM has no equivalent, which is why a paused job there has to be inferred from a note.'],
  ['Scope', `<strong>${clients.length || 19} clients</strong> behind one login, and four SEE trading entities. The connector is written once and its value multiplies — but nothing may assume a single client.`],
];

const ACTIONS = ['Add Appointment', 'Cost uplift required', 'Mark job as attended', 'Parts On Order',
  'Assign operative (with appointment)', 'Add Note/Document/Photo', 'Work complete', 'Assign Operative',
  'Add Note', 'Quote required'];
const ROWMENU = ['Select record', 'Options', 'Audit trail / detail', 'Notes and messages', 'Print order', 'Permits', 'Attachments'];

const FILTERS = [
  ['Search field', '—', 'Order number · Order description · Supplier reference · Client reference · Job reference · Site'],
  ['Search box', 'pbl_form_dba_search', 'free text against the field above'],
  ['Type of works order', 'pbl_form_dba_type', 'All · Planned · Reactive · Remedial'],
  ['Status of work order', 'pbl_form_dba_status', 'Attended · In progress · Parts On Order · Work complete'],
  ['Client workspace', 'pbl_form_dba_portfolioid', `the ${clients.length || 19} clients`],
  ['Appointment', 'pbl_form_dba_appoint', 'All · Without appointment · With appointment'],
  ['PPM Tag', 'pbl_form_dba_ppm_tagid', '32 disciplines — Fire, Gas, F Gas, Water, LOLER, Asbestos, Catering Equipment, Air Conditioning…'],
];

const video = !REDACT && fs.existsSync(path.join(MAP, 'concerto-tour.mp4'));

const html = `<!doctype html>
<meta charset="utf-8">
<title>Concerto — supplier portal map${REDACT ? ' (redacted)' : ''}</title>
<style>
  :root { --ink:#16181d; --muted:#6b7280; --line:#e5e7eb; --accent:#0e6b3f; --bg:#fbfaf7; }
  * { box-sizing:border-box }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.55 ui-sans-serif,system-ui,"Segoe UI",sans-serif }
  header { padding:2rem clamp(1rem,4vw,3rem) 1rem; border-bottom:1px solid var(--line) }
  h1 { margin:0 0 .3rem; font-size:1.7rem; letter-spacing:-.02em }
  .sub { color:var(--muted) }
  main { padding:1.5rem clamp(1rem,4vw,3rem) 5rem; max-width:1400px }
  nav { position:sticky; top:0; background:var(--bg); padding:.7rem 0; border-bottom:1px solid var(--line); z-index:5 }
  nav a { color:var(--accent); margin-right:1.2rem; text-decoration:none; font-size:.9rem }
  h2 { margin:2.5rem 0 .6rem; font-size:1.2rem; border-bottom:2px solid var(--accent); display:inline-block; padding-bottom:.2rem }
  h3 { margin:.2rem 0 .1rem; font-size:1.02rem }
  h4 { margin:.8rem 0 .3rem; font-size:.8rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted) }
  .screen { background:#fff; border:1px solid var(--line); border-radius:.6rem; padding:1rem; margin:1rem 0 }
  .url { font:12px ui-monospace,Consolas,monospace; color:var(--muted); word-break:break-all; margin-bottom:.6rem }
  .shot img { width:100%; border:1px solid var(--line); border-radius:.4rem; display:block }
  .cols { display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-top:1rem }
  @media (max-width:900px){ .cols{grid-template-columns:1fr} }
  .row { padding:.28rem 0; border-bottom:1px solid #f3f4f6 }
  code { font:12.5px ui-monospace,Consolas,monospace; background:#f3f4f6; padding:.05em .35em; border-radius:.25rem }
  .lbl { color:var(--muted); font-size:.85rem; margin-left:.4rem }
  .muted { color:var(--muted) }
  details summary { cursor:pointer; color:var(--accent); font-size:.85rem; margin-top:.2rem }
  ul.opts { margin:.3rem 0 .5rem; padding-left:1.1rem; max-height:16rem; overflow:auto; font-size:.85rem }
  pre { white-space:pre-wrap; font:12px ui-monospace,Consolas,monospace; background:#f9fafb; border:1px solid var(--line);
        border-radius:.4rem; padding:.6rem; max-height:20rem; overflow:auto }
  table { border-collapse:collapse; width:100%; background:#fff; border:1px solid var(--line); border-radius:.5rem; font-size:.9rem }
  th,td { text-align:left; padding:.45rem .7rem; border-bottom:1px solid var(--line); vertical-align:top }
  th { background:#f9fafb; font-size:.75rem; text-transform:uppercase; letter-spacing:.07em; color:var(--muted) }
  .warn { background:#fff8e6; border:1px solid #f0d9a0; border-radius:.5rem; padding:.8rem 1rem; margin:1rem 0 }
  video { width:100%; border:1px solid var(--line); border-radius:.5rem; background:#000 }
  .chips span { display:inline-block; background:#fff; border:1px solid var(--line); border-radius:1rem;
                padding:.2rem .7rem; margin:.15rem .2rem .15rem 0; font-size:.85rem }
</style>
<header>
  <h1>Concerto — Bellrock supplier portal</h1>
  <div class="sub">Read from SEE&rsquo;s own helpdesk login · 21 August 2026 · ${stops.length} tour stops,
  ${others.length} further screens · nothing written${REDACT ? ' · redacted' : ''}</div>
</header>
<main>
<nav>
  <a href="#facts">What it tells us</a><a href="#tour">The tour</a><a href="#filters">Filters</a>
  <a href="#actions">Write path</a><a href="#clients">Clients</a><a href="#screens">Other screens</a>
</nav>

${REDACT ? `<div class="warn"><strong>Redacted.</strong> Screenshots and the video are withheld, and
clients, sites, people, addresses, order numbers, emails and phone numbers are replaced with
placeholders. What remains is structure: screens, element ids, dropdown values, filters and action
names. Read it as a description of the software, not of anybody&rsquo;s estate.</div>`
  : `<div class="warn"><strong>Local only.</strong> These screens carry a live client&rsquo;s sites, order
numbers and named people, read from a supplier login that belongs to SEE. Do not publish this file
or the video beside it. There is a redacted build for anything that has to leave this machine.</div>`}

<h2 id="facts">What it tells us</h2>
<table><tr><th>&nbsp;</th><th>&nbsp;</th></tr>
${FACTS.map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`).join('')}
</table>

${video ? `<h2 id="video">The tour, recorded</h2>
<p class="muted">Every screen, read-only, with the search box typed into and cleared to show that
typing is not saving. Taken from Chrome itself over the debugging protocol, because Playwright can
only record a browser it launched — and this one a person had to sign into by hand.</p>
<video controls preload="metadata" src="concerto-tour.mp4"></video>
<p class="muted">Sits beside this file as <code>concerto-tour.mp4</code>.</p>` : ''}

<h2 id="tour">The tour</h2>
${stops.map(section).join('')}

<h2 id="filters">What a driver can query</h2>
<table><tr><th>Filter</th><th>Element id</th><th>Values</th></tr>
${FILTERS.map(([a, b, c]) => `<tr><td>${a}</td><td><code>${esc(b)}</code></td><td>${esc(c)}</td></tr>`).join('')}
</table>

<h2 id="actions">The write path</h2>
<p class="muted">Under <code>#dropdownMenuButton</code> on an order. Captured by opening the menu and
reading it — nothing in it was ever chosen. Note that the same element id sits on the order
<em>list</em> as well, so its presence does not prove you are on a record.</p>
<table><tr><th>Action</th><th>Where it sits in the loop</th></tr>
${ACTIONS.map((a) => `<tr><td>${esc(a)}</td><td class="muted">${{
  'Add Appointment': 'scheduling — the answer to 371 PPMs due with no appointment',
  'Assign Operative': 'who is going',
  'Assign operative (with appointment)': 'who is going, and when',
  'Mark job as attended': 'attendance',
  'Parts On Order': 'the pause, as an action rather than a note',
  'Add Note': 'a note',
  'Add Note/Document/Photo': 'certificates, job sheets and photographs',
  'Work complete': 'the completion',
  'Quote required': 'the quote path',
  'Cost uplift required': 'the spend-limit path — Mandate is the NTE',
}[a] || ''}</td></tr>`).join('')}
</table>
<p class="muted">Nothing in that list <em>accepts</em> an order, because the sample was already
accepted. Acceptance appears on a pending one, which matches the <em>Awaiting Acceptance</em> tile.</p>

<h4>And the row&rsquo;s own menu, on the list</h4>
<div class="chips">${ROWMENU.map((r) => `<span>${esc(r)}</span>`).join('')}</div>
<p class="muted">A second route into a job — history and paperwork — without opening the order.</p>

<h2 id="clients">Clients behind the one login</h2>
<p class="muted">From <code>pbl_form_dba_portfolioid</code>. ${clients.length} of them${REDACT ? ', named in the unredacted build' : ''}.</p>
<div class="chips">${(REDACT ? clients.map((_, i) => 'Client ' + (i + 1)) : clients).map((c) => `<span>${esc(c)}</span>`).join('')}</div>

<h2 id="screens">Other screens</h2>
${others.map(section).join('')}
</main>`;

fs.writeFileSync(OUT, html);
const mb = (fs.statSync(OUT).size / 1048576).toFixed(1);
console.log(`\n  ${OUT}\n  ${stops.length} stops + ${others.length} screens · ${clients.length} clients · ${mb} MB\n`);

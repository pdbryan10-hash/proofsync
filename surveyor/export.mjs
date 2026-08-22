// EXPORT — the same page, without an engine underneath it.
//
// ProofMap runs locally because a survey needs a browser and a person to sign
// in at it. But the RESULT is just a report, and a report is worth sending. So
// this writes the surveys out as flat files and rewrites the page to read them,
// producing something that can sit behind a passcode on the web.
//
// Nothing is re-derived here. The JSON is exactly what the local app serves, so
// a published report cannot drift from the one on the desk.
//
//   node surveyor/export.mjs ../proofmap-web/site
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONCEPTS } from '../kernel/domain.mjs';
import { discover } from '../kernel/discover.mjs';
import { propose } from './propose.mjs';
import { pair } from '../kernel/pair.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, '..', 'proofmap-web', 'site'));

const systems = [];
for (const f of fs.readdirSync(path.join(ROOT, 'kernel', 'systems'))) {
  if (!f.endsWith('.mjs') || f === 'TEMPLATE.mjs') continue;
  systems.push((await import('file://' + path.join(ROOT, 'kernel', 'systems', f))).default);
}

/** Identical shape to /api/system, because it is the same code. */
const survey = (system) => {
  const run = discover(system, { root: ROOT });
  const proposed = propose(run.captures, { only: system.only || null });
  const rows = CONCEPTS.map((c) => {
    const f = run.findings.find((x) => x.id === c.id);
    const p = proposed[c.id];
    return {
      id: c.id, group: c.group, weight: c.weight, question: c.question, why: c.why,
      human: { grade: f.grade, how: f.how, proven: f.proven, contradicted: !!f.contradicted,
        file: f.proof.file || null, sample: f.proof.sample || null },
      machine: { grade: p.grade, how: p.how, basis: p.basis || null, file: p.proof.file || null,
        sample: p.proof.sample || null },
      agree: f.grade === p.grade,
    };
  });
  const shots = fs.existsSync(run.captures)
    ? fs.readdirSync(run.captures).filter((f) => f.endsWith('.png')).sort() : [];
  const video = fs.existsSync(run.captures)
    ? fs.readdirSync(run.captures).find((f) => f.endsWith('.mp4')) || null : null;
  return {
    id: system.id, name: system.name, vendor: system.vendor, role: system.role, access: system.access,
    captures: run.captures, score: run.score, counts: run.counts,
    blockingGaps: run.blockingGaps.map((g) => g.id),
    agreement: Math.round((rows.filter((r) => r.agree).length / rows.length) * 100),
    freeText: rows.filter((r) => r.machine.basis === 'free text').map((r) => r.id),
    rows, shots, video,
  };
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'data', 'domain.json'), JSON.stringify(CONCEPTS));

const index = [];
let bytes = 0;
for (const s of systems) {
  const d = survey(s);
  fs.writeFileSync(path.join(OUT, 'data', 'system-' + d.id + '.json'), JSON.stringify(d));
  index.push({ id: d.id, name: d.name, vendor: d.vendor, score: d.score.pct, counts: d.counts,
    captures: '', missing: !d.shots.length && !d.rows.length });

  const shotDir = path.join(OUT, 'shots', d.id);
  fs.mkdirSync(shotDir, { recursive: true });
  for (const f of [...d.shots, d.video].filter(Boolean)) {
    const from = path.join(d.captures, f);
    if (!fs.existsSync(from)) continue;
    fs.copyFileSync(from, path.join(shotDir, f));
    bytes += fs.statSync(from).size;
  }
  console.log(` · ${d.name}: ${d.shots.length} screens${d.video ? ' + walkthrough' : ''}`);
}
fs.writeFileSync(path.join(OUT, 'data', 'systems.json'), JSON.stringify(index));

// Every ordered pair. A linkage map is cheap to compute and there is nothing on
// the far end to compute it with, so both directions are written out.
let pairs = 0;
for (const A of systems) {
  for (const B of systems) {
    if (A.id === B.id) continue;
    fs.writeFileSync(path.join(OUT, 'data', 'pair-' + A.id + '-' + B.id + '.json'),
      JSON.stringify(pair(A, B, { root: ROOT })));
    pairs += 1;
  }
}
console.log(' - ' + pairs + ' linkage map(s)');

// ── the page, rewired to read files instead of an engine ────────────────────
let html = fs.readFileSync(path.join(HERE, 'ui.html'), 'utf8');
html = html.replace('<script>', '<script>window.PROOFMAP_STATIC = true;', 1);
const swap = (a, b) => {
  if (!html.includes(a)) { console.error('\n  EXPORT FAILED: the page has changed and this rewrite no longer matches:\n  ' + a.slice(0, 90) + '\n'); process.exit(1); }
  html = html.split(a).join(b);
};
swap("href=\"/file?p=${encodeURIComponent(d.captures + '\\\\\\\\' + s)}\"", "href=\"shots/${d.id}/${s}\"");
swap("src=\"/file?p=${encodeURIComponent(d.captures + '\\\\\\\\' + s)}\"", "src=\"shots/${d.id}/${s}\"");
swap("src=\"/file?p=${encodeURIComponent(d.captures + '\\\\\\\\' + d.video)}\"", "src=\"shots/${d.id}/${d.video}\"");
// No engine, so no surveying, and no local paths worth publishing.
swap('<button class="act" onclick="newSurvey.showModal()">Survey a new system</button>',
  '<button class="act" disabled title="Surveying runs on the desktop" style="opacity:.5;cursor:default">Survey a new system</button>'
  + '<div class="railnote">Surveying runs on the desktop app, where a browser can be opened and signed into. This is the report it produced.</div>');
swap('    <p class="path">${esc(d.captures)}</p>', '');
swap('</style>', `  .railnote { font-size:13px; color:var(--ink-3); line-height:1.55; background:var(--sunk);
       border:1px solid var(--line); border-radius:8px; padding:12px 14px }
</style>`);

fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`\n  ${index.length} systems · ${(bytes / 1048576).toFixed(1)} MB of captures`);
console.log(`  ${OUT}\n`);

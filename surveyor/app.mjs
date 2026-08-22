// THE SURVEYOR — a desktop app around the kernel.
//
// Node's own http server plus one HTML page, and a .bat that opens Chrome at it
// in app mode so it behaves like a window rather than a tab. No Electron, no
// Tauri, no build step: the engine is the interesting part and it is already
// written. A native shell can be wrapped round this later without touching it.
//
//   node surveyor/app.mjs            → http://localhost:4321
//   SURVEYOR.bat                     → the same, in its own window
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONCEPTS } from '../kernel/domain.mjs';
import { discover } from '../kernel/discover.mjs';
import { propose } from './propose.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PORT = Number(process.env.SURVEYOR_PORT || 4321);

const loadSystems = async () => {
  const dir = path.join(ROOT, 'kernel', 'systems');
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.mjs') || f === 'TEMPLATE.mjs') continue;
    try { out.push((await import('file://' + path.join(dir, f))).default); } catch (e) { console.error(f, e.message); }
  }
  return out;
};

/** Everything the page needs about one system, in one shot. */
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
        sample: p.proof.sample || null, signal: p.signal || null },
      agree: f.grade === p.grade,
    };
  });
  const shots = fs.existsSync(run.captures)
    ? fs.readdirSync(run.captures).filter((f) => f.endsWith('.png')).sort()
    : [];
  const video = fs.existsSync(run.captures)
    ? fs.readdirSync(run.captures).find((f) => f.endsWith('.mp4')) || null : null;
  return {
    id: system.id, name: system.name, vendor: system.vendor, role: system.role, access: system.access,
    captures: run.captures, score: run.score, counts: run.counts,
    blockingGaps: run.blockingGaps.map((g) => g.id),
    agreement: Math.round((rows.filter((r) => r.agree).length / rows.length) * 100),
    // Surfaced rather than buried in a grade: a concept the machine could only
    // find in free text is a person describing it, not the software having it.
    freeText: rows.filter((r) => r.machine.basis === 'free text').map((r) => r.id),
    unobserved: rows.filter((r) => r.human.grade === 'absent').map((r) => r.id),
    rows, shots, video,
  };
};

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

/** Serving a file out of a captures folder, and nowhere else. */
const sendFile = (res, file) => {
  const abs = path.resolve(file);
  if (!abs.startsWith(path.resolve(ROOT)) && !abs.startsWith(path.resolve('C:/dev/sites'))) return send(res, 403, { error: 'outside the capture roots' });
  if (!fs.existsSync(abs)) return send(res, 404, { error: 'not found' });
  const type = abs.endsWith('.png') ? 'image/png' : abs.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream';
  const stat = fs.statSync(abs);
  res.writeHead(200, { 'content-type': type, 'content-length': stat.size, 'accept-ranges': 'bytes' });
  fs.createReadStream(abs).pipe(res);
};

const progress = [];
let running = false;
let stopper = null;
let ready = false;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/') return send(res, 200, fs.readFileSync(path.join(HERE, 'ui.html')), 'text/html; charset=utf-8');

    // The domain itself, so the page can describe what it asks without a copy
    // of the questions drifting out of sync with the ones that get asked.
    if (url.pathname === '/api/domain') return send(res, 200, CONCEPTS);

    if (url.pathname === '/api/systems') {
      const systems = await loadSystems();
      return send(res, 200, systems.map((s) => {
        const r = discover(s, { root: ROOT });
        return { id: s.id, name: s.name, vendor: s.vendor, score: r.score.pct, counts: r.counts, captures: r.captures,
          missing: !fs.existsSync(r.captures) };
      }));
    }

    if (url.pathname === '/api/system') {
      const systems = await loadSystems();
      const s = systems.find((x) => x.id === url.searchParams.get('id'));
      if (!s) return send(res, 404, { error: 'no such system' });
      return send(res, 200, survey(s));
    }

    if (url.pathname === '/file') return sendFile(res, url.searchParams.get('p'));

    if (url.pathname === '/api/progress') return send(res, 200, { running, lines: progress.slice(-200) });

    // "I am in." The person is the authority on whether a sign-in happened;
    // no amount of DOM inspection beats being told.
    if (url.pathname === '/api/ready' && req.method === 'POST') { ready = true; return send(res, 200, { ready: true }); }

    if (url.pathname === '/api/cancel' && req.method === 'POST') {
      if (!running) return send(res, 200, { stopped: false, note: 'nothing running' });
      progress.push('stopping…');
      await stopper?.stop?.();
      running = false; stopper = null;
      progress.push('stopped. The browser is closed and the session profile is gone.');
      return send(res, 200, { stopped: true });
    }

    if (url.pathname === '/api/survey' && req.method === 'POST') {
      const body = await new Promise((r) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => r(b)); });
      const { id, startUrl, max } = JSON.parse(body || '{}');
      if (!id || !startUrl) return send(res, 400, { error: 'a short name and a sign-in URL, please' });
      if (running) return send(res, 409, { error: 'a survey is already running — stop it first' });
      running = true; ready = false; progress.length = 0;
      const outDir = path.join(ROOT, 'data', id + '-map');
      // Deliberately not awaited: the browser opens, a person signs in, and the
      // page polls /api/progress while that happens.
      import('./crawl.mjs').then(({ crawl }) => crawl({
        id, startUrl, outDir, max: max || 0, onProgress: (m) => progress.push(m),
        onStart: (h) => { stopper = h; }, isReady: () => ready,
      })).then((r) => {
        progress.push(`captured ${r.screens.length} screens. Now draft kernel/systems/${id}.mjs from the proposals.`);
      }).catch((e) => progress.push('FAILED: ' + e.message)).finally(() => { running = false; stopper = null; });
      return send(res, 200, { started: true, outDir });
    }

    // Write a system module from whatever the human settled on.
    if (url.pathname === '/api/confirm' && req.method === 'POST') {
      const body = await new Promise((r) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => r(b)); });
      const { id, name, vendor, captures, answers } = JSON.parse(body || '{}');
      if (!id || !answers) return send(res, 400, { error: 'id and answers please' });
      const lines = [
        `// ${name || id} — confirmed by a person on ${new Date().toISOString().slice(0, 10)}.`,
        '//',
        '// Drafted by the surveyor from captures, then reviewed row by row. Grades a',
        '// person changed are marked; everything else is the machine\'s reading, accepted.',
        'export default {',
        `  id: ${JSON.stringify(id)},`,
        `  name: ${JSON.stringify(name || id)},`,
        `  vendor: ${JSON.stringify(vendor || '')},`,
        `  captures: ${JSON.stringify(captures || ('data/' + id + '-map'))},`,
        '',
        '  map: {',
      ];
      for (const [cid, a] of Object.entries(answers)) {
        lines.push(`    ${cid}: { grade: ${JSON.stringify(a.grade)}, how: ${JSON.stringify(a.how || '')},`);
        lines.push(`      where: { glob: ${JSON.stringify(a.glob || '*.json')}, find: ${JSON.stringify(a.find || '')} }${a.changed ? ',   // changed by hand' : ''} },`);
      }
      lines.push('  },', '};', '');
      const out = path.join(ROOT, 'kernel', 'systems', id + '.mjs');
      fs.writeFileSync(out, lines.join('\n'));
      return send(res, 200, { written: path.relative(ROOT, out) });
    }

    return send(res, 404, { error: 'no' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n  The Surveyor — http://localhost:${PORT}\n`);
});

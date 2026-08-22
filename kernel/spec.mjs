// SPEC — turn a linkage map into something a build can read.
//
// The linkage map says what happens to a fact when it crosses. This says what
// to DO about it: which leg, which direction, which fields, which actions in
// which order, what to re-read afterwards, and — the part everyone skips —
// which legs are not buildable and why.
//
// It is generated, never written. Every line traces back to a captured screen,
// so a spec cannot claim a field that no survey ever saw. Where a leg cannot be
// built it says so and names what would unblock it, rather than quietly
// producing a stub that will fail at three in the morning.
//
//   node kernel/spec.mjs concerto vx           → prints it
//   node kernel/spec.mjs concerto vx --write   → writes connectors/<a>-to-<b>/
import fs from 'node:fs';
import path from 'node:path';
import { pair } from './pair.mjs';

/**
 * The legs of the loop, in the order they happen. Each names the concepts it
 * depends on: if one of those does not cross, the leg inherits that.
 */
const LEGS = [
  { id: 'intake', title: 'A job arrives', needs: ['job', 'client', 'site', 'intake', 'priority', 'sla'],
    writes: null, direction: 'a->b',
    detail: 'Notice the new job on the source, and raise its twin on the target.' },
  { id: 'key', title: 'Tie the two records together', needs: ['cross_key'],
    writes: 'reference', direction: 'both',
    detail: 'Write each system’s number into the other. Do this BEFORE anything else — it is what makes every later step idempotent.' },
  { id: 'accept', title: 'Acceptance', needs: ['acceptance'], writes: 'accept', direction: 'b->a',
    detail: 'When the target accepts, stamp the source so its clock stops.' },
  { id: 'appointment', title: 'A date is promised', needs: ['eta'], writes: 'appointment', direction: 'b->a',
    detail: 'Carry the promised date across, and compare it with the target date before anyone is late.' },
  { id: 'attend', title: 'Somebody turned up', needs: ['attendance'], writes: 'attend', direction: 'b->a',
    detail: 'Attendance is not completion. Two clocks.' },
  { id: 'pause', title: 'The job stops', needs: ['pause'], writes: 'pause', direction: 'b->a',
    detail: 'Parts, access, a second visit. A pause read as progress is how a job hides for three weeks.' },
  { id: 'evidence', title: 'The paperwork', needs: ['evidence'], writes: 'evidence', direction: 'b->a',
    detail: 'Certificates, job sheets, photographs. The completion nobody can prove is the one that does not get paid.' },
  { id: 'complete', title: 'The job closes', needs: ['completion', 'history'], writes: 'complete', direction: 'b->a',
    detail: 'Close it on the source, and prove the close by reading it back.' },
  { id: 'exception', title: 'Somebody has to be chased', needs: ['exception'], writes: 'note', direction: 'both',
    detail: 'Whose court the ball is in, and what happens when it stays there.' },
  { id: 'money', title: 'Quotes and spend', needs: ['money'], writes: 'quote', direction: 'both',
    detail: 'The commonest reason a job stops is money, and it is a different workflow from the work.' },
];

const WORST = { linked: 0, bridged: 1, 'one-sided': 2, missing: 3 };

export const spec = (sysA, sysB, { root = process.cwd() } = {}) => {
  const p = pair(sysA, sysB, { root });
  const row = (id) => p.rows.find((r) => r.id === id);

  const legs = LEGS.map((leg) => {
    const deps = leg.needs.map(row).filter(Boolean);
    const worst = deps.reduce((w, d) => (WORST[d.verdict.key] > WORST[w.verdict.key] ? d : w), deps[0]);
    const target = leg.direction === 'a->b' ? sysB : sysA;
    const recipe = leg.writes ? (target.recipes?.[leg.writes] || null) : null;

    let status = 'buildable', why = 'Every concept it depends on crosses cleanly.';
    if (worst?.verdict.key === 'bridged') {
      status = 'needs a rule';
      why = `${worst.id} only crosses by inference (${worst.a.field} against ${worst.b.field}). Write the rule down, and test it against real jobs before trusting it.`;
    }
    if (worst?.verdict.key === 'one-sided') {
      status = 'blocked';
      why = `${worst.id} cannot be expressed on one side. Nothing to write to, so this leg has to live outside both systems — a mailbox, a store, or a person — until that changes.`;
    }
    if (recipe && recipe.some((step) => step.startsWith('('))) {
      status = status === 'buildable' ? 'not yet captured' : status;
      why += ' The action itself has not been seen yet — it is on a record in a state we have not opened.';
    }

    return {
      id: leg.id, title: leg.title, detail: leg.detail, direction: leg.direction,
      status, why,
      into: target.name,
      fields: leg.needs.map((n) => {
        const r = row(n);
        return r ? { concept: n, [sysA.id]: r.a.field, [sysB.id]: r.b.field, crossing: r.verdict.key } : null;
      }).filter(Boolean),
      actions: recipe,
      verify: target.map?.verify?.field || null,
    };
  });

  const stateRow = row('states');
  return {
    generated: 'kernel/spec.mjs — do not edit by hand; re-run it',
    a: { id: sysA.id, name: sysA.name, driver: sysA.driver || null },
    b: { id: sysB.id, name: sysB.name, driver: sysB.driver || null },
    carried: p.carried,
    key: { [sysA.id]: row('cross_key').a.field, [sysB.id]: row('cross_key').b.field,
      rule: 'write each reference into the other system before any other write, then find records by searching it' },
    // Keyed by the CANONICAL state, not by system, so a connector reads
    // states[PAUSED][theirId] rather than transposing it at runtime.
    states: (() => {
      const src = stateRow?.states;
      if (!src?.a && !src?.b) return null;
      const out = {};
      for (const k of new Set([...Object.keys(src.a || {}), ...Object.keys(src.b || {})])) {
        out[k] = { [sysA.id]: src.a?.[k] || null, [sysB.id]: src.b?.[k] || null };
      }
      return out;
    })(),
    transforms: [
      { id: 'priority', from: row('priority').a.field, to: row('priority').b.field,
        rule: 'one side is a phrase in working days, the other a band in calendar hours. Convert through a working-day calendar with the client’s own hours — do not count hours against a working-day target.' },
      { id: 'reference', rule: 'references are opaque strings; never parse them for meaning, only match them.' },
    ],
    legs,
    open: p.rows.filter((r) => r.verdict.key !== 'linked')
      .map((r) => ({ concept: r.id, crossing: r.verdict.key, ask: r.verdict.note })),
  };
};

// ── the stub, so the human work starts at the selectors ─────────────────────
const adapter = (s) => `// ${s.a.name}  ->  ${s.b.name}
//
// GENERATED by kernel/spec.mjs from a read-only survey of both systems, then
// left deliberately unfinished. What is filled in is what the surveys PROVED:
// the key, the state map, the leg order and the action recipes. What is left
// is what no survey can give you — the selectors, and the judgement about when
// to act. Fill those in; do not invent the ones above.
//
// ${s.carried}% of the domain crosses cleanly between these two.
import SPEC from './spec.json' with { type: 'json' };

/** Their word -> ours -> their word. Straight out of the crosswalk. */
export const STATES = ${JSON.stringify(s.states, null, 2)};
export const toCanonical = (system, word) =>
  Object.entries(STATES).find(([, v]) => (v[system] || '').toLowerCase() === String(word).toLowerCase())?.[0] || null;
export const fromCanonical = (system, canon) => STATES[canon]?.[system] || null;

/** The cross-system key. Nothing else may be used to match records. */
export const KEY = ${JSON.stringify(s.key, null, 2)};

${s.legs.map((l) => `/**
 * ${l.title.toUpperCase()} — ${l.status}
 * ${l.why}
 * Writes into: ${l.into}
 * ${l.actions ? 'Actions, in order: ' + l.actions.join(' -> ') : 'No write on this leg.'}
 */
export const ${l.id} = async (job, ctx) => {
${l.status === 'blocked'
    ? `  // BLOCKED and not stubbed on purpose. ${l.why}
  throw new Error('${l.id}: not buildable against these two systems - see spec.json');`
    : `  // TODO selectors. Everything else on this leg is already decided.
  throw new Error('${l.id}: not implemented');`}
};`).join('\n\n')}
`;

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('spec.mjs')) {
  const [aId, bId] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
  if (!aId || !bId) { console.error('usage: node kernel/spec.mjs <a> <b> [--write]'); process.exit(1); }
  const root = process.cwd();
  const load = async (id) => (await import('file://' + path.join(root, 'kernel', 'systems', id + '.mjs'))).default;
  const s = spec(await load(aId), await load(bId), { root });

  console.log(`\n  ${s.a.name}  ->  ${s.b.name}   (${s.carried}% carried)\n`);
  for (const l of s.legs) {
    const flag = l.status === 'buildable' ? ' ' : l.status === 'needs a rule' ? '~' : '!';
    console.log(`   ${flag} ${l.id.padEnd(12)} ${l.status.padEnd(16)} ${l.actions ? l.actions.join(' -> ') : ''}`);
  }
  console.log(`\n  ${s.open.length} concept(s) still open\n`);

  if (process.argv.includes('--write')) {
    const dir = path.join(root, 'connectors', `${aId}-to-${bId}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify(s, null, 2));
    fs.writeFileSync(path.join(dir, 'adapter.mjs'), adapter(s));
    console.log(`  written: ${path.relative(root, dir)}\n`);
  }
}

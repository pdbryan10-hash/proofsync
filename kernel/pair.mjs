// PAIR — put two systems side by side and work out what connecting them means.
//
// A survey scores one system. A SYNC is about two, and the interesting question
// is never "how good is this CAFM" — it is "what happens to a fact when it has
// to cross". This answers that per concept, and then says the same thing at the
// top in one sentence, because that is the sentence somebody is buying.
//
// Nothing here is new evidence. It is the two surveys, joined.
import { CONCEPTS } from './domain.mjs';
import { discover } from './discover.mjs';

/** What a concept costs to carry, given how each side holds it. */
const verdictFor = (a, b) => {
  const rank = (f) => (f.status === 'stated' ? 2 : f.status === 'inferred' ? 1 : 0);
  const [x, y] = [rank(a), rank(b)];
  if (x === 2 && y === 2) return {
    key: 'linked', label: 'Linked',
    note: 'Both systems state it. This carries straight across.' };
  if (x >= 1 && y >= 1) return {
    key: 'bridged', label: 'Bridged',
    note: 'One side only implies it, so the connector has to work it out and can be wrong. Worth a rule, and worth testing.' };
  if (x + y >= 1) return {
    key: 'one-sided', label: 'One-sided',
    note: 'Only one side can express this at all. Anything the other side needs to know has to be carried some other way — a note, an email, or a field we borrow.' };
  return {
    key: 'missing', label: 'Missing both ends',
    note: 'Neither system holds it. If the operation depends on this, it lives in somebody’s head today and will still live there afterwards.' };
};

/** The sentences that decide whether this pairing is a fortnight or a quarter. */
const headline = (rows) => {
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  const out = [];

  const k = by.cross_key;
  if (k?.verdict.key === 'linked') out.push({
    tone: 'good', title: 'The join already exists',
    body: `Each system has a slot for the other's reference — ${k.a.field} on one side, ${k.b.field} on the other. `
      + 'Write each number into the other system on the way through and every later lookup is a search, not a guess. '
      + 'No custom field, nothing to ask a vendor for, and reconciliation after a crash is a query.' });
  else out.push({
    tone: 'bad', title: 'There is no shared key',
    body: 'Neither side can hold the other’s reference, so the connector needs its own lookup table — '
      + 'which is the thing that rots silently after the first crash. Get a custom field before anything else.' });

  const v = by.verify;
  if (v?.verdict.key === 'linked') out.push({
    tone: 'good', title: 'A write can be proven',
    body: 'Both sides carry an attributed, timed record, so anything written can be read back and confirmed. '
      + 'That is the difference between an operator and an optimist.' });
  else out.push({
    tone: 'bad', title: 'A write cannot be proven on one side',
    body: 'Without a read-back the connector can only claim it wrote something. Keep that leg attended.' });

  const e = by.evidence;
  if (e && e.verdict.key !== 'linked') out.push({
    tone: 'warn', title: 'The evidence leg does not meet',
    body: `${e.a.grade === 'absent' ? e.aName : e.bName} has nowhere to put a certificate or a photograph`
      + ` (${e.a.grade === 'absent' ? e.a.field : e.b.field}). `
      + 'So the completion can cross but its paperwork cannot, and that gap has to be built somewhere else — '
      + 'a mailbox, a document store, or a person.' });

  const p = by.priority;
  if (p?.verdict.key === 'linked') out.push({
    tone: 'warn', title: 'Both state urgency, in different arithmetic',
    body: `${p.aName} says "${p.a.field}", ${p.bName} says "${p.b.field}". `
      + 'Working days are not calendar hours. A clock that counts the wrong one is confidently wrong all day.' });

  const s = by.states;
  if (s?.verdict.key === 'linked') out.push({
    tone: 'good', title: 'The states can be normalised',
    body: 'Both expose a state vocabulary, so each maps into the canonical set and the pair can be spoken about '
      + 'in one language — see the crosswalk below.' });

  return out;
};

export const pair = (sysA, sysB, { root = process.cwd() } = {}) => {
  const A = discover(sysA, { root });
  const B = discover(sysB, { root });
  const rows = CONCEPTS.map((c) => {
    const fa = A.findings.find((x) => x.id === c.id);
    const fb = B.findings.find((x) => x.id === c.id);
    const cell = (f, sys) => ({
      grade: f.grade, status: f.status, field: (sys.map?.[c.id]?.field) || '—',
      how: f.how, file: f.proof.file || null,
    });
    const a = cell(fa, sysA), b = cell(fb, sysB);
    return {
      id: c.id, group: c.group, weight: c.weight, question: c.question, why: c.why,
      a, b, aName: sysA.name, bName: sysB.name,
      verdict: verdictFor(fa, fb),
      states: c.id === 'states'
        ? { a: sysA.map?.states?.states || null, b: sysB.map?.states?.states || null } : null,
    };
  });

  const counts = { linked: 0, bridged: 0, 'one-sided': 0, missing: 0 };
  for (const r of rows) counts[r.verdict.key] += 1;
  const blocking = rows.filter((r) => r.weight === 'blocking' && r.verdict.key !== 'linked');

  return {
    a: { id: sysA.id, name: sysA.name, vendor: sysA.vendor },
    b: { id: sysB.id, name: sysB.name, vendor: sysB.vendor },
    counts, rows, blocking: blocking.map((r) => r.id),
    // A crossing is only as good as its worst blocking concept.
    carried: Math.round((rows.reduce((n, r) => n + (r.verdict.key === 'linked' ? 1 : r.verdict.key === 'bridged' ? 0.5 : 0), 0) / rows.length) * 100),
    headline: headline(rows),
  };
};

// THE PROPOSER — answer the domain's questions from a pile of captures.
//
// This is the difference between a scraper and a surveyor. Anyone can dump
// screens; the work is looking at the dump and saying "acceptance is stated
// here, and it is a timestamped event". Until now a person did that. This tries
// to do it, and — crucially — is scored against the answers a person gave.
//
// HOW IT WORKS, AND WHY IT IS DELIBERATELY DUMB
//
// Each concept carries a list of SIGNALS: vocabulary an FM system might use for
// it, ordered strongest first. The first that resolves in the captures wins and
// carries its grade with it. No model, no cleverness — the vocabulary of this
// industry is small and mostly borrowed, which is exactly why this works at all.
//
// The signals must be GENERIC. Writing "Parts On Order" as the pause signal
// would make the Concerto score meaningless — so the pause signal is a family
// of phrases, of which Concerto uses one and VX another.
//
//   node surveyor/propose.mjs data/concerto-map
//   node surveyor/propose.mjs data/concerto-map --against concerto   (scored)
import path from 'node:path';
import { resolve } from '../kernel/evidence.mjs';

const J = { glob: '**' };   // captures are JSON here, CSV exports there — search both

/** grade: what it means about the SYSTEM if this signal is the one that hits. */
export const SIGNALS = {
  job: [
    { find: /order number|work order|wo #|job number|job reference|call reference/i, grade: 'direct',
      how: 'a job identifier is stated on the record and in the lists' },
  ],
  cross_key: [
    { find: /supplier.{0,3}s ref|contractor reference|provider reference|external reference|your reference|third party ref/i, grade: 'direct',
      how: 'a field exists for the other system’s reference — the cross-system key needs no custom field' },
    { find: /custom field|user defined field/i, grade: 'inferred',
      how: 'no dedicated slot, but user-defined fields exist and could carry the key' },
  ],
  client: [
    { find: /portfolio|client workspace|tenant|parent organisation|customer account/i, grade: 'direct',
      how: 'the client is an explicit dimension — a tenancy or an account field' },
    { find: /\bclient\b|\bcustomer\b/i, grade: 'inferred', how: 'client appears as a word but not as a dimension we can filter on' },
  ],
  site: [
    { find: /uprn|site no|site code|property (id|reference)|location code/i, grade: 'direct',
      how: 'sites carry a stable identifier, so two systems can be joined on it' },
    { find: /site name|location of work|premises/i, grade: 'inferred',
      how: 'sites are named but not coded — joining means matching typed text' },
  ],
  supplier: [
    { find: /contractor|supplier|operative|engineer name|subcontractor/i, grade: 'direct',
      how: 'the party doing the work is named on the job' },
  ],
  requester: [
    { find: /originator|reported by|requested by|created by|caller|logged by/i, grade: 'direct',
      how: 'the record distinguishes who asked from who logged it' },
  ],
  intake: [
    { find: /emailed to|notification sent|dispatched to|sent to (supplier|contractor)/i, grade: 'direct',
      how: 'the system records that it told somebody — intake can be reconciled against a mailbox' },
    { find: /date.{0,3}(time)? (created|raised|logged)/i, grade: 'inferred',
      how: 'jobs carry a creation time but no arrival event: discovery means polling' },
  ],
  acceptance: [
    { find: /accept within sla|date acknowledged|accepted on|acceptance date|acknowledged/i, grade: 'direct',
      how: 'acceptance is a stamped event, not a status to be inferred' },
    { find: /pend\.? accept|awaiting acceptance|to be accepted/i, grade: 'inferred',
      how: 'acceptance exists only as a status to leave — the moment has to be reconstructed' },
  ],
  priority: [
    { find: /working day|priority of response|response priority/i, grade: 'direct',
      how: 'priority is stated per job, and in the client’s own words rather than as a code' },
    { find: /\bp[1-6]\b|priority|urgency|sla band/i, grade: 'direct', how: 'priority is a banded code on the job' },
  ],
  sla: [
    { find: /(response|completion|fix|accept).{0,12}(time )?(required|due|sla|target)/i, grade: 'direct',
      how: 'targets are stated per job rather than computed from a policy we hold' },
  ],
  eta: [
    { find: /appointment|\beta\b|promised (date|time)|scheduled (date|visit)/i, grade: 'direct',
      how: 'a promised date exists and can be compared with the target' },
  ],
  states: [
    { find: /status of work order|current status|job status|work status/i, grade: 'direct',
      how: 'a state vocabulary is exposed and filterable' },
    { find: /\bstatus\b/i, grade: 'direct', how: 'a status column exists — the state vocabulary is whatever it holds' },
  ],
  attendance: [
    { find: /mark job as attended|attended|on site|arrived/i, grade: 'direct',
      how: 'attendance is expressible separately from completion — two clocks, not one' },
  ],
  pause: [
    { find: /parts on order|awaiting parts|on hold|suspended|paused/i, grade: 'direct',
      how: 'the system can say a job is stopped and waiting' },
    { find: /service incomplete|incomplete|part complete/i, grade: 'inferred',
      how: 'a status means "stopped" only by convention — reading it as motion hides a stalled job' },
  ],
  recall: [
    { find: /\brecall\b|return visit|revisit|repeat (visit|call)/i, grade: 'inferred',
      how: 'repeat visits are describable but not linked to the original job' },
  ],
  evidence: [
    { find: /add note\/document\/photo|attach|upload|certificate|job sheet|document/i, grade: 'direct',
      how: 'there is somewhere on the record for certificates, sheets and photographs' },
  ],
  completion: [
    { find: /work complete|job.?complete|completed on|completion date/i, grade: 'direct',
      how: 'a named action or state closes the job' },
  ],
  history: [
    { find: /posted by|notes and activities|audit trail|activity log|log note|history/i, grade: 'direct',
      how: 'an attributed, timed record exists — which is what read-back verification reads' },
  ],
  actions: [
    { find: /actions|assign operative|add appointment|update eta|log_note/i, grade: 'direct',
      how: 'the write path is a named set of actions on the record' },
  ],
  exception: [
    { find: /escalat/i, grade: 'direct', how: 'escalation is stated on the record' },
    { find: /currently with|passed back|awaiting (client|customer) /i, grade: 'inferred',
      how: 'whose court the ball is in can be read, but only in part of the system' },
  ],
  money: [
    { find: /mandate|\bnte\b|not to exceed|spend limit|quote|cost uplift/i, grade: 'direct',
      how: 'a spend limit and a quote route exist — the commonest reason a job stops' },
  ],
  verify: [
    { find: /posted by|log note|audit trail|activity/i, grade: 'direct',
      how: 'a write can be re-read from the record, so it can be proven to have landed' },
  ],
};

/**
 * Propose an answer for every concept from what is on disk.
 *
 * TWO PASSES, and the order is the whole point.
 *   1. STRUCTURE — headers, options, field ids, action names. A hit here is the
 *      software having the concept, and grades as the signal says.
 *   2. FREE TEXT — descriptions, notes, call scripts. A hit here is a PERSON
 *      mentioning the concept, which is never better than `inferred` and is
 *      labelled as such, because a job described as "on hold" in a text box is
 *      not a system that can express a pause.
 */
export const propose = (captures, { only = null } = {}) => {
  const out = {};
  for (const [id, signals] of Object.entries(SIGNALS)) {
    let answer = null;
    for (const s of signals) {
      const proof = resolve(captures, s.glob || J.glob, s.find, { structureOnly: true, only });
      if (!proof.found) continue;
      answer = { grade: s.grade, how: s.how, where: { glob: s.glob || J.glob, find: String(s.find) },
        proof, signal: String(s.find), basis: 'structure' };
      break;
    }
    if (!answer) {
      for (const s of signals) {
        const proof = resolve(captures, s.glob || J.glob, s.find, { only });
        if (!proof.found) continue;
        answer = { grade: 'inferred', how: s.how + ' — but seen only in free text, so this is somebody describing it rather than the system expressing it',
          where: { glob: s.glob || J.glob, find: String(s.find) }, proof, signal: String(s.find), basis: 'free text' };
        break;
      }
    }
    out[id] = answer || {
      grade: 'absent',
      how: 'no vocabulary for this found in the captures — either the system has no expression for it, or the survey did not reach the screen that does.',
      where: { glob: J.glob, find: String(signals[0]?.find || '') },
      proof: { found: false, reason: 'no signal matched' },
    };
  }
  return out;
};

// ── CLI ───────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node surveyor/propose.mjs <captures-dir> [--against <system id>]'); process.exit(1); }
  const captures = path.resolve(process.cwd(), dir);
  const againstIdx = process.argv.indexOf('--against');
  let truth = null, only = null;
  if (againstIdx > 0) {
    const mod = await import('../kernel/systems/' + process.argv[againstIdx + 1] + '.mjs');
    truth = mod.default.map;
    only = mod.default.only || null;
  }
  const proposed = propose(captures, { only });

  console.log(`\n  proposed from ${captures}\n`);
  let right = 0, total = 0;
  for (const [id, a] of Object.entries(proposed)) {
    const t = truth?.[id];
    const mark = !t ? ' ' : t.grade === a.grade ? '✓' : '✗';
    if (t) { total += 1; if (t.grade === a.grade) right += 1; }
    const site = a.proof.found ? a.proof.file : '—';
    console.log(`   ${mark} ${id.padEnd(12)} ${a.grade.padEnd(9)} ${(a.basis || '').padEnd(10)} ${String(site).slice(0, 34).padEnd(36)}${t && t.grade !== a.grade ? 'human said: ' + t.grade : ''}`);
  }
  if (truth) console.log(`\n  agreed with the human map on ${right} of ${total} (${Math.round((right / total) * 100)}%)\n`);
}

// DISCOVER — score a system against the domain, and check its homework.
//
// Two separate judgements, deliberately not merged:
//
//   GRADE   how well the system expresses the concept (stated / inferred / absent)
//   PROOF   whether the claim resolves in the captures we hold
//
// A `direct` claim with no evidence is worth nothing and is reported as
// UNPROVEN. That is the mechanism that stops this becoming a table of
// confident assertions about software somebody looked at once.
import path from 'node:path';
import { CONCEPTS, GRADES, WEIGHTS } from './domain.mjs';
import { resolve } from './evidence.mjs';

export const discover = (system, { root = process.cwd() } = {}) => {
  const captures = path.isAbsolute(system.captures) ? system.captures : path.join(root, system.captures);
  const findings = CONCEPTS.map((c) => {
    const claim = system.map?.[c.id];
    if (!claim) {
      return { ...c, grade: 'absent', how: 'not mapped — nobody has looked, which is different from the system not having it.',
        proof: { found: false, reason: 'no claim made' }, proven: false, unmapped: true };
    }
    const proof = claim.where ? resolve(captures, claim.where.glob, claim.where.find) : { found: false, reason: 'no evidence pointer' };
    // ABSENCE IS NEVER PROVEN.
    //
    // The first cut of this treated "searched and found nothing" as evidence of
    // absence, which is the one thing a partial crawl cannot establish: a
    // concept we never navigated to is indistinguishable from one that is not
    // there. So a searched-and-empty absence is UNOBSERVED — we looked at N
    // files and did not see it — and it scores nothing, exactly as before. What
    // changes is that the report stops calling it confirmed.
    //
    // Finding the thing still CONTRADICTS the claim and wants a human.
    const contradicted = claim.grade === 'absent' && proof.found;
    const looked = (proof.searched ?? 0) > 0;
    const proven = claim.grade === 'absent' ? false : proof.found;
    const status = claim.grade === 'absent'
      ? (contradicted ? 'contradicted' : looked ? 'unobserved' : 'not looked')
      : (proof.found ? claim.grade === 'direct' ? 'stated' : 'inferred' : 'unproven');
    return { ...c, grade: claim.grade, how: claim.how, states: claim.states, where: claim.where,
      proof, proven, contradicted, status, looked };
  });

  // Scoring: a concept earns its weight × grade rank, but only if the claim is
  // proven. Absent-and-proven still scores zero — the honesty is in the report,
  // not in a flattering number.
  const max = CONCEPTS.reduce((n, c) => n + WEIGHTS[c.weight] * GRADES.direct.rank, 0);
  const got = findings.reduce((n, f) => n + (f.proven ? WEIGHTS[f.weight] * (GRADES[f.grade]?.rank ?? 0) : 0), 0);

  const blockingGaps = findings.filter((f) => f.weight === 'blocking' && f.status !== 'stated' && f.status !== 'inferred');
  return {
    system, captures, findings,
    score: { got, max, pct: Math.round((got / max) * 100) },
    counts: {
      stated: findings.filter((f) => f.status === 'stated').length,
      inferred: findings.filter((f) => f.status === 'inferred').length,
      unobserved: findings.filter((f) => f.status === 'unobserved').length,
      unproven: findings.filter((f) => f.status === 'unproven' || f.status === 'not looked').length,
      contradicted: findings.filter((f) => f.contradicted).length,
    },
    blockingGaps,
  };
};

/** Where two systems disagree about how they hold the same fact. */
export const compare = (a, b) => CONCEPTS.map((c) => {
  const fa = a.findings.find((f) => f.id === c.id);
  const fb = b.findings.find((f) => f.id === c.id);
  return {
    id: c.id, question: c.question, weight: c.weight,
    a: { grade: fa.grade, proven: fa.proven, how: fa.how },
    b: { grade: fb.grade, proven: fb.proven, how: fb.how },
    divergent: fa.grade !== fb.grade,
  };
});

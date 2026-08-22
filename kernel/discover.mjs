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
    // A claim of ABSENCE is proven by NOT finding the thing. Searching for it
    // and coming back empty is the evidence; finding it CONTRADICTS the claim
    // and wants a human. Graded claims are the other way round.
    // ...but only if the search actually looked at something. With no captures
    // at all, "we did not find it" is not evidence of absence, it is evidence
    // of not having looked — and that pass would have been free.
    const proven = claim.grade === 'absent' ? (!proof.found && (proof.searched ?? 0) > 0) : proof.found;
    const contradicted = claim.grade === 'absent' && proof.found;
    return { ...c, grade: claim.grade, how: claim.how, states: claim.states, where: claim.where, proof, proven, contradicted };
  });

  // Scoring: a concept earns its weight × grade rank, but only if the claim is
  // proven. Absent-and-proven still scores zero — the honesty is in the report,
  // not in a flattering number.
  const max = CONCEPTS.reduce((n, c) => n + WEIGHTS[c.weight] * GRADES.direct.rank, 0);
  const got = findings.reduce((n, f) => n + (f.proven ? WEIGHTS[f.weight] * (GRADES[f.grade]?.rank ?? 0) : 0), 0);

  const blockingGaps = findings.filter((f) => f.weight === 'blocking' && (f.grade === 'absent' || !f.proven));
  return {
    system, captures, findings,
    score: { got, max, pct: Math.round((got / max) * 100) },
    counts: {
      stated: findings.filter((f) => f.grade === 'direct' && f.proven).length,
      inferred: findings.filter((f) => f.grade === 'inferred' && f.proven).length,
      absent: findings.filter((f) => f.grade === 'absent').length,
      unproven: findings.filter((f) => !f.proven).length,
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

// SYSTEM THREE — copy this file, fill it in, add it to kernel/report.mjs.
//
// This template is the actual test of whether the domain generalises. Point a
// read-only capture pass at an unfamiliar CAFM, answer the questions in
// domain.mjs from what you captured, and run the report. Three outcomes, and
// only one of them is good news:
//
//   1. Most concepts map, evidence resolves            → the grammar holds.
//   2. Concepts map but the evidence will not resolve   → you are remembering,
//                                                         not reading.
//   3. The system has important concepts with NO slot   → the domain is too
//      here, or half of these questions are meaningless   narrow. Add them to
//      to it                                              domain.mjs and re-run
//                                                         the other systems.
//
// Outcome 3 is the interesting one and it must not be quietly smoothed over. If
// a third system needs a concept the first two never had, say so — that is the
// difference between a domain model and two case studies with a table on top.
//
// RULES FOR FILLING THIS IN
//   - `grade` is about the SYSTEM, not about how hard it was to find.
//       direct   — the system holds it as a field, a state or an event
//       inferred — derivable, but only by convention (a status that "means" it)
//       absent   — no expression. This is a legitimate answer and often the
//                  most valuable one.
//   - `where` must point at a file YOU CAPTURED. For a `direct` or `inferred`
//     claim it is the thing that proves it. For an `absent` claim it is the
//     search that came back empty — and if it comes back full, the report says
//     CONTRADICTED and you go and look again. (That has already happened once:
//     Concerto's recall was graded absent until the checker found "Recall of
//     QPIZ0019423" in a job description.)
//   - Leave a concept out entirely if nobody has looked. "Not mapped" and
//     "absent" are different findings and the report keeps them apart.
export default {
  id: 'system-three',
  name: '',
  vendor: '',
  captures: 'data/system-three-map',      // relative to the repo, or absolute
  role: '',                               // whose system, seen as whom
  access: '',                             // API? browser only? exports?

  map: {
    // job:        { grade: 'direct',   how: '', where: { glob: '*.json', find: '' } },
    // cross_key:  { grade: 'absent',   how: 'nowhere to put our reference — needs a custom field, ask the vendor',
    //               where: { glob: '*.json', find: /reference/i } },
    // client:     { grade: '', how: '', where: {} },
    // site:       { grade: '', how: '', where: {} },
    // supplier:   { grade: '', how: '', where: {} },
    // requester:  { grade: '', how: '', where: {} },
    // intake:     { grade: '', how: '', where: {} },
    // acceptance: { grade: '', how: '', where: {} },
    // priority:   { grade: '', how: '', where: {} },
    // sla:        { grade: '', how: '', where: {} },
    // eta:        { grade: '', how: '', where: {} },
    // states:     { grade: '', how: '', where: {}, states: { /* canonical: 'their word' */ } },
    // attendance: { grade: '', how: '', where: {} },
    // pause:      { grade: '', how: '', where: {} },
    // recall:     { grade: '', how: '', where: {} },
    // evidence:   { grade: '', how: '', where: {} },
    // completion: { grade: '', how: '', where: {} },
    // history:    { grade: '', how: '', where: {} },
    // actions:    { grade: '', how: '', where: {} },
    // exception:  { grade: '', how: '', where: {} },
    // money:      { grade: '', how: '', where: {} },
    // verify:     { grade: '', how: '', where: {} },
  },
};

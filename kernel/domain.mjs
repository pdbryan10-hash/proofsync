// THE DOMAIN — the operational grammar of FM work, independent of any software.
//
// These are the things an FM operation does, phrased as the questions a machine
// has to be able to answer before it may act. They are deliberately NOT phrased
// in the vocabulary of any CAFM: a system either has a way of expressing each
// one, or it does not, and that gap is the finding.
//
// The point of writing them down: given controlled access to a CAFM nobody here
// has seen, the work is no longer "map the software". It is "answer these
// twenty questions, and show where each answer came from".
//
// `weight` is what it costs to be wrong:
//   blocking  — cannot safely operate without it
//   material  — can operate, but a whole class of work is invisible
//   useful    — improves decisions

export const CONCEPTS = [
  // ── identity ───────────────────────────────────────────────────────────────
  { id: 'job', group: 'identity', weight: 'blocking',
    question: 'What is the unit of work, and what identifies it?',
    why: 'Everything else hangs off it. Without a stable identifier there is nothing to be idempotent about.' },

  { id: 'cross_key', group: 'identity', weight: 'blocking',
    question: 'Where can THIS system hold the other system’s reference for the same job?',
    why: 'A synchroniser that cannot write its own foreign key has to keep a private lookup table, and a private lookup table is a thing that goes wrong silently after a crash.' },

  { id: 'client', group: 'identity', weight: 'blocking',
    question: 'Whose job is it — which client, and is that a field or a tenancy?',
    why: 'Decides the contract, the SLA and often the entity. A build that assumes one client is a build that gets thrown away at the second one.' },

  { id: 'site', group: 'identity', weight: 'blocking',
    question: 'Where is the work, and is there a stable property identifier?',
    why: 'Site names are typed by people; a code or UPRN is what two systems can be joined on.' },

  { id: 'supplier', group: 'identity', weight: 'material',
    question: 'Who is doing the work, and how is that party reached?',
    why: 'The party a chase is sent to. If contact details are not on the record, chasing means a directory nobody maintains.' },

  { id: 'requester', group: 'identity', weight: 'material',
    question: 'Who asked for it, and who may be asked about it?',
    why: 'The difference between asking the person with the problem and asking the agent who logged it.' },

  // ── the clocks ─────────────────────────────────────────────────────────────
  { id: 'intake', group: 'clock', weight: 'blocking',
    question: 'How does a job arrive, and does the system record that it told anyone?',
    why: 'Decides whether the trigger is a poll, a webhook or a mailbox — and whether the two can be reconciled.' },

  { id: 'acceptance', group: 'clock', weight: 'blocking',
    question: 'Is acceptance a stamped event, or must it be inferred from a status?',
    why: 'Stated: you read it. Inferred: every clock built on it inherits the guess.' },

  { id: 'priority', group: 'clock', weight: 'blocking',
    question: 'How is urgency expressed — code, band, or a phrase in the client’s own words?',
    why: '“3 Working Day (excluding weekends)” is arithmetic, not a label. Counting calendar hours against it produces confident wrong answers.' },

  { id: 'sla', group: 'clock', weight: 'blocking',
    question: 'What targets exist, are they per-job, and does the system show required against actual?',
    why: 'A target the system states is a target we can be held to. A target we compute is one we can be argued out of.' },

  { id: 'eta', group: 'clock', weight: 'material',
    question: 'Is there a promised date, and can it be compared with the target?',
    why: 'A promise that already breaches the target is the cheapest exception there is, and it is visible before anybody is late.' },

  // ── the states ─────────────────────────────────────────────────────────────
  { id: 'states', group: 'state', weight: 'blocking',
    question: 'What is the state vocabulary, and how many jobs sit in each?',
    why: 'The distribution matters more than the list: a state holding a fifth of the estate is where the work is.' },

  { id: 'attendance', group: 'state', weight: 'material',
    question: 'Is "someone turned up" distinguishable from "the job is done"?',
    why: 'Two clocks, not one. Conflating them makes an attended-but-unfinished job look finished.' },

  { id: 'pause', group: 'state', weight: 'material',
    question: 'Can the system say a job is stopped and waiting on something?',
    why: 'A pause read as motion is how a job sits for nineteen days looking healthy.' },

  { id: 'recall', group: 'state', weight: 'useful',
    question: 'Can it express that work failed and came back?',
    why: 'Repeat visits are the quality signal, and they are invisible if a recall opens as a fresh job.' },

  // ── the evidence ───────────────────────────────────────────────────────────
  { id: 'evidence', group: 'evidence', weight: 'blocking',
    question: 'Where do certificates, job sheets and photographs attach?',
    why: 'The completion nobody can prove is the completion that does not get paid.' },

  { id: 'completion', group: 'evidence', weight: 'blocking',
    question: 'What closes a job, and is closing separable from evidencing?',
    why: 'If they are two actions, "done but undocumented" is a state the system can hold — and therefore one we can chase.' },

  { id: 'history', group: 'evidence', weight: 'blocking',
    question: 'Is there an attributed, timed record of what happened?',
    why: 'Read-back verification needs somewhere to read back from. No feed, no proof a write landed.' },

  // ── acting ─────────────────────────────────────────────────────────────────
  { id: 'actions', group: 'act', weight: 'blocking',
    question: 'What is the write path — the named actions that change the record?',
    why: 'The boundary of what an operator may ever do. Anything outside it is not automatable at any level of confidence.' },

  { id: 'exception', group: 'act', weight: 'material',
    question: 'How does the system express escalation, or whose court the ball is in?',
    why: 'If it is stated, we honour it. If not, we compute it — and then two parties disagree about who is waiting.' },

  { id: 'money', group: 'act', weight: 'material',
    question: 'Is there a spend limit, and a route for quotes and uplifts?',
    why: 'The commonest reason a job stops is money, and it is a different workflow from the work.' },

  { id: 'verify', group: 'act', weight: 'blocking',
    question: 'After a write, can the record be re-read to prove it landed?',
    why: 'Everything else is a claim. This is the difference between an operator and an optimist.' },
];

/** The canonical states. A system maps into these; it does not define them. */
export const STATES = [
  'AWAITING_TRIAGE', 'SCHEDULED', 'AWAITING_CONTRACTOR', 'IN_PROGRESS',
  'ATTENDED', 'PAUSED', 'AWAITING_EVIDENCE', 'COMPLETED', 'CANCELLED', 'OVERDUE',
];

/** How well a system expresses a concept. Grading is the whole product. */
export const GRADES = {
  direct: { rank: 3, label: 'stated', note: 'the system holds this as a field, state or event' },
  inferred: { rank: 2, label: 'inferred', note: 'derivable, but from something that means it only by convention' },
  absent: { rank: 0, label: 'absent', note: 'no expression found — the gap is the finding' },
};

export const WEIGHTS = { blocking: 3, material: 2, useful: 1 };

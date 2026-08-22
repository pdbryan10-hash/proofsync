// CONCERTO (Bellrock) — the supplier portal, expressed in kernel terms.
//
// Every line points at a file captured read-only on 21 August 2026. Nothing here
// is from memory: if a claim's evidence does not resolve, the report says so.
export default {
  id: 'concerto',
  name: 'Concerto — Bellrock supplier portal',
  vendor: 'Bellrock',
  captures: 'data/concerto-map',
  role: 'the client’s CAFM, seen through a supplier login',
  access: 'browser only. No API seen from the supplier side.',

  // Only what the survey captured — not the map or the report we generated.
  only: ['tour-*.json', 'screen-*.json', 'order-*.json', 'nav.json'],

  map: {
    job: { grade: 'direct', field: 'Order number', how: '`Order number`, e.g. RDDC0024267/2 — order/revision. Rows are `tr[role="link"]`, opened with Enter; the record replaces the grid at the same URL.',
      where: { glob: 'tour-*-an-order.json', find: 'Order number' } },

    cross_key: { grade: 'direct', field: 'Supplier\'s ref', how: '**`Supplier’s ref`** — a grid column AND a search field. The other system’s job number goes here and the order is found again by searching it.',
      where: { glob: 'screen-supplier-portal.json', find: /supplier.{0,3}s ref/i } },

    client: { grade: 'direct', field: 'Client workspace (pbl_form_dba_portfolioid)', how: 'A tenancy, not a field: `pbl_form_dba_portfolioid` — the Client workspace selector — holding 19 clients behind the one login.',
      where: { glob: '*.json', find: 'pbl_form_dba_portfolioid' } },

    site: { grade: 'direct', field: 'Location of work · UPRN (PPM review)', how: '`Location of work` on the order; **UPRN** on the PPM certificate review screen, which is a property identifier rather than a typed name. Sites also carry codes (`ABZ050`).',
      where: { glob: '*.json', find: 'UPRN' } },

    supplier: { grade: 'direct', field: 'the login itself · Operative(s)', how: 'The login is the supplier: SEE Services Ltd plus three trading entities. Operative(s) names the engineer on the grid.',
      where: { glob: '*.json', find: 'SOUTH EASTERN SERVICES' } },

    requester: { grade: 'direct', field: 'Originator (email + mobile)', how: '`Originator` with an email and a mobile, on the order itself.',
      where: { glob: 'tour-*.json', find: 'Originator' } },

    intake: { grade: 'direct', field: 'order emailed to the helpdesk mailbox, logged in the feed', how: 'Concerto **emails the order** to the supplier helpdesk mailbox and records in the feed that it did, against a helpdesk reference. Intake can be driven from the mailbox or the portal and the two reconcile.',
      where: { glob: 'tour-*.json', find: /emailed to/i } },

    acceptance: { grade: 'direct', field: 'Date acknowledged · feed: Accept within SLA', how: 'A stamped, named event — `Accept within SLA` in the feed — plus `Date acknowledged` on the record.',
      where: { glob: 'tour-*.json', find: /accept within sla/i } },

    priority: { grade: 'direct', field: 'Priority of response (a phrase: 3 Working Day)', how: '`Priority of response` as a phrase in the client’s own words — “3 Working Day (excluding weekends)”, “4 Hour”. Working-day arithmetic, not hours.',
      where: { glob: 'tour-*.json', find: /working day \(excluding weekends\)/i } },

    sla: { grade: 'direct', field: 'Response time required · Completion time required (+ actual)', how: '`Response time required` and `Completion time required`, each shown beside its **actual** on the grid and coloured when missed.',
      where: { glob: 'tour-*.json', find: 'Completion time required' } },

    eta: { grade: 'direct', field: 'Appointments · action: Add Appointment', how: '`Appointments` on the order, and an `Add Appointment` action. The grid filters on with/without appointment.',
      where: { glob: '*.json', find: 'pbl_form_dba_appoint' } },

    states: { grade: 'direct', field: 'Status of work order', how: 'Filterable: Attended · In progress · **Parts On Order** · Work complete. Plus dashboard tiles for Awaiting Acceptance, Breaching SLA, Overdue, Requiring Action to Complete, Awaiting Certificate, Passed Back to Supplier.',
      where: { glob: '*.json', find: 'pbl_form_dba_status' },
      states: { ATTENDED: 'Attended', IN_PROGRESS: 'In progress', PAUSED: 'Parts On Order', COMPLETED: 'Work complete', AWAITING_EVIDENCE: 'Awaiting Certificate (tile)', AWAITING_CONTRACTOR: 'Awaiting Acceptance (tile)' } },

    attendance: { grade: 'direct', field: 'action: Mark job as attended · status: Attended', how: '`Mark job as attended` is its own action, and Attended is its own status — separable from completion.',
      where: { glob: 'tour-*.json', find: 'Mark job as attended' } },

    pause: { grade: 'direct', field: 'status + action: Parts On Order', how: '**`Parts On Order`** is a first-class action and a filterable status. The supplier states the pause; the client sees it.',
      where: { glob: 'tour-*.json', find: 'Parts On Order' } },

    recall: { grade: 'inferred', field: 'free text in the description: \'Recall of <ref>\'', how: 'Only as a convention in free text — “**Recall of QPIZ0019423** Eng. left x3 tiles broken at Kitchen followed by the last visit on 7/8”. The repeat visit is stated by whoever typed the description, not linked to the original order. Graded absent until the checker found it.',
      where: { glob: '*.json', find: /recall of/i } },

    evidence: { grade: 'direct', field: 'action: Add Note/Document/Photo · Permits tab', how: '`Add Note/Document/Photo`, and a **Permits** tab carrying `Request a permit`. PPM certificates have their own review screen.',
      where: { glob: 'tour-*.json', find: 'Add Note/Document/Photo' } },

    completion: { grade: 'direct', field: 'action: Work complete', how: '`Work complete` — and it is **separate** from `Add Note/Document/Photo`, so “done but undocumented” is a state the system can express.',
      where: { glob: 'tour-*.json', find: 'Work complete' } },

    history: { grade: 'direct', field: 'Notes and Activities feed', how: 'The **Notes and Activities** feed: every entry attributed and timed to the second — order added, order emailed, accepted.',
      where: { glob: 'tour-*.json', find: /posted by/i } },

    actions: { grade: 'direct', field: 'ACTIONS menu — ten named actions', how: 'Ten named actions under `#dropdownMenuButton`. Note the same id sits on the list, so its presence does not prove you are on a record.',
      where: { glob: 'tour-*.json', find: 'Assign operative (with appointment)' } },

    exception: { grade: 'inferred', field: 'Currently with (cost referral only)', how: '**Cost referral** states `Currently with` — whose court the ball is in — but that is the money workflow. No general escalation field seen on an order.',
      where: { glob: '*.json', find: /currently with/i } },

    money: { grade: 'direct', field: 'Mandate (NTE) · Quote required · Cost uplift required', how: '`Mandate` is the spend limit (NTE) on the grid; `Quote required` and `Cost uplift required` are actions; Quotes has its own screen, 103 awaiting.',
      where: { glob: '*.json', find: /mandate/i } },

    verify: { grade: 'direct', field: 're-read the feed entry', how: 'The feed is the read-back: an action lands as an attributed, timed entry that can be re-read and matched.',
      where: { glob: 'tour-*.json', find: /accept within sla/i } },
  },
};

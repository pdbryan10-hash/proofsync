// VX SUITE (Accruent / Verisae) — expressed in the same kernel terms.
//
// The captures live in the other repo, so the root is configurable:
//   VX_CAPTURES=C:/dev/sites/mml-portal/data node kernel/report.mjs
// If they are not there, every VX claim reports UNPROVEN rather than passing on
// the strength of having once been true.
export default {
  id: 'vx',
  name: 'VX Suite',
  vendor: 'Accruent / Verisae',
  captures: process.env.VX_CAPTURES || 'C:/dev/sites/mml-portal/data',
  role: 'the managing agent’s CAFM, seen as the agent',
  access: 'browser (server-rendered Struts) plus CSV/Cognos exports. No usable API seen.',

  map: {
    job: { grade: 'direct', how: '`WO #` — the work order number, on every export and every screen.',
      where: { glob: 'exports/*.csv', find: 'WO #' } },

    cross_key: { grade: 'direct', how: '`Contractor Reference No.` on the export, and **Set Provider Reference Number** as an action — the mirror image of Concerto’s `Supplier’s ref`. Each system has a slot for the other’s key.',
      where: { glob: 'exports/*.csv', find: 'Contractor Reference No.' } },

    client: { grade: 'direct', how: '`Client` and `Parent Organisation` columns — a field, not a tenancy. One login sees several.',
      where: { glob: 'exports/OutstandingWorkOrders.csv', find: 'Parent Organisation' } },

    site: { grade: 'direct', how: '`Site No.`, `Site Name` and `Site Type` — a site number, so joinable rather than typed.',
      where: { glob: 'exports/*.csv', find: 'Site No.' } },

    supplier: { grade: 'direct', how: '`Contractor` on the job; contact details harvested from the contractor screens into a contact book.',
      where: { glob: 'vx-contractors/*.json', find: /contact|phone|email/i } },

    requester: { grade: 'direct', how: '`Created By`, `Created By Role` and `Reported By` — which is how an operator knows whether it is asking the person with the problem or the agent who logged it.',
      where: { glob: 'exports/*.csv', find: 'Created By Role' } },

    intake: { grade: 'inferred', how: 'No arrival event. Jobs are discovered by polling the outstanding list or an export; nothing states that anyone was told.',
      where: { glob: 'exports/OutstandingWorkOrders.csv', find: 'Date/Time Created' } },

    acceptance: { grade: 'inferred', how: 'No acceptance event. `Pend. Accept` is a status and `Date Assigned` a timestamp, so acceptance has to be reconstructed from the pair.',
      where: { glob: 'exports/AllWorkOrders.csv', find: 'Date Assigned' } },

    priority: { grade: 'direct', how: 'Banded codes — `P2 - 4 hours`, `P5 - 7 days`, plus quote bands. Hours, not working days.',
      where: { glob: 'exports/*.csv', find: 'Priority' } },

    sla: { grade: 'direct', how: 'Three per-job targets, stated in HOURS on the export — `Accept SLA (Hours)`, `Response SLA (Hours)`, `Fix SLA (Hours)` — with 8760 meaning “no target”. Calendar hours, so no working-day arithmetic.',
      where: { glob: 'exports/*.csv', find: /accept sla|response sla|fix sla/i } },

    eta: { grade: 'direct', how: '`ETA` on the export and an `Update ETA` action, so a promise can be compared with the target — 462 of 972 ETAs landed beyond the response target.',
      where: { glob: 'vx-map/screen-action-update-eta.json', find: /eta/i } },

    states: { grade: 'direct', how: 'A long vocabulary — Assigned · Pend. Accept · Pend. · In Progress · Service Incomplete · No Contractor · Alternate Contractor · Pend Prov Notif — mapped into the canonical set by the importer.',
      where: { glob: 'vx-map/screen-action-list.json', find: 'Service Incomplete' },
      states: { AWAITING_CONTRACTOR: 'Assigned / Pend. Accept', AWAITING_TRIAGE: 'Pend.', IN_PROGRESS: 'In Progress', PAUSED: 'Service Incomplete (by inference)', COMPLETED: 'Service Complete / invoiced', CANCELLED: 'Cancelled / EOL' } },

    attendance: { grade: 'absent', how: 'No attendance state distinct from progress. An engineer having turned up is not separately expressible.',
      where: { glob: 'vx-map/*.json', find: /attended/i } },

    pause: { grade: 'inferred', how: '`Service Incomplete` means stopped — parts on order, or the engineer left — but only by convention. It held 113 of the open jobs, and reading it as motion made a de-stocked fridge look like a job under way.',
      where: { glob: 'exports/*.csv', find: 'Service Incomplete' } },

    recall: { grade: 'inferred', how: 'Recalls appear in the alarm/tag vocabulary (`Recalled`) rather than as a link between jobs.',
      where: { glob: 'exports/*.csv', find: /recalled/i } },

    evidence: { grade: 'absent', how: 'No attachment action seen on the work order. Notes are text. Photographs are asked for **by email** in the call script — “upload a photo or email one to the helpdesk quoting the work order number”.',
      where: { glob: 'vx-map/*.json', find: /attach|upload/i } },

    completion: { grade: 'direct', how: '`Job Complete` is an action on the work order, and completion states carry through to invoicing.',
      where: { glob: 'vx-map/*.json', find: 'Job_Complete' } },

    history: { grade: 'direct', how: 'Notes on the record via `Log Note`, timed and attributed — which is what read-back verification reads.',
      where: { glob: 'vx-map/screen-action-log-note.json', find: /log.?note/i } },

    actions: { grade: 'direct', how: 'A long action list on the work order, revealed as hidden panels rather than screens — Log Note, Update ETA, Tags, escalation, NTE, Job Complete and more.',
      where: { glob: 'vx-map/screen-action-list.json', find: /action/i } },

    exception: { grade: 'direct', how: 'First and second level escalation are **stated** — escalated by, type and comment — which is more than Concerto offers on an order.',
      where: { glob: 'exports/OutstandingWorkOrders.csv', find: '1st Level Escalation Type' } },

    money: { grade: 'direct', how: '`NTE` on the export with an `Update NTE Values` action; quote work orders are a separate WO Type (312 of 1,137).',
      where: { glob: 'vx-map/screen-action-update-nte-values.json', find: /nte/i } },

    verify: { grade: 'direct', how: 'A note written to the record can be re-read from the record — the basis of the write ledger’s INTENDED → SUBMITTED → CONFIRMED.',
      where: { glob: 'vx-map/screen-action-log-note.json', find: /comments|note/i } },
  },
};

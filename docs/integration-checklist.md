# Live Integration Checklist

Everything required from the **contractor** and the **client (CAFM owner)** before
ProofSync can move from `INTEGRATION_MODE=mock` to `live`. Until each item is
confirmed, the corresponding `TODO(joblogic)` / `TODO(concerto)` in
`lib/integrations/*/live.ts` must remain unimplemented — **do not invent endpoints.**

---

## A. Joblogic (source system) — from the contractor

- [ ] **API credentials** — API key / OAuth client for the contractor's Joblogic account.
- [ ] **Tenant / account details** — tenant id and the correct base URL/region.
- [ ] **Authentication method** — API key header vs Bearer vs OAuth2
      client-credentials (and token endpoint if OAuth).
- [ ] **Completion event / webhook capability** — does Joblogic emit a
      job-completed webhook? Payload shape, event id field, signing scheme and
      signature header name (for `verifyWebhookSignature`). If no webhook, confirm a
      polling endpoint for "jobs completed since <timestamp>".
- [ ] **Job endpoint** — retrieve a single job and its core fields.
- [ ] **Completion endpoint** — retrieve completion data (arrival/departure, time on
      site, work completed, notes, costs, follow-on, completion date) and the exact
      field names.
- [ ] **Document retrieval endpoint** — list a job's documents and download bytes;
      document type taxonomy; size limits.
- [ ] **★ Concerto-reference source field** — the single most important item:
      which Joblogic field holds the Concerto job reference (custom field? PO/
      customer reference?). This is the cross-system matching key.
- [ ] **Sample anonymised payloads** — one job + one completion + one document list.
- [ ] **Rate limits** — requests/minute and burst behaviour.

## B. Concerto (target system) — from the client

- [ ] **API access approval** — written approval from the client to integrate.
- [ ] **API documentation** — official reference for the client's Concerto env.
- [ ] **Authentication method** — almost certainly OAuth2 client-credentials
      (`CONCERTO_CLIENT_ID` / `CONCERTO_CLIENT_SECRET` → token); confirm token URL.
- [ ] **Environment / base URL** — production and a **test/sandbox** environment.
- [ ] **Job lookup endpoint** — find a job by its **unique reference** field; confirm
      that field's name and uniqueness guarantee.
- [ ] **Permitted update endpoint(s)** — method (PATCH/PUT) and the exact target
      field names that may be written (map to `contractorCompletionNotes`,
      `actualLabourDuration`, `actualCompletionDate`, `workCompletionDescription`,
      `contractorCost`, `followOnRequired`, …).
- [ ] **Field schema & types** — value formats (dates, durations, currency).
- [ ] **Status transition rules** — allowed status values and legal transitions;
      whether the integration may move status / close jobs.
- [ ] **Document upload endpoint** — multipart format, allowed types, size limits.
- [ ] **Verification read** — endpoint to re-read a job to confirm an update applied.
- [ ] **Service account permissions** — the integration account's scope.
- [ ] **Sample anonymised job payload** and **rate limits**.

## C. Business mapping workshop — contractor + client

Confirm and record decisions for each client:

- [ ] The **authoritative Concerto reference field** in Joblogic.
- [ ] **Source ↔ target status mapping** (Joblogic statuses → Concerto statuses).
- [ ] Which **fields may be updated** and which must **never be overwritten**.
- [ ] Which **document categories** transfer (e.g. certificates, service reports,
      completion sheets) and which do not (internal notes, commercial docs).
- [ ] Whether **costs** transfer (default: off).
- [ ] **Who may close** a Concerto job, and whether manual approval is required
      before close (`requireApprovalBeforeClose`).
- [ ] **Exception ownership** — who monitors and resolves the Exceptions queue.
- [ ] **Audit retention** requirements.

## D. Wiring it up

1. Populate the `.env` values in §A/§B (server-only; never `NEXT_PUBLIC_*`).
2. Implement each `TODO(joblogic)` / `TODO(concerto)` in `live.ts` against the
   confirmed endpoints. Keep all provider specifics inside the connector.
3. Update `CONCERTO_REFERENCE_REGEX` in `lib/domain/validation.ts` if the real
   reference format differs.
4. Update the seeded/managed `FieldMapping` rows to the confirmed target field names.
5. Set `INTEGRATION_MODE=live`, run **Test Connection** for both providers, and
   verify one job end-to-end in the Concerto **test** environment before production.

---

## E. The UI route — when there is no API (the VX Maintain method)

Sections A–B assume the client will grant API access. Often they will not, or the
system has no usable API at all. The proven alternative is the one used for Terri
on VX Maintain (formerly Verisae): **operate the system through its own interface,
signed in as a licensed user, with the contractor's own account.**

This is a different set of prerequisites, and it is deliberately staged so that
nothing writes until reading has been proven.

### E1. Access — what to ask the contractor for

- [ ] **An email account on the contractor's domain** for the ProofSync operator.
      It must be theirs, not ours: the account acts as one of their users and must
      be visible in their own directory and revocable by them.
- [ ] **A named user login to the contractor's own system** (Joblogic).
- [ ] **A named user login to the client's system** (Concerto) — the contractor
      already holds one; this is the same access their coordinator uses, not a new
      grant from the client.
- [ ] **MFA method confirmed** for both, and who holds the second factor.
- [ ] **Written confirmation from the contractor** that using their account in this
      way is authorised, and by whom.

### E2. Read-only first — non-negotiable

- [ ] Both logins start **read-only**. Where the platform supports a role with no
      write permission, use it; where it does not, the operator runs with writes
      disabled in configuration and that is verified before credentials are loaded.
- [ ] Prove access by **reading** only: sign in, find a known job by reference,
      read its fields back. No note, no status change, no upload.
- [ ] Only after read access is proven and the mapping is agreed does any write
      capability get enabled, and then against a test job first.

### E3. Screen and field mapping — the asset

The equivalent of the VX field map. This is the per-system knowledge that makes the
route work, and it does not exist in any documentation — it is produced by driving
the system and recording what is there.

- [ ] **Login flow**, including MFA prompt and any interstitials.
- [ ] **Job lookup** — the screen and control that finds a job by its unique
      reference, and what a no-match and a multi-match look like.
- [ ] **Fields to read** on the job record, with their on-screen labels and
      underlying element identifiers.
- [ ] **Fields to write** for a completion — notes, attendance times, time on site,
      costs, follow-on flag, completion date — same detail.
- [ ] **The completion form itself**: which controls, in what order, what is
      mandatory, what validation fires and what its messages say.
- [ ] **Document upload**: control, accepted types, size limits.
- [ ] **The read-back view** used to verify a write landed — this is what
      `verifyUpdate` compares against.
- [ ] **Terminating conditions**: the states in which the operator must stop and
      hand to a person rather than proceed.

### E4. What must stay true

- [ ] Attended by default: a person signs in each day, with MFA, and starts the run.
      This is not bypassed — see `docs/AUTH.md`.
- [ ] Every write is still read back and compared. The verification requirement does
      not relax because the transport changed.
- [ ] No reference, or an ambiguous match, still raises an exception rather than
      guessing.

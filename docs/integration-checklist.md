# Live Integration Checklist

Everything required from **SEE Services** and the **client (Concerto owner)** before
SEE CAFM Sync can move from `INTEGRATION_MODE=mock` to `live`. Until each item is
confirmed, the corresponding `TODO(joblogic)` / `TODO(concerto)` in
`lib/integrations/*/live.ts` must remain unimplemented — **do not invent endpoints.**

---

## A. Joblogic (source system) — from SEE

- [ ] **API credentials** — API key / OAuth client for SEE's Joblogic account.
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

## C. Business mapping workshop — SEE + client

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

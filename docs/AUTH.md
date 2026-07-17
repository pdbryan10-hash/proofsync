# How ProofSync signs in

The systems ProofSync integrates with often have no API. The only way in is the
one a person has: a login. This is how ProofSync gets through it — legally,
safely, and without needing the client's IT department to agree to anything.

## The rule that keeps this a business and not a breach

**ProofSync never bypasses a security control.** The moment it defeats an MFA
prompt the client didn't knowingly provision for, it is unauthorised access —
Computer Misuse Act in the UK, CFAA in the US — the professional-indemnity cover
lapses, and a client's security team is right to treat it as an intruder,
because it would be indistinguishable from one.

So the question is never "how do we get around MFA." It is "how do we become an
authorised party the login already lets in." There are two answers, and the
first is the default.

## Mode 1 — Attended (the default; works everywhere, needs nobody's permission)

The human authenticates. ProofSync automates the work inside their live session.

1. Each morning the contractor's admin opens ProofSync and clicks **Start
   session**.
2. ProofSync opens its own browser at the source system's login. The admin types
   **their own** username, password and MFA code into that window.
3. Same for the target system.
4. The admin clicks **Go** and walks away. ProofSync reads, matches, transforms,
   types and verifies inside those two authenticated sessions until the day's
   work is done, then leaves an exceptions list.

Why this is the cleanest option there is:

- **No credential is ever stored.** ProofSync never sees the password. Nothing to
  leak, nothing to insure, nothing in the database.
- **MFA is satisfied, not bypassed.** A real person completed it. There is no
  control being defeated, so the whole unauthorised-access question disappears.
- **No client IT involvement.** The contractor's admin already has a login. You
  launch day one with zero dependency on the client's security team — which is
  the entire reason this problem has never been solved: fixing it "properly"
  needed the client's cooperation, and this needs nobody's.

The cost, stated plainly:

- **It is attended, not unattended.** Someone logs in daily and presses go.
  Market it as *assisted* or *supervised* — **never imply it runs without them**
  on a hard-MFA client. Overclaiming unattended is the kind of gap that surfaces
  badly in a procurement questionnaire. For FM completions a daily batch is fine:
  the admin who spent hours re-keying now spends thirty seconds logging in.
- **The session must survive the batch.** Most last a working day. Some idle-time
  out in 15–30 minutes; a few bind the session to the originating browser/IP. If
  a session dies mid-batch ProofSync must stop cleanly and ask for a fresh login,
  never thrash.

## Mode 2 — Unattended (the upsell; needs the client to provision)

For clients who want overnight, hands-off runs and will set it up. In order of
preference:

1. **Dedicated service account, MFA-exempted.** The client creates a restricted
   "ProofSync Integration" user, scoped to this contractor's work orders, and
   exempts that one account from interactive MFA. Ordinary — orgs already do this
   for their own automation. MFA exists to stop humans being phished, not to gate
   a machine account the org deliberately created and can switch off.
2. **Conditional access / IP allowlist.** MFA required except from ProofSync's
   fixed egress IP. Two clicks in Entra. Often *more* defensible in the client's
   audit than a blanket exemption, because the account can only sign in from you.
3. **Issued TOTP seed.** If MFA can't be waived, the client provisions the
   account's authenticator and hands you the seed knowingly. Generate the code
   server-side and type it like a person would. Clean because the client issued
   it — identical to installing Authenticator on a shared ops phone. Store the
   seed in a secrets manager, **never** the database.

Every one of these is the client **knowingly provisioning access for a named
machine identity they control and can revoke**: written authorisation, dedicated
account, least privilege, fixed origin, an audit trail showing exactly what the
account did. That is what your PI insurer and their security team both need to
see. Feeding a real employee's personal credentials and catching their MFA push
is the version that gets you sued and locked out mid-contract — same code,
completely different legal object. Never build it, and don't let a customer talk
you into it "just to get started."

## The ladder, and where MFA sits on it

Preferred access, best to worst: **API → SFTP/CSV/email import → portal bulk
upload → internal JSON endpoints → screen automation**. MFA is only a wall on the
bottom rung. You take that rung only when a vendor leaves you nowhere else —
and even then, Mode 1 clears it without anyone's permission.

## What this means for the architecture

- **Attended is the default sell; unattended is a per-pairing upgrade** — which
  maps onto Run pricing: unattended is a higher tier because it is worth more and
  costs a provisioning conversation.
- **The browser doing the work must be the one the human authenticated in.** The
  session lives in that browser context; the automation rides it. This is the
  same Playwright browser the demo's `browser` transport already drives — the
  only change from the demo is that a human types the real login and MFA instead
  of ProofSync auto-filling seeded credentials.
- **A stable, owned run environment is required** (a box or a static-IP worker),
  because Mode 2 options 2–3 key on a fixed origin, and because headed browser
  automation cannot run on Vercel anyway. See [DEMO.md](./DEMO.md).

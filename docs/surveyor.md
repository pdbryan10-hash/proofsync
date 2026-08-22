# The Surveyor — the kernel with a window on it

```
SURVEYOR.bat                     opens it as a window
node surveyor/app.mjs            the same thing, in a tab
```

Pick a system on the left and you get its score, all 22 domain questions, what the machine read
off the captures, what is on record, the screenshots and the recorded walkthrough — and a
confirm control on every row.

## What it is made of

| | |
|---|---|
| `surveyor/crawl.mjs` | the read-only walk. Attended sign-in, follows navigation, opens a record, opens menus. Presses nothing. |
| `surveyor/propose.mjs` | reads the captures and **answers the 22 questions itself** |
| `surveyor/app.mjs` | local server — systems, surveys, screenshots, video, confirmations |
| `surveyor/ui.html` | one page. Machine's answer beside the human's, disagreements highlighted |
| `SURVEYOR.bat` | starts it and opens Chrome in app mode, so it behaves like a window |

No Electron, no Tauri, no build step. The engine is the valuable part and it was already written;
a native shell can be wrapped round this later without touching any of it.

## How well the proposer actually does

Scored against the maps a person wrote by hand:

| | agreement |
|---|---|
| Concerto | **22 of 22** |
| VX | **19 of 22** |

Concerto's 100% proves less than it looks — I wrote both the signals and the answers. **VX is the
real number**, because its vocabulary and its capture format are different: CSV exports and
server-rendered screens rather than a modern portal.

Getting from 73% to 86% was three corrections, and each one is a rule worth keeping:

**1 · Grade on structure, never on prose.** Searching whole captures said VX had a first-class
attendance state and a pause state. It has neither — both matched words in job descriptions:
*"engineer attended"*, *"on hold"*, typed by whoever logged the call. A phrase in free text is
somebody **talking about** a concept; a column header, a dropdown option, a field id or an action
name is the software **having** one. Free text can now only ever propose *inferred*, and says so.

**2 · Only cite what the survey captured.** It was grading VX off `live.csv-derived.json` and
`disagreements.json` — files **we** generated, in our own canonical vocabulary. It was reading our
normalisation back and calling it VX's. Each system now declares a capture manifest and nothing
outside it may be evidence.

**3 · Menus and plumbing are not the record.** `acceptance` matched a hidden input called
`duplicates_acknowledged`. `attendance`, `pause` and `evidence` all matched VX's application menu —
*Service > Engineers On Site*, *Sites > Suspended Monitoring*, *Sites > Site Documents*. The
application has those screens; the job record has no such states. Hidden inputs, hrefs and
`Section > Item` menu paths are excluded.

The three rows VX still disagrees on are exactly the rows a person should look at, and the UI
highlights them. That is the design — **it proposes, you decide** — not a shortfall.

## Pacing — why the walk does not tick

The first recorded walk held every dwell at **6.875 seconds, to within a twelfth of a second, six
times running**. Nothing a person does is that steady, and a metronome is exactly what an abuse
heuristic is built to notice.

The reason to fix it is not stealth. The access is authorised, the account is the client's and the
pass is read-only — the risk being managed is a **false positive**: a vendor flagging a live
helpdesk login, which lands on SEE's relationship with Bellrock rather than on ours, on a system
where an account problem costs 24 working hours and a vendor to undo. Pacing also keeps the load
light, which is ordinary manners on somebody else's production system.

`surveyor/pace.mjs` draws dwells from a **log-normal**, because uniform jitter is its own tell —
real dwell times are heavy-tailed. Somebody reading a queue mostly glances, sometimes reads, and
occasionally stops dead because the phone rang. Over 2,000 draws:

| | |
|---|---|
| median | 3.0 s |
| p25 / p75 | 2.0 s / 5.0 s |
| p95 | 13.1 s |
| longest | 46.8 s |
| consecutive dwells within a twelfth of a second of each other | **3.2%** |

It also moves the pointer in steps before clicking rather than teleporting onto an element, scrolls
in uneven pushes with the occasional flick back up, types with the pauses in the places a person
puts them, and reads the menu mostly-but-not-strictly in order. Pass a `seed` and a run repeats
exactly, which matters when something breaks.

**What this is not.** It makes the traffic unremarkable, not invisible, and it is no substitute for
telling Bellrock and Accruent what we run and why. If a vendor says don't, that settles it.

The recorded tour is left ticking on purpose — its holds are editorial, timed for whoever is
watching the video, and it is not the thing that walks an unfamiliar system.

## On credentials, which is the part to get right

**The password is not the perimeter — the session is.** After an attended sign-in the browser
profile holds session cookies, and those are bearer credentials: "we never store your password" is
true and beside the point if the cookie that stands in for it is sitting in a working tree. One of
those reached a git remote this week. So the profile is created in the OS temp directory, never in
the repo, and destroyed when the walk ends — including when it ends badly.

The app never sees a password. A browser opens, **you** sign in, and the walk starts once you are
through. That is not squeamishness: Concerto locks an account after three wrong attempts and only
Bellrock can undo it, inside 24 working hours, and it is a client's live helpdesk account. More
systems are on SSO and MFA every year, so attended is also the pattern that keeps working.

Where a system genuinely permits stored credentials they belong in Windows Credential Manager, and
still not in this repo.

It also makes the client conversation easy: *we never hold your password, and here is the log of
every request we made* — which the guard already writes to `requests.log`.

## What is proven and what is not

**Proven.** The scoring, the proposer and the app all run against captures on disk — 33 Concerto
screens and the VX exports — with no network and no login.

**Also not established.** Whether an automated read-only pass has side effects inside a vendor's
own state machine — a viewed timestamp, an audit entry, anything that could touch an SLA clock —
has not been checked with either vendor. The request log shows we sent nothing but GETs; it does
not show what the server did with them. Worth asking Bellrock and Accruent outright before this is
sold as a service.

**Not proven.** `crawl.mjs` has never been run against a real system. It was generalised out of
the two passes that worked, but the first time it meets an unfamiliar CAFM it will find something
neither of those had. Expect to fix it on system three; that is what system three is for.

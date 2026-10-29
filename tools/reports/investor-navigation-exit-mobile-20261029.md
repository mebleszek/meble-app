# INWESTOR / Wyjdź / mobile navigation — 29.10.2026

BASE: `0a9522cf9277ef3de03d328a84dd9569a1958e46` (wydany PR #85).
Branch: `fix/investor-navigation-exit-mobile-20261029`.
One implementation commit; exact resulting HEAD is reported with the push.
Main and open PRs were checked read-only before implementation. Only unrelated
historical documentation PR #41 was open. No conflicting worktree or edits.
AGENTS §§3, 10–14, CURRENT_STATE, ROADMAP, TEST_BASELINE and the existing
session/navigation/Auth contracts were read. No new release authorization is
inferred from implementation approval; the explicit release STOP remains.

## Implemented behavior and causes

- Moved the existing Pomieszczenia block immediately under Inwestor, before
  Typ/Data dodania. Same room/status markup, IDs, classes, actions and disabled
  editing state; no new selection screen, room storage or migration.
- WYWIAD/MATERIAŁ/RYSUNEK/CZYNNOŚCI without a room redirect to INWESTOR when an
  investor exists; otherwise to the existing investor list. A one-shot hint
  says “Wybierz pomieszczenie lub dodaj nowe.” Existing room buttons, or Add
  for a genuinely roomless investor, receive three 450 ms subtle pulses.
  Reduced-motion uses a static outline. Nothing intercepts input or restarts
  the cue on ordinary render/INWESTOR visits. Form-edit navigation lock remains.
- Kept compatibility openRooms/showRooms and the hidden roomsView scaffolding
  for internal/legacy consumers, while both normal routing and bootstrap
  fallback now show INWESTOR/list instead. WYCENA and ROZRYS keep their separate
  roomless project-scope paths; MAGAZYN, scope pickers and calculations unchanged.
  Selecting a room retains it across the four tabs. Investor activation clears
  roomType/lastRoomType/selectedCabinetId so another owner cannot inherit it.
- The former clean session-cancel path could cancel a clean session and go to
  rooms, or openHome when no session remained. Clean project Exit now uses the
  existing requestTransition contract and investor list regardless of tab.
  Active clean sessions must pass retry/baseline evidence, commit, durable
  marker absence and central reload before the destination. Dirty Anuluj keeps
  its original confirmation, scoped rollback and same-room reopening. No
  save/discard is selected automatically. Removed the redundant legacy reload
  after successful cancellation; failure still retains context and errors.
- A controlled reproduction with **actual patchInvestorsAPI enabled** proved
  that high-level setCurrentId(null) would save the old clean project again.
  List entry now clears only the context pointer through the existing guarded
  investorsLocalRepository after approved closure, checks read-back and clears
  reload-restore navigation metadata. No project contents are reset/saved by
  this operation. The repository still enforces canSwitchInvestor; no direct
  localStorage bypass or new persistence implementation was added. Failed
  pointer clearance leaves the view and displays the existing infoBox.
- bindings lacked global compatibility-click suppression for session-cancel.
  It now consumes exactly that one click after Exit, including retargeting onto
  main-signout. A pointer gesture that starts on an action and ends on another
  is refused. A fresh pointerdown resets the guard; deliberate Wyloguj works.
  Actual main/Auth/bindings regressions prove this without changing main-login
  or weakening the access gate. The precise physical Android failure sequence
  was not captured; on-device confirmation remains required.
- The black row contains only the real checkbox labelled “Zaufany” and
  “Wyloguj”, nowrap. Warning/consent information remains in the accessible
  checkbox description and existing title; success/error aria-live status is
  outside that row. No new buttons or PIN. Trusted enrollment, five-minute
  temporary lock, offline proof and manual logout semantics remain unchanged.

## Changed files

Public: `index.html`, `css/investor-layout.css`,
`js/app/investor/investor-ui-render.js`, `js/app/investor/investor-ui.js`,
`js/app/ui/tab-navigation.js`, `js/app/ui/views.js`,
`js/app/ui/actions-register.js`, `js/app/ui/bindings.js`,
`js/app/bootstrap/app-ui-bootstrap.js`, and regenerated `offline-assets.js`.

Tests: `tools/investor-navigation-exit-smoke.js` (new),
`tools/helpers/investor-navigation-browser.js` (new),
`tools/trusted-session-browser-smoke.js`, `tools/trusted-main-login-smoke.js`,
`tools/room-navigation-view-refresh-smoke.js`,
`tools/project-session-cancel-failure-safety-smoke.js`,
`tools/project-context-mobile-browser.js`.

Documentation: CURRENT_STATE.md, ROADMAP.md, TEST_BASELINE.md, this report.
No workflow, AGENTS, model, calculator, Rules, CLOUD operator/pins, Auth entry,
LOCAL-FIRST, IndexedDB/outbox implementation or company data changes.

## Existing test audit and actual CI coverage

Searched tools, dev_tests.html and js/testing for roomsView, openRooms,
session-cancel, openHome, back-rooms and roomType. Navigation expectations were
separated from storage/owner/Auth safety. Hidden roomsView fixture scaffolding,
home startup recovery, roomless WYCENA scope, ROZRYS room pickers and internal
room IDs remain valid; they do not expect Exit to the obsolete room screen.

| Test / area | Action and reason | Mandatory execution |
| --- | --- | --- |
| investor-navigation-exit-smoke | Added 12 groups: redirects/Add/rooms, ownerless list, room retained, eight clean exits, cleanup/read/pointer failure, dirty Cancel, form lock, project-wide tabs, owner change and exact protected RAW | Existing Preflight `*-smoke.js` discovery |
| trusted-session-browser-smoke + new helper | Added actual touch workflow after cold trusted boot with origin stopped/CDP offline; 393/320 px topbar, Add/room cue, four tabs, eight Exits, no reload/logout/write, unchanged proof; explicit logout requires durable fence and tombstone then cold refusal | Existing Preflight, awaited helper, no optional flag |
| trusted-main-login-smoke | Added actual main/Auth/verifier/bindings proof: one Exit, retargeted click and changed-target gesture refuse logout; trust fence survives; deliberate logout revokes it; retained unsaved RAM assertions | Existing Preflight |
| room-navigation-view-refresh-smoke | Replaced only obsolete clean Exit home/rooms destination with investorsListView. All Cancel/Save/rollback/fresh-room DOM/snapshot invariants retained | Existing Preflight |
| project-session-cancel-failure-safety-smoke | Successful legacy cancellation now expects zero reload; rollback, durable marker, retries and failure assertions unchanged | Existing Preflight |
| project-navigation-blockers-smoke; project-navigation-safety-smoke | Audited and preserved all current owner/CAS/RAW/recovery/calculation gates and Back choices | Existing Preflight |
| empty-installation-browser-smoke | Audited, unchanged; real native investor creation/confirmation/room/durable save remains required; existing stable gesture helper retained | Existing Preflight |
| project-context-mobile-browser | Changed obsolete WYCENA→roomsView setup to INWESTOR→existing room; quote/history/status assertions retained | Standalone optional command, NOT automatically CI |
| project-session-restored-proof-browser | Audited, unchanged; restored proof and refusal assertions do not require the old Exit route | Standalone optional command, NOT automatically CI |
| app-dev-smoke / dev_tests / js/testing project and investor suites | Audited startup home recovery vs project Exit, scope pickers and internal fixture room scaffolding. No incompatible navigation assertion found; no artificial changes | app-dev-smoke is mandatory; standalone browser dev_tests is not independently implied |
| offline-shell-smoke / load groups | Kept worker completeness/integrity/private-response exclusions and registration sequence | Existing Preflight |

The release workflow still has independent safety/preflight/firebase-current/
cloud-historical groups. Safety fixes exact approved HEAD/BASE and historical
425-pin isolation. Required failures/skips block summary/automatic merge; Pages
depends on valid merge. No workflow change or execution was performed. New
required physical scenarios are in the mandatory native smoke, not hidden in
the two standalone browser scripts. Those optional matrices remain an explicit
additional evidence gap, with overlapping mandatory owner/storage coverage.

## Actually executed targeted checks

During this implementation, Node 22.23.3:

| Check | Result |
| --- | --- |
| New navigation/Exit regression | 12/12 PASS, including all eight tabs with the actual investor wrapper and byte-identical project data |
| room-navigation-view-refresh-smoke | 17/17 PASS, updated UX plus retained Cancel/Save/security assertions |
| project-navigation-blockers-smoke | 35/35 PASS |
| project-navigation-safety-smoke | 22/22 PASS |
| project-session-cancel-failure-safety-smoke | 10/10 PASS |
| trusted-main-login-smoke | 4 groups PASS, including new trusted gesture/logout guards |
| Selected app-dev node project/investor groups only | 10/10 and 7/7 PASS; full app-dev/Preflight was NOT run |
| offline-shell-smoke | 2 groups PASS; current manifest and actual worker contracts |
| Syntax / index load groups / manifest / diff | PASS; 450 asset paths retained, only the 9 edited public entries and version changed |
| Native trusted-session-browser-smoke | BLOCKED at loopback listen EPERM; zero native scenarios executed locally |

The new navigation regression was rerun after the confirmed wrapper-side write
fix and pointer-failure case. Earlier targeted suite runs guided the same
implementation; none is a claim of CI_PASS for the eventual commit. Final
release evidence for every mandatory group belongs to separately approved CI.
No full local Preflight, all-emulator run, repeated historical audit, production
request or company data migration was performed.

## Remaining evidence and status

Actual Chromium must confirm the added mobile gesture/layout/offline workflow
for this HEAD, alongside all existing mandatory tests. Physical Android must
confirm the reported Exit issue, room cue ergonomics, narrow bar and preserved
unfinished work without reloading an existing draft. Model tests and desktop
headless emulation do not establish that on-device proof. No Firebase LIVE,
production Rules/IAM, synchronization activation, PR, Actions launch/rerun,
merge or Pages. One branch/commit/push with clean tree, then stop for review.

**CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**.

## PR #86 — repair of CI 40928905654 and drawing fixture

Input HEAD `ab93268dadcec9f7053d28260c3b7485131afb5f`; BASE unchanged
`0a9522cf9277ef3de03d328a84dd9569a1958e46`. PR remains open/Ready.
No workflow rerun, PR mutation, merge, Pages or Firebase LIVE.

### Confirmed causes

1. Restored-proof smoke expected `session.cancel()` semantics from the clean
   session-cancel button. This button now performs Exit via requestTransition.
   `inspectNavigationState()` correctly returns null for an incomplete snapshot;
   navigation refuses with the existing generic message without assigning a new
   lastError. The test now verifies false, unchanged view/context, active session,
   identical snapshot and ALL persisted RAW, zero writes and refusal on a second
   restart. Direct Cancel AND dirty Cancel still require SESSION_UNCONFIRMED.
   No session/proof implementation was changed and no missing proof is repaired.
2. Real Chromium trace reproduced pointerdown/up on CZYNNOŚCI followed by a
   compatibility click on MAGAZYN after header/scroll layout changed. Valid owner,
   durable proof, no modal and no Auth lock ruled out a session refusal. The CI
   failure was at MATERIAŁ; its old log did not identify the retargeted button.
   The reproduced shared cause is the missing global one-click guard for `tab`.
   Existing guard now covers tabs as well as Exit/open-room. Fresh pointerdown
   still resets it and deliberate logout works. Deterministic regression failed
   before the fix (two actions) and passes after for eight tabs and logout target.
3. Structural native diagnostics: alias `projectData===window.projectData` was
   true throughout. After fixture creation, room opening/session begin, WYWIAD
   and MATERIAŁ, RAM/central/snapshot were equal. First RYSUNEK render added only
   `.room_mobile.layout` and `.room_mobile.finishes` in RAM through existing
   layoutState.ensureLayout. Layout is Segment A/segA, left anchor, zero offsets
   and empty base/module/wall rows, activeSegmentId segA, zOrderRows
   base/module/wall; finishes is []. Central and snapshot lacked both fields.
   No persistent write occurred, hence isDirty false while divergence correctly
   became true. The synthetic clean-exit fixture was incomplete for drawing.
   It now invokes the existing initializer BEFORE persisting the synthetic
   fixture and BEFORE beginning a session. No active RAM is auto-saved or
   accepted, no normalization/migration/calculation or divergence guard changed.
   The model regression also proves a subsequent real offset edit is divergent.

### Regression coverage

- Restored proof: all original eight groups retained, plus direct/dirty Cancel
  code and no-write/unchanged view assertions.
- Investor navigation: 13 groups including layout baseline preparation and
  retained protection of actual drawing changes.
- main-login/bindings: eight retargeted tab gestures, one action each, tab→logout
  veto, fresh deliberate logout; original Auth/idle/trust/RAM checks retained.
- Mandatory native helper: structural checks compare RAM/window alias, central
  record and snapshot before session, after room open, each of four tabs and
  before each of eight Exits. Existing gesture helper now records bounded
  read-only target/trusted/cancel evidence. No UID, tokens or business values.
- All above are mandatory current Preflight via `*-smoke.js` discovery; native
  helper is awaited by trusted-session-browser-smoke, not an optional script.
- Offline manifest regenerated from actual bytes: 450 paths unchanged; only
  bindings.js entry plus package version changed. No worker behavior change.

### Executed evidence for the repair

Node 22.23.3: restored proof 8/8; investor navigation 13/13; room refresh 17/17;
Cancel failure safety 10/10; main-login 4 groups; offline shell 2 groups PASS.
Syntax, manifest actual-byte integrity and diff checks PASS.
The retarget regression was observed FAIL before the production fix, then PASS.

Native Chromium 151.0.7922.173 was available with an approved sandbox escalation.
The unmodified offline emulation reported navigator.onLine=true after navigation
although the origin HTTP server was stopped; original smoke failed its existing
networkOffline assertion. A disposable diagnostic copy explicitly sent CDP
Network.overrideNetworkState after navigation (no fabricated trust or app state).
With ALL navigation/RAW/trust assertions intact it passed the four tabs, all
EIGHT native Exits, 393/320px layout, zero Auth initialization during navigation,
manual logout and durable revoked fence/tombstone. It then failed the final cold
restart expectation `authState===unauthenticated`: document startup saw online
before the post-navigation CDP override and attempted Auth, ending at error;
access stayed locked. This is NOT a full native smoke PASS. No such assertion
was removed or relaxed in committed code; the diagnostic copy is deleted.
The main-login model separately passes offline logout and cold refusal.
Required unmodified native test and full mandatory CI remain CI_PENDING;
physical Android remains PHONE_PENDING. No claim of CI_PASS or release readiness.

Only bindings.js is changed in production. Session/proof, drawing, normalization,
Auth, LOCAL-FIRST, Rules, 425 pins and workflow sources are unchanged.
**CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**.

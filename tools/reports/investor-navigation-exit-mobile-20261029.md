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

# Trusted device / temporary session / offline Auth

BASE/main: `951005296780f2b4887ab39b3c065a0beb247c48` (released PR #84).
Branch: `trusted-phone-desktop-offline-auth-20261028`.
Owner approved a post-login checkbox in the top bar beside **Wyloguj**.

## Cause and resulting behavior

Previously `main-login` used the 45-second Firebase authorization lease as the
only local access permission. The verifier invalidates that lease on offline,
hidden visibility and pagehide; the gate closes it and the main screen hides the
application. Returning to the screen repeated server authorization, producing
`AUTH_ACCESS_UNCONFIRMED`. This was intentional cloud fail-closed behavior used
for the wrong purpose: continuing already-approved local work.

Three independent authorities are now retained:

- **Local access**: an in-memory desktop session or explicitly enrolled local
  device proof, plus the existing immutable profile-owner admission.
- **Google identity**: the SDK instance; main uses only in-memory persistence and
  requires a real Google-button interaction in each new untrusted document.
- **Firebase authorization**: the unchanged short, server-verified lease and
  Rules. Local trust never extends this lease or grants a Google identity/RPC.

### Trusted device — phone, tablet or laptop

After Google login, fresh authorized proof and existing-profile admission, the
top-bar checkbox **Zaufaj temu urządzeniu — dostęp offline do wylogowania**
may enroll this installation on a phone, tablet or laptop. It is not preselected by UA,
viewport, a legacy receipt or Firebase's remembered user. Enrollment first
prepares and verifies the complete public offline shell, then checks the live
lease/UID/epoch/profile again. The local proof lives in **meble-device-trust-v1**,
separate from business stores and the ownership DB. Its ECDSA P-256 private key
is non-exportable; a signed statement binds origin, project, owner UID, immutable
profile admission nonce and random installation nonce. Restore verifies the
signature and a fresh private-key challenge. A boolean or copied fence cannot
authorize a new profile. Existing ownership is confirmed read-only on restore;
it is not re-adopted or migrated.

Cold trusted startup checks local proof before creating any Firebase instance.
It does not initialize Google/Firestore or contact their servers. Hidden tabs,
notification shade, offline and long inactivity do not expire local trust.
Manual logout/unchecking blocks immediately, writes a synchronous revocation
fence and an IDB tombstone, and closes cloud access. Other cooperating tabs honor
the fence. Enrollment interrupted by another tab's logout cannot reactivate it.
Future startup requires deliberate online Google login and new owner consent;
neither inherited SDK state nor the old profile receipt restores device trust.

Confirmed server denial revokes local trust too. An unknown network result only
invalidates cloud rights. A wholly offline phone cannot learn of a remote
revocation; no immediate remote-stop guarantee is made. It must obtain fresh
authorization before any future cloud operation. No production sync is started.

### Temporary session — unchecked option on any device

With the checkbox unchecked, any device uses a temporary session with the same
five-minute inactivity limit. Default mode has no durable login/admission for this
document. Every new load,
browser restart or restored tab needs a new Google action and server proof, even
when the immutable data-owner receipt already exists. No `sessionStorage`
browser-lifetime flag is used. bfcache restoration locks the memory session.
Ordinary visibility changes do not mean browser closure. A five-minute deadline
counts hidden time and suspension, checks wall/monotonic elapsed time before
accepting activity, and refuses clock rollback. Only trusted browser input events
renew activity; expiry cannot be undone by an arriving click.

Locking hides/inerts the existing DOM and gates storage; it does not Save, Cancel,
reset, remount, roll back or clear a draft. Reauthentication reveals the same DOM.
This is a document-lifetime model, not a claim that a web page can reliably detect
every OS/browser shutdown. Process death can still lose RAM-only edits; this task
does not migrate or add business draft storage.

## Offline shell and limits

The opt-in worker precaches only deterministic public files under index/js/css/
assets. SHA-256 and byte length verify every resource before complete readiness.
The explicit same-origin GET allowlist never caches Google/Firebase responses,
tokens, private data or runtime exports. Trusted boot avoids external SDK imports.
Missing/corrupt static resources fail closed. No skipWaiting, clients.claim,
forced reload or deletion of business IDB occurs. A complete existing static cache
is preserved when an install is retried offline. Open documents retain their
worker/version; a new version activates through the normal browser lifecycle.
The public cache currently covers 450 files (about 5.14 MiB); quota failure refuses enrollment. Old
static versions are retained to avoid destroying a live document's only shell.
No policy for unlimited future cache growth is claimed. After changing public resources, regenerate with `node tools/offline-assets.js --write`; the mandatory smoke refuses a stale manifest.

WebCrypto/IDB binds this origin/profile, not physical hardware. Same-origin code,
XSS, extensions or someone controlling/copying the entire browser profile may
access local data or keys through the browser. This is not encryption of company
data, OS user isolation or hardware attestation. Device/profile clearing or loss
requires fresh authorization. IDB/persistence cannot guarantee survival of device
failure or browser eviction. If BOTH logout persistence paths fail, RAM access is
blocked and the UI reports **DEVICE_TRUST_LOGOUT_UNCONFIRMED**; permanent logout
after process death cannot be promised when no durable store accepts a write.
Do not treat that error as confirmed logout or discard its open warning.

Mapping/directions and new Google login still require network. Offline shell
readiness is not proof of business backup, synchronization or cloud permission.
Existing business records/RAW, backup stores and PR #84 sync code are unchanged.

## Changed files

- `index.html`, `js/main-login.js`, `tools/index-load-groups.js`: approved top-bar
  checkbox and split startup/admission flow.
- `js/app/cloud/local-device-access.js`: durable local proof and memory session.
- `js/app/cloud/local-access-profile.js`: read-only exact-binding resume API.
- `js/app/cloud/cloud-auth.js`: explicit memory-only option, legacy API default retained.
- `js/app/cloud/auth-access-gate.js`: distinguish confirmed denial in initial state.
- `js/app/cloud/offline-shell.js`, `offline-worker.js`, `offline-assets.js`,
  `tools/offline-assets.js`: versioned public static shell and integrity generation.
- `tools/trusted-session-smoke.js`, `tools/trusted-main-login-smoke.js`,
  `tools/offline-shell-smoke.js`, `tools/trusted-session-browser-smoke.js`: new
  mandatory targeted policy, entry, shell and native browser regressions.
- `tools/empty-installation-browser-smoke.js`: conscious native login in existing
  business regression, including reload; existing business assertions retained.
- `tools/firebase-pilot/access.test.mjs`: real SDK/Rules session and denial regression.
- `CURRENT_STATE.md`, `ROADMAP.md`, `CLOUD_MIGRATION.md`: current scope/status.
- This report.

## Validation and CI ownership

Actually executed targeted checks:

- `trusted-session-smoke.js`: five groups (real crypto/key/signature, corruption/
  UID/new profile, logout/enrollment race, idle/sleep, actual memory-only Auth).
- `trusted-main-login-smoke.js`: three groups using actual entry/gate/profile/
  policy code, synthetic DOM/authorization and transactional IDB model. Covers
  deliberate login, idle/re-auth/RAM, offline restore without Auth, logout and
  confirmed denial. These are not native-browser or Firebase PASS claims.
- `offline-shell-smoke.js`: deterministic actual-byte manifest and worker logic,
  complete/static cache, corrupt/missing-resource refusal, no private/Firebase
  interception or open-page takeover, using injected Cache/Response boundaries.
- Targeted index load-group audit; syntax/diff/manifest checks.

Native `trusted-session-browser-smoke.js` is prepared for existing Preflight's
automatic `*-smoke.js` discovery: actual Chromium, native IDB/CryptoKey/SW, conscious
top-bar gesture, desktop idle/RAM, browser close/restart, foreign UID refusal,
background/offline, complete cold trusted startup with the HTTP origin stopped,
offline logout and no inherited readmission. Its Google/authorization SDK is an
explicit injected fixture; it does not claim a Google/Rules emulator test.
Local execution is **BLOCKED** at `listen EPERM`, zero native cases completed.

Actual SDK/Auth/Rules `access.test.mjs` remains in the current Firebase CI command;
an added test verifies the memory-only configuration, independent unauthenticated
session, Rules refusal and real grant revocation. The unchanged cloud gate tests
remain strict about server leases. Existing `main-login-smoke.js` ownership tests
and the full empty-installation browser business assertions remain in Preflight;
the latter now uses a conscious native login gesture, including after reload.
The separate optional `auth-browser.test.mjs` matrix predates the new local-session
UX and was not executed; it is not the mandatory new session/browser evidence.
No old browser PASS is assigned to this new behavior.

Full Preflight, current Firebase and historical CLOUD (425 pins/frozen checkout)
remain **CI_PENDING** for this new HEAD, with no workflow change or CI launch.
Physical Android must separately verify notification shade, switching apps,
screen sleep, long offline use, cold browser restart, visible top-bar consent,
offline logout and preservation of real unfinished work. Do not force-refresh
the owner's current tab to acquire this version.

Implementation **CODE_READY**; CI **CI_PENDING**; **PHONE_PENDING**;
**RELEASE_BLOCKED / LIVE_BLOCKED**. No PR, merge, Pages, production reads/writes,
Rules/IAM/billing change, migration, backup rewrite or synchronization activation.

## PR #85 — targeted CI repair

Input HEAD: `d80b9d8c175d77c3f517ed3c669771347f9bbd69`.
Unchanged BASE/main: `951005296780f2b4887ab39b3c065a0beb247c48`.
Evidence: [run 40783957859](https://github.com/mebleszek/meble-app/actions/runs/40783957859),
current Firebase 104/105 and current Preflight smoke 161/164. These are results
for the input revision, not a PASS for this repair.

Four causes and corrections:

1. **Signed-out SDK client:** its verifier rejects a fabricated identity before
   connecting Firestore. The new direct Rules assertion nevertheless called
   `getFirestore()` on that app, which defaults to the remote service rather than
   the loopback emulator. `unavailable` was therefore not evidence of a Rules
   denial. The fixture now explicitly initializes memory-only Firestore and
   connects every signed-out client to `127.0.0.1:18080`, before a direct RPC.
   `assertFails` still requires `permission-denied`; no allowance for network
   errors was added. Auth, verifier and Rules implementations are unchanged.
2. **Private CLOUD-4.1 source pin:** the current `main-login.js` differs from its
   historical SHA-256 `061d9f4364625cfc53f4280dac74cfb18ae487624fa97393f40cfcb6aa12c103`.
   The compiler correctly refuses. The unchanged original positive smoke now
   joins the existing historical routing at exact commit
   `306f90a4cfd8bcb4277aa8b4d140e911493ddd60` (eight historical smoke files).
   Existing routing verifies byte equality of the test against that checkout.
   The current boundary separately checks the three private operator files
   against their original pins and requires the exact compiler refusal, before
   effects. No operator, historical source, manifest, pin or workflow changed.
3. **Empty-installation native gesture:** the test waited 160ms after opening a
   catalog, but the real modal keeps `modal-open-guard`/`pointer-events:none` for
   a requestAnimationFrame plus 260ms. Its former rectangle-only tap could hit
   the underlying page, including Auth controls, instead of the close button.
   The shared test helper now waits for enabled/non-inert/non-guarded state and
   actual `elementFromPoint` hit testing. The test also requires the modal to
   close and local access to remain valid before its unchanged RAW assertions.
   The original CI log did not record the unintended native event's target;
   that exact target is not claimed as locally reproduced. The unsafe sequence
   is reproduced against the actual modal guard in the offline regression.
   No storage gate, session, application gesture handler or local data changed.
4. **Trusted-session navigation:** `Page.navigate` acknowledges navigation
   before the requested document is parsed, leaving `body` null at the first
   poll. The helper now waits for `DOMContentLoaded` from the exact returned
   frame/loader, including events arriving before the navigate response. It
   rejects failed/no-document navigation and missing events; then the test
   verifies the requested URL and actual application shell before startup polls.
   Native taps use the same hit-test barrier. A second fixture defect found on
   this startup path was its missing `memoryLocalCache` SDK method; the injected
   fixture now implements and checks the existing memory-only verifier contract.
   Browser errors still fail the test; readiness timeouts were not increased.

Repair files: `tools/firebase-pilot/access.test.mjs`, `tools/cloud-ci-context.js`,
`tools/cloud-ci-current-boundary-smoke.js`,
`tools/empty-installation-browser-smoke.js`,
`tools/trusted-session-browser-smoke.js`,
`tools/helpers/browser-test-readiness.js`,
`tools/trusted-ci-readiness-smoke.js`, and this report.

Actually executed targeted checks on the repair working tree, Node 22.23.3:

- `trusted-ci-readiness-smoke.js`: **3 groups PASS**. Exact CDP frame/loader and
  event-order barrier, negative navigation cases; real modal guard and hit-test
  refusal for disabled/inert/occluded targets; actual Auth/verifier code with
  the injected browser SDK, successful proof and confirmed denial. These are
  offline helper/fixture checks, not native Chromium or emulator evidence.
- Current CLOUD boundary: **PASS**, including exact private compiler refusal,
  original reviewed operator bytes, C/D/E refusals and no effects/LIVE.
  Historical checkout identity, cleanliness and all **425 pins** verified.
- Original CLOUD-4.1 smoke in that exact isolated historical tree: **PASS**;
  no other historical suite rerun.
- Changed JS/MJS syntax, offline manifest actual-byte integrity (**450 files**),
  diff/scope checks: **PASS**. No public assets changed; no manifest rewrite.
- Empty-installation native browser: **BLOCKED**, before any scenario, by DBus
  socket `Operation not permitted`. Trusted-session native browser: **BLOCKED**,
  before any scenario, by loopback server `listen EPERM`.
- Targeted real `Desktop in-memory Auth` test: **BLOCKED**, zero scenarios
  executed, because the local `firebase` package is unavailable. No installation,
  fake emulator success or relaxed error expectation was substituted.

The new offline helper regression is discovered by existing mandatory Preflight
`*-smoke.js` discovery. Both native browser suites remain mandatory current
smoke; `access.test.mjs` remains in the current SDK group. The original private
smoke is now mandatory in the independent historical job, with the current
refusal mandatory in the current boundary smoke. Full Preflight/current SDK/
historical results for the new HEAD require a separately approved CI attempt.
Physical Android remains **PHONE_PENDING**. Explicit opt-in trust on any owner
device, five-minute temporary sessions, local-data protection and deferred
shared PIN are unchanged. No CI rerun, PR mutation, merge, Pages or Firebase LIVE.

**CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**.

## PR #85 — remaining Chromium regressions (29.10.2026)

Input HEAD `804c32574179d21846330a2e1c16f3c322570f41`; unchanged BASE/main
`951005296780f2b4887ab39b3c065a0beb247c48`.
[Run 40789226065](https://github.com/mebleszek/meble-app/actions/runs/40789226065)
confirmed Safety, current Firebase and historical CLOUD PASS for that input
revision, and current smoke 162/164. It did not release the branch. None of
those PASS results is assigned to this repair.

### Confirmed production defects

- The actual business delegation in `js/app/ui/bindings.js` closes the catalog
  on `pointerup` and consumes the following compatibility `click` in document
  capture. The main Auth listener previously handled logout in **window capture**,
  ahead of that protection. A click retargeted under the closed modal could
  therefore log out before the existing guard saw it. This was reproduced with
  the input revision's real main entry and actual business bindings: one close,
  then a retargeted click on `main-signout`, and local access became false.
  Rectangle/hit-test waiting alone could not fix this production event ordering;
  the preceding repair's early-gesture hypothesis was insufficient.
- The locked-state pointer guard also stopped a genuine login-shell
  `pointerdown` before the document's physical-gesture reset. Reproduction
  confirmed zero document deliveries on the input revision. The new Auth click
  handling runs in bubbling, after the existing compatibility-click protection;
  a fresh login-shell pointerdown is allowed to reach the shared reset. Business
  input remains blocked in capture and the existing DOM remains inert/hidden.
- A cloud callback's `onState` called `isValid()`, which could synchronously
  expire the desktop session and render the login screen in `onLock`. The same
  older callback then rendered its signed-in cloud state over that screen,
  hiding Google login. This was independently reproduced against the exact
  input main source with actual Auth/verifier/profile modules: access false,
  Google hidden, popup count still one. Main now preserves the synchronous
  local-lock screen when that nested expiry occurs. No local/cloud permission
  is renewed by this check; a second deliberate Google action and new server
  proof are still required.

The real CI log did not contain click targets, popup counts, Auth/profile state
or lock reasons for the failed reauthentication. The local reproductions prove
the above implementation defects with modeled DOM/IndexedDB/event delivery;
they do **not** prove which precise ordering occurred inside that Chromium run.
Native verification of the complete failing flows remains required in CI.

### Regression evidence and scope

`trusted-main-login-smoke.js` now models window capture → document capture →
window bubble, multiple Auth subscriptions, listener removal and cancelled
timers. Its added group executes actual main, Auth, verifier, profile and
business bindings with the existing explicitly injected SDK and transactional
IDB model. It verifies a modal compatibility click cannot log out; a genuine
logout still blocks; exact idle expiry cannot open a popup; the login screen
survives the cloud callback; the next physical gesture reaches document reset;
exactly the second popup, fresh read/transaction and completed profile admission
restore access; unsaved RAM stays byte-for-byte unchanged. Existing three groups
still cover trusted offline restart, manual logout, real denial and RAM safety.

The native tests retain their original session-validity assertions, actual
mouse/touch gestures, native IndexedDB, full offline restart and RAW assertions.
The reauthentication test additionally requires exactly two trusted native
Google clicks and popups, fresh probe read and transaction, authenticated Auth,
desktop mode, confirmed profile and unchanged unsaved input. Test-only bounded
diagnostics capture event kinds/known control IDs, lock reason, mode, profile
phase, Auth status/epoch and counts; no UID, token, receipt or business value.
Diagnostics are not imported by the application or added to its offline shell.
Cold offline documents without this injection retain safe status-only failure
diagnostics. No timeout was increased and no exception is accepted as PASS.

Changed files:

- `js/main-login.js` — production event ordering and nested-expiry rendering.
- `offline-assets.js` — actual-byte regeneration; only `js/main-login.js` entry
  and the manifest version change, with all 450 paths retained.
- `tools/trusted-main-login-smoke.js` — accurate event/Auth fixture and regression.
- `tools/trusted-session-browser-smoke.js`,
  `tools/empty-installation-browser-smoke.js` — stronger native assertions and
  diagnostic evidence, with original business/security assertions retained.
- `tools/helpers/auth-input-diagnostics.js` — isolated test instrumentation.
- `tools/trusted-ci-readiness-smoke.js` — event-registration stub required by
  that instrumentation in the existing SDK-fixture unit check.
- This report.

Actually executed on the repair working tree using Node 22.23.3:

- Controlled input-revision reproductions: modal click-through logout,
  synchronous idle lock overwritten by a cloud callback, and suppressed login
  pointerdown **REPRODUCED**. No production source was swapped on disk.
- `trusted-main-login-smoke.js`: **4 groups PASS**, including the new actual-module
  event/proof/profile regression. This is not a native-browser or Rules PASS.
- `trusted-ci-readiness-smoke.js`: **3 groups PASS** for navigation, hit testing,
  and the actual Auth/verifier with the injected browser SDK.
- Syntax of changed JS, actual-byte offline manifest integrity (450 assets),
  exact manifest delta, diff and unchanged protected-source/PIN scope: **PASS**.
- Current CLOUD boundary: **PASS**, exact fail-closed refusals without effects;
  isolated historical checkout identity/cleanliness and **425 pins** verified.
- Both native smoke commands were attempted: **BLOCKED, zero native scenarios
  completed**. Empty-installation cannot bind its private DBus socket; trusted
  session cannot bind its loopback server (`EPERM`). A further isolated pipe-only
  Chromium diagnostic also failed on sandbox-denied socket operations. The
  additional-network execution request was cancelled, so it provided no test
  evidence. No Chromium runtime/CI configuration was changed to hide this.

Full mandatory current Preflight (including both native flows), current Firebase
and historical CLOUD require a separately approved Actions attempt for the new
HEAD. Existing CI discovery and release gates are unchanged. Physical Android
remains PHONE_PENDING. Five-minute expiry, explicit device trust, fresh cloud
authorization, local-data protection, Save/Cancel, LOCAL-FIRST, business data,
Rules, the 425 historical pins and deferred shared PIN remain unchanged.

**CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**.
One repair commit on the existing branch; no CI rerun, PR transition, merge,
Pages or Firebase LIVE.

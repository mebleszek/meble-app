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

## PR #85 — cold offline restart / final Chromium blocker (29.10.2026)

Input HEAD `c7168d2a3e3a22d557d76cac811e700a7f8a46fd`; unchanged BASE/main
`951005296780f2b4887ab39b3c065a0beb247c48`.
[Run 40824073397](https://github.com/mebleszek/meble-app/actions/runs/40824073397)
confirmed Safety, current Firebase and historical CLOUD PASS, current smoke
163/164, including empty-installation and main-login PASS for that input SHA.
The remaining failure is cold offline browser startup. No previous PASS is
assigned to this repair, and no CI attempt was launched.

### Cause established and evidence limit

The test's `device.close()` called supervisor cleanup directly. The existing
supervisor requests termination and signals descendants; it confirms process
reaping/profile ownership, but does not request Chromium's ordinary profile
shutdown. In particular, a completed localStorage API call/read-back does not
prove that Chromium flushed that renderer/browser's buffered profile state to
disk before those signals. The test thus used emergency process termination
at a boundary intended to test an ordinary browser close and restart.

This lifecycle defect is confirmed by the actual caller/supervisor code. The
old CI log has no fence, key or restore evidence and cannot establish whether a
specific fence, CryptoKey, profile receipt or startup step failed. `input:null`
only identifies the missing diagnostic injection. Local Chromium remains
blocked, so **loss of any particular stored value in that CI run is not claimed
as reproduced**. The repair fixes the confirmed shutdown defect and adds the
missing evidence; native confirmation of the full cold path remains CI_PENDING.

### Minimal correction and stronger evidence

The browser test now sends `Browser.close`, requires its ACK and natural zero
exit, and only then invokes the unchanged supervisor cleanup/reaping check.
Close is idempotent per launch. Lost ACK, nonzero/signalled exit, missing exit
confirmation or failed cleanup still FAIL; cleanup on failure provides no
successful restart result. There is no startup retry, profile repair, lock-file
removal or timeout extension. The added 30-second orderly-exit bound uses the
existing CDP request bound; application-readiness deadlines are unchanged.

Before closing, read-only diagnostics inspect only the two known trust/ownership
databases. The diagnostic enumerates databases first, never creates a missing
store, aborts an upgrade race, and uses readonly transactions. It returns only
fixed state labels/booleans: fence class, record/key types, non-exportability,
signature presence, origin match and profile/receipt/fence binding matches.
It exports no UID, nonce, key, signature, receipt, token or business data.

The same profile is reopened with CDP network offline after the HTTP server has
stopped. Its sanitized persistent metadata must match the pre-close snapshot.
The original `businessState === ready`, valid-session and trusted-checkbox
assertions are retained. Actual application restore must report a valid crypto
proof and confirmed profile resume; Service Worker must control the page from
the expected script; network must remain offline and Auth factory calls zero.
No SDK/Google fixture is injected into cold documents. Read-only instrumentation
records actual restore outcome/error class, profile phase/error, local mode and
worker state, replacing the uninformative null diagnostics. Metadata alone
never authorizes access; the unchanged application still verifies the signature,
private-key challenge, fence and ownership binding.

No production access, WebCrypto proof, IndexedDB schema, startup, offline worker,
public asset manifest, session deadline, UI, PIN, LOCAL-FIRST or business code
was changed. A genuinely missing/corrupt/revoked proof still requires deliberate
online approval; no recovery fallback creates or reactivates trust. This change
does not promise survival of power loss, eviction or OS killing the browser.

Changed files:

- `tools/trusted-session-browser-smoke.js` — orderly close, unchanged cold
  offline scenario, metadata comparisons and actual restore/worker assertions.
- `tools/helpers/trusted-cold-start.js` — orderly-close handshake and readonly
  metadata inspection for the disposable test profile.
- `tools/helpers/auth-input-diagnostics.js` — safe cold restore/profile/worker
  evidence, preserving original API promises and requiring no SDK injection.
- `tools/trusted-cold-start-smoke.js` — mandatory targeted regression through
  existing Preflight `*-smoke.js` discovery.
- This report.

Actually executed, Node 22.23.3:

- New cold-start smoke: **2 groups PASS**. Orderly ACK → natural exit → reaping,
  and refusal on lost ACK/nonzero exit/signal/timeout/failed cleanup without
  retry; real WebCrypto keys/signature restore through the transactional IDB
  model, valid/absent/refused diagnostics, readonly metadata, missing DB without
  creation, corrupt/revoked proof without repair, and no private values exported.
- Existing targeted readiness smoke: **3 groups PASS**, including the changed
  injected instrumentation with actual Auth/verifier and the SDK fixture.
- Changed JS syntax, exact five-file diff/scope, unchanged public manifest and
  protected application/operator/PIN files: **PASS**.
- Native trusted-session browser smoke: **BLOCKED** at loopback `listen EPERM`,
  zero native cases completed locally. No new installation, extra-permission
  request, full Preflight, emulator suite or completed historical audit rerun.

GitHub Actions must still confirm real Chromium profile persistence, stored
CryptoKey restore and Service Worker startup with the origin stopped, alongside
the mandatory existing current/historical groups, for the new HEAD. Physical
Android remains separate. No PR operation, CI rerun, merge, Pages or Firebase LIVE.

**CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**.

## PR #85 — combined Auth/offline test audit (29.10.2026)

Input HEAD `45b1dc6b08ebc38c5865bd6356aed65c0286bb29`; GitHub branch and main
verified read-only; BASE remains `951005296780f2b4887ab39b3c065a0beb247c48`.
Read AGENTS, this package's documentation and the actual Preflight job logs for
the three preceding failed attempts:

| Run | Evidence for that input revision only |
| --- | --- |
| [40789226065](https://github.com/mebleszek/meble-app/actions/runs/40789226065) | 162/164 current smoke; catalog gesture invalidated access and idle reauthentication timed out. Subsequent production event-order corrections are retained. |
| [40824073397](https://github.com/mebleszek/meble-app/actions/runs/40824073397) | 163/164; cold restart did not reach ready; no diagnostic injection in that cold document. Subsequent orderly browser-close and cold evidence checks are retained. |
| [40827260333](https://github.com/mebleszek/meble-app/actions/runs/40827260333) | 164/165; safety/current Firebase/historical CLOUD PASS. Cold proof/profile/worker/ready/no-Auth assertions passed; the remaining assertion read the wrong namespace at line 90. |

### Dependency map and contract review

| Layer / test | Actual dependency and boundary |
| --- | --- |
| Workflow → safety → independent Preflight/current Firebase/historical CLOUD | Exact approved HEAD/BASE, isolated historical checkout and 425 pins precede execution. Current Preflight failure does not suppress the other two groups. All mandatory groups and fresh revisions gate automatic merge; Pages follows that merge. No workflow change is needed. |
| `preflight.js` → sorted `tools/*-smoke.js` | Separate Node child per smoke; collects failures and continues independent phases. All six audited smoke files are automatically mandatory in the current group, not the frozen historical group. Requiring a fixture module does not invoke its guarded `main()`. |
| `trusted-session-browser-smoke.js` | Real Chromium, durable profile, IndexedDB/CryptoKey and SW. Online phase explicitly injects SDK-shaped fixtures; cold phase has only bounded diagnostics, stopped HTTP origin and CDP offline. Actual `main-login` must restore validated trust and ownership before business startup; Auth factory count must remain zero. |
| `trusted-cold-start-smoke.js` | Tests the same Browser.close ACK → natural exit → reaping helper; real WebCrypto with transactional IDB model for readonly diagnostics, absent/corrupt/revoked proof refusal. Does not establish native disk persistence. |
| `trusted-main-login-smoke.js` | Actual main/local modules with modeled DOM/IDB; actual Auth/verifier/business bindings in its event-order group. Requires consent, idle lock, fresh proof on reauthentication, offline trust restoration without Auth and exact retained RAM. |
| `trusted-ci-readiness-smoke.js` | Same CDP frame/loader readiness and physical hit-test helpers; actual modal guard; actual Auth/verifier with the browser SDK fixture. Now also executes the real namespace factory and extracted, unchanged app.js `const FC` declaration to reproduce the lexical shadow. |
| `empty-installation-browser-smoke.js` | Real mobile Chromium gestures and business startup, intercepted static resources and explicit Auth/verifier fixture; shared safe diagnostics/hit testing. Public business APIs already use `window.FC`; lexical business state such as `uiState` is intentionally read directly. No equivalent incorrect Auth lookup found. |
| `offline-shell-smoke.js` | Actual-byte public manifest and worker logic in a controlled cache/fetch model; checks corruption, completeness, expected worker/scope, exclusion of private/Firebase responses and no page takeover. Actual cold SW behavior is covered separately by the native session test. |

Runtime chain: deferred auth-shell scripts in `index.html` register inert public
APIs in `window.FC`, then `main-login.js` attempts `trust.restore()` first.
`local-device-access.js` validates the signed origin/project/owner statement,
non-exportable private-key challenge and local fence; `local-access-profile.js`
checks the owner/receipt/attempt binding before a readonly resume. The capability
authorizes local work only. The business loader fetches/evaluates the ordered
template manifest, including `app-core-namespace.js` → `app.js` → `public-api.js`.
The latter core bootstrap does not turn local trust into Firebase authority.
Without valid local proof, online deliberate admission and fresh server proof
remain required; offline logout retains the veto. SW supplies only the complete,
hash-checked static shell; it supplies no Google session or private response.

### Confirmed causes and corrections

`app.js` declares a global lexical `const FC` from `createAppCore()`, whose
result contains the business `utils/storage/project` core. It is distinct from
the public `window.FC` object holding `cloudAuth`. CDP Runtime.evaluate resolves
bare `FC` to that lexical binding. A local reproduction with the actual factory
and actual declaration confirmed: bare `FC.cloudAuth` is undefined, while
`window.FC.cloudAuth.create` is a function. Therefore the final CI assertion did
not demonstrate missing offline Auth resources or a failed local session.

The native test now uses shared, inert `authModuleType()` to inspect explicitly
`window.FC.cloudAuth.create`. It still requires a function, so a missing module
fails. All existing cold persistence, crypto restore, profile admission, SW,
session, consent, zero Auth creation, logout and no inherited readmission
assertions remain. Module registration and Google initialization are separate:
the former is required offline, the latter must not occur during trusted boot.

Audit also reproduced a diagnostic defect: public bootstrap can assign a
namespace into itself (`Object.assign(window.FC, window.FC)`), and the helper's
setter wrapped its already wrapped API again. One actual Auth create then
reported two. The setter now preserves the identical current wrapper on that
self-assignment. The new regression checks stable API/function identity after
two merges, zero create/SDK loads during inspection, exactly one actual create
and one diagnostic count during explicit initialization, and missing-module
refusal. The helper still returns original promises, observes outcomes and does
not authorize access, write storage or dispatch input. Existing profile/trust
instrumentation, event delivery and fail-closed paths are retained.

No other contradictory requirement was found in the audited paths. Model-only
tests and native tests deliberately prove different boundaries; their PASS
counts are not interchangeable. No duplicate smoke was removed. No reason to
change application code, access policy, SW/cache contents, public manifest,
IndexedDB schema, UI, LOCAL-FIRST, Rules or historical sources was established.

Changed files: `tools/helpers/auth-input-diagnostics.js`,
`tools/trusted-ci-readiness-smoke.js`, `tools/trusted-session-browser-smoke.js`
and this report. The test-only helper is outside the public offline allowlist;
`offline-assets.js` therefore remains byte-identical and current.

### Actually executed for this repair

- Input-source reproductions: wrong lexical lookup **REPRODUCED**; repeated
  diagnostic wrapping **REPRODUCED** (one real call, two reported calls).
- `trusted-ci-readiness-smoke.js`: **4 groups PASS**, including namespace,
  inert registration, idempotent instrumentation and strict actual Auth/proof.
- `trusted-main-login-smoke.js`: **4 groups PASS**, checking the changed shared
  instrumentation against actual main/event/proof paths and retained RAM.
- `trusted-cold-start-smoke.js`: **2 groups PASS**, checking changed diagnostics
  against readonly trust evidence, real crypto/model-IDB and fail-closed restore.
- Three changed JS syntax checks, actual-byte offline manifest verification,
  exact four-file scope and diff whitespace checks: **PASS**.
- Native session command: **BLOCKED** at `listen EPERM 127.0.0.1`, **zero native
  scenarios completed locally**. No timeout extension or environment exception
  accepted as PASS. No full local Preflight, emulator suite or CI attempt run.

All mandatory CI groups need a separately approved run for the new HEAD. In
particular the complete native flow must reach offline logout and its following
cold refusal; the prior run stopped before those final assertions. Physical
Android notification/sleep/offline restart and real browser storage behavior
remain PHONE_PENDING. Earlier run successes are evidence for their own SHA only.

**CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**.
One logical commit/push on the existing branch; no PR modification, Actions
launch/rerun, merge, Pages or Firebase LIVE.

## PR #85 — investor save gesture readiness (29.10.2026)

Input HEAD `21becc4f0b0f4de8cc3e816c5e20f221a9a97cab`; GitHub branch and main
verified read-only; BASE `951005296780f2b4887ab39b3c065a0beb247c48` unchanged.
Read AGENTS, this report and the actual Preflight logs for
[40830924581](https://github.com/mebleszek/meble-app/actions/runs/40830924581)
and the preceding [40827260333](https://github.com/mebleszek/meble-app/actions/runs/40827260333).

The newer run completed native trusted cold startup, offline logout and cold
readmission refusal. Its sole failing smoke was empty-installation, timing out
after the first investor save gesture. Its failure snapshot still had
`auth: authorized`, `business: ready`, the editing form and Save action; no save
confirmation or validation notice was present. The earlier run completed the
same empty-installation scenario in 6866 ms. This does not establish a runner
resource failure, a revoked session or an invalid investor fixture.

### Confirmed defect and evidence boundary

The test helper called scrollIntoView and returned the hit-tested coordinates
in the same JS task. It did not await a rendering frame or revalidate the hit
target before separate CDP touch messages. The save button is below the long
investor form, so that gesture requires scrolling. Controlled reproduction
confirmed the old helper can return a valid point which becomes stale on the
next frame. This is a test readiness race, not evidence that production save
validation should be relaxed.

The old CI log contains no actual pointer/touch/click targets, draft validation
result or cancellation trace. Consequently the exact event sequence in that
failed Chromium run is **not proved**, and the repair does not claim a local
native reproduction. The change removes the demonstrated readiness defect and
adds the evidence needed to distinguish a remaining application failure from
misdirected/cancelled input in the next authorized run. No environment failure
is accepted as a successful application test.

### Correction and retained requirements

- Empty-installation opts into a stable physical-input target: scroll once,
  wait across two requestAnimationFrame callbacks, then recheck coordinates
  without scrolling and require the identical hit node. Motion, replacement,
  an overlay or lost availability refuses readiness within the original bound.
  Other callers retain their existing default behavior. There is still exactly
  one touchStart/touchEnd pair per tap, no click retry, synthetic DOM click,
  larger timeout, forced focus or application-style/animation change.
- Save uses the explicit investorActionBar button. The actual editor must be
  editing, dirty and complete under the unchanged production required-field
  validator before dispatch. A complete draft still does not authorize saving.
- Before accepting the real confirmation, the test requires exactly one trusted
  pointerdown, pointerup and click on that Save control, no touch/pointer cancel,
  and zero persisted investors/projects. Existing confirmation, real owner,
  project/room creation and durable-save assertions remain unchanged.
- A disposable, read-only observer captures at most 16 input event kinds,
  isTrusted/on-target booleans and target connection state. Timeout diagnostics
  add editing/dirty/missing-field-count/notice/confirmation state and existing
  sanitized Auth diagnostics. No field values, UID or body text are exported;
  the observer neither cancels nor synthesizes events and is replaced/removed
  between gestures.

Production investigation: investor-actions binds Save to click, validates the
actual editor draft, then awaits investor-modals/confirmBox before commit.
The navigation guard does not disable this Save button. Main's access guard
allows business input while local access is valid; the CI snapshot confirms it
remained authorized. The preceding Auth diagnostic change only makes API
self-assignment idempotent and adds an inert namespace reader; it does not wrap
investor actions/validation/modals, dispatch input or change scroll. No evidence
justifies changing those production modules.

Changed files: `tools/helpers/browser-test-readiness.js`,
`tools/empty-installation-browser-smoke.js`, `tools/trusted-ci-readiness-smoke.js`
and this report. Existing mandatory Preflight smoke discovery covers the added
regressions; no workflow, pinned source, public manifest or application change.

### Actually executed

- `trusted-ci-readiness-smoke.js`: **6 groups PASS**. New groups reproduce stale
  same-task coordinates, refuse moving/replaced targets, accept rendered stable
  coordinates and verify non-cancelling observer cleanup. Actual investor action
  binding/editor/validator/modals refuse incomplete data, wait for an explicit
  decision, preserve edit after cancellation and commit once after acceptance.
  Existing navigation, modal-guard, namespace and actual Auth/verifier checks
  remain present. This is controlled DOM/SDK testing, not native touch PASS.
- Syntax of three changed JS files, exact four-file scope, whitespace diff and
  actual-byte offline manifest verification: **PASS**. Public/application,
  Auth diagnostics, Chromium supervision, Rules, LOCAL-FIRST and PIN sources
  remain unchanged.
- Native empty-installation command: **BLOCKED**, zero native scenarios
  completed. The sandbox denied the private DBus socket (`Operation not
  permitted`) before Chromium readiness; no application failure was converted
  into PASS. No full local Preflight, emulator suite, installation or CI rerun.

CI must confirm actual compositor/touch delivery and the full investor save
flow for the new HEAD, alongside all existing mandatory groups. The old failure
remains an incomplete event-level diagnosis until that native evidence exists.
Physical Android remains separate. One logical commit/push, clean tree; no PR
operations, Actions launch/rerun, merge, Pages or Firebase LIVE.

**CODE_READY / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED**.

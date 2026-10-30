# LOCAL-FIRST application end-to-end — 30.10.2026

## Revision and scope

Product branch: `integration/android-local-first-20261030`. Continued input
`f3ae3374dfa581ea93d4bffa80f6d338070ff898`, reconciled with released main
`6588cac972fc1ebbfe57f80ad55b4d22620a7647` through merge
`6db5164c433d1cded5b3cd47cb9f79895b2d1be0`. No force push or release merge.

PR #87 is MERGED, head `c220ac506ca345077f13eec26a695d8e6d6f42ca`.
GitHub read-only evidence: run [41038339355](https://github.com/mebleszek/meble-app/actions/runs/41038339355)
completed successfully, including safety, Preflight, Firebase current, CLOUD
historical, auto-merge and exact-merge Pages verification. These are documentation
release proofs, not CI evidence for this product branch. Compact documentation
and complete archives were retained; no archive was rewritten.

## Implemented application path

- `application-authority.mjs` explicitly installs an emulator-only application
  image in the existing LOCAL-FIRST IDB control store. It is not the backup archive.
  Current repositories read this image; original covered localStorage bytes remain
  untouched recovery sources. Approved Save commits the image, replica and outbox
  atomically, with a version CAS and hashes. No local/cloud success before commit.
- Writes of covered keys outside an asynchronous transaction refuse. Concurrent
  transactions, source changes/old-tab storage events and clear() refuse. The
  controlled installer requires loopback, the exact demo connection, test database,
  matching UID and valid existing local access. A production-name initialization
  refuses with `LF_OLD_WRITER_EXCLUSIVITY_UNPROVEN`.
- Existing Save/Cancel and clean Exit have optional bindings. Save notices wait
  for local durability. Cancel keeps its real confirmation and native proof/owner
  checks; rollback must match the approved local replica and may not add an outbox
  operation. Clean Exit first confirms durable session closure. Failed transactions
  restore the previous image, RAM/session/UI state instead of acknowledging success.
- Draft transactions retain session proof and local draft bytes without approving
  their publication. Explicit adapter resume uses the existing session validator;
  it does not create a missing snapshot, repair proof, retry begin or replay WRITE.
  A corrupt/missing proof remains blocked. Startup hydrates the IDB image and shows
  the verified investor; remembered UI alone does not grant a new room edit.
- `application-replication.mjs` composes the existing channels and coordinator.
  Verified remote content is projected into the application image in the same IDB
  transaction as the replica CAS. Active RAM/session, dirty local data/outbox,
  wrong owner, conflicting aliases and stale application version prevent apply.
  Rendering follows commit and the unchanged-RAM witness. Company transport.apiKey
  remains local and is never included in the network model.
- Head listeners and online/local-commit signals wake synchronization. A confirmed
  commit joining a cycle in progress now requests another outbox scan; otherwise a
  queued operation could remain unpublished after the last listener event. This
  is queue scheduling, not retrying an uncertain WRITE. Uncertain operations still
  resolve from an independent server read and the durable expected revision.
- Owner-scoped project discovery registers channels only after the same independent
  chunk/hash/dependency validation. A fresh receiver needs no preconfigured project
  inventory. Its emulator-only Rules fragment permits owner-approved head queries
  bounded to 100 results per request; pagination reads the full inventory. Unbounded
  queries, foreign UID, deletes, and revision/chunk/editor listing remain denied.
  No deployed/production Rules or grant was changed.
- Android fixes from the input commit remain. A newly reproduced defect was in
  project-bootstrap: rendering called project.save() even when normalization made
  no content change. The observed difference on investor switch was only
  `projects[1].updatedAt`; the captured stack proved refresh -> normalize -> save.
  Normalization now fills RAM defaults without implicitly committing a revision.

## Supported data and explicit refusals

The single existing CLOUD-3 contract still defines all 14 globals: materials,
hardware, manufacturers, suppliers, categories, types, technicalParams,
hardwareSettings, labor, workshopServices, stock, programDefaults, company and
businessCosts. Primary sources and historical aliases use that contract; a
conflicting alias refuses without erasing either source. No second data register.

`business-project-v1` carries the exact selected investor, full owned project
record and its unambiguously owned frozen offers. It retains IDs, values, unknown
allowed fields, project-local PCV and layouts. It reuses existing geometry,
relationship, PCV and dependency validators, immutable chunks, revision hashes,
CAS and editor epochs. No synthetic eligibility flags are stamped onto real
records. Historical `native-project-v1` pilot validation remains unchanged.

Unsupported structures return `LF_PROJECT_SCHEMA_BLOCKED` with the original
validator reason. In particular, this does not claim support for constructions
outside the existing room-validator coverage (standard cabinets/drawers and
supported set layouts). A whole dependent project refuses, rather than silently
omitting its cabinets or treating a partial project as complete.

Nonempty fc_edge_v1, fc_material_part_options_v1, fc_rozrys_grain_state_v1,
fc_rozrys_overrides_v1 and unresolved quote drafts remain protected and block the
dependent project. Unowned history, pending domain operations, incomplete room
ownership and missing catalog dependencies refuse. Issue #47 stays deferred.
Old RAW, backups, source keys and previously protected versions are not deleted.

## Targeted checks and mandatory CI

No full local Preflight or full Firebase regression suite was run. Development
failures were diagnosed and fixed within the new E2E, including inconsistent
fixture aliases, the queue wake-up race and implicit normalization Save. Final targeted E2E: **1/1 PASS**, 0 skipped, on Node 22.23.3/native Chromium;
74.06 s scenario / 76.39 s TAP lifetime. The receiver started with only its global
channel; both project scopes were discovered after publication. It is not inherited
from an earlier CI SHA.

| Check | Evidence / CI owner |
| --- | --- |
| application-e2e.test.mjs | Real native Chromium profiles, real IDB, pinned Web SDK and Auth/Firestore emulators. Full index/bootstrap/repositories, original Save and Cancel controls. UI Google popup/admission is an explicit fixture; transport Auth and Firestore are real emulator SDKs, not mocked network transports. |
| Round trip | Phone -> publication -> previously empty receiver -> computer edit -> phone; automatic commit wake, head-listener receive and online wake, without manual synchronize control. |
| Actual data | Two independently owned investors/projects, nonempty cabinet, real room creation, 14 domains, stock updates, frozen offer, exact unknown field, identical cut-list and labor result 21.375. |
| Offline / editor | Genuine SDK disableNetwork, locally durable edit, online reconciliation, second editor refusal, confirmed handover and stale editor refusal. |
| Draft / crash | Real SIGKILL and same-profile IDB/session recovery; explicit Save after draft resume. Another real SIGKILL after a successful server publication loses its ACK; recovery resolves with independent READ and exactly one WRITE. |
| RAM / Cancel / Exit | A remote catalog cannot replace an active local draft; original cancellation confirmation, unchanged approved RAW/outbox, clean Exit without logout, logout preserving IDB. |
| Security | Foreign UID denied; unbounded head inventory denied; old-writer fence refuses; no automatic LIVE startup. |
| application-authority-store-smoke.js | Real IDB image+outbox atomicity, quota abort rollback, application CAS, duplicate payload binding, SIGKILL persistence and production-name migration refusal. |
| business-project-contract-smoke.js | Whole owned payload/hashes/frozen fields, invalid owner/geometry/references, pending operation, ambiguous RAW, secret exclusion and conflicting alias preservation. |
| application-session-resume-smoke.js | Valid durable proof resume without writes; missing/corrupt proof or replacement of active session refused. |
| project-bootstrap-readonly-smoke.js | Both normalized and missing-default RAM paths perform no implicit Save or stored RAW/timestamp change. |
| empty-installation-browser-smoke.js | Native empty startup, actual investor/room Save, two-investor isolation, logout/reauthentication and document restart. |
| Restored-proof baseline | Existing project-session-restored-proof-smoke: **8/8 PASS**, including missing proof refusal, lost ACK attribution and safe Cancel cleanup. |
| Offline/load order/syntax/diff | Exact generated public asset hashes, coherent offline-shell contract, ordered classic script registration, syntax and scoped diff checks. |

Mandatory routing: `.github/workflows/preflight-js.yml` -> firebase-current ->
`tools/cloud-ci-emulators.js --context=current` -> cloud-sync-global.test.mjs ->
separate top-level application E2E. Existing LOCAL-FIRST 01–08 and all CLOUD-SYNC-1
assertions remain. New *-smoke.js files are automatically discovered by mandatory
Preflight; routing itself has a regression. Historical checkout
`306f90a4cfd8bcb4277aa8b4d140e911493ddd60` and its 425 pins are unchanged.
No workflow, dependency pins, Chromium launcher, business calculator or backup
archive implementation changed. Final changed/new JS/MJS syntax: **21/21 PASS** on Node 22.23.3. New store/contract/resume/readiness/RAM-normalization smoke controls and manifest/load order passed. The targeted empty-installation Chromium check passed on the available host Node 24; the real SDK E2E and final technical controls used pinned Node 22. Full CI and physical Android remain pending.

## Remaining activation conditions, separated by cause

**Code/integration boundary:** this is a controlled application composition, not
an automatic production cutover. All covered synchronous UI callbacks must either
enter its asynchronous transaction boundary or refuse. Their wholesale production
conversion/initialization and offline creation of a brand-new server-unknown
project are not declared complete. Existing, durably owned editor scopes can save
offline and resume. Unsupported construction contracts and ambiguous RAW do not
become supported because transport succeeds. These are concrete remaining code
boundaries, not missing Firebase credentials and not a request for another audit.

**Migration/environment proof:** production activation must demonstrate exclusion
of old/incompatible writers and a lossless versioned source/image handoff. Storage
event detection does not prove that every old device stopped writing. No such
proof or owner-data migration was fabricated. Normal application startup remains
unchanged and cannot activate this composition by a flag.

**LIVE/operator:** existing C/D/E code, executeProduction() refusal, six signed
decisions, private journal/fence/recovery and STOP protocol remain the basis.
No new operator or production launcher. Private host and independent STOP after
loss of the entire primary host still require actual separate availability,
journal/fence recovery, identities and permissions. Original private rollback is
635 B / SHA-256 9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91;
no copy/template was fetched, reconstructed or committed. Historical billingEnabled:false
from the owner's 30.10 evidence was not re-audited. Fresh Rules/read-back,
effective IAM/publishers/exclusivity, Spark/limits and named STOP operator belong
to the separately authorized execution window, not this emulator task.

## Delivery status and next action

Controlled emulator integration is **CODE_READY** for independent review; the entire
production application cutover is explicitly INTEGRATION_PARTIAL. CI_PENDING /
PHONE_PENDING / RELEASE_BLOCKED / LIVE_BLOCKED. Next: review this branch's exact
HEAD/BASE and the mandatory coverage, then obtain a separate approval for one CI
attempt. No PR, Ready/Draft change, workflow invocation, release merge, Pages or
Firebase production operation was performed.

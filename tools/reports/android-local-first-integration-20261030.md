# Android + LOCAL-FIRST — 30.10.2026

BASE/main: f8e452813faaf6cd343704b3952d9501652222d3, verified on GitHub.
Product branch: integration/android-local-first-20261030.
Documentation PR #87 remains separate on docs/current-state-ledger-20261030:
commit c220ac50 (full SHA in final report), only README/DEV, both failed smoke
checks now pass; full archive unchanged. No PR or workflow mutation.

## Implemented

- Investor room rendering is bound to an actual persisted investor and matching
  central record. A transient form cannot display rooms of the previous project.
- A new investor uses a one-use proof captured BEFORE creation: clean RAM,
  no active/durable session marker, exact previous records. Consumption requires
  one new target and unchanged existing records. Its fresh project explicitly
  carries project PCV mode before activation. This is not a bypass for dirty RAM.
- Switching investors no longer implicitly saves the old RAM. Explicit Save/Cancel
  owns that decision. saveActiveProjectToInvestor refuses mismatched RAM ownership.
  open-investor now checks the actual activation result before rendering success.
- Transient forms no longer persist their draft IDs as active investor context.
  Failed investor persistence keeps the editing form instead of committing its
  UI first and dropping the draft. Existing records are not reset or deleted.
- Room status groups have the requested bottom separator. Trust/logout controls
  use consistent type/height in the same row; IDs and accessibility retained.
- sync/application-startup.mjs composes existing IDB, global channel and durable
  coordinator with an explicit access/binding check. No automatic LIVE startup,
  ADC, authentication, data migration or second cloud transport.
- sync/application-session.mjs connects an existing confirmed Save to durable
  submitGlobals/submitProject, reports success only after IDB/outbox acknowledgement,
  refuses active edits/unconfirmed Save/foreign owner, provides checked incoming
  revision and editor acquire/release through existing protocol. No default
  localStorage apply exists: without a transactional host adapter receive refuses.
- application-sync-actions.js provides an inert installation point in the existing
  shell. Existing Save is unchanged unless a controller was explicitly installed.
  Auth lock/logout closes installed synchronization and store handles, without
  removing data, pending outbox or session RAM. No PIN or new sync button.

## Exact remaining integration boundaries — NOT production ready

The existing CLOUD-1B/2B project transport accepts a closed synthetic profile.
We did NOT label real application projects as synthetic, widen historical
validators or bypass the production gate. The added application composition is
usable for the existing supported test/global flow, not a claim that normal
startup now synchronizes the owner's devices. Complete live application startup
remains disabled: source migration/authority activation was explicitly excluded
from this task's execution authorization.

Issue #47 still identifies grain/rotation by a global material/geometry signature,
not a physical project/room/cabinet/part identity. Matching dimensions do not prove
which historical physical parts the user meant. Existing source refs/PCV addresses
can define future individual edits, but cannot losslessly assign old global
values retroactively. No private value is discarded or assigned arbitrarily.
The existing LF_PROJECT_OWNERSHIP_PENDING guard remains for these RAW and history/
drafts until a complete real-project profile with explicit ownership is approved.
Frozen offers already have project IDs; draft fallback by investor alone and
unscoped historic grain still require explicit rules. Preserve all originals.

The missing source migration cannot be replaced by copying localStorage into IDB
and claiming atomicity: existing synchronous writers must first be routed through
an approved transactional application repository, including old open tabs. This
package prepares the async Save seam but does not claim that all catalog setters,
Cancel, drawing mutations and automatic remote projection have been migrated.
Receiving values is staged/validated; no automatic overwrite of current catalogs,
projects, history, backup archive or uncommitted RAM was introduced.

## First LIVE and independent STOP

Reuse cloud46e-connection at the previously verified historical checkout, with
425 pins unchanged. Do not patch executeProduction or run inventory from a changed
main and rewrite pins. Private runtime, key and 635-byte rollback were already
prepared by the owner; do not reinstall/regenerate. Billing 30.10: owner confirms
billingEnabled:false and no linked account. This is recorded evidence, not a new GET.

Before an authorized attempt: choose named runtime/STOP/verifier contexts, private
in-memory credential delivery, journal location and independent protected copy.
After lost ACK: preserve revision/attempt and use independent READ; never retry WRITE.
After process loss: existing recoverAuthorizedConnection requires the same durable
journal and a fresh signed recover-stop bundle; it never reopens stage/activate/WRITE.

A second host alone does not provide safe failover. The current fence is a same-host
file; copying it elsewhere cannot stop a still-running administrator. Before using
recovery on another host the operator must positively stop/fence the original host,
obtain the complete latest journal/admin-inflight evidence, preserve uncertain RPCs,
and retain independent OAuth access. Pending admin RPC or stale/missing journal
means STOP_UNCONFIRMED, not permission to clear markers or start a new attempt.
If those conditions cannot be established, an authorized administrator must use a
separately reviewed emergency procedure for the exact control docs, existing CAS,
maxAttempts:1 and independent server verification. Do not invent a recovery receipt.
This environment has no such production credentials or independent durable host.
That execution/failover stage is BLOCKED, not LIVE_PASS. No replacement protocol
or production request was run. Fresh Rules/account/exclusion checks belong just
before the separately authorized operation (existing 5 s/5 min bounds).

Six separate signed scopes remain required: read-production-state,
deploy-minimal-rules, stage-activate-grant, synthetic-write, independent-read,
administrative-stop. Protect original 635 B with SHA-256
9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91;
never replace it with the repository 755-byte template.

## Verification plan

Mandatory Preflight discovers android-investor-isolation-smoke and
application-session-smoke plus existing navigation/session/Auth/offline checks.
Existing empty-installation-browser-smoke now includes two-investor creation,
logout/reauthentication and restart with actual Chromium gestures.
Existing SDK entry cloud-sync-global.test.mjs awaits local-first.test.mjs:
new LOCAL-FIRST 08 exercises the application boundary with real browser IDB and
Auth/Firestore emulators; original seven scenarios and all old assertions retained.
No workflow, Rules, historic pins, calculator, package or dependencies changed.

## Actually executed targeted checks (Node 22.23.3)

- PR87 client-offer-preview and pricing-modes-calculation-coverage: PASS each;
  no archive changes, no assertions removed, no full Preflight.
- android-investor-isolation: PASS, including foreign RAM refusal and failed
  investor persistence retaining the draft. Reproduced foreign rooms before fix.
- empty-installation-browser: PASS in native Chromium 151, 393x852, original
  empty/startup/catalog/room Save plus second investor, unchanged first project,
  deliberate logout, reauthentication and document restart. An initial failure
  was the old fixture deliberately throwing `No test logout`; it now supports
  the explicit logout and asserts exactly one call. No production Auth weakened.
- application-session smoke: PASS, Save refusal/active edit/receive CAS and
  inert installation/close. application-session-browser: PASS on REAL Chromium
  IDB across process restart, complete 14-domain data/outbox and guarded receipt;
  remote channel is explicitly in-memory, NOT Firebase/Rules evidence.
- investor-navigation-exit: 13/13; empty-installation model 5/5;
  project-session-owner-rollback 26/26; restored-proof 8/8 PASS.
- trusted-main-login 4 groups; trusted-ci-readiness 6 groups;
  project-false-edit-session and investor-project-boot-source-truth: PASS.
- offline-shell 2 groups PASS before final resource update; exact generated
  manifest is checked again with final syntax/load order/diff controls.
- New SDK LOCAL-FIRST 08 prepared and syntax checked, NOT executed locally.
  Existing scenarios 01-07/CLOUD-3/C-D-E unchanged, not rerun. Full release CI,
  emulator suite and physical Android remain PENDING for the resulting SHA.

The application composition modules are now included in the versioned offline
asset inventory, without activation or caching any credentials/private response.
Old source keys and backups are unchanged. No Rules/IAM/billing/migration/LIVE.

## Final boundary and next action

Android repair and the described composition/Save seam are implemented. The
ENTIRE requested product integration is NOT complete: continuous production
startup, all synchronous catalog/drawing setters as IDB authority, complete
real-project/history ownership/receive projection and independent-host STOP
still lack the conditions explained above. No CODE_READY for full automatic
production synchronization and no claim that a real phone is now synchronized.
Status: IMPLEMENTATION_PARTIAL / CI_PENDING / PHONE_PENDING / RELEASE_BLOCKED /
LIVE_BLOCKED. Next: independent review of both branch HEADs and exact BASE; only
then a separately approved CI attempt. Remaining product authority and host
failover work must use these existing seams, not another transport or fake grant.

# PR #84 — LOCAL-FIRST 03–06 repair

Input HEAD: `1cb27233ad9c6b59de20315eb4884a0f13b6dd87`.
BASE/main: `149f9a126a85f9972f5fc1cd19afdc264be98cc7`.
Branch: `local-first-sync-durable-20261028`.
Evidence: [Actions #40754318357](https://github.com/mebleszek/meble-app/actions/runs/40754318357), `firebase-current` job `123049146943`.

## Confirmed causes and limits of the original evidence

The CI stack identifies the SECOND assertion at line 98, column 91:
`phone.sync.flush().ok`, rather than `submitProject().localConfirmed`.
Acquiring the editor and confirming the IndexedDB commit have already returned.
The original log records only `false !== true`, not the returned refusal code,
IDB snapshot or Firestore response. Browser profiles were not published as CI
artifacts. We do not claim to have recovered those runtime snapshots.

### Missing browser API in the project fixture (03, cascading 04 and 06)

The native fixture supplies `TextEncoder` but not `TextDecoder`. CLOUD-2B's
independent `unpack()` requires `window.TextDecoder` and refuses if it is missing.
Targeted reproduction with the real packer, immutable project bytes and actual
independent transport reader produces **`CLOUD_EXPORT_INVALID`**. Supplying the
real platform decoder reconstructs the exact original document and bytes.

This is a fixture error, not a reason to relax decoding, checksums or Rules.
The causal path in the coordinator is:

1. Local model/outbox commit completes, with the acquired editor and pinned
   complete global revision. `localConfirmed` is true.
2. Project preparation and publication are followed by independent READ.
3. On this READ, the missing API refuses decoding. A completed publication
   cannot yield a verified receipt. The coordinator retains dirty data and the
   outbox (`inflight` → `uncertain`); later cycles only read to resolve it.
4. Scenario 04 correctly refuses handover while that work remains unconfirmed.
5. A fresh device in scenario 06 must receive project A during baseline sync.
   It fails decoding before the ACK/SIGKILL injection is even reached.

The exact CI phase/remote revision was not captured in the old log. The new
failure assertions include only structural local/remote emulator evidence:
result code, local versions/dirty flag, editor, outbox phases/expected receipts
and server heads. They never serialize business JSON, chunks or protected RAW.
The existing single-writer, handover and uncertain-ACK guards remain intact.

### Persisted CAS base rolled back to an older own receipt (05)

There is a separate coordinator defect after the successful scenario 02:
the phone's last own global publication has receipt generation 1, while its
verified incoming base is generation 2 from the computer. A later local edit
correctly records base 2, but `cycle()` unconditionally replaces it with the
receipt of `previousOperation`, reverting CAS to 1. The server at 2 correctly
refuses; the winning-device assertion can fail independently of project READ.
The unresolved project operation from 03 can additionally fail the same flush.

The fix preserves the newer of the already persisted base and the verified
predecessor receipt. It still waits for unresolved predecessors. Missing or
invalid receipts, or different heads at the same generation, refuse before
preparation/publication. This does not fetch/adopt a server head to overwrite
newer work and does not retry a mutation. An actually stale CAS still conflicts
and retains its dirty local model/outbox.

## Files and regression coverage

- `tools/firebase-pilot/cloud-sync-fixture.mjs`: expose the standard decoder in
  the selected native fixture, retaining strict CLOUD-2B unpack behavior.
- `sync/local-first-sync.mjs`: monotonic persisted predecessor-base selection
  with explicit equal-generation conflict refusal.
- `tools/firebase-pilot/local-first.test.mjs`: split the first local/remote
  assertions and add structural diagnostics to positive flush assertions in
  03–06. No expected result is changed. The SIGKILL injection, durable reopen,
  independent READ and `publications === 1` assertions remain unchanged.
- `tools/local-first-project-read-smoke.js`: real CLOUD-2B pack/transport read
  against injected immutable snapshots. Missing decoder reproduces the original
  refusal; the fixed independent reader returns every field and byte exactly,
  despite a different local reader project. Missing/corrupt chunks still refuse;
  no WRITE or native RAW change occurs.
- `tools/local-first-revision-base-smoke.js`: real coordinator with injected
  store/channel, 10 cases: incoming newer base, queued predecessor advancement,
  initial null base, stale CAS retention, contradictory/missing/invalid receipt,
  uncertain predecessor, and read-only inflight/uncertain recovery.
- This report.

Both new `*-smoke.js` files are discovered by existing Preflight. The real
LOCAL-FIRST suite remains nested in the current SDK job. No workflow, Chromium,
production Rules, emulator Rules, historical pin/source, UI or business algorithm
was changed. Scenario bodies 01, 02 and 07 remain byte-for-byte unchanged.

## Executed checks / pending evidence

- Real contract/reader negative and positive reproductions: PASS after supplying
  the actual platform API; corrupt/missing chunk guards remain effective.
- New reader smoke: two targeted groups PASS, using injected snapshots only.
- New coordinator smoke: 10/10 cases PASS, using injected storage/channel only.
- Syntax, diff and unchanged protected scenario/implementation boundaries
  checked for the final package.
- Local real SDK/Rules/Chromium rerun: **BLOCKED**. Firebase modules/CLI are
  unavailable (`MODULE_NOT_FOUND`), and a local listener is denied (`EPERM`).
  No installations or full CI reruns were performed. **0/4 real scenarios 03–06
  re-executed locally**; the injected tests do not establish IDB durability,
  Rules acceptance, real SIGKILL recovery or a real server's transaction outcome.

All seven emulator scenarios (especially project publication/resolve, handover,
stale editor, CAS retention and actual SIGKILL/one-WRITE recovery) plus the existing
regressions remain required for a separately approved new-head CI attempt.
Earlier PASS results are not assigned to this commit.

Implementation **CODE_READY**; verification **CI_PENDING** with local emulator
validation **BLOCKED**; release **RELEASE_BLOCKED**; Firebase **LIVE_BLOCKED**.
No Actions, Draft/Ready, new PR, merge, LIVE operation or data migration performed.

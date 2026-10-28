# PR #84 — LOCAL-FIRST 06: distinguish offline scheduling from actual crash

Input HEAD: `48f7b4d4b9be7ae7c3b9cf23362b2fe04e6c3d25`.
BASE/main: `149f9a126a85f9972f5fc1cd19afdc264be98cc7`.
Branch: `local-first-sync-durable-20261028`.
Evidence: [Actions #40762582635](https://github.com/mebleszek/meble-app/actions/runs/40762582635), `firebase-current` job `123078437873`.

## Cause

The CI failure occurs at the second `openBrowserDevice` (old line 175).
The profile ownership guard correctly refuses another launch while that profile
remains owned. The preceding test asserted only that `flush().ok` was false;
it did not establish whether a publication or browser crash had happened.

`submitGlobals()` automatically schedules synchronization while the fixture is
still offline. An immediate `online=true; flush()` can join that already-running
offline cycle and return **`LF_OFFLINE`**, before the injected publication/crash.
A targeted reproduction with the actual coordinator confirms that result with
zero publications and no injection. Thus the test could advance to profile
reopening with the original browser still running. The old CI log has no crash
counter/receipt evidence; it cannot establish completed SIGKILL or cleanup.

The runtime was inspected: LOCAL-FIRST `stop()` awaits the runtime's crash;
the runtime awaits owned-process termination and requires the subreaper receipt
before deleting its in-memory profile ownership. The Python subreaper handles
SIGUSR2 by SIGKILLing only its descendants, checks process birth identity, reaps
them and writes the receipt after none remain. No confirmed defect requires
changing these guards or the browser process implementation.

## Repair

Only scenario 06 changes in `tools/firebase-pilot/local-first.test.mjs`:

- Reuse its existing `reconnect()` online event instead of changing a flag and
  accepting an unrelated false result. The event wakes an in-progress cycle.
- Explicitly reject `LF_OFFLINE` as the simulated lost ACK.
- Require exactly one completed publication before continuing.
- Retain and await the actual `browser.crash()` promise and require its completion
  before opening the same profile. Cleanup refusal propagates; it is not bypassed.
- Preserve the actual SIGKILL path, durable `initialize:false` reopen, `inflight`
  outbox assertion, independently verified READ recovery, exact model comparison
  and final `publications === 1` assertion.

`tools/local-first-crash-smoke.js` adds two targeted regressions:

1. Actual scheduler with injected store/channel: reproduce the offline false
   result without publication, then require the online event to reach exactly
   one injected post-publication failure. This is not a browser-crash claim.
2. Actual runtime/supervisor/profile ownership with a real controlled Python
   process. Only the browser/DBus command and CDP responses are injected; no
   production injection switch is added. Concurrent profile reuse refuses before
   spawn. Hard shutdown/reaping and the existing receipt release ownership,
   allowing one explicit reopen of the same profile. `/proc` confirms process
   termination; a TERM handler does not run. Synthetic `SingletonLock` and retained
   bytes survive shutdown/reopen. The synthetic directory is discarded only after
   successful final cleanup, never to force profile reuse.

Existing Preflight discovers this `*-smoke.js` automatically. No workflow edit,
global pkill, SingletonLock deletion, startup retry, forced profile cleanup,
synchronizer/CAS/Rules change, or change to scenarios 01–05/07 was made.

## Verification and remaining gate

- New scheduler regression: PASS, including the negative original sequence.
- New real controlled-process/profile regression: PASS, both launches terminated
  and reaped with cleanup confirmation; lock and sentinel unchanged during reuse.
- Syntax of the two JS/MJS files, exact scenario-change boundary and diff checked.
- Actual Chromium/IndexedDB/Firebase scenario 06: **BLOCKED locally, 0/1 rerun**.
  Firebase dependencies are unavailable (`MODULE_NOT_FOUND`) and the local fixture
  listener is denied (`EPERM`). The controlled-process test does not prove browser
  IndexedDB durability or a real Firebase transaction/recovery outcome.
- Scenario 06 and existing regressions remain required in separately authorized
  CI for the new HEAD. Earlier PASS results are not assigned to the new commit.

Implementation **CODE_READY**; CI **CI_PENDING**; release **RELEASE_BLOCKED**;
Firebase **LIVE_BLOCKED**. No Actions, Draft/Ready, PR, merge, Pages, LIVE,
production Rules publication or migration was performed.

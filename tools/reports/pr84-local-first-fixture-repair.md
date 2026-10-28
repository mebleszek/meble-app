# PR #84 — LOCAL-FIRST fixture lifecycle repair

Input HEAD: `ce24b22b4c29bf763f8148e8cc4893c7fb5b95c2`.
BASE/main: `149f9a126a85f9972f5fc1cd19afdc264be98cc7`.
Branch: `local-first-sync-durable-20261028`.
Evidence: [Actions #40751436599](https://github.com/mebleszek/meble-app/actions/runs/40751436599), job `firebase-current` (`123038993242`).

## Confirmed causes

`cloud-sync-global.test.mjs` installs a file-level `beforeEach` that clears
Firestore. Node 22 inherits that hook into the seven `t.test()` children of
`runLocalFirstSuite`. LOCAL-FIRST creates its Auth clients, administrative grant
and browser stores once, then deliberately runs a sequential lifecycle across
those children. The inherited hook deletes that remote fixture before every
child. IndexedDB survives, so the local and remote halves cease to agree.

A targeted reproduction using real `node:test` hooks confirmed that the hook
runs for the parent and each child, with `fullName` distinguishing their scope.

There is also a distinct native fixture-context error in scenario 07: `device`
requests project B but constructs the default fixture with active project A,
investor `inv-A` and project-A RAM. The failure at line 164 is `doc.ok`, not
`reconnect.ok`. A separate native exporter reproduction returns
`EXPORT_CONTEXT_MISMATCH` for B and succeeds for A. The strict exporter is
correct; the synthetic selection must be made coherent before the test.

| Failed scenario | Effect of the destructive inherited reset |
|---|---|
| 01 phone → computer | Removes the grant created before the children; the first flush refuses access. |
| 02 computer → phone | No successful first publication/baseline; remote grant is deleted again. |
| 03 one editor | L193 is `allow get: if globalApproved(uid)` on `localFirstEditors`; its grant lookup is null after the reset. Denial is correct. |
| 04 handover | Scenario 03 never acquired/published the editor state; the local handover guard correctly refuses. |
| 05 CAS | No coherent preceding server baseline/grant for the two devices. |
| 06 lost ACK/restart | The new device creates its grant inside the child, but prior publications were deleted. An empty-server flush may succeed without creating a replica; dereferencing its `json` then fails. |
| 07 dependency/RAW | Separate fixture mismatch: project B is requested while the current project/investor/RAM still belongs to A; the native builder correctly refuses at line 164. |

These are test-fixture lifecycle errors and cascading prerequisites, not evidence
that the business assertions, CAS or access Rules should be relaxed.

## Repair and regression

- `tools/firebase-pilot/cloud-sync-fixture.mjs`: `topLevelFixture` wraps setup and
  teardown hooks, requiring a known Node test context. It invokes the hook only
  when `fullName === name`. Unknown context refuses before destructive setup.
  `selectProjectFixture` establishes the synthetic active project, its actual
  investor and RAM through native APIs; it does not alter stored business RAW.
- `tools/firebase-pilot/cloud-sync-global.test.mjs`: both existing per-case hooks
  use that boundary. Independent top-level tests retain reset/cleanup; nested
  LOCAL-FIRST children use their own existing setup/`t.after` lifecycle.
- `tools/local-first-fixture-hooks-smoke.js`: actual Node hook inheritance with
  synthetic lifecycle state; seven children and a deeper child retain their
  state, the next top-level case resets, cleanup occurs once per root, unknown
  context refuses. Also checks both SDK hook registrations use the tested guard.
  A native project-B export regression first proves context mismatch is still
  rejected, then verifies the coherent fixture exports B without mutating
  business RAW/RAM. Missing project selection also refuses without writes.
  Existing Preflight automatically discovers this `*-smoke.js`; no CI edit.
- `tools/firebase-pilot/local-first.test.mjs`: the device factory uses the
  coherent selection helper for its requested synthetic project.

All seven LOCAL-FIRST scenario bodies and their assertions are byte-for-byte unchanged.
All previous CLOUD-SYNC-1 test bodies are unchanged. No production code, IDB
schema, outbox, transport, editor/ACK protocol, Rules, historical pins, Chromium
runtime, workflow, UI or real data changed.

## Verification and remaining evidence

- Node 22.23.3 targeted inheritance reproduction: confirmed the destructive
  parent-hook behavior without Firebase.
- New fixture regression: **10/10 tests PASS**, zero failures/skips/cancellations.
  Additional native project-B context/export checks in the same smoke also PASS.
- Syntax of four changed JS/MJS files and diff checked.
- Local SDK resolution: `firebase/app`, `@firebase/rules-unit-testing` and
  `firebase-tools` unavailable (`MODULE_NOT_FOUND`). Local fixture listener:
  `listen EPERM`. No installations or full CI/test reruns attempted.
- Actual Auth/Firestore/Chromium LOCAL-FIRST rerun: **BLOCKED locally, 0/7
  executed for this repair**. The synthetic lifecycle test is not an emulator
  or offline-durability PASS. All seven real scenarios, including full values,
  14 domains, CAS, handover, RAW and one-WRITE recovery, remain required in the
  existing Firebase CI job after separately approved Ready/CI.

The approved CI run's earlier PASS results are historical evidence only, not
new-head PASS. Implementation **CODE_READY**; validation **CI_PENDING** (real
emulator verification locally **BLOCKED**); release **RELEASE_BLOCKED**;
Firebase **LIVE_BLOCKED**. No Actions, Draft/Ready, PR, merge, deployment or LIVE
operation was performed by this repair.

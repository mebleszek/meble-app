// Isolated operator. The only accepted transport is the fixed demo adapter.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import gate from './cloud44-gate2.js';
import pilot from './cloud42-package.js';
import proof from './cloud46c-proof.js';
import {assertDemoTransport} from './cloud46c-demo-transport.mjs';
const attempts = new Set();
// Emulator-only crash fence; never a production journal or an IAM lock.
function claimAttempt(key) {
  const directory = '/tmp/meble-cloud46c-demo-attempts-v1';
  try { fs.mkdirSync(directory, {mode: 0o700}); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) fail('JOURNAL_UNSAFE');
  const name = createHash('sha256').update(key).digest('hex');
  let file;
  try {
    file = fs.openSync(directory + '/' + name, 'wx', 0o600);
    fs.writeFileSync(file, 'EMULATOR_ATTEMPT_CONSUMED\n'); fs.fsyncSync(file);
    const parent = fs.openSync(directory, 'r');
    try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
  } catch (e) { if (e.code === 'EEXIST') fail('ATTEMPT_CONSUMED'); throw e; }
  finally { if (file !== undefined) fs.closeSync(file); }
}
const fail = code => { throw Error('CLOUD46C_' + code); };
export function openDemoExecutor({transport, evidence, timeoutMs = 8000} = {}) {
  assertDemoTransport(transport);
  const reviewed = proof.reviewDemoEvidence(evidence);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000) fail('TIMEOUT_INVALID');
  transport.assertBinding(reviewed.uid);
  const attemptKey = reviewed.projectId + '/' + reviewed.uid + '/' + reviewed.attemptId;
  if (attempts.has(attemptKey)) fail('ATTEMPT_CONSUMED');
  claimAttempt(attemptKey);
  const operator = gate.openDemoOperator({projectId: reviewed.projectId, origin: 'http://127.0.0.1:18080', expiresAt: reviewed.expiresAt});
  attempts.add(attemptKey); // Never released, even after an uncertain acknowledgement.
  let started = false, stopPromise, interrupted = false;
  let interrupt;
  const stopSignal = new Promise(resolve => { interrupt = resolve; });
  const pending = new Set();
  async function bounded(operation, {stopping = false} = {}) {
    let timer;
    // Keeping the raw promise alive also keeps the existing operator lock while
    // an administrative/client RPC can still finish. No background continuation.
    const task = Promise.resolve().then(operation);
    pending.add(task);
    task.then(() => pending.delete(task), () => pending.delete(task));
    try {
      return await Promise.race([task,
        new Promise((_, reject) => { timer = setTimeout(() => reject(Error('CLOUD46C_TIMEOUT_RESULT_UNCERTAIN')), timeoutMs); }),
        ...(!stopping ? [stopSignal.then(() => fail('STOP_DURING_AWAIT'))] : [])]);
    } finally { clearTimeout(timer); }
  }
  async function checkpoint() {
    if (interrupted) fail('STOP_DURING_AWAIT');
    proof.reviewDemoEvidence(reviewed);
    transport.assertBinding(reviewed.uid);
    await bounded(() => transport.verifyRules());
    if (interrupted) fail('STOP_DURING_AWAIT');
    transport.assertBinding(reviewed.uid);
  }
  function stop() {
    if (stopPromise) return stopPromise;
    interrupted = true; interrupt();
    // STOP uses independent administration, never waits for a hung client and
    // does not require the client lease or a still-valid operation deadline.
    stopPromise = (async () => {
      const stopped = operator.stop(async () => {
        const current = await transport.readAdminState();
        await transport.apply(pilot.stopAction({uid: reviewed.uid, ...current}));
      });
      await bounded(() => stopped, {stopping: true});
      await bounded(() => operator.verifyStop(async () => {
        // A late stage/activate/WRITE must settle before STOP can be certified.
        if (pending.size > 1) return false;
        return transport.verifyStop();
      }), {stopping: true});
      return {status: 'STOP_VERIFIED'};
    })();
    return stopPromise;
  }
  return Object.freeze({
    inspect: () => ({...operator.inspect(), started, pending: pending.size, automaticRetry: false, productionExecutionAllowed: false}),
    stop,
    async run() {
      if (started || interrupted) fail('ATTEMPT_CONSUMED');
      started = true;
      let written, read, error, stopError;
      try {
        await checkpoint();
        const current = await bounded(() => transport.readAdminState());
        const actions = pilot.grantActions({uid: reviewed.uid, ...current});
        await bounded(() => operator.stage(() => transport.apply(actions.stage)));
        await checkpoint();
        await bounded(() => operator.activate(() => transport.apply(actions.activate)));
        await checkpoint();
        written = await bounded(() => operator.write({execute: () => transport.write(reviewed)}, {role: 'write'}));
        // Failed/uncertain WRITE remains a refusal. Only the independent read
        // can diagnose the result; it never authorizes another WRITE.
        await checkpoint();
        read = await bounded(() => operator.read({execute: () => transport.read(reviewed)}, {role: 'read'}));
        await checkpoint();
        if (pilot.readDecision(written, read).status !== 'VERIFIED_SYNTHETIC_STATE') fail('READBACK_UNCONFIRMED');
        if (written?.ok !== true || !/^[a-f0-9]{32}$/.test(written.revisionId || '')) fail('WRITE_RESULT_UNCERTAIN');
      } catch (e) { error = e.message; }
      finally {
        try { await stop(); } catch (e) { stopError = e.message; }
        // These are private handles; closing never signs out shared Auth or
        // terminates a caller-owned connection. STOP precedes client cleanup.
        try { await bounded(() => transport.close(), {stopping: true}); }
        catch (e) { stopError ||= e.message; }
      }
      return {status: !error && !stopError ? 'DEMO_CYCLE_VERIFIED' : 'STOP_REVIEW_REQUIRED',
        productionExecutionAllowed: false, retryWrite: false,
        writeConfirmed: written?.ok === true, independentReadConfirmed: read?.ok === true,
        revisionId: read?.revisionId || null, error: error || null, stopError: stopError || null,
        stopVerified: operator.inspect().state === 'STOP_VERIFIED' && !stopError};
    }
  });
}
// There is no production adapter, launcher, target switch or executable CLI.
export const executeProduction = gate.executeProduction;

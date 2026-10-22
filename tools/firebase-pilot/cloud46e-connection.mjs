// Private operator API. Importing starts no SDK, remote IO or authentication.
// executeProduction() remains the legacy unconditional refusal.
import fs from 'node:fs';
import path from 'node:path';
import authority from './cloud46e-authority.js';
import contract from './cloud46d-contract.js';
import journalApi from './cloud46d-journal.js';
import gate from './cloud44-gate2.js';
import fence from './cloud46e-fence.js';
import {connectNative, checkCredentials, checkRecoveryCredentials} from './cloud46e-native.mjs';
import {bindAuthorizedRuntime} from './cloud46e-runtime.mjs';
const fail = code => { throw Error('CLOUD46E_' + code); };
function review(input, action) {
  const capability = authority.reviewAuthorization(input);
  if (capability.bundle.action !== action) fail('ACTION_NOT_APPROVED');
  (action === 'cycle' ? checkCredentials : checkRecoveryCredentials)(input.credentials, input.runtimeDirectory);
  // Resolve the physical path; the existing journal rejects symlink components.
  if (!path.isAbsolute(input.privateDirectory || '') || /^\/(?:tmp|var\/tmp)(?:\/|$)/.test(input.privateDirectory)) fail('DURABLE_PRIVATE_DIRECTORY_REQUIRED');
  return capability;
}
function rulesReader(credential) {
  return new Function(fs.readFileSync(new URL('./cloud46d-rules-reader.js.txt', import.meta.url), 'utf8') + '\nreturn createRulesReader;')()(credential, fetch);
}
function storeAuthority(directory, capability, ownerKeySha256) {
  const evidence = capability.bundle.intent;
  const name = contract.sha(contract.canonical({projectId: evidence.projectId, database: evidence.database,
    uid: evidence.uid, projectIdInData: contract.TARGET.projectIdInData}));
  const fd = fs.openSync(path.join(directory, name + '.authority.json'),
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try {
    fs.writeFileSync(fd, contract.canonical({releaseBase: authority.BASE, executionHead: capability.bundle.executionHead,
      signedBundleSha256: contract.sha(contract.canonical(capability.bundle)),
      ownerKeySha256, decisionIds: evidence.approvals.map(a => a.decisionId), contexts: capability.bundle.contexts}) + '\n');
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  const parent = fs.openSync(directory, 'r'); try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
}
export async function openAuthorizedConnection(input = {}) {
  const capability = review(input, 'cycle'), evidence = capability.assert(), journal = journalApi.createJournal(input.privateDirectory);
  // Consume the fixed synthetic scope durably BEFORE authentication or remote IO.
  journal.claim(evidence);
  let native;
  try {
    storeAuthority(input.privateDirectory, capability, input.ownerKeySha256);
    native = await connectNative({...input, capability});
    let claimedByCycle = false;
    const cycleJournal = {...fence.fencedJournal(input.privateDirectory, evidence, journal), claim(value) {
      if (claimedByCycle || contract.canonical(value) !== contract.canonical(evidence)) fail('ATTEMPT_CONSUMED');
      claimedByCycle = true;
    }};
    const proof = {reviewDemoEvidence(value) {
      capability.assert(); native.assertCredentials();
      if (contract.canonical(value) !== contract.canonical(evidence)) fail('INTENT_CHANGED');
      return structuredClone(evidence);
    }};
    const runtime = await bindAuthorizedRuntime({capability, options: native.options, firestore: native.firestore, journal: cycleJournal,
      proof, readOfficialRules: rulesReader(native.rulesCredential), expectedRules: capability.bundle.expectedRules});
    const executor = runtime.open({transport: runtime.transport, evidence});
    return Object.freeze({inspect: executor.inspect, stop: executor.stop,
      async run() {
        // All failures after opening are owned by the existing cycle's finally/STOP.
        const result = await executor.run();
        const safe = value => value === null ? null : /^CLOUD[0-9A-Z_]+$/.test(value || '') ? value : 'CLOUD46E_REMOTE_RESULT_UNCERTAIN';
        return {...result, error: safe(result.error), stopError: safe(result.stopError), status: result.status === 'DEMO_CYCLE_VERIFIED' ? 'SYNTHETIC_CYCLE_VERIFIED' : result.status,
          productionExecutionAllowed: false}; // Receipt is never authorization for another run.
      },
      async close() {
        // Never shut down the administrator or journal while an RPC can still settle.
        if (executor.inspect().pending || executor.inspect().state !== 'STOP_VERIFIED') fail('STOP_OR_PENDING_REVIEW_REQUIRED');
        journal.close(); await native.close();
      }});
  } catch (error) {
    journal.close(); if (native) await native.close();
    if (/^CLOUD[0-9A-Z_]+$/.test(error?.message || '')) throw error;
    fail('CONNECTION_REFUSED_SCOPE_CONSUMED');
  }
}
// Restart path intentionally has no stage, activate, WRITE or run method.
export async function recoverAuthorizedConnection(input = {}) {
  const capability = review(input, 'recover-stop'), evidence = capability.assert();
  const original = journalApi.inspectJournal(input.privateDirectory, evidence);
  if (original.binding.attemptId !== evidence.attemptId || original.binding.packageSha256 !== evidence.packageSha256) fail('RECOVERY_BINDING_MISMATCH');
  // Exclusive recovery claim, fsynced before any RPC; a crash never permits blind retry.
  const files = fence.names(input.privateDirectory, evidence);
  const fd = fs.openSync(files.recovery,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  const record = value => { fs.writeFileSync(fd, contract.canonical(value) + '\n'); fs.fsyncSync(fd); };
  record({kind: 'RECOVERY_INTENT', journalHash: original.events.at(-1).hash,
    signedBundleSha256: contract.sha(contract.canonical(capability.bundle)), retryWrite: false});
  const directoryFd = fs.openSync(input.privateDirectory, 'r');
  try { fs.fsyncSync(directoryFd); } finally { fs.closeSync(directoryFd); }
  let native;
  const pending = new Set();
  async function bounded(phase, operation) {
    const task = Promise.resolve().then(operation); pending.add(task);
    task.then(() => pending.delete(task), () => pending.delete(task));
    let timer;
    try { return await Promise.race([task, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('CLOUD46E_RECOVERY_' + phase + '_TIMEOUT_UNCERTAIN')), 8000);
    })]); } finally { clearTimeout(timer); }
  }
  try {
    const {connectRecoveryNative} = await import('./cloud46e-native.mjs');
    native = await connectRecoveryNative({...input, capability});
    const candidate = (await import('./cloud46d-candidate.js')).default;
    const pilot = (await import('./cloud42-package.js')).default;
    const admin = new Function('contract', 'pilot', candidate.connectionSources().admin + '\nreturn {readDemoState, applyDemoAction, verifyDemoStop};')(contract, pilot);
    // STOP remains independent of a writer, client lease, or changed Rules.
    const current = await bounded('READ_STATE', () => admin.readDemoState(native.adminDb, evidence.uid));
    await bounded('STOP', () => admin.applyDemoAction(native.adminDb, pilot.stopAction({uid: evidence.uid, ...current}), evidence.uid));
    record({kind: 'STOP_ACKNOWLEDGED', retryWrite: false});
    const flags = await bounded('FLAGS', () => admin.verifyDemoStop(native.stopVerifierDb, evidence.uid));
    const denied = await bounded('DENIAL', () => native.verifyDenied());
    if (!flags || !denied || fs.existsSync(files.administrative)) fail('STOP_UNCONFIRMED_PENDING_ADMIN_REVIEW');
    const result = {kind: 'STOP_VERIFIED', retryWrite: false, writeOutcome: 'REVIEW_OR_INDEPENDENT_READ_REQUIRED',
      revisionId: original.events.find(row => row.kind === 'REVISION_PREPARED')?.receipt?.revisionId || null};
    record(result); return result;
  } catch (e) {
    const reason = /^CLOUD[0-9A-Z_]+$/.test(e?.message || '') ? e.message : 'CLOUD46E_RECOVERY_REMOTE_RESULT_UNCERTAIN';
    record({kind: 'RESULT_UNCERTAIN', reason, retryWrite: false}); throw Error(reason);
  }
  finally { fs.closeSync(fd); if (native && !pending.size) await native.close(); }
}
export const executeProduction = gate.executeProduction;

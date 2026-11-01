import {test, mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import c from './cloud46d-contract.js';
import review from './cloud46f-evidence.js';
import recovery from './cloud46f-recovery.js';
import journalApi from './cloud46d-journal.js';
import fence from './cloud46e-fence.js';
import gate from './cloud44-gate2.js';
import context from '../cloud-ci-context.js';
import history from './cloud46f-history.js';
import {fixture} from './cloud46f-fixture.mjs';
import {inventory, executeProduction, recoverProduction, preparePrivateLaunch} from './cloud46f-operator.mjs';
function makeJournal(f, directory) {
  const j = journalApi.createJournal(directory); j.claim(f.binding);
  fs.writeFileSync(recovery.paths(directory, f.binding).authority, c.canonical({executionHead: f.executionHead,
    signedBundleSha256: 'b'.repeat(64)}), {mode: 0o600});
  return j;
}
function restore(f, capsule, directory, changes = {}) {
  return recovery.restoreCheckpoint(f.seal(capsule, recovery.DOMAIN), {directory, binding: f.binding,
    executionHead: f.executionHead, checkpointSha256: c.sha(c.canonical(capsule)),
    trustFile: f.trustFile, fingerprint: f.fingerprint, ...changes});
}
test('4.6F imports/launcher/flags cannot activate production or touch remote resources', async () => {
  let calls = 0;
  const fetch = mock.method(globalThis, 'fetch', () => { calls++; throw Error('network'); });
  try {
    assert.equal(inventory().productionExecutionAllowed, false);
    assert.equal(executeProduction, gate.executeProduction);
    for (const input of [{}, {approved: true, live: true}, {credentials: {}, target: 'production'}]) {
      assert.throws(() => executeProduction(input), /PRODUCTION_EXECUTION_DISABLED/);
      assert.throws(() => recoverProduction(input), /PRODUCTION_EXECUTION_DISABLED/);
      assert.throws(() => preparePrivateLaunch(input), /CLOUD/);
    }
    assert.equal(calls, 0);
    const current = context.sdkPlan(new URL('../..', import.meta.url).pathname).find(g => g.context === 'current');
    assert.ok(current.files.includes('live-readiness.test.mjs'));
    const registration = fs.readFileSync(new URL('./live-readiness.test.mjs', import.meta.url), 'utf8');
    assert.ok(registration.includes("import {registerRecoveryCases} from './cloud46f-recovery.cases.mjs'"));
    assert.ok(registration.includes('registerRecoveryCases({environment: () => env, client, uid: UID,'));
    for (const filename of ['index.html', 'js/main-login.js', 'js/app.js'])
      assert.equal(fs.readFileSync(new URL('../../' + filename, import.meta.url), 'utf8').includes('cloud46f'), false);
  } finally { fetch.mock.restore(); }
});
test('4.6F complete signed supplied evidence is explicitly NOT a live proof or approval', () => {
  const f = fixture();
  try {
    const result = review.reviewEvidence(f.seal(f.payload), f);
    assert.equal(result.status, 'SUPPLIED_EVIDENCE_COMPLETE_ONLY');
    assert.equal(result.executionAllowed, false); assert.equal(result.authenticatedProductionObservation, false);
    const bad = f.seal(f.payload); bad.payload.uid = 'foreign';
    assert.throws(() => review.reviewEvidence(bad, f), /SIGNATURE_INVALID/);
    assert.throws(() => review.reviewEvidence(f.seal(f.payload), {...f, artifactBytes: {...f.artifactBytes, iam: Buffer.from('changed')}}), /BYTES_MISMATCH/);
    assert.throws(() => review.reviewEvidence(f.seal(f.payload), {...f, fingerprint: '0'.repeat(64)}), /KEY_MISMATCH/);
  } finally { f.close(); }
});
test('4.6F missing closure/delegation/publisher/state/Rules/independent-host evidence refuses even signed claims', () => {
  const f = fixture();
  try {
    const changes = [p => p.projectId = 'foreign', p => p.database = 'foreign', p => p.uid = '', p => p.observedAt = f.now - 300001,
      p => p.exclusion.coverage.pop(), p => delete p.exclusion.noUnknownPublisherRef,
      p => p.exclusion.publishers[0].control = 'unknown', p => p.exclusion.paths.pop(),
      p => p.exclusion.paths[0].publisherIds = ['foreign'], p => p.exclusion.delegations.push({from: 'foreign', to: 'synthetic-owner', evidenceRef: 'iam'}),
      p => p.exclusion.windowEnd = f.now, p => p.exclusion.monitorRef = 'absent',
      p => p.rules.checkpoints[1].ruleset += '-changed', p => p.rules.checkpoints[1].sourceSha256 = '0'.repeat(64),
      p => p.rules.checkpoints[0].at -= 6000, p => p.rules.checkpoints.pop(),
      p => p.stateCheckpoints[1].sha256 = '0'.repeat(64), p => p.stateCheckpoints.pop(),
      p => p.contextIds.reader = p.contextIds.writer,
      p => p.hosts.recovery.id = p.hosts.primary.id, p => p.hosts.recovery.failureDomain = p.hosts.primary.failureDomain,
      p => p.hosts.recovery.fenceMethod = 'second-local-process', p => delete p.hosts.recovery.replicaRef,
      p => delete p.hosts.recovery.credentialsRef, p => delete p.hosts.recovery.rehearsalRef];
    for (const change of changes) {
      const value = structuredClone(f.payload); change(value);
      assert.throws(() => review.reviewEvidence(f.seal(value), f), /CLOUD46F_/);
    }
    const noArtifacts = {...f.payload, artifacts: []};
    assert.throws(() => review.reviewEvidence(f.seal(noArtifacts), f), /ARTIFACTS_REQUIRED/);
  } finally { f.close(); }
});
test('4.6F private checkpoint survives lost ACK, source loss and restart; no second WRITE', async () => {
  const f = fixture(), source = f.subdir('primary'), destination = f.subdir('secondary');
  const j = makeJournal(f, source); let writes = 0;
  try {
    await j.perform('stage', async () => {}); await j.perform('activate', async () => {});
    await assert.rejects(j.perform('write', async () => { writes++; j.recordRevision('a'.repeat(32)); throw Error('lost ACK'); }));
    j.close(); const capsule = recovery.draftCheckpoint(source, f.binding, f.executionHead);
    const result = restore(f, capsule, destination);
    fs.rmSync(source, {recursive: true}); // Synthetic primary filesystem lost.
    assert.equal(result.hostIndependenceProven, false); assert.equal(result.retryWrite, false);
    const inspected = journalApi.inspectJournal(result.directory, f.binding);
    assert.equal(inspected.events.find(e => e.kind === 'REVISION_PREPARED').receipt.revisionId, 'a'.repeat(32));
    const restarted = journalApi.createJournal(result.directory);
    assert.throws(() => restarted.claim({...f.binding, attemptId: 'retry'}), /ATTEMPT_CONSUMED/); restarted.close();
    const resolution = journalApi.recordRecovery(result.directory, f.binding, {ok: true, sourceMatches: true,
      revisionId: 'a'.repeat(32), documentSha256: f.binding.documentSha256, utf8Bytes: 6797});
    assert.equal(resolution.independentReadMatched, true); assert.equal(resolution.stopVerified, false);
    assert.equal(writes, 1);
    assert.throws(() => restore(f, capsule, destination), /EMPTY_PRIVATE/);
  } finally { j.close(); f.close(); }
});
test('4.6F wrong/stale/tampered checkpoint and partial journal never become usable recovery', () => {
  const f = fixture(), source = f.subdir('primary'), j = makeJournal(f, source); j.close();
  try {
    const capsule = recovery.draftCheckpoint(source, f.binding, f.executionHead);
    for (const changes of [{checkpointSha256: '0'.repeat(64)}, {executionHead: '0'.repeat(40)},
      {binding: {...f.binding, attemptId: 'foreign'}}])
      assert.throws(() => restore(f, capsule, f.subdir('bad-' + Math.random()), changes), /CHECKPOINT_MISMATCH/);
    const broken = structuredClone(capsule); broken.files.journal = broken.files.journal.trimEnd();
    const destination = f.subdir('truncated');
    assert.throws(() => restore(f, broken, destination), /TRUNCATED/);
    assert.equal(fs.existsSync(destination + '/restored'), false);
    assert.throws(() => restore(f, capsule, destination), /EMPTY_PRIVATE/);
    const changed = f.seal(capsule, recovery.DOMAIN); changed.payload.journalHash = '0'.repeat(64);
    assert.throws(() => recovery.restoreCheckpoint(changed, {...f, directory: f.subdir('forged')}), /SIGNATURE_INVALID/);
  } finally { f.close(); }
});
test('4.6F capsule preserves uncertain administrative RPC and already-used recovery fence', () => {
  const f = fixture(), source = f.subdir('primary'), j = makeJournal(f, source); j.close();
  try {
    const files = fence.names(source, f.binding);
    fs.writeFileSync(files.administrative, 'uncertain stage\n', {mode: 0o600});
    fs.writeFileSync(files.recovery, 'uncertain stop\n', {mode: 0o600});
    const capsule = recovery.draftCheckpoint(source, f.binding, f.executionHead), result = restore(f, capsule, f.subdir('secondary'));
    assert.equal(result.adminUncertain, true); assert.equal(result.recoveryAlreadyClaimed, true);
    assert.equal(result.executionAllowed, false);
    assert.equal(fs.readFileSync(fence.names(result.directory, f.binding).administrative, 'utf8'), 'uncertain stage\n');
  } finally { f.close(); }
});

test('4.6F revision replication is acknowledged before WRITE; broken mirror consumes attempt without mutation', async () => {
  const {default: replica} = await import('./cloud46f-replica.js');
  for (const fault of ['none', 'lost-replica-ack', 'async-copy']) {
    const f = fixture(), source = f.subdir('primary'), j = makeJournal(f, source);
    let remoteCopy, writes = 0, broken = false;
    const guarded = replica.replicatedJournal({journal: j, checkpoint: () => recovery.draftCheckpoint(source, f.binding, f.executionHead),
      trustFile: f.trustFile, fingerprint: f.fingerprint, primaryDomain: 'A', recoveryDomain: 'B', recoveryHost: 'secondary',
      replicate(capsule) {
        remoteCopy = capsule;
        if (broken && fault === 'lost-replica-ack') throw Error('synthetic mirror ACK lost');
        const ack = f.seal({checkpointSha256: c.sha(c.canonical(capsule)), journalHash: capsule.journalHash,
          host: 'secondary', failureDomain: 'B', durable: true}, replica.DOMAIN);
        return broken && fault === 'async-copy' ? Promise.resolve(ack) : ack;
      }});
    try {
      await guarded.perform('stage', async () => {}); await guarded.perform('activate', async () => {});
      const operation = guarded.perform('write', async () => {
        broken = fault !== 'none'; guarded.recordRevision('a'.repeat(32));
        assert.ok(remoteCopy.files.journal.includes('REVISION_PREPARED')); writes++;
        return {ok: true};
      });
      if (fault === 'none') { await operation; assert.equal(writes, 1); }
      else { await assert.rejects(operation); assert.equal(writes, 0); }
      j.close();
      assert.equal(journalApi.inspectJournal(source, f.binding).retryWrite, false);
      assert.ok(remoteCopy.files.journal.includes('REVISION_PREPARED'));
    } finally { j.close(); f.close(); }
  }
});


test('4.6F recovery preparation remains independent of Rules/billing/rollback availability', () => {
  const f = fixture();
  try {
    const p = {...f.payload, action: 'recover-stop'};
    delete p.exclusion; delete p.rules; delete p.stateCheckpoints;
    assert.equal(review.reviewEvidence(f.seal(p), {...f, action: 'recover-stop'}).executionAllowed, false);
    assert.throws(() => review.reviewEvidence(f.seal(p), f), /BINDING_INVALID/);
    delete p.hosts.recovery.replicaRef;
    assert.throws(() => review.reviewEvidence(f.seal(p), {...f, action: 'recover-stop'}), /INDEPENDENT_HOST_PROOF_REQUIRED/);
  } finally { f.close(); }
});


test('4.6F signed recovery preparation binds all six decisions, artifacts, four contexts and exact frozen checkout; still cannot run', () => {
  const f = fixture(), {authority, executionHead} = history.loadOperator();
  const fetch = mock.method(globalThis, 'fetch', () => { throw Error('network must never start'); });
  try {
    const e = {...f.payload, action: 'recover-stop', executionHead};
    delete e.rules; delete e.exclusion; delete e.stateCheckpoints;
    const contexts = Object.fromEntries(Object.entries(e.contextIds).map(([role, id]) => [role, {id, email: 'mebleszek@gmail.com'}]));
    const finalChecks = {fastTrack: {sourceManifestSha256: inventory().packageSha256,
      evidenceSha256: c.sha(c.canonical(e)), reviewerFingerprint: f.fingerprint, checkpointSha256: 'c'.repeat(64)}};
    const bundle = authority.unsignedBundle({uid: f.binding.uid, attemptId: f.binding.attemptId,
      expiresAt: Date.now() + 600000, contexts, expectedRules: {}, finalChecks, action: 'recover-stop'});
    for (const a of bundle.intent.approvals) a.signature = f.signBytes(authority.signingBytes(bundle, a.scope, a.decisionId));
    const artifactFiles = Object.fromEntries(Object.entries(f.artifactBytes).map(([id, bytes]) => {
      const file = f.directory + '/' + id + '.artifact'; fs.writeFileSync(file, bytes, {mode: 0o600}); return [id, file];
    }));
    const input = {bundle, trustFile: f.trustFile, ownerKeySha256: f.fingerprint,
      evidenceEnvelope: f.seal(e), evidenceTrustFile: f.trustFile, evidenceFingerprint: f.fingerprint,
      runtimeDirectory: f.directory, artifactFiles, credentials: {expiresAt: Date.now() + 600000,
        stopAccessToken: 'synthetic-stop-not-a-real-token', verifierAccessToken: 'synthetic-verifier-not-a-real-token',
        readerGoogleIdToken: 'synthetic-reader-not-a-real-token'}};
    const before = fs.readdirSync(f.directory);
    const result = preparePrivateLaunch(input);
    assert.equal(result.status, 'OFFLINE_PREPARATION_COMPLETE_ONLY'); assert.equal(result.productionExecutionAllowed, false);
    assert.throws(() => executeProduction(input), /PRODUCTION_EXECUTION_DISABLED/);
    assert.throws(() => recoverProduction(input), /PRODUCTION_EXECUTION_DISABLED/);
    const noReader = structuredClone(input); delete noReader.credentials.readerGoogleIdToken;
    assert.throws(() => preparePrivateLaunch(noReader), /RECOVERY_READER_REQUIRED/);
    const changed = structuredClone(input); changed.bundle.finalChecks.fastTrack.checkpointSha256 = 'd'.repeat(64);
    assert.throws(() => preparePrivateLaunch(changed), /OWNER_SIGNATURE_INVALID/);
    const cycleEvidence = {...f.payload, executionHead};
    const cycle = structuredClone(input); cycle.bundle.action = 'cycle';
    cycle.bundle.finalChecks.fastTrack.evidenceSha256 = c.sha(c.canonical(cycleEvidence));
    cycle.evidenceEnvelope = f.seal(cycleEvidence);
    for (const a of cycle.bundle.intent.approvals) a.signature = f.signBytes(authority.signingBytes(cycle.bundle, a.scope, a.decisionId));
    assert.throws(() => preparePrivateLaunch(cycle), /RULES_EVIDENCE_MISMATCH/);
    assert.deepEqual(fs.readdirSync(f.directory), before, 'preparation cannot claim a trial or write any journal/fence');
    assert.equal(gate.rollbackReadiness(Buffer.alloc(635)).executionAllowed, false);
    assert.equal(gate.rollbackReadiness({byteLength: 635, sha256: '9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91'}).status,
      'BLOCKED_PRIVATE_BYTES_REQUIRED');
  } finally { fetch.mock.restore(); f.close(); }
});


test('4.6F real controlled process SIGKILL leaves fsynced revision and consumed scope', () => {
  const f = fixture(), source = f.subdir('crashed-process');
  try {
    const program = `const api=require(process.argv[3]),j=api.createJournal(process.argv[1]);
      j.claim(JSON.parse(process.argv[2]));
      (async()=>{await j.perform('stage',async()=>{});await j.perform('activate',async()=>{});
        await j.perform('write',async()=>{j.recordRevision('a'.repeat(32));process.kill(process.pid,'SIGKILL');});})();`;
    const child = spawnSync(process.execPath, ['-e', program, source, JSON.stringify(f.binding),
      fileURLToPath(new URL('./cloud46d-journal.js', import.meta.url))], {encoding: 'utf8'});
    assert.equal(child.signal, 'SIGKILL');
    const state = journalApi.inspectJournal(source, f.binding);
    assert.equal(state.events.at(-1).kind, 'REVISION_PREPARED'); assert.equal(state.retryWrite, false);
    const restart = journalApi.createJournal(source);
    try { assert.throws(() => restart.claim(f.binding), /ATTEMPT_CONSUMED/); } finally { restart.close(); }
  } finally { f.close(); }
});

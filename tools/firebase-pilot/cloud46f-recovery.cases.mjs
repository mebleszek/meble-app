// Registered by CURRENT live-readiness suite. Real SDK/Rules, never private keys.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {doc, getDocFromServer, setDoc, disableNetwork, enableNetwork} from 'firebase/firestore';
import {fixture} from './cloud46f-fixture.mjs';
import {recoverDemoStop} from './cloud46f-demo-recovery.mjs';
import recovery from './cloud46f-recovery.js';
import journalApi from './cloud46d-journal.js';
import fence from './cloud46e-fence.js';
import c from './cloud46d-contract.js';
import replica from './cloud46f-replica.js';
function localJournal(f, directory) {
  const j = journalApi.createJournal(directory); j.claim(f.binding);
  fs.writeFileSync(recovery.paths(directory, f.binding).authority,
    c.canonical({executionHead: f.executionHead, signedBundleSha256: 'b'.repeat(64)}), {mode: 0o600});
  return j;
}
function handoff(f, source, capsule = recovery.draftCheckpoint(source, f.binding, f.executionHead)) {
  return recovery.restoreCheckpoint(f.seal(capsule, recovery.DOMAIN), {directory: f.subdir('secondary'), binding: f.binding,
    executionHead: f.executionHead, checkpointSha256: c.sha(c.canonical(capsule)), trustFile: f.trustFile, fingerprint: f.fingerprint});
}
// Keep disabled-rules credentials alive for the entire SDK callback, separately.
async function administrators(env, operation) {
  return env.withSecurityRulesDisabled(a => env.withSecurityRulesDisabled(b => operation(a.firestore(), b.firestore())));
}
export function registerRecoveryCases({environment, client, retire, uid}) {
  test('CLOUD-4.6F real lost ACK -> independent READ -> off-source recovery STOP; one committed revision', async () => {
    const f = fixture(), source = f.subdir('primary'); f.binding.uid = uid;
    const local = localJournal(f, source), mirror = f.subdir('replica'); let lastReplica;
    const j = replica.replicatedJournal({journal: local,
      checkpoint: () => recovery.draftCheckpoint(source, f.binding, f.executionHead),
      trustFile: f.trustFile, fingerprint: f.fingerprint, primaryDomain: 'A', recoveryDomain: 'B', recoveryHost: 'secondary',
      replicate(capsule) {
        const hash = c.sha(c.canonical(capsule)), filename = mirror + '/' + hash + '.json';
        const fd = fs.openSync(filename, 'wx', 0o600);
        try { fs.writeFileSync(fd, c.canonical(capsule)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        fence.syncDirectory(mirror); lastReplica = filename;
        return f.seal({checkpointSha256: hash, journalHash: capsule.journalHash,
          host: 'secondary', failureDomain: 'B', durable: true}, replica.DOMAIN);
      }});
    try {
      const writer = await client(), reader = await client(), p = await writer.borrow(), read = await reader.borrow();
      const prepared = await p.prepare(); assert.equal(prepared.ok, true);
      await j.perform('stage', async () => {}); await j.perform('activate', async () => {});
      let submissions = 0, revision;
      await assert.rejects(j.perform('write', async () => {
        j.recordRevision(prepared.revisionId); submissions++;
        const result = await p.write(); assert.equal(result.ok, true, JSON.stringify(result));
        revision = result.head.currentRevisionId; throw Error('synthetic ACK lost after actual commit');
      }), /ACK lost/);
      const verified = await read.readVerify(); assert.equal(verified.ok, true); assert.equal(verified.sourceMatches, true);
      assert.equal(verified.utf8Bytes, 6797); assert.equal(verified.document.integrity.documentSha256, f.binding.documentSha256); assert.equal(verified.head.currentRevisionId, revision);
      const headPath = 'users/' + uid + '/pilotProjects/cloud4-project-v1';
      const before = (await getDocFromServer(doc(reader.db, headPath))).data();
      j.close(); const capsule = JSON.parse(fs.readFileSync(lastReplica, 'utf8'));
      await retire(writer);
      fs.rmSync(source, {recursive: true}); // Only synthetic primary files; no actual second-host claim.
      const restored = handoff(f, null, capsule);
      const resolution = journalApi.recordRecovery(restored.directory, f.binding, {ok: true, sourceMatches: true,
        revisionId: revision, documentSha256: verified.document.integrity.documentSha256, utf8Bytes: verified.utf8Bytes});
      assert.equal(resolution.independentReadMatched, true);
      await administrators(environment(), async (adminDb, verifierDb) => {
        const result = await recoverDemoStop({directory: restored.directory, binding: f.binding, adminDb, verifierDb, readerDb: reader.db});
        assert.equal(result.status, 'DEMO_STOP_VERIFIED'); assert.equal(result.revisionId, revision);
        assert.equal(result.hostIndependenceProven, false);
        assert.deepEqual((await getDocFromServer(doc(verifierDb, headPath))).data(), before);
        await assert.rejects(recoverDemoStop({directory: restored.directory, binding: f.binding, adminDb, verifierDb, readerDb: reader.db}), /EEXIST/);
      });
      assert.equal(submissions, 1);
      assert.equal((await p.write()).ok, false);
      // No shared/business collection was changed by recovery.
      await environment().withSecurityRulesDisabled(async ctx => {
        assert.equal((await getDocFromServer(doc(ctx.firestore(), 'catalogs', 'sentinel'))).exists(), false);
        const grant = (await getDocFromServer(doc(ctx.firestore(), 'authorizedUsers', uid))).data();
        assert.equal(grant.appEnabled, true); assert.equal(grant.enabled, false);
      });
    } finally { j.close(); f.close(); }
  });
  test('CLOUD-4.6F copied admin-inflight fence vetoes recovery certification before RPC', async () => {
    const f = fixture(), source = f.subdir('primary'); f.binding.uid = uid;
    const j = localJournal(f, source); j.close();
    try {
      fs.writeFileSync(fence.names(source, f.binding).administrative, 'uncertain activation\n', {mode: 0o600});
      const restored = handoff(f, source), reader = await client();
      await administrators(environment(), async (adminDb, verifierDb) => {
        await assert.rejects(recoverDemoStop({directory: restored.directory, binding: f.binding, adminDb, verifierDb, readerDb: reader.db}), /PRIMARY_ADMIN_UNCERTAIN/);
        assert.equal((await getDocFromServer(doc(adminDb, 'authorizedUsers', uid))).data().enabled, true);
        assert.equal(fs.existsSync(fence.names(restored.directory, f.binding).recovery), false);
      });
    } finally { f.close(); }
  });
  for (const failure of ['unprivileged-verifier', 'offline-reader'])
    test('CLOUD-4.6F interrupted STOP verification remains uncertain and consumed: ' + failure, async () => {
      const f = fixture(), source = f.subdir('primary'); f.binding.uid = uid;
      const j = localJournal(f, source); j.close();
      const reader = await client(), extra = await client();
      try {
        const restored = handoff(f, source);
        if (failure === 'offline-reader') await disableNetwork(reader.db);
        await administrators(environment(), async (adminDb, verifierDb) => {
          const options = {directory: restored.directory, binding: f.binding, adminDb,
            verifierDb: failure === 'unprivileged-verifier' ? extra.db : verifierDb, readerDb: reader.db};
          await assert.rejects(recoverDemoStop(options), /STOP_UNCERTAIN/);
          assert.equal((await getDocFromServer(doc(adminDb, 'authorizedUsers', uid))).data().enabled, false);
          const marker = fs.readFileSync(fence.names(restored.directory, f.binding).recovery, 'utf8');
          assert.ok(marker.includes('RESULT_UNCERTAIN')); assert.equal(marker.includes('STOP_VERIFIED'), false);
          await assert.rejects(recoverDemoStop(options), /EEXIST/);
        });
      } finally { if (failure === 'offline-reader') await enableNetwork(reader.db); f.close(); }
    });
  test('CLOUD-4.6F production or shared recovery context rejected before IO or journal mutation', async () => {
    const f = fixture(), source = f.subdir('primary'); f.binding.uid = uid;
    const j = localJournal(f, source); j.close();
    try {
      const reader = await client();
      await administrators(environment(), async (adminDb, verifierDb) => {
        await assert.rejects(recoverDemoStop({directory: source, binding: f.binding,
          adminDb: {app: {options: {projectId: 'mebleszek-meble-app'}}}, verifierDb, readerDb: reader.db}), /DEMO_ONLY/);
        await assert.rejects(recoverDemoStop({directory: source, binding: f.binding, adminDb,
          verifierDb: adminDb, readerDb: reader.db}), /INDEPENDENT_CONTEXTS_REQUIRED/);
        await assert.rejects(recoverDemoStop({directory: source, binding: {...f.binding, uid: 'foreign'}, adminDb,
          verifierDb, readerDb: reader.db}), /READER_IDENTITY_MISMATCH/);
        assert.equal(fs.existsSync(fence.names(source, f.binding).recovery), false);
      });
    } finally { f.close(); }
  });
}

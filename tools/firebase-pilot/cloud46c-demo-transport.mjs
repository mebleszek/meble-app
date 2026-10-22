// Fixed emulator transport. No SDK work on import, injectable SDK or LIVE mode.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import pilot from './cloud42-package.js';
import fixtureRuntime from '../cloud4-pilot-readiness-smoke.js';
import {applyDemoAction, readDemoState, verifyDemoStop} from './cloud44-emulator-admin.mjs';
const transports = new WeakSet();
const fail = code => { throw Error('CLOUD46C_' + code); };
export function assertDemoTransport(value) {
  if (!transports.has(value)) fail('FIXED_DEMO_TRANSPORT_REQUIRED');
}
function assertDb(db) {
  const native = db?._delegate || db;
  if (db?.app?.options?.projectId !== 'demo-meble-app'
    || native?._databaseId?.projectId !== 'demo-meble-app' || native?._databaseId?.database !== '(default)'
    || native?._settings?.host !== '127.0.0.1:18080' || native?._settings?.ssl !== false
    || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080'
    || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099') fail('DEMO_CONNECTION_REQUIRED');
}
export async function createDemoTransport({uid, writer, reader, adminDb, stopVerifierDb} = {}) {
  // Refuse foreign administration before importing SDK or opening any connection.
  assertDb(adminDb); assertDb(stopVerifierDb);
  if (adminDb === stopVerifierDb || adminDb.app === stopVerifierDb.app) fail('INDEPENDENT_CONTEXTS_REQUIRED');
  const f = await import('firebase/firestore');
  const clients = [writer, reader];
  const identities = clients.map(client => client?.authSession?.identity());
  const dbs = clients.map(client => f.getFirestore(client.authSession.verificationContext().app));
  if (new Set([...dbs, adminDb, stopVerifierDb].map(db => db.app)).size !== 4) fail('INDEPENDENT_CONTEXTS_REQUIRED');
  let closed = false;
  const handles = new Set();
  function assertBinding(expectedUid = uid, {access = false} = {}) {
    assertDb(adminDb); assertDb(stopVerifierDb);
    if (expectedUid !== uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid || '')) fail('UID_CHANGED');
    clients.forEach((client, i) => {
      assertDb(dbs[i]);
      const ctx = client.authSession.verificationContext(), who = client.authSession.identity();
      if (ctx.target !== 'emulator' || ctx.app !== dbs[i].app || ctx.auth?.app !== ctx.app
        || ctx.auth.currentUser?.uid !== uid || who.uid !== uid || who.epoch !== identities[i].epoch
        || ctx.emulator?.host !== '127.0.0.1' || ctx.emulator?.port !== 19099
        || ctx.emulator?.firestorePort !== 18080
        || !ctx.auth.emulatorConfig || ctx.auth.emulatorConfig.host !== '127.0.0.1'
        || ctx.auth.emulatorConfig.port !== 19099) fail('UID_OR_AUTH_CHANGED');
      if (access) { client.lease.assert(); if (client.lease.uid !== uid || client.lease.isValid() !== true) fail('ACCESS_REVOKED'); }
    });
  }
  assertBinding();
  const used = {write: false, read: false};
  async function execute(role, evidence) {
    if (closed || used[role]) fail('CLIENT_ATTEMPT_CONSUMED');
    used[role] = true;
    assertBinding(evidence.uid, {access: true});
    const client = role === 'write' ? writer : reader;
    // Reuse the existing native synthetic source and its sealed MemoryStorage.
    // No caller-supplied builder, project data, Storage or SDK is accepted.
    const runtime = fixtureRuntime.source();
    for (const name of ['cloud-pilot-contract', 'firebase-pilot-transport', 'project-cloud-pilot',
      'firebase-pilot-live-transport', 'controlled-project-pilot']) {
      new Function('window', fs.readFileSync(new URL('../../js/app/cloud/' + name + '.js', import.meta.url), 'utf8'))(runtime.s);
    }
    const approval = {version: 1, ownerUid: uid, investorId: 'cloud4-investor-v1', projectId: 'cloud4-project-v1',
      payloadSha256: pilot.inventory().payloadSha256, rulesSha256: evidence.rulesSha256, expiresAt: evidence.expiresAt};
    let handle;
    try {
      handle = await runtime.s.FC.controlledProjectPilot.borrow({authSession: client.authSession, lease: client.lease,
        assertLocalAccess: () => { if (closed) fail('CLIENT_CLOSED'); assertBinding(uid, {access: true}); },
        builder: runtime.builder, approval, sdk: {firestore: f}});
      handles.add(handle);
      if (closed) fail('CLIENT_CLOSED');
      if (role === 'write') {
        const prepared = await handle.prepare();
        if (prepared.ok !== true) return prepared;
        const result = await handle.write();
        return result.ok ? {ok: true, revisionId: result.head.currentRevisionId} : result;
      }
      const result = await handle.readVerify();
      return result.ok ? {ok: true, sourceMatches: result.sourceMatches, utf8Bytes: result.utf8Bytes,
        revisionId: result.head.currentRevisionId, documentSha256: result.document.integrity.documentSha256} : result;
    } finally { if (handle) { await handle.close(); handles.delete(handle); } }
  }
  const transport = Object.freeze({
    assertBinding,
    async verifyRules() {
      assertBinding();
      // Actual emulator source, rather than a caller's hash receipt. Never follow
      // redirects away from the literal loopback origin. Failure is a refusal.
      const response = await fetch('http://127.0.0.1:18080/emulator/v1/projects/demo-meble-app:ruleCoverage',
        {redirect: 'error', signal: AbortSignal.timeout(8000)});
      if (!response.ok) fail('RULES_UNCONFIRMED');
      const report = await response.json();
      const files = report.rules?.files;
      if (!Array.isArray(files) || files.length !== 1 || typeof files[0].content !== 'string') fail('RULES_UNCONFIRMED');
      pilot.verifyDeployedRules('minimal-pilot', Buffer.from(files[0].content));
      assertBinding();
      return {rulesSha256: createHash('sha256').update(files[0].content).digest('hex')};
    },
    async readAdminState() { assertDb(adminDb); return readDemoState(adminDb, uid); },
    async apply(action) { assertDb(adminDb); return applyDemoAction(adminDb, action, uid); },
    write: evidence => execute('write', evidence),
    read: evidence => execute('read', evidence),
    async verifyStop() {
      // Separate connection and server-backed flag reads, then real denied pilot
      // access and preserved Auth-only access in the unprivileged reader context.
      assertDb(stopVerifierDb); assertDb(dbs[1]);
      if (!await verifyDemoStop(stopVerifierDb, uid)) return false;
      const fresh = ref => f.runTransaction(dbs[1], tx => tx.get(ref), {maxAttempts: 1});
      try { await fresh(f.doc(dbs[1], 'users', uid, 'pilotProjects', 'cloud4-project-v1')); return false; }
      catch (error) { if (error.code !== 'permission-denied') throw error; }
      const state = await readDemoState(stopVerifierDb, uid);
      if (state.grant?.appEnabled === true) {
        const snapshot = await fresh(f.doc(dbs[1], 'appAccess', uid));
        if (!snapshot.exists() || snapshot.data().schemaVersion !== 1) return false;
      }
      return true;
    },
    async close() { closed = true; await Promise.all([...handles].map(handle => handle.close())); }
  });
  transports.add(transport);
  return transport;
}

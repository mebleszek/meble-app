// Shared assembly used by both the private binding and fixed emulator rehearsal.
// No SDK import or connection on evaluation. No production authorization here.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import gate from './cloud44-gate2.js';
import pilot from './cloud42-package.js';
import candidate from './cloud46d-candidate.js';
import fixtureRuntime from '../cloud4-pilot-readiness-smoke.js';
import contract from './cloud46d-contract.js';
import authority from './cloud46e-authority.js';
import demoProof from './cloud46c-proof.js';
async function bindRuntime({options, firestore, journal, policy, proof, readOfficialRules, expectedRules}) {
  const parts = candidate.connectionSources();
  const administrative = new Function('contract', 'pilot', parts.admin + '\nreturn {applyDemoAction, readDemoState, verifyDemoStop};')(policy, pilot);
  const stopReturn = '      return true;\n    },\n    async close()';
  if (parts.adapter.split(stopReturn).length !== 2) throw Error('CLOUD46E_REVIEWED_SOURCE_CHANGED');
  const source = parts.adapter.replace(stopReturn, '      assertDb(dbs[1]);\n' + stopReturn)
    .replace("const f = await import('firebase/firestore');", 'const f = firestore;')
    .replaceAll('import.meta.url', JSON.stringify(new URL('./cloud46c-demo-transport.mjs', import.meta.url).href));
  const adapter = new Function('fs', 'createHash', 'pilot', 'fixtureRuntime', 'contract', 'journal',
    'readOfficialRules', 'expectedRules', 'firestore', 'applyDemoAction', 'readDemoState', 'verifyDemoStop',
    source + '\nreturn {createDemoTransport, assertDemoTransport};')(fs, createHash, pilot, fixtureRuntime, policy, journal,
    readOfficialRules, expectedRules, firestore, administrative.applyDemoAction, administrative.readDemoState, administrative.verifyDemoStop);
  const transport = await adapter.createDemoTransport(options);
  const open = new Function('gate', 'pilot', 'proof', 'assertDemoTransport', 'journal',
    parts.cycle + '\nreturn openDemoExecutor;')(gate, pilot, proof, adapter.assertDemoTransport, journal);
  return {transport, open, administrative};
}
export function bindAuthorizedRuntime(input) {
  authority.assertCapability(input?.capability, 'cycle');
  const reader = input.options.reader, identity = reader.authSession.identity();
  const app = reader.authSession.verificationContext().app;
  const policy = {...contract, assertLiveDb(db) {
    contract.assertLiveDb(db);
    if (db.app === app) {
      const who = reader.authSession.identity(), ctx = reader.authSession.verificationContext();
      if (who.uid !== identity.uid || who.epoch !== identity.epoch || ctx.auth.currentUser?.uid !== identity.uid) throw Error('CLOUD46E_STOP_READER_IDENTITY_CHANGED');
    }
  }};
  return bindRuntime({...input, policy});
}
const fail = code => { throw Error('CLOUD46C_' + code); };
function assertDemoDb(db) {
  const native = db?._delegate || db;
  if (db?.app?.options?.projectId !== 'demo-meble-app' || native?._databaseId?.projectId !== 'demo-meble-app'
    || native?._databaseId?.database !== '(default)' || native?._settings?.host !== '127.0.0.1:18080'
    || native?._settings?.ssl !== false || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080'
    || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099') fail('DEMO_CONNECTION_REQUIRED');
}
export async function bindEmulatorRuntime({options, journal}) {
  assertDemoDb(options?.adminDb); assertDemoDb(options?.stopVerifierDb);
  if (options.adminDb.app === options.stopVerifierDb.app) fail('INDEPENDENT_CONTEXTS_REQUIRED');
  const f = await import('firebase/firestore');
  const admins = new WeakSet();
  const snapshot = s => ({exists: s.exists(), data: () => s.data()});
  function backend(db) {
    const wrapped = {doc(p) { const reference = f.doc(db, p); return {reference, get: async () => snapshot(await f.getDocFromServer(reference))}; },
      runTransaction(callback, settings) {
        return f.runTransaction(db, tx => callback({get: async ref => snapshot(await tx.get(ref.reference)),
          set: (ref, data) => tx.set(ref.reference, data), update: (ref, data) => tx.update(ref.reference, data)}), settings);
      }};
    admins.add(wrapped); return wrapped;
  }
  const policy = {assertLiveDb: assertDemoDb,
    assertAdmin(db) { if (!admins.has(db)) fail('DEMO_CONNECTION_REQUIRED'); },
    assertLiveSession(client, db, uid, identity) {
      assertDemoDb(db);
      const ctx = client.authSession.verificationContext(), who = client.authSession.identity();
      if (ctx.target !== 'emulator' || ctx.app !== db.app || ctx.auth.app !== ctx.app
        || ctx.auth.currentUser?.uid !== uid || who.uid !== uid || who.epoch !== identity.epoch
        || ctx.auth.emulatorConfig?.host !== '127.0.0.1' || ctx.auth.emulatorConfig?.port !== 19099) fail('UID_OR_AUTH_CHANGED');
      client.lease.assert(); if (!client.lease.isValid() || client.lease.uid !== uid) fail('ACCESS_REVOKED');
    },
    verifyRulesCheckpoint({observed}) { pilot.verifyDeployedRules('minimal-pilot', Buffer.from(observed)); }};
  return bindRuntime({options: {...options, adminDb: backend(options.adminDb), stopVerifierDb: backend(options.stopVerifierDb)},
    firestore: f, journal, policy, proof: demoProof, expectedRules: null,
    async readOfficialRules() {
      const r = await fetch('http://127.0.0.1:18080/emulator/v1/projects/demo-meble-app:ruleCoverage',
        {redirect: 'error', signal: AbortSignal.timeout(8000)});
      if (!r.ok) fail('RULES_UNCONFIRMED');
      const files = (await r.json()).rules?.files;
      if (!Array.isArray(files) || files.length !== 1 || typeof files[0].content !== 'string') fail('RULES_UNCONFIRMED');
      return files[0].content;
    }});
}

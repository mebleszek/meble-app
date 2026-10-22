// CI-owned real SDK/emulator cycles. Worker isolation never clears an operator lock.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';
import {randomUUID} from 'node:crypto';
const scenarios = ['full-cycle', 'failed-write', 'lost-ack', 'cas-conflict', 'wrong-uid', 'wrong-project',
  'wrong-database', 'late-response', 'stop-during-await', 'interrupted-stop', 'rules-mismatch',
  'rules-change', 'revoked-access', 'production-refusal', 'real-data-denied'];
if (isMainThread) {
  for (const scenario of scenarios) test('CLOUD-4.6C ' + scenario, {timeout: 45000}, async t => {
    await new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), {workerData: scenario});
      t.signal.addEventListener('abort', () => { worker.terminate(); }, {once: true});
      let result;
      worker.on('message', message => { result = message; });
      worker.on('error', reject);
      worker.on('exit', code => {
        if (code || result?.ok !== true) reject(Error(result?.error || 'Scenario worker failed: ' + code));
        else resolve();
      });
    });
  });
} else {
  try { await scenario(workerData); parentPort.postMessage({ok: true}); }
  catch (error) { parentPort.postMessage({ok: false, error: error.stack}); process.exitCode = 1; }
}
async function scenario(name) {
  const [{initializeTestEnvironment, assertFails}, app, auth, f, fs, {mock}, {default: p}, {default: proof},
    {createDemoTransport}, {openDemoExecutor, executeProduction}, {default: fixture}] = await Promise.all([
    import('@firebase/rules-unit-testing'), import('firebase/app'), import('firebase/auth'), import('firebase/firestore'),
    import('node:fs'), import('node:test'), import('./cloud42-package.js'), import('./cloud46c-proof.js'),
    import('./cloud46c-demo-transport.mjs'), import('./cloud46c-executor.mjs'), import('../cloud4-pilot-readiness-smoke.js')]);
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:18080');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:19099');
  f.setLogLevel('silent');
  const uid = 'synthetic-cloud46c-owner', projectId = 'demo-meble-app';
  const rules = fs.readFileSync(new URL('./firestore-live-pilot.rules', import.meta.url), 'utf8');
  const env = await initializeTestEnvironment({projectId, firestore: {host: '127.0.0.1', port: 18080, rules}});
  const contexts = [], sessions = [];
  // withSecurityRulesDisabled installs owner credentials only on this emulator
  // context. Keep two distinct contexts active for the entire isolated scenario.
  let releaseAdmin, releaseVerifier, adminReady, verifierReady;
  const readyAdmin = new Promise(resolve => { adminReady = resolve; });
  const readyVerifier = new Promise(resolve => { verifierReady = resolve; });
  let administrativeDb, verificationDb;
  const adminLife = env.withSecurityRulesDisabled(async ctx => {
    administrativeDb = ctx.firestore(); adminReady(); await new Promise(resolve => { releaseAdmin = resolve; });
  });
  const verifierLife = env.withSecurityRulesDisabled(async ctx => {
    verificationDb = ctx.firestore(); verifierReady(); await new Promise(resolve => { releaseVerifier = resolve; });
  });
  await Promise.all([readyAdmin, readyVerifier]);
  let unblock;
  try {
    await env.clearFirestore();
    await f.setDoc(f.doc(administrativeDb, 'authorizedUsers', uid), {appEnabled: true, enabled: false, globalDataEnabled: true, globalSchemaVersion: 1});
    await f.setDoc(f.doc(administrativeDb, 'appAccess', uid), {schemaVersion: 1});
    async function client(label, owner = uid) {
      const r = fixture.source(), FC = r.s.FC;
      for (const file of ['cloud-pilot-contract', 'firebase-pilot-transport', 'cloud-auth', 'cloud-access-verifier', 'auth-access-gate']) {
        new Function('window', fs.readFileSync(new URL('../../js/app/cloud/' + file + '.js', import.meta.url), 'utf8'))(r.s);
      }
      const session = await FC.cloudAuth.create({target: 'emulator', appName: 'cloud46c-' + label,
        firebaseConfig: {apiKey: 'demo-only', projectId, appId: 'demo-only', authDomain: projectId + '.firebaseapp.com'},
        emulator: {host: '127.0.0.1', port: 19099, firestorePort: 18080},
        sdk: {app, auth: {...auth, indexedDBLocalPersistence: auth.inMemoryPersistence}}});
      sessions.push(session);
      const token = Buffer.from(JSON.stringify({sub: owner, email: owner + '@example.invalid', email_verified: true})).toString('base64url');
      await auth.signInWithCredential(auth.getAuth(app.getApp('cloud46c-' + label)), auth.GoogleAuthProvider.credential('e30.' + token + '.'));
      assert.equal(session.identity().uid, owner);
      const verifier = FC.cloudAccessVerifier.create(session, {sdk: f});
      let resolveLease, rejectLease;
      const leaseReady = new Promise((resolve, reject) => { resolveLease = resolve; rejectLease = reject; });
      const gate = FC.authAccessGate.create(session, {verifyAccess: verifier.verify,
        onAuthorized: resolveLease, onState: state => { if (['error', 'unapproved'].includes(state.status)) rejectLease(Error(state.code)); }});
      contexts.push({gate, verifier});
      return {authSession: session, lease: await leaseReady};
    }
    // Preseed actual Auth emulator Google users so the SDK retains exact UIDs.
    const seeded = await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/projects/demo-meble-app/accounts:batchCreate',
      {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer owner'}, body: JSON.stringify({allowOverwrite: true,
        users: [uid].map(localId => ({localId, email: localId + '@example.invalid', emailVerified: true,
          providerUserInfo: [{providerId: 'google.com', rawId: localId, email: localId + '@example.invalid'}]}))})});
    assert.equal(seeded.ok, true);
    const writer = await client('writer'), reader = await client('reader');
    const options = {uid, writer, reader, adminDb: administrativeDb, stopVerifierDb: verificationDb};
    const pin = proof.inventory(), expiresAt = Date.now() + 600000;
    const evidence = {type: 'emulator-rehearsal-only', projectId, database: '(default)', uid,
      attemptId: 'synthetic-' + randomUUID(), base: proof.BASE, executorSha256: pin.executorSha256,
      packageSha256: pin.packageSha256, rulesSha256: pin.rulesSha256, expiresAt};
    evidence.approvals = proof.SCOPES.map(scope => ({type: evidence.type, scope, decisionId: 'synthetic-' + scope,
      projectId, database: evidence.database, uid, attemptId: evidence.attemptId, executorSha256: pin.executorSha256, expiresAt}));
    const head = db => f.doc(db, 'users', uid, 'pilotProjects', 'cloud4-project-v1');
    if (name === 'wrong-project' || name === 'wrong-database') {
      // No mock SDK is imported by the adapter. These objects fail before IO.
      options.adminDb = {app: {options: {projectId: name === 'wrong-project' ? 'mebleszek-meble-app' : projectId}},
        _databaseId: {projectId, database: 'foreign'}, _settings: {host: '127.0.0.1:18080', ssl: false}};
      await assert.rejects(createDemoTransport(options), /DEMO_CONNECTION_REQUIRED/); return;
    }
    if (name === 'wrong-uid') {
      options.uid = 'foreign-synthetic-owner';
      await assert.rejects(createDemoTransport(options), /UID_OR_AUTH_CHANGED/); return;
    }
    if (name === 'production-refusal') {
      for (const flags of [{}, {live: true}, {target: 'production', approved: true}]) assert.throws(() => executeProduction(flags), /PRODUCTION_EXECUTION_DISABLED/);
      assert.throws(() => openDemoExecutor({transport: {write() { throw Error('must not execute'); }}, evidence}), /FIXED_DEMO_TRANSPORT_REQUIRED/);
      return;
    }
    if (name === 'cas-conflict') {
      const original = p.grantActions;
      mock.method(p, 'grantActions', input => { const plan = original(input); plan.stage.expected['authorizedUsers/' + uid].enabled = true; return plan; });
    }
    if (name === 'interrupted-stop') mock.method(p, 'stopAction', () => { throw Error('synthetic interrupted STOP'); });
    if (['failed-write', 'lost-ack', 'late-response', 'stop-during-await'].includes(name)) {
      const original = fixture.source;
      mock.method(fixture, 'source', () => {
        const r = original();
        Object.defineProperty(r.s.FC, 'firebasePilotLiveTransport', {configurable: true, set(value) {
          const create = value.create;
          value.create = async options => {
            const handle = await create(options), publish = handle.transport.publish;
            handle.transport.publish = async (...args) => {
              if (name === 'failed-write') throw Error('synthetic failed WRITE');
              await publish(...args); // Lost ACK and delayed result follow a real commit.
              if (name === 'lost-ack') throw Error('synthetic lost ACK');
              await new Promise(resolve => { unblock = resolve; });
            };
            return handle;
          };
          Object.defineProperty(r.s.FC, 'firebasePilotLiveTransport', {value, configurable: true});
        }});
        return r;
      });
    }
    const transport = await createDemoTransport(options);
    if (name === 'rules-mismatch') {
      await fetch('http://127.0.0.1:18080/emulator/v1/projects/demo-meble-app:securityRules',
        {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify({rules: {files: [{name: 'firestore.rules', content: rules + '\n// changed\n'}]}})});
    }
    let checks = 0, deniedWhileActive = false;
    if (['rules-change', 'revoked-access', 'real-data-denied'].includes(name)) {
      const original = globalThis.fetch;
      mock.method(globalThis, 'fetch', async (url, ...args) => {
        if (String(url).endsWith(':ruleCoverage') && ++checks === 3) {
          if (name === 'rules-change') await original('http://127.0.0.1:18080/emulator/v1/projects/demo-meble-app:securityRules',
            {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify({rules: {files: [{name: 'firestore.rules', content: rules + '\n// concurrent change\n'}]}})});
          else if (name === 'revoked-access') await f.updateDoc(f.doc(administrativeDb, 'authorizedUsers', uid), {appEnabled: false});
          else {
            const db = f.getFirestore(reader.authSession.verificationContext().app);
            assert.equal((await f.getDocFromServer(f.doc(administrativeDb, 'authorizedUsers', uid))).data().enabled, true);
            for (const path of ['users/real-customer/pilotProjects/real-project', 'catalogs/materials', 'settings/global', 'authorizedUsers/' + uid]) {
              await assertFails(f.getDocFromServer(f.doc(db, path)));
              await assertFails(f.setDoc(f.doc(db, path), {synthetic: true}));
            }
            deniedWhileActive = true;
          }
        }
        return original(url, ...args);
      });
    }
    const executor = openDemoExecutor({transport, evidence, timeoutMs: 8000});
    const operation = executor.run();
    if (name === 'stop-during-await') {
      const deadline = Date.now() + 12000;
      while (!unblock && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
      assert.ok(unblock, 'real commit reached held acknowledgement');
      await assert.rejects(executor.stop(), /STOP_NOT_CONFIRMED/);
    }
    const result = await operation;
    if (['full-cycle', 'real-data-denied'].includes(name)) {
      assert.equal(result.status, 'DEMO_CYCLE_VERIFIED', JSON.stringify(result));
      assert.equal(result.writeConfirmed, true); assert.equal(result.independentReadConfirmed, true);
      assert.equal(result.stopVerified, true); assert.match(result.revisionId, /^[a-f0-9]{32}$/);
    } else {
      assert.equal(result.status, 'STOP_REVIEW_REQUIRED', JSON.stringify(result));
      assert.equal(result.retryWrite, false);
      if (name === 'lost-ack') { assert.equal(result.writeConfirmed, false); assert.equal(result.independentReadConfirmed, true); }
      if (['late-response', 'stop-during-await', 'interrupted-stop'].includes(name)) assert.equal(result.stopVerified, false);
      else assert.equal(result.stopVerified, true, JSON.stringify(result));
    }
    await assert.rejects(executor.run(), /ATTEMPT_CONSUMED/);
    assert.throws(() => openDemoExecutor({transport, evidence}), /ATTEMPT_CONSUMED/);
    if (unblock) { unblock(); await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.notEqual(executor.inspect().state, 'ACTIVE');
    const published = await f.getDocFromServer(head(administrativeDb));
    if (['cas-conflict', 'rules-mismatch', 'rules-change', 'revoked-access', 'failed-write'].includes(name)) assert.equal(published.exists(), false);
    else assert.equal(published.exists(), true);
    if (result.stopVerified) {
      const stoppedGrant = (await f.getDocFromServer(f.doc(administrativeDb, 'authorizedUsers', uid))).data();
      assert.equal(stoppedGrant.enabled, false); assert.equal(stoppedGrant.globalDataEnabled, true);
      assert.equal(stoppedGrant.globalSchemaVersion, 1);
      assert.equal(stoppedGrant.appEnabled, name !== 'revoked-access');
      assert.deepEqual((await f.getDocFromServer(f.doc(administrativeDb, 'appAccess', uid))).data(), {schemaVersion: 1});
    }
    if (name === 'real-data-denied') {
      assert.equal(deniedWhileActive, true);
      const db = f.getFirestore(reader.authSession.verificationContext().app);
      for (const path of ['users/real-customer/pilotProjects/real-project', 'catalogs/materials', 'settings/global', 'authorizedUsers/' + uid]) {
        await assertFails(f.getDocFromServer(f.doc(db, path)));
        await assertFails(f.setDoc(f.doc(db, path), {synthetic: true}));
      }
      assert.equal(fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8').includes('cloud46c'), false);
      assert.equal(fs.readFileSync(new URL('../../js/main-login.js', import.meta.url), 'utf8').includes('cloud46c'), false);
    }
  } finally {
    unblock?.(); mock.restoreAll();
    for (const {gate, verifier} of contexts) { gate.close(); await verifier.close(); }
    for (const session of sessions) await session.close();
    releaseAdmin(); releaseVerifier(); await Promise.all([adminLife, verifierLife]); await env.cleanup();
  }
}

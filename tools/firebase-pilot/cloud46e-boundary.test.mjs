import {test, mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateKeyPairSync, sign} from 'node:crypto';
import authority from './cloud46e-authority.js';
import contract from './cloud46d-contract.js';
import candidate from './cloud46d-candidate.js';
import journalApi from './cloud46d-journal.js';
import pilot from './cloud42-package.js';
import baseline from './cloud43a-baseline.js';
import fence from './cloud46e-fence.js';
import {checkCredentials, checkRecoveryCredentials, assertContextSet, connectNative, connectRecoveryNative} from './cloud46e-native.mjs';
import {bindAuthorizedRuntime, bindEmulatorRuntime} from './cloud46e-runtime.mjs';
import {openAuthorizedConnection, recoverAuthorizedConnection, executeProduction} from './cloud46e-connection.mjs';
function signedFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud46e-authority-test-'));
  const {privateKey, publicKey} = generateKeyPairSync('ed25519');
  const trustFile = path.join(directory, 'owner-public.pem');
  fs.writeFileSync(trustFile, publicKey.export({type: 'spki', format: 'pem'}), {mode: 0o600});
  const ownerKeySha256 = contract.sha(publicKey.export({type: 'spki', format: 'der'}));
  const historical = baseline.baseline(), id = 'projects/mebleszek-meble-app/rulesets/synthetic-owner-decision';
  const expectedRules = {projectId: contract.TARGET.projectId, database: '(default)',
    release: {...historical.release, rulesetName: id}, ruleset: {...historical.ruleset, name: id,
      source: {files: [{name: 'firestore.rules', content: fs.readFileSync(new URL('./firestore-live-pilot.rules', import.meta.url), 'utf8')}]}}};
  const bundle = authority.unsignedBundle({uid: 'synthetic-owner', attemptId: 'synthetic-attempt', expiresAt: Date.now() + 600000,
    contexts: Object.fromEntries(['writer', 'reader', 'stop', 'verifier'].map(role => [role, {id: 'synthetic-' + role, email: 'mebleszek@gmail.com'}])),
    expectedRules, finalChecks: {}});
  function signAll() {
    for (const a of bundle.intent.approvals) a.signature = sign(null, authority.signingBytes(bundle, a.scope, a.decisionId), privateKey).toString('base64');
  }
  signAll();
  return {bundle, trustFile, ownerKeySha256, directory, signAll, close: () => fs.rmSync(directory, {recursive: true, force: true})};
}
function journalBinding() {
  return {projectId: contract.TARGET.projectId, database: '(default)', uid: 'synthetic-owner', attemptId: 'synthetic-attempt',
    packageSha256: authority.inventory().packageSha256, rulesSha256: pilot.inventory().rulesSha256,
    payloadSha256: pilot.inventory().payloadSha256, documentSha256: pilot.inventory().documentSha256};
}
test('CLOUD-4.6E imports and unauthorized production calls cannot touch a remote resource', async () => {
  let calls = 0;
  const request = mock.method(globalThis, 'fetch', () => { calls++; throw Error('remote resource touched'); });
  try {
    for (const input of [{}, {live: true}, {approved: true, target: 'production'}]) {
      assert.throws(() => executeProduction(input), /PRODUCTION_EXECUTION_DISABLED/);
      await assert.rejects(openAuthorizedConnection(input), /CLOUD46E_/);
      await assert.rejects(recoverAuthorizedConnection(input), /CLOUD46E_/);
    }
    assert.equal(calls, 0);
    const forged = {capability: {assert() {}, bundle: {action: 'cycle'}}};
    assert.throws(() => connectNative(forged), /AUTHENTICATED_CAPABILITY_REQUIRED/);
    assert.throws(() => connectRecoveryNative(forged), /AUTHENTICATED_CAPABILITY_REQUIRED/);
    assert.throws(() => bindAuthorizedRuntime(forged), /AUTHENTICATED_CAPABILITY_REQUIRED/);
    await assert.rejects(bindEmulatorRuntime({options: {adminDb: {projectId: contract.TARGET.projectId}}}), /DEMO_CONNECTION_REQUIRED/);
    assert.equal(calls, 0);
    for (const file of ['index.html', 'js/main-login.js', 'js/boot.js', 'js/app.js']) {
      assert.equal(fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8').includes('cloud46e'), false);
    }
  } finally { request.mock.restore(); }
});
test('CLOUD-4.6E six separate signatures bind exact package, session contexts, Rules, action and final evidence', () => {
  const fixture = signedFixture();
  try {
    const {bundle, trustFile, ownerKeySha256} = fixture;
    assert.equal(authority.verifySignedBundle(bundle, trustFile, ownerKeySha256).intent.uid, 'synthetic-owner');
    for (const change of [b => b.intent.uid = 'foreign', b => b.intent.projectId = 'foreign', b => b.intent.database = 'foreign',
      b => b.intent.packageSha256 = '0'.repeat(64), b => b.intent.expiresAt = 0, b => b.intent.approvals.pop(),
      b => b.intent.approvals[0].signature = b.intent.approvals[1].signature,
      b => b.contexts.reader = {...b.contexts.writer}, b => b.contexts.stop.email = 'foreign@example.invalid',
      b => b.expectedRules.ruleset.source.files[0].content += '\n', b => b.finalChecks.exclusion = {checkedAt: 1},
      b => b.action = 'recover-stop', b => b.releaseBase = 'f'.repeat(40), b => b.executionHead = 'f'.repeat(40)]) {
      const changed = structuredClone(bundle); change(changed);
      assert.throws(() => authority.verifySignedBundle(changed, trustFile, ownerKeySha256), /CLOUD46[DE]_/);
    }
    assert.throws(() => authority.verifySignedBundle(bundle, trustFile, 'f'.repeat(64)), /OWNER_KEY_MISMATCH/);
    fs.chmodSync(trustFile, 0o644);
    assert.throws(() => authority.verifySignedBundle(bundle, trustFile, ownerKeySha256), /PRIVATE_TRUST_REQUIRED/);
  } finally { fixture.close(); }
});
test('CLOUD-4.6E even valid synthetic signatures cannot replace actual private rollback and current gates', async () => {
  const fixture = signedFixture(); let calls = 0;
  const request = mock.method(globalThis, 'fetch', () => { calls++; throw Error('remote resource touched'); });
  try {
    for (const privateSource of [undefined, {byteLength: 635, sha256: baseline.baseline().source.sha256}, Buffer.alloc(635)]) {
      assert.throws(() => authority.reviewAuthorization({...fixture, privateSource}), /FINAL_CHECKS_REQUIRED/);
      await assert.rejects(openAuthorizedConnection({...fixture, privateSource}), /FINAL_CHECKS_REQUIRED/);
    }
    assert.equal(calls, 0);
  } finally { request.mock.restore(); fixture.close(); }
});
test('CLOUD-4.6E credentials have no ambient fallback and require a complete finite private set', () => {
  const credentials = Object.fromEntries(['writerGoogleIdToken', 'readerGoogleIdToken', 'stopAccessToken', 'verifierAccessToken', 'rulesAccessToken']
    .map(k => [k, 'synthetic-not-a-real-token-' + k]));
  credentials.expiresAt = Date.now() + 600000;
  checkCredentials(credentials, '/private-operator-runtime');
  checkRecoveryCredentials({stopAccessToken: credentials.stopAccessToken, verifierAccessToken: credentials.verifierAccessToken,
    expiresAt: credentials.expiresAt}, '/private-operator-runtime');
  for (const key of Object.keys(credentials)) {
    const changed = {...credentials}; delete changed[key];
    assert.throws(() => checkCredentials(changed, '/private-operator-runtime'), /PRIVATE_CREDENTIALS_REQUIRED/);
  }
  for (const directory of ['relative', new URL('../..', import.meta.url).pathname]) {
    assert.throws(() => checkCredentials(credentials, directory.replace(/\/$/, '')), /PRIVATE_CREDENTIALS_REQUIRED/);
  }
  assert.throws(() => checkCredentials({...credentials, expiresAt: Infinity}, '/private-operator-runtime'), /PRIVATE_CREDENTIALS_REQUIRED/);
});
test('CLOUD-4.6E four contexts require distinct Auth/apps/admins and exact live UID, database and host', () => {
  function client() {
    const app = {options: {...pilot.PRODUCTION}}, identity = {uid: 'synthetic-owner', epoch: 1};
    const ctx = {target: 'live-auth', app, auth: {app, currentUser: {uid: identity.uid}}};
    return {authSession: {identity: () => identity, verificationContext: () => ctx}, lease: {uid: identity.uid, assert() {}, isValid: () => true}};
  }
  const writer = client(), reader = client(), uid = 'synthetic-owner';
  const admin = () => ({projectId: contract.TARGET.projectId, databaseId: '(default)', _settings: {host: 'firestore.googleapis.com', ssl: true}, doc() {}, runTransaction() {}});
  const options = {writer, reader, adminDb: admin(), stopVerifierDb: admin()};
  const dbs = [writer, reader].map(c => ({app: c.authSession.verificationContext().app,
    _databaseId: {projectId: contract.TARGET.projectId, database: '(default)'}, _settings: {host: 'firestore.googleapis.com', ssl: true}}));
  assertContextSet(options, uid, dbs);
  assert.throws(() => assertContextSet({...options, reader: writer}, uid, dbs), /FOUR_CONTEXTS_REQUIRED/);
  assert.throws(() => assertContextSet({...options, stopVerifierDb: options.adminDb}, uid, dbs), /FOUR_CONTEXTS_REQUIRED/);
  assert.throws(() => assertContextSet(options, 'foreign', dbs), /IDENTITY_MISMATCH/);
  assert.throws(() => assertContextSet(options, uid, [dbs[0], {...dbs[1], _settings: {host: 'foreign', ssl: true}}]), /IDENTITY_MISMATCH/);
  reader.lease.isValid = () => false;
  assert.throws(() => assertContextSet(options, uid, dbs), /ACCESS_REVOKED/);
});
test('CLOUD-4.6E native snapshot bridge preserves existing CAS callback and maxAttempts=1', async () => {
  const parts = candidate.connectionSources(), calls = [];
  const action = pilot.grantActions({uid: 'synthetic-owner', grant: {appEnabled: true, enabled: false}, appAccess: {schemaVersion: 1}, control: null}).stage;
  const db = {doc: p => p, async runTransaction(callback, options) {
    calls.push(options);
    return callback({get: async p => ({exists: action.expected[p] !== null, data: () => action.expected[p]}),
      update: (p, data) => calls.push({p, data}), set: (p, data) => calls.push({p, data})});
  }};
  const admin = new Function('contract', 'pilot', parts.admin + '\nreturn {applyDemoAction};')({assertAdmin: value => assert.equal(value, db)}, pilot);
  await admin.applyDemoAction(db, action, 'synthetic-owner');
  assert.deepEqual(calls[0], {maxAttempts: 1});
  assert.deepEqual(calls.slice(1).map(c => c.p).sort(), ['authorizedUsers/synthetic-owner', 'pilotControl/cloud4']);
  assert.ok(parts.admin.includes('pilot.assertExpected(action, observed)'));
});
test('CLOUD-4.6E restart retains consumed scope and uncertain precommitted revision without another WRITE', async () => {
  const binding = journalBinding();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud46e-restart-test-'));
  let journal = journalApi.createJournal(directory);
  try {
    journal.claim(binding); await journal.perform('stage', async () => {}); await journal.perform('activate', async () => {});
    await assert.rejects(journal.perform('write', async () => { journal.recordRevision('a'.repeat(32)); throw Error('disconnected after submission'); }));
    journal.close();
    const recovered = journalApi.inspectJournal(directory, binding);
    assert.equal(recovered.retryWrite, false);
    assert.equal(recovered.events.find(e => e.kind === 'REVISION_PREPARED').receipt.revisionId, 'a'.repeat(32));
    journal = journalApi.createJournal(directory);
    assert.throws(() => journal.claim({...binding, attemptId: 'another-attempt'}), /ATTEMPT_CONSUMED/);
    assert.equal(recovered.status, 'RESULT_UNCERTAIN_REVIEW_REQUIRED');
  } finally { journal.close(); fs.rmSync(directory, {recursive: true, force: true}); }
});
test('CLOUD-4.6E restart STOP marker blocks future mutations and refuses certification of an in-flight admin RPC', async () => {
  const binding = journalBinding();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud46e-fence-test-'));
  const journal = journalApi.createJournal(directory); journal.claim(binding);
  const guarded = fence.fencedJournal(directory, binding, journal), files = fence.names(directory, binding);
  let release, calls = 0;
  try {
    const pending = guarded.perform('stage', () => { calls++; return new Promise(resolve => { release = resolve; }); });
    assert.equal(fs.existsSync(files.administrative), true);
    fs.writeFileSync(files.recovery, 'RECOVERY_INTENT\n', {flag: 'wx', mode: 0o600}); fence.syncDirectory(directory);
    release(); await assert.rejects(pending, /RECOVERY_STOP_REQUESTED/);
    assert.equal(fs.existsSync(files.administrative), true, 'uncertain administrative outcome cannot be certified after restart');
    await assert.rejects(guarded.perform('write', async () => { calls++; }), /RECOVERY_STOP_REQUESTED/);
    assert.equal(calls, 1);
  } finally { release?.(); journal.close(); fs.rmSync(directory, {recursive: true, force: true}); }
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import c from './cloud46d-contract.js';
import candidate from './cloud46d-candidate.js';
import journalApi from './cloud46d-journal.js';
import p from './cloud42-package.js';
import gate from './cloud44-gate2.js';
import baseline from './cloud43a-baseline.js';
const require = createRequire(import.meta.url);
function intent() {
  const proof = candidate.inventory(), pin = p.inventory(), expiresAt = Date.now() + 600000;
  const input = {projectId: c.TARGET.projectId, database: '(default)', base: c.BASE, uid: 'synthetic-cloud46d-owner',
    attemptId: 'synthetic-attempt', packageSha256: proof.packageSha256, investorId: c.TARGET.investorId,
    projectIdInData: c.TARGET.projectIdInData, rulesSha256: pin.rulesSha256, payloadSha256: pin.payloadSha256,
    documentSha256: pin.documentSha256, type: 'explicit-production-decision', expiresAt};
  input.approvals = gate.FUTURE_SCOPES.map(scope => ({scope, type: input.type, decisionId: 'synthetic-' + scope,
    uid: input.uid, attemptId: input.attemptId, projectId: input.projectId, database: input.database,
    packageSha256: input.packageSha256, rulesSha256: input.rulesSha256, expiresAt}));
  return input;
}
function observation() {
  const b = baseline.baseline();
  const id = 'projects/mebleszek-meble-app/rulesets/synthetic-reviewed-minimal';
  return {projectId: c.TARGET.projectId, database: '(default)', observedAt: new Date().toISOString(),
    release: {...b.release, rulesetName: id}, ruleset: {...b.ruleset, name: id,
      source: {files: [{name: 'firestore.rules', content: fs.readFileSync(new URL('./firestore-live-pilot.rules', import.meta.url), 'utf8')}]}}};
}
test('Prepared intent binds six decisions, package, UID, scope and window; no approval enables execution', () => {
  const input = intent(); assert.deepEqual(c.reviewIntent(input, input.packageSha256), input);
  for (const change of [x => x.projectId = 'foreign', x => x.uid = '../foreign', x => x.database = 'foreign',
    x => x.packageSha256 = 'f'.repeat(64), x => x.projectIdInData = 'foreign', x => x.expiresAt = 0,
    x => x.approvals.pop(), x => x.approvals[0].uid = 'foreign', x => x.approvals[0].decisionId = x.approvals[1].decisionId]) {
    const changed = structuredClone(input); change(changed);
    assert.throws(() => c.reviewIntent(changed, input.packageSha256), /CLOUD46D_/);
  }
  assert.throws(() => gate.executeProduction(input), /PRODUCTION_EXECUTION_DISABLED/);
  assert.equal(c.reviewFinalChecks({privateSource: Buffer.alloc(635)}).executionAllowed, false);
  assert.ok(c.reviewFinalChecks({}).blockers.includes('PRIVATE_ROLLBACK_REQUIRED'));
});
test('Rules receipt compares exact identity, source bytes, database and fresh timestamp', () => {
  const expected = observation();
  assert.equal(c.verifyRulesCheckpoint({observed: expected, expected}).executionAllowed, false);
  for (const change of [x => x.projectId = 'foreign', x => x.database = 'foreign', x => x.release.updateTime += 'x',
    x => x.ruleset.name += 'x', x => x.ruleset.source.files[0].content += '\n', x => x.observedAt = new Date(Date.now() - 6000).toISOString()]) {
    const changed = structuredClone(expected); change(changed);
    assert.throws(() => c.verifyRulesCheckpoint({observed: changed, expected}), /CLOUD4/);
  }
});
test('Actual Rules reader code refuses changed release, foreign identity, permission loss and HTTP ambiguity', async () => {
  const text = fs.readFileSync(new URL('./cloud46d-rules-reader.js.txt', import.meta.url), 'utf8');
  const create = new Function(text + '\nreturn createRulesReader;')();
  const o = observation(), urls = [];
  const request = async url => { urls.push(url); return {status: 200, json: async () => url.includes('/releases/') ? o.release : o.ruleset}; };
  const read = create({getAccessToken: async () => ({token: 'synthetic-not-a-credential'})}, request);
  const result = await read(); c.verifyRulesCheckpoint({observed: result, expected: o}); assert.equal(urls.length, 3);
  assert.ok(urls.every(url => url.startsWith('https://firebaserules.googleapis.com/v1/projects/mebleszek-meble-app/')));
  for (const status of [403, 429, 500]) await assert.rejects(create({getAccessToken: async () => 'synthetic'}, async () => ({status}))(), /READ_UNCONFIRMED/);
  let count = 0;
  await assert.rejects(create({getAccessToken: async () => 'synthetic'}, async url => ({status: 200, json: async () => {
    count++; return url.includes('/releases/') ? {...o.release, ...(count === 3 ? {updateTime: 'changed'} : {})} : o.ruleset;
  }}))(), /RULES_CHANGED_DURING_READ/);
  await assert.rejects(create({getAccessToken: async () => 'synthetic'}, async () => ({status: 200,
    json: async () => ({...o.release, rulesetName: 'projects/foreign/rulesets/id'})}))(), /IDENTITY_MISMATCH/);
});
test('Journal consumes scope across new handles and new attempt IDs; captures revision before a lost ACK', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud46d-journal-test-')), binding = intent();
  const journal = journalApi.createJournal(directory), revisionId = 'a'.repeat(32);
  try {
    journal.claim(binding); await journal.perform('stage', async () => {}); await journal.perform('activate', async () => {});
    await assert.rejects(journal.perform('write', async () => { journal.recordRevision(revisionId); throw Error('lost ACK'); }), /lost ACK/);
    await assert.rejects(journal.perform('write', async () => assert.fail('retry')), /PHASE_REFUSED/);
    assert.throws(() => journalApi.createJournal(directory).claim({...binding, attemptId: 'another'}), /ATTEMPT_CONSUMED/);
    const receipt = {ok: true, sourceMatches: true, revisionId, documentSha256: binding.documentSha256, utf8Bytes: 6797};
    assert.throws(() => journal.resolveReadback({...receipt, revisionId: 'b'.repeat(32)}), /READBACK_UNATTRIBUTED/);
    journal.resolveReadback(receipt);
    await journal.perform('stop', async () => {}); await journal.perform('verify-stop', async () => true); journal.close();
    const record = journalApi.inspectJournal(directory, binding); assert.equal(record.retryWrite, false);
    assert.equal(record.events.find(row => row.kind === 'REVISION_PREPARED').receipt.revisionId, revisionId);
    assert.ok(record.events.find(row => row.phase === 'write' && row.kind === 'UNCERTAIN'));
    const file = path.join(directory, fs.readdirSync(directory)[0]); fs.appendFileSync(file, 'partial');
    assert.throws(() => journalApi.inspectJournal(directory, binding), /TRUNCATED/);
  } finally { journal.close(); fs.rmSync(directory, {recursive: true, force: true}); }
});
test('Journal refuses late results and interrupted STOP; it never restores the write attempt', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud46d-journal-late-')), binding = intent(), journal = journalApi.createJournal(directory);
  let release;
  try {
    journal.claim(binding); await journal.perform('stage', async () => {}); await journal.perform('activate', async () => {});
    const write = journal.perform('write', () => new Promise(resolve => { release = resolve; }));
    await assert.rejects(journal.perform('stop', async () => { throw Error('interrupted STOP'); }), /interrupted STOP/);
    release({ok: true, revisionId: 'a'.repeat(32)}); await assert.rejects(write, /LATE_RESULT/);
    await assert.rejects(journal.perform('verify-stop', async () => true), /ORDER_INVALID/);
    journal.close(); assert.equal(journalApi.inspectJournal(directory, binding).status, 'RESULT_UNCERTAIN_REVIEW_REQUIRED');
  } finally { release?.({ok: false}); journal.close(); fs.rmSync(directory, {recursive: true, force: true}); }
});
test('Native production connection boundaries refuse wrong UID/project/database/emulators and revoked lease', () => {
  const app = {options: {...p.PRODUCTION}}, identity = {uid: 'synthetic-owner', epoch: 1};
  app.options.projectId = c.TARGET.projectId;
  const ctx = {target: 'live-auth', app, emulator: null, auth: {app, currentUser: {uid: identity.uid}}};
  const client = {authSession: {identity: () => identity, verificationContext: () => ctx}, lease: {uid: identity.uid, assert() {}, isValid: () => true}};
  const db = {app, _databaseId: {projectId: c.TARGET.projectId, database: '(default)'}, _settings: {host: 'firestore.googleapis.com', ssl: true}};
  c.assertLiveSession(client, db, identity.uid, identity);
  c.assertLiveDb(db);
  const admin = {projectId: c.TARGET.projectId, databaseId: '(default)', _settings: {host: 'firestore.googleapis.com', ssl: true}, doc() {}, runTransaction() {}};
  c.assertAdmin(admin);
  for (const bad of [{...admin, projectId: 'foreign'}, {...admin, databaseId: 'foreign'}, {...admin, _settings: {host: '127.0.0.1:18080', ssl: false}}]) {
    assert.throws(() => c.assertAdmin(bad), /ADMIN_IDENTITY_MISMATCH/);
  }

  assert.throws(() => c.assertLiveSession(client, db, 'foreign', identity), /IDENTITY_MISMATCH/);
  for (const changed of [{...db, _databaseId: {...db._databaseId, database: 'foreign'}}, {...db, _settings: {host: '127.0.0.1:18080', ssl: false}}, {...db, app: {options: {projectId: 'foreign'}}}]) {
    assert.throws(() => c.assertLiveSession(client, changed, identity.uid, identity), /IDENTITY_MISMATCH/);
  }
  client.lease.isValid = () => false; assert.throws(() => c.assertLiveSession(client, db, identity.uid, identity), /ACCESS_REVOKED/);
});
test('Production artifact remains inert even after direct import; normal startup cannot reach it', async () => {
  const packet = candidate.prepareCandidate(); assert.equal(packet.executionAllowed, false);
  assert.equal(packet.sourceSha256, c.sha(packet.source));
  const moduleSource = packet.source.replace(/from '(\.[^']+)'/g, (_all, relative) => "from '" + new URL(relative, import.meta.url).href + "'");
  const exported = await import('data:text/javascript;base64,' + Buffer.from(moduleSource).toString('base64'));
  assert.deepEqual(Object.keys(exported), ['executeProduction']);
  const untouched = new Proxy({}, {get() { throw Error('network touched'); }});
  assert.throws(() => exported.executeProduction(untouched), /PRODUCTION_EXECUTION_DISABLED/);
  // A separately evaluated binder also encounters an unconditional refusal;
  // fake JSON approvals cannot produce handles or invoke credentials.
  const raw = packet.source.replace(/^import .*;\n/gm, '').replace('export const executeProduction', 'const executeProduction').replaceAll('import.meta.url', JSON.stringify(import.meta.url));
  const binder = new Function('gate', 'contract', 'preparation', raw + '\nreturn privateBindings;')(gate, c, candidate);
  assert.throws(() => binder(untouched, intent(), packet.packageSha256, untouched, observation(), {}), /PRODUCTION_EXECUTION_DISABLED/);
  for (const name of ['index.html', 'js/main-login.js', 'js/boot.js', 'js/app.js']) assert.equal(fs.readFileSync(new URL('../../' + name, import.meta.url), 'utf8').includes('cloud46d'), false);
});

test('Recovery sidecar resolves the exact precommitted revision after restart without reopening WRITE', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud46d-recovery-')), binding = intent();
  const journal = journalApi.createJournal(directory), revisionId = 'c'.repeat(32);
  try {
    journal.claim(binding); await journal.perform('stage', async () => {}); await journal.perform('activate', async () => {});
    await assert.rejects(journal.perform('write', async () => { journal.recordRevision(revisionId); throw Error('ACK lost'); }));
    journal.close();
    const recovered = journalApi.recordRecovery(directory, binding, {ok: true, sourceMatches: true, revisionId,
      documentSha256: binding.documentSha256, utf8Bytes: 6797});
    assert.equal(recovered.status, 'SAME_ATTEMPT_STATE_OBSERVED_ONLY'); assert.equal(recovered.retryWrite, false);
    assert.equal(recovered.stopVerified, false); assert.equal(recovered.productionExecutionAllowed, false);
    assert.throws(() => journalApi.createJournal(directory).claim(binding), /ATTEMPT_CONSUMED/);
    assert.throws(() => journalApi.recordRecovery(directory, {...binding, attemptId: 'foreign'}, {}), /BINDING_INVALID/);
  } finally { journal.close(); fs.rmSync(directory, {recursive: true, force: true}); }
});

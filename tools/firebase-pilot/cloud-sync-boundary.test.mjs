// Pure composition diagnostics. SDK/security evidence belongs to cloud-sync-global.test.mjs.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createEmulatorSynchronizer, createMemoryReplica, createMemoryOperationJournal} from '../../sync/global-data-sync.mjs';
import {runtime, model, seed} from './cloud-sync-fixture.mjs';
test('SYNC fixture: CLOUD-3 staging payloads use the SDK realm; device stores stay independent', async () => {
  const a = runtime(), b = runtime(), uid = 'synthetic-owner';
  seed(a); seed(b);
  const contract = a.FC.globalDataContract, captured = contract.capture(a.storage, Object.keys(contract.schemas));
  const packed = await contract.pack(uid, captured.model);
  for (const record of packed.records) {
    // Firebase 12.19.0's isPlainObject compares this exact prototype. A vm
    // Object fails before transaction serialization or Security Rules evaluation.
    assert.equal(Object.getPrototypeOf(record), Object.prototype);
    assert.equal(record.byteLength, Buffer.byteLength(record.json, 'utf8'));
  }
  assert.deepEqual((await contract.unpack(uid, packed.directory, packed.records)).model, model());
  assert.notEqual(a.s, b.s); assert.notEqual(a.FC, b.FC);
  assert.notEqual(a.FC.globalDataContract, b.FC.globalDataContract);
  assert.notEqual(a.FC.firebaseGlobalTransport, b.FC.firebaseGlobalTransport);
  const beforeB = [...b.rows];
  a.rows.set('fc_sheets_v1', JSON.stringify({sheets: []}));
  assert.deepEqual([...b.rows], beforeB); assert.deepEqual(a.calls, []); assert.deepEqual(b.calls, []);
});
function fixture() {
  const r = runtime(), c = r.FC.globalDataContract, uid = 'synthetic-owner'; seed(r);
  const connection = () => {
    const app = {options: {projectId: 'demo-meble-app'}};
    return {db: {app, _databaseId: {projectId: 'demo-meble-app', database: '(default)'}, _settings: {host: '127.0.0.1:18080', ssl: false}},
      auth: {app, emulatorConfig: {host: '127.0.0.1', port: 19099, protocol: 'http'}, currentUser: {uid, providerData: [{providerId: 'google.com'}]}},
      session: {identity: () => ({uid, epoch: 1})}};
  };
  const writer = connection(), reader = connection(), remote = {model: null, head: null}, counts = {publish: 0, read: 0};
  let drop = false, pause = null;
  const factory = {fromConnection: conn => ({
    async prepare({model, expectedHead, assertSource}) {
      assertSource(); assert.deepEqual(expectedHead, remote.head);
      return {ok: true, handle: {revisionId: 'a'.repeat(32), model: structuredClone(model)}};
    },
    async publish(handle) {
      assert.equal(conn, writer); counts.publish++;
      const packed = await c.pack(uid, handle.model);
      remote.model = handle.model; remote.head = {ownerUid: uid, version: 1, generation: 1,
        revisionId: handle.revisionId, directoryHash: packed.directoryHash, recordCount: packed.records.length};
      return drop ? {ok: false, published: 'unconfirmed', code: 'GLOBAL_NETWORK_UNCONFIRMED'} : {ok: true, head: remote.head};
    },
    async read() {
      assert.equal(conn, reader); counts.read++;
      if (pause) await pause;
      return {ok: true, head: structuredClone(remote.head), model: structuredClone(remote.model), dependencies: [], warnings: []};
    },
    async close() {}
  })};
  const journal = createMemoryOperationJournal();
  const options = {contract: c, transportFactory: factory, writer, reader, ownerUid: uid, journal};
  const sync = createEmulatorSynchronizer(options);
  return {r, c, uid, options, sync, counts, remote, setDrop: value => { drop = value; }, setPause: value => { pause = value; },
    send: () => sync.send({operationId: 'one', source: r.storage, expectedHead: null}),
    replica: () => createMemoryReplica({contract: c, ownerUid: uid})};
}
test('SYNC boundary: capture -> one publication -> independent verified read -> atomic memory apply', async () => {
  const f = fixture(), before = [...f.r.rows];
  const out = await f.send(); assert.equal(out.ok, true, JSON.stringify(out));
  const replica = f.replica(); assert.equal((await f.sync.receive({replica, expectedLocalVersion: 0})).ok, true);
  assert.deepEqual(replica.snapshot().model, model()); assert.equal(f.counts.publish, 1); assert.equal(f.counts.read, 2);
  assert.deepEqual([...f.r.rows], before); assert.deepEqual(f.r.calls, []);
});
test('SYNC boundary: lost ACK, duplicate, coordinator recreation never republish', async () => {
  const f = fixture(); f.setDrop(true);
  assert.equal((await f.send()).published, 'unconfirmed');
  assert.equal((await f.send()).code, 'SYNC_OPERATION_ALREADY_RESERVED');
  assert.equal((await createEmulatorSynchronizer(f.options).resolve('one')).ok, true);
  assert.equal(f.counts.publish, 1); assert.equal(f.options.journal.snapshot()[0].state, 'verified');
  assert.equal(JSON.stringify(f.options.journal.snapshot()).includes('Synthetic white'), false);
});
test('SYNC boundary: edits during await, escaped edit references, dirty and unknown stores refuse replacement', async () => {
  const f = fixture(); assert.equal((await f.send()).ok, true);
  const replica = f.replica(); assert.equal((await f.sync.receive({replica, expectedLocalVersion: 0})).ok, true);
  let resume; f.setPause(new Promise(resolve => { resume = resolve; }));
  const pending = f.sync.receive({replica, expectedLocalVersion: 1});
  let escaped; replica.edit(m => { escaped = m; m.stock[0].qty = 7; }); escaped.stock[0].qty = 999;
  resume(); assert.equal((await pending).code, 'SYNC_LOCAL_CONFLICT'); assert.equal(replica.snapshot().model.stock[0].qty, 7);
  assert.equal((await f.sync.receive({replica, expectedLocalVersion: 2})).code, 'SYNC_LOCAL_CONFLICT');
  assert.equal((await f.sync.receive({replica: {snapshot() {}}, expectedLocalVersion: 0})).code, 'SYNC_MEMORY_REPLICA_REQUIRED');
});
test('SYNC boundary: invalid source and independent-read hash mismatch cannot apply data', async () => {
  const f = fixture(); f.r.rows.delete('fc_quote_rates_v1');
  assert.equal((await f.send()).code, 'GLOBAL_SOURCE_MISSING'); assert.equal(f.counts.publish, 0);
  const other = fixture(); assert.equal((await other.send()).ok, true); other.remote.model.stock[0].qty = 42;
  const replica = other.replica(); assert.equal((await other.sync.receive({replica, expectedLocalVersion: 0})).code, 'SYNC_REVISION_MISMATCH');
  assert.equal(replica.snapshot().model, null);
});
test('SYNC boundary: LIVE, shared contexts and closed synchronizer deny; no startup reference', async () => {
  const f = fixture();
  const production = {...f.options, writer: {...f.options.writer, db: {app: {options: {projectId: 'mebleszek-meble-app'}}}}};
  assert.throws(() => createEmulatorSynchronizer(production), /SYNC_EMULATOR_REQUIRED/);
  assert.throws(() => createEmulatorSynchronizer({...f.options, reader: f.options.writer}), /SYNC_INDEPENDENT_READER_REQUIRED/);
  await f.sync.close(); assert.equal((await f.send()).code, 'SYNC_CLOSED'); assert.equal(f.counts.publish, 0);
  for (const file of ['index.html', 'js/main-login.js', 'tools/index-load-groups.js']) {
    assert.equal(fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8').includes('global-data-sync'), false);
  }
});

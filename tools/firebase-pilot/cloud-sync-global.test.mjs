// Actual Auth + Firestore SDKs. All business data belongs to isolated fixtures.
import {test, before, beforeEach, afterEach, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as app from 'firebase/app';
import * as auth from 'firebase/auth';
import * as firestore from 'firebase/firestore';
import {initializeTestEnvironment, assertFails} from '@firebase/rules-unit-testing';
import {createEmulatorSynchronizer, createMemoryReplica, createMemoryOperationJournal} from '../../sync/global-data-sync.mjs';
import {runtime, model, seed, addCompatibleFields, topLevelFixture} from './cloud-sync-fixture.mjs';
for (const [key, port] of [['FIRESTORE_EMULATOR_HOST', 18080], ['FIREBASE_AUTH_EMULATOR_HOST', 19099]]) {
  if (process.env[key] !== `127.0.0.1:${port}`) throw Error('Loopback emulator required');
}
const projectId = 'demo-meble-app', clone = v => JSON.parse(JSON.stringify(v));
let env, serial = 0, clients = [], synchronizers = [];
async function client(sub = 'synthetic-sync-owner', sdk = firestore) {
  const r = runtime();
  for (const name of ['cloud-pilot-contract', 'firebase-pilot-transport']) {
    new Function('window', fs.readFileSync(new URL('../../js/app/cloud/' + name + '.js', import.meta.url), 'utf8'))(r.s);
  }
  const handles = await r.FC.firebasePilotTransport.create({target: 'emulator', projectId,
    emulator: {host: '127.0.0.1', authPort: 19099, firestorePort: 18080},
    appName: 'sync-' + (++serial), sdk: {app, auth, firestore}});
  clients.push(handles.transport);
  const claims = Buffer.from(JSON.stringify({sub, email: sub + '@example.invalid', email_verified: true})).toString('base64url');
  await auth.signInWithCredential(handles.auth, auth.GoogleAuthProvider.credential('e30.' + claims + '.'));
  await handles.transport.ready();
  const uid = handles.auth.currentUser.uid;
  return {r, ...handles, uid, connection: {...handles, firestore: sdk, session: handles.transport, assertAccess() {}}};
}
function connect(a, b, journal = createMemoryOperationJournal(), ownerUid = a.uid) {
  const sync = createEmulatorSynchronizer({contract: a.r.FC.globalDataContract,
    transportFactory: a.r.FC.firebaseGlobalTransport, writer: a.connection, reader: b.connection, ownerUid, journal});
  synchronizers.push(sync); return sync;
}
async function grant(uid, patch = {}) {
  await env.withSecurityRulesDisabled(ctx => firestore.setDoc(firestore.doc(ctx.firestore(), 'authorizedUsers', uid),
    {appEnabled: true, enabled: false, globalDataEnabled: true, globalSchemaVersion: 1, ...patch}));
}
async function pair(sdk) {
  const a = await client('synthetic-sync-owner', sdk), b = await client(); await grant(a.uid);
  return {a, b, sync: connect(a, b)};
}
const publish = (sync, a, operationId = 'operation-one', expectedHead = null) =>
  sync.send({operationId, source: a.r.storage, expectedHead});
const replica = a => createMemoryReplica({contract: a.r.FC.globalDataContract, ownerUid: a.uid});
async function rows(uid, collection) {
  let result;
  await env.withSecurityRulesDisabled(async ctx => {
    result = (await firestore.getDocs(firestore.collection(ctx.firestore(), 'users', uid, collection))).docs.map(s => ({id: s.id, ...s.data()}));
  }); return result;
}
before(async () => {
  firestore.setLogLevel('silent');
  env = await initializeTestEnvironment({projectId, firestore: {host: '127.0.0.1', port: 18080,
    rules: fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8')}});
});
beforeEach(topLevelFixture(async () => env.clearFirestore()));
afterEach(topLevelFixture(async () => {
  await Promise.all(synchronizers.map(s => s.close())); synchronizers = [];
  await Promise.all(clients.map(c => c.close())); clients = [];
}));
after(async () => env?.cleanup());

test('CLOUD-SYNC-1 01: native RAW stores A -> immutable Firestore -> independent B, all 14 domains', async () => {
  const {a, b, sync} = await pair(), r = a.r;
  for (const name of ['pricing/labor-catalog-definitions', 'pricing/labor-catalog', 'catalog/hardware-technical-params',
    'catalog/hardware-catalog', 'catalog/hardware-catalog-seed-data', 'catalog/hardware-catalog-seeds',
    'catalog/catalog-domain', 'catalog/catalog-migration', 'catalog/catalog-storage-policy', 'catalog/catalog-store',
    'settings/program-defaults-store', 'settings/business-costs-store', 'settings/company-profile-store', 'material/magazyn']) r.load('js/app/' + name + '.js');
  r.FC.catalogStore.savePriceList('materials', model().materials);
  r.FC.programDefaults.write(model().programDefaults); r.FC.companyProfile.write(model().company);
  r.FC.businessCosts.write(model().businessCosts); r.FC.magazyn.upsertSheet(model().stock[0]);
  const c = r.FC.globalDataContract, expected = clone(c.capture(r.storage, Object.keys(c.schemas)).model);
  const before = [...r.rows], n = r.calls.length, bBefore = [...b.r.rows];
  const sent = await publish(sync, a); assert.equal(sent.ok, true, JSON.stringify(sent)); assert.equal(sent.independentlyVerified, true);
  const local = replica(a), received = await sync.receive({replica: local, expectedLocalVersion: 0});
  assert.equal(received.ok, true, JSON.stringify(received)); assert.deepEqual(local.snapshot().model, expected);
  assert.equal(Object.keys(local.snapshot().model).length, 14); assert.deepEqual(local.snapshot().head, sent.head);
  assert.deepEqual([...r.rows], before); assert.equal(r.calls.length, n); assert.deepEqual([...b.r.rows], bBefore);
});
test('CLOUD-SYNC-1 02: exact identifiers, fractional prices, discounts, substitutes and compatibility relations', async () => {
  const {a, sync} = await pair(), value = addCompatibleFields(model()); value.materials[0].price = 280.123456789;
  value.hardware[0].supplierDiscountPercent = 7.125; seed(a.r, value);
  assert.equal((await publish(sync, a)).ok, true);
  const local = replica(a); assert.equal((await sync.receive({replica: local, expectedLocalVersion: 0})).ok, true);
  assert.deepEqual(local.snapshot().model, value);
});
test('CLOUD-SYNC-1 03: real sheet stock identifiers, dimensions and quantities survive without adjustment', async () => {
  const {a, sync} = await pair(), value = model(); value.stock.push({id: 'offcut-002', material: value.stock[0].material, width: 432.125, height: 801.75, qty: 0});
  seed(a.r, value); assert.equal((await publish(sync, a)).ok, true);
  const local = replica(a); assert.equal((await sync.receive({replica: local, expectedLocalVersion: 0})).ok, true);
  assert.deepEqual(local.snapshot().model.stock, value.stock);
});
test('CLOUD-SYNC-1 04: one price edit commits the next revision and one new record; clean B advances', async () => {
  const {a, sync} = await pair(), value = model(); seed(a.r, value);
  const first = await publish(sync, a); assert.equal(first.ok, true);
  const count = (await rows(a.uid, 'globalRecords')).length, local = replica(a);
  assert.equal((await sync.receive({replica: local, expectedLocalVersion: 0})).ok, true);
  value.materials[0].price = 315.25; seed(a.r, value);
  const second = await publish(sync, a, 'operation-two', first.head); assert.equal(second.ok, true, JSON.stringify(second));
  assert.equal(second.head.generation, 2); assert.equal((await rows(a.uid, 'globalRecords')).length, count + 1);
  assert.equal((await sync.receive({replica: local, expectedLocalVersion: 1})).ok, true);
  assert.deepEqual(local.snapshot().model, value);
});
test('CLOUD-SYNC-1 05: stale CAS cannot replace a newer group revision', async () => {
  const {a, sync} = await pair(); seed(a.r); const first = await publish(sync, a); assert.equal(first.ok, true);
  const value = model(); value.labor[0].price = 177; seed(a.r, value);
  const second = await publish(sync, a, 'operation-two', first.head); assert.equal(second.ok, true);
  value.stock[0].qty = 9; seed(a.r, value);
  assert.equal((await publish(sync, a, 'operation-stale', first.head)).code, 'GLOBAL_WRITE_CONFLICT');
  assert.equal((await rows(a.uid, 'globalRevisions')).length, 2);
  const local = replica(a); assert.equal((await sync.receive({replica: local, expectedLocalVersion: 0})).ok, true);
  assert.equal(local.snapshot().model.stock[0].qty, 3); assert.deepEqual(local.snapshot().head, second.head);
});
test('CLOUD-SYNC-1 06: lost real transaction ACK stays uncertain; coordinator recreation only reads to resolve', async () => {
  let drop = true;
  const sdk = {...firestore, runTransaction: async (db, fn, options) => {
    let publication = false;
    const result = await firestore.runTransaction(db, tx => fn(new Proxy(tx, {get(target, key) {
      if (key === 'set') return (ref, data) => { if (ref.path.endsWith('/globalData/current')) publication = true; return target.set(ref, data); };
      const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
    }})), options);
    if (publication && drop) { drop = false; throw Object.assign(Error('synthetic ACK loss'), {code: 'unavailable'}); }
    return result;
  }};
  const {a, b, sync} = await pair(sdk); seed(a.r);
  await firestore.disableNetwork(a.db);
  assert.equal((await publish(sync, a, 'disconnected')).ok, false);
  await firestore.enableNetwork(a.db);
  assert.equal((await rows(a.uid, 'globalRecords')).length, 0);
  assert.equal((await rows(a.uid, 'globalRevisions')).length, 0);
  const lost = await publish(sync, a); assert.equal(lost.ok, false); assert.equal(lost.published, 'unconfirmed');
  assert.equal((await publish(sync, a)).code, 'SYNC_OPERATION_ALREADY_RESERVED');
  const resumed = connect(a, b, sync.journal), resolved = await resumed.resolve('operation-one');
  assert.equal(resolved.ok, true, JSON.stringify(resolved)); assert.equal(resolved.independentlyVerified, true);
  assert.equal((await rows(a.uid, 'globalRevisions')).length, 1);
  assert.equal((await publish(resumed, a)).code, 'SYNC_OPERATION_ALREADY_RESERVED');
});
test('CLOUD-SYNC-1 07: concurrent duplicate request and unchanged data produce no duplicate effects', async () => {
  const {a, sync} = await pair(); seed(a.r);
  const results = await Promise.all([publish(sync, a), publish(sync, a)]);
  assert.equal(results.filter(r => r.ok).length, 1); assert.equal(results.find(r => !r.ok).code, 'SYNC_OPERATION_ALREADY_RESERVED');
  const first = results.find(r => r.ok); const count = (await rows(a.uid, 'globalRecords')).length;
  assert.equal((await sync.resolve('operation-one')).ok, true);
  assert.equal((await publish(sync, a, 'identical-data', first.head)).ok, true);
  assert.equal((await rows(a.uid, 'globalRevisions')).length, 1); assert.equal((await rows(a.uid, 'globalRecords')).length, count);
});
test('CLOUD-SYNC-1 08: missing source, corrupt remote and interrupted staging never become a complete replica', async () => {
  const {a, sync} = await pair(); seed(a.r); a.r.rows.delete('fc_quote_rates_v1');
  assert.equal((await publish(sync, a, 'missing')).code, 'GLOBAL_SOURCE_MISSING');
  assert.equal((await rows(a.uid, 'globalRevisions')).length, 0); seed(a.r);
  assert.equal((await publish(sync, a)).ok, true);
  const record = (await rows(a.uid, 'globalRecords'))[0];
  await env.withSecurityRulesDisabled(ctx => firestore.updateDoc(firestore.doc(ctx.firestore(), 'users', a.uid, 'globalRecords', record.id), {json: record.json + ' '}));
  const local = replica(a); assert.equal((await sync.receive({replica: local, expectedLocalVersion: 0})).ok, false); assert.equal(local.snapshot().model, null);
  await env.clearFirestore(); await grant(a.uid);
  let writes = 0;
  const interrupted = {...firestore, runTransaction: (db, fn, options) => firestore.runTransaction(db, tx => fn(new Proxy(tx, {get(t, key) {
    if (key === 'set') return (ref, data) => { if (++writes >= 2) throw Object.assign(Error('synthetic interruption'), {code: 'unavailable'}); return t.set(ref, data); };
    const v = t[key]; return typeof v === 'function' ? v.bind(t) : v;
  }})), options)};
  const other = connect({...a, connection: {...a.connection, firestore: interrupted}}, await client());
  assert.equal((await publish(other, a, 'interrupted')).ok, false);
  assert.ok((await rows(a.uid, 'globalRecords')).length > 0); assert.equal((await rows(a.uid, 'globalRevisions')).length, 0);
  assert.equal((await other.receive({replica: local, expectedLocalVersion: 0})).ok, false); assert.equal(local.snapshot().model, null);
});
test('CLOUD-SYNC-1 09: owner UID mismatch and server grant revocation deny access', async () => {
  const {a, b, sync} = await pair(), foreign = await client('synthetic-foreign');
  assert.throws(() => connect(a, foreign), /SYNC_OWNER_MISMATCH/);
  assert.throws(() => connect(a, b, createMemoryOperationJournal(), 'wrong-owner'), /SYNC_OWNER_MISMATCH/);
  seed(a.r); assert.equal((await publish(sync, a)).ok, true);
  await assertFails(firestore.getDoc(firestore.doc(foreign.db, 'users', a.uid, 'globalData', 'current')));
  await grant(a.uid, {globalDataEnabled: false});
  assert.equal((await sync.receive({replica: replica(a), expectedLocalVersion: 0})).code, 'GLOBAL_PERMISSION_DENIED');
});
test('CLOUD-SYNC-1 10: all five legacy aliases and materials/services mirrors detect divergences', async () => {
  const {a, sync} = await pair(), c = a.r.FC.globalDataContract;
  for (const domain of ['suppliers', 'categories', 'types', 'technicalParams', 'hardwareSettings', 'materials', 'labor']) {
    seed(a.r); a.r.rows.set(c.sources[domain][1], domain === 'hardwareSettings' ? '{}' : '[]');
    const before = [...a.r.rows]; assert.equal((await publish(sync, a, 'alias-' + domain)).code, 'GLOBAL_ALIAS_CONFLICT');
    assert.deepEqual([...a.r.rows], before); a.r.rows.delete(c.sources[domain][1]);
  }
  seed(a.r);
  for (const domain of ['suppliers', 'categories', 'types', 'technicalParams', 'hardwareSettings']) {
    a.r.rows.set(c.sources[domain][1], a.r.rows.get(c.sources[domain][0])); a.r.rows.delete(c.sources[domain][0]);
  }
  assert.equal((await publish(sync, a)).ok, true); assert.equal((await rows(a.uid, 'globalRevisions')).length, 1);
});
test('CLOUD-SYNC-1 11: company apiKey, tokens, backups, unresolved ownership and project stores are excluded', async () => {
  const {a, sync} = await pair(), value = model(); value.company.transport.apiKey = 'SYNTHETIC-EXCLUDED-CREDENTIAL'; seed(a.r, value);
  for (const key of ['fc_edge_v1', 'fc_material_part_options_v1', 'fc_rozrys_grain_state_v1', 'fc_rozrys_overrides_v1', 'fc_projects_v1', 'fc_backups_v1', 'auth_token', 'fc_session_token']) a.r.rows.set(key, 'SYNTHETIC-NOT-FOR-SYNC');
  const before = [...a.r.rows]; assert.equal((await publish(sync, a)).ok, true);
  const persisted = JSON.stringify(await rows(a.uid, 'globalRecords'));
  assert.ok(!persisted.includes('SYNTHETIC-EXCLUDED-CREDENTIAL')); assert.ok(!persisted.includes('SYNTHETIC-NOT-FOR-SYNC'));
  assert.deepEqual([...a.r.rows], before); assert.deepEqual(a.r.calls, []);
  const local = replica(a); assert.equal((await sync.receive({replica: local, expectedLocalVersion: 0})).ok, true);
  assert.equal(Object.hasOwn(local.snapshot().model.company.transport, 'apiKey'), false);
});
test('CLOUD-SYNC-1 12: allowed dynamic fields and defaults v1 survive; unapproved future pricing fields refuse without deletion', async () => {
  const {a, sync} = await pair(), value = addCompatibleFields(model());
  value.programDefaults = {version: 1, materials: {bodyColor: 'Synthetic white'}, hardware: {hingesManufacturer: 'Synthetic maker'}};
  seed(a.r, value); const first = await publish(sync, a); assert.equal(first.ok, true);
  const local = replica(a); assert.equal((await sync.receive({replica: local, expectedLocalVersion: 0})).ok, true); assert.deepEqual(local.snapshot().model, value);
  value.labor[0].futurePricingFormula = {keepExactly: 0.123456789}; seed(a.r, value); const before = [...a.r.rows];
  assert.equal((await publish(sync, a, 'future-schema', first.head)).code, 'GLOBAL_UNKNOWN_FIELD');
  assert.deepEqual([...a.r.rows], before); assert.equal((await rows(a.uid, 'globalRevisions')).length, 1);
});
test('CLOUD-SYNC-1 13: history/calculations unchanged and receiving device edits protected, including edits during await', async () => {
  const {a, b, sync} = await pair(); seed(a.r);
  a.r.load('js/app/pricing/labor-catalog-definitions.js'); a.r.load('js/app/pricing/labor-catalog.js');
  const calculate = () => clone(a.r.FC.laborCatalog.calculateDefinition({id: 'synthetic-sync-labor', name: 'Synthetic labor', pricingMode: 'perUnit', price: 7.125}, {quantity: 3}));
  a.r.rows.set('fc_quote_snapshots_v1', JSON.stringify([{id: 'history', total: 123.456789}]));
  a.r.rows.set('fc_quote_offer_drafts_v1', 'UNTOUCHED-DRAFTS');
  b.r.rows.set('fc_quote_snapshots_v1', 'UNTOUCHED-HISTORY'); b.r.rows.set('fc_projects_v1', 'UNTOUCHED-PROJECTS');
  const beforeA = [...a.r.rows], beforeB = [...b.r.rows], calculated = calculate();
  assert.equal(calculated.total, 21.375);
  assert.equal((await publish(sync, a)).ok, true); const local = replica(a);
  assert.equal((await sync.receive({replica: local, expectedLocalVersion: 0})).ok, true);
  const pending = sync.receive({replica: local, expectedLocalVersion: 1}); local.edit(m => { m.stock[0].qty = 77; });
  assert.equal((await pending).code, 'SYNC_LOCAL_CONFLICT'); assert.equal(local.snapshot().model.stock[0].qty, 77);
  assert.equal((await sync.receive({replica: local, expectedLocalVersion: 2})).code, 'SYNC_LOCAL_CONFLICT');
  assert.deepEqual([...a.r.rows], beforeA); assert.deepEqual([...b.r.rows], beforeB); assert.deepEqual(calculate(), calculated);
});
test('CLOUD-SYNC-1 14: LIVE/wrong host/database and shared reader contexts refuse before transport creation', async () => {
  const {a, b, sync} = await pair(); seed(a.r);
  for (const edit of [x => { x.app.options.projectId = 'mebleszek-meble-app'; },
    x => { x._databaseId.database = 'foreign'; }, x => { x._settings.host = 'firestore.googleapis.com'; }]) {
    const fake = {app: {options: {projectId}}, _databaseId: {projectId, database: '(default)'}, _settings: {host: '127.0.0.1:18080', ssl: false}}; edit(fake);
    const connection = {...a.connection, db: fake, auth: {...a.auth, app: fake.app}};
    assert.throws(() => connect({...a, connection}, b), /SYNC_EMULATOR_REQUIRED/);
  }
  assert.throws(() => connect(a, a), /SYNC_INDEPENDENT_READER_REQUIRED/);
  const result = await publish(sync, a); assert.equal(result.ok, true);
  await a.transport.signOut(); assert.equal((await sync.resolve('operation-one')).ok, false);
  for (const path of ['index.html', 'js/main-login.js', 'tools/index-load-groups.js']) {
    assert.equal(fs.readFileSync(new URL('../../' + path, import.meta.url), 'utf8').includes('global-data-sync'), false);
  }
});

test('WYCENA-LABOR: editable norms, zero included units and saved 45 minutes survive actual emulator sync without repricing history', async () => {
  const {a, b, sync} = await pair();
  for (const r of [a.r, b.r]) {
    r.load('js/app/pricing/labor-catalog-definitions.js');
    r.load('js/app/pricing/labor-catalog.js');
  }
  const value = model(), catalog = a.r.FC.laborCatalog;
  value.labor = clone(catalog.ensureDefaultDefinitions([]).map(row => catalog.normalizeDefinition(row)));
  value.labor.find(row => row.id === 'labor_rate_workshop').price = 191;
  value.labor.find(row => row.id === 'labor_rate_assembly').price = 317;
  value.labor.push(clone(catalog.normalizeDefinition({id: 'synthetic-saved-45', name: 'Synthetic saved 45',
    pricingMode: 'time', timeBlockHours: 0.75, startHours: 0.75, stepHours: 0.75, rateType: 'workshop'})));
  value.labor.push(clone(catalog.normalizeDefinition({id:'synthetic-old-step',name:'Old private step',pricingMode:'timeStartStep',
    rateType:'workshop',startHours:0.25,stepEveryQty:1,stepHours:1/12,note:'keep private'})));
  value.workshopServices.push({id: 'synthetic-saved-service-45', name: 'Synthetic service 45', price: 0,
    timeBlockHours: 0.75, startHours: 0.75, stepHours: 0.75});
  seed(a.r, value);
  for (const r of [a.r, b.r]) {
    r.rows.set('fc_quote_snapshots_v1', '[{"id":"frozen","total":123.456789,"hours":0.75}]');
    r.rows.set('fc_projects_v1', 'UNTOUCHED-PROJECTS');
  }
  const beforeA = [...a.r.rows], beforeB = [...b.r.rows];
  assert.equal((await publish(sync, a, 'labor-norms')).ok, true);
  const local = replica(a);
  assert.equal((await sync.receive({replica: local, expectedLocalVersion: 0})).ok, true);
  const restored = local.snapshot().model;
  assert.deepEqual(restored, value);
  const legs = restored.labor.find(row => row.id === 'labor_legs_install');
  assert.equal(legs.startQty, 0);
  const rates = b.r.FC.laborCatalog.buildHourlyRates(restored.labor);
  const result = b.r.FC.laborCatalog.calculateDefinition(legs, {quantity: 4, hourlyRates: rates});
  assert.ok(Math.abs(result.pricedHours * 60 - 9) < 1e-8);
  assert.ok(Math.abs(result.total - 28.65) < 1e-8);
  assert.equal(b.r.FC.laborCatalog.calculateDefinition(legs, {quantity: 0, hourlyRates: rates}).total, 0);
  assert.equal(restored.labor.find(row => row.id === 'synthetic-saved-45').timeBlockHours, 0.75);
  const oldStep=restored.labor.find(row=>row.id==='synthetic-old-step');
  assert.equal(oldStep.startQty,1);
  const oldResult=b.r.FC.laborCatalog.calculateDefinition(oldStep,{quantity:1,hourlyRates:{workshop:150}});
  assert.equal(oldResult.pricedHours,0.25);assert.equal(oldResult.total,37.5);

  assert.deepEqual([...a.r.rows], beforeA);
  assert.deepEqual([...b.r.rows], beforeB);
});

test('LOCAL-FIRST: durable browser stores and real Auth/Firestore integration', async t => {
  const {runLocalFirstSuite} = await import('./local-first.test.mjs');
  await runLocalFirstSuite(t);
});

// Separate top-level lifetime releases the earlier Chromium stores first.
test('LOCAL-FIRST actual application: automatic two-device round trip and crash recovery',async t=>{
 const {runApplicationE2E}=await import('./application-e2e.test.mjs');
 await runApplicationE2E(t);
});

test('LOCAL-FIRST normal application startup on two independent browser profiles',async t=>{
 const {runNormalApplication}=await import('./normal-application.cases.mjs');
 await runNormalApplication(t);
});


test('LOCAL-FIRST approved deployment: normal startup, fenced migration and empty-device receive',async t=>{
 const {runNormalApplication}=await import('./normal-application.cases.mjs');
 await runNormalApplication(t,{deployment:true});
});

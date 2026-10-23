// CLOUD-SYNC-1. Explicit, emulator-only composition of CLOUD-3; no startup side effects.
const stores = new WeakMap(), journals = new WeakMap();
const clone = value => structuredClone(value);
function fail(code) { throw Object.assign(new Error(code), {code}); }
function refused(error) {
  return {ok: false, code: /^(GLOBAL_|SYNC_)[A-Z_]+$/.test(error?.code) ? error.code : 'SYNC_UNCONFIRMED'};
}
const same = (c, a, b) => c.canonical(a) === c.canonical(b);

// This is the future local apply boundary, implemented ONLY for isolated memory.
// Persistent storage needs its own atomic model+pending-work transaction before use.
export function createMemoryReplica({contract: c, ownerUid, model = null} = {}) {
  c.id(ownerUid);
  if (model !== null) c.validateBundle(model);
  const state = {ownerUid, model: clone(model), head: null, version: 0, dirty: model !== null};
  const store = Object.freeze({
    snapshot: () => clone(state),
    edit(change) {
      if (typeof change !== 'function' || state.model === null) fail('SYNC_LOCAL_MODEL_REQUIRED');
      const next = clone(state.model), result = change(next);
      if (result?.then) fail('SYNC_SYNCHRONOUS_EDIT_REQUIRED');
      c.validateBundle(next);
      state.model = clone(next); state.version++; state.dirty = true;
    }
  });
  stores.set(store, state);
  return store;
}

// No production durability claim: a retained journal permits coordinator recreation
// within an emulator fixture. Unknown attempts are never replayed or re-created.
export function createMemoryOperationJournal() {
  const entries = new Map();
  const journal = Object.freeze({snapshot: () => clone([...entries.values()])});
  journals.set(journal, entries);
  return journal;
}

function bind(connection, c) {
  const {db, auth, session} = connection || {};
  const check = () => {
    const native = db?._delegate || db;
    if (db?.app?.options?.projectId !== 'demo-meble-app'
      || native?._databaseId?.projectId !== 'demo-meble-app'
      || native?._databaseId?.database !== '(default)'
      || native?._settings?.host !== '127.0.0.1:18080' || native?._settings?.ssl !== false
      || auth?.app !== db.app || auth?.emulatorConfig?.host !== '127.0.0.1'
      || auth?.emulatorConfig?.port !== 19099 || auth?.emulatorConfig?.protocol !== 'http'
      || auth?.app?.options?.projectId !== 'demo-meble-app') fail('SYNC_EMULATOR_REQUIRED');
    const who = session.identity(); c.id(who.uid);
    if (!Number.isSafeInteger(who.epoch) || auth.currentUser?.uid !== who.uid
      || !auth.currentUser.providerData?.some(p => p.providerId === 'google.com')) fail('SYNC_IDENTITY_INVALID');
    return who;
  };
  const bound = check();
  return () => {
    const current = check();
    if (!same(c, current, bound)) fail('SYNC_IDENTITY_CHANGED');
    return current;
  };
}

export function createEmulatorSynchronizer({contract: c, transportFactory, writer, reader, ownerUid,
  journal = createMemoryOperationJournal()} = {}) {
  if (!c || typeof transportFactory?.fromConnection !== 'function') fail('SYNC_DEPENDENCY_REQUIRED');
  c.id(ownerUid);
  const entries = journals.get(journal);
  if (!entries) fail('SYNC_MEMORY_JOURNAL_REQUIRED');
  const writerIdentity = bind(writer, c), readerIdentity = bind(reader, c);
  if (writer.db === reader.db || writer.auth === reader.auth || writer.db.app === reader.db.app
    || writer.session === reader.session) fail('SYNC_INDEPENDENT_READER_REQUIRED');
  let closed = false;
  const guard = () => {
    if (closed) fail('SYNC_CLOSED');
    if (writerIdentity().uid !== ownerUid || readerIdentity().uid !== ownerUid) fail('SYNC_OWNER_MISMATCH');
  };
  guard();
  // Borrow CLOUD-3; do not create another Firestore schema or publication protocol.
  const outbound = transportFactory.fromConnection(writer), inbound = transportFactory.fromConnection(reader);
  const domains = Object.keys(c.schemas);

  async function verifiedRead(expected) {
    guard();
    const result = await inbound.read(); guard();
    if (!result.ok) return result;
    c.validateBundle(result.model);
    const packed = await c.pack(ownerUid, result.model); guard();
    if (packed.directoryHash !== result.head.directoryHash || packed.records.length !== result.head.recordCount
      || result.head.ownerUid !== ownerUid || (expected && !same(c, expected, result.head))) fail('SYNC_REVISION_MISMATCH');
    return result;
  }

  async function resolve(operationId) {
    try {
      guard();
      const entry = entries.get(operationId);
      if (!entry || entry.ownerUid !== ownerUid) fail('SYNC_OPERATION_UNKNOWN');
      if (!entry.expected) fail('SYNC_OPERATION_UNCONFIRMED');
      const result = await verifiedRead(entry.expected);
      if (!result.ok) return result;
      entry.state = 'verified';
      entry.result = {ok: true, head: clone(result.head), independentlyVerified: true, operationId};
      return clone(entry.result);
    } catch (error) { return refused(error); }
  }

  async function send({operationId, source, expectedHead} = {}) {
    let entry;
    try {
      guard(); c.id(operationId);
      if (expectedHead === undefined) fail('SYNC_BASE_REQUIRED');
      if (entries.has(operationId)) fail('SYNC_OPERATION_ALREADY_RESERVED');
      // Reserve synchronously, before any await. Duplicate requests never mutate.
      entry = {operationId, ownerUid, state: 'preparing', expected: null};
      entries.set(operationId, entry);
      const capture = c.capture(source, domains); c.validateBundle(capture.model);
      const packed = await c.pack(ownerUid, capture.model); guard(); capture.assertUnchanged();
      const prepared = await outbound.prepare({model: capture.model, expectedHead, assertSource: capture.assertUnchanged});
      guard();
      if (!prepared.ok) { entry.state = 'refused'; return prepared; }
      entry.expected = prepared.unchanged ? clone(prepared.head) : {
        ownerUid, version: 1, generation: (expectedHead?.generation || 0) + 1,
        revisionId: prepared.handle.revisionId, directoryHash: packed.directoryHash, recordCount: packed.records.length
      };
      entry.state = 'reserved'; // Recorded before the only publish invocation.
      if (!prepared.unchanged) {
        entry.state = 'unconfirmed';
        const published = await outbound.publish(prepared.handle); guard();
        if (!published.ok) return published; // No implicit retry, including lost ACK.
      }
      entry.state = 'awaiting-independent-read';
      return await resolve(operationId);
    } catch (error) {
      if (entry && entry.state === 'preparing') entry.state = 'refused';
      return refused(error);
    }
  }

  async function receive({replica, expectedLocalVersion} = {}) {
    try {
      guard();
      const state = stores.get(replica);
      if (!state || state.ownerUid !== ownerUid) fail('SYNC_MEMORY_REPLICA_REQUIRED');
      const version = state.version;
      if (expectedLocalVersion !== version || state.dirty) fail('SYNC_LOCAL_CONFLICT');
      const result = await verifiedRead();
      if (!result.ok) return result;
      // This synchronous swap is the complete apply transaction in memory.
      // Recheck AFTER every remote/hash await; no partial domain assignment.
      guard();
      if (state.version !== version || state.dirty) fail('SYNC_LOCAL_CONFLICT');
      if (state.head && (result.head.generation < state.head.generation
        || (result.head.generation === state.head.generation && !same(c, state.head, result.head)))) fail('SYNC_STALE_REVISION');
      if (same(c, state.head, result.head)) return {ok: true, unchanged: true, localVersion: state.version};
      const model = clone(result.model), head = clone(result.head);
      state.model = model; state.head = head; state.version++;
      return {ok: true, head: clone(head), localVersion: state.version, dependencies: clone(result.dependencies), warnings: clone(result.warnings)};
    } catch (error) { return refused(error); }
  }
  return Object.freeze({send, resolve, receive, journal, async close() { closed = true; await Promise.all([outbound.close(), inbound.close()]); }});
}

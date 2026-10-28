import {copy, fail, equal, id, json, digest} from './local-first-values.mjs';
const TABLES = ['control', 'replicas', 'outbox', 'protected'];
// Explicit separate database. No localStorage, backup archive or startup.
export async function openLocalFirstStore({indexedDB, locks, name, ownerUid, deviceId, instanceId, initialize = false} = {}) {
  id(ownerUid); id(deviceId); id(instanceId);
  if (!(name === 'meble-local-first-v1' || /^meble-lf-test-[a-zA-Z0-9_-]{1,100}$/.test(name || '')) || !indexedDB || typeof locks?.request !== 'function') fail('LF_ISOLATED_STORAGE_REQUIRED');
  let closed = false;
  function open() {
    if (closed) fail('LF_STORE_CLOSED');
    return new Promise((resolve, reject) => {
      let abandoned = false;
      const q = indexedDB.open(name, 1);
      q.onupgradeneeded = () => {
        if (!initialize) { q.transaction.abort(); return; }
        for (const table of TABLES) q.result.createObjectStore(table, {keyPath: 'key'});
        q.transaction.objectStore('control').add({key: 'binding', ownerUid, deviceId, instanceId, version: 1});
      };
      q.onerror = () => reject(Error('LF_IDB_MISSING_OR_UNAVAILABLE'));
      q.onblocked = () => { abandoned = true; reject(Error('LF_IDB_BLOCKED')); };
      q.onsuccess = () => {
        const db = q.result; db.onversionchange = () => db.close();
        if (abandoned || closed || !equal(Array.from(db.objectStoreNames).sort(), [...TABLES].sort())) {
          db.close(); reject(Error('LF_IDB_SCHEMA_OR_CLOSED')); return;
        }
        resolve(db);
      };
    });
  }
  async function transaction(mode, action) {
    const db = await open();
    try { return await new Promise((resolve, reject) => {
      let tx, output, failure;
      try { tx = db.transaction(TABLES, mode, mode === 'readwrite' ? {durability: 'strict'} : undefined); }
      catch (_) { reject(Error('LF_IDB_TRANSACTION_UNAVAILABLE')); return; }
      const s = Object.fromEntries(TABLES.map(t => [t, tx.objectStore(t)]));
      const abort = e => { failure = e; try { tx.abort(); } catch (_) {} };
      tx.onabort = () => reject(failure || Error(tx.error?.name === 'QuotaExceededError' ? 'LF_IDB_QUOTA' : 'LF_IDB_ABORTED'));
      tx.onerror = () => {};
      tx.oncomplete = () => closed ? reject(Error('LF_LOCAL_ACK_UNCONFIRMED')) : resolve(copy(output));
      const binding = s.control.get('binding');
      binding.onsuccess = () => {
        try {
          if (!equal(binding.result, {key: 'binding', ownerUid, deviceId, instanceId, version: 1})) fail('LF_IDB_IDENTITY_OR_LOSS');
          action(s, value => { output = value; }, abort);
        } catch (e) { abort(e); }
      };
    }); } finally { db.close(); }
  }
  // After first successful open, deletion must never recreate an empty database.
  await transaction('readonly', (_s, done) => done(true)); initialize = false;
  async function snapshot(scope) {
    id(scope);
    const value = await transaction('readonly', (s, done) => {
      const a = s.replicas.get(scope), b = s.outbox.getAll(), c = s.protected.getAll(); let pending = 3;
      const finish = () => { if (!--pending) done({replica: a.result || null, operations: b.result.filter(row => row.scope === scope), protected: c.result.filter(row=>row.scope===scope)}); };
      a.onsuccess = b.onsuccess = c.onsuccess = finish;
    });
    if (value.replica && await digest(value.replica.json) !== value.replica.hash) fail('LF_LOCAL_INTEGRITY');
    for (const op of value.operations) if (await digest(op.json) !== op.hash) fail('LF_LOCAL_INTEGRITY');
    for (const row of value.protected) if(await digest(row.json)!==row.hash)fail('LF_LOCAL_INTEGRITY');
    return value;
  }
  async function commit({scope, operationId, value, expectedVersion, base = null, editor = null, blockers = [], protectedRows = {}}) {
    id(scope); id(operationId); editor=copy(editor);base=copy(base);blockers=copy(blockers);
    const encoded = json(value), protection = json(protectedRows), hash = await digest(encoded), protectedHash=await digest(protection);
    if (!Array.isArray(blockers) || blockers.some(v => !/^LF_[A-Z_]+$/.test(v))) fail('LF_BLOCKER_INVALID');
    return transaction('readwrite', (s, done, abort) => {
      const a = s.replicas.get(scope), b = s.outbox.get(operationId), all = s.outbox.getAll(); let pending = 3;
      const finish = () => { if (--pending) return;
        try {
          if (b.result) {
            if (b.result.scope !== scope || b.result.hash !== hash || !equal(b.result.editor, editor)) fail('LF_OPERATION_REUSED');
            done({ok: true, duplicate: true, version: b.result.localVersion, operationId}); return;
          }
          const old = a.result, version = old?.version || 0;
          if (version !== expectedVersion) fail('LF_LOCAL_CONFLICT');
          if (scope !== 'globals' && (!old?.editor || !old.editor.active || !equal(old.editor, editor)
            || editor.deviceId !== deviceId)) fail('LF_EDITOR_REQUIRED');
          const previous = all.result.filter(row => row.scope === scope).sort((x,y) => y.localVersion - x.localVersion)[0];
          const nextVersion = version + 1;
          s.replicas.put({key: scope, version: nextVersion, json: encoded, hash, base: old?.base || base, editor: copy(editor), dirty: true});
          s.outbox.add({key: operationId, scope, localVersion: nextVersion, json: encoded, hash, base: old?.base || base,
            previousOperation: previous?.key || null, editor: copy(editor), phase: blockers.length ? 'blocked' : 'queued', blockers: copy(blockers), expected: null});
          // Retain every protected RAW version; later edits cannot erase its only copy.
          s.protected.add({key: operationId, scope, json: protection,hash:protectedHash});
          done({ok: true, operationId, version: nextVersion, localConfirmed: true, cloudConfirmed: false});
        } catch(e) { abort(e); }
      }; a.onsuccess = b.onsuccess = all.onsuccess = finish;
    });
  }
  async function transition(operationId, expectedPhase, phase, patch = {}) {
    id(operationId);patch=copy(patch);
    const allowed = {queued: ['inflight','blocked','conflict'], inflight: ['verified','uncertain','conflict'], uncertain: ['verified','conflict']};
    if (!allowed[expectedPhase]?.includes(phase) || Object.keys(patch).some(k => !['expected','receipt','code'].includes(k))) fail('LF_TRANSITION_INVALID');
    return transaction('readwrite', (s, done, abort) => {
      const q = s.outbox.get(operationId);
      q.onsuccess = () => { try {
        const op = q.result; if (!op || op.phase !== expectedPhase) fail('LF_QUEUE_CONFLICT');
        const next = {...op, ...copy(patch), phase};
        if (phase === 'inflight' && !next.expected) fail('LF_EXPECTED_REVISION_REQUIRED');
        if(phase==='verified'&&(!next.receipt||!equal(next.receipt,op.expected)))fail('LF_RECEIPT_INVALID');
        s.outbox.put(next);
        if (phase !== 'verified') { done(next); return; }
        const r = s.replicas.get(op.scope); r.onsuccess = () => {
          const current = r.result;
          if (!current) { abort(Error('LF_LOCAL_INTEGRITY')); return; }
          current.base = copy(next.receipt);
          if (current.version === op.localVersion && current.hash === op.hash) current.dirty = false;
          s.replicas.put(current); done(next);
        };
      } catch(e) { abort(e); } };
    });
  }
  async function apply({scope, value, head, expectedVersion, editor = null}) {
    id(scope);head=copy(head);editor=copy(editor);const encoded = json(value), hash = await digest(encoded);
    return transaction('readwrite', (s, done, abort) => {
      const r = s.replicas.get(scope), q = s.outbox.getAll(); let pending = 2;
      const finish = () => { if (--pending) return; try {
        const old = r.result;
        if ((old?.version || 0) !== expectedVersion || old?.dirty || q.result.some(op => op.scope === scope && op.phase !== 'verified')) fail('LF_LOCAL_CONFLICT');
        if (old?.base && (head.generation < old.base.generation || head.generation === old.base.generation && !equal(head,old.base))) fail('LF_STALE_REMOTE');
        if (old && equal(old.base, head)) { done(old); return; }
        const next = {key: scope, version: (old?.version || 0) + 1, json: encoded, hash, base: copy(head), editor: copy(editor), dirty: false};
        s.replicas.put(next); done(next);
      } catch(e) { abort(e); } }; r.onsuccess = q.onsuccess = finish;
    });
  }
  async function setEditor(scope, expectedVersion, expectedEditor, nextEditor) {
    id(scope);
    return transaction('readwrite', (s, done, abort) => {
      const q = s.replicas.get(scope), ops = s.outbox.getAll(); let pending = 2;
      const finish = () => { if (--pending) return; try {
        const old = q.result;
        if ((old?.version || 0) !== expectedVersion || old?.dirty || !equal(old?.editor || null, expectedEditor)
          || ops.result.some(op => op.scope === scope && op.phase !== 'verified')) fail('LF_LOCAL_CONFLICT');
        const row = old || {key: scope, version: 0, json: 'null', hash: null, base: null, dirty: false};
        row.editor = copy(nextEditor); row.version++;
        if (row.hash === null) { abort(Error('LF_PROJECT_MUST_BE_RECEIVED')); return; }
        s.replicas.put(row); done(row);
      } catch(e) { abort(e); } }; q.onsuccess = ops.onsuccess = finish;
    });
  }
  return Object.freeze({ownerUid, deviceId, instanceId, name, snapshot, commit, transition, apply, setEditor,
    exclusive: callback => locks.request(name + ':' + instanceId, {mode: 'exclusive'}, () => {if(closed)fail('LF_STORE_CLOSED');return callback();}),
    close() { closed = true; }});
}

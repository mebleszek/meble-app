// Durable deletion intent for the isolated candidate. The existing project outbox
// requires an active project editor, which is incompatible with investor deletion.
import {equal,fail,id} from '../../sync/local-first-values.mjs';
import {validateP0BDeletionIntent} from './p0b-protocol.mjs';

export async function openP0BDeletionJournal({indexedDB, locks, ownerUid, deviceId,registry='candidate'}) {
  const name = 'meble-lf-test-p0b-delete-'+(registry==='candidate'?'':id(registry)+'-')+'v1-' + id(ownerUid) + ':' + id(deviceId);
  const db = await new Promise((resolve,reject) => {
    const request = indexedDB.open(name,1);
    request.onupgradeneeded = () => request.result.createObjectStore('intents',{keyPath:'operationId'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  function access(mode, action) {
    return new Promise((resolve,reject) => {
      const tx = db.transaction('intents',mode,mode === 'readwrite' ? {durability:'strict'} : undefined);
      let result, error;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(error || tx.error || Error('LF_IDB_ABORTED'));
      if (mode === 'readwrite' && tx.durability !== 'strict') {
        error = Error('LF_STRICT_DURABILITY_REQUIRED');
        tx.abort();
        return;
      }
      action(tx.objectStore('intents'), value => {result = value;}, cause => {error = cause; tx.abort();});
    });
  }
  const read = operationId => access('readonly',(store,done) => {
    const request = store.get(id(operationId));
    request.onsuccess = () => done(request.result);
  });
  function change(operationId, apply) {
    return access('readwrite',(store,done,abort) => {
      const request = store.get(id(operationId));
      request.onsuccess = () => {
        try {
          const next = apply(request.result);
          if (!equal(next,request.result)) store.put(next);
          done(next);
        } catch (error) {abort(error);}
      };
    });
  }
  return Object.freeze({
    read,
    all(){return access('readonly',(store,done)=>{const q=store.getAll();q.onsuccess=()=>done(q.result);});},
    pending() {
      return access('readonly',(store,done) => {
        const request = store.getAll();
        request.onsuccess = () => done(request.result.filter(row=>!['verified','conflict'].includes(row.phase)));
      });
    },
    enqueue(intent) {
      const exact = validateP0BDeletionIntent(intent);
      return change(intent.operationId, existing => {
        if (existing) {
          if (!equal(existing.intent,exact)) fail('LF_OPERATION_REUSED');
          return existing;
        }
        return {operationId:intent.operationId, intent:exact, phase:'queued'};
      });
    },
    async reconcile(operationId, protocol, online) {
      return locks.request(name + ':' + id(operationId), async () => {
        let operation = await read(operationId);
        if (!operation) fail('LF_P0B_DELETE_INTENT_REQUIRED');
        if (operation.phase === 'verified' || operation.phase === 'conflict' || !online()) return operation;
        if(operation.phase!=='queued' && operation.intent.targets){
          // A committed group is acknowledged before any preparation retry.
          try{
            const receipt=await protocol.confirmDeletion(operation.intent);
            return change(operationId,current=>({operationId,intent:current.intent,phase:'verified',receipt}));
          }catch(_){}
        }
        if (operation.phase === 'queued' || operation.intent.targets) {
          operation = await change(operationId,current => ({...current, phase:'inflight'}));
          try { await protocol.publishDeletion(operation.intent); }
          catch (error) {
            const refused = ['LF_P0B_DELETE_CONFLICT','LF_P0B_EDITOR_CONFLICT','LF_P0B_INVESTOR_DELETED'].includes(error?.code);
            return change(operationId,current => ({...current, phase:refused ? 'conflict' : 'uncertain',
              code:refused ? error.code : 'LF_P0B_ACK_UNCONFIRMED'}));
          }
        }
        try {
          const receipt = await protocol.confirmDeletion(operation.intent);
          return change(operationId,current => ({operationId, intent:current.intent, phase:'verified', receipt}));
        } catch (_) {
          return change(operationId,current => ({...current, phase:'uncertain', code:'LF_P0B_ACK_UNCONFIRMED'}));
        }
      });
    },
    close:() => db.close()
  });
}

import {copy, fail, equal, safeError} from './local-first-values.mjs';
import {protectProjectRows,validateProjectDependencies} from './local-first-project.mjs';
import {assertGlobalConnection} from './firebase-activation.mjs';
export function createGlobalChannel({writer,reader,ownerUid,contract,factory}) {
  const a=assertGlobalConnection(writer),b=assertGlobalConnection(reader);
  if(a.uid!==ownerUid||b.uid!==ownerUid||writer.db.app===reader.db.app)fail('LF_INDEPENDENT_OWNER_REQUIRED');
  const guard=()=>{if(!equal(assertGlobalConnection(writer),a)||!equal(assertGlobalConnection(reader),b))fail('LF_AUTH_CHANGED');};
  const outbound=factory.fromConnection({...writer,assertAccess(){guard();writer.assertAccess();}}),inbound=factory.fromConnection({...reader,assertAccess(){guard();reader.assertAccess();}});
  return Object.freeze({kind:'globals',scope:'globals',contract,guard,
    async prepare(model,base){guard();contract.validateBundle(model);const packed=await contract.pack(ownerUid,model);
      const p=await outbound.prepare({model,expectedHead:base});if(!p.ok)fail(p.code);guard();
      return {expected:p.unchanged?p.head:{ownerUid,version:1,generation:(base?.generation||0)+1,
        revisionId:p.handle.revisionId,directoryHash:packed.directoryHash,recordCount:packed.records.length},
        async publish(){if(!p.unchanged){const r=await outbound.publish(p.handle);if(!r.ok)fail(r.code);}guard();}};
    },
    async read(){guard();const r=await inbound.read();if(!r.ok)fail(r.code);
      const packed=await contract.pack(ownerUid,r.model);guard();
      if(packed.directoryHash!==r.head.directoryHash||packed.records.length!==r.head.recordCount)fail('LF_REMOTE_INTEGRITY');
      return {head:r.head,value:r.model};},
    watch(notify){guard();return reader.firestore.onSnapshot(reader.firestore.doc(reader.db,'users',ownerUid,'globalData','current'),
      ()=>notify(),()=>notify());},
    async close(){await Promise.all([outbound.close(),inbound.close()]);}
  });
}

export function createDurableSynchronizer({store,channels,eventTarget,online=()=>true,onState=()=>{}}) {
  const byScope=new Map(channels.map(c=>[c.scope,c]));
  if(byScope.size!==channels.length||!eventTarget?.addEventListener||!store?.exclusive)fail('LF_DEPENDENCY_REQUIRED');
  let closed=false,scheduled=false,running=null,wake=false;
  const assertOpen=()=>{if(closed)fail('LF_CLOSED');};
  const state=value=>{try{onState(copy(value));}catch(_){}};
  async function resolve(channel,op) {
    const remote=await channel.read();
    if(!equal(remote.head,op.expected))fail('LF_ACK_UNRESOLVED');
    // Channel reader fully validates values/hashes and dependency closure.
    if(!equal(remote.value,JSON.parse(op.json)))fail('LF_REMOTE_CONTENT_MISMATCH');
    await store.transition(op.key,op.phase,'verified',{receipt:remote.head});
  }
  async function cycle() {
    if(closed||!online())return {ok:false,code:'LF_OFFLINE'};
    return store.exclusive(async()=>{
      for(const channel of channels){
        let snap=await store.snapshot(channel.scope);
        const ordered=snap.operations.sort((a,b)=>a.localVersion-b.localVersion);
        for(let op of ordered){
          if(closed||!online())return {ok:false,code:'LF_OFFLINE'};
          if(op.phase==='verified')continue;
          if(['blocked','conflict'].includes(op.phase))return {ok:false,code:op.code||op.blockers[0]||'LF_CONFLICT'};
          if(['inflight','uncertain'].includes(op.phase)){
            if(op.phase==='inflight')op=await store.transition(op.key,'inflight','uncertain');
            try{await resolve(channel,op);}catch(e){return safeError(e);}continue;
          }
          let base=op.base;
          if(op.previousOperation){const previous=(await store.snapshot(op.scope)).operations.find(p=>p.key===op.previousOperation);
            if(previous?.phase!=='verified')return {ok:false,code:'LF_PREDECESSOR_PENDING'};
            const receipt=previous.receipt;
            if(!receipt||!Number.isSafeInteger(receipt.generation)||receipt.generation<1
              ||base&&(!Number.isSafeInteger(base.generation)||base.generation<1
                ||base.generation===receipt.generation&&!equal(base,receipt)))return {ok:false,code:'LF_PREDECESSOR_BASE_CONFLICT'};
            // A queued successor may need its predecessor's newer receipt.
            // Conversely, a verified incoming revision can already be newer
            // than our last own publication: never roll that durable base back.
            if(!base||receipt.generation>base.generation)base=receipt;}
          let prepared;
          try{prepared=await channel.prepare(JSON.parse(op.json),base,op.editor);}
          catch(e){if(/CONFLICT|STALE|DEPENDENCY|EDITOR/.test(e.code||''))await store.transition(op.key,'queued','conflict',{code:e.code});return safeError(e);}
          if(closed||!online())return {ok:false,code:'LF_OFFLINE'};
          op=await store.transition(op.key,'queued','inflight',{expected:prepared.expected});
          try{await prepared.publish();if(closed)return {ok:false,code:'LF_CLOSED_RESULT_UNCONFIRMED'};await resolve(channel,op);}
          catch(e){const now=(await store.snapshot(op.scope)).operations.find(p=>p.key===op.key);
            if(now.phase==='inflight')await store.transition(op.key,'inflight','uncertain',{code:safeError(e).code});
            return safeError(e);}
        }
        snap=await store.snapshot(channel.scope);
        if(!snap.replica?.dirty && !snap.operations.some(op=>op.phase!=='verified')){
          try{const remote=await channel.read();if(!closed)await store.apply({scope:channel.scope,value:remote.value,head:remote.head,
            expectedVersion:snap.replica?.version||0,editor:snap.replica?.editor||null});}
          catch(e){if(!['GLOBAL_NOT_FOUND','CLOUD_PROJECT_NOT_FOUND'].includes(e.code))return safeError(e);}
        }
      }
      return {ok:true};
    });
  }
  function schedule(){if(closed)return;if(running){wake=true;return;}if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;void flush();});}
  async function flush(){if(closed)return {ok:false,code:'LF_CLOSED'};if(running)return running;
    running=(async()=>{let result;do{wake=false;result=await cycle().catch(safeError);state(result);}while(wake&&!closed);return result;})()
      .finally(()=>{running=null;});return running;}
  // Listeners are wake-up signals only; every receive still uses a fresh,
  // independently validated server read and local CAS, never the cache payload.
  const unsubscribe=[];
  try{for(const channel of channels)if(typeof channel.watch==='function')unsubscribe.push(channel.watch(schedule));}
  catch(e){closed=true;for(const stop of unsubscribe)stop();throw e;}
  eventTarget.addEventListener('online',schedule);schedule();
  return Object.freeze({flush,
    async submitGlobals({source,operationId,expectedVersion}){
      assertOpen();
      const c=byScope.get('globals')?.contract;if(!c)fail('LF_GLOBAL_CHANNEL_REQUIRED');
      const captured=c.capture(source,Object.keys(c.schemas));c.validateBundle(captured.model);captured.assertUnchanged();
      const snap=await store.snapshot('globals');captured.assertUnchanged();
      const out=await store.commit({scope:'globals',operationId,value:copy(captured.model),expectedVersion,base:snap.replica?.base||null});schedule();return out;
    },
    async submitProject({projectId,operationId,document,source,expectedVersion,projectContract,globalContract}){
      assertOpen();
      const channel=byScope.get(projectId);if(channel?.kind!=='project')fail('LF_PROJECT_CHANNEL_REQUIRED');
      const local=await store.snapshot(projectId),global=await store.snapshot('globals');
      const pinned=local.replica?JSON.parse(local.replica.json).globals:null;
      if(!pinned&&(!global.replica?.base||global.replica.dirty))fail('LF_GLOBAL_DEPENDENCIES_UNCONFIRMED');
      const globals=pinned||{head:global.replica.base,model:JSON.parse(global.replica.json)};
      const requirements=validateProjectDependencies(projectContract,globalContract,document,globals.model);
      const protection=protectProjectRows(source);
      const out=await store.commit({scope:projectId,operationId,value:{document:copy(document),globals,requirements},expectedVersion,
        base:local.replica?.base||null,editor:local.replica?.editor||null,...protection});schedule();return {...out,blockers:protection.blockers};
    },
    async acquireEditor(projectId){return store.exclusive(async()=>{
      assertOpen();
      const channel=byScope.get(projectId),snap=await store.snapshot(projectId);
      if(!snap.replica||snap.replica.dirty||snap.replica.editor?.active)fail('LF_LOCAL_PROJECT_NOT_READY');
      const e=await channel.acquire(snap.replica.base);
      // Uncertain local/remote acquire is a refusal; no timeout takeover.
      return store.setEditor(projectId,snap.replica.version,snap.replica.editor,e);
    });},
    async releaseEditor(projectId){return store.exclusive(async()=>{
      assertOpen();
      const channel=byScope.get(projectId),snap=await store.snapshot(projectId),r=snap.replica;
      if(!r||r.dirty||!r.editor?.active||snap.operations.some(op=>op.phase!=='verified'))fail('LF_HANDOVER_PENDING_LOCAL_WORK');
      const remote=await channel.read();if(!equal(remote.head,r.base)||!equal(remote.value,JSON.parse(r.json)))fail('LF_HANDOVER_CONTENT_MISMATCH');
      // Block local edits durably BEFORE the remote release can commit.
      const blocked=await store.setEditor(projectId,r.version,r.editor,{...r.editor,active:false,handoverPending:true});
      const released=await channel.release(r.editor,r.base);
      return store.setEditor(projectId,blocked.version,blocked.editor,released);
    });},
    async recoverEditor(projectId){return store.exclusive(async()=>{
      assertOpen();
      const channel=byScope.get(projectId),snap=await store.snapshot(projectId),r=snap.replica;
      if(!r||r.dirty||snap.operations.some(op=>op.phase!=='verified'))fail('LF_EDITOR_RECOVERY_BLOCKED');
      const e=await channel.editor();
      if(!e||e.deviceId!==store.deviceId)fail('LF_EDITOR_RECOVERY_BLOCKED');
      if(r.editor?.handoverPending && e.active)fail('LF_HANDOVER_UNCERTAIN');
      if(r.base){const remote=await channel.read();if(!equal(remote.head,r.base)||!equal(remote.value,JSON.parse(r.json)))fail('LF_EDITOR_RECOVERY_BLOCKED');}
      else if(e.headRevision!=='')fail('LF_EDITOR_RECOVERY_BLOCKED');
      return store.setEditor(projectId,r.version,r.editor,e);
    });},
    close(){closed=true;eventTarget.removeEventListener('online',schedule);for(const stop of unsubscribe)stop();}
  });
}

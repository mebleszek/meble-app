import {copy, digest, fail, equal, safeError} from './local-first-values.mjs';
import {protectProjectRows,validateProjectDependencies} from './local-first-project.mjs';
import {assertGlobalConnection} from './firebase-activation.mjs';
export function createGlobalChannel({writer,reader,ownerUid,contract,factory,store}) {
  const a=assertGlobalConnection(writer),b=assertGlobalConnection(reader);
  if(a.uid!==ownerUid||b.uid!==ownerUid||writer.db.app===reader.db.app)fail('LF_INDEPENDENT_OWNER_REQUIRED');
  const guard=()=>{if(!equal(assertGlobalConnection(writer),a)||!equal(assertGlobalConnection(reader),b))fail('LF_AUTH_CHANGED');};
  const outbound=factory.fromConnection({...writer,assertAccess(){guard();writer.assertAccess();}}),inbound=factory.fromConnection({...reader,assertAccess(){guard();reader.assertAccess();}});
  const revisions=new Map();
  const key=pin=>pin.revisionId+':'+pin.directoryHash;
  function remember(pin,request){
    const id=key(pin);
    const pending=Promise.resolve().then(request).catch(error=>{if(revisions.get(id)===pending)revisions.delete(id);throw error;});
    revisions.set(id,pending);
    if(revisions.size>8)revisions.delete(revisions.keys().next().value);
    return pending;
  }
  return Object.freeze({kind:'globals',scope:'globals',contract,guard,
    async readPinned(pin,load){
      guard();
      const cached=await (revisions.get(key(pin))||remember(pin,async()=>{
        const stored=await store?.readCatalogReplica?.(pin);
        if(stored&&await digest(stored.replica.json)===stored.replica.hash){
          const {head,model:value}=stored.catalog;
          const packed=await contract.pack(ownerUid,value);
          if(packed.directoryHash===pin.directoryHash&&packed.records.length===head.recordCount)return {head,value};
        }
        return load();
      }));
      guard();
      return copy(cached);
    },
    async prepare(model,base){guard();contract.validateBundle(model);const packed=await contract.pack(ownerUid,model);
      const p=await outbound.prepare({model,expectedHead:base});if(!p.ok)fail(p.code);guard();
      return {expected:p.unchanged?p.head:{ownerUid,version:1,generation:(base?.generation||0)+1,
        revisionId:p.handle.revisionId,directoryHash:packed.directoryHash,recordCount:packed.records.length},
        async publish(){if(!p.unchanged){const r=await outbound.publish(p.handle);if(!r.ok)fail(r.code);}guard();}};
    },
    async readHead(){guard();const r=await inbound.readHead();if(!r.ok)fail(r.code);guard();return r.head;},
    async read(){guard();const r=await inbound.read();if(!r.ok)fail(r.code);
      const packed=await contract.pack(ownerUid,r.model);guard();
      if(packed.directoryHash!==r.head.directoryHash||packed.records.length!==r.head.recordCount)fail('LF_REMOTE_INTEGRITY');
      if(!revisions.has(key(r.head)))remember(r.head,()=>copy({head:r.head,value:r.model}));
      return {head:r.head,value:r.model,parent:r.parent};},
    watch(notify){guard();return reader.firestore.onSnapshot(reader.firestore.doc(reader.db,'users',ownerUid,'globalData','current'),
      ()=>notify(),()=>notify());},
    async close(){await Promise.all([outbound.close(),inbound.close()]);}
  });
}

export function createDurableSynchronizer({store,channels,eventTarget,online=()=>true,onState=()=>{},projectRemote=async()=>null,onApplied=async()=>{},quota,ownsChannels=false}) {
  channels=[...channels];
  const byScope=new Map(channels.map(c=>[c.scope,c]));
  if(byScope.size!==channels.length||!eventTarget?.addEventListener||!store?.exclusive)fail('LF_DEPENDENCY_REQUIRED');
  let closed=false,scheduled=false,running=null,retryAt=0,retryDelay=0,retryTimer;
  const pending=new Set(byScope.keys());
  let closing;
  const assertOpen=()=>{if(closed)fail('LF_CLOSED');};
  const state=value=>{try{onState(copy(value));}catch(_){}};
  async function resolve(channel,op) {
    const remote=await channel.read();
    if(!equal(remote.head,op.expected))fail('LF_ACK_UNRESOLVED');
    // Channel reader fully validates values/hashes and dependency closure.
    if(!equal(remote.value,JSON.parse(op.json)))fail('LF_REMOTE_CONTENT_MISMATCH');
    await store.transition(op.key,op.phase,'verified',{receipt:remote.head});
  }
  async function cycle(scopes) {
    if(closed||!online())return {ok:false,code:'LF_OFFLINE'};
    return store.exclusive(async()=>{
      for(const scope of scopes){
        const channel=byScope.get(scope);
        if(closed||!online())return {ok:false,code:'LF_OFFLINE'};
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
          try{
            if(channel.readHead&&snap.replica?.base&&equal(snap.replica.base,await channel.readHead()))continue;
            if(closed||!online())return {ok:false,code:'LF_OFFLINE'};
            const remote=await channel.read();if(!closed&&!equal(snap.replica?.base,remote.head)){const application=await projectRemote(channel,remote,snap);
            if(closed)return {ok:false,code:'LF_CLOSED'};
            await store.apply({scope:channel.scope,value:remote.value,head:remote.head,application,expectedVersion:snap.replica?.version||0,editor:snap.replica?.editor||null});
            await onApplied(channel,remote);}}
          catch(e){if(!['GLOBAL_NOT_FOUND','CLOUD_PROJECT_NOT_FOUND'].includes(e.code))return safeError(e);}
        }
      }
      return {ok:true};
    });
  }
  function schedule(scope){
    if(closed)return;
    if(typeof scope==='string')pending.add(scope);
    else for(const key of byScope.keys())pending.add(key);
    if(running||scheduled||Date.now()<retryAt)return;
    scheduled=true;queueMicrotask(()=>{scheduled=false;void drain();});
  }
  async function flush(){
    if(running&&online())for(const key of byScope.keys())pending.add(key);
    if(!running&&!pending.size)for(const key of byScope.keys())pending.add(key);
    return drain();
  }
  async function drain(){if(closed)return {ok:false,code:'LF_CLOSED'};if(running)return running;
    if(Date.now()<retryAt)return {ok:false,code:'resource-exhausted'};
    running=(async()=>{let result={ok:true};while(pending.size&&!closed){
      const scopes=[...byScope.keys()].filter(scope=>pending.has(scope));pending.clear();
      result=await cycle(scopes).catch(safeError);state(result);
      if(result.code==='resource-exhausted'&&!closed){
        retryDelay=Math.min(300000,retryDelay?retryDelay*2:30000);
        const delay=result.cooldown?Math.max(1,(quota?.deadline()||Date.now())-Date.now()):retryDelay+Math.floor(Math.random()*5000);
        retryAt=Date.now()+delay;
        quota?.record(result,delay);
        for(const key of scopes)pending.add(key);
        clearTimeout(retryTimer);retryTimer=setTimeout(()=>void drain(),delay);
        break;
      }
      if(result.ok){retryAt=0;retryDelay=0;clearTimeout(retryTimer);}
      else{
        const reconnected=result.code==='LF_OFFLINE'&&pending.size>0&&online();
        for(const key of scopes)pending.add(key);
        if(!reconnected)break;
      }
    }return result;})()
      .finally(()=>{running=null;});return running;}
  // Listeners are wake-up signals only; every receive still uses a fresh,
  // independently validated server read and local CAS, never the cache payload.
  const unsubscribe=[];
  try{for(const channel of channels)if(typeof channel.watch==='function')unsubscribe.push(channel.watch(()=>schedule(channel.scope)));}
  catch(e){closed=true;for(const stop of unsubscribe)stop();throw e;}
  eventTarget.addEventListener('online',schedule);schedule();
  return Object.freeze({notify:schedule,flush,channel:scope=>byScope.get(scope),
    register(channel){assertOpen();if(!channel||byScope.has(channel.scope)||channel.kind!=='project')fail('LF_CHANNEL_CONFLICT');channel.guard();
      const stop=typeof channel.watch==='function'?channel.watch(()=>schedule(channel.scope)):()=>{};
      byScope.set(channel.scope,channel);unsubscribe.push(stop);schedule(channel.scope);},
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
      if(!r||r.dirty||!(r.editor?.active||r.editor?.handoverPending)||snap.operations.some(op=>op.phase!=='verified'))fail('LF_HANDOVER_PENDING_LOCAL_WORK');
      const remote=await channel.read();if(!equal(remote.head,r.base)||!equal(remote.value,JSON.parse(r.json)))fail('LF_HANDOVER_CONTENT_MISMATCH');
      // Block local edits durably BEFORE the remote release can commit.
      const blocked=r.editor.handoverPending?r:await store.setEditor(projectId,r.version,r.editor,{...r.editor,active:false,handoverPending:true});
      const {handoverPending,...proof}=blocked.editor;
      const current=await channel.editor();
      const released={...proof,headRevision:r.base.currentRevisionId};
      if(!equal(current,released)){
        const active={...proof,active:true};
        if(!equal(current,active))fail('LF_HANDOVER_CONFLICT');
        const confirmed=await channel.release(active,r.base);
        if(!equal(confirmed,released))fail('LF_HANDOVER_CONFLICT');
      }
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
    // Listener removal is not completion of an in-flight SDK/IDB cycle.
    close(){
      if(closing)return closing;
      closed=true;clearTimeout(retryTimer);eventTarget.removeEventListener('online',schedule);
      for(const stop of unsubscribe)stop();
      closing=Promise.resolve(running).then(()=>{
        if(ownsChannels)return Promise.all([...byScope.values()].map(channel=>channel.close?.()));
      });
      return closing;
    }
  });
}

// Normal-startup composition of the released LOCAL-FIRST components, demo only.
import {openLocalFirstStore} from './local-first-idb.mjs';
import {createGlobalChannel} from './local-first-sync.mjs';
import {createProjectChannel} from './local-first-project.mjs';
import {createApplicationReplication,createEmulatorProjectDiscovery,createApplicationCommitter} from './application-replication.mjs';
import {installEmulatorApplicationAuthority,createApplicationActionBinding,applicationKeys,installOfflineEmulatorApplicationAuthority} from './application-authority.mjs';
import {installApplicationWriteBoundary} from './application-write-boundary.mjs';
import {applicationInstallation,verifyExclusiveClient} from './application-installation.mjs';
import {copy,equal,assertEmulator,fail,safeError} from './local-first-values.mjs';
export async function startNormalEmulatorApplication({window:w,writer,reader,name,ownerUid,boot}){
 const fc=w.FC;
 if(writer){const a=assertEmulator(writer),b=assertEmulator(reader);if(a.uid!==ownerUid||b.uid!==ownerUid||writer.db.app===reader.db.app)fail('LF_INDEPENDENT_OWNER_REQUIRED');}
 else if(!boot?.restored)fail('LF_ONLINE_INSTALLATION_REQUIRED');
 w.__FC_MAIN_ACCESS__.assert();
 const keys=applicationKeys(fc);
 const installation=await applicationInstallation({window:w,ownerUid,name,keys,sourceRead:boot?.readNative,heldRelease:boot?.release});
 let store,sync,authority,boundary,closed=false,authorityReady=false,incomingBlocked=false;const states=[];
 const state=value=>{if(['LF_ACTIVE_FORM_PROTECTED','LF_ACTIVE_RAM_PROTECTED'].includes(value.code))incomingBlocked=true;states.push(copy(value));if(states.length>12)states.shift();};
 try{
  store=await openLocalFirstStore({...installation.binding,indexedDB:w.indexedDB,locks:w.navigator.locks});
  const c=fc.globalDataContract,p=fc.businessProjectContract;
  let globals=writer?createGlobalChannel({writer,reader,ownerUid,contract:c,factory:fc.firebaseGlobalTransport}):null;
  const channel=record=>createProjectChannel({writer,reader,ownerUid,deviceId:store.deviceId,projectId:record.id,investorId:record.investorId,
   pilotContract:fc.cloudPilotContract,pilotFactory:fc.firebasePilotTransport,globalContract:c,projectContract:p,globals});
  const channels=[globals];
  const image=await store.readApplication(),rows=image?.rows||installation.rows;
  if(writer)for(const record of JSON.parse(rows.fc_projects_v1||'[]'))channels.push(channel(record));
  const idle=()=>authority.assertIdle({allowForm:true});
  const discovery=writer?createEmulatorProjectDiscovery({writer,reader,ownerUid,deviceId:store.deviceId,
   pilotContract:fc.cloudPilotContract,pilotFactory:fc.firebasePilotTransport,globalContract:c,projectContract:p,globals}):null;
  sync=writer?createApplicationReplication({store,channels,globalContract:c,projectContract:p,eventTarget:w,
   online:()=>authorityReady&&!closed&&w.navigator.onLine!==false,onState:state,discovery,
   incoming:next=>authority.incoming(next),refresh:()=>authority.refresh(),assertIdle:idle}):null;
  const local=createApplicationCommitter({store,globalContract:c,projectContract:p,channel:scope=>JSON.parse(rows.fc_projects_v1||'[]').some(p=>p.id===scope)?{kind:'project'}:null});
  async function ensureEditor(scope=w.localStorage.getItem('fc_current_project_id_v1')){
   if(!scope)fail('LF_PROJECT_CHANNEL_REQUIRED');
   const snap=await store.snapshot(scope);
   if(snap.replica?.editor?.active&&snap.replica.editor.deviceId===store.deviceId)return;
   if(!sync||w.navigator.onLine===false)fail('LF_OFFLINE_EDITOR_REQUIRED');
   await sync.acquireEditor(scope);
  }
  authority=await (writer?installEmulatorApplicationAuthority:installOfflineEmulatorApplicationAuthority)({window:w,store,ownerUid,connection:writer,sourceRead:boot?.readNative,initialRows:boot?.rows(),
   beforeTransaction:()=>verifyExclusiveClient(w),onCommitted:()=>sync?.notify(),authorize:ensureEditor,
   checkpoint:(application,kind)=>(sync||local).checkpoint(application,kind),
   commit:async(kind,application)=>{
    let scope=application.rows.fc_current_project_id_v1;
    if(kind==='project'){
     const before=await store.readApplication(),old=JSON.parse(before.rows.fc_projects_v1||'[]'),next=JSON.parse(application.rows.fc_projects_v1||'[]');
     const changed=next.filter(row=>!equal(row,old.find(x=>x.id===row.id)));
     if(changed.length>1)fail('LF_APPLICATION_PROJECT_SCOPE_REQUIRED');scope=changed[0]?.id||scope;
     if(!scope)fail('LF_APPLICATION_PROJECT_SCOPE_REQUIRED');
     if(sync&&!sync.channel(scope)){
      if(w.navigator.onLine===false)fail('LF_ONLINE_NEW_PROJECT_REQUIRED');
      const record=next.find(r=>r.id===scope),built=await p.build({getItem:k=>application.rows[k]??null},scope),g=await store.snapshot('globals');
      if(!g.replica?.base||g.replica.dirty)fail('LF_GLOBAL_DEPENDENCIES_UNCONFIRMED');
      const ch=channel(record);let remote=null;
      try{remote=await ch.read();}catch(e){if(e.code!=='CLOUD_PROJECT_NOT_FOUND')throw e;}
      if(remote)fail('LF_INITIAL_PROJECT_CONFLICT');
      const editor=await ch.acquire(null),value={document:built.document,globals:{head:g.replica.base,model:JSON.parse(g.replica.json)},requirements:p.dependencies(built.document.payload)};
      await store.apply({scope,value,head:null,expectedVersion:0,editor});sync.register(ch);
     }
     await ensureEditor(scope);
    }
    return (sync||local).commit(kind,application,scope);
   }});
  installation.confirm();authorityReady=true;
  // A local image exists before any network operation; source remains unchanged.
  // Only seed a remote-empty global scope. A competing revision is a CAS refusal.
  if(writer){await store.exclusive(async()=>{
   const snap=await store.snapshot('globals');
   if(!snap.replica){
    let remote=null;try{remote=await globals.read();}catch(e){if(e.code!=='GLOBAL_NOT_FOUND')throw e;}
    const captured=c.capture({getItem:k=>authority.rows()[k]??null},Object.keys(c.schemas));c.validateBundle(captured.model);
    if(remote){if(!equal(remote.value,captured.model))fail('LF_INITIAL_GLOBAL_CONFLICT');
     await store.apply({scope:'globals',value:remote.value,head:remote.head,expectedVersion:0});
    }else await store.commit({scope:'globals',operationId:crypto.randomUUID(),value:captured.model,expectedVersion:0});
   }
  });const result=await sync.flush();if(!result.ok)fail(result.code);}
  // Existing owned source projects become real channels without synthetic flags.
  if(writer)for(const record of JSON.parse(authority.rows().fc_projects_v1||'[]')){
   await store.exclusive(async()=>{
   if((await store.snapshot(record.id)).replica)return;
   const ch=sync.channel(record.id),source={getItem:k=>authority.rows()[k]??null};
   try{
    const built=await p.build(source,record.id),g=await store.snapshot('globals');
    let remote=null;try{remote=await ch.read();}catch(e){if(e.code!=='CLOUD_PROJECT_NOT_FOUND')throw e;}
    if(remote){
     if(!equal(remote.value.document.payload,built.document.payload))fail('LF_INITIAL_PROJECT_CONFLICT');
     await store.apply({scope:record.id,value:remote.value,head:remote.head,expectedVersion:0});
    }else{
     const editor=await ch.acquire(null),value={document:built.document,globals:{head:g.replica.base,model:JSON.parse(g.replica.json)},requirements:fc.businessProjectContract.dependencies(built.document.payload)};
     await store.apply({scope:record.id,value,head:null,expectedVersion:0,editor});
     const base=await store.snapshot(record.id);
     await store.commit({scope:record.id,operationId:crypto.randomUUID(),value,expectedVersion:base.replica.version,editor});
    }
   }catch(error){state({...safeError(error),scope:'project-transfer-blocked'});}
   });
  }
  async function handover(scope){
   // A confirmed local Exit is allowed offline; server ownership remains held.
   // The next verified reconnect releases it only from the clean list view.
   if(!sync||w.navigator.onLine===false)return {pending:true};
   if(!scope)return;
   const local=await store.snapshot(scope);
   if(!local.replica?.editor?.active||local.replica.editor.deviceId!==store.deviceId)return;
   const result=await sync.flush();if(!result.ok)fail(result.code);
   await sync.releaseEditor(scope);
  }
  if(writer){const result=await sync.flush();if(!result.ok)state(result);
   if(!fc.session.active)for(const record of JSON.parse(authority.rows().fc_projects_v1||'[]'))await handover(record.id);
  }
  const notify=()=>sync?.notify();w.addEventListener('online',notify);
  const wakeReceive=()=>queueMicrotask(()=>{if(!incomingBlocked||closed)return;try{authority.assertIdle();incomingBlocked=false;sync?.notify();}catch(_){}});
  w.addEventListener('click',wakeReceive,{capture:true,passive:true});
  const bind=()=>{
   boundary=installApplicationWriteBoundary({window:w,authority,ensureEditor,onExit:handover});
   fc.applicationSyncActions.install(createApplicationActionBinding({window:w,authority,onExit:handover,onClose:()=>{closed=true;sync?.close();boundary.close();}}));
  };bind();
  sync?.notify();
  return Object.freeze({store,authority,get sync(){return sync;},write:boundary.run,
   status:()=>({state:closed?'locked':sync?'active':'offline',sourcePreserved:true,projectRecords:JSON.parse(authority.rows().fc_projects_v1||'[]').length,projectChannels:JSON.parse(authority.rows().fc_projects_v1||'[]').filter(p=>!!sync?.channel(p.id)).length,transactionPending:authority.status().transactionPending||boundary?.busy()===true,states:copy(states)}),
   async resume(next){
    if(assertEmulator(next.writer).uid!==ownerUid||assertEmulator(next.reader).uid!==ownerUid)fail('LF_APPLICATION_OWNER_CHANGED');
    const wasClosed=closed;sync?.close();writer=next.writer;reader=next.reader;authority.resume(ownerUid);closed=false;if(authority.status().incomingPending)await authority.refresh();
    globals=createGlobalChannel({writer,reader,ownerUid,contract:c,factory:fc.firebaseGlobalTransport});
    const channels=[globals,...JSON.parse(authority.rows().fc_projects_v1||'[]').map(channel)];
    sync=createApplicationReplication({store,channels,globalContract:c,projectContract:p,eventTarget:w,online:()=>!closed&&w.navigator.onLine!==false,onState:state,
     discovery:createEmulatorProjectDiscovery({writer,reader,ownerUid,deviceId:store.deviceId,pilotContract:fc.cloudPilotContract,pilotFactory:fc.firebasePilotTransport,globalContract:c,projectContract:p,globals}),
     incoming:next=>authority.incoming(next),refresh:()=>authority.refresh(),assertIdle:idle});
    if(wasClosed)bind();sync.notify();
    void sync.flush().then(async result=>{if(result.ok&&!fc.session.active&&w.uiState.entry==='investorsList')for(const p of JSON.parse(authority.rows().fc_projects_v1||'[]')){if(fc.session.active||w.uiState.entry!=='investorsList')return;await handover(p.id);}}).catch(error=>state(safeError(error)));
   },
   close(){closed=true;sync?.close();boundary.close();authority.close();w.removeEventListener('online',notify);w.removeEventListener('click',wakeReceive,true);},
   async dispose(){closed=true;sync?.close();boundary?.close();authority?.close();store.close();await installation.release();}});
 }catch(error){closed=true;sync?.close();boundary?.close();authority?.close();store?.close();await installation.release();throw error;}
}

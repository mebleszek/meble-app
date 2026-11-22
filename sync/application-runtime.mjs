// Normal-startup composition of the released LOCAL-FIRST components; inert import.
import {resumeRoomBootRecovery} from './application-room-boot-recovery.mjs';
import {createP0BRuntime} from './application-p0b-runtime.mjs';
import {completeMissingApplicationGlobals,emptyInstallationRows} from './application-initial-state.mjs';
import {openLocalFirstStore} from './local-first-idb.mjs';
import {createLocalDeviceLabel} from './local-device-label.mjs';
import {createGlobalChannel} from './local-first-sync.mjs';
import {createProjectChannel} from './local-first-project.mjs';
import {createApplicationReplication,createEmulatorProjectDiscovery,createApplicationCommitter,createApplicationHandover,projectApplicationRows} from './application-replication.mjs';
import {installEmulatorApplicationAuthority,createApplicationActionBinding,applicationKeys,installOfflineEmulatorApplicationAuthority,installAuthorizedApplicationAuthority} from './application-authority.mjs';
import {installApplicationWriteBoundary} from './application-write-boundary.mjs';
import {applicationInstallation,verifyExclusiveClient} from './application-installation.mjs';
import {assertApplicationConnection,assertP0BConnection} from './firebase-activation.mjs';
import {planFirstCatalogSync} from './application-first-catalog-sync.mjs';
import {assertApplicationRelease,applicationP0BMode} from './application-release.mjs';
import {installLocalInvestorDeletion} from './application-investor-delete.mjs';
import {copy,equal,assertEmulator,fail,safeError} from './local-first-values.mjs';
export function startNormalEmulatorApplication(options){return startApplicationRuntime(options);}
export async function startApplicationRuntime({window:w,writer,reader,name,ownerUid,boot,release:deployment,localOnly=false,firstCatalogSync=false,p0bDemo=false,emulatorCatalogWitness,onStage=()=>{},onDiagnostic=()=>{},onFailureQuiescent=()=>{}}){
 const fc=w.FC,p0bEnabled=applicationP0BMode({release:deployment,window:w,name,ownerUid,p0bDemo,localOnly});
 if(emulatorCatalogWitness&&(assertApplicationRelease(deployment).projectId!=='demo-meble-app'||writer?.db.app.options.projectId!=='demo-meble-app'))fail('LF_EMULATOR_REQUIRED');
 if(localOnly&&(writer||reader||!boot?.localOnly))fail('LF_LOCAL_MODE_REQUIRED');
 if(writer){const a=assertApplicationConnection(writer),b=assertApplicationConnection(reader);if(a.uid!==ownerUid||b.uid!==ownerUid||writer.db.app===reader.db.app)fail('LF_INDEPENDENT_OWNER_REQUIRED');}
 else if(!boot?.restored&&!(localOnly&&boot?.localOnly))fail('LF_ONLINE_INSTALLATION_REQUIRED');
 if(p0bEnabled&&writer){assertP0BConnection(writer);assertP0BConnection(reader);}
 w.__FC_MAIN_ACCESS__.assert();
 const keys=applicationKeys(fc);
 onStage('checking-installation');const installation=await applicationInstallation({window:w,ownerUid,name,keys,sourceRead:boot?.readNative,heldRelease:boot?.release,release:deployment,migration:boot?.migration,p0bDemo:p0bEnabled});
 let store,sync,authority,boundary,deletion,p0b,closed=false,authorityReady=false,incomingBlocked=false,recoveryReading=false;const states=[];let wakeHandovers=()=>{},wakeReceives=()=>{};
 const state=(value,error)=>{try{onDiagnostic({ok:value.ok===true,code:error?.code||error?.message||value.code,projectTransferBlocked:value.scope==='project-transfer-blocked'});}catch(_){}if(['LF_ACTIVE_FORM_PROTECTED','LF_ACTIVE_RAM_PROTECTED'].includes(value.code)||value.reason==='LF_P0B_DELETION_RECOVERY_REQUIRED')incomingBlocked=true;states.push(copy(value));if(states.length>12)states.shift();if(value.ok)wakeHandovers();else if(p0b&&['LF_EDITOR_CONFLICT','LF_P0B_EDITOR_CONFLICT','LF_ACK_UNRESOLVED'].includes(value.code))void p0b.canRecover(value).then(ok=>{if(ok&&w.document.body.dataset.businessState==='ready')return p0b.offerRecovery();}).catch(()=>{});};
 try{
  onStage('opening-idb');store=await openLocalFirstStore({...installation.binding,indexedDB:w.indexedDB,locks:w.navigator.locks});
  if(!p0bEnabled&&await store.p0bRegistry())fail('LF_P0B_REGISTRY_REQUIRED');
  if(p0bEnabled){if(boot?.p0bDemo!==true)fail('LF_P0B_REGISTRY_REQUIRED');await store.exclusive(async()=>{if(deployment&&!await store.readApplication())await store.initializeApplication(installation.rows);await store.enterP0BRegistry(boot.p0bSource);});}
  const c=fc.globalDataContract,p=fc.businessProjectContract;
  const emptyP0BGlobals=p0bEnabled&&Object.values(c.sources).flat().every(key=>boot.p0bSource?.[key]==null)&&boot.p0bSource?.fc_materials_v1==null;
  let globals=writer?createGlobalChannel({writer,reader,ownerUid,contract:c,factory:fc.firebaseGlobalTransport,store}):null;
  if(p0bEnabled)p0b=await createP0BRuntime({window:w,writer,reader,store,getAuthority:()=>authority,getSync:()=>sync,getGlobals:()=>globals,backupKeys:boot.backupKeys,onError:error=>state(safeError(error),error)});
  const channel=record=>p0b?p0b.project(record):createProjectChannel({writer,reader,ownerUid,deviceId:store.deviceId,projectId:record.id,investorId:record.investorId,
   pilotContract:fc.cloudPilotContract,pilotFactory:fc.firebasePilotTransport,globalContract:c,projectContract:p,globals});
  const channels=[globals];
  const image=await store.readApplication();
  let initialRows=deployment&&boot?.fresh&&!boot.restored?emptyInstallationRows(boot.rows()):boot?.rows();
  let firstCatalog;
  if(firstCatalogSync&&!(await store.snapshot('globals')).replica){
   onStage('initial-global-revision');
   if(!globals)fail('LF_FIRST_CATALOG_ONLINE_REQUIRED');
   const remote=await globals.read();
   const plan=await planFirstCatalogSync({remote,image,boot,contract:c,ownerUid},emulatorCatalogWitness);
   firstCatalog={remote,plan};
   if(plan.action==='receive')initialRows=projectApplicationRows(initialRows,globals,remote,c,p);
  }
  const rows=image?.rows||initialRows||installation.rows;
  if(writer)for(const record of JSON.parse(rows.fc_projects_v1||'[]'))channels.push(channel(record));
  const idle=()=>authority.assertIdle({allowForm:true});
  const discovery=writer?(p0b?.discovery||createEmulatorProjectDiscovery({writer,reader,ownerUid,deviceId:store.deviceId,
   pilotContract:fc.cloudPilotContract,pilotFactory:fc.firebasePilotTransport,globalContract:c,projectContract:p,globals})):null;
  sync=writer?createApplicationReplication({store,channels,globalContract:c,projectContract:p,summarizeLocal:fc.projectModel?.summarizeProjectData,eventTarget:w,quota:writer.quota,ownsChannels:true,
   online:()=>authorityReady&&!closed&&w.navigator.onLine!==false,onState:state,discovery,projectRows:p0b?.projectRows,
   incoming:next=>authority.incoming(next),refresh:()=>authority.refresh(),assertIdle:idle}):null;
  const local=createApplicationCommitter({store,globalContract:c,projectContract:p,localOnly,summarizeLocal:fc.projectModel?.summarizeProjectData,channel:scope=>JSON.parse(rows.fc_projects_v1||'[]').some(p=>p.id===scope)?{kind:'project'}:null});
  const verifiedEditors=new Map();
  const handovers=createApplicationHandover({store,getSync:()=>sync,online:()=>!closed&&w.navigator.onLine!==false,onError:error=>state(safeError(error),error)});
  async function ensureEditor(scope=w.localStorage.getItem('fc_current_project_id_v1'),{reopen=false}={}){
   if(!scope)fail('LF_PROJECT_CHANNEL_REQUIRED');
   if(p0b){const record=JSON.parse((await store.readApplication()).rows.fc_projects_v1||'[]').find(row=>row.id===scope);if(!record||record.investorId!==w.localStorage.getItem('fc_current_investor_v1'))fail('LF_APPLICATION_SCOPE_REFUSED');fc.roomProjectModel.validate(record);if(record.meta.roomProject.removed)fail('LF_ROOM_PROJECT_REMOVED');}
   if(p0b){if(await store.retired(scope))fail('LF_P0B_SCOPE_RETIRED');if(p0b.isLost(scope))fail('LF_EDITOR_RECOVERY_BLOCKED');await p0b.ensureNewProject(scope);}
   if(localOnly){const localRows=authority?authority.rows():(await store.readApplication()).rows;if(!JSON.parse(localRows.fc_projects_v1||'[]').some(p=>p.id===scope))fail('LF_PROJECT_CHANNEL_REQUIRED');return;}
   if(await store.pendingProjectRecovery(scope))fail('LF_PROJECT_RECOVERY_PENDING');
   await handovers.start(scope);
   await handovers.pending(scope);
   const snap=await store.snapshot(scope), editor=snap.replica?.editor;
   const request=await store.pendingHandover(scope);
   const online=sync&&w.navigator.onLine!==false;
   if(editor?.handoverPending||request&&!reopen)fail('LF_HANDOVER_UNCERTAIN');
   if(request){
    if(online)await sync.recoverEditor(scope);
    await store.exclusive(()=>store.withdrawHandover(scope,request));
    if(online)verifiedEditors.set(scope,editor.epoch);
   }
   if(editor?.active&&editor.deviceId===store.deviceId){
    if(online&&verifiedEditors.get(scope)!==editor.epoch){
     await sync.recoverEditor(scope);
     verifiedEditors.set(scope,editor.epoch);
    }
    p0b?.watchEditor(scope,editor);return;
   }
   if(!online)fail('LF_OFFLINE_EDITOR_REQUIRED');
   let replica;
   try{replica=await sync.acquireEditor(scope);}
   catch(e){
    if(e.code!=='LF_EDITOR_BUSY_OR_HEAD_CHANGED')throw e;
    try{replica=await sync.recoverEditor(scope);}
    catch(recovery){if(recovery.code==='LF_EDITOR_RECOVERY_BLOCKED')throw e;throw recovery;}
   }
   verifiedEditors.set(scope,replica.editor.epoch);p0b?.watchEditor(scope,replica.editor);
  }
  if(localOnly){onStage('initial-global-revision');const captured=c.capture({getItem:k=>k==='fc_edit_session_v1'?null:rows[k]??null},Object.keys(c.schemas));c.validateBundle(captured.model);}
  if(p0b)await resumeRoomBootRecovery({window:w,store,p0b,boot});
  onStage('installing-authority');authority=await (deployment?installAuthorizedApplicationAuthority:writer?installEmulatorApplicationAuthority:installOfflineEmulatorApplicationAuthority)({window:w,store,ownerUid,connection:writer,sourceRead:boot?.readNative,initialRows,release:deployment,localOnly,recoverBootDraft:p0b?error=>p0b.canRecover(safeError(error)):undefined,
   beforeTransaction:()=>{if(recoveryReading)fail('LF_APPLICATION_BUSY');return boot?.verifyFence?boot.verifyFence():verifyExclusiveClient(w);},onCommitted:scope=>{sync?.notify(scope);wakeReceives();},authorize:ensureEditor,
   checkpoint:(application,kind,exitScope)=>p0b?p0b.checkpoint(application,()=>(sync||local).checkpoint(application,kind,exitScope)):(sync||local).checkpoint(application,kind,localOnly?undefined:exitScope),
   commit:async(kind,application,{writeScopes}={})=>{
    let scope=application.rows.fc_current_project_id_v1;
    if(localOnly&&kind==='delete-investors'){if(!deletion)fail('DELETE_CONFIRMATION_REQUIRED');return deletion.commitApplication(application);}
    if(localOnly)return local.commit(kind,application,scope);
    if(p0b&&(kind==='project'||kind==='room-records')){
     const result=await p0b.commit(application,writeScopes||[scope],{batchable:kind==='project'&&!writeScopes});
     if(result){authority.afterCommit(()=>{for(const scope of result.scopes||[result.scope])sync?.notify(scope);void p0b.resume().catch(error=>state(safeError(error),error));});return result;}
    }
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
  installation.confirm();onStage('initial-global-revision');
  if(localOnly){const captured=c.capture({getItem:k=>k==='fc_edit_session_v1'?null:authority.rows()[k]??null},Object.keys(c.schemas));c.validateBundle(captured.model);}
  // A local image exists before any network operation; source remains unchanged.
  // Only seed a remote-empty global scope. A competing revision is a CAS refusal.
  if(writer){await store.exclusive(async()=>{
   const snap=await store.snapshot('globals');
   if(!snap.replica){
    let remote=null;try{remote=await globals.read();}catch(e){if(e.code!=='GLOBAL_NOT_FOUND')throw e;}
    if(firstCatalog){
     if(!remote||!equal(remote.head,firstCatalog.remote.head))fail('LF_FIRST_CATALOG_BASE_CHANGED');
     const {plan}=firstCatalog;
     if(plan.action==='publish'){
      if((await store.readApplication())?.hash!==image.hash)fail('LF_FIRST_CATALOG_SOURCE_CHANGED');
      await boot.verifyFence();
      await store.commit({scope:'globals',operationId:crypto.randomUUID(),value:plan.model,
       expectedVersion:0,base:remote.head,protectedRows:image.rows});
     }else{
      await store.apply({scope:'globals',value:remote.value,head:remote.head,expectedVersion:0});
     }
     return;
    }
    if(remote){
     if(!(deployment&&boot.fresh)&&!emptyP0BGlobals){
      const captured=c.capture({getItem:k=>authority.rows()[k]??null},Object.keys(c.schemas));c.validateBundle(captured.model);
      if(!equal(remote.value,captured.model))fail('LF_INITIAL_GLOBAL_CONFLICT');
     }
     const image=await store.readApplication(),application=await authority.incoming(projectApplicationRows(image.rows,globals,remote,c,p));
     await store.apply({scope:'globals',value:remote.value,head:remote.head,expectedVersion:0,application});await authority.refresh();
    }else{
     const completed=deployment?completeMissingApplicationGlobals(authority.rows(),fc,c):authority.rows();
     const captured=c.capture({getItem:k=>completed[k]??null},Object.keys(c.schemas));c.validateBundle(captured.model);
     const application=await authority.incoming(completed);
     await store.commit({scope:'globals',operationId:crypto.randomUUID(),value:captured.model,expectedVersion:0,application});await authority.refresh();
    }
   }
  });authorityReady=true;
   const result=await sync.flush({forceProjects:false});
   // A project journal must remain accessible for local recovery.
   if(!result.ok&&result.code!=='LF_PROJECT_OPERATION_PENDING'&&!await p0b?.canRecover(result))fail(result.code);
  }else authorityReady=true;
  if(!localOnly)onStage('initial-project-revisions');
  // Existing owned source projects become real channels without synthetic flags.
  if(writer&&!p0b)for(const record of JSON.parse(authority.rows().fc_projects_v1||'[]')){
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
     await store.commit({scope:record.id,operationId:crypto.randomUUID(),value,expectedVersion:base.replica.version,editor,releaseAfterSync:true});
    }
   }catch(error){state({...safeError(error),scope:'project-transfer-blocked'},error);}
   });
  }
  const projectScopes=()=>JSON.parse(authority.rows().fc_projects_v1||'[]').map(record=>record.id);
  function deferHandover(scope){
   if(!scope)return;
   void (async()=>{if(p0b&&await store.retired(scope)){sync?.discover();return;}await handovers.start(scope);})().catch(error=>state(safeError(error),error));
  }
  wakeHandovers=()=>{if(!closed){void handovers.resume(projectScopes());if(p0b)void p0b.resume().catch(error=>state(safeError(error),error));}};
  if(writer){const result=await sync.flush({forceProjects:false});if(!result.ok)state(result);
   await handovers.resume(projectScopes());
  }
  const notify=()=>{sync?.notify();sync?.discover?.();};
  const reconnected=()=>{verifiedEditors.clear();notify();for(const scope of projectScopes())deferHandover(scope);};
  const authorized=()=>{if(closed)return;p0b?.refreshPresence();verifiedEditors.clear();notify();wakeHandovers();};
  const unconfirmed=()=>p0b?.suspendPresence();
  w.addEventListener('online',reconnected);w.addEventListener('meble-sync-authorized',authorized);w.addEventListener('meble-sync-unconfirmed',unconfirmed);
  const wakeReceive=()=>queueMicrotask(()=>{if(!incomingBlocked||closed)return;try{authority.assertIdle();incomingBlocked=false;sync?.notify();sync?.discover();}catch(_){}});
  wakeReceives=wakeReceive;
  w.addEventListener('click',wakeReceive,{capture:true,passive:true});
  const bind=async()=>{
   fc.localDeviceLabel=createLocalDeviceLabel({storage:w.localStorage,deviceId:store.deviceId,navigator:w.navigator,assertAccess(){
    if(closed)fail('LF_CLOSED');w.__FC_MAIN_ACCESS__.assert();
   }});
   boundary=installApplicationWriteBoundary({window:w,authority,ensureEditor,localOnly,registry:p0bEnabled?'p0b-rooms-v1':undefined,onExit:deferHandover,preflightAcceptance:p0b?.preflightAcceptance});
   if(localOnly)deletion=installLocalInvestorDeletion({window:w,store,authority,boundary});
   fc.applicationSyncActions.install(createApplicationActionBinding({window:w,authority,onExit:deferHandover,onClose:()=>{closed=true;sync?.close();deletion?.close();p0b?.close();boundary.close();}}));
   await p0b?.bind();
  };await bind();
  if(localOnly)boot?.confirmLocalReset?.();
  notify();if(p0b)w.setTimeout(()=>{void p0b.offerRecovery();},0);
  return Object.freeze({store,authority,get sync(){return sync;},write:boundary.run,wake:authorized,
   async withRescueRead(operation){
    if(closed||recoveryReading||authority.status().transactionPending||authority.status().incomingPending)fail('LF_APPLICATION_BUSY');
    recoveryReading=true;try{return await operation();}finally{recoveryReading=false;}
   },
   status:()=>({state:closed?'locked':localOnly?'local-only':sync?'active':'offline',...(localOnly?{cloudConfirmed:false,writeCode:authority.status().lastCode}:{}),sourcePreserved:true,projectRecords:JSON.parse(authority.rows().fc_projects_v1||'[]').length,projectChannels:JSON.parse(authority.rows().fc_projects_v1||'[]').filter(p=>!!sync?.channel(p.id)).length,transactionPending:authority.status().transactionPending||boundary?.busy()===true,incomingPending:authority.status().incomingPending,states:copy(states)}),
   async resume(next){
    if(localOnly){if(next?.localOwnerUid!==ownerUid||next.writer||next.reader)fail('LF_LOCAL_SYNC_NOT_AUTHORIZED');w.__FC_MAIN_ACCESS__.assert();const wasClosed=closed;authority.resume(ownerUid);closed=false;if(wasClosed)await bind();return;}
    if(assertApplicationConnection(next.writer).uid!==ownerUid||assertApplicationConnection(next.reader).uid!==ownerUid)fail('LF_APPLICATION_OWNER_CHANGED');
    if(p0bEnabled){assertP0BConnection(next.writer);assertP0BConnection(next.reader);}
    const wasClosed=closed;await sync?.close();p0b?.close();verifiedEditors.clear();writer=next.writer;reader=next.reader;authority.resume(ownerUid);closed=false;if(authority.status().incomingPending)await authority.refresh();
    globals=createGlobalChannel({writer,reader,ownerUid,contract:c,factory:fc.firebaseGlobalTransport,store});
    if(p0bEnabled)p0b=await createP0BRuntime({window:w,writer,reader,store,getAuthority:()=>authority,getSync:()=>sync,getGlobals:()=>globals,backupKeys:boot.backupKeys,onError:error=>state(safeError(error),error)});
    const channels=[globals,...JSON.parse(authority.rows().fc_projects_v1||'[]').map(channel)];
    sync=createApplicationReplication({store,channels,globalContract:c,projectContract:p,summarizeLocal:fc.projectModel?.summarizeProjectData,eventTarget:w,quota:writer.quota,ownsChannels:true,online:()=>!closed&&w.navigator.onLine!==false,onState:state,
     projectRows:p0b?.projectRows,discovery:p0b?.discovery||createEmulatorProjectDiscovery({writer,reader,ownerUid,deviceId:store.deviceId,pilotContract:fc.cloudPilotContract,pilotFactory:fc.firebasePilotTransport,globalContract:c,projectContract:p,globals}),
     incoming:next=>authority.incoming(next),refresh:()=>authority.refresh(),assertIdle:idle});
    if(wasClosed)await bind();else await p0b?.bind();notify();
    // Do not report a rebound runtime ready while the durable queue is still
    // resolving its previous generation's uncertain operation. Never retry WRITE.
    const result=await sync.flush({forceProjects:false});
    if(!result.ok&&result.code!=='LF_PROJECT_OPERATION_PENDING'&&!await p0b?.canRecover(result)){state(result);fail(result.code);}
    await handovers.resume(projectScopes());if(p0b)void p0b.offerRecovery();
   },
   close(){closed=true;sync?.close();deletion?.close();p0b?.close();boundary.close();authority.close();w.removeEventListener('online',reconnected);w.removeEventListener('meble-sync-authorized',authorized);w.removeEventListener('meble-sync-unconfirmed',unconfirmed);w.removeEventListener('click',wakeReceive,true);},
   async dispose(){closed=true;await sync?.close();deletion?.close();p0b?.close();boundary?.close();authority?.close();store.close();await installation.release();}});
 }catch(error){
  closed=true;let quiet=true;try{await sync?.close();}catch(_){quiet=false;}
  for(const stop of [()=>p0b?.close(),()=>deletion?.close(),()=>boundary?.close(),()=>authority?.close(),()=>store?.close(),()=>installation.release()])try{await stop();}catch(_){quiet=false;}
  if(quiet)onFailureQuiescent();throw error;
 }
}

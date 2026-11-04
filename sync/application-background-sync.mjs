// Attach the released transport to the existing local image, never a second authority.
import {createGlobalChannel,createDurableSynchronizer} from './local-first-sync.mjs';
import {createProjectChannel} from './local-first-project.mjs';
import {createApplicationReplication,createApplicationCommitter,createEmulatorProjectDiscovery} from './application-replication.mjs';
import {assertApplicationConnection} from './firebase-activation.mjs';
import {equal,fail,safeError} from './local-first-values.mjs';
export function createApplicationBackgroundSync({window:w,store,authority,ownerUid,barrier,onState=()=>{}}){
 const fc=w.FC,c=fc.globalDataContract,p=fc.businessProjectContract;
 const local=createApplicationCommitter({store,globalContract:c,projectContract:p,localOnly:true,summarizeLocal:fc.projectModel.summarizeProjectData});
 const queued=createApplicationCommitter({store,globalContract:c,projectContract:p,channel:()=>({kind:'project'})});
 let connection=null,admitted=null,sync=null,pending=null,closed=false,generation=0,last={state:'local-pending',cloudConfirmed:false};
 const status=(state,code=null)=>{last={state,code,cloudConfirmed:state==='confirmed'};onState({ok:state==='confirmed',code:code||'NONE',scope:'background-sync'});};
 const source=rows=>({getItem:k=>rows[k]??null});
 const model=rows=>c.capture(source(rows),Object.keys(c.schemas)).model;
 async function owned(scope){const s=await store.snapshot(scope);if(s.replica&&(!s.replica.editor?.active||s.replica.editor.deviceId!==store.deviceId))fail('LF_OFFLINE_EDITOR_REQUIRED');return s;}
 async function confirm(epoch=generation){
  if(closed||!connection||w.navigator.onLine===false){status('pending');return;}
  try{authority.assertIdle();}catch(error){if(!['LF_ACTIVE_FORM_PROTECTED','LF_ACTIVE_RAM_PROTECTED'].includes(error.code))throw error;status('local-pending');return;}
  const image=await store.readApplication(),rows=image.rows,g=await store.snapshot('globals');
  if(rows.fc_edit_session_v1!==null||!g.replica?.base||g.replica.dirty||g.operations.some(o=>o.phase!=='verified')||!equal(model(rows),JSON.parse(g.replica.json))){status('local-pending');return;}
  for(const record of JSON.parse(rows.fc_projects_v1||'[]')){const s=await store.snapshot(record.id);if(!s.replica?.base||s.replica.dirty||s.operations.some(o=>o.phase!=='verified')||!equal((await p.build(source(rows),record.id)).document.payload,JSON.parse(s.replica.json).document.payload)){status('local-pending');return;}}
  connection.writer.assertAccess();connection.reader.assertAccess();if(closed||epoch!==generation||(await store.readApplication()).version!==image.version)return;status('confirmed');
 }
 async function initialize(){
  if(closed||!connection||w.navigator.onLine===false)return;
  const epoch=++generation;
  await barrier(async()=>{
   authority.assertIdle();connection.writer.assertAccess();connection.reader.assertAccess();admitted=connection;await sync?.close();sync=null;connection.writer.assertAccess();connection.reader.assertAccess();
   const rows=authority.rows(),snapshot=await store.readApplication();
   if(!equal(rows,snapshot.rows))fail('LF_APPLICATION_CONFLICT');
   const guard=async()=>{if(closed)fail('LF_CLOSED');w.__FC_MAIN_ACCESS__.assert();authority.assertIdle();connection.writer.assertAccess();connection.reader.assertAccess();if((await store.readApplication()).version!==snapshot.version)fail('LF_APPLICATION_CONFLICT');};
   const globals=createGlobalChannel({...connection,ownerUid,contract:c,factory:fc.firebaseGlobalTransport});
   const make=record=>createProjectChannel({...connection,ownerUid,deviceId:store.deviceId,projectId:record.id,investorId:record.investorId,pilotContract:fc.cloudPilotContract,pilotFactory:fc.firebasePilotTransport,globalContract:c,projectContract:p,globals});
   const localModel=model(rows);c.validateBundle(localModel);let g=await store.snapshot('globals');
   if(!g.replica){
    let remote=null;try{remote=await globals.read();}catch(e){if(e.code!=='GLOBAL_NOT_FOUND')throw e;}await guard();
    if(remote){if(!equal(remote.value,localModel))fail('LF_INITIAL_GLOBAL_CONFLICT');await store.apply({scope:'globals',value:remote.value,head:remote.head,expectedVersion:0});}
    else await store.commit({scope:'globals',operationId:w.crypto.randomUUID(),value:localModel,expectedVersion:0,protectedRows:rows});
   }else if(!equal(JSON.parse(g.replica.json),localModel))fail('LF_INITIAL_GLOBAL_CONFLICT');

   // Only this existing queue may publish. Independent read resolves every ACK.
   const bootstrap=createDurableSynchronizer({store,channels:[globals],eventTarget:w,online:()=>!closed&&w.navigator.onLine!==false});
   try{const result=await bootstrap.flush();if(!result.ok)fail(result.code);}finally{await bootstrap.close();}
   await guard();g=await store.snapshot('globals');if(!equal(JSON.parse(g.replica.json),localModel))fail('LF_INITIAL_GLOBAL_CONFLICT');if(g.replica.dirty||!g.replica.base)fail('LF_GLOBAL_DEPENDENCIES_UNCONFIRMED');
   const channels=[globals];
   for(const record of JSON.parse(rows.fc_projects_v1||'[]')){
    await guard();const channel=make(record);channels.push(channel);const built=await p.build(source(rows),record.id),s=await store.snapshot(record.id);
    if(!s.replica){
     let remote=null;try{remote=await channel.read();}catch(e){if(e.code!=='CLOUD_PROJECT_NOT_FOUND')throw e;}await guard();
     if(remote){if(!equal(remote.value.document.payload,built.document.payload))fail('LF_INITIAL_PROJECT_CONFLICT');await store.apply({scope:record.id,value:remote.value,head:remote.head,expectedVersion:0});}
     else{
      // Recovery of an own unpublished acquire never takes another writer's lease.
      let editor=await channel.editor();if(editor?.active){if(editor.deviceId!==store.deviceId||editor.headRevision!=='')fail('LF_EDITOR_CONFLICT');}else editor=await channel.acquire(null);
      await guard();const value={document:built.document,globals:{head:g.replica.base,model:JSON.parse(g.replica.json)},requirements:p.dependencies(built.document.payload)};
      await store.apply({scope:record.id,value,head:null,expectedVersion:0,editor});
      const base=await store.snapshot(record.id);await store.commit({scope:record.id,operationId:w.crypto.randomUUID(),value,expectedVersion:base.replica.version,editor,protectedRows:rows});
     }
    }else if(!equal(JSON.parse(s.replica.json).document.payload,built.document.payload)){
     await owned(record.id);await guard();
     // The image is a durable unpublished draft; pin to the already confirmed catalogs.
     const value={document:built.document,globals:JSON.parse(s.replica.json).globals,requirements:p.dependencies(built.document.payload)};
     await store.commit({scope:record.id,operationId:w.crypto.randomUUID(),value,expectedVersion:s.replica.version,editor:s.replica.editor,protectedRows:rows});
    }
   }
   await guard();
   sync=createApplicationReplication({store,channels,globalContract:c,projectContract:p,eventTarget:w,online:()=>!closed&&w.navigator.onLine!==false,
    onState:r=>{if(epoch!==generation||closed)return;if(r.ok)void confirm(epoch).catch(e=>status('pending',safeError(e).code));else status('pending',r.code);},
    incoming:async next=>{
     // Existing image changes not represented by a replica are never overwritten.
     const current=authority.rows(),global=await store.snapshot('globals');
     if(!equal(model(next),model(current)))fail('LF_INITIAL_GLOBAL_CONFLICT');
     if(global.replica&&!equal(model(current),JSON.parse(global.replica.json)))fail('LF_LOCAL_CONFLICT');
     for(const record of JSON.parse(current.fc_projects_v1||'[]')){
      const r=await store.snapshot(record.id),candidate=JSON.parse(next.fc_projects_v1||'[]').find(v=>v.id===record.id);
      if(!equal(record,candidate)){
       if(!r.replica||!equal((await p.build(source(current),record.id)).document.payload,JSON.parse(r.replica.json).document.payload))fail('LF_LOCAL_CONFLICT');
      }
     }
     return authority.incoming(next);
    },refresh:()=>authority.refresh(),assertIdle:()=>authority.assertIdle({allowForm:true}),
    discovery:createEmulatorProjectDiscovery({...connection,ownerUid,deviceId:store.deviceId,pilotContract:fc.cloudPilotContract,pilotFactory:fc.firebasePilotTransport,globalContract:c,projectContract:p,globals})});
  });
  const result=await sync.flush();if(!result.ok)fail(result.code);
  if(!fc.session.active&&w.uiState.entry!=='app')for(const record of JSON.parse(authority.rows().fc_projects_v1||'[]')){const s=await store.snapshot(record.id);if(s.replica?.editor?.active&&s.replica.editor.deviceId===store.deviceId)await sync.releaseEditor(record.id);}
  await confirm();
 }
 function schedule(){if(closed||!connection||pending||w.navigator.onLine===false)return;
  pending=new Promise(resolve=>w.setTimeout(resolve,0)).then(async()=>{await initialize();return {ok:true};}).catch(e=>{status('pending',safeError(e).code);return safeError(e);}).finally(()=>{pending=null;});return pending;
 }
 return Object.freeze({
  async attach(next){const a=assertApplicationConnection(next.writer),b=assertApplicationConnection(next.reader);if(a.uid!==ownerUid||b.uid!==ownerUid||next.writer.db.app===next.reader.db.app)fail('LF_APPLICATION_OWNER_CHANGED');
   await pending;const previous=connection;connection=next;const result=await schedule();if(admitted!==next){connection=previous;return {...result,attached:false};}return {...result,attached:true};},
  notify(){if(closed)return;if(sync)sync.notify();
   // Reconcile after a completed local session, including projects created offline.
   if(!fc.session.active&&!authority.status().transactionPending&&(!sync||JSON.parse(authority.rows().fc_projects_v1||'[]').some(p=>!sync.channel(p.id))))void schedule();},
  async ensureEditor(scope){const s=await store.snapshot(scope);if(!s.replica)return;
   if(s.replica.editor?.active&&s.replica.editor.deviceId===store.deviceId)return;
   if(pending&&w.navigator.onLine!==false)await pending;
   if(!sync||w.navigator.onLine===false)fail('LF_OFFLINE_EDITOR_REQUIRED');await sync.acquireEditor(scope);},
  async commit(kind,application,scope){
   if(kind==='project')await owned(scope);
   const r=await store.snapshot(kind==='globals'?'globals':scope);
   const result=r.replica&&application.rows.fc_edit_session_v1===null?await queued.commit(kind,application,scope):await local.commit(kind,application,scope);
   status('local-pending');return result;
  },
  async checkpoint(a,k){const result=await local.checkpoint(a,k);status('local-pending');return result;},
  async handover(scope){if(!sync||!scope||w.navigator.onLine===false)return {pending:true};const result=await sync.flush();if(!result.ok)fail(result.code);const s=await store.snapshot(scope);if(s.replica?.editor?.active&&s.replica.editor.deviceId===store.deviceId)await sync.releaseEditor(scope);},
  status:()=>({...last}),get sync(){return sync;},
  async close(){closed=true;generation++;await sync?.close();await pending;}
 });
}

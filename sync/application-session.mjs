// Application boundary around the existing durable coordinator. Import is inert.
// Installation/migration and production connections remain separately authorized.
import {equal,fail,copy} from './local-first-values.mjs';
export function createApplicationSession({synchronizer,store,access,session,source,globalContract,
  projectContract,buildProject,projectId,onRemote=()=>fail('LF_APPLICATION_LOCAL_APPLY_NOT_APPROVED'),eventTarget}={}){
  if(!synchronizer||!store||!access||!session||!eventTarget?.addEventListener||!source?.getItem)fail('LF_APPLICATION_DEPENDENCIES_REQUIRED');
  let closed=false,busy=false;
  const identity={ownerUid:store.ownerUid,deviceId:store.deviceId,instanceId:store.instanceId};
  function guard(){if(closed)fail('LF_APPLICATION_CLOSED');access.assertLocal(identity.ownerUid);
    if(store.ownerUid!==identity.ownerUid||store.deviceId!==identity.deviceId||store.instanceId!==identity.instanceId)fail('LF_APPLICATION_OWNER_CHANGED');}
  async function exclusive(fn){guard();if(busy)fail('LF_APPLICATION_BUSY');busy=true;try{return await fn();}finally{busy=false;}}
  const localClean=()=>!session.active&&!session.snapshot&&!session.durable&&source.getItem('fc_edit_session_v1')===null;
  async function globals(operationId){return exclusive(async()=>{
    if(!localClean())fail('LF_APPLICATION_EDIT_ACTIVE');
    const before=await store.snapshot('globals');guard();
    const result=await synchronizer.submitGlobals({source,operationId,expectedVersion:before.replica?.version||0});
    guard();if(!result.localConfirmed)fail('LF_LOCAL_ACK_UNCONFIRMED');return result;
  });}
  async function project(operationId){return exclusive(async()=>{
    // Existing project builder refuses unsupported real profiles; do not stamp
    // synthetic provenance on application data to get through it.
    if(!localClean())fail('LF_APPLICATION_EDIT_ACTIVE');
    const built=await buildProject();guard();
    if(!built?.ok)fail('LF_APPLICATION_PROJECT_PROFILE_BLOCKED');
    const before=await store.snapshot(projectId);guard();
    if(!before.replica?.editor?.active)fail('LF_EDITOR_REQUIRED');
    const result=await synchronizer.submitProject({projectId,operationId,document:built.document,source,
      expectedVersion:before.replica.version,projectContract,globalContract});
    guard();if(!result.localConfirmed)fail('LF_LOCAL_ACK_UNCONFIRMED');return result;
  });}
  async function receive(scope){return exclusive(async()=>{
    if(scope!=='globals'&&scope!==projectId)fail('LF_APPLICATION_SCOPE_REFUSED');
    if(!localClean())fail('LF_APPLICATION_EDIT_ACTIVE');
    const before=await store.snapshot(scope);guard();
    if(!before.replica||before.replica.dirty||before.operations.some(x=>x.phase!=='verified'))fail('LF_LOCAL_CONFLICT');
    const value=JSON.parse(before.replica.json);
    if(scope==='globals')globalContract.validateBundle(value);
    const witness=scope==='globals'?globalContract.capture(source,Object.keys(globalContract.schemas)):null;
    // Host adapter must use this CAS callback at its transaction boundary. No
    // default localStorage writer, merge, normalization or partial application.
    return onRemote({scope,value:copy(value),version:before.replica.version,head:copy(before.replica.base),
      async assertCurrent(){guard();if(!localClean())fail('LF_APPLICATION_EDIT_ACTIVE');witness?.assertUnchanged();
        const now=await store.snapshot(scope);if(!equal(now,before))fail('LF_LOCAL_CONFLICT');}});
  });}
  const wake=()=>{if(closed)return;try{guard();access.assertCloud(identity.ownerUid);}catch(_){return;}
    void synchronizer.flush();};
  eventTarget.addEventListener('online',wake);
  eventTarget.addEventListener('meble:confirmed-global-change',wake);
  return Object.freeze({identity:copy(identity),globals,project,receive,
    async save({operationId,saveLocal,kind='project'}){
      await exclusive(async()=>{
        guard();if(typeof saveLocal!=='function')fail('LF_APPLICATION_SAVE_REQUIRED');
        const result=await saveLocal();guard();
        if(result?.ok!==true||!localClean())fail('LF_APPLICATION_SAVE_UNCONFIRMED');
      });
      // No combined acknowledgement until the existing IDB data+outbox
      // transaction completes. Failed queueing retains the confirmed local
      // source and reports failure, never cloud success or automatic rollback.
      return kind==='globals'?globals(operationId):project(operationId);
    },
    acquire:()=>{guard();access.assertCloud(identity.ownerUid);return synchronizer.acquireEditor(projectId);},
    release:()=>{guard();access.assertCloud(identity.ownerUid);if(!localClean())fail('LF_APPLICATION_EDIT_ACTIVE');return synchronizer.releaseEditor(projectId);},
    close(){closed=true;eventTarget.removeEventListener('online',wake);eventTarget.removeEventListener('meble:confirmed-global-change',wake);synchronizer.close();return store.close();}
  });
}

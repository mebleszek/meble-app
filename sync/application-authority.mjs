// Shared authority; production cutover requires a verified owner deployment.
import {assertApplicationRelease} from './application-release.mjs';
import {assertEmulator,fail,equal} from './local-first-values.mjs';
const installations=new WeakSet();
export function applicationKeys(fc){return [...Object.values(fc.globalDataContract.sources).flat(),'fc_projects_v1','fc_investors_v1','fc_current_project_id_v1','fc_current_investor_v1','fc_edit_session_v1','fc_ui_v1','fc_quote_snapshots_v1',
  'fc_project_v1','fc_materials_v1','fc_investor_removed_ids_v1','fc_edge_v1','fc_material_part_options_v1','fc_rozrys_grain_state_v1','fc_rozrys_overrides_v1','fc_quote_offer_drafts_v1','fc_project_backup_v1','fc_project_backup_meta_v1'];}

// An intentional edit updates the declared aliases as one value. Conflicting
// pre-existing RAW or competing writes are refusals, never automatic repair.
export function reconcileGlobalAliases(before,after,contract){
 const next=structuredClone(after);
 for(const keys of Object.values(contract.sources)){
  if(keys.length<2)continue;const changed=keys.filter(k=>before[k]!==after[k]);if(!changed.length)continue;
  const parse=raw=>{try{return JSON.parse(raw);}catch(_){fail('LF_GLOBAL_ALIAS_CONFLICT');}};
  const baseline=keys.map(k=>before[k]).filter(v=>v!==null&&v!==undefined).map(parse);
  if(baseline.some(v=>!equal(v,baseline[0])))fail('LF_GLOBAL_ALIAS_CONFLICT');
  const values=changed.map(k=>after[k]??null);if(values.some(v=>v!==values[0]))fail('LF_GLOBAL_ALIAS_CONFLICT');
  for(const key of keys)next[key]=values[0];
 }
 return next;
}

export async function installEmulatorApplicationAuthority(options){
 const who=assertEmulator(options.connection);
 return installAuthority({...options,ownerUid:who.uid});
}
// Local trusted access can restore IDB without starting Google or Firestore.
// This entry is still loopback/test-only; it grants no cloud capability.
export async function installOfflineEmulatorApplicationAuthority(options){
 options.window.__FC_MAIN_ACCESS__.assert();
 return installAuthority(options);
}
export function installAuthorizedApplicationAuthority(options){assertApplicationRelease(options.release,{ownerUid:options.ownerUid,name:options.store.name,window:options.window});return installAuthority(options);}
async function installAuthority({window:w,store,ownerUid,commit,checkpoint,onCommitted=()=>{},authorize,beforeTransaction=async()=>{},sourceRead,initialRows,release:deployment}){
 if(deployment)assertApplicationRelease(deployment,{ownerUid,name:store.name,window:w});
 if(ownerUid!==store.ownerUid||!deployment&&(!/^meble-lf-test-/.test(store.name)||!['127.0.0.1','localhost'].includes(w.location.hostname)))fail('LF_APPLICATION_MIGRATION_NOT_APPROVED');
 if(installations.has(w))fail('LF_APPLICATION_ALREADY_INSTALLED');
 const fc=w.FC,ls=w.localStorage,proto=w.Storage.prototype;
 const keys=new Set(applicationKeys(fc));
 if(fc.session.active||fc.investorEditorState?.hasUiLock()||fc.investorProjectRuntime.hasProjectDivergence(w.projectData))fail('LF_ACTIVE_RAM_PROTECTED');
 const original={get:sourceRead||proto.getItem,set:proto.setItem,remove:proto.removeItem};
 const source=Object.fromEntries([...keys].map(k=>[k,original.get.call(ls,k)]));
 let image=await store.readApplication();if(!image)image=await store.initializeApplication(initialRows||source);
 let rows=structuredClone(image.rows),inTransaction=false,mutating=false,closed=false,external=false,incomingWitness=null,lastCode=null;
 const pendingNotices=[],pendingClosures=[],open=fc.infoBox?.open;
 if(fc.panelBox?.close){const close=fc.panelBox.close;fc.panelBox.close=(...args)=>{if(inTransaction){pendingClosures.push(()=>close(...args));return;}return close(...args);};}
 function access(){w.__FC_MAIN_ACCESS__.assert();if(closed||external)fail('LF_APPLICATION_CLOSED_OR_OLD_WRITER');}
 function assertSource(){for(const k of keys)if(original.get.call(ls,k)!==source[k]){external=true;fail('LF_OLD_WRITER_DETECTED');}}
 function mutate(key,value){access();assertSource();if(!inTransaction||!mutating)fail('LF_ASYNC_TRANSACTION_REQUIRED');const old=rows[key]??null;rows[key]=value;fc.session?.trackKeyMutation(key,value,old);}
 installations.add(w);
 proto.getItem=function(key){if(this===ls&&keys.has(String(key))){w.__FC_MAIN_ACCESS__.assert();return rows[String(key)]??null;}return original.get.call(this,key);};
 proto.setItem=function(key,value){if(this===ls&&keys.has(String(key)))return mutate(String(key),String(value));return original.set.call(this,key,value);};
 const originalClear=proto.clear;proto.clear=function(){if(this===ls)fail('LF_APPLICATION_CLEAR_REFUSED');return originalClear.call(this);};
 proto.removeItem=function(key){if(this===ls&&keys.has(String(key)))return mutate(String(key),null);return original.remove.call(this,key);};
 if(open)fc.infoBox.open=options=>{if(inTransaction&&(options?.title==='Projekt zapisany'||/^Zapisano/.test(options?.title||''))){pendingNotices.push(options);return;}return open(options);};
 const listener=event=>{if(event.key===null||keys.has(event.key)){external=true;}};w.addEventListener('storage',listener);
 function idle({allowForm=false}={}){access();if(!allowForm&&(fc.priceModal?.isItemDirty?.()||w.document.querySelector('.panel-box-backdrop')))fail('LF_ACTIVE_FORM_PROTECTED');if(inTransaction||fc.session.active||fc.session.snapshot||fc.session.durable||rows.fc_edit_session_v1!==null||fc.investorEditorState?.hasUiLock()||fc.investorProjectRuntime.hasProjectDivergence(w.projectData))fail('LF_ACTIVE_RAM_PROTECTED');}
 async function hydrateCatalogs(){if(!(await store.snapshot?.('globals'))?.replica)return;const c=fc.globalDataContract,model=c.capture({getItem:k=>k==='fc_edit_session_v1'?null:rows[k]??null},Object.keys(c.schemas)).model;fc.catalogStore?.adoptVerified?.(model);}
 function snapshotSession(){return Object.fromEntries(Object.entries(fc.session).filter(([,v])=>typeof v!=='function').map(([k,v])=>[k,structuredClone(v)]));}
 async function transaction(kind,operation){
  access();assertSource();lastCode=null;if(inTransaction)fail('LF_APPLICATION_BUSY');
  await beforeTransaction();access();assertSource();if(incomingWitness!==null)fail('LF_REMOTE_APPLY_PENDING');
  const editorState=fc.investorEditorState?.state?structuredClone(fc.investorEditorState.state):null;
  const investorUi=fc.investorUI?.state?structuredClone(fc.investorUI.state):null;
  const priceState=fc.priceModalContext?.runtimeState?structuredClone(fc.priceModalContext.runtimeState):null;
  const old=structuredClone(rows),session=snapshotSession(),ram=structuredClone(w.projectData),ui=structuredClone(w.uiState),views=[...w.document.querySelectorAll('[id$=View],#sessionButtons,[id$=Modal]')].map(el=>[el,el.style.cssText]);inTransaction=true;
  try{
   if(['project','draft','rollback'].includes(kind)){if(typeof authorize!=='function')fail('LF_EDITOR_REQUIRED');await authorize(rows.fc_current_project_id_v1);access();assertSource();}
   mutating=true;const result=await operation();rows=reconcileGlobalAliases(old,rows,fc.globalDataContract);mutating=false;access();assertSource();if(result===false||result?.ok===false)fail('LF_APPLICATION_SAVE_UNCONFIRMED');
   if(kind==='auto'){
    const changed=[...keys].filter(k=>rows[k]!==old[k]);
    const globals=new Set([...Object.values(fc.globalDataContract.sources).flat(),'fc_materials_v1']);
    const business=changed.filter(k=>!['fc_edit_session_v1','fc_ui_v1','fc_current_project_id_v1','fc_current_investor_v1','fc_project_backup_v1','fc_project_backup_meta_v1'].includes(k));
    if(business.every(k=>globals.has(k))&&business.length)kind='globals';
    else if(business.length)kind='project';
    else kind=fc.session.active?'draft':'checkpoint';
   }
   const application={expectedVersion:image.version,rows:structuredClone(rows)};
   if(kind==='checkpoint'||kind==='draft'||kind==='rollback'){
    // No data/catalog change can masquerade as a session/UI checkpoint.
    if(kind==='draft'&&(!fc.session.active||!fc.session.durable||rows.fc_edit_session_v1===null))fail('LF_DRAFT_SESSION_REQUIRED');
    for(const k of keys)if(kind==='checkpoint'&&!['fc_edit_session_v1','fc_ui_v1','fc_current_project_id_v1','fc_current_investor_v1'].includes(k)&&rows[k]!==old[k])throw Object.assign(Error('LF_CHECKPOINT_DATA_CHANGED: '+k),{code:'LF_CHECKPOINT_DATA_CHANGED'});
    await checkpoint(application,kind);
   }else await commit(kind,application);
   image=await store.readApplication();rows=structuredClone(image.rows);await hydrateCatalogs();inTransaction=false;
   for(const close of pendingClosures.splice(0))close();
   for(const notice of pendingNotices.splice(0))open?.(notice);
   queueMicrotask(onCommitted);return result;
  }catch(e){lastCode=/^(LF_|GLOBAL_|CLOUD_)[A-Z_]+$/.test(e?.code||e?.message||'')?(e.code||e.message):'LF_APPLICATION_UNCONFIRMED';rows=old;Object.assign(fc.session,session);w.projectData=ram;w.uiState=ui;if(editorState)Object.assign(fc.investorEditorState.state,editorState);if(investorUi)Object.assign(fc.investorUI.state,investorUi);if(priceState)Object.assign(fc.priceModalContext.runtimeState,priceState);pendingClosures.length=0;for(const [el,style]of views)el.style.cssText=style;pendingNotices.length=0;inTransaction=false;mutating=false;await hydrateCatalogs();throw e;}
 }
 // Reopening an approved image never copies it back over the preserved source.
 // A durable draft requires the existing session recovery path, not a clean boot.
 w.projectData=fc.project.load();w.uiState=fc.uiState.get();
 if(rows.fc_edit_session_v1!==null){
  if(fc.session.resumeFromStorage?.()!==true){closed=true;fail('LF_APPLICATION_DRAFT_RECOVERY_REQUIRED');}
  await transaction('draft',()=>{fc.views.applyFromState(w.uiState);fc.sections.update();return true;});
 }else{
  // A fresh document has no implicit editing permission. Display its verified
  // investor without starting a new room session merely from restored UI state.
  await transaction('checkpoint',()=>{
   if(rows.fc_current_investor_v1)w.uiState=fc.uiState.set({entry:'rooms',activeTab:'inwestor',roomType:null,lastRoomType:null,selectedCabinetId:null});
   fc.views.applyFromState(w.uiState);fc.sections.update();return true;
  });
 }
 return Object.freeze({transaction,afterCommit(fn){if(inTransaction)pendingClosures.push(fn);else fn();},assertIdle:idle,rows:()=>structuredClone(rows),
  async incoming(next){idle();assertSource();if(Object.keys(next).some(k=>!keys.has(k)))fail('LF_APPLICATION_SCOPE_REFUSED');incomingWitness=JSON.stringify(w.projectData);return {expectedVersion:image.version,rows:next};},
  async refresh(){access();assertSource();if(inTransaction||fc.session.active||incomingWitness!==JSON.stringify(w.projectData))fail('LF_ACTIVE_RAM_PROTECTED');image=await store.readApplication();rows=structuredClone(image.rows);await hydrateCatalogs();w.projectData=fc.project.load();w.uiState=fc.uiState.get();fc.views.applyFromState(w.uiState);fc.sections.update();incomingWitness=null;},
  // Logout seals writes; the local data/outbox is never removed.
  close(){closed=true;},
  resume(uid){if(uid!==ownerUid||external)fail('LF_APPLICATION_OWNER_CHANGED');w.__FC_MAIN_ACCESS__.assert();assertSource();closed=false;},
  status:()=>({version:image.version,closed,external,lastCode,transactionPending:inTransaction,incomingPending:incomingWitness!==null})});
}

// Existing controls keep their Save/Cancel meaning. Clean Exit first closes the
// durable session; only then may the existing navigation change the view.
export function createApplicationActionBinding({window:w,authority,onClose=()=>{},onExit=async()=>{}}){
 const fc=w.FC;
 return Object.freeze({
  save:({saveLocal})=>authority.transaction('project',saveLocal),
  async cancel({cancelLocal}){
   const divergent=()=>fc.investorProjectRuntime.hasProjectDivergence(w.projectData);
   if(fc.session.active&&(fc.session.isDirty()||divergent()))return authority.transaction('rollback',cancelLocal);
   if(divergent())fail('LF_ACTIVE_RAM_PROTECTED');
   await authority.transaction('checkpoint',()=>fc.session.active?fc.session.commit():true);
   if(divergent())fail('LF_ACTIVE_RAM_PROTECTED');
   const scope=w.localStorage.getItem('fc_current_project_id_v1');
   const result=await authority.transaction('checkpoint',cancelLocal);
   if(result!==false&&w.uiState?.entry==='investorsList')await onExit(scope);
   return result;
  },
  close(){authority.close();onClose();}
 });
}

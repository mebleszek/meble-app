// Local-only adapter around the existing ownership/cascade planner and write boundary.
// Never deletes remotely confirmed replicas or any queued operation.
import {equal,fail} from './local-first-values.mjs';
export function installLocalInvestorDeletion({window:w,store,authority,boundary}){
 const fc=w.FC,tokens=new WeakMap();let committing=null;
 const source=()=>{const rows=authority.rows();return Object.fromEntries([...new Set([...Object.keys(rows),'fc_investors_v1','fc_projects_v1','fc_quote_snapshots_v1','fc_quote_offer_drafts_v1','fc_investor_removed_ids_v1','fc_current_project_id_v1','fc_current_investor_v1','fc_ui_v1','fc_project_v1'])].map(k=>[k,rows[k]??null]));};
 function idle(){
  if(fc.applicationWrite?.localOnly!==true||boundary.busy()||committing)fail('DELETE_LOCAL_MODE_REQUIRED');
  w.__FC_MAIN_ACCESS__.assert();authority.assertIdle({allowForm:true});
  if(fc.investorDeletion.pending()||w.uiState?.entry!=='investorsList'||w.uiState.currentInvestorId||w.uiState.roomType||w.localStorage.getItem('fc_current_investor_v1')!==null||fc.session.canSaveProject?.()!==true)fail('DELETE_CONTEXT_PROTECTED');
 }
 const projectIds=(rows,ids)=>JSON.parse(rows.fc_projects_v1||'[]').filter(p=>ids.includes(p.investorId)).map(p=>p.id);
 async function assertLocal(scopes){for(const scope of scopes){const snap=await store.snapshot(scope);if(snap.replica||snap.operations.length)fail('DELETE_SYNCED_PROJECT_PROTECTED');}}
 async function inventory(){
  const names=await w.indexedDB.databases();
  const archive=names.some(d=>d.name==='meble-business-backups-v1')?await fc.backupArchive?.inspect():null;
  if(names.some(d=>d.name==='meble-business-backups-v1')&&!archive)fail('DELETE_BACKUP_INSPECTION_UNAVAILABLE');
  let backups=0;for(let n=0;n<w.localStorage.length;n++)if(/^fc_(?:data_backups_v1|(?:project|investors|project_inv_.+)_backup(?:_meta)?_v1)$/.test(w.localStorage.key(n)||''))backups++;
  return {backups,archiveRecords:archive?.count||0,deletionReceipts:(await store.snapshot('investor-deletions')).protected.length};
 }
 const api=Object.freeze({
  canPrepare(){try{idle();return true;}catch(_){return false;}},
  async prepare(ids){
   idle();const before=source(),image=await store.readApplication();
   const plan=fc.investorDeletion.planLocal(before,ids),scopes=projectIds(before,ids);
   // Legacy per-investor physical slots are preserved originals, outside this image.
   // They require their existing legacy protocol, never an untracked native delete.
   if(ids.some(id=>w.localStorage.getItem('fc_project_inv_'+id+'_v1')!==null))fail('DELETE_LEGACY_SLOT_PROTECTED');
   await assertLocal(scopes);const kept=await inventory();idle();
   if(!equal(before,source())||image.version!==(await store.readApplication()).version)fail('DELETE_SOURCE_CHANGED');
   const token=Object.freeze({...plan.count,names:Object.freeze(plan.names),...kept});
   tokens.set(token,{ids:[...ids],before,after:plan.after,version:image.version});return token;
  },
  async commit(token){
   idle();const proof=tokens.get(token);if(!proof)fail('DELETE_CONFIRMATION_REQUIRED');tokens.delete(token);
   committing=proof;
   try{
   if(!equal(source(),proof.before)||proof.version!==(await store.readApplication()).version)fail('DELETE_SOURCE_CHANGED');
   await boundary.run(()=>{
    if(fc.session.active||fc.session.snapshot||fc.session.durable||fc.investorEditorState?.hasUiLock?.()||fc.investorProjectRuntime.hasProjectDivergence(w.projectData)||w.uiState?.entry!=='investorsList'||w.uiState.currentInvestorId||w.uiState.roomType)fail('DELETE_CONTEXT_PROTECTED');
    if(!equal(source(),proof.before))fail('DELETE_SOURCE_CHANGED');
    for(const [key,value]of Object.entries(proof.after))if(value!==proof.before[key]){if(value===null)w.localStorage.removeItem(key);else w.localStorage.setItem(key,value);}
    if(proof.before.fc_current_project_id_v1!==proof.after.fc_current_project_id_v1)w.projectData=fc.project.load();
    w.uiState=fc.uiState.get();return {ok:true};
   },'delete-investors');}finally{committing=null;}
   return {ok:true};
  }
 });
 fc.localInvestorDeletion=api;
 return {commitApplication(application){if(!committing||committing.version!==application.expectedVersion)fail('DELETE_CONFIRMATION_REQUIRED');return commitLocalInvestorDeletion({window:w,store,application});},close(){committing=null;if(fc.localInvestorDeletion===api)delete fc.localInvestorDeletion;}};
}

// Recompute the exact authorized cascade at the durable commit boundary.
async function commitLocalInvestorDeletion({window:w,store,application}){
 const before=await store.readApplication(),fc=w.FC;
 if(!before||before.version!==application.expectedVersion)fail('DELETE_SOURCE_CHANGED');
 const old=JSON.parse(before.rows.fc_investors_v1||'[]'),next=JSON.parse(application.rows.fc_investors_v1||'[]');
 const ids=old.filter(i=>!next.some(n=>n.id===i.id)).map(i=>i.id);
 const source={...before.rows};for(const k of ['fc_quote_snapshots_v1','fc_quote_offer_drafts_v1','fc_investor_removed_ids_v1','fc_current_project_id_v1','fc_current_investor_v1','fc_ui_v1','fc_project_v1'])source[k]??=null;
 const plan=fc.investorDeletion.planLocal(source,ids);
 for(const k of new Set([...Object.keys(plan.after),...Object.keys(application.rows)]))if((plan.after[k]??null)!==(application.rows[k]??null))fail('DELETE_SCOPE_CHANGED');
 const model=fc.globalDataContract.capture({getItem:k=>k==='fc_edit_session_v1'?null:application.rows[k]??null},Object.keys(fc.globalDataContract.schemas)).model;fc.globalDataContract.validateBundle(model);
 const scopes=JSON.parse(before.rows.fc_projects_v1||'[]').filter(p=>ids.includes(p.investorId)).map(p=>p.id);
 await store.checkpointDeletion({application,before:before.rows,scopes,investorIds:ids,assertAccess:()=>w.__FC_MAIN_ACCESS__.assert()});
 return {localConfirmed:true,cloudConfirmed:false};
}

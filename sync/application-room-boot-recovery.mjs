// Resume an already approved durable recovery before the normal authority is
// installed. No synthetic Save/Cancel, no RAW write and no new recovery choice.
import {equal,fail} from './local-first-values.mjs';
export async function resumeRoomBootRecovery({window:w,store,p0b,boot}){
 const fc=w.FC,initial=await store.readApplication();if(!initial)return false;
 const records=JSON.parse(initial.rows.fc_projects_v1||'[]'),pending=[];
 for(const row of records)if(await store.pendingProjectRecovery(row.id))pending.push(row.id);
 if(!pending.length)return false;
 if(!w.__FC_MAIN_ACCESS__.isLoading?.()||fc.investorEditorState.hasUiLock())fail('LF_ACTIVE_FORM_PROTECTED');
 const s=fc.session;
 if(s.active&&(!s.durable||s.canSaveProject()!==true)||!s.active&&(s.snapshot||s.durable))fail('LF_DRAFT_SESSION_REQUIRED');
 if(fc.investorProjectRuntime.hasProjectDivergence(w.projectData))fail('LF_ACTIVE_RAM_PROTECTED');
 const ram=JSON.stringify(w.projectData),session=JSON.stringify(Object.fromEntries(Object.entries(s).filter(([,value])=>typeof value!=='function')));
 for(const scope of pending){
  const before=await store.readApplication(),receipt=await p0b.recovery(scope).resume();
  const snapshot=await store.snapshot(scope),archive=snapshot.protected.find(row=>row.key===receipt.archiveId);
  if(!archive)fail('LF_PROJECT_RECOVERY_SOURCE_CHANGED');
  const source=JSON.parse(archive.json);
  if(source.kind!=='project-recovery'||source.sourceScope!==scope||!equal(source.image,before)
    ||!equal(source.receipt,receipt)||!equal(snapshot.replica.editor,receipt.editor))fail('LF_PROJECT_RECOVERY_SOURCE_CHANGED');
 }
 if(JSON.stringify(w.projectData)!==ram||JSON.stringify(Object.fromEntries(Object.entries(s).filter(([,value])=>typeof value!=='function')))!==session)fail('LF_ACTIVE_RAM_PROTECTED');
 const image=await store.readApplication();if(image.rows.fc_edit_session_v1!==null)fail('LF_DRAFT_SESSION_REQUIRED');
 await boot.replaceRecoveryImage(initial,image);
 // The old public session is discarded only after its exact durable source is
 // independently found in the verified recovery archive above. Fresh startup
 // has not admitted user interaction, so there is no uncheckpointed form here.
 Object.assign(s,{active:false,durable:false,projectId:'',roomId:'',expectedOwnerRaw:null,expectedOwnerKnown:false,lastError:null,
  snapshot:null,startedAt:0,updatedAt:0,context:null,comparableKeys:null,changedKeys:{},suspendTracking:false,lastDirtyCheckAt:0,lastDirtyValue:false});
 w.projectData=fc.project.load();w.uiState=fc.uiState.get();
 if(fc.investorUI?.state)Object.assign(fc.investorUI.state,{selectedId:image.rows.fc_current_investor_v1,mode:'detail',allowListAccess:false,transientInvestor:null});
 fc.views.applyFromState(w.uiState);fc.sessionNavigation?.invalidateCalculationContext();
 return true;
}

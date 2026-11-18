// Atomic LOCAL-FIRST commit of independently owned room records. No RPC here.
import {copy,equal,fail,id,json,digest} from './local-first-values.mjs';
import {P0B_REGISTRY} from './application-p0b-domain.mjs';
export async function commitRoomBatch({transaction,prepareApplication,applicationChange,rememberHandover,deviceId,args}){
 const {entries,application:input}=args;
 if(!Array.isArray(entries)||!entries.length||new Set(entries.map(row=>row.scope)).size!==entries.length
   ||new Set(entries.map(row=>row.operationId)).size!==entries.length)fail('LF_ROOM_BATCH_INVALID');
 const application=await prepareApplication(input);if(!application)fail('LF_APPLICATION_INVALID');
 const investorId=id(entries[0]?.value?.document?.payload?.project?.investorId);
 const protection=json(application.rows),protectedHash=await digest(protection),prepared=[];
 for(const entry of entries){
  const row=copy(entry);id(row.scope);id(row.operationId);
  const project=row.value?.document?.payload?.project;
  if(project?.investorId!==investorId||project?.id!==row.scope||project.meta?.roomProject?.version!==1||project.meta.roomProject.roomId!==row.scope
    ||!row.editor?.active||row.editor.deviceId!==deviceId||!Number.isSafeInteger(row.expectedVersion)||row.expectedVersion<1)fail('LF_ROOM_BATCH_INVALID');
  const encoded=json(row.value);prepared.push({...row,encoded,hash:await digest(encoded)});
 }
 return transaction('readwrite',(s,done,abort)=>{
  const r=s.replicas.getAll(),q=s.outbox.getAll(),c=s.control.getAll();let pending=3;
  const finish=()=>{if(--pending)return;try{
   if(!c.result.some(row=>row.key==='p0b-registry'&&row.registry===P0B_REGISTRY))fail('LF_P0B_REGISTRY_REQUIRED');
   const existing=prepared.map(row=>q.result.find(op=>op.key===row.operationId));
   if(existing.some(Boolean)){
    if(existing.some((op,index)=>!op||op.scope!==prepared[index].scope||op.hash!==prepared[index].hash
      ||!equal(op.editor,prepared[index].editor)||op.applicationHash!==application.hash))fail('LF_OPERATION_REUSED');
    done({ok:true,duplicate:true,localConfirmed:true,cloudConfirmed:false,scopes:prepared.map(row=>row.scope)});return;
   }
   const writes=prepared.map(row=>{
    if(c.result.some(marker=>marker.key==='retired:'+row.scope))fail('LF_P0B_SCOPE_RETIRED');
    const old=r.result.find(replica=>replica.key===row.scope);
    if(!old||old.version!==row.expectedVersion)fail('LF_LOCAL_CONFLICT');
    if(!old.editor?.active||!equal(old.editor,row.editor)||old.editor.deviceId!==deviceId)fail('LF_EDITOR_REQUIRED');
    const previous=q.result.filter(op=>op.scope===row.scope).sort((a,b)=>b.localVersion-a.localVersion)[0];
    return {row,old,previous};
   });
   applicationChange(s,application,before=>{
    const allowed=new Set(['fc_projects_v1','fc_investors_v1','fc_current_project_id_v1','fc_current_investor_v1','fc_ui_v1','fc_edit_session_v1','fc_project_backup_v1','fc_project_backup_meta_v1']);
    for(const key of new Set([...Object.keys(before.rows),...Object.keys(application.rows)]))if(before.rows[key]!==application.rows[key]&&!allowed.has(key))fail('LF_APPLICATION_SCOPE_REFUSED');
    const scopes=new Set(prepared.map(row=>row.scope)),prior=JSON.parse(before.rows.fc_projects_v1||'[]'),next=JSON.parse(application.rows.fc_projects_v1||'[]');
    if(!equal(prior.filter(row=>!scopes.has(row.id)),next.filter(row=>!scopes.has(row.id))))fail('LF_APPLICATION_SCOPE_REFUSED');
    for(const row of prepared)if(!equal(next.find(record=>record.id===row.scope),row.value.document.payload.project))fail('LF_APPLICATION_SCOPE_REFUSED');
    const card=value=>JSON.parse(value||'[]').map(row=>{const next=copy(row);if(row.id===investorId)delete next.rooms;return next;});
    if(!equal(card(before.rows.fc_investors_v1),card(application.rows.fc_investors_v1)))fail('LF_APPLICATION_SCOPE_REFUSED');
    for(const {row,old,previous}of writes){
     const version=old.version+1;
     s.replicas.put({key:row.scope,version,json:row.encoded,hash:row.hash,base:copy(old.base),editor:copy(row.editor),dirty:true});
     s.outbox.add({key:row.operationId,scope:row.scope,localVersion:version,json:row.encoded,hash:row.hash,base:copy(old.base),
      previousOperation:previous?.key||null,applicationHash:application.hash,editor:copy(row.editor),phase:'queued',blockers:[],expected:null});
     s.protected.add({key:row.operationId,scope:row.scope,json:protection,hash:protectedHash});
     if(row.releaseAfterSync)rememberHandover(s.control,row.scope,row.editor);
    }
    done({ok:true,localConfirmed:true,cloudConfirmed:false,scopes:prepared.map(row=>row.scope)});
   },abort);
  }catch(error){abort(error);}};r.onsuccess=q.onsuccess=c.onsuccess=finish;
 });
}

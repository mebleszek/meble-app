// Status-only room participants in the same strict IDB transaction as a quote.
import {copy,equal,fail,id,json,digest} from './local-first-values.mjs';
function content(record){
 const out=copy(record);delete out.status;delete out.updatedAt;
 const meta=out.projectData?.meta;if(meta){delete meta.projectStatus;const def=meta.roomDefs?.[out.id];if(def){delete def.projectStatus;delete def.lastManualProjectStatus;}}
 return out;
}
export async function prepareQuoteStatusRooms(entries,investorId,deviceId){
 if(!Array.isArray(entries)||new Set(entries.map(row=>row.scope)).size!==entries.length)fail('LF_QUOTE_STATUS_PLAN_INVALID');
 const result=[];
 for(const entry of entries){
  const row=copy(entry),project=row.value?.document?.payload?.project;
  id(row.scope);id(row.operationId);
  if(project?.id!==row.scope||project.investorId!==investorId||project.meta?.roomProject?.roomId!==row.scope
    ||!row.editor?.active||row.editor.deviceId!==deviceId||!Number.isSafeInteger(row.expectedVersion))fail('LF_QUOTE_STATUS_PLAN_INVALID');
  const encoded=json(row.value);result.push({...row,encoded,hash:await digest(encoded)});
 }
 return result;
}
export function validateQuoteStatusRooms(prepared,replicas,outbox,control,before,application,investorId){
 const scopes=new Set(prepared.map(row=>row.scope)),prior=JSON.parse(before.rows.fc_projects_v1||'[]'),next=JSON.parse(application.rows.fc_projects_v1||'[]');
 if(!equal(prior.filter(row=>!scopes.has(row.id)),next.filter(row=>!scopes.has(row.id))))fail('LF_APPLICATION_SCOPE_REFUSED');
 const writes=prepared.map(row=>{
  const old=replicas.find(replica=>replica.key===row.scope),a=prior.find(record=>record.id===row.scope),b=next.find(record=>record.id===row.scope);
  if(!old||old.version!==row.expectedVersion||old.dirty||outbox.some(op=>op.scope===row.scope&&op.phase!=='verified'))fail('LF_LOCAL_CONFLICT');
  if(!old.editor?.active||!equal(old.editor,row.editor))fail('LF_EDITOR_REQUIRED');
  if(control.some(marker=>marker.key==='quote-grant:'+row.scope||marker.key==='quote-reservation:'+row.scope))fail('LF_QUOTE_ROOM_RESERVED');
  if(control.some(marker=>['retired:'+row.scope,'projectRecovery:'+row.scope].includes(marker.key)))fail('LF_PROJECT_RECOVERY_PENDING');
  if(outbox.some(op=>op.key===row.operationId)||!a||!b||a.investorId!==investorId||a.meta?.pendingDomainOperation||b.meta?.pendingDomainOperation
    ||!equal(content(a),content(b))||!equal(b,row.value.document.payload.project))fail('LF_APPLICATION_SCOPE_REFUSED');
  return {row,old,previous:outbox.filter(op=>op.scope===row.scope).sort((a,b)=>b.localVersion-a.localVersion)[0]};
 });
 const expectedCards=JSON.parse(before.rows.fc_investors_v1||'[]').map(card=>{
  const out=copy(card);
  if(out.id===investorId)out.rooms=(out.rooms||[]).map(room=>scopes.has(room.id)
   ? {...room,...copy(next.find(record=>record.id===room.id).projectData.meta.roomDefs[room.id])}:room);
  return out;
 });
 if(!equal(expectedCards,JSON.parse(application.rows.fc_investors_v1||'[]')))fail('LF_APPLICATION_SCOPE_REFUSED');
 return writes;
}
export function writeQuoteStatusRooms({s,writes,application,protection,protectedHash,rememberHandover}){
 for(const {row,old,previous}of writes){
  const version=old.version+1;
  s.replicas.put({key:row.scope,version,json:row.encoded,hash:row.hash,base:copy(old.base),editor:copy(row.editor),dirty:true});
  s.outbox.add({key:row.operationId,scope:row.scope,localVersion:version,json:row.encoded,hash:row.hash,base:copy(old.base),editor:copy(row.editor),
   previousOperation:previous?.key||null,applicationHash:application.hash,phase:'queued',blockers:[],expected:null});
  s.protected.add({key:row.operationId,scope:row.scope,json:protection,hash:protectedHash});
  if(row.releaseAfterSync)rememberHandover(s.control,row.scope,row.editor);
 }
}

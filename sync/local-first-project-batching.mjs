// Local scheduling only. No Firebase, UI, lease changes or invented cloud ACK.
import {copy,equal,fail} from './local-first-values.mjs';
export const PROJECT_SYNC_IDLE_MS=120000,PROJECT_SYNC_MAX_MS=300000;
export function projectBatchDelay(operation,now=Date.now()){
 if(!operation.batch||operation.phase!=='queued')return 0;
 const b=operation.batch;
 if(b.version!==1||!Number.isSafeInteger(b.firstAt)||!Number.isSafeInteger(b.lastAt)
  ||b.firstAt<0||b.lastAt<b.firstAt||!Number.isSafeInteger(now))fail('LF_SYNC_BATCH_INVALID');
 // A clock moved backwards must not postpone transmission indefinitely.
 if(now<b.lastAt)return 0;
 return Math.max(0,Math.min(b.lastAt+PROJECT_SYNC_IDLE_MS,b.firstAt+PROJECT_SYNC_MAX_MS)-now);
}
export function archivedProjectOperation(controls,key){
 const record=controls.find(row=>row.key==='p1-coalesced:'+key);
 if(!record)return null;
 if(record.version!==1||record.operation?.key!==key||!record.replacedBy)fail('LF_SYNC_BATCH_INVALID');
 return record.operation;
}
export function prepareProjectBatch({entry,old,previous,operations,controls,now=Date.now()}){
 const project=entry.value?.document?.payload?.project;
 if(entry.batchable!==true||entry.releaseAfterSync||project?.meta?.roomProject?.version!==1
  ||project.meta.roomProject.roomId!==entry.scope||project.meta.roomProject.removed===true)return {};
 if(!Number.isSafeInteger(now)||now<0)fail('LF_SYNC_BATCH_INVALID');
 const batch={version:1,firstAt:now,lastAt:now};
 if(!previous?.batch||previous.phase!=='queued'||previous.expected||previous.blockers?.length
  ||previous.scope!==entry.scope||previous.localVersion!==old.version||previous.json!==old.json||previous.hash!==old.hash
  ||!equal(previous.editor,entry.editor)||!equal(previous.base,old.base)
  ||controls.some(c=>c.key==='handover:'+entry.scope||c.key==='projectRecovery:'+entry.scope||c.key==='retired:'+entry.scope)
  ||operations.some(op=>op.dependencies?.some(d=>d.key===previous.key)))return {batch};
 const before=JSON.parse(previous.json);
 // Never fold a catalog pin or offer/history change into a later room save.
 if(!equal(before.globals,entry.value.globals)||!equal(before.document?.payload?.offers,entry.value.document?.payload?.offers))return {batch};
 projectBatchDelay(previous,now); // Validate persisted timing before reusing it.
 // A due operation is a boundary: continued saves must not starve it.
 if(projectBatchDelay(previous,now)===0)return {batch};
 batch.firstAt=previous.batch.firstAt;
 return {batch,superseded:copy(previous)};
}
export function retainCoalescedProject(s,previous,replacedBy){
 if(!previous)return;
 s.control.add({key:'p1-coalesced:'+previous.key,version:1,operation:copy(previous),replacedBy});
 // Existing protected RAW is retained. The archive is not a server receipt.
 s.outbox.delete(previous.key);
}

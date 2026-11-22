import {copy,equal,fail,id,json} from './local-first-values.mjs';

export function validateQuoteRelease(row,ownerUid,deviceId){
 json(row);id(row?.projectId);id(row?.investorId);id(row?.operationId);
 const e=row.expected?.editor;
 if(row.key!=='quote-release:'+row.projectId||row.version!==1||row.deviceId!==deviceId
  ||typeof row.deviceLabel!=='string'||row.deviceLabel.length>64||!Number.isSafeInteger(row.pinRevision)||row.pinRevision<1
  ||!e?.active||e.deviceId===deviceId||e.ownerUid!==ownerUid||e.projectId!==row.projectId||e.investorId!==row.investorId
  ||!Number.isSafeInteger(e.epoch)||e.epoch<1||!/^[a-f0-9]{32}$/.test(row.expected.revision)
  ||!equal(Object.keys(row).sort(),['key','version','deviceId','deviceLabel','projectId','investorId','operationId','pinRevision','expected'].sort()))fail('LF_QUOTE_RELEASE_INVALID');
 return true;
}
export const quoteReleaseEditor=row=>({...copy(row.expected.editor),deviceId:row.deviceId,deviceLabel:row.deviceLabel,epoch:row.expected.editor.epoch+1,headRevision:row.expected.revision});
export function validateQuoteReleaseReceipt(record,ownerUid,deviceId){
 validateQuoteRelease(record.intent,ownerUid,deviceId);
 const row=record.intent,next=quoteReleaseEditor(row),released={editor:{...next,active:false},revision:row.expected.revision};
 if(record.key!=='quote-release-done:'+row.operationId+':'+row.projectId||record.version!==1
  ||!equal(Object.keys(record).sort(),['key','version','intent','outcome','observed'].sort())
  ||record.outcome==='released'&&!equal(record.observed,released)
  ||record.outcome==='changed'&&(equal(record.observed,row.expected)||equal(record.observed,{editor:next,revision:row.expected.revision})||equal(record.observed,released))
  ||!['released','changed'].includes(record.outcome))fail('LF_QUOTE_RELEASE_INVALID');
 const observed=record.observed;
 if(observed?.editor?.ownerUid!==ownerUid||observed.editor.investorId!==row.investorId||observed.editor.projectId!==row.projectId
  ||typeof observed.editor.active!=='boolean'||!Number.isSafeInteger(observed.editor.epoch)||observed.editor.epoch<row.expected.editor.epoch
  ||!/^[a-f0-9]{32}$/.test(observed.revision))fail('LF_QUOTE_RELEASE_INVALID');
 json(observed);return true;
}
export function quoteReleaseStore({transaction,ownerUid,deviceId}){
 async function pending(){
  const rows=await transaction('readonly',(s,done)=>{const q=s.control.getAll();q.onsuccess=()=>done(q.result.filter(row=>row.key.startsWith('quote-release:')));});
  for(const row of rows)validateQuoteRelease(row,ownerUid,deviceId);return rows;
 }
 async function stage({investorId,targets,pinRevision,deviceLabel,application}){
  if(!Array.isArray(targets)||!targets.length||new Set(targets.map(row=>row.projectId)).size!==targets.length)fail('LF_QUOTE_RELEASE_INVALID');
  const operationId=crypto.randomUUID(),rows=targets.map(target=>({key:'quote-release:'+target.projectId,version:1,operationId,projectId:target.projectId,investorId,deviceId,deviceLabel,pinRevision,expected:copy(target.expected)}));
  for(const row of rows)validateQuoteRelease(row,ownerUid,deviceId);
  return transaction('readwrite',(s,done,abort)=>{
   const a=s.control.get('application'),c=s.control.getAll();let n=2;
   const finish=()=>{if(--n)return;try{
    if(!a.result||a.result.version!==application.version||a.result.hash!==application.hash)fail('LF_QUOTE_RELEASE_SOURCE_CHANGED');
    const projects=JSON.parse(a.result.rows.fc_projects_v1||'[]');
    if(a.result.rows.fc_current_investor_v1!==investorId||rows.some(row=>!projects.some(p=>p.id===row.projectId&&p.investorId===investorId&&!p.meta?.roomProject?.removed)))fail('LF_APPLICATION_SCOPE_REFUSED');
    if(c.result.some(record=>rows.some(row=>record.key===row.key)))fail('LF_QUOTE_RELEASE_PENDING');
    if(c.result.some(record=>rows.some(row=>['retired:','projectRecovery:','handover:'].some(prefix=>record.key===prefix+row.projectId))))fail('LF_QUOTE_RELEASE_SOURCE_CHANGED');
    for(const row of rows)s.control.add(row);done(rows);
   }catch(error){abort(error);}};a.onsuccess=c.onsuccess=finish;
  });
 }
 async function finish(intent,outcome,observed){
  const record={key:'quote-release-done:'+intent.operationId+':'+intent.projectId,version:1,intent:copy(intent),outcome,observed:copy(observed)};
  validateQuoteReleaseReceipt(record,ownerUid,deviceId);
  return transaction('readwrite',(s,done,abort)=>{const q=s.control.get(intent.key);q.onsuccess=()=>{try{
   if(!equal(q.result,intent))fail('LF_QUOTE_RELEASE_SOURCE_CHANGED');
   s.control.delete(intent.key);s.control.add(record);done(record);
  }catch(error){abort(error);}};});
 }
 async function reauthorize(intent,pinRevision){
  const next={...copy(intent),pinRevision};validateQuoteRelease(next,ownerUid,deviceId);
  return transaction('readwrite',(s,done,abort)=>{const q=s.control.get(intent.key);q.onsuccess=()=>{try{if(!equal(q.result,intent))fail('LF_QUOTE_RELEASE_SOURCE_CHANGED');s.control.put(next);done(next);}catch(error){abort(error);}};});
 }
 return {pendingQuoteReleases:pending,pendingQuoteRelease:async scope=>(await pending()).find(row=>row.projectId===scope)||null,stageQuoteReleases:stage,finishQuoteRelease:finish,reauthorizeQuoteRelease:reauthorize};
}

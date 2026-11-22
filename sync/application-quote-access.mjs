import {copy,equal,fail} from './local-first-values.mjs';
import {quoteWarning} from './application-quote-warning.mjs';
export function createQuoteAccess({window:w,store,protocol,getSync,assertAccess,releases}){
 const fc=w.FC;let closed=false,busy=false,prompt=null;
 const access=()=>{if(closed)fail('LF_CLOSED');assertAccess();};
 async function inspect(selection){
  access();const iid=fc.investors.getCurrentId(),image=await store.readApplication(),records=JSON.parse(image.rows.fc_projects_v1||'[]');
  const rooms=selection.selectedRooms;
  if(!Array.isArray(rooms)||!rooms.length||new Set(rooms).size!==rooms.length)fail('LF_QUOTE_SOURCE_INVALID');
  return Promise.all(rooms.map(async pid=>{
   const record=records.find(row=>row.id===pid&&row.investorId===iid);if(!record||record.meta?.roomProject?.removed)fail('LF_QUOTE_SOURCE_INVALID');
   const name=record.title||record.projectData.meta.roomDefs[pid]?.name||pid;
   if(w.navigator.onLine===false)return {projectId:pid,name,state:'unconfirmed'};
   const expected=await protocol.projectStatus(iid,pid);access();
   const pending=await store.pendingQuoteRelease(pid);
   return {projectId:pid,name,state:pending||expected.editor.active&&expected.editor.deviceId!==store.deviceId?'held':'released',deviceLabel:expected.editor.deviceLabel||'Nieznane urządzenie',expected};
  }));
 }
 async function run({selection:readSelection,generate,assertCurrent,beforeRun}){
  if(busy)fail('LF_APPLICATION_BUSY');busy=true;
  try{
   access();assertCurrent();if(!fc.sessionNavigation.canCalculate())return false;
   // Explicitly finish committed local saves and receive server-confirmed data.
   // An offline clean replica can remain a witnessed historical source; no ACK is invented.
   const pending=(await store.pendingQuoteReleases()).some(row=>row.investorId===fc.investors.getCurrentId());
   if(w.navigator.onLine!==false&&!pending){const result=await getSync().flush();if(!result.ok)fail(result.code);}
   access();assertCurrent();const selection=copy(readSelection()),witness=fc.roomQuoteSources.revision(selection.selectedRooms);
   const rows=await inspect(selection),warning=rows.some(row=>row.state!=='released');
   if(warning){
    prompt=quoteWarning({window:w,rows,refresh:()=>inspect(selection),release:async(targets,pin)=>{
     access();assertCurrent();await releases.release({investorId:fc.investors.getCurrentId(),targets:targets.map(row=>({projectId:row.projectId,expected:row.expected})),pin});
    }});
    if(!await prompt.promise)return false;prompt=null;
   }
   access();assertCurrent();if(!equal(readSelection(),selection))fail('LF_QUOTE_SOURCE_CHANGED');
   fc.roomQuoteSources.assertRevision(selection.selectedRooms,witness);
   if(await fc.quoteOfferStore.prepareGeneration()===false)fail('LF_OFFER_DRAFT_UNCONFIRMED');
   access();assertCurrent();beforeRun();
   return fc.applicationWrite.quote(()=>generate({readOnly:true}));
  }finally{busy=false;prompt=null;}
 }
 return {run,inspect,busy:()=>busy,close(){closed=true;prompt?.cancel();}};
}

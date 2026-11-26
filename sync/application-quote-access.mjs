import {copy,equal,fail} from './local-first-values.mjs';
import {quoteWarning} from './application-quote-warning.mjs';
export function createQuoteAccess({window:w,store,protocol,getSync,assertAccess,releases,reservations,assertLocalAccess=assertAccess}){
 const fc=w.FC;let closed=false,busy=false,prompt=null;
 const access=()=>{if(closed)fail('LF_CLOSED');assertAccess();};
 const localAccess=()=>{if(closed)fail('LF_CLOSED');assertLocalAccess();};
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
   if(w.navigator.onLine===false){
    localAccess();assertCurrent();if(!fc.sessionNavigation.canCalculate())return false;
    const selection=copy(readSelection()),iid=fc.investors.getCurrentId(),image=await store.readApplication();
    if(!image)fail('LF_OFFLINE_QUOTE_CONTEXT_CHANGED');
    const witness=fc.roomQuoteSources.revision(selection.selectedRooms);
    const check=()=>{
     localAccess();assertCurrent();
     if(w.navigator.onLine!==false||fc.investors.getCurrentId()!==iid||!equal(readSelection(),selection)
      ||!fc.sessionNavigation.canCalculate())fail('LF_OFFLINE_QUOTE_CONTEXT_CHANGED');
     fc.roomQuoteSources.assertRevision(selection.selectedRooms,witness);
    };
    const rows=selection.selectedRooms.map(pid=>{
     const record=JSON.parse(image.rows.fc_projects_v1||'[]').find(row=>row.id===pid&&row.investorId===iid);
     if(!record||record.meta?.roomProject?.removed)fail('LF_QUOTE_SOURCE_INVALID');
     return {projectId:pid,name:record.title||pid,state:'unconfirmed'};
    });
    check();
    prompt=quoteWarning({window:w,rows,offline:true});
    if(!await prompt.promise)return false;prompt=null;
    check();beforeRun();
    return await fc.applicationWrite.offlineQuote(()=>generate({readOnly:true,offlineQuote:{
     assertCurrent:check,
     async save(snapshot){
      check();
      // The calculation builder deliberately leaves the ID to its storage sink.
      const value={...fc.projectPcvResolver.stripQuoteProof(snapshot),id:crypto.randomUUID()};
      const result=await store.saveOfflineQuote({image,snapshot:value,assertCurrent:check,normalizeProject:fc.projectModel.normalizeProjectRecord});
      return {...value,meta:{...value.meta,offlineUnconfirmed:true},localReceipt:result};
     }
    }}));
   }
   access();assertCurrent();if(!protocol||!getSync())fail('LF_QUOTE_SOURCE_UNCONFIRMED');
   if(!fc.sessionNavigation.canCalculate())return false;
   // Explicitly finish committed local saves and receive server-confirmed data.
   // An offline clean replica can remain a witnessed historical source; no ACK is invented.
   const pending=(await store.pendingQuoteReleases()).some(row=>row.investorId===fc.investors.getCurrentId());
   if(w.navigator.onLine!==false&&!pending){const result=await getSync().flush();if(!result.ok)fail(result.code);}
   access();assertCurrent();const selection=copy(readSelection());
   if(reservations){
    const iid=fc.investors.getCurrentId();
    const refresh=options=>{access();assertCurrent();return reservations.ready(iid,selection.selectedRooms,options);};
    const rows=await refresh();
    if(!rows.length||rows.some(row=>row.state!=='reserved')){
     prompt=quoteWarning({window:w,rows,reservation:true,refresh,release:(_rows,pin)=>refresh({pin})});
     if(!await prompt.promise)return false;prompt=null;
    }
    // The grant may refer to a newly saved revision. Apply that image before
    // taking the calculation witness. Older local revisions cannot publish.
    const synced=await getSync().flush();if(!synced.ok)fail(synced.code);
    access();assertCurrent();if(!equal(readSelection(),selection))fail('LF_QUOTE_SOURCE_CHANGED');
    if(await fc.quoteOfferStore.prepareGeneration()===false)fail('LF_OFFER_DRAFT_UNCONFIRMED');
    access();assertCurrent();beforeRun();reservations.publication(true);
    try{return await fc.applicationWrite.quote(()=>generate({readOnly:true}));}
    finally{reservations.publication(false);}
   }
   const witness=fc.roomQuoteSources.revision(selection.selectedRooms);
   const rows=await inspect(selection);
   if(rows.some(row=>row.state!=='released')){
    prompt=quoteWarning({window:w,rows,refresh:()=>inspect(selection),release:async(targets,pin)=>{
     access();assertCurrent();await releases.release({investorId:fc.investors.getCurrentId(),targets:targets.map(row=>({projectId:row.projectId,expected:row.expected})),pin});
    }});
    if(!await prompt.promise)return false;prompt=null;
   }
   access();assertCurrent();if(!equal(readSelection(),selection))fail('LF_QUOTE_SOURCE_CHANGED');
   fc.roomQuoteSources.assertRevision(selection.selectedRooms,witness);
   if(await fc.quoteOfferStore.prepareGeneration()===false)fail('LF_OFFER_DRAFT_UNCONFIRMED');
   access();assertCurrent();beforeRun();
   return await fc.applicationWrite.quote(()=>generate({readOnly:true}));
  }finally{busy=false;prompt=null;}
 }
 return {run,inspect,previewSelection:reservations?.previewSelection,navigate:reservations?.navigate,async offlineHistory(investorId,projectId){
  localAccess();
  if(fc.investors.getCurrentId()!==investorId||fc.projectStore.getCurrentProjectId()!==projectId)return [];
  const rows=await store.readOfflineQuotes(investorId);localAccess();
  if(fc.investors.getCurrentId()!==investorId||fc.projectStore.getCurrentProjectId()!==projectId)return [];
  return rows.filter(row=>row.project.id===projectId||row.scope.selectedRooms.includes(projectId)).sort((a,b)=>b.generatedAt-a.generatedAt)
   .map(row=>({...row,meta:{...row.meta,offlineUnconfirmed:true}}));
 },busy:()=>busy,close(){closed=true;prompt?.cancel();}};
}

// Detached, read-only sources for a quote spanning independent room projects.
// No RAM activation, selection change, cached facts persistence or editor mutation.
(function(){
 'use strict';const FC=window.FC=window.FC||{};
 const clone=value=>JSON.parse(JSON.stringify(value));
 const canonical=value=>FC.cloudPilotContract.canonical(value);
 const enabled=()=>FC.roomProjectModel?.enabled()===true;
 const fail=code=>{throw Object.assign(Error(code),{code});};
 function capture(rooms){
  if(!enabled())fail('LF_ROOM_PROJECT_SCOPE_REQUIRED');
  const iid=FC.investors.getCurrentId();
  const source=FC.roomProjectModel.quoteSource(iid,rooms);
  const policy=FC.projectPcvPolicy.read({strict:true});
  if(!policy.ok)fail('PROJECT_PCV_'+policy.code);
  return source;
 }
 function captureAll(){const iid=FC.investors.getCurrentId(),ids=FC.roomProjectModel.list(iid).filter(row=>!row.meta.roomProject.removed).map(row=>row.id);return ids.length?capture(ids):{projectData:{},projects:[]};}
 function read(rooms){return FC.projectPcvOverrides?.calculationSource?FC.projectPcvOverrides.calculationSource(rooms):rooms===null?captureAll():capture(rooms);}
 function all(){return read(null);}
 function context(projectId,roomId){
  const source=read([roomId]),record=source.projects[0];
  if(record.id!==projectId)fail('PROJECT_PCV_SOURCE_CONTEXT_MISMATCH');
  return {ok:true,detached:true,project:record.projectData,record,room:record.projectData[roomId]};
 }
 function input(roomId){return enabled()?context(roomId,roomId).room:roomId;}
 function cutlist(cabinet,roomId){return FC.cabinetCutlist.getCabinetCutList(cabinet,input(roomId),enabled()?{projectId:roomId,roomId}:undefined);}
 function revision(rooms){return canonical(capture(rooms).projects);}
 function assertRevision(rooms,expected){if(revision(rooms)!==expected)fail('PROJECT_PCV_READ_CONFLICT');}
 async function references(rooms,offlineQuote){
  const source=capture(rooms),before=canonical(source.projects);
  const refs=await Promise.all(source.projects.map(async record=>({projectId:record.id,roomId:record.id,investorId:record.investorId,recordHash:await FC.cloudPilotContract.sha(new TextEncoder().encode(canonical(record)))})));
  if(offlineQuote){
   offlineQuote.assertCurrent();assertRevision(rooms,before);return refs;
  }
  if(!FC.roomQuoteProof?.sources)fail('LF_QUOTE_SOURCE_UNCONFIRMED');
  const pins=await FC.roomQuoteProof.sources(refs);
  assertRevision(rooms,before);return refs.map(ref=>{const pin=pins.find(pin=>pin.projectId===ref.projectId);if(!pin)fail('LF_QUOTE_SOURCE_UNCONFIRMED');return {...ref,revision:clone(pin.head),documentHash:pin.documentHash};});
 }
 function matchesPart(part){const pcv=part?.effectivePcv;if(!pcv?.contributions?.length)return false;return pcv.contributions.every(c=>c.address.projectId===pcv.projectId&&c.address.roomId===pcv.projectId&&context(c.address.projectId,c.address.roomId).ok);}
 FC.roomQuoteSources={enabled,capture,captureAll,all,context,input,cutlist,revision,assertRevision,references,matchesPart};
})();

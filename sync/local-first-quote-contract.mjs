// Investor-owned quote history. Sources are real immutable room revisions.
// One-room legacy project.id remains origin metadata, never the ledger owner.
import {copy,id,json,equal,fail,digest} from './local-first-values.mjs';
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const quoteScope=async iid=>'p0b_quotes_'+await digest(id(iid));
export function validateQuoteLedger(value){
 json(value);
 if(value?.kind!=='p0b-room-quotes'||!Array.isArray(value.offers)||!value.pins||typeof value.pins!=='object')fail('LF_QUOTE_LEDGER_INVALID');
 id(value.investorId);
 if(new Set(value.offers.map(row=>row.id)).size!==value.offers.length||!equal(Object.keys(value.pins).sort(),value.offers.map(row=>row.id).sort()))fail('LF_QUOTE_LEDGER_INVALID');
 for(const row of value.offers){
  id(row.id);
  const rooms=row.scope?.selectedRooms,refs=row.scope?.sourceProjects,pins=value.pins[row.id];
  if(row.investor?.id!==value.investorId||row.project?.investorId!==value.investorId||!rooms?.length
    ||new Set(rooms).size!==rooms.length||!rooms.includes(row.project.id)||!Array.isArray(refs)||!Array.isArray(pins)
    ||refs.length!==rooms.length||pins.length!==rooms.length||!equal(refs.map(ref=>ref.roomId).sort(),rooms.slice().sort())
    ||!equal(pins.map(pin=>pin.projectId).sort(),rooms.slice().sort()))fail('LF_QUOTE_SOURCE_INVALID');
  for(const ref of refs){
   const pin=pins.find(pin=>pin.projectId===ref.projectId);
   if(ref.projectId!==ref.roomId||ref.investorId!==value.investorId||!hash(ref.recordHash)||!equal(ref.revision,pin?.head)||ref.documentHash!==pin?.documentHash
     ||!pin||pin.recordHash!==ref.recordHash||!hash(pin.documentHash)||!pin.head?.currentRevisionId
     ||pin.head.projectId!==ref.projectId||pin.head.investorId!==value.investorId||pin.head.documentSha256!==pin.documentHash||pin.head.roomDeleted===true)fail('LF_QUOTE_SOURCE_INVALID');
  }
  if(!row.lines||!row.totals||!row.calculationRegister)fail('LF_QUOTE_LEDGER_INVALID');
 }
 return true;
}
function frozen(row){
 const out=copy(row);
 // These are the existing explicit acceptance/status fields. Frozen prices,
 // source identities, revisions, scope, clientOffer and lines never change.
 if(out.meta)for(const key of ['selectedByClient','acceptedAt','acceptedStage','rejectedAt','rejectedReason'])delete out.meta[key];
 if(out.project)delete out.project.status;
 return out;
}
// Only the existing explicit preliminary -> final workflow may alter these
// classification fields. Every price, source pin, timestamp and unknown field
// is compared against the exact prior snapshot; final content cannot be edited.
function promotion(before,after){
 if(!before.meta?.selectedByClient||!(before.meta?.preliminary||before.commercial?.preliminary)
  ||!(before.meta.acceptedAt>0)||before.meta.acceptedStage!=='pomiar')return false;
 const rooms=before.scope.selectedRooms,labels=before.scope.roomLabels;
 if(!Array.isArray(labels)||labels.length<rooms.length||rooms.some((_,i)=>!String(labels[i]||'').trim()))return false;
 const suffix=' — '+labels.slice(0,rooms.length).map(v=>String(v).trim()).join(' + ');
 const current=String(before.commercial?.versionName||before.meta.versionName||'').trim();
 const name=!current||current==='Wstępna oferta'+suffix?'Oferta'+suffix:current;
 const expected=copy(before);
 expected.commercial={...expected.commercial,preliminary:false,versionName:name};
 expected.meta={...expected.meta,preliminary:false,versionName:name,selectedByClient:true,acceptedStage:'zaakceptowany',rejectedAt:0,rejectedReason:''};
 expected.project={...expected.project,status:'zaakceptowany'};
 return equal(expected,after);
}
// The approved duplicate action refreshes only calculation timestamps in the
// same logical slot. Every business value, source pin and unknown field stays exact;
// previous local images and immutable cloud revisions are never rewritten.
function duplicateRefresh(before,after){
 if(!before.meta||typeof before.meta!=='object'||Array.isArray(before.meta)||after.meta?.source!=='quote-duplicate-refresh')return false;
 const expected=frozen(before),next=frozen(after),time=next.generatedAt;
 if(!Number.isSafeInteger(time)||!Number.isSafeInteger(before.generatedAt)||time<before.generatedAt)return false;
 expected.generatedAt=time;expected.meta.source='quote-duplicate-refresh';
 if(Object.hasOwn(expected.calculationRegister,'generatedAt')){
  const stamp=next.calculationRegister?.generatedAt,prior=expected.calculationRegister.generatedAt;
  if(!Number.isSafeInteger(stamp)||stamp<prior||stamp>time)return false;
  expected.calculationRegister.generatedAt=stamp;
 }
 for(const key of ['builtAt','generatedAt'])if(Object.hasOwn(expected.clientOffer||{},key)){
  const stamp=next.clientOffer?.[key],prior=expected.clientOffer[key];
  if(!Number.isSafeInteger(stamp)||stamp<prior||stamp>time)return false;
  expected.clientOffer[key]=stamp;
 }
 return equal(expected,next);
}
export function validateQuoteLedgerChange(before,after){
 validateQuoteLedger(after);if(!before)return true;validateQuoteLedger(before);
 if(before.investorId!==after.investorId)fail('LF_QUOTE_OWNER_CHANGED');
 for(const old of before.offers){
  const next=after.offers.find(row=>row.id===old.id);
  if(next&&((!equal(frozen(old),frozen(next))&&!promotion(old,next)&&!duplicateRefresh(old,next))||!equal(before.pins[old.id],after.pins[old.id])))fail('LF_QUOTE_HISTORY_IMMUTABLE');
  // Explicit removal changes active history only. Earlier immutable revisions
  // remain in Firestore and protected local transaction images.
 }
 return true;
}
// Read-only room pricing can create or explicitly refresh one offer. It cannot
// remove history, accept/reject an offer or alter any room's business status.
export function validateQuoteGenerationChange(before,after){
 const old=before?.offers||[],added=after.offers.filter(row=>!old.some(prior=>prior.id===row.id));
 if(added.length>1||after.offers.length!==old.length+added.length||added.some(row=>row.meta?.selectedByClient||row.meta?.acceptedAt||row.meta?.acceptedStage||row.meta?.rejectedAt||row.meta?.rejectedReason)
  ||!equal(after.offers.filter(row=>old.some(prior=>prior.id===row.id)).map(row=>row.id),old.map(row=>row.id)))fail('LF_QUOTE_HISTORY_IMMUTABLE');
 let refreshed=0;
 const acceptance=row=>({status:row.project?.status,meta:Object.fromEntries(['selectedByClient','acceptedAt','acceptedStage','rejectedAt','rejectedReason'].filter(key=>Object.hasOwn(row.meta||{},key)).map(key=>[key,row.meta[key]]))});
 for(const prior of old){
  const next=after.offers.find(row=>row.id===prior.id);if(!next)fail('LF_QUOTE_HISTORY_IMMUTABLE');
  if(!equal(prior,next)){if(added.length||++refreshed>1||!duplicateRefresh(prior,next)||!equal(acceptance(prior),acceptance(next)))fail('LF_QUOTE_HISTORY_IMMUTABLE');}
 }
 return true;
}

// Status writes may accompany exactly one explicit active-history removal.
// Retained offers/pins are exact; no add, replacement or unrelated room write.
export function validateQuoteStatusHistoryChange(before,after,scopes){
 if(before&&equal(before.offers.map(row=>row.id),after.offers.map(row=>row.id)))return true;
 const removed=before?.offers.filter(row=>!after.offers.some(next=>next.id===row.id))||[];
 if(removed.length!==1||!equal(after.offers,before.offers.filter(row=>row.id!==removed[0].id))
   ||scopes.some(scope=>!removed[0].scope.selectedRooms.includes(scope)))fail('LF_QUOTE_HISTORY_IMMUTABLE');
 return true;
}

// Naming another variant is part of the same atomic local history commit.
// It is not a general settings write: all other fields/rows stay exact.
export function validateQuoteVariantDraftChange(before,after,previous,value){
 const key='fc_quote_offer_drafts_v1';
 if(before[key]===after[key])return false;
 const refuse=()=>fail('LF_APPLICATION_SCOPE_REFUSED'),pid=before.fc_current_project_id_v1,iid=value.investorId;
 if(!pid||after.fc_current_project_id_v1!==pid||before.fc_current_investor_v1!==iid||after.fc_current_investor_v1!==iid)refuse();
 const priorOffers=previous?.offers||[],added=value.offers.filter(row=>!priorOffers.some(old=>old.id===row.id));
 if(added.length!==1||value.offers.length!==priorOffers.length+1
  ||!equal(priorOffers,value.offers.filter(row=>priorOffers.some(old=>old.id===row.id))))refuse();
 const offer=added[0];
 if(offer.project.id!==pid||offer.investor.id!==iid)refuse();
 let old,next,projects;
 try{old=JSON.parse(before[key]||'[]');next=JSON.parse(after[key]||'[]');projects=JSON.parse(before.fc_projects_v1||'[]');}catch{refuse();}
 if(!Array.isArray(old)||!Array.isArray(next)||!Array.isArray(projects))refuse();
 const indices=old.flatMap((row,index)=>row?.projectId===pid?[index]:[]);
 if(indices.length!==1||projects.filter(row=>row.id===pid&&row.investorId===iid).length!==1)refuse();
 const index=indices[0],prior=old[index],draft=next[index],name=draft?.commercial?.versionName;
 if(prior.investorId!==iid||draft?.investorId!==iid||typeof name!=='string'||!name.trim()||name!==name.trim()
  ||name!==offer.commercial?.versionName||name!==offer.meta?.versionName
  ||!Number.isSafeInteger(draft.updatedAt)||draft.updatedAt<0)refuse();
 const expected=copy(old);
 expected[index]={...expected[index],commercial:{...expected[index].commercial,versionName:name},updatedAt:draft.updatedAt};
 if(!equal(expected,next))refuse();
 return true;
}

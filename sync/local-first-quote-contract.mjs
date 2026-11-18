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
export function validateQuoteLedgerChange(before,after){
 validateQuoteLedger(after);if(!before)return true;validateQuoteLedger(before);
 if(before.investorId!==after.investorId)fail('LF_QUOTE_OWNER_CHANGED');
 for(const old of before.offers){
  const next=after.offers.find(row=>row.id===old.id);
  if(next&&((!equal(frozen(old),frozen(next))&&!promotion(old,next))||!equal(before.pins[old.id],after.pins[old.id])))fail('LF_QUOTE_HISTORY_IMMUTABLE');
  // Explicit removal changes active history only. Earlier immutable revisions
  // remain in Firestore and protected local transaction images.
 }
 return true;
}

// Private, in-memory proposal only. No store/authority/replication or executor.
import {digest,json,equal} from './local-first-values.mjs';
import {boundedJson,validateAuthority,refuse} from './local-first-rescue-state.mjs';
const plans=new WeakMap();
export function codeGlobalRows(model,c){
 c.validateBundle(model);return Object.fromEntries(Object.entries(c.sources).map(([domain,[key]])=>[key,c.canonical(domain==='stock'?{sheets:model[domain]}:model[domain])]));
}
function fields(a,b,path=[]){
 if(Object.is(a,b))return [];
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b))return [...new Set([...Object.keys(a),...Object.keys(b)])].sort().flatMap(key=>{
  if(!Object.hasOwn(a,key)||!Object.hasOwn(b,key))return [{path:[...path,key],oldPresent:Object.hasOwn(a,key),codePresent:Object.hasOwn(b,key),old:a[key]??null,code:b[key]??null}];
  return fields(a[key],b[key],[...path,key]);
 });
 return [{path,old:a,code:b}];
}
function records(old,code,c,domain){
 if(c.single.has(domain)||!Array.isArray(old)||!Array.isArray(code))return {fields:fields(old,code)};
 const index=list=>{const map=new Map(),unidentified=[];list.forEach((row,index)=>{
  const key=c.dictionary.has(domain)?row:row?.id;
  if(typeof key!=='string'||!key){unidentified.push({index,row});return;}
  if(!map.has(key))map.set(key,[]);map.get(key).push({index,row});
 });return {map,unidentified};};
 const a=index(old),b=index(code),onlyHistorical=[],onlyCode=[],changed=[],ambiguous=[];
 for(const id of [...new Set([...a.map.keys(),...b.map.keys()])].sort()){
  const x=a.map.get(id)||[],y=b.map.get(id)||[];
  if(x.length>1||y.length>1)ambiguous.push({id,historical:x,code:y});
  else if(!y.length)onlyHistorical.push(x[0]);else if(!x.length)onlyCode.push(y[0]);
  else{const differences=fields(x[0].row,y[0].row);if(differences.length)changed.push({id,historical:x[0],code:y[0],fields:differences});}
 }
 return {onlyHistorical,onlyCode,changed,ambiguous,unidentified:a.unidentified,order:fields(old.map(r=>c.dictionary.has(domain)?r:r?.id??null),code.map(r=>c.dictionary.has(domain)?r:r?.id??null))};
}
export async function planCodeGlobalRebuild({candidate,snapshot,contract:c,diagnostics}={}){
 boundedJson(snapshot);boundedJson(candidate.model);boundedJson(candidate.rules);c.validateBundle(candidate.model);
 if(candidate.provenance?.noStorage!==true||candidate.provenance.noCache!==true||candidate.provenance.noMigration!==true||candidate.provenance.modelHash!==await digest(c.canonical(candidate.model))||candidate.provenance.rulesHash!==await digest(c.canonical(candidate.rules)))refuse('CODE_REBUILD_PROVENANCE_INVALID');
 const native=Object.fromEntries(snapshot.local.rows.map(r=>[r.key,r.raw])),tables=snapshot.databases.authority;
 await validateAuthority(tables,snapshot.identity.receipt,native,snapshot.identity.activationId);
 const image=tables.control.find(r=>r.key==='application'),rows=structuredClone(image.rows),primary=codeGlobalRows(candidate.model,c),comparisons=[];
 // Inspect every original independently; no alias is chosen as a source.
 for(const [layer,original]of [['native',native],['application',image.rows]])for(const [domain,keys]of Object.entries(c.sources))for(const key of keys){
  const raw=original[key]??null,code=JSON.parse(primary[keys[0]]);let status='SOURCE_MISSING',comparison=null;
  if(raw!==null){let parsed;try{parsed=JSON.parse(raw);}catch(_){status='INVALID_JSON';}
   if(status!=='INVALID_JSON'){
    try{status=c.canonical(parsed)===c.canonical(code)?raw===primary[keys[0]]?'EQUAL':'RAW_ONLY':'DIFFERENT';}catch(_){status='NON_CANONICAL';}
    if(status==='NON_CANONICAL')comparison={rawReviewRequired:true};
    else{const historical=domain==='stock'&&parsed&&Array.isArray(parsed.sheets)?parsed.sheets:parsed;
     comparison=records(historical,candidate.model[domain],c,domain);
     if(domain==='stock')comparison.wrapperFields=fields(parsed,code);
    }
   }
  }
  comparisons.push({layer,domain,key,status,raw,comparison});
 }
 for(const [domain,keys]of Object.entries(c.sources)){
  rows[keys[0]]=primary[keys[0]];
  for(const key of keys.slice(1))if(image.rows[key]!=null)rows[key]=primary[keys[0]];
 }
 let startup;try{const captured=c.capture({getItem:key=>rows[key]??null},Object.keys(c.sources));c.validateBundle(captured.model);captured.assertUnchanged();startup={status:'GLOBALS_VALID',domains:14};}
 catch(error){startup={status:'BLOCKED',code:/^GLOBAL_[A-Z_]+$/.test(error?.code||'')?error.code:'CODE_REBUILD_VALIDATION_BLOCKED'};}
 const phases=tables.outbox.map(r=>r.phase),baseline=await digest(boundedJson(snapshot));
 const plan={scope:'PRIVATE_LOCAL_ONLY',status:'REPAIR_BLOCKED',executeAvailable:false,writeApproved:false,
  candidateProvenance:structuredClone(candidate.provenance),candidateRules:structuredClone(candidate.rules),
  nativeDiagnostics:diagnostics.inspect(key=>native[key]??null),applicationDiagnostics:diagnostics.inspect(key=>image.rows[key]??null),
  proposedDiagnostics:diagnostics.inspect(key=>rows[key]??null),startup,
  comparisons,ownerReviewRequired:comparisons.some(r=>['DIFFERENT','INVALID_JSON','NON_CANONICAL'].includes(r.status)),
  // Full historical records, prices, replacement sidecars and ACK evidence stay
  // private. This memory object is NOT a downloaded/verified rescue file.
  preservedPreimage:structuredClone(snapshot),
  proposedApplication:{expectedVersion:image.version,hash:await digest(json(rows)),rows},
  baseline:{snapshotHash:baseline,imageVersion:image.version,imageHash:image.hash,sourceHash:snapshot.identity.receipt.sourceHash,
   controlHash:await digest(json(tables.control)),replicasHash:await digest(json(tables.replicas)),outboxHash:await digest(json(tables.outbox)),protectedHash:await digest(json(tables.protected))},
  queue:{allRetained:true,pending:phases.filter(p=>p!=='verified').length,uncertain:phases.filter(p=>['uncertain','inflight'].includes(p)).length},
  requirements:['VERIFIED_OWNER_BACKUP_WITH_RAM','EXPLICIT_PRICE_RECORD_AND_RULE_DECISIONS','CURRENT_AUTH_RELEASE_AND_RECEIPT','EXISTING_WRITER_FENCE_SINGLE_EDITOR',
   'QUIESCENT_SCHEDULER_AND_RAM','RESOLVE_UNCERTAIN_ACK_WITHOUT_RETRY','FRESH_FULL_BASELINE_CAS','ATOMIC_APPLICATION_REPLICA_PROTECTED_OUTBOX',
   'PRESERVE_NATIVE_SOURCE_RECEIPT','RESTART_OFFLINE_AND_PROJECT_QUOTE_VALIDATION','ROLLBACK_WITHOUT_ACK_REPLAY','SEPARATE_WRITE_APPROVAL']};
 plans.set(plan,{baseline,proposalHash:await digest(json(plan.proposedApplication)),summary:{status:'REPAIR_BLOCKED',domains:14,
  startup:startup.status==='GLOBALS_VALID'?'GLOBALS_VALID':'BLOCKED',ownerReviewRequired:plan.ownerReviewRequired,
  backupVerified:false,executeAvailable:false,writeApproved:false}});return plan;
}
export async function assertCodeRebuildBaseline(plan,freshSnapshot){
 if(!plans.has(plan))refuse('CODE_REBUILD_PLAN_REQUIRED');
 const proof=plans.get(plan);if(await digest(json(plan.proposedApplication))!==proof.proposalHash)refuse('CODE_REBUILD_PROPOSAL_CHANGED');
 if(await digest(boundedJson(freshSnapshot))!==proof.baseline)refuse('CODE_REBUILD_BASELINE_CHANGED');
 return {matched:true,writeApproved:false};
}
export function codeRebuildSummary(plan){
 if(!plans.has(plan))refuse('CODE_REBUILD_PLAN_REQUIRED');
 return structuredClone(plans.get(plan).summary);
}

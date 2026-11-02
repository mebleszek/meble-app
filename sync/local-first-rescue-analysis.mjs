// Local, private comparison of an already verified rescue. No stores/factories.
import {boundedJson,refuse} from './local-first-rescue-state.mjs';
// Canonicalization errors never hide other sources; private RAW stays intact.
const semanticallyEqual=(a,b,c)=>{try{return c.canonical(a)===c.canonical(b);}catch(_){return differences(a,b).length===0;}};
const required=['id','name','materialType','price','priceUnit'];
const knownMaterial=new Set([...required,'manufacturer','symbol','hasGrain','starterPrice','priceUserEditedAt','note']);
const mixed=row=>typeof row?.materialType==='string'&&['akcesoria','accessories','akcesorium'].includes(row.materialType.trim().toLowerCase());
const parse=raw=>{if(raw===null)return {status:'MISSING',raw};try{return {status:'PARSED',raw,value:JSON.parse(raw)};}catch(_){return {status:'INVALID_JSON',raw};}};
function differences(a,b,path=[]){
 if(Object.is(a,b))return [];
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){
  return [...new Set([...Object.keys(a),...Object.keys(b)])].sort().flatMap(key=>{
   if(!Object.hasOwn(a,key)||!Object.hasOwn(b,key))return [{path:[...path,key],left:{present:Object.hasOwn(a,key),value:a[key]??null},right:{present:Object.hasOwn(b,key),value:b[key]??null}}];
   return differences(a[key],b[key],[...path,key]);
  });
 }
 return [{path,left:{present:true,value:a},right:{present:true,value:b}}];
}
function compareRecords(a,b,c){
 if(!Array.isArray(a)||!Array.isArray(b))return {status:'SHAPE_DECISION_REQUIRED',left:a,right:b};
 const index=rows=>{const map=new Map(),unidentified=[];rows.forEach((row,i)=>{if(typeof row?.id!=='string'||!row.id){unidentified.push({index:i,row});return;}if(!map.has(row.id))map.set(row.id,[]);map.get(row.id).push({index:i,row});});return {map,unidentified};};
 const left=index(a),right=index(b),onlyLeft=[],onlyRight=[],changed=[],ambiguous=[];
 for(const id of [...new Set([...left.map.keys(),...right.map.keys()])].sort()){
  const x=left.map.get(id)||[],y=right.map.get(id)||[];
  if(x.length>1||y.length>1){ambiguous.push({id,left:x,right:y});continue;}
  if(!x.length)onlyRight.push(y[0]);else if(!y.length)onlyLeft.push(x[0]);else if(!semanticallyEqual(x[0].row,y[0].row,c))changed.push({id,left:x[0],right:y[0],fields:differences(x[0].row,y[0].row)});
 }
 return {status:'COMPARED',onlyLeft,onlyRight,changed,ambiguous,unidentifiedLeft:left.unidentified,unidentifiedRight:right.unidentified,
  orderEqual:semanticallyEqual(a.map(r=>r?.id??null),b.map(r=>r?.id??null),c)};
}
export function analyzeRescue(data,c,diagnostics){
 if(typeof diagnostics?.inspect!=='function')refuse('RESCUE_DIAGNOSTICS_REQUIRED');
 boundedJson(data);const originals=Object.fromEntries(data.local.rows.map(r=>[r.key,r.raw])),image=data.databases.authority.control.find(r=>r.key==='application')?.rows;
 if(!image)refuse('RESCUE_IMAGE_INTEGRITY');
 const layer=rows=>{
  const sources=Object.fromEntries(Object.entries(c.sources).map(([domain,keys])=>[domain,keys.map(key=>({key,...parse(rows[key]??null)}))]));
  const material=sources.materials.map(src=>({...src,records:Array.isArray(src.value)?src.value.map((row,index)=>{
   const missing=required.filter(key=>!row||typeof row!=='object'||!Object.hasOwn(row,key));let schema='VALID',code='NONE';
   try{c.schemas.materials(row,'materials');}catch(error){schema='INVALID';code=typeof error?.code==='string'?error.code:'GLOBAL_VALUE_INVALID';}
   return {index,id:row?.id??null,row,missingRequired:missing,unknownFields:row&&typeof row==='object'?Object.keys(row).filter(k=>!knownMaterial.has(k)):[],
    catalogKind:mixed(row)?'HISTORICAL_ACCESSORY':'MATERIAL_OR_UNKNOWN',schema,code,unitCandidates:row&&typeof row==='object'?['priceUnit','unitPriceMode','unit'].filter(k=>Object.hasOwn(row,k)).map(key=>({key,value:row[key]})):[]};
  }):null}));
  const labor=sources.labor.map(src=>{
   const rows=Array.isArray(src.value)?src.value:[],hourly=rows.filter(r=>r&&(r.isHourlyRate||r.systemRate||r.category==='Stawki godzinowe'));
   const codes=hourly.map(r=>r.rateKey||r.rateCode||r.rateType),unresolved=rows.filter(r=>r&& !hourly.includes(r)&&r.rateType&&r.pricingMode!=='fixed'&&!codes.includes(r.rateType));
   return {...src,hourlyCodes:codes,duplicateHourlyCodes:codes.filter((code,i)=>codes.indexOf(code)!==i),unresolvedReferences:unresolved,records:rows.map((row,index)=>{
    let schema='VALID',code='NONE';try{c.schemas.labor(row,'labor');}catch(error){schema='INVALID';code=error?.code||'GLOBAL_VALUE_INVALID';}
    return {index,row,schema,code,unknownFields:Object.keys(row||{}).filter(k=>!['id','name','note','price','starterPrice','priceUserEditedAt','category','label','usage','rateKey','rateCode','rateType','pricingMode','quantityMode','quantitySource','volumeTimeMode','isHourlyRate','systemRate','nonDeletable','active','internalOnly','startPrice','includedQty','timeBlockHours','defaultMultiplier','startHours','startQty','stepEveryQty','stepHours','volumePricePerM3','volumeTimePerM3','fixedPrice','conditions','quantityTiers','volumeTimeTiers'].includes(k))};
   })};
  });
  const validation=diagnostics.inspect(key=>rows[key]??null);
  const domains=Object.entries(sources).map(([domain,list])=>{
   const present=list.filter(s=>s.status!=='MISSING');let status='SOURCE_AVAILABLE';
   if(!present.length)status='CONTROLLED_INITIALIZATION_REQUIRED';else if(present.some(s=>s.status!=='PARSED'))status='FORMAT_DECISION_REQUIRED';
   else if(present.length===2&&!semanticallyEqual(present[0].value,present[1].value,c))status='OWNER_CONFLICT_DECISION';
   else if(list.length===2&&present.length===1)status='OPTIONAL_ALIAS_ABSENT';
   const contract=validation.domains.find(r=>r.domain===domain);
   if(['SOURCE_AVAILABLE','OPTIONAL_ALIAS_ABSENT'].includes(status)&&['INVALID_SCHEMA','BLOCKED'].includes(contract.status))status='SCHEMA_DECISION_REQUIRED';
   return {domain,keys:list.map(s=>s.key),status,contract};
  });
  return {sources,materials:material,materialsComparison:compareRecords(sources.materials[0].value,sources.materials[1].value,c),labor,laborComparison:compareRecords(sources.labor[0].value,sources.labor[1].value,c),domains};
 };
 const local=layer(originals),active=layer(image);
 const schemaDecisions=layer=>layer.materials.flatMap(src=>(src.records||[]).filter(r=>r.missingRequired.length||r.unknownFields.length||r.catalogKind==='HISTORICAL_ACCESSORY').map(r=>({key:src.key,index:r.index,missing:r.missingRequired,unknown:r.unknownFields,kind:r.catalogKind})));
 const validationDecisions=layer=>layer.domains.filter(d=>['INVALID_JSON','INVALID_SCHEMA','UNREADABLE','BLOCKED'].includes(d.contract.status)||['INVALID','BLOCKED','RUNTIME_REQUIRED'].includes(d.contract.validation.status));
 return {scope:'PRIVATE_LOCAL_ONLY',local,active,comparison:diagnostics.compare(key=>originals[key]??null,key=>image[key]??null),plan:{status:'REPAIR_BLOCKED',executeAvailable:false,
  originalBytesRetained:true,allIdbStoresRetained:true,automaticMerge:false,factoryInitialization:false,
  schemaDecisions:{local:schemaDecisions(local),active:schemaDecisions(active)},
  ownerDecisions:{local:local.domains.filter(d=>['OWNER_CONFLICT_DECISION','FORMAT_DECISION_REQUIRED'].includes(d.status)),active:active.domains.filter(d=>['OWNER_CONFLICT_DECISION','FORMAT_DECISION_REQUIRED'].includes(d.status))},
  initialization:{local:local.domains.filter(d=>d.status==='CONTROLLED_INITIALIZATION_REQUIRED'),active:active.domains.filter(d=>d.status==='CONTROLLED_INITIALIZATION_REQUIRED')},
  validationDecisions:{local:validationDecisions(local),active:validationDecisions(active)},
  prerequisites:['VERIFIED_PRIVATE_FILE','EXPLICIT_FIELD_AND_RECORD_DECISIONS','PRESERVE_UNKNOWN_AND_HISTORICAL_RAW','FULL_VALIDATE_BUNDLE_AND_RUNTIME_BINDINGS','RESOLVE_UNCERTAIN_ACK_WITHOUT_RETRY','SINGLE_WRITER_AND_QUIESCENT_RAM','ATOMIC_IMAGE_AND_OUTBOX_CAS','RECEIPT_SOURCE_PROOF','RESTART_OFFLINE_AND_ROLLBACK_PROOF','SEPARATE_WRITE_APPROVAL']}};
}
export function simulateRescueCandidate(candidate,c){
 boundedJson(candidate);const before=boundedJson(candidate);let result;
 try{const validation=c.validateBundle(candidate);result={status:'VALIDATION_ONLY',writeApproved:false,unresolvedRuntimeDependencies:validation.dependencies.length>0};}
 catch(error){result={status:'INVALID_CANDIDATE',writeApproved:false,code:/^GLOBAL_[A-Z_]+$/.test(error?.code||'')?error.code:'GLOBAL_VALUE_INVALID'};}
 if(before!==boundedJson(candidate))refuse('RESCUE_SOURCE_CHANGED');return result;
}

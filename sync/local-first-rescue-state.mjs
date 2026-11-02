// Private snapshot validation only; never opens, repairs or writes a database.
import {digest,json,equal} from './local-first-values.mjs';
export class RescueFailure extends Error{constructor(code){super(code);this.code=code;}}
export const refuse=code=>{throw new RescueFailure(code);};
export function boundedJson(value){
 let units=0,nodes=0;const ancestors=new Set();
 function visit(v){
  if(++nodes>250000)refuse('RESCUE_SIZE_LIMIT');
  if(typeof v==='string'){units+=v.length*6+2;if(units>32*1024*1024)refuse('RESCUE_SIZE_LIMIT');return;}
  if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return;
  if(!v||typeof v!=='object'||ancestors.has(v)||!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype)refuse('RESCUE_UNSUPPORTED_VALUE');
  ancestors.add(v);for(const [k,item]of Object.entries(v)){units+=k.length*6+8;visit(item);}ancestors.delete(v);
  if(Array.isArray(v)&&Object.keys(v).length!==v.length)refuse('RESCUE_UNSUPPORTED_VALUE');
 }
 visit(value);return json(value);
}
export async function validateAuthority(stores,receipt,nativeRows,activationId){
 boundedJson(stores);
 if(!stores||Object.keys(stores).sort().join(',')!=='control,outbox,protected,replicas'||Object.values(stores).some(v=>!Array.isArray(v)))refuse('RESCUE_SCHEMA_INVALID');
 const unique=(rows,key)=>{const values=rows.map(r=>r?.[key]);if(values.some(k=>typeof k!=='string'||!k)||new Set(values).size!==values.length)refuse('RESCUE_RECORD_INVALID');};
 for(const rows of Object.values(stores))unique(rows,'key');
 const byKey=new Map(stores.control.map(r=>[r.key,r]));
 if(stores.control.length!==3||!equal(byKey.get('binding'),{key:'binding',version:1,ownerUid:receipt.ownerUid,deviceId:receipt.deviceId,instanceId:receipt.instanceId}))refuse('RESCUE_BINDING_INVALID');
 const source=byKey.get('source'),image=byKey.get('application');
 const rowsValid=rows=>rows&&typeof rows==='object'&&!Array.isArray(rows)&&Object.values(rows).every(v=>v===null||typeof v==='string');
 if(!source||source.version!==1||!rowsValid(source.rows)||source.hash!==receipt.sourceHash||activationId&&source.activationId!==activationId||await digest(source.rows)!==source.hash)refuse('RESCUE_SOURCE_INTEGRITY');
 for(const [key,raw]of Object.entries(source.rows))if((nativeRows[key]??null)!==raw)refuse('RESCUE_SOURCE_CHANGED');
 if(!image||!Number.isSafeInteger(image.version)||image.version<1||!rowsValid(image.rows)||await digest(json(image.rows))!==image.hash)refuse('RESCUE_IMAGE_INTEGRITY');
 for(const group of ['replicas','outbox','protected'])for(const row of stores[group]){
  if(group==='replicas'&&row.version===0&&row.json==='null'&&row.hash===null)continue;
  if(typeof row.json!=='string'||await digest(row.json)!==row.hash)refuse('RESCUE_RECORD_INTEGRITY');
  try{if(json(JSON.parse(row.json))!==row.json)refuse('RESCUE_RECORD_INTEGRITY');}catch(_){refuse('RESCUE_RECORD_INTEGRITY');}
 }
 for(const op of stores.outbox){
  if(!['queued','inflight','uncertain','verified','blocked','conflict'].includes(op.phase))refuse('RESCUE_ACK_INVALID');
  if(['inflight','uncertain','verified'].includes(op.phase)&&!op.expected||op.phase==='verified'&&!equal(op.receipt,op.expected))refuse('RESCUE_ACK_INVALID');
  if(!stores.protected.some(p=>p.key===op.key&&p.scope===op.scope))refuse('RESCUE_PROTECTION_MISSING');
 }
 return true;
}
export async function rescueManifest(data,hash){
 boundedJson(data);const entries=[];
 for(const scope of ['local','session'])for(const row of data[scope].rows)entries.push({scope,key:row.key,sha256:await hash(row.raw)});
 for(const [database,stores]of Object.entries(data.databases))for(const [store,rows]of Object.entries(stores))for(let i=0;i<rows.length;i++)entries.push({database,store,index:i,sha256:await hash(boundedJson(rows[i]))});
 return {version:1,scope:'CURRENT_DOCUMENT_NATIVE_AND_LOCAL_FIRST',entries,ramHash:await hash(boundedJson(data.ram)),dataHash:await hash(boundedJson(data)),
  completeWithinScope:true,otherTabsRam:false,entireHeap:false,cloudBackupConfirmed:false,authorizationRestorable:false,ramIsCommitProof:false};
}
export async function validateArchive(archive,native,f){
 const {control,records,sources}=archive,state=control[0],source=sources[0],route=native.meble_backup_archive_backend_v1??null;
 const marker='{"v":1,"backend":"indexeddb"}';
 if(control.length>1||sources.length>1||control.length!==sources.length||!state&&(records.length||route!==null))refuse('RESCUE_ARCHIVE_INTEGRITY');
 if(route!==null&&route!==marker||['COPIED','CANCELLED'].includes(state?.phase)&&route!==null)refuse('RESCUE_ARCHIVE_INTEGRITY');
 if(state&&(state.key!=='archive'||state.schema!==1||!['INITIALIZING','COPIED','CANCELLED','SWITCH_PENDING','ACTIVE'].includes(state.phase)
  ||!Number.isSafeInteger(state.revision)||state.revision<0||!Number.isSafeInteger(state.count)||state.count<0||state.count!==records.length
  ||typeof source.raw!=='string'||state.sourceHash!==source.sha256||await f.hash(source.raw)!==source.sha256
  ||state.phase==='ACTIVE'&&route!==marker||state.phase==='INITIALIZING'&&(state.origin!=='fresh'||source.raw!=='[]'||records.length)))refuse('RESCUE_ARCHIVE_INTEGRITY');
 try{
  const decoded=await f.decode(records);
  if(state){const original=f.parse(source.raw);
   if(state.phase!=='ACTIVE'){
    const sort=rows=>rows.slice().sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    if(!equal(sort(original),sort(decoded)))refuse('RESCUE_ARCHIVE_INTEGRITY');
    const fragments=f.rawRecords(source.raw),byId=new Map(records.map(r=>[r.id,r.raw]));
    if(original.some((row,i)=>byId.get(row.id)!==fragments[i]))refuse('RESCUE_ARCHIVE_INTEGRITY');
   }
  }
 }catch(_){refuse('RESCUE_ARCHIVE_INTEGRITY');}
}

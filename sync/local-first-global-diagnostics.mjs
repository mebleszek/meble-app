// Existing authority only. No initialization, recovery, setters or cloud access.
import {assertApplicationRelease} from './application-release.mjs';
import {applicationKeys} from './application-authority.mjs';
import {digest,json,equal,id} from './local-first-values.mjs';
const RECEIPT='meble_application_authority_v1';
class Refusal{constructor(code){this.code=code;}}
const refuse=code=>{throw new Refusal(code);};
export async function collectGlobalDiagnostics({window:w,ownerUid,name,readNative,authorize,release}={}){
 const d=w.FC.globalDataDiagnostics;
 let originals=d.blocked('DIAG_CONTEXT_BLOCKED'),expired=false,timer;const connections=new Set(),transactions=new Set();
 const blocked=code=>d.sanitize({status:'BLOCKED',code,originals,localFirst:d.blocked(code),comparison:d.blocked(code)});
 const gate=()=>{
  if(expired)refuse('DIAG_TIMEOUT');
  try{
   const descriptor=Object.getOwnPropertyDescriptor(w,'__FC_MAIN_ACCESS__');
   if(!descriptor||descriptor.writable!==false||descriptor.configurable!==false||descriptor.value.isValid()!==true)throw Error();
   descriptor.value.assert();authorize();
  }catch(_){refuse('DIAG_AUTH_BLOCKED');}
 };
 const close=()=>{for(const tx of transactions)try{tx.abort();}catch(_){}for(const db of connections)db.close();};
 async function work(){
  if(typeof readNative!=='function'||typeof authorize!=='function')refuse('DIAG_CONTEXT_BLOCKED');
  gate();
  if(release){try{assertApplicationRelease(release,{ownerUid,name,window:w});}catch(_){refuse('DIAG_RELEASE_BLOCKED');}}
  else if(!['localhost','127.0.0.1'].includes(w.location.hostname)||!/^meble-lf-test-[a-zA-Z0-9_-]{1,100}$/.test(name||''))refuse('DIAG_RELEASE_BLOCKED');
  const keys=d.rawKeys(),source=new Map();
  const read=key=>{const v=source.get(key);if(v?.failed)throw Error();return v?.raw??null;};
  for(const key of keys){gate();try{source.set(key,{raw:readNative(key)});}catch(_){source.set(key,{failed:true});}}
  originals=d.inspect(read);gate();
  // No DB discovery/open before this authenticated profile's receipt proves
  // the exact target. Do not infer identity from a database name or first row.
  let receiptRaw,binding;
  try{receiptRaw=readNative(RECEIPT);binding=JSON.parse(receiptRaw);}catch(_){refuse('DIAG_RECEIPT_INVALID');}
  if(!binding||binding.version!==1||binding.name!==name||typeof binding.sourceHash!=='string'||!(/^[a-f0-9]{64}$/).test(binding.sourceHash))refuse('DIAG_RECEIPT_INVALID');
  if(binding.ownerUid!==ownerUid)refuse('DIAG_OWNER_BLOCKED');
  try{id(ownerUid);id(binding.deviceId);id(binding.instanceId);}catch(_){refuse('DIAG_BINDING_INVALID');}
  if(release&&binding.activationId!==assertApplicationRelease(release).activationId)refuse('DIAG_RELEASE_BLOCKED');
  if(typeof w.indexedDB?.databases!=='function')refuse('DIAG_IDB_UNAVAILABLE');
  let names;try{names=await w.indexedDB.databases();}catch(_){refuse('DIAG_IDB_UNAVAILABLE');}gate();
  const existing=names.find(row=>row.name===name);
  if(!existing)refuse('DIAG_IDB_MISSING');if(existing.version!==1)refuse('DIAG_IDB_SCHEMA');
  async function state(){
   gate();const db=await new Promise((resolve,reject)=>{
    let request;
    try{request=w.indexedDB.open(name,1);}catch(_){reject(new Refusal('DIAG_IDB_UNAVAILABLE'));return;}
    request.onupgradeneeded=()=>{request.transaction.abort();}; // Race with deletion: never create a database.
    request.onblocked=request.onerror=()=>reject(new Refusal('DIAG_IDB_UNAVAILABLE'));
    request.onsuccess=()=>{
     const db=request.result;
     if(expired){db.close();reject(new Refusal('DIAG_TIMEOUT'));return;}
     connections.add(db);db.onversionchange=()=>db.close();resolve(db);
    };
   });
   try{
    gate();if(!equal([...db.objectStoreNames].sort(),['control','outbox','protected','replicas']))refuse('DIAG_IDB_SCHEMA');
    return await new Promise((resolve,reject)=>{
     let tx,value,failure;
     const stop=code=>{failure=new Refusal(code);try{tx.abort();}catch(_){};};
     try{tx=db.transaction(['control'],'readonly');}catch(_){reject(new Refusal('DIAG_IDB_UNAVAILABLE'));return;}
     transactions.add(tx);tx.onabort=()=>{transactions.delete(tx);reject(failure||new Refusal('DIAG_IDB_UNAVAILABLE'));};tx.onerror=()=>{};
     tx.oncomplete=()=>{transactions.delete(tx);resolve(value);};
     const store=tx.objectStore('control'),q=store.get('binding');
     q.onsuccess=()=>{
      try{gate();}catch(_){stop('DIAG_AUTH_BLOCKED');return;}
      if(!equal(q.result,{key:'binding',ownerUid,deviceId:binding.deviceId,instanceId:binding.instanceId,version:1})){stop('DIAG_BINDING_INVALID');return;}
      const a=store.get('source'),b=store.get('application');
      b.onsuccess=()=>{value={source:a.result,image:b.result};};
     };
    });
   }finally{db.close();connections.delete(db);}
  }
  const first=await state();gate();
  const preserved=first.source,image=first.image,allowed=new Set(applicationKeys(w.FC));
  const rowsValid=rows=>{
   if(!rows||typeof rows!=='object'||Array.isArray(rows)||Object.keys(rows).some(k=>!allowed.has(k))||Object.values(rows).some(v=>v!==null&&typeof v!=='string'))return false;
   let units=0;for(const value of Object.values(rows))if(typeof value==='string'){
    units+=value.length;if(value.length>8*1024*1024||units>16*1024*1024)refuse('DIAG_TOO_LARGE');
   }return true;
  };
  if(!preserved||preserved.key!=='source'||preserved.version!==1||!rowsValid(preserved.rows)||preserved.hash!==binding.sourceHash)refuse('DIAG_SOURCE_INTEGRITY');
  if(release&&preserved.activationId!==binding.activationId)refuse('DIAG_SOURCE_INTEGRITY');
  if(await digest(preserved.rows)!==preserved.hash)refuse('DIAG_SOURCE_INTEGRITY');gate();
  for(const key of keys){if(!Object.hasOwn(preserved.rows,key))refuse('DIAG_SOURCE_INTEGRITY');if(read(key)!==preserved.rows[key])refuse('GLOBAL_SOURCE_CHANGED');}
  if(!image)refuse('DIAG_IMAGE_MISSING');
  if(image.key!=='application'||!Number.isSafeInteger(image.version)||image.version<1||!rowsValid(image.rows)||await digest(json(image.rows))!==image.hash)refuse('DIAG_IMAGE_INTEGRITY');gate();
  const imageRead=key=>image.rows[key]??null;
  const localFirst=d.inspect(imageRead),comparison=d.compare(read,imageRead);
  // These are observations, not a cross-store transaction or an ABA proof.
  // Reject a witnessed change; no attempt to lock, reconcile or restart writers.
  const second=await state();gate();
  if(!equal(first,second))refuse('DIAG_IMAGE_CHANGED');
  for(const key of keys){gate();let raw;try{raw=readNative(key);}catch(_){refuse('GLOBAL_STORAGE_UNAVAILABLE');}if(raw!==read(key))refuse('GLOBAL_SOURCE_CHANGED');}
  if(readNative(RECEIPT)!==receiptRaw)refuse('DIAG_RECEIPT_INVALID');gate();
  return d.sanitize({status:'READ_ONLY',code:'NONE',originals,localFirst,comparison});
 }
 try{
  return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;close();reject(new Refusal('DIAG_TIMEOUT'));},10000);})]);
 }catch(error){
  const code=error instanceof Refusal?error.code:'DIAG_READ_BLOCKED';
  if(code==='DIAG_AUTH_BLOCKED')originals=d.blocked(code);
  return blocked(code);
 }finally{expired=true;clearTimeout(timer);close();}
}

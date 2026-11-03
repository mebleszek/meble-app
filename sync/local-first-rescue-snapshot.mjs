// Existing databases and native originals only. No migration/restore entry.
import {assertApplicationRelease} from './application-release.mjs';
import {verifyExclusiveClient} from './application-installation.mjs';
import {id,equal} from './local-first-values.mjs';
import {boundedJson,validateAuthority,validateArchive,refuse,RescueFailure} from './local-first-rescue-state.mjs';
import {assertRescueReadAccess} from './local-first-rescue-access.mjs';
const RECEIPT='meble_application_authority_v1',ARCHIVE='meble-business-backups-v1',ROUTE='meble_backup_archive_backend_v1';
const aliases=new Set(['hardwareSuppliers','hardwareSettings','hardwareCategories','hardwareTypes','hardwareTechnicalParams']);
// Existing writer-fence coordination is retained, like owner/Auth metadata.
const authNames=new Set(['meble-application-writer-fence-v1','meble-access-profile-v1','meble-device-trust-v1','firebaseLocalStorageDb','firebase-heartbeat-database','firebase-installations-database']);
const authKey=k=>/^firebase[:_]/.test(k)||/^meble_access_profile_(?:v1|pending_v1)$/.test(k)||k==='meble_device_trust_fence_v1';
export async function readRescueSnapshot({window:w,name,ownerUid,readNative,readSession,authorize,verifyOwner,release,readRam,assertQuiescent,allowMissingRam=false}={}){
 let expired=false,timer;const opened=new Set(),transactions=new Set();
 const access=()=>{if(expired)refuse('RESCUE_TIMEOUT');try{
  assertRescueReadAccess(w);authorize();assertQuiescent();
 }catch(_){refuse('RESCUE_AUTH_OR_BUSY');}};
 const close=()=>{for(const tx of transactions)try{tx.abort();}catch(_){}for(const db of opened)db.close();};
 function storage(storage,get){
  access();const names=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(typeof key!=='string'||names.includes(key))refuse('RESCUE_STORAGE_INCOMPLETE');names.push(key);}names.sort();
  const rows=[],omitted=[];let units=0;
  for(const key of names){access();if(authKey(key)){omitted.push('AUTH_LOCAL_ONLY');continue;}
   if(!key.startsWith('fc_')&&!aliases.has(key)&&![RECEIPT,ROUTE,'meble_local_reset_v1'].includes(key))refuse('RESCUE_UNKNOWN_STORAGE');
   let raw;try{raw=get(key);}catch(_){refuse('RESCUE_STORAGE_UNAVAILABLE');}if(typeof raw!=='string')refuse('RESCUE_STORAGE_INCOMPLETE');units+=raw.length;
   if(units>8*1024*1024)refuse('RESCUE_SIZE_LIMIT');rows.push({key,raw});
  }
  if(storage.length!==names.length)refuse('RESCUE_SOURCE_CHANGED');return {rows,omitted};
 }
 function current(){
  const local=storage(w.localStorage,readNative),session=storage(w.sessionStorage,readSession||(k=>w.sessionStorage.getItem(k)));
  let ram;try{ram=readRam();}catch(_){if(!allowMissingRam)refuse('RESCUE_RAM_UNAVAILABLE');}
  if(ram?.available!==true||ram.scope!=='CURRENT_DOCUMENT_KNOWN_BUSINESS_RAM'||!ram.data||typeof ram.data!=='object'){
   if(!allowMissingRam)refuse('RESCUE_RAM_UNAVAILABLE');ram={available:false,scope:'CURRENT_DOCUMENT_KNOWN_BUSINESS_RAM',data:null};
  }
  boundedJson(ram);access();return {local,session,ram:JSON.parse(boundedJson(ram))};
 }
 async function database(name,tables,expectedBinding){
  access();const db=await new Promise((resolve,reject)=>{
   let q;try{q=w.indexedDB.open(name,1);}catch(_){reject(new RescueFailure('RESCUE_IDB_UNAVAILABLE'));return;}
   q.onupgradeneeded=()=>q.transaction.abort();q.onerror=q.onblocked=()=>reject(new RescueFailure('RESCUE_IDB_UNAVAILABLE'));
   q.onsuccess=()=>{const db=q.result;if(expired){db.close();reject(new RescueFailure('RESCUE_TIMEOUT'));return;}opened.add(db);db.onversionchange=()=>db.close();resolve(db);};
  });
  try{
   access();if(!equal([...db.objectStoreNames].sort(),[...tables].sort()))refuse('RESCUE_SCHEMA_INVALID');
   return await new Promise((resolve,reject)=>{
    let tx,failure;try{tx=db.transaction(tables,'readonly');}catch(_){reject(new RescueFailure('RESCUE_IDB_UNAVAILABLE'));return;}
    const result={};transactions.add(tx);tx.oncomplete=()=>{transactions.delete(tx);resolve(result);};tx.onabort=()=>{transactions.delete(tx);reject(failure||new RescueFailure('RESCUE_IDB_UNAVAILABLE'));};tx.onerror=()=>{};
    const abort=code=>{failure=new RescueFailure(code);tx.abort();};
    const all=()=>{try{access();for(const table of tables){const q=tx.objectStore(table).getAll();q.onsuccess=()=>{result[table]=q.result;};}}catch(_){abort('RESCUE_AUTH_OR_BUSY');}};
    if(expectedBinding){const q=tx.objectStore('control').get('binding');q.onsuccess=()=>{if(!equal(q.result,expectedBinding)){abort('RESCUE_BINDING_INVALID');return;}all();};}else all();
   });
  }finally{db.close();opened.delete(db);}
 }
 async function work(){
  if([readNative,authorize,readRam,assertQuiescent].some(f=>typeof f!=='function'))refuse('RESCUE_CONTEXT_REQUIRED');access();
  if(verifyOwner)await verifyOwner();access();
  if(release){try{assertApplicationRelease(release,{ownerUid,name,window:w});}catch(_){refuse('RESCUE_RELEASE_INVALID');}}
  else if(!['localhost','127.0.0.1'].includes(w.location.hostname)||!/^meble-lf-test-[A-Za-z0-9_-]{1,100}$/.test(name||''))refuse('RESCUE_RELEASE_INVALID');
  try{await verifyExclusiveClient(w);}catch(_){refuse('RESCUE_OTHER_CLIENT');}access();
  const first=current(),native=Object.fromEntries(first.local.rows.map(r=>[r.key,r.raw]));let receipt;
  try{receipt=JSON.parse(native[RECEIPT]);id(ownerUid);id(receipt.deviceId);id(receipt.instanceId);}catch(_){refuse('RESCUE_RECEIPT_INVALID');}
  if(receipt.version!==1||receipt.name!==name||receipt.ownerUid!==ownerUid||!/^[a-f0-9]{64}$/.test(receipt.sourceHash||''))refuse('RESCUE_RECEIPT_INVALID');
  const activation=release?assertApplicationRelease(release).activationId:null;if(activation&&receipt.activationId!==activation)refuse('RESCUE_RELEASE_INVALID');
  if(typeof w.indexedDB?.databases!=='function')refuse('RESCUE_IDB_INVENTORY');
  const inventory=async()=>{const rows=await w.indexedDB.databases();access();if(rows.some(d=>!authNames.has(d.name)&&![name,ARCHIVE].includes(d.name)))refuse('RESCUE_UNKNOWN_DATABASE');return rows.filter(d=>!authNames.has(d.name)).sort((a,b)=>a.name.localeCompare(b.name));};
  const names=await inventory();if(!names.some(d=>d.name===name)||names.some(d=>d.version!==1))refuse('RESCUE_IDB_MISSING_OR_SCHEMA');
  const binding={key:'binding',version:1,ownerUid,deviceId:receipt.deviceId,instanceId:receipt.instanceId};
  const capture=async()=>{
   const authority=await database(name,['control','protected','replicas','outbox'],binding);access();await validateAuthority(authority,receipt,native,activation);access();
   const databases={authority};
   if(names.some(d=>d.name===ARCHIVE)){
    const archive=await database(ARCHIVE,['control','records','sources']);
    await validateArchive(archive,native,w.FC.backupArchiveFormat);databases.archive=archive;
   }else if(native[ROUTE]!=null)refuse('RESCUE_ARCHIVE_INTEGRITY');
   return databases;
  };
  const databases=await capture();boundedJson(databases);const second=await capture();
  if(!equal(databases,second)||!equal(names,await inventory())||!equal(first,current()))refuse('RESCUE_SOURCE_CHANGED');
  try{await verifyExclusiveClient(w);}catch(_){refuse('RESCUE_OTHER_CLIENT');}access();
  if(verifyOwner)await verifyOwner();access();
  return {version:1,local:first.local,session:first.session,ram:first.ram,databases,identity:{receipt,activationId:activation},
   limitations:{otherTabsRam:false,entireHeap:false,cloudBackupConfirmed:false,authorizationRestorable:false,scope:'CURRENT_DOCUMENT_NATIVE_AND_LOCAL_FIRST'}};
 }
 try{return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;close();reject(new RescueFailure('RESCUE_TIMEOUT'));},15000);})]);}
 catch(error){throw error instanceof RescueFailure?error:new RescueFailure('RESCUE_READ_BLOCKED');}
 finally{expired=true;clearTimeout(timer);close();}
}

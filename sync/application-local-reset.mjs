// Explicit destruction of this application's local test data only. No transport.
import {applicationKeys} from './application-authority.mjs';
import {INSTALL_KEY} from './application-installation.mjs';
import {assertApplicationRelease} from './application-release.mjs';
import {readLocalResetSnapshot} from './local-first-rescue-snapshot.mjs';
import {assertRescueReadAccess} from './local-first-rescue-access.mjs';
import {readCurrentBusinessRam} from './local-first-rescue-ram.mjs';
import {digest,equal,fail,id} from './local-first-values.mjs';
export const RESET_KEY='meble_local_reset_v1';
export function localResetState(w,ownerUid,name){
 const raw=w.localStorage.getItem(RESET_KEY);if(raw===null)return null;
 let value;try{value=JSON.parse(raw);}catch(_){fail('LF_LOCAL_RESET_INVALID');}
 if(value?.version!==1||value.ownerUid!==ownerUid||value.name!==name||!['pending','cleared','used'].includes(value.state))fail('LF_LOCAL_RESET_INVALID');
 for(const b of [value.previous,value.next]){if(b?.ownerUid!==ownerUid||b.key!=='binding'||b.version!==1)fail('LF_LOCAL_RESET_INVALID');id(b.deviceId);id(b.instanceId);}
 return value;
}
export async function resetLocalTestData(context,native,consent){
 const {window:w,name,ownerUid,release,authorize,assertQuiescent,verifyOwner}=context;
 const event=consent?.event,target=event?.target?.closest?.('[data-local-test-reset]');
 if(consent?.confirmed!==true||!(event instanceof w.Event)||event.type!=='click'||event.isTrusted!==true||!target?.isConnected||!target.closest('[data-local-first-rescue]'))fail('LF_LOCAL_RESET_CONFIRMATION_REQUIRED');
 const guard=()=>{assertRescueReadAccess(w);authorize();assertQuiescent();};guard();await verifyOwner?.();guard();
 if(release)assertApplicationRelease(release,{ownerUid,name,window:w});
 else if(!['localhost','127.0.0.1'].includes(w.location.hostname)||!/^meble-lf-test-/.test(name))fail('LF_LOCAL_RESET_INVALID');
 const {codeCandidate}=await import('./code-global-catalogs.generated.mjs');w.FC.globalDataContract.validateBundle(codeCandidate.model);guard();
 let state=localResetState(w,ownerUid,name);
 if(state&&state.state!=='pending')fail('LF_LOCAL_RESET_ALREADY_USED');
 const write=value=>{native.set(RESET_KEY,JSON.stringify(value));if(native.get(RESET_KEY)!==JSON.stringify(value))fail('LF_LOCAL_RESET_UNCONFIRMED');};
 if(!state){
  // Reuse the owner/receipt/binding/integrity/inventory proof. A backup is not
  // required: the owner explicitly accepted loss of all these local test data.
  const snapshot=await readLocalResetSnapshot({...context,readRam:()=>readCurrentBusinessRam(w),allowMissingRam:true});guard();
  const previous=snapshot.databases.authority.control.find(r=>r.key==='binding');
  state={version:1,ownerUid,name,state:'pending',previous,next:{key:'binding',version:1,ownerUid,deviceId:w.crypto.randomUUID(),instanceId:w.crypto.randomUUID()},archive:!!snapshot.databases.archive};
  write(state); // Durable veto precedes the first destructive transaction.
 }
 async function clear(name,tables,binding){
  guard();const inventory=await w.indexedDB.databases();guard();
  if(!inventory.some(d=>d.name===name&&d.version===1))fail('LF_LOCAL_RESET_DATABASE_MISSING');
  const db=await new Promise((resolve,reject)=>{const q=w.indexedDB.open(name,1);let abandoned=false;
   const no=()=>{abandoned=true;reject(Error('LF_LOCAL_RESET_DATABASE_BLOCKED'));};
   q.onupgradeneeded=()=>q.transaction.abort();q.onerror=q.onblocked=no;
   q.onsuccess=()=>{if(abandoned){q.result.close();return;}resolve(q.result);};
  });
  try{
   guard();if(!equal([...db.objectStoreNames].sort(),[...tables].sort()))fail('LF_LOCAL_RESET_DATABASE_INVALID');
   await new Promise((resolve,reject)=>{
    const tx=db.transaction(tables,'readwrite',{durability:'strict'});let failure;
    const stop=e=>{failure=e;try{tx.abort();}catch(_){}};
    const timer=w.setTimeout(()=>stop(Error('LF_LOCAL_RESET_TIMEOUT')),8000);
    tx.oncomplete=()=>{clearTimeout(timer);resolve();};tx.onabort=()=>{clearTimeout(timer);reject(failure||Error('LF_LOCAL_RESET_ABORTED'));};tx.onerror=()=>{};
    const perform=()=>{try{guard();for(const table of tables)tx.objectStore(table).clear();if(binding)tx.objectStore('control').put(binding);}catch(e){stop(e);}};
    if(binding){const q=tx.objectStore('control').get('binding');q.onsuccess=()=>{if(!equal(q.result,state.previous)&&!equal(q.result,state.next)){stop(Error('LF_LOCAL_RESET_OWNER_CHANGED'));return;}perform();};}else perform();
   });guard();
  }finally{db.close();}
 }
 await clear(name,['control','replicas','protected','outbox'],state.next);
 if(state.archive)await clear('meble-business-backups-v1',['control','records','sources']);
 for(const storage of [w.localStorage,w.sessionStorage]){
  const keys=[];for(let i=0;i<storage.length;i++)keys.push(storage.key(i));
  for(const key of keys)if((/^(fc_)/.test(key)||['hardwareCategories','hardwareSettings','hardwareSuppliers','hardwareTechnicalParams', 'hardwareTypes',INSTALL_KEY,'meble_backup_archive_backend_v1'].includes(key))){guard();native.remove(storage,key);if(native.read(storage,key)!==null)fail('LF_LOCAL_RESET_UNCONFIRMED');}
 }
 guard();const receipt={version:1,name,ownerUid,deviceId:state.next.deviceId,instanceId:state.next.instanceId,sourceHash:await digest(Object.fromEntries(applicationKeys(w.FC).map(k=>[k,null])))};
 if(release)receipt.activationId=assertApplicationRelease(release).activationId;
 guard();native.set(INSTALL_KEY,JSON.stringify(receipt));if(native.get(INSTALL_KEY)!==JSON.stringify(receipt))fail('LF_LOCAL_RESET_UNCONFIRMED');
 state={...state,state:'cleared'};write(state);return {status:'RESET_COMPLETE',cloudConfirmed:false};
}

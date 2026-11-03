// TEST-ONLY executor. No product imports; actual loopback window and disposable
// test DB names are mandatory BEFORE any IDB call. Never usable on Android LIVE.
import {assertRescueBackupPlan} from '../../sync/local-first-rescue-file.mjs';
import {assertRescueReadAccess} from '../../sync/local-first-rescue-access.mjs';
import {json,digest,equal} from '../../sync/local-first-values.mjs';
import {verifyExclusiveClient} from '../../sync/application-installation.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});},tables=['control','replicas','protected','outbox'];
const clone=value=>structuredClone(value),ordered=data=>Object.fromEntries(tables.map(name=>[name,data[name].slice().sort((a,b)=>a.key.localeCompare(b.key,'en'))]));
function scope(w,name,uid){
 if(w!==globalThis.window||!['127.0.0.1','localhost'].includes(globalThis.location?.hostname)||!/^meble-lf-test-rebuild-[A-Za-z0-9_-]{1,80}$/.test(name||'')||!/^synthetic-[A-Za-z0-9_-]+$/.test(uid||''))fail('SYNTHETIC_REBUILD_ONLY');
 assertRescueReadAccess(w);
}
async function open(w,name){
 const inventory=await w.indexedDB.databases();if(!inventory.some(d=>d.name===name&&d.version===1))fail('SYNTHETIC_DATABASE_MISSING');
 return new Promise((resolve,reject)=>{const q=w.indexedDB.open(name,1);q.onupgradeneeded=()=>q.transaction.abort();q.onerror=q.onblocked=()=>reject(Error('SYNTHETIC_DATABASE_BLOCKED'));q.onsuccess=()=>{const db=q.result;if(!equal([...db.objectStoreNames].sort(),[...tables].sort())){db.close();reject(Error('SYNTHETIC_SCHEMA'));return;}resolve(db);};});
}
async function read(db){return new Promise((resolve,reject)=>{const tx=db.transaction(tables,'readonly'),data={};tx.oncomplete=()=>resolve(ordered(data));tx.onabort=()=>reject(Error('SYNTHETIC_READ_ABORTED'));for(const name of tables){const q=tx.objectStore(name).getAll();q.onsuccess=()=>{data[name]=q.result;};}});}
function binding(data){return data.control.find(r=>r.key==='binding');}
async function payload(value){const encoded=json(value);return {json:encoded,hash:await digest(encoded)};}
async function resolved(data,probe){
 const next=clone(data);
 for(const op of next.outbox){
  if(op.phase==='verified'){if(!op.expected||!equal(op.receipt,op.expected))fail('SYNTHETIC_ACK_INVALID');continue;}
  if(!['uncertain','inflight'].includes(op.phase)||typeof probe!=='function')fail('SYNTHETIC_ACK_UNRESOLVED');
  // Synthetic independent reader only. There is deliberately no publish/retry.
  const receipt=await probe(clone(op));
  if(!op.expected||receipt?.operationId!==op.key||receipt.hash!==op.hash||receipt.json!==op.json||await digest(receipt.json)!==op.hash||!equal(receipt.head,op.expected))fail('SYNTHETIC_ACK_UNRESOLVED');
  op.phase='verified';op.receipt=clone(receipt.head);
  const replica=next.replicas.find(r=>r.key===op.scope);if(replica){replica.base=clone(op.receipt);if(replica.version===op.localVersion&&replica.hash===op.hash)replica.dirty=false;}
 }
 return next;
}
async function afterRebuild(journal){
 const next=clone(journal.resolved),application=next.control.find(r=>r.key==='application');
 application.rows=clone(journal.proposed.rows);application.hash=journal.proposed.hash;application.version++;
 const old=next.replicas.find(r=>r.key==='globals'),value=journal.model,encoded=await payload(value),version=(old?.version||0)+1;
 const replica={key:'globals',version,...encoded,base:old?.base||null,editor:old?.editor||null,dirty:true};
 next.replicas=next.replicas.filter(r=>r.key!=='globals').concat(replica);
 next.outbox.push({key:journal.id,scope:'globals',localVersion:version,...encoded,base:replica.base,previousOperation:next.outbox.filter(r=>r.scope==='globals').at(-1)?.key||null,
  applicationHash:application.hash,editor:replica.editor,phase:'blocked',blockers:['LF_SEPARATE_ACTIVATION_REQUIRED'],expected:null});
 next.protected.push({key:journal.id,scope:'globals',...await payload(journal)});return ordered(next);
}
async function swap(w,db,expected,next,check){
 check();return new Promise((resolve,reject)=>{
  let failure;const tx=db.transaction(tables,'readwrite',{durability:'strict'}),actual={};let pending=tables.length;
  const abort=e=>{failure||=typeof e?.code==='string'?e.code:e?.name||'SYNTHETIC_ABORT';try{tx.abort();}catch(_){}};
  tx.onabort=()=>reject(Object.assign(Error(failure||tx.error?.name||'SYNTHETIC_ABORT'),{code:failure||tx.error?.name||'SYNTHETIC_ABORT'}));tx.onerror=()=>{};
  tx.oncomplete=()=>resolve(true);
  for(const name of tables){const q=tx.objectStore(name).getAll();q.onsuccess=()=>{actual[name]=q.result;if(--pending)return;
   try{
    check();if(!equal(ordered(actual),expected))fail('SYNTHETIC_CAS_CHANGED');
    if(!equal(binding(actual),binding(next))||!equal(actual.control.find(r=>r.key==='source'),next.control.find(r=>r.key==='source')))fail('SYNTHETIC_SOURCE_CHANGED');
    for(const table of tables){
     const store=tx.objectStore(table),keys=new Set(next[table].map(r=>r.key));
     // Existing ACK/protection records cannot be deleted by either direction.
     if(['protected','outbox'].includes(table)&&actual[table].some(r=>!keys.has(r.key)))fail('SYNTHETIC_HISTORY_DELETE');
     for(const row of next[table]){const write=store.put(row);write.onerror=()=>{failure||=write.error?.name||'SYNTHETIC_ABORT';};write.onsuccess=()=>{try{check();}catch(e){abort(e);}};}
    }
   }catch(e){abort(e);}
  };}
 });
}
async function locked({window:w,name,ownerUid},operation){
 scope(w,name,ownerUid);await verifyExclusiveClient(w);scope(w,name,ownerUid);
 return w.navigator.locks.request('meble-application-authority-v1',{ifAvailable:true},async lock=>{
  if(!lock)fail('SYNTHETIC_OTHER_WRITER');const db=await open(w,name);
  try{const data=await read(db),b=binding(data),access=w.__FC_RECOVERY_ACCESS__;if(b?.ownerUid!==ownerUid||access?.scope!=='LOCAL_FIRST_RESCUE_READ_ONLY_V1')fail('SYNTHETIC_OWNER');access.assert(ownerUid);
   let receipt;try{receipt=JSON.parse(access.readNative('meble_application_authority_v1'));}catch(_){fail('SYNTHETIC_RECEIPT');}
   const source=data.control.find(r=>r.key==='source');
   if(receipt.name!==name||receipt.ownerUid!==ownerUid||receipt.deviceId!==b.deviceId||receipt.instanceId!==b.instanceId||receipt.sourceHash!==source?.hash)fail('SYNTHETIC_RECEIPT');
   for(const [key,raw]of Object.entries(source.rows))if(access.readNative(key)!==raw)fail('SYNTHETIC_SOURCE_CHANGED');
   return await w.navigator.locks.request(name+':'+b.instanceId,{ifAvailable:true},held=>{if(!held)fail('SYNTHETIC_OTHER_WRITER');return operation(db,data,()=>scope(w,name,ownerUid));});
  }finally{db.close();}
 });
}
export async function executeSyntheticRebuild(options){
 scope(options.window,options.name,options.ownerUid);
 const backup=await assertRescueBackupPlan(options.plan,options.window);
 const approval=options.approval;
 if(approval?.scope!=='SYNTHETIC_REVIEW_V1'||approval.reviewedDifferences!==true||approval.preservePreimage!==true
  ||approval.snapshotHash!==options.plan.baseline.snapshotHash||approval.targetHash!==options.plan.proposedApplication.hash
  ||approval.sourceHash!==options.plan.candidateProvenance.sourceHash)fail('SYNTHETIC_REVIEW_REQUIRED');
 return locked(options,async(db,before,check)=>{
  if(!equal(before,ordered(options.plan.preservedPreimage.databases.authority)))fail('SYNTHETIC_CAS_CHANGED');
  const proposal=options.plan.proposedApplication;
  if(before.control.find(r=>r.key==='application').version!==proposal.expectedVersion||await digest(json(proposal.rows))!==proposal.hash)fail('SYNTHETIC_CAS_CHANGED');
  const c=options.window.FC.globalDataContract,model=c.capture({getItem:key=>proposal.rows[key]??null},Object.keys(c.sources)).model;c.validateBundle(model);
  const acknowledged=await resolved(before,options.readIndependentAck);check();
  const journal={kind:'SYNTHETIC_CODE_REBUILD_V1',id:'synthetic-rebuild-'+options.window.crypto.randomUUID(),before,resolved:acknowledged,
   proposed:clone(proposal),model:clone(model),backupFileHash:backup.fileHash,rolledBack:false};
  const after=await afterRebuild(journal);check();await swap(options.window,db,before,after,check);
  if(!equal(await read(db),after))fail('SYNTHETIC_READBACK_UNCONFIRMED');check();return {status:'SYNTHETIC_COMMITTED',journalId:journal.id,networkWrites:0,productionWriteApproved:false};
 });
}
export async function rollbackSyntheticRebuild(options){
 return locked(options,async(db,actual,check)=>{
  const record=actual.protected.find(r=>r.key===options.journalId);if(!record||await digest(record.json)!==record.hash)fail('SYNTHETIC_JOURNAL_MISSING');
  let journal;try{journal=JSON.parse(record.json);}catch(_){fail('SYNTHETIC_JOURNAL_INVALID');}
  if(journal.kind!=='SYNTHETIC_CODE_REBUILD_V1'||journal.rolledBack)fail('SYNTHETIC_JOURNAL_INVALID');
  const expected=await afterRebuild(journal);if(!equal(actual,expected))fail('SYNTHETIC_ROLLBACK_CHANGED_OR_ACKED');
  const next=clone(journal.resolved),image=next.control.find(r=>r.key==='application'),current=actual.control.find(r=>r.key==='application');image.version=current.version+1;
  for(const replica of next.replicas){const current=actual.replicas.find(r=>r.key===replica.key);replica.version=(current?.version||replica.version)+1;}
  // Keep the blocked rebuild op as audit evidence, never eligible for send.
  next.outbox.push(clone(actual.outbox.find(r=>r.key===journal.id)));
  journal.rolledBack=true;next.protected.push({key:journal.id,scope:'globals',...await payload(journal)});
  await swap(options.window,db,actual,ordered(next),check);
  if(!equal(await read(db),ordered(next)))fail('SYNTHETIC_READBACK_UNCONFIRMED');
  check();
  return {status:'SYNTHETIC_ROLLED_BACK',networkWrites:0,ackReplay:false,productionWriteApproved:false};
 });
}

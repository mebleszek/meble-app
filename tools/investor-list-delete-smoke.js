'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{MessageChannel}=require('node:worker_threads');
const {setup}=require('./investor-navigation-exit-smoke');
const {createSandbox,loadSmokeFiles}=require('./app-dev-smoke');
const P='fc_projects_v1',I='fc_investors_v1',H='fc_quote_snapshots_v1',D='fc_quote_offer_drafts_v1',M='fc_investor_removed_ids_v1',J='meble_investor_delete_journal_v1';
// Transaction model for fault/state regressions only. Native Chromium below
// verifies the real IDB strict transactions and persistent completion receipts.
function journalIDB(state={rows:new Map(),opened:false}){
 const api={state,strict:true,databases:async()=>state.opened?[{name:'meble-investor-delete-v1'}]:[],open(){
  state.opened=true;const request={};queueMicrotask(()=>{
   const db={objectStoreNames:{length:1,contains:name=>name==='operations'},createObjectStore(){},close(){},transaction(_store,mode,options){
    const staged=new Map(state.rows),tx={durability:api.strict?options?.durability:'relaxed',abort(){tx.aborted=true;queueMicrotask(()=>tx.onabort?.());},objectStore(){return {keyPath:'operationId',put(row){staged.set(row.operationId,structuredClone(row));},getAll(){const get={};queueMicrotask(()=>{if(tx.aborted)return;get.result=[...staged.values()].map(row=>structuredClone(row));get.onsuccess?.();queueMicrotask(()=>{if(tx.aborted)return;if(mode==='readwrite'){state.rows=staged;api.onCommit?.([...staged.values()]);}tx.oncomplete?.();});});return get;}};}};return tx;}};
   request.result=db;request.onupgradeneeded?.();request.onsuccess?.();
  });return request;}};return api;
}
function wire(r,{old=false,other=false,idb=[],durable}={}){
 const s=r.s||r;s.__FC_MAIN_ACCESS__={isValid:()=>true};s.MessageChannel=MessageChannel;s.URL=URL;
 let handler;
 const workerHandlers={};const self={MEBLE_OFFLINE_ASSETS:{files:[],version:'synthetic'},location:{href:'https://synthetic.invalid/offline-worker.js'},addEventListener:(name,fn)=>{workerHandlers[name]=fn;},clients:{matchAll:async()=>old?[{postMessage:(data,ports)=>{ports[0].postMessage({version:'old'});ports[0].close();}}]:[{postMessage:(data,ports)=>handler({data,ports})}]}};
 vm.runInNewContext(fs.readFileSync('offline-worker.js','utf8'),{self,importScripts(){},URL,MessageChannel,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto});
 const controller={scriptURL:'https://synthetic.invalid/offline-worker.js',postMessage(data,ports){workerHandlers.message({data,ports,waitUntil:promise=>promise.catch(e=>{throw e;})});}};
 s.document.baseURI='https://synthetic.invalid/index.html';s.navigator={locks:{request:async(_name,fn)=>fn()},serviceWorker:{controller,addEventListener:(_name,fn)=>{handler=fn;}}};
 const db=journalIDB(durable);s.__journalIDB=db;const list=db.databases;db.databases=async()=>[...await list(),...(other?[{name:'meble-local-first-v1'}]:idb)];s.indexedDB=db;s.FC.offlineShell={prepare:async()=>({complete:true})};

}
function ready(options){
 const r=setup({configureSandbox:s=>wire(s,options)});r.FC.investorProjectPatches.patchInvestorsAPI();r.FC.views.openInvestorsList();
 const projects=JSON.parse(r.storage.getItem(P)),investors=JSON.parse(r.storage.getItem(I));
 const third=structuredClone(projects[1]);third.id='R';third.investorId='T';third.projectData.meta.assignedInvestorId='T';third.future=9007199254740992;
 projects[1].projectData.meta.assignedInvestorId='K';projects.push(third);investors.push({id:'T',name:'Kept owner',rooms:[]});
 r.storage.setItem(P,JSON.stringify(projects).replace('"future":9007199254740992','"future":9007199254740993'));r.storage.setItem(I,JSON.stringify(investors));
 r.storage.setItem(H,JSON.stringify([{id:'a',investor:{id:'K'},project:{id:'P'},frozen:{total:21.375}},{id:'b',investor:{id:'N'},project:{id:'Q'}},{id:'legacy',investorId:'N'},{id:'kept',investor:{id:'T'},project:{id:'R'},frozen:{total:99.5}}]));
 r.storage.setItem(D,JSON.stringify([{projectId:'P',investorId:'K'},{projectId:'Q'},{projectId:'R',investorId:'T'}]));
 r.storage.setItem('fc_data_backups_v1',' [ { "id": "full-copy", "keys": {"fc_investors_v1":"ORIGINAL"} } ] ');
 r.storage.setItem('fc_project_backup_v1',' EXACT BACKUP ');r.storage.setItem('fc_quote_rates_v1',' [ {"price": 7.125 } ] ');
 r.s.document.baseURI='https://synthetic.invalid/index.html';return r;
}
async function main(){
 const r=ready(),before=r.seed(),token=await r.FC.investorDeletion.prepare(['K','N']);
 assert.deepEqual([token.investors,token.projects,token.offers,token.drafts],[2,2,3,2]);assert.equal(token.rooms,4);assert.equal(token.backups,2);
 assert.equal((await r.FC.investorDeletion.commit(token)).ok,true);
 assert.deepEqual(JSON.parse(r.storage.getItem(I)).map(i=>i.id),['T']);assert.deepEqual(JSON.parse(r.storage.getItem(P)).map(p=>p.id),['R']);
 assert.equal(r.storage.getItem(P).includes('9007199254740993'),true,'Retained numeric RAW must not be reserialized');
 assert.deepEqual(JSON.parse(r.storage.getItem(H)).map(h=>h.id),['kept']);assert.deepEqual(JSON.parse(r.storage.getItem(D)).map(d=>d.projectId),['R']);
 for(const key of ['fc_quote_rates_v1','fc_data_backups_v1','fc_project_backup_v1'])assert.equal(r.storage.getItem(key),before[key]);
 assert.equal(r.storage.getItem(J),null);assert.equal(r.storage.getItem('fc_current_project_id_v1'),null);
 assert.equal(r.s.projectData.meta?.assignedInvestorId,undefined);assert.equal(r.FC.investors.getById('K'),null);
 console.log('PASS complete batch removes owned investors/projects/offers/drafts, exact foreign numeric RAW, keeps global/backups, clears only deleted pointer/RAM');
 const cancelled=ready();cancelled.FC.confirmBox={ask:async cfg=>{assert.match(cfg.message,/Inwestorzy: 2/);assert.match(cfg.message,/Zapisane oferty \/ wyceny: 3/);assert.equal(cfg.cancelText,'Anuluj');return false;}};
 const original=cancelled.seed();assert.equal(await cancelled.handlers['remove-investor-from-list']({}),true);assert.equal(cancelled.FC.investorUI.state.deleteMode,true);
 cancelled.FC.investorUI.state.deleteIds=['K','N'];assert.equal(await cancelled.handlers['remove-investor-from-list']({}),true);assert.deepEqual(cancelled.seed(),original);
 cancelled.FC.investorUI.state.deleteIds=[];await cancelled.handlers['remove-investor-from-list']({});assert.equal(cancelled.FC.investorUI.state.deleteMode,false);
 assert.equal(cancelled.handlers['delete-investor'],undefined);
 console.log('PASS first/second minus, empty selection exit, batch preview and Cancel without writes; old action absent');
 for(const mode of ['auth','session','unknown','idb','owner','duplicate','legacy','pending','source','old-client']){
  const t=ready({old:mode==='old-client',other:mode==='idb'}),source=t.seed();
  if(mode==='auth')t.s.__FC_MAIN_ACCESS__.isValid=()=>false;
  if(mode==='session')t.storage.setItem('fc_edit_session_v1','{}');
  if(mode==='unknown')t.storage.setItem('fc_future_owned_records_v1','[]');
  if(mode==='owner'){const h=JSON.parse(t.storage.getItem(H));h[0].project.id='R';t.storage.setItem(H,JSON.stringify(h));}
  if(mode==='duplicate'){const a=JSON.parse(t.storage.getItem(P));a.push(a[0]);t.storage.setItem(P,JSON.stringify(a));}
  if(mode==='legacy')t.storage.setItem('fc_project_inv_N_v1','{"meta":{"assignedInvestorId":"T"}}');
  if(mode==='pending'){const a=JSON.parse(t.storage.getItem(P));a[0].meta={pendingDomainOperation:{}};t.storage.setItem(P,JSON.stringify(a));}
  const preparedSource=t.seed();let tx;
  try{tx=await t.FC.investorDeletion.prepare(['K','N']);if(mode==='source')t.storage.setItem(H,t.storage.getItem(H)+' ');await t.FC.investorDeletion.commit(tx);assert.fail(mode+' must refuse');}
  catch(error){assert.match(error.code||error.message,/^DELETE_/);}
  // Old-client denial leaves the already authorized intent, never mutations.
  assert.equal(t.storage.rows.get(P),preparedSource[P],mode);
  assert.equal(t.storage.rows.get(I),source[I],mode);
 }
 console.log('PASS 10 refusals: Auth/session, unknown store/IDB, conflicting refs/duplicate IDs/legacy owner, pending operation, changed source and old client');
 for(const key of [J,M,P,H,D,I,'remove:'+J]){
  const t=ready(),p=await t.FC.investorDeletion.prepare(['K','N']),original=t.seed();t.storage.fail.set(key,true);
  await assert.rejects(t.FC.investorDeletion.commit(p));
  if(key===J){assert.deepEqual(t.seed(),original);continue;}
  assert.ok(t.storage.rows.get(J));assert.throws(()=>t.storage.getItem(P),/DELETE_RECOVERY_REQUIRED/);
  t.storage.fail.clear();await t.FC.investorDeletion.resumePending();
  assert.equal(t.storage.getItem(J),null);assert.deepEqual(JSON.parse(t.storage.getItem(P)).map(p=>p.id),['R']);
 }
 console.log('PASS every controlled write/cleanup failure: no success, retained intent and fail-closed fence; approved operation resumes without replaying completed writes');
 for(const mode of ['false','noop']){
  const t=ready(),cap=await t.FC.investorDeletion.prepare(['K','N']);t.storage.fail.set(P,mode);
  await assert.rejects(t.FC.investorDeletion.commit(cap),/DELETE_WRITE_UNCONFIRMED/);assert.ok(t.storage.rows.get(J));
  t.storage.fail.clear();await t.FC.investorDeletion.resumePending();assert.equal(t.storage.getItem(J),null);
  assert.deepEqual(JSON.parse(t.storage.getItem(P)).map(row=>row.id),['R']);
 }
 const race=ready(),raceToken=await race.FC.investorDeletion.prepare(['K','N']);
 race.s.indexedDB.databases=async()=>{race.storage.setItem(H,race.storage.getItem(H)+' ');return [];};
 await assert.rejects(race.FC.investorDeletion.commit(raceToken),/DELETE_SOURCE_CHANGED/);
 assert.equal(race.storage.getItem(J),null);assert.equal(JSON.parse(race.storage.getItem(I)).length,3);
 const conflict=ready(),conflictToken=await conflict.FC.investorDeletion.prepare(['K','N']);conflict.storage.fail.set(H,true);
 await assert.rejects(conflict.FC.investorDeletion.commit(conflictToken));conflict.storage.fail.clear();
 conflict.storage.rows.set(P,'[]');const changed=Object.fromEntries(conflict.storage.rows);
 await assert.rejects(conflict.FC.investorDeletion.resumePending(),/DELETE_RECOVERY_CONFLICT/);
 assert.deepEqual(Object.fromEntries(conflict.storage.rows),changed);assert.ok(conflict.storage.rows.get(J));
 console.log('PASS silent/no-op writes, source changed during async inventory, conflicting recovery: no false success, overwrite or erased journal');
 const crashed=ready(),p=await crashed.FC.investorDeletion.prepare(['K','N']);crashed.storage.fail.set(H,true);await assert.rejects(crashed.FC.investorDeletion.commit(p));
 crashed.storage.rows.delete(J); // Simulated loss of localStorage hint: strict IDB intent survives.
 const seed=Object.fromEntries(crashed.storage.rows),s=createSandbox();s.Storage=crashed.s.Storage;s.localStorage=new s.Storage(seed);s.sessionStorage=new s.Storage();
 loadSmokeFiles(s,['js/app/shared/utils.js','js/app/shared/constants.js','js/app/shared/storage.js','js/app/shared/data-storage-classifier.js']);wire(s,{durable:crashed.s.__journalIDB.state});loadSmokeFiles(s,['js/app/investor/investor-deletion.js']);
 await s.FC.investorDeletion.resumePending();assert.equal(s.localStorage.getItem(J),null);assert.deepEqual(JSON.parse(s.localStorage.getItem(P)).map(p=>p.id),['R']);
 console.log('PASS fresh runtime recovery before business initialization, no restore from backup and no lost retained records');
 const strict=ready(),strictSource=strict.seed(),strictToken=await strict.FC.investorDeletion.prepare(['K','N']);strict.s.__journalIDB.strict=false;
 await assert.rejects(strict.FC.investorDeletion.commit(strictToken),/DELETE_STRICT_DURABILITY_REQUIRED/);
 assert.equal(strict.storage.rows.get(P),strictSource[P]);assert.equal(strict.storage.rows.get(I),strictSource[I]);assert.ok(strict.storage.rows.get(J));
 strict.s.__journalIDB.strict=true;await strict.FC.investorDeletion.resumePending();assert.equal(strict.storage.getItem(J),null);
 const receipt=[...strict.s.__journalIDB.state.rows.values()][0];assert.equal(receipt.state,'completed');
 strict.storage.rows.set(I,receipt.journal.before[I]);strict.storage.rows.delete(M); // Older persisted page after power loss.
 await strict.FC.investorDeletion.resumePending();assert.deepEqual(JSON.parse(strict.storage.getItem(I)).map(i=>i.id),['T']);
 const newInvestors=JSON.stringify([{id:'T',name:'New legitimate data',unknownAllowed:{value:1.125}}]);strict.storage.setItem(I,newInvestors);
 await strict.FC.investorDeletion.resumePending();assert.equal(strict.storage.getItem(I),newInvestors,'Completed receipt must never overwrite later legitimate edits');
 assert.throws(()=>strict.FC.investorDeletion.assertRestoreSafe({keys:receipt.journal.before}),/^Error: DELETE_RESTORE_/);
 assert.equal(strict.FC.investorDeletion.assertRestoreSafe({keys:receipt.journal.after}),true);
 const restoredBefore=strict.seed();assert.throws(()=>strict.FC.dataBackupSnapshotApply.applySnapshot({version:1,kind:'meble-app-storage-snapshot',keys:receipt.journal.before}),/DELETE_RESTORE_/);assert.deepEqual(strict.seed(),restoredBefore);
 strict.storage.rows.set(J,JSON.stringify({...receipt.journal,unexpected:'changed hint'}));const protectedLedger=JSON.stringify([...strict.s.__journalIDB.state.rows]);
 await assert.rejects(strict.FC.investorDeletion.resumePending(),/DELETE_RECOVERY_CONFLICT/);assert.equal(JSON.stringify([...strict.s.__journalIDB.state.rows]),protectedLedger);
 console.log('PASS strict-IDB refusal and completion receipt, missing localStorage hint/tombstone and lost target flush recover without undoing later edits');
 const revoked=ready(),revokedToken=await revoked.FC.investorDeletion.prepare(['K','N']);
 revoked.s.__journalIDB.onCommit=rows=>{if(rows.some(row=>row.state==='completed'))revoked.s.__FC_MAIN_ACCESS__.isValid=()=>false;};
 await assert.rejects(revoked.FC.investorDeletion.commit(revokedToken),/DELETE_ACCESS_DENIED/);assert.ok(revoked.storage.rows.get(J));
 const writes=revoked.storage.calls.filter(k=>[I,P,H,D].includes(k)).length;
 revoked.s.__journalIDB.onCommit=null;revoked.s.__FC_MAIN_ACCESS__.isValid=()=>true;await revoked.FC.investorDeletion.resumePending();
 assert.equal(revoked.storage.getItem(J),null);assert.equal(revoked.storage.calls.filter(k=>[I,P,H,D].includes(k)).length,writes);
 console.log('PASS logout during durable completion never reports success; reauthorized cleanup does not repeat active-data writes');
 const replay=ready(),cap=await replay.FC.investorDeletion.prepare(['N']);await replay.FC.investorDeletion.commit(cap);await assert.rejects(replay.FC.investorDeletion.commit(cap),/DELETE_TOKEN_INVALID/);
 const bar=replay.FC.investorActions.buildActionBarHtml({isEditing:true,dirty:true});assert.equal(bar.includes('data-investor-action="delete"'),false);assert.ok(bar.includes('data-investor-action="save"'));assert.ok(bar.includes('data-investor-action="cancel"'));
 console.log('PASS one-use consent, no detail deletion, unchanged Save/Cancel');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main,ready};

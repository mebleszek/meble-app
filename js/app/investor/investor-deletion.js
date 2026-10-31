// Confirmed, restart-recoverable deletion of explicitly owned local records.
// No SDK, migration, backup rewriting or inferred ownership from names.
(function(){
 'use strict';const FC=window.FC=window.FC||{};
 const DB='meble-investor-delete-v1',STORE='operations';
 const VERSION='20261031_investor_delete_v2',KEY='meble_investor_delete_journal_v1',LOCK='meble-investor-delete-v1';
 const I='fc_investors_v1',P='fc_projects_v1',H='fc_quote_snapshots_v1',D='fc_quote_offer_drafts_v1',M='fc_investor_removed_ids_v1';
 const CP='fc_current_project_id_v1',CI='fc_current_investor_v1',UI='fc_ui_v1',LEGACY='fc_project_v1';
 const ls=window.localStorage,proto=window.Storage?.prototype;
 const get=proto?.getItem||ls.getItem,set=proto?.setItem||ls.setItem,remove=proto?.removeItem||ls.removeItem;
 const raw=key=>get.call(ls,key),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),own=(o,k)=>Object.hasOwn(o||{},k);
 const fail=code=>{throw Object.assign(Error(code),{code});};
 const allowedKey=key=>[I,P,H,D,M,CP,CI,UI,LEGACY].includes(key)||/^fc_project_inv_.+_v1$/.test(key)&&!/_backup(?:_meta)?_v1$/.test(key);
 const business=key=>String(key).startsWith('fc_')||['hardwareSuppliers','hardwareCategories','hardwareTypes','hardwareTechnicalParams','hardwareSettings'].includes(key);
 const tokens=new WeakMap();let running=false,clientStatus=null,durableRecords=[];
 // Remove top-level array members without reserializing any retained record:
 // unknown fields, numeric lexemes and original per-record RAW stay exact.
 function retainRaw(text,keep){
  const start=text.indexOf('['),end=text.lastIndexOf(']'),parts=[];let from=start+1,depth=0,string=false,escape=false;
  for(let i=from;i<end;i++){const c=text[i];if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;continue;}
   if(c==='"')string=true;else if(c==='{'||c==='[')depth++;else if(c==='}'||c===']')depth--;else if(c===','&&depth===0){parts.push(text.slice(from,i));from=i+1;}}
  if(text.slice(from,end).trim())parts.push(text.slice(from,end));
  if(parts.length!==keep.length)fail('DELETE_ARRAY_SHAPE_CHANGED');
  return text.slice(0,start+1)+parts.filter((_,i)=>keep[i]).join(',')+text.slice(end);
 }
 function access(){if(window.__FC_MAIN_ACCESS__?.isValid()!==true)fail('DELETE_ACCESS_DENIED');}
 function idle(startup=false,fenced=false){
  access();if(FC.applicationSyncActions?.installed?.())fail('DELETE_LOCAL_FIRST_ACTIVE');
  if(raw('fc_edit_session_v1')!==null)fail('DELETE_SESSION_ACTIVE');
  if(!startup && (!FC.session || FC.session.active || FC.session.snapshot || FC.session.durable
   || !fenced&&FC.session.canSaveProject?.()!==true || FC.investorEditorState?.hasUiLock?.()
   || window.uiState?.entry!=='investorsList' || window.uiState.currentInvestorId || window.uiState.roomType
   || raw(CI)!==null))fail('DELETE_CONTEXT_PROTECTED');
  if(!startup&&!fenced&&FC.investorProjectRuntime?.hasProjectDivergence(window.projectData)!==false)fail('DELETE_RAM_PROTECTED');
 }
 function snapshot(){
  const names=[I,P,H,D,M,CP,CI,UI,LEGACY];
  for(let n=0;n<ls.length;n++){const key=ls.key(n);if(/^fc_project_inv_.+_v1$/.test(key||'')&&!/_backup(?:_meta)?_v1$/.test(key))names.push(key);}
  return Object.fromEntries([...new Set(names)].sort().map(key=>[key,raw(key)]));
 }
 function rows(source,key,ids=true){
  const value=source[key]===null?[]:JSON.parse(source[key]);
  if(!Array.isArray(value)||value.some(r=>!r||typeof r!=='object'||Array.isArray(r)))fail('DELETE_INVALID_RECORDS');
  if(ids&&(value.some(r=>typeof r.id!=='string'||!r.id)||new Set(value.map(r=>r.id)).size!==value.length))fail('DELETE_DUPLICATE_ID');return value;
 }
 function build(source,ids){
  if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)fail('DELETE_SELECTION_INVALID');
  const selected=new Set(ids),investors=rows(source,I),projects=rows(source,P),history=rows(source,H,false),drafts=rows(source,D,false);
  const offerIds=history.filter(o=>o.id!==undefined).map(o=>o.id);
  if(offerIds.some(id=>typeof id!=='string'||!id)||new Set(offerIds).size!==offerIds.length)fail('DELETE_DUPLICATE_OFFER_ID');
  if(ids.some(id=>!investors.some(i=>i.id===id)))fail('DELETE_INVESTOR_MISSING');
  if(projects.some(p=>typeof p.investorId!=='string'||!p.investorId||!p.projectData))fail('DELETE_PROJECT_OWNER_REQUIRED');
  const owned=projects.filter(p=>selected.has(p.investorId)),projectIds=new Set(owned.map(p=>p.id)),owners=new Map(projects.map(p=>[p.id,p.investorId]));
  if(owned.some(p=>p.meta?.pendingDomainOperation))fail('DELETE_PENDING_DOMAIN_OPERATION');
  const after={...source},count={investors:ids.length,projects:owned.length,rooms:0,roomTemplates:0,offers:0,drafts:0,legacy:0};
  const filtered=(key,values,keep)=>{const mask=values.map(keep);if(mask.some(v=>!v))after[key]=retainRaw(source[key],mask);};
  filtered(I,investors,i=>!selected.has(i.id));filtered(P,projects,p=>!projectIds.has(p.id));
  function belongs(record){
   const pi=[record.projectId,record.project?.id,record.meta?.projectId].filter(v=>v!==undefined&&v!==null&&v!=='');
   const ii=[record.investorId,record.investor?.id,record.project?.investorId,record.meta?.investorId].filter(v=>v!==undefined&&v!==null&&v!=='');
   if(pi.concat(ii).some(v=>typeof v!=='string')||new Set(pi).size>1||new Set(ii).size>1)fail('DELETE_REFERENCE_CONFLICT');
   const pid=pi[0],iid=ii[0],mapped=owners.get(pid);
   if(!pid&&!iid)fail('DELETE_REFERENCE_OWNER_REQUIRED');
   if(mapped&&iid&&mapped!==iid)fail('DELETE_REFERENCE_CONFLICT');
   if(pid&&iid&&selected.has(iid)&&!projectIds.has(pid)&&mapped!==iid)fail('DELETE_ORPHAN_REFERENCE');
   return projectIds.has(pid)||selected.has(iid);
  }
  filtered(H,history,o=>{if(!belongs(o))return true;count.offers++;return false;});
  filtered(D,drafts,d=>{if(!belongs(d))return true;count.drafts++;return false;});
  for(const p of owned){
   const defs=p.projectData.meta?.roomDefs;
   const physical=Object.keys(p.projectData).filter(k=>!['schemaVersion','meta'].includes(k)&&p.projectData[k]&&typeof p.projectData[k]==='object'&&(Array.isArray(p.projectData[k].cabinets)||Array.isArray(p.projectData[k].fronts)||Array.isArray(p.projectData[k].sets)||p.projectData[k].settings));
   const roomIds=new Set(Object.keys(defs||{}));
   for(const r of investors.find(i=>i.id===p.investorId).rooms||[])if(own(p.projectData,r.id))roomIds.add(r.id);
   for(const k of physical){const r=p.projectData[k];if(!['kuchnia','szafa','pokoj','lazienka'].includes(k)||['cabinets','fronts','sets'].some(f=>r[f]?.length))roomIds.add(k);}
   count.rooms+=roomIds.size;count.roomTemplates+=physical.filter(k=>!roomIds.has(k)).length;
  }
  for(const id of ids){const key='fc_project_inv_'+id+'_v1';if(source[key]!==undefined&&source[key]!==null){
   const data=JSON.parse(source[key]),owner=data?.meta?.assignedInvestorId;
   if(owner!==undefined&&owner!==null&&owner!==''&&owner!==id)fail('DELETE_LEGACY_OWNER_CONFLICT');after[key]=null;count.legacy++;
  }}
  if(source[LEGACY]!==null){const legacy=JSON.parse(source[LEGACY]);if(selected.has(legacy?.meta?.assignedInvestorId)){after[LEGACY]=null;count.legacy++;}}
  if(projectIds.has(source[CP]))after[CP]=null;if(selected.has(source[CI]))after[CI]=null;
  if(source[UI]!==null){const ui=JSON.parse(source[UI]);if(selected.has(ui.currentInvestorId)||projectIds.has(source[CP]))after[UI]=JSON.stringify({...ui,entry:'investorsList',activeTab:null,roomType:null,lastRoomType:null,currentInvestorId:null,selectedCabinetId:null});}
  const removed=source[M]===null?[]:JSON.parse(source[M]);
  if(!Array.isArray(removed)||removed.some(id=>typeof id!=='string'||!id))fail('DELETE_INVALID_TOMBSTONES');
  after[M]=JSON.stringify([...new Set([...removed,...ids])]);
  return {after,count,names:investors.filter(i=>selected.has(i.id)).map(i=>i.kind==='company'?i.companyName||'(Firma bez nazwy)':i.name||'(Bez nazwy)')};
 }
 // Durable intent and completion receipts survive loss of the localStorage
 // hint. No active data moves to IDB; before/after are private recovery copies.
 async function ledger(write){
  if(!indexedDB?.open)fail('DELETE_DURABLE_JOURNAL_UNAVAILABLE');
  return new Promise((resolve,reject)=>{
   const request=indexedDB.open(DB,1);let db;
   const rejectWith=()=>reject(Object.assign(Error('DELETE_DURABLE_JOURNAL_FAILED'),{code:'DELETE_DURABLE_JOURNAL_FAILED'}));
   request.onerror=rejectWith;request.onblocked=rejectWith;
   request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'operationId'});
   request.onsuccess=()=>{db=request.result;let tx,result;
    try{
     if(db.objectStoreNames.length!==1||!db.objectStoreNames.contains(STORE))fail('DELETE_DURABLE_JOURNAL_SCHEMA');
     tx=db.transaction(STORE,write?'readwrite':'readonly',write?{durability:'strict'}:undefined);
     if(write&&tx.durability!=='strict'){tx.abort();fail('DELETE_STRICT_DURABILITY_REQUIRED');}
     const store=tx.objectStore(STORE);if(store.keyPath!=='operationId')fail('DELETE_DURABLE_JOURNAL_SCHEMA');
     if(write)store.put(write);
     const read=store.getAll();read.onsuccess=()=>{result=read.result;};
     tx.oncomplete=()=>{db.close();durableRecords=result;resolve(result);};
     tx.onabort=tx.onerror=()=>{db.close();rejectWith();};
    }catch(error){try{tx?.abort();}catch(_){}db.close();reject(error);}
   };
  });
 }
 async function persist(journal,state){
  const row={operationId:journal.operationId,version:1,state,journal};
  const written=await ledger(row),verified=await ledger();
  if(!written.some(r=>same(r,row))||!verified.some(r=>same(r,row)))fail('DELETE_DURABLE_JOURNAL_UNCONFIRMED');
 }
 function hint(journal){const encoded=JSON.stringify(journal);set.call(ls,KEY,encoded);if(raw(KEY)!==encoded)fail('DELETE_JOURNAL_UNCONFIRMED');}
 function removedActive(journal){
  const ids=new Set(journal.ids),pids=new Set(rows(journal.before,P).filter(p=>ids.has(p.investorId)).map(p=>p.id));
  const source=snapshot();
  if(rows(source,I).some(i=>ids.has(i.id))||rows(source,P).some(p=>ids.has(p.investorId)||pids.has(p.id)))return true;
  for(const key of [H,D])if(rows(source,key,false).some(r=>[r.projectId,r.project?.id,r.meta?.projectId].some(id=>pids.has(id))||[r.investorId,r.investor?.id,r.project?.investorId,r.meta?.investorId].some(id=>ids.has(id))))return true;
  if(journal.ids.some(id=>source['fc_project_inv_'+id+'_v1']!=null))return true;
  return source[LEGACY]!==null&&ids.has(JSON.parse(source[LEGACY])?.meta?.assignedInvestorId);
 }
 async function finish(journal){
  apply(journal);await persist(journal,'completed');access();
  if(Object.keys(journal.after).some(key=>raw(key)!==journal.after[key]))fail('DELETE_WRITE_UNCONFIRMED');
  remove.call(ls,KEY);if(raw(KEY)!==null)fail('DELETE_CLEANUP_UNCONFIRMED');
 }
 function assertRestoreSafe(snapshot){
  if(raw(KEY)!==null)fail('DELETE_RECOVERY_REQUIRED');
  if(!durableRecords.length)return true;
  const source=snapshot?.keys;if(!source)fail('DELETE_RESTORE_UNCONFIRMED');
  const ids=new Set(durableRecords.flatMap(r=>r.journal.ids)),pids=new Set(durableRecords.flatMap(r=>rows(r.journal.before,P).filter(p=>ids.has(p.investorId)).map(p=>p.id)));
  const read=key=>source[key]==null?[]:JSON.parse(source[key]);
  const mark=read(M);if(!Array.isArray(mark)||[...ids].some(id=>!mark.includes(id)))fail('DELETE_RESTORE_TOMBSTONES_MISSING');
  for(const key of [I,P,H,D]){
   const entries=read(key);if(!Array.isArray(entries))fail('DELETE_RESTORE_UNCONFIRMED');
   if(entries.some(r=>key===I&&ids.has(r.id)||key===P&&(ids.has(r.investorId)||pids.has(r.id))||[r.investorId,r.investor?.id,r.project?.investorId,r.meta?.investorId].some(id=>ids.has(id))||[r.projectId,r.project?.id,r.meta?.projectId].some(id=>pids.has(id))))fail('DELETE_RESTORE_REMOVED_RECORDS');
  }
  if([...ids].some(id=>source['fc_project_inv_'+id+'_v1']!=null)||source[LEGACY]!=null&&ids.has(JSON.parse(source[LEGACY])?.meta?.assignedInvestorId))fail('DELETE_RESTORE_REMOVED_RECORDS');
  return true;
 }
 async function inventory(recovering=false){
  if(!window.indexedDB?.databases)fail('DELETE_IDB_INVENTORY_UNAVAILABLE');
  const dbs=await indexedDB.databases();access();
  const allowed=new Set(['meble-access-profile-v1','meble-device-trust-v1','firebaseLocalStorageDb','firebase-heartbeat-database','firebase-installations-database','meble-business-backups-v1',DB]);
  if(dbs.some(d=>!allowed.has(d.name)))fail('DELETE_OTHER_DATABASE_PRESENT');
  for(let n=0;n<ls.length;n++){const key=ls.key(n);if(key?.startsWith('fc_')&&!FC.dataStorageClassifier?.isRegisteredKey(key))fail('DELETE_UNKNOWN_STORE');}
  const receipts=dbs.some(d=>d.name===DB)?await ledger():[];
  for(const row of receipts){if(row.version!==1||!['pending','completed'].includes(row.state)||row.operationId!==row.journal?.operationId)fail('DELETE_DURABLE_JOURNAL_SCHEMA');validate(row.journal);}
  if(!recovering&&receipts.some(row=>row.state==='pending'))fail('DELETE_RECOVERY_REQUIRED');
  const archive=!recovering&&dbs.some(d=>d.name==='meble-business-backups-v1')?await FC.backupArchive?.inspect():null;
  if(!recovering&&dbs.some(d=>d.name==='meble-business-backups-v1')&&!archive)fail('DELETE_BACKUP_INSPECTION_UNAVAILABLE');
  const backupKeys=[];for(let n=0;n<ls.length;n++){const key=ls.key(n);if(key==='fc_data_backups_v1'||/^fc_(?:project|investors)_backup(?:_meta)?_v1$/.test(key)||/^fc_project_inv_.+_backup(?:_meta)?_v1$/.test(key))backupKeys.push(key);}
  return {databases:dbs.map(d=>d.name).sort(),backupKeys:backupKeys.sort(),archiveCount:archive?.count||0,deletionReceipts:receipts.length};
 }
 async function clientProof(operationId){
  // The existing shell installs without skipWaiting: unknown/old clients must
  // acknowledge the fence, never be assumed absent from an empty Web Locks list.
  await FC.offlineShell.prepare();access();
  const worker=navigator.serviceWorker.controller;
  if(!worker||worker.scriptURL!==new URL('offline-worker.js',document.baseURI).href)fail('DELETE_WORKER_UNCONFIRMED');
  const answer=await new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Object.assign(Error('DELETE_CLIENTS_UNCONFIRMED'),{code:'DELETE_CLIENTS_UNCONFIRMED'}));},5000);
   channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};worker.postMessage({type:'VERIFY_INVESTOR_DELETE_CLIENTS',operationId,version:VERSION},[channel.port2]);});
  clientStatus={clients:Number.isSafeInteger(answer?.clients)?answer.clients:null,reasons:Array.isArray(answer?.reasons)?answer.reasons.filter(r=>/^[A-Z_]+$/.test(r)):[]};
  if(answer?.version!==VERSION||answer.operationId!==operationId||answer.ok!==true||!Number.isSafeInteger(answer.clients)||answer.clients<1){const reason=answer?.reasons?.[0];fail(/^(AUTH|SESSION|VIEW|MODAL|JOURNAL|INITIALIZING|FENCE|NO_ACK)$/.test(reason||'')?'DELETE_CLIENT_'+reason:'DELETE_OLD_OR_ACTIVE_CLIENT');}
 }
 function validate(journal){
  if(journal?.version!==1||typeof journal.operationId!=='string'||!journal.before||!Array.isArray(journal.ids)
    ||Object.keys(journal.before).some(key=>!allowedKey(key))||Object.keys(journal.before).some(k=>journal.before[k]!==null&&typeof journal.before[k]!=='string'))fail('DELETE_JOURNAL_INVALID');
  const plan=build(journal.before,journal.ids);if(!same(plan.after,journal.after))fail('DELETE_JOURNAL_INVALID');return plan;
 }
 function consistent(journal){
  for(const key of Object.keys(journal.before))if(raw(key)!==journal.before[key]&&raw(key)!==journal.after[key])fail('DELETE_RECOVERY_CONFLICT');
 }
 function apply(journal){
  consistent(journal);
  // Tombstones first, then owned records; journal remains until all read-backs.
  const keys=[M,...Object.keys(journal.after).filter(k=>k!==M)];
  for(const key of keys){consistent(journal);if(raw(key)===journal.after[key])continue;
   if(journal.after[key]===null)remove.call(ls,key);else set.call(ls,key,journal.after[key]);
   if(raw(key)!==journal.after[key])fail('DELETE_WRITE_UNCONFIRMED');
  }
  if(Object.keys(journal.after).some(key=>raw(key)!==journal.after[key]))fail('DELETE_WRITE_UNCONFIRMED');
 }
 async function resumePending(){
  const databases=await window.indexedDB?.databases?.();
  if(raw(KEY)===null&&!databases?.some(d=>d.name===DB))return true;
  if(!navigator.locks?.request)fail('DELETE_LOCK_REQUIRED');
  return navigator.locks.request(LOCK,async()=>{
   idle(true);const records=databases?.some(d=>d.name===DB)?await ledger():[];
   const hinted=raw(KEY)===null?null:JSON.parse(raw(KEY));
   if(hinted&&records.some(r=>r.operationId===hinted.operationId&&!same(r.journal,hinted)))fail('DELETE_RECOVERY_CONFLICT');
   if(hinted&&!records.some(r=>r.operationId===hinted.operationId&&same(r.journal,hinted))){
    validate(hinted);if(Object.keys(hinted.before).some(key=>raw(key)!==hinted.before[key]))fail('DELETE_DURABLE_JOURNAL_MISSING');
    await persist(hinted,'pending');records.push({operationId:hinted.operationId,version:1,state:'pending',journal:hinted});
   }
   for(const record of records){
    access();
    if(record.version!==1||!['pending','completed'].includes(record.state)||record.operationId!==record.journal?.operationId)fail('DELETE_DURABLE_JOURNAL_SCHEMA');
    const journal=record.journal;validate(journal);
    if(record.state==='pending'||removedActive(journal)){
     if(raw(KEY)!==null&&JSON.parse(raw(KEY)).operationId!==journal.operationId)fail('DELETE_RECOVERY_CONFLICT');
     hint(journal);await inventory(true);await clientProof(journal.operationId);access();await finish(journal);
    }else{
     // Later legitimate edits are allowed; never replace their arrays from an
     // old receipt. Only restore missing tombstones against automatic recovery.
     const prior=raw(M)===null?[]:JSON.parse(raw(M));if(!Array.isArray(prior)||prior.some(id=>typeof id!=='string'))fail('DELETE_INVALID_TOMBSTONES');
     const next=JSON.stringify([...new Set([...prior,...journal.ids])]);if(next!==raw(M)){set.call(ls,M,next);if(raw(M)!==next)fail('DELETE_WRITE_UNCONFIRMED');}
     if(raw(KEY)!==null&&JSON.parse(raw(KEY)).operationId===journal.operationId){remove.call(ls,KEY);if(raw(KEY)!==null)fail('DELETE_CLEANUP_UNCONFIRMED');}
    }
   }
   return true;
  });
 }
 async function prepare(ids){
  idle();if(raw(KEY)!==null)fail('DELETE_RECOVERY_REQUIRED');
  const before=snapshot(),plan=build(before,ids),kept=await inventory();idle();if(!same(snapshot(),before))fail('DELETE_SOURCE_CHANGED');
  const token=Object.freeze({...plan.count,names:Object.freeze(plan.names),backups:kept.backupKeys.length,archiveRecords:kept.archiveCount,deletionReceipts:kept.deletionReceipts});
  tokens.set(token,{ids:[...ids],before,after:plan.after,inventory:kept});return token;
 }
 async function commit(token){
  const proof=tokens.get(token);tokens.delete(token);if(!proof)fail('DELETE_TOKEN_INVALID');
  if(!navigator.locks?.request)fail('DELETE_LOCK_REQUIRED');
  return navigator.locks.request(LOCK,async()=>{
   idle();if(raw(KEY)!==null)fail('DELETE_RECOVERY_REQUIRED');if(!same(snapshot(),proof.before)||!same(await inventory(),proof.inventory))fail('DELETE_SOURCE_CHANGED');idle();if(!same(snapshot(),proof.before))fail('DELETE_SOURCE_CHANGED');
   const journal={version:1,operationId:crypto.randomUUID(),ids:proof.ids,before:proof.before,after:proof.after};
   hint(journal);await persist(journal,'pending');
   try{await clientProof(journal.operationId);idle(false,true);await finish(journal);}catch(error){error.partial=true;throw error;}
   if(proof.before[CP]!==proof.after[CP]){
    const loaded=FC.project.load();if(typeof projectData!=='undefined')projectData=loaded;window.projectData=loaded;
   }
   return {ok:true};
  });
 }
 // A pending journal blocks cooperating business readers/writers in every tab.
 // The transaction itself uses the captured native methods, with checked RAW.
 if(proto){
  for(const [name,original]of [['getItem',get],['setItem',set],['removeItem',remove]])proto[name]=function(key,...args){
   if(this===ls&&business(key)&&raw(KEY)!==null)fail('DELETE_RECOVERY_REQUIRED');return original.call(this,key,...args);
  };
  const clear=proto.clear;proto.clear=function(){if(this===ls&&raw(KEY)!==null)fail('DELETE_RECOVERY_REQUIRED');return clear.call(this);};
 }
 window.navigator?.serviceWorker?.addEventListener('message',event=>{
  if(event.data?.type!=='PREPARE_INVESTOR_DELETE'||!event.ports[0])return;
  let ready=false,reason='JOURNAL';try{const journal=JSON.parse(raw(KEY));ready=journal?.operationId===event.data.operationId&&event.data.version===VERSION;
   if(window.__FC_MAIN_ACCESS__?.isValid()!==true){ready=false;reason='AUTH';}
   if(FC.session){if(FC.session.active||FC.session.snapshot||FC.session.durable||raw('fc_edit_session_v1')!==null||FC.investorEditorState?.hasUiLock?.()){ready=false;reason='SESSION';}
    if(window.uiState?.currentInvestorId||window.uiState?.roomType||!['home','modeHub','investorsList'].includes(window.uiState?.entry)||FC.applicationSyncActions?.installed?.()){ready=false;reason='VIEW';}
    if([...document.querySelectorAll('.modal-back,.panel-box-backdrop,.confirm-backdrop')].some(node=>node.getClientRects?.().length)){ready=false;reason='MODAL';}
   }else if(!running){ready=false;reason='INITIALIZING';}
  }catch(_){ready=false;reason='FENCE';}
  event.ports[0].postMessage({version:VERSION,operationId:event.data.operationId,ready,reason});
  event.ports[0].close();
 });
 FC.investorDeletion={version:VERSION,KEY,assertRestoreSafe,clientStatus:()=>clientStatus&&structuredClone(clientStatus),prepare,commit,resumePending:async()=>{running=true;try{return await resumePending();}finally{running=false;}},pending:()=>raw(KEY)!==null};
})();

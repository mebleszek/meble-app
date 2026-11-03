'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {androidGlobalsFixture}=require('./helpers/android-globals-browser-fixture');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));let phase='SETUP';
(async()=>{
 const {openBrowserDevice}=await import('./helpers/local-first-browser.mjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-synthetic-cas-')),profile=path.join(dir,'profile'),downloads=path.join(dir,'downloads');fs.mkdirSync(downloads);
 const server=await androidGlobalsFixture(),password='synthetic atomic recovery passphrase';let browser;
 async function extraPages(){const {targetInfos}=await browser.send('Target.getTargets');for(const t of targetInfos)if(t.type==='page'&&t.targetId!==browser.targetId)await browser.send('Target.closeTarget',{targetId:t.targetId});}
 async function clickRecovery(){const point=await browser.evaluate('(()=>{const e=document.querySelector("#auth-recovery");e.scrollIntoView();const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  for(let i=0;i<200;i++){if(await browser.evaluate('!!document.querySelector("[data-local-first-rescue]")'))break;if(i===199)throw Error('SYNTHETIC_PANEL_TIMEOUT');await pause(20);}
  await browser.evaluate(`(async()=>{
   const {createLocalFirstRescue}=await import('/sync/local-first-rescue-file.mjs'),gate=__FC_RECOVERY_ACCESS__;
   const {codeCandidate}=await import('/sync/code-global-catalogs.generated.mjs');window.syntheticCandidate=codeCandidate;
   window.syntheticApi=createLocalFirstRescue({window,name:${JSON.stringify(server.name)},ownerUid:${JSON.stringify(server.uid)},readNative:k=>gate.readNative(k),readSession:k=>gate.readSession(k),verifyOwner:()=>gate.verify(),authorize:()=>gate.assert(${JSON.stringify(server.uid)}),assertQuiescent(){if(!FC.applicationStartup.canRecoverGlobals())throw Error('RESCUE_AUTH_OR_BUSY');}});
   window.syntheticExecutor=await import('/tools/helpers/synthetic-global-rebuild.mjs');window.syntheticProbeCalls=0;
   window.syntheticOptions=()=>({window,name:${JSON.stringify(server.name)},ownerUid:${JSON.stringify(server.uid)},plan:window.syntheticPlan,
    approval:window.syntheticPlan&&{scope:'SYNTHETIC_REVIEW_V1',reviewedDifferences:true,preservePreimage:true,snapshotHash:syntheticPlan.baseline.snapshotHash,targetHash:syntheticPlan.proposedApplication.hash,sourceHash:syntheticPlan.candidateProvenance.sourceHash},
    readIndependentAck:async op=>{syntheticProbeCalls++;return {operationId:op.key,hash:op.hash,json:op.json,head:op.expected};}});
   window.syntheticReadRow=async(table,key)=>{const db=await new Promise(resolve=>{const q=indexedDB.open(${JSON.stringify(server.name)},1);q.onsuccess=()=>resolve(q.result);});try{return await new Promise(resolve=>{const tx=db.transaction(table,'readonly'),q=tx.objectStore(table).get(key);q.onsuccess=()=>resolve(q.result);});}finally{db.close();}};
   window.syntheticEdit=async(table,row)=>{const db=await new Promise(resolve=>{const q=indexedDB.open(${JSON.stringify(server.name)},1);q.onsuccess=()=>resolve(q.result);});try{await new Promise((resolve,reject)=>{const tx=db.transaction(table,'readwrite',{durability:'strict'});tx.objectStore(table).put(row);tx.oncomplete=resolve;tx.onabort=reject;});}finally{db.close();}return true;};
   window.syntheticFence=fixtureNativeGet('meble_device_trust_fence_v1');
   return true;
  })()`);
 }
 async function reopen(crash=false){if(browser)await (crash?browser.crash():browser.gracefulClose());browser=await openBrowserDevice(server,profile);await extraPages();await server.setup(browser);await clickRecovery();}
 async function proof(){
  for(const file of fs.readdirSync(downloads))fs.rmSync(path.join(downloads,file),{force:true});let completed=false;
  const off=browser.onEvent(e=>{if(e.method==='Browser.downloadProgress'&&e.params.state==='completed')completed=true;});await browser.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,eventsEnabled:true});
  await browser.evaluate(`(async()=>{window.syntheticToken=await syntheticApi.prepare(${JSON.stringify(password)});await syntheticApi.download(syntheticToken);return true;})()`);
  for(let i=0;i<500&&!completed;i++)await pause(20);off();if(!completed)throw Error('SYNTHETIC_DOWNLOAD_NOT_COMPLETED');const file=path.join(downloads,'meble-app-local-first-rescue.encrypted.json');assert.ok(fs.existsSync(file));
  await browser.evaluate(`(()=>{document.querySelector('[data-synthetic-proof]')?.remove();const input=document.createElement('input');input.type='file';input.setAttribute('data-synthetic-proof','');document.querySelector('[data-local-first-rescue] section').append(input);window.syntheticProofResult=null;
   input.addEventListener('change',event=>{window.syntheticTrusted=event.isTrusted;syntheticApi.verifySelection(input,event,${JSON.stringify(password)},syntheticToken).then(async receipt=>{window.syntheticPlan=await syntheticApi.planRebuild(receipt,syntheticCandidate);syntheticProofResult=receipt.status;}).catch(e=>{syntheticProofResult=e.code||'FAILED';});});return true;})()`);
  const doc=await browser.send('DOM.getDocument'),node=await browser.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'[data-synthetic-proof]'});await browser.send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[file]});
  for(let i=0;i<500;i++){const result=await browser.evaluate('syntheticProofResult');if(result){assert.equal(result,'BACKUP_PASS');assert.equal(await browser.evaluate('syntheticTrusted'),true);return;}await pause(20);}throw Error('SYNTHETIC_PROOF_TIMEOUT');
 }
 const execute='syntheticExecutor.executeSyntheticRebuild(syntheticOptions())';
 async function result(expression=execute){return browser.evaluate(expression+'.then(r=>r.status,e=>e.code||e.message)');}
 try{
  browser=await openBrowserDevice(server,profile);await server.setup(browser,{seed:true});await reopen();await proof();const before=await browser.evaluate('fixtureSnapshot()');
  phase='SCOPE_ACK_ABORT';assert.equal(await result('syntheticExecutor.executeSyntheticRebuild({...syntheticOptions(),name:"meble-local-first-v1"})'),'SYNTHETIC_REBUILD_ONLY');
  assert.equal(await result('syntheticExecutor.executeSyntheticRebuild({...syntheticOptions(),plan:{}})'),'RESCUE_VERIFIED_FILE_REQUIRED');
  assert.equal(await result('syntheticExecutor.executeSyntheticRebuild({...syntheticOptions(),approval:undefined})'),'SYNTHETIC_REVIEW_REQUIRED');
  await browser.evaluate('new Promise(resolve=>{navigator.locks.request("meble-application-authority-v1",async()=>{resolve(true);await new Promise(done=>window.syntheticReleaseWriter=done);});})');
  assert.equal(await result(),'SYNTHETIC_OTHER_WRITER');await browser.evaluate('syntheticReleaseWriter();true');
  assert.equal(await result('syntheticExecutor.executeSyntheticRebuild({...syntheticOptions(),readIndependentAck:undefined})'),'SYNTHETIC_ACK_UNRESOLVED');
  assert.equal(await result('syntheticExecutor.executeSyntheticRebuild({...syntheticOptions(),readIndependentAck:async op=>({operationId:op.key,hash:op.hash,json:op.json,head:{generation:999}})})'),'SYNTHETIC_ACK_UNRESOLVED');assert.deepEqual(await browser.evaluate('fixtureSnapshot()'),before);
  await browser.evaluate('window.syntheticPut=IDBObjectStore.prototype.put;window.syntheticPuts=0;IDBObjectStore.prototype.put=function(...args){if(++syntheticPuts===5)throw new DOMException("synthetic abort","AbortError");return syntheticPut.apply(this,args);};true');
  assert.equal(await result(),'AbortError');await browser.evaluate('IDBObjectStore.prototype.put=syntheticPut;true');assert.deepEqual(await browser.evaluate('fixtureSnapshot()'),before);
  console.log('PASS synthetic Chromium executor: real database/origin and forged backup refuse; unresolved/wrong ACK and native transaction abort preserve all four stores and originals');
  phase='QUOTA';await browser.evaluate('window.syntheticPuts=0;IDBObjectStore.prototype.put=function(...args){if(++syntheticPuts===5)throw new DOMException("synthetic quota boundary","QuotaExceededError");return syntheticPut.apply(this,args);};true');assert.equal(await result(),'QuotaExceededError');await browser.evaluate('IDBObjectStore.prototype.put=syntheticPut;true');assert.deepEqual(await browser.evaluate('fixtureSnapshot()'),before);
  console.log('PASS synthetic Chromium executor: injected QuotaExceededError in a native transaction aborts application/replicas/protected/outbox atomically, original RAW/receipt/binding unchanged');
  phase='AUTH_ABORT';await browser.evaluate(`IDBObjectStore.prototype.put=function(...args){const q=syntheticPut.apply(this,args);q.addEventListener('success',()=>{fixtureNativeSet('meble_device_trust_fence_v1','revoked');window.dispatchEvent(new StorageEvent('storage',{key:'meble_device_trust_fence_v1',newValue:'revoked'}));},{once:true});return q;};true`);
  assert.equal(await result(),'RESCUE_AUTH_OR_BUSY');assert.deepEqual(await browser.evaluate('fixtureSnapshot()'),before);await browser.evaluate('IDBObjectStore.prototype.put=syntheticPut;fixtureNativeSet("meble_device_trust_fence_v1",syntheticFence);true');
  await reopen();await proof();assert.deepEqual(await browser.evaluate('fixtureSnapshot()'),before);
  console.log('PASS synthetic Chromium executor: Auth revoked after queued native puts aborts without mutations; fresh owner proof/file required after restart');
  phase='CAS_CHANGE';const expected=await browser.evaluate('syntheticReadRow("control","application")');
  assert.equal(await result(`syntheticExecutor.executeSyntheticRebuild({...syntheticOptions(),readIndependentAck:async op=>{const row=await syntheticReadRow('control','application');row.version++;await syntheticEdit('control',row);return {operationId:op.key,hash:op.hash,json:op.json,head:op.expected};}})`),'SYNTHETIC_CAS_CHANGED');
  const raced=await browser.evaluate('fixtureSnapshot()');assert.equal(raced.imageVersion,before.imageVersion+1);assert.equal(raced.nativeHash,before.nativeHash);await browser.evaluate('syntheticEdit("control",'+JSON.stringify(expected)+')');assert.deepEqual(await browser.evaluate('fixtureSnapshot()'),before);
  phase='CRASH_TRANSACTION';await browser.evaluate(`window.syntheticPut=IDBObjectStore.prototype.put;window.syntheticKeepTx=true;window.syntheticTxOpen=false;IDBObjectStore.prototype.put=function(...args){const q=syntheticPut.apply(this,args),store=this;
   q.addEventListener('success',()=>{if(syntheticTxOpen)return;syntheticTxOpen=true;const hold=()=>{if(!syntheticKeepTx)return;const r=store.transaction.objectStore('control').get('binding');r.onsuccess=hold;};hold();},{once:true});return q;};window.syntheticRunning=${execute}.catch(e=>e.code||e.message);true`);
  for(let i=0;i<300;i++){if(await browser.evaluate('syntheticTxOpen'))break;if(i===299)throw Error('SYNTHETIC_TX_NOT_HELD');await pause(10);}await reopen(true);assert.deepEqual(await browser.evaluate('fixtureSnapshot()'),before);await proof();
  console.log('PASS synthetic Chromium executor: concurrent version CAS refuses; SIGKILL with an open native transaction leaves the complete preimage after restart');
  phase='COMMIT_OFFLINE';await browser.send('Network.enable');await browser.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  const committed=await browser.evaluate(execute);assert.equal(committed.status,'SYNTHETIC_COMMITTED');assert.equal(committed.networkWrites,0);assert.equal(committed.productionWriteApproved,false);
  const after=await browser.evaluate('fixtureSnapshot()');assert.equal(after.nativeHash,before.nativeHash);assert.equal(after.imageVersion,before.imageVersion+1);assert.deepEqual([...after.phases].sort(),['blocked','verified']);
  assert.equal(await browser.evaluate(`(async()=>{const row=await syntheticReadRow('control','application');FC.globalDataContract.validateBundle(FC.globalDataContract.capture({getItem:k=>row.rows[k]??null},Object.keys(FC.globalDataContract.sources)).model);return true;})()`),true);
  await reopen(true);assert.deepEqual(await browser.evaluate('fixtureSnapshot()'),after);
  phase='ROLLBACK';const journalId=committed.journalId,newOp=await browser.evaluate('syntheticReadRow("outbox",'+JSON.stringify(journalId)+')');
  await browser.evaluate('syntheticEdit("outbox",{...'+JSON.stringify(newOp)+',phase:"verified"})');const acked=await browser.evaluate('fixtureSnapshot()');
  assert.equal(await result('syntheticExecutor.rollbackSyntheticRebuild({...syntheticOptions(),journalId:'+JSON.stringify(journalId)+'})'),'SYNTHETIC_ROLLBACK_CHANGED_OR_ACKED');assert.deepEqual(await browser.evaluate('fixtureSnapshot()'),acked);await browser.evaluate('syntheticEdit("outbox",'+JSON.stringify(newOp)+')');
  assert.equal(await result('syntheticExecutor.rollbackSyntheticRebuild({...syntheticOptions(),journalId:'+JSON.stringify(journalId)+'})'),'SYNTHETIC_ROLLED_BACK');
  const rolled=await browser.evaluate('fixtureSnapshot()');assert.equal(rolled.nativeHash,before.nativeHash);assert.equal(rolled.imageVersion,after.imageVersion+1);assert.deepEqual([...rolled.phases].sort(),['blocked','verified']);
  assert.equal(await result('syntheticExecutor.rollbackSyntheticRebuild({...syntheticOptions(),journalId:'+JSON.stringify(journalId)+'})'),'SYNTHETIC_JOURNAL_INVALID');
  console.log('PASS synthetic Chromium executor: offline atomic commit/readback survives SIGKILL; rollback uses journal and CAS, retains confirmed ACK/blocked audit without replay or network WRITE, refuses changed/ACKed state');
 }finally{try{await browser?.close();}finally{await server.close();fs.rmSync(dir,{recursive:true,force:true});}}
})().catch(error=>{console.error(phase+': '+(error.code==='ERR_ASSERTION'?error.message:error.code||error.message||'SYNTHETIC_EXECUTOR_TEST_FAILED'));process.exitCode=1;});

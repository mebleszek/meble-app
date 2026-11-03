'use strict';
// Synthetic isolated profile. Native download -> disk -> native FileList; no UI in product.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto');
const {fixture}=require('./helpers/global-diagnostics-fixture');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let phase='START';
(async()=>{
 const {openBrowserDevice}=await import('./helpers/local-first-browser.mjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-private-rescue-')),profile=path.join(dir,'profile'),downloads=path.join(dir,'downloads');fs.mkdirSync(downloads);
 const worker=`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('message',e=>{if(e.data?.type==='VERIFY_APPLICATION_AUTHORITY')e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>e.ports[0].postMessage({protocol:1,nonce:e.data.nonce,exclusive:clients.length===1})));});`;
 const server=http.createServer((req,res)=>{
  const file=new URL(req.url,'http://localhost').pathname;
  if(file==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><title>Synthetic rescue fixture</title><input id="rescue-file" type="file"><script type="module">import {openLocalFirstStore} from "/sync/local-first-idb.mjs";window.openLF=b=>openLocalFirstStore({...b,indexedDB,locks:navigator.locks}).then(s=>{window.lf=s;return true;});window.lfReady=true;</script>');return;}
  if(file==='/rescue-worker.js'){res.setHeader('content-type','text/javascript');res.end(worker);return;}
  if(!/^\/sync\/(?:local-first-[a-z-]+|global-code-rebuild-plan|application-(?:release|writer-fence|authority|installation|migration-recovery))\.mjs$/.test(file)){res.writeHead(404);res.end();return;}
  try{res.setHeader('content-type','text/javascript');res.end(fs.readFileSync(path.join(process.cwd(),file)));}catch(_){res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const service={base:'http://127.0.0.1:'+server.address().port};let browser;
 const binding={name:'meble-lf-test-native-rescue',ownerUid:'synthetic-owner',deviceId:'synthetic-device',instanceId:'synthetic-instance',initialize:true};
 const rows=Object.fromEntries(fixture().rows),password='synthetic independent disk passphrase';
 async function closeExtraTestPages(){const {targetInfos}=await browser.send('Target.getTargets');for(const target of targetInfos)if(target.type==='page'&&target.targetId!==browser.targetId)await browser.send('Target.closeTarget',{targetId:target.targetId});}
 Object.assign(rows,{fc_projects_v1:'[{"id":"synthetic-project","price":12.125}]',fc_investors_v1:'[{"id":"synthetic-investor"}]',fc_data_backups_v1:' [] ',fc_quote_offer_drafts_v1:'PRIVATE_DRAFT',fc_hardware_replacement_rules_v1:'PRIVATE_REPLACEMENTS',fc_lone_surrogate_v1:'A\ud800B'});
 async function context(initial,ramAvailable=initial){
  for(const file of ['js/app/project/project-export-contract.js','js/app/cloud/global-data-contract.js','js/app/cloud/global-data-diagnostics.js','js/app/shared/backup-archive-format.js','js/app/shared/storage-recovery-export.js'])await browser.evaluate(fs.readFileSync(file,'utf8')+'\ntrue');
  await browser.evaluate(`(async()=>{
   const {digest}=await import('/sync/local-first-values.mjs');const {createLocalFirstRescue}=await import('/sync/local-first-rescue-file.mjs');
   await navigator.serviceWorker.register('/rescue-worker.js');await navigator.serviceWorker.ready;
   if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
   const rows=${JSON.stringify(rows)},binding=${JSON.stringify(binding)},nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem,nativeTx=IDBDatabase.prototype.transaction;
   ${initial?`await openLF(binding);await lf.initializeApplication(rows);await lf.commit({scope:'globals',operationId:'synthetic-uncertain',value:${JSON.stringify(fixture().m)},expectedVersion:0,protectedRows:rows});await lf.transition('synthetic-uncertain','queued','inflight',{expected:{generation:1,revisionId:'synthetic'}});await lf.transition('synthetic-uncertain','inflight','uncertain');
    const source={key:'source',version:1,activationId:'synthetic-activation',rows,hash:await digest(rows)};
    const db=await new Promise(resolve=>{const q=indexedDB.open(binding.name,1);q.onsuccess=()=>resolve(q.result);});
    await new Promise((resolve,reject)=>{const tx=nativeTx.call(db,['control'],'readwrite');tx.oncomplete=resolve;tx.onabort=reject;tx.objectStore('control').put(source);});db.close();
    for(const [key,raw]of Object.entries(rows))nativeSet.call(localStorage,key,raw);
    nativeSet.call(localStorage,'meble_application_authority_v1',JSON.stringify({version:1,name:binding.name,ownerUid:binding.ownerUid,deviceId:binding.deviceId,instanceId:binding.instanceId,sourceHash:source.hash}));
    nativeSet.call(sessionStorage,'fc_reload_restore_v1','PRIVATE_SESSION');`:''}
   ${ramAvailable&&!initial?"nativeSet.call(sessionStorage,'fc_reload_restore_v1','PRIVATE_SESSION');":''}
   window.rescueValid=true;window.rescueRam=${ramAvailable?"{available:true,scope:'CURRENT_DOCUMENT_KNOWN_BUSINESS_RAM',data:{project:{unsaved:'PRIVATE_RAM'},ui:{}}}":'null'};
   Object.defineProperty(window,'__FC_MAIN_ACCESS__',{value:Object.freeze({isValid:()=>rescueValid,assert(){if(!rescueValid)throw Error('PRIVATE_AUTH');}}),writable:false,configurable:false});
   window.rescue=createLocalFirstRescue({window,name:binding.name,ownerUid:binding.ownerUid,readNative:key=>nativeGet.call(localStorage,key),authorize(){if(!rescueValid)throw Error('PRIVATE_AUTH');},assertQuiescent(){},readRam:()=>rescueRam});
   window.persistedHash=async()=>{const db=await new Promise(resolve=>{const q=indexedDB.open(binding.name,1);q.onsuccess=()=>resolve(q.result);});
    try{const tables=await new Promise((resolve,reject)=>{const out={},tx=nativeTx.call(db,['control','protected','replicas','outbox'],'readonly');tx.oncomplete=()=>resolve(out);tx.onabort=reject;for(const name of ['control','protected','replicas','outbox']){const q=tx.objectStore(name).getAll();q.onsuccess=()=>{out[name]=q.result;};}});
     return {tablesHash:await digest(tables),localHash:await digest(Object.keys(localStorage).sort().map(k=>[k,nativeGet.call(localStorage,k)])),uncertain:tables.outbox[0].phase==='uncertain'};
    }finally{db.close();}};
   window.rescueTransactions=[];IDBDatabase.prototype.transaction=function(stores,mode,...args){rescueTransactions.push(mode);return nativeTx.call(this,stores,mode,...args);};
   // Prove the rescue reads physical originals, even when virtual storage differs.
   Storage.prototype.getItem=function(key){return this===localStorage?'VIRTUAL_NOT_PHYSICAL':nativeGet.call(this,key);};
   for(const method of ['setItem','removeItem','clear'])Storage.prototype[method]=()=>{throw Error('Forbidden business WRITE');};
   return true;
  })()`);
 }
 async function select(file,pass=password,token=true){
  await browser.evaluate(`(()=>{const input=document.querySelector('#rescue-file');input.value='';window.selectionResult=null;input.onchange=event=>{window.nativeSelection=event.isTrusted;rescue.verifySelection(input,event,${JSON.stringify(pass)},${token?'window.rescueToken':'undefined'}).then(proof=>{window.rescueProof=proof;window.selectionResult={status:proof.status,complete:proof.completeWithinScope,planBlocked:rescue.analyzePrivate(proof).plan.executeAvailable===false};},error=>{window.selectionResult={code:error.code};});};return true;})()`);
  const doc=await browser.send('DOM.getDocument'),node=await browser.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#rescue-file'});
  await browser.send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[file]});
  for(let i=0;i<500;i++){const result=await browser.evaluate('window.selectionResult');if(result){assert.equal(await browser.evaluate('nativeSelection'),true);return result;}await pause(20);}throw Error('RESCUE_NATIVE_SELECTION_TIMEOUT');
 }
 try{
  browser=await openBrowserDevice(service,profile);await context(true);
  // Native localStorage setup is asynchronously flushed by Chrome. Establish
  // a durable fixture through a normal close/reopen BEFORE testing SIGKILL.
  phase='DURABLE_FIXTURE';await browser.gracefulClose();browser=await openBrowserDevice(service,profile);await closeExtraTestPages();await context(false,true);
  if(!await browser.evaluate('localStorage.length>5'))throw Error('RESCUE_FIXTURE_NOT_PERSISTED');
  const before=await browser.evaluate('persistedHash()');let completed=false,canceled=false;
  browser.onEvent(event=>{if(event.method==='Browser.downloadProgress'){completed||=event.params.state==='completed';canceled||=event.params.state==='canceled';}});
  await browser.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,eventsEnabled:true});
  const pending=await browser.evaluate(`(async()=>{window.rescueToken=await rescue.prepare(${JSON.stringify(password)});return {token:rescueToken,download:await rescue.download(rescueToken)};})()`);
  assert.equal(pending.token.status,'BACKUP_PENDING');assert.equal(pending.download.status,'BACKUP_PENDING');
  const file=path.join(downloads,'meble-app-local-first-rescue.encrypted.json');
  for(let i=0;i<500&&!completed&&!canceled;i++)await pause(20);
  assert.equal(completed,true,'Chromium must confirm disk download completion');assert.equal(canceled,false);assert.ok(fs.existsSync(file));assert.equal(fs.readdirSync(downloads).some(n=>n.endsWith('.crdownload')),false);
  const bytes=fs.readFileSync(file);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),pending.token.fileHash);assert.equal(bytes.includes('PRIVATE_'),false);
  assert.deepEqual(await select(file),{status:'BACKUP_PASS',complete:true,planBlocked:true});
  assert.equal((await select(file,'wrong independent passphrase')).code,'RESCUE_DECRYPT_OR_FORMAT');
  const truncated=path.join(dir,'truncated.json');fs.writeFileSync(truncated,bytes.subarray(0,bytes.length-25));assert.equal((await select(truncated)).code,'RESCUE_FILE_HASH_MISMATCH');
  assert.deepEqual(await browser.evaluate('persistedHash()'),before);assert.ok((await browser.evaluate('rescueTransactions')).every(mode=>mode==='readonly'));
  console.log('PASS Chromium: completed encrypted disk download, native trusted FileList re-read/decrypt/manifest/RAW verification, truncated file/wrong password, all four stores and uncertain ACK unchanged');
  phase='SECOND_CLIENT';const second=await browser.send('Target.createTarget',{url:service.base});
  try{
   for(let i=0;i<100;i++){const {targetInfos}=await browser.send('Target.getTargets');if(targetInfos.some(t=>t.targetId===second.targetId&&t.title==='Synthetic rescue fixture'))break;if(i===99)throw Error('RESCUE_SECOND_TAB_NOT_READY');await pause(20);}
   assert.equal(await browser.evaluate(`rescue.prepare(${JSON.stringify(password)}).then(()=>"UNEXPECTED",e=>e.code)`),'RESCUE_OTHER_CLIENT');
  }finally{await browser.send('Target.closeTarget',{targetId:second.targetId});}
  phase='AUTH_LOSS';
  await browser.evaluate('rescueValid=false;true');assert.equal(await browser.evaluate(`rescue.prepare(${JSON.stringify(password)}).then(()=>"UNEXPECTED",e=>e.code)`),'RESCUE_AUTH_OR_BUSY');
  phase='RESTART';await browser.crash();browser=null;
  browser=await openBrowserDevice(service,profile);
  // A crash can restore an additional disposable test tab. Close only pages in this owned profile.
  await closeExtraTestPages();
  phase='RESTART_CONTEXT';await context(false);const after=await browser.evaluate('persistedHash()');
  if(after.tablesHash!==before.tablesHash)throw Error('RESCUE_RESTART_TABLES_DIFFERENT');if(after.localHash!==before.localHash)throw Error('RESCUE_RESTART_NATIVE_DIFFERENT');assert.equal(after.uncertain,true);
  phase='RESTART_FILE';
  assert.deepEqual(await select(file,password,false),{status:'FILE_VERIFIED_STALE',complete:false,planBlocked:true});
  assert.equal(await browser.evaluate(`rescue.prepare(${JSON.stringify(password)}).then(()=>"UNEXPECTED",e=>e.code)`),'RESCUE_RAM_UNAVAILABLE');assert.deepEqual(await browser.evaluate('persistedHash()'),before);
  console.log('PASS Chromium: actual second client and authorization loss refuse; SIGKILL/restart independently verifies saved file with explicit lost-RAM limitation; persisted RAW/image/outbox remain identical');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(phase+': '+(error.code||error.message||'RESCUE_BROWSER_TEST_FAILED'));process.exitCode=1;});

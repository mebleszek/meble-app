'use strict';
// Private Chromium profile only; genuine IDB/outbox, no Firebase or owner data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {fixture}=require('./helpers/global-diagnostics-fixture');
(async()=>{
 const {startLocalFirstServer,openBrowserDevice}=await import('./helpers/local-first-browser.mjs');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'meble-global-diagnostics-')),server=await startLocalFirstServer();let browser;
 try{
  browser=await openBrowserDevice(server,path.join(directory,'profile'));const evaluate=browser.evaluate;
  for(const file of ['js/app/project/project-export-contract.js','js/app/cloud/global-data-contract.js','js/app/cloud/global-data-diagnostics.js'])await evaluate(fs.readFileSync(file,'utf8')+'\ntrue');
  const r=fixture(),rows=Object.fromEntries(r.rows),binding={name:'meble-lf-test-global-diagnostics',ownerUid:'private-owner',deviceId:'private-device',instanceId:'private-instance',initialize:true};
  await browser.open(binding);
  await evaluate(`(async()=>{
   const {digest,json}=await import('/sync/local-first-values.mjs');const {collectGlobalDiagnostics}=await import('/sync/local-first-global-diagnostics.mjs');
   const rows=${JSON.stringify(rows)},binding=${JSON.stringify(binding)};
   await lf.initializeApplication(rows);
   await lf.commit({scope:'globals',operationId:'private-offline-operation',value:${JSON.stringify(r.m)},expectedVersion:0,protectedRows:rows});
   await lf.transition('private-offline-operation','queued','inflight',{expected:{generation:1,revisionId:'synthetic'}});await lf.transition('private-offline-operation','inflight','uncertain');
   const nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem,nativeTransaction=IDBDatabase.prototype.transaction;
   const source={key:'source',version:1,activationId:'private-activation',rows,hash:await digest(rows)};
   window.fixtureEdit=async edit=>{const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(binding.name,1);q.onsuccess=()=>resolve(q.result);q.onerror=reject;});
    try{await new Promise((resolve,reject)=>{const tx=nativeTransaction.call(db,['control'],'readwrite');tx.oncomplete=resolve;tx.onabort=reject;edit(tx.objectStore('control'));});}finally{db.close();}};
   await fixtureEdit(control=>control.put(source));
   for(const [key,value]of Object.entries(rows))nativeSet.call(localStorage,key,value);
   nativeSet.call(localStorage,'meble_application_authority_v1',JSON.stringify({...binding,initialize:undefined,version:1,sourceHash:source.hash}));
   window.diagValid=true;Object.defineProperty(window,'__FC_MAIN_ACCESS__',{value:Object.freeze({isValid:()=>diagValid,assert(){if(!diagValid)throw Error('PRIVATE_DENIED');}}),writable:false,configurable:false});
   window.diagArgs={window,ownerUid:binding.ownerUid,name:binding.name,readNative:key=>nativeGet.call(localStorage,key),authorize(){if(!diagValid)throw Error('PRIVATE_OWNER');}};
   window.collectGlobals=extra=>collectGlobalDiagnostics({...diagArgs,...extra});
   window.fixtureSnapshot=async()=>{const db=await new Promise(resolve=>{const q=indexedDB.open(binding.name,1);q.onsuccess=()=>resolve(q.result);});try{return await new Promise((resolve,reject)=>{const out={},tx=nativeTransaction.call(db,['control','outbox','protected','replicas'],'readonly');tx.oncomplete=()=>resolve(JSON.stringify(out));tx.onabort=reject;for(const key of ['control','outbox','protected','replicas']){const q=tx.objectStore(key).getAll();q.onsuccess=()=>{out[key]=q.result;};}});}finally{db.close();}};
   window.rawSnapshot=()=>JSON.stringify(Object.entries(rows).map(([k])=>[k,nativeGet.call(localStorage,k)]));
   window.diagTransactions=[];IDBDatabase.prototype.transaction=function(stores,mode,...rest){diagTransactions.push({stores:[...stores],mode});return nativeTransaction.call(this,stores,mode,...rest);};
   for(const key of ['setItem','removeItem','clear'])Storage.prototype[key]=()=>{throw Error('Forbidden diagnostic storage WRITE');};
   window.fetch=()=>{throw Error('Forbidden diagnostic network');};
   return true;
  })()`);
  const before=await evaluate('fixtureSnapshot()'),raw=await evaluate('rawSnapshot()');
  await evaluate('diagTransactions.length=0;true');
  let report=await evaluate('collectGlobals()');assert.equal(report.status,'READ_ONLY');assert.equal(report.originals.domains.length,14);assert.equal(report.localFirst.domains.length,14);
  assert.ok((await evaluate('diagTransactions')).every(t=>t.mode==='readonly'&&t.stores.join(',')==='control'));
  assert.equal(await evaluate('fixtureSnapshot()'),before);assert.equal(await evaluate('rawSnapshot()'),raw);
  const pending=await evaluate('lf.snapshot("globals")');assert.equal(pending.operations[0].phase,'uncertain');
  // Simulate the existing authority image diverging while the native source
  // remains preserved. This fixture write is outside diagnostic collection.
  await evaluate(`(async()=>{const {digest,json}=await import('/sync/local-first-values.mjs');const image=await lf.readApplication();const value=JSON.parse(image.rows.fc_materials_v1);value[0].price+=12.125;image.rows.fc_materials_v1=JSON.stringify(value);image.hash=await digest(json(image.rows));await fixtureEdit(s=>s.put(image));return true;})()`);
  const diverged=await evaluate('fixtureSnapshot()');report=await evaluate('collectGlobals()');
  const row=(section,domain)=>section.domains.find(r=>r.domain===domain);
  assert.equal(row(report.originals,'materials').status,'EQUAL');assert.equal(row(report.localFirst,'materials').status,'DIFFERENT');assert.equal(row(report.comparison,'materials').status,'DIFFERENT');
  assert.equal(await evaluate('fixtureSnapshot()'),diverged);assert.equal(await evaluate('rawSnapshot()'),raw);
  assert.doesNotMatch(JSON.stringify(report),/Synthetic|12\.125|private-owner|private-device|private-instance|private-offline-operation/);
  const names=await evaluate('indexedDB.databases()');
  report=await evaluate(`collectGlobals({name:'meble-lf-test-absent',readNative:key=>key==='meble_application_authority_v1'?JSON.stringify({...JSON.parse(diagArgs.readNative(key)),name:'meble-lf-test-absent'}):diagArgs.readNative(key)})`);
  assert.equal(report.code,'DIAG_IDB_MISSING');assert.deepEqual(await evaluate('indexedDB.databases()'),names,'Absent diagnostics must not initialize a DB');
  report=await evaluate('collectGlobals({ownerUid:"other-owner"})');assert.equal(report.code,'DIAG_OWNER_BLOCKED');
  await evaluate('diagValid=false;true');report=await evaluate('collectGlobals()');assert.equal(report.code,'DIAG_AUTH_BLOCKED');assert.equal(report.originals.status,'BLOCKED');
  assert.equal(await evaluate('fixtureSnapshot()'),diverged);assert.equal(await evaluate('rawSnapshot()'),raw);
  console.log('PASS real Chromium: all 14 domains/7 pairs, distinct native source and IDB image, uncertain offline outbox preserved, readonly transactions, no DB creation/foreign owner/access bypass');
 }finally{await browser?.close();await server.close();fs.rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});

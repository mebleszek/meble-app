'use strict';
// Existing Preflight runs this isolated real-IDB suite; no Firebase SDK or app startup.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
async function main(){
 const {startLocalFirstServer,openBrowserDevice}=await import('./helpers/local-first-browser.mjs');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'meble-lf-idb-')),server=await startLocalFirstServer();let browser;
 const binding={name:'meble-lf-test-durable',ownerUid:'synthetic-owner',deviceId:'phone',instanceId:'installation-one',initialize:true};
 try{
  browser=await openBrowserDevice(server,path.join(directory,'phone'));let store=await browser.open(binding);
  const first=await store.commit({scope:'globals',operationId:'one',value:{exact:7.125,unknownAllowed:{keep:true}},expectedVersion:0,protectedRows:{historicalRaw:'SYNTHETIC-KEEP-EXACT'}});
  assert.equal(first.localConfirmed,true);assert.equal(first.cloudConfirmed,false);
  let snapshot=await store.snapshot('globals');assert.equal(snapshot.replica.version,1);assert.equal(snapshot.operations.length,1);
  assert.equal((await store.commit({scope:'globals',operationId:'one',value:{exact:7.125,unknownAllowed:{keep:true}},expectedVersion:0})).duplicate,true);
  await assert.rejects(store.commit({scope:'globals',operationId:'one',value:{exact:8},expectedVersion:1}),/LF_OPERATION_REUSED/);
  await assert.rejects(store.commit({scope:'globals',operationId:'old',value:{exact:8},expectedVersion:0}),/LF_LOCAL_CONFLICT/);
  console.log('PASS real IndexedDB: atomic model+outbox, exact values, durable ID and local CAS');
  await browser.close();browser=await openBrowserDevice(server,path.join(directory,'phone'));store=await browser.open({...binding,initialize:false});
  snapshot=await store.snapshot('globals');assert.equal(snapshot.operations[0].key,'one');assert.equal(snapshot.replica.dirty,true);
  await store.transition('one','queued','inflight',{expected:{generation:1,revisionId:'synthetic'}});
  await browser.close();browser=await openBrowserDevice(server,path.join(directory,'phone'));store=await browser.open({...binding,initialize:false});
  snapshot=await store.snapshot('globals');assert.equal(snapshot.operations[0].phase,'inflight');assert.equal(snapshot.operations[0].expected.revisionId,'synthetic');
  await assert.rejects(store.transition('one','inflight','queued'),/LF_TRANSITION_INVALID/);
  await assert.rejects(store.apply({scope:'globals',value:{remote:true},head:{generation:1},expectedVersion:1}),/LF_LOCAL_CONFLICT/);
  console.log('PASS real Chromium restart: queued/inflight state persists, no blind replay or remote overwrite');
  // Fault injection at a real IDB write: force quota error AFTER transaction abort.
  await browser.evaluate('window.__oldPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==="replicas"){this.transaction.abort();throw new DOMException("synthetic quota","QuotaExceededError");}return window.__oldPut.apply(this,args);};true');
  await assert.rejects(store.commit({scope:'globals',operationId:'quota',value:{exact:9},expectedVersion:1}),/QuotaExceededError|quota|LF_IDB/);
  await browser.evaluate('IDBObjectStore.prototype.put=window.__oldPut;true');
  snapshot=await store.snapshot('globals');assert.equal(snapshot.replica.version,1);assert.equal(snapshot.operations.length,1);
  console.log('PASS real IDB aborted transaction: quota cannot confirm or leave a partial model/outbox');
  // Hold a genuine readwrite transaction open after its model put, then kill
  // the browser process before commit. Both model and obligation must roll back.
  await browser.evaluate(`window.__oldPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){
    const q=window.__oldPut.apply(this,args);if(this.name==='replicas'){
      q.addEventListener('success',()=>{window.__crashReady=true;const control=this.transaction.objectStore('control');
        const pump=()=>{control.get('binding').onsuccess=pump;};pump();});}return q;};true`);
  const interrupted=store.commit({scope:'globals',operationId:'interrupted',value:{exact:123},expectedVersion:1}).then(()=>({confirmed:true}),()=>({confirmed:false}));
  for(let i=0;i<100;i++){if(await browser.evaluate('window.__crashReady===true'))break;if(i===99)throw Error('Crash fixture did not reach IDB write');await new Promise(resolve=>setTimeout(resolve,10));}
  await browser.close();assert.equal((await interrupted).confirmed,false);
  browser=await openBrowserDevice(server,path.join(directory,'phone'));store=await browser.open({...binding,initialize:false});
  snapshot=await store.snapshot('globals');assert.equal(snapshot.replica.version,1);assert.equal(snapshot.operations.length,1);assert.equal(JSON.parse(snapshot.replica.json).exact,7.125);
  console.log('PASS real browser crash during IDB transaction: no partial record or false local ACK');
  await store.commit({scope:'globals',operationId:'later',value:{exact:9},expectedVersion:1});
  snapshot=await store.snapshot('globals');assert.equal(snapshot.protected.length,2);
  assert.equal(JSON.parse(snapshot.protected.find(row=>row.key==='one').json).historicalRaw,'SYNTHETIC-KEEP-EXACT');
  console.log('PASS protected RAW versions: later work never erases the prior retained copy');
  await store.close();
  await browser.evaluate('new Promise((resolve,reject)=>{const q=indexedDB.deleteDatabase("'+binding.name+'");q.onsuccess=()=>resolve(true);q.onerror=q.onblocked=()=>reject(Error("Fixture deletion failed"));})');
  await assert.rejects(browser.open({...binding,initialize:false}),/LF_IDB_MISSING_OR_UNAVAILABLE/);
  console.log('PASS real IDB loss: reopening refuses and never silently creates an empty replacement');
 }finally{await browser?.close();await server.close();fs.rmSync(directory,{recursive:true,force:true,maxRetries:3});}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};

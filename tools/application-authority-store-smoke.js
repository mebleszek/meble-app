'use strict';
// Mandatory Preflight: real Chromium/IDB for the new atomic application image.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
(async()=>{
 const {startLocalFirstServer,openBrowserDevice}=await import('./helpers/local-first-browser.mjs');
 const server=await startLocalFirstServer(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-authority-'));let browser;
 try{
  browser=await openBrowserDevice(server,path.join(dir,'phone'));
  const binding={name:'meble-lf-test-authority',ownerUid:'owner',deviceId:'phone',instanceId:'one',initialize:true};
  const store=await browser.open(binding),rows={fc_projects_v1:'[]',fc_investors_v1:'[]',fc_quote_snapshots_v1:'[]',unknownRaw:'EXACT'};
  const first=await store.initializeApplication(rows);assert.equal(first.version,1);
  const changed={...rows,fc_projects_v1:'[{"id":"owned"}]'},value={exact:7.125};
  const request={scope:'globals',operationId:'approved',value,expectedVersion:0,application:{expectedVersion:1,rows:changed}};
  await browser.evaluate(`window.oldPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='replicas'){this.transaction.abort();throw new DOMException('synthetic quota','QuotaExceededError');}return window.oldPut.apply(this,args);};true`);
  await assert.rejects(store.commit(request),/quota|QuotaExceededError|LF_IDB/);
  await browser.evaluate('IDBObjectStore.prototype.put=window.oldPut;true');
  assert.deepEqual(await store.readApplication(),first);assert.equal((await store.snapshot('globals')).replica,null);
  const out=await store.commit(request);assert.equal(out.localConfirmed,true);assert.equal((await store.readApplication()).version,2);
  assert.deepEqual((await store.readApplication()).rows,changed);assert.equal((await store.snapshot('globals')).operations.length,1);
  assert.equal((await store.commit(request)).duplicate,true);assert.equal((await store.readApplication()).version,2);
  await assert.rejects(store.commit({...request,application:{expectedVersion:1,rows}}),/LF_OPERATION_REUSED/);
  await assert.rejects(store.commit({...request,operationId:'stale',expectedVersion:1}),/LF_APPLICATION_CONFLICT/);
  assert.equal((await store.snapshot('globals')).operations.length,1);assert.equal((await store.readApplication()).version,2);
  await browser.crash();browser=await openBrowserDevice(server,path.join(dir,'phone'));const restored=await browser.open({...binding,initialize:false});
  assert.deepEqual((await restored.readApplication()).rows,changed);assert.equal((await restored.snapshot('globals')).operations[0].phase,'queued');
  // A production-name store cannot activate this emulator-only migration API.
  await browser.evaluate(`openLF({name:'meble-local-first-v1',ownerUid:'owner',deviceId:'phone',instanceId:'one',initialize:true})`);
  await assert.rejects(browser.evaluate('window.lf.initializeApplication({})'),/LF_OLD_WRITER_EXCLUSIVITY_UNPROVEN/);
  console.log('PASS real IDB application+outbox atomicity/quota rollback, local CAS, duplicate integrity, SIGKILL persistence and production migration refusal');
 }finally{await browser?.close();await server.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

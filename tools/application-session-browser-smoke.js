'use strict';
// New application boundary on actual Chromium IDB. Remote memory channel is
// explicit here; real Auth/Firestore coverage is LOCAL-FIRST 08 in existing CI.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{
 const {startLocalFirstServer,openBrowserDevice}=await import('./helpers/local-first-browser.mjs');
 const {createDurableSynchronizer}=await import('../sync/local-first-sync.mjs');
 const {createApplicationSession}=await import('../sync/application-session.mjs');
 const fixture=await import('./firebase-pilot/cloud-sync-fixture.mjs'),r=fixture.runtime(),model=fixture.model(),c=r.FC.globalDataContract;
 for(const [key,value]of Object.entries(model))r.rows.set(c.sources[key][0],JSON.stringify(key==='stock'?{sheets:value}:value));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-application-idb-')),server=await startLocalFirstServer();let browser,adapter;
 const binding={name:'meble-lf-test-application',ownerUid:'synthetic-owner',deviceId:'phone',instanceId:'installation-one',initialize:true};
 try{
  browser=await openBrowserDevice(server,path.join(dir,'profile'));const store=await browser.open(binding);
  let online=false,remote=null;
  const channel={kind:'globals',scope:'globals',contract:c,async prepare(value){return {expected:{generation:1,revisionId:'synthetic'},async publish(){remote={head:{generation:1,revisionId:'synthetic'},value};}};},async read(){assert.ok(remote);return remote;}};
  const events=new EventTarget(),sync=createDurableSynchronizer({store,channels:[channel],eventTarget:events,online:()=>online});
  adapter=createApplicationSession({synchronizer:sync,store,source:r.storage,globalContract:c,session:{active:false,snapshot:null,durable:false},eventTarget:events,
   access:{assertLocal(uid){assert.equal(uid,binding.ownerUid);},assertCloud(){}}});
  await assert.rejects(adapter.save({operationId:'bad',kind:'globals',saveLocal:async()=>({ok:false})}),/LF_APPLICATION_SAVE_UNCONFIRMED/);
  assert.equal((await store.snapshot('globals')).operations.length,0);
  const saved=await adapter.save({operationId:'confirmed',kind:'globals',saveLocal:async()=>({ok:true})});assert.equal(saved.localConfirmed,true);assert.equal(saved.cloudConfirmed,false);
  const queued=await store.snapshot('globals');assert.equal(queued.operations[0].phase,'queued');assert.deepEqual(JSON.parse(queued.replica.json),model);
  assert.equal(Object.keys(model).length,14);await adapter.close();adapter=null;
  await browser.close();browser=await openBrowserDevice(server,path.join(dir,'profile'));
  const reopened=await browser.open({...binding,initialize:false});assert.deepEqual(await reopened.snapshot('globals'),queued);
  online=true;const resumed=createDurableSynchronizer({store:reopened,channels:[channel],eventTarget:events,online:()=>online});
  assert.equal((await resumed.flush()).ok,true);const done=await reopened.snapshot('globals');assert.equal(done.operations[0].phase,'verified');assert.equal(done.replica.dirty,false);resumed.close();
  console.log('PASS application actual Chromium IDB: refused Save queues nothing, 14-domain Save+outbox, logout preserves data, profile restart and verified recovery');
 }finally{await adapter?.close();await browser?.close();await server.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

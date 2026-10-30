'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
(async()=>{
 const {createApplicationSession}=await import('../sync/application-session.mjs');
 let active=false,closed=false,queued=0,saved=0,remoteApplied=0,version=1;
 const snap=()=>({replica:{version,json:'{"exact":7.125}',base:{generation:1},dirty:false},operations:[],protected:[]});
 const store={ownerUid:'owner',deviceId:'phone',instanceId:'one',snapshot:async()=>snap(),close(){closed=true;}};
 const session={get active(){return active;},snapshot:null,durable:false};
 const sync={submitGlobals:async()=>{queued++;return {localConfirmed:true,cloudConfirmed:false};},flush:async()=>({ok:true}),close(){}};
 const adapter=createApplicationSession({synchronizer:sync,store,session,source:{getItem:()=>null},globalContract:{schemas:{one:{}},validateBundle(){},capture:()=>({assertUnchanged(){}})},
  eventTarget:new EventTarget(),access:{assertLocal(uid){assert.equal(uid,'owner');if(closed)throw Error('CLOSED');},assertCloud(){}},
  onRemote:async receipt=>{await receipt.assertCurrent();remoteApplied++;assert.equal(receipt.value.exact,7.125);return true;}});
 await assert.rejects(adapter.save({operationId:'bad',kind:'globals',saveLocal:async()=>({ok:false})}),/LF_APPLICATION_SAVE_UNCONFIRMED/);assert.equal(queued,0);
 active=true;await assert.rejects(adapter.globals('editing'),/LF_APPLICATION_EDIT_ACTIVE/);active=false;
 const result=await adapter.save({operationId:'good',kind:'globals',saveLocal:async()=>{saved++;return {ok:true};}});assert.equal(result.localConfirmed,true);assert.equal(result.cloudConfirmed,false);assert.equal(saved,1);assert.equal(queued,1);
 assert.equal(await adapter.receive('globals'),true);assert.equal(remoteApplied,1);
 const w={FC:{}};vm.runInNewContext(fs.readFileSync('js/app/cloud/application-sync-actions.js','utf8'),{window:w,crypto});
 const a=w.FC.applicationSyncActions;assert.equal(a.installed(),false);assert.equal(a.save(()=>42),42);
 a.install(adapter);assert.equal(a.installed(),true);a.close();assert.equal(closed,true);assert.equal(a.installed(),false);
 await assert.rejects(adapter.globals('logout'),/LF_APPLICATION_CLOSED/);
 console.log('PASS application Save/receive boundary, active edit refusal, no false cloud ACK, inert install and logout preservation');
})().catch(e=>{console.error(e);process.exitCode=1;});

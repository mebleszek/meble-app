'use strict';
// Browser.close may terminate its page transport before the response arrives.
// Only synthetic loopback data; suppress one ACK, never the real process exit.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
async function main(){
 const api=await import('./helpers/local-first-browser.mjs');
 const NativeSocket=global.WebSocket;
 let commands=0,otherResponses=0,dropped=0;
 global.WebSocket=class extends NativeSocket{
  send(raw){const m=JSON.parse(raw);if(m.method==='Browser.close'){this.closeId=m.id;commands++;}return super.send(raw);}
  set onmessage(fn){super.onmessage=event=>{const m=JSON.parse(event.data);if(this.closeId&&m.id===this.closeId){dropped++;return;}if(m.id)otherResponses++;fn(event);};}
 };
 const server=await api.startLocalFirstServer(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-close-proof-'));
 let device;const binding={name:'meble-lf-test-close-proof',ownerUid:'synthetic-owner',deviceId:'one',instanceId:'one'};
 try{
  device=await api.openBrowserDevice(server,dir);await device.open({...binding,initialize:true});
  await device.evaluate(`(async()=>{localStorage.setItem('synthetic-close-proof','EXACT-7.125');await lf.initializeApplication({raw:'EXACT-7.125'});const editor={active:true,deviceId:'one',token:'synthetic-editor'};await lf.apply({scope:'synthetic-project',value:{price:7.125},head:null,expectedVersion:0,editor});await lf.commit({scope:'synthetic-project',operationId:'uncertain-before-close',value:{price:7.125},expectedVersion:1,editor,protectedRows:{original:'EXACT'}});await lf.transition('uncertain-before-close','queued','inflight',{expected:{generation:1}});await lf.transition('uncertain-before-close','inflight','uncertain');return true;})()`);
  const read=`(async()=>{const names=['control','replicas','protected','outbox'];return new Promise((resolve,reject)=>{const q=indexedDB.open(${JSON.stringify(binding.name)});q.onerror=reject;q.onsuccess=()=>{const db=q.result,rows={},tx=db.transaction(names,'readonly');for(const name of names){const r=tx.objectStore(name).getAll();r.onsuccess=()=>rows[name]=r.result;}tx.oncomplete=()=>{db.close();resolve({raw:localStorage.getItem('synthetic-close-proof'),rows});};tx.onabort=reject;};});})()`;
  const before=await device.evaluate(read);assert.equal(before.rows.outbox[0].phase,'uncertain');
  const closing=device.gracefulClose();assert.equal(device.gracefulClose(),closing,'Concurrent orderly closes share one command/proof');await closing;device=null;
  assert.equal(commands,1,'Close must be sent once, without retry');assert.ok(otherResponses>0,'Only Browser.close ACK is withheld, not ordinary CDP replies');
  device=await api.openBrowserDevice(server,dir);await device.open({...binding,initialize:false});
  assert.deepEqual(await device.evaluate(read),before,'Cold reopen preserves exact localStorage and all four native stores, including uncertain ACK');
  await device.gracefulClose();device=null;
  console.log('PASS real Chromium: withheld Browser.close ACK, verified orderly process exit, same-profile cold restart, exact RAW/control/replicas/protected/uncertain outbox; ACKs withheld='+dropped);
 }finally{await device?.close();global.WebSocket=NativeSocket;await server.close();fs.rmSync(dir,{recursive:true,force:true});}
}
async function contract(){
 const {waitForOrderlyBrowserExit:close}=await import('./helpers/local-first-browser.mjs'),never=()=>new Promise(()=>{});
 let exit;const events=[];const ended=new Promise(resolve=>{exit=resolve;});
 const closing=close({send:method=>{assert.equal(method,'Browser.close');events.push('request');return never();},exited:ended,cleanup:async()=>{events.push('reap');}});
 assert.deepEqual(events,['request']);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(events,['request'],'Never reap/kill while an orderly exit is still unproven');
 events.push('natural-zero-exit');exit({code:0,signal:null});await closing;assert.deepEqual(events,['request','natural-zero-exit','reap']);
 console.log('PASS protocol: missing ACK accepts ONLY natural zero exit before cleanup');
 for(const ack of [true,false]){
  let requests=0,reaped=0;
  await assert.rejects(close({send:()=>{requests++;return ack?Promise.resolve({}):never();},exited:never(),cleanup:async()=>{reaped++;}},{timeoutMs:5}),/LF_GRACEFUL_CLOSE_TIMEOUT/);
  assert.equal(requests,1);assert.equal(reaped,1);
 }
 console.log('PASS protocol: ACK without exit and no ACK/no exit both reach the bounded deadline, no retry');
 for(const result of [{code:7,signal:null},{code:0,signal:'SIGTERM'},{error:Error('spawn-failed')},{}]){
  let reaped=0;
  await assert.rejects(close({send:()=>Promise.resolve({}),exited:Promise.resolve(result),cleanup:async()=>{reaped++;}}),/LF_GRACEFUL_CLOSE_FAILED/);assert.equal(reaped,1);
 }
 console.log('PASS protocol: nonzero/signal/spawn error or absent exit status cannot pass');
 for(const send of [()=>Promise.reject(Error('EXPLICIT_CDP_ERROR')),()=>{throw Error('SEND_FAILED');}]){
  let reaped=0;await assert.rejects(close({send,exited:never(),cleanup:async()=>{reaped++;}}),/EXPLICIT_CDP_ERROR|SEND_FAILED/);assert.equal(reaped,1);
 }
 await assert.rejects(close({send:()=>Promise.resolve({}),exited:Promise.resolve({code:0,signal:null}),cleanup:async()=>{throw Error('CLEANUP_UNCONFIRMED');}}),/CLEANUP_UNCONFIRMED/);
 console.log('PASS protocol: dispatch/CDP failure and unconfirmed cleanup refuse instead of masking errors');
}
if(require.main===module)(async()=>{await contract();await main();})().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main,contract};

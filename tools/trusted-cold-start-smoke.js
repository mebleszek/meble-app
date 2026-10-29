'use strict';
// Targeted lifecycle and read-only diagnostic checks. Native Chromium/IDB/SW
// persistence remains the mandatory trusted-session-browser smoke in CI.
const assert=require('node:assert/strict'),vm=require('node:vm');
const {inspectTrustStorage,closeBrowserForRestart}=require('./helpers/trusted-cold-start');
const {world}=require('./trusted-main-login-smoke');
async function main(){
 let exit,finished=false;const events=[],owner={exited:new Promise(resolve=>{exit=resolve;}),async close(){events.push('reaped');}};
 const closing=closeBrowserForRestart({send:async method=>{events.push(method);},owner,ws:{close(){events.push('socket closed');}},pending:new Map()}).then(()=>{finished=true;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(finished,false);assert.deepEqual(events,['Browser.close']);
 exit({code:0,signal:null});await closing;assert.deepEqual(events,['Browser.close','socket closed','reaped']);
 for(const kind of ['ack','exit','signal','timeout','cleanup']){
  let attempts=0,cleaned=0,socketClosed=false;
  const result=kind==='exit'?{code:1}:kind==='signal'?{code:null,signal:'SIGTERM'}:{code:0,signal:null};
  const owned={exited:kind==='timeout'?new Promise(()=>{}):Promise.resolve(result),async close(){cleaned++;if(kind==='cleanup')throw Error('CLEANUP_UNCONFIRMED');}};
  await assert.rejects(closeBrowserForRestart({send:async method=>{assert.equal(method,'Browser.close');attempts++;if(kind==='ack')throw Error('ACK_LOST');},owner:owned,ws:{close(){socketClosed=true;}},pending:new Map()},{timeoutMs:1}),/ACK_LOST|BROWSER_ORDERLY_EXIT|CLEANUP_UNCONFIRMED/);
  assert.equal(attempts,1);assert.equal(cleaned,1);assert.equal(socketClosed,true);
 }
 console.log('PASS orderly close: Browser.close ACK and natural zero exit precede reaping; lost ACK, signal, timeout, nonzero exit or failed cleanup refuse without retry');

 const d=world({},null,{realAuth:true});try{
  await d.login();await d.trust();
  const databases=d.shared.databases,rows=d.shared.rows,originalRows=[...rows],originalProof=[...databases.get('meble-device-trust-v1').rows];
  let available=[...databases.keys()],opens=0,transactions=0;
  const indexedDB={databases:async()=>[...available,'PRIVATE_OTHER_DATABASE'].map(name=>({name})),open(name){
   assert.ok(available.includes(name),'Never create a missing diagnostic database');assert.ok(databases.has(name),'Never read another database');opens++;
   const request=databases.get(name).open();let success;
   Object.defineProperty(request,'onsuccess',{get:()=>success,set:callback=>{success=()=>{
    const original=request.result.transaction;
    request.result.transaction=(store,mode,...rest)=>{assert.equal(mode,'readonly');transactions++;return original.call(request.result,store,mode,...rest);};callback();
   };}});return request;
  }};
  const inspect=()=>vm.runInNewContext('('+inspectTrustStorage.toString()+')()',{localStorage:d.w.localStorage,indexedDB,location:d.w.location});
  const valid=await inspect();assert.equal(valid.fence,'active');assert.equal(valid.trustDatabase,'read');assert.equal(valid.profileDatabase,'read');assert.equal(valid.revoked,false);
  for(const key of ['proofPresent','proofVersionValid','privateKeyPresent','privateKeyNonExportable','publicKeyPresent','signaturePresent','originMatches','fenceMatches','profileActive','bindingMatches','receiptMatches'])assert.equal(valid[key],true,key);
  const unchanged=(current,prior)=>current.length===prior.length&&current.every(([key,value],i)=>key===prior[i][0]&&value===prior[i][1]);
  assert.equal(opens,2);assert.equal(transactions,2);assert.equal(unchanged([...rows],originalRows),true,'Diagnostic must preserve storage');assert.equal(unchanged([...databases.get('meble-device-trust-v1').rows],originalProof),true,'Diagnostic must preserve proof');
  assert.ok(await d.w.FC.localDeviceAccess.createTrust().restore());assert.equal(d.w.__AUTH_INPUT_DIAGNOSTICS__().trustRestore,'valid');
  const output=JSON.stringify(valid);assert.equal(output.includes('synthetic-phone-owner'),false);assert.equal(output.includes('PRIVATE_OTHER_DATABASE'),false);
  available=available.filter(name=>name!=='meble-device-trust-v1');const missing=await inspect();assert.equal(missing.trustDatabase,'missing');assert.equal(missing.proofPresent,false);assert.equal(opens,3,'Missing trust DB must not be opened/created');
  available=[...databases.keys()];const fence=rows.get('meble_device_trust_fence_v1');rows.set('meble_device_trust_fence_v1','revoked');
  const revoked=await inspect();assert.equal(revoked.fence,'revoked');assert.equal(revoked.fenceMatches,false);assert.equal(rows.get('meble_device_trust_fence_v1'),'revoked','Inspection must not reactivate trust');
  assert.equal(await d.w.FC.localDeviceAccess.createTrust().restore(),null);assert.equal(d.w.__AUTH_INPUT_DIAGNOSTICS__().trustRestore,'absent');
  rows.set('meble_device_trust_fence_v1',fence);
  const proofRows=databases.get('meble-device-trust-v1').rows,record=proofRows.get('active');
  const corrupt={...record,statement:{...record.statement,origin:'https://foreign.invalid'}};proofRows.set('active',corrupt);
  await assert.rejects(d.w.FC.localDeviceAccess.createTrust().restore(),/DEVICE_TRUST_INVALID/);assert.equal(proofRows.get('active'),corrupt,'Refused proof must not be repaired');
  assert.equal(d.w.__AUTH_INPUT_DIAGNOSTICS__().trustRestore,'refused');assert.equal(d.w.__AUTH_INPUT_DIAGNOSTICS__().trustError,'DEVICE_TRUST_INVALID');proofRows.set('active',record);
  console.log('PASS read-only cold evidence: real CryptoKey/signature restore in IDB model, valid/absent/refused diagnostics, missing DB without creation, revoked/corrupt proof without repair, no UID/key/business values exported');
 }finally{d.close();}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});module.exports={main};

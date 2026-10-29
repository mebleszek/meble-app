'use strict';
// Browser-test helpers only. Never change a receipt, key, fence or database.
async function inspectTrustStorage(){
 const fenceRaw=localStorage.getItem('meble_device_trust_fence_v1');
 const fence=fenceRaw===null?'missing':fenceRaw==='revoked'?'revoked':fenceRaw.startsWith('active:')?'active':fenceRaw.startsWith('pending:')?'pending':'invalid';
 if(typeof indexedDB.databases!=='function')throw Error('TRUST_DIAGNOSTICS_UNAVAILABLE');
 const names=new Set((await indexedDB.databases()).map(db=>db.name));
 async function read(name,store,key){
  if(!names.has(name))return {state:'missing'};
  return new Promise(resolve=>{
   let db,settled=false;
   const finish=value=>{if(settled)return;settled=true;db?.close();resolve(value);};
   const request=indexedDB.open(name); // No version upgrade or implicit creation.
   request.onupgradeneeded=()=>request.transaction.abort();
   request.onblocked=()=>finish({state:'blocked'});request.onerror=()=>finish({state:'unavailable'});
   request.onsuccess=()=>{
    db=request.result;if(settled){db.close();return;}
    try{
     const tx=db.transaction(store,'readonly'),q=tx.objectStore(store).get(key);let record;
     q.onsuccess=()=>{record=q.result;};
     tx.oncomplete=()=>finish({state:'read',record});tx.onabort=()=>finish({state:'unavailable'});tx.onerror=()=>{};
    }catch(_){finish({state:'unavailable'});}
   };
  });
 }
 const t=await read('meble-device-trust-v1','proof','active'),p=await read('meble-access-profile-v1','ownership','owner');
 const proof=t.record,statement=proof?.statement,owner=p.record;
 let receipt;try{receipt=JSON.parse(localStorage.getItem('meble_access_profile_v1'));}catch(_){}
 return {fence,trustDatabase:t.state,profileDatabase:p.state,
  proofPresent:!!proof,proofVersionValid:proof?.version===1,revoked:proof?.revoked===true,
  privateKeyPresent:proof?.privateKey?.type==='private',privateKeyNonExportable:proof?.privateKey?.extractable===false,
  publicKeyPresent:proof?.publicKey?.type==='public',signaturePresent:proof?.signature?.byteLength===64,
  originMatches:!!statement&&statement.origin===location.origin,
  fenceMatches:!!statement&&fenceRaw==='active:'+statement.installationId,
  profileActive:owner?.version===1&&owner.state==='active',
  bindingMatches:!!statement&&!!owner&&statement.uid===owner.uid&&statement.profileAttemptId===owner.attemptId,
  receiptMatches:!!receipt&&!!owner&&receipt.uid===owner.uid&&receipt.attemptId===owner.attemptId};
}
async function closeBrowserForRestart({send,owner,ws,pending},{timeoutMs=30000}={}){
 let timer;
 try{
  // OS signals are emergency process cleanup, not Chromium's profile shutdown.
  // Require its close command and natural exit BEFORE supervisor cleanup.
  await send('Browser.close');
  const result=await Promise.race([owner.exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('BROWSER_ORDERLY_EXIT_UNCONFIRMED')),timeoutMs);})]);
  if(result.error||result.code!==0||result.signal)throw Error('BROWSER_ORDERLY_EXIT_FAILED');
 }finally{
  clearTimeout(timer);ws.close();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Closed'));}pending.clear();
  await owner.close(); // Reaping receipt/profile ownership is still mandatory.
 }
}
module.exports={inspectTrustStorage,closeBrowserForRestart};

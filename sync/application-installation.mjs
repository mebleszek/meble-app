// Lossless emulator cutover receipt. Source keys are never deleted or rewritten.
import {digest,equal,fail} from './local-first-values.mjs';
export const INSTALL_KEY='meble_application_authority_v1';
export async function exclusiveApplication(w){
 let release;const held=new Promise(resolve=>{release=resolve;});let accepted;
 const ready=new Promise(resolve=>{accepted=resolve;});
 const life=w.navigator.locks.request('meble-application-authority-v1',{ifAvailable:true},async lock=>{
  if(!lock){accepted(false);return;}accepted(true);await held;
 });
 if(!await ready){await life;fail('LF_OTHER_APPLICATION_CLIENT');}
 return ()=>{release();return life;};
}
export async function verifyExclusiveClient(w){
 const worker=w.navigator.serviceWorker?.controller;
 if(!worker)fail('LF_OLD_WRITER_EXCLUSIVITY_UNPROVEN');
 const channel=new w.MessageChannel(),nonce=crypto.randomUUID();
 const result=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{channel.port1.close();reject(Error('LF_OLD_WRITER_EXCLUSIVITY_UNPROVEN'));},2000);
  channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};
  worker.postMessage({type:'VERIFY_APPLICATION_AUTHORITY',protocol:1,nonce},[channel.port2]);
 });
 if(result?.protocol!==1||result.nonce!==nonce||result.exclusive!==true)fail('LF_OLD_WRITER_EXCLUSIVITY_UNPROVEN');
}
export async function applicationInstallation({window:w,ownerUid,name,keys,sourceRead,heldRelease}){
 if(!['127.0.0.1','localhost'].includes(w.location.hostname)||!/^meble-lf-test-/.test(name))fail('LF_PRODUCTION_MIGRATION_NOT_APPROVED');
 const release=heldRelease||await exclusiveApplication(w);
 try{
  await verifyExclusiveClient(w);
  const rows=Object.fromEntries(keys.map(k=>[k,sourceRead?sourceRead(k):w.localStorage.getItem(k)]));
  const sourceHash=await digest(rows),raw=w.localStorage.getItem(INSTALL_KEY);
  let binding;
  if(raw){try{binding=JSON.parse(raw);}catch(_){fail('LF_INSTALLATION_RECEIPT_INVALID');}
   if(binding.version!==1||binding.ownerUid!==ownerUid||binding.name!==name||binding.sourceHash!==sourceHash)fail('LF_OLD_WRITER_OR_OWNER_CONFLICT');
   binding={...binding,initialize:false};
  }else{
   // A missing marker cannot recreate an existing authority. IDB open without
   // initialize remains the only route after a receipt has been established.
   const names=await w.indexedDB.databases();
   if(names.some(db=>db.name===name))fail('LF_INSTALLATION_RECEIPT_LOST');
   binding={version:1,name,ownerUid,deviceId:crypto.randomUUID(),instanceId:crypto.randomUUID(),sourceHash,initialize:true};
  }
  return {binding,rows,release,
   confirm(){const receipt={...binding};delete receipt.initialize;w.localStorage.setItem(INSTALL_KEY,JSON.stringify(receipt));
    if(!equal(JSON.parse(w.localStorage.getItem(INSTALL_KEY)),receipt))fail('LF_INSTALLATION_RECEIPT_UNCONFIRMED');}
  };
 }catch(error){await release();throw error;}
}

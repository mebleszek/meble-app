// Persistent SW ownership complements the lifetime Web Lock. No source mutation.
import {fail} from './local-first-values.mjs';
export async function applicationWriterFence(w,{claim=false}={}){
 const registration=await w.navigator.serviceWorker.ready,worker=w.navigator.serviceWorker.controller||(claim?registration.active:null);
 if(!worker||worker.scriptURL!==new URL('offline-worker.js',w.document.baseURI).href)fail('LF_WRITER_FENCE_UNCONFIRMED');
 function request(type,shouldClaim){
  const channel=new w.MessageChannel(),nonce=crypto.randomUUID();
  return new Promise((resolve,reject)=>{
   const complete=value=>{clearTimeout(timer);channel.port1.close();resolve(value);};
   const timer=setTimeout(()=>complete(null),2000);
   channel.port1.onmessage=e=>complete({reply:e.data,nonce});
   try{worker.postMessage({type,protocol:2,nonce,claim:shouldClaim},[channel.port2]);}
   catch(error){clearTimeout(timer);channel.port1.close();reject(error);}
  });
 }
 let proof=await request('APPLICATION_WRITER_FENCE',claim);
 // A dropped first answer can only be resolved by reading the existing
 // binding from the same controller. Never retry acquisition or claim.
 if(!proof&&!claim&&w.navigator.serviceWorker.controller===worker)
  proof=await request('VERIFY_APPLICATION_WRITER_FENCE',false);
 if(!proof)fail('LF_WRITER_FENCE_UNCONFIRMED');
 if(proof.reply?.nonce!==proof.nonce||proof.reply.protocol!==2||proof.reply.owned!==true)fail('LF_OTHER_APPLICATION_CLIENT');
 if(!claim&&w.navigator.serviceWorker.controller!==worker)fail('LF_WRITER_FENCE_UNCONFIRMED');
 if(!w.navigator.serviceWorker.controller&&claim)await new Promise((resolve,reject)=>{const sw=w.navigator.serviceWorker,timer=setTimeout(()=>{sw.removeEventListener('controllerchange',check);reject(Error('LF_WRITER_CONTROLLER_UNCONFIRMED'));},2000);function check(){if(sw.controller){clearTimeout(timer);sw.removeEventListener('controllerchange',check);resolve();}}sw.addEventListener('controllerchange',check);check();});
 if(!w.navigator.serviceWorker.controller)fail('LF_WRITER_CONTROLLER_UNCONFIRMED');
}

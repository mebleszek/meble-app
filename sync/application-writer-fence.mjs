// Persistent SW ownership complements the lifetime Web Lock. No source mutation.
import {fail} from './local-first-values.mjs';
export async function applicationWriterFence(w,{claim=false}={}){
 const registration=await w.navigator.serviceWorker.ready,worker=w.navigator.serviceWorker.controller||(claim?registration.active:null);
 if(!worker||worker.scriptURL!==new URL('offline-worker.js',w.document.baseURI).href)fail('LF_WRITER_FENCE_UNCONFIRMED');
 const channel=new w.MessageChannel(),nonce=crypto.randomUUID();
 const reply=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{channel.port1.close();reject(Error('LF_WRITER_FENCE_UNCONFIRMED'));},2000);
  channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};
  worker.postMessage({type:'APPLICATION_WRITER_FENCE',protocol:2,nonce,claim},[channel.port2]);
 });
 if(reply?.nonce!==nonce||reply.protocol!==2||reply.owned!==true)fail('LF_OTHER_APPLICATION_CLIENT');
 if(!w.navigator.serviceWorker.controller&&claim)await new Promise((resolve,reject)=>{const sw=w.navigator.serviceWorker,timer=setTimeout(()=>{sw.removeEventListener('controllerchange',check);reject(Error('LF_WRITER_CONTROLLER_UNCONFIRMED'));},2000);function check(){if(sw.controller){clearTimeout(timer);sw.removeEventListener('controllerchange',check);resolve();}}sw.addEventListener('controllerchange',check);check();});
 if(!w.navigator.serviceWorker.controller)fail('LF_WRITER_CONTROLLER_UNCONFIRMED');
}

// Service Worker helper: durable ownership survives worker eviction. No user data.
(function(){
 'use strict';let queue=Promise.resolve();
 const serial=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
 async function record(action){
  const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('meble-application-writer-fence-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('control');q.onerror=()=>reject(q.error);q.onsuccess=()=>resolve(q.result);});
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction('control','readwrite',{durability:'strict'}),s=tx.objectStore('control'),get=s.get('owner');let result;
   get.onsuccess=()=>{try{result=action(s,get.result||null);}catch(e){tx.abort();reject(e);}};tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error||Error('FENCE_ABORTED'));
  });}finally{db.close();}
 }
 const read=()=>record((_s,value)=>value);
 async function liveOwner(){const old=await read();return old&&await self.clients.get(old.id)?old:null;}
 self.addEventListener('message',event=>{
  if(event.data?.type!=='APPLICATION_WRITER_FENCE'||!event.ports[0])return;
  event.waitUntil(serial(async()=>{
   let owned=false;
   try{const source=event.source,windows=await self.clients.matchAll({type:'window',includeUncontrolled:true}),old=await liveOwner();
    if(event.data.protocol===2&&source?.id&&windows.length===1&&windows[0].id===source.id&&(!old||old.id===source.id)){
     await record(s=>s.put({id:source.id,protocol:2},'owner'));
     // Claim only this proven lone auth-shell client, after the durable fence;
     // never skipWaiting, replace an existing worker or reload an open document.
     if(event.data.claim===true)await self.clients.claim();owned=true;
    }
   }catch(_){}
   event.ports[0].postMessage({protocol:2,nonce:event.data.nonce,owned});event.ports[0].close();
  }));
 });
 self.MEBLE_WRITER_ALLOWED=event=>serial(async()=>{
  const owner=await liveOwner();if(!owner)return true;
  if(event.clientId===owner.id||event.replacesClientId===owner.id){
   if(event.request.mode==='navigate'&&event.resultingClientId)await record(s=>s.put({id:event.resultingClientId,protocol:2},'owner'));
   return true;
  }
  return false;
 });
})();

'use strict';
importScripts('./offline-assets.js','./js/app/cloud/offline-writer-fence.js');
const MANIFEST=self.MEBLE_OFFLINE_ASSETS,CACHE='meble-static-'+MANIFEST.version;
const root=new URL('./',self.location.href),assets=new Map(MANIFEST.files.map(f=>[new URL(f.path,root).pathname,f]));
const digest=async buffer=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
async function checked(response,file){
  if(!response||response.status!==200||response.type==='opaque'||response.redirected)throw Error('OFFLINE_RESOURCE_UNAVAILABLE');
  const bytes=await response.clone().arrayBuffer();
  if(bytes.byteLength!==file.bytes||await digest(bytes)!==file.sha256)throw Error('OFFLINE_RESOURCE_CHANGED');
  return response;
}
async function complete(onVerified){
  const cache=await caches.open(CACHE);
  let verified=0;
  for(const file of MANIFEST.files){
    await checked(await cache.match(new URL(file.path,root).href),file);
    if(onVerified)onVerified(++verified);
  }
  return true;
}
// Only public static-resource counters are published. No application storage.
const observers=new Set();
let installProgress={type:'STATIC_SHELL_INSTALL_PROGRESS',protocol:1,version:MANIFEST.version,phase:'preparing',
  total:MANIFEST.files.length,processed:0,downloaded:0,reused:0,verified:0};
function reportInstall(patch){
  installProgress={...installProgress,...patch};
  for(const port of observers)try{port.postMessage(installProgress);}catch(_){observers.delete(port);}
}
function finishObservers(){
  for(const port of observers)try{port.close();}catch(_){}
  observers.clear();
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  reportInstall({phase:'preparing'});
  let created=false;
  try{
    const names=await caches.keys();
    const cache=await caches.open(CACHE);
    created=!names.includes(CACHE);
    reportInstall({phase:'install',processed:0,downloaded:0,reused:0,verified:0});
    // Reuse only versioned Meble-App static caches. Never trust metadata alone:
    // check the actual bytes of every reused resource against the NEW manifest.
    const older=names.filter(name=>name!==CACHE&&/^meble-static-[a-f0-9]{64}$/.test(name)).reverse();
    const sources=[cache,...await Promise.all(older.map(name=>caches.open(name)))];
    let cursor=0,firstError=null;
    async function installNext(){
      while(!firstError){
        const index=cursor++;
        if(index>=MANIFEST.files.length)return;
        const file=MANIFEST.files[index],url=new URL(file.path,root);
        try{
          let response=null,reused=false,inDestination=false;
          for(const source of sources){
            const candidate=await source.match(url.href);
            if(!candidate)continue;
            try{response=await checked(candidate,file);reused=true;inDestination=source===cache;break;}catch(_){}
          }
          if(!response)response=await checked(await fetch(url,{cache:'no-store',credentials:'omit',redirect:'error'}),file);
          if(!inDestination)await cache.put(url.href,response.clone());
          reportInstall({phase:'install',processed:installProgress.processed+1,
            reused:installProgress.reused+(reused?1:0),downloaded:installProgress.downloaded+(reused?0:1)});
        }catch(error){firstError||=error;}
      }
    }
    // One failed download cannot leave a partially installed version visible.
    // Wait for all in-flight writes before removing the candidate cache.
    await Promise.all(Array.from({length:Math.min(4,MANIFEST.files.length)},()=>installNext()));
    if(firstError)throw firstError;
    reportInstall({phase:'verify',verified:0});
    await complete(verified=>reportInstall({phase:'verify',verified}));
    reportInstall({phase:'ready',verified:MANIFEST.files.length});
  }catch(error){
    // An existing same-version cache can still serve the active worker.
    // Its entries are only replaced with exact manifest matches.
    if(created)await caches.delete(CACHE);
    reportInstall({phase:'error'});
    throw error;
  }finally{finishObservers();}
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='OBSERVE_STATIC_SHELL_INSTALL'&&event.ports[0]){
    const port=event.ports[0];
    try{port.postMessage(installProgress);if(['ready','error'].includes(installProgress.phase))port.close();else observers.add(port);}
    catch(_){try{port.close();}catch(_){}}
    return;
  }
  if(event.data?.type==='VERIFY_APPLICATION_AUTHORITY'&&event.ports[0]){
    event.waitUntil((async()=>{
      const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      event.ports[0].postMessage({protocol:1,nonce:event.data.nonce,
        exclusive:event.data.protocol===1&&clients.length===1&&clients[0].id===event.source?.id});
      event.ports[0].close();
    })());return;
  }
  if(event.data?.type==='VERIFY_INVESTOR_DELETE_CLIENTS'&&event.ports[0]){
    event.waitUntil((async()=>{
      const version='20261031_investor_delete_v2',operationId=event.data.operationId;
      const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      const ready=await Promise.all(windows.map(client=>new Promise(resolve=>{
        const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve({ready:false,reason:'NO_ACK'});},1500);
        channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve({ready:e.data?.version===version&&e.data.operationId===operationId&&e.data.ready===true,reason:/^(?:AUTH|SESSION|VIEW|MODAL|JOURNAL|INITIALIZING|FENCE)$/.test(e.data?.reason||'')?e.data.reason:'UNKNOWN'});};
        client.postMessage({type:'PREPARE_INVESTOR_DELETE',version,operationId},[channel.port2]);
      })));
      event.ports[0].postMessage({version,operationId,clients:windows.length,ok:event.data.version===version&&windows.length>0&&ready.every(result=>result.ready),reasons:ready.filter(result=>!result.ready).map(result=>result.reason)});
      event.ports[0].close();
    })());return;
  }
  if(event.data?.type==='VERIFY_STATIC_SHELL'&&event.ports[0]){
    const port=event.ports[0],report=event.data.progress===true?verified=>{
      try{port.postMessage({type:'STATIC_SHELL_VERIFY_PROGRESS',version:MANIFEST.version,
        verified,total:MANIFEST.files.length});}catch(_){}
    }:undefined;
    event.waitUntil(complete(report).then(()=>port.postMessage({complete:true,version:MANIFEST.version}),
      ()=>port.postMessage({complete:false})));
  }
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==root.origin)return;
  const pathname=url.pathname===root.pathname?new URL('index.html',root).pathname:url.pathname,file=assets.get(pathname);
  // Explicit allowlist excludes Firebase, tokens, private responses, tools and
  // all unknown routes. The immutable shell version stays coherent per worker.
  if(!file){if(request.mode==='navigate'||request.destination==='script')event.respondWith((async()=>await self.MEBLE_WRITER_ALLOWED(event)?fetch(request):new Response('APPLICATION_WRITE_LOCKED',{status:423}))());return;}
  event.respondWith((async()=>{
    if(self.MEBLE_WRITER_ALLOWED&&!await self.MEBLE_WRITER_ALLOWED(event))return new Response('APPLICATION_WRITE_LOCKED',{status:423});
    const cache=await caches.open(CACHE),stored=await cache.match(new URL(file.path,root).href);
    return checked(stored,file); // Missing/corrupt resources never become PASS.
  })());
});

'use strict';
importScripts('./offline-assets.js');
const MANIFEST=self.MEBLE_OFFLINE_ASSETS,CACHE='meble-static-'+MANIFEST.version;
const root=new URL('./',self.location.href),assets=new Map(MANIFEST.files.map(f=>[new URL(f.path,root).pathname,f]));
const digest=async buffer=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
async function checked(response,file){
  if(!response||response.status!==200||response.type==='opaque'||response.redirected)throw Error('OFFLINE_RESOURCE_UNAVAILABLE');
  const bytes=await response.clone().arrayBuffer();
  if(bytes.byteLength!==file.bytes||await digest(bytes)!==file.sha256)throw Error('OFFLINE_RESOURCE_CHANGED');
  return response;
}
async function complete(){
  const cache=await caches.open(CACHE);
  for(const file of MANIFEST.files)await checked(await cache.match(new URL(file.path,root).href),file);
  return true;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  try{await complete();return;}catch(_){} // Preserve an already complete active version.
  const cache=await caches.open(CACHE);
  try{
    for(const file of MANIFEST.files){const url=new URL(file.path,root);
      const response=await checked(await fetch(url,{cache:'no-store',credentials:'omit',redirect:'error'}),file);
      await cache.put(url.href,response);
    }
    await complete();
  }catch(error){await caches.delete(CACHE);throw error;}
  // No skipWaiting/clients.claim: never replace the runtime of an open draft.
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='VERIFY_STATIC_SHELL'&&event.ports[0])event.waitUntil(complete().then(()=>event.ports[0].postMessage({complete:true,version:MANIFEST.version}),()=>event.ports[0].postMessage({complete:false})));
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==root.origin)return;
  const pathname=url.pathname===root.pathname?new URL('index.html',root).pathname:url.pathname,file=assets.get(pathname);
  // Explicit allowlist excludes Firebase, tokens, private responses, tools and
  // all unknown routes. The immutable shell version stays coherent per worker.
  if(!file)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),stored=await cache.match(new URL(file.path,root).href);
    return checked(stored,file); // Missing/corrupt resources never become PASS.
  })());
});

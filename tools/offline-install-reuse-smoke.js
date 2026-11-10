'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const code=fs.readFileSync('offline-worker.js','utf8'),root='https://synthetic.invalid/meble-app/',oldName='meble-static-'+ 'a'.repeat(64),newName='meble-static-'+ 'b'.repeat(64);
const files=Array.from({length:12},(_,i)=>({path:i?'js/f'+i+'.js':'index.html',body:'VERIFIED_BODY_'+i})).map(f=>({...f,bytes:Buffer.byteLength(f.body),sha256:createHash('sha256').update(f.body).digest('hex')}));
function fixture({old=true,corrupt=false,failure=false,offline=false}={}){
 const stores=new Map(),handlers={},requests=[];let active=0,peak=0,finished=0;
 if(old){const rows=new Map(files.map(f=>[root+f.path,new Response(f.body)]));rows.set(root+'index.html',new Response('OLD_INDEX'));if(corrupt)rows.set(root+'js/f2.js',new Response('CORRUPT'));stores.set(oldName,rows);}
 const cache=name=>{if(!stores.has(name))stores.set(name,new Map());const rows=stores.get(name);return {match:async key=>rows.get(String(key))?.clone(),put:async(key,r)=>{await new Promise(setImmediate);rows.set(String(key),r.clone());}};};
 const self={location:{href:root+'offline-worker.js'},MEBLE_OFFLINE_ASSETS:{version:'b'.repeat(64),files},addEventListener:(type,fn)=>handlers[type]=fn};
 const context={self,Response,importScripts(){},URL,Uint8Array,crypto:webcrypto,caches:{keys:async()=>[...stores.keys()],open:async name=>cache(name),delete:async name=>stores.delete(name)},fetch:async url=>{
  requests.push(String(url));active++;peak=Math.max(peak,active);
  try{await new Promise(setImmediate);if(offline)throw Error('OFFLINE');const f=files.find(f=>root+f.path===String(url));return new Response(failure&&f.path==='js/f1.js'?'BAD_BYTES':f.body);}finally{active--;finished++;}
 }};
 vm.runInNewContext(code,context);
 return {stores,requests,get peak(){return peak;},get finished(){return finished;},async install(){let work;handlers.install({waitUntil:p=>{work=p;}});await work;},async verify(){let work,result;handlers.message({data:{type:'VERIFY_STATIC_SHELL'},ports:[{postMessage:value=>{result=value;}}],waitUntil:p=>{work=p;}});await work;return result;},async fetchDenied(){self.MEBLE_WRITER_ALLOWED=async()=>false;let response;handlers.fetch({request:new Request(root+'js/f1.js'),respondWith:p=>{response=p;}});assert.equal((await response).status,423);}};
}
(async()=>{
 const reuse=fixture();await reuse.install();assert.deepEqual(reuse.requests,[root+'index.html']);assert.equal((await reuse.verify()).complete,true);assert.equal(await reuse.stores.get(oldName).get(root+'index.html').text(),'OLD_INDEX');await reuse.fetchDenied();
 const corrupt=fixture({corrupt:true});await corrupt.install();assert.deepEqual(corrupt.requests.sort(),[root+'index.html',root+'js/f2.js'].sort());assert.equal(await corrupt.stores.get(oldName).get(root+'js/f2.js').text(),'CORRUPT');
 const parallel=fixture({old:false});await parallel.install();assert.ok(parallel.peak>1);assert.ok(parallel.peak<=4);assert.equal(parallel.requests.length,files.length);
 const interrupted=fixture({old:false,failure:true});await assert.rejects(interrupted.install(),/RESOURCE_CHANGED/);assert.equal(interrupted.finished,interrupted.requests.length);await new Promise(setImmediate);assert.equal(interrupted.stores.has(newName),false);assert.equal((await interrupted.verify()).complete,false);
 const offline=fixture({offline:true});await assert.rejects(offline.install(),/OFFLINE/);assert.equal(offline.stores.has(oldName),true);assert.equal(offline.stores.has(newName),false);
 const existing=fixture({old:false,offline:true});existing.stores.set(newName,new Map([[root+'index.html',new Response('CORRUPT_PREEXISTING')]]));await assert.rejects(existing.install(),/OFFLINE/);assert.equal(existing.stores.has(newName),true,'A pre-existing version may still be active; failed repair must not delete it');assert.equal(await existing.stores.get(newName).get(root+'index.html').text(),'CORRUPT_PREEXISTING');
 const complete=fixture();await complete.install();const count=complete.requests.length;await complete.install();assert.equal(complete.requests.length,count);
 console.log('offline-install-reuse: 7/7 groups PASS; verified reuse, corrupt fallback, concurrency<=4, drained rollback, offline, complete-cache retry, pre-existing cache preservation; 423 retained');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});

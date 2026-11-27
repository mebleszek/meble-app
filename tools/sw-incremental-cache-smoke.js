'use strict';
// Targeted synthetic SW install: reuse only independently verified public cache
// objects, fetch changed resources, never mutate an active cache on failure.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync('offline-worker.js','utf8');
const root='https://synthetic.invalid/meble-app/';
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const expected={'unchanged.js':'unchanged bytes','changed.js':'changed version 2','new.js':'new public asset'};
const manifest={version:'b'.repeat(64),files:Object.entries(expected).map(([path,body])=>({path,bytes:Buffer.byteLength(body),sha256:sha(body)}))};
class ResponseFixture {
 constructor(body){this.bytes=Buffer.from(body);this.status=200;this.type='basic';this.redirected=false;}
 clone(){return new ResponseFixture(this.bytes);}
 async arrayBuffer(){const bytes=Buffer.from(this.bytes);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}
}
function harness(oldFiles,networkFiles=expected,{validOldName=true,completeCurrent=false}={}){
 const name='meble-static-'+manifest.version,oldName=validOldName?'meble-static-'+'a'.repeat(64):'foreign-private-cache';
 const data=new Map(),fetches=[],events={};
 const initial=new Map(Object.entries(oldFiles).map(([path,value])=>[new URL(path,root).href,new ResponseFixture(value)]));
 data.set(oldName,initial);
 if(completeCurrent)data.set(name,new Map(Object.entries(expected).map(([path,value])=>[new URL(path,root).href,new ResponseFixture(value)])));
 const caches={
  keys:async()=>[...data.keys()],
  open:async key=>{
   if(!data.has(key))data.set(key,new Map());
   const records=data.get(key);
   return {
    match:async url=>records.get(String(url))?.clone(),
    put:async(url,response)=>{records.set(String(url),response.clone());}
   };
  },
  delete:async key=>data.delete(key)
 };
 const self={
  location:{href:root+'offline-worker.js'},MEBLE_OFFLINE_ASSETS:manifest,
  addEventListener:(type,fn)=>{events[type]=fn;},MEBLE_WRITER_ALLOWED:async()=>true,
  registration:{waiting:{state:'installed'}}
 };
 const fetch=async(url,options)=>{
  const path=new URL(url).pathname.slice(new URL(root).pathname.length);
  fetches.push(path);
  assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');
  if(!Object.hasOwn(networkFiles,path))throw Error('SYNTHETIC_NETWORK_UNAVAILABLE');
  return new ResponseFixture(networkFiles[path]);
 };
 const importScripts=(...paths)=>{assert.deepEqual([...paths],['./offline-assets.js','./js/app/cloud/offline-writer-fence.js']);};
 vm.runInNewContext(source,{self,URL,caches,fetch,crypto:crypto.webcrypto,importScripts,console,setTimeout,clearTimeout},{filename:'offline-worker.js'});
 const messages=[];
 const port={postMessage:message=>messages.push(JSON.parse(JSON.stringify(message))),close(){this.closed=true;}};
 events.message({data:{type:'OBSERVE_STATIC_SHELL_INSTALL'},ports:[port]});
 const install=()=>new Promise((resolve,reject)=>{
  events.install({waitUntil:task=>task.then(resolve,reject)});
 });
 const verify=async()=>{
  const rows=[];let job;
  events.message({data:{type:'VERIFY_STATIC_SHELL',progress:true},
   ports:[{postMessage:message=>rows.push(JSON.parse(JSON.stringify(message)))}],
   waitUntil:task=>{job=task;}});
  await job;return rows;
 };
 async function activate({owned=true,otherClient=false,latePeer=false,badProof=false,invalidScope=false}={}){
  const replies=[],windowClient={type:'window',id:'caller',url:invalidScope?root+'sw-update.html':root+'index.html'};
  let activated=0,checks=0,job;
  self.MEBLE_UPDATE_OWNS_WRITER=async id=>id===windowClient.id&&owned;
  self.skipWaiting=async()=>{activated++;};
  self.clients={matchAll:async()=>otherClient||(latePeer&&++checks>2)?[windowClient,{id:'peer'}]:[windowClient]};
  const channel={postMessage(message){
   replies.push({status:message.status,reason:message.reason});
   if(message.status==='prepared')queueMicrotask(()=>this.onmessage({data:{nonce:badProof?'other':message.nonce,version:message.version,confirm:true}}));
  },close(){}};
  events.message({data:{type:'ACTIVATE_STATIC_SHELL',protocol:1,version:manifest.version,nonce:'activation-proof'},source:windowClient,ports:[channel],waitUntil:task=>{job=task;}});
  await job;
  return {activated,replies};
 }
 return {name,oldName,data,fetches,messages,port,install,verify,activate};
}
(async()=>{
 let h=harness({'unchanged.js':expected['unchanged.js'],'changed.js':'old version'});
 await h.install();
 assert.deepEqual(h.fetches.sort(),['changed.js','new.js']);
 assert.deepEqual(h.messages.at(-1),{type:'STATIC_SHELL_INSTALL_PROGRESS',protocol:1,
  version:manifest.version,phase:'ready',total:3,processed:3,downloaded:2,reused:1,verified:3});
 assert.equal(h.port.closed,true);
 assert.equal(h.data.get(h.oldName).get(new URL('changed.js',root).href).bytes.toString(),'old version','Old active image must remain byte-identical');
 const acknowledgements=await h.verify();
 assert.equal(acknowledgements.at(-1).complete,true);
 assert.equal(acknowledgements.at(-1).version,manifest.version);
 assert.deepEqual(acknowledgements.filter(x=>x.type==='STATIC_SHELL_VERIFY_PROGRESS').map(x=>x.verified),[1,2,3]);
 h=harness({'unchanged.js':'unchanged byteX','changed.js':'outdated'});
 await h.install();
 assert.deepEqual(h.fetches.sort(),['changed.js','new.js','unchanged.js'],'Wrong hash may not be reused');
 assert.equal(h.messages.at(-1).reused,0);
 h=harness({'unchanged.js':expected['unchanged.js']},{'new.js':expected['new.js']});
 await assert.rejects(h.install(),/SYNTHETIC_NETWORK_UNAVAILABLE/);
 assert.equal(h.data.has(h.name),false,'Failed candidate cache must be deleted');
 assert.equal(h.data.has(h.oldName),true,'Failed install must preserve the old cache');
 h=harness({'unchanged.js':expected['unchanged.js']},expected,{validOldName:false});
 await h.install();
 assert.deepEqual(h.fetches.sort(),['changed.js','new.js','unchanged.js'],'Never read foreign cache names');
 h=harness({},expected,{completeCurrent:true});
 await h.install();
 assert.deepEqual(h.fetches,[],'Complete same-version cache must not trigger network download');
 assert.equal(h.messages.at(-1).verified,3);
 h=harness({}, {}, {completeCurrent:true});
 const current=h.data.get(h.name);
 current.delete(new URL('new.js',root).href);
 await assert.rejects(h.install(),/SYNTHETIC_NETWORK_UNAVAILABLE/);
 assert.equal(h.data.get(h.name),current,'Failed same-manifest repair must preserve the existing cache');
 assert.equal(current.get(new URL('unchanged.js',root).href).bytes.toString(),expected['unchanged.js']);
 assert.deepEqual(await h.activate(),{activated:0,replies:[{status:'refused',reason:'INSTALL_UNCONFIRMED'}]},'A damaged candidate must never activate');
 h=harness({},expected,{completeCurrent:true});
 for(const [input,reason] of [[{owned:false},'OTHER_TAB'],[{otherClient:true},'OTHER_TAB'],[{latePeer:true},'OTHER_TAB'],[{badProof:true},'APP_BUSY'],[{invalidScope:true},'CANDIDATE_CHANGED']]){
  const refusal=await h.activate(input);assert.equal(refusal.activated,0);assert.deepEqual(refusal.replies.at(-1),{status:'refused',reason});
 }
 const accepted=await h.activate();assert.equal(accepted.activated,1);assert.equal(accepted.replies.at(-1).status,'accepted');
 console.log('PASS incremental Service Worker: verified reuse, atomic failure, ACK counters and guarded activation against a late tab, bad proof and corrupt cache');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});

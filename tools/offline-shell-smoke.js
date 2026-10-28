'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
async function main(){
 assert.equal(fs.readFileSync('offline-assets.js','utf8'),require('./offline-assets').source(),'Static manifest must match every real byte');
 const source=fs.readFileSync('offline-worker.js','utf8'),handlers={},root='https://synthetic.invalid/meble-app/';
 const files=[{path:'index.html',body:'SYNTHETIC-SHELL'},{path:'js/main.js',body:'SYNTHETIC-CODE'}].map(f=>({...f,bytes:Buffer.byteLength(f.body),sha256:createHash('sha256').update(f.body).digest('hex')}));
 const stores=new Map();let fetches=0;
 const cache=name=>{if(!stores.has(name))stores.set(name,new Map());const rows=stores.get(name);return {match:async url=>rows.get(String(url))?.clone(),put:async(url,response)=>rows.set(String(url),response.clone())};};
 const self={location:{href:root+'offline-worker.js'},MEBLE_OFFLINE_ASSETS:{version:'synthetic',files},addEventListener:(name,fn)=>handlers[name]=fn,
   skipWaiting(){throw Error('Forbidden open-page replacement');},clients:{claim(){throw Error('Forbidden takeover');}}};
 const context={self,URL,crypto:webcrypto,Uint8Array,importScripts(){},caches:{open:async name=>cache(name),delete:async name=>stores.delete(name)},
   fetch:async url=>{fetches++;const file=files.find(f=>new URL(f.path,root).href===String(url));assert.ok(file);return new Response(file.body,{status:200});}};
 vm.runInNewContext(source,context);
 let work;handlers.install({waitUntil:p=>{work=p;}});await work;assert.equal(fetches,2);
 // A complete version must survive a later failed network/install attempt.
 context.fetch=async()=>{throw Error('Offline');};handlers.install({waitUntil:p=>{work=p;}});await work;assert.equal(fetches,2);
 let response;handlers.fetch({request:new Request(root+'?version=ignored'),respondWith:p=>{response=p;}});assert.equal(await (await response).text(),'SYNTHETIC-SHELL');
 for(const url of ['https://firestore.googleapis.com/private',root+'appAccess/owner',root+'private.json']){
   let intercepted=false;handlers.fetch({request:new Request(url),respondWith(){intercepted=true;}});assert.equal(intercepted,false);
 }
 const cacheRows=stores.get('meble-static-synthetic');cacheRows.set(root+'js/main.js',new Response('CORRUPT',{status:200}));
 handlers.fetch({request:new Request(root+'js/main.js'),respondWith:p=>{response=p;}});await assert.rejects(response,/RESOURCE_CHANGED/);
 let message;handlers.message({data:{type:'VERIFY_STATIC_SHELL'},ports:[{postMessage:m=>message=m}],waitUntil:p=>{work=p;}});await work;assert.equal(message.complete,false);
 console.log('PASS offline shell: exact current manifest, full install, coherent offline read, protected active cache, corrupt/missing resource refusal, no Firebase/private-response interception or page takeover');
 const win={FC:{},isSecureContext:true},worker={scriptURL:root+'offline-worker.js',postMessage(_message,ports){ports[0].postMessage({complete:true,version:'a'.repeat(64)});ports[0].close();}},registration={scope:root,active:worker};
 const navigator={serviceWorker:{register:async(url,options)=>{assert.equal(String(url),root+'offline-worker.js');assert.equal(options.updateViaCache,'none');},ready:Promise.resolve(registration)}};
 new Function('window','navigator','document','MessageChannel',fs.readFileSync('js/app/cloud/offline-shell.js','utf8'))(win,navigator,{baseURI:root+'index.html'},MessageChannel);
 assert.equal((await win.FC.offlineShell.prepare()).complete,true);
 worker.scriptURL=root+'foreign-worker.js';await assert.rejects(win.FC.offlineShell.prepare(),/UNCONFIRMED/);worker.scriptURL=root+'offline-worker.js';
 registration.scope=root+'foreign/';await assert.rejects(win.FC.offlineShell.prepare(),/UNCONFIRMED/);registration.scope=root;
 worker.postMessage=(_message,ports)=>{ports[0].postMessage({complete:false});ports[0].close();};await assert.rejects(win.FC.offlineShell.prepare(),/INCOMPLETE/);
 console.log('PASS offline enrollment: exact worker/script/scope identity and explicit complete-version acknowledgement required');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};

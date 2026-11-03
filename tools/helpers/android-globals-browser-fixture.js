'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{codeRebuildFixture}=require('./code-rebuild-fixture');
const root=path.resolve(__dirname,'../..');
async function androidGlobalsFixture(){
 const r=await codeRebuildFixture(),data=r.snapshot,name='meble-lf-test-rebuild-android',uid='synthetic-owner',attempt='12345678-1234-4123-8123-123456789abc';
 data.identity.receipt.name=name;data.local.rows.find(r=>r.key==='meble_application_authority_v1').raw=JSON.stringify(data.identity.receipt);
 data.databases.authority.outbox[0].localVersion=1;
 const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>button,input{min-height:44px} [hidden]{display:none!important}</style><div id="main-login"><button id="auth-google">Google</button><p id="auth-status"></p><p id="auth-error" hidden></p><button id="auth-recovery" hidden>Tryb ratunkowy — kopia LOCAL-FIRST</button><section id="auth-profile-admission" hidden><input id="auth-profile-backup" type="checkbox"><input id="auth-profile-owner" type="checkbox"><button id="auth-profile-confirm">Confirm</button><button id="auth-profile-cancel">Cancel</button></section><div id="auth-account" hidden><button id="auth-signout">Logout</button></div></div><div id="main-auth-bar" hidden><input id="main-trust-phone" type="checkbox"><span id="main-trust-status"></span><button id="main-signout">Logout</button></div><button id="auth-theme"></button><template id="business-template"></template><template id="business-styles"></template><script>window.lfReady=true;</script>`;
 const worker=`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('message',e=>{if(e.data?.type==='VERIFY_APPLICATION_AUTHORITY')e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>e.ports[0].postMessage({protocol:1,nonce:e.data.nonce,exclusive:clients.length===1})));});self.addEventListener('fetch',e=>{if(new URL(e.request.url).origin===self.location.origin)e.respondWith(fetch(e.request).then(async r=>{if(r.ok)(await caches.open('synthetic-static')).put(e.request,r.clone());return r;}).catch(async()=>{const r=await caches.match(e.request);return r||Response.error();}));});`;
 const server=http.createServer((req,res)=>{const file=new URL(req.url,'http://localhost').pathname;
  if(file==='/'){res.setHeader('content-type','text/html');res.end(html);return;}
  if(file==='/fixture-worker.js'){res.setHeader('content-type','text/javascript');res.end(worker);return;}
  if(!/^\/sync\/[a-z-]+(?:\.generated)?\.mjs$/.test(file)&&file!=='/tools/helpers/synthetic-global-rebuild.mjs'){res.writeHead(404);res.end();return;}
  try{res.setHeader('content-type','text/javascript');res.end(fs.readFileSync(path.join(root,file)));}catch(_){res.writeHead(404);res.end();}
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 async function setup(browser,{seed=false,ram=true}={}){
  const evaluate=browser.evaluate;
  if(seed)await evaluate(`(async()=>{
   const data=${JSON.stringify(data)};
   for(const row of data.local.rows)localStorage.setItem(row.key,row.raw);
   localStorage.setItem('meble_access_profile_v1',JSON.stringify({version:3,uid:${JSON.stringify(uid)},attemptId:${JSON.stringify(attempt)}}));
   sessionStorage.setItem('fc_reload_restore_v1','PRIVATE_SESSION');
   const create=(name,stores,write)=>new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);q.onupgradeneeded=()=>{for(const [name,keyPath]of stores)q.result.createObjectStore(name,keyPath?{keyPath}:undefined);};q.onsuccess=()=>{const db=q.result,tx=db.transaction(stores.map(r=>r[0]),'readwrite',{durability:'strict'});write(tx);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=reject;};q.onerror=reject;});
   await create(${JSON.stringify(name)},['control','replicas','protected','outbox'].map(n=>[n,'key']),tx=>{for(const [name,rows]of Object.entries(data.databases.authority))for(const row of rows)tx.objectStore(name).put(row);});
   await create('meble-access-profile-v1',[['ownership',null]],tx=>tx.objectStore('ownership').put({version:1,state:'active',uid:${JSON.stringify(uid)},attemptId:${JSON.stringify(attempt)}},'owner'));
   return true;
  })()`);
  for(const file of ['shared/constants','project/project-export-contract','cloud/global-data-contract','cloud/global-data-diagnostics','shared/backup-archive-format','shared/storage-recovery-export','cloud/auth-access-gate','cloud/local-access-profile','cloud/local-device-access'])await evaluate(fs.readFileSync(path.join(root,'js/app/'+file+'.js'),'utf8')+'\ntrue');
  if(seed)await evaluate(`FC.localDeviceAccess.createTrust().enroll({uid:${JSON.stringify(uid)},profileAttemptId:${JSON.stringify(attempt)},consent:true,check(){}}).then(()=>true)`);
  await evaluate(`(async()=>{
   await navigator.serviceWorker.register('/fixture-worker.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
   const nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem,nativeTx=IDBDatabase.prototype.transaction;window.fixtureNativeGet=k=>nativeGet.call(localStorage,k);window.fixtureNativeSet=(k,v)=>nativeSet.call(localStorage,k,v);
   window.fixtureSnapshot=async()=>{const q=indexedDB.open(${JSON.stringify(name)},1),db=await new Promise(resolve=>{q.onsuccess=()=>resolve(q.result);});try{
    const tables=await new Promise((resolve,reject)=>{const result={},tx=nativeTx.call(db,['control','replicas','protected','outbox'],'readonly');for(const table of ['control','replicas','protected','outbox']){const r=tx.objectStore(table).getAll();r.onsuccess=()=>{result[table]=r.result;};}tx.oncomplete=()=>resolve(result);tx.onabort=reject;});
    const {digest}=await import('/sync/local-first-values.mjs');return {hash:await digest(tables),nativeHash:await digest(Object.keys(localStorage).filter(k=>k.startsWith('fc_')||k==='meble_application_authority_v1'||k.startsWith('hardware')).sort().map(k=>[k,nativeGet.call(localStorage,k)])),phases:tables.outbox.map(r=>r.phase),imageVersion:tables.control.find(r=>r.key==='application').version};
   }finally{db.close();}};
   window.projectData=${ram?'{unsaved:"PRIVATE_ANDROID_RAM"}':'undefined'};window.uiState={entry:'investorsList'};FC.session={active:false,durable:false};
   FC.cloudAuth={create:async()=>{throw Error('Unexpected Auth SDK for trusted fixture');}};
   FC.mainBusinessLoader={create:check=>({start:async()=>check(),abort(){}})};
   document.addEventListener('DOMContentLoaded',()=>{window.__APP_STARTED__=true;});
   window.fixtureImport=async path=>{
    if(path==='../../../sync/application-runtime.mjs')return {startApplicationRuntime:async({boot,onStage,onFailureQuiescent})=>{
     onStage('initial-global-revision');try{FC.globalDataContract.capture({getItem:k=>boot.rows()[k]??null},Object.keys(FC.globalDataContract.sources));throw Object.assign(Error('Synthetic globals fault'),{code:'GLOBAL_VALUE_INVALID'});}
     catch(error){await boot.release();onFailureQuiescent();throw error;}
    }};
    if(path.startsWith('../../../sync/'))return import('/sync/'+path.split('/').at(-1));
    if(['./global-data-contract.js','./global-data-diagnostics.js','./cloud-pilot-contract.js','./firebase-global-transport.js'].includes(path))return {};
    throw Error('Unexpected fixture import');
   };
   return true;
  })()`);
  const source=fs.readFileSync(path.join(root,'js/app/cloud/application-bootstrap.js'),'utf8').replace(/\bimport\(/g,'fixtureImport(');
  await evaluate('new Function("window","document","localStorage","location","navigator","fixtureImport",'+JSON.stringify(source)+')(window,document,localStorage,location,navigator,fixtureImport);FC.applicationStartup.configureEmulator({name:'+JSON.stringify(name)+',connections:async()=>({})});true');
  await evaluate(fs.readFileSync(path.join(root,'js/main-login.js'),'utf8')+'\ntrue');
  for(let i=0;i<200;i++){if(await evaluate('document.body.dataset.authState==="error"&&!document.querySelector("#auth-recovery").hidden'))return;if(i===199)throw Error('ANDROID_FATAL_NOT_READY');await new Promise(resolve=>setTimeout(resolve,20));}
 }
 return {base,name,uid,data,setup,close:()=>new Promise(resolve=>server.close(resolve))};
}
module.exports={androidGlobalsFixture};

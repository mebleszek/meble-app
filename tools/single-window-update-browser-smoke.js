'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const execFile=require('node:util').promisify(require('node:child_process').execFile);
const BASE='eb861142cc08842ef3773e1ea3d3a14847d8ff63',read=p=>fs.readFileSync(p,'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
async function main(){
 const oldWorker=(await execFile('git',['show',BASE+':offline-worker.js'],{maxBuffer:2e6})).stdout;
 const loaderPath='js/app/cloud/main-business-loader.js',bootstrapPath='js/app/cloud/application-bootstrap.js',updatePath='js/app/cloud/offline-update.js';
 const oldLoader=(await execFile('git',['show',BASE+':'+loaderPath])).stdout;
 let phase=1,interrupt=false;const requests=[];
 function image(){return {'index.html':'<!doctype html><script>window.lfReady=true;window.DEPLOY='+phase+';</script><body></body>',
  [loaderPath]:phase===1?oldLoader:read(loaderPath),[bootstrapPath]:read(bootstrapPath),[updatePath]:read(updatePath),
  'js/first.js':phase===3?'window.startOrder=["changed"];':'window.startOrder=["first"];',
  'js/second.js':'window.startOrder.push("second");','js/known-error.js':'window.knownError=Object.assign(new Error("AUTH_ACCESS_REVOKED"),{code:"AUTH_ACCESS_REVOKED"});throw window.knownError;','js/broken.js':'throw new ReferenceError("PRIVATE_EXCEPTION_UID_PRICE");',
  'js/app/cloud/offline-writer-fence.js':read('js/app/cloud/offline-writer-fence.js')};}
 function manifest(){const files=Object.entries(image()).map(([file,body])=>({path:file,bytes:Buffer.byteLength(body),sha256:hash(body)}));return {version:hash(JSON.stringify(files)),files};}
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';let body;
  requests.push({phase,name});if(name==='offline-worker.js')body=phase===1?oldWorker:read('offline-worker.js');else if(name==='offline-assets.js')body='self.MEBLE_OFFLINE_ASSETS='+JSON.stringify(manifest())+';';else if(name==='sw-update.html')body=read(name);else if(name==='js/denied.js'){res.writeHead(423);res.end('APPLICATION_WRITE_LOCKED');return;}else body=image()[name];
  if(body===undefined){res.writeHead(404);res.end();return;}if(interrupt&&name==='js/first.js')body='BAD_INSTALL_BYTES';res.writeHead(200,{'content-type':name.endsWith('.js')?'text/javascript':'text/html','cache-control':'no-store'});res.end(body);
 });
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-single-window-'));let browser,secondary;
 const until=async expression=>{for(let i=0;i<500;i++){try{if(await browser.evaluate('(async()=>('+expression+'))()'))return;}catch(_){}await new Promise(r=>setTimeout(r,20));}throw Error('CONDITION_TIMEOUT '+expression);};
 const navigate=async(url,condition)=>{await browser.evaluate('window.__oldDocument=true');await browser.send('Page.navigate',{url});await until('window.__oldDocument!==true&&('+condition+')');};
 const load=file=>browser.evaluate(`(async()=>{(0,eval)(await (await fetch(${JSON.stringify(file)})).text());return true;})()`);
 const snapshot=`(async()=>{const q=indexedDB.open('synthetic-private-integrity',1);const db=await new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=reject;});try{return {raw:Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]),idb:await new Promise((resolve,reject)=>{const tx=db.transaction('records','readonly'),r=tx.objectStore('records').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=reject;})};}finally{db.close();}})()`;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/';
  const {openBrowserDevice}=await import('./helpers/local-first-browser.mjs');browser=await openBrowserDevice({base},dir);
  await browser.evaluate(`(async()=>{localStorage.setItem('fc_sheet_materials_v1','[{"id":"private","price":0,"note":"KEEP_PRIVATE_CATALOGUE"}]');localStorage.setItem('fc_projects_v1','[{"id":"private-project","raw":"KEEP"}]');const q=indexedDB.open('synthetic-private-integrity',1);q.onupgradeneeded=()=>q.result.createObjectStore('records',{keyPath:'id'});const db=await new Promise(r=>q.onsuccess=()=>r(q.result));await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put({id:'private',outbox:'KEEP_PENDING',catalogue:'KEEP_RAW'});tx.oncomplete=resolve;tx.onabort=reject;});db.close();await navigator.serviceWorker.register('offline-worker.js',{scope:'./',updateViaCache:'none'});await navigator.serviceWorker.ready;return true;})()`);
  await navigate(base+'index.html?old','!!navigator.serviceWorker.controller');
  await browser.evaluate(`(async()=>{const c=new MessageChannel();return new Promise(resolve=>{c.port1.onmessage=e=>{c.port1.close();resolve(e.data.owned)};navigator.serviceWorker.controller.postMessage({type:'APPLICATION_WRITER_FENCE',protocol:2,nonce:'test'},[c.port2]);});})()`);
  const before=await browser.evaluate(snapshot);
  await load(bootstrapPath);await load(loaderPath);
  const old=await browser.evaluate(`(async()=>{try{await FC.mainBusinessLoader.create(()=>{},()=>{}).start([{src:'js/broken.js',group:'app-runtime'}]);return null;}catch(e){return FC.applicationStartup.errorCode(e);}})()`);assert.equal(old,'UNRECOGNIZED_ERROR');
  await browser.evaluate(`window.unsaved='KEEP_RAM';const e=document.createElement('input');e.id='dirty';e.value='KEEP_UNSAVED_FORM';document.body.append(e);`);
  phase=2;const expected=manifest().version;const beforeUpdate=requests.length;
  await browser.evaluate(`(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();return true;})()`);await until('(await navigator.serviceWorker.getRegistration()).waiting!==null');
  assert.deepEqual(await browser.evaluate(snapshot),before);assert.equal(await browser.evaluate('document.getElementById("dirty").value'), 'KEEP_UNSAVED_FORM');assert.equal(await browser.evaluate('window.unsaved'),'KEEP_RAM');
  assert.equal(requests.slice(beforeUpdate).filter(r=>r.phase===2&&['js/first.js','js/second.js','js/broken.js'].includes(r.name)).length,0,'Unchanged verified resources must not be fetched again');
  // A deliberately unauthorized second tab must retain the existing writer-fence refusal.
  const target=await browser.send('Target.createTarget',{url:'about:blank'});
  const targets=await(await fetch('http://127.0.0.1:'+new URL(browser.endpoint).port+'/json/list')).json();secondary=new WebSocket(targets.find(t=>t.id===target.targetId).webSocketDebuggerUrl);await new Promise(r=>secondary.onopen=r);
  let serial=0;const pending=new Map();secondary.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});secondary.send(JSON.stringify({id,method,params}));});
  await send('Page.navigate',{url:base+'index.html'});let denied=false;
  for(let i=0;i<100;i++){const result=await send('Runtime.evaluate',{expression:'document.body?.textContent',returnByValue:true});if(result.result.value?.includes('APPLICATION_WRITE_LOCKED')){denied=true;break;}await new Promise(r=>setTimeout(r,20));}assert.equal(denied,true);
  // Explicit fixture decision ends the synthetic edit; installation never does so.
  await browser.evaluate('window.unsaved=null;document.getElementById("dirty").remove();');
  await navigate(base+'sw-update.html','document.getElementById("sw-update-status")?.dataset.state==="ready"');
  await browser.evaluate('document.getElementById("sw-update-apply").click()');await until('document.getElementById("sw-update-status")?.dataset.reason==="ACTIVATION_BLOCKED"');assert.equal(await browser.evaluate('location.protocol'),'http:');
  await browser.send('Target.closeTarget',{targetId:target.targetId});secondary.close();secondary=null;
  await browser.evaluate('document.getElementById("sw-update-check").click()');await until('document.getElementById("sw-update-status")?.dataset.state==="ready"');
  const targetId=browser.targetId;await browser.evaluate('document.getElementById("sw-update-apply").click()');await until('location.protocol==="blob:"');assert.equal(await browser.evaluate('!!navigator.serviceWorker.controller'),false);assert.ok(await browser.evaluate('document.querySelector("a").getBoundingClientRect().height>=44'));
  await browser.evaluate('document.querySelector("a").click()');await until('document.getElementById("sw-update-status")?.dataset.state==="activated"');assert.equal(await browser.evaluate('new URL(location.href).searchParams.get("expected")'),expected);
  assert.equal(browser.targetId,targetId);assert.equal((await browser.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page').length,1);assert.deepEqual(await browser.evaluate(snapshot),before);
  await browser.evaluate('document.getElementById("sw-update-return").click()');await until('window.DEPLOY===2');
  await browser.send('Network.enable');await browser.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await load(bootstrapPath);await load(loaderPath);
  const observation=await browser.evaluate(`(async()=>{try{await FC.mainBusinessLoader.create(()=>{},e=>FC.applicationStartup.recordFailure(e,'loading-business-scripts')).start([{src:'js/first.js',group:'startup-foundation'},{src:'js/second.js',group:'app-runtime'},{src:'js/broken.js',group:'app-runtime'}]);}catch(e){}return {order:window.startOrder,diagnostic:FC.applicationStartup.diagnostics()};})()`);
  assert.deepEqual(observation.order,['first','second']);assert.equal(observation.diagnostic.firstError.code,'AUTH_SCRIPT_EXECUTION');assert.equal(observation.diagnostic.firstError.script.index,3);assert.equal(observation.diagnostic.firstError.script.name,'ReferenceError');assert.equal(JSON.stringify(observation).includes('PRIVATE_EXCEPTION_UID_PRICE'),false);assert.deepEqual(await browser.evaluate(snapshot),before);
  await browser.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await navigate(base+'index.html?fetch-failure','window.DEPLOY===2');await load(bootstrapPath);await load(loaderPath);
  const refused=await browser.evaluate(`(async()=>{try{window.testLoader=FC.mainBusinessLoader.create(()=>{},e=>FC.applicationStartup.recordFailure(e,'loading-business-scripts'));await window.testLoader.start([{src:'js/denied.js',group:'app-runtime'}]);}catch(e){FC.applicationStartup.recordFailure(e,'loading-business-scripts');}return FC.applicationStartup.diagnostics().firstError;})()`);assert.equal(refused.code,'AUTH_SCRIPT_LOCKED');assert.equal(refused.script.status,423);
  const known=await browser.evaluate(`(async()=>{try{await window.testLoader.start([{src:'js/known-error.js',group:'app-runtime'}]);}catch(e){return e===window.knownError&&e.code==='AUTH_ACCESS_REVOKED';}return false;})()`);assert.equal(known,true,'Known domain/Auth errors must preserve identity and existing recovery semantics');
  phase=3;interrupt=true;const failedVersion=manifest().version;
  await browser.evaluate('(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();return true;})()');await until('(await navigator.serviceWorker.getRegistration()).installing===null');
  assert.equal(await browser.evaluate('(async()=>(await navigator.serviceWorker.getRegistration()).waiting===null)()'),true);assert.equal(await browser.evaluate(`(async()=>(await caches.keys()).includes('meble-static-'+${JSON.stringify(failedVersion)}))()`),false);assert.deepEqual(await browser.evaluate(snapshot),before);
  console.log('single-window-update-browser: 8/8 PASS; old/new worker, verified reuse, dirty RAM, 423 second tab, natural blob activation in one target, offline ordered startup, private diagnostics, interrupted install and exact RAW/IDB/catalogues');
 }finally{secondary?.close();try{await browser?.close();}finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}}
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={main};

'use strict';
// Two real public deployments, one private Chromium profile; no Firebase RPC.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const execFile=require('node:util').promisify(require('node:child_process').execFile);
const {browser}=require('./trusted-session-browser-smoke');
async function main(){
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-sw-upgrade-')),old=path.join(dir,'old'),profile=path.join(dir,'profile');fs.mkdirSync(old);
 const archive=path.join(dir,'old.tar');
 await execFile('git',['archive','-o',archive,'2930e0d769d9576d387764af439eab7df9fd5636'],{cwd:root,timeout:30000});
 await execFile('tar',['-xf',archive,'-C',old],{timeout:30000});
 let deployment=old,one,stopped=false,heldAsset=false,releasedAsset=false,delayTimer;
 const server=http.createServer((req,res)=>{try{const pathname=new URL(req.url,'http://127.0.0.1').pathname,file=path.resolve(deployment,'.'+pathname);if(!file.startsWith(deployment+path.sep))throw Error();const data=fs.readFileSync(file);
  const respond=()=>{res.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'image/jpeg','cache-control':'no-store'});res.end(data);};
  // Real SW install fetch, not a page timer or mocked registration. Exceed the
  // former shared deadline while the same old dirty application stays open.
  if(deployment===root&&!heldAsset&&pathname==='/assets/branding/MebLeszek_logo_oryginal.jpg'){
   heldAsset=true;console.log('START real Chromium: hold one manifest download for 32s');
   delayTimer=setTimeout(()=>{releasedAsset=true;respond();},32000);
  }else respond();
 }catch(_){res.writeHead(404);res.end();}});
 try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const base='http://127.0.0.1:'+server.address().port;
 one=await browser(profile,base+'/index.html',{inject:true});await one.until('document.body.dataset.authState==="unauthenticated"');await one.tap('auth-google');await one.until('document.body.dataset.businessState==="ready"');
 await one.tap('main-trust-phone');await one.until('document.getElementById("main-trust-phone").checked&&!document.getElementById("main-trust-phone").disabled');await one.until('__AUTH_INPUT_DIAGNOSTICS__().mode==="trusted"&&__FC_MAIN_ACCESS__.isValid()');
 const fixtures=require('./project-navigation-blockers-smoke'),fixture=fixtures.fixture();fixtures.offers(fixture);const source=fixture.seed();
 const seed=Object.fromEntries(['fc_investors_v1','fc_projects_v1','fc_quote_snapshots_v1'].map(key=>[key,source[key]]));seed.fc_quote_offer_drafts_v1=JSON.stringify([{projectId:'P',investorId:'K',syntheticPrice:12.125}]);
 await one.evaluate(`(()=>{for(const [k,v]of Object.entries(${JSON.stringify(seed)}))localStorage.setItem(k,v);const fc=window.FC;fc.projectStore.setCurrentProjectId('P');projectData=fc.project.load();window.projectData=projectData;fc.views.openInvestorsList();})()`);

 const raw=()=>one.evaluate('JSON.stringify(Object.keys(localStorage).filter(k=>k.startsWith("fc_")&&!["fc_ui_v1","fc_current_investor_v1","fc_current_project_id_v1"].includes(k)).sort().map(k=>[k,localStorage.getItem(k)]))');let before;
 assert.equal(await one.evaluate('!!document.querySelector("[data-action=remove-investor-from-list]")'),false);
 const cache=await one.evaluate('window.FC.offlineShell.prepare().then(r=>r.version)');
 // An old client cannot acquire new UI by an import or forced takeover.
 await one.evaluate(`(async()=>{const fc=window.FC,inv=fc.investors.readAll()[0];if(await fc.actions.dispatch('open-investor',{element:{getAttribute:()=>inv.id}})!==true)throw Error('Open refused');fc.investorEditorState.enter(inv);fc.investorEditorState.setField('name','EXACT UNSAVED RAM');fc.investorUI.render();})()`);
 await one.evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('synthetic-safe-sw-data',1);r.onupgradeneeded=()=>r.result.createObjectStore('rows');r.onerror=reject;r.onsuccess=()=>{const db=r.result,tx=db.transaction('rows','readwrite',{durability:'strict'});tx.objectStore('rows').put('EXACT-IDB-12.125','saved');tx.oncomplete=()=>{db.close();resolve(true);};tx.onabort=reject;};})`);
 before=await raw(); // Baseline after intentional fixture activation/edit setup, before deployment.
 deployment=root;
 const endpoint=await one.evaluate('location.origin');assert.equal(endpoint,base);
 // Public recovery URL is not in the old worker cache allowlist. Same browser
 // process via CDP Target: the old dirty page stays open throughout detection.
 const target=await one.send('Target.createTarget',{url:'about:blank'});
 // Inspect the new bootstrap target in the same owned process.
 const targets=await(await fetch('http://127.0.0.1:'+new URL(one.endpoint).port+'/json/list')).json();
 const ws=new WebSocket(targets.find(t=>t.id===target.targetId).webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let serial=0;const pending=new Map(),resources=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}else if(m.method==='Network.requestWillBeSent')resources.push({type:m.params.type,initiator:m.params.initiator.type});};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('Update test CDP timeout: '+method));},30000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 await send('Page.enable');await send('Network.enable');await send('Page.navigate',{url:base+'/sw-update.html'});
 const started=Date.now();let longInstallSeen=false;
 while(Date.now()-started<90000){
  const status=await evaluate('(()=>{const s=document.getElementById("sw-update-status");return s?{...s.dataset}:null;})()');
  if(status&&status.state!=='checking'){assert.equal(status.state,'ready',JSON.stringify(status));break;}
  if(Date.now()-started>30000&&heldAsset&&!releasedAsset){
   assert.equal(status.state,'checking');assert.equal(status.stage,'installation');longInstallSeen=true;
  }
  await new Promise(r=>setTimeout(r,50));
 }
 assert.equal(longInstallSeen,true,'Real installation >30s must remain checking, without false FAIL');assert.equal(releasedAsset,true);
 assert.equal(await evaluate('document.getElementById("sw-update-status").dataset.state'),'ready');
 assert.equal(await evaluate('document.getElementById("sw-update-status").dataset.reason'),'NONE');
 console.log('PASS real Chromium: delayed installation >30s then complete active/waiting ACK');
 assert.equal(await evaluate('document.getElementById("sw-update-active-version").textContent'),cache);
 assert.equal(await evaluate('document.getElementById("sw-update-waiting-version").textContent'),require('./offline-assets').manifest().version);
 assert.equal(await evaluate('document.getElementById("sw-update-help").hidden'),false);
 assert.equal(resources.filter(r=>r.type==='Stylesheet'||r.type==='Script'&&r.initiator==='parser').length,0,'Network page must not depend on a script or style from the old cache');
 assert.equal(await one.evaluate('window.FC.investorEditorState.state.draft.name'),'EXACT UNSAVED RAM');assert.equal(await raw(),before);
 assert.equal(await one.evaluate('window.FC.offlineShell.prepare().then(r=>r.version)'),cache);
 await send('Page.bringToFront');await send('Emulation.setTouchEmulationEnabled',{enabled:true});
 for(const width of [320,360,412]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:852,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true,'No update-page overflow at '+width);
  assert.equal(await evaluate('document.getElementById("sw-update-check").getBoundingClientRect().height>=44'),true);
 }
 const point=await evaluate('(()=>{const r=document.getElementById("sw-update-check").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 for(let i=0;i<200&&!(await evaluate('!document.getElementById("sw-update-check").disabled'));i++)await new Promise(r=>setTimeout(r,50));
 assert.equal(await evaluate('document.getElementById("sw-update-status").dataset.state'),'ready');
 assert.equal(await evaluate('document.getElementById("sw-update-help").hidden'),false);
 // A loaded network page also gives a truthful result after actual loss of
 // connectivity. Rechecks are explicit native gestures, never a browser retry.
 async function recheck(){
  const p=await evaluate('(()=>{const r=document.getElementById("sw-update-check").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  for(let i=0;i<200&&!(await evaluate('!document.getElementById("sw-update-check").disabled'));i++)await new Promise(r=>setTimeout(r,50));
 }
 await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await send('Network.overrideNetworkState',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 assert.equal(await evaluate('navigator.onLine'),false);await recheck();assert.equal(await evaluate('document.getElementById("sw-update-status").dataset.state'),'offline');
 assert.equal(await evaluate('document.getElementById("sw-update-status").dataset.reason'),'OFFLINE');
 await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await send('Network.overrideNetworkState',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await recheck();assert.equal(await evaluate('document.getElementById("sw-update-status").dataset.state'),'ready');
 ws.close();
 await one.send('Target.closeTarget',{targetId:target.targetId});
 await one.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update())');
 assert.equal(await one.evaluate('window.FC.investorEditorState.state.draft.name'),'EXACT UNSAVED RAM');
 // Explicit safe user decision: the synthetic draft is accounted for; close
 // all app tabs. No product code reloads, closes or writes this draft.
 assert.equal(await one.evaluate('window.FC.investorEditorState.hasUiLock()'),true);
 await one.evaluate('window.FC.investorEditorState.exit(window.FC.investors.readAll()[0]);window.FC.views.openInvestorsList();true');await one.close();one=null;await new Promise(r=>server.close(r));stopped=true;
 one=await browser(profile,base+'/index.html',{offline:true});await one.until('document.body.dataset.businessState==="ready"');
 await one.evaluate('window.FC.views.openInvestorsList();true');assert.equal(await one.evaluate('!!document.querySelector("[data-action=remove-investor-from-list]")'),true);
 assert.equal(await raw(),before,'Same profile must retain business RAW through upgrade');
 assert.notEqual(await one.evaluate('window.FC.offlineShell.prepare().then(r=>r.version)'),cache);
 assert.equal(await one.evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('synthetic-safe-sw-data',1);r.onerror=reject;r.onsuccess=()=>{const db=r.result,tx=db.transaction('rows'),q=tx.objectStore('rows').get('saved');tx.oncomplete=()=>{db.close();resolve(q.result);};tx.onabort=reject;};})`),'EXACT-IDB-12.125');

 console.log('PASS real old-SW → independent network page/active+waiting hashes/native retry/320,360,412px → dirty RAM/multiple clients protected → natural activation/new offline shell/Delete/exact RAW+IDB');
 }finally{clearTimeout(delayTimer);await one?.close();if(!stopped){server.closeAllConnections();await new Promise(r=>server.close(r));}fs.rmSync(dir,{recursive:true,force:true});}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};

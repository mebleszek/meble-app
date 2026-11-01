'use strict';
// Two real public deployments, one private Chromium profile; no Firebase RPC.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {browser}=require('./trusted-session-browser-smoke');
async function main(){
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-sw-upgrade-')),old=path.join(dir,'old'),profile=path.join(dir,'profile');fs.mkdirSync(old);
 execFileSync('tar',['-x','-C',old],{input:execFileSync('git',['archive','2930e0d769d9576d387764af439eab7df9fd5636'],{cwd:root,maxBuffer:64*1024*1024})});
 let deployment=old,one,stopped=false;const server=http.createServer((req,res)=>{try{const pathname=new URL(req.url,'http://127.0.0.1').pathname,file=path.resolve(deployment,'.'+pathname);if(!file.startsWith(deployment+path.sep))throw Error();const data=fs.readFileSync(file);res.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'image/jpeg','cache-control':'no-store'});res.end(data);}catch(_){res.writeHead(404);res.end();}});
 try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
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
 const target=await one.send('Target.createTarget',{url:base+'/sw-update.html'});
 await one.until('navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)');
 assert.equal(await one.evaluate('window.FC.investorEditorState.state.draft.name'),'EXACT UNSAVED RAM');assert.equal(await raw(),before);
 assert.equal(await one.evaluate('window.FC.offlineShell.prepare().then(r=>r.version)'),cache);
 // Inspect the new bootstrap target in the same owned process.
 const targets=await(await fetch('http://127.0.0.1:'+new URL(one.endpoint).port+'/json/list')).json();
 const ws=new WebSocket(targets.find(t=>t.id===target.targetId).webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let serial=0;const pending=new Map();
 ws.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 for(let i=0;i<200&&!(await evaluate('!!document.querySelector("#offline-update-notice:not([hidden])")'));i++)await new Promise(r=>setTimeout(r,50));
 assert.equal(await evaluate('document.querySelector("#offline-update-notice").hidden'),false);
 await send('Page.bringToFront');await send('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true});const point=await evaluate('(()=>{const r=document.querySelector("#offline-update-notice button").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await evaluate('document.querySelector("#offline-update-notice p").hidden'),false);ws.close();
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

 console.log('PASS real old-SW → deploy → multiple clients/dirty RAM protected → all clients closed → new offline shell, visible Delete and exact business RAW');
 }finally{await one?.close();if(!stopped)await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};

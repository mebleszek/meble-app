'use strict';
// Real old/new public shells and worker, same disposable Chromium profile.
// Owner/loader/runtime boundaries use the existing synthetic recovery fixture.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const execFile=require('node:util').promisify(require('node:child_process').execFile);
const {androidGlobalsFixture}=require('./android-globals-browser-fixture');
const {documentNavigation,waitForGesturePoint}=require('./browser-test-readiness');
const root=path.resolve(__dirname,'../..'),OLD='317cfce2d43ac5ae4c9ed92c306d5c04d73b3f74';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-recovery-upgrade-')),old=path.join(dir,'old');fs.mkdirSync(old);
 let device,server,phase='ARCHIVE';
 async function until(test,label,ms=90000){const end=Date.now()+ms;while(Date.now()<end){if(await test())return;await pause(40);}throw Error('RECOVERY_UPGRADE_TIMEOUT_'+label);}
 try{
  await execFile('git',['archive','-o',path.join(dir,'old.tar'),OLD],{cwd:root,timeout:30000});
  await execFile('tar',['-xf',path.join(dir,'old.tar'),'-C',old],{timeout:30000});
  let deployment=old;server=await androidGlobalsFixture({deployment:()=>deployment});
  const origin=server.base,{openBrowserDevice}=await import('./local-first-browser.mjs');
  device=await openBrowserDevice({base:origin+'/fixture-host.html'},path.join(dir,'profile'));
  const responses=[],workers=new Map();let navigations=0;
  const navigation=documentNavigation(device.send);
  device.onEvent(event=>{navigation.event(event);
   if(event.method==='Network.responseReceived')responses.push({url:event.params.response.url,worker:event.params.response.fromServiceWorker===true,deployment:deployment===root?'new':'old'});
   if(event.method==='ServiceWorker.workerVersionUpdated')for(const version of event.params.versions)workers.set(version.versionId,version);
   if(event.method==='Page.frameNavigated'&&!event.params.frame.parentId)navigations++;
  });
  await device.send('Network.enable');await device.send('ServiceWorker.enable');
  async function source(file){return device.evaluate(`fetch('/'+${JSON.stringify(file)}).then(r=>{if(!r.ok)throw Error('UPGRADE_SOURCE_UNAVAILABLE');return r.text();})`);}
  async function run(file){const bytes=await source(file);assert.equal(bytes,fs.readFileSync(path.join(deployment,file),'utf8'));await device.evaluate(bytes+'\ntrue');}
  async function shellDocument(){
   // Load genuine cached HTML/URLs, then compose the same synthetic startup
   // boundary as the existing recovery test. No SDK/Firebase RPC is allowed.
   await device.send('Emulation.setScriptExecutionDisabled',{value:true});
   try{await navigation.navigate(origin+'/index.html');}finally{await device.send('Emulation.setScriptExecutionDisabled',{value:false});}
   assert.equal(await device.evaluate('typeof __FC_MAIN_ACCESS__'),'undefined');
  }
  async function ack(slot){return device.evaluate(`(async()=>{const registration=await navigator.serviceWorker.getRegistration();const worker=registration[${JSON.stringify(slot)}];if(!worker)return null;
   return new Promise((resolve,reject)=>{const c=new MessageChannel(),timer=setTimeout(()=>{c.port1.close();reject(Error('UPGRADE_ACK_TIMEOUT'));},15000);c.port1.onmessage=e=>{clearTimeout(timer);c.port1.close();resolve(e.data);};worker.postMessage({type:'VERIFY_STATIC_SHELL'},[c.port2]);});})()`);}
  async function click(selector){const point=await waitForGesturePoint(device.evaluate,selector,{stable:true});await device.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await device.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});}
  phase='OLD_INSTALL';await run('js/app/cloud/offline-shell.js');
  const oldVersion=await device.evaluate('FC.offlineShell.prepare().then(r=>r.version)');
  assert.match(oldVersion,/^[a-f0-9]{64}$/);const newVersion=require('../offline-assets').manifest().version;assert.notEqual(oldVersion,newVersion);
  await shellDocument();assert.equal(await device.evaluate('!!document.getElementById("auth-recovery")'),false);
  assert.equal(await device.evaluate('navigator.serviceWorker.controller?.scriptURL'),origin+'/offline-worker.js');
  await server.setup(device,{seed:true,registerWorker:false,fetchSources:true,fatal:false});
  await run('js/app/cloud/offline-shell.js');await run('js/app/cloud/offline-update.js');
  assert.deepEqual(await ack('active'),{complete:true,version:oldVersion});
  await until(()=>[...workers.values()].some(w=>w.scriptURL===origin+'/offline-worker.js'&&w.status==='activated'),'OLD_ACTIVATED');
  const oldWorker=[...workers.values()].find(w=>w.scriptURL===origin+'/offline-worker.js'&&w.status==='activated').versionId;
  const before=await device.evaluate('fixtureSnapshot()');assert.ok(before.phases.includes('uncertain'));
  await device.evaluate(`window.upgradeDocument=crypto.randomUUID();window.upgradeController=navigator.serviceWorker.controller;window.upgradeControllerChanges=0;
   navigator.serviceWorker.addEventListener('controllerchange',()=>upgradeControllerChanges++);
   projectData.unsaved={price:12.125,notes:'SYNTHETIC UNSAVED RAM'};window.upgradeInput=document.createElement('input');upgradeInput.value='SYNTHETIC UNSAVED INPUT';document.body.append(upgradeInput);true`);
  const ram=await device.evaluate('({document:upgradeDocument,project:JSON.stringify(projectData),input:upgradeInput.value})'),navigationBefore=navigations;
  phase='NEW_WAITING_DIRTY_DOCUMENT';deployment=root;
  await device.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update()).then(()=>true)');
  await until(()=>device.evaluate('!!document.getElementById("offline-update-notice")&&!document.getElementById("offline-update-notice").hidden'),'UPDATE_NOTICE');
  assert.deepEqual(await ack('active'),{complete:true,version:oldVersion});assert.deepEqual(await ack('waiting'),{complete:true,version:newVersion});
  await click('#offline-update-notice button');assert.equal(await device.evaluate('document.querySelector("#offline-update-notice p").hidden'),false);
  await device.evaluate('document.dispatchEvent(new Event("visibilitychange"));true');
  await until(()=>[...workers.values()].some(w=>w.versionId!==oldWorker&&w.scriptURL===origin+'/offline-worker.js'&&w.status==='installed'),'NEW_INSTALLED');
  const waitingWorker=[...workers.values()].find(w=>w.versionId!==oldWorker&&w.scriptURL===origin+'/offline-worker.js'&&w.status==='installed').versionId;
  assert.equal(navigations,navigationBefore,'Update/notice must never navigate the dirty document');
  assert.deepEqual(await device.evaluate('({document:upgradeDocument,project:JSON.stringify(projectData),input:upgradeInput.value})'),ram);
  assert.equal(await device.evaluate('upgradeControllerChanges===0&&navigator.serviceWorker.controller===upgradeController'),true);
  assert.equal(await device.evaluate('typeof __FC_RECOVERY_ACCESS__'), 'undefined','No new code execution in the already loaded old document');
  assert.equal(await device.evaluate('!!document.getElementById("auth-recovery")'),false);
  assert.deepEqual(await device.evaluate('fixtureSnapshot()'),before);
  assert.equal(await device.evaluate(`(async()=>{const cache=await caches.open('meble-static-'+${JSON.stringify(newVersion)}),response=await cache.match(location.origin+'/js/main-login.js');return response?.text();})()`),fs.readFileSync(path.join(root,'js/main-login.js'),'utf8'));
  console.log('PASS recovery upgrade Chromium: real BASE worker and full old/new manifests, waiting-version ACK/notice/native click; dirty old document/input/RAM/controller/RAW/all four IDB stores/uncertain outbox unchanged, no forced reload or new code activation');
  phase='NATURAL_ACTIVATION';
  // The test explicitly accounts for/discards its synthetic draft after all
  // preservation assertions. Product code never saves, clears or closes it.
  await device.evaluate('delete projectData.unsaved;upgradeInput.remove();true');
  await navigation.navigate('about:blank');
  await until(()=>workers.get(waitingWorker)?.status==='activated','NATURAL_ACTIVATION');
  phase='NEW_FATAL_RECOVERY';await shellDocument();
  assert.equal(await device.evaluate('!!document.getElementById("auth-recovery")'),true);
  await server.setup(device,{registerWorker:false,fetchSources:true});
  assert.equal(await device.evaluate('__FC_MAIN_ACCESS__.isValid()'),false);
  assert.equal(await device.evaluate('FC.applicationStartup.diagnostics().firstError.stage'),'initial-global-revision');
  assert.deepEqual(await ack('active'),{complete:true,version:newVersion});assert.equal(await ack('waiting'),null);
  await click('#auth-recovery');await until(()=>device.evaluate('!!document.querySelector("[data-local-first-rescue]")'),'RECOVERY_PANEL');
  assert.equal(await device.evaluate('__FC_RECOVERY_ACCESS__.isValid()'),true);
  assert.equal(await device.evaluate('document.querySelector("[data-local-first-rescue] input[type=password]")?.type'),'password');
  assert.equal(await device.evaluate('document.querySelector("[data-local-first-rescue] input[type=file]")?.type'),'file');
  assert.equal(await device.evaluate('document.querySelector("[data-rescue-status]").dataset.rescueStatus'),'BACKUP_PENDING');
  assert.equal(await device.evaluate('(()=>{try{localStorage.setItem("fc_update_forbidden","x");return false;}catch(_){return true;}})()'),true);
  assert.equal(await device.evaluate('__FC_MAIN_ACCESS__.isValid()'),false);assert.deepEqual(await device.evaluate('fixtureSnapshot()'),before);
  for(const file of ['/index.html','/js/main-login.js','/js/app/cloud/application-bootstrap.js','/sync/local-first-recovery-ui.mjs'])assert.ok(responses.some(r=>new URL(r.url).pathname===file&&r.worker&&r.deployment==='new'),'New resource delivered by real cached worker: '+file);
  console.log('PASS recovery upgrade Chromium: same profile, natural activation after explicit safe departure, genuine new cached HTML/main/bootstrap/UI, fatal globals and authorized read-only rescue panel; exact original RAW/IDB/outbox preserved, no business WRITE');
 }catch(error){throw Error(phase+': '+error.message);}
 finally{try{await device?.close();}finally{await server?.close();fs.rmSync(dir,{recursive:true,force:true});}}
}
module.exports={main};

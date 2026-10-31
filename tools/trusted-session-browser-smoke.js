'use strict';
// Actual Chromium, CryptoKey/IndexedDB and Service Worker. Google and its
// read-only authorization RPC are explicit injected SDK fixtures, never LIVE.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {startBrowser}=require('./helpers/chromium-runtime');
const {documentNavigation,waitForGesturePoint,observeGesture}=require('./helpers/browser-test-readiness');
const {installAuthInputDiagnostics,authModuleType}=require('./helpers/auth-input-diagnostics');
const {inspectTrustStorage,closeBrowserForRestart}=require('./helpers/trusted-cold-start');
const root=path.resolve(__dirname,'..');
const injection='('+installAuthInputDiagnostics.toString()+')();\n'+`(()=>{
 const RealDate=Date;let offset=0;window.Date=class extends RealDate{static now(){return RealDate.now()+offset;}};window.advanceClock=n=>offset+=n;
 window.authCalls=0;window.popupCalls=0;window.probeReads=0;window.probeTransactions=0;window.grant=true;window.rawGet=Storage.prototype.getItem;
 let options;Object.defineProperty(window,'FC_AUTH_TEST_OPTIONS',{get:()=>options,set:v=>{options={...v,target:'emulator',firebaseConfig:{apiKey:'demo',projectId:'demo-meble-app',appId:'demo',authDomain:'demo.invalid'},emulator:{host:'127.0.0.1',port:19099,firestorePort:18080},sdk:{
 app:{initializeApp:config=>{window.authCalls++;return {options:config};},deleteApp:async()=>{}},
 auth:{inMemoryPersistence:class Memory{},initializeAuth:app=>({app,currentUser:null,listeners:new Set()}),setPersistence:async()=>{},connectAuthEmulator(){},
 onAuthStateChanged(a,fn){a.listeners.add(fn);queueMicrotask(()=>fn(a.currentUser));return()=>a.listeners.delete(fn);},
 GoogleAuthProvider:class{setCustomParameters(p){if(p.prompt!=='select_account')throw Error('Account choice required');}},
 signInWithPopup:async a=>{window.popupCalls++;a.currentUser={uid:window.testAccount||'synthetic-phone-owner',providerData:[{providerId:'google.com'}]};for(const fn of a.listeners)fn(a.currentUser);return {user:a.currentUser};},
 signOut:async a=>{a.currentUser=null;for(const fn of a.listeners)fn(null);}},
 firestore:{memoryLocalCache:()=>({kind:'memory'}),initializeFirestore:(app,settings)=>{if(settings.localCache.kind!=='memory')throw Error('Memory-only Firestore required');return {app};},connectFirestoreEmulator(){},doc:(_db,_c,id)=>({id}),
 getDocFromServer:async ref=>{window.probeReads++;return {id:ref.id,metadata:{fromCache:false,hasPendingWrites:false},exists:()=>window.grant,data:()=>({schemaVersion:1})};},
 runTransaction:async(db,fn)=>{window.probeTransactions++;return fn({get:async ref=>({id:ref.id,metadata:{fromCache:false,hasPendingWrites:false},exists:()=>window.grant,data:()=>({schemaVersion:1})})});},terminate:async()=>{}}
 }};}});
})();`;
async function browser(profile,url,{offline=false,inject=false}={}){
 const owner=await startBrowser({profileDir:profile}),targets=await(await fetch('http://127.0.0.1:'+new URL(owner.endpoint).port+'/json/list')).json();
 const pages=targets.filter(t=>t.type==='page'),target=pages.find(t=>t.url==='about:blank')||pages[0];
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 const pending=new Map();let serial=0,closing;
 let navigation,startup=true,unexpectedTarget=false;const startupCloses=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else{navigation?.event(m);if(m.method==='Target.targetCreated'&&m.params.targetInfo.type==='page'&&m.params.targetInfo.targetId!==target.id){if(startup){const closing=send('Target.closeTarget',{targetId:m.params.targetInfo.targetId}).then(r=>assert.equal(r.success,true));startupCloses.push(closing);closing.catch(()=>{});}else unexpectedTarget=true;}}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP '+method));},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const settleTargets=async()=>{if(startup){startup=false;await Promise.all(startupCloses);assert.equal((await send('Target.getTargets')).targetInfos.filter(t=>t.type==='page').length,1);}assert.equal(unexpectedTarget,false,'Unexpected page after disposable-browser startup');};
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'Browser assertion failed');return r.result.value;};
 const until=async expression=>{for(let i=0;i<600;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Browser timeout '+expression+' '+JSON.stringify(await evaluate('({auth:document.body?.dataset.authState,business:document.body?.dataset.businessState,input:typeof __AUTH_INPUT_DIAGNOSTICS__==="function"?__AUTH_INPUT_DIAGNOSTICS__():null})')));};
 try{
  // Chromium can restore old tabs alongside the explicit about:blank after
  // a profile restart. Own exactly one foreground test tab; never run native
  // input in an arbitrary restored/background target. Only this disposable
  // subprocess/profile is touched, before any navigation or business setup.
  await send('Target.setDiscoverTargets',{discover:true});
  await Promise.all(startupCloses);
  await send('Page.enable');await send('Page.bringToFront');await send('Network.enable');
  // Cold startup gets read-only instrumentation, never the SDK/Google fixture.
  await send('Page.addScriptToEvaluateOnNewDocument',{source:inject?injection:'('+installAuthInputDiagnostics.toString()+')();'});
  if(offline){
    const state={offline:true,latency:0,downloadThroughput:0,uploadThroughput:0};
    await send('Network.emulateNetworkConditions',state);
    // Explicit navigator state is a separate CDP contract; keep real network
    // blocking and the closed HTTP origin, never override a JS property.
    await send('Network.overrideNetworkState',state);
  }
  navigation=documentNavigation(send);await navigation.navigate(url);
  // A cross-document renderer can reset navigator state (also reproduced on
  // chrome-error without application code). Reassert the CDP state on the
  // navigated renderer; network blocking was enabled before navigation.
  if(offline)await send('Network.overrideNetworkState',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  assert.equal(await evaluate('location.href'),url);assert.equal(await evaluate('!!document.body&&!!document.getElementById("main-login")'),true,'Requested application document parsed');
  return {evaluate,until,send,reload:()=>navigation.navigate(url),async touch(selector){
    await settleTargets();await send('Emulation.setTouchEmulationEnabled',{enabled:true});
    // Arm passive native-event evidence BEFORE the final six-frame layout sample;
    // CDP round trips after measuring a sticky tab can leave stale coordinates.
    await evaluate('window.__navigationGesture=('+observeGesture.toString()+')('+JSON.stringify(selector)+');window.__touchSelector='+JSON.stringify(selector)+';window.__touchCoordinates=[];window.__touchRecorder=e=>{const b=document.querySelector(__touchSelector)?.getBoundingClientRect();__touchCoordinates.push({x:e.clientX,y:e.clientY,tag:e.target.tagName,tab:e.target.dataset?.tab,hit:document.elementFromPoint(e.clientX,e.clientY)?.dataset?.tab,wanted:b&&{x:b.x,y:b.y,width:b.width,height:b.height}});};window.addEventListener("pointerdown",__touchRecorder,true)');
    try{
      const p=await waitForGesturePoint(evaluate,selector,{stable:true});
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,radiusX:3,radiusY:3,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      const trace=await evaluate('({...__navigationGesture.snapshot(),coordinates:__touchCoordinates,scale:visualViewport.scale,offset:visualViewport.offsetTop,scrollY,viewport:innerWidth})');trace.requested=p;
      for(const type of ['pointerdown','pointerup'])assert.equal(trace.events.filter(e=>e.type===type&&e.trusted&&e.onTarget).length,1,'Native '+type+' target '+selector+' '+JSON.stringify(trace));
      assert.equal(trace.events.some(e=>e.type.endsWith('cancel')),false,'Native gesture cancelled '+JSON.stringify(trace));
      // A compatibility click may target the new layout. The subsequent
      // navigation assertions must prove that it cannot execute a second action.
    }finally{await evaluate('__navigationGesture.close();delete window.__navigationGesture;window.removeEventListener("pointerdown",__touchRecorder,true);delete window.__touchRecorder;delete window.__touchCoordinates');}
  },async tap(id){await settleTargets();const p=await waitForGesturePoint(evaluate,'#'+id);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});},
    close(){return closing||=closeBrowserForRestart({send,owner,ws,pending});}};
 }catch(e){ws.close();await owner.close();throw e;}
}
async function main(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'meble-trusted-session-')),server=http.createServer((req,res)=>{
   try{const name=new URL(req.url,'http://127.0.0.1').pathname,file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
     if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile())throw Error();
     res.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'image/jpeg'});res.end(fs.readFileSync(file));
   }catch(_){res.writeHead(404);res.end();}
 });let device,closed=false;
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const url='http://127.0.0.1:'+server.address().port+'/index.html',profile=path.join(directory,'phone');
  device=await browser(profile,url,{inject:true});await device.until('document.body.dataset.authState==="unauthenticated"');
  assert.equal(await device.evaluate('!!window.__APP_STARTED__'),false);await device.tap('auth-google');await device.until('document.body.dataset.businessState==="ready"');
  await device.evaluate('window.unsaved=document.createElement("input");unsaved.value="EXACT-UNSAVED";document.body.appendChild(unsaved);advanceClock(300000);true');
  assert.equal(await device.evaluate('__FC_MAIN_ACCESS__.isValid()'),false);assert.equal(await device.evaluate('unsaved.value'),'EXACT-UNSAVED');
  const locked=await device.evaluate('__AUTH_INPUT_DIAGNOSTICS__()');assert.equal(locked.mode,'locked');assert.equal(locked.popups,1);
  await device.tap('auth-google');
  assert.equal(await device.evaluate('popupCalls'),2,'Conscious native Google click must invoke exactly the second popup: '+JSON.stringify(await device.evaluate('__AUTH_INPUT_DIAGNOSTICS__()')));
  await device.until('__FC_MAIN_ACCESS__.isValid()');assert.equal(await device.evaluate('popupCalls'),2);
  const resumed=await device.evaluate('__AUTH_INPUT_DIAGNOSTICS__()');
  assert.equal(resumed.authStatus,'authenticated');assert.equal(resumed.mode,'desktop');assert.equal(resumed.profilePhase,'confirm:confirmed');
  assert.ok(resumed.reads>locked.reads&&resumed.transactions>locked.transactions,'Reauthentication requires new independent server proof');
  assert.equal(resumed.events.filter(e=>e.type==='click'&&e.id==='auth-google'&&e.trusted).length,2);
  assert.equal(await device.evaluate('unsaved.value'),'EXACT-UNSAVED');
  await device.close();device=await browser(profile,url,{inject:true});
  await device.until('document.body.dataset.authState==="unauthenticated"');assert.equal(await device.evaluate('!!window.__APP_STARTED__'),false);
  await device.evaluate('window.testAccount="foreign-owner"');await device.tap('auth-google');await device.until('document.body.dataset.authState==="error"');
  assert.match(await device.evaluate('document.getElementById("auth-error").textContent'),/LOCAL_ACCESS_OTHER_ACCOUNT/);assert.equal(await device.evaluate('!!window.__APP_STARTED__'),false);
  await device.tap('auth-signout');await device.evaluate('window.testAccount="synthetic-phone-owner"');await device.tap('auth-google');await device.until('document.body.dataset.businessState==="ready"');
  await device.tap('main-trust-phone');await device.until('document.getElementById("main-trust-phone").checked&&!document.getElementById("main-trust-phone").disabled');
  assert.match(await device.evaluate('document.getElementById("main-trust-status").textContent'),/Zaufano/);
  await device.evaluate('dispatchEvent(new Event("offline"));document.dispatchEvent(new Event("visibilitychange"));dispatchEvent(new PageTransitionEvent("pagehide"));advanceClock(86400000);true');
  assert.equal(await device.evaluate('__FC_MAIN_ACCESS__.isValid()'),true);
  const before=await device.evaluate('('+inspectTrustStorage.toString()+')()');
  assert.equal(before.fence,'active');for(const key of ['proofPresent','proofVersionValid','privateKeyPresent','privateKeyNonExportable','publicKeyPresent','signaturePresent','originMatches','fenceMatches','profileActive','bindingMatches','receiptMatches'])assert.equal(before[key],true,'Before shutdown: '+key+' '+JSON.stringify(before));
  await device.close();device=null;
  await new Promise(resolve=>server.close(resolve));closed=true; // No HTTP origin remains for cold startup.
  device=await browser(profile,url,{offline:true});
  const cold=await device.evaluate('('+inspectTrustStorage.toString()+')()');
  assert.deepEqual(cold,before,'Cold-start persistent trust/profile changed: '+JSON.stringify(cold));
  await device.until('document.body.dataset.businessState==="ready"');
  const restored=await device.evaluate('__AUTH_INPUT_DIAGNOSTICS__()');
  assert.equal(restored.trustRestore,'valid');assert.equal(restored.mode,'trusted');assert.equal(restored.profilePhase,'resume:confirmed');assert.equal(restored.authStatus,undefined,'Cold trust must not initialize Google');assert.equal(restored.authCreations,0);
  assert.equal(restored.offline.networkOffline,true,JSON.stringify(restored.offline));assert.equal(restored.offline.controlled,true,JSON.stringify(restored.offline));assert.equal(restored.offline.workerExpected,true,JSON.stringify(restored.offline));
  assert.equal(await device.evaluate('__FC_MAIN_ACCESS__.isValid()'),true);
  assert.equal(await device.evaluate('('+authModuleType.toString()+')()'),'function','Public Auth module stays registered without creating an Auth session');
  assert.equal(await device.evaluate('document.getElementById("main-trust-phone").checked'),true);
  await require('./helpers/investor-delete-sw-browser').exerciseFullDeletion(device);
  await require('./helpers/investor-navigation-browser').exerciseInvestorNavigation(device);
  await device.tap('main-signout');await device.until('!__FC_MAIN_ACCESS__.isValid()');
  const revoked=await device.evaluate('('+inspectTrustStorage.toString()+')()');assert.equal(revoked.fence,'revoked');assert.equal(revoked.revoked,true,'Explicit logout must durably revoke the trust proof');
  await device.close();device=null;
  device=await browser(profile,url,{offline:true});
  // This fresh foreground renderer has neither a trust proof nor injected or
  // previously downloaded Firebase SDK. The closed origin/offline network
  // must yield this exact SDK refusal, not an inherited Auth instance from a
  // restored tab. Both local admission and business reads remain forbidden.
  await device.until('document.body.dataset.authState==="error"');
  assert.match(await device.evaluate('document.getElementById("auth-error").textContent'),/\(AUTH_SDK_UNAVAILABLE\)/);
  const denied=await device.evaluate('__AUTH_INPUT_DIAGNOSTICS__()');assert.equal(denied.trustRestore,'absent');assert.equal(denied.mode,'locked');
  assert.equal(await device.evaluate('(()=>{try{localStorage.getItem("fc_projects_v1");return "READ_ALLOWED";}catch(e){return e.message;}})()'),'AUTH_ACCESS_REVOKED');
  assert.equal(await device.evaluate('!!window.__APP_STARTED__'),false);assert.equal(await device.evaluate('__FC_MAIN_ACCESS__.isValid()'),false);
  console.log('PASS real Chromium/IDB/CryptoKey/SW: desktop idle retains RAM, explicit trust, background/offline, cold restart with origin stopped, offline logout and no inherited readmission');
 }finally{await device?.close();if(!closed)await new Promise(resolve=>server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main,injection};

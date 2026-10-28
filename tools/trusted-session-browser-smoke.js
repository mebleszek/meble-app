'use strict';
// Actual Chromium, CryptoKey/IndexedDB and Service Worker. Google and its
// read-only authorization RPC are explicit injected SDK fixtures, never LIVE.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {startBrowser}=require('./helpers/chromium-runtime');
const {documentNavigation,waitForGesturePoint}=require('./helpers/browser-test-readiness');
const root=path.resolve(__dirname,'..');
const injection=`(()=>{
 const RealDate=Date;let offset=0;window.Date=class extends RealDate{static now(){return RealDate.now()+offset;}};window.advanceClock=n=>offset+=n;
 window.authCalls=0;window.popupCalls=0;window.grant=true;window.rawGet=Storage.prototype.getItem;
 let options;Object.defineProperty(window,'FC_AUTH_TEST_OPTIONS',{get:()=>options,set:v=>{options={...v,target:'emulator',firebaseConfig:{apiKey:'demo',projectId:'demo-meble-app',appId:'demo',authDomain:'demo.invalid'},emulator:{host:'127.0.0.1',port:19099,firestorePort:18080},sdk:{
 app:{initializeApp:config=>{window.authCalls++;return {options:config};},deleteApp:async()=>{}},
 auth:{inMemoryPersistence:class Memory{},initializeAuth:app=>({app,currentUser:null,listeners:new Set()}),setPersistence:async()=>{},connectAuthEmulator(){},
 onAuthStateChanged(a,fn){a.listeners.add(fn);queueMicrotask(()=>fn(a.currentUser));return()=>a.listeners.delete(fn);},
 GoogleAuthProvider:class{setCustomParameters(p){if(p.prompt!=='select_account')throw Error('Account choice required');}},
 signInWithPopup:async a=>{window.popupCalls++;a.currentUser={uid:window.testAccount||'synthetic-phone-owner',providerData:[{providerId:'google.com'}]};for(const fn of a.listeners)fn(a.currentUser);return {user:a.currentUser};},
 signOut:async a=>{a.currentUser=null;for(const fn of a.listeners)fn(null);}},
 firestore:{memoryLocalCache:()=>({kind:'memory'}),initializeFirestore:(app,settings)=>{if(settings.localCache.kind!=='memory')throw Error('Memory-only Firestore required');return {app};},connectFirestoreEmulator(){},doc:(_db,_c,id)=>({id}),
 getDocFromServer:async ref=>({id:ref.id,metadata:{fromCache:false,hasPendingWrites:false},exists:()=>window.grant,data:()=>({schemaVersion:1})}),
 runTransaction:async(db,fn)=>fn({get:async ref=>({id:ref.id,metadata:{fromCache:false,hasPendingWrites:false},exists:()=>window.grant,data:()=>({schemaVersion:1})})}),terminate:async()=>{}}
 }};}});
})();`;
async function browser(profile,url,{offline=false,inject=false}={}){
 const owner=await startBrowser({profileDir:profile}),targets=await(await fetch('http://127.0.0.1:'+new URL(owner.endpoint).port+'/json/list')).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 const pending=new Map();let serial=0;
 let navigation;
 ws.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else navigation?.event(m);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP '+method));},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'Browser assertion failed');return r.result.value;};
 const until=async expression=>{for(let i=0;i<600;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Browser timeout '+expression+' '+await evaluate('document.body?.innerText.slice(-800)'));};
 try{
  await send('Page.enable');await send('Network.enable');if(inject)await send('Page.addScriptToEvaluateOnNewDocument',{source:injection});
  if(offline)await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  navigation=documentNavigation(send);await navigation.navigate(url);
  assert.equal(await evaluate('location.href'),url);assert.equal(await evaluate('!!document.body&&!!document.getElementById("main-login")'),true,'Requested application document parsed');
  return {evaluate,until,send,async tap(id){const p=await waitForGesturePoint(evaluate,'#'+id);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});},
    async close(){ws.close();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Closed'));}pending.clear();await owner.close();}};
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
  await device.tap('auth-google');await device.until('__FC_MAIN_ACCESS__.isValid()');assert.equal(await device.evaluate('popupCalls'),2);
  await device.close();device=await browser(profile,url,{inject:true});
  await device.until('document.body.dataset.authState==="unauthenticated"');assert.equal(await device.evaluate('!!window.__APP_STARTED__'),false);
  await device.evaluate('window.testAccount="foreign-owner"');await device.tap('auth-google');await device.until('document.body.dataset.authState==="error"');
  assert.match(await device.evaluate('document.getElementById("auth-error").textContent'),/LOCAL_ACCESS_OTHER_ACCOUNT/);assert.equal(await device.evaluate('!!window.__APP_STARTED__'),false);
  await device.tap('auth-signout');await device.evaluate('window.testAccount="synthetic-phone-owner"');await device.tap('auth-google');await device.until('document.body.dataset.businessState==="ready"');
  await device.tap('main-trust-phone');await device.until('document.getElementById("main-trust-phone").checked&&!document.getElementById("main-trust-phone").disabled');
  assert.match(await device.evaluate('document.getElementById("main-trust-status").textContent'),/Zaufano/);
  await device.evaluate('dispatchEvent(new Event("offline"));document.dispatchEvent(new Event("visibilitychange"));dispatchEvent(new PageTransitionEvent("pagehide"));advanceClock(86400000);true');
  assert.equal(await device.evaluate('__FC_MAIN_ACCESS__.isValid()'),true);await device.close();device=null;
  await new Promise(resolve=>server.close(resolve));closed=true; // No HTTP origin remains for cold startup.
  device=await browser(profile,url,{offline:true});await device.until('document.body.dataset.businessState==="ready"');
  assert.equal(await device.evaluate('__FC_MAIN_ACCESS__.isValid()'),true);
  assert.equal(await device.evaluate('FC.cloudAuth && typeof FC.cloudAuth.create'), 'function');
  assert.equal(await device.evaluate('document.getElementById("main-trust-phone").checked'),true);
  await device.tap('main-signout');await device.until('!__FC_MAIN_ACCESS__.isValid()');await device.close();device=null;
  device=await browser(profile,url,{offline:true});await device.until('document.body.dataset.authState==="unauthenticated"');
  assert.equal(await device.evaluate('!!window.__APP_STARTED__'),false);assert.equal(await device.evaluate('__FC_MAIN_ACCESS__.isValid()'),false);
  console.log('PASS real Chromium/IDB/CryptoKey/SW: desktop idle retains RAM, explicit trust, background/offline, cold restart with origin stopped, offline logout and no inherited readmission');
 }finally{await device?.close();if(!closed)await new Promise(resolve=>server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main,injection};

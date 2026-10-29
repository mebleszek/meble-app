'use strict';
// Bounded offline checks of the actual test helpers. No native/emulator PASS is
// claimed here; those remain mandatory in their original CI groups.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {documentNavigation,gesturePoint,waitForGesturePoint}=require('./helpers/browser-test-readiness');
const {authModuleType}=require('./helpers/auth-input-diagnostics');
async function main(){
 const event=(loaderId,frameId='main')=>({method:'Page.lifecycleEvent',params:{name:'DOMContentLoaded',loaderId,frameId}});
 let nav,complete=false;
 nav=documentNavigation(async method=>{
  if(method==='Page.navigate')return {frameId:'main',loaderId:'requested'};
  assert.equal(method,'Page.setLifecycleEventsEnabled');return {};
 });
 const pending=nav.navigate('http://127.0.0.1/index.html').then(()=>{complete=true;});
 await new Promise(r=>setImmediate(r));assert.equal(complete,false,'navigate ACK must not authorize a document read');
 nav.event(event('old'));nav.event(event('requested','child'));await new Promise(r=>setImmediate(r));assert.equal(complete,false);
 nav.event(event('requested'));await pending;assert.equal(complete,true);
 let early;early=documentNavigation(async method=>{
  if(method==='Page.navigate'){early.event(event('early'));return {frameId:'main',loaderId:'early'};}return {};
 });await early.navigate('http://127.0.0.1/index.html');
 for(const [result,message]of [[{errorText:'net::ERR_INTERNET_DISCONNECTED'},/Navigation failed/],[{frameId:'main'},/did not create a document/]]){
  await assert.rejects(documentNavigation(async()=>result).navigate('http://127.0.0.1/index.html'),message);
 }
 await assert.rejects(documentNavigation(async()=>({frameId:'main',loaderId:'missing'}),{timeoutMs:1}).navigate('http://127.0.0.1/index.html'),/DOMContentLoaded missing/);
 console.log('PASS navigation: exact frame/loader parse barrier, early event, old/child event refusal, network/no-document/missing-event failures');

 // Use the real modal-open guard rather than replacing its 260ms contract.
 let guarded=false,raf,release,disabled=false,inert=false,overlaid=false,polls=0;
 const modal={classList:{add(name){assert.equal(name,'modal-open-guard');guarded=true;},remove(name){assert.equal(name,'modal-open-guard');guarded=false;}}};
 const page={window:{FC:{}},lockModalScroll(){},requestAnimationFrame:fn=>{raf=fn;},setTimeout:(fn,ms)=>{assert.equal(ms,260);release=fn;}};
 vm.runInNewContext(fs.readFileSync('js/app/material/price-modal-context.js','utf8'),page);
 page.window.FC.priceModalContext.setModalShellOpen(modal,false);assert.equal(guarded,true);raf();
 assert.match(fs.readFileSync('css/drawing-home-confirm.css','utf8'),/\.modal-open-guard, \.modal-open-guard \*\{ pointer-events:none !important; \}/);
 const target={get disabled(){return disabled;},getClientRects:()=>[{}],closest:()=>guarded||inert?modal:null,scrollIntoView(){},getBoundingClientRect:()=>({x:10,y:20,width:40,height:40}),contains:hit=>hit===target};
 const document={querySelectorAll:()=>[target],elementFromPoint:()=>guarded||overlaid?{id:'main-signout'}:target};
 const evaluate=async expression=>{polls++;return vm.runInNewContext(expression,{document});};
 assert.equal(await evaluate('('+gesturePoint.toString()+')("#closePriceModal")'),null);
 const point=await waitForGesturePoint(evaluate,'#closePriceModal',{pause:async()=>{assert.equal(guarded,true);release();}});
 assert.deepEqual(JSON.parse(JSON.stringify(point)),{x:30,y:40});assert.equal(polls,3,'Wait until actual hit target is available');
 for(const state of ['disabled','inert','overlaid']){
  disabled=state==='disabled';inert=state==='inert';overlaid=state==='overlaid';
  await assert.rejects(waitForGesturePoint(evaluate,'#closePriceModal',{timeoutMs:0,pause:async()=>{}}),/Native gesture target not ready/);
 }
 await assert.rejects(waitForGesturePoint(async()=>{throw Error('APPLICATION_ERROR');},'#target'),/^Error: APPLICATION_ERROR$/);
 console.log('PASS gesture: actual modal guard, disabled/inert/occluded targets refused; no click through to logout, no swallowed application exception');

 const {runtime}=require('./cloud-auth-smoke');
 const s=runtime();s.Storage=class {};s.window=s;s.Date=Date;s.queueMicrotask=queueMicrotask;s.addEventListener=()=>{};
 const context=vm.createContext(s);vm.runInContext(require('./trusted-session-browser-smoke').injection,context);
 let sdkLoads=0;s.FC.firebasePilotTransport.loadAuthSdk=()=>{sdkLoads++;throw Error('UNEXPECTED_SDK_LOAD');};
 // Execute the actual namespace factory and app.js lexical declaration rather
 // than pretending that the browser's bare FC always means window.FC.
 vm.runInContext(fs.readFileSync('js/app/bootstrap/app-core-namespace.js','utf8'),context);
 const declaration=fs.readFileSync('js/app.js','utf8').match(/const FC = [\s\S]*?;\n/);
 assert.ok(declaration,'Actual business namespace declaration required');
 vm.runInContext('const STORAGE_KEYS={};\n'+declaration[0],context);
 assert.equal(vm.runInContext('FC===window.FC',context),false);
 assert.equal(vm.runInContext('FC.cloudAuth && typeof FC.cloudAuth.create',context),undefined,'Reproduce original CI assertion against the business core');
 const moduleType=()=>vm.runInContext('('+authModuleType.toString()+')()',context);
 const api=s.FC.cloudAuth,originalCreate=api.create;
 assert.equal(moduleType(),'function');assert.equal(s.__AUTH_INPUT_DIAGNOSTICS__().authCreations,0);assert.equal(sdkLoads,0);
 // Public bootstrap currently merges its namespace into itself. Instrumentation
 // must not wrap an already instrumented API again or multiply its counters.
 Object.assign(s.FC,s.FC);Object.assign(s.FC,s.FC);
 assert.equal(s.FC.cloudAuth,api);assert.equal(s.FC.cloudAuth.create,originalCreate);
 assert.equal(moduleType(),'function');assert.equal(s.__AUTH_INPUT_DIAGNOSTICS__().authCreations,0);
 const missing={window:{FC:{}},addEventListener(){}};missing.window.addEventListener=missing.addEventListener;
 vm.runInNewContext('('+require('./helpers/auth-input-diagnostics').installAuthInputDiagnostics.toString()+')();',missing);
 assert.equal(vm.runInNewContext('('+authModuleType.toString()+')()',missing),'undefined','Missing API must not be fabricated by diagnostics');
 console.log('PASS Auth registration: actual lexical business namespace differs from public API; module inspection is inert and missing API is refused');
 s.FC_AUTH_TEST_OPTIONS={};
 const auth=await s.FC.cloudAuth.create({...s.FC_AUTH_TEST_OPTIONS,sessionOnly:true});
 const verifier=s.FC.cloudAccessVerifier.create(auth,{sdk:s.FC_AUTH_TEST_OPTIONS.sdk.firestore});
 try{
  assert.equal(auth.state().status,'unauthenticated');assert.equal(s.__AUTH_INPUT_DIAGNOSTICS__().authCreations,1);assert.equal(s.authCalls,1);assert.equal(sdkLoads,0);
  assert.equal((await auth.signInGoogle()).ok,true);
  const proof=await verifier.verify(auth.identity());assert.equal(proof.ok,true);assert.equal(proof.uid,'synthetic-phone-owner');
  s.grant=false;assert.equal((await verifier.verify(auth.identity())).denied,true);
 }finally{await verifier.close();await auth.close();}
 console.log('PASS browser SDK fixture: actual Auth/verifier initialization, memory-only cache, server-shaped proof and confirmed denial');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});module.exports={main};

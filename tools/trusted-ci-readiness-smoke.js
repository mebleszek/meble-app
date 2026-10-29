'use strict';
// Bounded offline checks of the actual test helpers. No native/emulator PASS is
// claimed here; those remain mandatory in their original CI groups.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {documentNavigation,gesturePoint,waitForGesturePoint}=require('./helpers/browser-test-readiness');
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
 vm.runInNewContext(require('./trusted-session-browser-smoke').injection,s);
 s.FC_AUTH_TEST_OPTIONS={};
 const auth=await s.FC.cloudAuth.create({...s.FC_AUTH_TEST_OPTIONS,sessionOnly:true});
 const verifier=s.FC.cloudAccessVerifier.create(auth,{sdk:s.FC_AUTH_TEST_OPTIONS.sdk.firestore});
 try{
  assert.equal(auth.state().status,'unauthenticated');assert.equal((await auth.signInGoogle()).ok,true);
  const proof=await verifier.verify(auth.identity());assert.equal(proof.ok,true);assert.equal(proof.uid,'synthetic-phone-owner');
  s.grant=false;assert.equal((await verifier.verify(auth.identity())).denied,true);
 }finally{await verifier.close();await auth.close();}
 console.log('PASS browser SDK fixture: actual Auth/verifier initialization, memory-only cache, server-shaped proof and confirmed denial');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});module.exports={main};

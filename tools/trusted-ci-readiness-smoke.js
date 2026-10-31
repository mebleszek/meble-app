'use strict';
// Bounded offline checks of the actual test helpers. No native/emulator PASS is
// claimed here; those remain mandatory in their original CI groups.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {documentNavigation,gesturePoint,stableGesturePoint,nativeTouchProbe,observeGesture,waitForGesturePoint}=require('./helpers/browser-test-readiness');
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

 // Reproduce the old same-task readiness hole: a scroll/layout frame changes
 // the target after it passed elementFromPoint, before CDP can send the input.
 let y=20,frame=0,moving=true,scrolls=0,replaced=false;
 const button={disabled:false,isConnected:true,getClientRects:()=>[{}],closest:()=>null,scrollIntoView(){scrolls++;},getBoundingClientRect:()=>({x:10,y,width:40,height:40}),contains:()=>false};
 const gestureDocument={querySelectorAll:()=>[button],querySelector:()=>button,elementFromPoint:()=>replaced?{}:button};
 const gestureContext=vm.createContext({window:{scrollX:0,scrollY:0},document:gestureDocument,requestAnimationFrame:fn=>setImmediate(()=>{frame++;if(moving)y+=40;fn();})});
 const sample=async expression=>vm.runInContext(expression,gestureContext);
 const oldPoint=await sample('('+gesturePoint.toString()+')("#save")');assert.equal(oldPoint.y,40);assert.equal(frame,0);
 await assert.rejects(waitForGesturePoint(sample,'#save',{stable:true,timeoutMs:0,pause:async()=>{}}),/Native gesture target not ready/);
 assert.notEqual(y+20,oldPoint.y,'Original single-task coordinates became stale');assert.equal(scrolls,0,'Already hittable sticky targets must not be scrolled by readiness checks');
 moving=false;const settled=await waitForGesturePoint(sample,'#save',{stable:true});assert.equal(settled.y,y+20);
 replaced=true;await assert.rejects(waitForGesturePoint(sample,'#save',{stable:true,timeoutMs:0,pause:async()=>{}}),/Native gesture target not ready/);replaced=false;
 const eventListeners=new Map(),observerWindow={addEventListener(type,fn,capture){assert.equal(capture,true);eventListeners.set(type,fn);},removeEventListener(type,fn,capture){assert.equal(capture,true);assert.equal(eventListeners.get(type),fn);eventListeners.delete(type);}};
 const observer=vm.runInNewContext('('+observeGesture.toString()+')("#save")',{document:gestureDocument,window:observerWindow});
 for(const type of ['pointerdown','pointerup','click'])eventListeners.get(type)({type,isTrusted:true,target:button,preventDefault(){throw Error('Observer must not cancel');},stopPropagation(){throw Error('Observer must not suppress');}});
 assert.equal(observer.snapshot().events.length,3);assert.ok(observer.snapshot().events.every(e=>e.trusted&&e.onTarget));
 assert.equal(JSON.stringify(observer.snapshot()).includes('Synthetic First Owner'),false);observer.close();assert.equal(eventListeners.size,0);
 // Cross-command race reproduced from PR #91: sampling, then a separate
 // instrumentation CDP command, can put a sticky tab above the old point.
 {let top=62;const sticky={disabled:false,getClientRects:()=>[{}],closest:()=>null,scrollIntoView(){throw Error('Visible sticky tab must not scroll');},getBoundingClientRect:()=>({x:73,y:top,width:70,height:32}),contains:()=>false};
  const doc={querySelectorAll:()=>[sticky],elementFromPoint:(x,y)=>x>=73&&x<143&&y>=top&&y<top+32?sticky:{dataset:{tab:'inwestor'}}};
  const context=vm.createContext({document:doc,window:{scrollX:0,scrollY:94},innerWidth:393,innerHeight:852,requestAnimationFrame:fn=>queueMicrotask(fn)});
  const evalPage=async expression=>vm.runInContext(expression,context);
  const premature=await waitForGesturePoint(evalPage,'.tab-btn[data-tab="wywiad"]',{stable:true});
  assert.deepEqual(JSON.parse(JSON.stringify(premature)),{x:108,y:78});
  top=42;assert.notEqual(doc.elementFromPoint(premature.x,premature.y),sticky,'Stale point now hits the wrong tab');
  const afterArming=await waitForGesturePoint(evalPage,'.tab-btn[data-tab="wywiad"]',{stable:true});
  assert.deepEqual(JSON.parse(JSON.stringify(afterArming)),{x:108,y:58});assert.equal(doc.elementFromPoint(afterArming.x,afterArming.y),sticky);
  const touch=fs.readFileSync('tools/trusted-session-browser-smoke.js','utf8');const start=touch.indexOf('async touch(selector){'),end=touch.indexOf('},async tap(id)',start),scope=touch.slice(start,end);
  assert.ok(start>=0&&end>start&&scope.indexOf('window.__navigationGesture=')<scope.indexOf('const p=await waitForGesturePoint'),'Recorders must precede final coordinate sample');
  assert.match(scope,/stable:true/);assert.match(scope,/Input\.dispatchTouchEvent/);assert.match(scope,/trace\.events\.filter\(e=>e\.type===type&&e\.trusted&&e\.onTarget\)/);
  console.log('PASS PR #91 sticky-layout drift: old 108,78 misses after layout moves; armed-then-sampled 108,58 hits and preserves native touch assertions');}
 // Native touch evidence must distinguish scroll from geometry changes,
 // without inspecting business data or changing the target of the gesture.
 {let top=62,yScroll=0;
  const target={getBoundingClientRect:()=>({x:229,y:top,width:70,height:32}),contains:()=>false};
  const header={getBoundingClientRect:()=>({x:0,y:0,width:393,height:112})};
  const tabs={getBoundingClientRect:()=>({x:73,y:top,width:300,height:72})};
  const doc={querySelector:s=>s==='header'?header:target,getElementById:()=>tabs,
   elementFromPoint:(x,y)=>x>=229&&x<299&&y>=top&&y<top+32?target:{tagName:'BUTTON',dataset:{tab:'rozrys'}},
   documentElement:{get scrollTop(){return yScroll;}},body:{get scrollTop(){return yScroll;}}};
  const window={get scrollY(){return yScroll;},scrollX:0,innerWidth:393,innerHeight:852,visualViewport:{offsetTop:0,pageTop:0,scale:1}};
  const ctx=vm.createContext({document:doc,window}),sample=(x,y)=>vm.runInContext('('+nativeTouchProbe.toString()+')(".tab-btn[data-tab=\\\"rysunek\\\"]",'+x+','+y+')',ctx);
  const initial=sample(264,78);assert.equal(initial.hit.onTarget,true);assert.equal(initial.wanted.y,62);assert.equal(initial.scroll.y,0);
  top=42;const shifted=sample(264,78);assert.equal(shifted.hit.onTarget,false);assert.equal(shifted.hit.tab,'rozrys');assert.equal(shifted.wanted.y,42);
  assert.equal(shifted.scroll.y,initial.scroll.y,'Layout shift without scroll must be observable');
  yScroll=20;const scrolling=sample(264,78);assert.equal(scrolling.scroll.y,20);assert.equal(scrolling.wanted.y,42);
  const source=fs.readFileSync('tools/trusted-session-browser-smoke.js','utf8'),start=source.indexOf('async touch(selector){'),end=source.indexOf('},async tap(id)',start),scope=source.slice(start,end);
  assert.ok(start>=0&&end>start&&scope.indexOf('const beforeStart=await evaluate(')<scope.indexOf("Input.dispatchTouchEvent',{type:'touchStart'"),'Before-start sample must precede native gesture');
  assert.match(scope,/window\.__touchProbe/);assert.match(scope,/__touchCoordinates\.push\(/);assert.match(scope,/layout:info/);assert.match(scope,/trace\.beforeStart=beforeStart/);
  assert.match(scope,/e\.trusted&&e\.onTarget/);assert.match(scope,/Input\.dispatchTouchEvent/);
  console.log('PASS read-only touch timing evidence: beforeStart and pointerdown hit/geometry, scroll independent of layout, native assertions intact');}
 console.log('PASS stable touch readiness: stale same-task coordinates reproduced, moving/replaced hit targets refused, rendered stable target accepted; bounded observer never cancels input');

 const investorWindow={FC:{}},fc=investorWindow.FC;
 for(const name of ['investor-editor-state','investor-actions','investor-modals'])vm.runInNewContext(fs.readFileSync('js/app/investor/'+name+'.js','utf8'),{window:investorWindow});
 const investor={id:'synthetic-draft',kind:'person',addedDate:'2026-10-29'};let notices=0,confirms=0,commits=0,decide;
 fc.investorUI={state:{newlyCreatedId:investor.id,transientInvestor:investor},getTransientInvestor:()=>investor,clearTransientInvestor(){}};
 fc.investorPersistence={searchInvestors:()=>[],createInvestor:patch=>{commits++;return {...patch,id:'synthetic-saved'};},setCurrentInvestorId(){}};
 fc.infoBox={open(){notices++;}};fc.confirmBox={ask(options){assert.equal(options.title,'ZAPISAĆ ZMIANY?');confirms++;return new Promise(resolve=>{decide=resolve;});}};
 fc.investorEditorState.enter(investor);let save;
 const saveButton={getAttribute:key=>{assert.equal(key,'data-investor-action');return 'save';},addEventListener(type,fn){assert.equal(type,'click');save=fn;}};
 fc.investorActions.bindTopActions({querySelectorAll:()=>[saveButton]},{getCurrentInvestor:()=>investor});
 await save();assert.equal(notices,1);assert.equal(confirms,0);assert.equal(commits,0,'Incomplete draft must not persist');
 for(const [key,value]of Object.entries({name:'Synthetic First Owner',phone:'123456789',city:'Test City',email:'first@example.invalid',address:'Synthetic address 1',source:'Ulotka',notes:'Synthetic browser fixture'}))fc.investorEditorState.setField(key,value);
 assert.equal(fc.investorActions._debug.requiredFieldErrors(fc.investorEditorState.state.draft).length,0);
 const refused=save();await new Promise(resolve=>setImmediate(resolve));assert.equal(confirms,1);assert.equal(commits,0);decide(false);await refused;assert.equal(commits,0);assert.equal(fc.investorEditorState.state.isEditing,true);
 const accepted=save();await new Promise(resolve=>setImmediate(resolve));assert.equal(confirms,2);assert.equal(commits,0);decide(true);await accepted;assert.equal(commits,1);
 console.log('PASS actual investor action binding/editor/validation/modals: incomplete draft refused, complete draft awaits explicit decision, cancel retains edit, accept commits exactly once');

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
 {let frame=0;const target={},scroll={scrollX:0,scrollY:0},sample=()=>({x:10,y:frame<3?20:40});
 const stableContext={window:scroll,document:{elementFromPoint:()=>target},requestAnimationFrame:fn=>{frame++;if(frame===3)scroll.scrollY=20;queueMicrotask(fn);}};
 const stable=vm.runInNewContext('('+stableGesturePoint.toString()+')',stableContext);
 assert.equal(await stable('#synthetic',sample),null,'Movement after two rendered frames must refuse an early input point');
 assert.deepEqual(JSON.parse(JSON.stringify(await stable('#synthetic',sample))),{x:10,y:40});assert.equal(frame,9);
 console.log('PASS native gesture readiness: late smooth-scroll movement refused before input, continuous stable rendered position required');}
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

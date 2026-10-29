'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{webcrypto}=require('node:crypto');
const idb=require('./helpers/profile-indexeddb-fixture');
const tick=()=>new Promise(r=>setImmediate(r));
async function until(fn){const end=Date.now()+3000;while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,1));}assert.fail('main-login did not reach expected state');}
function world(shared={},inherited=null,{realAuth=false}={}){
 class Storage{constructor(rows){this.rows=rows||new Map();}get length(){return this.rows.size;}key(i){return [...this.rows.keys()][i]??null;}getItem(k){return this.rows.get(k)??null;}setItem(k,v){this.rows.set(k,String(v));}removeItem(k){this.rows.delete(k);}}
 const local=new Storage(shared.rows),session=new Storage(),databases=shared.databases||new Map(),listeners={},nodes={};
 const node=id=>nodes[id]||=( {id,hidden:true,disabled:id==='auth-google',checked:false,dataset:{},classList:{toggle(){}},addEventListener(type,fn){this[type]=fn;},contains(target){return this===target||(this.id==='main-login'&&target.id.startsWith('auth-'));},
   closest(selector){return ['button','button,input'].includes(selector)?this:selector==='[data-action]'&&this.action?this:selector==='.modal-back'&&this.modal?this:null;},getAttribute(name){return name==='data-action'?this.action:null;},
   content:{cloneNode:()=>({children:[],querySelectorAll:()=>[]})}});
 const timers=new Map(),capture=new WeakMap(),authListeners=new Set();let time=1000,serial=0,authCreates=0,logins=0,watch,cloudUser=inherited,actualAuth,actualVerifier;
 const clock=class extends Date{static now(){return time;}};
 const document={body:{dataset:{},classList:{toggle(){}},appendChild(){}},documentElement:{classList:{toggle(){}}},getElementById:node,
   addEventListener(type,fn){(listeners['doc:'+type]||=[]).push(fn);},removeEventListener(type,fn){listeners['doc:'+type]=(listeners['doc:'+type]||[]).filter(f=>f!==fn);},dispatchEvent(){w.__APP_STARTED__=true;},baseURI:'https://synthetic.invalid/'};
 const w={FC:{},crypto:webcrypto,location:{origin:'https://synthetic.invalid'},localStorage:local,indexedDB:{open(name){if(!databases.has(name))databases.set(name,idb());return databases.get(name).open();}},
   navigator:{locks:{request:async(_name,options,fn)=>(fn||options)()}},document,addEventListener(type,fn,options){capture.set(fn,options===true||options?.capture===true);(listeners[type]||=[]).push(fn);},removeEventListener(type,fn){listeners[type]=(listeners[type]||[]).filter(f=>f!==fn);}};
 const set=(fn,ms)=>{const n=++serial;timers.set(n,{fn,at:time+ms});return n;},clear=n=>timers.delete(n);
 const load=file=>new Function('window','document','Storage','localStorage','sessionStorage','navigator','performance','setTimeout','clearTimeout','Date','Event','setInterval','clearInterval',fs.readFileSync(file,'utf8'))(
   w,document,Storage,local,session,w.navigator,{now:()=>time},set,clear,clock,Event,set,clear);
 for(const name of ['auth-access-gate','local-access-profile','local-device-access'])load('js/app/cloud/'+name+'.js');
 w.FC.cloudAuth={create:async options=>{assert.equal(options.sessionOnly,true);authCreates++;return {
   identity:()=>{if(!cloudUser)throw Error('No Google identity');return {uid:cloudUser,epoch:1};},state:()=>({uid:cloudUser}),subscribe(fn){authListeners.add(fn);fn(cloudUser?{status:'authenticated',uid:cloudUser,epoch:1}:{status:'unauthenticated'});return()=>authListeners.delete(fn);},
   signInGoogle:async()=>{logins++;cloudUser='owner';for(const fn of authListeners)fn({status:'authenticated',uid:'owner',epoch:1});return {ok:true};},signOut:async()=>{cloudUser=null;}
 };}};
 w.FC.cloudAccessVerifier={create:()=>({verify:async({uid})=>({ok:true,uid,validUntil:time+45000}),watch(_id,fn){watch=fn;return()=>{watch=null;};}})};
 w.FC.mainBusinessLoader={create:check=>({start:async()=>check(),abort(){throw Error('Unexpected abort');}})};
 w.FC.offlineShell={prepare:async()=>({complete:true})};
 if(realAuth){
  for(const name of ['firebase-pilot-transport','cloud-auth','cloud-access-verifier'])load('js/app/cloud/'+name+'.js');
  new Function('window','Storage','Date',require('./trusted-session-browser-smoke').injection)(w,Storage,clock);w.FC_AUTH_TEST_OPTIONS={};
  const create=w.FC.cloudAuth.create,verify=w.FC.cloudAccessVerifier.create;
  w.FC.cloudAuth.create=async options=>{authCreates++;actualAuth=await create(options);return actualAuth;};
  w.FC.cloudAccessVerifier.create=(...args)=>actualVerifier=verify(...args);
 }
 load('js/main-login.js');
 const event=target=>({target,isTrusted:true,preventDefault(){},stopImmediatePropagation(){}});
 return {w,nodes,shared:{rows:local.rows,databases},get authCreates(){return authCreates;},get logins(){return logins;},
  ready:()=>document.body.dataset.businessState==='ready'&&w.__FC_MAIN_ACCESS__.isValid(),
  async login(){await until(()=>!node('auth-google').disabled);this.input('click','auth-google');try{await until(()=>this.ready());}catch(e){throw Error(JSON.stringify({state:document.body.dataset,status:node('auth-status').textContent,error:node('auth-error').textContent}),{cause:e});}},
  async trust(){node('main-trust-phone').checked=true;await node('main-trust-phone').change(event(node('main-trust-phone')));assert.equal(node('main-trust-phone').checked,true);},
  async logout(){this.input('click','main-signout');await tick();},
  deny(){watch?.({ok:false,denied:true});},offline(){watch?.({ok:false});},
  installBindings(actions){load('js/core/actions.js');w.FC.actions.register(actions);load('js/app/ui/bindings.js');w.FC.bindings.install();},
  input(type,id,options={}){let stopped=false;const e={...event(node(id)),type,pointerType:'mouse',detail:1,...options,
    stopPropagation(){stopped=true;},stopImmediatePropagation(){stopped=true;}};
   const windowListeners=listeners[type]||[];
   for(const group of [windowListeners.filter(fn=>capture.get(fn)),listeners['doc:'+type]||[],windowListeners.filter(fn=>!capture.get(fn))])for(const fn of [...group]){if(stopped)break;fn(e);}return !stopped;},
  diagnostics:()=>({auth:actualAuth?.state().status,popups:w.popupCalls,authState:document.body.dataset.authState,error:node('auth-error').textContent}),
  advance(ms){time+=ms;for(const [key,t]of [...timers])if(timers.has(key)&&t.at<=time){timers.delete(key);t.fn();}},
  visible(){for(const fn of listeners['doc:visibilitychange']||[])fn();},restore(){for(const fn of listeners.pageshow||[])fn({persisted:true});},
  close(){timers.clear();void actualVerifier?.close();void actualAuth?.close();}
 };
}
async function main(){
 const d=world({},'owner');await until(()=>d.authCreates===1);assert.equal(d.ready(),false);await d.login();assert.equal(d.logins,1);
 d.w.projectData={unsaved:'EXACT-RAM'};const before=d.shared.rows.get('fc_projects_v1');d.advance(300000);
 assert.equal(d.ready(),false);assert.deepEqual(d.w.projectData,{unsaved:'EXACT-RAM'});assert.equal(d.shared.rows.get('fc_projects_v1'),before);
 await d.login();assert.equal(d.logins,2);d.restore();assert.equal(d.ready(),false);d.close();
 console.log('PASS main desktop: conscious login, idle/bfcache lock, reauthentication and exact RAM protection');
 const phone=world();await phone.login();await phone.trust();phone.offline();phone.visible();phone.advance(86400000);assert.equal(phone.ready(),true);
 const boot=world(phone.shared);await until(()=>boot.ready());assert.equal(boot.authCreates,0,'Trusted restart must not initialize Google/Firestore');assert.equal(boot.logins,0);
 await boot.logout();assert.equal(boot.ready(),false);const loggedOut=world(boot.shared);await until(()=>loggedOut.authCreates===1);assert.equal(loggedOut.ready(),false);
 phone.close();boot.close();loggedOut.close();
 console.log('PASS main phone: explicit trust, notification/visibility/offline/long use, full offline restart without Auth, offline logout veto');
 const revoked=world();await revoked.login();await revoked.trust();revoked.deny();assert.equal(revoked.ready(),false);
 const afterDenial=world(revoked.shared);await until(()=>afterDenial.authCreates===1);assert.equal(afterDenial.ready(),false);revoked.close();afterDenial.close();
 console.log('PASS main revocation: confirmed denial destroys offline admission; network uncertainty alone does not');
 const input=world({},null,{realAuth:true});
 try{
  await input.login();let closes=0,physical=0;
  input.installBindings({'close-price':()=>{closes++;return true;}});
  const close=input.nodes.closePriceModal={id:'closePriceModal',action:'close-price',modal:true,
   closest(s){return ['button','[data-action]','.modal-back'].includes(s)?this:null;},getAttribute(n){return n==='data-action'?this.action:null;}};
  input.w.document.addEventListener('pointerdown',()=>physical++);
  input.w.projectData={unsaved:'EXACT-RAM-AFTER-MODAL'};
  input.input('pointerdown',close.id);input.input('pointerup',close.id);input.input('click','main-signout');
  assert.equal(closes,1);assert.equal(input.ready(),true,'Retargeted compatibility click must be consumed before logout');
  assert.equal(input.diagnostics().popups,1);
  // Leave the guard armed, as happens when a browser omits the compatibility
  // click. Then expire during an in-flight/expired cloud callback.
  input.input('pointerdown',close.id);input.input('pointerup',close.id);
  input.advance(300000);assert.equal(input.ready(),false);
  assert.equal(input.nodes['auth-google'].hidden,false,'Cloud callback cannot overwrite the synchronous idle-lock screen');
  assert.equal(input.diagnostics().popups,1,'Expiry must never initiate a popup');
  const locked=input.w.__AUTH_INPUT_DIAGNOSTICS__();
  const before=physical;
  input.input('pointerdown','auth-google');assert.equal(physical,before+1,'Fresh login gesture must reach the document reset');
  input.input('pointerup','auth-google');input.input('click','auth-google');
  await until(()=>input.ready());assert.equal(input.diagnostics().popups,2,'One conscious reauthentication after expiry');
  assert.equal(input.diagnostics().auth,'authenticated');
  const resumed=input.w.__AUTH_INPUT_DIAGNOSTICS__();assert.equal(resumed.profilePhase,'confirm:confirmed');
  assert.ok(resumed.reads>locked.reads&&resumed.transactions>locked.transactions);
  assert.equal(JSON.stringify(resumed).includes('synthetic-phone-owner'),false,'Diagnostics must not expose UID/receipt/data');
  assert.deepEqual(input.w.projectData,{unsaved:'EXACT-RAM-AFTER-MODAL'});
  await input.trust();const fence=input.shared.rows.get('meble_device_trust_fence_v1');let exits=0;
  input.w.FC.actions.register({'session-cancel':()=>{exits++;return true;}});
  input.nodes.sessionCancel={id:'sessionCancel',closest(selector){return ['button','button,input','[data-action]'].includes(selector)?this:null;},getAttribute:()=> 'session-cancel'};
  input.input('pointerdown','sessionCancel');input.input('pointerup','sessionCancel');input.input('click','main-signout');
  assert.equal(exits,1);assert.equal(input.ready(),true,'Exit compatibility click must not log out');assert.equal(input.shared.rows.get('meble_device_trust_fence_v1'),fence);
  input.input('pointerdown','sessionCancel');input.input('pointerup','main-signout');input.input('click','main-signout');
  assert.equal(exits,1,'Changed gesture target must not dispatch Exit');assert.equal(input.ready(),true,'Changed gesture target must not dispatch logout');
  input.input('pointerdown','main-signout');input.input('pointerup','main-signout');
  await input.logout();assert.equal(input.ready(),false,'A genuine logout still blocks immediately');
  assert.equal(input.shared.rows.get('meble_device_trust_fence_v1'),'revoked');
 }finally{input.close();}
 console.log('PASS actual main/Auth/verifier/bindings: modal click-through refused, idle/cloud ordering, fresh pointer reset, popup twice, profile readmission and exact unsaved RAM');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main,world};

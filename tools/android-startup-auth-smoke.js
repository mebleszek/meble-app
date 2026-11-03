'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{world}=require('./trusted-main-login-smoke');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(test){const end=Date.now()+3000;while(Date.now()<end){if(test())return;await new Promise(resolve=>setTimeout(resolve,1));}throw Error('STARTUP_AUTH_FIXTURE_TIMEOUT');}
// Only SDK connections are synthetic. Main Auth/session/gate/profile and the
// production createApplicationConnections guard are executed unchanged.
function connectionSdk(w,trustedUid='synthetic-phone-owner'){
 const apps=new Map(),databases=new Map(),create=w.FC.cloudAuth.create;
 const sdk={app:{...w.FC_AUTH_TEST_OPTIONS?.sdk?.app,initializeApp(options,name){const app={options,name};apps.set(name,app);return app;},getApp:name=>apps.get(name)},auth:{...w.FC_AUTH_TEST_OPTIONS?.sdk?.auth,
  initializeAuth(app){return app.auth={app,currentUser:null,listeners:new Set()};},onAuthStateChanged(auth,fn){auth.listeners.add(fn);queueMicrotask(()=>fn(auth.currentUser));return()=>auth.listeners.delete(fn);},getAuth:app=>app.auth,
  async updateCurrentUser(auth,user){auth.currentUser=user;for(const fn of auth.listeners||[])fn(user);}},
  firestore:{...w.FC_AUTH_TEST_OPTIONS?.sdk?.firestore,getFirestore(app){if(!databases.has(app))databases.set(app,{app,_databaseId:{projectId:app.options.projectId,database:'(default)'},_settings:{host:'127.0.0.1:18080',ssl:false}});return databases.get(app);},async terminate(){}}};
 if(w.FC_AUTH_TEST_OPTIONS?.sdk?.auth)w.FC_AUTH_TEST_OPTIONS.sdk.auth.connectAuthEmulator=auth=>{auth.emulatorConfig={host:'127.0.0.1',port:19099,protocol:'http'};};
 w.FC.cloudAuth.create=async options=>{
  if(!options.appName?.startsWith('meble-sync-'))return create(options);
  const auth={currentUser:options.sessionOnly?null:{uid:trustedUid,providerData:[{providerId:'google.com'}]},emulatorConfig:{host:'127.0.0.1',port:19099,protocol:'http'}},app={options:options.firebaseConfig,auth};auth.app=app;apps.set(options.appName,app);
  const identity=()=>{if(!auth.currentUser)throw Error('AUTH_SESSION_UNCONFIRMED');return {uid:auth.currentUser.uid,epoch:1};};
  return {identity,verificationContext:()=>({app,auth,target:options.target,emulator:options.emulator}),
   subscribe(fn){const id=identity();fn({status:'authenticated',...id});return()=>{};},async signOut(){auth.currentUser=null;},async close(){}};
 };
 return sdk;
}
function startup(w,connect){
 const calls={connections:0,runtime:0,resumes:0,context:null,authorized:false};w.location.hostname='localhost';
 const source=fs.readFileSync('js/app/cloud/application-bootstrap.js','utf8').replace(/\bimport\(/g,'loadModule(');
 new Function('window','document','localStorage','location','navigator','loadModule',source)(w,w.document,w.localStorage,w.location,w.navigator,async file=>{
  if(file==='../../../sync/application-boot.mjs')return {prepareApplicationBoot:async()=>({})};
  if(file==='../../../sync/application-runtime.mjs')return {startApplicationRuntime:async()=>{calls.runtime++;return {status:()=>({state:'active'}),async resume(){calls.resumes++;}};}};
  if(['./global-data-contract.js','./cloud-pilot-contract.js','./firebase-global-transport.js'].includes(file))return {};
  throw Error('UNEXPECTED_STARTUP_MODULE');
 });
 w.FC.applicationStartup.configureEmulator({name:'meble-lf-test-startup-auth',connections:async input=>{
  calls.connections++;calls.context={context:!!input.authSession?.verificationContext(),identity:!!input.authSession?.identity().uid,lease:!!input.lease,mode:input.localAccess.mode};
  const result=await connect(input);calls.authorized=result.writer.lease.isValid();return result;
 }});return calls;
}
function desktop(connect,mode='ok'){let release,renew,invalidate,completeProof,attempts=0,aborts=0,calls;const r=world({},null,{realAuth:true,beforeMain(w){
 const create=w.FC.cloudAccessVerifier.create;w.FC.cloudAccessVerifier.create=(...args)=>{const verifier=create(...args);return {...verifier,async verify(id){attempts++;if(attempts>1){if(mode==='unavailable')throw Error('AUTH_ACCESS_UNCONFIRMED');if(mode==='denied')return {ok:false,denied:true};if(mode==='pending'){const proof=await verifier.verify(id);return new Promise(resolve=>{completeProof=async()=>{resolve(proof);};});}}return verifier.verify(id);},watch(id,reply){invalidate=reply;renew=()=>verifier.verify(id).then(reply);return()=>{};}};};
 const createAuth=w.FC.cloudAuth.create;w.FC.cloudAuth.create=async options=>{const session=await createAuth(options);w.startupAuth=session;return session;};
 const sdk=connectionSdk(w);calls=startup(w,input=>connect({window:w,...input,sdk}));
 w.FC.mainBusinessLoader={create:()=>({start:()=>new Promise(resolve=>{release=resolve;}),abort(){aborts++;}})};
 }});return {...r,get authCreates(){return r.authCreates;},get calls(){return calls;},get release(){return release;},get aborts(){return aborts;},get attempts(){return attempts;},get completeProof(){return completeProof;},renew:()=>renew(),offline:()=>invalidate({ok:false}),deny:()=>invalidate({ok:false,denied:true})};}
async function begin(r){await until(()=>r.nodes['auth-google']?.disabled===false);r.input('click','auth-google');await until(()=>r.release);r.w.projectData={unsaved:'SYNTHETIC_EXACT_RAM'};}
async function main(){
 const {createApplicationConnections:connect}=await import('../sync/application-connections.mjs');
 // Discriminate every term of the original line 33 and an expired, present
 // lease. Expiration of an object is distinct from the null passed by main.
 for(const [ctx,identity,lease,code]of [[null,{uid:'owner'},{uid:'owner'},'LF_APPLICATION_AUTH_REQUIRED'],[{},null,{uid:'owner'},'LF_APPLICATION_AUTH_REQUIRED'],[{}, {uid:'owner'},{uid:'foreign'},'LF_APPLICATION_AUTH_REQUIRED'],[{}, {uid:'owner'},null,'LF_APPLICATION_AUTH_REQUIRED'],[{}, {uid:'owner'},{uid:'owner',assert(){throw Error('AUTH_ACCESS_REVOKED');}},'AUTH_ACCESS_REVOKED']]){
  const w={FC:{},__FC_MAIN_ACCESS__:{assert(){}}};await assert.rejects(connect({window:w,sdk:{},authSession:{verificationContext:()=>ctx,identity:()=>identity},lease}),e=>(e.code||e.message)===code);
 }
 console.log('PASS exact connection refusal terms: context, UID, missing/foreign lease; expired present lease refuses separately');
 for(const kind of ['uncertainty','denial']){
  const r=desktop(connect);try{await begin(r);const before=[...r.shared.rows];
   if(kind==='uncertainty')r.offline();else r.deny();
   assert.equal(r.w.__FC_MAIN_ACCESS__.isValid(),false,kind);assert.equal(r.calls.connections,0);assert.equal(r.calls.runtime,0);assert.equal(r.aborts,1);
   if(kind!=='denial')assert.equal(r.w.FC.applicationStartup.diagnostics().firstError.code,'AUTH_ACCESS_UNCONFIRMED');
   r.release();await tick();await tick();assert.equal(r.calls.connections,0);assert.equal(r.ready(),false);assert.deepEqual(r.w.projectData,{unsaved:'SYNTHETIC_EXACT_RAM'});
   for(const [key,raw]of before)if(key.startsWith('fc_'))assert.equal(r.shared.rows.get(key),raw);
  }finally{r.close();}
 }
 console.log('PASS failed renewal/denial still stops loading, aborts once and preserves original error/RAM/business data');
 const expired=desktop(connect);try{await begin(expired);expired.advance(46000);assert.equal(expired.w.__FC_MAIN_ACCESS__.isValid(),true);assert.equal(expired.aborts,0);expired.release();await until(()=>expired.ready());
  assert.equal(expired.attempts,2);assert.equal(expired.calls.authorized,true);assert.equal(expired.calls.runtime,1);assert.equal(expired.w.popupCalls,1);assert.equal(expired.authCreates,1);assert.equal(expired.w.FC.applicationStartup.diagnostics().firstError,null);
  await expired.w.FC.applicationStartup.refresh();assert.equal(expired.calls.resumes,1);assert.equal(expired.calls.connections,2);assert.equal(expired.attempts,2);assert.equal(expired.w.FC.applicationStartup.diagnostics().firstError,null);
 }finally{expired.close();}
 console.log('PASS expired initial grant is freshly verified on the same Auth after loading, one startup/popup and unchanged 45s bound');
 for(const mode of ['unavailable','denied','pending','account','epoch']){
  const r=desktop(connect,['account','epoch'].includes(mode)?'pending':mode);try{await begin(r);r.advance(46000);r.release();await until(()=>r.attempts===2);
   if(mode==='pending'){await until(()=>r.completeProof);r.advance(10001);await until(()=>!r.w.__FC_MAIN_ACCESS__.isValid());await r.completeProof();}
   if(mode==='account'){await until(()=>r.completeProof);const a=r.w.startupAuth.verificationContext().auth;a.currentUser={uid:'foreign-owner',providerData:[{providerId:'google.com'}]};for(const fn of a.listeners)fn(a.currentUser);await r.completeProof();}
   if(mode==='epoch'){await until(()=>r.completeProof);const a=r.w.startupAuth.verificationContext().auth,user=a.currentUser;a.currentUser=null;for(const fn of a.listeners)fn(null);a.currentUser=user;for(const fn of a.listeners)fn(user);await r.completeProof();}
   await until(()=>!r.w.__FC_MAIN_ACCESS__.isValid());await tick();assert.equal(r.calls.runtime,0);assert.equal(r.ready(),false);assert.deepEqual(r.w.projectData,{unsaved:'SYNTHETIC_EXACT_RAM'});
  }finally{r.close();}
 }
 console.log('PASS missing/denied/timed-out fresh proof and late old-session/account-change proof cannot start runtime or erase RAM');
 const offline=desktop(connect);try{await begin(offline);offline.advance(46000);offline.w.navigator.onLine=false;offline.release();await until(()=>!offline.w.__FC_MAIN_ACCESS__.isValid());assert.equal(offline.calls.connections,0);assert.equal(offline.calls.runtime,0);assert.deepEqual(offline.w.projectData,{unsaved:'SYNTHETIC_EXACT_RAM'});}finally{offline.close();}
 const renewed=desktop(connect);try{await begin(renewed);renewed.advance(30000);await renewed.renew();renewed.advance(16000);renewed.release();await until(()=>renewed.ready());
  assert.deepEqual(renewed.calls.context,{context:true,identity:true,lease:true,mode:'desktop'});assert.equal(renewed.calls.runtime,1);assert.equal(renewed.aborts,0);
 }finally{renewed.close();}
 const duplicate=desktop(connect);try{await begin(duplicate);const a=duplicate.w.startupAuth.verificationContext().auth;for(const fn of a.listeners)fn(a.currentUser);await until(()=>duplicate.attempts===2);duplicate.release();await until(()=>duplicate.ready());assert.equal(duplicate.calls.runtime,1);assert.equal(duplicate.calls.connections,1);assert.equal(duplicate.authCreates,1);}finally{duplicate.close();}
 console.log('PASS a renewed same-owner lease survives delayed loading without extending policy, second popup or duplicate startup');
 const phone=world();await phone.login();await phone.trust();let release,calls;
 const trusted=world(phone.shared,null,{realAuth:true,beforeMain(w){w.FC_AUTH_TEST_OPTIONS={firebaseConfig:{apiKey:'demo',projectId:'demo-meble-app',appId:'demo',authDomain:'demo.invalid'},target:'emulator',emulator:{host:'127.0.0.1',port:19099,firestorePort:18080},sdk:w.FC_AUTH_TEST_OPTIONS.sdk};
  const sdk=connectionSdk(w,'owner');calls=startup(w,input=>connect({window:w,...input,sdk}));w.FC.mainBusinessLoader={create:()=>({start:()=>new Promise(resolve=>{release=resolve;}),abort(){throw Error('TRUSTED_LOADING_ABORTED');}})};
 }});
 try{await until(()=>release);trusted.advance(46000);release();await until(()=>trusted.ready());assert.deepEqual(calls.context,{context:false,identity:false,lease:false,mode:'trusted'});assert.equal(calls.runtime,1);assert.equal(trusted.logins,0);
 }finally{trusted.close();}
 let foreignCalls;const foreign=world(phone.shared,null,{realAuth:true,beforeMain(w){const sdk=connectionSdk(w,'foreign-owner');foreignCalls=startup(w,input=>connect({window:w,...input,sdk}));}});
 try{await until(()=>foreign.w.FC.applicationStartup.diagnostics().firstError);assert.equal(foreign.w.FC.applicationStartup.diagnostics().firstError.code,'LF_SYNC_AUTH_OWNER_MISMATCH');assert.equal(foreign.ready(),false);assert.equal(foreignCalls.runtime,0);assert.equal(foreign.logins,0);}
 finally{phone.close();foreign.close();}
 console.log('PASS trusted cold phone has no main Auth/lease, obtains its own current same-owner cloud grant, preserves offline/local policy');
}
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={connectionSdk,main};

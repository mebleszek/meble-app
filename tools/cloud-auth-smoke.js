#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const config={target:'live-auth',firebaseConfig:{apiKey:'synthetic-public',authDomain:'mebleszek-meble-app.firebaseapp.com',projectId:'mebleszek-meble-app',appId:'synthetic-app'}};
function runtime(){const s={FC:{}};for(const name of ['firebase-pilot-transport','cloud-auth','auth-access-gate','cloud-access-verifier'])new Function('window',fs.readFileSync(path.join(__dirname,'../js/app/cloud',name+'.js'),'utf8'))(s);return s;}
function fakeSdk(){
 let listener,current=null,popup,stored=null,sets=0,inits=0,providerCalls=0;
 const sdk={app:{initializeApp(){inits++;return {};},deleteApp:async()=>{}},auth:{
  inMemoryPersistence:class Memory{},indexedDBLocalPersistence:class Indexed{},browserLocalPersistence:class Local{},
  initializeAuth(app,options){assert.equal(options.persistence.length,2);current=stored;return {get currentUser(){return current;}};},
  setPersistence:async()=>{sets++;},onAuthStateChanged(auth,fn){listener=fn;queueMicrotask(()=>fn(current));return ()=>{listener=null;};},
  GoogleAuthProvider:class {setCustomParameters(value){assert.equal(value.prompt,'select_account');providerCalls++;}},
  signInWithPopup(){popup=true;return Promise.resolve({});},signOut:async()=>{current=null;stored=null;listener?.(null);}
 }};
 return {sdk,emit(uid){current=uid?{uid,providerData:[{providerId:'google.com'}]}:null;stored=current;listener?.(current);},popupError(code){sdk.auth.signInWithPopup=()=>{popup=true;return Promise.reject({code,message:'private data must not leak'});};},get popup(){return popup;},get counts(){return {sets,inits,providerCalls};}};
}
async function instance(){const s=runtime(),fake=fakeSdk(),auth=await s.FC.cloudAuth.create({...config,sdk:fake.sdk});return {s,fake,auth};}
test('Auth registration is inert; main entry gates business scripts and the old URL redirects',()=>{
 const s=runtime();assert.ok(s.FC.cloudAuth);const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.match(index,/<template id="business-template">/);assert.match(index,/js\/main-login\.js/);
 const page=fs.readFileSync(path.join(__dirname,'../auth-test.html'),'utf8');assert.match(page,/url=index\.html/);assert.equal(/<script/.test(page),false);
});
test('Dedicated page public live-auth config matches the Console fields and loads only Auth SDK',async()=>{
 const s=runtime(),fake=fakeSdk();let loads=0,business=0;
 s.FC.firebasePilotTransport.loadAuthSdk=async()=>{loads++;return fake.sdk;};
 s.FC.firebasePilotTransport.loadSdk=()=>{throw Error('Firestore must not load');};
 new Function('window',fs.readFileSync(path.join(__dirname,'../js/auth-test-config.js'),'utf8'))(s);
 assert.equal(loads,0,'config evaluation is inert');
 assert.deepEqual(s.FC_AUTH_TEST_OPTIONS,{target:'live-auth',firebaseConfig:{
  apiKey:'AIzaSyDv89lIX2ZLUJwwO1dMxvQuNU17zNMxqUQ',authDomain:'mebleszek-meble-app.firebaseapp.com',
  projectId:'mebleszek-meble-app',appId:'1:447820686604:web:6bc0817aa365b1b613d529'
 }});
 assert.deepEqual(s.FC.cloudAuth.configOf(s.FC_AUTH_TEST_OPTIONS),s.FC_AUTH_TEST_OPTIONS.firebaseConfig);
 const auth=await s.FC.cloudAuth.create(s.FC_AUTH_TEST_OPTIONS);assert.equal(loads,1);
 const gate=s.FC.authAccessGate.create(auth,{onAuthorized:()=>business++});
 fake.emit('synthetic-live-config');await tick();assert.equal(gate.state().status,'unapproved');assert.equal(business,0);
 gate.close();await auth.close();
 const page=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.match(page,/auth-test-config\.js\?v=20261017_main_login/);
});
test('Missing/invalid config refuses before any SDK initialization; real target is pinned',async()=>{
 const s=runtime(),fake=fakeSdk();await assert.rejects(s.FC.cloudAuth.create({sdk:fake.sdk}),e=>e.code==='AUTH_CONFIG_REQUIRED');
 for(const value of [{...config,firebaseConfig:{...config.firebaseConfig,projectId:'other'}},{...config,firebaseConfig:{...config.firebaseConfig,serviceAccount:{}}},{...config,target:'emulator',emulator:{host:'example.org',port:19099}}])await assert.rejects(s.FC.cloudAuth.create({...value,sdk:fake.sdk}),e=>e.code==='AUTH_CONFIG_INVALID');assert.equal(fake.counts.inits,0);
});
test('Initial session resolution, Google UID and logout; no application-managed token persistence',async()=>{
 const {s,fake,auth}=await instance();assert.equal(auth.state().status,'unauthenticated');assert.equal(fake.counts.sets,1);
 fake.emit('synthetic-A');assert.equal(auth.identity().uid,'synthetic-A');assert.equal(auth.state().status,'authenticated');
 await auth.signOut();assert.equal(auth.state().status,'unauthenticated');assert.throws(()=>auth.identity(),e=>e.code==='CLOUD_AUTH_REQUIRED');await auth.close();
});
test('Popup is invoked synchronously in the gesture stack and always selects an account',async()=>{
 const {fake,auth}=await instance();const pending=auth.signInGoogle();assert.equal(fake.popup,true);assert.equal(fake.counts.providerCalls,1);await pending;await auth.close();
});
test('Successful popup into the same UID resolves checking even without another auth-state event',async()=>{
 const {fake,auth}=await instance();fake.emit('synthetic-A');assert.equal(auth.state().status,'authenticated');
 const out=await auth.signInGoogle();assert.equal(out.ok,true);assert.equal(auth.state().status,'authenticated');assert.equal(auth.state().uid,'synthetic-A');await auth.close();
});
test('Popup closed, blocked, denied-domain and network failures remain retryable and sanitized',async()=>{
 for(const code of ['auth/popup-closed-by-user','auth/popup-blocked','auth/network-request-failed','auth/unauthorized-domain']){
  const {fake,auth}=await instance();fake.popupError(code);assert.equal((await auth.signInGoogle()).ok,false);assert.equal(auth.state().code,code);assert.equal(auth.state().message.includes('private'),false);assert.equal((await auth.signInGoogle()).code,code);await auth.close();
 }
});
test('Initialization failure disposes the SDK app and preserves the ability to retry',async()=>{
 const s=runtime(),fake=fakeSdk();let deletes=0;const initialize=fake.sdk.auth.initializeAuth;
 fake.sdk.app.deleteApp=async()=>deletes++;fake.sdk.auth.initializeAuth=()=>{throw {code:'auth/invalid-api-key'};};
 await assert.rejects(s.FC.cloudAuth.create({...config,sdk:fake.sdk}),e=>e.code==='auth/invalid-api-key');assert.equal(deletes,1);
 fake.sdk.auth.initializeAuth=initialize;const auth=await s.FC.cloudAuth.create({...config,sdk:fake.sdk});assert.equal(auth.state().status,'unauthenticated');await auth.close();
});
test('No persistence silently falls back to an unremembered session',async()=>{
 const s=runtime(),fake=fakeSdk();fake.sdk.auth.setPersistence=async()=>{throw Error('storage disabled');};await assert.rejects(s.FC.cloudAuth.create({...config,sdk:fake.sdk}),e=>e.code==='AUTH_PERSISTENCE_UNAVAILABLE');
});
test('Google login without a server verifier never initializes business modules',async()=>{
 const {s,fake,auth}=await instance();let business=0;const gate=s.FC.authAccessGate.create(auth,{onAuthorized:()=>business++});fake.emit('synthetic-A');await tick();assert.equal(gate.state().status,'unapproved');assert.equal(gate.state().code,'AUTH_AUTHORIZATION_NOT_CONFIGURED');assert.equal(business,0);gate.close();await auth.close();
});
test('Server refusal/foreign UID/error and unresolved verification all keep the business loader blocked',async()=>{
 for(const reply of [{ok:false},{ok:true,uid:'foreign',validUntil:Date.now()+45000},null]){
  const {s,fake,auth}=await instance();let business=0;const gate=s.FC.authAccessGate.create(auth,{verifyAccess:async()=>reply,onAuthorized:()=>business++});fake.emit('synthetic-A');await tick();assert.equal(gate.state().status,'unapproved');assert.equal(business,0);gate.close();await auth.close();
 }
 const {s,fake,auth}=await instance();let business=0;const gate=s.FC.authAccessGate.create(auth,{verifyAccess:async()=>{throw Error('network');},onAuthorized:()=>business++});fake.emit('synthetic-A');await tick();assert.equal(gate.state().status,'error');assert.equal(business,0);gate.close();await auth.close();
});
const invalidDeadlines=[
 ['missing',()=>undefined],['infinite',()=>Infinity],['negative infinity',()=>-Infinity],['NaN',()=>NaN],
 ['past',()=>Date.now()-1],['now',()=>Date.now()],['over 45 seconds',()=>Date.now()+60000],
 ['string',()=>String(Date.now()+45000)],['null',()=>null]
];
for(const [name,deadline]of invalidDeadlines)test('Initial proof rejects '+name+' validUntil',async()=>{
 const {s,fake,auth}=await instance();let opened=0,watched=0;
 const gate=s.FC.authAccessGate.create(auth,{verifyAccess:async({uid})=>({ok:true,uid,...(name==='missing'?{}:{validUntil:deadline()})}),
  watchAccess:()=>{watched++;return ()=>{};},onAuthorized:()=>opened++});
 try{fake.emit('synthetic-deadline');await tick();assert.equal(gate.state().status,'unapproved');assert.equal(opened,0);assert.equal(watched,0);}
 finally{gate.close();await auth.close();}
});
for(const [name,deadline]of invalidDeadlines)test('Renewal rejects '+name+' validUntil and permanently revokes the lease',async()=>{
 const {s,fake,auth}=await instance();let lease,reply,stops=0,opened=0;
 const gate=s.FC.authAccessGate.create(auth,{verifyAccess:async({uid})=>({ok:true,uid,validUntil:Date.now()+45000}),
  watchAccess:(_,fn)=>{reply=fn;return ()=>stops++;},onAuthorized:value=>{lease=value;opened++;}});
 try{
  fake.emit('synthetic-deadline');await tick();assert.equal(lease.isValid(),true);
  reply({ok:true,uid:'synthetic-deadline',...(name==='missing'?{}:{validUntil:deadline()})});
  assert.equal(gate.state().status,'error');assert.equal(gate.state().code,'AUTH_ACCESS_UNCONFIRMED');
  assert.equal(lease.isValid(),false);assert.throws(()=>lease.assert(),/AUTH_ACCESS_REVOKED/);assert.equal(stops,1);
  reply({ok:true,uid:'synthetic-deadline',validUntil:Date.now()+45000});assert.equal(lease.isValid(),false);assert.equal(opened,1);
 }finally{gate.close();await auth.close();}
});
test('The finite lease boundary accepts 45 seconds and rejects 45 seconds plus one millisecond',async()=>{
 const originalNow=Date.now,now=originalNow();Date.now=()=>now;
 try{
  for(const duration of [45000,45001]){
   const {s,fake,auth}=await instance();let lease,opened=0;
   const gate=s.FC.authAccessGate.create(auth,{verifyAccess:async({uid})=>({ok:true,uid,validUntil:now+duration}),onAuthorized:value=>{lease=value;opened++;}});
   try{fake.emit('synthetic-boundary');await tick();assert.equal(opened,duration===45000?1:0);assert.equal(gate.state().status,duration===45000?'authorized':'unapproved');if(lease)assert.equal(lease.isValid(),true);}
   finally{gate.close();await auth.close();}
  }
 }finally{Date.now=originalNow;}
});
test('Only verified exact UID obtains a revocable lease; logout blocks immediately',async()=>{
 const {s,fake,auth}=await instance();let lease,started=0;const gate=s.FC.authAccessGate.create(auth,{verifyAccess:async({uid})=>({ok:true,uid,validUntil:Date.now()+45000}),onAuthorized:value=>{lease=value;started++;}});
 fake.emit('synthetic-A');await tick();assert.equal(started,1);assert.equal(lease.isValid(),true);const out=auth.signOut();assert.equal(lease.isValid(),false);assert.throws(()=>lease.assert(),/AUTH_ACCESS_REVOKED/);await out;gate.close();await auth.close();
});
test('Changing account while the authorization promise waits cannot activate stale identity',async()=>{
 const {s,fake,auth}=await instance();const decisions=[],opened=[];const gate=s.FC.authAccessGate.create(auth,{verifyAccess:({uid})=>new Promise(resolve=>decisions.push(()=>resolve({ok:true,uid,validUntil:Date.now()+45000}))),onAuthorized:lease=>opened.push(lease.uid)});
 fake.emit('synthetic-A');fake.emit('synthetic-B');decisions[0]();await tick();assert.deepEqual(opened,[]);decisions[1]();await tick();assert.deepEqual(opened,['synthetic-B']);gate.close();await auth.close();
});
test('Server-watch revocation invalidates and never resurrects the old lease',async()=>{
 const {s,fake,auth}=await instance();let invalidate,lease,stops=0;
 const gate=s.FC.authAccessGate.create(auth,{verifyAccess:async({uid})=>({ok:true,uid,validUntil:Date.now()+45000}),watchAccess:(_,fn)=>{invalidate=fn;return ()=>stops++;},onAuthorized:value=>{lease=value;}});
 fake.emit('synthetic-approved');await tick();assert.equal(lease.isValid(),true);
 invalidate({ok:false,denied:true});assert.equal(gate.state().status,'revoked');assert.equal(lease.isValid(),false);assert.equal(stops,1);
 invalidate({ok:true,uid:'synthetic-approved',validUntil:Date.now()+45000});assert.equal(lease.isValid(),false);
 gate.close();await auth.close();
});
test('A bounded proof expires even when no new Auth event occurs',async()=>{
 const {s,fake,auth}=await instance();let lease;
 const gate=s.FC.authAccessGate.create(auth,{verifyAccess:async({uid})=>({ok:true,uid,validUntil:Date.now()+50}),onAuthorized:value=>{lease=value;}});
 fake.emit('synthetic-expiry');await tick();assert.equal(lease.isValid(),true);
 await new Promise(resolve=>setTimeout(resolve,80));assert.equal(lease.isValid(),false);assert.equal(gate.state().code,'AUTH_ACCESS_EXPIRED');gate.close();await auth.close();
});
test('Broken access watcher cannot open a business loader or leave a valid lease',async()=>{
 const {s,fake,auth}=await instance();let opened=0;
 const gate=s.FC.authAccessGate.create(auth,{verifyAccess:async({uid})=>({ok:true,uid,validUntil:Date.now()+45000}),watchAccess:()=>undefined,onAuthorized:()=>opened++});
 fake.emit('synthetic-broken-watch');await tick();assert.equal(gate.state().status,'error');assert.equal(opened,0);gate.close();await auth.close();
});
test('Cache, pending writes, wrong document and unknown probe fields cannot produce server proof',async()=>{
 for(const variant of ['cache','pending','wrong-uid','extra']){
  const {s,fake,auth}=await instance();fake.emit('synthetic-probe');
  auth.verificationContext=()=>({app:{options:{projectId:'mebleszek-meble-app'}},auth:{currentUser:{uid:'synthetic-probe'}},target:'live-auth'});
  const verifier=s.FC.cloudAccessVerifier.create(auth,{sdk:{initializeFirestore:()=>({}),memoryLocalCache:()=>({}),doc:(_,collection,uid)=>{assert.equal(collection,'appAccess');assert.equal(uid,'synthetic-probe');return {};},getDocFromServer:async()=>({metadata:{fromCache:variant==='cache',hasPendingWrites:variant==='pending'},exists:()=>true,id:variant==='wrong-uid'?'foreign':'synthetic-probe',data:()=>variant==='extra'?{schemaVersion:1,secret:'synthetic'}:{schemaVersion:1}}),terminate:async()=>{}}});
  await assert.rejects(verifier.verify(auth.identity()));await verifier.close();await auth.close();
 }
});
test('A previously server-marked snapshot cannot replace a new transactional Rules decision',async()=>{
 const {s,fake,auth}=await instance();fake.emit('synthetic-fresh-rpc');let revoked=false,transactions=0;
 auth.verificationContext=()=>({app:{options:{projectId:'mebleszek-meble-app'}},auth:{currentUser:{uid:'synthetic-fresh-rpc'}},target:'live-auth'});
 const snapshot={metadata:{fromCache:false,hasPendingWrites:false},exists:()=>true,id:'synthetic-fresh-rpc',data:()=>({schemaVersion:1})};
 const verifier=s.FC.cloudAccessVerifier.create(auth,{sdk:{initializeFirestore:()=>({}),memoryLocalCache:()=>({}),doc:()=>({}),
  getDocFromServer:async()=>snapshot,runTransaction:async(_,fn)=>{transactions++;if(revoked)throw {code:'permission-denied'};return fn({get:async()=>snapshot});},terminate:async()=>{}}});
 assert.equal((await verifier.verify(auth.identity())).ok,true);revoked=true;
 assert.equal((await verifier.verify(auth.identity())).ok,false);assert.equal(transactions,2);await verifier.close();await auth.close();
});
async function main(){for(const [name,fn]of tests){await fn();console.log('PASS '+name);}console.log('Auth opt-in and prepared gate: '+tests.length+'/'+tests.length+' PASS');}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={runtime};

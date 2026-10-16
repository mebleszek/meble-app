#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const config={target:'live-auth',firebaseConfig:{apiKey:'synthetic-public',authDomain:'mebleszek-meble-app.firebaseapp.com',projectId:'mebleszek-meble-app',appId:'synthetic-app'}};
function runtime(){const s={FC:{}};for(const name of ['firebase-pilot-transport','cloud-auth','auth-access-gate'])new Function('window',fs.readFileSync(path.join(__dirname,'../js/app/cloud',name+'.js'),'utf8'))(s);return s;}
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
test('Auth module registration is inert and normal index/boot stay outside opt-in page',()=>{
 const s=runtime();assert.ok(s.FC.cloudAuth);const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.equal(/auth-test|cloud-auth\.js|auth-access-gate\.js/.test(index),false);
 const page=fs.readFileSync(path.join(__dirname,'../auth-test.html'),'utf8');assert.equal(/src=["'][^"']*(?:boot\.js|app\.js|project-store|catalog-store|firebase-firestore)/.test(page),false);
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
 for(const reply of [{ok:false},{ok:true,uid:'foreign'},null]){
  const {s,fake,auth}=await instance();let business=0;const gate=s.FC.authAccessGate.create(auth,{verifyAccess:async()=>reply,onAuthorized:()=>business++});fake.emit('synthetic-A');await tick();assert.equal(gate.state().status,'unapproved');assert.equal(business,0);gate.close();await auth.close();
 }
 const {s,fake,auth}=await instance();let business=0;const gate=s.FC.authAccessGate.create(auth,{verifyAccess:async()=>{throw Error('network');},onAuthorized:()=>business++});fake.emit('synthetic-A');await tick();assert.equal(gate.state().status,'error');assert.equal(business,0);gate.close();await auth.close();
});
test('Only verified exact UID obtains a revocable lease; logout blocks immediately',async()=>{
 const {s,fake,auth}=await instance();let lease,started=0;const gate=s.FC.authAccessGate.create(auth,{verifyAccess:async({uid})=>({ok:true,uid}),onAuthorized:value=>{lease=value;started++;}});
 fake.emit('synthetic-A');await tick();assert.equal(started,1);assert.equal(lease.isValid(),true);const out=auth.signOut();assert.equal(lease.isValid(),false);assert.throws(()=>lease.assert(),/AUTH_ACCESS_REVOKED/);await out;gate.close();await auth.close();
});
test('Changing account while the authorization promise waits cannot activate stale identity',async()=>{
 const {s,fake,auth}=await instance();const decisions=[],opened=[];const gate=s.FC.authAccessGate.create(auth,{verifyAccess:({uid})=>new Promise(resolve=>decisions.push(()=>resolve({ok:true,uid}))),onAuthorized:lease=>opened.push(lease.uid)});
 fake.emit('synthetic-A');fake.emit('synthetic-B');decisions[0]();await tick();assert.deepEqual(opened,[]);decisions[1]();await tick();assert.deepEqual(opened,['synthetic-B']);gate.close();await auth.close();
});
async function main(){for(const [name,fn]of tests){await fn();console.log('PASS '+name);}console.log('Auth opt-in and prepared gate: '+tests.length+'/'+tests.length+' PASS');}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={runtime};

'use strict';
// Focused policy/crypto tests. Native IDB and offline startup are browser tests.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const fixture=require('./helpers/profile-indexeddb-fixture');
class Storage{constructor(){this.rows=new Map();}getItem(k){return this.rows.get(k)??null;}setItem(k,v){this.rows.set(k,String(v));}}
function runtime(){const s={FC:{},crypto:webcrypto,location:{origin:'https://synthetic.invalid'}};
  new Function('window','Storage',fs.readFileSync('js/app/cloud/local-device-access.js','utf8'))(s,Storage);return s.FC.localDeviceAccess;}
async function main(){
 const api=runtime(),db=fixture(),storage=new Storage();let checks=0;
 const options={indexedDB:db,crypto:webcrypto,storage,origin:'https://synthetic.invalid'},trust=api.createTrust(options);
 assert.equal(await trust.restore(),null);assert.equal(db.rows.size,0);
 storage.setItem('trusted','true');assert.equal(await trust.restore(),null);
 await assert.rejects(trust.enroll({uid:'owner',profileAttemptId:'profile',check(){},consent:false}),/CONSENT/);
 const cap=await trust.enroll({uid:'owner',profileAttemptId:'profile',check(){checks++;},consent:true});assert.ok(checks>1);
 assert.equal(cap.uid,'owner');assert.equal(db.rows.get('active').privateKey.extractable,false);
 await assert.rejects(webcrypto.subtle.exportKey('pkcs8',db.rows.get('active').privateKey));
 const restored=await api.createTrust(options).restore();assert.equal(restored.uid,'owner');assert.equal(restored.profileAttemptId,'profile');
 let wall=1000,mono=0,locks=0;const session=api.createSession({now:()=>wall,mono:()=>mono,onLock:()=>locks++,timer:()=>0,cancel(){}});
 assert.throws(()=>session.trusted({uid:'owner',assert(){}}),/DEVICE_TRUST_INVALID/);
 session.trusted(restored);wall+=7*86400000;mono+=7*86400000;assert.equal(session.isValid(),true);
 const signed=db.rows.get('active');db.rows.set('active',{...signed,statement:{...signed.statement,uid:'other'}});
 await assert.rejects(trust.restore(),/DEVICE_TRUST_INVALID/);db.rows.set('active',signed);
 const copied=new Storage();copied.setItem(trust.key,storage.getItem(trust.key));
 await assert.rejects(api.createTrust({...options,storage:copied,indexedDB:fixture()}).restore(),/DEVICE_TRUST_INVALID/);
 const revoked=trust.revoke();assert.throws(()=>cap.assert(),/REVOKED/);assert.equal(session.isValid(),false);await revoked;
 assert.equal(await trust.restore(),null);assert.equal(locks,1);
 await assert.rejects(trust.enroll({uid:'other',profileAttemptId:'other-profile',check(){},consent:true}),/OTHER_ACCOUNT/);
 assert.equal(await trust.restore(),null);
 console.log('PASS trust: explicit consent, real non-exportable key/signature, offline restore, corruption/new profile/foreign UID refusal, synchronous logout veto');
 // A different tab's logout must veto a suspended enrollment, even before its
 // async IDB tombstone commits. It must not resurrect the active fence.
 const db2=fixture(),local2=new Storage(),a=api.createTrust({...options,indexedDB:db2,storage:local2}),b=api.createTrust({...options,indexedDB:db2,storage:local2});
 let revoke;await assert.rejects(a.enroll({uid:'owner',profileAttemptId:'profile',consent:true,check(){
   if(local2.getItem(a.key)?.startsWith('pending:')&&!revoke)revoke=b.revoke();
 }}),/REVOKED/);await revoke;assert.equal(await a.restore(),null);
 console.log('PASS trust: cross-tab logout during enrollment cannot resurrect consent');
 session.desktop('owner');const identity=session.identity();wall+=299999;mono+=299999;session.activity({isTrusted:false});assert.equal(session.isValid(),true);
 session.activity({isTrusted:true});assert.deepEqual(session.identity(),identity);wall+=299999;mono+=299999;assert.equal(session.isValid(),true);
 wall++;mono++;assert.equal(session.isValid(),false);session.activity({isTrusted:true});assert.equal(session.isValid(),false);
 session.desktop('owner');wall+=3600000;assert.equal(session.isValid(),false);
 session.desktop('owner');wall--;assert.equal(session.isValid(),false);
 assert.equal(api.createSession({timer:()=>0,cancel(){}}).isValid(),false);
 console.log('PASS desktop: trusted activity only, exact five-minute limit, sleep/clock rollback, no activity resurrection or restart grant');
 const source=fs.readFileSync('js/main-login.js','utf8');
 assert.match(source,/sessionOnly:true/);assert.match(source,/if\(capability\)\{localSession\.trusted/);
 assert.equal(/sessionStorage\.(setItem|getItem)/.test(source),false);
 assert.equal(/session\.(commit|cancel)\(/.test(source),false);
 console.log('PASS integration boundaries: ephemeral Auth, no sessionStorage admission, Save/Cancel untouched');
 const {runtime:authRuntime}=require('./cloud-auth-smoke'),s=authRuntime();let current=null,listener,selected;
 class Memory{}
 const auth=await s.FC.cloudAuth.create({target:'emulator',sessionOnly:true,appName:'synthetic-session-only',
   firebaseConfig:{apiKey:'demo',projectId:'demo-meble-app',authDomain:'demo.invalid',appId:'demo'},emulator:{host:'127.0.0.1',port:19099},
   sdk:{app:{initializeApp:()=>({}),deleteApp:async()=>{}},auth:{inMemoryPersistence:Memory,
     indexedDBLocalPersistence:class Forbidden{},browserLocalPersistence:class Forbidden{},
     initializeAuth(_app,options){assert.deepEqual(options.persistence,[Memory]);return {get currentUser(){return current;}};},
     setPersistence:async(_auth,persistence)=>{selected=persistence;},connectAuthEmulator(){},
     onAuthStateChanged(_auth,fn){listener=fn;queueMicrotask(()=>fn(null));return()=>{};},
     GoogleAuthProvider:class{setCustomParameters(){}},signInWithPopup:async()=>{current={uid:'owner',providerData:[{providerId:'google.com'}]};listener(current);},signOut:async()=>{}
   }}});
 assert.equal(selected,Memory);assert.equal(auth.state().status,'unauthenticated');await auth.signInGoogle();assert.equal(auth.identity().uid,'owner');await auth.close();
 console.log('PASS actual cloudAuth: explicit memory-only persistence, conscious Google action, no persistent fallback');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};

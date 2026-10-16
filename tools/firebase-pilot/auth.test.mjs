// Real Auth emulator, same SDK/UID observer as the pilot. Browser persistence
// is verified separately in auth-browser.test.mjs, not claimed for Node memory.
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as app from 'firebase/app';
import * as authSdk from 'firebase/auth';
const {runtime}=createRequire(import.meta.url)('../cloud-auth-smoke.js');
if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099')throw Error('Auth loopback emulator required');
let serial=0;const clients=[];
async function create(){
 const s=runtime(),name='auth-node-'+(++serial),appInstance=app.initializeApp({projectId:'demo-meble-app',apiKey:'demo-emulator-only'},name);
 // Node SDK has no browser storage. This test-only alias is deliberately memory.
 const sdk={app:{...app,initializeApp:()=>appInstance},auth:{...authSdk,indexedDBLocalPersistence:authSdk.inMemoryPersistence}};
 const controller=await s.FC.cloudAuth.create({target:'emulator',firebaseConfig:{projectId:'demo-meble-app',apiKey:'demo-emulator-only',appId:'demo-only',authDomain:'demo-meble-app.firebaseapp.com'},emulator:{host:'127.0.0.1',port:19099},sdk});
 clients.push(controller);return {s,controller,auth:authSdk.getAuth(appInstance)};
}
async function signIn(a,sub){const part=Buffer.from(JSON.stringify({sub,email:sub+'@example.invalid',email_verified:true})).toString('base64url');return authSdk.signInWithCredential(a,authSdk.GoogleAuthProvider.credential('e30.'+part+'.'));}
after(async()=>{await Promise.all(clients.map(c=>c.close()));});
test('Real Google UID drives the prepared gate; missing server approval remains blocked',async()=>{
 const r=await create();assert.equal(r.controller.state().status,'unauthenticated');let business=0;const gate=r.s.FC.authAccessGate.create(r.controller,{onAuthorized:()=>business++});
 const credential=await signIn(r.auth,'synthetic-auth-one');assert.equal(r.controller.identity().uid,credential.user.uid);assert.equal(gate.state().status,'unapproved');assert.equal(business,0);
 await r.controller.signOut();assert.equal(gate.state().status,'unauthenticated');assert.equal(business,0);gate.close();
});
test('Real account change revokes an already verified lease before a second server decision',async()=>{
 const r=await create();let lease;const gate=r.s.FC.authAccessGate.create(r.controller,{verifyAccess:async({uid})=>({ok:true,uid,validUntil:Date.now()+45000}),onAuthorized:value=>{lease=value;}});
 await signIn(r.auth,'synthetic-auth-two');await new Promise(resolve=>setImmediate(resolve));const old=lease;assert.equal(old.isValid(),true);
 await r.controller.signOut();assert.equal(old.isValid(),false);await signIn(r.auth,'synthetic-auth-three');await new Promise(resolve=>setImmediate(resolve));assert.notEqual(lease.uid,old.uid);assert.equal(old.isValid(),false);gate.close();
});
test('Real anonymous session cannot be mistaken for approved Google identity',async()=>{
 const r=await create();await authSdk.signInAnonymously(r.auth);assert.equal(r.controller.state().status,'error');assert.equal(r.controller.state().code,'AUTH_GOOGLE_REQUIRED');assert.throws(()=>r.controller.identity(),e=>e.code==='CLOUD_GOOGLE_REQUIRED');
});

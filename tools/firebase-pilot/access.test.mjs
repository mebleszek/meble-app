// Real SDK + Auth/Firestore loopback emulators. Never a production account/grant.
import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as app from 'firebase/app';
import * as a from 'firebase/auth';
import * as f from 'firebase/firestore';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
const {runtime}=createRequire(import.meta.url)('../cloud-auth-smoke.js');
if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18080')throw Error('Loopback emulators required');
let env,serial=0;const clients=[];
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
async function until(fn,details=()=>null,timeout=7000){const end=Date.now()+timeout;while(!fn()){assert.ok(Date.now()<end,'authorization state timeout: '+JSON.stringify(details()));await tick();}}
const probe=(db,uid)=>f.doc(db,'appAccess',uid);
const grant=(db,uid)=>f.doc(db,'authorizedUsers',uid);
const raw=(uid,provider='google.com')=>env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).firestore();
async function admin(uid,enabled=true,{pilot=false,document={schemaVersion:1}}={}){
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();await f.setDoc(grant(db,uid),{appEnabled:enabled,enabled:pilot,pilotProjectId:'synthetic-project',pilotInvestorId:'synthetic-investor'});
  if(document!==null)await f.setDoc(probe(db,uid),document);
 });
}
async function client({login=true,anonymous=false}={}){
 const s=runtime(),n=++serial;
 const controller=await s.FC.cloudAuth.create({target:'emulator',appName:'access-'+n,
  firebaseConfig:{apiKey:'demo-only',projectId:'demo-meble-app',appId:'demo-only',authDomain:'demo-meble-app.firebaseapp.com'},
  emulator:{host:'127.0.0.1',port:19099,firestorePort:18080},
  sdk:{app,auth:{...a,indexedDBLocalPersistence:a.inMemoryPersistence}}});
 const instance=app.getApp('access-'+n),auth=a.getAuth(instance);
 if(anonymous)await a.signInAnonymously(auth);
 else if(login){const part=Buffer.from(JSON.stringify({sub:'synthetic-access-'+n,email:'synthetic-'+n+'@example.invalid',email_verified:true})).toString('base64url');await a.signInWithCredential(auth,a.GoogleAuthProvider.credential('e30.'+part+'.'));}
 const verifier=s.FC.cloudAccessVerifier.create(controller,{sdk:f});
 const r={s,controller,auth,verifier,uid:auth.currentUser?.uid,gate:null,db:()=>f.getFirestore(instance)};clients.push(r);return r;
}
function gate(r){let lease;const states=[];r.gate=r.s.FC.authAccessGate.create(r.controller,{verifyAccess:r.verifier.verify,watchAccess:r.verifier.watch,onState:s=>states.push(s),onAuthorized:value=>{lease=value;}});return {states,lease:()=>lease};}
before(async()=>{f.setLogLevel('silent');env=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,rules:fs.readFileSync(new URL('./firestore.rules',import.meta.url),'utf8')}});});
beforeEach(async()=>env.clearFirestore());
afterEach(async()=>{for(const r of clients){r.gate?.close();await r.verifier.close();await r.controller.close();}clients.length=0;});
after(async()=>env?.cleanup());

test('Approved real Google UID obtains server-only proof; app approval alone grants no pilot data access',async()=>{
 const r=await client();await admin(r.uid);const out=await r.verifier.verify(r.controller.identity());
 assert.equal(out.ok,true);assert.equal(out.uid,r.uid);assert.ok(out.validUntil>Date.now());
 await assertSucceeds(f.getDocFromServer(probe(r.db(),r.uid)));
 await assertFails(f.getDocFromServer(f.doc(r.db(),'users',r.uid,'pilotProjects','synthetic-project')));
 const g=gate(r);await until(()=>r.gate.state().status==='authorized');assert.equal(g.lease().isValid(),true);
});
test('Second Google, signed-out, anonymous and direct UI-bypass reads are denied',async()=>{
 const owner=await client(),other=await client();await admin(owner.uid,true,{pilot:true});
 const denied=await other.verifier.verify(other.controller.identity());assert.equal(denied.ok,false);
 for(const db of [raw(other.uid),raw(owner.uid,'anonymous'),env.unauthenticatedContext().firestore()]){
  await assertFails(f.getDocFromServer(probe(db,owner.uid)));
  await assertFails(f.getDocFromServer(f.doc(db,'users',owner.uid,'pilotProjects','synthetic-project')));
 }
 const empty=await client({login:false}),anonymous=await client({anonymous:true});
 await assert.rejects(empty.verifier.verify({uid:owner.uid,epoch:1}));
 await assert.rejects(anonymous.verifier.verify({uid:anonymous.uid,epoch:1}));
});
test('No client lists UID approvals, reads grants or creates/changes/deletes approval/probe documents',async()=>{
 const r=await client();await admin(r.uid);const db=raw(r.uid);
 await assertFails(f.getDocFromServer(grant(db,r.uid)));
 for(const name of ['authorizedUsers','appAccess'])await assertFails(f.getDocs(f.collection(db,name)));
 for(const ref of [grant(db,r.uid),grant(db,'foreign-synthetic'),probe(db,r.uid),probe(db,'foreign-synthetic')]){
  await assertFails(f.setDoc(ref,{appEnabled:true,schemaVersion:1}));await assertFails(f.updateDoc(ref,{appEnabled:true}));await assertFails(f.deleteDoc(ref));
 }
});
test('Administrative revocation invalidates the lease and next direct reads, without touching business data',async()=>{
 const r=await client();await admin(r.uid,true,{pilot:true});const g=gate(r);await until(()=>r.gate.state().status==='authorized');const old=g.lease();
 await env.withSecurityRulesDisabled(ctx=>f.updateDoc(grant(ctx.firestore(),r.uid),{appEnabled:false}));
 // Fresh server RPCs refuse immediately. The UI polls every 30s and its lease
 // expires at 45s; no claim of instantaneous distributed UI invalidation.
 await assertFails(f.runTransaction(r.db(),tx=>tx.get(probe(r.db(),r.uid)),{maxAttempts:1}));
 await assertFails(f.getDocFromServer(f.doc(r.db(),'users',r.uid,'pilotProjects','synthetic-project')));
 assert.equal((await r.verifier.verify(r.controller.identity())).ok,false);
 await until(()=>r.gate.state().status==='revoked',()=>g.states,40000);assert.equal(old.isValid(),false);
 await admin(r.uid);await tick();assert.equal(old.isValid(),false,'revoked lease never resurrects');
});
test('Missing or malformed control document never authorizes despite an admin grant',async()=>{
 const r=await client();await admin(r.uid,true,{document:null});assert.equal((await r.verifier.verify(r.controller.identity())).ok,false);
 await admin(r.uid,true,{document:{schemaVersion:1,untrusted:'synthetic'}});await assert.rejects(r.verifier.verify(r.controller.identity()));
});
test('Offline denies server verification even with the previously cached approved probe',async()=>{
 const r=await client();await admin(r.uid);assert.equal((await r.verifier.verify(r.controller.identity())).ok,true);
 await f.disableNetwork(r.db());await assert.rejects(r.verifier.verify(r.controller.identity()));
});
test('Loss of network revokes bounded access without accepting cached approval',async()=>{
 const r=await client();await admin(r.uid);const g=gate(r);await until(()=>r.gate.state().status==='authorized');
 const old=g.lease();await f.disableNetwork(r.db());
 await until(()=>r.gate.state().status==='error',()=>g.states,40000);assert.equal(old.isValid(),false);
});
test('Logout and changing Google account invalidate the old server-authorized lease',async()=>{
 const r=await client();await admin(r.uid);const g=gate(r);await until(()=>r.gate.state().status==='authorized');const old=g.lease();
 const signout=r.controller.signOut();assert.equal(old.isValid(),false);await signout;
 const part=Buffer.from(JSON.stringify({sub:'synthetic-changed-account',email:'changed@example.invalid',email_verified:true})).toString('base64url');
 await a.signInWithCredential(r.auth,a.GoogleAuthProvider.credential('e30.'+part+'.'));
 await until(()=>r.gate.state().status==='unapproved');assert.equal(old.isValid(),false);
});
test('Expired or unconfirmed server proof cannot run a business loader',async()=>{
 const r=await client();let opened=0;
 r.gate=r.s.FC.authAccessGate.create(r.controller,{verifyAccess:async({uid})=>({ok:true,uid,validUntil:Date.now()-1}),onAuthorized:()=>opened++});
 await until(()=>r.gate.state().status==='unapproved');assert.equal(opened,0);
});
test('Auth-only Rules profile never opens pilot/business paths even if a grant also enables the old data pilot',async()=>{
 const isolated=await initializeTestEnvironment({projectId:'demo-meble-auth-only',firestore:{host:'127.0.0.1',port:18080,rules:fs.readFileSync(new URL('./firestore-auth-only.rules',import.meta.url),'utf8')}});
 try{
  const uid='synthetic-auth-only-owner';await isolated.withSecurityRulesDisabled(async ctx=>{
   await f.setDoc(grant(ctx.firestore(),uid),{appEnabled:true,enabled:true,pilotProjectId:'A',pilotInvestorId:'I'});
   await f.setDoc(probe(ctx.firestore(),uid),{schemaVersion:1});
  });
  const db=isolated.authenticatedContext(uid,{firebase:{sign_in_provider:'google.com'}}).firestore();
  await assertSucceeds(f.getDocFromServer(probe(db,uid)));
  for(const path of ['users/'+uid+'/pilotProjects/A','catalogs/materials','settings/global','authorizedUsers/'+uid]){
   await assertFails(f.getDocFromServer(f.doc(db,path)));await assertFails(f.setDoc(f.doc(db,path),{synthetic:true}));
  }
  await assertFails(f.getDocs(f.collection(db,'appAccess')));await assertFails(f.setDoc(probe(db,uid),{schemaVersion:1}));
  const other='synthetic-auth-only-unapproved';
  await isolated.withSecurityRulesDisabled(async ctx=>{await f.setDoc(probe(ctx.firestore(),other),{schemaVersion:1});});
  const unapproved=isolated.authenticatedContext(other,{firebase:{sign_in_provider:'google.com'}}).firestore();
  await assertFails(f.getDocFromServer(probe(unapproved,other)));
  await assertFails(f.getDocFromServer(probe(unapproved,uid)));
  const anonymous=isolated.authenticatedContext(uid,{firebase:{sign_in_provider:'anonymous'}}).firestore();
  await assertFails(f.getDocFromServer(probe(anonymous,uid)));
  await assertFails(f.getDocFromServer(probe(isolated.unauthenticatedContext().firestore(),uid)));
  await isolated.withSecurityRulesDisabled(async ctx=>{await f.updateDoc(grant(ctx.firestore(),uid),{appEnabled:false});});
  // A fresh server transaction must re-evaluate the dependent grant, even if
  // an SDK listen target still remembers the earlier successful get.
  await assertFails(f.runTransaction(db,tx=>tx.get(probe(db,uid)),{maxAttempts:1}));
 }finally{await isolated.cleanup();}
});

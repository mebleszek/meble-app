// Exact minimal CLOUD-4 candidate; loopback only, no live configuration/credentials.
import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import * as app from 'firebase/app';
import * as a from 'firebase/auth';
import * as f from 'firebase/firestore';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
const require=createRequire(import.meta.url),{source}=require('../cloud4-pilot-readiness-smoke.js'),{plan}=require('./cloud4-admin-plan.js');
for(const [key,port]of [['FIRESTORE_EMULATOR_HOST',18080],['FIREBASE_AUTH_EMULATOR_HOST',19099]])if(process.env[key]!==`127.0.0.1:${port}`)throw Error('Loopback emulators required');
const UID='synthetic-cloud4-owner',OTHER='synthetic-cloud4-other',PROJECT='demo-meble-app';
const scope={ownerUid:UID,investorId:'cloud4-investor-v1',projectId:'cloud4-project-v1'};
const exportOptions={investorId:scope.investorId,projectId:scope.projectId,purpose:'pilot'};
const root=new URL('../../',import.meta.url),rules=fs.readFileSync(new URL('./firestore-live-pilot.rules',import.meta.url),'utf8');
let env,serial=0;const clients=[];
const raw=(uid=UID,provider='google.com')=>env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).firestore();
const ref=(db,suffix='')=>f.doc(db,'users/'+UID+'/pilotProjects/'+scope.projectId+suffix);
const grant=db=>f.doc(db,'authorizedUsers',UID),control=db=>f.doc(db,'pilotControl','cloud4');
async function admin(operation){return env.withSecurityRulesDisabled(ctx=>operation(ctx.firestore()));}
function runtime(){
 const r=source();
 for(const name of ['cloud-pilot-contract','firebase-pilot-transport','project-cloud-pilot','cloud-auth','auth-access-gate','cloud-access-verifier','firebase-pilot-live-transport','controlled-project-pilot'])new Function('window',fs.readFileSync(new URL('js/app/cloud/'+name+'.js',root),'utf8'))(r.s);
 return r;
}
const approval=(r,uid=UID)=>({version:1,ownerUid:uid,...r.s.FC.controlledProjectPilot.scope,payloadSha256:r.s.FC.controlledProjectPilot.payloadSha256,rulesSha256:r.s.FC.controlledProjectPilot.rulesSha256,expiresAt:Date.now()+600000});
async function login(session,uid=UID){
 const token=Buffer.from(JSON.stringify({sub:uid,email:uid+'@example.invalid',email_verified:true})).toString('base64url');
 await a.signInWithCredential(session.verificationContext?session.verificationContext().auth:session,a.GoogleAuthProvider.credential('e30.'+token+'.'));
}
async function client({uid=UID,hook}={}){
 const r=runtime(),name='cloud4-'+(++serial),FC=r.s.FC;
 const session=await FC.cloudAuth.create({target:'emulator',appName:name,firebaseConfig:{apiKey:'demo-only',projectId:PROJECT,appId:'demo-only',authDomain:PROJECT+'.firebaseapp.com'},emulator:{host:'127.0.0.1',port:19099,firestorePort:18080},sdk:{app,auth:{...a,indexedDBLocalPersistence:a.inMemoryPersistence}}});
 const instance=app.getApp(name),auth=a.getAuth(instance);await login(auth,uid);
 const verifier=FC.cloudAccessVerifier.create(session,{sdk:f});let lease;
 const gate=FC.authAccessGate.create(session,{verifyAccess:verifier.verify,watchAccess:verifier.watch,onAuthorized:value=>{lease=value;}});
 const until=Date.now()+6000;while(!lease&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,5));assert.ok(lease,JSON.stringify(gate.state()));
 if(hook){const create=FC.firebasePilotLiveTransport.create;FC.firebasePilotLiveTransport.create=async options=>{const h=await create(options);hook(h.transport);return h;};}
 const counts={reads:0,writes:0,transactions:0};
 const metered={...f,getDocFromServer:ref=>{counts.reads++;return f.getDocFromServer(ref);},runTransaction:(db,fn,options)=>f.runTransaction(db,tx=>{
  counts.transactions++;return fn({get:ref=>{counts.reads++;return tx.get(ref);},set:(...args)=>{counts.writes++;return tx.set(...args);}});
 },options)};
 const snapshot=()=>JSON.stringify({local:[...r.local.rows],session:[...r.session.rows],ram:r.s.projectData});
 const out={r,FC,session,verifier,gate,lease,auth,counts,snapshot,before:snapshot(),db:f.getFirestore(instance),controllers:[]};
 out.borrow=async options=>{const p=await FC.controlledProjectPilot.borrow({authSession:session,lease,assertLocalAccess:()=>lease.assert(),builder:r.builder,approval:approval(r,uid),sdk:{firestore:metered},...options});out.controllers.push(p);return p;};
 clients.push(out);return out;
}
async function published(){const c=await client(),p=await c.borrow();assert.equal((await p.prepare()).ok,true);const out=await p.write();assert.equal(out.ok,true,JSON.stringify(out));return {c,p,out};}
async function pack(r,revision='1'.repeat(32),base=null){return r.s.FC.cloudPilotContract.pack(await r.builder.build(exportOptions),scope,base,revision);}
before(async()=>{
 f.setLogLevel('silent');
 env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:'127.0.0.1',port:18080,rules}});
 const response=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/projects/'+PROJECT+'/accounts:batchCreate',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer owner'},body:JSON.stringify({users:[UID,OTHER].map(uid=>({localId:uid,email:uid+'@example.invalid',emailVerified:true,providerUserInfo:[{providerId:'google.com',rawId:uid,email:uid+'@example.invalid'}]})),allowOverwrite:true})});assert.equal(response.ok,true,await response.text());
});
beforeEach(async()=>{
 await env.clearFirestore();
 const p=plan({uid:UID,grant:{appEnabled:true,enabled:false},appAccess:{schemaVersion:1},control:null});
 await admin(async db=>{await f.setDoc(grant(db),{...p.expectedGrant,...p.grantPatch});await f.setDoc(control(db),p.control);await f.setDoc(f.doc(db,'appAccess',UID),{schemaVersion:1});});
});
afterEach(async()=>{for(const c of clients){for(const p of c.controllers)await p.close();c.gate.close();await c.verifier.close();await c.session.close();assert.equal(c.snapshot(),c.before,'business RAM and every synthetic stored byte must remain identical');}clients.length=0;});
after(async()=>env?.cleanup());

test('Exact reviewed Rules SHA; Auth-only survives missing/disabled pilot control and grant',async()=>{
 const r=runtime();assert.equal(createHash('sha256').update(rules).digest('hex'),r.s.FC.controlledProjectPilot.rulesSha256);
 await admin(async db=>{await f.deleteDoc(control(db));await f.updateDoc(grant(db),{enabled:false});});
 const c=await client(),p=await c.borrow();assert.equal((await c.verifier.verify(c.session.identity())).ok,true);
 assert.equal((await p.prepare()).code,'CLOUD_PERMISSION_DENIED');
 await assertSucceeds(f.getDocFromServer(f.doc(raw(),'appAccess',UID)));
});
test('Private existing Google lease, native synthetic write, independent fresh client read: exact bytes/model/PCV',async()=>{
 const {c,p,out}=await published(),who=c.session.identity(),shared=c.session.verificationContext(),before=[...c.r.local.rows];
 const fresh=await client(),reader=await fresh.borrow();assert.notEqual(fresh.auth,c.auth);assert.notEqual(fresh.db,c.db);
 const result=await reader.readVerify();assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.sourceMatches,true);
 assert.deepEqual(c.counts,{reads:13,writes:3,transactions:6});assert.deepEqual(fresh.counts,{reads:6,writes:0,transactions:3});
 assert.equal(result.head.currentRevisionId,out.head.currentRevisionId);assert.equal(result.utf8Bytes,6797);
 assert.deepEqual(result.document,JSON.parse(JSON.stringify((await fresh.r.builder.build(exportOptions)).document)));
 await p.close();assert.deepEqual(c.session.identity(),who);assert.equal(c.session.verificationContext().app,shared.app);assert.equal(c.session.verificationContext().auth,shared.auth);assert.equal(f.getFirestore(shared.app),c.db);assert.equal((await c.verifier.verify(who)).ok,true);assert.deepEqual([...c.r.local.rows],before);
 assert.equal((await p.prepare()).code,'CLOUD_CLIENT_CLOSED');
});
test('Minimal Rules deny non-Google, other UID, foreign scope, control/grant edits, lists and ALL global paths',async()=>{
 const own=raw(),other=raw(OTHER);
 await admin(db=>f.setDoc(f.doc(db,'authorizedUsers',OTHER),{appEnabled:true,enabled:true,pilotProjectId:scope.projectId,pilotInvestorId:scope.investorId,globalDataEnabled:true,globalSchemaVersion:1}));
 for(const db of [other,raw(UID,'anonymous'),env.unauthenticatedContext().firestore()])await assertFails(f.getDocFromServer(ref(db)));
 await assertFails(f.getDocFromServer(f.doc(other,'users',OTHER,'pilotProjects',scope.projectId)));
 await assertFails(f.getDocFromServer(f.doc(own,'users',UID,'pilotProjects','other')));
 await assertFails(f.getDocs(f.collection(own,'users',UID,'pilotProjects')));
 await assertFails(f.getDocs(f.collection(own,'appAccess')));
 await admin(db=>f.updateDoc(grant(db),{globalDataEnabled:true,globalSchemaVersion:1}));
 for(const path of ['authorizedUsers/'+UID,'pilotControl/cloud4','users/'+UID+'/globalData/head','users/'+UID+'/globalDomains/materials','catalogs/materials','settings/global']){
  await assertFails(f.getDocFromServer(f.doc(own,path)));await assertFails(f.setDoc(f.doc(own,path),{enabled:true}));await assertFails(f.deleteDoc(f.doc(own,path)));
 }
});
test('No second publication, no staging after publication; stale direct manifest/update/delete denied',async()=>{
 const {c,p}=await published();assert.equal((await p.write()).code,'CLOUD_OPERATION_LIMIT');
 const next=await c.borrow();assert.equal((await next.prepare()).code,'CLOUD_WRITE_CONFLICT');
 const r=runtime(),packed=await pack(r,'2'.repeat(32)),db=raw();
 await assertFails(f.setDoc(ref(db,'/revisions/'+packed.revision.revisionId),{...packed.revision,createdAt:f.serverTimestamp()}));
 await assertFails(f.updateDoc(ref(db),{generation:2}));await assertFails(f.deleteDoc(ref(db)));
 const read=await next.readVerify();assert.equal(read.ok,true,JSON.stringify(read));
 assert.equal((await next.readVerify()).ok,true);assert.equal((await next.readVerify()).code,'CLOUD_OPERATION_LIMIT');
});
test('Missing fields, wrong owner/investor, extra secrets, incomplete fragments, immutable revision are denied',async()=>{
 const r=runtime(),p=await pack(r),db=raw(),header=ref(db,'/revisions/'+p.revision.revisionId);
 for(const patch of [{ownerUid:OTHER},{investorId:'foreign'},{projectId:'foreign'},{secret:'synthetic'},{chunkCount:8}])await assertFails(f.setDoc(header,{...p.revision,...patch,createdAt:f.serverTimestamp()}));
 await assertSucceeds(f.setDoc(header,{...p.revision,createdAt:f.serverTimestamp()}));
 const manifest={...r.s.FC.cloudPilotContract.candidateHead(p),formatVersion:1,chunkCount:p.revision.chunkCount,byteLength:p.revision.byteLength,updatedAt:f.serverTimestamp()};
 await assertFails(f.setDoc(ref(db),manifest));
 const chunk=p.chunks[0],chunkRef=ref(db,'/revisions/'+p.revision.revisionId+'/chunks/0');
 await assertFails(f.setDoc(chunkRef,{...chunk,sha256:'f'.repeat(64),bytes:f.Bytes.fromUint8Array(chunk.bytes)}));
 await assertSucceeds(f.setDoc(chunkRef,{...chunk,bytes:f.Bytes.fromUint8Array(chunk.bytes)}));await assertSucceeds(f.setDoc(ref(db),manifest));
 await assertFails(f.updateDoc(header,{byteLength:1}));await assertFails(f.deleteDoc(chunkRef));
});
test('Actual Rules limit: seven chunks at exactly 800 KiB publish and independently reconstruct',async()=>{
 const r=runtime(),original=await r.builder.build(exportOptions),doc=JSON.parse(JSON.stringify(original.document));
 doc.payload.project.title+='X'.repeat(819200-original.utf8Bytes);
 const contract=r.s.FC.cloudPilotContract,encoder=new TextEncoder();
 // Recompute the existing format's integrity for this boundary-only fixture.
 const {integrity,...unsigned}=doc;
 doc.integrity={...integrity,payloadSha256:await contract.sha(encoder.encode(contract.canonical(doc.payload))),documentSha256:await contract.sha(encoder.encode(contract.canonical(unsigned)))};
 const revised={document:doc,utf8Bytes:encoder.encode(contract.canonical(doc)).byteLength};
 assert.equal(revised.utf8Bytes,819200);
 const c=await client(),h=await c.FC.firebasePilotLiveTransport.create({authSession:c.session,assertAccess:()=>c.lease.assert(),sdk:{firestore:f}});
 c.controllers.push(h.transport);const p=await c.FC.cloudPilotContract.pack({ok:true,...revised},scope,null,'7'.repeat(32));assert.equal(p.chunks.length,7);
 await h.transport.stage(p);await h.transport.publish(p,async()=>{});
 const reader=await client(),rh=await reader.FC.firebasePilotLiveTransport.create({authSession:reader.session,assertAccess:()=>reader.lease.assert(),sdk:{firestore:f}});reader.controllers.push(rh.transport);
 const read=await rh.transport.readProject(scope);assert.equal(read.utf8Bytes,819200);assert.deepEqual(read.document,revised.document);
});
test('Approval/pinned payload cannot be widened or mutated; expired, missing lease or wrong source fail closed',async()=>{
 const c=await client();
 for(const patch of [{projectId:'foreign'},{ownerUid:OTHER},{rulesSha256:'f'.repeat(64)},{expiresAt:Infinity},{expiresAt:Date.now()-1},{expiresAt:Date.now()+1000000},{extra:true}])await assert.rejects(c.borrow({approval:{...approval(c.r),...patch}}));
 await assert.rejects(c.borrow({lease:null}));
 const wrong=await c.borrow({builder:{build:async()=>({ok:true,document:{integrity:{payloadSha256:'f'.repeat(64)}}})}});assert.equal((await wrong.prepare()).code,'CLOUD_SOURCE_CHANGED');
 const p=await c.borrow();assert.deepEqual(Object.keys(p).sort(),['close','confirm','prepare','readVerify','write']);
});
test('Revoking appEnabled, project grant or singleton control stops new operations without affecting Auth-only unnecessarily',async()=>{
 for(const field of ['appEnabled','enabled','control']){
  await admin(async db=>{await f.updateDoc(grant(db),{appEnabled:true,enabled:true});await f.updateDoc(control(db),{enabled:true});});
  const c=await client(),p=await c.borrow();assert.equal((await p.prepare()).ok,true);
  await admin(db=>field==='control'?f.updateDoc(control(db),{enabled:false}):f.updateDoc(grant(db),{[field]:false}));
  assert.equal((await p.write()).ok,false,field);await assertFails(f.getDocFromServer(ref(c.db)));
  if(field!=='appEnabled')assert.equal((await c.verifier.verify(c.session.identity())).ok,true);
 }
});
test('Logout, same UID relogin and account change invalidate old private handles, including across await',async()=>{
 const c=await client(),p=await c.borrow();assert.equal((await p.prepare()).ok,true);await c.session.signOut();await login(c.auth);
 assert.equal((await p.write()).ok,false);
 const d=await client(),q=await d.borrow({builder:{build:async options=>{const out=await d.r.builder.build(options);await d.session.signOut();await login(d.auth,OTHER);return out;}}});
 assert.equal((await q.prepare()).ok,false);
});
test('Offline is refused, source remains sealed and no offline write appears on reconnect',async()=>{
 const c=await client(),p=await c.borrow(),before=JSON.stringify([...c.r.local.rows]);assert.equal((await p.prepare()).ok,true);
 await f.disableNetwork(c.db);assert.equal((await p.write()).ok,false);await f.enableNetwork(c.db);
 assert.equal((await f.getDocFromServer(ref(c.db))).exists(),false);assert.equal((await p.write()).code,'CLOUD_OPERATION_LIMIT');assert.equal(JSON.stringify([...c.r.local.rows]),before);
});
test('Lost acknowledgement after real publication requires independent read, never blind retry/rollback',async()=>{
 const c=await client({hook:t=>{const publish=t.publish;t.publish=async(...args)=>{await publish(...args);throw Error('synthetic lost response');};}}),p=await c.borrow();assert.equal((await p.prepare()).ok,true);
 const out=await p.write();assert.equal(out.ok,false);assert.equal(out.published,'unconfirmed');assert.equal(out.requiresIndependentRead,true);assert.equal((await p.write()).code,'CLOUD_OPERATION_LIMIT');
 const fresh=await client(),q=await fresh.borrow();assert.equal((await q.readVerify()).ok,true);assert.equal((await p.confirm()).published,true);
});
test('Interrupted staging does not publish; two independent clients cannot replace the first winner',async()=>{
 const interrupted=await client({hook:t=>{const stage=t.stage;t.stage=async p=>{await stage(p);throw Error('synthetic interruption');};}}),p=await interrupted.borrow();await p.prepare();assert.equal((await p.write()).ok,false);assert.equal((await f.getDocFromServer(ref(interrupted.db))).exists(),false);
 const a=await client(),b=await client(),pa=await a.borrow(),pb=await b.borrow();assert.equal((await pa.prepare()).ok,true);assert.equal((await pb.prepare()).ok,true);
 const out=await Promise.all([pa.write(),pb.write()]);assert.equal(out.filter(x=>x.ok).length,1,JSON.stringify(out));assert.equal(out.filter(x=>!x.ok).length,1);assert.equal((await pa.readVerify()).ok,true);
});
test('Independent reader refuses missing/corrupt fragments, bad manifest and changed access mid-read',async()=>{
 const {out}=await published(),chunkSuffix='/revisions/'+out.head.currentRevisionId+'/chunks/0';
 let original;await admin(async db=>{original=(await f.getDoc(ref(db,chunkSuffix))).data();await f.deleteDoc(ref(db,chunkSuffix));});
 const fresh=await client(),p=await fresh.borrow();assert.equal((await p.readVerify()).ok,false);
 await admin(db=>f.setDoc(ref(db,chunkSuffix),{...original,bytes:f.Bytes.fromUint8Array(new Uint8Array(original.byteLength))}));assert.equal((await p.readVerify()).ok,false);
 await admin(async db=>{await f.setDoc(ref(db,chunkSuffix),original);await f.updateDoc(ref(db),{ownerUid:OTHER});});
 const another=await client(),q=await another.borrow();assert.equal((await q.readVerify()).ok,false);
 await admin(db=>f.updateDoc(ref(db),{ownerUid:UID}));
 const revoked=await client({hook:t=>{const read=t.readProject;t.readProject=async(...args)=>{const out=await read(...args);await admin(db=>f.updateDoc(grant(db),{enabled:false}));revoked.gate.close();return out;};}}),reader=await revoked.borrow();assert.equal((await reader.readVerify()).ok,false);
});

// New recovery boundaries use this mandatory CURRENT emulator lifetime; old tests unchanged.
import {registerRecoveryCases} from './cloud46f-recovery.cases.mjs';
registerRecoveryCases({environment: () => env, client, uid: UID, async retire(c) {
  // Use the same teardown AND byte-preservation assertion before retiring a primary.
  for(const p of c.controllers)await p.close();c.gate.close();await c.verifier.close();await c.session.close();
  assert.equal(c.snapshot(),c.before,'business RAM and every synthetic stored byte must remain identical');
  const index=clients.indexOf(c);assert.notEqual(index,-1);clients.splice(index,1);
}});

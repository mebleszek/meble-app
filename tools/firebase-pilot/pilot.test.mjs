// Only demo + loopback emulators. No credentials, live Firebase or local user storage.
import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as app from 'firebase/app';
import * as auth from 'firebase/auth';
import * as firestore from 'firebase/firestore';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
const require=createRequire(import.meta.url),{fixture}=require('../project-selective-export-smoke.js');
const clone=v=>JSON.parse(JSON.stringify(v));
const PROJECT='demo-meble-app',UID='synthetic-google-owner',scope={ownerUid:UID,investorId:'inv-A',projectId:'A'};
for(const [key,port]of [['FIRESTORE_EMULATOR_HOST',18080],['FIREBASE_AUTH_EMULATOR_HOST',19099]]){
 if(process.env[key]!==`127.0.0.1:${port}`)throw Error('Loopback emulator required: '+key);
}
const root=new URL('../../',import.meta.url),sdk={app,auth,firestore};
let env,serial=0,clients=[];
const ref=(db,suffix='')=>firestore.doc(db,'users/'+UID+'/pilotProjects/A'+suffix);
const raw=(uid=UID,google=true)=>env.authenticatedContext(uid,{firebase:{sign_in_provider:google?'google.com':'anonymous'}}).firestore();
async function bootstrap(uid=UID){await env.withSecurityRulesDisabled(async ctx=>firestore.setDoc(firestore.doc(ctx.firestore(),'authorizedUsers',uid),{appEnabled:true,enabled:true,pilotProjectId:'A',pilotInvestorId:'inv-A'}));}
function runtime(seed){
 const r=fixture(seed);r.s.TextDecoder=TextDecoder;
 // The browser and SDK share one realm. Keep new modules in the SDK realm,
 // while existing app/session modules still use isolated fixture globals.
 for(const name of ['cloud-pilot-contract','firebase-pilot-transport','project-cloud-pilot','cloud-auth','auth-access-gate','cloud-access-verifier','firebase-pilot-live-transport'])new Function('window',fs.readFileSync(new URL('js/app/cloud/'+name+'.js',root),'utf8'))(r.s);
 return r;
}
async function client(r=runtime(),uid=UID){
 const handles=await r.FC.firebasePilotTransport.create({target:'emulator',projectId:PROJECT,emulator:{host:'127.0.0.1',authPort:19099,firestorePort:18080},appName:'pilot-'+(++serial),sdk});
 clients.push(handles.transport);
 if(uid){
  // Auth emulator accepts unsigned synthetic OIDC tokens, never real Google credentials.
  const token=Buffer.from(JSON.stringify({sub:uid,email:uid+'@example.invalid',email_verified:true,name:'Synthetic pilot'})).toString('base64url');
  await auth.signInWithCredential(handles.auth,auth.GoogleAuthProvider.credential('e30.'+token+'.'));
  // Google account sub is not Firebase UID. Bind grant/path to actual emulator UID.
  const actual=handles.auth.currentUser.uid;
  if(uid===UID){assert.equal(actual,UID,'pre-seeded Firebase UID');}
 }
 await handles.transport.ready();
 return {r,...handles,pilot:r.FC.projectCloudPilot.create(handles.transport)};
}
async function prepare(c,base=null){const out=await c.pilot.prepare({investorId:'inv-A',projectId:'A',expectedHead:base});assert.equal(out.ok,true,JSON.stringify(out));return out;}
async function packed(r,revision='1'.repeat(32),base=null){return r.FC.cloudPilotContract.pack(await r.build(),scope,base,revision);}
function manifest(r,p){return {...r.FC.cloudPilotContract.candidateHead(p),formatVersion:1,chunkCount:p.revision.chunkCount,byteLength:p.revision.byteLength,updatedAt:firestore.serverTimestamp()};}
async function count(){let size;await env.withSecurityRulesDisabled(async ctx=>{size=(await firestore.getDocs(firestore.collection(ctx.firestore(),'users',UID,'pilotProjects','A','revisions'))).size;});return size;}
function setPcv(r,extra=false){const value=r.FC.projectPcvOverrides.setEdges({projectId:'A',roomId:'kuchnia',cabinetId:'one',partRoleId:'body.side.left'},{w1:true,w2:extra,h1:false,h2:true});assert.equal(value.ok,true,JSON.stringify(value));assert.equal(r.FC.session.commit(),true);}
before(async()=>{
 firestore.setLogLevel('silent');
 env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:'127.0.0.1',port:18080,rules:fs.readFileSync(new URL('./firestore.rules',import.meta.url),'utf8')}});
 // Seed synthetic Auth emulator account with a fixed Firebase UID linked to Google.
 const response=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/projects/'+PROJECT+'/accounts:batchCreate',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer owner'},body:JSON.stringify({users:[{localId:UID,email:UID+'@example.invalid',emailVerified:true,providerUserInfo:[{providerId:'google.com',rawId:UID,email:UID+'@example.invalid'}]}],allowOverwrite:true})});
 assert.equal(response.ok,true,await response.text());
});
beforeEach(async()=>{await env.clearFirestore();await bootstrap();});
afterEach(async()=>{await Promise.all(clients.map(c=>c.close()));clients=[];});
after(async()=>{await env?.cleanup();});

test('Real Google Auth emulator + exact CLOUD-1B bytes: stage, transactional manifest, server confirmation',async()=>{
 const c=await client(),before=c.r.rows(),ram=clone(c.r.s.projectData),p=await prepare(c);
 assert.equal((await c.pilot.readHead(scope)).head,null);
 const out=await c.pilot.publish(p.handle);assert.equal(out.ok,true,JSON.stringify(out));assert.equal(out.published,true);assert.equal(out.head.generation,1);
 const db=raw(),head=(await firestore.getDoc(ref(db))).data(),header=(await firestore.getDoc(ref(db,'/revisions/'+p.revisionId))).data();
 const bytes=new Uint8Array(header.byteLength);let offset=0;
 for(let i=0;i<header.chunkCount;i++){const part=(await firestore.getDoc(ref(db,'/revisions/'+p.revisionId+'/chunks/'+i))).data();bytes.set(part.bytes.toUint8Array(),offset);offset+=part.byteLength;}
 const document=JSON.parse(new TextDecoder().decode(bytes));assert.deepEqual(document.payload,clone((await c.r.build()).document.payload));
 assert.equal(await c.r.FC.cloudPilotContract.sha(bytes),head.fileSha256);
 assert.deepEqual(c.r.rows(),before);assert.deepEqual(clone(c.r.s.projectData),ram);assert.deepEqual(c.r.storage.calls,[]);
 const unchanged=await prepare(c,out.head);assert.equal(unchanged.unchanged,true);assert.equal(await count(),1);
 const repeated=await c.pilot.publish(p.handle);assert.equal(repeated.ok,true);assert.equal(repeated.head.generation,1);assert.equal(await count(),1);
});
test('No auth, anonymous, unapproved Google, foreign UID/project, listing and global paths are denied',async()=>{
 const c=await client(runtime(),null);assert.equal((await c.pilot.prepare({...scope,expectedHead:null})).code,'CLOUD_AUTH_REQUIRED');
 await auth.signInAnonymously(c.auth);assert.equal((await c.pilot.readHead(scope)).code,'CLOUD_GOOGLE_REQUIRED');
 await assertFails(firestore.getDoc(ref(env.unauthenticatedContext().firestore())));
 await assertFails(firestore.getDoc(ref(raw(UID,false))));
 await assertFails(firestore.getDoc(ref(raw('unapproved'))));
 await bootstrap('other-owner');await assertFails(firestore.getDoc(ref(raw('other-owner'))));
 const db=raw();await assertSucceeds(firestore.getDoc(ref(db)));
 await assertFails(firestore.getDoc(firestore.doc(db,'users',UID,'pilotProjects','B')));
 await assertFails(firestore.getDocs(firestore.collection(db,'users',UID,'pilotProjects')));
 for(const path of ['authorizedUsers/'+UID,'catalogs/materials','settings/global','users/'+UID+'/backups/all']){
  await assertFails(firestore.getDoc(firestore.doc(db,path)));await assertFails(firestore.setDoc(firestore.doc(db,path),{secret:'synthetic'}));
 }
});
test('Rules reject malformed headers, foreign investor, extra secret, bad chunks and incomplete publication',async()=>{
 const r=runtime(),p=await packed(r),db=raw(),revision=ref(db,'/revisions/'+p.revision.revisionId);
 await assertFails(firestore.setDoc(revision,{...p.revision,investorId:'inv-B',createdAt:firestore.serverTimestamp()}));
 await assertFails(firestore.setDoc(revision,{...p.revision,apiKey:'synthetic',createdAt:firestore.serverTimestamp()}));
 await assertFails(firestore.setDoc(revision,{...p.revision,chunkCount:8,createdAt:firestore.serverTimestamp()}));
 await assertSucceeds(firestore.setDoc(revision,{...p.revision,createdAt:firestore.serverTimestamp()}));
 await assertFails(firestore.setDoc(ref(db),manifest(r,p)));
 const chunk=p.chunks[0],chunkRef=ref(db,'/revisions/'+p.revision.revisionId+'/chunks/0');
 await assertFails(firestore.setDoc(chunkRef,{...chunk,bytes:firestore.Bytes.fromUint8Array(chunk.bytes),byteLength:chunk.byteLength-1}));
 await assertFails(firestore.setDoc(chunkRef,{...chunk,bytes:firestore.Bytes.fromUint8Array(chunk.bytes),sha256:'f'.repeat(64)}));
 await assertFails(firestore.setDoc(ref(db,'/revisions/'+p.revision.revisionId+'/chunks/1'),{...chunk,bytes:firestore.Bytes.fromUint8Array(chunk.bytes)}));
 await assertSucceeds(firestore.setDoc(chunkRef,{...chunk,bytes:firestore.Bytes.fromUint8Array(chunk.bytes)}));
 await assertSucceeds(firestore.setDoc(ref(db),manifest(r,p)));
 await assertFails(firestore.updateDoc(revision,{byteLength:1}));await assertFails(firestore.deleteDoc(revision));await assertFails(firestore.updateDoc(chunkRef,{sha256:'f'.repeat(64)}));await assertFails(firestore.deleteDoc(chunkRef));
 await assertFails(firestore.deleteDoc(ref(db)));await assertFails(firestore.setDoc(ref(db),manifest(r,p)));
});
test('Rules and real adapter accept all seven chunks at exact 800 KiB, no Rules access/expression overflow',async()=>{
 const r=runtime(),size=(await r.build()).utf8Bytes;
 r.mutate(p=>{p.title+='X'.repeat(819200-size);});assert.equal((await r.build()).utf8Bytes,819200);
 const c=await client(r),p=await prepare(c);assert.equal(p.chunkCount,7);assert.equal(p.byteLength,819200);
 const out=await c.pilot.publish(p.handle);assert.equal(out.ok,true,JSON.stringify(out));assert.equal(out.published,true);
 const fresh=await client(),read=await fresh.pilot.read(scope);assert.equal(read.ok,true,JSON.stringify(read));assert.equal(read.utf8Bytes,819200);assert.deepEqual(clone(read.document.payload),clone((await r.build()).document.payload));
 r.mutate(p=>p.title+='X');const before=await count();const failed=await c.pilot.prepare({...scope,expectedHead:out.head});assert.equal(failed.code,'EXPORT_SIZE_LIMIT');assert.equal(await count(),before);
});
test('Two actual SDK devices with the same base: one winner, explicit conflict, no overwrite',async()=>{
 const a=await client(),b=await client();setPcv(a.r);setPcv(b.r,true);
 const pa=await prepare(a),pb=await prepare(b);
 const results=await Promise.all([a.pilot.publish(pa.handle),b.pilot.publish(pb.handle)]);
 assert.equal(results.filter(x=>x.ok).length,1,JSON.stringify(results));assert.equal(results.filter(x=>x.code==='CLOUD_WRITE_CONFLICT').length,1,JSON.stringify(results));
 const head=(await a.pilot.readHead(scope)).head;assert.equal(head.generation,1);assert.equal(await count(),2);
 const loser=results[0].ok?b:a;assert.equal((await loser.pilot.prepare({...scope,expectedHead:null})).code,'CLOUD_WRITE_CONFLICT');
});
test('Sequential revision binds full base; immutable older revision and stale direct manifest cannot overwrite',async()=>{
 const c=await client(),p=await prepare(c),first=await c.pilot.publish(p.handle);assert.equal(first.ok,true);
 setPcv(c.r);const next=await prepare(c,first.head),second=await c.pilot.publish(next.handle);assert.equal(second.ok,true,JSON.stringify(second));assert.equal(second.head.generation,2);
 const db=raw();assert.equal((await firestore.getDoc(ref(db,'/revisions/'+p.revisionId))).exists(),true);
 const stale=await packed(c.r,'3'.repeat(32),first.head);await c.transport.stage(stale);
 await assertFails(firestore.setDoc(ref(db),manifest(c.r,stale)));assert.equal((await c.pilot.readHead(scope)).head.generation,2);
});
test('Interrupted after staging leaves old manifest, no destructive cleanup; explicit retry is idempotent',async()=>{
 const c=await client(),original=c.transport.publish;let interrupted=true;
 c.transport.publish=async(...args)=>{if(interrupted){const e=Error();e.code='CLOUD_TEST_INTERRUPTION';throw e;}return original(...args);};
 const p=await prepare(c),failed=await c.pilot.publish(p.handle);assert.equal(failed.ok,false);assert.equal(failed.published,'unconfirmed');assert.equal(await count(),1);assert.equal((await c.pilot.readHead(scope)).head,null);
 {const retry=await c.pilot.publish(p.handle);assert.equal(retry.code,'CLOUD_CONFIRMATION_REQUIRED');assert.equal(retry.published,'unconfirmed');assert.equal(retry.staging,'confirmed');}
 assert.equal((await c.pilot.confirm(p.handle)).code,'CLOUD_PUBLICATION_NOT_OBSERVED');
 interrupted=false;const out=await c.pilot.publish(p.handle);assert.equal(out.ok,true,JSON.stringify(out));assert.equal(await count(),1);
});
test('Lost acknowledgement after real transaction: no false failure/no blind retry, server confirm identifies exact own revision',async()=>{
 const c=await client(),original=c.transport.publish;c.transport.publish=async(...args)=>{await original(...args);throw Error('synthetic lost acknowledgement');};
 const p=await prepare(c),failed=await c.pilot.publish(p.handle);assert.equal(failed.ok,false);assert.equal(failed.published,'unconfirmed');
 {const retry=await c.pilot.publish(p.handle);assert.equal(retry.code,'CLOUD_CONFIRMATION_REQUIRED');assert.equal(retry.published,'unconfirmed');assert.equal(retry.staging,'confirmed');}
 const out=await c.pilot.confirm(p.handle);assert.equal(out.ok,true);assert.equal(out.head.currentRevisionId,p.revisionId);assert.equal(await count(),1);
 const restarted=await client(runtime(c.r.rows()));assert.equal((await restarted.pilot.readHead(scope)).head.currentRevisionId,p.revisionId);assert.equal((await restarted.pilot.confirm(p.handle)).code,'CLOUD_ATTEMPT_UNKNOWN');
});
test('Source changed after real staging: publication denied; no cancellation of local data or removal of staging',async()=>{
 const c=await client(),original=c.transport.stage;c.transport.stage=async p=>{await original(p);setPcv(c.r);};
 const p=await prepare(c),out=await c.pilot.publish(p.handle);assert.equal(out.code,'CLOUD_SOURCE_CHANGED');assert.equal(out.published,false);assert.equal(out.staging,'confirmed');
 assert.equal((await c.pilot.readHead(scope)).head,null);assert.equal(await count(),1);assert.ok(c.r.row().projectData.kuchnia.production.partOverrides.one);
});
test('Actual blob corruption with unchanged claimed hash is refused by SDK read-back, never published',async()=>{
 const c=await client(),original=c.transport.stage;c.transport.stage=async p=>{await original(p);await env.withSecurityRulesDisabled(async ctx=>{
  const chunk=ref(ctx.firestore(),'/revisions/'+p.revision.revisionId+'/chunks/0'),snap=await firestore.getDoc(chunk),data=snap.data(),bytes=data.bytes.toUint8Array();bytes[0]^=1;await firestore.updateDoc(chunk,{bytes:firestore.Bytes.fromUint8Array(bytes)});
 });};
 const p=await prepare(c),out=await c.pilot.publish(p.handle);assert.equal(out.code,'CLOUD_INTEGRITY_INVALID');assert.equal((await c.pilot.readHead(scope)).head,null);
});
test('Auth change/revocation after prepare is denied without publishing or changing local data',async()=>{
 const c=await client(),p=await prepare(c),before=c.r.rows();await c.transport.signOut();
 assert.equal((await c.pilot.publish(p.handle)).code,'CLOUD_AUTH_REQUIRED');assert.deepEqual(c.r.rows(),before);assert.equal(await count(),0);
 const second=await client(),q=await prepare(second);await env.withSecurityRulesDisabled(ctx=>firestore.updateDoc(firestore.doc(ctx.firestore(),'authorizedUsers',UID),{enabled:false}));
 assert.equal((await second.pilot.publish(q.handle)).code,'CLOUD_PERMISSION_DENIED');assert.equal(await count(),0);
});
test('Clean/dirty/unconfirmed sessions and divergent RAM cannot upload; actual PCV partial save remains blocked',async()=>{
 for(const mode of ['clean','dirty','ram','unconfirmed']){
  const r=runtime(),c=await client(r);
  if(mode==='ram')r.s.projectData.kuchnia.cabinets[0].width=75;
  else if(mode==='unconfirmed'){
   assert.equal(r.FC.session.begin(),true);r.storage.fail.add('set:fc_edit_session_v1');
   const out=r.FC.projectPcvOverrides.setEdges({projectId:'A',roomId:'kuchnia',cabinetId:'one',partRoleId:'body.side.left'},{w2:true});
   assert.equal(out.ok,false);assert.equal(out.projectSaved,true);r.storage.fail.clear();assert.equal(r.FC.session.commit(),false);
  }else{assert.equal(r.FC.session.begin(),true);if(mode==='dirty')r.s.projectData.kuchnia.cabinets[0].width=75;}
  const before=r.rows(),ram=clone(r.s.projectData),out=await c.pilot.prepare({...scope,expectedHead:null});assert.equal(out.ok,false,mode);assert.match(out.code,/^EXPORT_/);assert.deepEqual(r.rows(),before);assert.deepEqual(clone(r.s.projectData),ram);
 }
 assert.equal(await count(),0);
});
test('Globals/ORS secret/legacy/options/offer history stay byte-identical and absent in cloud bytes',async()=>{
 const r=runtime();for(const key of ['fc_company_profile_v1','fc_edge_v1','fc_material_part_options_v1','fc_rozrys_grain_state_v1','fc_price_list_v1','fc_quote_snapshots_v1'])r.storage.rows.set(key,JSON.stringify({sentinel:'DO_NOT_UPLOAD_'+key,transport:{apiKey:'synthetic-not-a-secret'}}));
 const before=r.rows(),ram=clone(r.s.projectData),c=await client(r),p=await prepare(c),out=await c.pilot.publish(p.handle);assert.equal(out.ok,true,JSON.stringify(out));
 const db=raw(),chunk=(await firestore.getDoc(ref(db,'/revisions/'+p.revisionId+'/chunks/0'))).data();assert.equal(new TextDecoder().decode(chunk.bytes.toUint8Array()).includes('DO_NOT_UPLOAD'),false);assert.equal(new TextDecoder().decode(chunk.bytes.toUint8Array()).includes('synthetic-not-a-secret'),false);
 assert.deepEqual(r.rows(),before);assert.deepEqual(clone(r.s.projectData),ram);assert.deepEqual(r.storage.calls,[]);assert.deepEqual(r.sessionStorage.calls,[]);
});
test('Offline transaction cannot enqueue a later authoritative write after connectivity returns',async()=>{
 const c=await client(),p=await prepare(c);await firestore.disableNetwork(c.db);
 const out=await c.pilot.publish(p.handle);await firestore.enableNetwork(c.db);const head=(await c.pilot.readHead(scope)).head;
 assert.deepEqual({out,head,revisions:await count()},{out:{ok:false,code:'CLOUD_NETWORK_UNCONFIRMED',phase:'staging',published:false,staging:'unconfirmed'},head:null,revisions:0});
});
test('Source change inside the real manifest transaction is checked again before its write',async()=>{
 const c=await client(),original=c.transport.publish;
 c.transport.publish=(p,check)=>original(p,async()=>{setPcv(c.r,true);await check();});
 const p=await prepare(c),out=await c.pilot.publish(p.handle);assert.equal(out.code,'CLOUD_SOURCE_CHANGED');assert.equal(out.ok,false);assert.equal((await c.pilot.readHead(scope)).head,null);assert.equal(await count(),1);
});
test('Changes to unrelated project B do not invalidate project A or leak its data',async()=>{
 const c=await client(),p=await prepare(c);c.r.mutate((a,list)=>{list.find(row=>row.id==='B').title='OTHER PROJECT MUST NOT LEAK';});
 const before=c.r.rows(),out=await c.pilot.publish(p.handle);assert.equal(out.ok,true,JSON.stringify(out));assert.deepEqual(c.r.rows(),before);
 const db=raw(),chunk=(await firestore.getDoc(ref(db,'/revisions/'+p.revisionId+'/chunks/0'))).data();assert.equal(new TextDecoder().decode(chunk.bytes.toUint8Array()).includes('OTHER PROJECT MUST NOT LEAK'),false);
});
test('Google logout/login into the same UID invalidates old prepared handles by auth epoch',async()=>{
 const c=await client(),p=await prepare(c);await c.transport.signOut();
 const token=Buffer.from(JSON.stringify({sub:UID,email:UID+'@example.invalid',email_verified:true})).toString('base64url');
 await auth.signInWithCredential(c.auth,auth.GoogleAuthProvider.credential('e30.'+token+'.'));
 assert.equal((await c.pilot.publish(p.handle)).code,'CLOUD_AUTH_CHANGED');assert.equal(await count(),0);
});

// Shared Auth adapter: the same objects/observer as the server-approved login.
async function sharedClient(r=runtime()){
 const controller=await r.FC.cloudAuth.create({target:'emulator',appName:'shared-'+(++serial),
  firebaseConfig:{projectId:PROJECT,apiKey:'demo-only',appId:'demo-only',authDomain:PROJECT+'.firebaseapp.com'},
  emulator:{host:'127.0.0.1',port:19099,firestorePort:18080},
  sdk:{app,auth:{...auth,indexedDBLocalPersistence:auth.inMemoryPersistence}}});
 const ctx=controller.verificationContext; // Context becomes available only after Google identity.
 const instance=app.getApp('shared-'+serial),a=auth.getAuth(instance);
 const token=Buffer.from(JSON.stringify({sub:UID,email:UID+'@example.invalid',email_verified:true})).toString('base64url');
 await auth.signInWithCredential(a,auth.GoogleAuthProvider.credential('e30.'+token+'.'));
 await env.withSecurityRulesDisabled(x=>firestore.setDoc(firestore.doc(x.firestore(),'appAccess',UID),{schemaVersion:1}));
 const verifier=r.FC.cloudAccessVerifier.create(controller,{sdk:firestore});let lease;
 const gate=r.FC.authAccessGate.create(controller,{verifyAccess:verifier.verify,watchAccess:verifier.watch,onAuthorized:value=>{lease=value;}});
 const end=Date.now()+7000;while(!lease){assert.ok(Date.now()<end,'shared server authorization timeout');await new Promise(resolve=>setTimeout(resolve,10));}
 const handles=await r.FC.firebasePilotLiveTransport.create({authSession:controller,assertAccess:()=>lease.assert(),sdk});
 clients.push({close:async()=>{await handles.transport.close();gate.close();await verifier.close();await controller.close();}});
 assert.equal(handles.app,instance);assert.equal(handles.auth,a);assert.equal(handles.db,firestore.getFirestore(instance));
 assert.equal(ctx().auth,a);
 return {r,...handles,pilot:r.FC.projectCloudPilot.create(handles.transport),controller,verifier,gate,lease:()=>lease};
}
test('Independent fresh SDK reader reconstructs exact published bytes and native PCV without local source access',async()=>{
 const writer=await client();setPcv(writer.r,true);const p=await prepare(writer);let written;
 const stage=writer.transport.stage;writer.transport.stage=async packed=>{written=packed.chunks.flatMap(c=>Array.from(c.bytes));return stage(packed);};
 assert.equal((await writer.pilot.publish(p.handle)).ok,true);
 const reader=await client(),before=reader.r.rows(),ram=clone(reader.r.s.projectData);
 reader.r.FC.projectSelectiveExport.build=()=>{throw Error('reader must not export its own project');};
 const out=await reader.pilot.read(scope);assert.equal(out.ok,true,JSON.stringify(out));
 assert.deepEqual(Array.from(out.bytes),written);assert.equal(out.utf8Bytes,written.length);
 assert.equal(out.document.payload.project.projectData.kuchnia.production.partOverrides.one['body.side.left'].edges.w2,true);
 assert.deepEqual(clone(out.document.payload),clone((await writer.r.build()).document.payload));
 assert.ok(out.dependencies.length);assert.ok(out.warnings.length);assert.deepEqual(reader.r.rows(),before);assert.deepEqual(clone(reader.r.s.projectData),ram);
 assert.deepEqual(reader.r.storage.calls,[]);assert.deepEqual(reader.r.sessionStorage.calls,[]);
});
test('Shared approved App/Auth/Firestore survive pilot close; verifier and original Google session remain usable',async()=>{
 const c=await sharedClient(),who=c.controller.identity(),p=await prepare(c);
 assert.equal((await c.pilot.publish(p.handle)).ok,true);assert.equal((await c.pilot.read(scope)).ok,true);
 await c.pilot.close();assert.deepEqual(c.controller.identity(),who);assert.equal(app.getApp(c.app.name),c.app);
 assert.equal(c.auth.currentUser.uid,who.uid);assert.equal((await c.verifier.verify(who)).ok,true);assert.equal(c.lease().isValid(),true);
 assert.equal((await c.pilot.read(scope)).code,'CLOUD_CLIENT_CLOSED');
});
test('Shared app approval alone is not a data grant; revoked pilot grant denies cached reads and writes',async()=>{
 const c=await sharedClient();assert.equal((await c.pilot.readHead(scope)).ok,true);
 await env.withSecurityRulesDisabled(x=>firestore.updateDoc(firestore.doc(x.firestore(),'authorizedUsers',UID),{enabled:false}));
 assert.equal(c.lease().isValid(),true,'app approval and data grant are different');
 assert.equal((await c.pilot.readHead(scope)).code,'CLOUD_PERMISSION_DENIED');
 assert.equal((await c.pilot.read(scope)).code,'CLOUD_PERMISSION_DENIED');
 assert.equal((await c.pilot.prepare({...scope,expectedHead:null})).code,'CLOUD_PERMISSION_DENIED');assert.equal(await count(),0);
});
test('Shared logout/login same UID, foreign account and closed authorization gate permanently invalidate borrowed transport',async()=>{
 for(const mode of ['same','foreign','gate']){
  const c=await sharedClient(),p=await prepare(c),before=c.r.rows();
  if(mode==='gate')c.gate.close();
  else{
   await c.controller.signOut();
   const uid=mode==='same'?UID:'synthetic-other-shared';
   const token=Buffer.from(JSON.stringify({sub:uid,email:uid+'@example.invalid',email_verified:true})).toString('base64url');
   await auth.signInWithCredential(c.auth,auth.GoogleAuthProvider.credential('e30.'+token+'.'));
  }
  assert.equal((await c.pilot.publish(p.handle)).ok,false);assert.equal((await c.pilot.read(scope)).ok,false);
  assert.deepEqual(c.r.rows(),before);assert.equal(await count(),0);
 }
});
test('Shared appEnabled revocation and offline cannot be bypassed through direct transport',async()=>{
 const c=await sharedClient(),p=await prepare(c);await firestore.disableNetwork(c.db);
 assert.equal((await c.pilot.publish(p.handle)).ok,false);assert.equal((await c.pilot.read(scope)).ok,false);
 await firestore.enableNetwork(c.db);assert.equal(await count(),0);
 await env.withSecurityRulesDisabled(x=>firestore.updateDoc(firestore.doc(x.firestore(),'authorizedUsers',UID),{appEnabled:false}));
 assert.equal((await c.pilot.publish(p.handle)).code,'CLOUD_PERMISSION_DENIED');
 assert.equal((await c.pilot.read(scope)).code,'CLOUD_PERMISSION_DENIED');assert.equal(await count(),0);
});
test('Fresh reader rejects missing manifest and missing revision/chunk, corrupt bytes, hashes and ownership',async()=>{
 const c=await client();assert.equal((await c.pilot.read(scope)).code,'CLOUD_PROJECT_NOT_FOUND');
 const p=await prepare(c);assert.equal((await c.pilot.publish(p.handle)).ok,true);
 let saved;await env.withSecurityRulesDisabled(async x=>{const db=x.firestore();saved={manifest:(await firestore.getDoc(ref(db))).data(),revision:(await firestore.getDoc(ref(db,'/revisions/'+p.revisionId))).data(),chunk:(await firestore.getDoc(ref(db,'/revisions/'+p.revisionId+'/chunks/0'))).data()};});
 const cases=[
  ['missing revision','CLOUD_REVISION_INCOMPLETE',async db=>firestore.deleteDoc(ref(db,'/revisions/'+p.revisionId))],
  ['missing chunk','CLOUD_REVISION_INCOMPLETE',async db=>firestore.deleteDoc(ref(db,'/revisions/'+p.revisionId+'/chunks/0'))],
  ['bytes','CLOUD_INTEGRITY_INVALID',async db=>{const b=saved.chunk.bytes.toUint8Array();b[0]^=1;await firestore.updateDoc(ref(db,'/revisions/'+p.revisionId+'/chunks/0'),{bytes:firestore.Bytes.fromUint8Array(b)});}],
  ['chunk hash','CLOUD_CHUNK_INVALID',async db=>firestore.updateDoc(ref(db,'/revisions/'+p.revisionId+'/chunks/0'),{sha256:'f'.repeat(64)})],
  ['manifest','CLOUD_MANIFEST_INVALID',async db=>firestore.updateDoc(ref(db),{chunkCount:8})],
  ...['ownerUid','investorId','projectId'].map(key=>[key,'CLOUD_BASE_INVALID',async db=>firestore.updateDoc(ref(db),{[key]:'foreign'})]),
  ['revision owner','CLOUD_REVISION_INVALID',async db=>firestore.updateDoc(ref(db,'/revisions/'+p.revisionId),{ownerUid:'foreign'})]
 ];
 for(const [name,code,damage] of cases){
  await env.withSecurityRulesDisabled(async x=>{const db=x.firestore();await firestore.setDoc(ref(db),saved.manifest);await firestore.setDoc(ref(db,'/revisions/'+p.revisionId),saved.revision);await firestore.setDoc(ref(db,'/revisions/'+p.revisionId+'/chunks/0'),saved.chunk);await damage(db);});
  const reader=await client(),before=reader.r.rows(),out=await reader.pilot.read(scope);
  assert.equal(out.code,code,name+': '+JSON.stringify(out));assert.deepEqual(reader.r.rows(),before);assert.deepEqual(reader.r.storage.calls,[]);
 }
});
test('Read detects a manifest switch during hashing instead of returning a stale current project',async()=>{
 const c=await client(),p=await prepare(c);assert.equal((await c.pilot.publish(p.handle)).ok,true);
 const reader=await client(),original=reader.r.FC.cloudPilotContract.unpack;let changed=false;
 reader.r.FC.cloudPilotContract.unpack=async(...args)=>{const value=await original(...args);if(!changed){changed=true;setPcv(c.r,true);const next=await prepare(c,(await c.pilot.readHead(scope)).head);assert.equal((await c.pilot.publish(next.handle)).ok,true);}return value;};
 assert.equal((await reader.pilot.read(scope)).code,'CLOUD_READ_CONFLICT');
});
test('Reader denies foreign/no auth, wrong scope and offline without changing local business bytes',async()=>{
 const writer=await client(),p=await prepare(writer);assert.equal((await writer.pilot.publish(p.handle)).ok,true);
 const reader=await client(),before=reader.r.rows();
 assert.equal((await reader.pilot.read({investorId:'other',projectId:'A'})).code,'CLOUD_BASE_INVALID');
 assert.equal((await reader.pilot.read({investorId:'inv-A',projectId:'B'})).code,'CLOUD_PERMISSION_DENIED');
 await firestore.disableNetwork(reader.db);assert.equal((await reader.pilot.read(scope)).code,'CLOUD_NETWORK_UNCONFIRMED');await firestore.enableNetwork(reader.db);
 await reader.transport.signOut();assert.equal((await reader.pilot.read(scope)).code,'CLOUD_AUTH_REQUIRED');
 const other=await client(runtime(),'reader-foreign');assert.equal((await other.pilot.read(scope)).code,'CLOUD_PERMISSION_DENIED');
 assert.deepEqual(reader.r.rows(),before);assert.deepEqual(reader.r.storage.calls,[]);
});

test('Independent read preserves all rooms, individual sides, shelf/drawer groups and real setId ownership',async()=>{
 const r=runtime(),edges={w1:true,w2:false,h1:true,h2:false};
 r.mutate(p=>{
  const room=p.projectData.kuchnia,cab=room.cabinets[0];cab.subType='szuflady';cab.details={drawerLayout:'3_1_2_2',drawerSystem:'skrzynkowe'};
  room.cabinets[1].details.shelves=5;room.cabinets[1].setId='set-A';
  room.sets=[{id:'set-A',presetId:'A',frontCount:2,params:{w1:30,w2:30,hB:72,hTop:20}}];
  room.production={cabinetGroupOverrides:{one:{'front.drawer.small':{edges},'front.drawer.large':{edges},'drawer.front_drawers.sides':{edges}},two:{'body.shelves':{edges}}},setGroupOverrides:{'set-A':{'front.A.left':{edges}}}};
 });
 setPcv(r,true);const c=await client(r),p=await prepare(c);assert.equal((await c.pilot.publish(p.handle)).ok,true);
 const reader=await client(),out=await reader.pilot.read(scope);assert.equal(out.ok,true,JSON.stringify(out));
 assert.deepEqual(clone(out.document.payload),clone((await r.build()).document.payload));
 const data=out.document.payload.project.projectData;
 assert.equal(data.kuchnia.production.setGroupOverrides['set-A']['front.A.left'].edges.h1,true);
 assert.equal(data.kuchnia.production.cabinetGroupOverrides.two['body.shelves'].edges.h1,true);
 assert.equal(data.pokoj.cabinets.length,1);assert.equal(data.kuchnia.cabinets.length,2);
 assert.equal(data.kuchnia.production.partOverrides.one['body.side.left'].edges.w2,true);
 assert.equal(data.kuchnia.production.partOverrides.one['body.side.right'],undefined);
});

test('Logout during independent decoding cannot return a result under an obsolete Auth epoch',async()=>{
 const c=await client(),p=await prepare(c);assert.equal((await c.pilot.publish(p.handle)).ok,true);
 const reader=await client(),original=reader.r.FC.cloudPilotContract.unpack;
 reader.r.FC.cloudPilotContract.unpack=async(...args)=>{const result=await original(...args);await reader.transport.signOut();return result;};
 assert.equal((await reader.pilot.read(scope)).code,'CLOUD_AUTH_REQUIRED');
});


test('Fresh server reads retry transient aborted transactions but never publish after exhausted retries',async()=>{
 const c=await client(),before=c.r.rows();
 for(const permanent of [false,true]){
  let attempts=0;
  const f={...firestore,runTransaction(db,fn,options){return firestore.runTransaction(db,async tx=>{
   attempts++;if(permanent||attempts===1)throw new firestore.FirestoreError('aborted','synthetic transaction contention');
   return fn(tx);
  },options);}};
  const transport=c.r.FC.firebasePilotTransport.fromConnection({firestore:f,db:c.db,session:{identity:()=>c.transport.identity()}});
  const pilot=c.r.FC.projectCloudPilot.create(transport),out=await pilot.prepare({...scope,expectedHead:null});
  if(permanent){assert.equal(out.ok,false);assert.equal(out.code,'CLOUD_REMOTE_UNCONFIRMED');assert.equal(attempts,3);}
  else{assert.equal(out.ok,true,JSON.stringify(out));assert.equal(attempts,2);}
  assert.deepEqual(c.r.rows(),before);assert.equal(await count(),0);await pilot.close();
 }
});

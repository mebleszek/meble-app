// CLOUD-3: two independent Web SDK clients, synthetic data, loopback only.
import {test,before,beforeEach,afterEach,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as app from 'firebase/app';
import * as auth from 'firebase/auth';
import * as f from 'firebase/firestore';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
const require=createRequire(import.meta.url),{fixture}=require('../project-selective-export-smoke.js'),{model}=require('../cloud-global-data-smoke.js');
for(const [key,port]of [['FIRESTORE_EMULATOR_HOST',18080],['FIREBASE_AUTH_EMULATOR_HOST',19099]])if(process.env[key]!==`127.0.0.1:${port}`)throw Error('Loopback emulator required');
const root=new URL('../../',import.meta.url),PROJECT='demo-meble-app',clone=v=>JSON.parse(JSON.stringify(v));
let env,serial=0,clients=[];
function runtime(){const r=fixture();for(const name of ['cloud-pilot-contract','firebase-pilot-transport','global-data-contract','firebase-global-transport'])new Function('window',fs.readFileSync(new URL('js/app/cloud/'+name+'.js',root),'utf8'))(r.s);return r;}
async function client(sub='synthetic-global-owner',options={}){
 const r=runtime(),handles=await r.FC.firebasePilotTransport.create({target:'emulator',projectId:PROJECT,emulator:{host:'127.0.0.1',authPort:19099,firestorePort:18080},appName:'global-'+(++serial),sdk:{app,auth,firestore:f}});clients.push(handles.transport);
 const jwt=Buffer.from(JSON.stringify({sub,email:sub+'@example.invalid',email_verified:true})).toString('base64url');
 if(options.anonymous)await auth.signInAnonymously(handles.auth);else if(!options.signedOut)await auth.signInWithCredential(handles.auth,auth.GoogleAuthProvider.credential('e30.'+jwt+'.'));
 await handles.transport.ready();const uid=handles.auth.currentUser?.uid;let allowed=true;
 const connection={firestore:options.firestore||f,db:handles.db,session:handles.transport,assertAccess:()=>{if(!allowed)throw Error('lease revoked');}};
 const globals=options.signedOut||options.anonymous?null:r.FC.firebaseGlobalTransport.fromConnection(connection);
 return {r,...handles,uid,globals,connection,revoke(){allowed=false;}};
}
async function grant(uid,patch={}){await env.withSecurityRulesDisabled(ctx=>f.setDoc(f.doc(ctx.firestore(),'authorizedUsers',uid),{appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1,...patch}));}
const ref=(db,uid,path)=>f.doc(db,'users',uid,...path.split('/'));
const raw=(uid,provider='google.com')=>env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).firestore();
async function publish(c,m=model(),base=null){const p=await c.globals.prepare({model:m,expectedHead:base});assert.equal(p.ok,true,JSON.stringify(p));if(p.unchanged)return p;const out=await c.globals.publish(p.handle);assert.equal(out.ok,true,JSON.stringify(out));return {...out,handle:p.handle};}
async function documents(uid,collection){let out;await env.withSecurityRulesDisabled(async ctx=>{out=(await f.getDocs(f.collection(ctx.firestore(),'users',uid,collection))).docs.map(s=>({id:s.id,...s.data()}));});return out;}
before(async()=>{f.setLogLevel('silent');env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:'127.0.0.1',port:18080,rules:fs.readFileSync(new URL('./firestore.rules',import.meta.url),'utf8')}});});
beforeEach(async()=>{await env.clearFirestore();});
afterEach(async()=>{await Promise.all(clients.map(c=>c.close()));clients=[];});after(async()=>{await env?.cleanup();});
test('14 domains: A publishes, independent B restores exact values/order/references; no local writes',async()=>{
 const a=await client(),b=await client();assert.equal(a.uid,b.uid);await grant(a.uid);const aRaw=a.r.rows(),bRaw=b.r.rows(),m=model();
 const out=await publish(a,m),read=await b.globals.read();assert.equal(read.ok,true,JSON.stringify(read));assert.deepEqual(read.model,m);assert.deepEqual(read.head,out.head);
 assert.deepEqual(a.r.rows(),aRaw);assert.deepEqual(b.r.rows(),bRaw);assert.deepEqual(a.r.storage.calls,[]);assert.deepEqual(b.r.storage.calls,[]);
});
test('Price/catalog/stock edits across clients publish one record each; unchanged state is a no-op',async()=>{
 const a=await client(),b=await client();await grant(a.uid);let m=model(),head=(await publish(a,m)).head,n=(await documents(a.uid,'globalRecords')).length;
 for(const edit of [x=>x.materials[0].price=299,x=>x.hardware[0].name='Synthetic changed hinge',x=>x.stock[0].qty=2]){
  edit(m);head=(await publish(a,m,head)).head;const read=await b.globals.read();assert.equal(read.ok,true,JSON.stringify(read));assert.deepEqual(read.model,m);assert.equal((await documents(a.uid,'globalRecords')).length,++n);
 }
 const revs=(await documents(a.uid,'globalRevisions')).length;const no=await b.globals.prepare({model:m,expectedHead:head});assert.equal(no.unchanged,true);assert.equal((await documents(a.uid,'globalRevisions')).length,revs);
});
test('Concurrent devices CAS: exactly one wins and stale publication cannot replace newer data',async()=>{
 const a=await client(),b=await client();await grant(a.uid);let head=(await publish(a)).head;
 for(let round=0;round<8;round++){
  const m=model(),n=model();m.materials[0].price=301+round;n.stock[0].qty=8+round;
  const pa=await a.globals.prepare({model:m,expectedHead:head}),pb=await b.globals.prepare({model:n,expectedHead:head});assert.ok(pa.ok&&pb.ok);
  const out=await Promise.all([a.globals.publish(pa.handle),b.globals.publish(pb.handle)]);assert.equal(out.filter(x=>x.ok).length,1);assert.equal(out.find(x=>!x.ok).code,'GLOBAL_WRITE_CONFLICT',JSON.stringify(out));
  const read=await b.globals.read();assert.equal(read.ok,true);assert.deepEqual(read.model,out[0].ok?m:n);assert.equal((await b.globals.prepare({model:n,expectedHead:head})).code,'GLOBAL_WRITE_CONFLICT');head=read.head;
 }
});
test('App-only/pilot-only/no grant, foreign UID, anonymous and signed-out users cannot bypass Rules',async()=>{
 const c=await client();await grant(c.uid,{globalDataEnabled:false});assert.equal((await c.globals.readHead()).code,'GLOBAL_PERMISSION_DENIED');
 await grant(c.uid,{appEnabled:false});assert.equal((await c.globals.readHead()).code,'GLOBAL_PERMISSION_DENIED');
 await grant(c.uid,{globalSchemaVersion:2});assert.equal((await c.globals.readHead()).code,'GLOBAL_PERMISSION_DENIED');await grant(c.uid);await publish(c);
 for(const db of [env.unauthenticatedContext().firestore(),raw('synthetic-foreign'),raw(c.uid,'anonymous')])await assertFails(f.getDoc(ref(db,c.uid,'globalData/current')));
 const other=await client('synthetic-other');await grant(other.uid);await assertFails(f.getDoc(ref(other.db,c.uid,'globalData/current')));
 await assertFails(f.getDocs(f.collection(raw(c.uid),'users',c.uid,'globalRecords')));
 await assertFails(f.getDoc(f.doc(raw(c.uid),'authorizedUsers',c.uid)));await assertFails(f.setDoc(f.doc(raw(c.uid),'authorizedUsers',c.uid),{appEnabled:true,globalDataEnabled:true}));
 await assertFails(f.getDoc(ref(raw(c.uid),c.uid,'unknown/business')));
});
test('Revoked server data grant or appEnabled denies subsequent reads and writes; local lease also required',async()=>{
 const c=await client();await grant(c.uid);const out=await publish(c);await grant(c.uid,{globalDataEnabled:false});assert.equal((await c.globals.read()).code,'GLOBAL_PERMISSION_DENIED');
 assert.equal((await c.globals.prepare({model:model(),expectedHead:out.head})).code,'GLOBAL_PERMISSION_DENIED');await grant(c.uid);c.revoke();assert.equal((await c.globals.read()).code,'GLOBAL_ACCESS_UNCONFIRMED');
});
test('Logout, same UID re-login and account change invalidate an existing transport epoch',async()=>{
 const c=await client();await grant(c.uid);await publish(c);await c.transport.signOut();assert.equal((await c.globals.read()).ok,false);
 const jwt=Buffer.from(JSON.stringify({sub:'synthetic-global-owner',email:'synthetic-global-owner@example.invalid',email_verified:true})).toString('base64url');await auth.signInWithCredential(c.auth,auth.GoogleAuthProvider.credential('e30.'+jwt+'.'));assert.equal((await c.globals.read()).code,'GLOBAL_AUTH_CHANGED');
 const other=Buffer.from(JSON.stringify({sub:'synthetic-other',email:'synthetic-other@example.invalid',email_verified:true})).toString('base64url');await auth.signInWithCredential(c.auth,auth.GoogleAuthProvider.credential('e30.'+other+'.'));assert.equal((await c.globals.read()).code,'GLOBAL_AUTH_CHANGED');
});
test('Offline refuses before staging and creates no queued writes after network resumes',async()=>{
 const c=await client();await grant(c.uid);const p=await c.globals.prepare({model:model(),expectedHead:null});assert.ok(p.ok);await f.disableNetwork(c.db);const out=await c.globals.publish(p.handle);assert.equal(out.ok,false);assert.equal(out.published,false);
 await f.enableNetwork(c.db);assert.equal((await documents(c.uid,'globalRecords')).length,0);assert.equal((await c.globals.readHead()).head,null);
});
test('Interrupted staging never publishes a partial group; immutable records cannot be mutated/deleted',async()=>{
 let n=0;const altered={...f,runTransaction:async(db,fn,opts)=>{if(++n===5)throw Object.assign(Error('synthetic network loss'),{code:'unavailable'});return f.runTransaction(db,fn,opts);}};
 const c=await client('synthetic-global-owner',{firestore:altered});await grant(c.uid);const p=await c.globals.prepare({model:model(),expectedHead:null});const out=await c.globals.publish(p.handle);assert.equal(out.ok,false);assert.equal((await c.globals.readHead()).head,null);
 const rows=await documents(c.uid,'globalRecords');assert.ok(rows.length>0);const db=raw(c.uid);await assertFails(f.updateDoc(ref(db,c.uid,'globalRecords/'+rows[0].id),{json:'{}'}));await assertFails(f.deleteDoc(ref(db,c.uid,'globalRecords/'+rows[0].id)));
});
test('Lost publication acknowledgement is uncertain, blind retry refuses, exact server head confirms',async()=>{
 let drop=true;const altered={...f,runTransaction:async(db,fn,opts)=>{let publication=false;const result=await f.runTransaction(db,tx=>fn(new Proxy(tx,{get(t,k){if(k==='set')return (ref,data)=>{if(ref.path.endsWith('/globalData/current'))publication=true;return t.set(ref,data);};const v=t[k];return typeof v==='function'?v.bind(t):v;}})),opts);if(publication&&drop){drop=false;throw Object.assign(Error('synthetic lost ack'),{code:'unavailable'});}return result;}};
 const c=await client('synthetic-global-owner',{firestore:altered});await grant(c.uid);const p=await c.globals.prepare({model:model(),expectedHead:null}),out=await c.globals.publish(p.handle);assert.equal(out.ok,false);assert.equal(out.published,'unconfirmed');const retry=await c.globals.publish(p.handle);assert.equal(retry.code,'GLOBAL_CONFIRMATION_REQUIRED');assert.equal(retry.published,'unconfirmed');assert.equal((await c.globals.confirm(p.handle)).ok,true);assert.equal((await c.globals.read()).ok,true);
});
test('Independent reader rejects missing/corrupt records and invalid owner/revision/manifest',async()=>{
 const c=await client();await grant(c.uid);const published=await publish(c);const rows=await documents(c.uid,'globalRecords'),first=rows[0];
 await env.withSecurityRulesDisabled(async ctx=>f.deleteDoc(ref(ctx.firestore(),c.uid,'globalRecords/'+first.id)));assert.equal((await c.globals.read()).code,'GLOBAL_RECORD_MISSING');
 const saved={...first};delete saved.id;await env.withSecurityRulesDisabled(async ctx=>f.setDoc(ref(ctx.firestore(),c.uid,'globalRecords/'+first.id),{...saved,json:saved.json+' '}));assert.equal((await c.globals.read()).code,'GLOBAL_INTEGRITY_INVALID');
 await env.withSecurityRulesDisabled(async ctx=>f.setDoc(ref(ctx.firestore(),c.uid,'globalRecords/'+first.id),{...saved,ownerUid:'foreign'}));assert.equal((await c.globals.read()).code,'GLOBAL_OWNER_INVALID');
 await env.withSecurityRulesDisabled(async ctx=>f.updateDoc(ref(ctx.firestore(),c.uid,'globalData/current'),{generation:0}));assert.equal((await c.globals.read()).code,'GLOBAL_HEAD_INVALID');
 assert.equal(published.published,true);
});
test('Rules deny forged envelopes, wrong scope, malformed head, orphan revision and grant escalation',async()=>{
 const c=await client();await grant(c.uid);const db=raw(c.uid),p=await c.r.FC.globalDataContract.pack(c.uid,model()),r=p.records[0];
 for(const changed of [{...r,ownerUid:'foreign'},{...r,domain:'cache'},{...r,token:'secret'},{...r,byteLength:131073}])await assertFails(f.setDoc(ref(db,c.uid,'globalRecords/'+r.hash),changed));
 await assertSucceeds(f.setDoc(ref(db,c.uid,'globalRecords/'+r.hash),r));await assertFails(f.setDoc(ref(db,c.uid,'globalData/current'),{ownerUid:c.uid,version:1,generation:1,revisionId:'a'.repeat(32),directoryHash:p.directoryHash,recordCount:p.records.length,updatedAt:f.serverTimestamp()}));
 await assertFails(f.setDoc(ref(db,c.uid,'globalRevisions/'+'a'.repeat(32)),{ownerUid:c.uid,version:1,generation:1,revisionId:'a'.repeat(32),directoryHash:p.directoryHash,recordCount:p.records.length,directory:p.directoryJson,baseGeneration:0,baseRevisionId:'',baseDirectoryHash:'',createdAt:f.serverTimestamp()}));
});
test('Source changes during hashing/staging refuse; missing dependencies/oversize fail before any remote writes',async()=>{
 const c=await client();await grant(c.uid);let valid=true;const p=await c.globals.prepare({model:model(),expectedHead:null,assertSource:()=>{if(!valid)c.r.FC.globalDataContract.fail('GLOBAL_SOURCE_CHANGED');}});assert.ok(p.ok);valid=false;assert.equal((await c.globals.publish(p.handle)).code,'GLOBAL_SOURCE_CHANGED');
 const m=model();m.suppliers=[];assert.equal((await c.globals.prepare({model:m,expectedHead:null})).code,'GLOBAL_REFERENCE_MISSING');m.suppliers=model().suppliers;m.materials[0].note='ł'.repeat(65536);assert.equal((await c.globals.prepare({model:m,expectedHead:null})).code,'GLOBAL_RECORD_TOO_LARGE');assert.equal((await documents(c.uid,'globalRecords')).length,0);
});
test('Closing borrowed global adapter leaves shared Auth/Firestore and project transport usable',async()=>{
 const c=await client();await grant(c.uid);const out=await publish(c),uid=c.auth.currentUser.uid;await c.globals.close();assert.equal(c.auth.currentUser.uid,uid);c.transport.identity();
 const next=c.r.FC.firebaseGlobalTransport.fromConnection(c.connection);assert.equal((await next.read()).head.revisionId,out.head.revisionId);assert.equal((await c.globals.read()).code,'GLOBAL_CLIENT_CLOSED');await next.close();
});

test('Source change during async preparation and incomplete domain bundle refuse without writes',async()=>{
 const c=await client();await grant(c.uid);let valid=true;
 const task=c.globals.prepare({model:model(),expectedHead:null,assertSource:()=>{if(!valid)c.r.FC.globalDataContract.fail('GLOBAL_SOURCE_CHANGED');}});valid=false;
 assert.equal((await task).code,'GLOBAL_SOURCE_CHANGED');assert.equal((await c.globals.prepare({model:{materials:model().materials},expectedHead:null})).code,'GLOBAL_BUNDLE_INCOMPLETE');assert.equal((await documents(c.uid,'globalRecords')).length,0);
});
test('A new manifest during asynchronous read invalidates the old snapshot instead of presenting it as current',async()=>{
 const a=await client(),b=await client();await grant(a.uid);const first=await publish(a),m=model();m.materials[0].price=345;const packed=await b.globals.prepare({model:m,expectedHead:first.head});assert.ok(packed.ok);
 const contract=a.r.FC.globalDataContract,sha=contract.sha;let changed=false;
 contract.sha=async bytes=>{const hash=await sha(bytes);if(!changed){changed=true;assert.equal((await b.globals.publish(packed.handle)).ok,true);}return hash;};
 assert.equal((await a.globals.read()).code,'GLOBAL_READ_CONFLICT');contract.sha=sha;assert.deepEqual((await a.globals.read()).model,m);
});

test('Deterministic Rules CAS denial is classified by fresh authorized head, never by retrying the write',async()=>{
 const b=await client();await grant(b.uid);const initial=await publish(b),next=model();next.stock[0].qty=42;
 const pending=await b.globals.prepare({model:next,expectedHead:initial.head});assert.ok(pending.ok);let intercepted=false;
 const altered={...f,runTransaction:async(db,fn,opts)=>{
  let publication=false;
  try{return await f.runTransaction(db,tx=>fn(new Proxy(tx,{get(t,k){if(k==='set')return (ref,data)=>{
   if(ref.path.endsWith('/globalData/current')&&!intercepted){publication=true;throw Object.assign(Error('synthetic Rules CAS denial'),{code:'permission-denied'});}return t.set(ref,data);
  };const v=t[k];return typeof v==='function'?v.bind(t):v;}})),opts);}
  catch(e){if(publication&&!intercepted){intercepted=true;assert.equal((await b.globals.publish(pending.handle)).ok,true);}throw e;}
 }};
 const a=await client('synthetic-global-owner',{firestore:altered}),m=model();m.materials[0].price=401;
 const pa=await a.globals.prepare({model:m,expectedHead:initial.head});assert.ok(pa.ok);const out=await a.globals.publish(pa.handle);
 assert.equal(intercepted,true);assert.equal(out.code,'GLOBAL_WRITE_CONFLICT',JSON.stringify(out));assert.deepEqual((await b.globals.read()).model,next);
});

test('Catalog larger than one bounded read batch roundtrips independently without losing order or records',async()=>{
 const a=await client(),b=await client();await grant(a.uid);const m=model();
 for(let i=0;i<65;i++)m.materials.push({id:'synthetic-material-'+i,name:'Synthetic material '+i,materialType:'laminat',price:i+1,priceUnit:'sheet'});
 await publish(a,m);const out=await b.globals.read();assert.equal(out.ok,true,JSON.stringify(out));assert.deepEqual(out.model,m);
});

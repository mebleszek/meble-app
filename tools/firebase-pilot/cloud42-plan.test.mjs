// Actual emulator transactions applying the offline plan; no Admin SDK or live IO.
import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDocFromServer,updateDoc,runTransaction} from 'firebase/firestore';
const p=createRequire(import.meta.url)('./cloud42-package.js');
for(const [key,value]of Object.entries({FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099'}))assert.equal(process.env[key],value);
const uid='synthetic-cloud42-owner',grant={appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1};
const access={schemaVersion:1},plans=p.grantActions({uid,grant,appAccess:access,control:null});let env;
async function admin(fn){let result;await env.withSecurityRulesDisabled(async c=>{result=await fn(c.firestore());});return result;}
async function apply(action){return admin(db=>runTransaction(db,async tx=>{
 const entries=await Promise.all(Object.keys(action.expected).map(async path=>{const s=await tx.get(doc(db,path));return [path,s.exists()?s.data():null];}));
 p.assertExpected(action,Object.fromEntries(entries));
 for(const write of action.writes){const ref=doc(db,write.path);if(write.method==='update')tx.update(ref,write.fields);else tx.set(ref,write.fields);}
}));}
const own=()=>env.authenticatedContext(uid,{firebase:{sign_in_provider:'google.com'}}).firestore();
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,rules:fs.readFileSync(new URL('./firestore-live-pilot.rules',import.meta.url),'utf8')}});});
beforeEach(async()=>{await env.clearFirestore();await admin(async db=>{await setDoc(doc(db,'authorizedUsers',uid),grant);await setDoc(doc(db,'appAccess',uid),access);});});
after(async()=>env?.cleanup());
test('Stage remains denied; activation permits only the synthetic scope; stop preserves Auth-only and global grant fields',async()=>{
 const db=own(),head=doc(db,'users',uid,'pilotProjects','cloud4-project-v1');
 await assertSucceeds(getDocFromServer(doc(db,'appAccess',uid)));await assertFails(getDocFromServer(head));
 await apply(plans.stage);await assertFails(getDocFromServer(head));await apply(plans.activate);
 assert.equal((await getDocFromServer(head)).exists(),false);
 const foreign=env.authenticatedContext('synthetic-other',{firebase:{sign_in_provider:'google.com'}}).firestore();
 await assertFails(getDocFromServer(doc(foreign,'users',uid,'pilotProjects','cloud4-project-v1')));
 await assertFails(getDocFromServer(doc(db,'users',uid,'pilotProjects','other')));
 await apply(plans.stop);await assertFails(getDocFromServer(head));await assertSucceeds(getDocFromServer(doc(db,'appAccess',uid)));
 assert.deepEqual(await admin(async db=>(await getDocFromServer(doc(db,'authorizedUsers',uid))).data()),{...grant,pilotProjectId:'cloud4-project-v1',pilotInvestorId:'cloud4-investor-v1'});
 assert.deepEqual(await admin(async db=>(await getDocFromServer(doc(db,'appAccess',uid))).data()),access);
});
test('Concurrent administrative change refuses activation without overwriting new data',async()=>{
 await apply(plans.stage);await admin(db=>updateDoc(doc(db,'authorizedUsers',uid),{globalDataEnabled:false}));
 await assert.rejects(apply(plans.activate),/CLOUD42_ADMIN_CONFLICT/);
 const state=await admin(async db=>(await getDocFromServer(doc(db,'authorizedUsers',uid))).data());
 assert.equal(state.globalDataEnabled,false);assert.equal(state.enabled,false);
 assert.equal(await admin(async db=>(await getDocFromServer(doc(db,'pilotControl','cloud4'))).data().enabled),false);
});
test('Revoking app access while staged vetoes activation and never repairs permissions automatically',async()=>{
 await apply(plans.stage);await admin(db=>updateDoc(doc(db,'authorizedUsers',uid),{appEnabled:false}));
 await assert.rejects(apply(plans.activate),/CLOUD42_ADMIN_CONFLICT/);
 await assertFails(getDocFromServer(doc(own(),'appAccess',uid)));
 assert.equal(await admin(async db=>(await getDocFromServer(doc(db,'authorizedUsers',uid))).data().appEnabled),false);
});
test('Fresh stop plan preserves concurrent global changes and already revoked app access',async()=>{
 await apply(plans.stage);await apply(plans.activate);
 await admin(db=>updateDoc(doc(db,'authorizedUsers',uid),{appEnabled:false,globalDataEnabled:false}));
 await assert.rejects(apply(plans.stop),/CLOUD42_ADMIN_CONFLICT/);
 const current=await admin(async db=>({grant:(await getDocFromServer(doc(db,'authorizedUsers',uid))).data(),
  appAccess:(await getDocFromServer(doc(db,'appAccess',uid))).data(),control:(await getDocFromServer(doc(db,'pilotControl','cloud4'))).data()}));
 await apply(p.stopAction({uid,...current}));
 assert.deepEqual(await admin(async db=>(await getDocFromServer(doc(db,'authorizedUsers',uid))).data()),{...current.grant,enabled:false});
 assert.equal(await admin(async db=>(await getDocFromServer(doc(db,'pilotControl','cloud4'))).data().enabled),false);
});

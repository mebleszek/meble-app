// Demo emulator CAS, incomplete staging and emergency STOP; no production SDK path.
import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,getDocFromServer} from 'firebase/firestore';
import p from './cloud42-package.js';
import gate from './cloud44-gate2.js';
import {applyDemoAction,readDemoState,verifyDemoStop} from './cloud44-emulator-admin.mjs';
const uid='synthetic-cloud44-owner',initial={appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1},access={schemaVersion:1};
let env;
async function admin(fn){let result;await env.withSecurityRulesDisabled(async c=>{result=await fn(c.firestore());});return result;}
const apply=action=>admin(db=>applyDemoAction(db,action,uid));
const current=()=>admin(db=>readDemoState(db,uid));
const own=()=>env.authenticatedContext(uid,{firebase:{sign_in_provider:'google.com'}}).firestore();
before(async()=>{
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');
 assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:19099');
 env=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,rules:fs.readFileSync(new URL('./firestore-live-pilot.rules',import.meta.url),'utf8')}});
});
beforeEach(async()=>{await env.clearFirestore();await admin(async db=>{await setDoc(doc(db,'authorizedUsers',uid),initial);await setDoc(doc(db,'appAccess',uid),access);});});
after(async()=>env?.cleanup());
test('Concurrent administrative operators have one stage winner and a refused second attempt',async()=>{
 const plan=p.grantActions({uid,grant:initial,appAccess:access,control:null}).stage;
 const results=await Promise.allSettled([apply(plan),apply(plan)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 assert.equal((await current()).grant.enabled,false);
 await assert.rejects(apply(plan),/CLOUD42_ADMIN_CONFLICT/);
});
test('Incomplete legacy staging is stopped without overwriting global fields or app access',async()=>{
 const plan=p.grantActions({uid,grant:initial,appAccess:access,control:null});
 // Simulate interruption of a previous nontransactional administrative attempt.
 await admin(db=>updateDoc(doc(db,'authorizedUsers',uid),plan.stage.writes[0].fields));
 await assert.rejects(apply(plan.activate),/CLOUD42_ADMIN_CONFLICT/);
 const before=await current();await apply(p.stopAction({uid,...before}));
 assert.equal(await admin(db=>verifyDemoStop(db,uid)),true);
 const after=await current();assert.equal(after.grant.appEnabled,true);assert.equal(after.grant.globalDataEnabled,true);assert.deepEqual(after.appAccess,access);
 await assertSucceeds(getDocFromServer(doc(own(),'appAccess',uid)));
 await assertFails(getDocFromServer(doc(own(),'users',uid,'pilotProjects','cloud4-project-v1')));
});
test('Expired client window cannot activate; administrative STOP and independent verification still work',async()=>{
 let clock=1000;const operator=gate.openDemoOperator({projectId:'demo-meble-app',origin:'http://127.0.0.1:1234',expiresAt:2000,now:()=>clock});
 const plans=p.grantActions({uid,grant:initial,appAccess:access,control:null});
 await operator.stage(()=>apply(plans.stage));clock=2000;
 await assert.rejects(operator.activate(()=>apply(plans.activate)),/WINDOW_EXPIRED/);
 assert.equal((await current()).control.enabled,false);
 const state=await current();await operator.stop(()=>apply(p.stopAction({uid,...state})));
 await operator.verifyStop(()=>admin(db=>verifyDemoStop(db,uid)));
 assert.equal(operator.inspect().state,'STOP_VERIFIED');
});
test('Concurrent revocation vetoes stale STOP; fresh bounded STOP never restores appEnabled',async()=>{
 const plans=p.grantActions({uid,grant:initial,appAccess:access,control:null});await apply(plans.stage);await apply(plans.activate);
 await admin(db=>updateDoc(doc(db,'authorizedUsers',uid),{appEnabled:false,globalDataEnabled:false}));
 await assert.rejects(apply(plans.stop),/CLOUD42_ADMIN_CONFLICT/);
 const state=await current();await apply(p.stopAction({uid,...state}));
 assert.equal(await admin(db=>verifyDemoStop(db,uid)),true);
 assert.deepEqual((await current()).grant,{...state.grant,enabled:false});
 await assertFails(getDocFromServer(doc(own(),'appAccess',uid)));
});
test('Foreign paths and non-demo connection are refused before any transaction',async()=>{
 const plan=p.grantActions({uid,grant:initial,appAccess:access,control:null}).stage;
 const changed=structuredClone(plan);changed.writes[0].path='global/data';
 await assert.rejects(apply(changed),/ADMIN_SCOPE_INVALID/);
 await assert.rejects(applyDemoAction({app:{options:{projectId:'mebleszek-meble-app'}}},plan,uid),/DEMO_LOOPBACK_REQUIRED/);
 assert.deepEqual((await current()).grant,initial);
});
test('Client expiry does not expire the server grant; explicit administrative STOP is required',async()=>{
 let clock=1000;const operator=gate.openDemoOperator({projectId:'demo-meble-app',origin:'http://127.0.0.1:1234',expiresAt:2000,now:()=>clock});
 const plans=p.grantActions({uid,grant:initial,appAccess:access,control:null});
 await operator.stage(()=>apply(plans.stage));await operator.activate(()=>apply(plans.activate));clock=2000;
 const head=doc(own(),'users',uid,'pilotProjects','cloud4-project-v1');
 await assertSucceeds(getDocFromServer(head));assert.equal((await current()).grant.enabled,true);
 let called=false;await assert.rejects(operator.write({execute:async()=>{called=true;return getDocFromServer(head);}},{role:'write'}),/WINDOW_EXPIRED/);
 assert.equal(called,false);
 await operator.stop(()=>apply(plans.stop));await operator.verifyStop(()=>admin(db=>verifyDemoStop(db,uid)));
 await assertFails(getDocFromServer(head));await assertSucceeds(getDocFromServer(doc(own(),'appAccess',uid)));
});

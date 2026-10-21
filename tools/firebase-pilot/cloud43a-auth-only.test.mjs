// Both exact Auth-only artifacts on the local official Firestore emulator.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,collection,getDocFromServer,getDocs,setDoc,updateDoc,deleteDoc,setLogLevel} from 'firebase/firestore';
import b from './cloud43a-baseline.js';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18080')throw Error('Demo loopback emulator required');
const root=fileURLToPath(new URL('../../',import.meta.url)),external=process.env.CLOUD43A_PRIVATE_SOURCE;
if(!external||path.resolve(external).startsWith(root))throw Error('CLOUD43A_PRIVATE_EXTERNAL_SOURCE_REQUIRED');
const privateBytes=fs.readFileSync(external);b.verifyArtifact('production-auth-only-baseline',privateBytes);
setLogLevel('silent');
for(const [role,bytes]of [['repository-auth-only-template',fs.readFileSync(new URL('./firestore-auth-only.rules',import.meta.url))],['production-auth-only-baseline',privateBytes]]){
 test(role+' exact Rules byte identity and full deny boundary',async t=>{
  b.verifyArtifact(role,bytes);
  const env=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,rules:bytes.toString('utf8')}});
  const own='cloud43a-synthetic-own',other='cloud43a-synthetic-other';
  const client=(uid=own,provider='google.com')=>env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).firestore();
  const access=(db,uid=own)=>doc(db,'appAccess',uid),grant=(db,uid=own)=>doc(db,'authorizedUsers',uid);
  const admin=fn=>env.withSecurityRulesDisabled(c=>fn(c.firestore()));
  try{
   await env.clearFirestore();
   await admin(async db=>{for(const uid of [own,other]){await setDoc(grant(db,uid),{appEnabled:true,enabled:true,pilotProjectId:'cloud4-project-v1',pilotInvestorId:'cloud4-investor-v1'});await setDoc(access(db,uid),{schemaVersion:1});}});
   await t.test('Only approved Google UID gets its own appAccess',async()=>{assert.equal((await assertSucceeds(getDocFromServer(access(client())))).data().schemaVersion,1);});
   await t.test('Unauthenticated and non-Google providers are denied',async()=>{
    await assertFails(getDocFromServer(access(env.unauthenticatedContext().firestore())));
    await assertFails(getDocFromServer(access(client(own,'password'))));
   });
   await t.test('Missing or revoked appEnabled denies, without changing pilot fields',async()=>{
    await admin(db=>updateDoc(grant(db),{appEnabled:false}));await assertFails(getDocFromServer(access(client())));
    await admin(db=>deleteDoc(grant(db)));await assertFails(getDocFromServer(access(client())));
    await admin(db=>setDoc(grant(db),{enabled:true}));await assertFails(getDocFromServer(access(client())));
    await admin(db=>updateDoc(grant(db),{appEnabled:true}));
   });
   await t.test('Another approved UID cannot read the first UID access record',async()=>{await assertFails(getDocFromServer(access(client(other))));});
   await t.test('Listing and every client mutation of appAccess remain denied',async()=>{
    const db=client();await assertFails(getDocs(collection(db,'appAccess')));
    await assertFails(setDoc(access(db,'new-synthetic'),{schemaVersion:1}));
    await assertFails(updateDoc(access(db),{schemaVersion:2}));await assertFails(deleteDoc(access(db)));
   });
   await t.test('Grant is unreadable and cannot be created, updated, deleted or listed by a client',async()=>{
    const db=client();await assertFails(getDocFromServer(grant(db)));await assertFails(getDocs(collection(db,'authorizedUsers')));
    await assertFails(setDoc(grant(db,'new-synthetic'),{appEnabled:true}));await assertFails(updateDoc(grant(db),{appEnabled:false}));await assertFails(deleteDoc(grant(db)));
   });
   await t.test('Pilot writes stay denied even with a pilot-looking grant; globals and other paths default-deny',async()=>{
    await admin(async db=>{await setDoc(grant(db),{appEnabled:true,enabled:true,pilotProjectId:'cloud4-project-v1',pilotInvestorId:'cloud4-investor-v1'});
     await setDoc(doc(db,'pilotControl','cloud4'),{schemaVersion:1,ownerUid:own,enabled:true,projectId:'cloud4-project-v1',investorId:'cloud4-investor-v1'});});
    const db=client();
    for(const name of ['users/'+own+'/pilotProjects/cloud4-project-v1','users/'+own+'/globals/catalog','pilotControl/cloud4','unmatched/data']){
     await assertFails(getDocs(collection(db,name.split('/').slice(0,-1).join('/'))));
     const ref=doc(db,name);await assertFails(getDocFromServer(ref));await assertFails(setDoc(ref,{synthetic:true}));await assertFails(updateDoc(ref,{synthetic:false}));await assertFails(deleteDoc(ref));
    }
   });
  }finally{await env.cleanup();}
 });
}

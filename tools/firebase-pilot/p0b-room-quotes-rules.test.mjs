import test from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as f from 'firebase/firestore';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {createP0BProtocol,createP0BDeletionIntent} from './p0b-protocol.mjs';
import {p0bConnection} from '../../sync/application-p0b-domain.mjs';
const {p0bApplicationRules}=createRequire(import.meta.url)('./p0b-application-rules.js');
test('P0-B room quote Rules: CAS, staging, immutable history, Auth and terminal investor denial',async t=>{
 const uid='room-quote-rules-owner',claims={email_verified:true,firebase:{sign_in_provider:'google.com'}};
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');
 const env=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,rules:p0bApplicationRules({normal:true})}});t.after(()=>env.cleanup());
 const protectedGlobal={exact:17.125};
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  for(const [collection,id,value]of [['syncConfig','owner',{ownerUid:uid,activationId:'p0b-demo',schemaVersion:1}],['syncAccess',uid,{activationId:'p0b-demo',schemaVersion:1}],['appAccess',uid,{schemaVersion:1}],['authorizedUsers',uid,{appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1}]])await f.setDoc(f.doc(db,collection,id),value);
  await f.setDoc(f.doc(db,'users',uid,'globalData','current'),protectedGlobal);
 });
 const db=env.authenticatedContext(uid,claims).firestore(),native=db._delegate||db;
 const connection={db:native,firestore:f,assertAccess(){},session:{identity:()=>({uid,epoch:1})},auth:{app:native.app,emulatorConfig:{host:'127.0.0.1',port:19099,protocol:'http'},currentUser:{uid,providerData:[{providerId:'google.com'}]}}};
 const protocol=createP0BProtocol(p0bConnection(connection),'computer');
 await protocol.createInvestor('owner',{id:'owner',name:'Synthetic'});
 await protocol.createInvestor('protected',{id:'protected',name:'Protected'});
 const protectedRecord=await protocol.investor('protected');
 const ref=(...path)=>f.doc(db,'users',uid,'p0bRoomQuotes','owner',...path),hash='a'.repeat(64);
 const head=(generation,revisionId)=>({ownerUid:uid,investorId:'owner',version:1,generation,revisionId,hash,updatedAt:f.serverTimestamp()});
 const stage=async(generation,rid,previous)=>{
  const {updatedAt,...fields}=head(generation,rid);
  await f.setDoc(ref('revisions',rid),{...fields,previous,chunks:[hash],createdAt:f.serverTimestamp()});
 };
 const chunk=rid=>f.setDoc(ref('revisions',rid,'chunks','0'),{index:0,text:'Synthetic frozen quote',hash});
 const r1='1'.repeat(32),r2='2'.repeat(32),r3='3'.repeat(32),r4='4'.repeat(32);
 await assertFails(f.setDoc(ref(),head(1,r1)));
 await stage(1,r1,'');await assertFails(f.setDoc(ref(),head(1,r1)));
 await chunk(r1);await f.setDoc(ref(),head(1,r1));
 const first=(await f.getDoc(ref())).data();
 await assertFails(f.setDoc(ref(),head(1,r1)));
 await assertFails(f.updateDoc(ref('revisions',r1),{hash:'b'.repeat(64)}));
 await assertFails(f.updateDoc(ref('revisions',r1,'chunks','0'),{text:'overwrite accepted content'}));
 await assertFails(f.deleteDoc(ref('revisions',r1,'chunks','0')));
 await stage(2,r2,r1);await chunk(r2);await stage(2,r3,r1);await chunk(r3);
 await f.setDoc(ref(),head(2,r2));
 await assertFails(f.setDoc(ref(),head(2,r3)));
 assert.equal((await f.getDoc(ref())).data().revisionId,r2);
 const stranger=env.authenticatedContext('stranger',claims).firestore(),anonymous=env.unauthenticatedContext().firestore();
 for(const other of [stranger,anonymous]){
  await assertFails(f.getDoc(f.doc(other,'users',uid,'p0bRoomQuotes','owner')));
  await assertFails(f.setDoc(f.doc(other,'users',uid,'p0bRoomQuotes','owner'),head(3,r4)));
 }
 await stage(3,r4,r2);await chunk(r4);
 await protocol.publishDeletion(createP0BDeletionIntent([await protocol.investor('owner')],'delete-owner'));
 await assertFails(f.setDoc(ref(),head(3,r4)));
 await assertFails(f.setDoc(ref('revisions','5'.repeat(32)),{...head(3,'5'.repeat(32)),createdAt:f.serverTimestamp()}));
 assert.equal((await f.getDoc(ref())).data().revisionId,r2);
 assert.equal((await f.getDoc(ref('revisions',r1,'chunks','0'))).data().text,'Synthetic frozen quote');
 assert.equal(first.generation,1);assert.deepEqual(await protocol.investor('protected'),protectedRecord);
 await env.withSecurityRulesDisabled(async context=>assert.deepEqual((await f.getDoc(f.doc(context.firestore(),'users',uid,'globalData','current'))).data(),protectedGlobal));
 t.diagnostic('Head CAS and immutable revisions stay within the emulator Rules read budget; staged quotes cannot publish after terminal deletion');
});

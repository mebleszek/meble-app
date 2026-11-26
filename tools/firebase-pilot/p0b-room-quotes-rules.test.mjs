import test from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as f from 'firebase/firestore';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {createP0BProtocol,createP0BDeletionIntent} from './p0b-protocol.mjs';
import {p0bConnection} from '../../sync/application-p0b-domain.mjs';
import {verifyQuoteReservation} from '../../sync/quote-reservation-contract.mjs';
import {digest} from '../../sync/local-first-values.mjs';
const {p0bApplicationRules}=createRequire(import.meta.url)('./p0b-application-rules.js');

test('P0-B room quote Rules: reservation candidate fences old editors and grants only against the saved room head',async t=>{
 const uid='room-reservation-owner',iid='investor',pid='kitchen',peer='wardrobe',rid='a'.repeat(32),savedRid='b'.repeat(32);
 const claims={email_verified:true,firebase:{sign_in_provider:'google.com'}};
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');
 const env=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,
  rules:p0bApplicationRules({normal:true,quoteReservations:true})}});t.after(()=>env.cleanup());
 const base=(db,collection,key,...path)=>f.doc(db,'users',uid,collection,key,...path);
 const seedHead=(id,currentRevisionId,generation)=>env.withSecurityRulesDisabled(ctx=>f.setDoc(
  base(ctx.firestore(),'p0bRoomProjects',id),{ownerUid:uid,investorId:iid,projectId:id,currentRevisionId,generation,roomDeleted:false}));
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  for(const [collection,id,value]of [['syncConfig','owner',{ownerUid:uid,activationId:'p0b-demo',schemaVersion:1}],['syncAccess',uid,{activationId:'p0b-demo',schemaVersion:1}],['appAccess',uid,{schemaVersion:1}],['authorizedUsers',uid,{appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1}]])
   await f.setDoc(f.doc(db,collection,id),value);
 });
 function setup(deviceId,candidate=true){
  const db=env.authenticatedContext(uid,claims).firestore(),native=db._delegate||db;
  const connection={db:native,firestore:f,assertAccess(){},session:{identity:()=>({uid,epoch:1})},auth:{
    app:native.app,emulatorConfig:{host:'127.0.0.1',port:19099,protocol:'http'},currentUser:{uid,providerData:[{providerId:'google.com'}]}}};
  return {db,connection,protocol:createP0BProtocol(p0bConnection(connection),deviceId,()=>{},{quoteReservationCandidate:candidate})};
 }
 const {db,protocol:computer,connection:reader}=setup('computer'),{db:phoneDb,protocol:phone,connection:writer}=setup('phone'),
  {protocol:oldWriter}=setup('phone',false);
 await computer.createInvestor(iid,{id:iid,name:'Synthetic'});
 const oldEditor=await computer.acquire({iid,pid,expectedHead:'',deviceLabel:'Computer'});
 await computer.acquire({iid,pid:peer,expectedHead:'',deviceLabel:'Computer'});
 await seedHead(pid,rid,1);await seedHead(peer,rid,1);
 const originalPeer=await computer.projectStatus(iid,peer);
 const before=await computer.projectStatus(iid,pid);
 const plan=(mode,status,pinRevision=null)=>({version:1,key:'quote-reservation:'+pid,operationId:crypto.randomUUID(),token:crypto.randomUUID(),
  ownerUid:uid,investorId:iid,projectId:pid,deviceId:'phone',deviceLabel:'Phone',mode,expected:status,pinRevision});
 const declinePlan=plan('request',before),firstPending=await phone.reservations.request(declinePlan);
 await assert.rejects(phone.reservations.decide(firstPending,'grant',rid),{code:'LF_QUOTE_RESERVATION_UNCONFIRMED'});
 assert.equal((await computer.reservations.decide(firstPending,'decline')).state,'declined');
 assert.deepEqual(await phone.projectStatus(iid,pid),before);
 const handover=plan('request',before),pending=await phone.reservations.request(handover);
 await seedHead(pid,savedRid,2);
 await assert.rejects(computer.reservations.decide(pending,'grant',rid),{code:'LF_QUOTE_RESERVATION_UNCONFIRMED'});
 const granted=await computer.reservations.decide(pending,'grant',savedRid);
 assert.deepEqual(await computer.reservations.decide(pending,'grant',savedRid),granted);
 const observed=await phone.reservations.inspect(iid,pid),proof=verifyQuoteReservation(handover,observed.status,observed.marker,granted);
 const pins=[{projectId:pid,head:{ownerUid:uid,investorId:iid,projectId:pid,currentRevisionId:savedRid}}];
 const verifyPublication=(sources=pins)=>f.runTransaction(phoneDb,tx=>phone.reservations.assertPublication(tx,
  {investorId:iid,pins:sources,proofs:[{intent:handover,receipt:{...proof,request:granted}}]}),{maxAttempts:1});
 await verifyPublication();
 await assert.rejects(verifyPublication([{...pins[0],head:{...pins[0].head,currentRevisionId:rid}}]),{code:'LF_QUOTE_RESERVATION_UNCONFIRMED'});
 const {createQuoteChannel}=await import('../../sync/local-first-quote-channel.mjs');
 const project={id:pid,investorId:iid},sealed='e'.repeat(64),sourcePin={
  projectId:pid,head:{...pins[0].head,documentSha256:sealed},recordHash:await digest(project),documentHash:sealed};
 const quote=await createQuoteChannel({writer,reader,ownerUid:uid,investorId:iid,reservationAuthority:phone.reservations,
  sourceChannel:()=>({async readPinned(head){
   assert.deepEqual(head,sourcePin.head);
   return {head,value:{document:{payload:{project},integrity:{documentSha256:sealed}}}};
  }}),normalizeProject:value=>value});
 const offer=id=>({id,investor:{id:iid},project,lines:{},totals:{grand:117.125},calculationRegister:{},
  scope:{selectedRooms:[pid],sourceProjects:[{projectId:pid,roomId:pid,investorId:iid,revision:sourcePin.head,
   recordHash:sourcePin.recordHash,documentHash:sourcePin.documentHash}]}});
 const ledger=ids=>({kind:'p0b-room-quotes',investorId:iid,offers:ids.map(offer),pins:Object.fromEntries(ids.map(id=>[id,[sourcePin]]))});
 const reservations=[{intent:handover,receipt:{...proof,request:granted}}];
 await assert.rejects(quote.prepare(ledger(['first']),null),{code:'LF_QUOTE_RESERVATION_UNCONFIRMED'});
 const first=await quote.prepare(ledger(['first']),null,null,reservations);
 await first.publish();assert.deepEqual((await quote.read()).head,first.expected);
 const later=await quote.prepare(ledger(['first','later']),first.expected,null,reservations);
 const markerRef=base(db,'p0bRoomEditors',pid,'quoteReservation','current');
 await assertFails(f.updateDoc(markerRef,{revision:rid}));
 await assertFails(f.deleteDoc(markerRef));
 const outsider=env.authenticatedContext('outside',claims).firestore();
 await assertFails(f.getDoc(base(outsider,'p0bRoomEditors',pid,'quoteReservation','current')));
 await assertFails(oldWriter.release({iid,pid,expectedHead:savedRid,expectedEditor:proof.status.editor}));
 const draftRevision={ownerUid:uid,investorId:iid,projectId:pid,revisionId:'c'.repeat(32),formatVersion:1,
  generationCandidate:3,baseGeneration:2,baseRevisionId:savedRid,baseFileSha256:'d'.repeat(64),
  baseDocumentSha256:'e'.repeat(64),basePayloadSha256:'f'.repeat(64),byteLength:64,chunkCount:1,
  chunkSha256:['d'.repeat(64)],fileSha256:'d'.repeat(64),documentSha256:'e'.repeat(64),payloadSha256:'f'.repeat(64),createdAt:f.serverTimestamp()};
 const revisionRef=base(db,'p0bRoomProjects',pid,'revisions',draftRevision.revisionId);
 await assertFails(f.setDoc(revisionRef,draftRevision));
 const released=await phone.reservations.release(proof);
 await assert.rejects(verifyPublication(),{code:'LF_QUOTE_RESERVATION_INVALID'});
 await assert.rejects(later.publish(),{code:'LF_QUOTE_RESERVATION_INVALID'});
 assert.deepEqual(await quote.read(),{head:first.expected,value:ledger(['first'])});
 const lateAck=await quote.resume(ledger(['first']),null,first.expected,reservations);
 await lateAck.publish();assert.deepEqual((await quote.read()).head,first.expected);
 assert.deepEqual(await phone.reservations.release(proof),released,'A repeated release only reads the existing receipt');
 const free=plan('free',released.status);
 const exclusive=await phone.reservations.reserve(free);
 assert.deepEqual(await phone.reservations.reserve(free),exclusive);
 await phone.reservations.release(exclusive);
 const editor=await computer.acquire({iid,pid,expectedHead:savedRid,deviceLabel:'Computer'});
 assert.notEqual(editor.epoch,oldEditor.epoch);
 await f.setDoc(revisionRef,draftRevision);
 await computer.pin.save({newPin:'1234',confirmation:'1234',expectedRevision:0});
 const pinPlan=plan('pin',await computer.projectStatus(iid,pid),1);
 await assert.rejects(phone.reservations.reserve(pinPlan,'2345'),{code:'LF_P0B_PIN_INCORRECT'});
 assert.equal((await phone.reservations.inspect(iid,pid)).marker.active,false);
 const taken=await phone.reservations.reserve(pinPlan,'1234');await phone.reservations.release(taken);
 assert.deepEqual(await computer.projectStatus(iid,peer),originalPeer);
});

test('P0-B room quote Rules: late committed expected head reconciles without another revision',async t=>{
 const {createQuoteChannel}=await import('../../sync/local-first-quote-channel.mjs');
 const uid='quote-late-commit-owner',claims={email_verified:true,firebase:{sign_in_provider:'google.com'}};
 const env=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,rules:p0bApplicationRules({normal:true})}});t.after(()=>env.cleanup());
 await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();
  for(const [collection,id,value]of [['syncConfig','owner',{ownerUid:uid,activationId:'p0b-demo',schemaVersion:1}],['syncAccess',uid,{activationId:'p0b-demo',schemaVersion:1}],['appAccess',uid,{schemaVersion:1}],['authorizedUsers',uid,{appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1}]])await f.setDoc(f.doc(db,collection,id),value);
 });
 function connection(){const db=env.authenticatedContext(uid,claims).firestore(),native=db._delegate||db;
  return {db:native,firestore:f,assertAccess(){},session:{identity:()=>({uid,epoch:1})},auth:{app:native.app,emulatorConfig:{host:'127.0.0.1',port:19099,protocol:'http'},currentUser:{uid,providerData:[{providerId:'google.com'}]}}};
 }
 const writer=connection(),reader=connection();assert.notEqual(writer.db.app,reader.db.app);
 const protocol=createP0BProtocol(p0bConnection(writer),'late-device');await protocol.createInvestor('late',{id:'late',name:'Synthetic late commit'});
 const channel=await createQuoteChannel({writer,reader,ownerUid:uid,investorId:'late',sourceChannel(){throw Error('No sources exist in an empty investor quote ledger');}});
 const value={kind:'p0b-room-quotes',investorId:'late',offers:[],pins:{}};
 const original=await channel.prepare(value,null);await original.publish();
 const committed=await channel.read();assert.deepEqual(committed.head,original.expected);
 // The original RPC completed after the previous uncertain probe read the old
 // head. A resumed operation must recognize this exact expected proof as ACK.
 const resumed=await channel.resume(value,null,original.expected);await resumed.publish();
 assert.deepEqual(await channel.read(),committed);
 await env.withSecurityRulesDisabled(async ctx=>assert.equal((await f.getDocs(f.collection(ctx.firestore(),'users',uid,'p0bRoomQuotes','late','revisions'))).size,1));
 await assert.rejects(channel.resume(value,null,{...original.expected,revisionId:'f'.repeat(32)}),{code:'LF_QUOTE_CAS_CONFLICT'});
});

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

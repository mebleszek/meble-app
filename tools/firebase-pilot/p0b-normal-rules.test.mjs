import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as f from 'firebase/firestore';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {createP0BProtocol,createP0BDeletionIntent} from './p0b-protocol.mjs';
import {p0bConnection} from '../../sync/application-p0b-domain.mjs';
const {p0bApplicationRules}=createRequire(import.meta.url)('./p0b-application-rules.js');
test('P0-B normal registry Rules: contact ACK ignores an overlapping earlier absent snapshot',async t=>{
 const uid='p0b-contact-ack-owner',claims={email_verified:true,firebase:{sign_in_provider:'google.com'}};
 const env=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,rules:p0bApplicationRules({normal:true})}});
 t.after(()=>env.cleanup());
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore(),batch=f.writeBatch(db);
  for(const [collection,id,value]of [['syncConfig','owner',{ownerUid:uid,activationId:'p0b-demo',schemaVersion:1}],['syncAccess',uid,{activationId:'p0b-demo',schemaVersion:1}],['appAccess',uid,{schemaVersion:1}],['authorizedUsers',uid,{appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1}]])batch.set(f.doc(db,collection,id),value);
  await batch.commit();
 });
 const db=env.authenticatedContext(uid,claims).firestore()._delegate;
 const target=f.doc(db,'users',uid,'p0bRoomInvestors','new-contact');
 // Capture a REAL server response from before publication. Delayed delivery at
 // the SDK boundary models a still-overlapping document listener, not a fake DB.
 const earlier=await f.getDocFromServer(target);
 assert.equal(earlier.exists(),false);assert.equal(earlier.metadata.fromCache,false);
 let overlapping=true,access=true;
 const connection={db,firestore:{...f,getDocFromServer:ref=>overlapping&&ref.path===target.path?Promise.resolve(earlier):f.getDocFromServer(ref)},
  assertAccess(){if(!access)throw Object.assign(Error('LF_AUTH_CHANGED'),{code:'LF_AUTH_CHANGED'});},
  session:{identity:()=>({uid,epoch:1})},auth:{app:db.app,emulatorConfig:{host:'127.0.0.1',port:19099,protocol:'http'},currentUser:{uid,providerData:[{providerId:'google.com'}]}}};
 const protocol=createP0BProtocol(p0bConnection(connection),'ack-device');
 const contact={id:'new-contact',name:'ACK proof',unknown:{exact:17.125}};
 await protocol.createInvestor('new-contact',contact);
 const raw=await f.runTransaction(db,async tx=>(await tx.get(target)).data(),{maxAttempts:1});
 assert.equal(raw.contactRevision,1);assert.deepEqual(JSON.parse(raw.contact),contact,'Real emulator commit is a prerequisite');
 const confirmed=await protocol.investor('new-contact');
 assert.ok(confirmed,'ACK must see the committed contact despite the overlapping absent result');
 assert.deepEqual(confirmed.contact,contact);assert.equal(confirmed.contactRevision,1);
 assert.deepEqual(await f.runTransaction(db,async tx=>(await tx.get(target)).data(),{maxAttempts:1}),raw,'ACK observation must not publish another revision');
 overlapping=false;
 assert.equal(await protocol.investor('missing'),null);
 await assert.rejects(protocol.updateContact('new-contact',0,{...contact,name:'stale'}),{code:'LF_P0B_CONTACT_CONFLICT'});
 await assert.rejects(protocol.createInvestor('new-contact',contact),{code:'LF_P0B_INVESTOR_CONFLICT'});
 await f.disableNetwork(db);
 try{assert.deepEqual(await protocol.presence('new-contact',()=>false),{state:'unconfirmed'},'An offline presence cannot claim a confirmed registry');}finally{await f.enableNetwork(db);}
 access=false;await assert.rejects(protocol.investor('new-contact'),{code:'LF_AUTH_CHANGED'});access=true;
 assert.deepEqual(await f.runTransaction(db,async tx=>(await tx.get(target)).data(),{maxAttempts:1}),raw);
});

test('P0-B normal registry Rules: separate legacy data, independent CAS, 0/1/N deletion and stale writers',async t=>{
 const uid='normal-p0b-rules-owner',claims={email_verified:true,firebase:{sign_in_provider:'google.com'}};
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');
 const env=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,rules:p0bApplicationRules({normal:true})}});
 t.after(()=>env.cleanup());
 const legacy={ownerUid:uid,opaque:{exact:17.125}},global={opaque:{exact:91.125}};
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  for(const [collection,id,value]of [['syncConfig','owner',{ownerUid:uid,activationId:'p0b-demo',schemaVersion:1}],['syncAccess',uid,{activationId:'p0b-demo',schemaVersion:1}],['appAccess',uid,{schemaVersion:1}],['authorizedUsers',uid,{appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1}]])await f.setDoc(f.doc(db,collection,id),value);
  await f.setDoc(f.doc(db,'users',uid,'localFirstProjects','old-project'),legacy);
  await f.setDoc(f.doc(db,'users',uid,'globalData','current'),global);
 });
 const db=env.authenticatedContext(uid,claims).firestore();
 const connection={db:db._delegate||db,firestore:f,assertAccess(){},session:{identity:()=>({uid,epoch:1})},auth:{app:(db._delegate||db).app,emulatorConfig:{host:'127.0.0.1',port:19099,protocol:'http'},currentUser:{uid,providerData:[{providerId:'google.com'}]}}};
 const pc=createP0BProtocol(p0bConnection(connection),'computer'),phone=createP0BProtocol(p0bConnection(connection),'phone');
 for(const iid of ['zero','one','many','protected'])await pc.createInvestor(iid,{id:iid,name:iid,phone:'111',unknown:{exact:13.125}});
 const protectedRecord=await pc.investor('protected'),a={iid:'many',pid:'kitchen',deviceLabel:'Computer',expectedHead:''},b={iid:'many',pid:'wardrobe',deviceLabel:'Phone',expectedHead:''};
 const outcomes=await Promise.allSettled([pc.acquire(a),phone.acquire(b)]);
 const acquired=outcomes.filter(row=>row.status==='fulfilled');assert.ok(acquired.length>=1,'Concurrent CAS must commit at least one complete pair');
 const registry=await pc.investor('many');
 for(const [i,pid]of ['kitchen','wardrobe'].entries()){
  const result=outcomes[i],editor=(await f.getDoc(f.doc(db,'users',uid,'p0bRoomEditors',pid))).data();
  if(result.status==='fulfilled'){assert.equal(registry.projects[pid],true);assert.deepEqual(editor,result.value);}
  else{assert.equal(result.reason.code,'permission-denied');assert.equal(registry.projects[pid],undefined);assert.equal(editor,undefined);}
 }
 // A fresh explicit acquisition after verifying the refusal is a new operation,
 // not a retry loop or permission bypass. Both editors then remain active.
 const kitchen=outcomes[0].status==='fulfilled'?outcomes[0].value:await pc.acquire(a);
 const wardrobe=outcomes[1].status==='fulfilled'?outcomes[1].value:await phone.acquire(b);
 assert.deepEqual((await pc.investor('many')).projects,{kitchen:true,wardrobe:true});
 t.diagnostic('Concurrent registry CAS: complete pairs only; both independent project leases active after explicit verified acquisition');
 await assert.rejects(phone.acquire(a),{code:'LF_P0B_EDITOR_CONFLICT'});
 await pc.updateContact('many',1,{id:'many',name:'changed',phone:'222',unknown:{exact:13.125}});
 await assert.rejects(phone.updateContact('many',1,{id:'many',name:'stale'}),{code:'LF_P0B_CONTACT_CONFLICT'});
 const held=await pc.investor('many');assert.throws(()=>createP0BDeletionIntent([held],'busy'),{code:'LF_P0B_EDITOR_CONFLICT'});
 const sha='b'.repeat(64),rid='c'.repeat(32),gid='d'.repeat(32),head=f.doc(db,'users',uid,'p0bRoomProjects',a.pid);
 await env.withSecurityRulesDisabled(c=>f.setDoc(f.doc(c.firestore(),'users',uid,'globalRevisions',gid),{revisionId:gid,directoryHash:sha}));
 const content={ownerUid:uid,investorId:a.iid,projectId:a.pid,formatVersion:1,chunkCount:7,byteLength:6*131072+1,fileSha256:sha,documentSha256:sha,payloadSha256:sha};
 const revision=f.doc(head,'revisions',rid),stage=f.writeBatch(db);
 stage.set(revision,{...content,revisionId:rid,generationCandidate:1,baseGeneration:0,baseRevisionId:'',baseFileSha256:'',baseDocumentSha256:'',basePayloadSha256:'',chunkSha256:Array(7).fill(sha),createdAt:f.serverTimestamp()});
 for(let index=0;index<7;index++){const byteLength=index===6?1:131072;stage.set(f.doc(revision,'chunks',String(index)),{index,byteLength,bytes:f.Bytes.fromUint8Array(new Uint8Array(byteLength)),sha256:sha});}
 await stage.commit();
 await f.setDoc(head,{...content,generation:1,currentRevisionId:rid,editorEpoch:kitchen.epoch,deviceId:kitchen.deviceId,globalRevisionId:gid,globalDirectoryHash:sha,roomDeleted:false,updatedAt:f.serverTimestamp()});
 assert.equal((await f.getDoc(head)).data().currentRevisionId,rid);t.diagnostic('Normal room Rules read budget accepts a seven-chunk stage and publication with the terminal-scope guard');
 await pc.release({...a,expectedHead:rid,expectedEditor:kitchen});await phone.release({...b,expectedEditor:wardrobe});t.diagnostic('Different project editors released');
 const one={iid:'one',pid:'only-project',deviceLabel:'Computer',expectedHead:''},single=await pc.acquire(one);
 const terminalRevision='e'.repeat(32),resurrection='f'.repeat(32),singleHead=f.doc(db,'users',uid,'p0bRoomProjects',one.pid);
 const singleContent={...content,investorId:one.iid,projectId:one.pid,chunkCount:1,byteLength:1};
 // Stage a valid successor BEFORE the terminal publication. A later refusal
 // must come from the terminal fence, not from an absent/invalid revision.
 const singleStage=f.writeBatch(db);
 for(const [revisionId,generation,base]of [[terminalRevision,1,''],[resurrection,2,terminalRevision]]){
  const revisionRef=f.doc(singleHead,'revisions',revisionId);
  singleStage.set(revisionRef,{...singleContent,revisionId,generationCandidate:generation,baseGeneration:generation-1,baseRevisionId:base,
   baseFileSha256:base?sha:'',baseDocumentSha256:base?sha:'',basePayloadSha256:base?sha:'',chunkSha256:[sha],createdAt:f.serverTimestamp()});
  singleStage.set(f.doc(revisionRef,'chunks','0'),{index:0,byteLength:1,bytes:f.Bytes.fromUint8Array(new Uint8Array(1)),sha256:sha});
 }
 await singleStage.commit();
 const singleMetadata={editorEpoch:single.epoch,deviceId:single.deviceId,globalRevisionId:gid,globalDirectoryHash:sha};
 await f.setDoc(singleHead,{...singleContent,...singleMetadata,generation:1,currentRevisionId:terminalRevision,roomDeleted:true,updatedAt:f.serverTimestamp()});
 await assertFails(f.setDoc(singleHead,{...singleContent,...singleMetadata,generation:2,currentRevisionId:resurrection,roomDeleted:false,updatedAt:f.serverTimestamp()}));
 await assertFails(f.updateDoc(f.doc(db,'users',uid,'p0bRoomEditors',one.pid),{deviceId:'phone',epoch:single.epoch+1,headRevision:terminalRevision}));
 await pc.release({...one,expectedHead:terminalRevision,expectedEditor:single});
 await assert.rejects(phone.acquire({...one,expectedHead:terminalRevision}),{code:'LF_ROOM_PROJECT_REMOVED'});
 const closed=(await f.getDoc(f.doc(db,'users',uid,'p0bRoomEditors',one.pid))).data();
 await assertFails(f.runTransaction(db,async tx=>{
  const registryRef=f.doc(db,'users',uid,'p0bRoomInvestors',one.iid),old=(await tx.get(registryRef)).data();
  tx.set(registryRef,{...old,generation:old.generation+1,lastProject:one.pid,projects:{...old.projects,[one.pid]:true}});
  tx.set(f.doc(db,'users',uid,'p0bRoomEditors',one.pid),{...closed,active:true,deviceId:'phone',epoch:closed.epoch+1});
 },{maxAttempts:1}));
 assert.equal((await f.getDoc(singleHead)).data().roomDeleted,true);
 assert.equal((await f.getDoc(f.doc(db,'users',uid,'p0bRoomInvestors',one.iid))).data().projects[one.pid],false,'Refused paired acquisition must leave the whole registry unchanged');
 t.diagnostic('Terminal room rejects takeover, reacquisition and resurrection, permits the confirmed editor release and retains history');
 const ids=['zero','one','many'],records=await Promise.all(ids.map(pc.investor)),intent=createP0BDeletionIntent(records,'group-delete');
 await phone.openInvestor('one','busy-visit','Phone');
 await assert.rejects(pc.publishDeletion(intent),{code:'LF_P0B_DELETE_CONFLICT'});
 assert.ok((await Promise.all(ids.map(pc.investor))).every(r=>!r.deletionId&&!r.bulkId));
 await phone.closeInvestor('one','busy-visit');
 const confirmed=createP0BDeletionIntent(await Promise.all(ids.map(pc.investor)),'group-confirmed');
 t.diagnostic('Busy group refused without partial reservation');
 await pc.publishDeletion(confirmed);assert.deepEqual((await phone.confirmDeletion(confirmed)).investorIds,ids.sort());
 for(const iid of ids){assert.equal((await pc.investor(iid)).deletionId,'group-confirmed');await assert.rejects(phone.acquire({iid,pid:'resurrection-'+iid,expectedHead:''}),{code:'LF_P0B_DELETE_CONFLICT'});}
 assert.deepEqual(await pc.investor('protected'),protectedRecord);
 for(const collection of ['localFirstEditors','localFirstProjects','localFirstInvestors'])await assertFails(f.setDoc(f.doc(db,'users',uid,collection,'old-writer'),legacy));
 await assertFails(f.updateDoc(f.doc(db,'users',uid,'p0bRoomEditors','kitchen'),{active:true,deviceId:'computer',epoch:kitchen.epoch}));
 await env.withSecurityRulesDisabled(async c=>{
  assert.deepEqual((await f.getDoc(f.doc(c.firestore(),'users',uid,'localFirstProjects','old-project'))).data(),legacy);
  assert.deepEqual((await f.getDoc(f.doc(c.firestore(),'users',uid,'globalData','current'))).data(),global);
 });
});

#!/usr/bin/env node
'use strict';
// Offline contract checks for normal preflight. Real SDK + Rules are tested
// separately with `cd tools/firebase-pilot && npm test` (both emulators mandatory).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture}=require('./project-selective-export-smoke');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const scope={ownerUid:'synthetic-owner',investorId:'inv-A',projectId:'A'},revision='a'.repeat(32);
function runtime(){
 const r=fixture();r.s.TextDecoder=TextDecoder;for(const name of ['cloud-pilot-contract','firebase-pilot-transport','project-cloud-pilot'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/app/cloud',name+'.js'),'utf8'),r.s);
 return r;
}
const code=expected=>e=>e.code===expected;
test('Registration is inert; live transport refuses before importing SDK or touching storage',async()=>{
 const r=runtime(),before=r.rows();let imports=0;
 await assert.rejects(r.FC.firebasePilotTransport.create({target:'live',projectId:'mebleszek-meble-app',get sdk(){imports++;throw Error('must not load');}}),code('CLOUD_LIVE_TRANSPORT_DISABLED'));
 assert.equal(imports,0);assert.deepEqual(r.rows(),before);assert.deepEqual(r.storage.calls,[]);assert.equal(r.FC.session.active,false);
});
test('Loopback/demo restrictions reject nonlocal emulator routes and invalid ports',async()=>{
 const r=runtime();for(const opts of [{projectId:'real-project',host:'127.0.0.1',port:18080},{projectId:'demo-test',host:'example.com',port:18080},{projectId:'demo-test',host:'localhost',port:0}]){
  await assert.rejects(r.FC.firebasePilotTransport.create({target:'emulator',projectId:opts.projectId,emulator:{host:opts.host,authPort:19099,firestorePort:opts.port}}),code('CLOUD_LIVE_TRANSPORT_DISABLED'));
 }
});
test('Exact native export, hashes, bytes and verified immutable chunks preserve all project PCV',async()=>{
 const r=runtime();assert.equal(r.FC.projectPcvOverrides.setEdges({projectId:'A',roomId:'kuchnia',cabinetId:'one',partRoleId:'body.side.left'},{w1:true,w2:true}).ok,true);assert.equal(r.FC.session.commit(),true);
 r.storage.calls=[];const before=r.rows(),ram=JSON.stringify(r.s.projectData),out=await r.build(),c=r.FC.cloudPilotContract,p=await c.pack(out,scope,null,revision);
 assert.equal(p.revision.byteLength,out.utf8Bytes);assert.equal(p.revision.payloadSha256,out.document.integrity.payloadSha256);
 const header={...p.revision,createdAt:{toMillis:()=>1}},chunks=p.chunks.map(x=>({...x,bytes:{toUint8Array:()=>x.bytes}}));await c.verifyStored(p,header,chunks);
 assert.equal(new TextDecoder().decode(p.chunks[0].bytes),c.canonical(out.document));assert.deepEqual(r.rows(),before);assert.equal(JSON.stringify(r.s.projectData),ram);assert.deepEqual(r.storage.calls,[]);
});
test('Tampered payload/checksum, unknown business fields and owner substitution fail closed',async()=>{
 const r=runtime(),c=r.FC.cloudPilotContract;
 for(const change of [d=>d.payload.project.title+='changed',d=>d.payload.project.secret='forbidden',d=>d.payload.project.id='B']){
  const out=await r.build();change(out.document);await assert.rejects(c.pack(out,scope,null,revision),e=>/CLOUD_(INTEGRITY|EXPORT)_INVALID/.test(e.code));
 }
 const out=await r.build();out.utf8Bytes--;await assert.rejects(c.pack(out,scope,null,revision),code('CLOUD_SIZE_INVALID'));
});
test('Read-back detects corruption, missing chunks and inconsistent header',async()=>{
 const r=runtime(),c=r.FC.cloudPilotContract,p=await c.pack(await r.build(),scope,null,revision),header={...p.revision,createdAt:{toMillis:()=>1}};
 await assert.rejects(c.verifyStored(p,header,[]),code('CLOUD_REVISION_INVALID'));
 const x=p.chunks[0],bytes=x.bytes.slice();bytes[0]^=1;
 await assert.rejects(c.verifyStored(p,header,[{...x,bytes:{toUint8Array:()=>bytes}}]),code('CLOUD_INTEGRITY_INVALID'));
 await assert.rejects(c.verifyStored(p,{...header,investorId:'other'},[]),code('CLOUD_REVISION_INVALID'));
});
test('Head proof binds UID, investor, physical project, generation and all hashes',async()=>{
 const r=runtime(),c=r.FC.cloudPilotContract,p=await c.pack(await r.build(),scope,null,revision),head=c.candidateHead(p);c.validHead(head,scope);
 for(const key of ['ownerUid','investorId','projectId','currentRevisionId','fileSha256','payloadSha256','documentSha256'])assert.throws(()=>c.validHead({...head,[key]:'invalid'},scope),code('CLOUD_BASE_INVALID'));
 assert.throws(()=>c.validHead({...head,generation:0},scope),code('CLOUD_BASE_INVALID'));
 assert.throws(()=>c.headOf({...head,formatVersion:1,chunkCount:1,byteLength:10,updatedAt:1},scope),code('CLOUD_MANIFEST_INVALID'));
});
test('Native active session, stale RAM and failed storage stop prepare before transport writes',async()=>{
 for(const mode of ['session','ram','storage']){
  const r=runtime();if(mode==='session')assert.equal(r.FC.session.begin(),true);if(mode==='ram')r.s.projectData.kuchnia.cabinets[0].width=100;if(mode==='storage')r.storage.fail.add('get:fc_projects_v1');
  let writes=0;const transport={ready:async()=>{},identity:()=>({uid:scope.ownerUid,epoch:1}),readHead:async()=>null,stage:async()=>writes++,publish:async()=>writes++};
  const out=await r.FC.projectCloudPilot.create(transport).prepare({...scope,expectedHead:null});assert.equal(out.ok,false);assert.match(out.code,/^EXPORT_/);assert.equal(writes,0);
 }
});
test('Unsafe caller cannot supply their own document/attempt or omit explicit optimistic base',async()=>{
 const r=runtime(),pilot=r.FC.projectCloudPilot.create({ready:async()=>{},identity:()=>({uid:scope.ownerUid,epoch:1})});
 assert.equal((await pilot.prepare({...scope})).code,'CLOUD_SCOPE_INVALID');assert.equal((await pilot.publish({revisionId:revision,document:{}})).code,'CLOUD_ATTEMPT_UNKNOWN');
});
test('Prepared LIVE adapter is absent from every production manifest and cannot activate by a target flag',async()=>{
 const r=runtime(),before=r.rows();
 for(const file of ['index.html','dev_tests.html','tools/index-load-groups.js','js/app/cloud/main-business-loader.js','js/main-login.js'])assert.equal(fs.readFileSync(path.join(__dirname,'..',file),'utf8').includes('firebase-pilot-live-transport'),false,file);
 new Function('window',fs.readFileSync(path.join(__dirname,'../js/app/cloud/firebase-pilot-live-transport.js'),'utf8'))(r.s);
 await assert.rejects(r.FC.firebasePilotLiveTransport.create({}),code('CLOUD_ACCESS_REQUIRED'));
 // Configuration getters are not invoked without an explicit session/access capability.
 assert.deepEqual(r.rows(),before);assert.deepEqual(r.storage.calls,[]);
 await assert.rejects(r.FC.firebasePilotTransport.create({target:'live',enabled:true}),code('CLOUD_LIVE_TRANSPORT_DISABLED'));
});
test('Independent unpack verifies exact bytes, schema, all hashes and never repairs corrupted data',async()=>{
 const r=runtime(),c=r.FC.cloudPilotContract,p=await c.pack(await r.build(),scope,null,revision);
 const header={...p.revision,createdAt:{toMillis:()=>1}},chunks=p.chunks.map(x=>({...x,bytes:{toUint8Array:()=>x.bytes}}));
 const manifest={...c.candidateHead(p),formatVersion:1,chunkCount:p.revision.chunkCount,byteLength:p.revision.byteLength,updatedAt:{toMillis:()=>1}};
 const read=await c.unpack(manifest,header,chunks,scope);assert.equal(c.canonical(read.document),(new TextDecoder()).decode(p.chunks[0].bytes));
 await assert.rejects(c.unpack(manifest,header,[],scope),code('CLOUD_REVISION_INVALID'));
 await assert.rejects(c.unpack(manifest,header,[{...chunks[0],index:1}],scope),code('CLOUD_CHUNK_INVALID'));
 await assert.rejects(c.unpack({...manifest,payloadSha256:'f'.repeat(64)},header,chunks,scope),code('CLOUD_REVISION_INVALID'));
 const doc=JSON.parse(c.canonical(read.document));doc.payload.project.secret='synthetic forbidden field';
 doc.integrity.payloadSha256=await c.sha(new TextEncoder().encode(c.canonical(doc.payload)));
 const noIntegrity={...doc};delete noIntegrity.integrity;doc.integrity.documentSha256=await c.sha(new TextEncoder().encode(c.canonical(noIntegrity)));
 const bytes=new TextEncoder().encode(c.canonical(doc)),hash=await c.sha(bytes);
 const badHeader={...header,byteLength:bytes.length,fileSha256:hash,chunkSha256:[hash],payloadSha256:doc.integrity.payloadSha256,documentSha256:doc.integrity.documentSha256};
 const badManifest={...manifest,byteLength:bytes.length,fileSha256:hash,payloadSha256:doc.integrity.payloadSha256,documentSha256:doc.integrity.documentSha256};
 await assert.rejects(c.unpack(badManifest,badHeader,[{index:0,byteLength:bytes.length,sha256:hash,bytes:{toUint8Array:()=>bytes}}],scope),code('CLOUD_EXPORT_INVALID'));
 assert.deepEqual(r.storage.calls,[]);assert.deepEqual(r.sessionStorage.calls,[]);
});
async function main(){for(const [name,fn]of tests){await fn();console.log('PASS '+name);}console.log('Firebase pilot offline contract: '+tests.length+'/'+tests.length+' PASS (SDK/Rules: separate emulator suite)');}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});

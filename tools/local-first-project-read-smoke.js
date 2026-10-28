'use strict';
// Real CLOUD-2B packing and independent transport reader, injected immutable
// snapshots only. This is not an SDK/Rules/IndexedDB/emulator execution claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./project-selective-export-smoke.js');
async function main(){
  const {selectProjectFixture}=await import('./firebase-pilot/cloud-sync-fixture.mjs');
  const runtime=()=>{
    const r=selectProjectFixture(fixture(),'A');
    for(const n of ['cloud-pilot-contract','firebase-pilot-transport'])new Function('window',fs.readFileSync(path.join(__dirname,'../js/app/cloud/'+n+'.js'),'utf8'))(r.s);
    return r;
  };
  const writer=runtime(),reader=runtime(),scope={ownerUid:'synthetic-owner',projectId:'A',investorId:'inv-A'};
  reader.mutate(p=>{p.projectData.kuchnia.cabinets[0].width=999;});
  const beforeWriter=writer.rows(),beforeReader=reader.rows(),built=await writer.build();assert.equal(built.ok,true);
  const c=writer.FC.cloudPilotContract,packed=await c.pack(built,scope,null,'a'.repeat(32)),stamp={toMillis:()=>1};
  const base='users/synthetic-owner/pilotProjects/A',revision=base+'/revisions/'+packed.revision.revisionId;
  const manifest={...c.candidateHead(packed),formatVersion:1,chunkCount:packed.chunks.length,byteLength:packed.revision.byteLength,updatedAt:stamp};
  const rows=new Map([[base,manifest],[revision,{...packed.revision,createdAt:stamp}]]);
  const chunks=packed.chunks.map(part=>({...part,bytes:{toUint8Array:()=>part.bytes.slice()}}));
  chunks.forEach((part,i)=>rows.set(revision+'/chunks/'+i,part));
  let reads=0,writes=0;
  const snapshot=ref=>{reads++;return {metadata:{fromCache:false,hasPendingWrites:false},exists:()=>rows.has(ref.path),data:()=>rows.get(ref.path)};};
  const sdk={doc:(parent,...parts)=>({path:[parent.path,...parts].filter(Boolean).join('/')}),getDocFromServer:async ref=>snapshot(ref),
    runTransaction:async(_db,fn)=>fn({get:async ref=>snapshot(ref),set(){writes++;throw Error('Unexpected write in independent reader');}})};
  const transport=reader.FC.firebasePilotTransport.fromConnection({db:{},firestore:sdk,session:{identity:()=>({uid:scope.ownerUid,epoch:1})}});
  assert.equal(reader.s.TextDecoder,TextDecoder,'The same fixture used by LOCAL-FIRST must expose the real browser decoder');
  // Reproduce the original failure before restoring the actual platform API.
  delete reader.s.TextDecoder;
  await assert.rejects(transport.readProject(scope),e=>e.code==='CLOUD_EXPORT_INVALID');
  reader.s.TextDecoder=TextDecoder;
  const result=await transport.readProject(scope);
  // Native builder runs in its own VM realm; compare all JSON fields in the
  // reader's realm and independently compare the exact canonical bytes below.
  assert.deepEqual(result.document,JSON.parse(JSON.stringify(built.document)));assert.deepEqual(result.head,c.candidateHead(packed));
  assert.equal(result.document.payload.project.projectData.kuchnia.cabinets[0].width,60,'Independent read must not use the reader\'s different local project');
  assert.deepEqual(Array.from(result.bytes),Array.from(new TextEncoder().encode(c.canonical(built.document))));
  console.log('PASS missing decoder reproduces CLOUD_EXPORT_INVALID; fixed fixture independently reconstructs exact native document/bytes');
  const chunkPath=revision+'/chunks/0',first=rows.get(chunkPath);
  rows.delete(chunkPath);await assert.rejects(transport.readProject(scope),e=>e.code==='CLOUD_REVISION_INCOMPLETE');rows.set(chunkPath,first);
  rows.set(chunkPath,{...first,bytes:{toUint8Array:()=>{const b=first.bytes.toUint8Array();b[0]^=1;return b;}}});
  await assert.rejects(transport.readProject(scope),e=>e.code==='CLOUD_INTEGRITY_INVALID');rows.set(chunkPath,first);
  assert.equal(writes,0);assert.ok(reads>0);
  assert.deepEqual(writer.rows(),beforeWriter);assert.deepEqual(reader.rows(),beforeReader);
  await transport.close();
  console.log('PASS missing/corrupt chunk still refused; no WRITE or native RAW changes; no emulator PASS claimed');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};

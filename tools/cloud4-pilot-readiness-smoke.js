#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {webcrypto,createHash}=require('node:crypto');
const {plan}=require('./firebase-pilot/cloud4-admin-plan.js');
const fixture=require('./firebase-pilot/cloud4-synthetic-source.js'),root=path.resolve(__dirname,'..');
function source(){
 const Storage=class extends fixture.MemoryStorage{};
 const local=new Storage(),session=new Storage();
 const s={console,Date:fixture.FixedDate,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,setTimeout,clearTimeout,Storage,localStorage:local,sessionStorage:session,FC:{utils:{clone:v=>JSON.parse(JSON.stringify(v))},infoBox:{open(){throw Error('forbidden');}}}};
 s.window=s;vm.createContext(s);for(const f of fixture.files)vm.runInContext(fs.readFileSync(path.join(root,'js/app',f+'.js'),'utf8'),s);
 return {s,local,session,builder:fixture.create(s.FC,local,session,s)};
}
async function main(){
 const a=source(),b=source(),options={...fixture.scope,purpose:'pilot'},before=JSON.stringify([...a.local.rows]);
 const out=await a.builder.build(options),other=await b.builder.build(options);assert.equal(out.ok,true,JSON.stringify(out));assert.deepEqual(JSON.parse(JSON.stringify(out)),JSON.parse(JSON.stringify(other)));assert.equal(JSON.stringify([...a.local.rows]),before);
 console.log(JSON.stringify({bytes:out.utf8Bytes,payloadSha256:out.document.integrity.payloadSha256,documentSha256:out.document.integrity.documentSha256}));
 assert.equal(out.document.payload.project.projectData.kuchnia.production.partOverrides.one['body.side.left'].edges.w2,true);
 assert.equal(out.document.payload.project.projectData.kuchnia.production.partOverrides.one['body.side.right'].edges.w2,false);
 assert.equal(out.document.payload.project.projectData.kuchnia.production.setGroupOverrides['set-A']['front.A.left'].edges.h1,true);
 const rawInvestor=JSON.parse(a.local.getItem('fc_investors_v1'))[0],rawProject=JSON.parse(a.local.getItem('fc_projects_v1'))[0];
 for(const mutate of [p=>{p.projectData.kuchnia.cabinets[0].details.unknownBusinessField=true;},p=>{p.projectData.kuchnia.cabinets[0].width=-1;},p=>{p.investorId='foreign';}]){
  const copy=JSON.parse(JSON.stringify(rawProject));mutate(copy);assert.equal(a.s.FC.projectExportContract.validate(rawInvestor,copy).ok,false);
 }
 assert.equal((await a.builder.build({...options,projectId:'other'})).ok,false);assert.throws(()=>a.local.setItem('fc_projects_v1','[]'),/READ_ONLY/);
 const inert={FC:{}};
 new Function('window',fs.readFileSync(path.join(root,'js/app/cloud/controlled-project-pilot.js'),'utf8'))(inert);
 assert.equal(out.document.integrity.payloadSha256,inert.FC.controlledProjectPilot.payloadSha256);
 assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,'tools/firebase-pilot/firestore-live-pilot.rules'))).digest('hex'),inert.FC.controlledProjectPilot.rulesSha256);
 for(const file of ['index.html','js/main-login.js','js/boot.js','js/app.js']){
  const text=fs.readFileSync(path.join(root,file),'utf8');
  assert.equal(/controlled-project-pilot|cloud4-source-worker|firestore-live-pilot|firebase-pilot-live-transport/.test(text),false,file+' must not launch pilot');
 }
 const grant={appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1},beforeGrant=JSON.stringify(grant);
 const admin=plan({uid:'synthetic-owner',grant,appAccess:{schemaVersion:1},control:null});
 assert.equal(JSON.stringify(grant),beforeGrant);assert.equal(admin.expectedGrant.globalDataEnabled,true);
 assert.equal(Object.hasOwn(admin.grantPatch,'appEnabled'),false);assert.equal(Object.hasOwn(admin.grantPatch,'globalDataEnabled'),false);
 const stopped={...grant,...admin.grantPatch,...admin.stopGrantPatch};assert.equal(stopped.appEnabled,true);assert.equal(stopped.globalDataEnabled,true);assert.equal(stopped.enabled,false);
 assert.deepEqual(plan({uid:'synthetic-owner',grant:{...grant,...admin.grantPatch},appAccess:{schemaVersion:1},control:admin.control}).control,admin.control);
 for(const bad of [{uid:''},{grant:{...grant,secret:'synthetic'}},{grant:{...grant,pilotProjectId:'foreign'}},{grant:{...grant,appEnabled:false}},{appAccess:{schemaVersion:2}},{appAccess:{schemaVersion:1,extra:true}},{control:{...admin.control,ownerUid:'foreign'}},{control:{...admin.control,extra:true}}]){
  assert.throws(()=>plan({uid:'synthetic-owner',grant,appAccess:{schemaVersion:1},control:null,...bad}),/CLOUD4_ADMIN_STATE_UNEXPECTED/);
 }
 console.log('CLOUD-4 deterministic native source, administrative preconditions, Rules pin and startup isolation: PASS');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={source};

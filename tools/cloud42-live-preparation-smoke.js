'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const p=require('./firebase-pilot/cloud42-package.js');
async function main(){
 const input={uid:'synthetic-cloud42-owner',role:'write',expiresAt:Date.now()+600000,
  grant:{appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1},appAccess:{schemaVersion:1},control:null};
 const packet=p.prepare(input),second=p.prepare(input);
 assert.deepEqual(packet,second);new vm.Script(packet.candidateSource);
 assert.equal(packet.status,'REVIEW_REQUIRED_NOT_ACTIVATED');assert.equal(packet.limits.writeAttempts,1);
 assert.equal(packet.proof.rulesSha256,'eaeb3e67417955bbd67d2881902d3827023502c2948ce0a19dc583c66b5a2e92');
 for(const [stage,name]of [['auth-only','firestore-auth-only.rules'],['minimal','firestore-live-pilot.rules']]){
  const bytes=fs.readFileSync(path.join(__dirname,'firebase-pilot',name));
  assert.equal(p.verifyDeployedRules(stage,bytes).byteLength,bytes.length);
  assert.throws(()=>p.verifyDeployedRules(stage,Buffer.concat([bytes,Buffer.from('\n')])) ,/DEPLOYED_RULES_UNCONFIRMED/);
 }
 for(const patch of [{target:'live'},{role:'sync'},{expiresAt:Date.now()-1},{expiresAt:Date.now()+1000000},{uid:'foreign/uid'}])assert.throws(()=>p.prepare({...input,...patch}));
 assert.throws(()=>p.prepare({...input,grant:{...input.grant,enabled:true}}),/ALREADY_ENABLED/);
 const loc={origin:p.PRODUCTION.origin,pathname:p.PRODUCTION.pathname,search:'',hash:''};
 const ctx={target:'live-auth',app:{options:{...p.PRODUCTION}}};
 assert.equal(p.productionContext(ctx,loc),true);
 for(const bad of [{...loc,origin:'http://localhost'},{...loc,pathname:'/index.html'},{...loc,search:'?live=1'},{...loc,hash:'#live'}])assert.equal(p.productionContext(ctx,bad),false);
 assert.equal(p.productionContext({...ctx,target:'emulator'},loc),false);
 assert.equal(p.productionContext({...ctx,app:{options:{...p.PRODUCTION,projectId:'other'}}},loc),false);
 assert.ok(packet.candidateSource.includes(p.productionContext.toString()));
 let calls=0;const driver={execute:async()=>{calls++;return {ok:true};},close:async()=>{}};
 const guarded=p.wrapOperator(driver,packet.binding);
 assert.equal((await guarded.execute({role:'read',approval:packet.approval})).code,'CLOUD_APPROVAL_REQUIRED');
 assert.equal((await guarded.execute({role:'write',approval:packet.approval})).code,'CLOUD_OPERATION_LIMIT');assert.equal(calls,0);
 const writer=p.wrapOperator(driver,packet.binding);assert.equal((await writer.execute({role:'write',approval:packet.approval})).ok,true);
 assert.equal((await writer.execute({role:'write',approval:packet.approval})).code,'CLOUD_OPERATION_LIMIT');assert.equal(calls,1);
 await writer.close();assert.equal((await writer.execute({role:'read',approval:packet.approval})).code,'CLOUD_CLIENT_CLOSED');
 const action=packet.actions.activate;assert.deepEqual(action.expected['appAccess/'+input.uid],input.appAccess);
 assert.throws(()=>p.assertExpected(action,{...action.expected,['authorizedUsers/'+input.uid]:{...input.grant,appEnabled:false}}),/ADMIN_CONFLICT/);
 assert.equal(packet.actions.stop.writes[0].fields.enabled,false);assert.equal(packet.actions.stop.writes[1].fields.enabled,false);
 assert.equal(packet.actions.stage.writes[0].fields.globalDataEnabled,undefined);
 const read={ok:true,sourceMatches:true,utf8Bytes:6797,documentSha256:packet.proof.documentSha256,revisionId:'a'.repeat(32)};
 assert.equal(p.readDecision({published:'unconfirmed'},read).status,'VERIFIED_SYNTHETIC_STATE');
 assert.equal(p.readDecision({revisionId:'b'.repeat(32)},read).status,'STOP_REVIEW_REQUIRED');
 assert.equal(p.readDecision({}, {...read,utf8Bytes:1}).retryWrite,false);
 const {openCloud42Rehearsal}=await import('./firebase-pilot/cloud42-rehearsal.mjs');
 const untouched=new Proxy({},{get(){throw Error('Page touched before refusing production');}});
 for(const url of ['https://mebleszek.github.io/meble-app/index.html','http://127.0.0.1/index.html?live=1'])await assert.rejects(openCloud42Rehearsal(untouched,url),/CLOUD_LIVE_TRANSPORT_DISABLED/);
 const template=fs.readFileSync(path.join(__dirname,'firebase-pilot/cloud42-reviewed-loader.mjs.txt'),'utf8');
 const reviewed=await import('data:text/javascript;base64,'+Buffer.from(template).toString('base64'));
 await assert.rejects(reviewed.openReviewedCandidate(untouched,{packet}),/SEPARATE_OWNER_APPROVAL_REQUIRED/);
 for(const name of ['index.html','tools/index-load-groups.js'])assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),/cloud42-(?:package|rehearsal)/);
 console.log('CLOUD-4.2 offline artifact, exact target/UID/role, grant CAS, no retry and LIVE refusal: PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

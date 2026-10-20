// Private API source is intentionally external to Git. Never substitute a template.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {fileURLToPath} from 'node:url';
import b from './cloud43a-baseline.js';
import p from './cloud42-package.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const sourcePath=process.env.CLOUD43A_PRIVATE_SOURCE;
if(!sourcePath||path.resolve(sourcePath).startsWith(root))throw Error('CLOUD43A_PRIVATE_EXTERNAL_SOURCE_REQUIRED');
const bytes=fs.readFileSync(sourcePath),source=bytes.toString('utf8');
b.verifyArtifact('production-auth-only-baseline',bytes);
const now=Date.parse('2026-10-20T12:00:00.000Z');
// Synthetic observation timestamps, NOT a claim of a new production read.
function observation(){const meta=b.baseline();return {projectId:meta.projectId,database:meta.database,
 release:structuredClone(meta.release),ruleset:{...meta.ruleset,source:{files:[{name:'firestore.rules',content:source}]}},observedAt:new Date(now-1000).toISOString()};}
test('Exact private source decoded from owner JSON; identity match never opens a gate',()=>{
 assert.equal(bytes.length,635);assert.equal(bytes[0],10);assert.notEqual(bytes.at(-1),10);
 const proof=p.verifyDeployedRules('production-auth-only-baseline',bytes,observation());
 assert.equal(proof.sha256,'9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91');
 assert.equal(proof.mutationAllowed,false);assert.equal(proof.baselineApprovedForGate2,false);
 assert.equal(proof.gate1,'STOP_OWNER_REVIEW_REQUIRED');assert.equal(proof.deploymentConfirmed,false);
});
const changes=[
 ['wrong project',o=>o.projectId='other'],['wrong database',o=>o.database='other'],
 ['wrong release',o=>o.release.name+='-other'],['wrong ruleset link',o=>o.release.rulesetName+='-other'],
 ['wrong ruleset identity',o=>o.ruleset.name+='-other'],['changed release updateTime',o=>o.release.updateTime='2026-10-20T00:00:00Z'],
 ['changed release createTime',o=>o.release.createTime='2026-10-20T00:00:00Z'],['changed ruleset createTime',o=>o.ruleset.createTime='2026-10-20T00:00:00Z'],
 ['missing source',o=>delete o.ruleset.source],['zero files',o=>o.ruleset.source.files=[]],
 ['two files',o=>o.ruleset.source.files.push({...o.ruleset.source.files[0]})],
 ['wrong filename',o=>o.ruleset.source.files[0].name='other.rules'],
 ['missing content',o=>delete o.ruleset.source.files[0].content],
 ['truncated source',o=>o.ruleset.source.files[0].content=source.slice(0,-40)],
 ['changed SHA same byte count',o=>o.ruleset.source.files[0].content=source.replace("'2'","'1'")],
 ['missing initial LF',o=>o.ruleset.source.files[0].content=source.slice(1)],
 ['extra terminal LF',o=>o.ruleset.source.files[0].content+='\n'],
 ['comment-only change',o=>o.ruleset.source.files[0].content+='\n// no policy change'],
 ['whitespace same length',o=>o.ruleset.source.files[0].content=source.replace('  match',' \tmatch')]
];
for(const [name,change]of changes)test('Fail closed: '+name,()=>{const o=observation();change(o);assert.throws(()=>b.verifyProductionObservation(o),/CLOUD43A_/);});
test('Missing, modified or self-approved baseline cannot replace the pinned record',()=>{
 for(const meta of [null,{}, {...b.baseline(),baselineApprovedForGate2:true},{...b.baseline(),source:{...b.baseline().source,sha256:'0'.repeat(64)}}]){
  assert.throws(()=>b.verifyProductionObservation(observation(),meta),/BASELINE_CHANGED/);
 }
});
test('Old 755B template remains distinct and cannot be used for exact production rollback',()=>{
 const template=fs.readFileSync(new URL('./firestore-auth-only.rules',import.meta.url));
 assert.equal(b.verifyArtifact('repository-auth-only-template',template).byteLength,755);
 assert.throws(()=>b.productionRollbackPlan(template),/SOURCE_BYTE_LENGTH_MISMATCH/);
 assert.throws(()=>p.verifyDeployedRules('auth-only',template),/EXPLICIT_RULES_ROLE_REQUIRED/);
 assert.throws(()=>p.verifyDeployedRules('production-auth-only-baseline',template,observation()),/SOURCE_BYTE_LENGTH_MISMATCH/);
 assert.throws(()=>p.verifyDeployedRules('production-auth-only-baseline',bytes),/TARGET_MISMATCH/);
});
test('Fresh unchanged observations only pass identity check, never grant mutation or Gate 2',()=>{
 const first=observation(),fresh=observation();fresh.observedAt=new Date(now).toISOString();
 const out=b.assertFreshUnchangedRules(first,fresh,now);assert.equal(out.mutationAllowed,false);assert.equal(out.gate1,'STOP_OWNER_REVIEW_REQUIRED');
 const plan=b.productionRollbackPlan(bytes);assert.equal(plan.sourceBytesVerified,true);assert.equal(plan.executionAllowed,false);assert.equal(plan.isFirebaseDeployConfig,false);
 assert.equal(plan.automaticRetry,false);assert.equal(plan.automaticBaselineUpdate,false);
});
test('Missing, stale, future or reversed read times refuse a future mutation precondition',()=>{
 for(const at of [undefined,'invalid',new Date(now-300001).toISOString(),new Date(now+1).toISOString()]){
  const fresh=observation();fresh.observedAt=at;assert.throws(()=>b.assertFreshUnchangedRules(observation(),fresh,now),/FRESH_READ_REQUIRED/);
 }
 const fresh=observation();fresh.observedAt=new Date(now-2000).toISOString();assert.throws(()=>b.assertFreshUnchangedRules(observation(),fresh,now),/FRESH_READ_REQUIRED/);
});
test('Rules change between check and deployment precondition: STOP, no write callback is invoked',()=>{
 for(const change of [o=>o.release.updateTime='2026-10-20T12:00:00Z',o=>o.release.rulesetName+='-new',o=>o.ruleset.source.files[0].content+='\n']){
  const first=observation(),fresh=observation();change(fresh);let writes=0;
  assert.throws(()=>{b.assertFreshUnchangedRules(first,fresh,now);writes++;},/CLOUD43A_/);assert.equal(writes,0);
 }
});

test('Artifact roles are immutable; a caller cannot replace the production SHA or byte count',()=>{
 assert.throws(()=>{b.ARTIFACTS['production-auth-only-baseline'].sha256='0'.repeat(64);},TypeError);
 assert.throws(()=>{b.ARTIFACTS['production-auth-only-baseline'].utf8Bytes=755;},TypeError);
});

test('Original private JSON string decodes losslessly, never by template reconstruction',()=>{
 assert.deepEqual(b.decodeProductionSourceJson(JSON.stringify(source)),bytes);
 for(const bad of ['{','{}',JSON.stringify(source+'\n')])assert.throws(()=>b.decodeProductionSourceJson(bad),/CLOUD43A_/);
});

test('Even an exact operator decision cannot activate the loader or advance the unapproved baseline',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cloud43a-inert-loader-'));
 try{
  const file=path.join(dir,'reviewed.mjs');fs.copyFileSync(new URL('./cloud42-reviewed-loader.mjs.txt',import.meta.url),file);
  const {openReviewedCandidate}=await import(pathToFileURL(file).href);
  const packet=p.prepare({uid:'cloud43a-synthetic-owner',role:'write',expiresAt:Date.now()+600000,grant:{appEnabled:true,enabled:false},appAccess:{schemaVersion:1},control:null});
  const decision={decisionId:'synthetic-test-only',baseCommit:packet.proof.baseCommit,sourcePinsSha256:packet.proof.sourcePinsSha256,
   packageSha256:packet.proof.packageSha256,loaderSha256:packet.proof.loaderSha256,candidateSha256:packet.proof.candidateSha256,
   rulesSha256:packet.proof.rulesSha256,projectId:p.PRODUCTION.projectId,...packet.binding};
  const page=new Proxy({},{get(){throw Error('Page touched before refusing unapproved baseline');}});
  await assert.rejects(openReviewedCandidate(page,{checkout:root,packet,decision}),/CLOUD43A_BASELINE_REVIEW_REQUIRED/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

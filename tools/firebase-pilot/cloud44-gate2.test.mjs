import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import gate from './cloud44-gate2.js';
import b from './cloud43a-baseline.js';
import p from './cloud42-package.js';
const require = createRequire(import.meta.url);
const now = Date.parse('2026-10-20T12:00:00Z');
const metadata = () => ({projectId:b.baseline().projectId, database:'(default)',
  release:structuredClone(b.baseline().release), ruleset:structuredClone(b.baseline().ruleset), observedAt:new Date(now-1000).toISOString()});
const demo = clock => gate.openDemoOperator({projectId:'demo-meble-app',origin:'http://127.0.0.1:1234',expiresAt:now+1000,now:clock||(()=>now)});
const stop = async o => { await o.stop(async()=>{}); await o.verifyStop(async()=>true); };
test('Historical metadata and newer preparation approval remain distinct and inert',()=>{
  assert.deepEqual(gate.preparationStatus(), {historicalApproval:false,baselineAcceptedForGate2Preparation:true,
    productionExecutionAllowed:false,preparationRecordSha256:'dd6ac10928e9495ba3a45598d94a71cd04eb68ec36f9fe14cc654efc76b09795'});
  assert.equal(b.baseline().release.rulesetName,b.baseline().ruleset.name);
  assert.equal(b.baseline().historicalOnly,true);
});
for (const [name,change] of [
  ['project',o=>o.projectId='foreign'],['database',o=>o.database='foreign'],
  ['release',o=>o.release.name+='x'],['ruleset link',o=>o.release.rulesetName+='x'],
  ['ruleset',o=>o.ruleset.name+='x'],['release create',o=>o.release.createTime+='x'],
  ['release update',o=>o.release.updateTime+='x'],['ruleset create',o=>o.ruleset.createTime+='x']
]) test('Historical metadata refuses changed '+name,()=>{const o=metadata();change(o);const report=gate.reviewProductionGate({projectId:gate.TARGET.projectId,database:'(default)',checked:o,fresh:o},now);assert.ok(report.blockers.some(code=>/MISMATCH|CHANGED/.test(code)));});
test('Missing private bytes and a mere SHA receipt never prove rollback possession',()=>{
  assert.equal(gate.rollbackReadiness().status,'BLOCKED_PRIVATE_SOURCE_REQUIRED');
  assert.equal(gate.rollbackReadiness({sha256:b.ARTIFACTS['production-auth-only-baseline'].sha256}).status,'BLOCKED_PRIVATE_BYTES_REQUIRED');
});
test('Wrong source size, same-size wrong SHA and 755-byte template are refused',()=>{
  for(const bytes of [Buffer.alloc(634),Buffer.alloc(635),fs.readFileSync(new URL('./firestore-auth-only.rules',import.meta.url))]){
    const result=gate.rollbackReadiness(bytes);assert.equal(result.status,'BLOCKED_INVALID_PRIVATE_SOURCE');assert.equal(result.executionAllowed,false);
  }
});
test('Preparation approval and fabricated complete production inputs cannot enable execution',()=>{
  const input={projectId:gate.TARGET.projectId,database:'(default)',checked:metadata(),fresh:metadata(),
    approvals:gate.FUTURE_SCOPES.map(scope=>({decisionId:'synthetic-'+scope,scope,type:'explicit-production-decision',
      projectId:gate.TARGET.projectId,database:'(default)',expiresAt:now+1000,packageSha256:p.inventory().packageSha256,
      rulesSha256:p.inventory().rulesSha256,baselineRecordSha256:b.BASELINE_SHA256})),
    operator:{stopAvailable:true,independentStopVerifierAvailable:true,exclusive:true,atomicCas:true},
    account:{projectId:gate.TARGET.projectId,database:'(default)',plan:'Spark',billingEnabled:false,remainingReads:500,remainingWrites:30,observedAt:now}};
  const report=gate.reviewProductionGate(input,now);
  assert.equal(report.executionAllowed,false);assert.equal(report.rulesAtomicCas,false);
  assert.ok(report.blockers.includes('RULES_ATOMICITY_OR_VERIFIED_EXTERNAL_EXCLUSION_UNAVAILABLE'));
  assert.ok(report.blockers.includes('BLOCKED_PRIVATE_SOURCE_REQUIRED'));
  assert.throws(()=>gate.executeProduction(input),/PRODUCTION_EXECUTION_DISABLED/);
  delete input.approvals;
  assert.ok(gate.reviewProductionGate(input,now).blockers.includes('SEPARATE_PRODUCTION_APPROVALS_REQUIRED'));
});
test('Preparation evidence tampering, including enabling a flag, is rejected',()=>{
  const filename=new URL('./cloud44-gate2.js',import.meta.url);
  const facade={...fs,readFileSync(file,...args){const out=fs.readFileSync(file,...args);
    return String(file).endsWith('cloud43b-preparation-approval.json')?Buffer.from(String(out).replace('"openGate2ForProductionExecution": false','"openGate2ForProductionExecution": true')):out;}};
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:n=>n==='node:fs'?facade:require(n),
    __dirname:new URL('.',import.meta.url).pathname,Buffer,URL});
  assert.throws(()=>module.exports.preparationStatus(),/PREPARATION_EVIDENCE_CHANGED/);
});
test('Concurrent operators are refused; only a verified STOP releases the rehearsal lock',async()=>{
  const o=demo();assert.throws(()=>demo(),/OPERATOR_CONFLICT/);
  await stop(o);const second=demo();await stop(second);
});
test('Expiry during await is uncertain; STOP remains possible after the client window',async()=>{
  let clock=now;const o=demo(()=>clock);
  await o.stage(async()=>{});await o.activate(async()=>{});
  await assert.rejects(o.write({execute:async()=>{clock+=1000;return {ok:true};}},{role:'write'}),/WINDOW_EXPIRED_RESULT_UNCERTAIN/);
  assert.equal(o.inspect().writeUsed,true);assert.equal(o.inspect().state,'STOP_REQUIRED');
  await assert.rejects(o.write({}, {role:'write'}),/WRITE_ATTEMPT_CONSUMED/);await stop(o);
});
test('Uncertain publication consumes write; independent reader remains separate and single-use',async()=>{
  const o=demo();await o.stage(async()=>{});await o.activate(async()=>{});
  await assert.rejects(o.write({}, {role:'read'}),/ROLE_MISMATCH/);
  let calls=0;const driver={execute:async()=>{calls++;return {ok:false,published:'unconfirmed'};}};
  await o.write(driver,{role:'write'});assert.equal(o.inspect().state,'PUBLICATION_UNCERTAIN');
  await assert.rejects(o.write(driver,{role:'write'}),/WRITE_ATTEMPT_CONSUMED/);
  await o.read({execute:async()=>({ok:true})},{role:'read'});
  await assert.rejects(o.read({}, {role:'read'}),/READ_ATTEMPT_CONSUMED/);assert.equal(calls,1);await stop(o);
});
test('Partial/failed administrative operation requires STOP, never retry or rollback',async()=>{
  const o=demo();await assert.rejects(o.stage(async()=>{throw Error('partial staging');}),/partial staging/);
  assert.equal(o.inspect().state,'STOP_REQUIRED');await assert.rejects(o.activate(async()=>{}),/STATE_CONFLICT/);await stop(o);
});
test('Real-time client expiry is not advertised as server expiry or server role separation',async()=>{
  const o=demo();assert.equal(o.inspect().serverEnforcedExpiry,false);assert.equal(o.inspect().serverRoleSeparation,false);await stop(o);
  for(const origin of ['https://mebleszek.github.io','http://127.0.0.1/?live=1','http://user@localhost']){
    assert.throws(()=>gate.openDemoOperator({projectId:'demo-meble-app',origin,expiresAt:now+1000,now:()=>now}),/DEMO_LOOPBACK_REQUIRED/);
  }
  assert.throws(()=>gate.openDemoOperator({projectId:gate.TARGET.projectId,origin:'http://localhost',expiresAt:now+1000,now:()=>now}),/DEMO_LOOPBACK_REQUIRED/);
});
test('Independent post-operation plan compares exact new identity and approved minimal bytes',()=>{
  const source=fs.readFileSync(new URL('./firestore-live-pilot.rules',import.meta.url));
  const expected=metadata();expected.release.rulesetName='projects/mebleszek-meble-app/rulesets/synthetic-reviewed-id';
  expected.ruleset.name=expected.release.rulesetName;expected.release.updateTime='2026-10-20T11:59:59Z';
  const observed=structuredClone(expected);observed.ruleset.source={files:[{name:'firestore.rules',content:source.toString()}]};
  assert.equal(gate.verifyPostOperation({observed,expected,sourceRole:'minimal-pilot',sourceBytes:source}).executionAllowed,false);
  for(const alter of [o=>o.ruleset.name+='x',o=>o.release.updateTime+='x',o=>o.ruleset.source.files[0].content+='\n']){
    const changed=structuredClone(observed);alter(changed);
    assert.throws(()=>gate.verifyPostOperation({observed:changed,expected,sourceRole:'minimal-pilot',sourceBytes:source}));
  }
});
test('Administrative STOP proceeds during stalled client IO; late completion cannot resurrect operator state',async()=>{
  const o=demo();await o.stage(async()=>{});await o.activate(async()=>{});
  let release;const pending=new Promise(resolve=>{release=resolve;});
  const write=o.write({execute:()=>pending},{role:'write'});
  await o.stop(async()=>{});await o.verifyStop(async()=>true);
  assert.equal(o.inspect().state,'STOP_VERIFIED');assert.throws(()=>demo(),/OPERATOR_CONFLICT/);
  release({ok:true});await assert.rejects(write,/STOPPED_DURING_OPERATION_RESULT_UNCERTAIN/);
  assert.equal(o.inspect().state,'STOP_VERIFIED');const next=demo();await stop(next);
});
test('Failed independent STOP verification retains the lock and never re-enables a client',async()=>{
  const o=demo();await o.stop(async()=>{});
  await assert.rejects(o.verifyStop(async()=>false),/STOP_NOT_CONFIRMED/);
  assert.equal(o.inspect().state,'STOP_UNVERIFIED');assert.throws(()=>demo(),/OPERATOR_CONFLICT/);
  await o.verifyStop(async()=>true);
});
test('Rules change between observations and unknown or changed account limits are STOP',()=>{
  const checked=metadata(),fresh=metadata();fresh.release.updateTime='2026-10-20T11:59:59Z';
  const input={projectId:gate.TARGET.projectId,database:'(default)',checked,fresh};
  assert.ok(gate.reviewProductionGate(input,now).blockers.includes('CLOUD43A_RULES_IDENTITY_CHANGED'));
  for(const account of [null,{plan:'Blaze'},{plan:'Spark',billingEnabled:true},{remainingReads:499,remainingWrites:29}]){
    assert.ok(gate.reviewProductionGate({...input,account},now).blockers.includes('FRESH_SPARK_BILLING_QUOTA_EVIDENCE_REQUIRED'));
  }
});
test('Even an exactly named operator decision cannot open the existing LIVE loader',async()=>{
  const packet=p.prepare({uid:'synthetic-cloud44-owner',role:'write',expiresAt:Date.now()+600000,
    grant:{appEnabled:true,enabled:false},appAccess:{schemaVersion:1},control:null});
  const decision={decisionId:'synthetic-no-production-authority',baseCommit:packet.proof.baseCommit,
    sourcePinsSha256:packet.proof.sourcePinsSha256,packageSha256:packet.proof.packageSha256,
    loaderSha256:packet.proof.loaderSha256,candidateSha256:packet.proof.candidateSha256,
    rulesSha256:packet.proof.rulesSha256,projectId:p.PRODUCTION.projectId,...packet.binding};
  const source=fs.readFileSync(new URL('./cloud42-reviewed-loader.mjs.txt',import.meta.url),'utf8');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cloud44-inert-loader-'));
  const file=path.join(directory,'reviewed.mjs');fs.writeFileSync(file,source);
  try {
    const {openReviewedCandidate}=await import(pathToFileURL(file));
    const untouched=new Proxy({},{get(){throw Error('Page touched before LIVE refusal');}});
    await assert.rejects(openReviewedCandidate(untouched,{checkout:new URL('../../',import.meta.url).pathname,packet,decision}),/CLOUD43A_BASELINE_REVIEW_REQUIRED/);
  } finally {fs.unlinkSync(file);fs.rmdirSync(directory);}
});
test('STOP at result delivery cannot be overwritten by the outer async result handler',async()=>{
  const o=demo();await o.stage(async()=>{});await o.activate(async()=>{});
  let releaseStop,entered,stopPromise;
  const hold=new Promise(resolve=>{releaseStop=resolve;}),reached=new Promise(resolve=>{entered=resolve;});
  const observer=(async()=>{
    while(o.inspect().state!=='WRITE_ATTEMPTED')await Promise.resolve();
    stopPromise=o.stop(()=>hold);entered();
  })();
  const write=o.write({execute:async()=>({ok:false,published:'unconfirmed'})},{role:'write'}).then(value=>({value}),error=>({error}));
  await reached;const out=await write,during=o.inspect().state;
  releaseStop();await stopPromise;await o.verifyStop(async()=>true);await observer;
  assert.equal(during,'STOP_IN_PROGRESS');
  assert.match(out.error?.message||'',/STOPPED_DURING_OPERATION_RESULT_UNCERTAIN/);
});

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const b=require('./firebase-pilot/cloud43a-baseline.js'),p=require('./firebase-pilot/cloud42-package.js');
const root=path.join(__dirname,'firebase-pilot'),record=b.baseline();
assert.equal(record.baselineApprovedForGate2,false);assert.equal(record.gate1,'STOP_SHA_MISMATCH_REVIEW_REQUIRED');
assert.equal(record.source.utf8Bytes,635);assert.equal(record.provenance.independentlyFetchedInThisTask,false);
assert.throws(()=>b.requireBaseline(null),/BASELINE_CHANGED/);
assert.throws(()=>b.requireBaseline({...record,baselineApprovedForGate2:true}),/BASELINE_CHANGED/);
const template=fs.readFileSync(path.join(root,'firestore-auth-only.rules'));
assert.equal(b.verifyArtifact('repository-auth-only-template',template).byteLength,755);
assert.throws(()=>b.productionRollbackPlan(template),/SOURCE_BYTE_LENGTH_MISMATCH/);
assert.throws(()=>b.productionRollbackPlan(),/SOURCE_REQUIRED/);
assert.throws(()=>p.verifyDeployedRules('auth-only',template),/EXPLICIT_RULES_ROLE_REQUIRED/);
assert.equal(b.verifyArtifact('minimal-pilot',fs.readFileSync(path.join(root,'firestore-live-pilot.rules'))).deploymentConfirmed,false);
const plan=JSON.parse(fs.readFileSync(path.join(root,'cloud43a-production-rollback.plan.json')));
assert.equal(plan.executionAllowed,false);assert.equal(plan.isFirebaseDeployConfig,false);assert.equal(plan.automaticBaselineUpdate,false);
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'cloud42-rules-rollback.json'))),{firestore:{rules:'firestore-auth-only.rules'}});
for(const suffix of ['cloud43a-production-baseline.json','cloud43a-production-rollback.plan.json']){
 const module={exports:{}},facade={...fs,readFileSync(file,...args){const out=fs.readFileSync(file,...args);return String(file).endsWith(suffix)?Buffer.concat([Buffer.from(out),Buffer.from(' ')]):out;}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'cloud43a-baseline.js'),'utf8'),{require:n=>n==='node:fs'?facade:require(n),module,__dirname:root,Buffer});
 if(suffix.includes('baseline'))assert.throws(()=>module.exports.baseline(),/BASELINE_CHANGED/);
 else assert.notEqual(require('node:crypto').createHash('sha256').update(facade.readFileSync(path.join(root,suffix))).digest('hex'),b.PLAN_SHA256);
}
assert.equal(p.inventory().sourcePinsSha256,'c8439b32a36cb6a76927ba4f968b08b909745286d9d80888923b2fc700d2f1c0');
console.log('CLOUD-4.3a pinned historical metadata, three artifact roles, private-source requirement and no automatic gate: PASS');

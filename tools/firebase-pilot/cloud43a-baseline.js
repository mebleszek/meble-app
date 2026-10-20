// Offline identity/byte checks only. No SDK, network, credentials or deployment.
'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const BASELINE_SHA256='4bce7b5fa37626b48f25802ce8d0f0c929a75a8eeb9240aaf9f04483b0bb5a6d';
const PLAN_SHA256='dc6c880912ddc9433bf5cb6c9268d128fb3bcf126f5c4695748ce486b36a68fe';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonical=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
function fail(code){throw Error('CLOUD43A_'+code);}
function pinned(name,expected){const bytes=fs.readFileSync(path.join(__dirname,name));if(sha(bytes)!==expected)fail('BASELINE_CHANGED');return JSON.parse(bytes);}
function baseline(){return pinned('cloud43a-production-baseline.json',BASELINE_SHA256);}
function requireBaseline(value){const expected=baseline();if(!value||canonical(value)!==canonical(expected))fail('BASELINE_CHANGED');return expected;}
const ARTIFACTS=Object.freeze({
 'production-auth-only-baseline':Object.freeze({utf8Bytes:635,sha256:'9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91'}),
 'repository-auth-only-template':Object.freeze({utf8Bytes:755,sha256:'fd92cffababe500cba62ed6e592b482760ce9e66df35f01419c44edff2f10cd3'}),
 'minimal-pilot':Object.freeze({sha256:'eaeb3e67417955bbd67d2881902d3827023502c2948ce0a19dc583c66b5a2e92'})
});
function verifyArtifact(role,value){
 const expected=ARTIFACTS[role];if(!expected||!(typeof value==='string'||Buffer.isBuffer(value)))fail('SOURCE_REQUIRED');
 const bytes=Buffer.isBuffer(value)?value:Buffer.from(value,'utf8');
 if(expected.utf8Bytes&&bytes.length!==expected.utf8Bytes)fail('SOURCE_BYTE_LENGTH_MISMATCH');
 if(sha(bytes)!==expected.sha256)fail('SOURCE_SHA_MISMATCH');
 return {role,sha256:expected.sha256,byteLength:bytes.length,deploymentConfirmed:false};
}
function decodeProductionSourceJson(jsonString){
 if(typeof jsonString!=='string')fail('SOURCE_REQUIRED');
 let content;try{content=JSON.parse(jsonString);}catch(_){fail('SOURCE_JSON_INVALID');}
 if(typeof content!=='string')fail('SOURCE_JSON_INVALID');
 const bytes=Buffer.from(content,'utf8');verifyArtifact('production-auth-only-baseline',bytes);return bytes;
}
function verifyProductionObservation(observation,record=baseline()){
 const b=requireBaseline(record),o=observation;
 if(!o||o.projectId!==b.projectId||o.database!==b.database)fail('TARGET_MISMATCH');
 for(const [section,keys]of [['release',['name','rulesetName','createTime','updateTime']],['ruleset',['name','createTime']]]){
  if(!o[section]||keys.some(key=>o[section][key]!==b[section][key]))fail('RULES_IDENTITY_CHANGED');
 }
 const files=o.ruleset.source?.files;
 if(!Array.isArray(files)||files.length!==1||files[0]?.name!==b.source.name||typeof files[0].content!=='string')fail('SOURCE_FILES_MISMATCH');
 const proof=verifyArtifact('production-auth-only-baseline',files[0].content);
 return {...proof,baselineId:b.baselineId,status:'HISTORICAL_IDENTITY_MATCH_ONLY',
  gate1:'STOP_OWNER_REVIEW_REQUIRED',mutationAllowed:false,baselineApprovedForGate2:false};
}
function assertFreshUnchangedRules(checked,fresh,now=Date.now(),record=baseline()){
 requireBaseline(record);
 // Caller supplies official observations after separate read authorization.
 // A timestamp/JSON is not an authenticated server receipt or owner consent.
 for(const o of [checked,fresh]){
  verifyProductionObservation(o,record);
  const at=typeof o.observedAt==='string'?Date.parse(o.observedAt):NaN;
  if(!Number.isFinite(now)||!Number.isFinite(at)||at>now||now-at>300000)fail('FRESH_READ_REQUIRED');
 }
 const identity=o=>({projectId:o.projectId,database:o.database,release:o.release,ruleset:o.ruleset});
 if(canonical(identity(checked))!==canonical(identity(fresh)))fail('RULES_IDENTITY_CHANGED');
 if(Date.parse(fresh.observedAt)<Date.parse(checked.observedAt))fail('FRESH_READ_REQUIRED');
 return {status:'FRESH_IDENTITY_MATCH_ONLY',gate1:'STOP_OWNER_REVIEW_REQUIRED',mutationAllowed:false};
}
function productionRollbackPlan(privateSource){
 verifyArtifact('production-auth-only-baseline',privateSource);
 const plan=pinned('cloud43a-production-rollback.plan.json',PLAN_SHA256);
 if(plan.baselineId!==baseline().baselineId||plan.executionAllowed!==false)fail('BASELINE_CHANGED');
 return {...plan,sourceBytesVerified:true};
}
module.exports={BASELINE_SHA256,PLAN_SHA256,ARTIFACTS,decodeProductionSourceJson,baseline,requireBaseline,verifyArtifact,verifyProductionObservation,assertFreshUnchangedRules,productionRollbackPlan};

// Offline review package. No SDK, credentials, production IO or executable CLI.
'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {compile,RULES_SHA256}=require('./private-pilot-source.js');
const {plan}=require('./cloud4-admin-plan.js');
const root=path.resolve(__dirname,'../..');
const BASE='44b5be9b1e05eded8243b9a617f976e44ad49c6f';
const REVIEW_SHA256='d8ed6e6336066cf0e33621838a3d98694202bf510461e21be91ce7dbeceeb2b8';
const PRODUCTION=Object.freeze({projectId:'mebleszek-meble-app',origin:'https://mebleszek.github.io',pathname:'/meble-app/index.html',authDomain:'mebleszek-meble-app.firebaseapp.com',appId:'1:447820686604:web:6bc0817aa365b1b613d529'});
const PAYLOAD='711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3';
const DOCUMENT='5c9bc70f8fc1d7a15cef742150636e41ebacde404e57bd6109213f82d28d81a1';
const sha=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const copy=value=>JSON.parse(JSON.stringify(value));
function fail(code){throw Error(code);}
const BASELINE_VERIFIER_SHA256='ea851d4bd82a578714cbda9465b9c3a0744a5c132bab945695bfeeb7565cb527';
const baselineVerifierFile=path.join(__dirname,'cloud43a-baseline.js');
if(sha(fs.readFileSync(baselineVerifierFile))!==BASELINE_VERIFIER_SHA256)fail('CLOUD43A_BASELINE_CHANGED');
const rulesBaseline=require('./cloud43a-baseline.js');
function validateSourceReview(manifest,review){
 if(review.schemaVersion!==1||review.reviewedBaseCommit!==BASE
   ||review.originalCount!==423||review.reviewedCount!==425||review.changedCount!==35
   ||review.addedCount!==2||review.unchangedCount!==388
   ||Object.keys(manifest.sha256||{}).length!==review.reviewedCount
   ||sha(canonical(manifest))!==review.reviewedManifestSha256)fail('CLOUD43_REVIEW_CHANGED');
 const seen=new Set();
 if(review.entries.length!==review.changedCount+review.addedCount)fail('CLOUD43_REVIEW_CHANGED');
 for(const entry of review.entries){
  if(seen.has(entry.path)||manifest.sha256[entry.path]!==entry.reviewedSha256
    ||!entry.compatibility||!entry.category||!entry.sourceCommits.length
    ||entry.sourceCommits.some(commit=>! /^[a-f0-9]{40}$/.test(commit)))fail('CLOUD43_REVIEW_CHANGED');
  seen.add(entry.path);
 }
}
function inventory(){
 if(sha(fs.readFileSync(baselineVerifierFile))!==BASELINE_VERIFIER_SHA256
  ||sha(fs.readFileSync(path.join(__dirname,'cloud43a-production-rollback.plan.json')))!==rulesBaseline.PLAN_SHA256)fail('CLOUD43A_BASELINE_CHANGED');
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'cloud42-source-pins.json')));
 if(manifest.baseCommit!==BASE)fail('CLOUD42_SOURCE_CHANGED');
 const reviewBytes=fs.readFileSync(path.join(__dirname,'cloud43-source-review.json'));
 if(sha(reviewBytes)!==REVIEW_SHA256)fail('CLOUD43_REVIEW_CHANGED');
 const review=JSON.parse(reviewBytes);validateSourceReview(manifest,review);
 // New application scripts cannot silently escape the reviewed source set.
 const scripts=[];
 function walk(dir){for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
  const name=dir+'/'+entry.name;if(entry.isDirectory())walk(name);else if(name.endsWith('.js'))scripts.push(name);
 }}
 walk('js');
 if(canonical(scripts.sort())!==canonical(Object.keys(manifest.sha256).filter(n=>n.startsWith('js/')&&n.endsWith('.js')).sort()))fail('CLOUD42_SOURCE_CHANGED');
 for(const [name,expected]of Object.entries(manifest.sha256)){
  if(name.startsWith('/')||name.split('/').includes('..')||sha(fs.readFileSync(path.join(root,name)))!==expected)fail('CLOUD42_SOURCE_CHANGED');
 }
 if(manifest.sha256['tools/firebase-pilot/firestore-live-pilot.rules']!==RULES_SHA256)fail('CLOUD42_RULES_CHANGED');
 return {baseCommit:BASE,sourceCount:review.reviewedCount,sourceReviewSha256:REVIEW_SHA256,sourcePinsSha256:sha(canonical(manifest)),rulesSha256:RULES_SHA256,
  repositoryAuthOnlyTemplateSha256:manifest.sha256['tools/firebase-pilot/firestore-auth-only.rules'],
  productionAuthOnlyBaselineSha256:rulesBaseline.baseline().source.sha256,
  productionBaselineApprovedForGate2:rulesBaseline.baseline().baselineApprovedForGate2,
  rulesBaselineRecordSha256:rulesBaseline.BASELINE_SHA256,
  rulesBaselineVerifierSha256:BASELINE_VERIFIER_SHA256,
  productionRollbackPlanSha256:rulesBaseline.PLAN_SHA256,
  packageSha256:sha(fs.readFileSync(__filename)),loaderSha256:sha(fs.readFileSync(path.join(__dirname,'cloud42-reviewed-loader.mjs.txt'))),
  payloadSha256:PAYLOAD,documentSha256:DOCUMENT,utf8Bytes:6797};
}

// Shared by the inert production candidate and the real emulator rehearsal.
// This is an operational fence, never an alternative to server Security Rules.
function wrapOperator(driver,binding){
 let used=false,closed=false;
 return Object.freeze({
  async execute(request){
   if(closed)return {ok:false,code:'CLOUD_CLIENT_CLOSED'};
   if(used)return {ok:false,code:'CLOUD_OPERATION_LIMIT'};
   used=true;
   const fixed=binding||{ownerUid:request?.approval?.ownerUid,role:request?.role,expiresAt:request?.approval?.expiresAt};
   if(!request||!['write','read'].includes(fixed.role)||request.role!==fixed.role
     ||request.approval?.ownerUid!==fixed.ownerUid||request.approval?.expiresAt!==fixed.expiresAt
     ||typeof fixed.ownerUid!=='string'||!Number.isFinite(fixed.expiresAt)
     ||fixed.expiresAt<=Date.now()||fixed.expiresAt>Date.now()+900000)return {ok:false,code:'CLOUD_APPROVAL_REQUIRED'};
   return driver.execute(request);
  },
  async close(){closed=true;await driver.close();}
 });
}

function grantActions({uid,grant,appAccess,control}){
 const p=plan({uid,grant,appAccess,control});
 if(grant.enabled!==false||(control!==null&&control.enabled!==false))fail('CLOUD42_PILOT_ALREADY_ENABLED');
 const disabledControl={...p.control,enabled:false};
 const disabledGrant={...grant,...p.grantPatch,enabled:false};
 const activeGrant={...disabledGrant,enabled:true};
 const action=(expectedGrant,expectedControl,grantPatch,nextControl)=>({
  projectId:PRODUCTION.projectId,database:'(default)',
  expected:{['authorizedUsers/'+uid]:copy(expectedGrant),['appAccess/'+uid]:copy(appAccess),['pilotControl/cloud4']:copy(expectedControl)},
  writes:[{path:'authorizedUsers/'+uid,method:'update',fields:grantPatch},
   {path:'pilotControl/cloud4',method:expectedControl===null?'create':'update',fields:copy(nextControl)}]
 });
 return {stage:action(grant,control,{...p.grantPatch,enabled:false},disabledControl),
  activate:action(disabledGrant,disabledControl,{enabled:true},p.control),
  stop:action(activeGrant,p.control,{enabled:false},disabledControl)};
}
function assertExpected(action,observed){
 if(canonical(action.expected)!==canonical(observed))fail('CLOUD42_ADMIN_CONFLICT');
}
function stopAction({uid,grant,appAccess,control}){
 if(!grant||typeof grant.appEnabled!=='boolean')fail('CLOUD42_ADMIN_STATE_UNEXPECTED');
 // Validate the schema using CLOUD-4, while preserving the ACTUAL revoked
 // appEnabled value in the CAS. Stopping must never re-enable app access.
 const p=plan({uid,grant:{...grant,appEnabled:true},appAccess,control});
 return {projectId:PRODUCTION.projectId,database:'(default)',
  expected:{['authorizedUsers/'+uid]:copy(grant),['appAccess/'+uid]:copy(appAccess),['pilotControl/cloud4']:copy(control)},
  writes:[{path:'authorizedUsers/'+uid,method:'update',fields:{enabled:false}},
   {path:'pilotControl/cloud4',method:control===null?'create':'update',fields:{...p.control,enabled:false}}]};
}
// Byte validation is not evidence that these bytes are currently deployed.
function verifyDeployedRules(role,bytes,observation){
 inventory();
 if(role==='auth-only')fail('CLOUD43A_EXPLICIT_RULES_ROLE_REQUIRED');
 if(role==='production-auth-only-baseline'){
  const out=rulesBaseline.verifyProductionObservation(observation);
  rulesBaseline.verifyArtifact(role,bytes);
  if(!Buffer.from(observation.ruleset.source.files[0].content,'utf8').equals(Buffer.from(bytes)))fail('CLOUD43A_SOURCE_SHA_MISMATCH');
  return out;
 }
 const mapped=role==='minimal'?'minimal-pilot':role;
 if(!['repository-auth-only-template','minimal-pilot'].includes(mapped))fail('CLOUD42_DEPLOYED_RULES_UNCONFIRMED');
 try{return {...rulesBaseline.verifyArtifact(mapped,bytes),stage:role};}
 catch(_){fail('CLOUD42_DEPLOYED_RULES_UNCONFIRMED');}
}

function productionContext(context,location){
 const expected={projectId:'mebleszek-meble-app',origin:'https://mebleszek.github.io',pathname:'/meble-app/index.html',authDomain:'mebleszek-meble-app.firebaseapp.com',appId:'1:447820686604:web:6bc0817aa365b1b613d529'};
 return context?.target==='live-auth'&&context.app?.options?.projectId===expected.projectId
  &&context.app.options.authDomain===expected.authDomain&&context.app.options.appId===expected.appId
  &&location?.origin===expected.origin&&location.pathname===expected.pathname&&!location.search&&!location.hash;
}
function prepare(input,now=Date.now()){
 const keys=['uid','role','expiresAt','grant','appAccess','control'];
 if(!input||Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k))
   ||!['write','read'].includes(input.role)||!Number.isFinite(input.expiresAt)
   ||input.expiresAt<=now||input.expiresAt>now+900000)fail('CLOUD42_REVIEW_SCOPE_INVALID');
 const proof=inventory(),actions=grantActions(input);
 const binding={ownerUid:input.uid,role:input.role,expiresAt:input.expiresAt};
 const original=compile().source;
 const guard="if(context.target!=='emulator'||!/^demo-[a-z0-9-]+$/.test(context.app.options.projectId)\n       ||!['127.0.0.1','localhost'].includes(location.hostname))fail('CLOUD_LIVE_TRANSPORT_DISABLED');";
 if(original.split(guard).length!==2)fail('CLOUD42_SOURCE_CHANGED');
 const productionCheck=`if(!(${productionContext.toString()})(context,location))fail('CLOUD_LIVE_TRANSPORT_DISABLED');`;
 // Text for separate owner review ONLY. No function here opens a live browser,
 // loads this candidate, initializes Firebase or deploys anything.
 const candidateSource=`(${wrapOperator.toString()})(${original.replace(guard,productionCheck).trim().replace(/;$/,'')},${JSON.stringify(binding)})`;
 return {status:'REVIEW_REQUIRED_NOT_ACTIVATED',production:PRODUCTION,binding,
  proof:{...proof,candidateSha256:sha(candidateSource)},candidateSource,actions,
  approval:{version:1,ownerUid:input.uid,investorId:'cloud4-investor-v1',projectId:'cloud4-project-v1',
   payloadSha256:PAYLOAD,rulesSha256:RULES_SHA256,expiresAt:input.expiresAt},
  limits:{writeAttempts:1,readerContexts:1,maximumApprovalMs:900000,automaticRetry:false,importToLocal:false},
  operationWindow:{stopBy:input.expiresAt,serverEnforcedExpiry:false,administrativeStopRequired:true}};
}
function readDecision(write,read){
 const valid=read?.ok===true&&read.sourceMatches===true&&read.utf8Bytes===6797&&read.documentSha256===DOCUMENT
  &&typeof read.revisionId==='string'&&/^[a-f0-9]{32}$/.test(read.revisionId);
 if(!valid||write?.revisionId&&write.revisionId!==read.revisionId)return {status:'STOP_REVIEW_REQUIRED',retryWrite:false};
 return {status:'VERIFIED_SYNTHETIC_STATE',attribution:write?.revisionId?'same-revision':'unattributed',retryWrite:false};
}
module.exports={validateSourceReview,BASE,PRODUCTION,inventory,prepare,grantActions,stopAction,assertExpected,readDecision,wrapOperator,productionContext,verifyDeployedRules};

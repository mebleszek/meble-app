// Offline review package. No SDK, credentials, production IO or executable CLI.
'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {compile,RULES_SHA256}=require('./private-pilot-source.js');
const {plan}=require('./cloud4-admin-plan.js');
const root=path.resolve(__dirname,'../..');
const BASE='d517d598917e5ccd6f1460950697c9ab27f1db1c';
const PRODUCTION=Object.freeze({projectId:'mebleszek-meble-app',origin:'https://mebleszek.github.io',pathname:'/meble-app/index.html',authDomain:'mebleszek-meble-app.firebaseapp.com',appId:'1:447820686604:web:6bc0817aa365b1b613d529'});
const PAYLOAD='711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3';
const DOCUMENT='5c9bc70f8fc1d7a15cef742150636e41ebacde404e57bd6109213f82d28d81a1';
const sha=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const copy=value=>JSON.parse(JSON.stringify(value));
function fail(code){throw Error(code);}
function inventory(){
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'cloud42-source-pins.json')));
 if(manifest.baseCommit!==BASE)fail('CLOUD42_SOURCE_CHANGED');
 for(const [name,expected]of Object.entries(manifest.sha256)){
  if(name.startsWith('/')||name.split('/').includes('..')||sha(fs.readFileSync(path.join(root,name)))!==expected)fail('CLOUD42_SOURCE_CHANGED');
 }
 if(manifest.sha256['tools/firebase-pilot/firestore-live-pilot.rules']!==RULES_SHA256)fail('CLOUD42_RULES_CHANGED');
 return {baseCommit:BASE,sourcePinsSha256:sha(canonical(manifest)),rulesSha256:RULES_SHA256,
  rollbackRulesSha256:manifest.sha256['tools/firebase-pilot/firestore-auth-only.rules'],
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
function verifyDeployedRules(stage,bytes){
 const proof=inventory();
 const expected=stage==='auth-only'?proof.rollbackRulesSha256:stage==='minimal'?proof.rulesSha256:null;
 if(!expected||sha(bytes)!==expected)fail('CLOUD42_DEPLOYED_RULES_UNCONFIRMED');
 return {stage,sha256:expected,byteLength:Buffer.byteLength(bytes)};
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
  limits:{writeAttempts:1,readerContexts:1,maximumApprovalMs:900000,automaticRetry:false,importToLocal:false}};
}
function readDecision(write,read){
 const valid=read?.ok===true&&read.sourceMatches===true&&read.utf8Bytes===6797&&read.documentSha256===DOCUMENT
  &&typeof read.revisionId==='string'&&/^[a-f0-9]{32}$/.test(read.revisionId);
 if(!valid||write?.revisionId&&write.revisionId!==read.revisionId)return {status:'STOP_REVIEW_REQUIRED',retryWrite:false};
 return {status:'VERIFIED_SYNTHETIC_STATE',attribution:write?.revisionId?'same-revision':'unattributed',retryWrite:false};
}
module.exports={BASE,PRODUCTION,inventory,prepare,grantActions,stopAction,assertExpected,readDecision,wrapOperator,productionContext,verifyDeployedRules};

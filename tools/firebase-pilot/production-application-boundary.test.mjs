import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {completeMissingApplicationGlobals} from '../../sync/application-initial-state.mjs';
import {planFirstCatalogSync} from '../../sync/application-first-catalog-sync.mjs';
const require=createRequire(import.meta.url);
import {canonical} from '../../sync/local-first-values.mjs';
import {verifyApplicationRelease,assertApplicationRelease,assertApplicationMigration} from '../../sync/application-release.mjs';
import {authorizeApplicationSession,assertApplicationConnection} from '../../sync/firebase-activation.mjs';
import {createApplicationSyncGrant} from '../../sync/application-sync-grant.mjs';
const owner='synthetic-owner',origin='https://mebleszek.github.io/meble-app/';
test('Firestore cooldown survives reload and expires without affecting another UID or project',()=>{
 const {runInNewContext}=require('node:vm'),rows=new Map();
 const source=fs.readFileSync(new URL('../../js/app/cloud/cloud-access-verifier.js',import.meta.url),'utf8');
 let now=100000;
 const localStorage={getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value)};
 function load(){
  const window={localStorage};
  runInNewContext(source,{window,Date:{now:()=>now}});
  return window.FC.cloudAccessVerifier.quotaGuard;
 }
 load()('demo-a','owner').record({code:'resource-exhausted'});
 let guard=load();
 assert.throws(()=>guard('demo-a','owner').assert(),/resource-exhausted/);
 guard('demo-b','owner').assert();
 guard('demo-a','other').assert();
 now+=35000;
 guard('demo-a','owner').assert();
 const quota=guard('demo-a','owner');
 quota.record({code:'resource-exhausted'},300000);
 now+=35000;
 guard=load();
 const reopened=guard('demo-a','owner');
 assert.throws(()=>reopened.assert(),/resource-exhausted/);
 const deadline=reopened.deadline();
 try{reopened.assert();}catch(error){reopened.record(error,300000);}
 assert.equal(reopened.deadline(),deadline);
 guard('demo-b','owner').assert();
 guard('demo-a','other').assert();
 now=deadline;
 reopened.assert();
 rows.set('meble-firestore-cooldown:demo-a:owner',String(now+86400000));
 guard=load();
 guard('demo-a','owner').assert();
});
test('first catalog sync publishes only the witnessed Pixel image over the preserved base',async()=>{
 const pixelHash='c73af3f12d2a81fa6007f067079f8f1f808fe1088d9929de24c421fdc90b1429';
 const head={ownerUid:owner,generation:1,revisionId:'584e3db3f8d04eb48445526b6d4f8043',
  directoryHash:'2fee1752e2db9cb497b0ed4c5ce4a7799f15ea82a7f464e351eb91e292601714',recordCount:171};
 const model={};
 const contract={schemas:{},capture:()=>({model}),validateBundle:value=>assert.equal(value,model),
  pack:async()=>({directoryHash:pixelHash,records:Array(239)})};
 const input={remote:{head},image:{rows:{}},boot:{fresh:true,restored:true},contract,ownerUid:owner};
 assert.deepEqual(await planFirstCatalogSync(input),{action:'publish',model});
 const fresh={...input,boot:{fresh:true,restored:false},image:null};
 await assert.rejects(planFirstCatalogSync(fresh),/LF_FIRST_CATALOG_PIXEL_REQUIRED/);
 await assert.rejects(planFirstCatalogSync({...input,remote:{head:{...head,revisionId:'changed'}}}),/LF_FIRST_CATALOG_BASE_CHANGED/);
 await assert.rejects(planFirstCatalogSync({...input,image:{rows:{fc_projects_v1:'[{}]'}}}),/LF_FIRST_CATALOG_LOCAL_BUSINESS_DATA/);
 await assert.rejects(planFirstCatalogSync({...input,image:{rows:{fc_edit_session_v1:'{}'}}}),/LF_FIRST_CATALOG_ACTIVE_SESSION/);
 await assert.rejects(planFirstCatalogSync({...input,contract:{...contract,pack:async()=>({directoryHash:head.directoryHash,records:Array(239)})}}),/LF_FIRST_CATALOG_SOURCE_CHANGED/);
 const published={head:{...head,generation:2,directoryHash:pixelHash,recordCount:239},parent:head};
 await assert.rejects(planFirstCatalogSync({...fresh,remote:{...published,parent:{...head,revisionId:'unrelated'}}}),/LF_FIRST_CATALOG_PIXEL_REQUIRED/);
 assert.deepEqual(await planFirstCatalogSync({...fresh,remote:published}),{action:'receive'});
 assert.deepEqual(await planFirstCatalogSync({...input,remote:published}),{action:'bind'});
});
async function fixture(overrides={}){const keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),spki=new Uint8Array(await crypto.subtle.exportKey('spki',keys.publicKey));
 const decision={domain:'MEBLE_APPLICATION_DEPLOYMENT_V1',protocol:2,database:'(default)',projectId:'mebleszek-meble-app',ownerUid:owner,origin,activationId:'synthetic-release',profile:'business-project-v1',globalDomains:14,migrationApproved:true,sourcePreserved:true,rulesApproved:true,rulesSha256:'a'.repeat(64),...overrides};
 const signature=new Uint8Array(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode(canonical(decision))));
 return {origin,trustedKeySha256:Buffer.from(await crypto.subtle.digest('SHA-256',spki)).toString('hex'),envelope:{decision,signature,publicKeySpki:spki}};
}
test('owner-authorized deployment verifies pinned key and Rules; unsigned or altered activation refuses',async()=>{
 const slot=fs.readFileSync(new URL('../../js/app/cloud/application-release.js',import.meta.url),'utf8');
 const {runInNewContext}=await import('node:vm'),{createHash}=await import('node:crypto'),sandbox={window:{},Uint8Array,Object};
 runInNewContext(slot,sandbox,{timeout:1000});
 const deployed=sandbox.window.FC_APPLICATION_RELEASE;
 const trustedKeySha256='c66babc664fff2dbb25edd84227c5337a32a59df25636f97cc3d71dcdeada53b';
 assert.equal(deployed.trustedKeySha256,trustedKeySha256);
 const approved=assertApplicationRelease(await verifyApplicationRelease({...deployed,trustedKeySha256,origin}));
 assert.equal(approved.ownerUid,'ByBPVVNXx3fUDUmTg5yTSNVveH23');assert.equal(approved.activationId,'meble-app-20261102-01');
 assert.equal(approved.protocol,3);assert.equal(approved.profile,'business-room-v1');
 assert.equal(approved.registry,'p0b-rooms-v1');assert.equal(approved.legacyDataPolicy,'preserve-outside-registry');
 assert.equal(approved.rulesSha256,createHash('sha256').update(require('./p0b-application-rules.js').p0bApplicationRules({normal:true})).digest('hex'));
 assert.equal(await (await import('../../sync/local-first-values.mjs')).digest(approved),'8c6d478efefa55d13d606ca4f71c141b681393bc73985af38ef9f3831a58f8a3');
 const altered=new Uint8Array(deployed.envelope.signature);altered[0]^=1;
 await assert.rejects(verifyApplicationRelease({...deployed,trustedKeySha256,origin,envelope:{...deployed.envelope,signature:altered}}),/SIGNATURE_INVALID/);
 await assert.rejects(verifyApplicationRelease({origin}),/APPROVAL_REQUIRED/);
 const f=await fixture();await assert.rejects(verifyApplicationRelease({...f,envelope:{...f.envelope,decision:{...f.envelope.decision,ownerUid:'foreign'}}}),/SIGNATURE_INVALID/);
 await assert.rejects(verifyApplicationRelease({...f,trustedKeySha256:'b'.repeat(64)}),/OWNER_TRUST_REQUIRED/);
 await assert.rejects(verifyApplicationRelease({...f,origin:'https://foreign.invalid/'}),/TARGET_INVALID/);
 const release=await verifyApplicationRelease(f);assert.equal(assertApplicationRelease(release).ownerUid,owner);
 assert.throws(()=>assertApplicationRelease(release,{ownerUid:'foreign'}),/OWNER_CHANGED/);
 await assert.rejects(assertApplicationMigration({approved:true},{name:'meble-local-first-v1',ownerUid:owner,rows:{}}),/EXCLUSIVITY_UNPROVEN/);
});
test('daily connection uses fresh Google/Rules leases, without administrative signature expiry or network',async()=>{
 const release=await verifyApplicationRelease(await fixture());let valid=true;
 const connection=()=>{const app={options:{projectId:'mebleszek-meble-app'}};return {db:{app,_databaseId:{projectId:'mebleszek-meble-app',database:'(default)'},_settings:{host:'firestore.googleapis.com',ssl:true}},auth:{app,currentUser:{uid:owner,emailVerified:true,providerData:[{providerId:'google.com'}]}},session:{identity:()=>({uid:owner,epoch:1})},assertAccess(){if(!valid)throw Error('LF_SYNC_ACCESS_UNCONFIRMED');},lease:{uid:owner,assert(){if(!valid)throw Error('revoked');},isValid:()=>valid}};};
 const writer=connection(),reader=connection(),permit=authorizeApplicationSession({release,writer,reader});
 const {authorizeGlobalStagingConnection,assertGlobalConnection,assertP0BConnection}=await import('../../sync/firebase-activation.mjs');
 assert.equal(typeof authorizeGlobalStagingConnection,'function');
 const staged=connection(),stageIdentity={uid:owner,epoch:1};staged.session.identity=()=>({...stageIdentity});
 const stagePermit=authorizeGlobalStagingConnection(writer,staged);
 assert.equal(assertGlobalConnection(staged).uid,owner);
 assert.throws(()=>assertApplicationConnection(staged),/APPLICATION_ACTIVATION_REQUIRED/);
 assert.throws(()=>assertP0BConnection(staged),/P0B_REGISTRY_REQUIRED/);
 assert.throws(()=>assertGlobalConnection({...staged}),/PRODUCTION_ACTIVATION_REQUIRED/);
 stageIdentity.epoch=2;assert.throws(()=>assertGlobalConnection(staged),/AUTH_CHANGED/);stageIdentity.epoch=1;
 staged.auth.currentUser.emailVerified=false;assert.throws(()=>assertGlobalConnection(staged),/LIVE_IDENTITY_INVALID/);staged.auth.currentUser.emailVerified=true;
 const foreign=connection();foreign.auth.currentUser.uid='foreign';assert.throws(()=>authorizeGlobalStagingConnection(writer,foreign),/LIVE_IDENTITY_INVALID/);
 assert.throws(()=>authorizeGlobalStagingConnection(writer,writer),/INDEPENDENT_OWNER_REQUIRED/);
 const now=Date.now;try{Date.now=()=>now()+172800000;assert.equal(assertApplicationConnection(writer).uid,owner);}finally{Date.now=now;}
 valid=false;assert.throws(()=>assertApplicationConnection(writer),/SYNC_ACCESS_UNCONFIRMED/);assert.throws(()=>assertGlobalConnection(staged),/SYNC_ACCESS_UNCONFIRMED/);valid=true;permit.revoke();assert.throws(()=>assertApplicationConnection(writer),/ACTIVATION_REQUIRED/);assert.throws(()=>assertGlobalConnection(staged),/PRODUCTION_ACTIVATION_REQUIRED/);stagePermit.revoke();
});
test('routine sync grant requires a fresh server transaction and exact activation, uncertainty is a refusal',async()=>{
 const release=await verifyApplicationRelease(await fixture()),w=new EventTarget();w.navigator={onLine:true};w.document={hidden:false};let calls=0;
 const firestore={doc:()=>({}),runTransaction:async(_db,fn)=>{calls++;return fn({get:async()=>({exists:()=>true,metadata:{fromCache:false,hasPendingWrites:false},data:()=>({schemaVersion:1,activationId:'synthetic-release'})})});}};
 const grant=await createApplicationSyncGrant({release,window:w,session:{identity:()=>({uid:owner,epoch:1})},db:{},firestore});
 try{assert.equal(calls,1);grant.assert();w.navigator.onLine=false;assert.throws(()=>grant.assert(),/UNCONFIRMED/);}finally{grant.close();}
 await assert.rejects(createApplicationSyncGrant({release,window:w,session:{identity:()=>({uid:owner,epoch:1})},db:{},firestore}),/UNCONFIRMED/);
});
test('candidate owner Rules reuse validators and all mandatory new suites are routed to existing CI',()=>{
 const root=new URL('../..',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
 assert.match(read('tools/firebase-pilot/application-rules.js'),/syncOwner\(uid\)/);assert.match(read('tools/firebase-pilot/cloud-sync-global.test.mjs'),/deployment:true/);
 assert.match(read('tools/cloud-ci-context.js'),/cloud-sync-global.test.mjs/);
 assert.match(read('js/app/cloud/offline-writer-fence.js'),/replacesClientId/);assert.match(read('sync/application-initial-state.mjs'),/Existing RAW|existing RAW/i);
});

test('real application factories complete all fourteen absent domains without changing source RAW',()=>{
 const w=require('../app-dev-smoke.js').makeLoadedSandbox();for(const file of ['project/project-export-contract','cloud/global-data-contract'])new Function('window',fs.readFileSync(new URL('../../js/app/'+file+'.js',import.meta.url),'utf8'))(w);
 const c=w.FC.globalDataContract,source=Object.fromEntries(Object.values(c.sources).flat().map(k=>[k,null])),before=structuredClone(source),rows=completeMissingApplicationGlobals(source,w.FC,c);
 assert.equal(Object.keys(c.capture({getItem:k=>rows[k]??null},Object.keys(c.schemas)).model).length,14);assert.deepEqual(source,before);
 const existing={...source,fc_quote_rates_v1:'INVALID-RETAINED'};assert.throws(()=>completeMissingApplicationGlobals(existing,w.FC,c),/GLOBAL_STORAGE_INVALID/);assert.equal(existing.fc_quote_rates_v1,'INVALID-RETAINED');
});

test('fresh grant remains valid during renewal; failed renewal revokes and successful proof wakes pending synchronization',async()=>{
 const release=await verifyApplicationRelease(await fixture()),w=new EventTarget();w.navigator={onLine:true};w.document={hidden:false};let requests=0,renewed=0,answer;
 const proof={exists:()=>true,metadata:{fromCache:false,hasPendingWrites:false},data:()=>({schemaVersion:1,activationId:'synthetic-release'})};
 const f={doc:()=>({}),runTransaction:async()=>{requests++;return requests===1?proof:new Promise((resolve,reject)=>{answer={resolve,reject};});}};
 const grant=await createApplicationSyncGrant({release,window:w,session:{identity:()=>({uid:owner,epoch:1})},db:{},firestore:f,onRenew:()=>renewed++});
 try{const pending=grant.refresh();grant.assert();assert.equal(renewed,1);answer.resolve(proof);await pending;grant.assert();assert.equal(renewed,1);
  const failed=grant.refresh();grant.assert();answer.reject(Error('synthetic network loss'));await assert.rejects(failed,/network loss/);assert.throws(()=>grant.assert(),/UNCONFIRMED/);
  const recovered=grant.refresh();answer.resolve(proof);await recovered;
  grant.assert();assert.equal(renewed,2,'only recovery wakes synchronization');
 }finally{grant.close();}
});
test('public activation packaging verifies the candidate Rules hash and signature, never activates or signs for the owner',async()=>{
 const crypto=await import('node:crypto'),vm=await import('node:vm'),{reviewApplicationRelease}=require('../application-release-package.js'),{applicationRules}=require('./application-rules.js');
 const rules=applicationRules(),rulesSha256=crypto.createHash('sha256').update(rules).digest('hex');assert.equal(fs.readFileSync(new URL('./application-owner.rules',import.meta.url),'utf8'),rules);
 const f=await fixture({rulesSha256}),input={trustedKeySha256:f.trustedKeySha256,envelope:{...f.envelope,publicKeySpki:[...f.envelope.publicKeySpki],signature:[...f.envelope.signature]}};
 const result=await reviewApplicationRelease(input),w={};vm.runInNewContext(result.source,{window:w,Uint8Array,Object});assert.equal(result.rulesSha256,rulesSha256);
 assert.equal(assertApplicationRelease(await verifyApplicationRelease({...w.FC_APPLICATION_RELEASE,origin})).ownerUid,owner);
 await assert.rejects(reviewApplicationRelease({...input,envelope:{...input.envelope,privateKey:'forbidden'}}),/APPROVAL_REQUIRED/);
 await assert.rejects(reviewApplicationRelease({...input,envelope:{...input.envelope,signature:Array(64).fill(0)}}),/SIGNATURE_INVALID/);
});

test('explicit project Save may pin only confirmed newer catalogs; uncertain globals retain the old dependency boundary',async()=>{
 const {createApplicationCommitter}=await import('../../sync/application-replication.mjs');
 const oldModel={materials:[{id:'old-material'}]},newModel={materials:[...oldModel.materials,{id:'new-material'}]},pin={head:{revisionId:'old'},model:oldModel};
 const rows={fc_projects_v1:'[{"id":"p"}]',fc_investors_v1:'[{"id":"i"}]',fc_quote_snapshots_v1:'[]'},original=structuredClone(pin);let saved,uncertain=false;
 const document={payload:{project:{id:'p'},investor:{id:'i'}}},p={build:async()=>({document}),dependencies:()=>[{domain:'material',reference:'new-material'}]};
 const g={sources:{materials:['primary']},validateBundle(){}};
 const store={readApplication:async()=>({version:1,rows}),snapshot:async scope=>scope==='globals'?{replica:{base:{revisionId:'new'},dirty:false,json:JSON.stringify(newModel)},operations:uncertain?[{phase:'uncertain'}]:[]}:{replica:{version:1,json:JSON.stringify({globals:pin}),editor:{active:true}},operations:[]},commit:async request=>{saved=request;return {localConfirmed:true};}};
 const c=createApplicationCommitter({store,globalContract:g,projectContract:p,channel:()=>({kind:'project'})});
 await c.commit('project',{expectedVersion:1,rows},'p');assert.equal(saved.value.globals.head.revisionId,'new');assert.deepEqual(pin,original);
 uncertain=true;saved=null;await assert.rejects(c.commit('project',{expectedVersion:1,rows},'p'),/LF_PROJECT_DEPENDENCY_MISSING/);assert.equal(saved,null);
 const bad={...rows,fc_materials_v1:'[{"id":"foreign"}]',primary:'[{"id":"owned"}]'};
 await assert.rejects(c.commit('globals',{expectedVersion:1,rows:bad}),/LF_LEGACY_MATERIAL_COPY_CONFLICT/);assert.equal(saved,null);
});


test('P0-B signed release binds the room registry and preserved legacy policy; old approvals stay unchanged',async()=>{
 const fields={protocol:3,profile:'business-room-v1',registry:'p0b-rooms-v1',legacyDataPolicy:'preserve-outside-registry'};
 const input=await fixture(fields),release=await verifyApplicationRelease(input);
 assert.equal(assertApplicationRelease(release).registry,'p0b-rooms-v1');
 for(const change of [{registry:'legacy'},{legacyDataPolicy:'delete'},{profile:'business-project-v1'},{protocol:2}])
  await assert.rejects(verifyApplicationRelease(await fixture({...fields,...change})),/APPROVAL_REQUIRED/);
 const old=await verifyApplicationRelease(await fixture());assert.equal(assertApplicationRelease(old).protocol,2);
 const mutated={...input.envelope.decision,rulesSha256:'b'.repeat(64)};
 await assert.rejects(verifyApplicationRelease({...input,envelope:{...input.envelope,decision:mutated}}),/SIGNATURE_INVALID/);
});


const roomApproval={protocol:3,profile:'business-room-v1',registry:'p0b-rooms-v1',legacyDataPolicy:'preserve-outside-registry'};
function syntheticLiveConnection(){
 const app={options:{projectId:'mebleszek-meble-app'}},identity={uid:owner,epoch:1};let valid=true;
 return {db:{app,_databaseId:{projectId:'mebleszek-meble-app',database:'(default)'},_settings:{host:'firestore.googleapis.com',ssl:true}},
  auth:{app,currentUser:{uid:owner,emailVerified:true,providerData:[{providerId:'google.com'}]}},session:{identity:()=>({...identity})},
  assertAccess(){if(!valid)throw Error('LF_SYNC_ACCESS_UNCONFIRMED');},lease:{uid:owner,assert(){if(!valid)throw Error('LF_SYNC_ACCESS_UNCONFIRMED');},isValid:()=>valid},
  firestore:{doc:(_db,...parts)=>parts.join('/'),collection:(_db,...parts)=>parts.join('/')},changeEpoch(){identity.epoch++;},expire(){valid=false;}};
}
test('P0-B deployment mode requires a verified room decision before local startup and never trusts a live DEMO flag',async()=>{
 const {applicationP0BMode}=await import('../../sync/application-release.mjs'),{startApplicationRuntime}=await import('../../sync/application-runtime.mjs');
 const w={location:{hostname:'mebleszek.github.io'},document:{baseURI:origin}},options={window:w,name:'meble-local-first-v1',ownerUid:owner};
 const release=await verifyApplicationRelease(await fixture(roomApproval)),old=await verifyApplicationRelease(await fixture());
 assert.equal(applicationP0BMode({...options,release}),true);assert.equal(applicationP0BMode({...options,release:old}),false);
 assert.throws(()=>applicationP0BMode({...options,p0bDemo:true}),/EMULATOR_REQUIRED/);
 assert.throws(()=>applicationP0BMode({...options,release:old,p0bDemo:true}),/EMULATOR_REQUIRED/);
 assert.throws(()=>applicationP0BMode({...options,release:{protocol:3}}),/APPROVAL_REQUIRED/);
 assert.throws(()=>applicationP0BMode({...options,release,localOnly:true}),/LOCAL_MODE_REQUIRED/);
 assert.throws(()=>applicationP0BMode({...options,release,ownerUid:'foreign'}),/OWNER_CHANGED/);
 const writer=syntheticLiveConnection(),reader=syntheticLiveConnection(),permit=authorizeApplicationSession({release:old,writer,reader});
 try{await assert.rejects(startApplicationRuntime({...options,release,writer,reader}),/P0B_REGISTRY_REQUIRED/);}finally{permit.revoke();}
});
test('P0-B live adapters require the room capability and retain revocation, Google identity and lease checks without I/O',async()=>{
 const {assertP0BConnection}=await import('../../sync/firebase-activation.mjs'),{p0bConnection}=await import('../../sync/application-p0b-domain.mjs');
 const {createQuoteChannel}=await import('../../sync/local-first-quote-channel.mjs');
 const writer=syntheticLiveConnection(),reader=syntheticLiveConnection();
 assert.throws(()=>p0bConnection(writer),/P0B_REGISTRY_REQUIRED/);
 const old=authorizeApplicationSession({release:await verifyApplicationRelease(await fixture()),writer,reader});
 assert.throws(()=>p0bConnection(writer),/P0B_REGISTRY_REQUIRED/);
 await assert.rejects(createQuoteChannel({writer,reader,ownerUid:owner,investorId:'investor'}),/P0B_REGISTRY_REQUIRED/);old.revoke();
 const permit=authorizeApplicationSession({release:await verifyApplicationRelease(await fixture(roomApproval)),writer,reader});
 const mapped=p0bConnection(writer);assert.equal(assertP0BConnection(mapped).uid,owner);
 assert.equal(mapped.firestore.doc(mapped.db,'users',owner,'localFirstProjects','room'),'users/'+owner+'/p0bRoomProjects/room');
 assert.equal(mapped.firestore.collection(mapped.db,'users',owner,'localFirstInvestors'),'users/'+owner+'/p0bRoomInvestors');
 assert.equal(mapped.firestore.doc(mapped.db,'users',owner,'globalData','current'),'users/'+owner+'/globalData/current');
 assert.throws(()=>assertP0BConnection({...mapped}),/P0B_REGISTRY_REQUIRED/);
 const quote=await createQuoteChannel({writer,reader,ownerUid:owner,investorId:'investor'});quote.guard();
 writer.auth.currentUser.emailVerified=false;assert.throws(()=>assertP0BConnection(mapped),/LIVE_IDENTITY_INVALID/);writer.auth.currentUser.emailVerified=true;
 writer.db._settings.host='127.0.0.1:18080';assert.throws(()=>assertP0BConnection(mapped),/LIVE_IDENTITY_INVALID/);writer.db._settings.host='firestore.googleapis.com';
 writer.expire();assert.throws(()=>assertP0BConnection(mapped),/SYNC_ACCESS_UNCONFIRMED/);
 permit.revoke();assert.throws(()=>assertP0BConnection(mapped),/P0B_REGISTRY_REQUIRED/);assert.throws(()=>quote.guard(),/P0B_REGISTRY_REQUIRED/);
 const a=syntheticLiveConnection(),b=syntheticLiveConnection(),p=authorizeApplicationSession({release:await verifyApplicationRelease(await fixture(roomApproval)),writer:a,reader:b});
 a.changeEpoch();assert.throws(()=>assertP0BConnection(a),/AUTH_CHANGED/);p.revoke();
});
test('P0-B offline packaging binds the exact Rules and signed public candidate without deployment',async()=>{
 const {createHash}=await import('node:crypto'),{reviewApplicationRelease}=require('../application-release-package.js');
 const rules=require('./p0b-application-rules.js').p0bApplicationRules({normal:true});
 assert.equal(fs.readFileSync(new URL('./application-p0b-owner.rules',import.meta.url),'utf8'),rules);
 const rulesSha256=createHash('sha256').update(rules).digest('hex'),f=await fixture({...roomApproval,rulesSha256});
 const input={trustedKeySha256:f.trustedKeySha256,envelope:{...f.envelope,publicKeySpki:[...f.envelope.publicKeySpki],signature:[...f.envelope.signature]}};
 const reviewed=await reviewApplicationRelease(input);assert.equal(reviewed.rulesSha256,rulesSha256);
 const w={};require('node:vm').runInNewContext(reviewed.source,{window:w,Uint8Array,Object});
 assert.equal(assertApplicationRelease(await verifyApplicationRelease({...w.FC_APPLICATION_RELEASE,origin})).profile,'business-room-v1');
 const bad=await fixture({...roomApproval,rulesSha256:'f'.repeat(64)});
 await assert.rejects(reviewApplicationRelease({trustedKeySha256:bad.trustedKeySha256,envelope:{...bad.envelope,publicKeySpki:[...bad.envelope.publicKeySpki],signature:[...bad.envelope.signature]}}),/RULES_PACKAGE_MISMATCH/);
 const slot=fs.readFileSync(new URL('../../js/app/cloud/application-release.js',import.meta.url),'utf8'),actual={};
 require('node:vm').runInNewContext(slot,{window:actual,Uint8Array,Object});
 const a=actual.FC_APPLICATION_RELEASE,inputActual={trustedKeySha256:a.trustedKeySha256,envelope:{decision:a.envelope.decision,publicKeySpki:[...a.envelope.publicKeySpki],signature:[...a.envelope.signature]}};
 assert.equal((await reviewApplicationRelease(inputActual)).source,slot);
 assert.equal(assertApplicationRelease(await verifyApplicationRelease({...a,origin})).rulesSha256,rulesSha256);
 await assert.rejects(verifyApplicationRelease({...a,origin,trustedKeySha256:'e3a45a1ef604058306955a6598ac7fd6d8d2bfb2682de53726895e4295a20284'}),/OWNER_TRUST_REQUIRED/);
});

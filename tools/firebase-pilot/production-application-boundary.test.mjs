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
 const trustedKeySha256='e3a45a1ef604058306955a6598ac7fd6d8d2bfb2682de53726895e4295a20284';
 assert.equal(deployed.trustedKeySha256,trustedKeySha256);
 const approved=assertApplicationRelease(await verifyApplicationRelease({...deployed,trustedKeySha256,origin}));
 assert.equal(approved.ownerUid,'ByBPVVNXx3fUDUmTg5yTSNVveH23');assert.equal(approved.activationId,'meble-app-20261102-01');
 assert.equal(approved.rulesSha256,createHash('sha256').update(require('./application-rules.js').applicationRules()).digest('hex'));
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
 const now=Date.now;try{Date.now=()=>now()+172800000;assert.equal(assertApplicationConnection(writer).uid,owner);}finally{Date.now=now;}
 valid=false;assert.throws(()=>assertApplicationConnection(writer),/SYNC_ACCESS_UNCONFIRMED/);valid=true;permit.revoke();assert.throws(()=>assertApplicationConnection(writer),/ACTIVATION_REQUIRED/);
});
test('routine sync grant requires a fresh server transaction and exact activation, uncertainty is a refusal',async()=>{
 const release=await verifyApplicationRelease(await fixture()),w=new EventTarget();w.navigator={onLine:true};w.document=Object.assign(new EventTarget(),{hidden:false});let calls=0;
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
 const release=await verifyApplicationRelease(await fixture()),w=new EventTarget();w.navigator={onLine:true};w.document=Object.assign(new EventTarget(),{hidden:false});let requests=0,renewed=0,answer;
 const proof={exists:()=>true,metadata:{fromCache:false,hasPendingWrites:false},data:()=>({schemaVersion:1,activationId:'synthetic-release'})};
 const f={doc:()=>({}),runTransaction:async()=>{requests++;return requests===1?proof:new Promise((resolve,reject)=>{answer={resolve,reject};});}};
 const grant=await createApplicationSyncGrant({release,window:w,session:{identity:()=>({uid:owner,epoch:1})},db:{},firestore:f,onRenew:()=>renewed++});
 try{const pending=grant.refresh();grant.assert();assert.equal(renewed,1);answer.resolve(proof);await pending;grant.assert();assert.equal(renewed,2);
  const failed=grant.refresh();grant.assert();answer.reject(Error('synthetic network loss'));await assert.rejects(failed,/network loss/);assert.throws(()=>grant.assert(),/UNCONFIRMED/);
  w.document.hidden=true;w.dispatchEvent(new Event('pagehide'));
  w.document.dispatchEvent(new Event('visibilitychange'));assert.equal(requests,3);
  w.document.hidden=false;w.document.dispatchEvent(new Event('visibilitychange'));w.dispatchEvent(new Event('pageshow'));
  assert.equal(requests,4,'foreground events share the same proof request');
  assert.throws(()=>grant.assert(),/UNCONFIRMED/);
  answer.resolve(proof);await grant.refresh();grant.assert();assert.equal(renewed,3);
 }finally{grant.close();}
 w.dispatchEvent(new Event('pageshow'));assert.equal(requests,4);
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

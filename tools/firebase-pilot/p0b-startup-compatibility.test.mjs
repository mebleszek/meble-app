import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import * as f from 'firebase/firestore';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {inspectP0BApplicationCompatibility} from './p0b-startup-compatibility.mjs';
import {createP0BProtocol,inspectP0BCompatibility} from './p0b-protocol.mjs';
import {runNormalApplication} from './normal-application.cases.mjs';
const {p0bApplicationRules}=createRequire(import.meta.url)('./p0b-application-rules.js');
const uid='synthetic-p0b-audit-owner';
const claims={email_verified:true,firebase:{sign_in_provider:'google.com'}};
function connection(db,ownerUid){
 return {db:db._delegate||db,firestore:f,assertAccess(){},
  session:{identity:()=>({uid:ownerUid,epoch:1})},
  auth:{app:(db._delegate||db).app,emulatorConfig:{host:'127.0.0.1',port:19099,protocol:'http'},
   currentUser:{uid:ownerUid,providerData:[{providerId:'google.com'}]}}};
}
test('P0-B compatibility: hidden legacy head cannot be certified by a complete-looking registry',async t=>{
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');
 const env=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,rules:p0bApplicationRules()}});
 t.after(()=>env.cleanup());
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  await f.setDoc(f.doc(db,'syncConfig','owner'),{ownerUid:uid,activationId:'p0b-demo',schemaVersion:1});
  await f.setDoc(f.doc(db,'syncAccess',uid),{activationId:'p0b-demo',schemaVersion:1});
  await f.setDoc(f.doc(db,'appAccess',uid),{schemaVersion:1});
  await f.setDoc(f.doc(db,'authorizedUsers',uid),{appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1});
  // A fresh isolated legacy fixture, never an import or conversion of user data.
  await f.setDoc(f.doc(db,'users',uid,'localFirstProjects','unregistered-old-project'),
   {ownerUid:uid,investorId:'legacy-investor',projectId:'unregistered-old-project',opaque:{exact:17.125}});
 });
 const db=env.authenticatedContext(uid,claims).firestore(),reader=connection(db,uid);
 const protocol=createP0BProtocol(reader,'audit-only');
 await protocol.createInvestor('new-investor',{id:'new-investor',name:'Fresh DEMO',unknown:{exact:7.125}});
 const records=await protocol.listInvestors(),heads=await protocol.listProjectHeads();
 assert.equal(heads.length,0);
 // Previous utility only checks the supplied subset. It is no completeness proof.
 assert.deepEqual(inspectP0BCompatibility({records,projectHeads:heads,snapshots:[]}),[]);
 const before=await protocol.investor('new-investor');
 const rows={fc_investors_v1:JSON.stringify([before.contact]),fc_projects_v1:'[]'};
 const original=structuredClone(rows);
 const result=await inspectP0BApplicationCompatibility({reader,ownerUid:uid,rows});
 assert.equal(result.status,'BLOCKED');
 assert.deepEqual(result.coverage,{registry:true,legacyProjects:false});
 assert.deepEqual(result.issues,[{code:'LF_P0B_LEGACY_INVENTORY_UNCONFIRMED',reason:'permission-denied'}]);
 assert.deepEqual(rows,original);
 assert.deepEqual(await protocol.investor('new-investor'),before);
 await assertFails(f.getDocFromServer(f.doc(db,'users',uid,'localFirstProjects','unregistered-old-project')));
 await assertFails(f.setDoc(f.doc(db,'users',uid,'localFirstEditors','old-writer'),
  {ownerUid:uid,projectId:'old-writer',deviceId:'old-device',epoch:1,active:true,headRevision:''}));
 await env.withSecurityRulesDisabled(async context=>{
  const legacy=(await f.getDoc(f.doc(context.firestore(),'users',uid,'localFirstProjects','unregistered-old-project'))).data();
  assert.deepEqual(legacy,{ownerUid:uid,investorId:'legacy-investor',projectId:'unregistered-old-project',opaque:{exact:17.125}});
 });
 t.diagnostic('READ_ONLY PASS: registry readable, legacy inventory denied, no implicit registration, migration or deletion');
});
async function runStartupDiagnostic(t,deployment){
 await runNormalApplication(t,{deployment,p0bDemo:true,
  async startupProbe({phone,configure,env,source,ownerUid}){
   const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'meble-p0b-startup-evidence-'));
   await phone.page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
   try{
   await configure(phone);
   await phone.page.reload();
   await phone.page.evaluate(()=>window.normalReleaseReady);
   await phone.page.click('#auth-google');
   await phone.page.waitForFunction(()=>['profile-pending','error'].includes(document.body.dataset.authState)||document.body.dataset.businessState==='ready');
   if(await phone.page.locator('#auth-profile-admission').isVisible()){
    await phone.page.check('#auth-profile-backup');await phone.page.check('#auth-profile-owner');await phone.page.click('#auth-profile-confirm');
   }
   await phone.page.waitForFunction(()=>document.body.dataset.authState==='error'||document.body.dataset.businessState==='ready');
   const observed=await phone.page.evaluate(()=>({
    business:document.body.dataset.businessState,auth:document.body.dataset.authState,
    phase:window.FC.applicationStartup.inspect(),errors:window.normalSdkErrors,
    source:{projects:window.readNormalSource('fc_projects_v1'),investors:window.readNormalSource('fc_investors_v1')}
   }));
   fs.writeFileSync(path.join(evidence,'startup.json'),JSON.stringify(observed,null,2));
   t.diagnostic(JSON.stringify({functionalStartup:observed.business==='ready'?'FALSE_READY':'REFUSED',deployment,
    sdkErrors:observed.errors?.map(({method,code})=>({method,code})),phase:observed.phase}));
   assert.notEqual(observed.business,'ready','No false ready state for an unintegrated protocol');
   assert.equal(observed.auth,'error');
   assert.ok(observed.errors.some(error=>error.method==='getDocsFromServer'&&error.code==='permission-denied'),JSON.stringify(observed));
   assert.deepEqual(observed.source,source,'Preserved RAW must not be converted after failed startup');
   const db=env.authenticatedContext(ownerUid,claims).firestore();
   const report=await inspectP0BApplicationCompatibility({reader:connection(db,ownerUid),ownerUid,
    rows:{fc_investors_v1:source.investors,fc_projects_v1:source.projects}});
   assert.equal(report.status,'BLOCKED');
   assert.ok(report.issues.some(issue=>issue.code==='LF_P0B_LEGACY_INVENTORY_UNCONFIRMED'));
   const registry=await f.getDocsFromServer(f.query(f.collection(db,'users',ownerUid,'localFirstInvestors'),f.limit(100)));
   assert.equal(registry.size,0,'No automatic migration of the synthetic source');
   t.diagnostic(JSON.stringify({functionalStartup:'BLOCKED',deployment,firstCode:observed.phase.firstCode||observed.phase.code,
    sdkErrors:observed.errors.map(({method,code})=>({method,code})),compatibility:report}));
   }finally{
    const diagnostic=await phone.page.evaluate(()=>({business:document.body.dataset.businessState,auth:document.body.dataset.authState,
     phase:window.FC.applicationStartup?.inspect(),pendingRpc:window.normalPendingRpc,timeline:window.normalRpcTimeline,
     sdkErrors:window.normalSdkErrors?.map(({method,code})=>({method,code})),budget:window.normalReadBudget}));
    fs.writeFileSync(path.join(evidence,'diagnostic.json'),JSON.stringify(diagnostic,null,2));
    t.diagnostic(JSON.stringify(diagnostic));
    await phone.page.screenshot({path:path.join(evidence,'startup.png'),fullPage:true});
    await phone.page.context().tracing.stop({path:path.join(evidence,'startup.zip')});
    t.diagnostic('Evidence: '+evidence);
   }
  }
 });
}
test('P0-B normal startup diagnostic: old discovery is refused by candidate Rules',t=>runStartupDiagnostic(t,false));
test('P0-B signed startup diagnostic: old discovery is refused by candidate Rules',t=>runStartupDiagnostic(t,true));

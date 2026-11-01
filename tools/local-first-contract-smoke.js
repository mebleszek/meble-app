'use strict';
// Targeted offline boundaries; real IDB/SDK scenarios live in separate CI suites.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture}=require('./project-selective-export-smoke.js');
const root=path.resolve(__dirname,'..'),clone=v=>JSON.parse(JSON.stringify(v));
async function main(){
 const {json,digest,canonical}=await import('../sync/local-first-values.mjs');
 const {authorizeGlobalFirebase,assertGlobalConnection,authorizeApplicationFirebase,assertApplicationConnection}=await import('../sync/firebase-activation.mjs');
 const {validateProjectDependencies,protectProjectRows}=await import('../sync/local-first-project.mjs');
 const {runtime,model,seed}=await import('./firebase-pilot/cloud-sync-fixture.mjs');
 const r=runtime(),c=r.FC.globalDataContract,value=model();
 value.labor.push({id:'synthetic-lf-task',name:'Synthetic task',pricingMode:'perUnit',price:7.125});
 const exact={id:'stable',price:21.375,unknown:{keep:[1,'raw',null]}};
 assert.deepEqual(JSON.parse(json(exact)),exact);
 for(const invalid of [undefined,NaN,{missing:undefined},new Date(),Array(1)])assert.throws(()=>json(invalid),/LF_VALUE_INVALID/);
 const cycle={};cycle.self=cycle;assert.throws(()=>json(cycle),/LF_VALUE_INVALID/);
 assert.equal((await digest(json(exact))).length,64);
 console.log('PASS LOCAL-FIRST contracts: exact JSON and refusal of lossy values');
 seed(r,value);const company=clone(value.company);company.transport.apiKey='SYNTHETIC-NEVER-SEND';r.rows.set(c.sources.company[0],JSON.stringify(company));
 r.rows.set('fc_quote_snapshots_v1','SYNTHETIC-HISTORY');r.rows.set('fc_data_backups_v1','SYNTHETIC-BACKUP');
 const before=[...r.rows],captured=c.capture(r.storage,Object.keys(c.schemas));captured.assertUnchanged();
 assert.equal(Object.keys(captured.model).length,14);assert.deepEqual(clone(captured.model),value);
 assert.equal(JSON.stringify(await c.pack('synthetic-owner',captured.model)).includes(company.transport.apiKey),false);
 assert.deepEqual([...r.rows],before);assert.deepEqual(r.calls,[]);
 console.log('PASS LOCAL-FIRST contracts: 14 RAW domains, secret exclusion and untouched history/backup');
 const p=fixture(),built=await p.build();assert.equal(built.ok,true);
 for(const dep of p.FC.projectExportContract.dependencies(built.document.payload).filter(x=>x.domain==='material'))
  if(!value.materials.some(x=>[x.id,x.name,x.materialType].includes(dep.reference)))value.materials.push({id:'required-'+value.materials.length,name:dep.reference,materialType:'synthetic',price:12.375,priceUnit:'sheet'});
 assert.ok(validateProjectDependencies(p.FC.projectExportContract,c,built.document,value).length>0);
 const missing=clone(value);delete missing.stock;assert.throws(()=>validateProjectDependencies(p.FC.projectExportContract,c,built.document,missing),/GLOBAL_BUNDLE_INCOMPLETE/);
 p.storage.rows.set('fc_quote_snapshots_v1','SYNTHETIC-HISTORY');const protectedBefore=p.rows();
 const protection=protectProjectRows(p.storage);
 assert.deepEqual(protection.blockers,['LF_PROJECT_OWNERSHIP_PENDING']);
 assert.deepEqual(protection.protectedRows,{fc_projects_v1:protectedBefore.fc_projects_v1,fc_investors_v1:protectedBefore.fc_investors_v1,fc_quote_snapshots_v1:'SYNTHETIC-HISTORY'});
 assert.deepEqual(p.rows(),protectedBefore);
 console.log('PASS LOCAL-FIRST contracts: real native project dependencies and explicit ownership blocker');
 const received=fixture();received.mutate(row=>{row.projectData=clone(built.document.payload.project.projectData);});
 const drawing=x=>clone(x.FC.cabinetCutlist.getCabinetCutList(x.s.projectData.kuchnia.cabinets[0],'kuchnia'));
 assert.deepEqual(drawing(received),drawing(p));
 for(const x of [p,received])for(const n of ['labor-catalog-definitions','labor-catalog'])vm.runInContext(fs.readFileSync(path.join(root,'js/app/pricing/'+n+'.js'),'utf8'),x.s);
 const packed=await c.pack('synthetic-owner',captured.model),decoded=await c.unpack('synthetic-owner',packed.directory,packed.records);
 const quote=(x,data)=>clone(x.FC.laborCatalog.calculateDefinition(data.labor.find(row=>row.id==='synthetic-lf-task'),{quantity:3}));
 assert.equal(quote(received,decoded.model).total,21.375);assert.deepEqual(quote(received,decoded.model),quote(p,captured.model));
 console.log('PASS LOCAL-FIRST contracts: native RYSUNEK and complete labor calculation remain identical');
 let requests=0;await assert.rejects(authorizeGlobalFirebase({request:async()=>{requests++;throw Error('No network allowed');}}),/LF_SEPARATE_ACTIVATION_REQUIRED/);
 assert.throws(()=>assertGlobalConnection({db:{app:{options:{projectId:'mebleszek-meble-app'}}}}),/LF_PRODUCTION_ACTIVATION_REQUIRED/);assert.equal(requests,0);
 for(const file of ['index.html','js/main-login.js','tools/index-load-groups.js'])assert.equal(fs.readFileSync(path.join(root,file),'utf8').includes('local-first'),false);
 console.log('PASS LOCAL-FIRST contracts: production activation refused before network; startup unchanged');
 // Synthetic ephemeral authority, fabricated identities and injected HTTP only.
 // No real owner key, token, Firebase connection or executable LIVE decision.
 const keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
 const spki=new Uint8Array(await crypto.subtle.exportKey('spki',keys.publicKey));
 const ownerKeySha256=Buffer.from(await crypto.subtle.digest('SHA-256',spki)).toString('hex');
 const release={name:'projects/mebleszek-meble-app/releases/cloud.firestore',rulesetName:'projects/mebleszek-meble-app/rulesets/synthetic'},ruleset={name:'projects/mebleszek-meble-app/rulesets/synthetic',source:{files:[{name:'firestore.rules',content:'synthetic source only'}]}};
 const decision={domain:'MEBLE_LOCAL_FIRST_ACTIVATION_v1',scope:'global-data-sync',projectId:'mebleszek-meble-app',database:'(default)',
  ownerUid:'synthetic-owner',deviceId:'synthetic-phone',instanceId:'synthetic-install',databaseName:'meble-lf-test-activation',expiresAt:Date.now()+60000,
  migrationApproved:true,sourcePreserved:true,productionRulesApproved:true,artifactSha256:'a'.repeat(64),baselineHash:await digest(json(captured.model)),
  expectedRelease:release,rulesSourceHash:await digest(canonical(ruleset.source))};
 const signature=new Uint8Array(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode(canonical(decision))));
 const connection=()=>{const app={options:{projectId:'mebleszek-meble-app'}};return{db:{app,_databaseId:{projectId:'mebleszek-meble-app',database:'(default)'},_settings:{host:'firestore.googleapis.com',ssl:true}},
  auth:{app,currentUser:{uid:decision.ownerUid,emailVerified:true,providerData:[{providerId:'google.com'}]}},session:{identity:()=>({uid:decision.ownerUid,epoch:1})},lease:{uid:decision.ownerUid,assert(){},isValid:()=>true}};};
 const options={decision,signature,publicKeySpki:spki,ownerKeySha256,artifactSha256:decision.artifactSha256,
  writer:connection(),reader:connection(),source:r.storage,contract:c,store:{name:decision.databaseName,ownerUid:decision.ownerUid,deviceId:decision.deviceId,instanceId:decision.instanceId,
   snapshot:async()=>({replica:{json:json(captured.model),dirty:false},operations:[]})},rulesAccessToken:'SYNTHETIC-NOT-A-CREDENTIAL',
  request:async url=>{requests++;return{status:200,json:async()=>url.endsWith('/releases/cloud.firestore')?release:ruleset};}};
 await assert.rejects(authorizeGlobalFirebase({...options,signature:new Uint8Array(64)}),/LF_OWNER_SIGNATURE_INVALID/);assert.equal(requests,0);
 await assert.rejects(authorizeGlobalFirebase({...options,artifactSha256:'b'.repeat(64)}),/LF_SEPARATE_ACTIVATION_REQUIRED/);assert.equal(requests,0);
 const foreign=connection();foreign.auth.currentUser.uid='foreign';await assert.rejects(authorizeGlobalFirebase({...options,writer:foreign}),/LF_LIVE_IDENTITY_INVALID/);assert.equal(requests,0);
 await assert.rejects(authorizeGlobalFirebase({...options,request:async url=>({status:200,json:async()=>url.endsWith('/releases/cloud.firestore')?release:{...ruleset,source:{files:[]}}})}),/LF_RULES_CHANGED/);
 const permit=await authorizeGlobalFirebase(options);assert.equal(requests,3);assert.equal(assertGlobalConnection(options.writer).uid,decision.ownerUid);
 assert.throws(()=>assertApplicationConnection(options.writer),/LF_APPLICATION_ACTIVATION_REQUIRED/);
 permit.revoke();assert.throws(()=>assertGlobalConnection(options.writer),/LF_PRODUCTION_ACTIVATION_REQUIRED/);

 // A distinct signed application scope binds the whole migrated image. A
 // global-only grant, changed image, absent exclusivity or bad signature cannot
 // authorize project channels. All RPCs below are injected synthetic responses.
 const applicationDecision={...decision,scope:'application-data-sync',projectProfile:'business-project-v1',globalDomains:14,
  oldWritersExcluded:true,applicationImageHash:'c'.repeat(64)};
 const sign=async value=>new Uint8Array(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode(canonical(value))));
 const applicationOptions={...options,decision:applicationDecision,signature:await sign(applicationDecision),
  store:{...options.store,readApplication:async()=>({hash:'c'.repeat(64)})}};
 requests=0;
 await assert.rejects(authorizeApplicationFirebase({...applicationOptions,decision:{...applicationDecision,oldWritersExcluded:false}}),/LF_APPLICATION_CUTOVER_NOT_PROVEN/);
 await assert.rejects(authorizeApplicationFirebase({...applicationOptions,signature:new Uint8Array(64)}),/LF_OWNER_SIGNATURE_INVALID/);
 await assert.rejects(authorizeApplicationFirebase({...applicationOptions,store:{...applicationOptions.store,readApplication:async()=>({hash:'d'.repeat(64)})}}),/LF_APPLICATION_CUTOVER_NOT_PROVEN/);
 assert.equal(requests,0);
 const applicationPermit=await authorizeApplicationFirebase(applicationOptions);assert.equal(requests,3);
 assert.equal(assertApplicationConnection(options.writer).uid,decision.ownerUid);
 applicationPermit.revoke();assert.throws(()=>assertApplicationConnection(options.writer),/LF_APPLICATION_ACTIVATION_REQUIRED/);
 console.log('PASS application activation: separate signature, image, owner, Rules, exclusivity statement and revocation');
 console.log('PASS LOCAL-FIRST activation contract: signature, artifact, UID, Rules source and revocation (offline synthetic inputs)');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};

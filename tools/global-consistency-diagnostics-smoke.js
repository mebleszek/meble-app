'use strict';
const assert=require('node:assert/strict'),{fixture,existingImage,clone}=require('./helpers/global-diagnostics-fixture');
const tests=[],test=(name,fn)=>tests.push([name,fn]),secret='PRIVATE_PRICE_UID_TOKEN_RAW_NAME';
function anonymous(value){assert.equal(JSON.stringify(value).includes(secret),false);assert.doesNotMatch(JSON.stringify(value),/private-owner|private-device|private-instance|PRIVATE_OUTBOX_PRICE/);}
test('all 14 domains and exactly 7 pairs are visited without writes or first-conflict short circuit',()=>{
 const r=fixture(),before=[...r.rows],seen=[];const report=clone(r.data.inspect(k=>{seen.push(k);return r.storage.getItem(k);}));
 assert.equal(report.domains.length,14);assert.equal(report.domains.filter(d=>d.keys.length===2).length,7);assert.deepEqual(seen,Object.values(r.c.sources).flat());
 for(const row of report.domains)assert.equal(row.status,row.keys.length===2?'EQUAL':'PRESENT');
 assert.deepEqual([...r.rows],before);assert.deepEqual(r.calls,[]);
 for(const [d,keys]of Object.entries(r.c.sources))if(keys.length===2){const raw=JSON.parse(r.rows.get(keys[1]));if(Array.isArray(raw))raw.push(typeof raw[0]==='string'?'EXTRA':{...raw[0],id:'extra'});else raw.defaultVatRate=8;r.rows.set(keys[1],JSON.stringify(raw));}
 assert.equal(r.report().domains.filter(d=>d.status==='DIFFERENT').length,7);assert.throws(()=>r.c.capture(r.storage,Object.keys(r.c.sources)),e=>e.code==='GLOBAL_ALIAS_CONFLICT'&&e.path==='materials');
});
test('each pair distinguishes equal semantic values, raw formatting, differences, all missing/read/JSON/schema states',()=>{
 for(const [domain,keys]of Object.entries(fixture().c.sources))if(keys.length===2){
  for(const mode of ['raw-only','different','primary-missing','alias-missing','both-missing','invalid-json-primary','invalid-json-alias','schema-primary','schema-alias','read-primary','read-alias']){
   const r=fixture(),beforeCalls=r.calls.length;let blocked;
   if(mode==='raw-only')r.rows.set(keys[1],JSON.stringify(JSON.parse(r.rows.get(keys[0])),null,2));
   if(mode==='different'){
    const value=JSON.parse(r.rows.get(keys[1]));if(Array.isArray(value)){if(typeof value[0]==='string')value.push('EXTRA');else value[0]={...value[0],[Object.hasOwn(value[0],'name')?'name':'label']:secret};}else value.defaultVatRate=8;r.rows.set(keys[1],JSON.stringify(value));
   }
   if(mode==='primary-missing'||mode==='both-missing')r.rows.delete(keys[0]);if(mode==='alias-missing'||mode==='both-missing')r.rows.delete(keys[1]);
   if(mode.startsWith('invalid-json'))r.rows.set(keys[mode.endsWith('primary')?0:1],'{'+secret);
   if(mode.startsWith('schema-')){const key=keys[mode.endsWith('primary')?0:1],value=JSON.parse(r.rows.get(key));if(Array.isArray(value))value[0]=typeof value[0]==='string'?{}:{...value[0],[secret]:secret};else value[secret]=secret;r.rows.set(key,JSON.stringify(value));}
   if(mode.startsWith('read-'))blocked=keys[mode.endsWith('primary')?0:1];
   const report=clone(r.data.inspect(k=>{if(k===blocked)throw Object.assign(Error(secret),{code:secret});return r.storage.getItem(k);})),row=r.row(report,domain);
   const expected=mode==='raw-only'?'EQUAL':mode==='different'?'DIFFERENT':mode==='both-missing'?'BOTH_MISSING':mode.endsWith('missing')?'ONE_MISSING':mode.startsWith('invalid-json')?'INVALID_JSON':mode.startsWith('schema-')?'INVALID_SCHEMA':'UNREADABLE';
   assert.equal(row.status,expected,domain+' '+mode);if(mode==='raw-only'){assert.equal(row.raw,'DIFFERENT');assert.equal(row.semantic,'EQUAL');assert.equal(row.discrepancy,'RAW_ONLY');}
   assert.equal(report.domains.length,14);anonymous(report);assert.equal(r.calls.length,beforeCalls);
  }
 }
});
test('all domains independently report absence/unknown fields and material history is never projected or normalized',()=>{
 for(const [domain,keys]of Object.entries(fixture().c.sources)){
  const r=fixture();for(const key of keys)r.rows.delete(key);assert.equal(r.row(r.report(),domain).status,keys.length===2?'BOTH_MISSING':'SOURCE_MISSING');
  r.rows.set(keys[0],JSON.stringify({[secret]:secret}));assert.equal(r.row(r.report(),domain).status,'INVALID_SCHEMA');anonymous(r.report());
 }
 const r=fixture(),original=r.rows.get(r.c.sources.materials[0]),mixed=JSON.parse(original);mixed.push({id:'extra-hardware',name:secret,materialType:'akcesoria',price:88});
 r.rows.set('fc_materials_v1',JSON.stringify(mixed));const before=[...r.rows];
 r.FC.catalogDomain={splitLegacyMaterials(){assert.fail('No split');}};r.FC.catalogStore=new Proxy({},{get(){assert.fail('No factory/store access');}});
 const row=r.row(r.report(),'materials');assert.equal(row.status,'INVALID_SCHEMA');assert.equal(row.discrepancy,'LEGACY_MIXED_CATALOG');assert.equal(row.semantic,'NOT_COMPARABLE');assert.deepEqual([...r.rows],before);
 assert.equal(r.rows.get('fc_sheet_materials_v1'),original);anonymous(r.report());
});
test('different prices and additional records remain differences; order and unknown fields are not discarded',()=>{
 for(const mode of ['price','record','order','unknown']){
  const r=fixture(),keys=r.c.sources.materials,value=JSON.parse(r.rows.get(keys[1]));
  if(mode==='price')value[0].price+=12.125;if(mode==='record')value.push({...value[0],id:'added'});if(mode==='order')value.reverse();if(mode==='unknown')value[0][secret]=secret;
  r.rows.set(keys[1],JSON.stringify(value));const row=r.row(r.report(),'materials');assert.equal(row.status,mode==='unknown'?'INVALID_SCHEMA':'DIFFERENT');
  if(['record','order'].includes(mode))assert.equal(row.discrepancy,'RECORDS_OR_ORDER');anonymous(row);
 }
});
test('existing dependency validator covers hardware, suppliers, types, parameters, labor and settings; runtime-only checks remain explicit',()=>{
 for(const [domain,edit,code]of [
  ['hardware',v=>v[0].supplierId='missing','GLOBAL_REFERENCE_MISSING'],['hardwareSettings',v=>v.defaultSupplierId='missing','GLOBAL_REFERENCE_MISSING'],
  ['types',v=>v[0].allowedCategories=['missing'],'GLOBAL_REFERENCE_MISSING'],['labor',v=>v[1].rateType='missing','GLOBAL_REFERENCE_MISSING'],
  ['hardware',v=>v[0].bundleItems=[{itemId:v[0].id,qty:1}],'GLOBAL_REFERENCE_CONFLICT'],['technicalParams',v=>v.push({...v[0],id:'other'}),'GLOBAL_DUPLICATE_ID'],
 ]){
  const r=fixture(),v=clone(r.m[domain]);edit(v);for(const k of r.c.sources[domain])r.rows.set(k,JSON.stringify(v));const row=r.row(r.report(),domain);assert.equal(row.validation.status,'INVALID');assert.equal(row.validation.code,code);assert.equal(r.row(r.report(),'materials').validation.status,'VALID');
 }
 const r=fixture();for(const k of r.c.sources.suppliers)r.rows.delete(k);assert.equal(r.row(r.report(),'hardware').validation.code,'DIAG_DEPENDENCY_BLOCKED');
 for(const domain of ['stock','programDefaults'])assert.equal(r.row(r.report(),domain).validation.status,'RUNTIME_REQUIRED','No guessed material/drawer-system resolution or WYCENA proof');
});
test('only the existing known local company credential is excluded; privacy, resource bounds and closed output survive malformed input',()=>{
 const r=fixture(),company=clone(r.m.company);company.transport.apiKey=secret;r.rows.set('fc_company_profile_v1',JSON.stringify(company));
 assert.equal(r.row(r.report(),'company').validation.status,'VALID');anonymous(r.report());company.transport[secret]=secret;r.rows.set('fc_company_profile_v1',JSON.stringify(company));assert.equal(r.row(r.report(),'company').code,'GLOBAL_UNKNOWN_FIELD');
 r.rows.set('fc_materials_v1','x'.repeat(2*1024*1024+1));assert.equal(r.row(r.report(),'materials').status,'BLOCKED');
 r.rows.set('fc_materials_v1','["'+'x'.repeat(2*1024*1024)+'"]');
 require('node:vm').runInContext('globalThis.oversizeParses=0;{const parse=JSON.parse;JSON.parse=raw=>{if(raw.length>2*1024*1024){oversizeParses++;throw Error();}return parse(raw);};}',r.s);
 const comparison=r.data.compare(k=>r.storage.getItem(k),k=>r.storage.getItem(k));assert.equal(r.row(comparison,'materials').status,'BLOCKED');assert.equal(r.s.oversizeParses,0,'Blocked oversized RAW must not be parsed again during cross-image comparison');
 const formatted=r.data.format({status:secret,code:secret,originals:{status:secret,domains:[{domain:'materials',keys:[secret],status:secret,code:secret}]}});assert.equal(formatted.includes(secret),false);
 assert.equal((formatted.match(/Oryginały localStorage/g)||[]).length,1);
});
test('read-only IDB uses exact owner/binding/source/integrity, distinguishes originals from image and leaves uncertain outbox untouched',async()=>{
 const {collectGlobalDiagnostics}=await import('../sync/local-first-global-diagnostics.mjs'),r=await existingImage();
 const v=JSON.parse(r.control.application.rows.fc_sheet_materials_v1);v[0].price+=12.125;
 for(const k of r.c.sources.materials)r.control.application.rows[k]=JSON.stringify(v);await r.rehash();
 const before={source:[...r.rows],control:clone(r.control),queue:clone(r.queue)};
 const report=await collectGlobalDiagnostics(r.args);assert.equal(report.status,'READ_ONLY');assert.equal(r.row(report.originals,'materials').status,'EQUAL');assert.equal(r.row(report.localFirst,'materials').status,'EQUAL');assert.equal(r.row(report.comparison,'materials').status,'DIFFERENT');
 assert.deepEqual([...r.rows],before.source);assert.deepEqual(r.control,before.control);assert.deepEqual(r.queue,before.queue);assert.ok(r.trace.filter(x=>x.startsWith('transaction:')).every(x=>x==='transaction:readonly'));assert.ok(r.connections.every(c=>c.closed));assert.deepEqual(r.calls,[]);anonymous(report);
});
test('missing receipt/DB, wrong owner/binding/version, corrupt image/source and unavailable IDB fail closed without initialization',async()=>{
 const {collectGlobalDiagnostics}=await import('../sync/local-first-global-diagnostics.mjs');
 for(const [mode,code,beforeOpen]of [['receipt','DIAG_RECEIPT_INVALID',true],['owner','DIAG_OWNER_BLOCKED',true],['absent','DIAG_IDB_MISSING',true],['namesError','DIAG_IDB_UNAVAILABLE',true],['version','DIAG_IDB_SCHEMA',true],['binding','DIAG_BINDING_INVALID',false],['badSchema','DIAG_IDB_SCHEMA',false],['source','DIAG_SOURCE_INTEGRITY',false],['image','DIAG_IMAGE_INTEGRITY',false],['missing-image','DIAG_IMAGE_MISSING',false],['upgrade','DIAG_IDB_UNAVAILABLE',false]]){
  const r=await existingImage();if(mode==='receipt')r.rows.set('meble_application_authority_v1','{bad');else if(mode==='owner')r.args.ownerUid='different';else if(mode==='binding')r.control.binding.ownerUid='different';else if(mode==='source')r.control.source.hash='c'.repeat(64);else if(mode==='image')r.control.application.hash='c'.repeat(64);else if(mode==='missing-image')delete r.control.application;else r.options[mode]=mode==='version'?2:true;
  const before=JSON.stringify(r.control),report=await collectGlobalDiagnostics(r.args);assert.equal(report.status,'BLOCKED',mode);assert.equal(report.code,code,mode);if(beforeOpen)assert.equal(r.trace.includes('open'),false,mode);
  if(mode==='binding')assert.equal(r.trace.includes('get:application'),false,'A foreign binding must not read the image');if(mode==='upgrade')assert.ok(r.trace.includes('upgrade-aborted'));
  assert.equal(JSON.stringify(r.control),before);assert.deepEqual(r.calls,[]);anonymous(report);
 }
});
test('lost authorization, original/image changes and missing native context discard unconfirmed observations',async()=>{
 const {collectGlobalDiagnostics}=await import('../sync/local-first-global-diagnostics.mjs');
 let r=await existingImage();r.deny();let report=await collectGlobalDiagnostics(r.args);assert.equal(report.code,'DIAG_AUTH_BLOCKED');assert.deepEqual(r.trace,[]);
 r=await existingImage();delete r.args.readNative;report=await collectGlobalDiagnostics(r.args);assert.equal(report.code,'DIAG_CONTEXT_BLOCKED');assert.deepEqual(r.trace,[]);
 r=await existingImage();r.options.beforeComplete=()=>{r.deny();};report=await collectGlobalDiagnostics(r.args);assert.equal(report.code,'DIAG_AUTH_BLOCKED');assert.equal(report.originals.status,'BLOCKED');anonymous(report);
 r=await existingImage();r.options.beforeComplete=control=>{control.application.version++;};report=await collectGlobalDiagnostics(r.args);assert.equal(report.code,'DIAG_IMAGE_CHANGED');anonymous(report);
 r=await existingImage();r.options.beforeComplete=()=>r.rows.set('fc_materials_v1','[]');report=await collectGlobalDiagnostics(r.args);assert.equal(report.code,'GLOBAL_SOURCE_CHANGED');anonymous(report);
});
test('hung IDB open has a finite deadline and cannot accept a late result',async()=>{
 const {collectGlobalDiagnostics}=await import('../sync/local-first-global-diagnostics.mjs'),r=await existingImage(),oldSet=global.setTimeout,oldClear=global.clearTimeout;
 let expire;global.setTimeout=(fn,ms)=>{assert.equal(ms,10000);expire=fn;return 1;};global.clearTimeout=()=>{};r.options.hang=true;
 try{const pending=collectGlobalDiagnostics(r.args);for(let i=0;i<50&&!r.trace.includes('open');i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(r.trace.includes('open'));expire();const report=await pending;assert.equal(report.code,'DIAG_TIMEOUT');anonymous(report);}finally{global.setTimeout=oldSet;global.clearTimeout=oldClear;}
});
test('verified demo release capability and activation receipt are required; forged release/changed activation cannot read IDB',async()=>{
 const {collectGlobalDiagnostics}=await import('../sync/local-first-global-diagnostics.mjs'),{verifyApplicationRelease}=await import('../sync/application-release.mjs'),{canonical}=await import('../sync/local-first-values.mjs');
 const r=await existingImage(),decision={activationId:'private-activation',database:'(default)',domain:'MEBLE_APPLICATION_DEPLOYMENT_V1',globalDomains:14,migrationApproved:true,origin:'http://localhost/',ownerUid:r.args.ownerUid,profile:'business-project-v1',projectId:'demo-meble-app',protocol:2,rulesApproved:true,rulesSha256:'a'.repeat(64),sourcePreserved:true};
 const pair=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']),publicKeySpki=new Uint8Array(await crypto.subtle.exportKey('spki',pair.publicKey));
 const trustedKeySha256=Buffer.from(await crypto.subtle.digest('SHA-256',publicKeySpki)).toString('hex'),signature=new Uint8Array(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(canonical(decision))));
 r.args.release=await verifyApplicationRelease({envelope:{decision,publicKeySpki,signature},trustedKeySha256,origin:decision.origin});r.w.document={baseURI:decision.origin};
 r.receipt.activationId=decision.activationId;r.rows.set('meble_application_authority_v1',JSON.stringify(r.receipt));assert.equal((await collectGlobalDiagnostics(r.args)).status,'READ_ONLY');
 r.trace.length=0;r.receipt.activationId='different-activation';r.rows.set('meble_application_authority_v1',JSON.stringify(r.receipt));assert.equal((await collectGlobalDiagnostics(r.args)).code,'DIAG_RELEASE_BLOCKED');assert.deepEqual(r.trace,[]);
 r.args.release={};assert.equal((await collectGlobalDiagnostics(r.args)).code,'DIAG_RELEASE_BLOCKED');assert.deepEqual(r.trace,[]);
});
test('large authority rows and unavailable native originals remain BLOCKED without export of partial image contents',async()=>{
 const {collectGlobalDiagnostics}=await import('../sync/local-first-global-diagnostics.mjs');
 let r=await existingImage();r.control.source.rows.fc_projects_v1='x'.repeat(8*1024*1024+1);let report=await collectGlobalDiagnostics(r.args);assert.equal(report.code,'DIAG_TOO_LARGE');anonymous(report);
 r=await existingImage();const read=r.args.readNative;r.args.readNative=key=>{if(key==='fc_materials_v1')throw Error(secret);return read(key);};report=await collectGlobalDiagnostics(r.args);
 assert.equal(r.row(report.originals,'materials').status,'UNREADABLE');assert.equal(report.localFirst.status,'BLOCKED');anonymous(report);
});
test('both new suites and retained safety/domain suites belong to exactly one mandatory CI group',()=>{
 const ci=require('./ci-smoke-shards'),historical=require('./cloud-ci-context').historicalSmoke,all=ci.plan(ci.inventory('tools',historical)).flat();
 for(const name of ['global-consistency-diagnostics-smoke.js','global-consistency-browser-smoke.js','global-consistency-startup-smoke.js','cloud-global-data-smoke.js','global-data-write-safety-smoke.js','first-sync-error-diagnostics-smoke.js','local-first-contract-smoke.js'])assert.equal(all.filter(x=>x===name).length,1,name);
});
(async()=>{for(const [name,fn]of tests){await fn();console.log('PASS '+name);}console.log(`Global consistency diagnostics: ${tests.length}/${tests.length} PASS`);})().catch(error=>{console.error(error.stack);process.exitCode=1;});

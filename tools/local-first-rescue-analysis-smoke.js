'use strict';
const assert=require('node:assert/strict'),{rescueFixture}=require('./helpers/local-first-rescue-fixture');
(async()=>{
 const {readRescueSnapshot}=await import('../sync/local-first-rescue-snapshot.mjs'),{analyzeRescue,simulateRescueCandidate}=await import('../sync/local-first-rescue-analysis.mjs');
 const r=await rescueFixture(),data=await readRescueSnapshot(r.context),local=new Map(data.local.rows.map(row=>[row.key,row])),image=data.databases.authority.control.find(r=>r.key==='application').rows;
 const put=(key,value)=>{const raw=JSON.stringify(value);local.get(key).raw=raw;image[key]=raw;};
 const primary=[{id:'m1',name:'PRIVATE_BOARD',materialType:'laminat',price:12.125,unit:'m²',unknownHistory:{retain:true}},{name:'PRIVATE_MISSING_ID',price:'12.125'}];
 const old=[{id:'m1',name:'PRIVATE_BOARD',materialType:'laminat',price:13.125,priceUnit:'m2',unknownHistory:{retain:false}},{id:'a1',name:'PRIVATE_HARDWARE',materialType:'akcesoria',price:7.125}];
 put('fc_sheet_materials_v1',primary);put('fc_materials_v1',old);
 const labor=[{id:'rate',name:'PRIVATE_RATE',price:123.125,category:'Stawki godzinowe',rateCode:'workshop'},{id:'task',name:'PRIVATE_TASK',price:0,rateType:'workshop',timeBlockHours:0.0166666667,quantityMode:'linear'},{id:'unique-left',name:'PRIVATE_LEFT',price:17.125}];
 const alias=[{...labor[0],price:124.125},{...labor[1],timeBlockHours:0.02,quantityMode:'tiers',quantityTiers:[{min:0,max:null,hours:0.125,price:0}]},{id:'unique-right',name:'PRIVATE_UNIQUE',price:8.125}];
 put('fc_quote_rates_v1',labor);put('fc_services_v1',alias);
 for(const domain of ['stock','programDefaults','company','businessCosts'])for(const key of r.c.sources[domain]){data.local.rows=data.local.rows.filter(row=>row.key!==key);image[key]=null;}
 for(const domain of ['suppliers','categories','types','technicalParams','hardwareSettings']){const key=r.c.sources[domain][1];data.local.rows=data.local.rows.filter(row=>row.key!==key);image[key]=null;}
 const before=JSON.stringify(data),report=analyzeRescue(data,r.c,r.FC.globalDataDiagnostics);
 assert.deepEqual(report.local.materials[0].records[0].missingRequired,['priceUnit']);assert.deepEqual(report.local.materials[0].records[1].missingRequired,['id','materialType','priceUnit']);
 assert.equal(report.local.materials[1].records[1].catalogKind,'HISTORICAL_ACCESSORY');assert.ok(report.plan.schemaDecisions.local.some(r=>r.unknown.includes('unknownHistory')));
 assert.equal(report.local.materialsComparison.changed[0].fields.find(f=>f.path.join('.')==='price').left.value,12.125);assert.equal(report.local.materialsComparison.onlyRight[0].row.id,'a1');assert.equal(report.local.materialsComparison.unidentifiedLeft.length,1);
 assert.equal(report.local.laborComparison.changed.find(r=>r.id==='rate').fields[0].left.value,123.125);assert.equal(report.local.laborComparison.onlyRight[0].row.id,'unique-right');
 assert.equal(report.local.laborComparison.onlyLeft[0].row.id,'unique-left');
 assert.ok(report.local.laborComparison.changed.find(r=>r.id==='task').fields.some(f=>f.path.join('.')==='quantityMode'));assert.equal(report.local.labor[0].unresolvedReferences.length,0);
 assert.equal(report.plan.initialization.local.length,4);assert.equal(report.local.domains.filter(d=>d.status==='OPTIONAL_ALIAS_ABSENT').length,5);assert.equal(report.plan.executeAvailable,false);assert.equal(JSON.stringify(data),before);
 assert.equal(report.local.domains.length,14);assert.equal(report.active.domains.length,14);assert.ok(report.local.domains.every(d=>d.contract?.sources.length===r.c.sources[d.domain].length));
 assert.equal(report.local.domains.find(d=>d.domain==='stock').contract.status,'SOURCE_MISSING');assert.equal(report.local.domains.find(d=>d.domain==='suppliers').contract.validation.status,'VALID');
 assert.equal(report.comparison.domains.length,14);assert.ok(report.plan.validationDecisions.local.some(d=>d.domain==='materials'));
 assert.deepEqual(report,analyzeRescue(data,r.c,r.FC.globalDataDiagnostics),'Plan must be deterministic');console.log('PASS private materials/labor two-way differences, required fields, history/accessories/unknown fields, exact prices/norms, five optional aliases and four missing domains');
 const model=r.m,modelBefore=JSON.stringify(model),simulation=simulateRescueCandidate(model,r.c);assert.equal(simulation.status,'VALIDATION_ONLY');assert.equal(simulation.writeApproved,false);assert.equal(JSON.stringify(model),modelBefore);
 const missing=structuredClone(model);delete missing.company;assert.equal(simulateRescueCandidate(missing,r.c).code,'GLOBAL_BUNDLE_INCOMPLETE');
 const unknown=structuredClone(model);unknown.materials[0].unknownHistory=true;assert.equal(simulateRescueCandidate(unknown,r.c).code,'GLOBAL_UNKNOWN_FIELD');
 assert.equal(JSON.stringify(data),before);console.log('PASS full validateBundle simulation is explicit, read-only, never a factory initialization, repair or schema-field deletion');
 const malformed=structuredClone(data);malformed.local.rows.find(r=>r.key==='fc_materials_v1').raw='{BROKEN';const bad=analyzeRescue(malformed,r.c,r.FC.globalDataDiagnostics);assert.equal(bad.local.materials[1].status,'INVALID_JSON');assert.equal(bad.plan.executeAvailable,false);
 const duplicate=structuredClone(data);duplicate.local.rows.find(r=>r.key==='fc_quote_rates_v1').raw=JSON.stringify([labor[0],labor[0]]);assert.ok(analyzeRescue(duplicate,r.c,r.FC.globalDataDiagnostics).local.laborComparison.ambiguous.length);console.log('PASS malformed JSON and duplicate identities never select a winner or discard original evidence');
 const unicode=structuredClone(data);unicode.local.rows.find(r=>r.key==='fc_sheet_materials_v1').raw=JSON.stringify([{...primary[0],name:'A\ud800B'}]);assert.equal(analyzeRescue(unicode,r.c,r.FC.globalDataDiagnostics).local.domains.length,14);
 const invalidFallback=structuredClone(data);invalidFallback.local.rows.find(r=>r.key==='fc_hardware_suppliers_v1').raw='{}';const invalidDomain=analyzeRescue(invalidFallback,r.c,r.FC.globalDataDiagnostics).local.domains.find(d=>d.domain==='suppliers');assert.equal(invalidDomain.status,'SCHEMA_DECISION_REQUIRED');assert.equal(invalidDomain.contract.status,'INVALID_SCHEMA');
 const ci=require('./ci-smoke-shards'),all=ci.plan(ci.inventory('tools',require('./cloud-ci-context').historicalSmoke)).flat();for(const name of ['local-first-rescue-smoke.js','local-first-rescue-analysis-smoke.js','local-first-rescue-browser-smoke.js','storage-recovery-smoke.js','storage-recovery-browser-smoke.js'])assert.equal(all.filter(x=>x===name).length,1,name);
 console.log('LOCAL-FIRST rescue analysis: 4/4 groups PASS');
})().catch(e=>{console.error(e.code||e.name||'TEST_FAILED');process.exitCode=1;});

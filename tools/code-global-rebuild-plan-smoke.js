'use strict';
const assert=require('node:assert/strict'),{codeRebuildFixture}=require('./helpers/code-rebuild-fixture');
(async()=>{
 const {planCodeGlobalRebuild,assertCodeRebuildBaseline,codeRebuildSummary,codeGlobalRows}=await import('../sync/global-code-rebuild-plan.mjs');
 const r=await codeRebuildFixture(),before=JSON.stringify(r.snapshot),args={candidate:r.candidate,snapshot:r.snapshot,contract:r.c,diagnostics:r.d};
 const initial=r.d.inspect(key=>r.native.get(key)??null),row=domain=>initial.domains.find(r=>r.domain===domain);
 assert.equal(row('materials').status,'INVALID_SCHEMA');assert.equal(row('materials').code,'GLOBAL_REQUIRED_FIELD');assert.equal(row('labor').status,'DIFFERENT');assert.equal(row('labor').code,'GLOBAL_ALIAS_CONFLICT');
 for(const domain of ['suppliers','categories','types','technicalParams','hardwareSettings'])assert.equal(row(domain).status,'ONE_MISSING');
 for(const domain of ['stock','programDefaults','company','businessCosts'])assert.equal(row(domain).status,'SOURCE_MISSING');
 const source=r.snapshot.databases.authority.control.find(r=>r.key==='source'),image=r.snapshot.databases.authority.control.find(r=>r.key==='application');assert.deepEqual(source.rows,image.rows);
 // capture keeps its original order: alias checks precede bundle schemas.
 assert.throws(()=>r.c.capture({getItem:key=>image.rows[key]??null},Object.keys(r.c.sources)),e=>e.code==='GLOBAL_ALIAS_CONFLICT');
 console.log('PASS exact synthetic Android pattern: materials schema, labor conflict, five optional missing aliases, four missing domains; native equals IDB');
 const plan=await planCodeGlobalRebuild(args),proposed=plan.proposedApplication.rows;
 assert.equal(plan.startup.status,'GLOBALS_VALID');assert.equal(plan.startup.domains,14);assert.deepEqual(JSON.parse(JSON.stringify(r.c.capture({getItem:key=>proposed[key]??null},Object.keys(r.c.sources)).model)),r.candidate.model);
 assert.ok(plan.proposedDiagnostics.domains.every(d=>['PRESENT','EQUAL','ONE_MISSING'].includes(d.status)));assert.ok(plan.proposedDiagnostics.domains.every(d=>['VALID','RUNTIME_REQUIRED'].includes(d.validation.status)));
 for(const domain of ['suppliers','categories','types','technicalParams','hardwareSettings'])assert.equal(proposed[r.c.sources[domain][1]],image.rows[r.c.sources[domain][1]],'Do not initialize historical aliases');
 for(const key of ['fc_materials_v1','fc_services_v1'])assert.equal(proposed[key],proposed[key==='fc_materials_v1'?'fc_sheet_materials_v1':'fc_quote_rates_v1']);
 assert.equal(Object.keys(codeGlobalRows(r.candidate.model,r.c)).length,14);assert.equal(JSON.stringify(r.snapshot),before);assert.deepEqual(plan.preservedPreimage,r.snapshot);
 console.log('PASS full future capture/validateBundle and all domain diagnostics pass; no original/image/outbox changes or needless alias initialization');
 assert.equal(plan.executeAvailable,false);assert.equal(plan.writeApproved,false);assert.equal(plan.queue.uncertain,1);assert.equal(plan.queue.allRetained,true);assert.deepEqual(await assertCodeRebuildBaseline(plan,r.snapshot),{matched:true,writeApproved:false});
 for(const section of ['control','outbox','protected','replicas']){const changed=structuredClone(r.snapshot);changed.databases.authority[section][0].syntheticConcurrentChange=true;await assert.rejects(assertCodeRebuildBaseline(plan,changed),e=>e.code==='CODE_REBUILD_BASELINE_CHANGED');}
 const changed=structuredClone(r.snapshot);changed.local.rows[0].raw+=' ';await assert.rejects(assertCodeRebuildBaseline(plan,changed),e=>e.code==='CODE_REBUILD_BASELINE_CHANGED');
 await assert.rejects(assertCodeRebuildBaseline({...plan},r.snapshot),e=>e.code==='CODE_REBUILD_PLAN_REQUIRED');
 const restarted=await import('../sync/global-code-rebuild-plan.mjs?synthetic-restart');await assert.rejects(restarted.assertCodeRebuildBaseline(plan,r.snapshot),e=>e.code==='CODE_REBUILD_PLAN_REQUIRED');
 const editedPlan=await planCodeGlobalRebuild(args);editedPlan.proposedApplication.rows.fc_sheet_materials_v1='[]';await assert.rejects(assertCodeRebuildBaseline(editedPlan,r.snapshot),e=>e.code==='CODE_REBUILD_PROPOSAL_CHANGED');editedPlan.ownerReviewRequired=false;assert.equal(codeRebuildSummary(editedPlan).ownerReviewRequired,true);
 console.log('PASS full baseline CAS checks all four stores/RAW; uncertain ACK prevents execution; restart/forged proof cannot reuse a plan');
 const edits=await codeRebuildFixture(),old=JSON.parse(edits.native.get('fc_sheet_materials_v1'));old[0].price=321.125;old[0].historicalField={retain:'SYNTHETIC_PRIVATE'};old.push({id:'synthetic-custom',name:'SYNTHETIC_UNKNOWN',price:27.375});edits.native.set('fc_sheet_materials_v1',JSON.stringify(old));edits.native.set('fc_hardware_replacement_rules_v1','{"syntheticRule":{"price":17.125}}');
 const editedLabor=JSON.parse(edits.native.get('fc_quote_rates_v1'));editedLabor[0].price=167.375;editedLabor.find(r=>r.id==='labor_legs_install').stepHours=0.03125;edits.native.set('fc_quote_rates_v1',JSON.stringify(editedLabor));edits.native.set('fc_services_v1','{SYNTHETIC_BROKEN');
 // The sidecar was not part of the 14-domain source contract; preserve it in
 // both the authority and native evidence without treating it as factory data.
 edits.snapshot.databases.authority.control.find(r=>r.key==='source').rows.fc_hardware_replacement_rules_v1=edits.native.get('fc_hardware_replacement_rules_v1');await edits.rehash();
 const saved=JSON.stringify(edits.snapshot),privatePlan=await planCodeGlobalRebuild({candidate:edits.candidate,snapshot:edits.snapshot,contract:edits.c,diagnostics:edits.d});
 const diff=privatePlan.comparisons.find(r=>r.layer==='application'&&r.key==='fc_sheet_materials_v1');assert.ok(diff.comparison.onlyHistorical.some(r=>r.row.id==='synthetic-custom'));assert.ok(diff.comparison.changed[0].fields.some(f=>f.path.join('.')==='price'&&f.old===321.125));assert.ok(diff.comparison.changed[0].fields.some(f=>f.path.join('.')==='historicalField'));
 const laborDiff=privatePlan.comparisons.find(r=>r.layer==='application'&&r.key==='fc_quote_rates_v1');assert.ok(laborDiff.comparison.changed.some(r=>r.fields.some(f=>f.path.join('.')==='price'&&f.old===167.375)));assert.ok(laborDiff.comparison.changed.some(r=>r.fields.some(f=>f.path.join('.')==='stepHours'&&f.old===0.03125)));assert.equal(privatePlan.comparisons.find(r=>r.layer==='application'&&r.key==='fc_services_v1').status,'INVALID_JSON');
 assert.equal(privatePlan.proposedApplication.rows.fc_hardware_replacement_rules_v1,edits.native.get('fc_hardware_replacement_rules_v1'));assert.equal(privatePlan.ownerReviewRequired,true);assert.equal(JSON.stringify(edits.snapshot),saved);assert.equal(JSON.stringify(privatePlan.preservedPreimage),saved);
 const summary=JSON.stringify(codeRebuildSummary(privatePlan));assert.doesNotMatch(summary,/321|27\.375|synthetic-custom|SYNTHETIC_PRIVATE|syntheticRule/);assert.equal(codeRebuildSummary(privatePlan).backupVerified,false);
 console.log('PASS edited prices, unknown records/fields and replacement sidecars retained privately; anonymous summary never grants WRITE or backup status');
 const badCandidate={...r.candidate,model:structuredClone(r.candidate.model)};badCandidate.model.labor[0].price+=1;await assert.rejects(planCodeGlobalRebuild({...args,candidate:badCandidate}),e=>e.code==='CODE_REBUILD_PROVENANCE_INVALID');
 const badRules={...r.candidate,rules:structuredClone(r.candidate.rules)};badRules.rules.laborReplacements={};await assert.rejects(planCodeGlobalRebuild({...args,candidate:badRules}),e=>e.code==='CODE_REBUILD_PROVENANCE_INVALID');
 const active=structuredClone(r.snapshot);active.databases.authority.control.find(r=>r.key==='application').rows.fc_edit_session_v1='SYNTHETIC_EDIT';const {digest,json}=await import('../sync/local-first-values.mjs');active.databases.authority.control.find(r=>r.key==='application').hash=await digest(json(active.databases.authority.control.find(r=>r.key==='application').rows));
 const blocked=await planCodeGlobalRebuild({...args,snapshot:active});assert.equal(blocked.startup.status,'BLOCKED');assert.equal(blocked.startup.code,'GLOBAL_EDIT_SESSION_ACTIVE');assert.equal(blocked.writeApproved,false);
 console.log('PASS changed code candidate and active editing session retain existing refusals; no bypass of startup/fatal/authority');
 const ci=require('./ci-smoke-shards'),all=ci.plan(ci.inventory('tools',require('./cloud-ci-context').historicalSmoke)).flat();
 for(const name of ['code-global-catalogs-smoke.js','code-global-rebuild-plan-smoke.js','wycena-labor-norms-smoke.js','quote-exact-calculations-smoke.js','wycena-hinge-quote-replacement-flow-smoke.js','global-data-write-safety-smoke.js','local-first-contract-smoke.js','company-transport-business-costs-smoke.js'])assert.equal(all.filter(x=>x===name).length,1,name);
 console.log('CODE GLOBAL REBUILD PLAN: 6/6 groups PASS, new and existing safety/WYCENA tests routed once to mandatory CI');
})().catch(error=>{console.error(error.code||error.message||'CODE_REBUILD_TEST_FAILED');process.exitCode=1;});

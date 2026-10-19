#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {createSandbox,loadSmokeFiles}=require('./app-dev-smoke');
const {rows}=require('./quote-performance-fixture');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const clone=x=>JSON.parse(JSON.stringify(x));
function runtime(){
 const s=createSandbox(),seed=rows(3,true);
 for(const [key,value]of Object.entries(seed))s.localStorage.setItem(key,value);
 loadSmokeFiles(s,require('./app-dev-smoke-lib/file-list').APP_DEV_SMOKE_FILES);const FC=s.FC;
 s.materials=JSON.parse(seed.fc_materials_v1);s.projectData=FC.project.load();
 s.uiState={...JSON.parse(seed.fc_ui_v1),activeTab:'wycena'};
 FC.quoteOfferStore.patchCurrentDraft({selection:{selectedRooms:['room_test_A'],materialScope:{kind:'all',includeFronts:true,includeCorpus:true}},commercial:{versionName:'Before'}});
 const state={},count={collect:0};const collect=FC.wycenaCore.collectQuoteData;
 FC.wycenaCore.collectQuoteData=async function(...args){count.collect++;return collect.apply(this,args);};
 const deps={getState:()=>state,setState:p=>Object.assign(state,p),render(){},
  getOfferDraft:()=>FC.quoteOfferStore.getCurrentDraft(),normalizeDraftSelection:d=>FC.wycenaCoreSelection.normalizeQuoteSelection(d.selection),
  ensureVersionNameBeforeGenerate:async()=>{FC.quoteOfferStore.patchCurrentDraft({commercial:{versionName:'After'}});return {cancelled:false};},
  getSnapshotId:q=>q.id,syncGeneratedQuoteStatus(){},getProjectStatusForHistory:()=>'',getSnapshotHistory:()=>FC.quoteSnapshotStore.listForProject('A')};
 return {s,FC,state,count,deps,run:()=>FC.wycenaTabShell.generateQuote({},deps,{source:'performance-regression'})};
}
const math=value=>JSON.stringify(value,(key,value)=>['generatedAt','generatedDate','diagnostics','performance','__projectPcvCandidate'].includes(key)?undefined:value);
test('Name-only change reuses real calculation and rebuilds final metadata',async()=>{
 const r=runtime();await r.run();assert.equal(r.state.lastQuote?.error,undefined,JSON.stringify(r.state));assert.equal(r.count.collect,1);
 const saved=r.FC.quoteSnapshotStore.listForProject('A');assert.equal(saved.length,1);assert.equal(saved[0].commercial.versionName,'After');
});
for(const [name,mutate]of [
 ['discount',r=>r.FC.quoteOfferStore.patchCurrentDraft({commercial:{discountPercent:12}})],
 ['catalog price',r=>{r.s.materials[0].price+=30;r.s.localStorage.setItem('fc_materials_v1',JSON.stringify(r.s.materials));}],
 ['optimizer controls',r=>{const input=r.s.document.createElement('input');input.id='rozK';input.value='8';r.s.document.body.appendChild(input);}],
 ['runtime board geometry',r=>{r.FC.materialCommon.FC_BOARD_THICKNESS_CM=2;}],
 ['commercial terms',r=>r.FC.quoteOfferStore.patchCurrentDraft({commercial:{customerNote:'Changed terms'}})]
])test(name+' changed during naming forces a fresh real calculation',async()=>{
 const r=runtime();r.deps.ensureVersionNameBeforeGenerate=async()=>{mutate(r);return {cancelled:false};};
 await r.run();assert.equal(r.count.collect,2);assert.equal(r.state.lastQuote?.error,undefined,JSON.stringify(r.state));assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,1);
});
test('Cancellation after actual calculation never saves a snapshot',async()=>{
 const r=runtime();r.deps.ensureVersionNameBeforeGenerate=async()=>({cancelled:true});await r.run();assert.equal(r.count.collect,1);assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,0);
});
for(const [name,mutate]of [
 ['project revision',r=>{const rec=r.FC.projectStore.getById('A');rec.title+=' changed';r.FC.projectStore.upsert(rec);}],
 ['investor',r=>r.FC.investors.setCurrentId('inv-B')],
 ['unfinished session',r=>r.FC.session.begin('room_test_A')],
 ['expired server lease',r=>{r.s.__FC_MAIN_ACCESS__={assert(){throw Error('AUTH_ACCESS_REVOKED');}};}]
])test(name+' changed across naming await cannot save a reused result',async()=>{
 const r=runtime();r.deps.ensureVersionNameBeforeGenerate=async()=>{mutate(r);return {cancelled:false};};await r.run();
 assert.ok(r.state.lastQuote?.error);assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,0);
});
test('Synchronous PCV sharing returns identical complete real calculation',async()=>{
 const r=runtime(),options={pcvMode:'project',projectId:'A',selection:r.deps.getOfferDraft().selection};
 const scoped=await r.FC.wycenaCore.collectQuoteData(options);
 const share=r.FC.projectPcvOverrides.withCalculationRead;
 r.FC.projectPcvOverrides.withCalculationRead=fn=>fn();
 const unshared=await r.FC.wycenaCore.collectQuoteData(options);r.FC.projectPcvOverrides.withCalculationRead=share;
 assert.equal(math(scoped),math(unshared));
});
test('Fully priced second decor retains identical complete math and exactly one PCV allowance',async()=>{
 const r=runtime();r.s.materials.push({name:'Oak',materialType:'laminat',price:135,priceUnit:'sheet'});
 r.s.localStorage.setItem('fc_materials_v1',JSON.stringify(r.s.materials));
 const options={pcvMode:'project',projectId:'A',selection:r.deps.getOfferDraft().selection};
 const current=await r.FC.wycenaCore.collectQuoteData(options);
 assert.equal(current.materialLines.find(x=>x.name==='Oak').unitPrice,135);
 const share=r.FC.projectPcvOverrides.withCalculationRead;r.FC.projectPcvOverrides.withCalculationRead=fn=>fn();
 const original=await r.FC.wycenaCore.collectQuoteData(options);r.FC.projectPcvOverrides.withCalculationRead=share;
 assert.equal(math(current),math(original));
 for(const row of current.materialLines.filter(x=>x.edgeRawMeters>0)){
  assert.equal(row.edgeWastePercent,10);assert.ok(Math.abs(row.edgeQuotedMeters-row.edgeRawMeters*1.1)<1e-8);
 }
});
for(const [name,mutate]of [
 ['RAM geometry',r=>{r.s.projectData.room_test_A.cabinets[0].width+=5;}],
 ['global PCV configuration',r=>{r.s.localStorage.setItem('fc_program_defaults_v1','{"changed":true}');}],
 ['canonical revision',r=>{const raw=JSON.parse(r.s.localStorage.getItem('fc_projects_v1'));raw[0].updatedAt+=1;r.s.localStorage.setItem('fc_projects_v1',JSON.stringify(raw));}],
 ['material type',r=>{r.s.materials[0].materialType='hdf';}],
 ['runtime board geometry',r=>{r.FC.materialCommon.FC_BOARD_THICKNESS_CM=2;}],
 ['RAM identity',r=>{r.s.projectData=clone(r.s.projectData);}],
 ['owner',r=>r.FC.investors.setCurrentId('inv-B')]
])test('Reentrant '+name+' mutation invalidates shared PCV read',()=>{
 const r=runtime(),api=r.FC.projectPcvOverrides;
 assert.throws(()=>api.withCalculationRead(()=>{assert.equal(api.inspectRoom('A','room_test_A').ok,true);mutate(r);return api.inspectRoom('A','room_test_A');}),e=>e.code==='PROJECT_PCV_READ_CONFLICT');
});
test('Scope cannot survive await; a later read sees fresh geometry and refuses divergence',async()=>{
 const r=runtime(),api=r.FC.projectPcvOverrides;assert.throws(()=>api.withCalculationRead(()=>Promise.resolve()),/Synchronous/);
 const address={projectId:'A',roomId:'room_test_A',cabinetId:'synth_cab_0',partRoleId:'front.door.right'};
 assert.equal(api.withCalculationRead(()=>api.getForCalculation(address)).ok,true);
 r.s.projectData.room_test_A.cabinets[0].width+=1;
 assert.equal(api.getForCalculation(address).code,'RAM_DIVERGENCE');
});

test('Delegation consumes a delayed synthetic click but accepts a new modal gesture',()=>{
 const handlers={},document={addEventListener:(type,fn)=>(handlers[type]||(handlers[type]=[])).push(fn),getElementById:()=>null};
 let calls=0;const host={FC:{actions:{has:()=>true,dispatch:()=>{calls++;return true;}}}};
 const fs=require('node:fs');new Function('window','document',fs.readFileSync('js/app/ui/bindings.js','utf8'))(host,document);host.FC.bindings.install();
 const action={getAttribute:()=> 'wycena-generate',closest:selector=>selector==='[data-action]'?action:null};
 const modal={closest:()=>null};
 const fire=(type,target)=>{const e={target,prevented:false,preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){}};for(const fn of handlers[type]||[])fn(e);return e;};
 fire('pointerup',action);assert.equal(calls,1);
 assert.equal(fire('click',modal).prevented,true,'same-gesture delayed click must not reach a modal/underlying element');
 fire('pointerup',action);assert.equal(calls,2); // browser suppresses its synthetic click entirely
 fire('pointerdown',modal);fire('pointerup',modal);
 assert.equal(fire('click',modal).prevented,false,'first new physical modal gesture must be accepted');
 fire('pointerdown',action);fire('pointerup',action);fire('click',action);assert.equal(calls,3,'native pointerup/click dispatches once');
});

(async()=>{let fail=0;for(const[name,fn]of tests)try{await fn();console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+'\n'+e.stack);}console.log(`Quote performance: ${tests.length-fail}/${tests.length} PASS, ${fail} FAIL`);process.exitCode=fail?1:0;})();

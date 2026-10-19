#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {fixture,activate,load}=require('./project-pcv-ui-activation-smoke');
const ROOT=path.resolve(__dirname,'..'),BASE='431545d364b47ee4d0cf8efed7d9e478d43ebe8d',baseline=process.argv.includes('--baseline');
const clone=x=>JSON.parse(JSON.stringify(x)),tests=[];const test=(n,f)=>tests.push([n,f]);
function runtime(){const r=fixture();activate(r);
 if(baseline)for(const f of ['js/app/wycena/wycena-tab-shell.js'])vm.runInContext(execFileSync('git',['show',BASE+':'+f],{cwd:ROOT,encoding:'utf8'}),r.s,{filename:f});
 const source='js/app/rozrys/rozrys-project-source.js';vm.runInContext(baseline?execFileSync('git',['show',BASE+':'+source],{cwd:ROOT,encoding:'utf8'}):fs.readFileSync(path.join(ROOT,source),'utf8'),r.s,{filename:source});
 r.source=r.FC.rozrysProjectSource.createApi({FC:r.FC,host:r.s});r.FC.rozrys.safeGetProject=r.source.safeGetProject;
 return r;
}
for(const count of [1,2,8])test('Canonical RAM beats foreign override with '+count+' cabinets',()=>{const r=runtime();const wrong=clone(r.row('B').projectData);wrong.room.cabinets=Array.from({length:count},(_,i)=>({...wrong.room.cabinets[0],id:'foreign-'+i}));r.FC.rozrys.__projectOverride=wrong;r.storage.setItem('fc_project_v1',JSON.stringify(wrong));const raw=r.rows();assert.equal(r.source.safeGetProject(),r.s.projectData);assert.deepEqual(r.rows(),raw);});
test('A -> B -> A keeps the exact activated object regardless of old override',()=>{const r=runtime(),a=r.s.projectData;r.FC.rozrys.__projectOverride=a;
 for(const [investor,project] of [['inv-B','B'],['inv-A','A']]){r.FC.investors.setCurrentId(investor);r.FC.projectStore.setCurrentProjectId(project);r.s.projectData=r.FC.project.load();assert.equal(r.source.safeGetProject(),r.s.projectData);assert.equal(r.source.safeGetProject().meta.assignedInvestorId,investor);}
});
test('Wrong RAM owner and missing physical context never fall back to an override',()=>{const r=runtime();r.FC.rozrys.__projectOverride=clone(r.s.projectData);r.s.projectData.meta.assignedInvestorId='inv-B';assert.equal(r.source.safeGetProject(),null);});
test('Explicit detached override remains available to a genuinely isolated factory',()=>{const project={room:{cabinets:[{id:'isolated'}]}};const r=runtime();const api=r.FC.rozrysProjectSource.createApi({FC:{rozrys:{__projectOverride:project}},host:{}});assert.equal(api.safeGetProject(),project);});
test('Actual selection renderer does not label an empty filtered scope as all rooms',()=>{
 const r=runtime();for(const f of ['js/app/wycena/wycena-room-availability.js','js/app/wycena/wycena-tab-selection-scope.js','js/app/wycena/wycena-tab-selection-model.js','js/app/wycena/wycena-tab-selection-render.js'])load(r,f);
 const wrong=clone(r.row('B').projectData);wrong.room_foreign=wrong.room;delete wrong.room;wrong.room_foreign.cabinets=Array.from({length:8},(_,i)=>({...wrong.room_foreign.cabinets[0],id:'foreign-'+i}));r.FC.rozrys.__projectOverride=wrong;
 const card=r.s.document.createElement('div'),h=(tag,a)=>{const el=r.s.document.createElement(tag);for(const[k,v]of Object.entries(a||{})){if(k==='text')el.textContent=v;else el.setAttribute(k,v);}return el;};
 r.FC.wycenaTabSelectionRender.renderQuoteSelectionSection(card,{}, {h,labelWithInfo:()=>h('label',{text:'Rooms'}),getOfferDraft:()=>r.draft,getMaterialScopeLabel:()=> 'all'});
 assert.ok(!card.querySelector('.quote-selection-launch--rooms').textContent.includes('Wszystkie pomieszczenia'));
 assert.deepEqual(clone(r.FC.wycenaTabSelectionModel.normalizeDraftSelection(r.draft).selectedRooms),['room']);
 assert.deepEqual(clone(r.FC.wycenaCoreSelection.normalizeQuoteSelection(r.draft.selection).selectedRooms),['room']);
});
test('Native right front is resolved using the active physical owner',()=>{const r=runtime();assert.equal(r.api.getForCalculation({projectId:'A',roomId:'room',cabinetId:'one',partRoleId:'front.door.right'}).ok,true);});
test('Status reconciliation retains a fresh error; explicit history selection can replace it',()=>{const r=runtime(),state={lastQuote:{error:'Synthetic refusal'},lastKnownProjectStatus:'nowy',previewSnapshotId:''};r.FC.wycenaTabShell.reconcileStatusPreviewState({getState:()=>state,setState:p=>Object.assign(state,p),getSnapshotHistory:()=>[],getProjectStatusForHistory:()=>''});assert.equal(state.lastQuote.error,'Synthetic refusal');});
for(const kind of ['investor','project','revision','session','confirmation','scope'])test('Real material calculation discards '+kind+' change across await',async()=>{
 const r=runtime();r.s.materials.filter(m=>m.materialType==='laminat').forEach(m=>m.priceUnit='sheet');
 const compute=r.FC.rozrysEngine.computePlanWithCurrentEngine;let did=false;
 r.FC.rozrysEngine.computePlanWithCurrentEngine=async(...args)=>{const plan=await compute(...args);if(!did){did=true;
  if(kind==='investor')r.FC.investors.setCurrentId(null);
  if(kind==='project')r.FC.projectStore.setCurrentProjectId('B');
  if(kind==='revision'){const a=r.row('A');a.projectData.room.cabinets[0].width+=1;r.FC.projectStore.upsert(a);}
  if(kind==='session')assert.equal(r.session.begin('room'),true);
  if(kind==='confirmation')r.session.markUnconfirmedProjectWrite();
  if(kind==='scope')r.draft.selection.selectedRooms=['other'];
 }return plan;};
 const history=r.storage.getItem('fc_quote_snapshots_v1');
 await assert.rejects(()=>r.calculate(),e=>['calculation_context_changed','calculation_scope_changed'].includes(e.code));assert.equal(did,true);assert.equal(r.storage.getItem('fc_quote_snapshots_v1'),history);
});
test('Real unsaved divergence, unfinished session and failed confirmation remain refused',async()=>{const r=runtime();r.s.projectData.room.cabinets[0].width+=1;assert.equal(r.FC.projectPcvPolicy.read().code,'RAM_DIVERGENCE');assert.equal(r.FC.sessionNavigation.canCalculate(),false);r.s.projectData=r.FC.project.load();assert.equal(r.session.begin('room'),true);await assert.rejects(()=>r.calculate(),e=>e.code==='active_edit');r.session.markUnconfirmedProjectWrite();assert.equal(r.FC.sessionNavigation.canCalculate(),false);});
test('Same IDs after a project round trip do not resurrect an old context',()=>{const r=runtime(),c=r.FC.sessionNavigation.calculationContext();r.FC.projectStore.setCurrentProjectId('B');r.FC.projectStore.setCurrentProjectId('A');assert.equal(r.FC.sessionNavigation.calculationUnchanged(c),false);});
(async()=>{let pass=0,fail=0;for(const [name,fn]of tests){try{await fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+': '+e.stack);}}console.log(`project-context-coherence: ${pass}/${tests.length} PASS, ${fail} FAIL`);process.exitCode=fail?1:0;})();

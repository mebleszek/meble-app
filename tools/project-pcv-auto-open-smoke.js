#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm');
const {fixture,openAutomatically,reopen,load,protectedSeed:seedGlobals}=require('./project-pcv-ui-activation-smoke');
const clone=x=>JSON.parse(JSON.stringify(x)),tests=[],test=(name,fn)=>tests.push([name,fn]);
function protectedSeed(r){
 for(const key of ['fc_hardware_manufacturers_v1','fc_hardware_suppliers_v1','fc_hardware_settings_v1','fc_hardware_categories_v1','fc_hardware_types_v1','fc_hardware_technical_params_v1','fc_hourly_rates_v1','fc_business_costs_v1','fc_company_profile_v1'])r.storage.rows.set(key,JSON.stringify({preserve:true}));
 const values=seedGlobals(r);delete values.fc_current_project_id_v1;return values;
}
const untouched=(r,before)=>Object.entries(before).forEach(([key,raw])=>assert.equal(r.storage.getItem(key),raw,key));
test('New physical project starts project PCV in its canonical record',()=>{
 const r=fixture(),globals=protectedSeed(r);r.FC.utils.uid=()=> 'new-project';
 const row=r.FC.projectStore.ensureForInvestor('new-investor',{projectData:{room:{cabinets:[]}}});
 assert.equal(row.projectData.meta.productionPcvMode,'project');assert.equal(row.projectData.meta.assignedInvestorId,'new-investor');assert.equal(r.FC.projectStore.getById(row.id).projectData.meta.productionPcvMode,'project');untouched(r,globals);
});
test('Initial save-for-investor preserves the automatic marker rather than overwriting it',()=>{
 const r=fixture();r.FC.utils.uid=()=> 'new-project';const input={room:{cabinets:[]}};
 const row=r.FC.projectStore.saveProjectDataForInvestor('new-investor',input);
 assert.equal(row.projectData.meta.productionPcvMode,'project');assert.equal(input.meta,undefined);
});
test('Existing project opens automatically before session baseline; reopen is idempotent',()=>{
 const r=fixture(),globals=protectedSeed(r);assert.equal(openAutomatically(r),true);untouched(r,globals);
 const snapshot=r.session.snapshot,raw=r.storage.getItem('fc_projects_v1');r.storage.calls.length=0;
 assert.equal(openAutomatically(r),true);assert.equal(r.session.snapshot,snapshot);assert.equal(r.storage.getItem('fc_projects_v1'),raw);assert.equal(r.storage.calls.length,0);
});
test('Investor runtime opening activates once, with no UI activation or legacy import',()=>{
 const r=fixture(),globals=protectedSeed(r);assert.equal(r.FC.investorProjectRuntime.setActiveProjectFromInvestor('inv-A'),true);
 assert.equal(r.policy.read().mode,'project');assert.equal(r.session.active,false);untouched(r,globals);
 const raw=r.storage.getItem('fc_projects_v1');assert.equal(r.FC.investorProjectRuntime.setActiveProjectFromInvestor('inv-A'),true);assert.equal(r.storage.getItem('fc_projects_v1'),raw);
});
test('Restart restores project marker and independent cabinet PCV',()=>{
 const r=fixture();assert.equal(openAutomatically(r),true);r.open();r.edge('w2',true);r.save();assert.equal(r.session.commit(),true);
 const next=reopen(r);assert.equal(next.FC.projectPcvPolicy.read().mode,'project');
 assert.equal(next.FC.projectPcvOverrides.get({projectId:'A',roomId:'room',cabinetId:'one',partRoleId:'body.side.left'}).edges.w2,true);
 assert.equal(next.FC.projectPcvOverrides.get({projectId:'A',roomId:'room',cabinetId:'two',partRoleId:'body.side.left'}).edges.w2,false);
});
test('Dirty RAM and missing investor refuse automatic activation without data mutation',()=>{
 for(const kind of ['ram','investor']){
  const r=fixture();if(kind==='ram')r.s.projectData.room.cabinets[0].width=65;else r.FC.investors.getCurrentId=()=>null;
  const globals=protectedSeed(r),before=r.rows(),ram=clone(r.s.projectData);r.storage.calls.length=0;
  assert.equal(openAutomatically(r),false);assert.deepEqual(r.rows(),before);assert.deepEqual(clone(r.s.projectData),ram);assert.equal(r.storage.calls.length,0);untouched(r,globals);
 }
});
test('Failed investor switch restores its matching RAM/pointer, so retry cannot overwrite the old project',()=>{
 const r=fixture(),globals=protectedSeed(r),a=clone(r.row('A').projectData),b=clone(r.row('B').projectData),ram=clone(r.s.projectData);
 r.storage.fail.set('set:fc_projects_v1','throw');assert.equal(r.FC.investors.setCurrentId('inv-B'),'inv-A');
 assert.equal(r.FC.projectStore.getCurrentProjectId(),'A');assert.deepEqual(clone(r.s.projectData),ram);assert.deepEqual(r.row('A').projectData,a);untouched(r,globals);
 r.storage.fail.clear();assert.equal(r.FC.investors.setCurrentId('inv-B'),'inv-B');assert.equal(r.policy.read().mode,'project');assert.deepEqual(r.row('A').projectData,a);
 assert.deepEqual(r.row('B').projectData.room,b.room);
});
test('Missing or throwing policy refuses investor switching and preserves the old edit context',()=>{
 for(const mode of ['missing','throw']){
  const r=fixture(),globals=protectedSeed(r),a=clone(r.row('A').projectData),b=clone(r.row('B').projectData),ram=clone(r.s.projectData);
  if(mode==='missing')delete r.FC.projectPcvPolicy;else r.FC.projectPcvPolicy.ensureProjectMode=()=>{throw Error('dependency failed');};
  assert.equal(r.FC.investors.setCurrentId('inv-B'),'inv-A');assert.equal(r.FC.projectStore.getCurrentProjectId(),'A');assert.deepEqual(clone(r.s.projectData),ram);assert.deepEqual(r.row('A').projectData,a);assert.deepEqual(r.row('B').projectData,b);untouched(r,globals);
 }
});
test('Absent session module cannot authorize an automatic central activation',()=>{
 const r=fixture(),before=r.rows();delete r.FC.session;assert.equal(r.policy.ensureProjectMode().ok,false);assert.deepEqual(r.rows(),before);
});
test('Failed durable begin cannot expose editor; canonical mode remains confirmed for safe retry',()=>{
 const r=fixture(),globals=protectedSeed(r);r.storage.fail.set('set:fc_edit_session_v1','throw');
 assert.equal(openAutomatically(r),false);assert.equal(r.session.durable,false);assert.equal(r.row('A').projectData.meta.productionPcvMode,'project');untouched(r,globals);
 r.storage.fail.clear();assert.equal(openAutomatically(r),true);assert.equal(r.session.durable,true);
});
test('Failed central activation preserves all global domains and permits safe retry',()=>{
 const r=fixture(),globals=protectedSeed(r),before=r.row('A');r.storage.fail.set('set:fc_projects_v1','noop');
 assert.equal(openAutomatically(r),false);assert.deepEqual(r.row('A'),before);untouched(r,globals);assert.equal(r.session.active,false);
 r.storage.fail.clear();assert.equal(openAutomatically(r),true);untouched(r,globals);
});
test('Actual app.js lexical core cannot hide project PCV or the existing recalculation handler',()=>{
 const r=fixture();r.storage.rows.set('fc_materials_v1',JSON.stringify(r.s.materials));r.storage.rows.set('fc_ui_v1',JSON.stringify(r.s.uiState));
 // Actual bootstrap factory, actual state bootstrap and complete app.js create its
 // real global lexical FC (only utils/storage/project), before the tab is loaded.
 for(const f of ['js/app/bootstrap/app-core-namespace.js','js/app/bootstrap/app-state-bootstrap.js','js/app.js'])load(r,f);
 assert.equal(vm.runInContext('FC.projectPcvPolicy',r.s),undefined);assert.ok(r.s.FC.projectPcvPolicy);
 vm.runInContext('window.projectData=projectData;',r.s);
 load(r,'js/app/project/project-recalculate.js');load(r,'js/tabs/material.js');
 assert.equal(openAutomatically(r),true);r.render();assert.equal(r.list.querySelector('.material-project-pcv-activate'),null);
 r.open();r.edge('w2',true);r.save();assert.equal(r.modal(),null);
 assert.equal(r.row('A').projectData.room.production.partOverrides.one['body.side.left'].edges.w2,true);
 assert.equal(r.row('A').projectData.room.production.partOverrides.two,undefined);
 // Observe the real API and run it; do not replace the handler with a success stub.
 const recalc=r.FC.projectRecalculator.recalculateAndNotify;let calls=0;
 r.FC.projectRecalculator.recalculateAndNotify=opts=>{calls++;assert.equal(opts.refresh,true);return recalc(opts);};
 r.render();const button=r.list.querySelector('.material-recalculate-project-btn');assert.equal(button.textContent,'Przelicz projekt');button.click();assert.equal(calls,1);
 assert.ok(r.messages.some(m=>m.title==='Projekt przeliczony'));
 assert.equal(r.policy.read().mode,'project');
});
(async()=>{let failures=0;for(const[name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+'\n'+e.stack);}}console.log(`${tests.length-failures}/${tests.length} PASS`);process.exitCode=failures?1:0;})();

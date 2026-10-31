'use strict';
const assert=require('node:assert/strict');
const {setup}=require('./investor-navigation-exit-smoke');
const collect=require('../js/app/ui/session-diagnostics-readonly');
const P='fc_projects_v1',E='fc_edit_session_v1',clone=x=>JSON.parse(JSON.stringify(x));
function legacy(){
 const r=setup();r.FC.investorProjectPatches.patchInvestorsAPI();r.load('js/app/investor/project-bootstrap.js');
 r.s.normalizeProjectData=()=>r.FC.projectBootstrap.normalizeProjectData(r.s.projectData,r.FC.project.DEFAULT_PROJECT);
 const rows=JSON.parse(r.storage.getItem(P));for(const row of rows)delete row.projectData.meta.assignedInvestorId;
 delete rows.find(row=>row.id==='P').projectData.meta.productionPcvMode;
 r.storage.setItem(P,JSON.stringify(rows));r.s.projectData=r.FC.project.load();return r;
}
async function main(){
 const r=legacy(),raw=r.storage.getItem(P);
 for(const id of ['K','N']){
  assert.equal(await r.handlers['open-investor']({element:{getAttribute:()=>id}}),true);
  assert.equal(r.FC.investors.getCurrentId(),id);assert.equal(r.s.projectData.meta.assignedInvestorId,id);
  assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.s.projectData),false);
  assert.equal(r.storage.getItem(P),raw,'Read-only historical admission must not migrate PCV or owner metadata');
  assert.equal(await r.handlers['session-cancel']({}),true);assert.equal(r.s.uiState.entry,'investorsList');
 }
 const fresh=r.FC.investors.create({name:'Synthetic third',rooms:[]});assert.ok(fresh);
 assert.equal(await r.handlers['open-investor']({element:{getAttribute:()=>fresh.id}}),true);
 const rows=JSON.parse(r.storage.getItem(P));for(const row of JSON.parse(raw))assert.deepEqual(rows.find(x=>x.id===row.id),row);
 assert.equal(r.s.projectData.room_k,undefined);assert.equal(r.s.projectData.room_n,undefined);
 console.log('PASS two historical owners + new third, authoritative identity, read-only admission, Exit and foreign-room isolation');
 const cold=legacy();cold.FC.investorsLocalRepository.setCurrentId(null);cold.s.projectData=cold.FC.project.load();
 const coldNew=cold.FC.investors.create({name:'Synthetic after cold list',rooms:[]});assert.ok(coldNew);
 assert.equal(cold.s.projectData.meta.assignedInvestorId,coldNew.id,'A cold ownerless list must still preserve the confirmed prior RAM owner during creation');
 for(const conflict of ['foreign','null','empty','duplicate']){
  const t=legacy(),rows=JSON.parse(t.storage.getItem(P)),q=rows.find(row=>row.id==='Q');
  if(conflict==='duplicate')rows.push({...clone(q),id:'Q-two'});else q.projectData.meta.assignedInvestorId=conflict==='foreign'?'foreign':conflict==='null'?null:'';
  t.storage.setItem(P,JSON.stringify(rows));const before=t.seed(),ram=JSON.stringify(t.s.projectData);
  assert.equal(await t.handlers['open-investor']({element:{getAttribute:()=> 'N'}}),false);
  assert.equal(t.storage.getItem(P),before[P]);assert.equal(t.storage.getItem(E),before[E]??null);assert.equal(JSON.stringify(t.s.projectData),ram);
  assert.ok(t.messages.some(message=>message.sessionDiagnostic&&message.title==='Nie można otworzyć inwestora'));
  assert.equal(t.FC.investorOpenDiagnostics.state.outcome,'refused');
 }
 console.log('PASS conflicting/explicit invalid owner and ambiguous projects refuse with evidence and preserved RAW/RAM');
 const busy=setup();assert.equal(await busy.open(),true);busy.s.projectData.room_k.cabinets[0].width=61;
 let release;busy.FC.choiceBox.ask=()=>new Promise(resolve=>{release=resolve;});
 const work=busy.FC.sessionNavigation.requestTransition('synthetic in-flight request',()=>true),before=busy.seed(),ram=JSON.stringify(busy.s.projectData),messages=busy.messages.length;
 assert.equal(typeof release,'function');
 assert.equal(await busy.handlers['open-investor']({element:{getAttribute:()=> 'N'}}),false);
 assert.equal(busy.FC.investorOpenDiagnostics.state.code,'NAVIGATION_BUSY');assert.ok(busy.messages.slice(messages).some(x=>x.message.includes('NAVIGATION_BUSY')));
 assert.deepEqual(busy.seed(),before);assert.equal(JSON.stringify(busy.s.projectData),ram);release('back');assert.equal(await work,false);
 busy.FC.choiceBox.ask=async()=> 'back';const count=busy.messages.length;
 assert.equal(await busy.handlers['open-investor']({element:{getAttribute:()=> 'N'}}),false);
 assert.equal(busy.FC.investorOpenDiagnostics.state.outcome,'cancelled');assert.equal(busy.messages.length,count,'Only confirmed Back suppresses error feedback');
 busy.FC.choiceBox.ask=async()=>undefined;
 assert.equal(await busy.handlers['open-investor']({element:{getAttribute:()=> 'N'}}),false);
 assert.equal(busy.FC.investorOpenDiagnostics.state.code,'NAVIGATION_DECISION_UNCONFIRMED');assert.ok(busy.messages.length>count);
 console.log('PASS busy, explicit Back and uncertain decision have separate per-request outcomes; no swallowed error');
 const edit=legacy();assert.equal(await edit.handlers['open-investor']({element:{getAttribute:()=> 'N'}}),true);
 assert.equal(await edit.FC.views.openRoom('room_n'),true);const other=clone(edit.FC.projectStore.getById('P'));
 edit.s.projectData.room_n.cabinets[0].width=91;const saved=edit.FC.project.saveConfirmed(edit.s.projectData);assert.equal(saved.ok,true);edit.s.projectData=saved.project;
 assert.equal(edit.FC.session.commit(),true);assert.equal(edit.FC.projectStore.getById('Q').projectData.room_n.cabinets[0].width,91);
 assert.equal(Object.hasOwn(edit.FC.projectStore.getById('Q').projectData.meta,'assignedInvestorId'),false);assert.deepEqual(clone(edit.FC.projectStore.getById('P')),other);
 console.log('PASS explicit owned-room Save works without stamping legacy source metadata or changing another investor');
 const d=legacy(),rowsD=JSON.parse(d.storage.getItem(P));rowsD.find(row=>row.id==='Q').projectData.meta.assignedInvestorId='SECRET-CUSTOMER-NAME';d.storage.setItem(P,JSON.stringify(rowsD));
 await d.handlers['open-investor']({element:{getAttribute:()=> 'N'}});
 d.s.location={origin:'https://mebleszek.github.io',pathname:'/meble-app/index.html'};
 Object.defineProperty(d.s,'__FC_MAIN_ACCESS__',{value:Object.freeze({isValid:()=>true}),writable:false,configurable:false});
 const original=d.seed(),state=JSON.stringify(d.FC.session),report=collect(d.s);
 assert.equal(report.status,'READ_ONLY');assert.equal(report.code,'PROJECT_OWNER_CONFLICT');assert.equal(report.investorOpen.stage,'activation');assert.equal(report.investorOpen.candidateProjects,1);
 assert.equal(report.runningCode.handler,'20261031_historical_owner_v1');assert.equal(report.runningCode.activation,'20261031_historical_owner_v1');
 assert.equal(JSON.stringify(report).includes('SECRET-CUSTOMER-NAME'),false);assert.deepEqual(d.seed(),original);assert.equal(JSON.stringify(d.FC.session),state);
 d.FC.investorProjectRuntime.version='old';assert.equal(collect(d.s).runningCode.activation,'LEGACY_OR_UNKNOWN');
 console.log('PASS actual read-only report includes activation refusal and running-module versions, without customer data or writes');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};

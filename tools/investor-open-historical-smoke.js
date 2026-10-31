'use strict';
const assert=require('node:assert/strict');
const {setup}=require('./investor-navigation-exit-smoke');
const P='fc_projects_v1',E='fc_edit_session_v1';
function historical(){
  const r=setup();r.FC.investorProjectPatches.patchInvestorsAPI();r.load('js/app/investor/project-bootstrap.js');
  r.s.normalizeProjectData=()=>r.FC.projectBootstrap.normalizeProjectData(r.s.projectData,r.FC.project.DEFAULT_PROJECT);
  const rows=JSON.parse(r.storage.getItem(P)),row=rows.find(item=>item.id==='Q');
  row.projectData.kuchnia.cabinets=[{id:'historical-cabinet',type:'stojąca',subType:'drzwi',width:63.5,setId:'historical-set',futureField:{exact:7.125}}];
  row.projectData.kuchnia.sets=[{id:'historical-set',futureField:'KEEP'}];
  r.storage.setItem(P,JSON.stringify(rows));return r;
}
async function main(){
  const r=historical(),raw=r.storage.getItem(P),rows=r.FC.projectStore.readAll();
  const normalized=rows.find(row=>row.id==='Q').projectData;
  assert.equal(normalized.kuchnia.cabinets[0].frontCount,2);assert.deepEqual(JSON.parse(JSON.stringify(normalized.kuchnia.cabinets[0].details)),{});
  assert.equal(Object.hasOwn(normalized.kuchnia.cabinets[0],'setNumber'),false,'Central/export model must preserve absent display numbering');
  assert.equal(Object.hasOwn(normalized.kuchnia.sets[0],'number'),false);
  const before=JSON.stringify(normalized),view=JSON.parse(before);
  r.FC.projectBootstrap.normalizeProjectData(view,r.FC.project.DEFAULT_PROJECT);
  assert.equal(view.kuchnia.cabinets[0].setNumber,1);assert.equal(view.kuchnia.sets[0].number,1);
  assert.equal(JSON.stringify(normalized),before,'Rendering a copy must not add fields to the central/export model');
  const rendered=JSON.stringify(view);r.FC.projectBootstrap.normalizeProjectData(view,r.FC.project.DEFAULT_PROJECT);
  assert.equal(JSON.stringify(view),rendered,'View normalization is idempotent');assert.equal(r.storage.getItem(P),raw);
  let activations=0;const activate=r.FC.investorProjectRuntime.setActiveProjectFromInvestor;
  r.FC.investorProjectRuntime.setActiveProjectFromInvestor=(...args)=>{activations++;return activate(...args);};
  assert.equal(await r.handlers['open-investor']({element:{getAttribute:()=> 'N'}}),true);
  assert.equal(activations,1,'Patched setter and action must not activate twice');
  assert.equal(r.s.uiState.currentInvestorId,'N');assert.equal(r.node('investorView').style.display,'block');
  assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.s.projectData),false);assert.equal(r.storage.getItem(P),raw);
  assert.equal(r.s.projectData.kuchnia.cabinets[0].futureField.exact,7.125);assert.equal(r.s.projectData.room_k,undefined);
  assert.equal(await r.handlers['session-cancel']({}),true);assert.equal(r.s.uiState.entry,'investorsList');
  assert.equal(await r.handlers['open-investor']({element:{getAttribute:()=> 'N'}}),true);assert.equal(activations,2);assert.equal(r.storage.getItem(P),raw);
  // Explicit same-investor Open still validates activation once.
  assert.equal(await r.handlers['open-investor']({element:{getAttribute:()=> 'N'}}),true);assert.equal(activations,3);
  r.s.projectData.kuchnia.cabinets[0].frontCount=1;
  assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.s.projectData),true,'A real front-count change must not be hidden by legacy defaults');
  r.s.projectData.kuchnia.cabinets[0].frontCount=2;
  assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.s.projectData),false);
  const viewRam=JSON.stringify(r.s.projectData);
  for(const field of ['set','cabinet']){
    if(field==='set')r.s.projectData.kuchnia.sets[0].number=2;
    else r.s.projectData.kuchnia.cabinets[0].setNumber=2;
    assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.s.projectData),true,'Explicit set numbering changes remain real edits: '+field);
    assert.equal(r.FC.projectPcvPolicy.read().code,'RAM_DIVERGENCE','PCV must refuse an actual numbering mismatch');
    r.s.projectData=JSON.parse(viewRam);
  }
  assert.equal(r.FC.projectPcvPolicy.read().ok,true,'View-only defaults compare equally without rewriting the source');
  assert.equal(r.storage.getItem(P),raw);
  assert.equal(await r.FC.views.openRoom('room_n'),true);
  r.s.projectData.room_n.cabinets[0].width=91;
  assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.s.projectData),true,'Actual edits cannot be erased as defaults');
  const ram=JSON.stringify(r.s.projectData),snapshot=r.storage.getItem(E),messages=r.messages.length;
  assert.equal(await r.handlers['open-investor']({element:{getAttribute:()=> 'K'}}),false);
  assert.equal(JSON.stringify(r.s.projectData),ram);assert.equal(r.storage.getItem(P),raw);assert.equal(r.storage.getItem(E),snapshot);
  assert.equal(r.FC.investors.getCurrentId(),'N');assert.equal(r.messages.length,messages,'Back from a valid dirty session must not show a new failure dialog');
  console.log('PASS historical read/render normalization, one activation, Exit/reopen and real RAM edit refusal without RAW writes');
  for(const kind of ['policy','ambiguous']){
    const t=historical(),before=t.storage.getItem(P),ram=JSON.stringify(t.s.projectData),owner=t.FC.investors.getCurrentId();
    if(kind==='policy')t.FC.projectPcvPolicy.ensureProjectMode=()=>({ok:false,code:'PCV_POLICY_MISMATCH'});
    else{const rows=JSON.parse(before),extra=structuredClone(rows.find(row=>row.id==='Q'));extra.id='Q-duplicate';rows.push(extra);t.storage.setItem(P,JSON.stringify(rows));}
    const protectedRaw=t.storage.getItem(P);
    assert.equal(await t.handlers['open-investor']({element:{getAttribute:()=> 'N'}}),false);
    assert.equal(t.storage.getItem(P),protectedRaw);assert.equal(JSON.stringify(t.s.projectData),ram);assert.equal(t.FC.investors.getCurrentId(),owner);
    assert.ok(t.messages.some(message=>message.sessionDiagnostic===true&&message.message.includes(kind==='policy'?'PCV_POLICY_MISMATCH':'PROJECT_OWNER_UNCONFIRMED')),'Refusal must expose the actual safe reason: '+kind);
  }
  const unconfirmed=historical(),protectedRaw=unconfirmed.storage.getItem(P),beforeOwner=unconfirmed.FC.investors.getCurrentId();
  unconfirmed.FC.investorProjectRuntime.setActiveProjectFromInvestor=()=>undefined;
  assert.equal(await unconfirmed.handlers['open-investor']({element:{getAttribute:()=> 'N'}}),false,'An undefined activation acknowledgement is not success');
  assert.equal(unconfirmed.FC.investors.getCurrentId(),beforeOwner);assert.equal(unconfirmed.storage.getItem(P),protectedRaw);
  console.log('PASS PCV refusal and ambiguous owner preserve RAM/records/pointers and expose existing in-app diagnostic');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};

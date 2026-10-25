'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('./project-navigation-blockers-smoke');
function empty(seed={}){
  const r=fixture(seed);
  r.s.Object=Object; // JSON in this mini-runtime is host-provided; keep isPlainObject in the same realm.
  // The older mini-runtime fixture omits migrations; production loads them.
  vm.runInContext(fs.readFileSync('js/app/shared/migrate.js','utf8'),r.s);
  r.s.projectData=r.FC.project.load();r.FC.investorProjectPatches.patchInvestorsAPI();return r;
}
async function main(){
  let passed=0;const test=async(name,run)=>{await run();passed++;console.log('PASS '+name);};
  await test('Null legacy normalization differs from bridge DEFAULT; truly empty default requires no session or owner',async()=>{
    for(const seed of [{},{fc_projects_v1:' [] ',fc_investors_v1:' [] '}]){
      const r=empty(seed),before=r.seed();
      assert.equal(r.FC.project.normalize(null).lazienka.settings.counterThickness,1.8,'Real legacy default reproduces the cause');
      assert.equal(r.s.projectData.lazienka.settings.counterThickness,2,'Bridge default is the approved current default');
      assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.s.projectData),false);assert.equal(r.FC.sessionNavigation.needsClosure(),false);
      let called=0,begin=0;const original=r.FC.session.begin;r.FC.session.begin=function(...args){begin++;return original.apply(this,args);};
      assert.equal(await r.FC.sessionNavigation.requestTransition('Projekty meblowe',()=>{called++;}),true);assert.equal(called,1);assert.equal(begin,0);
      assert.deepEqual(r.seed(),before);assert.equal(r.FC.session.projectId,'');assert.equal(r.FC.session.active,false);
    }
  });
  await test('An actual unowned RAM setting edit is retained and still refuses navigation',async()=>{
    const r=empty();r.s.projectData.lazienka.settings.counterThickness=1.8;const before=r.seed();let entered=0;
    assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.s.projectData),true);
    assert.equal(await r.FC.sessionNavigation.requestTransition('menu',()=>{entered++;}),false);assert.equal(entered,0);
    assert.equal(r.s.projectData.lazienka.settings.counterThickness,1.8);assert.equal(r.FC.session.lastError.code,'SESSION_OWNER_MISSING');assert.deepEqual(r.seed(),before);
  });
  await test('Persisted/RAM session evidence, stale owners, malformed stores and legacy projects are never classified as pristine',()=>{
    for(const [key,value]of [['fc_edit_session_v1','{"active":true}'],['fc_current_project_id_v1','missing'],['fc_current_investor_v1','missing'],['fc_projects_v1','broken'],['fc_projects_v1','{}'],['fc_investors_v1','[{"id":"owner"}]'],['fc_project_v1','{"private":"legacy"}'],['fc_project_inv_private_backup_v1','{"private":"legacy"}']]){
      const r=empty();r.storage.rows.set(key,value);const before=r.seed();assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.s.projectData),true,key);assert.deepEqual(r.seed(),before);
    }
    for(const patch of [{active:true},{durable:true},{snapshot:{}},{projectId:'orphan'},{context:{}},{lastError:{code:'PROJECT_WRITE_CONFLICT'}}]){
      const r=empty();Object.assign(r.FC.session,patch);const before=r.seed(),snapshot=r.FC.session.snapshot;
      assert.equal(r.FC.sessionNavigation.needsClosure(),true,JSON.stringify(patch));assert.deepEqual(r.seed(),before);assert.equal(r.FC.session.snapshot,snapshot);
    }
    const r=empty();r.storage.getItem=()=>{throw Error('Synthetic denied read');};assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.s.projectData),true,'Unreadable is never empty');
  });
  await test('A genuine owned session keeps its dirty/edit and owner-conflict navigation gates',async()=>{
    const r=fixture();assert.equal(await r.open(),true);assert.equal(r.FC.session.durable,true);assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.s.projectData),false);
    r.s.projectData.room_k.cabinets[0].width=65;r.FC.choiceBox.ask=async()=> 'back';const snapshot=r.FC.session.snapshot,before=r.seed();
    assert.equal(await r.FC.sessionNavigation.requestTransition('menu',()=>true),false);assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.snapshot,snapshot);assert.equal(r.s.projectData.room_k.cabinets[0].width,65);assert.deepEqual(r.seed(),before);
    const rows=JSON.parse(r.storage.getItem('fc_projects_v1'));rows.find(row=>row.id==='P').investorId='different-owner';r.storage.rows.set('fc_projects_v1',JSON.stringify(rows));const conflicting=r.seed();
    assert.equal(await r.FC.sessionNavigation.requestTransition('menu',()=>true),false);assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.snapshot,snapshot);assert.deepEqual(r.seed(),conflicting);
  });
  await test('Only the first explicit create can activate its real owner, with unchanged default RAM',()=>{
    for(const transient of [false,true]){
      const r=empty();
      if(transient){
        const draft={id:'draft_inv_synthetic'};
        r.FC.investorUI={state:{selectedId:draft.id,newlyCreatedId:draft.id},getTransientInvestor:()=>draft};
        r.s.uiState.currentInvestorId=draft.id;
        r.storage.rows.set('fc_ui_v1',JSON.stringify({currentInvestorId:draft.id}));
      }
      const inv=r.FC.investors.create({name:'First synthetic investor'});
      assert.ok(inv && inv.id);assert.equal(r.FC.investors.readAll().length,1);assert.equal(r.FC.projectStore.readAll().length,1);
      assert.equal(r.s.projectData.meta.assignedInvestorId,inv.id);assert.equal(r.FC.projectStore.getCurrentRecord().investorId,inv.id);
      assert.equal(r.FC.session.active,false);assert.equal(r.storage.getItem('fc_edit_session_v1'),null);
      assert.equal(r.FC.investorProjectRuntime.prepareFirstProjectActivation(),null,'An existing project cannot get an empty-install token');
    }
    for(const setup of [r=>{r.s.projectData.lazienka.settings.counterThickness=2.5;},r=>{r.s.uiState.currentInvestorId='foreign';},r=>{r.storage.rows.set('fc_edit_session_v1','{}');},r=>{r.FC.session.lastError={code:'PROJECT_WRITE_CONFLICT'};}]){
      const r=empty();setup(r);const before=r.seed(),ram=JSON.stringify(r.s.projectData);
      assert.equal(r.FC.investorProjectRuntime.prepareFirstProjectActivation(),null);assert.equal(JSON.stringify(r.s.projectData),ram);assert.deepEqual(r.seed(),before);
    }
    for(const alter of [r=>{r.s.projectData.lazienka.settings.counterThickness=2.5;},r=>{r.FC.session.snapshot={};},r=>{r.storage.rows.set('fc_investors_v1',JSON.stringify([{id:'new'},{id:'other'}]));}]){
      const r=empty(),token=r.FC.investorProjectRuntime.prepareFirstProjectActivation();assert.ok(token);
      r.FC.investors.writeAll([{id:'new',name:'Synthetic owner',rooms:[]}]);
      const expected=r.FC.investorProjectRuntime.normalizeProject(r.FC.investorProjectRuntime.freshProject());expected.meta={assignedInvestorId:'new'};
      r.FC.investorProjectRuntime.writeProjectFor('new',expected);alter(r);const before=r.seed(),ram=JSON.stringify(r.s.projectData);
      assert.equal(r.FC.investorProjectRuntime.setActiveProjectFromInvestor('new',{firstActivation:token,expectedProject:expected}),false);
      assert.equal(JSON.stringify(r.s.projectData),ram);assert.deepEqual(r.seed(),before);
    }
  });
  console.log('Empty installation targeted: '+passed+'/5 groups PASS');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};

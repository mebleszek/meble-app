#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {fixture}=require('./project-navigation-blockers-smoke');
const P='fc_projects_v1',E='fc_edit_session_v1';
const tests=[],test=(name,fn)=>tests.push([name,fn]);
async function opened(){
  const r=fixture();assert.equal(await r.open(),true);r.prompts=0;
  r.FC.choiceBox.ask=async()=>{r.prompts++;return 'back';};return r;
}
test('Clean Kitchen → INWESTOR → Salon commits only the session, without asking',async()=>{
  const r=await opened(),raw=r.storage.getItem(P);await r.FC.tabNavigation.setActiveTab('inwestor');
  r.storage.calls.length=0;assert.equal(await r.FC.views.openRoom('room_s'),true);
  assert.equal(r.prompts,0);assert.equal(r.s.uiState.activeTab,'wywiad');assert.equal(r.FC.session.roomId,'room_s');
  assert.equal(r.storage.getItem(P),raw);assert.ok(!r.storage.calls.includes(P));
  assert.equal(JSON.parse(r.storage.getItem(E)).roomId,'room_s');
});
test('Clean WYCENA and ROZRYS transitions require no dialog or project write',async()=>{
  for(const tab of ['wycena','rozrys']){
    const r=await opened();assert.equal(r.FC.sessionNavigation.needsClosure(),true);
    assert.equal(r.FC.sessionNavigation.canCalculate(),false);
    r.storage.calls.length=0;const raw=r.storage.getItem(P);
    await r.FC.tabNavigation.setActiveTab(tab);
    assert.equal(r.prompts,0);assert.equal(r.s.uiState.activeTab,tab);assert.equal(r.FC.session.active,false);
    assert.equal(r.storage.getItem(E),null);assert.equal(r.storage.getItem(P),raw);assert.ok(!r.storage.calls.includes(P));
  }
});
test('RAM-only cabinet change requires the three-option dialog despite isDirty=false',async()=>{
  const r=await opened();assert.equal(r.FC.session.isDirty(),false);r.s.projectData.room_k.cabinets[0].width=65;
  const snapshot=r.FC.session.snapshot;assert.equal(await r.FC.views.openRoom('room_s'),false);
  assert.equal(r.prompts,1);assert.equal(r.FC.session.snapshot,snapshot);assert.equal(r.s.projectData.room_k.cabinets[0].width,65);
});
test('Persisted room change remains dirty even if RAM matches central data',async()=>{
  const r=await opened();r.s.projectData.room_k.cabinets[0].width=65;
  const result=r.FC.project.saveConfirmed(r.s.projectData);assert.equal(result.ok,true);r.s.projectData=result.project;
  assert.equal(await r.FC.views.openRoom('room_s'),false);assert.equal(r.prompts,1);assert.equal(r.FC.session.active,true);
});
test('Both monitored global option keys require a dialog, even with stale clean cache',async()=>{
  for(const key of ['fc_edge_v1','fc_material_part_options_v1']){
    const r=await opened();r.FC.session.isDirty();r.storage.rows.set(key,'{"changed":true}');
    assert.equal(await r.FC.views.openRoom('room_s'),false);assert.equal(r.prompts,1);assert.equal(r.storage.getItem(key),'{"changed":true}');
  }
});
test('Failed cleanup blocks clean navigation; retry succeeds without project write',async()=>{
  const r=await opened(),payload=r.storage.getItem(E),snapshot=r.FC.session.snapshot,raw=r.storage.getItem(P);
  r.storage.fail.set('remove:'+E,true);assert.equal(await r.FC.views.openRoom('room_s'),false);
  assert.equal(r.prompts,0);assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.snapshot,snapshot);
  assert.equal(r.s.uiState.roomType,'room_k');assert.equal(r.storage.getItem(E),payload);assert.equal(r.storage.getItem(P),raw);
  r.storage.fail.clear();assert.equal(await r.FC.views.openRoom('room_s'),true);assert.equal(r.prompts,0);assert.equal(r.storage.getItem(P),raw);
});
test('Same-room entry retains snapshot and does not commit or prompt',async()=>{
  const r=await opened(),snapshot=r.FC.session.snapshot,payload=r.storage.getItem(E);
  assert.equal(await r.open(),true);assert.equal(r.prompts,0);assert.equal(r.FC.session.snapshot,snapshot);assert.equal(r.storage.getItem(E),payload);
});
test('Fresh unrelated room and independent project changes survive clean navigation',async()=>{
  const r=await opened(),row=r.record();row.projectData.room_s.cabinets[0].width=75;assert.ok(r.FC.projectStore.upsert(row));
  const other=r.FC.projectStore.getById('Q');other.projectData.room_n.cabinets[0].width=99;assert.ok(r.FC.projectStore.upsert(other));
  r.s.projectData=r.FC.project.load();const raw=r.storage.getItem(P);
  assert.equal(await r.FC.views.openRoom('room_s'),true);assert.equal(r.prompts,0);assert.equal(r.storage.getItem(P),raw);
  assert.equal(r.s.projectData.room_s.cabinets[0].width,75);assert.equal(r.FC.projectStore.getById('Q').projectData.room_n.cabinets[0].width,99);
});
test('Missing, corrupt or contradictory durable payload blocks rather than guessing clean',async()=>{
  for(const mode of ['missing','corrupt','snapshot','owner']){
    const r=await opened(),raw=r.storage.getItem(P),payload=JSON.parse(r.storage.getItem(E));
    if(mode==='missing')r.storage.rows.delete(E);
    else if(mode==='corrupt')r.storage.rows.set(E,'{');
    else{if(mode==='snapshot')payload.snapshot.fc_edge_v1='{}';else payload.roomId='room_s';r.storage.rows.set(E,JSON.stringify(payload));}
    assert.equal(await r.FC.views.openRoom('room_s'),false);assert.equal(r.prompts,0);assert.equal(r.FC.session.active,true);
    assert.equal(r.s.uiState.roomType,'room_k');assert.equal(r.storage.getItem(P),raw);
  }
});
test('External owner conflict and missing project record block before any dialog',async()=>{
  for(const mode of ['conflict','missing']){
    const r=await opened(),rows=JSON.parse(r.storage.getItem(P));
    if(mode==='conflict')rows.find(row=>row.id==='P').projectData.room_k.cabinets[0].width=88;
    else rows.splice(rows.findIndex(row=>row.id==='P'),1);
    r.storage.rows.set(P,JSON.stringify(rows));const raw=r.storage.getItem(P);
    assert.equal(await r.FC.views.openRoom('room_s'),false);assert.equal(r.prompts,0);assert.equal(r.FC.session.active,true);assert.equal(r.storage.getItem(P),raw);
  }
});
test('Storage read exception is unknown, never a clean session',async()=>{
  const r=await opened(),read=r.storage.getItem.bind(r.storage),snapshot=r.FC.session.snapshot;
  r.storage.getItem=key=>{if(key==='fc_edge_v1')throw Error('Read unavailable');return read(key);};
  assert.equal(await r.FC.views.openRoom('room_s'),false);assert.equal(r.prompts,0);assert.equal(r.FC.session.snapshot,snapshot);assert.equal(r.s.uiState.roomType,'room_k');
});
test('Reloaded clean session is freshly verified and can navigate without re-saving',async()=>{
  const r=await opened(),reboot=fixture(r.seed()),raw=r.storage.getItem(P);let prompts=0;
  reboot.FC.choiceBox.ask=async()=>{prompts++;return 'back';};
  assert.equal(await reboot.FC.views.openRoom('room_s'),true);assert.equal(prompts,0);assert.equal(reboot.storage.getItem(P),raw);
});
test('A change during RAM verification invalidates clean evidence and blocks navigation',async()=>{
  const r=await opened(),compare=r.FC.investorProjectRuntime.hasProjectDivergence;
  r.FC.investorProjectRuntime.hasProjectDivergence=data=>{
    const result=compare(data);r.storage.rows.set('fc_edge_v1','{"concurrent":true}');return result;
  };
  assert.equal(await r.FC.views.openRoom('room_s'),false);assert.equal(r.prompts,0);assert.equal(r.FC.session.active,true);
  assert.equal(r.s.uiState.roomType,'room_k');assert.equal(r.storage.getItem('fc_edge_v1'),'{"concurrent":true}');
});
test('Non-durable or unavailable RAM cannot be mistaken for a clean session',async()=>{
  for(const mode of ['durability','ram']){
    const r=await opened();if(mode==='durability')r.FC.session.durable=false;else r.s.projectData=null;
    assert.equal(await r.FC.views.openRoom('room_s'),false);assert.equal(r.prompts,0);assert.equal(r.FC.session.active,true);assert.equal(r.s.uiState.roomType,'room_k');
  }
});
(async()=>{let failed=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}console.log(`${tests.length-failed}/${tests.length} PASS`);process.exitCode=failed?1:0;})();

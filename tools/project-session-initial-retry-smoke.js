#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const {fixture} = require('./project-navigation-blockers-smoke');
const P = 'fc_projects_v1', E = 'fc_edit_session_v1', H = 'fc_quote_snapshots_v1';
const tests = [], test = (name, fn)=>tests.push([name,fn]);

async function failedBegin(dirty = false){
  const r = fixture();
  assert.ok(r.FC.quoteSnapshotStore.save({id:'historical',project:{id:'P',investorId:'K'},investor:{id:'K'},scope:{selectedRooms:['room_k']},lines:{materials:[{name:'Synthetic board',qty:1,unitPrice:1234,total:1234}]},totals:{grand:1234},commercial:{preliminary:false},meta:{selectedByClient:true}}));
  assert.equal(await r.open(),true);
  assert.equal(r.FC.session.commit(),true);
  r.storage.rows.set('fc_price_list_v1','{"synthetic":"unchanged prices"}');
  if(dirty) r.s.projectData.room_k.cabinets[0].width = 65;
  r.storage.fail.set(E,true);
  assert.equal(r.FC.session.begin('room_k'),false);
  assert.equal(r.FC.session.active,true);
  assert.equal(r.FC.session.durable,false);
  assert.equal(r.storage.getItem(E),null);
  r.original = r.FC.session.snapshot;
  r.startedAt = r.FC.session.startedAt;
  r.before = Object.fromEntries(r.storage.rows);
  return r;
}
function protectedBytes(r){
  for(const key of [H,'fc_price_list_v1','fc_investors_v1']) assert.equal(r.storage.getItem(key),r.before[key]);
  const before=JSON.parse(r.before[P]),after=JSON.parse(r.storage.getItem(P));
  assert.deepEqual(after.find(row=>row.id==='Q'),before.find(row=>row.id==='Q'));
  assert.deepEqual(after.find(row=>row.id==='P').projectData.room_s,before.find(row=>row.id==='P').projectData.room_s);
}
async function act(r,action){
  if(action==='navigation') return r.FC.tabNavigation.setActiveTab('wycena');
  return r.handlers['session-'+action]({});
}
test('Public Save retries the initial baseline, then confirms the project and session cleanup',async()=>{
  const r=await failedBegin(true);r.storage.fail.clear();
  await act(r,'save');
  assert.equal(r.FC.session.active,false);assert.equal(r.storage.getItem(E),null);
  assert.equal(r.record().projectData.room_k.cabinets[0].width,65);
  protectedBytes(r);
});
test('Explicit Cancel retries only after consent, restores RAM and reopens the same durable room',async()=>{
  const r=await failedBegin(true);r.storage.fail.clear();let asked=0;
  r.FC.confirmBox={async ask(){asked++;assert.equal(r.storage.getItem(E),null);return true;}};
  await act(r,'cancel');assert.equal(asked,1);
  assert.equal(r.s.projectData.room_k.cabinets[0].width,60);
  assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.durable,true);
  assert.equal(r.FC.session.projectId,'P');assert.equal(r.FC.session.roomId,'room_k');
  protectedBytes(r);
});
test('Declining Cancel does not persist a baseline or discard the draft',async()=>{
  const r=await failedBegin(true);r.storage.fail.clear();r.FC.confirmBox={async ask(){return false;}};
  r.storage.calls.length=0;await act(r,'cancel');
  assert.equal(r.FC.session.snapshot,r.original);assert.equal(r.FC.session.durable,false);
  assert.equal(r.s.projectData.room_k.cabinets[0].width,65);assert.deepEqual(r.storage.calls,[]);
});
test('Clean navigation retries and closes without any project, investor or history write',async()=>{
  const r=await failedBegin();r.storage.fail.clear();r.storage.calls.length=0;
  assert.equal(await act(r,'navigation'),true);assert.equal(r.FC.session.active,false);
  assert.equal(r.s.uiState.activeTab,'wycena');assert.equal(r.storage.getItem(P),r.before[P]);
  assert.equal(r.storage.calls.includes(P),false);protectedBytes(r);
});
test('Dirty navigation retains Back / Save / Discard decisions after securing the original baseline',async()=>{
  for(const choice of ['back','save','discard']){
    const r=await failedBegin(true);r.storage.fail.clear();let asked=0;
    r.FC.choiceBox={async ask(){asked++;const payload=JSON.parse(r.storage.getItem(E));
      assert.deepEqual(payload.snapshot,JSON.parse(JSON.stringify(r.original)));
      assert.equal(payload.startedAt,r.startedAt);return choice;}};
    assert.equal(await act(r,'navigation'),choice!=='back');assert.equal(asked,1);
    assert.equal(r.record().projectData.room_k.cabinets[0].width,choice==='save'?65:60);
    assert.equal(r.FC.session.active,choice==='back');
    if(choice==='back'){assert.equal(r.s.projectData.room_k.cabinets[0].width,65);assert.equal(r.FC.session.snapshot,r.original);}
    protectedBytes(r);
  }
});
test('Persistent storage failure never finishes a session or loses the baseline',async()=>{
  for(const action of ['save','cancel','navigation']){
    const r=await failedBegin();await act(r,action);
    assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.durable,false);
    assert.equal(r.FC.session.snapshot,r.original);assert.equal(r.storage.getItem(P),r.before[P]);
    assert.equal(r.storage.getItem(E),null);protectedBytes(r);
  }
});
test('A newer owner revision still refuses all retry paths without adopting or overwriting it',async()=>{
  for(const action of ['save','cancel','navigation']){
    const r=await failedBegin();r.storage.fail.clear();const rows=JSON.parse(r.storage.getItem(P));
    rows.find(row=>row.id==='P').projectData.room_k.cabinets[0].width=88;
    r.storage.rows.set(P,JSON.stringify(rows));const newer=r.storage.getItem(P);
    await act(r,action);assert.equal(r.FC.session.lastError.code,'PROJECT_WRITE_CONFLICT');
    assert.equal(r.storage.getItem(P),newer);assert.equal(r.storage.getItem(E),null);
    assert.equal(r.FC.session.snapshot,r.original);assert.equal(r.FC.session.durable,false);
  }
});
test('Foreign active project and a corrupt payload cannot acquire initial retry permission',async()=>{
  for(const mode of ['owner','payload']){
    const r=await failedBegin();r.storage.fail.clear();
    if(mode==='owner')r.storage.rows.set('fc_current_project_id_v1','Q');else r.storage.rows.set(E,'{broken');
    const raw=r.storage.getItem(P),payload=r.storage.getItem(E);
    await act(r,'save');assert.equal(r.FC.session.lastError.code,mode==='owner'?'SESSION_OWNER_MISMATCH':'SESSION_UNCONFIRMED');
    assert.equal(r.storage.getItem(P),raw);assert.equal(r.storage.getItem(E),payload);
  }
});
test('Missing proof from a restored session never becomes an initial begin failure',async()=>{
  const r=fixture();await r.open();const reboot=fixture(r.seed()),raw=reboot.storage.getItem(P);
  reboot.FC.session.durable=false;reboot.storage.rows.delete(E);reboot.storage.calls.length=0;
  await act(reboot,'save');assert.equal(reboot.FC.session.lastError.code,'SESSION_UNCONFIRMED');
  assert.equal(reboot.storage.getItem(P),raw);assert.equal(reboot.storage.getItem(E),null);
  assert.deepEqual(reboot.storage.calls,[]);
});
test('Initial session write with a lost read-back can resume only from the identical stored proof',async()=>{
  for(const restart of [false,true]){
    const r=fixture();await r.open();r.FC.session.commit();
    const get=r.storage.getItem.bind(r.storage);let miss=false;
    r.storage.hook=key=>{if(key===E)miss=true;};
    r.storage.getItem=key=>{if(key===E&&miss){miss=false;return null;}return get(key);};
    assert.equal(r.FC.session.begin('room_k'),false);
    assert.equal(r.FC.session.durable,false);assert.ok(get(E));
    r.storage.hook=null;const raw=get(P),snapshot=r.FC.session.snapshot;
    const client=restart?fixture(r.seed()):r;
    assert.equal(await act(client,'navigation'),true);
    assert.equal(client.FC.session.active,false);assert.equal(client.storage.getItem(E),null);
    assert.equal(client.storage.getItem(P),raw);
    assert.equal(snapshot[P],raw);
  }
});
test('Lost session acknowledgement of a successful project write remains blocked, including after restart',async()=>{
  const r=fixture();await r.open();r.storage.fail.set(E,true);
  r.s.projectData.room_k.cabinets[0].width=67;
  const result=r.FC.project.saveConfirmed(r.s.projectData);assert.equal(result.ok,false);assert.equal(result.projectSaved,true);
  r.storage.fail.clear();const payload=r.storage.getItem(E),raw=r.storage.getItem(P);
  for(const action of ['save','cancel','navigation'])await act(r,action);
  assert.equal(r.FC.session.lastError.code,'SESSION_UNCONFIRMED');
  assert.equal(r.storage.getItem(E),payload);assert.equal(r.storage.getItem(P),raw);
  const reboot=fixture(r.seed());await act(reboot,'save');
  assert.equal(reboot.FC.session.lastError.code,'PROJECT_WRITE_CONFLICT');
  assert.equal(reboot.storage.getItem(E),payload);assert.equal(reboot.storage.getItem(P),raw);
});
test('Restart after a successful retry retains the saved value, history and a usable clean session',async()=>{
  const r=await failedBegin(true);r.storage.fail.clear();await act(r,'save');
  const reboot=fixture(r.seed());assert.equal(await reboot.open(),true);
  assert.equal(reboot.FC.session.canSaveProject(),true);
  assert.equal(reboot.record().projectData.room_k.cabinets[0].width,65);
  assert.equal(await act(reboot,'navigation'),true);assert.equal(reboot.FC.session.active,false);
  assert.equal(reboot.storage.getItem(H),r.before[H]);
});
(async()=>{let failed=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}}console.log(`${tests.length-failed}/${tests.length} PASS`);process.exitCode=failed?1:0;})();

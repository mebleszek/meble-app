#!/usr/bin/env node
'use strict';
// Fresh VM/document per attempt; only persisted localStorage crosses restart.
const assert=require('node:assert/strict');
const {fixture}=require('./project-navigation-blockers-smoke');
const P='fc_projects_v1',E='fc_edit_session_v1';
const clone=x=>JSON.parse(JSON.stringify(x));
const tests=[],test=(name,fn)=>tests.push([name,fn]);
async function opened(){
  const r=fixture();
  r.FC.quoteSnapshotStore.save({id:'historical',project:{id:'P',investorId:'K'},investor:{id:'K'},scope:{selectedRooms:['room_k']},lines:{materials:[{name:'Synthetic',qty:1,unitPrice:100,total:100}]},totals:{grand:100},meta:{selectedByClient:true}});
  r.storage.rows.set('fc_price_list_v1','{"synthetic":"unchanged"}');
  assert.equal(await r.open(),true);return r;
}
function reboot(rows){
  const r=fixture(clone(rows));r.FC.confirmBox={async ask(){return true;}};
  assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.durable,true);
  assert.equal(r.storage.getItem(E),rows[E]);r.storage.calls.length=0;return r;
}
async function refused(rows,code){
  for(const action of ['save','cancel','navigation']){
    const r=reboot(rows),before=r.seed(),snapshot=r.FC.session.snapshot;
    if(action==='navigation')assert.equal(await r.FC.tabNavigation.setActiveTab('wycena'),false);
    else await r.handlers['session-'+action]({});
    if(action==='navigation'&&code==='SESSION_UNCONFIRMED'){
      assert.equal(r.FC.session.lastError,null); // navigation shows a generic proof refusal
      assert.ok(r.messages.some(row=>row.title==='Nie można potwierdzić stanu sesji'));
    }else assert.equal(r.FC.session.lastError.code,code,action);
    assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.snapshot,snapshot);
    assert.deepEqual(r.seed(),before,action+' must preserve ALL persisted bytes');
    assert.deepEqual(r.storage.calls,[]);
    // No in-memory failure flag survives: the second restart must refuse too.
    const again=reboot(r.seed());assert.equal(again.FC.session.canSaveProject(),false);
    assert.equal(again.FC.session.lastError.code,code);assert.deepEqual(again.seed(),before);
  }
}
test('A complete baseline session survives a new document and clean navigation needs no initial retry flag',async()=>{
  const r=await opened(),rows=r.seed(),fresh=reboot(rows);
  assert.equal(fresh.FC.session.canSaveProject(),true);
  assert.equal(fresh.FC.session.inspectNavigationState().dirty,false);
  assert.equal(await fresh.FC.tabNavigation.setActiveTab('wycena'),true);
  assert.equal(fresh.FC.session.active,false);assert.equal(fresh.storage.getItem(E),null);
  assert.equal(fresh.storage.getItem(P),rows[P]);
  assert.equal(fresh.storage.calls.includes(P),false);
});
test('An acknowledged revision restores canonical RAM and allows explicit Save without changing history or globals',async()=>{
  const r=await opened();r.s.projectData.room_k.cabinets[0].width=65;
  assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);const rows=r.seed(),fresh=reboot(rows);
  assert.equal(fresh.s.projectData.room_k.cabinets[0].width,65);
  assert.equal(fresh.FC.session.canSaveProject(),true);
  assert.equal(fresh.FC.session.inspectNavigationState().dirty,true);
  await fresh.handlers['session-save']({});assert.equal(fresh.FC.session.active,false);
  assert.equal(fresh.record().projectData.room_k.cabinets[0].width,65);
  for(const key of ['fc_quote_snapshots_v1','fc_price_list_v1','fc_investors_v1'])assert.equal(fresh.storage.getItem(key),rows[key]);
});
test('Lost session revision after an actual central write remains blocked through every action and two restarts',async()=>{
  const r=await opened(),old=r.storage.getItem(E);r.storage.fail.set(E,true);
  r.s.projectData.room_k.cabinets[0].width=65;
  const result=r.FC.project.saveConfirmed(r.s.projectData);
  assert.equal(result.ok,false);assert.equal(result.projectSaved,true);
  assert.equal(result.code,'SESSION_UNCONFIRMED');assert.equal(r.storage.getItem(E),old);
  r.storage.fail.clear();assert.equal(r.FC.session.canSaveProject(),false);
  assert.equal(r.FC.session.lastError.code,'SESSION_UNCONFIRMED');
  await refused(r.seed(),'PROJECT_WRITE_CONFLICT');
});
test('A newer external owner revision also remains blocked through every action and two restarts',async()=>{
  const r=await opened(),rows=r.seed(),records=JSON.parse(rows[P]);
  records.find(row=>row.id==='P').projectData.room_k.cabinets[0].width=88;
  rows[P]=JSON.stringify(records);await refused(rows,'PROJECT_WRITE_CONFLICT');
});
test('Lost write attribution and an external writer can leave identical persisted evidence',async()=>{
  const r=await opened(),original=r.seed();r.storage.fail.set(E,true);
  r.s.projectData.room_k.cabinets[0].width=65;
  assert.equal(r.FC.project.saveConfirmed(r.s.projectData).projectSaved,true);
  const own=r.seed();assert.equal(own[E],original[E]);
  // Model another document writing the same final RAW. No session receipt or
  // operation ID in these bytes can tell which document performed that write.
  const baseline=JSON.parse(original[P]).find(row=>row.id==='P').projectData;
  assert.deepEqual(JSON.parse(own.fc_project_backup_v1),baseline);
  assert.deepEqual(Object.keys(JSON.parse(own.fc_project_backup_meta_v1)),['savedAt']);
  // The compatibility backup contains old project bytes and a wall-clock date,
  // not an operation/session ID or acknowledgement of the new owned revision.
  const external={...original,[P]:own[P],fc_project_backup_v1:own.fc_project_backup_v1,
    fc_project_backup_meta_v1:own.fc_project_backup_meta_v1};
  assert.deepEqual(Object.keys(own).filter(key=>external[key]!==own[key]),[],'Changed persisted keys must be modeled explicitly');
  const a=reboot(own),b=reboot(external);
  assert.equal(a.FC.session.canSaveProject(),false);assert.equal(b.FC.session.canSaveProject(),false);
  assert.equal(a.FC.session.lastError.code,b.FC.session.lastError.code);
  assert.equal(a.FC.session.lastError.code,'PROJECT_WRITE_CONFLICT');
});
test('A bridge read-back failure with a persisted matching owner proof is different from a lost session revision',async()=>{
  const r=await opened(),update=r.FC.projectStore.updateRecordConfirmed;
  r.FC.projectStore.updateRecordConfirmed=function(...args){
    const result=update(...args);assert.ok(result);
    const records=JSON.parse(r.storage.getItem(P));
    records.find(row=>row.id==='P').projectData.room_s.cabinets[0].width=77;
    r.storage.rows.set(P,JSON.stringify(records));return result;
  };
  r.s.projectData.room_k.cabinets[0].width=65;
  const result=r.FC.project.saveConfirmed(r.s.projectData,{expectedRecord:r.FC.projectStore.getById('P')});
  assert.equal(result.ok,false);assert.equal(result.projectSaved,true);assert.equal(result.code,'SAVE_UNCONFIRMED');
  assert.equal(r.FC.session.canSaveProject(),false);
  const rows=r.seed(),fresh=reboot(rows);
  assert.equal(fresh.s.projectData.room_k.cabinets[0].width,65);
  assert.equal(fresh.s.projectData.room_s.cabinets[0].width,77);
  assert.equal(fresh.FC.session.canSaveProject(),true);
  assert.equal(fresh.FC.session.commit(),true); // explicit completion, no project rewrite
  assert.equal(fresh.storage.getItem(P),rows[P]);assert.equal(fresh.storage.calls.includes(P),false);
});
test('An already restored baseline after failed Cancel cleanup can finish without another rollback',async()=>{
  const r=await opened();r.s.projectData.room_k.cabinets[0].width=65;
  assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);
  r.storage.fail.set('remove:'+E,true);assert.equal(r.FC.session.cancel(),false);
  assert.equal(r.record().projectData.room_k.cabinets[0].width,60);r.storage.fail.clear();
  const rows=r.seed(),fresh=reboot(rows);assert.equal(fresh.FC.session.canSaveProject(),true);
  assert.equal(fresh.FC.session.commit(),true);assert.equal(fresh.storage.getItem(P),rows[P]);
  assert.equal(fresh.storage.calls.includes(P),false);
});
test('A stored snapshot lacking required proof is not repaired from existence or matching geometry',async()=>{
  const r=await opened(),rows=r.seed(),payload=JSON.parse(rows[E]);
  delete payload.snapshot.fc_edge_v1;rows[E]=JSON.stringify(payload);
  await refused(rows,'SESSION_UNCONFIRMED');
});
(async()=>{let failed=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}}console.log(`${tests.length-failed}/${tests.length} PASS`);process.exitCode=failed?1:0;})();

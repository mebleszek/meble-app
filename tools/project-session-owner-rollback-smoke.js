#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ROOT = path.resolve(__dirname,'..');
const PROJECTS='fc_projects_v1', SESSION='fc_edit_session_v1';
const PARTS=['fc_edge_v1','fc_material_part_options_v1'];
const clone=value=>JSON.parse(JSON.stringify(value));
function runtime(seed){
  class MemoryStorage{
    constructor(rows={}){this.rows=new Map(Object.entries(rows));this.calls=[];this.fail=new Map();this.onRead=null;}
    get length(){return this.rows.size;}
    key(i){return [...this.rows.keys()][i]??null;}
    getItem(k){if(this.onRead)this.onRead(String(k));return this.rows.get(String(k))??null;}
    setItem(k,v){k=String(k);this.calls.push(['set',k]);const mode=this.fail.get('set:'+k);if(mode==='throw')throw new Error('storage failure');if(mode==='noop')return;if(mode==='false')return false;this.rows.set(k,String(v));}
    removeItem(k){k=String(k);this.calls.push(['remove',k]);if(this.fail.has('remove:'+k))throw new Error('cleanup failure');this.rows.delete(k);}
    clear(){throw Error('clear forbidden');}
  }
  const storage=new MemoryStorage(seed),handlers={},messages=[];
  const s={console,Date,setTimeout,clearTimeout,Storage:MemoryStorage,localStorage:storage,sessionStorage:new MemoryStorage(),
    uiState:{activeTab:'wywiad'},location:{reloads:0,reload(){this.reloads++;}},
    FC:{utils:{clone},schema:{CURRENT_SCHEMA_VERSION:1,DEFAULT_PROJECT:{schemaVersion:1}},infoBox:{open:cfg=>messages.push(cfg)},
      actions:{register:actions=>Object.assign(handlers,actions)},views:{refreshSessionButtons(){}}}};
  s.window=s;vm.createContext(s);
  let investor=seed?storage.getItem('fc_current_investor_v1'):'inv-A';
  s.FC.investors={getCurrentId:()=>investor,setCurrentId(id){investor=id;storage.setItem('fc_current_investor_v1',id||'');return id;},create(){throw Error('blocked create must not run');},remove(){throw Error('blocked remove must not run');}};
  for(const file of ['js/app/shared/constants.js','js/app/shared/storage.js','js/app/project/project-model.js','js/app/project/project-store.js',
    'js/app/project/project-bridge.js','js/app/investor/investor-project-repository.js','js/app/investor/investor-project-runtime.js',
    'js/app/investor/investor-project-patches.js','js/app/investor/session.js','js/app/project/project-domain-operations.js','js/app/ui/actions-register.js','js/app/ui/session-navigation.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),s,{filename:file});
  }
  const FC=s.FC;
  if(!seed){
    for(const [id,width] of [['A',60],['B',70]])assert.ok(FC.projectStore.upsert({id,investorId:'inv-'+id,projectData:{meta:{assignedInvestorId:'inv-'+id},room:{cabinets:[{id:'cab-'+id,width}],fronts:[],sets:[],settings:{}}}}));
    FC.projectStore.setCurrentProjectId('A');storage.setItem('fc_current_investor_v1','inv-A');
  }
  s.projectData=FC.project.load();FC.investorProjectPatches.patchInvestorsAPI();
  const update=(id,width)=>{const record=FC.projectStore.getById(id);record.projectData.room.cabinets[0].width=width;assert.ok(FC.projectStore.upsert(record));};
  const row=id=>JSON.parse(storage.getItem(PROJECTS)).find(row=>row.id===id);
  return {s,FC,session:FC.session,storage,handlers,messages,update,row,rows:()=>Object.fromEntries(storage.rows)};
}
function edited(){const r=runtime();assert.equal(r.session.begin(),true);r.update('A',65);return r;}
function preserved(r,raw){assert.equal(r.session.active,true);assert.ok(r.session.snapshot);assert.equal(r.storage.getItem(SESSION),raw);}
const tests=[],test=(name,fn)=>tests.push([name,fn]);
test('Owner A rollback preserves current B and restores only A',()=>{
  const r=edited();r.update('B',75);const b=clone(r.row('B'));assert.equal(r.session.projectId,'A');
  assert.equal(r.session.cancel(),true);assert.equal(r.row('A').projectData.room.cabinets[0].width,60);assert.deepEqual(r.row('B'),b);
});
test('B-only edit does not dirty A and cancel never rewrites the container',()=>{
  const r=runtime();r.session.begin();r.update('B',75);assert.equal(r.session.isDirty(),false);r.storage.calls.length=0;
  assert.equal(r.session.cancel(),true);assert.equal(r.row('B').projectData.room.cabinets[0].width,75);
  assert.ok(!r.storage.calls.some(call=>call[1]===PROJECTS));
});
test('New B/C records and deletion of unrelated records survive owner rollback',()=>{
  const r=edited();r.FC.projectStore.upsert({id:'C',investorId:'inv-C',projectData:{room:{cabinets:[]}}});
  const rows=JSON.parse(r.storage.getItem(PROJECTS)).filter(row=>row.id!=='B');r.storage.setItem(PROJECTS,JSON.stringify(rows));
  const c=clone(r.row('C'));assert.equal(r.session.cancel(),true);assert.equal(r.row('B'),undefined);assert.deepEqual(r.row('C'),c);
});
test('Locally deleted owner is restored without deleting other projects',()=>{
  const r=edited();const rows=JSON.parse(r.storage.getItem(PROJECTS)).filter(row=>row.id!=='A');r.storage.setItem(PROJECTS,JSON.stringify(rows));
  const b=clone(r.row('B'));assert.equal(r.session.cancel(),true);assert.equal(r.row('A').projectData.room.cabinets[0].width,60);assert.deepEqual(r.row('B'),b);
});
test('Save A through the UI preserves B and closes durably',()=>{
  const r=edited();r.update('B',75);const b=clone(r.row('B'));r.s.projectData=r.FC.projectStore.getById('A').projectData;r.s.projectData.room.cabinets[0].width=66;
  r.handlers['session-save']({});assert.equal(r.row('A').projectData.room.cabinets[0].width,66);assert.deepEqual(r.row('B'),b);
  assert.equal(r.session.active,false);assert.equal(r.storage.getItem(SESSION),null);
});
test('Investor and direct project switches are blocked before activation',()=>{
  const r=edited(),raw=r.storage.getItem(SESSION);r.s.projectData=r.FC.projectStore.getById('A').projectData;
  assert.equal(r.FC.investors.setCurrentId('inv-B'),'inv-A');assert.equal(r.FC.projectStore.setCurrentProjectId('B'),false);
  assert.equal(r.FC.projectStore.loadProjectDataForInvestor('inv-B',null),null);
  assert.equal(r.FC.investors.create({}),null);assert.equal(r.FC.investors.remove('inv-B'),false);
  const ram=clone(r.s.projectData),b=clone(r.row('B'));
  r.FC.investorProjectRuntime.setActiveProjectFromInvestor('inv-B');
  assert.deepEqual(clone(r.s.projectData),ram);
  assert.equal(r.FC.investorProjectRuntime.saveActiveProjectToInvestor('inv-B'),null);
  assert.deepEqual(r.row('B'),b);
  assert.equal(r.FC.projectStore.getCurrentProjectId(),'A');preserved(r,raw);
  assert.equal(r.session.commit(),true);r.FC.investors.setCurrentId('inv-B');assert.equal(r.FC.projectStore.getCurrentProjectId(),'B');
});
test('Even bypassed switching cannot save B through A session or roll B back',()=>{
  const r=edited();r.update('B',75);r.storage.setItem('fc_current_project_id_v1','B');r.storage.setItem('fc_current_investor_v1','inv-B');
  r.s.FC.investors.getCurrentId=()=> 'inv-B';r.s.projectData=r.FC.projectStore.getById('B').projectData;r.s.projectData.room.cabinets[0].width=99;
  const b=clone(r.row('B'));assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,false);r.handlers['session-save']({});assert.deepEqual(r.row('B'),b);
  assert.equal(r.session.commit(),false);assert.equal(r.session.cancel(),true);assert.deepEqual(r.row('B'),b);
  assert.equal(r.storage.getItem('fc_current_project_id_v1'),'B');
});
test('Unowned global part changes block cancellation before any rollback write',async()=>{
  for(const key of PARTS){const r=edited();r.update('B',75);r.storage.setItem(key,'{"part":"changed"}');const raw=r.storage.getItem(SESSION),before=r.storage.getItem(PROJECTS);
    r.storage.calls.length=0;assert.equal(r.session.cancel(),false);assert.equal(r.session.lastError.code,'UNSCOPED_PART_ROLLBACK_BLOCKED');
    preserved(r,raw);assert.equal(r.storage.getItem(PROJECTS),before);assert.equal(r.storage.calls.length,0);
    await r.handlers['session-cancel']({});
    assert.equal(r.s.location.reloads,0);
    assert.ok(r.messages.some(cfg=>/Nie można bezpiecznie cofnąć globalnych opcji formatek/.test(cfg.message)));
    assert.equal(r.storage.getItem(PROJECTS),before);
    r.storage.removeItem(key);assert.equal(r.session.cancel(),true);assert.equal(r.row('B').projectData.room.cabinets[0].width,75);
  }
});
test('Write exception and silent failed write retain snapshot, B and retry',()=>{
  for(const mode of ['throw','noop','false']){const r=edited();r.update('B',75);const b=clone(r.row('B')),raw=r.storage.getItem(SESSION);
    r.storage.fail.set('set:'+PROJECTS,mode);assert.equal(r.session.cancel(),false);preserved(r,raw);assert.deepEqual(r.row('B'),b);
    r.storage.fail.clear();assert.equal(r.session.cancel(),true);assert.deepEqual(r.row('B'),b);
  }
});
test('Durable cleanup failure, reload and retry preserve all project records',()=>{
  const r=edited();r.update('B',75);const b=clone(r.row('B')),raw=r.storage.getItem(SESSION);r.storage.fail.set('remove:'+SESSION,'throw');
  assert.equal(r.session.cancel(),false);preserved(r,raw);assert.equal(r.session.isDirty(),false);
  const reloaded=runtime(r.rows());assert.equal(reloaded.session.active,true);assert.equal(reloaded.session.cancel(),true);assert.deepEqual(reloaded.row('B'),b);
});
test('Reload retains owner and last observed version; no automatic rollback',()=>{
  const r=edited();r.update('B',75);const before=r.storage.getItem(PROJECTS),reloaded=runtime(r.rows());
  assert.equal(reloaded.storage.getItem(PROJECTS),before);assert.equal(reloaded.session.projectId,'A');
  assert.equal(reloaded.session.cancel(),true);assert.equal(reloaded.row('B').projectData.room.cabinets[0].width,75);
});
test('Untracked owner modification is a conflict, not cancellation success',()=>{
  const r=edited(),raw=r.storage.getItem(SESSION),rows=JSON.parse(r.storage.getItem(PROJECTS));rows.find(row=>row.id==='A').projectData.room.cabinets[0].width=88;
  r.storage.rows.set(PROJECTS,JSON.stringify(rows));const before=r.storage.getItem(PROJECTS);r.storage.calls.length=0;
  assert.equal(r.session.cancel(),false);assert.equal(r.session.lastError.code,'PROJECT_WRITE_CONFLICT');preserved(r,raw);
  assert.equal(r.storage.getItem(PROJECTS),before);assert.equal(r.storage.calls.length,0);assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,false);
});
test('Container changed during merge causes conflict without overwriting new B',()=>{
  const r=edited(),raw=r.storage.getItem(SESSION);let reads=0;r.storage.onRead=key=>{if(key===PROJECTS&&++reads===3){const rows=JSON.parse(r.storage.rows.get(PROJECTS));rows.find(row=>row.id==='B').projectData.room.cabinets[0].width=83;r.storage.rows.set(PROJECTS,JSON.stringify(rows));}};
  assert.equal(r.session.cancel(),false);r.storage.onRead=null;preserved(r,raw);assert.equal(r.row('B').projectData.room.cabinets[0].width,83);
});
test('Saving B cannot adopt an externally modified A as a session-owned revision',()=>{
  const r=edited(),rows=JSON.parse(r.storage.getItem(PROJECTS));
  rows.find(row=>row.id==='A').projectData.room.cabinets[0].width=88;
  r.storage.rows.set(PROJECTS,JSON.stringify(rows));
  const raw=r.storage.getItem(SESSION);r.update('B',75);
  assert.equal(r.session.cancel(),false);preserved(r,raw);
  assert.equal(r.row('A').projectData.room.cabinets[0].width,88);
  assert.equal(r.row('B').projectData.room.cabinets[0].width,75);
});
test('Lost revision persistence blocks rollback after reload rather than trusting a stale version',()=>{
  const r=runtime();assert.equal(r.session.begin(),true);
  const baseline=r.storage.getItem(SESSION);r.storage.fail.set('set:'+SESSION,'throw');
  r.update('A',65);r.update('B',75);assert.equal(r.storage.getItem(SESSION),baseline);
  const reloaded=runtime(r.rows());assert.equal(reloaded.session.cancel(),false);preserved(reloaded,baseline);
  assert.equal(reloaded.row('A').projectData.room.cabinets[0].width,65);
  assert.equal(reloaded.row('B').projectData.room.cabinets[0].width,75);
  r.storage.fail.clear();assert.equal(r.session.cancel(),true);
  assert.equal(r.row('A').projectData.room.cabinets[0].width,60);
});
test('Corrupt or duplicate current records never trigger destructive restoration',()=>{
  for(const invalid of ['broken JSON','[{"id":"B"},{"id":"B"}]']){const r=edited(),raw=r.storage.getItem(SESSION);r.storage.rows.set(PROJECTS,invalid);r.storage.calls.length=0;
    assert.equal(r.session.cancel(),false);preserved(r,raw);assert.equal(r.storage.getItem(PROJECTS),invalid);assert.equal(r.storage.calls.length,0);
  }
});
test('Old wide snapshot with unchanged A preserves later B, investors, offers, UI and legacy',()=>{
  const r=runtime(),snapshot=Object.fromEntries(r.storage.rows),base=snapshot[PROJECTS];r.update('B',75);
  const untouched=['fc_investors_v1','fc_current_investor_v1','fc_ui_v1','fc_quote_snapshots_v1','fc_quote_offer_drafts_v1','fc_project_backup_v1','fc_project_backup_meta_v1','fc_project_v1','fc_project_inv_inv-B_v1','fc_quote_rates_v1','fc_accessories_v1'];
  for(const key of untouched){snapshot[key]='old';r.storage.rows.set(key,'latest:'+key);}r.storage.rows.set('fc_current_investor_v1','inv-A');
  r.storage.rows.set(SESSION,JSON.stringify({schemaVersion:2,active:true,startedAt:123,context:{projectId:'A',investorId:'inv-A'},snapshot}));
  const reloaded=runtime(r.rows()),before=new Map(untouched.map(key=>[key,reloaded.storage.getItem(key)]));
  assert.equal(reloaded.session.cancel(),true);assert.equal(reloaded.row('B').projectData.room.cabinets[0].width,75);
  for(const [key,value] of before)assert.equal(reloaded.storage.getItem(key),value,key);assert.equal(JSON.parse(base).find(row=>row.id==='A').id,'A');
});
test('Old changed-owner or unknown-owner snapshot remains active and cannot overwrite any project',()=>{
  for(const known of [true,false]){const r=runtime(),snapshot=Object.fromEntries(r.storage.rows);r.update('A',65);r.update('B',75);
    if(!known)delete snapshot.fc_current_project_id_v1;
    r.storage.rows.set(SESSION,JSON.stringify({schemaVersion:2,active:true,startedAt:123,context:known?{projectId:'A'}:{},snapshot}));
    const reloaded=runtime(r.rows()),before=reloaded.storage.getItem(PROJECTS),raw=reloaded.storage.getItem(SESSION);
    assert.equal(reloaded.session.cancel(),false);preserved(reloaded,raw);assert.equal(reloaded.storage.getItem(PROJECTS),before);
  }
});
test('Missing current owner blocks begin without inventing a project or durable payload',()=>{
  const r=runtime();r.storage.removeItem('fc_current_project_id_v1');assert.equal(r.session.begin(),false);assert.equal(r.storage.getItem(SESSION),null);assert.equal(r.session.active,false);
});
test('Reload of ownerless legacy session cannot bootstrap a fresh project over existing data',()=>{
  const r=runtime(),snapshot={fc_projects_v1:r.storage.getItem(PROJECTS)};
  r.storage.rows.set(SESSION,JSON.stringify({active:true,snapshot}));
  const reloaded=runtime(r.rows()),before=reloaded.storage.getItem(PROJECTS),ram=clone(reloaded.s.projectData);
  reloaded.FC.investorProjectRuntime.ensureInvestorProjectLoadedOnBoot();
  assert.equal(reloaded.storage.getItem(PROJECTS),before);assert.deepEqual(clone(reloaded.s.projectData),ram);
  assert.equal(reloaded.session.active,true);assert.equal(reloaded.session.cancel(),false);
});

function multiRoom(){
  const r=runtime();
  const record=r.FC.projectStore.getById('A');
  record.projectData.other={cabinets:[{id:'cab-other',width:70}],fronts:[],sets:[],settings:{}};
  record.projectData.meta=Object.assign({},record.projectData.meta,{
    roomDefs:{room:{id:'room',label:'Kuchnia'},other:{id:'other',label:'Salon'}},
    roomOrder:['room','other']
  });
  assert.ok(r.FC.projectStore.upsert(record));
  r.s.uiState.roomType='room';
  r.s.projectData=r.FC.project.load();
  assert.equal(r.session.begin(),true);
  assert.equal(r.session.roomId,'room');
  return r;
}
function updateOther(r,width){
  const record=r.FC.projectStore.getById('A');
  record.projectData.other.cabinets[0].width=width;
  assert.ok(r.FC.projectStore.upsert(record));
}
test('C2.0b room-owned save merges A and keeps newer B within one record',()=>{
  const r=multiRoom();
  updateOther(r,75);
  r.s.projectData.room.cabinets[0].width=65;
  assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);
  assert.equal(r.row('A').projectData.room.cabinets[0].width,65);
  assert.equal(r.row('A').projectData.other.cabinets[0].width,75);
  assert.equal(r.session.commit(),true);
});
test('C2.0b room-owned cancel preserves newer B within one record',()=>{
  const r=multiRoom();
  r.s.projectData.room.cabinets[0].width=65;
  assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);
  updateOther(r,75);
  assert.equal(r.session.cancel(),true);
  assert.equal(r.row('A').projectData.room.cabinets[0].width,60);
  assert.equal(r.row('A').projectData.other.cabinets[0].width,75);
});
test('C2.0b scoped save refuses edits to other rooms',()=>{
  const r=multiRoom();
  r.s.projectData.other.cabinets[0].width=123;
  const before=r.storage.getItem(PROJECTS);
  assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,false);
  assert.equal(r.storage.getItem(PROJECTS),before);
  assert.equal(r.session.canSwitchRoom('other'),false);
  assert.equal(r.session.canSwitchRoom('room'),true);
});
test('C2.0b external owned-room conflict blocks save and cancel',()=>{
  const r=multiRoom();
  const raw=r.storage.getItem(SESSION);
  const rows=JSON.parse(r.storage.getItem(PROJECTS));
  rows.find(row=>row.id==='A').projectData.room.cabinets[0].width=88;
  r.storage.rows.set(PROJECTS,JSON.stringify(rows));
  r.s.projectData.room.cabinets[0].width=65;
  assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,false);
  assert.equal(r.session.cancel(),false);
  assert.equal(r.storage.getItem(SESSION),raw);
  assert.equal(r.row('A').projectData.room.cabinets[0].width,88);
});
test('C2.0b navigation asks and switches only after confirmed save',async()=>{
  const r=multiRoom();
  const picks=[];
  r.FC.choiceBox={async ask(payload){picks.push(payload);return 'save';}};
  r.s.projectData.room.cabinets[0].width=65;
  let entered=0;
  const ok=await r.FC.sessionNavigation.requestTransition('WYCENY',()=>{entered++;});
  assert.equal(ok,true);assert.equal(entered,1);
  assert.equal(picks.length,1);assert.equal(picks[0].actions.length,3);
  assert.equal(r.session.active,false);
  assert.equal(r.row('A').projectData.room.cabinets[0].width,65);
});
test('C2.0b back or cancel failure cannot enter ROZRYS',async()=>{
  const r=multiRoom();r.s.projectData.room.cabinets[0].width=65;
  let entered=0;
  r.FC.choiceBox={async ask(){return 'back';}};
  assert.equal(await r.FC.sessionNavigation.requestTransition('ROZRYSU',()=>{entered++;}),false);
  assert.equal(entered,0);assert.equal(r.session.active,true);
  r.FC.choiceBox={async ask(){return 'discard';}};
  r.s.projectData.room.cabinets[0].width=65;
  r.storage.fail.set('remove:'+SESSION,'throw');
  assert.equal(await r.FC.sessionNavigation.requestTransition('ROZRYSU',()=>{entered++;}),false);
  assert.equal(entered,0);assert.equal(r.session.active,true);
  r.storage.fail.clear();
  assert.equal(await r.FC.sessionNavigation.requestTransition('ROZRYSU',()=>{entered++;}),true);
  assert.equal(entered,1);assert.equal(r.session.active,false);
  assert.equal(r.row('A').projectData.room.cabinets[0].width,60);
});
if(require.main === module) (async()=>{for(const [name,fn] of tests){await fn();console.log('PASS '+name);}console.log('Project-owned session rollback: '+tests.length+'/'+tests.length+' PASS');})().catch(error=>{console.error(error);process.exitCode=1;});

module.exports = { runtime, multiRoom, updateOther };

#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture:sourceFixture}=require('./part-provenance-stability-smoke');
const {runtime}=require('./project-session-owner-rollback-smoke');
const ROOT=path.resolve(__dirname,'..'),PROJECTS='fc_projects_v1',SESSION='fc_edit_session_v1';
const clone=value=>JSON.parse(JSON.stringify(value));
const address={projectId:'A',roomId:'room',cabinetId:'one',partRoleId:'body.side.left'};
const load=(r,file)=>vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),r.s,{filename:file});
function fixture(){const r=sourceFixture();r.s.uiState.roomType='room';load(r,'js/app/project/project-pcv-overrides.js');r.storage.calls.length=0;return r;}
const edge=r=>r.row('A').projectData.room.production?.partOverrides?.one?.['body.side.left']?.edges;
const writes=r=>r.storage.calls.filter(call=>call[1]===PROJECTS || call[1]===SESSION);
function preserve(r,raw,ram,snapshot){
 assert.equal(r.storage.getItem(PROJECTS),raw);assert.equal(r.s.projectData,ram);assert.equal(r.session.snapshot,snapshot);
 assert.equal(r.session.active,true);assert.ok(!r.messages.some(m=>m.title==='Projekt zapisany'));
}
function partial(mode='throw'){
 const r=fixture();assert.equal(r.session.begin('room'),true);r.storage.fail.set('set:'+SESSION,mode);
 const ram=r.s.projectData,snapshot=r.session.snapshot;
 const result=r.FC.projectPcvOverrides.setEdges(address,{w2:true});
 assert.equal(result.ok,false);assert.equal(result.code,'SESSION_UNCONFIRMED');assert.equal(result.projectSaved,true);
 assert.equal(edge(r).w2,true);assert.equal(r.s.projectData,ram);assert.equal(r.session.snapshot,snapshot);
 r.storage.fail.clear();r.storage.calls.length=0;r.messages.length=0;return r;
}
const tests=[],test=(name,fn)=>tests.push([name,fn]);
test('P1 real global Save cannot replace centrally saved PCV with old RAM',()=>{
 const r=partial(),raw=r.storage.getItem(PROJECTS),payload=r.storage.getItem(SESSION),ram=r.s.projectData,snapshot=r.session.snapshot;
 r.handlers['session-save']({});preserve(r,raw,ram,snapshot);assert.equal(edge(r).w2,true);
 assert.equal(r.storage.getItem(SESSION),payload);assert.deepEqual(writes(r),[]);
 assert.ok(r.messages.some(m=>m.message.includes('Dane projektu mogły zostać zapisane')&&m.message.includes('Dalszy zapis został wstrzymany')));
});
test('P2 shared gate and direct commit reject an unconfirmed revision without cleanup',()=>{
 const r=partial(),raw=r.storage.getItem(PROJECTS),ram=r.s.projectData,snapshot=r.session.snapshot;
 assert.equal(r.session.inspectNavigationState(),null);assert.equal(r.session.canSaveProject(),false);assert.equal(r.session.commit(),false);
 preserve(r,raw,ram,snapshot);assert.deepEqual(writes(r),[]);assert.equal(r.session.lastError.code,'SESSION_UNCONFIRMED');
});
test('P3 setter retry gives explicit partial-state refusal and preserves draft/baseline',()=>{
 const r=partial(),raw=r.storage.getItem(PROJECTS),ram=r.s.projectData,snapshot=r.session.snapshot;
 const result=r.FC.projectPcvOverrides.setEdges(address,{w2:true});assert.equal(result.ok,false);assert.equal(result.code,'SESSION_UNCONFIRMED');
 assert.equal(result.projectSaved,true);preserve(r,raw,ram,snapshot);assert.deepEqual(writes(r),[]);
});
test('Direct saveConfirmed refuses old RAM in the same partial state',()=>{
 const r=partial(),raw=r.storage.getItem(PROJECTS),ram=r.s.projectData,snapshot=r.session.snapshot;
 const result=r.FC.project.saveConfirmed(ram);assert.equal(result.ok,false);assert.equal(result.code,'SESSION_UNCONFIRMED');
 assert.equal(result.projectSaved,true);preserve(r,raw,ram,snapshot);assert.deepEqual(writes(r),[]);
});
test('Compatibility save and investor runtime cannot bypass the common gate',()=>{
 const r=partial(),raw=r.storage.getItem(PROJECTS),ram=r.s.projectData,snapshot=r.session.snapshot;
 r.FC.investorProjectPatches.patchProjectSave();r.FC.project.save(ram);
 assert.equal(r.FC.investorProjectRuntime.saveActiveProjectToInvestor('inv-A'),null);
 preserve(r,raw,ram,snapshot);assert.deepEqual(writes(r),[]);
});
test('Direct upsert, writeAll and conditional owner update cannot overwrite partial PCV',()=>{
 for(const method of ['upsert','writeAll','updateRecordConfirmed']){
  const r=partial(),raw=r.storage.getItem(PROJECTS),ram=r.s.projectData,snapshot=r.session.snapshot;
  const current=r.FC.projectStore.getById('A'),stale={...clone(current),projectData:clone(ram)};
  let result;if(method==='writeAll')result=r.FC.projectStore.writeAll(r.FC.projectStore.readAll().map(row=>row.id==='A'?stale:row));
  else if(method==='upsert')result=r.FC.projectStore.upsert(stale);else result=r.FC.projectStore.updateRecordConfirmed(stale,current);
  assert.equal(result,null);preserve(r,raw,ram,snapshot);assert.deepEqual(writes(r),[]);
 }
});
test('Navigation blocks every decision before its dialog when proof is missing',async()=>{
 const r=partial(),raw=r.storage.getItem(PROJECTS),ram=r.s.projectData,snapshot=r.session.snapshot;let approved=0,dialogs=0;
 r.FC.choiceBox={ask:async()=>{dialogs++;return 'save';}};
 assert.equal(await r.FC.sessionNavigation.requestTransition('Salonu',()=>approved++,{roomId:'other'}),false);
 assert.equal(approved,0);assert.equal(dialogs,0);assert.equal(r.s.uiState.roomType,'room');preserve(r,raw,ram,snapshot);assert.deepEqual(writes(r),[]);
});
test('Direct Cancel cannot compensate an unconfirmed write or discard its snapshot',()=>{
 const r=partial(),raw=r.storage.getItem(PROJECTS),ram=r.s.projectData,snapshot=r.session.snapshot;
 assert.equal(r.session.cancel(),false);preserve(r,raw,ram,snapshot);assert.deepEqual(writes(r),[]);
});
test('Restart after partial save refuses save/commit/rollback of the unowned new revision',()=>{
 const r=partial(),raw=r.storage.getItem(PROJECTS),payload=r.storage.getItem(SESSION),restarted=runtime(r.rows());restarted.s.uiState.roomType='room';
 restarted.storage.calls.length=0;assert.equal(restarted.session.active,true);
 assert.equal(restarted.FC.project.saveConfirmed(restarted.s.projectData).ok,false);assert.equal(restarted.session.commit(),false);
 assert.equal(restarted.session.cancel(),false);assert.equal(restarted.session.lastError.code,'PROJECT_WRITE_CONFLICT');
 assert.equal(restarted.storage.getItem(PROJECTS),raw);assert.equal(restarted.storage.getItem(SESSION),payload);assert.deepEqual(writes(restarted),[]);
});
test('Failed begin makes zero project changes; valid retry keeps the original snapshot',()=>{
 const r=fixture(),raw=r.storage.getItem(PROJECTS),ram=r.s.projectData;r.storage.fail.set('set:'+SESSION,'throw');
 const result=r.FC.projectPcvOverrides.setEdges(address,{w2:true});assert.equal(result.ok,false);assert.equal(result.code,'BEGIN_FAILED');
 const snapshot=r.session.snapshot;preserve(r,raw,ram,snapshot);assert.ok(!r.storage.calls.some(call=>call[1]===PROJECTS));
 r.storage.fail.clear();assert.equal(r.FC.projectPcvOverrides.setEdges(address,{w2:true}).ok,true);assert.equal(r.session.snapshot,snapshot);assert.equal(edge(r).w2,true);
});
test('Central failure returns no false success and retains shared RAM',()=>{
 for(const mode of ['throw','false','noop']){
  const r=fixture(),raw=r.storage.getItem(PROJECTS),ram=r.s.projectData;r.storage.fail.set('set:'+PROJECTS,mode);
  const result=r.FC.projectPcvOverrides.setEdges(address,{w2:true});assert.equal(result.ok,false);assert.notEqual(result.projectSaved,true);
  preserve(r,raw,ram,r.session.snapshot);assert.equal(edge(r),undefined);
 }
});
test('Failed revision throw, false and silent no-op all report projectSaved:true',()=>{
 for(const mode of ['throw','false','noop']){const r=partial(mode);assert.equal(r.session.canSaveProject(),false);assert.equal(r.session.commit(),false);assert.equal(edge(r).w2,true);assert.deepEqual(writes(r),[]);}
});
test('Global Save whose own revision write fails reports partial execution without success',()=>{
 const r=fixture();assert.equal(r.session.begin('room'),true);r.s.projectData.room.cabinets[0].width=70;
 const ram=r.s.projectData,snapshot=r.session.snapshot;r.storage.fail.set('set:'+SESSION,'throw');r.handlers['session-save']({});
 assert.equal(r.row('A').projectData.room.cabinets[0].width,70);assert.equal(r.s.projectData,ram);assert.equal(r.session.snapshot,snapshot);assert.equal(r.session.active,true);
 assert.ok(!r.messages.some(m=>m.title==='Projekt zapisany'));assert.ok(r.messages.some(m=>m.message.includes('Dalszy zapis został wstrzymany')));
 r.storage.fail.clear();const raw=r.storage.getItem(PROJECTS);r.storage.calls.length=0;r.handlers['session-save']({});assert.equal(r.storage.getItem(PROJECTS),raw);assert.deepEqual(writes(r),[]);
});
test('Partial return to original PCV is refused, not mistaken for Cancel cleanup retry',()=>{
 const r=fixture();assert.equal(r.FC.projectPcvOverrides.setEdges(address,{w2:true}).ok,true);r.storage.fail.set('set:'+SESSION,'throw');
 const result=r.FC.projectPcvOverrides.clearEdges(address);assert.equal(result.ok,false);assert.equal(result.code,'SESSION_UNCONFIRMED');assert.equal(result.projectSaved,true);
 assert.equal(edge(r),undefined);r.storage.fail.clear();r.storage.calls.length=0;assert.equal(r.session.commit(),false);assert.equal(r.session.canSaveProject(),false);assert.deepEqual(writes(r),[]);
});
test('Acknowledged write with conflicting read-back latches refusal even with a valid session payload',()=>{
 const r=fixture(),ram=r.s.projectData,snapshotBefore=JSON.stringify(ram.room),original=r.FC.projectStore.updateRecordConfirmed;
 r.FC.projectStore.updateRecordConfirmed=function(...args){
  const saved=original(...args);assert.ok(saved);
  // A different room changes after the write, before bridge read-back.
  const rows=JSON.parse(r.storage.getItem(PROJECTS));rows.find(row=>row.id==='A').projectData.other.cabinets[0].width=99;
  r.storage.rows.set(PROJECTS,JSON.stringify(rows));return saved;
 };
 const result=r.FC.projectPcvOverrides.setEdges(address,{w2:true});assert.equal(result.ok,false);assert.equal(result.code,'SAVE_UNCONFIRMED');assert.equal(result.projectSaved,true);
 assert.equal(r.s.projectData,ram);assert.equal(JSON.stringify(ram.room),snapshotBefore);assert.equal(edge(r).w2,true);
 const raw=r.storage.getItem(PROJECTS),payload=r.storage.getItem(SESSION);r.storage.calls.length=0;
 r.handlers['session-save']({});assert.equal(r.session.commit(),false);assert.equal(r.session.cancel(),false);
 assert.equal(r.storage.getItem(PROJECTS),raw);assert.equal(r.storage.getItem(SESSION),payload);assert.deepEqual(writes(r),[]);
 assert.ok(!r.messages.some(m=>m.title==='Projekt zapisany'));
 // This differs from a lost session revision: restart has matching persisted ownership
 // evidence and loads canonical RAM without adopting an arbitrary newer owned room.
 const restarted=runtime(r.rows());restarted.s.uiState.roomType='room';assert.equal(restarted.session.canSaveProject(),true);
 assert.equal(edge(restarted).w2,true);assert.equal(restarted.row('A').projectData.other.cabinets[0].width,99);
});
test('Missing durable payload blocks Save, commit, begin and PCV writes',()=>{
 const r=fixture();assert.equal(r.session.begin('room'),true);r.storage.rows.delete(SESSION);const raw=r.storage.getItem(PROJECTS),ram=r.s.projectData,snapshot=r.session.snapshot;r.storage.calls.length=0;
 assert.equal(r.FC.project.saveConfirmed(ram).ok,false);assert.equal(r.session.commit(),false);assert.equal(r.session.begin('room'),false);
 assert.equal(r.FC.projectPcvOverrides.setEdges(address,{w2:true}).ok,false);r.handlers['session-save']({});preserve(r,raw,ram,snapshot);assert.deepEqual(writes(r),[]);
});
test('Shared room save preserves partial result and never masks it with a not-saved message',()=>{
 const r=fixture();load(r,'js/app/room-preferences/room-preferences-model.js');r.session.begin('room');
 const ram=r.s.projectData,next=clone(ram);next.room.settings.roomHeight=280;r.storage.fail.set('set:'+SESSION,'throw');
 const result=r.FC.roomPreferences.saveRoomProjectConfirmed(next);assert.equal(result.ok,false);assert.equal(result.projectSaved,true);assert.equal(result.code,'SESSION_UNCONFIRMED');
 assert.equal(r.s.projectData,ram);assert.equal(r.row('A').projectData.room.settings.roomHeight,280);
 assert.ok(r.messages.some(m=>m.message.includes('Dalszy zapis został wstrzymany')));
 assert.ok(!r.messages.some(m=>m.title==='Nie zapisano zmian pomieszczenia'));
 r.storage.fail.clear();const raw=r.storage.getItem(PROJECTS);r.storage.calls.length=0;
 assert.equal(r.FC.roomPreferences.saveRoomProjectConfirmed(next).projectSaved,true);assert.equal(r.storage.getItem(PROJECTS),raw);assert.deepEqual(writes(r),[]);
});
test('Bulk room save retains explicit partial diagnostics, draft and shared RAM baseline',()=>{
 const r=fixture();for(const file of ['js/app/room-preferences/room-preferences-model.js','js/app/room-preferences/room-preferences-bulk-plan.js','js/app/room-preferences/room-preferences-bulk-apply.js'])load(r,file);
 const preferences=r.FC.roomPreferences.getRoomPreferences('room');preferences.zones.lower.bodyColor='laminat Black';
 const record=r.FC.projectStore.getById('A');record.projectData.room.preferences=preferences;r.FC.projectStore.upsert(record);r.s.projectData=r.FC.project.load();
 r.session.begin('room');const before=clone(r.s.projectData);r.storage.fail.set('set:'+SESSION,'throw');
 const result=vm.runInContext('FC.roomPreferencesBulkApply.apply("room",{zones:{lower:true},fields:{body:true}})',r.s);
 assert.equal(result.ok,false);assert.equal(result.projectSaved,true);assert.equal(result.code,'SESSION_UNCONFIRMED');
 assert.deepEqual(clone(r.s.projectData),before);assert.equal(r.row('A').projectData.room.cabinets[0].bodyColor,'laminat Black');
 assert.ok(result.message.includes('Dalszy zapis został wstrzymany'));assert.ok(!r.messages.some(m=>m.title==='Nie zapisano zmian pomieszczenia'));
 r.storage.fail.clear();r.storage.calls.length=0;assert.equal(r.session.commit(),false);assert.deepEqual(writes(r),[]);
});
test('Tampered durable snapshot or context never becomes a new baseline',()=>{
 for(const field of ['snapshot','investor','room','startedAt']){
  const r=fixture();r.session.begin('room');const snapshot=r.session.snapshot,payload=JSON.parse(r.storage.getItem(SESSION));
  if(field==='snapshot')payload.snapshot[PROJECTS]='[]';if(field==='investor')payload.context.investorId='inv-B';if(field==='room')payload.roomId='other';if(field==='startedAt')payload.startedAt++;
  r.storage.rows.set(SESSION,JSON.stringify(payload));const raw=r.storage.getItem(PROJECTS);r.storage.calls.length=0;
  assert.equal(r.session.commit(),false);assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,false);assert.equal(r.session.begin('room'),false);
  assert.equal(r.storage.getItem(PROJECTS),raw);assert.equal(r.session.snapshot,snapshot);assert.deepEqual(writes(r),[]);
 }
});
test('Newer untracked central room is a conflict, never overwritten by old RAM',()=>{
 const r=fixture();r.session.begin('room');const rows=JSON.parse(r.storage.getItem(PROJECTS));rows.find(x=>x.id==='A').projectData.room.cabinets[0].width=83;
 r.storage.rows.set(PROJECTS,JSON.stringify(rows));const raw=r.storage.getItem(PROJECTS),ram=r.s.projectData,snapshot=r.session.snapshot;r.storage.calls.length=0;
 r.handlers['session-save']({});assert.equal(r.session.lastError.code,'PROJECT_WRITE_CONFLICT');preserve(r,raw,ram,snapshot);assert.deepEqual(writes(r),[]);
});
test('Unrelated rooms and projects survive refusal after partial execution',()=>{
 const r=partial(),rows=JSON.parse(r.storage.getItem(PROJECTS));rows.find(x=>x.id==='A').projectData.other.cabinets[0].width=81;rows.find(x=>x.id==='B').projectData.room.cabinets[0].width=91;
 r.storage.rows.set(PROJECTS,JSON.stringify(rows));const raw=r.storage.getItem(PROJECTS),ram=r.s.projectData,snapshot=r.session.snapshot;
 r.handlers['session-save']({});assert.equal(r.session.cancel(),false);assert.equal(r.FC.project.saveConfirmed(ram).ok,false);preserve(r,raw,ram,snapshot);assert.deepEqual(writes(r),[]);
});
test('An unrelated B write cannot authorize the unconfirmed A revision',()=>{
 const r=partial(),owner=clone(r.row('A'));r.update('B',92);assert.equal(r.row('B').projectData.room.cabinets[0].width,92);
 assert.equal(r.session.canSaveProject(),false);assert.equal(r.session.commit(),false);assert.deepEqual(r.row('A'),owner);
});
test('Healthy global Save updates only its room, preserving newer room/project data',()=>{
 const r=fixture();r.session.begin('room');const record=r.FC.projectStore.getById('A');record.projectData.other.cabinets[0].width=77;r.FC.projectStore.upsert(record);r.update('B',88);
 const other=clone(r.row('A').projectData.other),b=clone(r.row('B'));r.s.projectData.room.cabinets[0].width=70;r.handlers['session-save']({});
 assert.equal(r.session.active,false);assert.equal(r.row('A').projectData.room.cabinets[0].width,70);assert.deepEqual(r.row('A').projectData.other,other);assert.deepEqual(r.row('B'),b);
 assert.ok(r.messages.some(m=>m.title==='Projekt zapisany'));
});
test('Healthy PCV save, Cancel and cleanup failure retry keep the original baseline',()=>{
 const r=fixture(),before=clone(r.row('A').projectData.room);assert.equal(r.FC.projectPcvOverrides.setEdges(address,{w2:true}).ok,true);
 const snapshot=r.session.snapshot;r.storage.fail.set('remove:'+SESSION,'throw');assert.equal(r.session.cancel(),false);assert.equal(r.session.snapshot,snapshot);assert.deepEqual(r.row('A').projectData.room,before);
 r.storage.fail.clear();assert.equal(r.session.cancel(),true);assert.equal(r.session.active,false);assert.equal(r.storage.getItem(SESSION),null);
});
test('Healthy PCV save plus commit and restart preserves its canonical value',()=>{
 const r=fixture();assert.equal(r.FC.projectPcvOverrides.setEdges(address,{w2:true}).ok,true);assert.equal(r.session.commit(),true);
 const restarted=runtime(r.rows());assert.equal(edge(restarted).w2,true);assert.equal(restarted.session.active,false);
});
test('Semantic no-op performs no begin, project write or session write',()=>{
 const r=fixture();r.session.begin('room');r.storage.calls.length=0;let begins=0;const begin=r.session.begin;r.session.begin=function(...args){begins++;return begin.apply(this,args);};
 assert.equal(r.FC.projectPcvOverrides.setEdges(address,{w1:true}).changed,false);assert.equal(r.FC.projectPcvOverrides.clearEdges(address).changed,false);assert.equal(begins,0);assert.deepEqual(r.storage.calls,[]);
});
test('Owner mismatch cannot save B or finish A and never changes B',()=>{
 const r=fixture();r.session.begin('room');r.storage.rows.set('fc_current_project_id_v1','B');r.FC.investors.getCurrentId=()=> 'inv-B';
 const before=r.storage.getItem(PROJECTS);assert.equal(r.FC.project.saveConfirmed(r.FC.projectStore.getById('B').projectData).ok,false);assert.equal(r.session.commit(),false);assert.equal(r.storage.getItem(PROJECTS),before);
});
test('Protected global catalogs, prices, legacy part stores and history stay byte-for-byte',()=>{
 const r=fixture(),keys=['fc_edge_v1','fc_material_part_options_v1','fc_rozrys_grain_state_v1','fc_materials_v1','fc_hardware_v1','fc_pricelist_v1','fc_program_defaults_v1','fc_quote_snapshots_v1'];
 for(const key of keys)r.storage.rows.set(key,'{"keep":"'+key+'"}');const before=Object.fromEntries(keys.map(k=>[k,r.storage.getItem(k)]));
 r.session.begin('room');r.storage.fail.set('set:'+SESSION,'throw');assert.equal(r.FC.projectPcvOverrides.setEdges(address,{w2:true}).projectSaved,true);r.storage.fail.clear();r.handlers['session-save']({});r.session.commit();r.session.cancel();
 for(const key of keys){assert.equal(r.storage.getItem(key),before[key]);assert.ok(!r.storage.calls.some(call=>call[1]===key));}
});
test('Missing RAM snapshot or inactive RAM cannot erase an existing active payload',()=>{
 for(const active of [true,false]){
  const r=fixture();r.session.begin('room');const raw=r.storage.getItem(PROJECTS),payload=r.storage.getItem(SESSION);r.session.snapshot=null;r.session.active=active;r.storage.calls.length=0;
  assert.equal(r.session.commit(),false);assert.equal(r.session.cancel(),false);assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,false);assert.equal(r.session.begin('room'),false);
  assert.equal(r.storage.getItem(PROJECTS),raw);assert.equal(r.storage.getItem(SESSION),payload);assert.deepEqual(writes(r),[]);
 }
});
test('Corrupt persisted payload after restart blocks begin, save and commit without rewriting it',()=>{
 const r=fixture();r.session.begin('room');r.storage.rows.set(SESSION,'{broken');const restarted=runtime(r.rows()),raw=restarted.storage.getItem(PROJECTS);restarted.storage.calls.length=0;
 assert.equal(restarted.session.begin('room'),false);assert.equal(restarted.FC.project.saveConfirmed(restarted.s.projectData).ok,false);assert.equal(restarted.session.commit(),false);
 assert.equal(restarted.storage.getItem(SESSION),'{broken');assert.equal(restarted.storage.getItem(PROJECTS),raw);assert.deepEqual(writes(restarted),[]);
});
(async()=>{
 let passed=0;for(const [name,fn] of tests){try{await fn();passed++;console.log('PASS '+name);}catch(error){console.error('FAIL '+name);console.error(error);process.exitCode=1;}}
 console.log('project-session-unconfirmed-save-safety-smoke: '+passed+'/'+tests.length+' PASS');
})();

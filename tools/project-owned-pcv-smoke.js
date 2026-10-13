#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture:sourceFixture}=require('./part-provenance-stability-smoke');
const {runtime}=require('./project-session-owner-rollback-smoke');
const ROOT=path.resolve(__dirname,'..'),PROJECTS='fc_projects_v1',SESSION='fc_edit_session_v1';
const clone=value=>JSON.parse(JSON.stringify(value));
function install(r){
 for(const file of ['js/app/cabinet/part-provenance.js','js/app/material/material-common.js','js/app/cabinet/front-hardware-fronts.js','js/app/cabinet/cabinet-cutlist.js','js/app/material/material-edge-store.js','js/app/project/project-pcv-overrides.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),r.s,{filename:file});
 r.s.materials=[{name:'laminat White',materialType:'laminat'},{name:'White',materialType:'laminat'}];
 r.api=r.FC.projectPcvOverrides;return r;
}
function fixture(){const r=install(sourceFixture());r.s.uiState.roomType='room';r.storage.calls.length=0;return r;}
const part=(cabinetId='one',partRoleId='body.side.left',roomId='room',projectId='A')=>({projectId,roomId,cabinetId,partRoleId});
const group=(cabinetId='one',groupRoleId='body.shelves',roomId='room',projectId='A')=>({projectId,roomId,ownerType:'cabinet',cabinetId,groupRoleId});
const setGroup=(setId='set',groupRoleId='front.A.left')=>({projectId:'A',roomId:'room',ownerType:'set',setId,groupRoleId});
function beginCalls(r){let n=0;const orig=r.session.begin;r.session.begin=function(...args){n++;return orig.apply(this,args);};return ()=>n;}
function update(r,mutate){const next=clone(r.s.projectData);mutate(next);const result=r.FC.project.saveConfirmed(next);assert.equal(result.ok,true);r.s.projectData=result.project;}
function editSeed(r,mutate){const record=r.FC.projectStore.getById('A');mutate(record.projectData);assert.ok(r.FC.projectStore.upsert(record));r.s.projectData=r.FC.project.load();r.storage.calls.length=0;}
function override(r,room='room',cab='one',role='body.side.left',space='partOverrides'){return r.row('A').projectData[room].production?.[space]?.[cab]?.[role];}
function switchProject(r,id){if(r.session.active)assert.equal(r.session.commit(),true);r.FC.investors.setCurrentId('inv-'+id);assert.notEqual(r.FC.projectStore.setCurrentProjectId(id),false);r.s.projectData=r.FC.project.load();r.s.uiState.roomType='room';}
const tests=[],test=(name,fn)=>tests.push([name,fn]);
test('Identical cabinets and left/right sides have independent full overrides',()=>{
 const r=fixture();assert.equal(r.api.setEdges(part(),{w2:true}).ok,true);
 assert.deepEqual(clone(r.api.get(part()).edges),{w1:true,w2:true,h1:false,h2:false});
 assert.equal(r.api.get(part('two')).edges.w2,false);assert.equal(r.api.get(part('one','body.side.right')).edges.w2,false);
 assert.equal(r.api.setEdges(part('two'),{h2:true}).ok,true);assert.equal(r.api.get(part()).edges.h2,false);
 assert.deepEqual(Object.keys(override(r)),['edges']);assert.equal(r.session.projectId,'A');assert.equal(r.session.roomId,'room');assert.equal(r.session.durable,true);
});
test('Rooms remain isolated and a different edit owner is refused',()=>{
 const r=fixture();assert.equal(r.api.setEdges(part(),{w2:true}).ok,true);
 assert.equal(r.api.get(part('one','body.side.left','other')).edges.w2,false);
 const before=r.storage.getItem(PROJECTS);assert.equal(r.api.setEdges(part('one','body.side.left','other'),{w2:true}).ok,false);assert.equal(r.storage.getItem(PROJECTS),before);
 assert.equal(r.session.commit(),true);r.s.uiState.roomType='other';assert.equal(r.api.setEdges(part('one','body.side.left','other'),{h1:true}).ok,true);
 assert.equal(r.api.get(part()).edges.h1,false);
});
test('Physical projects isolate identical addresses and returning to A restores A only',()=>{
 const r=fixture();assert.equal(r.api.setEdges(part(),{w2:true}).ok,true);const a=clone(r.row('A'));
 assert.equal(r.api.get(part('one','body.side.left','room','B')).ok,false);
 switchProject(r,'B');assert.deepEqual(r.row('A').projectData,a.projectData);const afterSwitch=clone(r.row('A'));const addr=part('one','body.side.left','room','B');assert.equal(r.api.get(addr).edges.w2,false);
 assert.equal(r.api.setEdges(addr,{h2:true}).ok,true);assert.deepEqual(r.row('A'),afterSwitch);
 switchProject(r,'A');assert.equal(r.api.get(part()).edges.w2,true);assert.equal(r.api.get(part()).edges.h2,false);
});
test('Shelf quantity 3 to 5 retains one address and one override; no cutlist is persisted',()=>{
 const r=fixture();editSeed(r,p=>p.room.cabinets[0].details.shelves=3);
 assert.equal(r.api.setEdges(group(),{w2:true}).ok,true);
 update(r,p=>p.room.cabinets[0].details.shelves=5);
 const shelf=r.FC.cabinetCutlist.getCabinetCutList(r.s.projectData.room.cabinets[0],'room').find(p=>p.name==='Półka');
 assert.equal(shelf.qty,5);assert.equal(shelf.sourceGroups[0].groupRoleId,'body.shelves');assert.equal(r.api.get(shelf.sourceGroups[0]).edges.w2,true);
 assert.deepEqual(Object.keys(override(r,'room','one','body.shelves','cabinetGroupOverrides')),['edges']);
 assert.equal(JSON.stringify(r.row('A').projectData.room.production).includes('qty'),false);
});
test('Dimensions and decor do not change the individual owner',()=>{
 const r=fixture();assert.equal(r.api.setEdges(part(),{h1:true}).ok,true);
 update(r,p=>{p.room.cabinets[0].height=90;p.room.cabinets[0].width=75;p.room.cabinets[0].bodyColor='laminat Black';});
 assert.equal(r.api.get(part()).edges.h1,true);
});
test('Copy with a new cabinet ID and deletion never activate the original override on a copy',()=>{
 const r=fixture();assert.equal(r.api.setEdges(part(),{w2:true}).ok,true);
 update(r,p=>{const copy=clone(p.room.cabinets[0]);copy.id='copy';p.room.cabinets.push(copy);});
 assert.equal(r.api.get(part('copy')).edges.w2,false);
 update(r,p=>p.room.cabinets=p.room.cabinets.filter(c=>c.id!=='one'));
 assert.equal(r.api.get(part()).ok,false);assert.equal(r.api.get(part('copy')).edges.w2,false);
 assert.ok(override(r)); // Dormant map retained for rollback, but missing owner is never addressable.
});
test('Set fronts use the set ID even after cabinet reorder and member ID replacement',()=>{
 const r=fixture();editSeed(r,p=>{p.room.cabinets.forEach(c=>c.setId='set');p.room.sets=[{id:'set',presetId:'A',number:1,frontCount:2,params:{w1:30,w2:30,hB:80,hTop:20}}];});
 const fronts=r.FC.cabinetCutlist.getCabinetCutList(r.s.projectData.room.cabinets[0],'room').filter(p=>p.name==='Front');
 const addr=clone(fronts.flatMap(p=>p.sourceGroups)[0]);assert.equal(addr.ownerType,'set');assert.equal(addr.setId,'set');
 assert.equal(r.api.setEdges(addr,{w1:false}).ok,true);
 update(r,p=>{p.room.cabinets.reverse();p.room.cabinets.forEach((c,i)=>c.id='replacement-'+i);});
 assert.equal(r.api.get(addr).edges.w1,false);assert.equal(r.row('A').projectData.room.production.setGroupOverrides.set[addr.groupRoleId].edges.w1,false);
 assert.equal(r.api.get({...addr,setId:'missing'}).ok,false);
});
test('Default revert removes only edges, preserving grain and other settings',()=>{
 const r=fixture();editSeed(r,p=>p.room.production={partOverrides:{one:{'body.side.left':{grain:{direction:'vertical'},custom:'keep'}}},otherSettings:{keep:1}});
 assert.equal(r.api.setEdges(part(),{w2:true}).ok,true);assert.equal(r.api.setEdges(part('two'),{h1:true}).ok,true);
 assert.equal(r.api.clearEdges(part()).ok,true);
 assert.deepEqual(override(r),{grain:{direction:'vertical'},custom:'keep'});assert.equal(r.api.get(part()).source,'default');assert.equal(r.api.get(part('two')).edges.h1,true);
 assert.deepEqual(r.row('A').projectData.room.production.otherSettings,{keep:1});
});
test('Default roundtrip restores a clean room and unchanged global stores',()=>{
 const r=fixture(),baseline=clone(r.row('A').projectData.room);
 assert.equal(r.api.setEdges(part(),{w2:true}).ok,true);assert.equal(r.session.isDirty(),true);
 assert.equal(r.api.setEdges(part(),{w2:false}).ok,true);assert.deepEqual(r.row('A').projectData.room,baseline);assert.equal(r.session.isDirty(),false);
 assert.equal(r.storage.getItem('fc_edge_v1'),null);assert.equal(r.storage.getItem('fc_material_part_options_v1'),null);
});
test('No-op and reads perform zero write/remove/begin and do not alias stored edges',()=>{
 const r=fixture(),begins=beginCalls(r),raw=r.storage.getItem(PROJECTS),ram=JSON.stringify(r.s.projectData);
 const edges=r.api.get(part()).edges;edges.w1=false;
 assert.equal(r.api.get(part()).edges.w1,true);assert.equal(r.api.setEdges(part(),{w1:true}).changed,false);
 assert.equal(r.api.clearEdges(part()).changed,false);assert.equal(begins(),0);assert.deepEqual(r.storage.calls,[]);assert.equal(r.storage.getItem(PROJECTS),raw);assert.equal(JSON.stringify(r.s.projectData),ram);
});
test('Confirmed cancel restores only PCV in its room, preserving newer other rooms/projects/history',()=>{
 const r=fixture();r.storage.rows.set('fc_quote_snapshots_v1','history');assert.equal(r.api.setEdges(part(),{w2:true}).ok,true);
 const a=r.FC.projectStore.getById('A');a.projectData.other.cabinets[0].width=77;assert.ok(r.FC.projectStore.upsert(a));r.update('B',88);
 const b=clone(r.row('B')),other=clone(r.row('A').projectData.other);assert.equal(r.session.cancel(),true);r.s.projectData=r.FC.project.load();
 assert.equal(r.api.get(part()).edges.w2,false);assert.deepEqual(r.row('A').projectData.other,other);assert.deepEqual(r.row('B'),b);assert.equal(r.storage.getItem('fc_quote_snapshots_v1'),'history');
});
test('Save plus restart restores canonical overrides with the real session implementation',()=>{
 const r=fixture();assert.equal(r.api.setEdges(part(),{w2:true}).ok,true);assert.equal(r.session.commit(),true);
 const reloaded=install(runtime(r.rows()));reloaded.s.uiState.roomType='room';reloaded.storage.calls.length=0;
 assert.equal(reloaded.api.get(part()).edges.w2,true);assert.equal(reloaded.session.active,false);assert.deepEqual(reloaded.storage.calls,[]);
});
test('Restart during active session retains the PCV baseline and can cancel safely',()=>{
 const r=fixture();assert.equal(r.api.setEdges(part(),{h1:true}).ok,true);const reloaded=install(runtime(r.rows()));reloaded.s.uiState.roomType='room';
 assert.equal(reloaded.session.active,true);assert.equal(reloaded.api.get(part()).edges.h1,true);
 assert.equal(reloaded.session.cancel(),true);reloaded.s.projectData=reloaded.FC.project.load();assert.equal(reloaded.api.get(part()).edges.h1,false);
});
test('Failed durable begin preserves every project and RAM; retry uses the same snapshot',()=>{
 const r=fixture(),ram=r.s.projectData,before=r.storage.getItem(PROJECTS);r.storage.fail.set('set:'+SESSION,'throw');
 assert.equal(r.api.setEdges(part(),{w2:true}).code,'BEGIN_FAILED');assert.equal(r.s.projectData,ram);assert.equal(r.storage.getItem(PROJECTS),before);assert.equal(r.session.durable,false);
 const snapshot=r.session.snapshot;assert.ok(r.messages.length);r.storage.fail.clear();assert.equal(r.api.setEdges(part(),{w2:true}).ok,true);assert.equal(r.session.snapshot,snapshot);
});
test('Central false, silent no-op and thrown failures never publish changed RAM or report success',()=>{
 for(const mode of ['false','noop','throw']){
  const r=fixture(),ram=r.s.projectData,raw=JSON.stringify(ram),before=r.storage.getItem(PROJECTS);r.storage.fail.set('set:'+PROJECTS,mode);
  assert.equal(r.api.setEdges(part(),{w2:true}).ok,false);assert.equal(r.s.projectData,ram);assert.equal(JSON.stringify(ram),raw);assert.equal(r.storage.getItem(PROJECTS),before);assert.equal(r.session.active,true);
  r.storage.fail.clear();assert.equal(r.api.setEdges(part(),{w2:true}).ok,true);
 }
});
test('Unsaved RAM changes are preserved and the PCV write fails closed',()=>{
 const r=fixture(),before=r.storage.getItem(PROJECTS);r.s.projectData.room.cabinets[0].width=65;const ram=r.s.projectData,begins=beginCalls(r);
 assert.equal(r.api.setEdges(part(),{w2:true}).code,'RAM_DIVERGENCE');assert.equal(r.s.projectData,ram);assert.equal(r.s.projectData.room.cabinets[0].width,65);assert.equal(r.storage.getItem(PROJECTS),before);assert.equal(begins(),0);
});
test('Unsaved data in another room are not silently overwritten',()=>{
 const r=fixture();assert.equal(r.session.begin('room'),true);r.s.projectData.other.cabinets[0].width=65;
 const ram=r.s.projectData,raw=JSON.stringify(ram),before=r.storage.getItem(PROJECTS);
 assert.equal(r.api.setEdges(part(),{w2:true}).ok,false);assert.equal(r.s.projectData,ram);assert.equal(JSON.stringify(ram),raw);assert.equal(r.storage.getItem(PROJECTS),before);
});
test('Invalid addresses, issues, absent roles/owners and mixed ownership are refused without writes',()=>{
 const r=fixture(),begins=beginCalls(r);
 for(const addr of [{}, {...part(),projectId:''},{...part(),cabinetId:'missing'},part('one','unknown'),{...part(),sourceIssues:[{reason:'unresolved'}]},
  {...part(),groupRoleId:'body.shelves'},{...group(),setId:'set'},group('one','unknown'),{...group(),qty:0},{...part(),cabinetId:'__proto__'}])assert.equal(r.api.setEdges(addr,{w2:true}).ok,false);
 assert.equal(begins(),0);assert.deepEqual(r.storage.calls,[]);
});
test('A generated row with sourceIssues is refused even if it also contains the requested ref',()=>{
 const r=fixture(),generate=r.FC.cabinetCutlist.getCabinetCutList;
 r.FC.cabinetCutlist.getCabinetCutList=(...args)=>generate(...args).map(p=>p.name==='Bok'?{...p,sourceIssues:[{reason:'unresolved',qty:1}]}:p);
 assert.equal(r.api.setEdges(part(),{w2:true}).code,'SOURCE_UNRESOLVED');assert.deepEqual(r.storage.calls,[]);
});
test('Ambiguous duplicate physical records or cabinet IDs are not guessed',()=>{
 for(const type of ['project','cabinet']){const r=fixture();
  if(type==='project'){const rows=JSON.parse(r.storage.getItem(PROJECTS));rows.push(clone(rows[0]));r.storage.rows.set(PROJECTS,JSON.stringify(rows));}
  else editSeed(r,p=>p.room.cabinets.push(clone(p.room.cabinets[0])));
  assert.equal(r.api.setEdges(part(),{w2:true}).ok,false);assert.deepEqual(r.storage.calls,[]);
 }
});
test('Corrupt existing production and partial edges are refused rather than overwritten',()=>{
 for(const production of [[],{partOverrides:[]},{partOverrides:{one:{'body.side.left':{edges:{w1:true}}}}}]){
  const r=fixture();editSeed(r,p=>p.room.production=production);const before=r.storage.getItem(PROJECTS);
  assert.equal(r.api.setEdges(part(),{w2:true}).ok,false);assert.equal(r.storage.getItem(PROJECTS),before);assert.deepEqual(r.storage.calls,[]);
 }
 const r=fixture();for(const patch of [{w1:1},{w3:true},{grain:'vertical'},null])assert.equal(r.api.setEdges(part(),patch).ok,false);assert.deepEqual(r.storage.calls,[]);
});
test('Non-PCV eligible back and invalid drawer front geometry reject writes',()=>{
 const r=fixture();assert.equal(r.api.setEdges(part('one','body.back'),{w1:true}).ok,false);
 editSeed(r,p=>{const c=p.room.cabinets[0];c.subType='szuflady';c.height=60;c.details={drawerLayout:'3_1_2_2'};});
 assert.equal(r.api.setEdges(group('one','front.drawer.small'),{w1:false}).code,'INVALID_DRAWER_FRONT_GEOMETRY');assert.deepEqual(r.storage.calls,[]);
});
test('A conflict between begin and save retains newer central data and unchanged RAM',()=>{
 const r=fixture(),ram=r.s.projectData,begin=r.session.begin;let once=true;
 r.session.begin=function(...args){const ok=begin.apply(this,args);if(once){once=false;const rows=JSON.parse(r.storage.getItem(PROJECTS));rows.find(row=>row.id==='A').projectData.room.cabinets[0].width=99;r.storage.rows.set(PROJECTS,JSON.stringify(rows));}return ok;};
 assert.equal(r.api.setEdges(part(),{w2:true}).ok,false);assert.equal(r.row('A').projectData.room.cabinets[0].width,99);assert.equal(r.s.projectData,ram);assert.equal(ram.room.cabinets[0].width,60);
});
test('Conditional central save refuses a stale expected record without altering newer rooms',()=>{
 const r=fixture(),expected=r.FC.projectStore.getById('A');assert.equal(r.session.begin('room'),true);
 const newer=r.FC.projectStore.getById('A');newer.projectData.other.cabinets[0].width=78;assert.ok(r.FC.projectStore.upsert(newer));
 const before=r.storage.getItem(PROJECTS),next=clone(r.s.projectData);next.room.production={partOverrides:{}};
 assert.equal(r.FC.project.saveConfirmed(next,{expectedRecord:expected}).ok,false);assert.equal(r.storage.getItem(PROJECTS),before);
});
test('Missing durable payload blocks changes; failed revision persistence reports explicit partial result',()=>{
 const r=fixture();assert.equal(r.session.begin('room'),true);r.storage.rows.delete(SESSION);const before=r.storage.getItem(PROJECTS);
 assert.equal(r.api.setEdges(part(),{w2:true}).ok,false);assert.equal(r.storage.getItem(PROJECTS),before);
 const t=fixture();assert.equal(t.session.begin('room'),true);const ram=t.s.projectData;t.storage.fail.set('set:'+SESSION,'throw');
 const result=t.api.setEdges(part(),{w2:true});assert.equal(result.ok,false);assert.equal(result.projectSaved,true);assert.equal(t.s.projectData,ram);assert.equal(override(t).edges.w2,true);
 const restarted=runtime(t.rows());assert.equal(restarted.session.cancel(),false);assert.equal(restarted.row('A').projectData.room.production.partOverrides.one['body.side.left'].edges.w2,true);
});
test('Catalogs, prices, legacy part stores and offer history survive new saves and cancel byte-for-byte',()=>{
 const r=fixture(),protectedKeys=['fc_edge_v1','fc_material_part_options_v1','fc_rozrys_grain_state_v1','fc_materials_v1','fc_hardware_v1','fc_pricelist_v1','fc_program_defaults_v1','fc_quote_snapshots_v1'];
 for(const key of protectedKeys)r.storage.rows.set(key,'{"preserve":"'+key+'"}');
 const before=Object.fromEntries(protectedKeys.map(key=>[key,r.storage.getItem(key)]));
 assert.equal(r.api.setEdges(part(),{w2:true}).ok,true);assert.equal(r.session.cancel(),true);
 for(const key of protectedKeys){assert.equal(r.storage.getItem(key),before[key]);assert.equal(r.storage.calls.some(call=>call[1]===key),false);}
});
test('Legacy material/rozrys/wycena calculations remain unchanged by this unconnected foundation',()=>{
 const r=fixture(),parts=r.parts(),old=r.FC.materialEdgeStore.createEdgeStore({persist:false}).calcEdgeMetersForParts(parts,r.cab());
 assert.equal(r.api.setEdges(part(),{w2:true}).ok,true);
 assert.equal(r.FC.materialEdgeStore.createEdgeStore({persist:false}).calcEdgeMetersForParts(r.parts(),r.cab()),old);
 const agg=r.FC.wycenaCoreSource.getSelectedAggregate({selectedRooms:['room','other']});assert.ok(agg.materials.length);
});
test('Existing durable session keeps the original baseline and no-op does not rewrite its payload',()=>{
 const r=fixture();assert.equal(r.session.begin('room'),true);const snapshot=r.session.snapshot,startedAt=r.session.startedAt;
 assert.equal(r.api.setEdges(part(),{w2:true}).ok,true);assert.equal(r.session.snapshot,snapshot);assert.equal(r.session.startedAt,startedAt);
 const payload=r.storage.getItem(SESSION),calls=r.storage.calls.length,begins=beginCalls(r);
 assert.equal(r.api.setEdges(part(),{w2:true}).changed,false);assert.equal(begins(),0);assert.equal(r.storage.calls.length,calls);assert.equal(r.storage.getItem(SESSION),payload);
});
test('Valid standard drawer front groups keep their separate quantities and owners',()=>{
 const r=fixture();editSeed(r,p=>{const c=p.room.cabinets[0];c.subType='szuflady';c.height=82;c.details={drawerLayout:'3_1_2_2'};});
 const small=group('one','front.drawer.small'),large=group('one','front.drawer.large');
 assert.equal(r.api.setEdges(small,{w1:false}).ok,true);assert.equal(r.api.get(large).edges.w1,true);
 assert.equal(r.api.setEdges(large,{w2:false}).ok,true);
 const parts=r.FC.cabinetCutlist.getCabinetCutList(r.s.projectData.room.cabinets[0],'room').filter(p=>p.name==='Front');
 assert.equal(parts.filter(p=>p.sourceGroups.some(g=>g.groupRoleId==='front.drawer.small')).reduce((n,p)=>n+p.qty,0),1);
 assert.equal(parts.filter(p=>p.sourceGroups.some(g=>g.groupRoleId==='front.drawer.large')).reduce((n,p)=>n+p.qty,0),2);
});
test('Baseline empty production containers survive the change and default roundtrip',()=>{
 for(const production of [{},{partOverrides:{}},{partOverrides:{one:{}}},{partOverrides:{one:{'body.side.left':{}}}}]){
  const r=fixture();editSeed(r,p=>p.room.production=clone(production));
  assert.equal(r.api.setEdges(part(),{w2:true}).ok,true);assert.equal(r.api.clearEdges(part()).ok,true);
  assert.deepEqual(r.row('A').projectData.room.production,production);assert.equal(r.session.isDirty(),false);
 }
});
test('Conditional write detects a container change at its final read without overwriting project B',()=>{
 const r=fixture();assert.equal(r.session.begin('room'),true);const expected=r.FC.projectStore.getById('A');
 const next=clone(r.s.projectData);next.room.production={partOverrides:{}};let reads=0;
 const conditional=r.FC.projectStore.updateRecordConfirmed;
 r.FC.projectStore.updateRecordConfirmed=(record,baseline)=>{r.storage.onRead=key=>{
  if(key===PROJECTS && ++reads===2){const rows=JSON.parse(r.storage.rows.get(PROJECTS));rows.find(row=>row.id==='B').projectData.room.cabinets[0].width=89;r.storage.rows.set(PROJECTS,JSON.stringify(rows));}
 };try{return conditional(record,baseline);}finally{r.storage.onRead=null;}};
 assert.equal(r.FC.project.saveConfirmed(next,{expectedRecord:expected}).ok,false);assert.equal(r.row('B').projectData.room.cabinets[0].width,89);
 assert.equal(r.row('A').projectData.room.production,undefined);
});
test('Non-finite native geometry is refused and confirmed domain success does not depend on views',()=>{
 const r=fixture(),generate=r.FC.cabinetCutlist.getCabinetCutList;
 r.FC.cabinetCutlist.getCabinetCutList=(...args)=>generate(...args).map(p=>p.name==='Bok'?{...p,a:Infinity}:p);
 assert.equal(r.api.setEdges(part(),{w2:true}).code,'PCV_INELIGIBLE');assert.deepEqual(r.storage.calls,[]);
 r.FC.cabinetCutlist.getCabinetCutList=generate;r.FC.views.refreshSessionButtons=()=>{throw new Error('unavailable UI');};
 assert.equal(r.api.setEdges(part(),{w2:true}).ok,true);assert.equal(r.api.get(part()).edges.w2,true);
});
test('An effective no-op does not rewrite a redundant record; explicit clear removes only its edges',()=>{
 const r=fixture();editSeed(r,p=>p.room.production={partOverrides:{one:{'body.side.left':{edges:{w1:true,w2:false,h1:false,h2:false},grain:'vertical'}}}});
 const before=r.storage.getItem(PROJECTS),begins=beginCalls(r);
 assert.equal(r.api.setEdges(part(),{w1:true}).changed,false);assert.equal(begins(),0);assert.deepEqual(r.storage.calls,[]);assert.equal(r.storage.getItem(PROJECTS),before);
 assert.equal(r.api.clearEdges(part()).changed,true);assert.deepEqual(override(r),{grain:'vertical'});
});
(async()=>{let failures=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name+'\n'+error.stack);}}console.log(`${tests.length-failures}/${tests.length} PASS`);process.exitCode=failures?1:0;})();

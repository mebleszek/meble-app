#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture}=require('./part-provenance-stability-smoke');
const clone=value=>JSON.parse(JSON.stringify(value));
const tests=[],test=(name,fn)=>tests.push([name,fn]);
const groups=parts=>Array.from(parts).flatMap(part=>Array.from(part.sourceGroups||[]));
const address=group=>{const out=clone(group);delete out.qty;return out;};
const keys=parts=>groups(parts).map(group=>JSON.stringify(address(group))).sort();
const geometry=parts=>Array.from(parts).filter(part=>(part.a||part.w)>0&&(part.b||part.h)>0);
const aggregateRows=aggregate=>aggregate.materials.flatMap(material=>Array.from(aggregate.groups[material].allParts));
function balanced(parts){
 for(const part of geometry(parts)){
  const covered=part.sourceRefs.length+part.sourceGroups.reduce((n,g)=>n+g.qty,0)+part.sourceIssues.reduce((n,g)=>n+g.qty,0);
  assert.equal(covered,part.qty,'Every physical quantity must be accounted for exactly once');
  assert.ok(part.sourceRefs.every(ref=>!ref.groupRoleId));
  assert.ok(part.sourceGroups.every(group=>!group.partRoleId));
 }
}
function drawers(r){
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/app/cabinet/cabinet-drawer-requirements.js'),'utf8'),r.s);
 r.cab().subType='szuflady';r.cab().details={shelves:3,drawers:3,drawerLayout:'3_equal',drawerSystem:'skrzynkowe',innerDrawerType:'skrzynkowe',innerDrawerCount:2};
 return r;
}
function setFixture(preset='C'){
 const r=fixture(),room=r.s.projectData.room;
 room.sets=[{id:'stable-set',presetId:preset,number:1,params:{w:60,w1:30,w2:30,hB:80,hTop:20,hM:30},frontCount:2,frontMaterial:'laminat',frontColor:'White'}];
 room.cabinets.forEach(cab=>{cab.setId='stable-set';cab.frontMaterial='laminat';cab.frontColor='White';});
 room.fronts=[];
 return r;
}
const setGroups=parts=>groups(parts).filter(group=>group.ownerType==='set');
test('Shelves 3 -> 5 keep one group address and the real quantities',()=>{
 const r=fixture();r.cab().details.shelves=3;const before=groups(r.parts()).find(g=>g.groupRoleId==='body.shelves');
 r.cab().details.shelves=5;const after=groups(r.parts()).find(g=>g.groupRoleId==='body.shelves');
 assert.equal(before.qty,3);assert.equal(after.qty,5);assert.deepEqual(address(after),address(before));balanced(r.parts());
});
test('Identical cabinet groups have distinct owners',()=>{
 const r=fixture(),one=keys(r.parts()),two=keys(r.parts(r.s.projectData.room.cabinets[1]));
 assert.ok(one.length>0&&two.length>0);assert.equal(one.some(key=>two.includes(key)),false);
});
test('Room and physical project addresses are independent',()=>{
 const r=fixture(),a=keys(r.parts()),other=keys(r.parts(r.s.projectData.other.cabinets[0],'other'));
 const b=keys(r.parts(r.FC.projectStore.getById('B').projectData.room.cabinets[0],'room','B'));
 assert.equal(a.some(key=>other.includes(key)||b.includes(key)),false);assert.ok(b.length>0);
});
test('Dimensions, material, labels and sort order do not change group addresses',()=>{
 const r=drawers(fixture()),before=keys(r.parts());r.cab().height=90;r.cab().width=70;r.cab().bodyColor='Black';r.cab().frontColor='Black';
 const rows=r.parts();assert.deepEqual(keys(rows),before);
 const renamed=rows.map(p=>({...p,name:'Other label'}));assert.deepEqual(keys(r.FC.rozrysScope.sortRozrysParts(renamed.reverse())),before);
});
test('Copying with a new cabinet ID never reuses group ownership',()=>{
 const r=fixture(),copy=clone(r.cab());copy.id='new-copy';const before=keys(r.parts());
 r.s.projectData.room.cabinets.push(copy);assert.equal(keys(r.parts(copy)).some(key=>before.includes(key)),false);
});
test('Native drawer front and box groups retain quantities through 3 -> 5',()=>{
 const r=drawers(fixture()),first=r.parts(),before=groups(first).filter(g=>g.groupRoleId!=='body.shelves');
 assert.equal(first.find(p=>p.name==='Front').qty,3);
 assert.equal(before.find(g=>g.groupRoleId==='drawer.front_drawers.sides').qty,6);
 r.cab().details.drawers=5;r.cab().details.drawerLayout='5_equal';const next=r.parts(),after=groups(next).filter(g=>g.groupRoleId!=='body.shelves');
 assert.equal(next.find(p=>p.name==='Front').qty,5);assert.equal(after.find(g=>g.groupRoleId==='drawer.front_drawers.sides').qty,10);
 assert.deepEqual(after.map(address).sort((a,b)=>a.groupRoleId.localeCompare(b.groupRoleId)),before.map(address).sort((a,b)=>a.groupRoleId.localeCompare(b.groupRoleId)));
 balanced(first);balanced(next);
});
test('Front and inner drawers are distinct structural groups even with identical box geometry',()=>{
 const r=drawers(fixture()),rows=r.parts(),sides=rows.filter(p=>p.name.startsWith('Bok szuflady'));
 assert.equal(sides.length,2);assert.equal(new Set(groups(sides).map(g=>g.groupRoleId)).size,2);
 const parts=aggregateRows(r.aggregate(['room']));balanced(parts);
 const groupedSides=parts.find(p=>p.name.startsWith('Bok szuflady')&&p.sourceGroups.some(g=>g.groupRoleId==='drawer.front_drawers.sides'));
 assert.ok(groupedSides.sourceGroups.some(g=>g.groupRoleId==='drawer.front_drawers.sides'));
 assert.ok(groups(parts).some(g=>g.groupRoleId==='drawer.inner_drawers.sides'));
});
test('Mixed 1-small/2-large template fronts retain two semantic groups, never one geometry-based owner',()=>{
 const r=drawers(fixture());r.cab().details.drawerLayout='3_1_2_2';const front=r.parts().find(p=>p.name==='Front');
 assert.equal(front.qty,3);assert.equal(front.sourceGroups.length,2);
 assert.equal(front.sourceGroups.find(g=>g.groupRoleId==='front.drawer.small').qty,1);
 assert.equal(front.sourceGroups.find(g=>g.groupRoleId==='front.drawer.large').qty,2);balanced([front]);
 r.cab().height=90;assert.deepEqual(groups(r.parts()).filter(g=>g.groupRoleId.startsWith('front.drawer')).map(address),Array.from(front.sourceGroups,address));
 r.cab().details.drawers=5;const inconsistent=r.parts().find(p=>p.name==='Front');assert.equal(inconsistent.qty,5);assert.equal(inconsistent.sourceGroups.length,0);assert.equal(inconsistent.sourceIssues[0].qty,5);
});
test('Existing fixed parts stay individual refs; singleton drawer roles are preserved',()=>{
 const r=drawers(fixture());r.cab().subType='piekarnikowa';r.cab().details={ovenOption:'szuflada_dol',drawerSystem:'skrzynkowe'};
 const rows=r.parts(),sides=rows.find(p=>p.name==='Bok'),box=rows.find(p=>p.name.startsWith('Bok szuflady'));
 assert.equal(sides.sourceRefs.length,2);assert.equal(sides.sourceGroups.length,0);
 assert.equal(box.sourceRefs.length,2);assert.equal(box.sourceGroups.length,0);balanced(rows);
});
test('Mixed individual front roles in one geometry row are not lost or double counted',()=>{
 const r=fixture();r.cab().subType='szuflada_drzwi';r.cab().width=60;r.cab().height=50;r.cab().details={drawerHeight:20,doorCount:1};
 // Leg height 10: drawer and door are both 60 x 20 and aggregate into one row.
 const front=r.parts().find(p=>p.name==='Front');assert.equal(front.qty,2);assert.equal(front.sourceRefs.length,2);assert.equal(front.sourceGroups.length,0);balanced([front]);
});
test('Ambiguous manual/duplicate requirements remain issues instead of counterfeit standard groups',()=>{
 const r=drawers(fixture());r.cab().drawerRequirements=[{source:'front_drawers',qty:2,technical:{drawerKind:'box'}},{source:'front_drawers',qty:1,technical:{drawerKind:'box'}}];
 const rows=r.parts().filter(p=>p.name.startsWith('Bok szuflady'));assert.equal(rows.reduce((n,p)=>n+p.qty,0),6);
 assert.equal(groups(rows).length,0);assert.ok(rows.every(p=>p.sourceIssues[0].reason==='ambiguous_drawer_requirement'));balanced(rows);
});
test('Both aggregators preserve every group owner and its contribution',()=>{
 const r=fixture(),raw=r.parts().concat(r.parts(r.s.projectData.room.cabinets[1]),r.parts(r.s.projectData.other.cabinets[0],'other'));
 const quantity=rows=>groups(rows).reduce((n,g)=>n+g.qty,0);
 for(const aggregate of [r.aggregate(['room','other']),r.FC.cabinetDerivedFacts.aggregatePartsForRooms(['room','other'])]){
  const rows=aggregateRows(aggregate);assert.deepEqual(keys(rows),keys(raw));assert.equal(quantity(rows),quantity(raw));balanced(rows);
 }
 r.s.projectData.room.cabinets.reverse();assert.deepEqual(keys(aggregateRows(r.aggregate(['other','room']))),keys(raw));
});
test('MATERIAL, ROZRYS raw reads, WYCENA source and cache carry copied groups',()=>{
 const r=drawers(fixture()),expected=keys(r.parts());const material=r.FC.materialTabData.collectRoomMaterials('room');
 assert.deepEqual(keys(material.cabinetRows[0].parts),expected);
 const quote=aggregateRows(r.FC.wycenaCoreSource.getSelectedAggregate({selectedRooms:['room']}));assert.deepEqual(keys(quote),keys(r.parts().concat(r.parts(r.s.projectData.room.cabinets[1]))));
 const utils=r.FC.rozrysRuntimeUtils.createApi({FC:r.FC,safeGetProject:()=>r.s.projectData,getRooms:()=>['room'],resolveCabinetCutListFn:()=>r.FC.cabinetCutlist.getCabinetCutList,resolveRozrysPartFromSource:r.FC.materialPartOptions.resolvePartForRozrys});
 const raw=utils.buildRawSnapshotForMaterial('laminat White','both',['room']);
 assert.deepEqual(keys(raw),keys(r.parts().concat(r.parts(r.s.projectData.room.cabinets[1])).filter(p=>p.material==='laminat White')));
 assert.ok(groups(r.cab().derivedFacts.cutlists.fronts).some(g=>g.groupRoleId==='front.drawer.standard'));
 const p=r.parts().find(p=>p.name==='Front'),resolved=r.FC.materialPartOptions.resolvePartForRozrys(p);resolved.sourceGroups[0].qty=999;
 assert.equal(p.sourceGroups[0].qty,3);material.cabinetRows[0].parts.find(p=>p.name==='Front').sourceGroupRoles[0].qty=888;
 assert.equal(groups(r.parts()).find(g=>g.groupRoleId==='front.drawer.standard').qty,3);
});
test('A copied RAM cache is rebound to the explicit new cabinet/project owner',()=>{
 const r=fixture();r.FC.cabinetDerivedFacts.getCutlist('room',r.cab());const copy=clone(r.cab());copy.id='new-copy';
 const rows=r.FC.cabinetDerivedFacts.getCutlist('room',copy,{projectId:'B',recalculate:false});
 assert.ok(groups(rows).every(g=>g.projectId==='B'&&g.cabinetId==='new-copy'));assert.ok(groups(rows).length>0);
 assert.ok(groups(r.cab().derivedFacts.cutlists.all).every(g=>g.projectId==='A'&&g.cabinetId==='one'));
});
test('Set front groups use stable setId across cabinet reorder and regenerated front IDs',()=>{
 const r=setFixture(),room=r.s.projectData.room,before=setGroups(r.parts());assert.equal(before.length,1);assert.equal(before[0].qty,2);
 assert.equal(before[0].ownerType,'set');assert.equal(before[0].setId,'stable-set');assert.ok(!before[0].cabinetId);
 room.cabinets.reverse();const after=setGroups(r.parts(room.cabinets[0]));assert.deepEqual(clone(after),clone(before));
 room.fronts=[{id:'random-1',setId:'stable-set',width:30,height:100,material:'laminat',color:'White'},{id:'random-2',setId:'stable-set',width:30,height:100,material:'laminat',color:'White'}];
 assert.deepEqual(clone(setGroups(r.parts(room.cabinets[0]))),clone(before));room.fronts.forEach((front,i)=>front.id='regenerated-'+i);
 assert.deepEqual(clone(setGroups(r.parts(room.cabinets[0]))),clone(before));
});
test('Asymmetric set A construction roles stay separate even when dimensions coincide',()=>{
 const r=setFixture('A'),before=setGroups(r.parts());assert.equal(before.length,2);assert.equal(new Set(before.map(g=>g.groupRoleId)).size,2);
 r.s.projectData.room.sets[0].params.w1=40;r.s.projectData.room.sets[0].params.w2=50;r.s.projectData.room.sets[0].frontColor='Black';
 const after=setGroups(r.parts());assert.deepEqual(after.map(address).sort((a,b)=>a.groupRoleId.localeCompare(b.groupRoleId)),before.map(address).sort((a,b)=>a.groupRoleId.localeCompare(b.groupRoleId)));balanced(r.parts());
});
test('Set cache invalidates after reorder, template edit and cabinet regeneration without doubling fronts',()=>{
 const r=setFixture(),facts=r.FC.cabinetDerivedFacts,read=()=>setGroups(aggregateRows(facts.aggregatePartsForRooms(['room']))),room=r.s.projectData.room;
 const before=read();assert.equal(before.reduce((n,g)=>n+g.qty,0),2);room.cabinets.reverse();assert.deepEqual(clone(read()),clone(before));
 room.sets[0].params.w=80;const edited=aggregateRows(facts.aggregatePartsForRooms(['room']));assert.equal(edited.filter(p=>p.sourceGroups.some(g=>g.ownerType==='set'))[0].w,400);
 room.cabinets=room.cabinets.map(cab=>({...clone(cab),id:'regenerated-'+cab.id}));assert.deepEqual(clone(read()),clone(before));
 room.sets[0].frontCount=1;assert.equal(read().reduce((n,g)=>n+g.qty,0),1);assert.deepEqual(address(read()[0]),address(before[0]));
});
test('Unverified, orphaned or cross-context set fronts have issues with a set owner, never a cabinet owner',()=>{
 const r=setFixture(),room=r.s.projectData.room;room.fronts=[{id:'custom',setId:'stable-set',width:47,height:23,material:'glass'}];
 let front=r.parts().find(p=>p.name==='Front');assert.equal(front.sourceGroups.length,0);assert.equal(front.sourceIssues[0].setId,'stable-set');assert.ok(!front.sourceIssues[0].cabinetId);
 room.fronts=[];front=r.parts(r.cab(),'room','B').find(p=>p.name==='Front');assert.equal(front.sourceGroups.length,0);
 room.sets=[];room.fronts=[{setId:'stable-set',width:30,height:100}];front=r.parts().find(p=>p.name==='Front');assert.equal(front.sourceGroups.length,0);assert.ok(front.sourceIssues.length);
 room.fronts=[];front=r.parts().find(p=>p.name==='Front');assert.equal(front.qty,2);assert.equal(front.sourceRefs.length,0);assert.equal(front.sourceGroups.length,0);
 assert.equal(front.sourceIssues[0].setId,'stable-set');assert.ok(!front.sourceIssues[0].cabinetId);balanced([front]);
});
test('Missing context and invalid coverage fail closed without fabricating group addresses',()=>{
 const r=fixture(),detached=clone(r.cab()),rows=r.FC.cabinetCutlist.getCabinetCutList(detached,'room');assert.equal(groups(rows).length,0);
 const invalid=r.FC.partProvenance.bind([{qty:1,sourceGroupRoles:[{ownerType:'cabinet',groupRoleId:'body.shelves',qty:2}]}],{projectId:'A',roomId:'room',cabinetId:'one'})[0];
 assert.equal(invalid.sourceGroups.length,0);assert.equal(invalid.sourceIssues[0].qty,1);assert.equal(invalid.sourceIssues[0].reason,'invalid_source_metadata');
});
test('Read paths never start a session, write storage or alter source project fields',()=>{
 const r=drawers(fixture()),before=JSON.stringify(r.FC.projectStore.prepareProjectDataForPersistence(r.s.projectData));let begins=0;r.session.begin=()=>{begins++;throw Error('read must not begin');};
 r.parts();r.aggregate(['room','other']);r.FC.cabinetDerivedFacts.aggregatePartsForRooms(['room','other']);r.FC.materialTabData.collectRoomMaterials('room');
 assert.equal(begins,0);assert.deepEqual(r.storage.calls,[]);assert.equal(JSON.stringify(r.FC.projectStore.prepareProjectDataForPersistence(r.s.projectData)),before);
 assert.equal(r.session.active,false);
});
test('Surface/PCV golden values and fixed qty remain unchanged',()=>{
 const r=fixture(),parts=r.parts();balanced(parts);
 assert.ok(Math.abs(r.FC.materialCommon.totalsFromParts(parts)['laminat White']-1.64188)<0.00001);
 assert.ok(Math.abs(r.FC.materialEdgeStore.createEdgeStore({persist:false}).calcEdgeMetersForParts(parts,r.cab())-8.22)<0.00001);
 assert.equal(parts.find(p=>p.name==='Bok').qty,2);assert.equal(parts.find(p=>p.name==='Półka').qty,2);assert.deepEqual(r.storage.calls,[]);
});
(async()=>{let failures=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name+'\n'+error.stack);}}console.log(`${tests.length-failures}/${tests.length} PASS`);process.exitCode=failures?1:0;})();

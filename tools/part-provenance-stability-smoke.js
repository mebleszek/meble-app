#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {runtime}=require('./project-session-owner-rollback-smoke');
const ROOT=path.resolve(__dirname,'..'),clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const r=runtime(),s=r.s,FC=r.FC;
 const cabinet=id=>({id,type:'stojąca',subType:'standardowa',width:60,height:80,depth:50,bodyColor:'laminat White',frontMaterial:'laminat',frontColor:'White',backMaterial:'HDF',frontCount:2,details:{shelves:2}});
 const room=cabs=>({cabinets:cabs,fronts:[],sets:[],settings:{legHeight:10,bottomHeight:82}});
 const a=FC.projectStore.getById('A');a.projectData={meta:{assignedInvestorId:'inv-A'},room:room([cabinet('one'),cabinet('two')]),other:room([cabinet('one')])};FC.projectStore.upsert(a);
 const b=FC.projectStore.getById('B');b.projectData={meta:{assignedInvestorId:'inv-B'},room:room([cabinet('one')])};FC.projectStore.upsert(b);s.projectData=FC.project.load();
 s.materials=[{name:'laminat White',materialType:'laminat'},{name:'White',materialType:'laminat'}];s.document={getElementById:()=>null};
 const load=file=>vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),s,{filename:file});
 for(const file of ['js/app/cabinet/part-provenance.js','js/app/material/material-common.js','js/app/cabinet/front-hardware-fronts.js','js/app/cabinet/cabinet-cutlist.js',
 'js/app/material/material-part-options.js','js/app/material/material-edge-store.js','js/app/cabinet/cabinet-derived-facts.js','js/app/material/material-tab-data.js',
 'js/app/shared/room-scope-resolver.js','js/app/rozrys/rozrys-scope.js','js/app/rozrys/rozrys-part-helpers.js','js/app/rozrys/rozrys-runtime-utils.js','js/app/wycena/wycena-core-selection.js'])load(file);
 s.getCabinetCutList=FC.cabinetCutlist.getCabinetCutList;s.totalsFromParts=FC.materialCommon.totalsFromParts;
 FC.roomRegistry={getActiveRoomIds:()=>['room','other']};
 const deps={safeGetProject:()=>s.projectData,getRooms:()=>['room','other'],getCabinetCutList:FC.cabinetCutlist.getCabinetCutList,resolveRozrysPartFromSource:FC.materialPartOptions.resolvePartForRozrys};
 FC.rozrys={safeGetProject:()=>s.projectData,aggregatePartsForProject:rooms=>FC.rozrysScope.aggregatePartsForProject(rooms,deps)};load('js/app/wycena/wycena-core-source.js');
 r.cab=()=>s.projectData.room.cabinets[0];
 r.parts=(cab=r.cab(),roomId='room',projectId='A')=>FC.cabinetCutlist.getCabinetCutList(cab,roomId,{projectId});
 r.refs=parts=>Array.from(parts).filter(p=>(p.a||p.w)>0&&(p.b||p.h)>0).flatMap(p=>Array.from(p.sourceRefs||[]));
 r.keys=parts=>r.refs(parts).map(ref=>JSON.stringify(ref)).sort();r.aggregate=rooms=>FC.rozrys.aggregatePartsForProject(rooms);
 r.storage.calls.length=0;return r;
}
const tests=[],test=(name,fn)=>tests.push([name,fn]);
test('Identical cabinet sides retain four distinct owners without splitting qty:2',()=>{
 const r=fixture(),a=r.parts(),b=r.parts(r.s.projectData.room.cabinets[1]);
 const side=rows=>rows.find(p=>p.name==='Bok');assert.equal(side(a).qty,2);assert.equal(side(a).sourceRefs.length,2);
 const refs=side(a).sourceRefs.concat(side(b).sourceRefs);assert.equal(new Set(refs.map(x=>JSON.stringify(x))).size,4);
 assert.deepEqual(clone(side(a).sourceRefs.map(x=>x.partRoleId)),['body.side.left','body.side.right']);
});
test('Identical cabinet IDs in separate rooms have different full addresses',()=>{
 const r=fixture(),a=r.keys(r.parts()),b=r.keys(r.parts(r.s.projectData.other.cabinets[0],'other'));
 assert.equal(a.some(key=>b.includes(key)),false);
});
test('Explicit physical project B never receives the active project A address',()=>{
 const r=fixture(),a=r.keys(r.parts()),cab=clone(r.FC.projectStore.getById('B').projectData.room.cabinets[0]);
 const parts=r.parts(cab,'room','B'),b=r.keys(parts);assert.equal(a.some(key=>b.includes(key)),false);
 assert.ok(r.refs(parts).every(ref=>ref.projectId==='B'));
});
test('Dimensions, decor, displayed name and grain changes do not change stable roles',()=>{
 const r=fixture(),before=r.keys(r.parts()),cab=r.cab();cab.height=90;cab.width=70;cab.bodyColor='laminat Black';cab.frontColor='Black';
 const parts=r.parts();assert.deepEqual(r.keys(parts),before);
 const source=parts.find(p=>p.name==='Bok'),renamed={...source,name:'Localized label'};
 const sig=r.FC.materialPartOptions.signatureFromPart(renamed);r.storage.rows.set('fc_material_part_options_v1',JSON.stringify({[sig]:'vertical'}));
 assert.deepEqual(clone(r.FC.materialPartOptions.resolvePartForRozrys(renamed).sourceRefs),clone(source.sourceRefs));
});
test('Sorting cabinets and part rows never changes source addresses',()=>{
 const r=fixture(),before=r.keys(r.parts());r.s.projectData.room.cabinets.reverse();
 const one=r.s.projectData.room.cabinets.find(c=>c.id==='one');const sorted=r.FC.rozrysScope.sortRozrysParts(r.parts(one).slice().reverse());
 assert.deepEqual(r.keys(sorted),before);
});
test('Copying a cabinet with a new ID does not reuse original source addresses',()=>{
 const r=fixture(),before=r.keys(r.parts()),copy=clone(r.cab());copy.id='copied';r.s.projectData.room.cabinets.push(copy);
 assert.equal(r.keys(r.parts(copy)).some(key=>before.includes(key)),false);
});
test('Deleting fridge lower cover never reassigns its address to the upper cover',()=>{
 const r=fixture(),cab=r.cab();cab.subType='lodowkowa';cab.details={fridgeOption:'zabudowa',fridgeFrontCount:'2'};
 r.s.projectData.room.settings.bottomHeight=40;const before=r.parts(),upper=before.flatMap(p=>p.sourceRefs).find(x=>x.partRoleId==='front.fridge.upper');
 assert.ok(before.flatMap(p=>p.sourceRefs).some(x=>x.partRoleId==='front.fridge.lower'));
 r.s.projectData.room.settings.bottomHeight=10;const after=r.parts().flatMap(p=>p.sourceRefs);
 assert.deepEqual(clone(after.find(x=>x.partRoleId==='front.fridge.upper')),clone(upper));assert.equal(after.some(x=>x.partRoleId==='front.fridge.lower'),false);
});
test('Standard shelf counts use one stable group rather than positional physical IDs',()=>{
 const r=fixture(),row=r.parts().find(p=>p.name==='Półka');assert.equal(row.qty,2);assert.deepEqual(clone(row.sourceRefs),[]);
 assert.equal(row.sourceGroups[0].qty,2);assert.equal(row.sourceGroups[0].groupRoleId,'body.shelves');assert.equal(row.sourceIssues.length,0);
 r.cab().details.shelves=1;const next=r.parts().find(p=>p.name==='Półka');assert.equal(next.sourceGroups[0].qty,1);assert.deepEqual(clone(next.sourceRefs),[]);
 assert.deepEqual(clone({...row.sourceGroups[0],qty:1}),clone(next.sourceGroups[0]));
});
test('Drawer singleton components are distinct; standard drawer groups preserve full qty',()=>{
 const r=fixture();r.FC.cabinetDrawerRequirements={getDrawerRequirements:()=>[{source:'oven_drawer',qty:1,technical:{drawerKind:'box'}}]};
 let row=r.parts().find(p=>p.name.startsWith('Bok szuflady'));assert.equal(row.qty,2);assert.equal(new Set(row.sourceRefs.map(x=>x.partRoleId)).size,2);
 r.FC.cabinetDrawerRequirements.getDrawerRequirements=()=>[{source:'front_drawers',qty:3,technical:{drawerKind:'box'}}];
 row=r.parts().find(p=>p.name.startsWith('Bok szuflady'));assert.equal(row.qty,6);assert.deepEqual(clone(row.sourceRefs),[]);assert.equal(row.sourceGroups[0].qty,6);
});
test('Corner roles survive dimension changes; shared set fronts have a set owner',()=>{
 const r=fixture(),cab=r.cab();cab.subType='narozna_l';cab.details={gl:60,gp:50,st:90,sp:60};const before=r.keys(r.parts());
 cab.details.gl=70;cab.details.gp=40;assert.deepEqual(r.keys(r.parts()),before);
 cab.subType='standardowa';cab.setId='set';r.s.projectData.room.sets=[{id:'set',presetId:'A',number:1,frontCount:2,params:{w1:30,w2:30,hB:80,hTop:20}}];
 const front=r.parts().find(p=>p.name==='Front');assert.equal(front.qty,2);assert.deepEqual(clone(front.sourceRefs),[]);
 assert.equal(front.sourceGroups.reduce((sum,g)=>sum+g.qty,0),2);assert.ok(front.sourceGroups.every(g=>g.setId==='set' && !g.cabinetId));assert.equal(front.sourceIssues.length,0);
});
test('Both aggregation paths keep all owners and quantities while grouping compatible parts',()=>{
 const r=fixture(),sum=parts=>parts.reduce((n,p)=>n+p.qty,0),raw=r.parts().concat(r.parts(r.s.projectData.room.cabinets[1]),r.parts(r.s.projectData.other.cabinets[0],'other'));
 const agg=r.aggregate(['room','other']),parts=agg.materials.flatMap(m=>agg.groups[m].allParts);
 const geometry=raw.filter(p=>p.a>0&&p.b>0);assert.equal(sum(parts),sum(geometry));assert.deepEqual(r.keys(parts),r.keys(raw));
 const facts=r.FC.cabinetDerivedFacts.aggregatePartsForRooms(['room','other']);const factParts=facts.materials.flatMap(m=>facts.groups[m].allParts);
 assert.equal(sum(factParts),sum(geometry));assert.deepEqual(r.keys(factParts),r.keys(raw));
 for(const p of parts)assert.equal((p.sourceRefs||[]).length+(p.sourceGroups||[]).reduce((n,x)=>n+x.qty,0)+(p.sourceIssues||[]).reduce((n,x)=>n+x.qty,0),p.qty);
});
test('MATERIAL, WYCENA source and ROZRYS raw diagnostics carry the same provenance',()=>{
 const r=fixture(),model=r.FC.materialTabData.collectRoomMaterials('room'),expected=r.keys(r.parts());
 assert.deepEqual(r.keys(model.cabinetRows[0].parts),expected);
 const aggregate=r.FC.wycenaCoreSource.getSelectedAggregate({selectedRooms:['room']}),parts=aggregate.materials.flatMap(m=>aggregate.groups[m].allParts);
 assert.deepEqual(r.keys(parts),r.keys(r.parts().concat(r.parts(r.s.projectData.room.cabinets[1]))));
 const utils=r.FC.rozrysRuntimeUtils.createApi({FC:r.FC,safeGetProject:()=>r.s.projectData,getRooms:()=>['room','other'],resolveCabinetCutListFn:()=>r.FC.cabinetCutlist.getCabinetCutList,resolveRozrysPartFromSource:r.FC.materialPartOptions.resolvePartForRozrys});
 const diagnostic=utils.buildRawSnapshotForMaterial('laminat White','both',['room']);
 const expectedBody=r.parts().concat(r.parts(r.s.projectData.room.cabinets[1])).filter(p=>p.material==='laminat White');assert.deepEqual(r.keys(diagnostic),r.keys(expectedBody));
});
test('Read paths do not write storage or change source cabinet fields',()=>{
 const r=fixture(),before=JSON.stringify(r.s.projectData);r.parts();r.FC.frontHardware.getCabinetFrontCutListForMaterials('room',r.cab());
 assert.equal(JSON.stringify(r.s.projectData),before);r.aggregate(['room','other']);r.FC.materialTabData.collectRoomMaterials('room');
 assert.equal(JSON.stringify(r.FC.projectStore.prepareProjectDataForPersistence(r.s.projectData)),JSON.stringify(r.FC.projectStore.prepareProjectDataForPersistence(JSON.parse(before))));
 assert.deepEqual(r.storage.calls,[]);
});
test('Known geometry, surface area and PCV meters stay unchanged with provenance',()=>{
 const r=fixture(),parts=r.parts();const geo=Array.from(parts).filter(p=>p.a>0&&p.b>0);
 assert.deepEqual(geo.map(p=>[p.name,p.qty,p.a,p.b]),[['Bok',2,68.2,50],['Wieniec dolny',1,60,50],['Trawers górny (9 cm)',2,56.4,9],['Półka',2,56.4,49.5],['Plecy',1,59.5,69.5],['Front',2,30,70]]);
 const totals=r.FC.materialCommon.totalsFromParts(parts);assert.ok(Math.abs(totals['laminat White']-1.64188)<0.00001);
 const edge=r.FC.materialEdgeStore.createEdgeStore({persist:false});assert.ok(Math.abs(edge.calcEdgeMetersForParts(parts,r.cab())-8.22)<0.00001);
 assert.deepEqual(r.storage.calls,[]);
});
test('Missing owner context never invents an address from an active pointer',()=>{
 const r=fixture(),detached=clone(r.cab()),parts=r.FC.cabinetCutlist.getCabinetCutList(detached,'room');
 assert.equal(r.refs(parts).length,0);assert.ok(parts.every(p=>p.sourceIssues.length));
});
test('RAM cache copied to project B is rebound on read, never exposing A owners',()=>{
 const r=fixture();r.FC.cabinetDerivedFacts.getCutlist('room',r.cab());
 const copy=clone(r.cab()),rows=r.FC.cabinetDerivedFacts.getCutlist('room',copy,{projectId:'B',recalculate:false});
 assert.ok(r.refs(rows).length>0);assert.ok(r.refs(rows).every(ref=>ref.projectId==='B'));
 assert.ok(r.refs(r.cab().derivedFacts.cutlists.all).every(ref=>ref.projectId==='A'));assert.deepEqual(r.storage.calls,[]);
});
test('Standard drawer fronts have group ownership, while the fixed single drawer keeps its role',()=>{
 const r=fixture(),cab=r.cab();cab.subType='szuflady';cab.details={drawers:3};
 const fronts=r.parts().filter(p=>p.name==='Front');assert.equal(fronts.length,1);assert.equal(fronts[0].qty,3);assert.deepEqual(clone(fronts[0].sourceRefs),[]);assert.equal(fronts[0].sourceGroups[0].qty,3);
 cab.subType='szuflada_drzwi';cab.details={drawerHeight:20,doorCount:2};
 assert.ok(r.refs(r.parts()).some(ref=>ref.partRoleId==='front.drawer.main'));
});
test('Returned metadata does not alias another renderer or the generated part',()=>{
 const r=fixture(),p=r.parts().find(p=>p.name==='Bok'),resolved=r.FC.materialPartOptions.resolvePartForRozrys(p),old=clone(p.sourceRefs);
 resolved.sourceRefs[0].cabinetId='bad';assert.deepEqual(clone(p.sourceRefs),old);
 const aggregate=r.aggregate(['room']);aggregate.groups['laminat White'].allParts[0].sourceRefs[0].cabinetId='bad';
 assert.ok(r.refs(r.parts()).every(ref=>ref.cabinetId==='one'));
});
module.exports={fixture};
if(require.main===module)(async()=>{let failures=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name+'\n'+error.stack);}}console.log(`${tests.length-failures}/${tests.length} PASS`);process.exitCode=failures?1:0;})();

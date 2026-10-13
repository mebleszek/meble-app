#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture}=require('./part-provenance-stability-smoke');
const clone=value=>JSON.parse(JSON.stringify(value)),tests=[];
const test=(name,fn)=>tests.push([name,fn]);
function setup(){
 const r=fixture();let uid=0;r.FC.utils.uid=()=>`test-front-${++uid}`;
 for(const file of ['js/app/cabinet/cabinet-fronts.js','js/app/cabinet/cabinet-drawer-requirements.js','js/app/cabinet/cabinet-modal-finalize.js']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),r.s,{filename:file});
 }
 r.cab().subType='szuflady';r.cab().height=82;r.cab().details={drawerLayout:'3_1_2_2',drawerSystem:'skrzynkowe',innerDrawerType:'brak'};
 r.s.uiState.roomType='room';r.s.cabinetModalState={mode:'edit',editingId:'one'};
 return r;
}
const frontRows=parts=>Array.from(parts).filter(part=>part.name==='Front');
const heights=parts=>frontRows(parts).flatMap(p=>Array(p.qty).fill(Math.round(p.b*10))).sort((a,b)=>a-b);
const groupTotals=parts=>frontRows(parts).flatMap(p=>Array.from(p.sourceGroups)).reduce((out,g)=>{out[g.groupRoleId]=(out[g.groupRoleId]||0)+g.qty;return out;},{});
const aggregateFronts=agg=>Array.from(agg.materials).flatMap(material=>Array.from(agg.groups[material].allParts)).filter(p=>p.name==='Front');
const expandedMm=parts=>parts.flatMap(p=>Array(p.qty).fill([p.w,p.h])).sort((a,b)=>a[1]-b[1]);
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<0.000001,`${actual} != ${expected}`);
function generate(r){assert.equal(r.FC.cabinetFronts.generateFrontsForCabinet('room',r.cab()),true);return Array.from(r.s.projectData.room.fronts).filter(f=>f.cabId==='one');}
test('720 mm body produces 139/283/283 mm and exactly 713 mm with the two gaps',()=>{
 const r=setup(),result=r.FC.cabinetCutlist.resolveDrawerFrontGeometry(r.cab(),'room');
 assert.equal(result.ok,true);assert.equal(result.bodyHeightMm,720);assert.deepEqual(clone(result.panels.map(p=>p.heightMm)),[139,283,283]);
 assert.equal(result.panels.reduce((n,p)=>n+p.heightMm,0)+2*result.gapMm,713);assert.equal(result.totalClearanceMm,7);
 assert.deepEqual(heights(r.parts()),[139,283,283]);
});
test('Several body heights retain fixed large fronts and total H_body minus 7',()=>{
 const r=setup();for(const body of [600,650,700,720,800,900]){
  r.cab().height=body/10+10;const geometry=r.FC.cabinetCutlist.resolveDrawerFrontGeometry(r.cab(),'room');
  assert.equal(geometry.ok,true);assert.deepEqual(clone(geometry.panels.map(p=>p.heightMm)),[body-581,283,283]);
  assert.equal(geometry.panels.reduce((n,p)=>n+p.heightMm,0)+8,body-7);
 }
});
test('Total height, already-body height, per-cabinet legs and module all resolve the same 720 mm body',()=>{
 const r=setup();assert.equal(r.FC.cabinetCutlist.resolveDrawerFrontGeometry(r.cab(),'room').bodyHeightMm,720);
 r.cab().height=72;r.cab().details.heightIncludesLegs='0';assert.deepEqual(heights(r.parts()),[139,283,283]);
 r.cab().height=87;r.cab().details={drawerLayout:'3_1_2_2',legHeightCm:'15'};assert.deepEqual(heights(r.parts()),[139,283,283]);
 r.cab().type='moduł';r.cab().height=72;assert.deepEqual(heights(r.parts()),[139,283,283]);
 for(const value of [false,0,'false','nie','off']){r.cab().type='stojąca';r.cab().height=72;r.cab().details.heightIncludesLegs=value;assert.deepEqual(heights(r.parts()),[139,283,283]);}
});
test('Persisted fronts and native material cutlist use identical dimensions and counts',()=>{
 const r=setup(),fronts=generate(r),cutlist=r.parts();
 assert.deepEqual(fronts.map(f=>[f.width*10,f.height*10]),[[600,139],[600,283],[600,283]]);
 assert.deepEqual(heights(cutlist),fronts.map(f=>Math.round(f.height*10)).sort((a,b)=>a-b));assert.equal(r.cab().frontCount,3);
 const req=r.FC.cabinetDrawerRequirements.getDrawerRequirements('room',r.cab());assert.equal(req[0].qty,3);
});
test('MATERIAL, ROZRYS and WYCENA receive the same 600 x 139/283/283 source geometry',()=>{
 const r=setup();r.s.projectData.room.cabinets=[r.cab()];generate(r);
 const material=r.FC.materialTabData.collectRoomMaterials('room');assert.deepEqual(heights(material.cabinetRows[0].parts),[139,283,283]);
 const expected=[[600,139],[600,283],[600,283]];
 assert.deepEqual(expandedMm(aggregateFronts(r.aggregate(['room']))),expected);
 assert.deepEqual(expandedMm(aggregateFronts(r.FC.wycenaCoreSource.getSelectedAggregate({selectedRooms:['room']}))),expected);
});
test('The real optimizer places all three correctly sized fronts on one sheet',()=>{
 const r=setup();r.s.projectData.room.cabinets=[r.cab()];
 for(const file of ['js/app/optimizer/cut-optimizer.js','js/app/rozrys/rozrys-engine.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),r.s,{filename:file});
 const plan=r.FC.rozrysEngine.computePlan({unit:'mm',boardW:2800,boardH:2070,kerf:4,edgeTrim:10,grain:true},aggregateFronts(r.aggregate(['room'])),{isPartRotationAllowed:()=>false});
 assert.equal(plan.sheets.length,1);const placements=Array.from(plan.sheets).flatMap(sheet=>Array.from(sheet.placements));assert.equal(placements.length,3);
 assert.deepEqual(placements.map(p=>[p.w,p.h]).sort((a,b)=>a[1]-b[1]),[[600,139],[600,283],[600,283]]);assert.deepEqual(r.storage.calls,[]);
});
test('Actual WYCENA material lines use 0.423 m2 at an unchanged controlled price',async()=>{
 const r=setup();r.s.projectData.room.cabinets=[r.cab()];r.FC.wycenaCoreCatalog={materialPriceLookup:()=>({priceUnit:'m2',price:100})};
 for(const file of ['js/app/wycena/wycena-core-utils.js','js/app/wycena/wycena-core-material-plan.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),r.s,{filename:file});
 const selection={selectedRooms:['room'],materialScope:{kind:'all',includeCorpus:false,includeFronts:true}};
 const lines=await r.FC.wycenaCoreMaterialPlan.collectMaterialLines(r.FC.wycenaCoreSource.getSelectedAggregate(selection),selection);
 const materialLines=Array.from(lines).filter(line=>line.priceUnit==='m2');assert.equal(materialLines.length,1);
 near(materialLines[0].qty,0.423);assert.equal(materialLines[0].unitPrice,100);near(materialLines[0].total,42.3);assert.deepEqual(r.storage.calls,[]);
});
test('New front area and PCV meters are derived from the actual panels without counting gaps',()=>{
 const r=setup(),fronts=frontRows(r.parts()),key=fronts[0].material;
 near(r.FC.materialCommon.totalsFromParts(fronts)[key],0.423);
 const edges=r.FC.materialEdgeStore.createEdgeStore({persist:false});
 // The default for Front is all four sides; use the real PCV calculator.
 near(edges.calcEdgeMetersForParts(fronts,r.cab()),5.01);
 assert.equal(fronts.reduce((n,p)=>n+p.qty,0),3);assert.deepEqual(r.storage.calls,[]);
});
test('Group addresses remain small/large across body-height changes and regeneration',()=>{
 const r=setup(),before=frontRows(r.parts()).flatMap(p=>Array.from(p.sourceGroups)).map(g=>{const x=clone(g);delete x.qty;return x;});
 assert.deepEqual(groupTotals(r.parts()),{'front.drawer.small':1,'front.drawer.large':2});generate(r);r.cab().height=90;generate(r);
 const after=frontRows(r.parts()).flatMap(p=>Array.from(p.sourceGroups)).map(g=>{const x=clone(g);delete x.qty;return x;});assert.deepEqual(after,before);
 assert.ok(frontRows(r.parts()).every(p=>p.sourceRefs.length===0));
 for(const p of frontRows(r.parts()))assert.equal(p.sourceGroups.reduce((n,g)=>n+g.qty,0),p.qty);
});
test('Equal-height coincidence aggregates qty:3 while retaining small qty:1 and large qty:2',()=>{
 const r=setup();r.cab().height=96.4;const fronts=frontRows(r.parts());assert.equal(fronts.length,1);assert.equal(fronts[0].qty,3);
 assert.equal(fronts[0].b,28.3);assert.deepEqual(groupTotals(fronts),{'front.drawer.small':1,'front.drawer.large':2});
});
test('Other standard layouts preserve the stored generator rounding and final-panel correction',()=>{
 const r=setup(),expected={'1_big':[700],'2_equal':[350,350],'3_equal':[233,233,234],'5_equal':[140,140,140,140,140]};r.cab().height=80;
 for(const [layout,heightsMm]of Object.entries(expected)){
  r.cab().details.drawerLayout=layout;r.cab().details.drawers=99;const stored=generate(r);
  assert.deepEqual(stored.map(f=>Math.round(f.height*10)),heightsMm);assert.deepEqual(heights(r.parts()),heightsMm);
  assert.equal(r.cab().frontCount,heightsMm.length);assert.equal(r.FC.cabinetDrawerRequirements.getDrawerRequirements('room',r.cab())[0].qty,heightsMm.length);
 }
 r.cab().details.drawerLayout='2_equal';r.cab().height=82.05;
 assert.deepEqual(generate(r).map(f=>Math.round(f.height*10)),[360,361],'Preserve existing final correction for a fractional-mm body');
});
test('The canonical layout, including its default, ignores obsolete details.drawers',()=>{
 const r=setup();for(const value of [1,5,99]){r.cab().details.drawers=value;assert.deepEqual(heights(r.parts()),[139,283,283]);}
 delete r.cab().details.drawerLayout;assert.deepEqual(heights(r.parts()),[139,283,283]);
});
test('Too-small bodies reject generation before deleting existing fronts or changing counts',()=>{
 const r=setup();generate(r);const previous=JSON.stringify(r.s.projectData.room.fronts),count=r.cab().frontCount;
 for(const body of [580,581]){
  r.cab().height=body/10+10;const result=r.FC.cabinetCutlist.resolveDrawerFrontGeometry(r.cab(),'room');assert.equal(result.ok,false);assert.equal(result.code,'body_too_short');assert.equal(result.panels.length,0);
  assert.throws(()=>r.FC.cabinetFronts.generateFrontsForCabinet('room',r.cab()),error=>error.code==='INVALID_DRAWER_FRONT_GEOMETRY');assert.equal(JSON.stringify(r.s.projectData.room.fronts),previous);assert.equal(r.cab().frontCount,count);
 }
});
test('Invalid geometry cannot fall back to missing fronts in MATERIAL, ROZRYS, WYCENA or stale cache',()=>{
 const r=setup();r.s.projectData.room.cabinets=[r.cab()];r.FC.materialTabData.collectRoomMaterials('room');r.cab().height=60;
 for(const read of [()=>r.parts(),()=>r.FC.cabinetDerivedFacts.getCutlist('room',r.cab(),{recalculate:false}),()=>r.FC.materialTabData.collectRoomMaterials('room'),()=>r.aggregate(['room']),()=>r.FC.wycenaCoreSource.getSelectedAggregate({selectedRooms:['room']})]){
  assert.throws(read,error=>error.code==='INVALID_DRAWER_FRONT_GEOMETRY');
 }
 assert.deepEqual(r.storage.calls,[]);
});
test('Modal save blocks invalid body geometry before begin, project mutation, persistence or closing',()=>{
 const r=setup(),draft=clone(r.cab());draft.height=60;const before=JSON.stringify(r.s.projectData);let begins=0,saves=0,closes=0;const messages=[];
 r.session.begin=()=>{begins++;return true;};r.FC.project.save=()=>{saves++;throw Error('should not save');};
 const ok=r.FC.cabinetModalFinalize.saveRegularCabinetDraft({draft,showCabinetInfo:(title,message)=>messages.push({title,message}),closeCabinetModal:()=>closes++});
 assert.equal(ok,false);assert.equal(begins,0);assert.equal(saves,0);assert.equal(closes,0);assert.equal(JSON.stringify(r.s.projectData),before);assert.equal(draft.height,60);
 assert.equal(messages[0].title,'Nieprawidłowe fronty szuflad');assert.deepEqual(r.storage.calls,[]);
});
test('Room leg-height change invalidates the cache and preserves group ownership',()=>{
 const r=setup();r.s.projectData.room.cabinets=[r.cab()];r.FC.materialTabData.collectRoomMaterials('room');const old=r.cab().derivedFacts.inputHash;
 r.s.projectData.room.settings.legHeight=12;const rows=r.FC.materialTabData.collectRoomMaterials('room').cabinetRows[0].parts;
 assert.deepEqual(heights(rows),[119,283,283]);assert.notEqual(r.cab().derivedFacts.inputHash,old);assert.deepEqual(groupTotals(rows),{'front.drawer.small':1,'front.drawer.large':2});
 assert.deepEqual(r.storage.calls,[]);
});
test('Read paths are pure and preserve other cabinets/rooms plus existing storage',()=>{
 const r=setup(),before=JSON.stringify(r.FC.projectStore.prepareProjectDataForPersistence(r.s.projectData));let begins=0;r.session.begin=()=>{begins++;throw Error('read must not begin');};
 r.parts();r.FC.materialTabData.collectRoomMaterials('room');r.aggregate(['room','other']);r.FC.wycenaCoreSource.getSelectedAggregate({selectedRooms:['room']});
 assert.equal(JSON.stringify(r.FC.projectStore.prepareProjectDataForPersistence(r.s.projectData)),before);assert.equal(begins,0);assert.deepEqual(r.storage.calls,[]);
});
test('Confirmed save persists correct fronts, restart reads them, and owner Cancel preserves another room',()=>{
 const r=setup();assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);assert.equal(r.session.begin(),true);generate(r);
 assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);assert.deepEqual(r.FC.projectStore.getById('A').projectData.room.fronts.map(f=>Math.round(f.height*10)),[139,283,283]);
 const other=JSON.stringify(r.FC.projectStore.getById('A').projectData.other);assert.equal(r.session.cancel(),true);
 assert.equal(r.FC.projectStore.getById('A').projectData.room.fronts.length,0);assert.equal(JSON.stringify(r.FC.projectStore.getById('A').projectData.other),other);
 r.s.projectData=r.FC.project.load();assert.equal(r.s.projectData.room.cabinets[0].subType,'szuflady');assert.deepEqual(heights(r.parts()),[139,283,283]);
});
(async()=>{let failed=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}console.log(`${tests.length-failed}/${tests.length} PASS`);process.exitCode=failed?1:0;})();

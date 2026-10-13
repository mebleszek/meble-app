#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture:sourceFixture}=require('./part-provenance-stability-smoke');
const clone=x=>JSON.parse(JSON.stringify(x)),ROOT=path.resolve(__dirname,'..'),tests=[];
const test=(name,fn)=>tests.push([name,fn]),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const load=(r,file)=>vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),r.s,{filename:file});
const options={pcvMode:'project',projectId:'A'};
const address=(id='one',role='body.side.left',roomId='room',projectId='A')=>({projectId,roomId,cabinetId:id,partRoleId:role});
const group=(id='one',role='body.shelves',roomId='room')=>({projectId:'A',roomId,ownerType:'cabinet',cabinetId:id,groupRoleId:role});
function fixture(){
 const r=sourceFixture();r.s.uiState.roomType='room';
 r.s.materials.push({name:'HDF',materialType:'hdf',price:20,priceUnit:'m2'},{name:'Obrzeże PCV standard',symbol:'PCV-STD',materialType:'obrzeże',price:3,priceUnit:'mb'},
 {name:'PCV pod kolor frontów',symbol:'PCV-FRONT',materialType:'obrzeże',price:5,priceUnit:'mb'});
 for(const item of r.s.materials){if(item.materialType==='laminat'){item.price=100;item.priceUnit='m2';}}
 for(const file of ['js/app/project/project-pcv-overrides.js','js/app/project/project-pcv-resolver.js','js/app/wycena/wycena-core-utils.js',
 'js/app/wycena/wycena-core-catalog.js','js/app/wycena/wycena-core-material-plan.js','js/app/optimizer/cut-optimizer.js','js/app/rozrys/rozrys-engine.js','js/app/rozrys/rozrys-cache.js'])load(r,file);
 r.api=r.FC.projectPcvOverrides;r.calc=(rooms=['room'],extra={})=>r.FC.projectPcvResolver.requireCollection(rooms,{...options,...extra});
 r.roz=(rooms=['room'],extra={})=>r.FC.rozrysScope.aggregatePartsForProject(rooms,{...options,...extra,safeGetProject:()=>r.s.projectData,resolveRozrysPartFromSource:r.FC.materialPartOptions.resolvePartForRozrys});
 r.quote=(rooms=['room'],extra={})=>r.FC.wycenaCoreSource.getSelectedAggregate({selectedRooms:rooms},{...options,...extra});r.storage.calls.length=0;return r;
}
function seed(r,mutate){const record=r.FC.projectStore.getById('A');mutate(record.projectData);assert.ok(r.FC.projectStore.upsert(record));r.s.projectData=r.FC.project.load();r.storage.calls.length=0;}
function update(r,mutate){const next=clone(r.s.projectData);mutate(next);const result=r.FC.project.saveConfirmed(next);assert.equal(result.ok,true);r.s.projectData=result.project;}
const rows=calc=>calc.details.flatMap(d=>d.parts),contributions=parts=>parts.flatMap(p=>p.effectivePcv?p.effectivePcv.contributions:[]);
const aggParts=agg=>agg.materials.flatMap(mat=>agg.groups[mat].allParts);
const select=(rooms=['room'],scope={})=>({selectedRooms:rooms,materialScope:{kind:'all',includeFronts:true,includeCorpus:true,...scope}});
function failCalc(r,code,rooms=['room'],extra={}){const result=r.FC.projectPcvResolver.collect(rooms,{...options,...extra});assert.equal(result.ok,false);if(code)assert.equal(result.code,'PROJECT_PCV_'+code);}
test('Individual left/right sides in Bok x2 contribute independently before aggregation',()=>{
 const r=fixture();assert.equal(r.api.setEdges(address(),{w2:true}).ok,true);
 const sides=rows(r.calc()).filter(p=>p.name==='Bok'&&p.sourceRefs[0].cabinetId==='one');assert.equal(sides.length,2);assert.equal(sides.reduce((n,p)=>n+p.qty,0),2);
 near(sides.find(p=>p.sourceRefs[0].partRoleId.endsWith('left')).effectivePcv.total,1.364);
 near(sides.find(p=>p.sourceRefs[0].partRoleId.endsWith('right')).effectivePcv.total,0.682);near(sides.reduce((n,p)=>n+p.effectivePcv.total,0),2.046);
});
test('Identical cabinets keep independent PCV and aggregate without double counting',()=>{
 const r=fixture();assert.equal(r.api.setEdges(address(),{w2:true}).ok,true);
 const result=r.calc();near(result.edgeMeters,17.122);
 const left=contributions(rows(result)).filter(c=>c.address.partRoleId==='body.side.left');assert.equal(left.length,2);near(left.find(c=>c.address.cabinetId==='one').meters,1.364);near(left.find(c=>c.address.cabinetId==='two').meters,0.682);
 const agg=r.roz();near(agg.edgeMeters,result.edgeMeters);near(contributions(aggParts(agg)).reduce((n,c)=>n+c.meters,0),result.edgeMeters);
});
test('Two rooms and combined scope sum the exact selected contributions',()=>{
 const r=fixture();assert.equal(r.api.setEdges(address(),{w2:true}).ok,true);
 near(r.calc(['room']).edgeMeters,17.122);near(r.calc(['other']).edgeMeters,8.22);near(r.calc(['room','other']).edgeMeters,25.342);
 const owner=r.session.roomId;r.calc(['other','room']);assert.equal(r.session.roomId,owner);
});
test('Two physical projects never share PCV, even with identical cabinet IDs',()=>{
 const r=fixture();assert.equal(r.api.setEdges(address(),{w2:true}).ok,true);assert.equal(r.session.commit(),true);
 r.FC.investors.setCurrentId('inv-B');r.FC.projectStore.setCurrentProjectId('B');r.s.projectData=r.FC.project.load();
 failCalc(r,'PROJECT_CONTEXT_MISMATCH');near(r.calc(['room'],{projectId:'B'}).edgeMeters,8.22);
 assert.equal(r.api.setEdges(address('one','body.side.left','room','B'),{h1:true}).ok,true);near(r.calc(['room'],{projectId:'B'}).edgeMeters,8.72);
 assert.equal(r.session.commit(),true);r.FC.investors.setCurrentId('inv-A');r.FC.projectStore.setCurrentProjectId('A');r.s.projectData=r.FC.project.load();near(r.calc().edgeMeters,17.122);
});
test('Shelves x3 and x5 multiply a stable group exactly once',()=>{
 const r=fixture();seed(r,p=>p.room.cabinets[0].details.shelves=3);assert.equal(r.api.setEdges(group(),{w2:true}).ok,true);
 const shelf=()=>contributions(rows(r.calc())).filter(c=>c.address.cabinetId==='one'&&c.address.groupRoleId==='body.shelves');near(shelf().reduce((n,c)=>n+c.meters,0),3.384);assert.equal(shelf().reduce((n,c)=>n+c.qty,0),3);
 update(r,p=>p.room.cabinets[0].details.shelves=5);near(shelf().reduce((n,c)=>n+c.meters,0),5.64);assert.equal(shelf().reduce((n,c)=>n+c.qty,0),5);
});
function drawers(r){seed(r,p=>{p.room.cabinets=[p.room.cabinets[0]];const c=p.room.cabinets[0];c.height=82;c.subType='szuflady';c.details={drawerLayout:'3_1_2_2'};});}
test('Small and large fronts have distinct PCV with large qty2',()=>{
 const r=fixture();drawers(r);assert.equal(r.api.setEdges(group('one','front.drawer.small'),{w1:false}).ok,true);assert.equal(r.api.setEdges(group('one','front.drawer.large'),{w2:false}).ok,true);
 const calc=r.calc(['room'],{materialScope:{includeCorpus:false}});near(calc.edgeMeters,3.21);
 const list=contributions(rows(calc));near(list.filter(c=>c.address.groupRoleId==='front.drawer.small').reduce((n,c)=>n+c.meters,0),0.878);
 near(list.filter(c=>c.address.groupRoleId==='front.drawer.large').reduce((n,c)=>n+c.meters,0),2.332);
 assert.equal(list.reduce((n,c)=>n+c.qty,0),3);
});
test('Equal-sized small/large coincidence still keeps two technological edge groups',()=>{
 const r=fixture();drawers(r);seed(r,p=>p.room.cabinets[0].height=96.4);assert.equal(r.api.setEdges(group('one','front.drawer.small'),{w1:false}).ok,true);
 const fronts=rows(r.calc(['room'],{materialScope:{includeCorpus:false}}));assert.equal(fronts.length,2);assert.equal(fronts.reduce((n,p)=>n+p.qty,0),3);
 assert.deepEqual(clone(fronts.map(p=>p.qty).sort()),[1,2]);
});
test('Set fronts retain setId and their PCV after member reorder',()=>{
 const r=fixture();seed(r,p=>{p.room.cabinets.forEach(c=>c.setId='set');p.room.sets=[{id:'set',presetId:'A',number:1,frontCount:2,params:{w1:30,w2:30,hB:80,hTop:20}}];});
 const addr=rows(r.calc()).flatMap(p=>p.sourceGroups||[]).find(g=>g.ownerType==='set');assert.ok(addr);assert.equal(r.api.setEdges(addr,{w1:false}).ok,true);
 const before=r.calc().edgeMeters;update(r,p=>p.room.cabinets.reverse());near(r.calc().edgeMeters,before);
 const setRows=contributions(rows(r.calc())).filter(c=>c.address.ownerType==='set');assert.ok(setRows.every(c=>c.address.setId==='set'&&!c.address.cabinetId));assert.equal(setRows.reduce((n,c)=>n+c.qty,0),2);
});
test('Defaults match the existing technological policy and return to default recomputes meters',()=>{
 const r=fixture();near(r.calc().edgeMeters,16.44);assert.equal(r.api.setEdges(address(),{w2:true}).ok,true);near(r.calc().edgeMeters,17.122);
 assert.equal(r.api.clearEdges(address()).ok,true);near(r.calc().edgeMeters,16.44);assert.equal(r.session.isDirty(),false);
});
test('PCV-only changes bypass warmed legacy derived facts and old plan cache',()=>{
 const r=fixture();r.FC.cabinetDerivedFacts.getCutlist('room',r.cab());const cached=clone(r.cab().derivedFacts);assert.equal(r.api.setEdges(address(),{w2:true}).ok,true);
 r.cab().derivedFacts=cached;near(r.calc().edgeMeters,17.122);near(r.quote().edgeMeters,17.122);
});
test('MATERIAL, both ROZRYS aggregators and WYCENA share the exact ledger, geometry and quantities',()=>{
 const r=fixture();assert.equal(r.api.setEdges(address(),{w2:true}).ok,true);
 const material=r.FC.materialTabData.collectRoomMaterials('room',options),roz=r.roz(),facts=r.FC.cabinetDerivedFacts.aggregatePartsForRooms(['room'],options),quote=r.quote();
 const fingerprint=list=>contributions(list).map(c=>JSON.stringify(c)).sort();
 assert.deepEqual(fingerprint(material.cabinetRows.flatMap(d=>d.parts)),fingerprint(aggParts(roz)));assert.deepEqual(fingerprint(aggParts(quote)),fingerprint(aggParts(roz)));assert.deepEqual(fingerprint(aggParts(facts)),fingerprint(aggParts(roz)));
 near(material.projectEdgeMeters,17.122);near(quote.edgeMeters,material.projectEdgeMeters);near(facts.edgeMeters,material.projectEdgeMeters);
 for(const p of aggParts(roz))assert.equal(p.sourceRefs.length+p.sourceGroups.reduce((n,g)=>n+g.qty,0),p.qty);
});
test('Standard versus front-color PCV uses the cabinet policy without mixing meters',()=>{
 const r=fixture();seed(r,p=>{p.room.cabinets[0].bodyPcvMode='front';p.room.cabinets[1].bodyPcvMode='body';});
 const result=r.calc();near(result.edgeMetersByMode.body,8.22);near(result.edgeMetersByMode.front,8.22);near(result.edgeMetersByMode.total,16.44);
});
test('WYCENA uses 5.01 raw meters, exactly one 10% allowance, and unchanged current price',async()=>{
 const r=fixture();drawers(r);seed(r,p=>p.room.cabinets[0].bodyPcvMode='front');const selection=select(['room'],{includeCorpus:false});
 const agg=r.quote(),lines=await r.FC.wycenaCoreMaterialPlan.collectMaterialLines(agg,selection,options),line=lines.find(l=>l.edgePricingMode==='front');
 assert.ok(line);near(line.edgeRawMeters,5.01);near(line.qty,5.511);near(line.edgeWasteMeters,0.501);assert.equal(line.edgeWastePercent,10);assert.equal(line.unitPrice,5);near(line.total,27.56);
 r.s.materials.find(m=>m.symbol==='PCV-FRONT').price=7;
 const next=(await r.FC.wycenaCoreMaterialPlan.collectMaterialLines(agg,selection,options)).find(l=>l.edgePricingMode==='front');assert.equal(next.unitPrice,7);near(next.total,38.58);
});
test('WYCENA preserves separate standard and front-price lines, with no duplicate quantity',async()=>{
 const r=fixture();seed(r,p=>p.room.cabinets[0].bodyPcvMode='front');const lines=await r.FC.wycenaCoreMaterialPlan.collectMaterialLines(r.quote(),select(),options);
 const edges=lines.filter(l=>l.priceUnit==='mb');assert.equal(edges.length,2);near(edges.reduce((n,l)=>n+l.edgeRawMeters,0),16.44);
 const body=edges.find(l=>l.edgePricingMode==='body'),front=edges.find(l=>l.edgePricingMode==='front');near(body.qty,9.042);near(front.qty,9.042);assert.equal(body.unitPrice,3);assert.equal(front.unitPrice,5);
});
test('sourceIssues never acquire an arbitrary owner or a plausible project price',async()=>{
 const r=fixture();seed(r,p=>{p.room.cabinets[0].subType='nieznany';});
 // Inject unresolved provenance into a genuine geometric row, not a mock result sum.
 const generator=r.FC.cabinetCutlist.getCabinetCutList;r.FC.cabinetCutlist.getCabinetCutList=(...args)=>generator(...args).map(p=>p.name==='Bok'?{...p,sourceRefs:[],sourceIssues:[{qty:p.qty,reason:'unresolved'}]}:p);
 failCalc(r,'SOURCE_UNRESOLVED');assert.throws(()=>r.quote(),e=>e.projectPcv);assert.throws(()=>r.FC.materialTabData.collectEdgeMetersForRooms(['room'],options),e=>e.projectPcv);
});
test('Quantity imbalance, duplicate individuals and wrong-owner contributions fail closed',()=>{
 for(const issue of ['count','duplicate','owner']){const r=fixture(),generator=r.FC.cabinetCutlist.getCabinetCutList;
  r.FC.cabinetCutlist.getCabinetCutList=(...args)=>generator(...args).map(p=>p.name==='Bok'?{...p,sourceRefs:issue==='count'?p.sourceRefs.slice(0,1):issue==='duplicate'?[p.sourceRefs[0],p.sourceRefs[0]]:p.sourceRefs.map(ref=>({...ref,projectId:'B'}))}:p);
  failCalc(r,issue==='count'?'QUANTITY_MISMATCH':issue==='duplicate'?'ROLE_AMBIGUOUS':'SOURCE_CONTEXT_MISMATCH');
 }
});
test('Wrong project, absent room/cabinet and unsaved RAM cannot produce a project result',()=>{
 const r=fixture();failCalc(r,'PROJECT_CONTEXT_MISMATCH',['room'],{projectId:'B'});failCalc(r,'ROOM_NOT_FOUND',['missing']);
 r.s.projectData.room.cabinets[0].width=65;failCalc(r,'RAM_DIVERGENCE');assert.throws(()=>r.quote(),e=>e.projectPcv);
});
test('Read-only collection, material lines and optimizer cause no storage/begin/RAM/catalog/history mutations',async()=>{
 const r=fixture();r.storage.rows.set('fc_edge_v1','{"preserve":true}');r.storage.rows.set('fc_rozrys_grain_state_v1','{"preserve":true}');r.storage.rows.set('fc_quote_snapshots_v1','history');
 const before=r.rows(),ram=JSON.stringify(r.s.projectData),catalog=JSON.stringify(r.s.materials);let begins=0;const begin=r.session.begin;r.session.begin=(...args)=>{begins++;return begin.apply(r.session,args);};r.storage.calls.length=0;
 const agg=r.quote(['room','other']);await r.FC.wycenaCoreMaterialPlan.collectMaterialLines(agg,select(['room','other']),options);
 r.FC.materialTabData.collectRoomMaterials('room',options);r.roz();r.FC.rozrysEngine.computePlan({unit:'mm',boardW:2800,boardH:2070,kerf:4,edgeTrim:10},aggParts(agg),options);
 assert.equal(begins,0);assert.deepEqual(r.storage.calls,[]);assert.deepEqual(r.rows(),before);assert.equal(JSON.stringify(r.s.projectData),ram);assert.equal(JSON.stringify(r.s.materials),catalog);
});
test('Legacy UI collectors still honor fc_edge_v1 and never silently adopt project overrides',()=>{
 const r=fixture(),sig=r.FC.materialEdgeStore.signatureFromPart(r.parts().find(p=>p.name==='Bok'));
 r.storage.rows.set('fc_edge_v1',JSON.stringify({[sig]:{w1:false,w2:false,h1:false,h2:false}}));
 const legacy=r.FC.materialTabData.collectRoomMaterials('room').projectEdgeMeters;
 assert.equal(r.api.setEdges(address(),{w2:true}).ok,true);near(r.FC.materialTabData.collectRoomMaterials('room').projectEdgeMeters,legacy);near(r.calc().edgeMeters,17.122);
});
test('A stale project aggregate or tampered ledger is refused before WYCENA pricing',async()=>{
 const r=fixture(),old=r.quote();assert.equal(r.api.setEdges(address(),{w2:true}).ok,true);
 await assert.rejects(r.FC.wycenaCoreMaterialPlan.collectMaterialLines(old,select(),options),e=>e.code==='PROJECT_PCV_STALE_AGGREGATE');
 const fresh=r.quote();aggParts(fresh)[0].effectivePcv.contributions[0].meters+=1;
 await assert.rejects(r.FC.wycenaCoreMaterialPlan.collectMaterialLines(fresh,select(),options),e=>e.code==='PROJECT_PCV_METERS_MISMATCH');
});
test('Calculation mode is explicit, cannot mix a legacy aggregate with project prices',async()=>{
 const r=fixture();await assert.rejects(r.FC.wycenaCoreMaterialPlan.collectMaterialLines(r.quote(),select()));
 await assert.rejects(r.FC.wycenaCoreMaterialPlan.collectMaterialLines(r.FC.wycenaCoreSource.getSelectedAggregate(select()),select(),options));
});
test('ROZRYS placements keep different PCV flags on two identically sized sides',()=>{
 const r=fixture();assert.equal(r.api.setEdges(address(),{w2:true}).ok,true);
 const sides=aggParts(r.roz()).filter(p=>p.name==='Bok'),plan=r.FC.rozrysEngine.computePlan({unit:'mm',boardW:2800,boardH:2070,kerf:4,edgeTrim:10,grain:true},sides,{...options,isPartRotationAllowed:()=>false,loadEdgeStore:()=>{throw Error('legacy read forbidden');}});
 const placed=plan.sheets.flatMap(sheet=>sheet.placements);assert.equal(placed.length,4);assert.equal(placed.filter(p=>p.edgeW2).length,1);assert.ok(placed.every(p=>p.edgeW1));
});
test('Existing vertical grain view maps edge axes without changing technological contributions',()=>{
 const r=fixture();assert.equal(r.api.setEdges(address(),{h1:true}).ok,true);
 const p=r.parts().find(p=>p.name==='Bok'),sig=r.FC.materialPartOptions.signatureFromPart(p);r.storage.rows.set('fc_material_part_options_v1',JSON.stringify({[sig]:'vertical'}));
 const sides=aggParts(r.roz()).filter(p=>p.name==='Bok');assert.ok(sides.every(p=>p.grainMode==='vertical'));
 const plan=r.FC.rozrysEngine.computePlan({unit:'mm',boardW:2800,boardH:2070,kerf:4,edgeTrim:10},sides,{...options,isPartRotationAllowed:()=>false});
 assert.equal(plan.sheets.flatMap(s=>s.placements).filter(p=>p.edgeW1).length,1);assert.ok(plan.sheets.flatMap(s=>s.placements).every(p=>p.edgeH1));
 near(contributions(sides).reduce((n,c)=>n+c.meters,0),3.228);
});
test('Project sheet calculation bypasses persisted plan-cache reads and writes',async()=>{
 const r=fixture();r.s.materials.filter(m=>m.materialType==='laminat').forEach(m=>m.priceUnit='sheet');
 r.FC.rozrysCache.loadPlanCache=()=>{throw Error('persistent cache read forbidden');};r.FC.rozrysCache.savePlanCache=()=>{throw Error('persistent cache write forbidden');};
 const agg=r.quote(),lines=await r.FC.wycenaCoreMaterialPlan.collectMaterialLines(agg,select(),options);assert.ok(lines.some(l=>l.priceUnit==='sheet'&&l.qty>0));assert.deepEqual(r.storage.calls,[]);
});
test('ROZRYS refuses stale PCV, omitted project mode and forged physical quantities',()=>{
 const r=fixture(),parts=aggParts(r.roz());assert.equal(r.api.setEdges(address(),{w2:true}).ok,true);
 assert.throws(()=>r.FC.rozrysEngine.computePlan({unit:'mm'},parts,options),e=>e.code==='PROJECT_PCV_METERS_MISMATCH');
 assert.throws(()=>r.FC.rozrysEngine.computePlan({unit:'mm'},aggParts(r.roz())),e=>e.code==='PROJECT_PCV_PLAN_MODE_MISMATCH');
 const same=fixture(),sameParts=aggParts(same.roz());assert.equal(same.api.setEdges(address(),{w1:false,w2:true}).ok,true);
 assert.throws(()=>same.FC.rozrysEngine.computePlan({unit:'mm'},sameParts,options),e=>e.code==='PROJECT_PCV_STALE_EDGES');
 const fresh=aggParts(r.roz());fresh[0].qty+=1;
 assert.throws(()=>r.FC.rozrysEngine.computePlan({unit:'mm'},fresh,options),e=>e.code==='PROJECT_PCV_QUANTITY_MISMATCH');
});
test('Different cabinet PCV pricing policies on one set produce an explicit diagnostic',()=>{
 const r=fixture();seed(r,p=>{p.room.cabinets.forEach(c=>c.setId='set');p.room.cabinets[0].bodyPcvMode='front';p.room.sets=[{id:'set',presetId:'A',frontCount:2,params:{w1:30,w2:30,hB:80,hTop:20}}];});
 failCalc(r,'SET_PCV_MODE_AMBIGUOUS');assert.equal(r.calc(['room'],{materialScope:{includeFronts:false}}).ok,true);
});
test('Unknown material classification is diagnostic; a verified empty room remains legitimately zero',async()=>{
 const r=fixture();seed(r,p=>p.room.cabinets[0].bodyColor='Unclassified board');failCalc(r,'MATERIAL_TYPE_UNRESOLVED');
 seed(r,p=>{p.room.cabinets=[];p.room.fronts=[];});near(r.calc().edgeMeters,0);
 assert.deepEqual(clone(await r.FC.wycenaCoreMaterialPlan.collectMaterialLines(r.quote(),select(),options)),[]);
});
test('Returned project parts and cabinets do not alias RAM or another calculation',()=>{
 const r=fixture(),before=JSON.stringify(r.s.projectData),first=r.calc();first.details[0].cabinet.width=999;
 first.details[0].parts[0].effectivePcv.contributions[0].edges.w1=false;
 const material=r.FC.materialTabData.collectRoomMaterials('room',options);material.cabinets[0].width=999;
 const agg=r.roz();aggParts(agg)[0].effectivePcv.contributions[0].address.cabinetId='bad';
 assert.equal(JSON.stringify(r.s.projectData),before);assert.ok(contributions(rows(r.calc())).every(c=>c.address.cabinetId!=='bad'));
});
test('Optimizer placement keys remain unique for different project parts; incomplete flags are refused',()=>{
 const r=fixture(),parts=aggParts(r.roz());
 const plan=r.FC.rozrysEngine.computePlan({unit:'mm',boardW:2800,boardH:2070,kerf:4,edgeTrim:10},parts,options);
 const placed=plan.sheets.flatMap(s=>s.placements);assert.equal(new Set(placed.map(p=>p.id)).size,placed.length);
 delete parts[0].effectivePcv.edges.h2;
 assert.throws(()=>r.FC.rozrysEngine.computePlan({unit:'mm'},parts,options),e=>e.code==='PROJECT_PCV_INVALID_EDGES');
});
test('Real stock adapter subtracts only used quantities and never packs the same physical part twice',async()=>{
 const r=fixture();assert.equal(r.api.setEdges(address(),{w2:true}).ok,true);
 load(r,'js/app/rozrys/rozrys-sheet-model.js');load(r,'js/app/rozrys/rozrys-stock.js');
 r.FC.magazyn={findForMaterial:()=>[{id:'stock',width:750,height:600,qty:1}]};
 const sides=aggParts(r.roz()).filter(p=>p.name==='Bok'),before=JSON.stringify(sides);
 const result=await r.FC.wycenaCoreMaterialPlan.computePlanForMaterial('laminat White',sides,options);
 assert.equal(result.plan.sheets.flatMap(s=>s.placements).length,4);assert.equal(result.plan.stockContext.usedStockSheets,1);
 assert.equal(JSON.stringify(sides),before);assert.deepEqual(r.storage.calls.filter(c=>c[1].includes('rozrys')),[]);
});
(async()=>{let failures=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name+'\n'+error.stack);}}console.log(`${tests.length-failures}/${tests.length} PASS`);process.exitCode=failures?1:0;})();

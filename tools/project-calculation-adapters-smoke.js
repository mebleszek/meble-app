#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture,load,seed,drawers,select,address,options,aggParts,clone}=require('./effective-project-pcv-smoke');
const {makeMiniDocument}=require('./app-dev-smoke-lib/mini-document');
const ROOT=path.resolve(__dirname,'..'),tests=[];
const test=(name,fn)=>tests.push([name,fn]),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const state={unit:'mm',boardW:2800,boardH:2070,kerf:4,edgeTrim:10,grain:false,heur:'max'};
const placements=plan=>plan.sheets.flatMap(s=>s.placements||[]);
function setup(){
 const r=fixture();r.s.setInterval=setInterval;r.s.clearInterval=clearInterval;r.s.requestAnimationFrame=fn=>setImmediate(fn);r.s.document=makeMiniDocument();
 // Match the browser's dataset attribute reflection for canvas selectors.
 const createElement=r.s.document.createElement;r.s.document.createElement=tag=>{const el=createElement(tag);el.dataset=new Proxy(el.dataset,{set(target,key,value){target[key]=String(value);el.attributes['data-'+key.replace(/[A-Z]/g,char=>'-'+char.toLowerCase())]=String(value);return true;}});return el;};
 for(const file of ['js/app/rozrys/rozrys-engine-bridge.js','js/app/rozrys/rozrys-sheet-model.js','js/app/rozrys/rozrys-stock.js',
 'js/app/rozrys/rozrys-plan-helpers.js','js/app/rozrys/rozrys-runner.js','js/app/rozrys/rozrys-summary.js'])load(r,file);
 r.FC.rozrys.aggregatePartsForProject=(rooms,opts)=>r.roz(rooms,opts);
 r.bridge=r.FC.rozrysEngineBridge.createApi({FC:r.FC,loadEdgeStore:()=>{throw Error('global edges read');},partSignature:r.FC.materialPartOptions.signatureFromPart,isPartRotationAllowed:()=>false});
 r.helpers=r.FC.rozrysPlanHelpers.createApi({FC:r.FC,calculationOptions:options,computePlan:r.bridge.computePlan,computePlanPanelProAsync:r.bridge.computePlanPanelProAsync,isPartRotationAllowed:()=>false});
 return r;
}
// Only worker transport is simulated. It executes the real worker, imported speed/optimizer modules and message protocol.
function worker(r,hook){
 r.s.Worker=class{
  constructor(){this.events={};this.dead=false;const box={console,Date,Math,JSON,performance:{now:()=>Date.now()}};box.self=box;box.postMessage=data=>{if(!this.dead)(this.events.message||[]).forEach(fn=>fn({data}));};
   this.box=vm.createContext(box);box.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(path.join(ROOT,'js/app/optimizer',path.basename(file.split('?')[0])),'utf8'),this.box));
   vm.runInContext(fs.readFileSync(path.join(ROOT,'js/app/optimizer/panel-pro-worker.js'),'utf8'),this.box);
  }
  addEventListener(k,fn){(this.events[k]??=[]).push(fn);}
  removeEventListener(k,fn){this.events[k]=(this.events[k]||[]).filter(x=>x!==fn);}
  terminate(){this.dead=true;}
  postMessage(data){setImmediate(()=>{if(this.dead)return;try{if(hook)hook();this.box.onmessage({data});}catch(error){(this.events.error||[]).forEach(fn=>fn(error));}});}
 };
}
function setOverride(r){assert.equal(r.api.setEdges(address(),{w2:true}).ok,true);assert.equal(r.session.commit(),true);}
function verify(plan,parts){const placed=placements(plan);assert.equal(placed.length,parts.reduce((n,p)=>n+p.qty,0));assert.equal(new Set(placed.map(p=>p.id)).size,placed.length);assert.equal(placed.reduce((n,p)=>n+(p.sourceRefs||[]).length+(p.sourceGroups||[]).reduce((s,g)=>s+g.qty,0),0),placed.length);
 near(placed.reduce((n,p)=>n+p.effectivePcv.total,0),parts.reduce((n,p)=>n+p.effectivePcv.total,0));assert.ok(placed.every(p=>p.key&&p.effectivePcv&&p.effectivePcv.projectId==='A'));
 const refs=placed.flatMap(p=>p.sourceRefs);assert.equal(new Set(refs.map(x=>JSON.stringify(x))).size,refs.length);
}
function runner(r,extra={}){
 const agg=r.roz(),rendered=[],out=r.s.document.createElement('div'),progress={startRun:()=>1,isActiveRun:()=>true,beginGlobalTicker(){},setActiveHooks(){},clearActiveHooks(){},setGenBtnMode(){},setStatus(){},formatElapsed:()=>'',progressPercent:()=>0,buildProgressMeta:()=>'',wasCancelRequested:()=>false,finishRun(){},getButtonMode:()=> 'idle'};
 const cfg={...options,agg,progressCtrl:progress,matSelValue:'all',...Object.fromEntries(Object.entries({unitValue:'mm',boardWValue:2800,boardHValue:2070,kerfValue:4,trimValue:10,heurValue:'turbo',directionValue:'start-along'})),out,
 normalizeMaterialScopeForAggregate:x=>x,decodeMaterialScope:()=>({kind:'all',includeCorpus:true,includeFronts:true}),normalizeCutDirection:x=>x,
 loadPlanCache:()=>{throw Error('cache read');},savePlanCache:()=>{throw Error('cache write');},makePlanCacheKey:()=>{throw Error('legacy cache key');},
 materialHasGrain:()=>false,getMaterialGrainEnabled:()=>false,getMaterialGrainExceptions:()=>({}),partSignature:r.FC.materialPartOptions.signatureFromPart,isPartRotationAllowed:()=>false,
 loadEdgeStore:()=>{throw Error('legacy edges');},getRealHalfStockForMaterial:r.helpers.getRealHalfStockForMaterial,getExactSheetStockForMaterial:r.helpers.getExactSheetStockForMaterial,
 getLargestSheetFormatForMaterial:r.helpers.getLargestSheetFormatForMaterial,buildStockSignatureForMaterial:r.helpers.buildStockSignatureForMaterial,
 speedLabel:()=>'',directionLabel:()=>'',formatHeurLabel:()=>'',getOptimaxProfilePreset:()=>({}),renderLoadingInto:()=>({}),
 computePlan:r.bridge.computePlan,computePlanPanelProAsync:r.bridge.computePlanPanelProAsync,applySheetStockLimit:r.helpers.applySheetStockLimit,
 renderOutput:(plan,meta)=>rendered.push({plan,meta}),buildEntriesForScope:(scope,a)=>a.materials.map(material=>({material,parts:a.groups[material].allParts})),
 getAccordionScopeKey:()=>'',getAccordionPref:()=>({}),createMaterialAccordionSection:()=>({wrap:r.s.document.createElement('div'),body:r.s.document.createElement('div')}),getRozrysScopeMode:()=> 'all',...extra};
 return {out,rendered,cfg,run:()=>r.FC.rozrysRunner.generate(true,cfg)};
}
function quoteSetup(r){
 r.draft={selection:select(),commercial:{versionName:'Test'}};
 // Unrelated commercial/labor/accessory controls are empty; source, PCV, geometry, prices, core, snapshot and storage are real.
 r.FC.wycenaCoreOffer={getOfferDraft:()=>r.draft,collectQuoteRateLines:()=>[],collectCommercialDraft:()=>({versionName:'Test'})};
 r.FC.wycenaCoreLines={collectElementLines:()=>[],collectAccessories:()=>[],collectBuiltInAppliances:()=>[]};r.FC.wycenaCoreLabor={collectCabinetLabor:()=>[]};
 let seq=0;r.FC.utils.uid=()=>`candidate-${++seq}`;
 for(const file of ['js/app/wycena/wycena-core.js','js/app/quote/quote-snapshot.js','js/app/quote/quote-snapshot-scope.js','js/app/quote/quote-snapshot-selection.js','js/app/quote/quote-snapshot-store.js','js/app/wycena/wycena-tab-shell.js'])load(r,file);
 r.calculate=selection=>r.FC.wycenaCore.collectQuoteData({...options,selection:selection||r.draft.selection});r.candidate=async()=>r.FC.quoteSnapshot.buildSnapshot(await r.calculate());
 return r;
}
const change=r=>{assert.equal(r.api.clearEdges(address()).ok,true);assert.equal(r.session.commit(),true);};
const rejected=(fn)=>assert.throws(fn,e=>e.projectPcv===true);
test('R1 sync bridge keeps project keys, independent side flags, sources and avoids global storage',()=>{
 const r=setup();setOverride(r);const parts=aggParts(r.roz()),before=r.rows();r.storage.calls.length=0;
 const plan=r.bridge.computePlan(state,parts,options);verify(plan,parts);assert.equal(placements(plan).filter(p=>p.name==='Bok'&&p.edgeW2).length,1);assert.deepEqual(r.rows(),before);assert.deepEqual(r.storage.calls,[]);
});
test('R1 async bridge uses actual worker with project flags and complete source ledger',async()=>{
 const r=setup();setOverride(r);worker(r);const parts=aggParts(r.roz());
 const plan=await r.bridge.computePlanPanelProAsync(state,parts,()=>{}, {},{speedMode:'turbo',startMode:'start-along'},options);verify(plan,parts);
 assert.equal(placements(plan).filter(p=>p.name==='Bok'&&p.edgeW2).length,1);
});
test('Runner standard engine refreshes aggregate, bypasses cache and renders validated project results',async()=>{
 const r=setup();setOverride(r);let refresh=0;const aggregate=r.FC.rozrys.aggregatePartsForProject;r.FC.rozrys.aggregatePartsForProject=(...args)=>{refresh++;assert.equal(args[1].projectId,'A');return aggregate(...args);};
 const x=runner(r,{engineMode:'sync'});await x.run();assert.equal(refresh,1);assert.ok(x.rendered.length);x.rendered.forEach(({plan,meta})=>{verify(plan,meta.parts);meta.validateCurrent();});assert.deepEqual(r.storage.calls.filter(c=>c[1].includes('rozrys')),[]);
});
test('Runner Optimax transports project PCV through asynchronous real worker',async()=>{
 const r=setup();setOverride(r);worker(r);const x=runner(r);assert.notEqual(await x.run(),false,JSON.stringify(r.messages));assert.ok(x.rendered.length);x.rendered.forEach(({plan,meta})=>verify(plan,meta.parts));
});
test('R2 project validation error never invokes fallback, render or legacy cache',async()=>{
 const r=setup();setOverride(r);let legacy=0;const x=runner(r,{computePlanPanelProAsync:async()=>{throw r.FC.projectPcvResolver.error('STALE_EDGES');},loadEdgeStore:()=>{legacy++;return{};}});
 assert.equal(await x.run(),false);assert.equal(legacy,0);assert.equal(x.rendered.length,0);assert.ok(x.out.textContent.includes('PCV'));assert.ok(r.messages.some(m=>m.title==='ROZRYS wymaga ponowienia'));
});
test('Ordinary worker failure fallback uses project mapper and retains all edge flags',async()=>{
 const r=setup();setOverride(r);const x=runner(r,{computePlanPanelProAsync:async()=>{throw Error('worker transport unavailable');}});assert.notEqual(await x.run(),false,JSON.stringify(r.messages));assert.ok(x.rendered.length);x.rendered.forEach(({plan,meta})=>verify(plan,meta.parts));
 assert.equal(x.rendered.flatMap(x=>placements(x.plan)).filter(p=>p.sourceRefs.some(ref=>ref.partRoleId==='body.side.left')&&p.effectivePcv.edges.w2).length,1,JSON.stringify(x.rendered.flatMap(x=>placements(x.plan)).filter(p=>p.name==='Bok')));
});
test('Worker no-fallback/incomplete result fails closed and is never cached or rendered',async()=>{
 const r=setup();const x=runner(r,{computePlanPanelProAsync:async()=>({sheets:[],workerFailed:true,noSyncFallback:true})});assert.equal(await x.run(),false);assert.equal(x.rendered.length,0);
});
test('PCV revision change while worker runs invalidates completed result',async()=>{
 const r=setup();setOverride(r);let changed=false;worker(r,()=>{if(!changed){changed=true;change(r);}});const x=runner(r);assert.equal(await x.run(),false);assert.equal(x.rendered.length,0);
});
test('Material scope and room selection change invalidate runner result',async()=>{
 const r=setup();setOverride(r);let current=true;worker(r,()=>{current=false;});const x=runner(r,{isScopeCurrent:()=>current});assert.equal(await x.run(),false);assert.equal(x.rendered.length,0);
 const y=runner(setup(),{decodeMaterialScope:()=>({kind:'material',material:'missing'}),normalizeMaterialScopeForAggregate:()=>({kind:'all'})});assert.equal(await y.run(),false);
});
test('Real stock adapter retains planKey, exact remaining quantities and unique sources',async()=>{
 const r=setup();setOverride(r);r.FC.magazyn={findForMaterial:()=>[{id:'stock',width:750,height:600,qty:1}]};const parts=aggParts(r.roz()).filter(p=>p.name==='Bok');
 const plan=r.bridge.computePlan(state,parts,options),stock=await r.helpers.applySheetStockLimit('laminat White',state,parts,plan),final=r.FC.projectPcvResolver.attachPlanProvenance(stock,parts,{...options,complete:true});
 verify(final,parts);assert.equal(stock.stockContext.usedStockSheets,1);assert.equal(placements(final).length,4);assert.ok(placements(final).some(p=>p.supplySource==='stock')||stock.sheets.some(s=>s.supplySource==='stock'));
});
test('Partial group ledger slices account for every shelf once without aliasing',()=>{
 const r=setup();seed(r,p=>p.room.cabinets[0].details.shelves=5);const shelf=aggParts(r.roz()).find(p=>p.name==='Półka'),qty=shelf.qty,before=JSON.stringify(shelf);
 const pieces=Array.from({length:qty},(_,skip)=>r.FC.projectPcvResolver.withQuantity({...shelf,qty:1},{skip}));assert.equal(pieces.reduce((n,p)=>n+p.sourceGroups.reduce((s,g)=>s+g.qty,0),0),qty);near(pieces.reduce((n,p)=>n+p.effectivePcv.total,0),shelf.effectivePcv.total);assert.equal(JSON.stringify(shelf),before);
});
test('W1 real quote orchestrator resolves 17.122 raw to 18.834 mb once at original price',async()=>{
 const r=quoteSetup(setup());setOverride(r);const data=await r.calculate(),line=data.materialLines.find(l=>l.edgePricingMode==='body');near(line.edgeRawMeters,17.122);near(line.qty,18.834);assert.equal(line.unitPrice,3);near(line.total,56.5);assert.equal(line.edgeWastePercent,10);
 const snapshot=r.FC.quoteSnapshot.buildSnapshot(data),saved=r.FC.quoteSnapshotStore.save(snapshot);assert.ok(saved.id);assert.equal(saved.pcvMode,undefined);assert.equal(saved.__projectPcvCandidate,undefined);assert.ok(!r.storage.getItem('fc_quote_snapshots_v1').includes('__projectPcvCandidate'));
});
test('Fronts 139/283/283 mm quote uses 5.010 -> 5.511 mb exactly once',async()=>{
 const r=quoteSetup(setup());drawers(r);seed(r,p=>p.room.cabinets[0].bodyPcvMode='front');r.draft.selection=select(['room'],{includeCorpus:false});
 const data=await r.calculate(),line=data.materialLines.find(l=>l.edgePricingMode==='front');near(line.edgeRawMeters,5.01);near(line.qty,5.511);assert.equal(line.unitPrice,5);near(line.total,27.56);assert.ok(r.FC.quoteSnapshotStore.save(r.FC.quoteSnapshot.buildSnapshot(data)));
});
test('A/B/A+B scopes retain correct sums and coexist as independent historical variants',async()=>{
 const r=quoteSetup(setup());setOverride(r);const sums=[17.122,8.22,25.342],scopes=[['room'],['other'],['room','other']];
 for(let i=0;i<scopes.length;i++){r.draft.selection=select(scopes[i]);const data=await r.calculate();near(data.materialLines.filter(l=>l.priceUnit==='mb').reduce((n,l)=>n+l.edgeRawMeters,0),sums[i]);r.FC.quoteSnapshotStore.save(r.FC.quoteSnapshot.buildSnapshot(data));}
 assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,3);
});
test('W2 project PCV change blocks direct save, replace, writeAll and snapshot launcher',async()=>{
 const r=quoteSetup(setup());setOverride(r);const candidate=await r.candidate(),saved=r.FC.quoteSnapshotStore.save(candidate);const second=await r.candidate(),history=r.storage.getItem('fc_quote_snapshots_v1');change(r);
 for(const fn of [()=>r.FC.quoteSnapshotStore.save(second),()=>r.FC.quoteSnapshotStore.replaceSnapshot(saved.id,second),()=>r.FC.quoteSnapshotStore.writeAll([second]),()=>r.FC.quoteSnapshot.saveSnapshot(second)])rejected(fn);
 assert.equal(r.storage.getItem('fc_quote_snapshots_v1'),history);
});
test('Changed project, investor and room/material scope reject new candidate without history writes',async()=>{
 for(const kind of ['scope','material','investor','project','RAM']){const r=quoteSetup(setup()),candidate=await r.candidate(),before=r.storage.getItem('fc_quote_snapshots_v1');
 if(kind==='scope')r.draft.selection=select(['other']);if(kind==='material')r.draft.selection=select(['room'],{includeCorpus:false});
 if(kind==='investor')r.FC.investors.setCurrentId('inv-B');if(kind==='project')r.FC.projectStore.setCurrentProjectId('B');if(kind==='RAM')r.cab().width=999;
 rejected(()=>r.FC.quoteSnapshotStore.save(candidate));assert.equal(r.storage.getItem('fc_quote_snapshots_v1'),before);}
});
test('Missing and forged proofs cannot persist a project candidate',async()=>{
 const r=quoteSetup(setup()),candidate=await r.candidate();delete candidate.__projectPcvCandidate;rejected(()=>r.FC.quoteSnapshotStore.save(candidate));candidate.__projectPcvCandidate='made-up';rejected(()=>r.FC.quoteSnapshotStore.replaceSnapshot('x',candidate));
});
test('Change between asynchronous calculation and candidate construction is rejected',async()=>{
 const r=quoteSetup(setup());setOverride(r);const data=await r.calculate();change(r);rejected(()=>r.FC.quoteSnapshot.buildSnapshot(data));
});
test('Change during material calculation does not produce a usable candidate',async()=>{
 const r=quoteSetup(setup());setOverride(r);const collect=r.FC.wycenaCoreMaterialPlan.collectMaterialLines;r.FC.wycenaCoreMaterialPlan.collectMaterialLines=async(...args)=>{const result=await collect(...args);change(r);return result;};
 await assert.rejects(r.calculate(),e=>e.projectPcv||e.code==='calculation_context_changed');assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,0);
});
function shellDeps(r){const state={};return {getState:()=>state,setState:patch=>Object.assign(state,patch),render(){},getOfferDraft:()=>r.draft,normalizeDraftSelection:d=>d.selection,
 ensureVersionNameBeforeGenerate:async()=>({cancelled:false}),getSnapshotId:s=>s.id,syncGeneratedQuoteStatus(){},getProjectStatusForHistory:()=>'',getSnapshotHistory:()=>r.FC.quoteSnapshotStore.listForProject('A'),state};}
test('Real duplicate dialog waiting for replace cannot persist candidate after PCV change',async()=>{
 const r=quoteSetup(setup());setOverride(r);r.FC.quoteSnapshotStore.save(await r.candidate());const history=r.storage.getItem('fc_quote_snapshots_v1'),deps=shellDeps(r);let shown=0;
 r.FC.choiceBox={ask:async()=>{shown++;await new Promise(resolve=>setImmediate(resolve));change(r);return'replace';}};
 await r.FC.wycenaTabShell.generateQuote({},deps,{...options,source:'project-duplicate'});assert.equal(shown,1);assert.equal(r.storage.getItem('fc_quote_snapshots_v1'),history);assert.ok(deps.state.lastQuote.error);assert.equal(deps.state.isBusy,false);
});
test('Actual quote shell supports valid project generation and valid duplicate replacement',async()=>{
 const r=quoteSetup(setup());setOverride(r);const deps=shellDeps(r);await r.FC.wycenaTabShell.generateQuote({},deps,{...options,source:'fresh'});assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,1);assert.ok(!deps.state.lastQuote.error);
 r.FC.wycenaTabShell._generateRuntime.lastAcceptedAt=0;r.FC.choiceBox={ask:async()=> 'replace'};await r.FC.wycenaTabShell.generateQuote({},deps,{...options,source:'replace'});assert.equal(r.FC.quoteSnapshotStore.listForProject('A').length,1);assert.ok(!deps.state.lastQuote.error);
});
test('Historical offers remain readable and unchanged after source revision without any proof',async()=>{
 const r=quoteSetup(setup());setOverride(r);const saved=r.FC.quoteSnapshotStore.save(await r.candidate()),history=r.storage.getItem('fc_quote_snapshots_v1');change(r);
 const stored=r.FC.quoteSnapshotStore.getById(saved.id);assert.equal(stored.__projectPcvCandidate,undefined);near(stored.lines.materials.find(l=>l.name.includes('PCV')).qty,18.834);assert.equal(r.storage.getItem('fc_quote_snapshots_v1'),history);assert.equal(JSON.stringify(r.FC.quoteSnapshotStore.getById(saved.id)),JSON.stringify(stored));
});
test('Project calculations preserve session, catalog, global settings and legacy behavior',async()=>{
 const r=quoteSetup(setup());const sig=r.FC.materialEdgeStore.signatureFromPart(r.parts().find(p=>p.name==='Bok'));r.storage.rows.set('fc_edge_v1',JSON.stringify({[sig]:{w1:false,w2:false,h1:false,h2:false}}));
 const legacy=(await r.FC.wycenaCore.collectQuoteData({selection:select()})).materialLines.find(l=>l.edgePricingMode==='body').qty;
 const before=r.rows();r.storage.calls.length=0;let begins=0;const begin=r.session.begin;r.session.begin=(...args)=>{begins++;return begin.apply(r.session,args);};await r.calculate();
 assert.deepEqual(r.rows(),before);assert.deepEqual(r.storage.calls,[]);assert.equal(begins,0);assert.equal((await r.FC.wycenaCore.collectQuoteData({selection:select()})).materialLines.find(l=>l.edgePricingMode==='body').qty,legacy);
});
test('Render and production CSV preserve independent keys, flags, quantities and cutting dimensions',()=>{
 const r=setup();setOverride(r);for(const file of ['js/app/rozrys/rozrys-validation.js','js/app/rozrys/rozrys-print.js','js/app/rozrys/rozrys-render.js'])load(r,file);
 r.s.Node=r.s.document.createElement('div').constructor;
 const parts=aggParts(r.roz()).filter(p=>p.name==='Bok'),plan=r.bridge.computePlan(state,parts,options),material=parts[0].material;
 const diag=r.FC.rozrysSummary.buildRozrysDiagnostics(material,'both',parts,plan,['room'],{buildRawSnapshotForMaterial:()=>{throw Error('legacy snapshot forbidden');}});
 assert.equal(diag.validation.ok,true);assert.equal(diag.rawQtyTotal,4);assert.equal(diag.actualRows.reduce((n,p)=>n+p.qty,0),4);
 const out=r.s.document.createElement('div'),drawn=[];
 r.FC.rozrysRender.renderOutput(plan,{material,unit:'mm',parts,selectedRooms:['room'],edgeSubMm:1,validateCurrent:()=>r.FC.projectPcvResolver.validatePlanParts(parts,options)},
 {target:out,drawSheet:(canvas,sheet)=>drawn.push(sheet),cutOptimizer:r.FC.cutOptimizer,mmToUnitStr:String});
 assert.equal(drawn.length,plan.sheets.length);assert.equal(out.querySelectorAll('canvas').length,plan.sheets.length);assert.ok(out.querySelectorAll('canvas').every(c=>c.__rozrysDrawPayload.sheet.placements.every(p=>p.effectivePcv)));
 const csv=r.FC.rozrysPrint.buildCsv(plan.sheets,{material,edgeSubMm:1}).split('\n').slice(1).map(row=>row.split(';'));
 const placed=placements(plan);assert.equal(csv.length,4);csv.forEach((row,i)=>{assert.equal(+row[5],placed[i].w-(+placed[i].edgeH1 + +placed[i].edgeH2));assert.equal(+row[6],placed[i].h-(+placed[i].edgeW1 + +placed[i].edgeW2));});
 change(r);rejected(()=>r.FC.rozrysRender.renderOutput(plan,{material,unit:'mm',parts,validateCurrent:()=>r.FC.projectPcvResolver.validatePlanParts(parts,options)},{target:out}));
 assert.equal(r.FC.rozrysRender.tryAutoRenderFromCache({agg:r.roz(),loadPlanCache:()=>{throw Error('cache read');}}),false);
});
test('Runner stock recalculation in both engine paths retains all sources',async()=>{
 for(const engineMode of ['sync','worker']){const r=setup();setOverride(r);worker(r);r.FC.magazyn={findForMaterial:()=>[{id:'stock',width:750,height:600,qty:1}]};
 const x=runner(r,{engineMode});assert.notEqual(await x.run(),false,JSON.stringify(r.messages));assert.ok(x.rendered.length);x.rendered.forEach(({plan,meta})=>verify(plan,meta.parts));assert.ok(x.rendered.some(({plan})=>plan.stockContext.usedStockSheets>0));}
});
test('Actual run controller passes project context, material scope and refreshed room selection',async()=>{
 const r=setup();setOverride(r);load(r,'js/app/rozrys/rozrys-run-controller.js');
 const x=runner(r,{engineMode:'sync'}),controls={matSel:{value:'all'},unitSel:{value:'mm'},inW:{value:2800},inH:{value:2070},inK:{value:4},inTrim:{value:10},heurSel:{value:'turbo'},dirSel:{value:'start-along'}};
 const controller=r.FC.rozrysRunController.createApi().createController({...controls,out:x.out,getAggregate:()=>r.roz(),calculationOptions:{...options,engineMode:'sync'}},
 {...x.cfg,createProgressApi:()=>({controller:x.cfg.progressCtrl})});
 await controller.generate(true);assert.ok(x.rendered.length);x.rendered.forEach(({plan,meta})=>verify(plan,meta.parts));
});
test('Public explicit render loads real lazy adapters and generates project placements from DOM action',async()=>{
 const r=setup();setOverride(r);r.s.Node=r.s.document.createElement('div').constructor;
 for(const file of ['js/app/rozrys/rozrys-project-source.js','js/app/rozrys/rozrys-prefs.js','js/app/rozrys/rozrys-validation.js','js/app/rozrys/rozrys-render.js','js/app/rozrys/rozrys-lazy-manifest.js'])load(r,file);
 const changed=['rozrys-runner','rozrys-plan-helpers','rozrys-engine-bridge','rozrys-render-compose','rozrys-run-controller','rozrys'];
 for(const item of r.FC.rozrysLazyManifest.scripts){if(changed.some(name=>item.startsWith('js/app/rozrys/'+name+'.js?')))assert.ok(item.endsWith('v=20261013_c2_1b2c2'));load(r,item.split('?')[0]);}
 const root=r.s.document.createElement('div');root.id='rozrysRoot';r.s.document.body.appendChild(root);
 r.storage.calls.length=0;let forbiddenReads=0;r.storage.onRead=key=>{if(key==='fc_edge_v1'||key==='fc_rozrys_plan_cache_v2')forbiddenReads++;};
 r.FC.rozrys.render({...options,engineMode:'sync'});let run=null;const generate=r.FC.rozrysRunner.generate;r.FC.rozrysRunner.generate=(...args)=>{run=generate(...args);return run;};
 const button=root.querySelector('.rozrys-action-btn--generate');assert.ok(button);button.click();assert.ok(run);assert.notEqual(await run,false);
 const canvases=root.querySelectorAll('canvas[data-rozrys-sheet="1"]');assert.ok(canvases.length,root.textContent+JSON.stringify(r.messages));const placed=canvases.flatMap(c=>c.__rozrysDrawPayload.sheet.placements);
 assert.ok(placed.every(p=>p.effectivePcv.projectId==='A'));assert.equal(placed.filter(p=>p.name==='Bok'&&p.effectivePcv.edges.w2).length,1);
 assert.ok(!r.storage.calls.some(call=>['fc_edge_v1','fc_projects_v1','fc_rozrys_plan_cache_v2'].includes(call[1])));assert.equal(forbiddenReads,0);
});
(async()=>{let failed=0;for(const[name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}}console.log(`${tests.length-failed}/${tests.length} PASS`);process.exitCode=failed?1:0;})();

'use strict';
// Regressions for the owner's real pricing defects, using the production collectors.
const assert=require('node:assert/strict'),{fixture}=require('./wycena-labor-norms-smoke'),{setup}=require('./labor-work-plan-smoke');
const clone=v=>JSON.parse(JSON.stringify(v)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const tests=[],test=(name,fn)=>tests.push([name,fn]);
test('carrying respects the actual edited rate, formula, preparation, quantity source, zero, multiplier and conditions',()=>{
 const r=fixture();r.load('js/app/pricing/carrying-logistics.js');
 const investor={carrying:{floorNumber:0,elevatorStatus:'no'}};
 r.FC.investorPersistence={getCurrentInvestorId:()=> 'owner',getInvestorById:()=>investor};
 const def=r.rates().find(d=>d.id==='labor_carrying_cabinet');
 const lines=()=>r.FC.wycenaCoreLabor.collectCarryingLines(['kuchnia']).flatMap(row=>row.details).filter(row=>row.sourceRole==='carrying-labor');
 let row=lines()[0];assert.equal(row.quantity,1);near(row.hours*60,15);near(row.total,62.5);assert.equal(row.rateType,'assembly');
 def.rateType='helper';row=lines()[0];near(row.hourlyRate,80);near(row.total,20);
 Object.assign(def,{startQty:2,stepEveryQty:3,defaultMultiplier:3});investor.carrying.floorNumber=4;
 row=lines()[0];near(row.hours*60,60);near(row.total,80); // 5 levels: (15 + ceil((5-2)/3)*5)*3.
 def.conditions=[{source:'cabinet.width_mm',operator:'range',min:9999,max:null}];assert.equal(lines().length,0);
 def.conditions=[];def.startHours=0;def.stepHours=0;near(lines().reduce((s,row)=>s+row.hours,0),0);near(lines().reduce((s,row)=>s+row.total,0),0);
 Object.assign(def,{startHours:.25,stepHours:1/12,defaultMultiplier:0});near(lines().reduce((s,row)=>s+row.hours,0),0);near(lines().reduce((s,row)=>s+row.total,0),0);
 Object.assign(def,{defaultMultiplier:1,quantitySource:'cabinet.count',startQty:1});row=lines()[0];assert.equal(row.quantity,1);near(row.hours*60,15);
 def.active=false;assert.equal(lines().length,0);
});
test('default ground floor applies only to NEW investor drafts; zero survives and old unknown floors stay unchanged',()=>{
 const r=fixture();r.load('js/app/investor/investor-carrying.js');r.load('js/app/investor/investor-editor-state.js');
 assert.equal(r.FC.investorCarrying.normalizeCarrying({floorNumber:0}).floorNumber,'0');
 assert.equal(r.FC.investorEditorState.buildDraft(null).carrying.floorNumber,'0');
 const old={id:'historical',carrying:{floorNumber:''}},bytes=JSON.stringify(old);
 assert.equal(r.FC.investorEditorState.buildDraft(old).carrying.floorNumber,'');assert.equal(JSON.stringify(old),bytes);
});
test('editable minimum/elevator levels and disassembly weight are facts, not independent pricing formulas',()=>{
 const r=fixture();r.load('js/app/pricing/carrying-logistics.js');
 const def=r.rates().find(d=>d.id==='labor_carrying_cabinet'),dis=r.rates().find(d=>d.id==='labor_carrying_disassembly'),api=r.FC.carryingLogistics;
 assert.equal(api.floorUnits({floorNumber:0},true),1);assert.equal(api.floorUnits({floorNumber:5},true),2);
 def.minimumLevels=3;def.liftLevels=4;assert.equal(api.floorUnits({floorNumber:0},true),3);assert.equal(api.floorUnits({floorNumber:5},true),4);
 const investor={carrying:{floorNumber:3,elevatorStatus:'no'}};
 dis.disassemblyWeightKg=0;let ev=api.evaluateCabinet('kuchnia',r.cab,investor);assert.equal(ev.requiresDisassembly,true);assert.equal(ev.carryingItemCount,1);
 dis.disassemblyWeightKg=9999;ev=api.evaluateCabinet('kuchnia',r.cab,investor);assert.equal(ev.requiresDisassembly,false);
});
test('every day has its own break threshold; inclusive four-hour boundary, last short day, commute and no daily recursion',()=>{
 const r=setup();
 function run(minutes,extra={}){const c=r.collections();c.labor=[{hours:minutes/60,total:minutes/60*250,rateType:extra.stage||'assembly'}];const p=r.run(c,['A'],{...extra,transport:extra.transport||{durationMin:5,transport:{durationMin:5}}});return {c,p};}
 let x=run(230);assert.equal(x.c.quoteRates.some(row=>row.id==='labor_daily_break'),false);near(x.p.schedule.assembly.totalMinutes,240);
 x=run(230.001);near(x.c.quoteRates.find(row=>row.id==='labor_daily_break').hours,.5);near(x.p.schedule.assembly.totalMinutes,270.001);
 x=run(450);assert.equal(x.p.schedule.trips,2);assert.equal(x.c.quoteRates.find(row=>row.id==='labor_daily_break').occurrences,1);near(x.p.schedule.assembly.totalMinutes,500);near(x.p.schedule.assembly.dayGroups[1].workMinutes,10);
 for(const stage of ['assembly','workshop']){x=run(60,{stage});assert.equal(x.c.quoteRates.some(row=>row.id==='labor_daily_break'),false);}
 x=run(15,{transport:{durationMin:120,transport:{durationMin:120}}});assert.equal(x.c.quoteRates.find(row=>row.id==='labor_daily_break').occurrences,1);
 x=run(0,{transport:{durationMin:120,transport:{durationMin:120}}});assert.equal(x.p.schedule.trips,0);assert.equal(x.c.quoteRates.length,0);
});
test('unbilled break reserves identical time and days; editable duration/threshold/day, free rate and third helper remain independent',()=>{
 const r=setup(),br=r.catalog.find(row=>row.id==='labor_daily_break');
 function run(billBreaks=true){const c=r.collections();c.labor=[{hours:8,total:1200,rateType:'workshop'}];return {c,p:r.run(c,['A'],{billBreaks})};}
 const charged=run(),free=run(false);assert.deepEqual(clone(charged.p.schedule.workshop),clone(free.p.schedule.workshop));near(free.c.quoteRates.find(row=>row.id===br.id).hours,.5);near(free.c.quoteRates.find(row=>row.id===br.id).total,0);near(charged.c.quoteRates.find(row=>row.id===br.id).total,75);
 Object.assign(br,{timeBlockHours:20/60,breakAfterHours:2,workdayHours:6});const changed=run();near(changed.p.schedule.dayMinutes,360);near(changed.p.schedule.workshop.availableMinutes,340);near(changed.c.quoteRates.find(row=>row.id===br.id).hours,2/3);near(changed.c.quoteRates.find(row=>row.id===br.id).total,100);
 r.catalog.find(row=>row.id==='labor_rate_workshop').price=0;near(run().c.quoteRates.find(row=>row.id===br.id).total,0);
 br.workdayHours=0;assert.throws(()=>run(),{code:'SCHEDULE_NONPOSITIVE_CAPACITY'});
});
test('travel time uses the shared edited formula, multiplier, conditions and zero without changing the catalog',()=>{
 const r=fixture();r.load('js/app/wycena/wycena-core-offer.js');r.FC.quoteOfferStore={getCurrentDraft:()=>({selection:{selectedRooms:['kuchnia']}})};
 r.FC.investorTransport={getCurrentTransportContext:()=>({durationMin:60,durationHours:1,billableKm:4})};
 const def=r.rates().find(row=>row.id==='transport_travel_time');Object.assign(def,{timeBlockHours:.5,defaultMultiplier:3});
 const lines=()=>r.FC.wycenaCoreOffer.collectQuoteRateLines().filter(row=>row.sourceRole==='transport-travel-time');
 let row=lines()[0];near(row.hours,1.5);near(row.total,375);assert.equal(row.timeBlockHours,.5);assert.equal(row.multiplier,3);
 def.timeBlockHours=0;near(lines()[0].total,0);def.timeBlockHours=.5;def.defaultMultiplier=0;near(lines()[0].total,0);
 def.defaultMultiplier=1;def.conditions=[{source:'cabinet.width_mm',operator:'range',min:9999,max:null}];assert.equal(lines().length,0);
});
test('fuel binding is identical in catalog description and calculation; explicit manual zero is never replaced',()=>{
 const r=fixture();r.load('js/app/settings/company-profile-store.js');const profile=r.FC.companyProfile.normalizeProfile({});r.FC.companyProfile.read=()=>profile;
 const def=r.rates().find(row=>row.id==='transport_distance_km');near(r.FC.laborCatalog.effectiveUnitPrice(def),1.4);near(r.FC.laborCatalog.calculateDefinition(def,{quantity:4}).total,5.6);
 assert.match(r.FC.laborCatalog.describeDefinition(def),/1.40 PLN/);profile.transport.vehicleCostMultiplier=3;near(r.FC.laborCatalog.calculateDefinition(def,{quantity:4}).total,8.4);assert.match(r.FC.laborCatalog.describeDefinition(def),/2.10 PLN/);
 Object.assign(def,{unitPriceSource:'manual',price:0});near(r.FC.laborCatalog.calculateDefinition(def,{quantity:4}).total,0);Object.assign(def,{price:7.125,startPrice:20,includedQty:2});near(r.FC.laborCatalog.calculateDefinition(def,{quantity:4}).total,34.25);
});
test('body and front PCV each use their own visible waste percentage, including zero, with exact material prices',async()=>{
 const r=fixture(),items=[{id:'body-edge',name:'Obrzeże PCV standard',symbol:'PCV-STD',priceUnit:'mb',price:3.125,edgeWastePercent:0},{id:'front-edge',name:'PCV pod kolor frontów',symbol:'PCV-FRONT',priceUnit:'mb',price:5.125,edgeWastePercent:25}];
 r.FC.catalogSelectors.getSheetMaterials=()=>items;r.FC.wycenaCoreSource.getScopedMaterials=()=>[];r.FC.wycenaCoreSelection.decodeMaterialScope=()=>({});
 r.FC.materialTabData={collectEdgeMetersForRooms:()=>({edgeMetersByMode:{body:10,front:20}})};r.load('js/app/wycena/wycena-core-material-plan.js');
 const before=JSON.stringify(items),rows=await r.FC.wycenaCoreMaterialPlan.collectMaterialLines({selectedRooms:['kuchnia']},{});
 assert.equal(rows.length,2);const body=rows.find(row=>row.edgePricingMode==='body'),front=rows.find(row=>row.edgePricingMode==='front');
 near(body.qty,10);near(body.edgeWastePercent,0);near(body.total,31.25);near(front.qty,25);near(front.total,128.13);near(front.edgeWastePercent,25);assert.match(front.calculation,/25%/);assert.equal(JSON.stringify(items),before);
 delete items[0].edgeWastePercent;const legacy=await r.FC.wycenaCoreMaterialPlan.collectMaterialLines({selectedRooms:['kuchnia']},{});near(legacy[0].qty,11);near(legacy[0].edgeWastePercent,10);assert.equal(Object.hasOwn(items[0],'edgeWastePercent'),false,'reading does not migrate material rows');
});
test('legacy AGD uses its full matched catalog rule and keeps exact fractional minutes before final currency rounding',()=>{
 const r=fixture(),def=r.rates().find(row=>row.id==='oven_mount');
 Object.assign(def,{quantitySource:'cabinet.count',pricingMode:'timeStartStep',quantityMode:'startStep',startQty:0,startHours:1/60,stepEveryQty:1,stepHours:1/60,defaultMultiplier:1.5});
 r.cab.subType='piekarnikowa';r.FC.wycenaCoreCatalog.servicePriceLookup=()=>def;
 let rows=r.FC.wycenaCoreLines.collectBuiltInAppliances(['kuchnia']);assert.equal(rows.length,1);near(rows[0].hours,.05);near(rows[0].total,12.5);assert.equal(rows[0].multiplier,1.5);
 def.defaultMultiplier=1;rows=r.FC.wycenaCoreLines.collectBuiltInAppliances(['kuchnia']);near(rows[0].hours,2/60);near(rows[0].total,250/30);assert.match(rows[0].calculation,/według formuły cennika/);
 def.conditions=[{source:'cabinet.width_mm',operator:'range',min:9999,max:null}];assert.equal(r.FC.wycenaCoreLines.collectBuiltInAppliances(['kuchnia']).length,0);
 def.conditions=[];def.quantitySource='shelf.count';r.cab.details.shelves=0;assert.equal(r.FC.wycenaCoreLines.collectBuiltInAppliances(['kuchnia']).length,0,'a zero source does not become one appliance or trigger fallback');
});
test('offer normalization and snapshots keep the break billing choice, do not rewrite historical schedules or amounts',()=>{
 const r=fixture();r.load('js/app/quote/quote-offer-store.js');r.load('js/app/quote/quote-snapshot.js');r.load('js/app/quote/quote-snapshot-scope.js');r.load('js/app/quote/quote-snapshot-selection.js');r.load('js/app/quote/quote-snapshot-store.js');
 assert.equal(r.FC.quoteOfferStore.normalizeCommercial({}).billBreaks,true);assert.equal(r.FC.quoteOfferStore.normalizeCommercial({billBreaks:false}).billBreaks,false);
 const current={id:'choice',commercial:{billBreaks:false},schedule:{version:3,billBreaks:false,workshop:{days:1,totalMinutes:480}},lines:{quoteRates:[{hours:.5,total:0,billed:false}]}};
 const stored=r.FC.quoteSnapshotStore.normalizeSnapshot(current);assert.equal(stored.commercial.billBreaks,false);assert.equal(stored.schedule.billBreaks,false);near(stored.lines.quoteRates[0].total,0);
 const archived={id:'old',commercial:{},schedule:{version:2,dayMinutes:480},lines:{quoteRates:[{hours:.5,total:75}]}};
 const bytes=JSON.stringify(archived);r.FC.quoteSnapshotStore.normalizeSnapshot(archived);assert.equal(JSON.stringify(archived),bytes);assert.equal(Object.hasOwn(r.FC.quoteSnapshotStore.normalizeSnapshot(archived).commercial,'billBreaks'),false);
});
test('selective factory correction changes only exact untouched historical factory rows, is idempotent and preserves custom rules/offers',()=>{
 const r=fixture(),vm=require('node:vm'),cp=require('node:child_process'),old={};old.window=old;vm.createContext(old);vm.runInContext(cp.execFileSync('git',['show','f29e8d3797108068130cfb73c3393a066e050c43:js/app/pricing/labor-catalog-definitions.js'],{encoding:'utf8'}),old);
 const previous=old.FC.laborCatalogDefinitions.DEFAULT_LABOR_DEFINITIONS.filter(row=>['labor_carrying_cabinet','labor_carrying_disassembly','labor_daily_break','transport_distance_km'].includes(row.id)).map(clone);
 const after=r.FC.laborCatalog.applyApprovedFactoryRules(previous);assert.equal(after[0].rateType,'assembly');assert.equal(after.find(d=>d.id==='transport_distance_km').unitPriceSource,'fuel');assert.equal(after.find(d=>d.id==='labor_daily_break').breakAfterHours,4);
 assert.deepEqual(clone(r.FC.laborCatalog.applyApprovedFactoryRules(after)),clone(after));
 for(const patch of [{priceUserEditedAt:'2026-11-08T00:00:00Z'},{startHours:0},{rateType:'workshop'},{note:'CUSTOM'},{defaultMultiplier:0},{unknown:'KEEP'}]){const edited={...previous[0],...patch};assert.deepEqual(clone(r.FC.laborCatalog.applyApprovedFactoryRules([edited])[0]),edited);}
 const frozen=JSON.stringify({lines:previous,total:999});r.FC.laborCatalog.ensureDefaultDefinitions(previous);assert.equal(JSON.stringify({lines:previous,total:999}),frozen);
});
async function main(){for(const [name,fn]of tests){await fn();console.log('PASS '+name);}console.log('PASS catalog authority '+tests.length+' targeted groups');}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};

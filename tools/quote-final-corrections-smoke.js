'use strict';
const assert=require('node:assert/strict'),{fixture}=require('./wycena-labor-norms-smoke');
const clone=v=>JSON.parse(JSON.stringify(v)),tests=[],test=(name,fn)=>tests.push([name,fn]);
test('both manual selectors contain extras including internalOnly, never automatic or legacy operations',()=>{
 const r=fixture(),f=r.FC;f.catalogStore={getPriceList:()=>r.rates()};
 r.load('js/app/cabinet/cabinet-modal-labor.js');r.load('js/app/wycena/wycena-labor-picker.js');
 for(const rows of [f.cabinetModalLabor.getDefinitions(),f.wycenaLaborPicker.normalizeCatalog(r.rates())]){
  assert.ok(rows.some(d=>d.id==='labor_hole_fi60'&&d.internalOnly));
  for(const id of ['labor_mount_hinge','labor_hinge_fastening','pdf_door_adjust','pdf_oven_mount','labor_daily_break'])assert.ok(!rows.some(d=>d.id===id),id+' is automatic');
 }
});
test('cabinet selected list retains unknown manual records while hiding assigned automats',()=>{
 const r=fixture(),f=r.FC;r.s.document=require('./app-dev-smoke-lib/mini-document').makeMiniDocument();f.catalogStore={getPriceList:()=>r.rates()};r.load('js/app/cabinet/cabinet-modal-labor.js');
 const root=r.s.document.createElement('div'),draft={...clone(r.cab),laborItems:[{rateId:'labor_mount_hinge',qty:1},{rateId:'unknown-manual-extra',qty:2}]};
 f.cabinetModalLabor.renderLaborSection(root,draft,()=>{});
 const names=[...root.querySelectorAll('.cabinet-labor-item__name')].map(row=>row.textContent);assert.deepEqual(names,['unknown-manual-extra']);assert.equal(draft.laborItems.length,2);
});
test('manual historical assignments cannot disable or duplicate automatic work; hole is additive',()=>{
 const r=fixture(),before=clone(r.details()),assignments=[{rateId:'labor_mount_hinge',qty:0},{rateId:'pdf_door_adjust',qty:20},{rateId:'labor_hole_fi60',qty:1}];
 r.cab.laborItems=clone(assignments);r.FC.quoteOfferStore={getCurrentDraft:()=>({rateSelections:[{rateId:'labor_mount_hinge',qty:0}]})};
 const after=r.details();assert.deepEqual(clone(after.filter(d=>d.sourceKind==='automatic')),before.filter(d=>d.sourceKind==='automatic'));
 assert.equal(after.filter(d=>d.sourceKind==='manual').length,1);assert.equal(after.find(d=>d.sourceKind==='manual').name,'Otwór fi 60');
 assert.equal(after.reduce((s,d)=>s+d.total,0),before.reduce((s,d)=>s+d.total,0)+37.5);assert.deepEqual(clone(r.cab.laborItems),assignments);
});
test('fixedPrice explicit zero in calculator, description and manual offer lines; absent still falls back',()=>{
 const r=fixture(),f=r.FC;
 for(const pricingMode of ['fixed','advanced']){const d={id:'free',name:'Free',price:123,fixedPrice:0,pricingMode,quantityMode:'none',active:true};assert.equal(f.laborCatalog.calculateDefinition(d,{quantity:3}).total,0);assert.ok(!f.laborCatalog.describeDefinition(d).includes('123.00'));if(pricingMode==='fixed')assert.match(f.laborCatalog.describeDefinition(d),/kwota 0.00 PLN/);}
 assert.equal(f.laborCatalog.calculateDefinition({price:123,pricingMode:'fixed'},{quantity:1}).total,123);
 r.rates().push({id:'free',name:'Free',price:123,fixedPrice:0,pricingMode:'fixed',quantityMode:'none',active:true});f.quoteOfferStore={getCurrentDraft:()=>({rateSelections:[{rateId:'free',qty:3}]})};r.load('js/app/wycena/wycena-core-offer.js');
 assert.equal(f.wycenaCoreOffer.collectQuoteRateLines().find(d=>d.laborDefinitionId==='free').total,0);
});
test('missing/null/blank/NaN/negative quantity blocks, numeric zero is a valid no-op',()=>{
 for(const fact of [null,{available:false,value:0},{available:true,value:null},{available:true,value:''},{available:true,value:NaN},{available:true,value:-1}]){
  const r=fixture(),read=r.FC.workQuantityFacts.getCabinetFact;r.FC.workQuantityFacts.getCabinetFact=(room,cab,code)=>code==='leg.count'?fact:read(room,cab,code);
  assert.ok(r.details().some(d=>d.sourceKind==='automatic-blocked'&&d.quantitySource==='leg.count'),'missing fact '+JSON.stringify(fact));
 }
 const r=fixture(),read=r.FC.workQuantityFacts.getCabinetFact;r.FC.workQuantityFacts.getCabinetFact=(room,cab,code)=>code==='leg.count'?{available:true,value:0}:read(room,cab,code);
 assert.ok(!r.details().some(d=>d.quantitySource==='leg.count'));
});
test('unavailable condition blocks, known false condition skips without requiring its quantity',()=>{
 const r=fixture(),f=r.FC,read=f.workQuantityFacts.getCabinetFact;
 const def=r.rates().find(d=>d.id==='labor_legs_install');def.conditions=[{source:'cabinet.width_mm',operator:'range',min:700,max:800}];
 f.workQuantityFacts.getCabinetFact=(room,cab,code)=>code==='cabinet.width_mm'?{available:false,value:null}:read(room,cab,code);
 assert.ok(r.details().some(d=>d.sourceKind==='automatic-blocked'&&d.name===def.name));
 f.workQuantityFacts.getCabinetFact=(room,cab,code)=>code==='leg.count'?null:read(room,cab,code);
 assert.ok(!r.details().some(d=>d.name===def.name));
});
test('a verified false AND condition takes precedence over missing data in either order',()=>{
 for(const reversed of [false,true]){
  const r=fixture(),def=r.rates().find(d=>d.id==='labor_legs_install'),conditions=[{source:'cabinet.weight_kg',operator:'range',min:1,max:100},{source:'cabinet.width_mm',operator:'range',min:700,max:800}];
  def.conditions=reversed?conditions.reverse():conditions;
  assert.ok(!r.details().some(d=>d.name===def.name));
 }
});
test('native empty generators prove zero; missing/throwing generators are unavailable',()=>{
 const r=fixture(),f=r.FC;
 f.frontHardware.getCabinetFrontCutListForMaterials=()=>[];assert.equal(r.fact('front.count').value,0);assert.equal(r.fact('front.count').available,true);
 f.frontHardware.getCabinetFrontCutListForMaterials=()=>{throw Error('unavailable');};assert.equal(r.fact('front.count').available,false);
 f.cabinetHardwareRequirements.getHingeRequirementsWithQty=()=>null;assert.equal(r.fact('hinge.count').available,false);assert.equal(r.fact('hinge.fitting_count').available,false);
 assert.equal(r.fact('drawer.count').available,false);
});
test('real quote collection refuses incomplete automation before a new snapshot can be saved',async()=>{
 const r=fixture(),f=r.FC,selection={selectedRooms:['kuchnia']};
 r.load('js/app/pricing/labor-work-plan.js');f.projectPcvGuard={calculationOptions:o=>o};f.wycenaCoreSelection={normalizeQuoteSelection:x=>x,validateQuoteSelection:x=>x,decodeSelectedRooms:x=>x.selectedRooms,validateQuoteContent(){},createQuoteValidationError:(code,title,message)=>Object.assign(Error(message),{code,title})};
 f.wycenaCoreSource.getSelectedAggregate=()=>({});f.wycenaCoreMaterialPlan={collectMaterialLines:async()=>[]};f.wycenaCoreOffer={getOfferDraft:()=>({selection,services:{delivery:false,carrying:false,assembly:false}}),collectQuoteRateLines:()=>[],collectCommercialDraft:()=>({})};
 f.wycenaCoreLines={collectElementLines:()=>[],collectAccessories:()=>[],collectBuiltInAppliances:()=>[]};f.investorTransport={getCurrentTransportContext:()=>({durationMin:0,transport:{durationMin:0},isStale:false})};r.load('js/app/quote/quote-snapshot.js');r.load('js/app/wycena/wycena-core.js');
 r.load('js/app/cabinet/cabinet-drawer-requirements.js');
 const complete=await f.wycenaCore.collectQuoteData({selection});assert.ok(complete.laborLines.length);
 const read=f.workQuantityFacts.getCabinetFact;f.workQuantityFacts.getCabinetFact=(room,cab,code)=>code==='leg.count'?null:read(room,cab,code);
 const history=[{id:'frozen',total:123.45}],before=clone(history);
 await assert.rejects((async()=>{const data=await f.wycenaCore.collectQuoteData({selection});history.push(f.quoteSnapshot.buildSnapshot(data));})(),e=>e.code==='labor_automation_incomplete');assert.deepEqual(history,before);
});
(async()=>{let failed=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message.slice(0,300));}}console.log(`${tests.length-failed}/${tests.length} quote corrections PASS`);if(failed)process.exitCode=1;})();

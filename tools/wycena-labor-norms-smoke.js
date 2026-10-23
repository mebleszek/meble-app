#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),clone=v=>JSON.parse(JSON.stringify(v));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function fixture(){
  let panels=[{w:30,h:200,material:'laminat'},{w:30,h:200,material:'laminat'}];
  const cab={id:'synthetic-cab',type:'stojąca',subType:'standardowa',width:60,height:82,depth:50,frontCount:2,backMaterial:'HDF',details:{shelves:2}};
  const project={kuchnia:{settings:{legHeight:10},cabinets:[cab],fronts:[],sets:[]}};
  const slug=v=>String(v||'').replace(/[^a-zA-Z0-9]+/g,'_');
  const FC={utils:{clone,slug},wycenaCoreUtils:{slug,clone},
    wycenaCoreSource:{project:()=>project,roomLabel:id=>id,selectedCabinets:()=>[{roomId:'kuchnia',roomLabel:'Kuchnia',cabinet:cab}]},
    wycenaCoreOffer:{},wycenaCoreSelection:{},wycenaCoreCatalog:{accessoryPriceLookup:()=>null},
    frontHardware:{getDoorFrontPanelsForHinges:()=>panels,universalHingesPerDoor:(w,h)=>h/100,getHingeCountForCabinet:()=>panels.reduce((sum,p)=>sum+p.h/100,0),
      getCabinetFrontCutListForMaterials:()=>panels.map(p=>({name:'Front',qty:1,a:p.w,b:p.h,material:'Front: laminat'}))}};
  const s={FC,projectData:project,console};s.window=s;s.globalThis=s;vm.createContext(s);
  const load=file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),s,{filename:file});
  for(const file of ['cabinet/cabinet-hardware-requirements','cabinet/cabinet-cutlist','pricing/labor-catalog-definitions','pricing/labor-catalog','pricing/work-quantity-sources','pricing/work-quantity-facts','wycena/wycena-core-labor','wycena/wycena-core-lines','quote/quote-calculation-register'])load('js/app/'+file+'.js');
  let rates=FC.laborCatalog.ensureDefaultDefinitions([]);
  FC.catalogSelectors={getQuoteRates:()=>rates};
  return {FC,cab,project,load,s,setPanels:p=>{panels=p;},rates:()=>rates,
    fact:code=>FC.workQuantityFacts.getCabinetFact('kuchnia',cab,code),
    details:()=>FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia'])[0]?.details||[],
    calc:(id,q)=>FC.laborCatalog.calculateDefinition(rates.find(r=>r.id===id),{quantity:q,hourlyRates:{workshop:150,assembly:250}})};
}
const tests=[],test=(name,fn)=>tests.push([name,fn]);
test('Leg boundaries/exceptions/additions share material, facts and labor quantity',()=>{
  const r=fixture(),{cab,FC}=r;
  const cases=[[15,15,1],[15,50,2],[60,15,2],[90,15,3],[60,50,4],[90,50,6],
    [19.99,19.99,1],[20,19.99,2],[80,19.99,2],[80.01,19.99,3],[19.99,20,2],[20,20,4],[80,20,4],[80.01,20,6]];
  for(const [w,d,q]of cases){cab.width=w;cab.depth=d;assert.equal(r.fact('leg.count').value,q);const part=FC.cabinetCutlist.getCabinetCutList(cab,'kuchnia').find(p=>p.hardwareRequirement?.kind==='leg');assert.equal(part.qty,q);near(r.calc('labor_legs_install',q).pricedHours*60,5+q);}
  for(const [sub,q]of [['zmywarkowa',0],['lodowkowa',4],['piekarnikowa',4]]){cab.subType=sub;assert.equal(r.fact('leg.count').value,q);cab.details.additionalLegs=2;assert.equal(r.fact('leg.count').value,q+2);delete cab.details.additionalLegs;}
  cab.subType='standardowa';cab.type='moduł';assert.equal(r.fact('leg.count').value,0);
  near(r.calc('labor_legs_install',0).pricedHours,0);
});
test('HDF hanging standard totals 23 min, with one preparation per operation; 18mm never triggers HDF',()=>{
  const r=fixture(),{cab,FC}=r;cab.type='wisząca';
  for(const [code,q]of [['hanger.count',2],['hdf.cutout_count',4],['nut.workshop_count',2]])assert.equal(r.fact(code).value,q);
  const minutes=r.details().filter(d=>['hanger.count','hdf.cutout_count','nut.workshop_count'].includes(d.quantitySource)).reduce((s,d)=>s+d.hours*60,0);near(minutes,23);
  cab.width=90;assert.equal(r.fact('hanger.count').value,2);
  cab.backMaterial='18 mm pod kolor korpusu';assert.equal(r.fact('hanger.count').value,0);cab.details.hangerCount=3;
  assert.equal(r.fact('hanger.count').value,3);assert.equal(r.fact('hdf.cutout_count').value,0);assert.equal(r.fact('nut.workshop_count').value,0);
  assert.equal(FC.cabinetCutlist.getCabinetCutList(cab,'kuchnia').find(p=>p.hardwareRequirement?.kind==='hanger').qty,3);
  cab.details.hangerCount=0;assert.equal(r.fact('hanger.count').value,0);
});
test('Shelf packages, zero, material count, and placement use the same effective shelf count',()=>{
  const r=fixture(),{cab}=r;
  for(const [type,id,cases]of [['adjustable','labor_shelves_adjustable',[[0,0],[1,15],[2,15],[3,30],[5,30],[6,45],[8,45],[9,60],[11,60],[12,75],[14,75]]],['fixed','labor_shelves_fixed',[[0,0],[1,15],[5,15],[6,30],[12,30],[13,45],[19,45],[20,60],[26,60]]]]){
    cab.details.shelfType=type;
    for(const[n,t]of cases){cab.details.shelves=n;assert.equal(r.fact('shelf.count').value,n);near(r.calc(id,n).pricedHours*60,t);assert.equal(r.fact(type==='adjustable'?'shelf.fixed_count':'shelf.adjustable_count').value,0);}
  }
  delete cab.details.shelfType;cab.details.shelves=4;assert.equal(r.fact('shelf.adjustable_count').value,4);near(r.calc('labor_shelves_place',4).pricedHours*60,9);near(r.calc('labor_shelves_place',8).pricedHours*60,13);
  cab.subType='szuflady';cab.details.shelves=7;assert.equal(r.fact('shelf.count').value,0);
});
test('Hinge drilling and layout are per original door, including split TIP-ON and independent overrides',()=>{
  const r=fixture(),{cab,FC}=r;
  for(const[n,t]of [[2,7],[3,13],[4,19],[5,25]]){
    r.setPanels([{w:30,h:n*100}]);
    const d=r.details();near(d.filter(row=>['hinge.drill_count','hinge.extra_drill_count'].includes(row.quantitySource)).reduce((s,row)=>s+row.hours*60,0),t);
  }
  r.setPanels([{w:30,h:200},{w:30,h:200}]);near(r.details().filter(d=>['hinge.drill_count','hinge.extra_drill_count'].includes(d.quantitySource)).reduce((s,d)=>s+d.hours*60,0),9);
  FC.cabinetHardwareRequirements.setHingeDoorOverride(cab,'left',{typeId:'hinge_170_overlay'});
  const before=JSON.stringify(cab);
  cab.openingSystem='TIP-ON';
  const rows=FC.cabinetHardwareRequirements.getHingeRequirementsWithQty('kuchnia',clone(cab));
  assert.equal(rows.length,4);assert.equal(rows.filter(r=>r.doorKey==='left').reduce((s,r)=>s+r.qty,0),2);assert.equal(rows.filter(r=>r.doorKey==='right').reduce((s,r)=>s+r.qty,0),2);
  assert.equal(r.fact('hinge.extra_drill_count').value,0);assert.equal(r.fact('hinge.door_count').value,2);assert.equal(r.fact('hinge.door_hinge_count').value,4);
  cab.details.hingeDrilling='predrilled';assert.equal(r.fact('hinge.drill_count').value,0);assert.equal(r.fact('hinge.extra_drill_count').value,0);assert.equal(r.fact('hinge.count').value,4);
  assert.equal(FC.cabinetCutlist.getCabinetCutList(cab,'kuchnia').filter(p=>p.hardwareRequirement?.kind==='hinge').reduce((s,p)=>s+p.qty,0),4);
  assert.ok(before.includes('hardwareRequirementOverrides'));
});
test('Door cycle, current rates, central register and explicit manual replacement have no duplicate automats',()=>{
  const r=fixture(),{cab,FC}=r;
  r.setPanels(Array.from({length:4},()=>({w:30,h:200})));
  const details=r.details();
  for(const[code,t]of [['hinge.fitting_count',21],['hinge.door_hinge_count',8],['hinge.door_count',20],['hinge.door_cycle_count',12]]){
    const matching=details.filter(d=>d.quantitySource===code);assert.ok(matching.length);matching.forEach(d=>near(d.hours*60,t));
  }
  const adjust=details.find(d=>d.name==='Końcowa regulacja drzwi u klienta');near(adjust.total,50);
  r.rates().find(row=>row.id==='labor_rate_assembly').price=300;near(r.details().find(d=>d.name===adjust.name).total,60);
  for(const old of Object.keys(FC.laborCatalogDefinitions.LABOR_REPLACEMENTS))assert.ok(!details.some(d=>d.key.includes(old)),'Old auto '+old);
  cab.laborItems=[{rateId:'labor_mount_front',qty:2,note:'keep exactly'},{rateId:'labor_mount_hinge',qty:1}];
  const saved=JSON.stringify(cab.laborItems),manual=r.details();
  assert.equal(manual.filter(d=>d.sourceKind==='manual').length,2);
  assert.ok(manual.filter(d=>d.sourceKind==='automatic-suppressed').length>=4);
  assert.ok(manual.filter(d=>d.sourceKind==='automatic-suppressed').every(d=>d.total===0&&d.quantity===0));
  assert.equal(JSON.stringify(cab.laborItems),saved);
  const line=FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia'])[0];
  const register=FC.quoteCalculationRegister.buildRegister({labor:[line]},{});
  const prep=register.lines.find(d=>d.quantitySource==='leg.count');near(prep.startHours*60,5);assert.equal(prep.startQty,0);near(prep.stepHours*60,1);assert.ok(prep.calculation.includes('min'));
  assert.ok(register.lines.filter(d=>d.sourceKind==='automatic-suppressed').every(d=>d.quantity===0&&d.total===0));
  const def=r.rates().find(d=>d.id==='labor_shelves_adjustable'),privateRow={...def,id:'private-row'};
  const once=FC.laborCatalog.ensureDefaultDefinitions([...r.rates(),privateRow]),twice=FC.laborCatalog.ensureDefaultDefinitions(once);
  assert.equal(once.length,twice.length);assert.equal(twice.filter(d=>d.id===def.id).length,1);assert.ok(twice.some(d=>d.id==='private-row'));
  const privateAgd=FC.laborCatalog.ensureDefaultDefinitions([{id:'private-hood',category:'Montaż AGD',name:'Montaż okapu',price:123}]);assert.ok(privateAgd.some(d=>d.id==='private-hood'&&d.price===123),'Private name matching a retired generic hood is preserved');
  r.project.kuchnia.cabinets.push({...clone(cab),id:'synthetic-second'});
  const ids=FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia']).flatMap(line=>line.details.map(d=>d.key));
  assert.equal(new Set(ids).size,ids.length,'Cabinet identity retained in every audit ID');
  cab.laborItems=[];
  FC.quoteOfferStore={getCurrentDraft:()=>({rateSelections:[{rateId:'labor_mount_hinge',qty:1}]})};
  assert.equal(r.details().find(d=>d.quantitySource==='hinge.fitting_count').sourceKind,'automatic-suppressed');
  delete FC.quoteOfferStore;
  r.rates().find(row=>row.id==='labor_hinge_fastening').active=false;
  assert.ok(!r.details().some(d=>d.name==='Montaż zawiasu'),'Disabled new norm never revives old automation');
});
test('Unchanged areas retain their existing definitions and cutlist geometry',()=>{
  const r=fixture(),{FC,cab}=r;
  const expected={labor_body_h150:[1,0.25],labor_body_width_090:[1/12,0],labor_body_width_110:[0.25,0],labor_mount_drawer:[0.25,0],labor_mount_lift:[0.5,0],dishwasher_mount:[1,0],project_design_parts:[1/60,0]};
  for(const[id,[hours,volume]]of Object.entries(expected)){const def=r.rates().find(d=>d.id===id);near(def.timeBlockHours,hours);near(def.volumeTimePerM3||0,volume);}
  const carrying=r.rates().find(d=>d.id==='labor_carrying_cabinet');near(carrying.startHours,0.25);near(carrying.stepHours,1/12);assert.equal(carrying.rateType,'helper');
  const parts=FC.cabinetCutlist.getCabinetCutList(cab,'kuchnia');assert.equal(parts.find(p=>p.name==='Bok').a,70.2);assert.equal(parts.find(p=>p.name==='Półka').qty,2);
});
function main(){for(const[name,fn]of tests){fn();console.log('PASS '+name);}console.log(`WYCENA-LABOR norms: ${tests.length}/${tests.length} PASS`);}
if(require.main===module)main();
module.exports={fixture,main};

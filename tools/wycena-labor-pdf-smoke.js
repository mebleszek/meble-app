#!/usr/bin/env node
'use strict';
// Synthetic PDF examples through the current technical requirements and quotation engine.
const assert=require('node:assert/strict');
const {fixture}=require('./wycena-labor-norms-smoke');
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
function setup(){const r=fixture();r.load('js/app/cabinet/cabinet-drawer-requirements.js');r.load('js/app/pricing/labor-appliance-rules.js');return r;}
function minutes(r,predicate){return r.details().filter(predicate).reduce((sum,row)=>sum+row.hours*60,0);}
const named=(r,id)=>r.rates().find(row=>row.id===id).name;
const operation=(r,id)=>row=>row.name===named(r,id)&&row.sourceKind==='automatic';
function drawers(r,system,runner='ball',qty=3){
  r.cab.subType='szuflady';r.cab.details={drawerSystem:system,drawerRunnerType:runner,drawerLayout:'3_1_2_2'};
  r.cab.frontCount=qty;
}
function main(){
  {
    const r=setup();r.setPanels(Array.from({length:4},()=>({w:30,h:200})));
    near(minutes(r,operation(r,'pdf_door_adjust')),9);
    near(minutes(r,operation(r,'labor_door_rehang')),12);
    r.setPanels([{w:30,h:200}]);near(minutes(r,operation(r,'pdf_door_adjust')),3);
    r.setPanels([]);r.cab.frontCount=0;near(minutes(r,operation(r,'pdf_door_adjust')),0);
    near(minutes(r,operation(r,'pdf_site_join')),5);
    r.cab.details.neighbors=0;near(minutes(r,operation(r,'pdf_site_join')),5);
    console.log('PASS corpus-level door adjustment, independent rehang, zero doors and standalone joining');
  }
  {
    const r=setup();r.cab.type='wisząca';
    const site=row=>row.quantitySource.startsWith('labor.site.');
    near(minutes(r,site),24);
    r.cab.backMaterial='18 mm pod kolor korpusu';r.cab.details.hangerCount=3;
    near(minutes(r,site),33); // Explicit three-hanger override adds its real 5+3 leveling.
    delete r.cab.details.hangerCount;near(minutes(r,site),25);
    assert.equal(r.fact('labor.site.rail_anchors').value,0);
    assert.equal(r.fact('labor.site.wall_points').value,2);
    r.cab.backMaterial='nieznane plecy';assert.equal(r.fact('labor.site.wall_points').value,0);
    console.log('PASS hanging HDF 24 minutes and 18mm 25 minutes; no double mounting variant');
  }
  for(const [system,runner,expected]of [['systemowe','',106],['skrzynkowe','ball',200],['skrzynkowe','roller',200],['skrzynkowe','undermount',172]]){
    const r=setup();drawers(r,system,runner);
    const saved=JSON.stringify(r.cab),catalog=JSON.stringify(r.rates());
    near(minutes(r,row=>row.quantitySource.startsWith('labor.drawer.')),expected);
    near(minutes(r,operation(r,'pdf_drawer_site_adjust')),15);
    assert.ok(!r.details().some(row=>row.name===named(r,'labor_mount_drawer')&&row.sourceKind==='automatic'));
    assert.equal(JSON.stringify(r.cab),saved);assert.equal(JSON.stringify(r.rates()),catalog);
    r.cab.laborItems=[{rateId:'labor_mount_drawer',qty:3,note:'Preserve historical choice'}];
    near(minutes(r,row=>row.quantitySource.startsWith('labor.drawer.')),0);
    near(minutes(r,operation(r,'pdf_drawer_site_adjust')),15);
    assert.ok(r.details().some(row=>row.sourceKind==='manual'&&row.note.includes('Preserve historical choice')));
    console.log('PASS three '+system+'/'+runner+' drawers: '+expected+' workshop minutes; no duplicate/manual loss');
  }
  {
    const r=setup();drawers(r,'systemowe');r.cab.details.innerDrawerType='systemowe';r.cab.details.innerDrawerCount=2;
    assert.equal(r.fact('labor.drawer.inner').value,2);
    assert.equal(r.fact('labor.drawer.front_catches').value,6);
    assert.equal(r.fact('labor.drawer.batch').value,1);
    near(minutes(r,operation(r,'pdf_drawer_inner_assemble')),30);
    near(minutes(r,operation(r,'pdf_drawer_inner_cut_prepare')),5);
    near(minutes(r,operation(r,'pdf_drawer_inner_cut')),2);
    // Explicit requirements must supply their own technical identity; names are never a norm.
    r.cab.drawerRequirements=[{qty:1,label:'Unknown private drawer',technical:{}}];
    const rows=r.details().filter(row=>row.quantitySource.startsWith('labor.drawer.'));
    assert.ok(rows.length>0&&rows.every(row=>row.total===0&&row.sourceKind==='automatic-blocked'));
    assert.ok(rows.every(row=>row.warnings.some(w=>w.includes('STOP:'))));
    console.log('PASS mixed inner/external preparation once per corpus; unidentified requirements stop without guessing');
  }
  {
    const r=setup();r.cab.frontCount=1;r.setPanels([{w:60,h:70}]);
    const agd=row=>row.quantitySource.startsWith('labor.agd.');
    const agdMinutes=()=>r.FC.wycenaCoreLines.collectBuiltInAppliances(['kuchnia']).filter(row=>row.sourceKind==='automatic').reduce((sum,row)=>sum+row.hours*60,0);
    for(const [sub,expected]of [['zmywarkowa',75],['piekarnikowa',30],['mikrofalowka',35]]){
      r.cab.subType=sub;near(agdMinutes(),expected);
      r.cab.details.applianceMountingMode='none';near(agdMinutes(),0);
      delete r.cab.details.applianceMountingMode;
    }
    r.cab.subType='zmywarkowa';r.setPanels([{w:30,h:70},{w:30,h:70}]);near(agdMinutes(),120);
    assert.ok(!r.details().some(agd),'AGD must not appear again in cabinet labor');
    assert.ok(!r.FC.wycenaCoreLines.collectBuiltInAppliances(['kuchnia']).some(row=>row.laborCode==='dishwasher_mount'),'No legacy AGD duplicate');
    r.cab.laborItems=[{rateId:'dishwasher_mount',qty:1,note:'legacy AGD'}];near(agdMinutes(),0);
    assert.ok(r.details().some(row=>row.sourceKind==='manual'&&row.note.includes('legacy AGD')));
    console.log('PASS dishwasher 75/120, oven 30, microwave 35 minutes; disabled mounting and manual replacement');
  }
  {
    const r=setup(),calc=(id,q)=>r.calc('pdf_'+id,q).pricedHours*60;
    near(calc('handle_agreement',1)+calc('handle_drill',20)+calc('handle_screw',40),170);
    for(const def of r.rates().filter(row=>r.FC.laborCatalogDefinitions.PDF_OPERATION_IDS.includes(row.id))){
      near(r.FC.laborCatalog.calculateDefinition(def,{quantity:0}).total,0);
      for(const field of ['timeBlockHours','startHours','stepHours'])if(def[field])assert.ok([1,5,15,30,60].some(min=>Math.abs(def[field]*60-min)<1e-8),def.id+': approved blocks');
    }
    const rate=r.rates().find(row=>row.id==='labor_rate_assembly');rate.price=237.12345;rate.userEdited=true;
    const before=JSON.stringify(r.rates());
    const join=r.details().find(operation(r,'pdf_site_join'));near(join.total,237.12345*5/60);
    assert.equal(JSON.stringify(r.rates()),before);
    console.log('PASS 20 two-screw handles 170 minutes, zero, unchanged time picker blocks and private hourly rate');
  }
  {
    const r=setup();
    near(minutes(r,row=>row.quantitySource.startsWith('labor.site.')),34);
    r.cab.width=90;near(minutes(r,row=>row.quantitySource.startsWith('labor.site.')),36);
    r.cab.subType='zmywarkowa';near(minutes(r,operation(r,'pdf_standing_level_initial')),0);near(minutes(r,operation(r,'pdf_standing_level_final')),0);
    r.cab.type='wisząca';r.cab.subType='standardowa';r.cab.details.hangerCount=0;
    near(minutes(r,operation(r,'pdf_hanging_level_start')),0);near(minutes(r,operation(r,'pdf_hanging_adjust')),0);
    r.cab.backMaterial='18 mm';near(minutes(r,operation(r,'pdf_hanging_level_start')),0);
    console.log('PASS standing 4/6 legs: 34/36 minutes; zero legs/hangers never receive leveling');
  }
  {
    const r=setup();r.cab.subType='okap';
    near(minutes(r,operation(r,'labor_body_h090'))+minutes(r,row=>row.quantitySource==='labor.workshop.hood'),150);
    r.cab.details.applianceMountingMode='none';near(minutes(r,row=>row.quantitySource==='labor.workshop.hood'),90);
    r.cab.subType='standardowa';near(minutes(r,row=>row.quantitySource==='labor.workshop.hood'),0);
    const calc=(id,q)=>r.calc('pdf_'+id,q).pricedHours*60;
    near(calc('cargo_runner',2)+calc('cargo_catch',2)+calc('cargo_fit',1),17);
    near(calc('cargo_tall_prepare',1)+calc('cargo_tall_mount',1),90);
    for(const id of ['cargo_corner','cargo_kidney','cargo_carousel'])near(calc(id,1),60);
    near(calc('lift_hkxs_mount',2),30);near(calc('lift_hk_prepare',1)+calc('lift_hk_mount',1),20);
    near(calc('lift_gap_adjust',2),3);near(calc('lift_force_adjust',1),5);
    assert.equal(r.rates().find(row=>row.id==='pdf_lift_hk_mount').rateType,'workshop');
    assert.equal(r.rates().find(row=>row.id==='pdf_lift_force_adjust').rateType,'assembly');
    console.log('PASS hood total 150 workshop minutes; cargo17/60/90, HK-XS per piece and separate customer adjustment');
  }
  {
    const r=setup();r.cab.type='wisząca';r.cab.subType='uchylne';r.cab.frontCount=1;r.setPanels([{w:60,h:70}]);
    r.cab.details={flapVendor:'blum',flapKind:'HK-XS'};
    r.FC.frontHardware.getBlumAventosInfo=()=>({kind:r.cab.details.flapKind,liftQty:2,hkxsHinges:3,status:'ok'});
    near(minutes(r,operation(r,'pdf_lift_hkxs_mount')),30);
    near(minutes(r,operation(r,'labor_door_trial')),3);near(minutes(r,operation(r,'labor_door_pack')),5);
    near(minutes(r,operation(r,'labor_door_rehang')),4);near(minutes(r,operation(r,'pdf_door_adjust')),4);
    near(minutes(r,operation(r,'pdf_lift_force_adjust')),5);
    r.cab.details.flapKind='HK_top';
    near(minutes(r,operation(r,'pdf_lift_hk_prepare'))+minutes(r,operation(r,'pdf_lift_hk_mount')),20);
    near(minutes(r,operation(r,'pdf_lift_pack')),5);near(minutes(r,operation(r,'pdf_lift_rehang')),3);
    near(minutes(r,operation(r,'pdf_lift_gap_adjust')),3);near(minutes(r,operation(r,'pdf_lift_force_adjust')),5);
    near(minutes(r,operation(r,'pdf_door_adjust')),0);
    r.cab.laborItems=[{rateId:'labor_mount_lift',qty:1,note:'Private manual lift'}];
    near(minutes(r,operation(r,'pdf_lift_hk_mount')),0);near(minutes(r,operation(r,'pdf_lift_gap_adjust')),3);
    r.cab.laborItems=[];r.setPanels([{w:30,h:70},{w:30,h:70}]);
    assert.equal(r.fact('labor.lift.force').available,false);
    assert.ok(r.details().some(row=>row.quantitySource==='labor.lift.force'&&row.sourceKind==='automatic-blocked'&&row.total===0));
    console.log('PASS HK-XS complete hinged-front cycle, actual lift count, HK top stages, manual replacement and ambiguous front refusal');
  }
  {
    const r=setup(),pdf=new Set(r.FC.laborCatalogDefinitions.PDF_OPERATION_IDS);
    const original=JSON.parse(JSON.stringify(r.rates().filter(row=>!pdf.has(row.id))));
    r.s.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-11-05T00:00:00.000Z']));}};
    const before=JSON.stringify(original),updated=r.FC.laborCatalog.ensureDefaultDefinitions(original);
    assert.equal(JSON.stringify(original),before);
    assert.equal(updated.length,121);
    for(const row of original){
      const expected=JSON.parse(JSON.stringify(row));
      if(['labor_hole_fi60','labor_pipe_cutout','labor_pipe_boxing','labor_vertical_partition_long'].includes(row.id))expected.priceUserEditedAt='2026-11-05T00:00:00.000Z';
      assert.equal(JSON.stringify(updated.find(next=>next.id===row.id)),JSON.stringify(expected),'Only the existing four legacy edited-at markers may change; all prices, norms and other fields stay exact');
    }
    assert.equal(JSON.stringify(r.FC.laborCatalog.ensureDefaultDefinitions(updated)),JSON.stringify(updated));
    console.log('PASS existing catalog save normalizer appends PDF definitions idempotently and preserves original prices/norms/IDs and the four existing legacy timestamp rules');
  }
  console.log('WYCENA PDF: 13/13 groups PASS');
}
if(require.main===module)main();
module.exports={main};

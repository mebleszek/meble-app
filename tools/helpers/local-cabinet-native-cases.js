'use strict';
const assert=require('node:assert/strict');
module.exports=async({getBrowser,tap,fill,until,reopen,baseProbe=false})=>{
 const evaluate=expression=>getBrowser().evaluate(expression);
 const modal='document.getElementById("cabinetModal").style.display';
 const ready='!window.FC.applicationStartup.inspect().transactionPending';
 if(await evaluate('!!document.querySelector(".info-box button")'))await tap('.info-box button');
 await until(ready);
 const variants=await evaluate(`['stojąca','wisząca','moduł'].flatMap((type,index)=>window.FC.cabinetFronts.getSubTypeOptionsForType(type).map(o=>({type,index,variant:o.v})))`);
 const ids=[];
 for(const {type,index,variant} of baseProbe?[variants.find(v=>v.variant==='piekarnikowa')]:variants){
  await until('!window.FC.actions.isLocked("add-cabinet")');await tap('#floatingAdd');await until(modal+'==="flex"');
  await tap('#cabinetTypeChoices .choice-tile:nth-child('+(index+1)+')');await fill('#cmSubType',variant);
  await fill('#cmWidth','90');await fill('#cmHeight',variant==='lodowkowa'?'210':variant==='uchylne'?'40':type==='stojąca'?'100':'80');await fill('#cmDepth','60');
  if(variant==='cargo'&&!baseProbe){
   await fill('#cmWidth','20');await fill('#cmDepth','51');await fill('#cmOpeningSystem','uchwyt klienta');
   await fill('#cmExtraSelectCargoModel','');const previous=await evaluate('JSON.stringify(projectData)');
   assert.equal(await evaluate('document.getElementById("cabinetModalSave").disabled'),true,'Cargo requires an explicit system before saving');
   assert.equal(await evaluate('JSON.stringify(projectData)'),previous);
   await tap('[data-launch-for="cmExtraSelectCargoModel"] .cabinet-choice-launch');await until('!!document.querySelector(".rozrys-choice-backdrop")');
   assert.equal(await evaluate('document.querySelectorAll(".rozrys-choice-backdrop .rozrys-choice-option").length'),5,'Four verified families plus the empty choice');
   await tap('.rozrys-choice-backdrop .rozrys-choice-option:nth-child(2)');await until('!document.querySelector(".rozrys-choice-backdrop")');
   assert.equal(await evaluate('cabinetModalState.draft.frontCount'),1);
   assert.equal(await evaluate('window.FC.hardwareCargoCatalog.select(uiState.roomType,cabinetModalState.draft).spec.symbol'),'04.802.B');
  }
  if(variant==='uchylne'&&!baseProbe){
   assert.deepEqual(await evaluate('Array.from(document.getElementById("cmExtraSelectFlapIntegration").options,o=>o.value)'),['','full','partial']);
   await fill('#cmExtraSelectFlapIntegration','');
   const beforeChoice=await evaluate('JSON.stringify(projectData)');
   assert.equal(await evaluate('document.getElementById("cabinetModalSave").disabled'),true,'Existing AVENTOS validation disables Save until HKi mounting is selected');
   const invalidMount=await evaluate('window.FC.cabinetFronts.validateAventosForDraft(uiState.roomType,cabinetModalState.draft)');
   assert.equal(invalidMount.ok,false);assert.match(invalidMount.msg,/montażu HKi/);
   assert.equal(await evaluate(modal),'flex');assert.equal(await evaluate('JSON.stringify(projectData)'),beforeChoice,'Missing HKi mounting choice cannot partially save a cabinet');
   await fill('#cmExtraSelectFlapIntegration','partial');
   assert.equal(await evaluate('cabinetModalState.draft.details.flapIntegration'),'partial');
   if(type==='wisząca')await fill('#cmExtraSelectFlapIntegration','full');
  }
  if(variant==='narozna_l')for(const [field,value]of Object.entries({cmGL:'100',cmGP:'60',cmST:'100',cmSP:'60'}))await fill('#'+field,value);
  // This case isolates the new rear mounting choice; other variants retain HDF.
  if(!baseProbe){
   await fill('#cmBackMaterial','HDF 3mm biała');
   if(index===0&&variant==='standardowa'){
    await fill('#cmBackMaterial','18 mm pod kolor korpusu');
    await fill('#cmExtraSelectBackPosition','');const beforeBack=await evaluate('JSON.stringify(projectData)');await tap('#cabinetModalSave');
    await until('!!document.querySelector(".info-box")&&'+ready);assert.equal(await evaluate(modal),'flex');
    assert.match(await evaluate('document.querySelector(".info-box").textContent'),/Wybierz montaż pleców/);assert.equal(await evaluate('JSON.stringify(projectData)'),beforeBack);
    await tap('.info-box button');
    await tap('[data-launch-for="cmExtraSelectBackPosition"] .cabinet-choice-launch');
    await until('!!document.querySelector(".rozrys-choice-backdrop")');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".rozrys-choice-backdrop .rozrys-choice-option__title"),el=>el.textContent)'),['Wybierz montaż','Wewnętrzne','Zewnętrzne — PCV dookoła']);
    await tap('.rozrys-choice-backdrop .rozrys-choice-option:nth-child(3)');
    await until('document.getElementById("cmExtraSelectBackPosition").value==="external"&&!document.querySelector(".rozrys-choice-backdrop")');
   }
  }
  if(index===0&&variant==='standardowa'&&!baseProbe){
   await fill('#cmExtraSelectInsideMode','szuflady_wew');await fill('#cmExtraSelectInnerDrawerType','skrzynkowe');await fill('#cmExtraDetails .cabinet-extra-field--number input','2');
   await fill('#cmExtraSelectInnerDrawerSpace','custom');await fill('#cmInnerDrawerSpaceHeight','50');
   await fill('#cmExtraSelectInnerDrawerDistribution','declared');await until('!!document.querySelector("[data-inner-drawer-heights]")');
   await fill('#innerDrawerHeightType','inside');await fill('[data-drawer-index="0"]','30');await fill('[data-drawer-index="1"]','30');
   await tap('[data-inner-drawer-heights] .is-success');assert.equal(await evaluate('!!document.querySelector("[data-inner-drawer-heights] [role=alert]").textContent'),true,'Oversized declared heights stay refused in the existing pattern');
   await fill('[data-drawer-index="0"]','15');await fill('[data-drawer-index="1"]','20');await tap('[data-inner-drawer-heights] .is-success');await until('!document.querySelector("[data-inner-drawer-heights]")');
   assert.match(await evaluate('document.getElementById("cmHardwareRequirements").textContent'),/155°.*zerowy|zerowy.*155°/s);
   assert.equal(await evaluate('window.FC.cabinetHardwareRequirements.getHingeRequirementsWithQty(uiState.roomType,cabinetModalState.draft).every(r=>r.typeId==="hinge_155_zero")'),true,'The existing hinge field changes when inner drawers are selected');
  }
  if(index===0&&variant==='szuflady'&&!baseProbe){
   await fill('#cmExtraSelectDrawerSystem','systemowe');await fill('#cmExtraSelectDrawerBrand','blum');await fill('#cmExtraSelectDrawerModel','merivobox');
   assert.deepEqual(await evaluate('Array.from(document.getElementById("cmExtraSelectDrawerLoadKg").options,o=>o.value)'),['40','70']);
   assert.equal(await evaluate('document.getElementById("cmExtraSelectDrawerLoadKg").value'),'40','The lowest OEM capacity is displayed by default');
   const loadBefore=await evaluate('cabinetModalState.draft.details.drawerLoadKg??null');
   await fill('#cmExtraSelectDrawerLayout','1_big');
   assert.deepEqual(await evaluate('Array.from(document.getElementById("cmExtraSelectDrawerLoadKg").options).filter(o=>!o.disabled).map(o=>o.value)'),['70'],'A full-height single drawer forces the strongest OEM class');
   assert.equal(await evaluate('document.getElementById("cmExtraSelectDrawerLoadKg").value'),'70');
   assert.equal(await evaluate('cabinetModalState.draft.details.drawerLoadKg??null'),loadBefore,'Displaying the automatic stronger class does not rewrite the saved choice');
   await fill('#cmExtraSelectDrawerLayout','3_equal');
   assert.equal(await evaluate('document.getElementById("cmExtraSelectDrawerLoadKg").value'),'40','Ordinary smaller drawers retain the low default');
   await fill('#cmExtraSelectDrawerLoadKg','70');
   assert.equal(await evaluate('cabinetModalState.draft.details.drawerLoadKg'),'70');
   await fill('#cmExtraSelectDrawerBrand','rejs');
   assert.deepEqual(await evaluate('Array.from(document.getElementById("cmExtraSelectDrawerModel").options,o=>o.textContent)'),['Comfort Box Plus','Ultra Box']);
   await fill('#cmExtraSelectDrawerModel','comfort_box_plus');
   assert.equal(await evaluate('cabinetModalState.draft.details.drawerLoadKg'),'70','A family change does not silently downgrade a saved capacity');
   assert.equal(await evaluate('document.getElementById("cmExtraSelectDrawerLoadKg").selectedOptions[0].disabled'),true);
   assert.equal(await evaluate('window.FC.cabinetDrawerRequirements.getDrawerRequirements(uiState.roomType,cabinetModalState.draft)[0].technical.drawerSystemKey'),'rejs_comfort_box_plus');
   await fill('#cmExtraSelectDrawerModel','ultra_box');
   await fill('#cmExtraSelectDrawerLoadKg','40');
  }
  const before=await evaluate('projectData[uiState.roomType].cabinets.map(c=>c.id)');
  const needsBottom=await evaluate('window.FC.cabinetDrawerRequirements.needsBottomColor(uiState.roomType,cabinetModalState.draft)');
  if(needsBottom&&!baseProbe){
   // A fresh add may intentionally clone the preceding cabinet's chosen colour.
   // Exercise the missing-value refusal through the real field, not that assumption.
   await fill('#cmExtraSelectDrawerBottomColor','');
   const previous=await evaluate('JSON.stringify(projectData)');await tap('#cabinetModalSave');
   await until('!!document.querySelector(".info-box")&&'+ready);
   assert.equal(await evaluate(modal),'flex');assert.match(await evaluate('document.querySelector(".info-box").textContent'),/Wybierz kolor płyt szuflad/);
   assert.equal(await evaluate('JSON.stringify(projectData)'),previous,'Missing color must not mutate project');
   await tap('.info-box button');await fill('#cmExtraSelectDrawerBottomColor',index%2?'grey':'white');
  }
  await tap('#cabinetModalSave');
  if(baseProbe){await until('!!document.querySelector(".info-box")&&'+ready);assert.equal(await evaluate(modal),'flex');assert.match(await evaluate('document.querySelector(".info-box").textContent'),/Zapis niepotwierdzony/);assert.deepEqual(await evaluate('projectData[uiState.roomType].cabinets.map(c=>c.id)'),before);console.log('BASE_FAIL native oven cabinetModalSave → LOCAL-FIRST refuses save; form retained');return;}
  await until(modal+'==="none"&&'+ready);
  const cab=await evaluate('projectData[uiState.roomType].cabinets.at(-1)');assert.equal(cab.subType,variant);assert.equal(cab.type,type);assert.ok(!before.includes(cab.id));ids.push({id:cab.id,field:variant==='narozna_l'?'cmST':'cmDepth',value:variant==='narozna_l'?101:61,bottom:needsBottom?cab.details.drawerBottomColor:null,back:index===0&&variant==='standardowa'?cab.details.backPosition:null,system:index===0&&variant==='szuflady',cargoModel:variant==='cargo'?cab.details.cargoModel:null});
  if(index===0&&variant==='szuflady')assert.equal(cab.details.drawerLoadKg,'40');
  if(variant==='uchylne')assert.equal(cab.details.flapIntegration,type==='wisząca'?'full':'partial','The explicit HKi choice is persisted, not both configurations at once');
  await tap('#cab-'+cab.id+' [data-act="edit"]');await until(modal+'==="flex"');await fill(variant==='narozna_l'?'#cmST':'#cmDepth',variant==='narozna_l'?'101':'61');await tap('#cabinetModalSave');await until(modal+'==="none"&&'+ready);
  assert.equal(await evaluate('Number(projectData[uiState.roomType].cabinets.find(c=>c.id==='+JSON.stringify(cab.id)+')'+(variant==='narozna_l'?'.details.st':'.depth')+')'),variant==='narozna_l'?101:61);
  console.log('PASS native modal add/edit/save '+type+'/'+variant);
 }
 if(!baseProbe){
  await until('!window.FC.actions.isLocked("add-cabinet")');await tap('#floatingAdd');await until(modal+'==="flex"');
  await tap('#cabinetTypeChoices .choice-tile:nth-child(1)');await fill('#cmSubType','cargo');
  await fill('#cmWidth','50');await fill('#cmHeight','210');await fill('#cmDepth','51');await fill('#cmOpeningSystem','uchwyt klienta');
  await fill('#cmExtraSelectCargoModel','nomet_prestige_maxi');
  const top=await evaluate('window.FC.cabinetCutlist.getCabinetCutList(cabinetModalState.draft,uiState.roomType).filter(p=>p.name==="Wieniec górny"||p.name.startsWith("Trawers"))');
  assert.equal(top.length,1);assert.equal(top[0].name,'Wieniec górny');assert.equal(top[0].a,46.4);assert.equal(top[0].b,51);
  await tap('#cabinetModalSave');await until(modal+'==="none"&&'+ready);
  const cab=await evaluate('projectData[uiState.roomType].cabinets.at(-1)');
  ids.push({id:cab.id,field:'cmDepth',value:51,cargoModel:'nomet_prestige_maxi',fullTop:true});
  console.log('PASS native standing MAXI automatic full top, actual inside dimensions and durable save');
 }
 if(!baseProbe)for(const [index,angle]of [[1,'75'],[2,'110']]){
  await until('!window.FC.actions.isLocked("add-cabinet")');await tap('#floatingAdd');await until(modal+'==="flex"');
  await tap('#cabinetTypeChoices .choice-tile:nth-child('+(index+1)+')');await fill('#cmSubType','uchylne');
  await fill('#cmWidth','50');await fill('#cmHeight','45');await fill('#cmDepth','40');await fill('#cmOpeningSystem','uchwyt klienta');
  await fill('#cmFlapVendor','hafele');
  assert.deepEqual(await evaluate('Array.from(document.getElementById("cmExtraSelectFlapAngle").options,o=>o.value)'),['','75','90','110']);
  await fill('#cmExtraSelectFlapAngle','');const before=await evaluate('JSON.stringify(projectData)');
  assert.equal(await evaluate('document.getElementById("cabinetModalSave").disabled'),true,'DUO refuses an unknown angle before any project write');
  assert.equal(await evaluate('window.FC.cabinetFronts.validateAventosForDraft(uiState.roomType,cabinetModalState.draft).ok'),false);
  assert.equal(await evaluate('JSON.stringify(projectData)'),before);
  await tap('[data-launch-for="cmExtraSelectFlapAngle"] .cabinet-choice-launch');await until('!!document.querySelector(".rozrys-choice-backdrop")');
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".rozrys-choice-backdrop .rozrys-choice-option__title"),el=>el.textContent)'),['Wybierz kąt','75°','90°','110°']);
  await tap('.rozrys-choice-backdrop .rozrys-choice-option:nth-child('+(angle==='75'?2:4)+')');await until('!document.querySelector(".rozrys-choice-backdrop")');
  await tap('#cabinetModalSave');await until(modal+'==="none"&&'+ready);
  const cab=await evaluate('projectData[uiState.roomType].cabinets.at(-1)');assert.equal(cab.details.flapAngle,angle);
  const selection=await evaluate('window.FC.hardwareLiftCatalog.duoInfo(uiState.roomType,projectData[uiState.roomType].cabinets.at(-1))');
  assert.equal(selection.status,'ok');assert.ok(['373.66.612','373.66.632'].includes(selection.model));
  ids.push({id:cab.id,field:'cmDepth',value:40,duoAngle:angle});console.log('PASS native DUO angle, automatic model/count and atomic save '+angle);
 }
 if(!baseProbe)for(const model of ['merivobox','legrabox']){
  await until('!window.FC.actions.isLocked("add-cabinet")');await tap('#floatingAdd');await until(modal+'==="flex"');
  await tap('#cabinetTypeChoices .choice-tile:nth-child(1)');await fill('#cmSubType','szuflady');
  if(await evaluate('document.getElementById("cmHeightIncludesLegs").checked'))await tap('#cmHeightIncludesLegs');
  await fill('#cmWidth','60');await fill('#cmHeight','72');await fill('#cmDepth','51');await fill('#cmBackMaterial','HDF 3mm biała');
  await fill('#cmExtraSelectDrawerSystem','systemowe');await fill('#cmExtraSelectDrawerBrand','blum');await fill('#cmExtraSelectDrawerModel',model);
  await fill('#cmExtraSelectDrawerLayout','1_big');await fill('#cmExtraSelectDrawerBottomColor','white');await fill('#cmOpeningSystem','TIP-ON');
  if(await evaluate('!!document.getElementById("cmExtraSelectInnerDrawerType")'))await fill('#cmExtraSelectInnerDrawerType','brak');
  assert.equal(await evaluate('window.FC.cabinetCutlist.resolveDrawerFrontGeometry(cabinetModalState.draft,uiState.roomType).bodyHeightMm'),720);
  assert.equal(await evaluate('document.getElementById("cmExtraSelectDrawerLoadKg").value'),'70');
  await tap('#cabinetModalSave');await until(modal+'==="none"&&'+ready);
  const large=await evaluate('projectData[uiState.roomType].cabinets.at(-1)');
  assert.equal(Number(large.details.drawerLoadKg),70,'The conscious Save stores the actual enforced capacity, not the lower cloned draft value');
  const module=model==='merivobox'?'T60H4570':'T60L7570 TOB R+LV1 S';
  ids.push({id:large.id,field:'cmDepth',value:51,bottom:'white',large:true,module});
  const specs=await evaluate('window.FC.cabinetCutlist.getCabinetCutList(projectData[uiState.roomType].cabinets.at(-1),uiState.roomType).filter(p=>p.hardwareRequirement?.drawerFit).map(p=>window.FC.hardwareDrawerCatalog.specFor(p.hardwareRequirement.drawerFit.selectedId))');
  assert.equal(specs.length,1,JSON.stringify(specs.map(s=>({id:s?.id,profile:s?.profile,loadKg:s?.loadKg}))));assert.equal(specs[0].loadKg,70);assert.equal(specs[0].lengthMm,500);assert.equal(specs[0].profile,model==='merivobox'?'E':'F');assert.equal(specs[0].family,'blum_'+model);
  assert.equal(await evaluate('window.FC.cabinetCutlist.getCabinetCutList(projectData[uiState.roomType].cabinets.at(-1),uiState.roomType).filter(p=>p.hardwareRequirement?.kind==="drawer-motion").map(p=>p.hardwareRequirement.expectedSymbol).join(",")'),module);
  console.log('PASS native720 mm '+model+' full-height drawer saves the strongest70 kg, highest solid side and longest fitting500 mm kit');
 }
 for(const preset of ['A','C','D']){
  await until('!window.FC.actions.isLocked("add-cabinet")');await tap('#floatingAdd');await until(modal+'==="flex"');await tap('#cabinetTypeChoices .choice-tile:nth-child(4)');await tap('#setTiles [data-preset="'+preset+'"]');
  if(preset==='C'){
   await fill('#setBackMaterial','18 mm pod kolor korpusu');await fill('#setBackPosition','');
   const before=await evaluate('JSON.stringify(projectData)');await tap('#cabinetModalSave');await until('!!document.querySelector(".info-box")&&'+ready);
   assert.equal(await evaluate(modal),'flex');assert.equal(await evaluate('JSON.stringify(projectData)'),before);
   assert.match(await evaluate('document.querySelector(".info-box").textContent'),/Wybierz montaż pleców/);await tap('.info-box button');
   await tap('[data-launch-for="setBackPosition"] .cabinet-choice-launch');await until('!!document.querySelector(".rozrys-choice-backdrop")');
   await tap('.rozrys-choice-backdrop .rozrys-choice-option:nth-child(2)');await until('document.getElementById("setBackPosition").value==="internal"&&!document.querySelector(".rozrys-choice-backdrop")');
  }
  await tap('#cabinetModalSave');await until(modal+'==="none"&&'+ready);
  if(preset==='C')assert.equal(await evaluate('(()=>{const room=projectData[uiState.roomType],set=room.sets.at(-1);return set.backPosition==="internal"&&room.cabinets.filter(c=>c.setId===set.id).every(c=>c.details.backPosition==="internal");})()'),true,'The set and every member preserve one explicit rear mounting');
  console.log('PASS native set '+preset);
 }
 const pcv=await evaluate(`window.FC.applicationWrite.project(()=>{const a={projectId:window.FC.projectStore.getCurrentProjectId(),roomId:uiState.roomType,cabinetId:projectData[uiState.roomType].cabinets[0].id,partRoleId:'body.side.left'};const previous=window.FC.projectPcvOverrides.get(a);if(!previous.ok)throw Error(JSON.stringify(previous));const result=window.FC.projectPcvOverrides.setEdges(a,{w2:!previous.edges.w2});if(!result.ok)throw Error(JSON.stringify(result));return result;})`);assert.equal(pcv.ok,true);assert.equal(pcv.changed,true);
 console.log('PASS actual project-owned PCV mutation through LOCAL-FIRST');
 await tap('#sessionSave');await until('!window.FC.session.active&&'+ready);
 const saved=await evaluate('window.FC.projectStore.readAll()[0].projectData');
 const proof=await evaluate('localProof()');assert.deepEqual(proof.tables.outbox,[]);assert.deepEqual(proof.tables.replicas,[]);
 // A synthetic previous installation written through the genuine authority.
 // Normal cold startup, rather than a direct planner call, must upgrade it.
 const beforeUpgrade=await evaluate('localProof()');
 const oldCatalog=await evaluate(`window.FC.applicationWrite.globals(()=>{
  const c=window.FC.globalDataContract,model=c.capture({getItem:k=>k==='fc_edit_session_v1'?null:localStorage.getItem(k)},Object.keys(c.sources)).model;
  const allHardware=model.hardware.map(row=>row.id),allLabor=model.labor.map(row=>row.id);
  model.hardware=model.hardware.filter(row=>!window.FC.hardwareDrawerCatalog.specFor(row.id)&&!/^hw_bivert_(?:axilo_|camar806_|blum_|lift_)/.test(row.id)&&!row.id.startsWith('hw_schach_camar816_')&&!row.id.startsWith('hw_gral_lift_duo_')&&!row.id.startsWith('hw_stolmet_lift_duo_')&&!row.id.startsWith('hw_bivert_cargo_')&&!['hw_seed_gtv_hexa_96_black','hw_seed_blum_tipon_long_956a1004'].includes(row.id));
  model.materials=model.materials.filter(row=>!row.id.startsWith('m_drawer_bottom_')||row.id==='m_drawer_bottom_16_white');
  const profile=model.technicalParams.find(row=>row.category==='Szuflady / prowadnice'&&row.key==='profil_szuflady');
  profile.options=['M','N','H','niska','średnia','wysoka'];profile.label='Prywatna nazwa profilu';
  model.technicalParams.find(row=>row.category==='Szuflady / prowadnice'&&row.key==='kolor_okucia').options=['biały','szary','antracyt'];
  const privateRow=model.materials.find(row=>row.id==='m_drawer_bottom_16_white');privateRow.price=0;privateRow.purchasePrice=0;privateRow.priceUserEditedAt='2026-11-23';
  model.materials[0].price=333;model.materials[0].priceUserEditedAt='2026-11-23';
  const newLiftNorms=['other_prepare','other_mount','hki_prepare','hki_mill_partial','hki_mill_full','arms','stabilizer_cut','stabilizer_mount','other_pack','other_rehang','other_gap_adjust'].map(id=>'pdf_lift_'+id).concat(["pdf_cargo_auto_runner","pdf_cargo_auto_catch","pdf_cargo_auto_fit","pdf_cargo_auto_tall_prepare","pdf_cargo_auto_tall_mount"]);
  model.labor=model.labor.filter(row=>!newLiftNorms.includes(row.id));
  for(const domain of ['materials','hardware','technicalParams','labor'])for(const key of c.sources[domain])localStorage.setItem(key,c.canonical(model[domain]));
  return {model,allHardware,allLabor};
 })`);
 const oldImage=(await evaluate('localProof()')).tables.control.find(row=>row.key==='application');
 assert.ok(oldCatalog.allHardware.length>oldCatalog.model.hardware.length);
 await reopen();
 const upgraded=await evaluate('localProof()'),upgradeRows=upgraded.tables.control.find(row=>row.key==='application').rows;
 assert.deepEqual(upgraded.raw,beforeUpgrade.raw,'Factory additions never rewrite protected native RAW');
 assert.deepEqual(upgraded.tables.outbox,[]);assert.deepEqual(upgraded.tables.replicas,[]);
 assert.equal(upgradeRows.fc_projects_v1,oldImage.rows.fc_projects_v1);assert.equal(upgradeRows.fc_quote_snapshots_v1,oldImage.rows.fc_quote_snapshots_v1);
 const read=domain=>JSON.parse(upgradeRows[({materials:'fc_sheet_materials_v1',hardware:'fc_accessories_v1'})[domain]]);
 assert.deepEqual(read('hardware').map(row=>row.id),oldCatalog.model.hardware.map(row=>row.id).concat(oldCatalog.allHardware.filter(id=>!oldCatalog.model.hardware.some(row=>row.id===id))));
 assert.deepEqual(read('hardware').slice(0,oldCatalog.model.hardware.length),oldCatalog.model.hardware);
 const labor=JSON.parse(upgradeRows.fc_quote_rates_v1);
 assert.deepEqual(labor.slice(0,oldCatalog.model.labor.length),oldCatalog.model.labor,'Approved lift additions preserve all preceding private/default norms');
 assert.deepEqual(labor.map(row=>row.id),oldCatalog.model.labor.map(row=>row.id).concat(oldCatalog.allLabor.filter(id=>!oldCatalog.model.labor.some(row=>row.id===id))));
 const profile=JSON.parse(upgradeRows.fc_hardware_technical_params_v1).find(row=>row.category==='Szuflady / prowadnice'&&row.key==='profil_szuflady');
 assert.equal(profile.label,'Prywatna nazwa profilu');assert.deepEqual(profile.options.slice(0,6),['M','N','H','niska','średnia','wysoka']);assert.ok(profile.options.includes('A'));
 assert.equal(read('materials').find(row=>row.id==='m_drawer_bottom_16_white').price,0);assert.equal(read('materials')[0].price,333);
 for(const color of ['white','grey'])for(const thickness of [10,16])assert.ok(read('materials').some(row=>row.id==='m_drawer_bottom_'+thickness+'_'+color));
 assert.deepEqual(await evaluate('window.FC.projectStore.readAll()[0].projectData'),saved,'Cold offline startup preserves native geometry, IDs, sets, PCV and metadata');
 await reopen();
 const expectedRestart=structuredClone(upgraded.tables);
 // Every ordinary boot checkpoints the verified UI once. No additional
 // globals commit, row mutation or queued publication may be introduced.
 expectedRestart.control.find(row=>row.key==='application').version++;
 assert.deepEqual((await evaluate('localProof()')).tables,expectedRestart,'Repeated startup has only its normal UI checkpoint, with no second catalog operation');
 console.log('PASS normal old-catalog startup appends missing factories, preserves private/zero prices, native RAW/projects/history/queue and is idempotent');
 await tap('[data-action="open-room"][data-room^="room_"]');await until('window.FC.session.active&&window.FC.session.durable&&'+ready);
 for(const {id,field,value,bottom,back,system} of ids){await tap('#cab-'+id+' [data-act="edit"]');await until(modal+'==="flex"');assert.equal(await evaluate('Number(document.getElementById('+JSON.stringify(field)+').value)'),value);if(bottom)assert.equal(await evaluate('document.getElementById("cmExtraSelectDrawerBottomColor").value'),bottom);if(system){assert.equal(await evaluate('document.getElementById("cmExtraSelectDrawerBrand").value'),'rejs');assert.equal(await evaluate('document.getElementById("cmExtraSelectDrawerModel").value'),'ultra_box');const panels=await evaluate('window.FC.cabinetCutlist.getCabinetCutList(cabinetModalState.draft,uiState.roomType).filter(p=>p.materialThicknessMm===16)');assert.equal(panels.length,6);assert.ok(panels.every(p=>p.material==='Płyta szuflad systemowych 16 mm biała'));assert.ok(panels.some(p=>p.name.startsWith('Dno'))&&panels.some(p=>p.name.startsWith('Tył')));}if(back){assert.equal(await evaluate('document.getElementById("cmExtraSelectBackPosition").value'),back);assert.equal(await evaluate('cabinetModalState.draft.details.innerDrawerCount'),"2");assert.deepEqual(await evaluate('cabinetModalState.draft.details.innerDrawerHeightsCm'),[15,20]);assert.deepEqual(await evaluate('window.FC.cabinetCutlist.getCabinetCutList(cabinetModalState.draft,uiState.roomType).filter(p=>p.name.startsWith("Front wewnętrzny")).map(p=>[p.a,p.b])'),[[85.6,20],[85.6,25]]);assert.equal(await evaluate('window.FC.cabinetHardwareRequirements.getHingeRequirementsWithQty(uiState.roomType,cabinetModalState.draft).every(r=>r.typeId==="hinge_155_zero")'),true,'Cold restart retains inner drawers and zero-protrusion hinges');}await tap('#cabinetModalCancel');await until(modal+'==="none"');}
 for(const {id,cargoModel,fullTop}of ids.filter(row=>row.cargoModel)){
  await tap('#cab-'+id+' [data-act="edit"]');await until(modal+'==="flex"');
  assert.equal(await evaluate('document.getElementById("cmExtraSelectCargoModel").value'),cargoModel,'Cold restart retains Cargo family');
  assert.equal(await evaluate('window.FC.hardwareCargoCatalog.select(uiState.roomType,cabinetModalState.draft).ok'),true);
  if(fullTop)assert.equal(await evaluate('window.FC.cabinetCutlist.getCabinetCutList(cabinetModalState.draft,uiState.roomType).filter(p=>p.name==="Wieniec górny"||p.name.startsWith("Trawers")).map(p=>p.name).join(",")'),'Wieniec górny');
  await tap('#cabinetModalCancel');await until(modal+'==="none"');
 }
 for(const {id,duoAngle}of ids.filter(row=>row.duoAngle)){
  await tap('#cab-'+id+' [data-act="edit"]');await until(modal+'==="flex"');
  assert.equal(await evaluate('document.getElementById("cmFlapVendor").value'),'hafele');
  assert.equal(await evaluate('document.getElementById("cmExtraSelectFlapAngle").value'),duoAngle,'Cold restart retains the explicit DUO angle');
  assert.equal(await evaluate('window.FC.hardwareLiftCatalog.duoInfo(uiState.roomType,cabinetModalState.draft).status'),'ok');
  await tap('#cabinetModalCancel');await until(modal+'==="none"');
 }
 for(const {id,module}of ids.filter(row=>row.large)){
  await tap('#cab-'+id+' [data-act="edit"]');await until(modal+'==="flex"');
  assert.equal(await evaluate('document.getElementById("cmExtraSelectDrawerLoadKg").value'),'70');
  assert.equal(await evaluate('window.FC.cabinetCutlist.getCabinetCutList(cabinetModalState.draft,uiState.roomType).filter(p=>p.hardwareRequirement?.drawerFit).every(p=>window.FC.hardwareDrawerCatalog.specFor(p.hardwareRequirement.drawerFit.selectedId).loadKg===70)'),true);
  assert.equal(await evaluate('window.FC.cabinetCutlist.getCabinetCutList(cabinetModalState.draft,uiState.roomType).filter(p=>p.hardwareRequirement?.kind==="drawer-motion").map(p=>p.hardwareRequirement.expectedSymbol).join(",")'),module);
  await tap('#cabinetModalCancel');await until(modal+'==="none"');
 }
 console.log('PASS '+ids.length+' native cabinets reopen after cold offline Chromium restart; room exact, IDs, load choices and set relations preserved');
};

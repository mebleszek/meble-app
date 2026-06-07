#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');

function assert(cond, msg, details){
  if(!cond){
    console.error('FAIL:', msg);
    if(details !== undefined){
      try{ console.error(JSON.stringify(details, null, 2)); }catch(_){ console.error(details); }
    }
    process.exit(1);
  }
}
function near(actual, expected, tolerance, msg){
  const a = Number(actual);
  const e = Number(expected);
  assert(Number.isFinite(a) && Math.abs(a - e) <= tolerance, `${msg}: expected ${e}, got ${actual}`);
}
function slug(value){ return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x'; }
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function load(ctx, files){ files.forEach((file)=> vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename:file })); }

function createBaseContext(){
  const FC = { utils:{ clone, slug }, wycenaCoreUtils:{ clone, slug } };
  const projectData = {
    kuchnia:{ cabinets:[
      { id:'cab_body', type:'stojąca', subType:'standard', width:60, height:82, depth:51, frontCount:2 },
      { id:'cab_drawer_door', type:'stojąca', subType:'szuflada_drzwi', width:60, height:82, depth:51, frontCount:3, details:{ drawerHeight:20, doorCount:2 } },
      { id:'cab_set_lead', type:'stojąca', subType:'standard', setId:'set_a', width:80, height:82, depth:51, frontCount:2 },
      { id:'cab_set_follow', type:'stojąca', subType:'standard', setId:'set_a', width:80, height:82, depth:51, frontCount:2 },
      { id:'cab_agd', type:'stojąca', subType:'zmywarkowa', width:60, height:82, depth:56, details:{ mounting:'yes' } },
    ], fronts:[], sets:[], settings:{ legHeight:10 } }
  };
  const ctx = { window:{ FC, projectData }, FC, projectData, console, setTimeout, clearTimeout };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  FC.wycenaCoreSource = {
    project:()=> projectData,
    roomLabel:(id)=> id === 'kuchnia' ? 'Kuchnia' : String(id || ''),
    selectedCabinets:(rooms)=> (Array.isArray(rooms) ? rooms : []).flatMap((roomId)=> (projectData[roomId] && projectData[roomId].cabinets || []).map((cabinet)=> ({ roomId, roomLabel:roomId === 'kuchnia' ? 'Kuchnia' : roomId, cabinet }))),
  };
  FC.frontHardware = {
    getCabinetFrontCutListForMaterials(room, cab){
      if(!cab || cab.id === 'cab_agd') return [];
      if(cab.id === 'cab_drawer_door') return [
        { name:'Front', qty:1, a:60, b:20, dims:'60 × 20', material:'Front: laminat • Egger' },
        { name:'Front', qty:2, a:30, b:52, dims:'30 × 52', material:'Front: laminat • Egger' },
      ];
      if(cab.id === 'cab_set_lead') return [{ name:'Front', qty:2, a:40, b:72, dims:'40 × 72', material:'Front: laminat • Egger' }];
      if(cab.id === 'cab_set_follow') return [];
      return [{ name:'Front', qty:Number(cab.frontCount || 0), a:30, b:72, dims:'30 × 72', material:'Front: laminat • Egger' }];
    },
    getHingeCountForCabinet(){ return 99; }
  };
  FC.cabinetHardwareRequirements = {
    getHingeRequirementsWithQty(room, cab){
      if(!cab || cab.id === 'cab_agd') return [];
      if(cab.id === 'cab_drawer_door') return [
        { kind:'hinge', hardwareGroup:'hinges', qty:2, label:'110° nakładany', doorKey:'left', doorLabel:'lewe drzwi', ruleId:'drawer_door', frontWidthCm:30, frontHeightCm:52 },
        { kind:'hinge', hardwareGroup:'hinges', qty:2, label:'110° nakładany', doorKey:'right', doorLabel:'prawe drzwi', ruleId:'drawer_door', frontWidthCm:30, frontHeightCm:52 },
      ];
      if(cab.id === 'cab_set_lead') return [{ kind:'hinge', hardwareGroup:'hinges', qty:8, label:'110° nakładany', doorKey:'set', doorLabel:'fronty zestawu', ruleId:'set_fronts' }];
      if(cab.id === 'cab_set_follow') return [];
      return [{ kind:'hinge', hardwareGroup:'hinges', qty:4, label:'110° nakładany', doorKey:'both', doorLabel:'drzwi', ruleId:'standard' }];
    }
  };
  FC.laborApplianceRules = {
    isMountingEnabled:(cab)=> cab && cab.subType === 'zmywarkowa',
    getApplianceForCabinet:()=> ({ serviceName:'Zmywarka do zabudowy' }),
  };
  return ctx;
}

function loadLabor(ctx){
  load(ctx, ['js/app/pricing/labor-catalog-definitions.js', 'js/app/pricing/labor-catalog.js']);
  const rates = ctx.FC.laborCatalog.DEFAULT_HOURLY_RATES.concat(ctx.FC.laborCatalog.DEFAULT_LABOR_DEFINITIONS).map(clone);
  ctx.FC.catalogSelectors = { getQuoteRates:()=> rates };
  load(ctx, ['js/app/wycena/wycena-core-labor.js', 'js/app/quote/quote-calculation-register.js', 'js/app/quote/quote-snapshot.js']);
  return rates;
}

function runLaborRegisterTests(){
  const ctx = createBaseContext();
  loadLabor(ctx);
  const FC = ctx.FC;
  const laborLines = FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia']);
  assert(laborLines.length >= 4, 'robocizna szafek ma powstać dla szafek z czynnościami', laborLines);

  const register = FC.quoteCalculationRegister.buildRegister({ labor:laborLines }, { discountPercent:10 });
  const laborRegisterLines = register.lines.filter((row)=> row.section === 'labor');
  assert(laborRegisterLines.length > 0, 'robocizna szafek trafia do quoteCalculationRegister', register);
  near(register.totals.labor, Math.round(laborRegisterLines.reduce((sum, row)=> sum + Number(row.total || 0), 0) * 100) / 100, 0.001, 'suma robocizny w rejestrze = suma linii rejestru');
  assert(laborRegisterLines.some((row)=> /Szafka #1/.test(row.sourceLabel || '') && row.sourceId === 'cab_body'), 'audyt robocizny pokazuje źródło pozycji: szafka/pokój/id', laborRegisterLines);
  assert(laborRegisterLines.some((row)=> row.workAutomatCode === 'cabinet_body'), 'quoteCalculationRegister zachowuje kod automatu cabinet_body', laborRegisterLines);
  assert(laborRegisterLines.some((row)=> row.workAutomatCode === 'front_mount'), 'quoteCalculationRegister zachowuje kod automatu front_mount', laborRegisterLines);
  assert(laborRegisterLines.some((row)=> row.workAutomatCode === 'hinge_mount'), 'quoteCalculationRegister zachowuje kod automatu hinge_mount', laborRegisterLines);

  const drawerLine = laborLines.find((row)=> row.cabinetId === 'cab_drawer_door');
  assert(drawerLine, 'fixture: jest szafka szuflada_drzwi');
  const frontCmp = drawerLine.details.find((row)=> row.sourceRole === 'front-labor');
  assert(frontCmp && Number(frontCmp.quantity) === 3, 'robocizna frontów bierze te same 3 fronty, które zwraca źródło MATERIAŁ/WYCENA', drawerLine.details);
  const hingeQty = drawerLine.details.filter((row)=> row.sourceRole === 'hinge-labor').reduce((sum, row)=> sum + Number(row.quantity || 0), 0);
  near(hingeQty, 4, 0.001, 'front szuflady nie jest liczony jako front zawiasowy — zawiasy tylko z centralnych wymagań drzwi');

  const setLines = laborLines.filter((row)=> /^cab_set_/.test(row.cabinetId || ''));
  const setFrontQty = setLines.flatMap((row)=> row.details || []).filter((row)=> row.sourceRole === 'front-labor').reduce((sum, row)=> sum + Number(row.quantity || 0), 0);
  const setHingeQty = setLines.flatMap((row)=> row.details || []).filter((row)=> row.sourceRole === 'hinge-labor').reduce((sum, row)=> sum + Number(row.quantity || 0), 0);
  near(setFrontQty, 2, 0.001, 'zestaw nie dubluje robocizny frontów na korpusie nieprowadzącym');
  near(setHingeQty, 8, 0.001, 'zestaw nie dubluje robocizny zawiasów na korpusie nieprowadzącym');

  const bodyLine = laborLines.find((row)=> row.cabinetId === 'cab_body');
  const bodyHingeQty = bodyLine.details.filter((row)=> row.sourceRole === 'hinge-labor').reduce((sum, row)=> sum + Number(row.quantity || 0), 0);
  near(bodyHingeQty, 4, 0.001, 'robocizna zawiasów bierze ilość z centralnych wymagań, a nie z legacy getHingeCountForCabinet=99');

  const snapshot = FC.quoteSnapshot.buildSnapshot({
    selectedRooms:['kuchnia'],
    roomLabels:['Kuchnia'],
    laborLines,
    calculationRegister:register,
    totals:{ labor:9999, subtotal:9999, grand:9999 },
    commercial:{ discountPercent:10, versionName:'Test robocizny' }
  });
  near(snapshot.totals.labor, register.totals.labor, 0.001, 'snapshot/oferta zapisuje robociznę z rejestru, a nie z bocznego totals');
  assert(snapshot.calculationRegister && snapshot.calculationRegister.lines.some((row)=> row.section === 'labor'), 'snapshot zapisuje linie robocizny jako część calculationRegister', snapshot.meta);
}

function runApplianceManualAndDiscountTests(){
  const ctx = createBaseContext();
  loadLabor(ctx);
  const FC = ctx.FC;
  FC.wycenaCoreCatalog = { servicePriceLookup:(name)=> name === 'Zmywarka do zabudowy' ? { price:170, starterPrice:false } : null };
  FC.wycenaCoreOffer = { collectQuoteRateLines:()=> [] };
  FC.wycenaCoreSelection = { normalizeQuoteSelection:(v)=> v || {}, decodeSelectedRooms:(v)=> v && v.selectedRooms || ['kuchnia'] };
  load(ctx, ['js/app/wycena/wycena-core-lines.js']);
  const agd = FC.wycenaCoreLines.collectBuiltInAppliances(['kuchnia']);
  assert(agd.length === 1 && agd[0].sourceType === 'appliance' && /Szafka #5/.test(agd[0].sourceLabel || ''), 'montaż AGD trafia do rejestru z audytem szafki/urządzenia', agd);
  assert(agd[0].workAutomatCode === 'dishwasher_mount', 'montaż AGD zachowuje osobny kod automatu zmywarki bez przebudowy liczenia AGD', agd);

  FC.quoteOfferStore = { getCurrentDraft:()=> ({ rateSelections:[{ rateId:'labor_hole_fi60', qty:2 }] }) };
  load(ctx, ['js/app/wycena/wycena-core-offer.js']);
  const manual = FC.wycenaCoreOffer.collectQuoteRateLines();
  assert(manual.length === 1 && manual[0].sourceType === 'manual' && manual[0].name === 'Otwór fi 60', 'ręczna pozycja robocizny jest zachowana i odróżniona od automatycznej', manual);

  const register = FC.quoteCalculationRegister.buildRegister({ agdServices:agd, quoteRates:manual }, { discountPercent:10 });
  near(register.totals.services, 170, 0.001, 'montaż AGD trafia do quoteCalculationRegister');
  assert(register.lines.some((row)=> row.section === 'services' && /Szafka #5/.test(row.sourceLabel || '') && row.workAutomatCode === 'dishwasher_mount'), 'audyt AGD pokazuje szafkę źródłową i kod automatu AGD', register.lines);
  near(register.totals.discount, (register.totals.services + register.totals.quoteRates) * 0.1, 0.001, 'rabat/narzut sumy działa przez register');
}

runLaborRegisterTests();
runApplianceManualAndDiscountTests();
console.log('OK quote-labor-single-truth smoke');
console.log(' - robocizna korpusów/frontów/zawiasów trafia do quoteCalculationRegister');
console.log(' - fronty i zawiasy bazują na centralnych źródłach bez dubli zestawów');
console.log(' - AGD, ręczne pozycje i snapshot używają ścieżki rejestru');
console.log(' - quoteCalculationRegister zachowuje workAutomatCode dla robocizny i AGD');

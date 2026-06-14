#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function assert(cond, msg){ if(!cond) throw new Error(msg); }
function slug(v){ return String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x'; }

function loadContext(){
  const storage = { getItem(){ return null; }, setItem(){}, removeItem(){} };
  const FC = {
    frontHardware:{
      getDoorFrontPanelsForHinges(_room, cab){
        const count = Math.max(1, Number(cab && cab.frontCount) || 1);
        const h = Number(cab && cab.height) || 82;
        return Array.from({ length:count }, ()=> ({ w:30, h, material:(cab && cab.frontMaterial) || 'laminat', hasHandle:true }));
      },
      blumHingesPerDoor(_w, h){ return Number(h) > 100 ? 3 : 2; },
      getHingeCountForCabinet(room, cab){
        return this.getDoorFrontPanelsForHinges(room, cab).reduce((sum, door)=> sum + this.blumHingesPerDoor(door.w, door.h), 0);
      }
    },
    wycenaCoreUtils:{ slug },
    wycenaCoreCatalog:{ accessoryPriceLookup(){ return null; }, servicePriceLookup(){ return null; } },
    wycenaCoreSource:{ selectedCabinets(){ return []; }, roomLabel(){ return 'S'; }, getSelectedAggregate(){ return { groups:{}, materials:[], selectedRooms:['S'] }; }, getScopedMaterials(){ return []; } },
    wycenaCoreOffer:{ collectQuoteRateLines(){ return []; } },
    wycenaCoreSelection:{ normalizeQuoteSelection(v){ return v || {}; }, decodeSelectedRooms(){ return ['S']; }, decodeMaterialScope(){ return { kind:'all' }; } },
    roomPreferences:{ resolveHardwareProducerPreference(_room, group, fallback){ return group === 'hinges' ? 'Blum' : (fallback || ''); } }
  };
  const ctx = { window:{ FC, localStorage:storage }, FC, localStorage:storage, console, document:{ getElementById(){ return null; } } };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  [
    'js/app/catalog/hardware-technical-params.js',
    'js/app/catalog/hardware-catalog.js',
    'js/app/catalog/hardware-catalog-seed-data.js',
    'js/app/catalog/hardware-catalog-seeds.js',
    'js/app/catalog/catalog-store.js',
    'js/app/cabinet/cabinet-hardware-requirement-options.js',
    'js/app/cabinet/cabinet-hardware-requirements.js',
    'js/app/cabinet/cabinet-hardware-requirements-panel.js',
    'js/app/cabinet/cabinet-cutlist.js',
    'js/app/wycena/wycena-core-lines.js'
  ].forEach((file)=> vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename:file }));
  return ctx;
}

function boolValue(param){ return !!(param && param.value === true); }

function runDefaultAndTipOnChecks(){
  const ctx = loadContext();
  const api = ctx.window.FC.cabinetHardwareRequirements;
  const normalCab = { type:'stojąca', subType:'standard', width:80, height:82, frontCount:2, frontMaterial:'laminat', openingSystem:'uchwyt klienta', details:{} };
  const normal = api.getHingeRequirementsWithQty('S', normalCab).filter((req)=> req && req.kind === 'hinge');
  assert(normal.length === 2, 'normalna szafka dwudrzwiowa ma mieć po jednym wymaganiu na każde drzwiczki');
  normal.forEach((req)=> {
    assert(boolValue(req.technicalParams.hamulec) === true, 'domyślny zawias normalnej szafki musi mieć hamulec');
    assert(boolValue(req.technicalParams.sprezyna) === true, 'domyślny zawias normalnej szafki musi mieć sprężynę');
    assert(Number(req.qty) === 2, 'dla frontu 82 cm test oczekuje 2 kpl. zawiasów na drzwiczki');
  });

  const tipCab = Object.assign({}, normalCab, { height:130, openingSystem:'TIP-ON' });
  const tipRows = api.getHingeRequirementsWithQty('S', tipCab).filter((req)=> req && req.kind === 'hinge');
  assert(tipRows.length === 4, 'TIP-ON przy dwóch drzwiczkach i 3 zawiasach na drzwi ma rozbić wymagania na 4 linie');
  ['left','right'].forEach((doorKey)=> {
    const rows = tipRows.filter((req)=> req.doorKey === doorKey);
    assert(rows.length === 2, 'TIP-ON ma rozbić każde drzwiczki osobno');
    const spring = rows.find((req)=> boolValue(req.technicalParams.sprezyna) === true);
    const plain = rows.find((req)=> boolValue(req.technicalParams.sprezyna) === false);
    assert(spring && Number(spring.qty) === 1, 'TIP-ON / 3 zawiasy: ze sprężyną ma być floor(3/2)=1');
    assert(plain && Number(plain.qty) === 2, 'TIP-ON / 3 zawiasy: bez sprężyny i bez hamulca ma być ceil(3/2)=2');
    assert(boolValue(spring.technicalParams.hamulec) === false, 'TIP-ON wariant ze sprężyną nie może mieć hamulca');
    assert(boolValue(plain.technicalParams.hamulec) === false, 'TIP-ON wariant bez sprężyny nie może mieć hamulca');
  });
}

async function runDynamicCascadeUsesKeyFeaturesCheck(){
  const ctx = loadContext();
  const FC = ctx.window.FC;
  const store = typeof FC.catalogStore === 'function' ? FC.catalogStore() : FC.catalogStore;
  const accessories = store.getAccessories();
  accessories.push({
    id:'test_hinge_no_brake_spring', manufacturer:'Blum', symbol:'TEST_NO_BRAKE_SPRING', name:'Test zawias 110 bez hamulca ze sprężyną', hardwareCategory:'Zawiasy', hardwareUnit:'kpl.', price:1, status:'active',
    technicalParams:{ rola_kompletu:{ value:'komplet zawiasowy' }, system_kompatybilnosci:{ value:'CLIP top' }, nalozenie:{ value:'nakładany' }, kat_rzeczywisty:{ from:110, to:'' }, klasa_kata:{ value:'standardowy 90–120°' }, hamulec:{ value:false }, sprezyna:{ value:true }, typ_prowadnika:{ value:'standardowy' }, forma_prowadnika:{ value:'krzyżowy' }, pokrycie_prowadnika:{ value:'w komplecie' } }
  });
  accessories.push({
    id:'test_hinge_no_brake_no_spring', manufacturer:'Blum', symbol:'TEST_NO_BRAKE_NO_SPRING', name:'Test zawias 110 bez hamulca bez sprężyny', hardwareCategory:'Zawiasy', hardwareUnit:'kpl.', price:1, status:'active',
    technicalParams:{ rola_kompletu:{ value:'komplet zawiasowy' }, system_kompatybilnosci:{ value:'CLIP top' }, nalozenie:{ value:'nakładany' }, kat_rzeczywisty:{ from:110, to:'' }, klasa_kata:{ value:'standardowy 90–120°' }, hamulec:{ value:false }, sprezyna:{ value:false }, typ_prowadnika:{ value:'standardowy' }, forma_prowadnika:{ value:'krzyżowy' }, pokrycie_prowadnika:{ value:'w komplecie' } }
  });
  store.savePriceList('accessories', accessories);

  const reqApi = FC.cabinetHardwareRequirements;
  const panel = FC.cabinetHardwareRequirementsPanel;
  const req = reqApi.getHingeRequirementWithQty('S', { type:'stojąca', subType:'standard', width:60, height:82, frontCount:1, frontMaterial:'laminat', openingSystem:'uchwyt klienta', details:{} }).doorRequirements[0];
  const titles = [];
  FC.rozrysChoice = {
    async openRozrysChoiceOverlay(cfg){
      const title = String(cfg.title || '');
      titles.push(title);
      if(title.includes('typ')) return 'nakładany';
      if(title.includes('klas') || title.includes('zakres')) return 'standardowy 90–120°';
      if(title.includes('hamulec')) return 'false';
      if(title.includes('sprężyn')) return 'false';
      return null;
    }
  };
  const picked = await panel.openHingeChoice(req);
  assert(titles.some((title)=> title.includes('hamulec')), 'kaskada ma pytać o Hamulec / domyk, bo jest cechą używaną do porównania');
  assert(titles.some((title)=> title.includes('sprężyn')), 'kaskada ma pytać o Sprężynę, bo jest cechą używaną do porównania');
  const pickedOption = panel.buildHingeChoiceOptions(req).find((opt)=> String(opt.typeId || opt.value) === String(picked));
  assert(pickedOption, 'wybrany wariant musi istnieć w opcjach technicznych');
  assert(boolValue(pickedOption.technicalParams.hamulec) === false, 'wybrany wariant ma zapisać hamulec: nie');
  assert(boolValue(pickedOption.technicalParams.sprezyna) === false, 'wybrany wariant ma zapisać sprężyna: nie');
  assert(String(picked).indexOf('catalog_hinge_') === 0, 'wariant różniący się ważnymi cechami nie może nadpisać kanonicznego typeId 110°');
}

(async function main(){
  runDefaultAndTipOnChecks();
  await runDynamicCascadeUsesKeyFeaturesCheck();
  console.log('OK cabinet-hinge-tipon-spring smoke');
})().catch((err)=> { console.error(err && err.stack || err); process.exit(1); });

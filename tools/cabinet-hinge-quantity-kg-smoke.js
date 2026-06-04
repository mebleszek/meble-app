#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function assert(cond, msg, data){ if(!cond){ throw new Error(msg + (data ? '\n' + JSON.stringify(data, null, 2) : '')); } }
function loadContext(){
  const ctx = { console, Math, Number, String, JSON, fmtCm(v){ return String(Number(v)); } };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.FC = {};
  ctx.projectData = { schemaVersion:9, kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{ legHeight:10, bottomHeight:82 } } };
  vm.createContext(ctx);
  [
    'js/app/cabinet/front-hardware-weights.js',
    'js/app/cabinet/front-hardware-fronts.js',
    'js/app/cabinet/front-hardware-hinges.js',
    'js/app/cabinet/front-hardware.js'
  ].forEach((file)=> vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename:file }));
  return ctx;
}
(function main(){
  const ctx = loadContext();
  const hw = ctx.FC.frontHardware;
  assert(hw && typeof hw.universalHingesPerDoor === 'function', 'Brak uniwersalnego kalkulatora zawiasów');
  assert(typeof hw.blumHingesPerDoor === 'function', 'Brak kompatybilnego aliasu blumHingesPerDoor');
  assert(hw.universalHingesPerDoor(60, 100, 'akryl', true) === 3, '60×100 akryl z uchwytem powinien mieć 3 zawiasy');
  assert(hw.universalHingesPerDoor(60, 105, 'akryl', true) === 3, '60×105 akryl z uchwytem powinien mieć 3 zawiasy');
  assert(hw.universalHingesPerDoor(66, 105, 'akryl', true) === 4, '66×105 akryl z uchwytem powinien mieć 4 zawiasy po zmianie szerokości na co 10 cm');
  assert(hw.universalHingesPerDoor(70, 105, 'akryl', true) === 4, '70×105 akryl z uchwytem powinien mieć 4 zawiasy, nie 5');
  assert(hw.universalHingesPerDoor(71, 105, 'akryl', true) === 5, '71×105 akryl powinien dostać drugi dodatek szerokości');
  assert(hw.blumHingesPerDoor(66, 105, 'akryl', true) === 4, 'Alias legacy musi korzystać z nowej reguły kg');
  const cab = { id:'drawer-door', type:'stojąca', subType:'szuflada_drzwi', width:60, height:82, frontMaterial:'laminat', openingSystem:'uchwyt klienta', frontCount:2, details:{ drawerHeight:20 } };
  const materialFronts = hw.getCabinetFrontCutListForMaterials('kuchnia', cab);
  const hingePanels = hw.getDoorFrontPanelsForHinges('kuchnia', cab);
  assert(materialFronts.reduce((sum, row)=> sum + Number(row.qty || 0), 0) === 3, 'Szuflada+drzwi ma mieć 3 fronty materiałowe: 1 szuflada + 2 drzwi', materialFronts);
  assert(hingePanels.length === 2, 'Szuflada+drzwi ma mieć do zawiasów tylko 2 panele drzwiowe, bez frontu szuflady', hingePanels);
  assert(hw.getHingeCountForCabinet('kuchnia', cab) === 4, 'Szuflada+drzwi 60 cm ma liczyć 4 zawiasy, a nie 6');
  const legacyMutated = { id:'drawer-door-legacy', type:'stojąca', subType:'szuflada_drzwi', width:60, height:82, frontMaterial:'laminat', openingSystem:'uchwyt klienta', frontCount:3, details:{ drawerHeight:20 } };
  const legacyPanels = hw.getDoorFrontPanelsForHinges('kuchnia', legacyMutated);
  assert(legacyPanels.length === 2, 'Legacy frontCount=3 przy szuflada+drzwi ma być odczytany jako 2 drzwi + 1 szuflada, nie 3 drzwi', legacyPanels);
  assert(hw.getHingeCountForCabinet('kuchnia', legacyMutated) === 4, 'Legacy szuflada+drzwi po wcześniejszej cutliście nie może zawyżać zawiasów');
  ctx.projectData.kuchnia.cabinets = [
    { id:'lead', setId:'set-a', type:'stojąca', subType:'standardowa', width:132, height:105, frontMaterial:'akryl', frontCount:2, openingSystem:'uchwyt klienta', details:{} },
    { id:'follower', setId:'set-a', type:'moduł', subType:'standardowa', width:132, height:25, frontMaterial:'akryl', frontCount:0, openingSystem:'uchwyt klienta', details:{} }
  ];
  ctx.projectData.kuchnia.fronts = [
    { id:'f1', setId:'set-a', width:66, height:105, material:'akryl' },
    { id:'f2', setId:'set-a', width:66, height:105, material:'akryl' }
  ];
  assert(hw.getHingeCountForCabinet('kuchnia', ctx.projectData.kuchnia.cabinets[0]) === 8, 'Zestaw ma liczyć zawiasy z frontów zestawu na korpusie prowadzącym: 2×4', hw.getDoorFrontPanelsForHinges('kuchnia', ctx.projectData.kuchnia.cabinets[0]));
  assert(hw.getHingeCountForCabinet('kuchnia', ctx.projectData.kuchnia.cabinets[1]) === 0, 'Korpus nieprowadzący zestawu nie może dublować zawiasów');
  console.log('OK cabinet-hinge-quantity-kg smoke');
})();

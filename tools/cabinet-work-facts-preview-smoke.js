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

const FC = {
  frontHardware:{
    getCabinetFrontCutListForMaterials(room, cab){
      assert(room === 'kuchnia', 'front helper dostaje room');
      assert(cab && cab.width === 60, 'front helper dostaje klon szafki');
      cab.frontCount = 99; // smoke: helper nie może zmienić oryginalnego draftu przez podgląd
      return [{ name:'Front', qty:2, a:30, b:72, dims:'30 × 72', material:'Front: laminat' }];
    }
  },
  cabinetHardwareRequirements:{
    getHingeRequirementsWithQty(room, cab){
      assert(room === 'kuchnia', 'hinge helper dostaje room');
      cab.hardwareRequirementOverrides = { mutatedByTest:true };
      return [{ kind:'hinge', qty:4, label:'Zawias 110° nakładany' }];
    }
  },
  laborApplianceRules:{
    getApplianceForCabinet(){ return null; }
  },
  helpRegistry:{ createTrigger(){ return { outerHTML:'<button>?</button>' }; } }
};
const ctx = { window:{ FC }, FC, console, JSON, String, Number, Array, Object, Set, Map, Math, RegExp };
ctx.globalThis = ctx.window;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/app/pricing/work-quantity-sources.js'), 'utf8'), ctx, { filename:'js/app/pricing/work-quantity-sources.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'js/app/cabinet/cabinet-work-facts-preview.js'), 'utf8'), ctx, { filename:'js/app/cabinet/cabinet-work-facts-preview.js' });

const api = ctx.FC.cabinetWorkFactsPreview;
assert(api && typeof api.buildFacts === 'function' && typeof api.renderPanel === 'function', 'cabinetWorkFactsPreview API jest dostępne');
const draft = { type:'stojąca', subType:'standardowa', width:60, height:72, depth:51, frontCount:2, details:{ shelves:1 }, frontMaterial:'laminat' };
const facts = api.buildFacts('kuchnia', draft);
assert(draft.frontCount === 2 && !draft.hardwareRequirementOverrides, 'podgląd nie mutuje draftu szafki');
const byCode = new Map(facts.map((row)=> [row.code, row]));
[
  'cabinet.count',
  'cabinet.width_mm',
  'cabinet.height_mm',
  'cabinet.depth_mm',
  'cabinet.volume_m3',
  'cabinet.zone',
  'cabinet.kind',
  'front.count',
  'front.dimensions',
  'front.area_m2',
  'hinge.count',
  'hinge.requirement',
  'shelf.count',
  'drawer.count',
  'appliance.count',
  'appliance.type'
].forEach((code)=> assert(byCode.has(code), `podgląd ma fakt ${code}`, facts.map((row)=> row.code)));
assert(byCode.get('cabinet.width_mm').displayValue === '600 mm', 'szerokość jest pokazana w mm z pola szafki', byCode.get('cabinet.width_mm'));
assert(byCode.get('front.count').displayValue === '2 szt.', 'liczba frontów idzie z lekkiego podglądu draftu', byCode.get('front.count'));
assert(/2× 30 × 72 cm/.test(byCode.get('front.dimensions').displayValue), 'wymiary frontów są czytelne', byCode.get('front.dimensions'));
assert(byCode.get('hinge.count').displayValue === '4 szt.', 'liczba zawiasów w podglądzie nie uruchamia ciężkich wymagań podczas otwierania modala', byCode.get('hinge.count'));
assert(byCode.get('shelf.count').displayValue === '1 szt.', 'liczba półek idzie z danych szafki', byCode.get('shelf.count'));
assert(byCode.get('appliance.type').displayValue === 'brak AGD', 'brak AGD jest opisany po ludzku', byCode.get('appliance.type'));

const src = fs.readFileSync(path.join(root, 'js/app/cabinet/cabinet-work-facts-preview.js'), 'utf8');
assert(!/localStorage|setItem|getItem/.test(src), 'moduł podglądu nie zapisuje ani nie czyta localStorage');
assert(src.includes('Co program odczyta z tej szafki') && src.includes('bez zapisywania drugiej kopii danych'), 'panel jasno opisuje read-only podgląd bez drugiej prawdy');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dev = fs.readFileSync(path.join(root, 'dev_tests.html'), 'utf8');
const load = fs.readFileSync(path.join(root, 'tools/index-load-groups.js'), 'utf8');
const smokeList = fs.readFileSync(path.join(root, 'tools/app-dev-smoke-lib/file-list.js'), 'utf8');
[index, dev, load, smokeList].forEach((content, idx)=> assert(content.includes('js/app/cabinet/cabinet-work-facts-preview.js'), `plik ładowania ${idx} zawiera cabinet-work-facts-preview.js`));
assert(index.includes('cmWorkFactsPreview'), 'modal szafki ma host pod podgląd faktów');
const modal = fs.readFileSync(path.join(root, 'js/app/cabinet/cabinet-modal.js'), 'utf8');
assert(modal.includes('refreshCabinetWorkFactsPreview') && modal.includes('scheduleCabinetWorkFactsPreview') && modal.includes('cmWorkFactsPreview'), 'modal odświeża podgląd faktów na żywo przez odroczony scheduler');
assert(modal.includes('Podgląd zostanie policzony po otwarciu okna'), 'modal ma lekki placeholder zamiast blokować klik Edytuj synchronicznym podglądem');
const css = fs.readFileSync(path.join(root, 'css/cabinet-common.css'), 'utf8');
assert(css.includes('cabinet-work-facts-panel') && css.includes('cabinet-work-facts-row__tech'), 'CSS ma style panelu podglądu faktów');
assert(index.includes('20260608_cabinet_edit_no_ui_regression_fix_v1') && dev.includes('20260608_cabinet_edit_no_ui_regression_fix_v1'), 'index/dev_tests mają cache-busting nowego etapu');

console.log('OK cabinet-work-facts-preview smoke');
console.log(' - modal szafki ma read-only podgląd „Co program odczyta z tej szafki”');
console.log(' - podgląd czyta aktualny draft bez tworzenia drugiej prawdy');
console.log(' - wartości frontów, zawiasów, półek i wymiarów są nazwane kodami źródeł ilości');

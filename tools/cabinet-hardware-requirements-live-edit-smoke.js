#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function assert(cond, msg){ if(!cond) throw new Error(msg); }

function loadContext(){
  const FC = {
    frontHardware:{
      getDoorFrontPanelsForHinges(room, cab){
        const count = Math.max(0, Number(cab && cab.frontCount) || 0);
        const wEach = count ? ((Number(cab && cab.width) || 0) / count) : 0;
        const h = Number(cab && cab.height) || 0;
        return Array.from({ length:count }, ()=> ({ w:wEach, h, material:(cab && cab.frontMaterial) || 'laminat', hasHandle:true }));
      },
      blumHingesPerDoor(w, h){ return Number(h) > 100 ? 3 : 2; },
      getHingeCountForCabinet(room, cab){
        return this.getDoorFrontPanelsForHinges(room, cab).reduce((sum, door)=> sum + this.blumHingesPerDoor(door.w, door.h), 0);
      }
    }
  };
  const ctx = {
    window:{ FC },
    FC,
    console,
    document:{ getElementById(){ return null; } },
  };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  ['js/app/cabinet/cabinet-hardware-requirement-options.js', 'js/app/cabinet/cabinet-hardware-requirements.js', 'js/app/cabinet/cabinet-hardware-requirements-panel.js', 'js/app/cabinet/cabinet-cutlist.js']
    .forEach((file)=> vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename:file }));
  return ctx;
}


function loadCatalogContext(){
  const FC = {
    frontHardware:{
      getDoorFrontPanelsForHinges(room, cab){
        const count = Math.max(0, Number(cab && cab.frontCount) || 0);
        const wEach = count ? ((Number(cab && cab.width) || 0) / count) : 0;
        const h = Number(cab && cab.height) || 0;
        return Array.from({ length:count }, ()=> ({ w:wEach, h, material:(cab && cab.frontMaterial) || 'laminat', hasHandle:true }));
      },
      blumHingesPerDoor(_w, h){ return Number(h) > 100 ? 3 : 2; },
      getHingeCountForCabinet(room, cab){
        return this.getDoorFrontPanelsForHinges(room, cab).reduce((sum, door)=> sum + this.blumHingesPerDoor(door.w, door.h), 0);
      }
    }
  };
  const storage = { getItem(){ return null; }, setItem(){}, removeItem(){} };
  const ctx = {
    window:{ FC, localStorage:storage },
    FC,
    localStorage:storage,
    console,
    document:{ getElementById(){ return null; } },
  };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  [
    'js/app/catalog/hardware-technical-params.js',
    'js/app/catalog/hardware-catalog.js',
    'js/app/catalog/hardware-catalog-seed-data.js',
    'js/app/catalog/hardware-catalog-seeds.js',
    'js/app/catalog/catalog-store.js',
    'js/app/cabinet/cabinet-hardware-requirement-options.js', 'js/app/cabinet/cabinet-hardware-requirements.js',
    'js/app/cabinet/cabinet-hardware-requirements-panel.js'
  ].forEach((file)=> vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename:file }));
  return ctx;
}

function runCatalogDrivenOptionsCheck(){
  const ctx = loadCatalogContext();
  const api = ctx.window.FC.cabinetHardwareRequirements;
  const options = api.getHingeRequirementOptions();
  assert(options.length >= 5, 'lista wyboru zawiasów ma powstać z katalogu okuć');
  assert(options.every((opt)=> opt.catalogDriven === true), 'opcje zawiasów w normalnym runtime muszą być katalogowe, nie hardcodowane');
  const overlay = options.find((opt)=> opt.typeId === api.HINGE_TYPES.OVERLAY_110);
  assert(overlay && overlay.sourceCount >= 2, 'opcja 110° nakładany ma być zduplikowana z realnych pozycji katalogu i scalona po cechach');
  const labels = options.map((opt)=> opt.label).join(' | ');
  assert(labels.includes('110° wpuszczany'), 'katalogowa lista musi zawierać wariant wpuszczany');
  assert(!/Blum|BLUM|GTV/.test(labels), 'lista wymagań nie może ujawniać producenta/modelu katalogowego');
  const req = api.getHingeRequirementPreset(api.HINGE_TYPES.OVERLAY_110, 'test_catalog_option');
  assert(req.requirementType === 'hingeSet', 'wymaganie zawiasowe ma być kompletem zawiasowym');
  assert(Number(req.technicalParams && req.technicalParams.kat_rzeczywisty && req.technicalParams.kat_rzeczywisty.from) === 110, 'kanoniczne wymaganie szafki 110° nie może zostać zastąpione kątem produktu katalogowego 107°');
  assert(Array.isArray(req.coverageComponents) && req.coverageComponents.some((row)=> row.kind === 'mountingPlate'), 'komplet zawiasowy ma wymagać prowadnika jako składnika pokrycia');
}

function runNoHardcodedOptionFallbackCheck(){
  const ctx = loadContext();
  const api = ctx.window.FC.cabinetHardwareRequirements;
  const options = api.getHingeRequirementOptions();
  assert(Array.isArray(options) && options.length === 0, 'bez katalogu lista wyboru zawiasów nie może wracać do hardcodowanych presetów');
}

function runPerDoorCheck(){
  const ctx = loadContext();
  const api = ctx.window.FC.cabinetHardwareRequirements;
  const cab = { type:'stojąca', subType:'standard', width:80, height:82, frontCount:2, frontMaterial:'laminat', details:{} };
  const agg = api.getHingeRequirementWithQty('kuchnia', cab);
  assert(agg.qty === 4, 'dwie pary drzwiczek 82 cm powinny mieć łącznie 4 zawiasy w teście');
  assert(Array.isArray(agg.doorRequirements) && agg.doorRequirements.length === 2, 'wymagania zawiasów muszą być rozbite per drzwiczki');
  assert(agg.doorRequirements[0].doorLabel === 'Lewe drzwiczki', 'pierwsza kolumna ma być lewymi drzwiczkami');
  assert(agg.doorRequirements[1].doorLabel === 'Prawe drzwiczki', 'druga kolumna ma być prawymi drzwiczkami');

  cab.height = 130;
  const taller = api.getHingeRequirementWithQty('kuchnia', cab);
  assert(taller.qty === 6, 'zmiana wysokości draftu musi od razu zmieniać ilość zawiasów w centralnej logice');

  api.setHingeDoorOverride(cab, 'left', { typeId:api.HINGE_TYPES.INSET_110 });
  const mixed = api.getHingeRequirementWithQty('kuchnia', cab);
  assert(mixed.mixedDoorRequirements === true, 'różne wymagania lewych i prawych drzwiczek muszą być oznaczone jako mieszane');
  assert(mixed.doorRequirements[0].technicalParams.nalozenie.value === 'wpuszczany', 'lewe drzwiczki mają przyjąć ręczne wymaganie wpuszczane');
  assert(mixed.doorRequirements[1].technicalParams.nalozenie.value === 'nakładany', 'prawe drzwiczki mają zachować domyślne wymaganie nakładane');

  const parts = ctx.window.FC.cabinetCutlist.getCabinetCutList(cab, 'kuchnia');
  const hingeParts = parts.filter((part)=> part && part.hardwareRequirement && part.hardwareRequirement.kind === 'hinge');
  assert(hingeParts.length === 2, 'cutlista musi rozdzielić różne wymagania lewych i prawych drzwiczek');
  assert(hingeParts.some((part)=> part.hardwareRequirement.technicalParams.nalozenie.value === 'wpuszczany'), 'cutlista musi przenieść wymaganie wpuszczane');
  assert(hingeParts.some((part)=> part.hardwareRequirement.technicalParams.nalozenie.value === 'nakładany'), 'cutlista musi przenieść wymaganie nakładane');
}

function clone(value){ return JSON.parse(JSON.stringify(value)); }

function runOverridePersistenceAndMaterialCheck(){
  const ctx = loadContext();
  const api = ctx.window.FC.cabinetHardwareRequirements;
  const cutlistApi = ctx.window.FC.cabinetCutlist;

  const one = { id:'cab_single', type:'stojąca', subType:'standard', width:60, height:82, frontCount:1, frontMaterial:'laminat', details:{} };
  api.setHingeDoorOverride(one, 'single', { typeId:api.HINGE_TYPES.PARALLEL_INSET });
  const savedOne = clone(one);
  const oneReq = api.getHingeRequirementWithQty('kuchnia', savedOne);
  assert(oneReq.doorRequirements.length === 1, 'szafka z 1 frontem ma zachować tylko jedno wymaganie single');
  assert(oneReq.doorRequirements[0].doorKey === 'single', 'szafka z 1 frontem nie może tworzyć lewe/prawe');
  assert(oneReq.doorRequirements[0].overridden === true, 'ręczne wymaganie jednego frontu musi przetrwać zapis/odczyt');
  assert(oneReq.doorRequirements[0].technicalParams.nalozenie.value === 'równoległy wpuszczany', 'po zapisie pojedynczy front ma mieć ręczne wymaganie równoległy wpuszczany');
  assert(!(savedOne.hardwareRequirementOverrides.hinges.doors.left || savedOne.hardwareRequirementOverrides.hinges.doors.right), 'szafka z 1 frontem nie może zapisywać niepotrzebnych override left/right');
  const oneParts = cutlistApi.getCabinetCutList(savedOne, 'kuchnia').filter((part)=> part && part.hardwareRequirement && part.hardwareRequirement.kind === 'hinge');
  assert(oneParts.length === 1 && oneParts[0].name.includes('równoległy wpuszczany'), 'MATERIAŁ/cutlista musi pokazać ręcznie ustawiony zawias pojedynczego frontu');

  api.setHingeDoorOverride(savedOne, 'single', { typeId:'' });
  const restoredOne = api.getHingeRequirementWithQty('kuchnia', savedOne);
  assert(!(savedOne.hardwareRequirementOverrides), 'Przywróć domyślne ma usunąć override, nie zostawiać pustych struktur');
  assert(restoredOne.doorRequirements[0].technicalParams.nalozenie.value === 'nakładany', 'po przywróceniu wraca domyślna reguła 110° nakładany');

  const two = { id:'cab_pair', type:'stojąca', subType:'standard', width:80, height:82, frontCount:2, frontMaterial:'laminat', details:{} };
  api.setHingeDoorOverride(two, 'left', { typeId:api.HINGE_TYPES.PARALLEL_INSET });
  const savedTwo = clone(two);
  const twoReq = api.getHingeRequirementWithQty('kuchnia', savedTwo);
  assert(twoReq.doorRequirements[0].overridden === true, 'lewe drzwiczki mają zostać ręczne po zapisie');
  assert(twoReq.doorRequirements[1].overridden === false, 'prawe drzwiczki mają zostać domyślne po zapisie');
  assert(twoReq.doorRequirements[0].technicalParams.nalozenie.value === 'równoległy wpuszczany', 'lewe drzwiczki mają mieć ręczne wymaganie równoległy wpuszczany');
  assert(twoReq.doorRequirements[1].technicalParams.nalozenie.value === 'nakładany', 'prawe drzwiczki mają zachować domyślne 110° nakładany');

  api.setHingeDoorOverride(savedTwo, 'left', { typeId:api.HINGE_TYPES.INSET_110 });
  api.setHingeDoorOverride(savedTwo, 'right', { typeId:api.HINGE_TYPES.INSET_110 });
  const bothReq = api.getHingeRequirementWithQty('kuchnia', clone(savedTwo));
  assert(bothReq.doorRequirements.every((req)=> req.overridden && req.technicalParams.nalozenie.value === 'wpuszczany'), 'Zmień oba ma zapisać ten sam override po obu stronach');
}

async function runPanelCheck(){
  const ctx = loadCatalogContext();
  const api = ctx.window.FC.cabinetHardwareRequirementsPanel;
  const reqApi = ctx.window.FC.cabinetHardwareRequirements;
  const draft = { type:'stojąca', subType:'standard', width:80, height:82, frontCount:2, frontMaterial:'laminat', details:{} };
  const container = { innerHTML:'' };
  api.renderPanel(container, 'kuchnia', draft);
  assert(container.innerHTML.includes('cabinet-hardware-req-door-pair'), 'panel dwudrzwiowy musi renderować układ dwóch kolumn');
  assert(container.innerHTML.includes('cabinet-hardware-req-door-divider'), 'lewe i prawe drzwiczki muszą być oddzielone pionową kreską');
  assert(container.innerHTML.includes('Lewe drzwiczki'), 'panel musi pokazać lewą stronę');
  assert(container.innerHTML.includes('Prawe drzwiczki'), 'panel musi pokazać prawą stronę');
  assert(container.innerHTML.includes('data-req-action="hinge-change"'), 'wymagania muszą mieć przycisk Zmień otwierający aplikacyjny wybór');
  assert(container.innerHTML.includes('data-req-action="hinge-default"'), 'wymagania muszą mieć przycisk Przywróć domyślne');
  assert(container.innerHTML.includes('data-req-action="hinge-change-all"') && container.innerHTML.includes('Zmień oba'), 'układ dwudrzwiowy musi mieć wspólny przycisk Zmień oba pod obydwoma frontami');
  assert(container.innerHTML.includes('data-req-action="hinge-default-all"') && container.innerHTML.includes('Przywróć domyślne dla obu'), 'układ dwudrzwiowy musi mieć wspólne przywracanie domyślnych dla obu frontów');
  assert(container.innerHTML.includes('Domyślnie'), 'panel ma pokazywać skrócony status domyślnego wymagania');
  assert(container.innerHTML.includes('Komplet zawiasowy'), 'panel ma używać pojęcia kompletu zawiasowego, nie samego zawiasu');
  assert(!/\bBLUM\b|\bBlum\b|\bGTV\b/.test(container.innerHTML), 'panel nadal nie może pokazywać producenta/modelu katalogowego');

  const singleDraft = { type:'stojąca', subType:'standard', width:60, height:82, frontCount:1, frontMaterial:'laminat', details:{} };
  const singleContainer = { innerHTML:'' };
  api.renderPanel(singleContainer, 'kuchnia', singleDraft);
  assert(!singleContainer.innerHTML.includes('Lewe drzwiczki') && !singleContainer.innerHTML.includes('Prawe drzwiczki'), 'szafka z jednym frontem nie może renderować układu lewe/prawe');
  assert(singleContainer.innerHTML.includes('Drzwiczki'), 'szafka z jednym frontem ma pokazać pojedyncze drzwiczki');
  assert(singleContainer.innerHTML.includes('110° nakładany'), 'domyślne wymaganie pojedynczego frontu ma pozostać 110°, a nie kąt katalogowego zamiennika 107°');

  reqApi.setHingeDoorOverride(draft, 'left', { typeId:reqApi.HINGE_TYPES.PARALLEL_INSET });
  api.renderPanel(container, 'kuchnia', draft);
  assert(container.innerHTML.includes('Lewe drzwiczki') && container.innerHTML.includes('Prawe drzwiczki'), 'po zmianie jednych drzwiczek układ lewe/prawe nie może znikać');
  assert(container.innerHTML.includes('Ręcznie') && container.innerHTML.includes('Domyślnie'), 'panel ma pokazać ręczne nadpisanie tylko przy zmienionej stronie');

  const leftReq = reqApi.getHingeRequirementWithQty('kuchnia', draft).doorRequirements[0];
  const options = api.buildHingeChoiceOptions(leftReq);
  assert(options.length >= 5, 'wybór ma bazować na pełnych wariantach z katalogu');
  assert(options.every((opt)=> !/ilość:\s*0 kpl\./.test(String(opt.description || ''))), 'lista wyboru wariantu nie może pokazywać ilości 0 kpl.; ilość należy do szafki');

  const titles = [];
  ctx.window.FC.rozrysChoice = {
    async openRozrysChoiceOverlay(cfg){
      const title = String(cfg.title || '');
      titles.push(title);
      if(title.includes('typ')) return 'nakładany';
      if(title.includes('klasę') || title.includes('zakres')) return 'standardowy 90–120°';
      if(title.includes('rzeczywisty') || title.includes('nominalny')) return '110';
      if(title.includes('prowadnik')) return 'standardowy';
      if(title.includes('hamulec')) return 'true';
      if(title.includes('sprężyn')) return 'false';
      return null;
    }
  };
  const picked = await api.openHingeChoice(leftReq);
  assert(picked === reqApi.HINGE_TYPES.OVERLAY_110, 'kaskadowy wybór nakładany → standardowy 90–120° → 110° → standardowy → hamulec ma wrócić do standardowego 110°');
  assert(titles.some((title)=> title.includes('typ')) && titles.some((title)=> title.includes('prowadnik') || title.includes('hamulec') || title.includes('klas') || title.includes('zakres') || title.includes('rzeczywisty')), 'wybór zawiasu ma być kaskadowy, a nie jedną długą listą wariantów');
}

async function runChangeButtonMustOpenFallbackAndNotOverrideSameValue(){
  const ctx = loadContext();
  const api = ctx.window.FC.cabinetHardwareRequirementsPanel;
  const reqApi = ctx.window.FC.cabinetHardwareRequirements;
  const draft = { type:'stojąca', subType:'standard', width:80, height:82, frontCount:2, frontMaterial:'laminat', details:{} };

  const opened = [];
  ctx.window.FC.rozrysChoice = {
    async openRozrysChoiceOverlay(cfg){
      opened.push(cfg);
      return reqApi.HINGE_TYPES.OVERLAY_110;
    }
  };

  const req = reqApi.getHingeRequirementWithQty('kuchnia', draft).doorRequirements[0];
  const picked = await api.openHingeChoice(req);
  assert(opened.length === 1, 'kliknięcie Zmień musi otworzyć modal nawet wtedy, gdy kaskada nie ma wielu wartości');
  assert(String(opened[0].title || '').includes('Wybierz wymaganie kompletu zawiasowego'), 'fallback wyboru musi mieć czytelny tytuł zamiast milczeć');
  assert(picked === reqApi.HINGE_TYPES.OVERLAY_110, 'fallback wyboru musi zwrócić bieżący typ, jeśli użytkownik go kliknie');

  const container = {
    innerHTML:'',
    addEventListener(type, handler){ if(type === 'click') this.__clickHandler = handler; }
  };
  api.renderPanel(container, 'kuchnia', draft);
  assert(typeof container.__clickHandler === 'function', 'panel musi podpiąć obsługę kliknięcia Zmień');
  const fakeTarget = {
    closest(){ return this; },
    getAttribute(name){
      if(name === 'data-req-action') return 'hinge-change';
      if(name === 'data-door-key') return 'left';
      return '';
    }
  };
  await container.__clickHandler({ target:fakeTarget, preventDefault(){}, stopPropagation(){} });
  assert(!(draft.hardwareRequirementOverrides && draft.hardwareRequirementOverrides.hinges && draft.hardwareRequirementOverrides.hinges.doors && draft.hardwareRequirementOverrides.hinges.doors.left), 'wybranie tej samej wartości domyślnej nie może zapisać ręcznego override');
}

async function runReusedPanelContainerUsesLatestDraftCheck(){
  const ctx = loadCatalogContext();
  const panelApi = ctx.window.FC.cabinetHardwareRequirementsPanel;
  const reqApi = ctx.window.FC.cabinetHardwareRequirements;
  const firstDraft = { id:'first', type:'stojąca', subType:'standard', width:80, height:82, frontCount:2, frontMaterial:'laminat', details:{} };
  const secondDraft = { id:'second', type:'stojąca', subType:'standard', width:60, height:82, frontCount:1, frontMaterial:'laminat', details:{} };
  const container = {
    innerHTML:'',
    addEventListener(type, handler){ if(type === 'click') this.__clickHandler = handler; }
  };

  panelApi.renderPanel(container, 'kuchnia', firstDraft);
  panelApi.renderPanel(container, 'kuchnia', secondDraft);
  assert(typeof container.__clickHandler === 'function', 'panel musi mieć jeden delegowany listener kliknięć');

  ctx.window.FC.rozrysChoice = {
    async openRozrysChoiceOverlay(cfg){
      const title = String(cfg.title || '');
      if(title.includes('typ')) return 'równoległy wpuszczany';
      if(title.includes('klas') || title.includes('zakres')) return 'równoległy wpuszczany 95°';
      if(title.includes('rzeczywisty') || title.includes('nominalny')) return '95';
      if(title.includes('prowadnik')) return 'specjalny';
      if(title.includes('hamulec')) return 'false';
      if(title.includes('sprężyn')) return 'false';
      return reqApi.HINGE_TYPES.PARALLEL_INSET;
    }
  };

  const fakeTarget = {
    closest(){ return this; },
    getAttribute(name){
      if(name === 'data-req-action') return 'hinge-change';
      if(name === 'data-door-key') return 'single';
      return '';
    }
  };
  await container.__clickHandler({ target:fakeTarget, preventDefault(){}, stopPropagation(){} });

  assert(!(firstDraft.hardwareRequirementOverrides), 'listener nie może zmienić starego draftu z poprzedniego renderu');
  assert(secondDraft.hardwareRequirementOverrides && secondDraft.hardwareRequirementOverrides.hinges && secondDraft.hardwareRequirementOverrides.hinges.doors.single, 'listener musi zapisać override do aktualnego draftu modala');
  assert(secondDraft.hardwareRequirementOverrides.hinges.doors.single.typeId === reqApi.HINGE_TYPES.PARALLEL_INSET, 'aktualny draft musi dostać wybrany typ zawiasu');
  assert(!(secondDraft.hardwareRequirementOverrides.hinges.doors.left || secondDraft.hardwareRequirementOverrides.hinges.doors.right), 'pojedynczy front ma zapisać single, bez left/right ze starego renderu');
  const secondReq = reqApi.getHingeRequirementWithQty('kuchnia', secondDraft);
  assert(secondReq.doorRequirements.length === 1 && secondReq.doorRequirements[0].overridden, 'ponowne odczytanie aktualnego draftu ma pokazać ręczny override');
}

function runStaticCheck(){
  const modal = fs.readFileSync(path.join(root, 'js/app/cabinet/cabinet-modal.js'), 'utf8');
  assert(modal.includes('refreshCabinetHardwareRequirementsPanel'), 'modal musi mieć odświeżanie panelu wymagań na żywo');
  assert(modal.includes('fcSel.onchange') && modal.includes('refreshCabinetHardwareRequirementsPanel();'), 'zmiana liczby frontów musi odświeżać wymagania');
  const css = fs.readFileSync(path.join(root, 'css/cabinet-common.css'), 'utf8');
  assert(css.includes('cabinet-hardware-req-door-pair') && css.includes('cabinet-hardware-req-door-divider'), 'brak stylów dwóch kolumn i pionowej kreski');
  assert(css.includes('cabinet-hardware-req-actions') && css.includes('cabinet-hardware-req-summary'), 'brak stylów skrótu i przycisków wymagań');
  assert(css.includes('cabinet-hardware-req-pair-actions'), 'brak stylów wspólnych przycisków dla obu drzwiczek');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(html.includes('20260604_help_qmark_global_shape_fix_v1'), 'index musi mieć aktualny cache-busting tej paczki');
}

(async function main(){
  runCatalogDrivenOptionsCheck();
  runNoHardcodedOptionFallbackCheck();
  runPerDoorCheck();
  runOverridePersistenceAndMaterialCheck();
  await runPanelCheck();
  await runChangeButtonMustOpenFallbackAndNotOverrideSameValue();
  await runReusedPanelContainerUsesLatestDraftCheck();
  runStaticCheck();
  console.log('OK cabinet-hardware-requirements-live-edit smoke');
})().catch((err)=> { console.error(err && err.stack || err); process.exit(1); });

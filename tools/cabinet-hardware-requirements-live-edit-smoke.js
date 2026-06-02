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

function runPanelCheck(){
  const ctx = loadCatalogContext();
  const api = ctx.window.FC.cabinetHardwareRequirementsPanel;
  const container = { innerHTML:'' };
  api.renderPanel(container, 'kuchnia', { type:'stojąca', subType:'standard', width:80, height:82, frontCount:2, frontMaterial:'laminat', details:{} });
  assert(container.innerHTML.includes('cabinet-hardware-req-door-pair'), 'panel dwudrzwiowy musi renderować układ dwóch kolumn');
  assert(container.innerHTML.includes('cabinet-hardware-req-door-divider'), 'lewe i prawe drzwiczki muszą być oddzielone pionową kreską');
  assert(container.innerHTML.includes('Lewe drzwiczki'), 'panel musi pokazać lewą stronę');
  assert(container.innerHTML.includes('Prawe drzwiczki'), 'panel musi pokazać prawą stronę');
  assert(container.innerHTML.includes('data-req-action="hinge-type"'), 'typ zawiasu musi być edytowalny przez launcher/select aplikacji');
  assert(container.innerHTML.includes('110° wpuszczany'), 'wybór musi zawierać zawias wpuszczany dostępny w systemie');
  assert(container.innerHTML.includes('Komplet zawiasowy'), 'panel ma używać pojęcia kompletu zawiasowego, nie samego zawiasu');
  assert(!/\bBLUM\b|\bBlum\b|\bGTV\b/.test(container.innerHTML), 'panel nadal nie może pokazywać producenta/modelu katalogowego');
}

function runStaticCheck(){
  const modal = fs.readFileSync(path.join(root, 'js/app/cabinet/cabinet-modal.js'), 'utf8');
  assert(modal.includes('refreshCabinetHardwareRequirementsPanel'), 'modal musi mieć odświeżanie panelu wymagań na żywo');
  assert(modal.includes('fcSel.onchange') && modal.includes('refreshCabinetHardwareRequirementsPanel();'), 'zmiana liczby frontów musi odświeżać wymagania');
  const css = fs.readFileSync(path.join(root, 'css/cabinet-common.css'), 'utf8');
  assert(css.includes('cabinet-hardware-req-door-pair') && css.includes('cabinet-hardware-req-door-divider'), 'brak stylów dwóch kolumn i pionowej kreski');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(html.includes('20260603_hinge_catalog_requirement_options_v1'), 'index musi mieć aktualny cache-busting tej paczki');
}

runCatalogDrivenOptionsCheck();
runNoHardcodedOptionFallbackCheck();
runPerDoorCheck();
runPanelCheck();
runStaticCheck();
console.log('OK cabinet-hardware-requirements-live-edit smoke');

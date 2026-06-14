#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function assert(cond, msg){ if(!cond) throw new Error(msg); }

function loadContext(){
  const FC = { frontHardware:{ getHingeCountForCabinet(){ return 4; }, getDoorFrontPanelsForHinges(room, cab){ const count = Number(cab && cab.frontCount) || 1; return Array.from({ length:count }, ()=> ({ w:30, h:Number(cab && cab.height) || 82, material:'laminat', hasHandle:true })); }, blumHingesPerDoor(){ return 2; } } };
  const ctx = {
    window:{ FC },
    FC,
    console,
    document:{ getElementById(){ return null; } },
  };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  ['js/app/cabinet/cabinet-hardware-requirement-options.js', 'js/app/cabinet/cabinet-hardware-requirements.js', 'js/app/cabinet/cabinet-hardware-requirements-panel.js']
    .forEach((file)=> vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename:file }));
  return ctx;
}

function runRenderCheck(){
  const ctx = loadContext();
  const api = ctx.window.FC.cabinetHardwareRequirementsPanel;
  assert(api && typeof api.renderPanel === 'function', 'brak panelu wymagań technicznych');
  const container = { innerHTML:'' };
  const reqs = api.renderPanel(container, 'kuchnia', { id:'cab1', type:'stojąca', subType:'drzwi', width:60, height:82, depth:51, frontCount:2, frontMaterial:'laminat', details:{} });
  assert(Array.isArray(reqs) && reqs.length === 1, 'panel powinien korzystać z centralnego helpera wymagań');
  assert(container.innerHTML.includes('Wymagania techniczne do wyceny'), 'panel nie ma nagłówka wymagań');
  assert(container.innerHTML.includes('nakładany'), 'panel powinien pokazać cechę zawiasu w skrócie');
  assert(container.innerHTML.includes('110°'), 'panel powinien pokazać kąt otwarcia w skrócie');
  assert(container.innerHTML.includes('prowadnik: standardowy'), 'panel powinien pokazać prowadnik w skrócie');
  assert(container.innerHTML.includes('ilość: 2 kpl.'), 'panel powinien pokazać ilość kompletów per drzwiczki z centralnej reguły');
  assert(container.innerHTML.includes('Zmień'), 'panel powinien mieć przycisk Zmień');
  assert(container.innerHTML.includes('Przywróć domyślne'), 'panel powinien mieć przycisk Przywróć domyślne');
  assert(container.innerHTML.includes('Zmień oba'), 'panel dwudrzwiowy powinien mieć wspólny przycisk Zmień oba');
  assert(container.innerHTML.includes('Przywróć domyślne dla obu'), 'panel dwudrzwiowy powinien mieć wspólny reset domyślnych dla obu');
  assert(!/\bBLUM\b|\bBlum\b|\bGTV\b/.test(container.innerHTML), 'panel nie może pokazywać producenta/modelu katalogowego');
}

function runNoHingeCheck(){
  const ctx = loadContext();
  const api = ctx.window.FC.cabinetHardwareRequirementsPanel;
  const container = { innerHTML:'' };
  api.renderPanel(container, 'kuchnia', { id:'cab2', type:'stojąca', subType:'szuflady', width:80, height:82, depth:51, details:{} });
  assert(container.innerHTML.includes('brak'), 'szafka szufladowa powinna mieć jawny status braku zawiasów');
  assert(container.innerHTML.includes('Szafka szufladowa'), 'panel powinien pokazać powód braku zawiasów');
}

function runStaticCheck(){
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(html.includes('id="cmHardwareRequirements"'), 'modal szafki musi mieć host panelu wymagań technicznych');
  assert(html.includes('cabinet-hardware-requirements-panel.js?v=20260614_labor_readable_modes_v1'), 'index musi ładować moduł panelu wymagań z aktualnym cache-bustingiem');
  const modal = fs.readFileSync(path.join(root, 'js/app/cabinet/cabinet-modal.js'), 'utf8');
  assert(modal.includes('cabinetHardwareRequirementsPanel'), 'modal musi renderować panel przez moduł, nie własną logiką');
  const css = fs.readFileSync(path.join(root, 'css/cabinet-common.css'), 'utf8');
  assert(css.includes('cabinet-hardware-req-panel'), 'brak stylów panelu wymagań technicznych');
  assert(css.includes('cabinet-hardware-req-actions') && css.includes('cabinet-hardware-req-summary'), 'brak stylów skróconego widoku i przycisków');
  assert(css.includes('cabinet-hardware-req-pair-actions'), 'brak stylów wspólnych przycisków dwudrzwiowych');
}

runRenderCheck();
runNoHingeCheck();
runStaticCheck();
console.log('OK cabinet-hardware-requirements-panel smoke');

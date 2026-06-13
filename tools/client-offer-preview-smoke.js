#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function fail(message, details){
  console.error('FAIL client-offer-preview-smoke:', message);
  if(details !== undefined){ try{ console.error(JSON.stringify(details, null, 2)); }catch(_){ console.error(details); } }
  process.exit(1);
}
function assert(cond, msg, details){ if(!cond) fail(msg, details); }

const version = '20260613_openrouteservice_transport_v1';
const index = read('index.html');
assert(index.includes(version), 'index.html nie ma cache-bustingu podglądu oferty klienta');
assert(index.includes('js/app/quote/quote-client-preview.js?v=' + version), 'index.html nie ładuje modułu quote-client-preview');
const shell = read('js/app/wycena/wycena-tab-shell.js');
assert(shell.includes('Podgląd oferty'), 'Topbar WYCENY nie ma przycisku Podgląd oferty');
assert(shell.includes('FC.quoteClientPreview.open(currentQuote)'), 'Przycisk nie otwiera modułu podglądu oferty klienta');
const css = read('css/wycena.css');
assert(css.includes('Oferta dla klienta — podgląd handlowy'), 'Brak stylów podglądu oferty klienta');
assert(css.includes('#quoteClientOfferPreviewModal'), 'Brak stylów modala oferty klienta');
const dev = read('DEV.md');
assert(dev.includes('PDF klienta zostaje etapem końcowym programu'), 'DEV.md nie zawiera planu PDF jako etapu końcowego');
const opt = read('OPTIMIZATION_PLAN.md');
assert(opt.includes('PDF / wydruk oferty klienta — etap końcowy'), 'OPTIMIZATION_PLAN.md nie ma wpisu o późniejszym PDF');

const sandbox = {
  console, Date, Math, JSON, String, Number, Array, Object, Set, Map, RegExp,
  window:null,
  document:{ createElement(){ return { appendChild(){}, setAttribute(){}, addEventListener(){}, style:{}, childNodes:[], querySelector(){ return null; } }; }, body:{ appendChild(){} }, getElementById(){ return null; }, addEventListener(){}, removeEventListener(){} },
  projectData:{
    kuchnia:{ cabinets:[
      { id:'c1', number:1, type:'stojąca', subType:'standardowa', width:60, height:82, depth:56, bodyColor:'Egger W1100', frontMaterial:'laminat', frontColor:'Grafit mat', backMaterial:'HDF biała', openingSystem:'uchwyt klienta', bodyPcvMode:'body' },
      { id:'c2', number:2, type:'moduł', subType:'otwarty', width:80, height:40, depth:36, bodyColor:'Egger W1100', frontMaterial:'laminat', frontColor:'Grafit mat', backMaterial:'HDF biała', openingSystem:'TIP-ON', bodyPcvMode:'front' },
      { id:'c3', number:3, type:'wisząca', subType:'uchylna', width:90, height:72, depth:32, bodyColor:'Egger W1100', frontMaterial:'laminat', frontColor:'Grafit mat', backMaterial:'HDF biała', openingSystem:'TIP-ON', bodyPcvMode:'front' },
    ]}
  },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.FC = {
  companyProfile:{ read(){ return { company:{ displayName:'Stolarnia Format', phone:'504-094-799', email:'biuro@stolarnia.net' } }; } },
  materialEdgeStore:{ pcvModeLabel(value){ return String(value || '') === 'front' ? 'pod kolor frontów' : 'pod kolor płyty'; } },
  quoteSnapshotStore:{ getScopeRoomLabels(){ return ['Kuchnia']; } },
};
vm.createContext(sandbox);
vm.runInContext(read('js/app/quote/quote-client-preview.js'), sandbox, { filename:'js/app/quote/quote-client-preview.js' });
assert(sandbox.FC.quoteClientPreview && typeof sandbox.FC.quoteClientPreview.buildSummaryData === 'function', 'Moduł quoteClientPreview nie eksportuje buildSummaryData');
const summary = sandbox.FC.quoteClientPreview.buildSummaryData({
  generatedAt: Date.parse('2026-06-13T10:00:00Z'),
  investor:{ id:'inv1', name:'Jan Klient' },
  project:{ id:'p1', title:'Kuchnia testowa' },
  scope:{ selectedRooms:['kuchnia'], roomLabels:['Kuchnia'], materialScopeMode:'both' },
  commercial:{ versionName:'Oferta testowa', offerValidity:'14 dni', leadTime:'6 tygodni' },
  totals:{ grand:12345.67 },
  lines:{
    materials:[
      { name:'Egger W1100', subsection:'Arkusze / rozkrój', qty:3, unit:'ark.' },
      { name:'PCV pod kolor frontów', subsection:'Obrzeża', qty:12, unit:'mb' },
    ],
    accessories:[
      { name:'Blum Clip Top Blumotion', qty:8, unit:'szt.', subsection:'Zawiasy' },
      { name:'Blum Clip Top Blumotion', qty:4, unit:'szt.', subsection:'Zawiasy' },
      { name:'Blum TANDEM 500', qty:2, unit:'kpl.', subsection:'Prowadnice' },
    ],
    agdServices:[{ name:'Montaż zmywarki', qty:1, unit:'szt.' }],
  },
});
assert(summary.grand === 12345.67, 'Podgląd ma zachować cenę końcową');
assert(summary.company.displayName === 'Stolarnia Format', 'Podgląd ma czytać dane firmy z trybika');
assert(summary.zones.find((z)=> z.key === 'lower').count === 1, 'Strefa dolna ma mieć 1 szafkę');
assert(summary.zones.find((z)=> z.key === 'middle').pcvModes.includes('pod kolor frontów'), 'Strefa środkowa ma pokazywać PCV pod fronty');
assert(summary.zones.find((z)=> z.key === 'upper').openingSystems.includes('TIP-ON'), 'Strefa górna ma pokazywać system otwierania');
const hinge = summary.accessories.find((row)=> row.name === 'Blum Clip Top Blumotion');
assert(hinge && hinge.qty === 12, 'Akcesoria mają być agregowane ilościowo bez cen', summary.accessories);
assert(summary.materials.some((row)=> row.name === 'PCV pod kolor frontów'), 'Materiały klienta mają pokazywać PCV opisowo bez arkuszy/cen');
console.log('OK client-offer-preview smoke');

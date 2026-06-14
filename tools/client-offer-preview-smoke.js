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

const version = '20260614_diag_file_labor_view_v1';
const index = read('index.html');
assert(index.includes(version), 'index.html nie ma cache-bustingu podglądu oferty klienta');
assert(index.includes('js/app/quote/quote-client-offer-model.js?v=' + version), 'index.html nie ładuje modułu quote-client-offer-model');
assert(index.includes('js/app/quote/quote-client-preview.js?v=' + version), 'index.html nie ładuje modułu quote-client-preview');
assert(index.indexOf('quote-client-offer-model.js') < index.indexOf('quote-snapshot.js'), 'Model oferty klienta musi ładować się przed quote-snapshot');
const shell = read('js/app/wycena/wycena-tab-shell.js');
assert(shell.includes('Podgląd oferty'), 'Topbar WYCENY nie ma przycisku Podgląd oferty');
assert(shell.includes('FC.quoteClientPreview.open(currentQuote)'), 'Przycisk nie otwiera modułu podglądu oferty klienta');
const css = read('css/wycena.css');
assert(css.includes('Oferta dla klienta — podgląd handlowy'), 'Brak stylów podglądu oferty klienta');
assert(css.includes('#quoteClientOfferPreviewModal'), 'Brak stylów modala oferty klienta');
const dev = read('DEV.md');
assert(dev.includes('Zamrożony model oferty klienta v2'), 'DEV.md nie opisuje zamrożonego modelu oferty klienta');
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
vm.runInContext(read('js/app/quote/quote-client-offer-model.js'), sandbox, { filename:'js/app/quote/quote-client-offer-model.js' });
vm.runInContext(read('js/app/quote/quote-client-preview.js'), sandbox, { filename:'js/app/quote/quote-client-preview.js' });
assert(sandbox.FC.quoteClientOfferModel && typeof sandbox.FC.quoteClientOfferModel.buildFromSnapshot === 'function', 'Moduł quoteClientOfferModel nie eksportuje buildFromSnapshot');
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
    quoteRates:[{ name:'Transport', qty:18, unit:'km', total:200, sourceRole:'transport-distance', quantitySource:'transport.distance_km' }],
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

assert(summary.clientOffer && summary.clientOffer.meta && summary.clientOffer.meta.frozen === true, 'Podgląd ma używać zamrożonego modelu klienta');
assert(summary.sections && summary.sections.includes && summary.sections.includes.some((txt)=> /transport|logistyka/i.test(txt)), 'Model klienta ma mieć dynamiczny zakres transportu, gdy transport jest w snapshotcie');

vm.runInContext(read('js/app/quote/quote-snapshot.js'), sandbox, { filename:'js/app/quote/quote-snapshot.js' });
const frozenSnapshot = sandbox.FC.quoteSnapshot.buildSnapshot({
  generatedAt: Date.parse('2026-06-13T11:00:00Z'),
  investor:{ id:'inv2', name:'Anna Klient', address:'Stary adres 1', city:'Łódź' },
  projectRecord:{ id:'p2', title:'Projekt zamrożony', investorId:'inv2' },
  selectedRooms:['kuchnia'],
  roomLabels:['Kuchnia'],
  commercial:{ versionName:'Oferta zamrożona', offerValidity:'10 dni', leadTime:'5 tygodni', deliveryTerms:'Transport według wyceny', customerNote:'Kolor do potwierdzenia' },
  totals:{ grand:9999 },
  materialLines:[{ name:'Egger W1100', subsection:'Płyta', qty:2, unit:'ark.' }],
  accessoryLines:[{ name:'Blum TANDEM 500', qty:1, unit:'kpl.', subsection:'Prowadnice' }],
  quoteRateLines:[{ name:'Transport', qty:6, unit:'km', total:120, sourceRole:'transport-distance', quantitySource:'transport.distance_km' }],
});
assert(frozenSnapshot.clientOffer && frozenSnapshot.clientOffer.client && frozenSnapshot.clientOffer.client.address.includes('Stary adres'), 'Snapshot nie zamroził danych klienta w clientOffer');
sandbox.projectData.kuchnia.cabinets.push({ id:'late', number:99, type:'wisząca', bodyColor:'Zmienione po ofercie' });
sandbox.FC.companyProfile.read = ()=> ({ company:{ displayName:'Inna firma po zmianie', phone:'000' } });
const frozenSummary = sandbox.FC.quoteClientPreview.buildSummaryData(frozenSnapshot);
assert(frozenSummary.company.displayName === 'Stolarnia Format', 'Podgląd nie może brać zmienionej firmy po zapisaniu snapshotu');
assert(frozenSummary.clientAddress.includes('Stary adres'), 'Podgląd nie może brać zmienionego adresu po zapisaniu snapshotu');
assert(frozenSummary.zones.find((z)=> z.key === 'upper').count === 1, 'Podgląd ma pokazać zamrożoną liczbę szafek, nie aktualny projekt po zmianach');
assert(frozenSummary.sections.terms.includes('Transport według wyceny') && frozenSummary.sections.terms.includes('Kolor do potwierdzenia'), 'Warunki handlowe mają być częścią modelu klienta');

console.log('OK client-offer-preview smoke');

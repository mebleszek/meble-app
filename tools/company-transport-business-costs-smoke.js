#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function read(file){ return fs.readFileSync(path.join(process.cwd(), file), 'utf8'); }
function assert(condition, message){ if(!condition){ throw new Error(message); } }

const index = read('index.html');
const dev = read('dev_tests.html');
const constants = read('js/app/shared/constants.js');
const classifier = read('js/app/shared/data-storage-classifier.js');
const menu = read('js/app/ui/data-settings-menu-view.js');
const modal = read('js/app/ui/data-settings-modal.js');
const companyStore = read('js/app/settings/company-profile-store.js');
const costsStore = read('js/app/settings/business-costs-store.js');
const investorModel = read('js/app/investor/investors-model.js');
const investorEditor = read('js/app/investor/investor-editor-state.js');
const investorRender = read('js/app/investor/investor-ui-render.js');
const orsTransport = read('js/app/investor/openrouteservice-transport.js');
const investorTransport = read('js/app/investor/investor-transport.js');
const sources = read('js/app/pricing/work-quantity-sources.js');
const defs = read('js/app/pricing/labor-catalog-definitions.js');
const offer = read('js/app/wycena/wycena-core-offer.js');

const version = '20260613_ors_geocoding_guard_v1';
[
  'js/app/settings/company-profile-store.js',
  'js/app/settings/business-costs-store.js',
  'js/app/investor/openrouteservice-transport.js',
  'js/app/investor/investor-transport.js',
  'js/app/ui/data-settings-company-view.js',
  'js/app/ui/data-settings-business-costs-view.js'
].forEach((script)=>{
  assert(index.includes(`${script}?v=${version}`), `Brak ${script} w index.html albo zły cache-busting`);
  assert(dev.includes(`${script}?v=${version}`), `Brak ${script} w dev_tests.html albo zły cache-busting`);
});

assert(constants.includes("companyProfile: 'fc_company_profile_v1'"), 'Brak klucza companyProfile w constants');
assert(constants.includes("businessCosts: 'fc_business_costs_v1'"), 'Brak klucza businessCosts w constants');
assert(classifier.includes('fc_company_profile_v1') && classifier.includes('fc_business_costs_v1'), 'Classifier nie opisuje nowych danych');
assert(companyStore.includes('Stolarnia Format') && companyStore.includes('Retkińska 29') && companyStore.includes('504-094-799'), 'Domyślne dane firmy nie są uzupełnione');
assert(companyStore.includes('billableDistanceKm') && companyStore.includes('round_trip') && companyStore.includes('openrouteservice'), 'Brak zasad transportu w companyProfile');
assert(costsStore.includes('Księgowa / biuro rachunkowe') && costsStore.includes('Ochrona / monitoring / alarm') && costsStore.includes('monthlyTotals'), 'Koszty firmy nie mają oczekiwanych pozycji i sumowania');
assert(menu.includes("setView('company')") && menu.includes("setView('businessCosts')"), 'Trybik nie ma kafelków nowych sekcji');
assert(modal.includes("view === 'company'") && modal.includes("view === 'businessCosts'"), 'Modal ustawień nie renderuje nowych widoków');
assert(investorModel.includes('transport: normalizeTransport') && investorEditor.includes('setTransportField') && investorRender.includes('transportPanel'), 'Inwestor nie przenosi transportu przez model/editor/render');
assert(orsTransport.includes('ORS_GEOCODE_URL') && orsTransport.includes('ORS_DIRECTIONS_URL') && orsTransport.includes('openrouteservice.org'), 'Brak modułu OpenRouteService');
assert(investorTransport.includes('calculate-ors') && investorTransport.includes('openRouteServiceTransport') && investorTransport.includes('Otwórz trasę w mapach'), 'Panel inwestora nie ma tras/ORS/map');
assert(sources.includes("code:'transport.distance_km'") && defs.includes("id:'transport_distance_km'"), 'Brak źródła ilości lub definicji transportu');
assert(offer.includes('buildTransportRateLine') && offer.includes('transport.distance_km') && offer.includes('sourceType:\'transport\''), 'WYCENA nie ma automatycznej linii transportu z inwestora');
assert(!read('js/app/ui/data-settings-company-view.js').includes("h('select'") && !read('js/app/ui/data-settings-business-costs-view.js').includes("h('select'"), 'Nowe widoki nie mogą używać natywnych selectów');

console.log('Company/transport/business costs smoke: OK');

#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');
function read(file){ return fs.readFileSync(path.join(process.cwd(), file), 'utf8'); }
function assert(condition, message, data){ if(!condition){ throw new Error(message + (data ? '\n' + JSON.stringify(data, null, 2) : '')); } }
function near(a,b,msg){ if(Math.abs(Number(a)-Number(b)) > 0.001) throw new Error(`${msg}: ${a} !== ${b}`); }

const defs = read('js/app/pricing/labor-catalog-definitions.js');
const sources = read('js/app/pricing/work-quantity-sources.js');
const offer = read('js/app/wycena/wycena-core-offer.js');
const czyn = read('js/tabs/czynnosci.js');
const registerSrc = read('js/app/quote/quote-calculation-register.js');
const snapshotSrc = read('js/app/quote/quote-snapshot.js');

assert(defs.includes("id:'transport_travel_time'"), 'Brak domyślnej pozycji Czas dojazdu');
assert(sources.includes("code:'transport.duration_hours'"), 'Brak źródła transport.duration_hours');
assert(offer.includes('buildTransportTravelTimeLine'), 'WYCENA nie buduje linii Czas dojazdu');
assert(czyn.includes("text:'Inne czynności'"), 'CZYNNOŚCI nie mają akordeonu Inne czynności');
assert(czyn.includes('transport-travel-time') && czyn.includes("breakdownRow('Czas dojazdu'"), 'CZYNNOŚCI mają pokazywać czas dojazdu bez kilometrów');
assert(registerSrc.includes("transport-travel-time") && snapshotSrc.includes("transport-travel-time"), 'Rejestr/snapshot muszą klasyfikować czas dojazdu jako Transport');

const sandbox = { console, window:{}, globalThis:null };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.FC = {
  utils:{ clone:(v)=> JSON.parse(JSON.stringify(v)) },
  wycenaCoreUtils:{ slug:(v)=> String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') },
  laborCatalogDefinitions:null
};
vm.createContext(sandbox);
vm.runInContext(defs, sandbox, { filename:'labor-catalog-definitions.js' });
vm.runInContext(read('js/app/pricing/labor-catalog.js'), sandbox, { filename:'labor-catalog.js' });
sandbox.FC.catalogSelectors = { getQuoteRates:()=> sandbox.FC.laborCatalog.ensureDefaultDefinitions([]).concat([{ id:'labor_rate_assembly', category:'Stawki godzinowe', name:'Montażowa', price:240, isHourlyRate:true, rateKey:'assembly', rateCode:'assembly', rateType:'assembly', active:true }]) };
sandbox.FC.quoteOfferStore = { getCurrentDraft:()=> ({ rateSelections:[] }) };
sandbox.FC.investorTransport = { getCurrentTransportContext:()=> ({ billableKm:30, displayValue:'30 km do wyceny', durationMin:45, durationHours:0.75, durationDisplay:'45 min', investor:{ name:'Jan' } }) };
vm.runInContext(offer, sandbox, { filename:'wycena-core-offer.js' });
const lines = sandbox.FC.wycenaCoreOffer.collectQuoteRateLines();
const travel = lines.find((row)=> row.sourceRole === 'transport-travel-time');
assert(travel, 'Brak linii Czas dojazdu w WYCENIE', lines);
near(travel.hours, 0.75, 'Czas dojazdu ma mieć 0.75 h');
near(travel.total, 180, 'Czas dojazdu ma być liczony stawką montażową');
assert(!String(travel.quantitySourceDisplay || '').includes('km'), 'Czas dojazdu nie może pokazywać kilometrów jako źródła');

vm.runInContext(registerSrc, sandbox, { filename:'quote-calculation-register.js' });
const reg = sandbox.FC.quoteCalculationRegister.buildRegister({ quoteRates:lines }, {});
assert(reg.lines.some((row)=> row.section === 'transport' && row.name === 'Czas dojazdu'), 'Czas dojazdu ma trafić do sekcji Transport');
near(reg.totals.transport, lines.reduce((s,r)=> s + (Number(r.total)||0), 0), 'Transport total zawiera km i czas dojazdu');
console.log('other-actions-travel-time-smoke OK');

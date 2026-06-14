#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');
function read(file){ return fs.readFileSync(path.join(process.cwd(), file), 'utf8'); }
function assert(condition, message, data){ if(!condition){ throw new Error(message + (data ? '\n' + JSON.stringify(data, null, 2) : '')); } }
function near(a,b,msg){ if(Math.abs(Number(a)-Number(b)) > 0.001) throw new Error(`${msg}: ${a} !== ${b}`); }

const files = [
  'js/app/material/material-common.js',
  'js/app/cabinet/cabinet-cutlist.js',
  'js/app/pricing/work-quantity-sources.js',
  'js/app/pricing/work-quantity-facts.js',
  'js/app/pricing/labor-catalog-definitions.js',
  'js/app/pricing/labor-catalog.js'
];
const sandbox = {
  console,
  window:{},
  globalThis:null,
  projectData:{ kuchnia:{ settings:{ legHeight:10 }, cabinets:[] } },
  FC:{ utils:{ clone:(v)=> JSON.parse(JSON.stringify(v)) } }
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.window.projectData = sandbox.projectData;
sandbox.window.FC = sandbox.FC;
vm.createContext(sandbox);
files.forEach((file)=> vm.runInContext(read(file), sandbox, { filename:file }));

const parts = sandbox.FC.cabinetCutlist.getCabinetCutList({ id:'cab', type:'stojąca', subType:'standardowa', width:60, height:82, depth:51, bodyColor:'Egger', backMaterial:'HDF', details:{} }, 'kuchnia');
const side = parts.find((p)=> p.name === 'Bok');
const back = parts.find((p)=> p.name === 'Plecy');
assert(side, 'Brak boku w cutliście', parts);
near(side.a, 70.2, 'Bok stojącej 82 cm z nogą 10 ma mieć 70.2 cm');
near(back.b, 71.5, 'Plecy stojącej 82 cm z nogą 10 mają mieć 71.5 cm');

const override = sandbox.FC.cabinetCutlist.getCabinetCutList({ id:'cab2', type:'stojąca', subType:'standardowa', width:60, height:82, depth:51, bodyColor:'Egger', backMaterial:'HDF', details:{ legHeightCm:'15' } }, 'kuchnia');
near(override.find((p)=> p.name === 'Bok').a, 65.2, 'Indywidualna wysokość nóg musi zmienić bok');

const bodyAlready = sandbox.FC.cabinetCutlist.getCabinetCutList({ id:'cab3', type:'stojąca', subType:'standardowa', width:60, height:82, depth:51, bodyColor:'Egger', backMaterial:'HDF', details:{ heightIncludesLegs:'0' } }, 'kuchnia');
near(bodyAlready.find((p)=> p.name === 'Bok').a, 80.2, 'Odznaczone Wysokość z nogami ma nie odejmować nóg od boku');

const map = sandbox.FC.workQuantityFacts.buildCabinetFactMap('kuchnia', { type:'stojąca', width:60, height:82, depth:51, details:{} });
assert(map['cabinet.height_mm'].value === 820, 'Stare cabinet.height_mm zostaje wysokością całkowitą');
assert(map['cabinet.body_height_mm'].value === 720, 'Nowe cabinet.body_height_mm ma odejmować nogi, gdy Wysokość z nogami jest zaznaczone');
near(map['cabinet.body_volume_m3'].value, 0.2203, 'body_volume_m3 ma liczyć gabaryt bez nóg');
const bodyMap = sandbox.FC.workQuantityFacts.buildCabinetFactMap('kuchnia', { type:'stojąca', width:60, height:82, depth:51, details:{ heightIncludesLegs:'0' } });
assert(bodyMap['cabinet.body_height_mm'].value === 820, 'Odznaczone Wysokość z nogami ma zostawić body_height bez odejmowania nóg');

const defs = sandbox.FC.laborCatalog.ensureDefaultDefinitions([
  { id:'labor_body_h072', category:'Korpusy', name:'Skręcenie korpusu do 72 cm', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.height_mm', operator:'range', min:null, max:720 }], timeBlockHours:0.5, active:true },
  { id:'labor_body_h225', category:'Korpusy', name:'Skręcenie korpusu do 225 cm', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.height_mm', operator:'range', min:1501, max:2250 }], timeBlockHours:0.5, active:true }
]);
assert(!defs.some((row)=> row.id === 'labor_body_h072' || row.id === 'labor_body_h225'), 'Stare pozycje skręcania mają zostać usunięte, nie wyłączone');
assert(defs.some((row)=> row.id === 'labor_body_h090' && row.conditions.some((c)=> c.source === 'cabinet.body_height_mm')), 'Brak nowej pozycji do 90 cm po body_height');
assert(defs.some((row)=> row.id === 'labor_body_width_130'), 'Brak dopłaty za szerokość');
console.log('body-height-legs-labor-smoke OK');

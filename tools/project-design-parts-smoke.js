#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');
function read(file){ return fs.readFileSync(path.join(process.cwd(), file), 'utf8'); }
function assert(condition, message, data){ if(!condition){ throw new Error(message + (data ? '\n' + JSON.stringify(data, null, 2) : '')); } }
function near(a,b,msg){ if(Math.abs(Number(a)-Number(b)) > 0.001) throw new Error(`${msg}: ${a} !== ${b}`); }

const index = read('index.html');
const material = read('js/tabs/material.js');
const modal = read('js/app/cabinet/cabinet-modal.js');
const fronts = read('js/app/cabinet/cabinet-fronts.js');
const defs = read('js/app/pricing/labor-catalog-definitions.js');
const sources = read('js/app/pricing/work-quantity-sources.js');
const factsSrc = read('js/app/pricing/work-quantity-facts.js');
const laborSrc = read('js/app/pricing/labor-catalog.js');
const laborCore = read('js/app/wycena/wycena-core-labor.js');
const derived = read('js/app/cabinet/cabinet-derived-facts.js');

assert(index.includes('cmProjectUnusual'), 'Modal szafki musi mieć ptaszek Nietypowy projekt');
assert(index.includes('0.016666666666666666') && index.includes('1 min'), 'Cennik ma mieć opcję 1 min w selectach czasu');
assert(material.includes('Formatki: ${partCount} szt.'), 'MATERIAŁ ma pokazywać podsumowanie ilości formatek szafki');
assert(modal.includes('syncProjectUnusualUi') && fronts.includes('det.projectUnusual'), 'Ptaszek Nietypowy projekt musi synchronizować się z draftem/szafką');
assert(sources.includes("code:'cabinet.part_count'") && sources.includes("code:'cabinet.unusual_project_count'"), 'Brak źródeł cabinet.part_count / cabinet.unusual_project_count');
assert(defs.includes("id:'project_design_parts'") && defs.includes("id:'project_design_unusual'"), 'Brak startowych pozycji projektu technicznego');
assert(laborCore.includes('collectProjectPreparationLines') && laborCore.includes('project-design-parts') && laborCore.includes('project-design-unusual'), 'WYCENA ma osobny kolektor Projekt i przygotowanie');
assert(!laborCore.includes('project-design-parts-labor') && !laborCore.includes('project-design-unusual-labor'), 'Pozycje projektu nie mogą już mieć roli robocizny szafek');
assert(read('js/app/quote/quote-calculation-register.js').includes("project:'Projekt i przygotowanie'"), 'Rejestr wyliczeń musi mieć dział Projekt i przygotowanie');
assert(derived.includes("const VERSION = '20260618_wycena_boot_dependency_retry_v1'"), 'derivedFacts musi mieć nową wersję cache');

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
[
  'js/app/material/material-common.js',
  'js/app/cabinet/cabinet-cutlist.js',
  'js/app/pricing/work-quantity-sources.js',
  'js/app/pricing/work-quantity-facts.js',
  'js/app/pricing/labor-catalog-definitions.js',
  'js/app/pricing/labor-catalog.js'
].forEach((file)=> vm.runInContext(read(file), sandbox, { filename:file }));

const cabinet = { id:'cab', type:'stojąca', subType:'standardowa', width:60, height:82, depth:51, bodyColor:'Egger', frontMaterial:'laminat', frontColor:'Egger', backMaterial:'HDF', frontCount:1, details:{ projectUnusual:'1' } };
const parts = sandbox.FC.cabinetCutlist.getCabinetCutList(cabinet, 'kuchnia');
const expectedCount = parts.reduce((sum, part)=> sum + (((Number(part.a)||0)>0 && (Number(part.b)||0)>0) ? Math.max(0, Math.round(Number(part.qty)||0)) : 0), 0);
const map = sandbox.FC.workQuantityFacts.buildCabinetFactMap('kuchnia', cabinet);
assert(map['cabinet.part_count'].value === expectedCount, 'cabinet.part_count ma liczyć qty formatek z cutlisty', { expectedCount, value:map['cabinet.part_count'].value, parts });
assert(map['cabinet.unusual_project_count'].value === 1, 'Nietypowy projekt ma zwracać 1');
const normalMap = sandbox.FC.workQuantityFacts.buildCabinetFactMap('kuchnia', Object.assign({}, cabinet, { details:{} }));
assert(normalMap['cabinet.unusual_project_count'].value === 0, 'Brak ptaszka ma zwracać 0');

const normalizedParts = sandbox.FC.laborCatalog.normalizeDefinition(sandbox.FC.laborCatalogDefinitions.DEFAULT_LABOR_DEFINITIONS.find((row)=> row.id === 'project_design_parts'));
near(normalizedParts.timeBlockHours, 1/60, '1 minuta nie może być ucinana przez clampTimeBlock');
assert(normalizedParts.rateType === 'specialist', 'Projekt formatek ma używać stawki specjalistycznej startowo');
const calc = sandbox.FC.laborCatalog.calculateDefinition(normalizedParts, { quantity:10, hourlyRates:{ specialist:300 } });
near(calc.pricedHours, 10/60, '10 formatek × 1 min');
near(calc.total, 50, '10 formatek × 1 min × 300 zł/h = 50 zł');
console.log('project-design-parts-smoke OK');

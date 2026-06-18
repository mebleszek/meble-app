#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg, data){ if(!cond){ throw new Error(msg + (data ? '\n' + JSON.stringify(data, null, 2) : '')); } }
function close(actual, expected, msg){ if(Math.abs(Number(actual) - Number(expected)) > 0.001){ throw new Error(`${msg}: ${actual} !== ${expected}`); } }

const version = '20260618_wycena_boot_dependency_retry_v1';
assert(read('index.html').includes(version), 'index.html ma mieć aktualny build/cache-busting działu Projekt i przygotowanie');
assert(read('dev_tests.html').includes(version), 'dev_tests.html ma mieć aktualny build/cache-busting działu Projekt i przygotowanie');

const laborCore = read('js/app/wycena/wycena-core-labor.js');
const registerSrc = read('js/app/quote/quote-calculation-register.js');
const snapshotSrc = read('js/app/quote/quote-snapshot.js');
const previewSrc = read('js/app/wycena/wycena-tab-preview.js');
const detailsSrc = read('js/app/wycena/wycena-summary-details-modal.js');
assert(laborCore.includes('collectProjectPreparationLines'), 'WYCENA musi mieć osobny kolektor Projekt i przygotowanie');
assert(laborCore.includes('isProjectAutomation'), 'Automaty projektu muszą być klasyfikowane po roli/kategorii, nie po zdublowanej matematyce');
assert(!laborCore.includes('project-design-parts-labor') && !laborCore.includes('project-design-unusual-labor'), 'Stare role projektu jako robocizna szafek nie mogą zostać w kodzie');
assert(registerSrc.includes("project:'Projekt i przygotowanie'"), 'Rejestr wyliczeń musi mieć sekcję Projekt i przygotowanie');
assert(snapshotSrc.includes('project: normalizeLaborLines') && snapshotSrc.includes('const project = Math.max'), 'Snapshot musi przechowywać lines.project i totals.project');
assert(previewSrc.includes("'Projekt i przygotowanie', totals.project, 'project'"), 'Podsumowanie WYCENY musi pokazywać dział Projekt i przygotowanie');
assert(detailsSrc.includes("['labor','project'].includes"), 'Modal szczegółów musi renderować szczegóły projektu jak linie czasowe');

const sandbox = {
  console,
  Date, Math, JSON, String, Number, Array, Object, Set, Map,
  window:{},
  globalThis:null,
  FC:{
    utils:{ clone:(value)=> JSON.parse(JSON.stringify(value)) },
    wycenaCoreUtils:{
      slug:(value)=> String(value == null ? '' : value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    },
  },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.FC = sandbox.FC;
vm.createContext(sandbox);
['js/app/quote/quote-calculation-register.js','js/app/quote/quote-snapshot.js'].forEach((file)=> vm.runInContext(read(file), sandbox, { filename:file }));

const projectLines = [
  {
    key:'kuchnia_cab1_project', type:'project-cabinet', category:'Projekt i przygotowanie', name:'Projekt — szafka #1 — Kuchnia', total:50, details:[{
      key:'project_design_parts', name:'Projekt techniczny — formatki', category:'Projekt', sourceType:'cabinet', sourceLabel:'Szafka #1 — Kuchnia', sourceId:'cab1', sourceRole:'project-design-parts', sourceKind:'automatic',
      quantitySource:'cabinet.part_count', quantitySourceLabel:'Ilość formatek szafki', quantitySourceValue:10, quantitySourceDisplay:'10 szt.', quantitySourceUsed:true,
      quantity:10, unit:'szt.', total:50, hours:10/60, baseHours:10/60, hourlyRate:300, timeBlockHours:1/60, quantityMode:'linear', rateType:'specialist'
    }]
  },
  {
    key:'kuchnia_cab2_project', type:'project-cabinet', category:'Projekt i przygotowanie', name:'Projekt — szafka #2 — Kuchnia', total:90, details:[{
      key:'project_design_unusual', name:'Projekt techniczny — nietypowa szafka', category:'Projekt', sourceType:'cabinet', sourceLabel:'Szafka #2 — Kuchnia', sourceId:'cab2', sourceRole:'project-design-unusual', sourceKind:'automatic',
      quantitySource:'cabinet.unusual_project_count', quantitySourceLabel:'Nietypowy projekt', quantitySourceValue:1, quantitySourceDisplay:'tak', quantitySourceUsed:true,
      quantity:1, unit:'szt.', total:90, hours:0.3, baseHours:0.25, volumeHours:0.05, volumeM3:0.05, hourlyRate:300, timeBlockHours:0.25, quantityMode:'linear', rateType:'specialist'
    }]
  }
];
const laborLines = [{
  key:'kuchnia_cab1_labor', type:'labor-cabinet', category:'Robocizna szafek', name:'Szafka #1 — Kuchnia', total:100, details:[{
    key:'labor_body', name:'Skręcenie korpusu', category:'Korpus', sourceRole:'cabinet-body-labor', sourceType:'cabinet', sourceLabel:'Szafka #1 — Kuchnia', quantity:1, unit:'szt.', total:100, hours:0.5, hourlyRate:200
  }]
}];

const register = sandbox.FC.quoteCalculationRegister.buildRegister({ project:projectLines, labor:laborLines }, {});
close(register.totals.project, 140, 'Rejestr ma osobny total projektu');
close(register.totals.labor, 100, 'Robocizna szafek nie może zawierać projektu');
close(register.totals.subtotal, 240, 'Subtotal ma zawierać projekt i robociznę');
close(register.totals.grand, 240, 'Grand total ma zawierać projekt');
const projectRows = register.lines.filter((row)=> row.section === 'project');
const laborRows = register.lines.filter((row)=> row.section === 'labor');
assert(projectRows.some((row)=> row.id === 'project_design_parts' && row.sectionLabel === 'Projekt i przygotowanie'), 'project_design_parts ma trafić do Projekt i przygotowanie', projectRows);
assert(projectRows.some((row)=> row.id === 'project_design_unusual' && row.sectionLabel === 'Projekt i przygotowanie'), 'project_design_unusual ma trafić do Projekt i przygotowanie', projectRows);
assert(!laborRows.some((row)=> /Projekt techniczny/.test(row.name) || row.id === 'project_design_parts' || row.id === 'project_design_unusual'), 'Robocizna szafek nie może zawierać pozycji projektu', laborRows);
assert(projectRows.some((row)=> row.quantitySource === 'cabinet.part_count' && row.quantitySourceDisplay === '10 szt.' && row.hours > 0 && row.hourlyRate === 300 && row.calculation.includes('10')), 'Szczegóły formatek mają pokazać źródło ilości, czas, stawkę i wyliczenie', projectRows);
assert(projectRows.some((row)=> row.quantitySource === 'cabinet.unusual_project_count' && row.quantitySourceDisplay === 'tak' && row.hours > 0 && row.hourlyRate === 300 && row.calculation.includes('gabarytoczas')), 'Szczegóły nietypowego projektu mają pokazać informację o nietypowości, czas, stawkę i gabarytoczas', projectRows);

const snapshot = sandbox.FC.quoteSnapshot.buildSnapshot({ lines:{ project:projectLines, labor:laborLines }, commercial:{} });
close(snapshot.totals.project, 140, 'Snapshot ma osobny total projektu');
close(snapshot.totals.labor, 100, 'Snapshot ma osobny total robocizny');
close(snapshot.totals.grand, 240, 'Snapshotowy total końcowy ma zawierać projekt');
assert(snapshot.lines.project.length === 2, 'Snapshot ma przechowywać lines.project', snapshot.lines);
assert(snapshot.lines.labor.length === 1, 'Snapshot ma zostawić robociznę w lines.labor', snapshot.lines);
assert(snapshot.calculationRegister && snapshot.calculationRegister.totals && snapshot.calculationRegister.totals.project === 140, 'Snapshotowy rejestr wyliczeń ma totals.project', snapshot.calculationRegister && snapshot.calculationRegister.totals);

console.log('quote-project-preparation-section-smoke OK');

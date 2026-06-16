#!/usr/bin/env node
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg, data){ if(!cond){ throw new Error(msg + (data ? '\n' + JSON.stringify(data, null, 2) : '')); } }
function close(actual, expected, msg){ if(Math.abs(Number(actual) - Number(expected)) > 0.001){ throw new Error(`${msg}: ${actual} !== ${expected}`); } }

const src = read('js/tabs/czynnosci.js');
assert(src.includes('collectProjectPreparationLines'), 'CZYNNOŚCI muszą pobierać Projekt i przygotowanie z kolektora WYCENY');
assert(src.includes('buildProjectPreparationActionRows'), 'CZYNNOŚCI muszą mieć osobny adapter projektu do Innych czynności');
assert(src.includes('buildOtherActionRows,'), 'buildOtherActionRows musi być eksportowany do testów/regresji');

const calls = [];
const sandbox = {
  console,
  window:{},
  globalThis:null,
  document:{ createElement(tag){ return { tagName:tag, childNodes:[], appendChild(child){ this.childNodes.push(child); }, setAttribute(){}, addEventListener(){}, querySelectorAll(){ return []; }, classList:{ add(){}, remove(){} } }; } },
  FC:{
    wycenaTabDom:{ h(tag, attrs, children){ return { tagName:tag, attrs:attrs || {}, children:children || [], childNodes:[], appendChild(child){ this.children.push(child); this.childNodes.push(child); }, setAttribute(){}, addEventListener(){}, querySelectorAll(){ return []; }, classList:{ add(){}, remove(){} } }; } },
    quoteOfferStore:{ getCurrentDraft(){ return { selection:{ selectedRooms:['fallback-room'] }, rateSelections:[], commercial:{} }; } },
    wycenaCoreOffer:{ collectQuoteRateLines(){ return [
      { name:'Transport do klienta', sourceRole:'transport-distance', quantitySource:'transport.distance_km', sourceId:'transport_distance_km', hours:0, category:'Transport' },
      { name:'Czas dojazdu', sourceRole:'transport-travel-time', hours:0.5, baseHours:0.5, rateType:'assembly', category:'Transport' }
    ]; } },
    wycenaCoreLabor:{ collectProjectPreparationLines(roomIds){
      calls.push(roomIds.slice());
      return [{
        name:'Projekt — szafka #1 — S', cabinetId:'cab1', details:[
          { key:'project_design_parts', name:'Projekt techniczny — formatki', category:'Projekt', sourceRole:'project-design-parts', sourceType:'cabinet', sourceLabel:'Szafka #1 — S — stojąca / standardowa', sourceId:'cab1', quantitySource:'cabinet.part_count', quantitySourceLabel:'Ilość formatek szafki', quantitySourceDisplay:'10 szt.', quantity:10, unit:'szt.', hours:10/60, baseHours:10/60, timeBlockHours:1/60, quantityMode:'linear', pricingMode:'time', rateType:'specialist', hourlyRate:300, note:'Źródło ilości: Ilość formatek szafki (cabinet.part_count) = 10 szt.' },
          { key:'project_design_unusual', name:'Projekt techniczny — nietypowa szafka', category:'Projekt', sourceRole:'project-design-unusual', sourceType:'cabinet', sourceLabel:'Szafka #1 — S — stojąca / standardowa', sourceId:'cab1', quantitySource:'cabinet.unusual_project_count', quantitySourceLabel:'Nietypowy projekt', quantitySourceDisplay:'tak', quantity:1, unit:'szt.', hours:0.3, baseHours:0.25, volumeHours:0.05, volumeM3:0.05, quantityMode:'linear', pricingMode:'time', rateType:'specialist', hourlyRate:300, note:'Źródło ilości: Nietypowy projekt (cabinet.unusual_project_count) = tak.' }
        ]
      }];
    } },
    laborCatalog:{ getRateLabel(code){ return code; } },
    catalogSelectors:{ getQuoteRates(){ return []; } }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.FC = sandbox.FC;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename:'js/tabs/czynnosci.js' });

assert(sandbox.FC.tabsCzynnosci && typeof sandbox.FC.tabsCzynnosci.buildOtherActionRows === 'function', 'Brak eksportu buildOtherActionRows');
const rows = sandbox.FC.tabsCzynnosci.buildOtherActionRows('S');
assert(calls.length === 1 && calls[0][0] === 'S', 'Projekt w CZYNNOŚCIACH ma być liczony dla bieżącego pomieszczenia', calls);
assert(!rows.some((row)=> row.sourceRole === 'transport-distance'), 'Inne czynności nie mogą pokazywać kilometrów transportu jako czasu', rows);
assert(rows.some((row)=> row.sourceRole === 'transport-travel-time'), 'Inne czynności nadal mają pokazywać czas dojazdu', rows);
assert(rows.some((row)=> row.sourceRole === 'project-design-parts' && row.name === 'Projekt techniczny — formatki'), 'Projekt techniczny — formatki musi trafić do Innych czynności', rows);
assert(rows.some((row)=> row.sourceRole === 'project-design-unusual' && row.name === 'Projekt techniczny — nietypowa szafka'), 'Nietypowy projekt musi trafić do Innych czynności', rows);
assert(rows.every((row)=> Number(row.hours) >= 0), 'Każda pozycja Innych czynności musi mieć normoczas liczbowy', rows);
const totalHours = rows.reduce((sum, row)=> sum + (Number(row.hours) || 0), 0);
close(totalHours, 0.5 + 10/60 + 0.3, 'Normoczas Innych czynności ma zawierać dojazd i projekt');
assert(rows.find((row)=> row.sourceRole === 'project-design-parts').note.includes('Dotyczy: Szafka #1'), 'Projekt w Innych czynnościach ma pokazywać, której szafki dotyczy', rows.find((row)=> row.sourceRole === 'project-design-parts'));

const fallbackRows = sandbox.FC.tabsCzynnosci.buildOtherActionRows('');
assert(calls[1] && calls[1][0] === 'fallback-room', 'Bez bieżącego pomieszczenia projekt korzysta z wyboru oferty jako fallback', calls);
assert(fallbackRows.some((row)=> row.sourceRole === 'project-design-parts'), 'Fallback wyboru oferty nadal ma pokazywać projekt', fallbackRows);

console.log('czynnosci-project-preparation-smoke OK');

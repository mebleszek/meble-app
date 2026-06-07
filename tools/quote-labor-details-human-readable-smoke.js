#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.cwd();
function read(file){ return fs.readFileSync(path.join(root, file), 'utf8'); }
function assert(condition, message, details){
  if(!condition){
    console.error('Quote labor details human readable smoke FAILED');
    console.error(' - ' + message);
    if(details) console.error(details);
    process.exit(1);
  }
}

class FakeClassList{
  constructor(el){ this.el = el; }
  _set(){ return new Set(String(this.el.className || '').split(/\s+/).filter(Boolean)); }
  contains(cls){ return this._set().has(cls); }
  add(cls){ const set = this._set(); set.add(cls); this.el.className = Array.from(set).join(' '); }
  remove(cls){ const set = this._set(); set.delete(cls); this.el.className = Array.from(set).join(' '); }
  toggle(cls, force){
    const set = this._set();
    const next = force == null ? !set.has(cls) : !!force;
    if(next) set.add(cls); else set.delete(cls);
    this.el.className = Array.from(set).join(' ');
    return next;
  }
}
class FakeElement{
  constructor(tag, doc){
    this.tagName = tag.toUpperCase();
    this.ownerDocument = doc;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.style = {};
    this.className = '';
    this.hidden = false;
    this._text = '';
    this.classList = new FakeClassList(this);
  }
  appendChild(child){
    if(child){ child.parentNode = this; this.children.push(child); }
    return child;
  }
  setAttribute(key, value){
    this.attributes[key] = String(value);
    if(key === 'id') this.ownerDocument._byId[String(value)] = this;
    if(key === 'class') this.className = String(value);
  }
  getAttribute(key){ return this.attributes[key]; }
  addEventListener(){ }
  scrollTo(){ }
  scrollIntoView(){ }
  getBoundingClientRect(){ return { top:0, bottom:0, height:0 }; }
  get offsetTop(){ return 0; }
  get scrollHeight(){ return 1; }
  set textContent(value){ this._text = String(value == null ? '' : value); this.children = []; }
  get textContent(){ return this._text + this.children.map((child)=> child.textContent || '').join(''); }
  set innerHTML(value){ this._text = String(value == null ? '' : value).replace(/<[^>]+>/g, ''); this.children = []; }
  get innerHTML(){ return this.textContent; }
  querySelector(){ return null; }
  querySelectorAll(){ return []; }
}
class FakeDocument{
  constructor(){ this._byId = {}; this.body = new FakeElement('body', this); }
  createElement(tag){ return new FakeElement(tag, this); }
  getElementById(id){ return this._byId[id] || null; }
  addEventListener(){ }
}

const source = read('js/app/wycena/wycena-summary-details-modal.js');
const laborRenderer = source.slice(source.indexOf('function renderLaborLine'), source.indexOf('function renderLine'));
assert(!laborRenderer.includes('addInfoButton'), 'linie robocizny nie mogą doklejać znaków zapytania przy wyliczeniu', laborRenderer);

const document = new FakeDocument();
const window = {
  FC:{
    laborCatalog:{ getRateLabel:(code)=> code === 'workshop' ? 'Warsztatowa' : '' },
    catalogSelectors:{ getQuoteRates:()=> [{ id:'labor_rate_workshop', autoRole:'hourlyRate', name:'Stawka warsztatowa', price:150, rateKey:'workshop' }] },
  },
  document,
  requestAnimationFrame:(fn)=> fn(),
  matchMedia:()=> ({ matches:false }),
};
const ctx = { window, document, console, setTimeout, clearTimeout };
ctx.globalThis = window;
vm.createContext(ctx);
vm.runInContext(source, ctx, { filename:'wycena-summary-details-modal.js' });

const baseCabinet = 'Szafka #1 — S — stojąca / standardowa';
const snapshot = {
  calculationRegister:{
    lines:[{
      section:'labor',
      sourceLabel:baseCabinet,
      sourceId:'cab_1',
      workAutomatCode:'front_mount',
      laborAutomatCode:'front_mount',
      name:'Montaż frontu / drzwi',
      quantity:2,
      unit:'szt.',
      unitPrice:37.5,
      total:75,
      starterPrice:true,
      warnings:['Cena startowa — sprawdź i edytuj w cenniku przed realną ofertą.'],
      note:'czas bazowy 0.5 h • czas wyceniony 0.5 h • 150 PLN/h • Fronty z MATERIAŁ/WYCENA: 2× 30 × 72',
      calculation:'Cena = 0.5 h × 150 PLN/h.',
    },{
      section:'labor',
      sourceLabel:baseCabinet + ' — Lewe drzwiczki',
      sourceId:'cab_1',
      workAutomatCode:'hinge_mount',
      laborAutomatCode:'hinge_mount',
      name:'Montaż zawiasu',
      quantity:2,
      unit:'szt.',
      unitPrice:37.5,
      total:75,
      note:'czas bazowy 0.5 h • czas wyceniony 0.5 h • 150 PLN/h • Lewe drzwiczki',
      calculation:'Cena = 0.5 h × 150 PLN/h.',
    },{
      section:'labor',
      sourceLabel:baseCabinet + ' — Prawe drzwiczki',
      sourceId:'cab_1',
      workAutomatCode:'hinge_mount',
      laborAutomatCode:'hinge_mount',
      name:'Montaż zawiasu',
      quantity:2,
      unit:'szt.',
      unitPrice:37.5,
      total:75,
      note:'czas bazowy 0.5 h • czas wyceniony 0.5 h • 150 PLN/h • Prawe drzwiczki',
      calculation:'Cena = 0.5 h × 150 PLN/h.',
    }],
    totals:{ labor:225, subtotal:225, grand:225 },
    warnings:[],
  }
};
window.FC.wycenaSummaryDetailsModal.open(snapshot, 'labor');
const title = document.getElementById('quoteSummaryDetailsTitle');
const subtitle = document.getElementById('quoteSummaryDetailsSubtitle');
const body = document.getElementById('quoteSummaryDetailsBody');
const bodyText = body.textContent;

assert(title && title.textContent === 'Szczegóły robocizny szafek', 'nagłówek modala robocizny jest ludzki', title && title.textContent);
assert(subtitle && subtitle.textContent === 'Sprawdź, co zostało policzone i skąd wzięła się kwota.', 'podtytuł modala robocizny jest ludzki', subtitle && subtitle.textContent);
assert(bodyText.includes('3 czynności razem = 225,00 zł • czas: 1,5 h'), 'podsumowanie szafki używa „czynności razem” i pokazuje łączny czas z notatki rejestru', bodyText);
assert(!bodyText.includes('1 poz.'), 'podsumowanie robocizny nie używa skrótu „poz.”', bodyText);
const cabinetTitleCount = (bodyText.match(new RegExp(baseCabinet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
assert(cabinetTitleCount === 1, 'jedna szafka ma jeden akordeon, także gdy ma lewe i prawe drzwiczki', bodyText);
['Dotyczy: 2 frontów 30 × 72 cm', 'Czas na 1 sztukę: 0,25 h', 'Czas razem: 2 × 0,25 h = 0,5 h', 'Stawka warsztatowa: 150 zł/h', 'Razem: 2 × 0,25 h × 150 zł/h = 75,00 zł', 'Dotyczy: Lewe drzwiczki: 2 zawiasów', 'Dotyczy: Prawe drzwiczki: 2 zawiasów'].forEach((needle)=>{
  assert(bodyText.includes(needle), 'brak czytelnej linii robocizny: ' + needle, bodyText);
});
assert(bodyText.includes('To jest stawka startowa. Przed wysłaniem oferty sprawdź ją w cenniku.'), 'komunikat ceny startowej ma nowy tekst', bodyText);
assert(!bodyText.includes('Fronty z MATERIAŁ/WYCENA'), 'główny opis nie pokazuje technicznego źródła frontów', bodyText);
assert(!bodyText.includes('PLN'), 'widok robocizny dla człowieka nie pokazuje PLN', bodyText);

console.log('OK quote-labor-details-human-readable smoke');
console.log(' - renderer czyta czas i stawkę także z notatki/calculation rejestru, bez raw');
console.log(' - podsumowanie szafki używa „czynności razem” i pokazuje łączny czas');
console.log(' - lewe/prawe drzwiczki są skomasowane w jednym akordeonie szafki');
console.log(' - pozycja montażu frontu pokazuje Dotyczy/Czas/Stawka/Razem');
console.log(' - przy liniach robocizny nie ma znaków zapytania');

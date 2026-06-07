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

const document = new FakeDocument();
const window = {
  FC:{
    laborCatalog:{ getRateLabel:(code)=> code === 'custom_painter' ? 'Lakiernik' : 'Warsztatowa' },
    catalogSelectors:{ getQuoteRates:()=> [] },
  },
  document,
  requestAnimationFrame:(fn)=> fn(),
  matchMedia:()=> ({ matches:false }),
};
const ctx = { window, document, console, setTimeout, clearTimeout };
ctx.globalThis = window;
vm.createContext(ctx);
vm.runInContext(read('js/app/wycena/wycena-summary-details-modal.js'), ctx, { filename:'wycena-summary-details-modal.js' });

const snapshot = {
  calculationRegister:{
    lines:[{
      section:'labor',
      sourceLabel:'Szafka #1 — S — stojąca / standardowa',
      name:'Montaż frontu / drzwi',
      quantity:2,
      unit:'szt.',
      unitPrice:37.5,
      total:75,
      starterPrice:true,
      warnings:['Cena startowa — sprawdź i edytuj w cenniku przed realną ofertą.'],
      calculation:'Cena = 0.5 h × 150 PLN/h.',
      raw:{
        sourceRole:'front-labor',
        sourceType:'fronts',
        sourceKind:'automatic',
        workAutomatCode:'front_mount',
        laborAutomatCode:'front_mount',
        rateType:'workshop',
        hourlyRate:150,
        baseHours:0.5,
        hours:0.5,
        quantity:2,
        unit:'szt.',
        total:75,
        multiplier:1,
        note:'Fronty z MATERIAŁ/WYCENA: 2× 30 × 72',
      },
    }],
    totals:{ labor:75, subtotal:75, grand:75 },
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
assert(bodyText.includes('1 czynność razem = 75,00 zł'), 'podsumowanie szafki używa „czynność razem”, bez skrótu poz.', bodyText);
assert(!bodyText.includes('1 poz.'), 'podsumowanie robocizny nie używa skrótu „poz.”', bodyText);
['Dotyczy: 2 frontów 30 × 72 cm', 'Czas na 1 sztukę: 0,25 h', 'Stawka warsztatowa: 150 zł/h', 'Razem: 2 × 0,25 h × 150 zł/h = 75,00 zł'].forEach((needle)=>{
  assert(bodyText.includes(needle), 'brak czytelnej linii robocizny: ' + needle, bodyText);
});
assert(bodyText.includes('To jest stawka startowa. Przed wysłaniem oferty sprawdź ją w cenniku.'), 'komunikat ceny startowej ma nowy tekst', bodyText);
assert(!bodyText.includes('Fronty z MATERIAŁ/WYCENA'), 'główny opis nie pokazuje technicznego źródła frontów', bodyText);
assert(!bodyText.includes('PLN'), 'widok robocizny dla człowieka nie pokazuje PLN', bodyText);

console.log('OK quote-labor-details-human-readable smoke');
console.log(' - nagłówek/podtytuł robocizny są po ludzku');
console.log(' - podsumowanie szafki używa „czynność razem”');
console.log(' - pozycja montażu frontu pokazuje Dotyczy/Czas/Stawka/Razem');
console.log(' - stawka startowa ma nowy komunikat i zł zamiast PLN');

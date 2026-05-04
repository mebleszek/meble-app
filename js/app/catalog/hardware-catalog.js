// js/app/catalog/hardware-catalog.js
// Model katalogu okuć/akcesoriów: producenci, kategorie, jednostki i normalizacja pól.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const DEFAULT_MANUFACTURERS = ['Blum','GTV','Peka','Rejs','Nomet','Häfele','Sevroll','Laguna','Hettich'];
  const CATEGORIES = ['Zawiasy','Szuflady / prowadnice','Podnośniki','Cargo / organizery','Uchwyty / profile','Nóżki / cokoły','Systemy przesuwne','LED / elektryka','AGD / montażowe akcesoria','Drobnica','Inne'];
  const UNITS = ['szt.','kpl.','para','mb','zestaw'];
  const STATUSES = [
    { value:'active', label:'Aktywne' },
    { value:'hidden', label:'Ukryte' },
    { value:'archived', label:'Archiwalne' },
  ];

  function clone(value){
    try{ return (FC.utils && typeof FC.utils.clone === 'function') ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }
  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function uniqueText(list){
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).forEach((value)=>{
      const raw = text(value);
      const key = raw.toLowerCase();
      if(!raw || seen.has(key)) return;
      seen.add(key);
      out.push(raw);
    });
    return out;
  }
  function normalizeManufacturerList(list){ return uniqueText(Array.isArray(list) ? list : []); }
  function normalizeStatus(value){
    const raw = text(value) || 'active';
    return STATUSES.some((item)=> item.value === raw) ? raw : 'active';
  }
  function normalizeUnit(value){
    const raw = text(value) || 'szt.';
    return UNITS.includes(raw) ? raw : raw;
  }
  function normalizeCategory(value){
    const raw = text(value) || 'Inne';
    return raw;
  }
  function resolveQuotePrice(src){
    const price = number(src && src.price);
    if(price > 0) return price;
    const purchase = number(src && src.purchasePrice);
    const markup = number(src && src.markupPercent);
    if(purchase > 0 && markup !== 0) return Math.round((purchase * (1 + markup / 100)) * 100) / 100;
    return purchase > 0 ? purchase : 0;
  }
  function normalizeAccessory(row, uidFn){
    const src = row && typeof row === 'object' ? row : {};
    const uid = typeof uidFn === 'function' ? uidFn : ((prefix)=> `${prefix}_${Date.now()}`);
    return {
      id:text(src.id) || uid('a'),
      manufacturer:text(src.manufacturer),
      symbol:text(src.symbol),
      name:text(src.name),
      price:resolveQuotePrice(src),
      hardwareCategory:normalizeCategory(src.hardwareCategory || src.category || ''),
      hardwareUnit:normalizeUnit(src.hardwareUnit || src.unit || 'szt.'),
      series:text(src.series),
      purchasePrice:number(src.purchasePrice),
      markupPercent:number(src.markupPercent),
      priceSource:text(src.priceSource),
      priceUpdatedAt:text(src.priceUpdatedAt),
      status:normalizeStatus(src.status),
      note:text(src.note),
    };
  }
  function statusLabel(value){
    const row = STATUSES.find((item)=> item.value === value);
    return row ? row.label : 'Aktywne';
  }
  function unitOptions(selected){
    const out = UNITS.map((value)=>({ value, label:value }));
    if(selected && !UNITS.includes(String(selected))) out.push({ value:String(selected), label:String(selected) });
    return out;
  }
  function statusOptions(){ return clone(STATUSES); }
  function categoryOptions(dynamic, selected){
    const base = CATEGORIES.concat(Array.isArray(dynamic) ? dynamic : []);
    if(selected) base.push(selected);
    return uniqueText(base).map((value)=>({ value, label:value }));
  }

  FC.hardwareCatalog = {
    DEFAULT_MANUFACTURERS,
    CATEGORIES,
    UNITS,
    STATUSES,
    normalizeManufacturerList,
    normalizeAccessory,
    normalizeStatus,
    normalizeUnit,
    normalizeCategory,
    resolveQuotePrice,
    statusLabel,
    unitOptions,
    statusOptions,
    categoryOptions,
  };
})();

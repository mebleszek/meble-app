// js/app/cabinet/cabinet-hardware-requirement-options.js
// Buduje wybór wymagań zawiasów z katalogu okuć i parametrów technicznych. Bez producenta/modelu w modalu szafki.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const HINGE_TYPES = {
    OVERLAY_110: 'hinge_110_overlay',
    INSET_110: 'hinge_110_inset',
    ZERO_155: 'hinge_155_zero',
    CORNER_170: 'hinge_170_corner',
    PARALLEL_INSET: 'hinge_parallel_inset',
    FRIDGE_OVERLAY: 'hinge_fridge_overlay'
  };

  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function bool(value){
    if(value === true) return true;
    if(value === false) return false;
    const raw = text(value).toLowerCase();
    return ['1','true','tak','yes','y'].includes(raw);
  }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; } }

  function safeKey(value){
    return text(value).toLowerCase().replace(/ł/g, 'l').replace(/Ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }
  function normalizedText(value){ return safeKey(value).replace(/_/g, ' '); }
  function hashKey(value){
    const raw = text(value);
    let h = 0;
    for(let i = 0; i < raw.length; i += 1){ h = ((h << 5) - h + raw.charCodeAt(i)) | 0; }
    return Math.abs(h).toString(36) || '0';
  }
  function getCatalogStore(){
    try{
      if(FC.catalogStore && typeof FC.catalogStore === 'function') return FC.catalogStore();
      if(FC.catalogStore && typeof FC.catalogStore === 'object') return FC.catalogStore;
    }catch(_){ }
    return null;
  }
  function getAccessoryCatalogRows(){
    const store = getCatalogStore();
    try{ if(store && typeof store.getAccessories === 'function') return store.getAccessories() || []; }catch(_){ }
    try{ return Array.isArray(typeof accessories !== 'undefined' ? accessories : []) ? accessories : []; }catch(_){ return []; }
  }
  function getHardwareTechnicalDefinitions(){
    const store = getCatalogStore();
    try{ if(store && typeof store.getHardwareTechnicalParams === 'function') return store.getHardwareTechnicalParams() || []; }catch(_){ }
    return (FC.hardwareTechnicalParams && FC.hardwareTechnicalParams.DEFAULT_DEFINITIONS) || [];
  }
  function getHardwareSuppliers(){
    const store = getCatalogStore();
    try{ if(store && typeof store.getHardwareSuppliers === 'function') return store.getHardwareSuppliers() || []; }catch(_){ }
    return [];
  }
  function getHardwareTypes(){
    const store = getCatalogStore();
    try{ if(store && typeof store.getHardwareTypes === 'function') return store.getHardwareTypes() || []; }catch(_){ }
    return (FC.hardwareCatalog && Array.isArray(FC.hardwareCatalog.DEFAULT_TYPES)) ? FC.hardwareCatalog.DEFAULT_TYPES.slice() : [];
  }
  function getHardwareTypeLabel(typeId){
    const id = text(typeId);
    if(!id) return '';
    const row = getHardwareTypes().find((item)=> text(item && item.id) === id && item.active !== false);
    return text(row && row.name);
  }
  function normalizeCatalogAccessory(row){
    const src = row && typeof row === 'object' ? row : {};
    try{
      if(FC.hardwareCatalog && typeof FC.hardwareCatalog.normalizeAccessory === 'function'){
        return FC.hardwareCatalog.normalizeAccessory(src, ()=> text(src.id) || 'hinge_option_candidate', {
          hardwareTechnicalParams:getHardwareTechnicalDefinitions(),
          hardwareSuppliers:getHardwareSuppliers()
        });
      }
    }catch(_){ }
    return src;
  }
  function isActiveCatalogItem(item){
    const status = normalizedText(item && item.status);
    return !status || ['active','aktywne','current'].includes(status);
  }
  function isHingeCategory(value){
    const raw = normalizedText(value);
    return raw === 'zawiasy' || raw.indexOf('zawias') !== -1;
  }
  function paramScalar(params, key){
    const raw = params && params[key];
    if(raw == null) return '';
    if(typeof raw === 'object'){
      if(raw.value != null) return raw.value;
      if(raw.from != null) return raw.from;
      if(raw.to != null) return raw.to;
    }
    return raw;
  }
  function paramRangeFrom(params, key){
    const raw = params && params[key];
    if(raw && typeof raw === 'object') return raw.from != null ? raw.from : raw.value;
    return raw;
  }
  function paramRangeTo(params, key){
    const raw = params && params[key];
    if(raw && typeof raw === 'object') return raw.to != null ? raw.to : '';
    return '';
  }
  function boolParam(params, key){ return bool(paramScalar(params, key)); }
  function numericParam(params, key){ return number(paramRangeFrom(params, key)); }
  function angleActual(params){ return numericParam(params, 'kat_rzeczywisty') || numericParam(params, 'kat_otwarcia'); }
  function angleClass(params){ return text(paramScalar(params, 'klasa_kata')); }
  function inferAngleClass(params){
    const p = params || {};
    const overlay = normalizedText(paramScalar(p, 'nalozenie'));
    const plate = normalizedText(paramScalar(p, 'prowadnik')) || 'standardowy';
    const angle = angleActual(p);
    if(overlay === 'rownolegly wpuszczany') return 'równoległy wpuszczany 95°';
    if(overlay === 'lodowkowy nakladany') return 'lodówkowy 95°';
    if(overlay === 'nakladany' && (angle >= 165 || plate === 'specjalny')) return 'narożny 170°';
    if(angle >= 150 && angle < 165) return 'zerowy uskok 155°';
    if(angle >= 80 && angle <= 130) return 'standardowy 90–120°';
    if(angle >= 165) return 'narożny 170°';
    return '';
  }
  function normalizeHingeParams(params){
    const tech = FC.hardwareTechnicalParams || null;
    try{
      if(tech && typeof tech.normalizeParamValues === 'function') return tech.normalizeParamValues(params || {}, getHardwareTechnicalDefinitions(), 'Zawiasy');
    }catch(_){ }
    const out = clone(params || {});
    if(!out.kat_rzeczywisty && out.kat_otwarcia) out.kat_rzeczywisty = clone(out.kat_otwarcia);
    if(!angleClass(out)){
      const inferred = inferAngleClass(out);
      if(inferred) out.klasa_kata = { value:inferred };
    }
    return out;
  }
  function hingeParamSignature(params){
    const p = normalizeHingeParams(params || {});
    return [
      'nalozenie=' + normalizedText(paramScalar(p, 'nalozenie')),
      'klasa_kata=' + normalizedText(angleClass(p) || inferAngleClass(p)),
      'kat_rzeczywisty=' + text(paramRangeFrom(p, 'kat_rzeczywisty') || paramRangeFrom(p, 'kat_otwarcia')),
      'hamulec=' + (boolParam(p, 'hamulec') ? '1' : '0'),
      'sprezyna=' + (boolParam(p, 'sprezyna') ? '1' : '0'),
      'prowadnik=' + normalizedText(paramScalar(p, 'prowadnik'))
    ].join('|');
  }
  function knownHingeTypeIdFromParams(params){
    const p = normalizeHingeParams(params || {});
    const overlay = normalizedText(paramScalar(p, 'nalozenie'));
    const cls = normalizedText(angleClass(p) || inferAngleClass(p));
    const plate = normalizedText(paramScalar(p, 'prowadnik')) || 'standardowy';
    const brakeRaw = paramScalar(p, 'hamulec');
    const brakeKnown = text(brakeRaw) !== '' || typeof brakeRaw === 'boolean';
    const brake = boolParam(p, 'hamulec');

    // Znane ID zachowujemy tylko dla kanonicznych klas funkcjonalnych reguł szafek.
    // Kąt rzeczywisty (np. 107° zamiast 110°) nie rozbija standardu, o ile klasa
    // zamienności i pozostałe cechy techniczne są te same.
    if(overlay === 'nakladany' && cls === 'standardowy 90 120' && plate === 'standardowy' && (!brakeKnown || brake)) return HINGE_TYPES.OVERLAY_110;
    if(overlay === 'wpuszczany' && cls === 'standardowy 90 120' && plate === 'standardowy' && (!brakeKnown || brake)) return HINGE_TYPES.INSET_110;
    if(overlay === 'nakladany' && cls === 'zerowy uskok 155' && plate === 'standardowy' && (!brakeKnown || brake)) return HINGE_TYPES.ZERO_155;
    if(overlay === 'nakladany' && cls === 'narozny 170' && plate === 'specjalny' && (!brakeKnown || !brake)) return HINGE_TYPES.CORNER_170;
    if(overlay === 'rownolegly wpuszczany' && cls === 'rownolegly wpuszczany 95' && plate === 'specjalny' && (!brakeKnown || !brake)) return HINGE_TYPES.PARALLEL_INSET;
    if(overlay === 'lodowkowy nakladany' && cls === 'lodowkowy 95' && plate === 'specjalny' && (!brakeKnown || !brake)) return HINGE_TYPES.FRIDGE_OVERLAY;
    return '';
  }
  function formatHingeOptionLabel(params){
    const p = normalizeHingeParams(params || {});
    const overlay = text(paramScalar(p, 'nalozenie'));
    const actual = angleActual(p);
    const cls = angleClass(p) || inferAngleClass(p);
    const angle = actual > 0 ? `${actual}°` : '';
    const parts = [];
    if(angle) parts.push(angle);
    if(overlay) parts.push(overlay);
    if(cls) parts.push('klasa ' + cls);
    const prowadnik = text(paramScalar(p, 'prowadnik'));
    if(prowadnik && !/^standardowy$/i.test(prowadnik)) parts.push('prowadnik ' + prowadnik);
    if(boolParam(p, 'hamulec')) parts.push('z hamulcem');
    return parts.join(' ').replace(/\s+/g, ' ').trim() || 'Wymaganie zawiasu z katalogu';
  }
  function catalogOptionTypeId(params){
    return knownHingeTypeIdFromParams(params) || ('catalog_hinge_' + hashKey(hingeParamSignature(params)));
  }
  function buildCatalogHingeRequirementOptions(){
    const map = new Map();
    getAccessoryCatalogRows().map(normalizeCatalogAccessory).forEach((item)=>{
      if(!item || !isActiveCatalogItem(item)) return;
      if(!isHingeCategory(item.hardwareCategory || item.category)) return;
      const params = normalizeHingeParams(item.technicalParams || {});
      if(!text(paramScalar(params, 'nalozenie')) && !number(paramRangeFrom(params, 'kat_otwarcia'))) return;
      const signature = hingeParamSignature(params);
      const typeId = catalogOptionTypeId(params);
      const key = typeId + '|' + signature;
      const existing = map.get(key);
      if(existing){
        existing.sourceCount += 1;
        if(text(item.id)) existing.sourceItemIds.push(text(item.id));
        if(text(item.hardwareUnit) === 'kpl.') existing.catalogHasSet = true;
        return;
      }
      map.set(key, {
        typeId,
        value:typeId,
        label:getHardwareTypeLabel(typeId) || formatHingeOptionLabel(params),
        technicalParams:clone(params),
        catalogDriven:true,
        sourceCount:1,
        sourceItemIds:text(item.id) ? [text(item.id)] : [],
        sourceSignature:signature,
        catalogHasSet:text(item.hardwareUnit) === 'kpl.',
        coverageMode:'catalogSetOrComponents',
        coverageComponents:[
          { kind:'hinge', label:'Zawias' },
          { kind:'mountingPlate', label:'Prowadnik' }
        ]
      });
    });
    return Array.from(map.values()).sort((a, b)=> text(a.label).localeCompare(text(b.label), 'pl'));
  }
  function getHingeRequirementOptions(){ return buildCatalogHingeRequirementOptions(); }
  function findHingeRequirementOption(typeId){
    const id = text(typeId);
    if(!id) return null;
    return getHingeRequirementOptions().find((row)=> text(row && (row.typeId || row.value)) === id) || null;
  }

  FC.cabinetHardwareRequirementOptions = {
    VERSION:'hinge_catalog_requirement_options_v1',
    getHingeRequirementOptions,
    findHingeRequirementOption,
    buildCatalogHingeRequirementOptions
  };
})();

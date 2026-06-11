// js/app/settings/hourly-rates-store.js
// Zarządzanie profilami stawek godzinowych firmy z trybika.
(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value, fallback){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : fallback; }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; } }
  function nowIso(){ try{ return new Date().toISOString(); }catch(_){ return String(Date.now()); } }
  function store(){ return FC.catalogStore || null; }
  function labor(){ return FC.laborCatalog || {}; }
  function codeOf(row){ const l = labor(); return l.normalizeRateCode ? l.normalizeRateCode(row && (row.rateKey || row.rateCode || row.code || row.key || row.rateType)) : text(row && (row.rateKey || row.rateCode || row.rateType)).toLowerCase(); }
  function isHourly(row){ const l = labor(); try{ return !!(l.isHourlyRateDefinition && l.isHourlyRateDefinition(row || {})); }catch(_){ return false; } }

  function rawQuoteRates(){
    const s = store();
    try{ return s && typeof s.getPriceList === 'function' ? s.getPriceList('quoteRates') : []; }catch(_){ return []; }
  }

  function normalizeRate(row, oldRow){
    const l = labor();
    const src = row && typeof row === 'object' ? row : {};
    const old = oldRow && typeof oldRow === 'object' ? oldRow : {};
    const profile = l.normalizeRateProfile ? l.normalizeRateProfile(Object.assign({}, old, src)) : Object.assign({}, old, src);
    const code = l.normalizeRateCode ? l.normalizeRateCode(profile.code || profile.rateKey || profile.rateCode || profile.rateType || src.code || src.rateKey || src.rateCode) : text(profile.code || profile.rateKey || profile.rateCode || profile.rateType || src.code);
    const name = text(src.name || src.label || profile.name || profile.label || code);
    const price = Math.max(0, num(src.price != null ? src.price : profile.price, 0));
    const changed = old && old.id ? (
      text(old.name || old.label) !== name ||
      Math.round((Number(old.price) || 0) * 100) !== Math.round(price * 100) ||
      (old.active !== false) !== (src.active !== false) ||
      text(old.note) !== text(src.note)
    ) : true;
    const editedAt = text(src.priceUserEditedAt || src.userEditedAt || old.priceUserEditedAt || old.userEditedAt) || (changed ? nowIso() : '');
    return {
      id:text(src.id || old.id) || (code ? `labor_rate_${code}` : ''),
      category:'Stawki godzinowe',
      name,
      label:name,
      price,
      usage:'universal',
      isHourlyRate:true,
      rateKey:code,
      rateCode:code,
      rateType:code || 'workshop',
      active:src.active !== false,
      systemRate:src.systemRate === true || old.systemRate === true || profile.systemRate === true,
      nonDeletable:true,
      starterPrice:(old.starterPrice === true && !changed && !editedAt) || src.starterPrice === true,
      priceUserEditedAt:editedAt,
      note:text(src.note || old.note),
    };
  }

  function read(){
    const l = labor();
    let rows = rawQuoteRates();
    try{ if(l.ensureDefaultDefinitions) rows = l.ensureDefaultDefinitions(rows); }catch(_){ }
    try{ if(l.dedupeHourlyRateDefinitions) rows = l.dedupeHourlyRateDefinitions(rows); }catch(_){ }
    const rates = rows.filter(isHourly).map((row)=> normalizeRate(row, row)).filter((row)=> row.rateCode);
    const order = ['workshop','assembly','specialist','helper'];
    return rates.sort((a,b)=>{
      const ai = order.indexOf(a.rateCode); const bi = order.indexOf(b.rateCode);
      if(ai !== bi){ if(ai >= 0 && bi >= 0) return ai - bi; if(ai >= 0) return -1; if(bi >= 0) return 1; }
      if(!!a.systemRate !== !!b.systemRate) return a.systemRate ? -1 : 1;
      return text(a.name).localeCompare(text(b.name), 'pl');
    });
  }

  function createBlankRate(){
    return { id:'draft_rate_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), category:'Stawki godzinowe', name:'', label:'', price:'', rateKey:'', rateCode:'', rateType:'', active:true, isHourlyRate:true, systemRate:false, nonDeletable:true, starterPrice:false, priceUserEditedAt:'', note:'', _new:true };
  }

  function validateRows(rows){
    const l = labor();
    const seen = new Set();
    for(const row of (Array.isArray(rows) ? rows : [])){
      const rawCode = text(row && (row.rateKey || row.rateCode || row.code || row.key || row.rateType));
      const code = l.normalizeRateCode ? l.normalizeRateCode(rawCode) : rawCode;
      if(!rawCode) return { ok:false, message:'Kod techniczny stawki godzinowej jest wymagany.' };
      if(l.isValidRateCode && !l.isValidRateCode(rawCode)) return { ok:false, message:'Kod techniczny może mieć tylko małe litery, cyfry i podkreślenia, bez spacji i polskich znaków.' };
      if(seen.has(code)) return { ok:false, message:'Kod techniczny stawki godzinowej musi być unikalny: ' + code };
      seen.add(code);
      if(!text(row && (row.name || row.label))) return { ok:false, message:'Nazwa przyjazna stawki godzinowej jest wymagana.' };
      if(!(Math.max(0, num(row && row.price, 0)) > 0)) return { ok:false, message:'Kwota stawki godzinowej musi być większa od zera.' };
    }
    return { ok:true };
  }

  function write(rows){
    const validation = validateRows(rows);
    if(!validation.ok) return validation;
    const current = rawQuoteRates();
    const oldByCode = new Map(current.filter(isHourly).map((row)=> [codeOf(row), row]));
    const nonHourly = current.filter((row)=> !isHourly(row));
    const normalizedRates = (Array.isArray(rows) ? rows : []).map((row)=>{
      const code = codeOf(row) || (labor().normalizeRateCode ? labor().normalizeRateCode(row && row.rateCode) : text(row && row.rateCode));
      const normalized = normalizeRate(Object.assign({}, row, { rateKey:code, rateCode:code, rateType:code }), oldByCode.get(code));
      delete normalized._new;
      return normalized;
    });
    const s = store();
    if(!(s && typeof s.savePriceList === 'function')) return { ok:false, message:'Brak magazynu cennika. Nie można zapisać stawek.' };
    s.savePriceList('quoteRates', normalizedRates.concat(nonHourly));
    return { ok:true, rows:read() };
  }

  function buildSummary(rows){
    const list = Array.isArray(rows) ? rows : read();
    const active = list.filter((row)=> row.active !== false).length;
    const inactive = Math.max(0, list.length - active);
    return `${active} aktywne ${active === 1 ? 'stawka' : 'stawki'} godzinowe${inactive ? ' • wyłączone: ' + inactive : ''}. Czynności czasowe wybierają jedną z tych stawek po kodzie technicznym.`;
  }

  FC.hourlyRatesSettings = { read, write, createBlankRate, validateRows, buildSummary, normalizeRate, isHourlyRateDefinition:isHourly };
})();

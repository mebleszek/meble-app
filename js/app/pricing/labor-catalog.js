// js/app/pricing/labor-catalog.js
// Uniwersalny model definicji robocizny: czas, ilości/pakiety, gabaryt zł/m³ oraz gabarytoczas.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const defs = FC.laborCatalogDefinitions || {};
  const RATE_TYPES = defs.RATE_TYPES || [];
  const USAGE_TYPES = defs.USAGE_TYPES || [];
  const AUTO_ROLES = defs.AUTO_ROLES || [];
  const QUANTITY_MODES = defs.QUANTITY_MODES || [];
  const DEFAULT_HOURLY_RATES = defs.DEFAULT_HOURLY_RATES || [];
  const DEFAULT_LABOR_DEFINITIONS = defs.DEFAULT_LABOR_DEFINITIONS || [];

  function num(value, fallback){
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }
  function text(value){ return String(value == null ? '' : value).trim(); }
  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }
  function uid(prefix){
    try{ return FC.utils && typeof FC.utils.uid === 'function' ? FC.utils.uid() : `${prefix || 'labor'}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
    catch(_){ return `${prefix || 'labor'}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
  }

  function clampTimeBlock(value){
    const n = num(value, 0);
    if(n === 0.25 || n === 0.5 || n === 1) return n;
    return 0;
  }
  function normalizeMode(value, allowed, fallback){
    const raw = text(value) || fallback;
    return allowed.some((row)=> row.key === raw) ? raw : fallback;
  }
  function normalizeTier(row){
    const src = row && typeof row === 'object' ? row : {};
    const min = Math.max(0, Math.floor(num(src.min, 0)));
    const maxRaw = Math.floor(num(src.max, 0));
    const max = maxRaw > 0 ? Math.max(min, maxRaw) : 0;
    const hours = Math.max(0, num(src.hours, 0));
    const price = Math.max(0, num(src.price, 0));
    return { min, max, hours, price };
  }
  function normalizeTiers(rows){
    return (Array.isArray(rows) ? rows : []).map(normalizeTier).filter((row)=> row.min > 0 && (row.hours > 0 || row.price > 0)).sort((a,b)=> a.min - b.min);
  }
  function parseTierText(value){
    const raw = text(value);
    if(!raw) return [];
    return raw.split(/[;\n]+/).map((chunk)=>{
      const part = text(chunk);
      if(!part) return null;
      const bits = part.split('=');
      if(bits.length < 2) return null;
      const range = text(bits[0]);
      const val = Math.max(0, num(bits.slice(1).join('='), 0));
      const rangeBits = range.split('-');
      const min = Math.max(0, Math.floor(num(rangeBits[0], 0)));
      const max = Math.max(min, Math.floor(num(rangeBits.length > 1 ? rangeBits[1] : rangeBits[0], min)));
      if(!(min > 0) || !(val > 0)) return null;
      return { min, max, hours:val, price:0 };
    }).filter(Boolean);
  }
  function tiersToText(rows){
    return normalizeTiers(rows).map((row)=> `${row.min}-${row.max || row.min}=${Number(row.hours || row.price || 0)}`).join(';');
  }
  function parseVolumeTierText(value){ return parseTierText(value); }
  function volumeTiersToText(rows){ return tiersToText(rows); }

  function normalizeDefinition(row){
    const src = row && typeof row === 'object' ? row : {};
    const autoRole = normalizeMode(src.autoRole, AUTO_ROLES, 'none');
    const rateKey = text(src.rateKey);
    const rateType = normalizeMode(src.rateType || (autoRole === 'hourlyRate' ? rateKey : ''), RATE_TYPES, 'workshop');
    const quantityMode = normalizeMode(src.quantityMode, QUANTITY_MODES, 'none');
    const volumeTimeMode = text(src.volumeTimeMode) === 'perM3' ? 'perM3' : (text(src.volumeTimeMode) === 'tiers' ? 'tiers' : 'none');
    const price = Math.max(0, num(src.price, 0));
    return {
      id:text(src.id) || uid('labor'),
      category:text(src.category) || 'Inne',
      name:text(src.name),
      price,
      usage:normalizeMode(src.usage, USAGE_TYPES, 'universal'),
      autoRole,
      rateKey:autoRole === 'hourlyRate' ? (rateKey || rateType) : rateKey,
      rateType,
      timeBlockHours:clampTimeBlock(src.timeBlockHours),
      defaultMultiplier:Math.max(0, num(src.defaultMultiplier, 1)) || 1,
      quantityMode,
      quantityTiers:normalizeTiers(src.quantityTiers),
      startHours:clampTimeBlock(src.startHours),
      startQty:Math.max(1, Math.floor(num(src.startQty, 1))),
      stepEveryQty:Math.max(1, Math.floor(num(src.stepEveryQty, 1))),
      stepHours:clampTimeBlock(src.stepHours),
      volumePricePerM3:Math.max(0, num(src.volumePricePerM3, 0)),
      volumeTimeMode,
      volumeTimePerM3:Math.max(0, num(src.volumeTimePerM3, 0)),
      volumeTimeTiers:normalizeTiers(src.volumeTimeTiers),
      fixedPrice:Math.max(0, num(src.fixedPrice, 0)),
      heightMinMm:Math.max(0, Math.floor(num(src.heightMinMm, 0))),
      heightMaxMm:Math.max(0, Math.floor(num(src.heightMaxMm, 0))),
      active:src.active !== false,
      internalOnly:src.internalOnly === true,
      note:text(src.note),
    };
  }
  function ensureDefaultDefinitions(list){
    const rows = Array.isArray(list) ? list.slice() : [];
    const seen = new Set(rows.map((row)=> text(row && row.id)).filter(Boolean));
    DEFAULT_HOURLY_RATES.concat(DEFAULT_LABOR_DEFINITIONS).forEach((row)=>{
      if(seen.has(row.id)) return;
      rows.push(clone(row));
      seen.add(row.id);
    });
    return rows;
  }
  function getRateLabel(key){
    const found = RATE_TYPES.find((row)=> row.key === key);
    return found ? found.label : (key || 'Warsztatowa');
  }
  function getUsageLabel(key){
    const found = USAGE_TYPES.find((row)=> row.key === key);
    return found ? found.label : (key || 'Ręcznie');
  }
  function getAutoRoleLabel(key){
    const found = AUTO_ROLES.find((row)=> row.key === key);
    return found ? found.label : (key || 'Brak automatu');
  }
  function getQuantityModeLabel(key){
    const found = QUANTITY_MODES.find((row)=> row.key === key);
    return found ? found.label : (key || 'Bez ilości');
  }
  function buildHourlyRates(list){
    const rates = { workshop:120, assembly:140, helper:60, specialist:180 };
    (Array.isArray(list) ? list : []).forEach((row)=>{
      const def = normalizeDefinition(row);
      if(def.autoRole !== 'hourlyRate') return;
      const key = def.rateKey || def.rateType;
      if(!key) return;
      const price = Math.max(0, num(def.price, 0));
      if(price > 0) rates[key] = price;
    });
    return rates;
  }
  function findTierValue(rows, quantity, valueKey){
    const qty = Math.max(0, Number(quantity) || 0);
    if(!(qty > 0)) return 0;
    const tiers = normalizeTiers(rows);
    const match = tiers.find((row)=> qty >= row.min && (row.max <= 0 || qty <= row.max)) || tiers[tiers.length - 1] || null;
    return match ? Math.max(0, Number(match[valueKey || 'hours']) || 0) : 0;
  }

  function computeQuantityHours(def, quantity){
    const qty = Math.max(0, Number(quantity) || 0);
    if(!(qty > 0)) return 0;
    if(def.quantityMode === 'linear') return Math.max(0, Number(def.timeBlockHours) || 0) * qty;
    if(def.quantityMode === 'tiers') return findTierValue(def.quantityTiers, qty, 'hours');
    if(def.quantityMode === 'startStep'){
      const startQty = Math.max(1, Math.floor(Number(def.startQty) || 1));
      const start = Math.max(0, Number(def.startHours) || 0);
      const stepEvery = Math.max(1, Math.floor(Number(def.stepEveryQty) || 1));
      const stepHours = Math.max(0, Number(def.stepHours) || 0);
      const extraQty = Math.max(0, qty - startQty);
      return start + (Math.ceil(extraQty / stepEvery) * stepHours);
    }
    return Math.max(0, Number(def.timeBlockHours) || 0);
  }

  function computeVolumeTime(def, volumeM3){
    const v = Math.max(0, Number(volumeM3) || 0);
    if(!(v > 0)) return 0;
    if(def.volumeTimeMode === 'perM3') return v * Math.max(0, Number(def.volumeTimePerM3) || 0);
    if(def.volumeTimeMode === 'tiers') return findTierValue(def.volumeTimeTiers, v, 'hours');
    return 0;
  }

  function calculateDefinition(row, ctx){
    const def = normalizeDefinition(row);
    const c = ctx && typeof ctx === 'object' ? ctx : {};
    const quantity = Math.max(0, Number(c.quantity) || 1);
    const volumeM3 = Math.max(0, Number(c.volumeM3) || 0);
    const rates = c.hourlyRates && typeof c.hourlyRates === 'object' ? c.hourlyRates : {};
    const hourlyRate = Math.max(0, Number(rates[def.rateType]) || Number(c.hourlyRate) || 0);
    const quantityHours = computeQuantityHours(def, quantity);
    const volumeHours = computeVolumeTime(def, volumeM3);
    const multiplier = Math.max(0, Number(c.multiplier) || Number(def.defaultMultiplier) || 1);
    const pricedHours = (quantityHours + volumeHours) * multiplier;
    const laborPrice = pricedHours * hourlyRate;
    const volumePrice = volumeM3 * Math.max(0, Number(def.volumePricePerM3) || 0);
    const fixedPrice = Math.max(0, Number(def.fixedPrice || def.price) || 0);
    const total = laborPrice + volumePrice + fixedPrice;
    return {
      definition: def,
      quantity,
      volumeM3,
      hourlyRate,
      quantityHours,
      volumeHours,
      multiplier,
      pricedHours,
      laborPrice,
      volumePrice,
      fixedPrice,
      total,
    };
  }

  function describeDefinition(row){
    const def = normalizeDefinition(row);
    if(def.autoRole === 'hourlyRate') return `${getRateLabel(def.rateKey || def.rateType)} • ${Number(def.price || 0).toFixed(2)} PLN/h`;
    const parts = [];
    if(def.autoRole && def.autoRole !== 'none') parts.push(getAutoRoleLabel(def.autoRole));
    if(def.timeBlockHours > 0) parts.push(`${def.timeBlockHours} h × ${getRateLabel(def.rateType)}`);
    if(def.quantityMode && def.quantityMode !== 'none') parts.push(getQuantityModeLabel(def.quantityMode));
    if(def.volumePricePerM3 > 0) parts.push(`gabaryt ${def.volumePricePerM3} PLN/m³`);
    if(def.volumeTimeMode && def.volumeTimeMode !== 'none') parts.push(`gabarytoczas: ${def.volumeTimeMode === 'tiers' ? 'progi' : 'h/m³'}`);
    if(def.fixedPrice > 0 || (def.price > 0 && def.autoRole !== 'hourlyRate')) parts.push(`kwota stała ${(def.fixedPrice || def.price).toFixed(2)} PLN`);
    if(def.heightMaxMm > 0) parts.push(`wys. ${def.heightMinMm || 0}–${def.heightMaxMm} mm`);
    return parts.join(' • ') || `${Number(def.price || 0).toFixed(2)} PLN`;
  }

  FC.laborCatalog = {
    RATE_TYPES,
    USAGE_TYPES,
    AUTO_ROLES,
    QUANTITY_MODES,
    DEFAULT_HOURLY_RATES,
    DEFAULT_LABOR_DEFINITIONS,
    normalizeDefinition,
    ensureDefaultDefinitions,
    buildHourlyRates,
    calculateDefinition,
    describeDefinition,
    parseTierText,
    tiersToText,
    parseVolumeTierText,
    volumeTiersToText,
    getRateLabel,
    getUsageLabel,
    getAutoRoleLabel,
    getQuantityModeLabel,
  };
})();

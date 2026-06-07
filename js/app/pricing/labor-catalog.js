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
  const DEFAULT_WORK_AUTOMATS = defs.DEFAULT_WORK_AUTOMATS || [];
  const LEGACY_AUTO_ROLE_TO_WORK_AUTOMAT = defs.LEGACY_AUTO_ROLE_TO_WORK_AUTOMAT || {};
  const WORK_AUTOMAT_TO_LEGACY_AUTO_ROLE = defs.WORK_AUTOMAT_TO_LEGACY_AUTO_ROLE || {};
  const DEFAULT_RATE_ID_TO_WORK_AUTOMAT = defs.DEFAULT_RATE_ID_TO_WORK_AUTOMAT || {};
  const SERVICE_NAME_TO_WORK_AUTOMAT = defs.SERVICE_NAME_TO_WORK_AUTOMAT || {};
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

  function nowIso(){
    try{ return new Date().toISOString(); }catch(_){ return String(Date.now()); }
  }
  function stripDiacritics(value){
    return text(value).replace(/ł/g, 'l').replace(/Ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function normalizeWorkAutomatCode(value){
    const raw = text(value);
    if(!raw) return '';
    if(LEGACY_AUTO_ROLE_TO_WORK_AUTOMAT[raw]) return LEGACY_AUTO_ROLE_TO_WORK_AUTOMAT[raw];
    return stripDiacritics(raw).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  }
  function isValidWorkAutomatCode(value){
    const raw = text(value);
    return !!raw && raw === normalizeWorkAutomatCode(raw) && /^[a-z0-9_]+$/.test(raw);
  }
  function normalizeRateCode(value){
    const raw = text(value);
    if(!raw) return '';
    return stripDiacritics(raw).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  }
  function isValidRateCode(value){
    const raw = text(value);
    return !!raw && raw === normalizeRateCode(raw) && /^[a-z0-9_]+$/.test(raw);
  }
  function isSystemRateCode(value){
    const key = normalizeRateCode(value);
    return RATE_TYPES.some((row)=> row && row.key === key && row.system !== false);
  }
  function normalizeNameKey(value){
    return stripDiacritics(value).toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function inferWorkAutomatCode(src, autoRole){
    const row = src && typeof src === 'object' ? src : {};
    const direct = normalizeWorkAutomatCode(row.workAutomatCode || row.automatCode || row.laborAutomatCode || row.automationCode);
    if(direct) return direct;
    const id = text(row.id);
    if(DEFAULT_RATE_ID_TO_WORK_AUTOMAT[id]) return DEFAULT_RATE_ID_TO_WORK_AUTOMAT[id];
    const role = text(autoRole || row.autoRole);
    if(LEGACY_AUTO_ROLE_TO_WORK_AUTOMAT[role]) return LEGACY_AUTO_ROLE_TO_WORK_AUTOMAT[role];
    const nameKey = normalizeNameKey(row.name);
    if(SERVICE_NAME_TO_WORK_AUTOMAT[nameKey]) return SERVICE_NAME_TO_WORK_AUTOMAT[nameKey];
    return '';
  }
  function workAutomatCodeToAutoRole(code, fallback){
    const key = normalizeWorkAutomatCode(code);
    return WORK_AUTOMAT_TO_LEGACY_AUTO_ROLE[key] || text(fallback) || 'none';
  }
  function normalizeWorkAutomat(row, opts){
    const cfg = opts && typeof opts === 'object' ? opts : {};
    const src = row && typeof row === 'object' ? row : {};
    const fallbackCode = normalizeWorkAutomatCode(cfg.fallbackCode);
    const code = normalizeWorkAutomatCode(src.code || src.id || src.key || fallbackCode);
    const stamp = text(src.createdAt || src.updatedAt) || nowIso();
    return {
      code,
      id:code,
      label:text(src.label || src.name) || code,
      name:text(src.name || src.label) || code,
      description:text(src.description),
      system:src.system === true || src.isSystem === true,
      isSystem:src.isSystem === true || src.system === true,
      active:src.active !== false,
      createdAt:text(src.createdAt) || stamp,
      updatedAt:text(src.updatedAt) || stamp,
    };
  }
  function validateWorkAutomat(row, existingList, opts){
    const cfg = opts && typeof opts === 'object' ? opts : {};
    const src = row && typeof row === 'object' ? row : {};
    const rawCode = text(src.code || src.id || src.key || '');
    const item = normalizeWorkAutomat(row || {});
    const oldCode = normalizeWorkAutomatCode(cfg.oldCode || (row && row.oldCode));
    const existing = Array.isArray(existingList) ? existingList.map((entry)=> normalizeWorkAutomat(entry)).filter((entry)=> entry.code) : [];
    if(!rawCode) return { ok:false, code:'required', message:'Kod techniczny automatu jest wymagany.' };
    if(!isValidWorkAutomatCode(rawCode)) return { ok:false, code:'format', message:'Kod techniczny może mieć tylko małe litery, cyfry i podkreślenia, bez spacji i polskich znaków.' };
    if(oldCode && item.code !== oldCode) return { ok:false, code:'immutable', message:'Nie można zmienić kodu technicznego istniejącego automatu. Utwórz nowy automat i wyłącz stary.' };
    const duplicate = existing.find((entry)=> entry.code === item.code && (!oldCode || entry.code !== oldCode));
    if(duplicate) return { ok:false, code:'duplicate', message:'Taki kod techniczny automatu już istnieje.' };
    if(!item.label) return { ok:false, code:'label', message:'Nazwa przyjazna automatu jest wymagana.' };
    return { ok:true, item };
  }
  function ensureDefaultWorkAutomats(list){
    const byCode = new Map();
    DEFAULT_WORK_AUTOMATS.forEach((row)=>{
      const item = normalizeWorkAutomat(row);
      if(item.code) byCode.set(item.code, item);
    });
    (Array.isArray(list) ? list : []).forEach((row)=>{
      const item = normalizeWorkAutomat(row);
      if(!item.code) return;
      const base = byCode.get(item.code);
      byCode.set(item.code, base ? Object.assign({}, base, item, { code:base.code, id:base.code, system:base.system === true || item.system === true, isSystem:base.isSystem === true || item.isSystem === true }) : item);
    });
    return Array.from(byCode.values()).map((row)=> normalizeWorkAutomat(row));
  }
  function findWorkAutomat(list, code){
    const key = normalizeWorkAutomatCode(code);
    return ensureDefaultWorkAutomats(list).find((row)=> row.code === key) || null;
  }
  function workAutomatOptions(list, selectedCode){
    const selected = normalizeWorkAutomatCode(selectedCode);
    const rows = ensureDefaultWorkAutomats(list).filter((row)=> row.active !== false || row.code === selected);
    return rows.map((row)=> ({ value:row.code, label:row.label || row.code, description:row.description || '' }));
  }
  function upsertWorkAutomat(list, payload, opts){
    const cfg = opts && typeof opts === 'object' ? opts : {};
    const existing = ensureDefaultWorkAutomats(list);
    const hasOldCode = Object.prototype.hasOwnProperty.call(cfg, 'oldCode') || !!(payload && payload.oldCode);
    const oldCode = hasOldCode ? normalizeWorkAutomatCode(cfg.oldCode || (payload && payload.oldCode)) : '';
    const validation = validateWorkAutomat(payload, existing, oldCode ? { oldCode } : {});
    if(!validation.ok) return { ok:false, error:validation.message, code:validation.code, list:existing };
    const nextItem = validation.item;
    const next = existing.slice();
    const idx = next.findIndex((row)=> row.code === nextItem.code);
    if(idx >= 0){
      const prev = next[idx];
      next[idx] = normalizeWorkAutomat(Object.assign({}, prev, nextItem, { code:prev.code, id:prev.code, system:prev.system === true, isSystem:prev.isSystem === true, createdAt:prev.createdAt || nextItem.createdAt, updatedAt:nowIso() }));
    }else next.push(normalizeWorkAutomat(Object.assign({}, nextItem, { createdAt:nextItem.createdAt || nowIso(), updatedAt:nowIso() })));
    return { ok:true, item:idx >= 0 ? next[idx] : next[next.length - 1], list:next };
  }


  function isHourlyRateDefinition(row){
    const src = row && typeof row === 'object' ? row : {};
    const cat = normalizeNameKey(src.category);
    return text(src.autoRole) === 'hourlyRate' || cat === 'stawki godzinowe' || /^labor_rate_/.test(text(src.id));
  }
  function normalizeRateProfile(row, opts){
    const cfg = opts && typeof opts === 'object' ? opts : {};
    const src = row && typeof row === 'object' ? row : {};
    const fallbackCode = normalizeRateCode(cfg.fallbackCode);
    const code = normalizeRateCode(src.rateKey || src.rateCode || src.code || src.key || src.rateType || fallbackCode);
    const base = RATE_TYPES.find((entry)=> entry && entry.key === code) || null;
    return {
      code,
      key:code,
      rateKey:code,
      rateCode:code,
      id:text(src.id) || (code ? `labor_rate_${code}` : ''),
      label:text(src.label || src.name) || (base ? base.label : code),
      name:text(src.name || src.label) || (base ? base.label : code),
      price:Math.max(0, num(src.price, base && base.price != null ? base.price : 0)),
      active:src.active !== false,
      system:src.systemRate === true || src.nonDeletable === true || (base && base.system !== false) || src.system === true || src.isSystem === true,
      systemRate:src.systemRate === true || src.nonDeletable === true || (base && base.system !== false),
      nonDeletable:src.nonDeletable === true || src.systemRate === true || (base && base.system !== false),
      starterPrice:src.starterPrice === true,
      priceUserEditedAt:text(src.priceUserEditedAt || src.userEditedAt),
      note:text(src.note),
    };
  }
  function hasExplicitPriceEdit(row){
    const src = row && typeof row === 'object' ? row : {};
    return src.starterPrice === false || !!text(src.priceUserEditedAt || src.userEditedAt);
  }
  function hourlyRateCodeFromRow(row){
    const src = row && typeof row === 'object' ? row : {};
    let code = normalizeRateCode(src.rateKey || src.rateCode || src.code || src.key || src.rateType);
    if(code) return code;
    const id = text(src.id);
    if(/^labor_rate_[a-z0-9_]+$/.test(id)) return normalizeRateCode(id.replace(/^labor_rate_/, ''));
    return '';
  }
  function defaultHourlyRateForCode(code){
    const key = normalizeRateCode(code);
    return DEFAULT_HOURLY_RATES.find((row)=> normalizeRateCode(row && (row.rateKey || row.rateCode || row.rateType)) === key) || null;
  }
  function dedupeHourlyRateDefinitions(list){
    const input = Array.isArray(list) ? list : [];
    const normalRows = [];
    const groups = new Map();
    const order = [];
    input.forEach((row)=>{
      if(!isHourlyRateDefinition(row)){ normalRows.push(row); return; }
      const code = hourlyRateCodeFromRow(row);
      if(!code){ normalRows.push(row); return; }
      if(!groups.has(code)){ groups.set(code, []); order.push(code); }
      groups.get(code).push(row);
    });

    const mergedHourly = [];
    order.forEach((code)=>{
      const rows = groups.get(code) || [];
      const canonicalId = `labor_rate_${code}`;
      const base = defaultHourlyRateForCode(code);
      const canonical = rows.find((row)=> text(row && row.id) === canonicalId) || null;
      if(base){
        const editedCanonical = canonical && hasExplicitPriceEdit(canonical);
        const singleLegacy = !canonical && rows.length === 1 && hasExplicitPriceEdit(rows[0]);
        const source = canonical || (singleLegacy ? rows[0] : null) || {};
        const keepUserPrice = !!(editedCanonical || singleLegacy);
        const next = Object.assign({}, base, source, {
          id:canonicalId,
          category:'Stawki godzinowe',
          autoRole:'hourlyRate',
          workAutomatCode:'manual_hourly',
          rateKey:code,
          rateCode:code,
          rateType:code,
          price:keepUserPrice ? Math.max(0, num(source.price, base.price)) : Math.max(0, num(base.price, 0)),
          systemRate:true,
          nonDeletable:true,
          starterPrice:keepUserPrice ? false : true,
          priceUserEditedAt:keepUserPrice ? text(source.priceUserEditedAt || source.userEditedAt) : '',
        });
        mergedHourly.push(next);
        return;
      }
      const preferred = rows.find(hasExplicitPriceEdit) || rows[rows.length - 1] || rows[0] || {};
      mergedHourly.push(Object.assign({}, preferred, {
        id:text(preferred.id) || canonicalId,
        category:'Stawki godzinowe',
        autoRole:'hourlyRate',
        workAutomatCode:'manual_hourly',
        rateKey:code,
        rateCode:code,
        rateType:code,
        nonDeletable:true,
      }));
    });
    return mergedHourly.concat(normalRows);
  }
  function buildRateProfiles(list, selectedCode){
    const selected = normalizeRateCode(selectedCode);
    const order = [];
    const byCode = new Map();
    RATE_TYPES.forEach((row)=>{
      const item = normalizeRateProfile({ rateKey:row.key, name:row.label, label:row.label, price:row.price, active:true, systemRate:row.system !== false, nonDeletable:row.system !== false, id:`labor_rate_${row.key}`, starterPrice:true });
      if(item.code){ byCode.set(item.code, item); order.push(item.code); }
    });
    (Array.isArray(list) ? list : []).forEach((row)=>{
      if(!isHourlyRateDefinition(row)) return;
      const item = normalizeRateProfile(row);
      if(!item.code) return;
      const prev = byCode.get(item.code);
      const next = prev
        ? Object.assign({}, prev, item, { code:prev.code, key:prev.code, rateKey:prev.code, rateCode:prev.code, system:prev.system === true || item.system === true, systemRate:prev.systemRate === true || item.systemRate === true, nonDeletable:prev.nonDeletable === true || item.nonDeletable === true })
        : item;
      byCode.set(item.code, next);
      if(!order.includes(item.code)) order.push(item.code);
    });
    if(selected && !byCode.has(selected)){
      const item = normalizeRateProfile({ rateKey:selected, name:selected, active:false });
      byCode.set(selected, item);
      order.push(selected);
    }
    return order.map((code)=> byCode.get(code)).filter((row)=> row && row.code);
  }
  function findRateProfile(list, code){
    const key = normalizeRateCode(code);
    return buildRateProfiles(list, key).find((row)=> row.code === key) || null;
  }
  function rateProfileOptions(list, selectedCode){
    const selected = normalizeRateCode(selectedCode);
    return buildRateProfiles(list, selected)
      .filter((row)=> row.active !== false || row.code === selected)
      .map((row)=> ({ value:row.code, label:`${row.label || row.name || row.code}${row.price > 0 ? ' — ' + Number(row.price).toFixed(2) + ' zł/h' : ''}`, description:row.note || '' }));
  }
  function validateRateProfile(row, existingList, opts){
    const cfg = opts && typeof opts === 'object' ? opts : {};
    const src = row && typeof row === 'object' ? row : {};
    const rawCode = text(src.rateKey || src.rateCode || src.code || src.key || '');
    const oldCode = normalizeRateCode(cfg.oldCode || src.oldCode);
    const item = normalizeRateProfile(src);
    if(!rawCode) return { ok:false, code:'required', message:'Kod techniczny stawki godzinowej jest wymagany.' };
    if(!isValidRateCode(rawCode)) return { ok:false, code:'format', message:'Kod techniczny stawki może mieć tylko małe litery, cyfry i podkreślenia, bez spacji i polskich znaków.' };
    if(oldCode && item.code !== oldCode) return { ok:false, code:'immutable', message:'Nie można zmienić kodu technicznego istniejącej stawki godzinowej. Utwórz nową stawkę i wyłącz starą.' };
    const existing = (Array.isArray(existingList) ? existingList : []).filter(isHourlyRateDefinition).map((entry)=> normalizeRateProfile(entry)).filter((entry)=> entry.code);
    const duplicate = existing.find((entry)=> entry.code === item.code && (!oldCode || entry.code !== oldCode));
    if(duplicate) return { ok:false, code:'duplicate', message:'Taki kod techniczny stawki godzinowej już istnieje.' };
    if(!item.label) return { ok:false, code:'label', message:'Nazwa przyjazna stawki godzinowej jest wymagana.' };
    if(!(item.price > 0)) return { ok:false, code:'price', message:'Kwota stawki godzinowej musi być większa od zera.' };
    return { ok:true, item };
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
    const inferredWorkCode = inferWorkAutomatCode(src, src.autoRole);
    const rawAutoRole = text(src.autoRole);
    const autoRole = normalizeMode(rawAutoRole && rawAutoRole !== 'none' ? rawAutoRole : workAutomatCodeToAutoRole(inferredWorkCode, rawAutoRole || 'none'), AUTO_ROLES, 'none');
    const workAutomatCode = inferredWorkCode || '';
    const rateKey = normalizeRateCode(src.rateKey || src.rateCode);
    const rateType = normalizeRateCode(src.rateType || (autoRole === 'hourlyRate' ? rateKey : '')) || 'workshop';
    const quantityMode = normalizeMode(src.quantityMode, QUANTITY_MODES, 'none');
    const volumeTimeMode = text(src.volumeTimeMode) === 'perM3' ? 'perM3' : (text(src.volumeTimeMode) === 'tiers' ? 'tiers' : 'none');
    const volumePricePerM3 = volumeTimeMode === 'none' ? Math.max(0, num(src.volumePricePerM3, 0)) : 0;
    const price = Math.max(0, num(src.price, 0));
    return {
      id:text(src.id) || uid('labor'),
      category:text(src.category) || 'Inne',
      name:text(src.name),
      price,
      usage:normalizeMode(src.usage, USAGE_TYPES, 'universal'),
      autoRole,
      workAutomatCode,
      automatCode:workAutomatCode,
      laborAutomatCode:workAutomatCode,
      rateKey:autoRole === 'hourlyRate' ? (rateKey || rateType) : rateKey,
      rateCode:autoRole === 'hourlyRate' ? (rateKey || rateType) : '',
      rateType,
      timeBlockHours:clampTimeBlock(src.timeBlockHours),
      defaultMultiplier:Math.max(0, num(src.defaultMultiplier, 1)) || 1,
      quantityMode,
      quantityTiers:normalizeTiers(src.quantityTiers),
      startHours:clampTimeBlock(src.startHours),
      startQty:Math.max(1, Math.floor(num(src.startQty, 1))),
      stepEveryQty:Math.max(1, Math.floor(num(src.stepEveryQty, 1))),
      stepHours:clampTimeBlock(src.stepHours),
      volumePricePerM3,
      volumeTimeMode,
      volumeTimePerM3:Math.max(0, num(src.volumeTimePerM3, 0)),
      volumeTimeTiers:normalizeTiers(src.volumeTimeTiers),
      fixedPrice:Math.max(0, num(src.fixedPrice, 0)),
      heightMinMm:Math.max(0, Math.floor(num(src.heightMinMm, 0))),
      heightMaxMm:Math.max(0, Math.floor(num(src.heightMaxMm, 0))),
      active:src.active !== false,
      internalOnly:src.internalOnly === true,
      note:text(src.note),
      systemRate:src.systemRate === true || src.nonDeletable === true || (autoRole === 'hourlyRate' && isSystemRateCode(rateKey || rateType)),
      nonDeletable:src.nonDeletable === true || src.systemRate === true || (autoRole === 'hourlyRate' && isSystemRateCode(rateKey || rateType)),
      starterPrice:src.starterPrice === true,
      priceUserEditedAt:text(src.priceUserEditedAt || src.userEditedAt),
    };
  }
  function ensureDefaultDefinitions(list){
    const rows = Array.isArray(list) ? list.slice() : [];
    const byId = new Map();
    rows.forEach((row, index)=>{ const id = text(row && row.id); if(id && !byId.has(id)) byId.set(id, index); });
    DEFAULT_HOURLY_RATES.concat(DEFAULT_LABOR_DEFINITIONS).forEach((row)=>{
      const seedHourlyCode = text(row.autoRole) === 'hourlyRate' ? normalizeRateCode(row.rateKey || row.rateCode || row.rateType) : '';
      const existingHourlyIndex = seedHourlyCode
        ? rows.findIndex((candidate)=> isHourlyRateDefinition(candidate) && hourlyRateCodeFromRow(candidate) === seedHourlyCode && text(candidate && candidate.id) === `labor_rate_${seedHourlyCode}`)
        : -1;
      const idx = existingHourlyIndex >= 0 ? existingHourlyIndex : (byId.has(row.id) ? byId.get(row.id) : -1);
      if(idx >= 0){
        // Systemowe stawki startowe mogą dostać nowy opis/kontrakt i bezpieczną cenę startową,
        // ale nie nadpisujemy kwoty zmienionej ręcznie przez użytkownika.
        if(text(row.autoRole) === 'hourlyRate'){
          const current = rows[idx] && typeof rows[idx] === 'object' ? rows[idx] : {};
          const userEdited = current.starterPrice === false || !!text(current.priceUserEditedAt || current.userEditedAt);
          rows[idx] = Object.assign({}, row, current, {
            id:row.id,
            category:current.category || row.category,
            autoRole:'hourlyRate',
            workAutomatCode:'manual_hourly',
            rateKey:normalizeRateCode(current.rateKey || current.rateCode || row.rateKey),
            rateCode:normalizeRateCode(current.rateKey || current.rateCode || row.rateKey),
            rateType:normalizeRateCode(current.rateType || current.rateKey || current.rateCode || row.rateKey),
            price:userEdited ? current.price : row.price,
            systemRate:true,
            nonDeletable:true,
          });
        }
        return;
      }
      rows.push(clone(row));
      byId.set(row.id, rows.length - 1);
    });
    return dedupeHourlyRateDefinitions(rows);
  }
  function getRateLabel(key, list){
    const normalized = normalizeRateCode(key);
    const foundProfile = Array.isArray(list) ? findRateProfile(list, normalized) : null;
    if(foundProfile) return foundProfile.label || foundProfile.name || normalized;
    const found = RATE_TYPES.find((row)=> row.key === normalized);
    return found ? found.label : (normalized || 'Warsztatowa');
  }
  function getUsageLabel(key){
    const found = USAGE_TYPES.find((row)=> row.key === key);
    return found ? found.label : (key || 'Ręcznie');
  }
  function getAutoRoleLabel(key){
    const found = AUTO_ROLES.find((row)=> row.key === key);
    return found ? found.label : (key || 'Brak legacy automatu');
  }
  function getWorkAutomatLabel(code, list){
    const found = findWorkAutomat(list, code);
    return found ? found.label : (normalizeWorkAutomatCode(code) || 'Brak automatu');
  }
  function getQuantityModeLabel(key){
    const found = QUANTITY_MODES.find((row)=> row.key === key);
    return found ? found.label : (key || 'Bez ilości');
  }
  function buildHourlyRates(list){
    const rates = {};
    buildRateProfiles(list).forEach((profile)=>{
      if(!profile.code) return;
      const price = Math.max(0, num(profile.price, 0));
      if(price > 0) rates[profile.code] = price;
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
    const volumePrice = volumeHours > 0 ? 0 : (volumeM3 * Math.max(0, Number(def.volumePricePerM3) || 0));
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
    if(def.autoRole === 'hourlyRate') return `${def.name || getRateLabel(def.rateKey || def.rateType)} • kod: ${def.rateKey || def.rateType} • ${Number(def.price || 0).toFixed(2)} PLN/h`;
    const parts = [];
    if(def.workAutomatCode) parts.push(getWorkAutomatLabel(def.workAutomatCode));
    else if(def.autoRole && def.autoRole !== 'none') parts.push(getAutoRoleLabel(def.autoRole));
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
    DEFAULT_WORK_AUTOMATS,
    LEGACY_AUTO_ROLE_TO_WORK_AUTOMAT,
    WORK_AUTOMAT_TO_LEGACY_AUTO_ROLE,
    DEFAULT_RATE_ID_TO_WORK_AUTOMAT,
    SERVICE_NAME_TO_WORK_AUTOMAT,
    QUANTITY_MODES,
    DEFAULT_HOURLY_RATES,
    DEFAULT_LABOR_DEFINITIONS,
    normalizeWorkAutomatCode,
    isValidWorkAutomatCode,
    normalizeRateCode,
    isValidRateCode,
    isSystemRateCode,
    isHourlyRateDefinition,
    normalizeRateProfile,
    buildRateProfiles,
    findRateProfile,
    rateProfileOptions,
    validateRateProfile,
    normalizeWorkAutomat,
    validateWorkAutomat,
    ensureDefaultWorkAutomats,
    findWorkAutomat,
    workAutomatOptions,
    upsertWorkAutomat,
    inferWorkAutomatCode,
    workAutomatCodeToAutoRole,
    getWorkAutomatLabel,
    normalizeDefinition,
    ensureDefaultDefinitions,
    dedupeHourlyRateDefinitions,
    hourlyRateCodeFromRow,
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

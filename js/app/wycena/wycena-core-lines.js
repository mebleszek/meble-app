(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const utils = FC.wycenaCoreUtils;
  const catalog = FC.wycenaCoreCatalog;
  const source = FC.wycenaCoreSource;
  const offer = FC.wycenaCoreOffer;
  const selectionApi = FC.wycenaCoreSelection;
  if(!(utils && catalog && source && offer && selectionApi)){
    throw new Error('Brak zależności FC.wycenaCoreLines — sprawdź kolejność ładowania Wyceny.');
  }


  function resolvePreferredHardwareProducer(roomId, groupKey, fallback){
    try{
      const prefs = FC.roomPreferences;
      if(prefs && typeof prefs.resolveHardwareProducerPreference === 'function'){
        return String(prefs.resolveHardwareProducerPreference(roomId, groupKey, fallback) || '').trim();
      }
    }catch(_){ }
    return String(fallback || '').trim();
  }

  function hardwareGroupFromMaterial(rawMaterial){
    const raw = String(rawMaterial || '').replace(/^Okucia:\s*/i, '').trim().toLowerCase();
    if(/^zawiasy\b/.test(raw) || raw.indexOf('zawias') !== -1) return 'hinges';
    if(/^podnośniki\b|^podnosniki\b/.test(raw) || raw.indexOf('podnośnik') !== -1 || raw.indexOf('podnosnik') !== -1) return 'lifts';
    if(/^szuflady\b|^prowadnice\b/.test(raw) || raw.indexOf('prowadnic') !== -1 || raw.indexOf('szuflad') !== -1) return 'drawers';
    if(/^cargo\b/.test(raw) || raw.indexOf('cargo') !== -1) return 'cargo';
    return 'accessories';
  }

  function displayHardwareNameFromPreferences(rawMaterial, roomId){
    const raw = String(rawMaterial || '').trim();
    const name = raw.replace(/^Okucia:\s*/i, '').trim() || raw;
    const group = hardwareGroupFromMaterial(name);
    if(group === 'hinges'){
      const producer = resolvePreferredHardwareProducer(roomId, 'hinges', 'BLUM');
      return producer ? `zawiasy ${producer}` : name;
    }
    if(group === 'lifts'){
      const producer = resolvePreferredHardwareProducer(roomId, 'lifts', 'BLUM');
      return producer ? `podnośniki ${producer}` : name;
    }
    if(group === 'drawers'){
      const producer = resolvePreferredHardwareProducer(roomId, 'drawers', '');
      return producer ? `${name.replace(/\s+[A-ZŁŚŻŹĆŃÓĘĄÄÖÜÉÈÊ]+$/i, '').trim() || 'szuflady / prowadnice'} ${producer}` : name;
    }
    if(group === 'cargo'){
      const producer = resolvePreferredHardwareProducer(roomId, 'cargo', '');
      return producer ? `cargo ${producer}` : name;
    }
    return name;
  }

  function text(value){ return String(value == null ? '' : value).trim(); }
  function norm(value){
    return text(value).toLowerCase().replace(/ł/g, 'l').replace(/Ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  }
  function moneySource(item){
    const parts = [];
    if(text(item && item.priceSource)) parts.push(text(item.priceSource));
    if(text(item && item.priceUpdatedAt)) parts.push('cena z ' + text(item.priceUpdatedAt));
    return parts.join(' • ');
  }
  function hardwareItemLabel(item){
    const src = item || {};
    const parts = [text(src.manufacturer), text(src.name)].filter(Boolean);
    const name = parts.join(' — ') || text(src.name) || 'Okucie z katalogu';
    return text(src.symbol) ? `${name} (${text(src.symbol)})` : name;
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
    try{ if(store && typeof store.getAccessories === 'function') return store.getAccessories(); }catch(_){ }
    try{ return Array.isArray(typeof accessories !== 'undefined' ? accessories : []) ? accessories : []; }catch(_){ return []; }
  }
  function getHardwareTechnicalDefinitions(){
    const store = getCatalogStore();
    try{ if(store && typeof store.getHardwareTechnicalParams === 'function') return store.getHardwareTechnicalParams(); }catch(_){ }
    return FC.hardwareTechnicalParams && FC.hardwareTechnicalParams.DEFAULT_DEFINITIONS || [];
  }
  function normalizeCandidateItem(row){
    const src = row || {};
    try{
      if(FC.hardwareCatalog && typeof FC.hardwareCatalog.normalizeAccessory === 'function'){
        return FC.hardwareCatalog.normalizeAccessory(src, ()=> text(src.id) || 'quote_hw_candidate', {
          hardwareTechnicalParams:getHardwareTechnicalDefinitions(),
          hardwareSuppliers:[]
        });
      }
    }catch(_){ }
    return src;
  }
  function categoryMatches(itemCategory, reqCategory){
    const a = norm(itemCategory);
    const b = norm(reqCategory);
    if(!a || !b) return false;
    if(a === b) return true;
    if(b === 'zawiasy') return a.indexOf('zawias') !== -1;
    if(b.indexOf('szuflad') !== -1) return a.indexOf('szuflad') !== -1 || a.indexOf('prowadnic') !== -1;
    if(b.indexOf('podnosnik') !== -1) return a.indexOf('podnosnik') !== -1;
    if(b.indexOf('cargo') !== -1) return a.indexOf('cargo') !== -1;
    return false;
  }
  function requirementText(req){
    const r = req || {};
    const parts = [];
    if(text(r.label)) parts.push(text(r.label));
    if(text(r.ruleId)) parts.push('reguła: ' + text(r.ruleId));
    return parts.join(' • ');
  }
  function candidateNameFallbackScore(item, req){
    const n = norm([item && item.name, item && item.symbol, item && item.hardwareType].filter(Boolean).join(' '));
    const typeId = norm(req && req.typeId);
    let score = 0;
    if(typeId.indexOf('110') !== -1 && n.indexOf('110') !== -1) score += 4;
    if(typeId.indexOf('155') !== -1 && n.indexOf('155') !== -1) score += 6;
    if(typeId.indexOf('170') !== -1 && n.indexOf('170') !== -1) score += 6;
    if(typeId.indexOf('parallel') !== -1 && (n.indexOf('rownolegl') !== -1 || n.indexOf('79b9550') !== -1)) score += 8;
    if(typeId.indexOf('fridge') !== -1 && (n.indexOf('lodow') !== -1 || n.indexOf('91k9550') !== -1)) score += 8;
    const label = norm(req && req.label);
    if(label.indexOf('nakladany') !== -1 && n.indexOf('naklad') !== -1) score += 2;
    if(label.indexOf('wpuszczany') !== -1 && n.indexOf('wpuszcz') !== -1) score += 2;
    if(label.indexOf('lodowkowy') !== -1 && n.indexOf('lodow') !== -1) score += 3;
    if(label.indexOf('narozny') !== -1 && (n.indexOf('naroz') !== -1 || n.indexOf('170') !== -1)) score += 3;
    return score;
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
  function paramFrom(params, key){
    const raw = params && params[key];
    if(raw && typeof raw === 'object') return raw.from != null ? raw.from : raw.value;
    return raw;
  }
  function paramTo(params, key){
    const raw = params && params[key];
    if(raw && typeof raw === 'object') return raw.to != null ? raw.to : '';
    return '';
  }
  function boolParam(params, key){
    const raw = paramScalar(params, key);
    if(raw === true) return true;
    if(raw === false) return false;
    const v = norm(raw);
    return ['1','true','tak','yes','y'].includes(v);
  }
  function numberParam(params, key){
    const n = Number(String(paramFrom(params, key) == null ? '' : paramFrom(params, key)).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  function normalizeKeyText(value){ return norm(value).replace(/[^a-z0-9]+/g, ' ').trim(); }
  function hingeActualAngle(params){ return numberParam(params, 'kat_rzeczywisty') || numberParam(params, 'kat_otwarcia'); }
  function hingeAngleClass(params){ return text(paramScalar(params || {}, 'klasa_kata')); }
  function inferHingeAngleClass(params){
    const p = params || {};
    const overlay = normalizeKeyText(paramScalar(p, 'nalozenie'));
    const plate = normalizeKeyText(paramScalar(p, 'prowadnik')) || 'standardowy';
    const angle = hingeActualAngle(p);
    if(overlay === 'rownolegly wpuszczany') return 'równoległy wpuszczany 95°';
    if(overlay === 'lodowkowy nakladany') return 'lodówkowy 95°';
    if(overlay === 'nakladany' && (angle >= 165 || plate === 'specjalny')) return 'narożny 170°';
    if(angle >= 150 && angle < 165) return 'zerowy uskok 155°';
    if(angle >= 80 && angle <= 130) return 'standardowy 90–120°';
    if(angle >= 165) return 'narożny 170°';
    return '';
  }
  function normalizeTechnicalParamsForCompare(category, params){
    const src = params && typeof params === 'object' ? params : {};
    const tech = FC.hardwareTechnicalParams || null;
    try{
      if(tech && typeof tech.normalizeParamValues === 'function') return tech.normalizeParamValues(src, getHardwareTechnicalDefinitions(), category || 'Zawiasy');
    }catch(_){ }
    const out = Object.assign({}, src);
    if(!out.kat_rzeczywisty && out.kat_otwarcia) out.kat_rzeczywisty = out.kat_otwarcia;
    if(!hingeAngleClass(out)){
      const inferred = inferHingeAngleClass(out);
      if(inferred) out.klasa_kata = { value:inferred };
    }
    return out;
  }
  function hingeParamSignature(params){
    const p = normalizeTechnicalParamsForCompare('Zawiasy', params || {});
    return [
      'nalozenie=' + normalizeKeyText(paramScalar(p, 'nalozenie')),
      'klasa_kata=' + normalizeKeyText(hingeAngleClass(p) || inferHingeAngleClass(p)),
      'kat_rzeczywisty=' + text(paramFrom(p, 'kat_rzeczywisty') || paramFrom(p, 'kat_otwarcia')),
      'hamulec=' + (boolParam(p, 'hamulec') ? '1' : '0'),
      'sprezyna=' + (boolParam(p, 'sprezyna') ? '1' : '0'),
      'prowadnik=' + normalizeKeyText(paramScalar(p, 'prowadnik'))
    ].join('|');
  }
  function canonicalHingeTypeIdFromParams(params){
    const p = normalizeTechnicalParamsForCompare('Zawiasy', params || {});
    const overlay = normalizeKeyText(paramScalar(p, 'nalozenie'));
    const cls = normalizeKeyText(hingeAngleClass(p) || inferHingeAngleClass(p));
    const plate = normalizeKeyText(paramScalar(p, 'prowadnik')) || 'standardowy';
    const brakeRaw = paramScalar(p, 'hamulec');
    const brakeKnown = text(brakeRaw) !== '' || typeof brakeRaw === 'boolean';
    const brake = boolParam(p, 'hamulec');

    if(overlay === 'nakladany' && cls === 'standardowy 90 120' && plate === 'standardowy' && (!brakeKnown || brake)) return 'hinge_110_overlay';
    if(overlay === 'wpuszczany' && cls === 'standardowy 90 120' && plate === 'standardowy' && (!brakeKnown || brake)) return 'hinge_110_inset';
    if(overlay === 'nakladany' && cls === 'zerowy uskok 155' && plate === 'standardowy' && (!brakeKnown || brake)) return 'hinge_155_zero';
    if(overlay === 'nakladany' && cls === 'narozny 170' && plate === 'specjalny' && (!brakeKnown || !brake)) return 'hinge_170_corner';
    if(overlay === 'rownolegly wpuszczany' && cls === 'rownolegly wpuszczany 95' && plate === 'specjalny' && (!brakeKnown || !brake)) return 'hinge_parallel_inset';
    if(overlay === 'lodowkowy nakladany' && cls === 'lodowkowy 95' && plate === 'specjalny' && (!brakeKnown || !brake)) return 'hinge_fridge_overlay';
    return '';
  }
  function isCanonicalHingeTypeId(typeId){
    return ['hinge_110_overlay','hinge_110_inset','hinge_155_zero','hinge_170_corner','hinge_parallel_inset','hinge_fridge_overlay'].includes(text(typeId));
  }
  function hingeCandidateCompatibility(candidate, req){
    if(!(req && req.kind === 'hinge' && text(req.hardwareGroup) === 'hinges')) return { allowed:true, score:0, exact:false };
    const reqType = text(req && req.typeId);
    const reqParams = normalizeTechnicalParamsForCompare('Zawiasy', req && req.technicalParams && typeof req.technicalParams === 'object' ? req.technicalParams : {});
    const candParams = normalizeTechnicalParamsForCompare('Zawiasy', candidate && candidate.technicalParams && typeof candidate.technicalParams === 'object' ? candidate.technicalParams : {});
    const candType = canonicalHingeTypeIdFromParams(candParams);
    const reqTypeFromParams = canonicalHingeTypeIdFromParams(reqParams);
    const requiredType = isCanonicalHingeTypeId(reqType) ? reqType : reqTypeFromParams;

    if(requiredType && candType && candType !== requiredType){
      return { allowed:false, score:-1000, exact:false, reason:'functional-class-mismatch' };
    }

    if(reqType.indexOf('catalog_hinge_') === 0){
      const reqSig = hingeParamSignature(reqParams);
      const candSig = hingeParamSignature(candParams);
      if(reqSig && candSig && reqSig === candSig) return { allowed:true, score:70, exact:true };
      if(candSig) return { allowed:false, score:-1000, exact:false, reason:'catalog-signature-mismatch' };
    }

    const reqClass = normalizeKeyText(hingeAngleClass(reqParams) || inferHingeAngleClass(reqParams));
    const candClass = normalizeKeyText(hingeAngleClass(candParams) || inferHingeAngleClass(candParams));
    if(reqClass && candClass && reqClass !== candClass){
      return { allowed:false, score:-1000, exact:false, reason:'angle-class-mismatch' };
    }

    const reqAngle = hingeActualAngle(reqParams);
    const candAngle = hingeActualAngle(candParams);
    let angleScore = 0;
    let exact = false;
    if(reqAngle > 0 && candAngle > 0){
      const distance = Math.abs(reqAngle - candAngle);
      if(distance === 0){ angleScore += 30; exact = true; }
      else angleScore += Math.max(0, 20 - distance);
    }

    if(reqParams && candParams && hingeParamSignature(reqParams) === hingeParamSignature(candParams)) return { allowed:true, score:80 + angleScore, exact:true };
    return { allowed:true, score:angleScore, exact };
  }

  function technicalStatusForCandidate(item){
    try{
      const api = FC.hardwareTechnicalParams || null;
      if(api && typeof api.evaluateItemTechnicalStatus === 'function') return api.evaluateItemTechnicalStatus(item || {}, getHardwareTechnicalDefinitions());
    }catch(_){ }
    return { ok:true, needsAttention:false, missing:[], code:'unknown' };
  }
  function isTechnicallyUsableCandidate(item, req){
    if(!(req && req.technicalParams && typeof req.technicalParams === 'object')) return true;
    const status = technicalStatusForCandidate(item);
    return !(status && status.needsAttention);
  }

  function compareRequirementParams(candidate, req){
    const tech = FC.hardwareTechnicalParams || null;
    const definitions = getHardwareTechnicalDefinitions();
    const category = text(req && req.category) || text(candidate && candidate.hardwareCategory);
    const rawReqParams = req && req.technicalParams && typeof req.technicalParams === 'object' ? req.technicalParams : {};
    const rawCandParams = candidate && candidate.technicalParams && typeof candidate.technicalParams === 'object' ? candidate.technicalParams : {};
    const reqParams = normalizeTechnicalParamsForCompare(category, rawReqParams);
    const candParams = normalizeTechnicalParamsForCompare(category, rawCandParams);
    const fields = tech && typeof tech.fieldsForCategory === 'function' ? tech.fieldsForCategory(definitions, category) : [];
    const checks = [];
    let score = 0;
    let required = 0;
    fields.filter((field)=> field && field.active !== false && field.keyFeature !== false && field.compareMode !== 'ignore').forEach((field)=>{
      const reqValue = reqParams[field.key];
      if(!reqValue) return;
      required += 1;
      const candValue = candParams[field.key];
      let ok = false;
      try{ ok = !!(tech && typeof tech.compareParam === 'function' ? tech.compareParam(field, reqValue, candValue) : false); }catch(_){ ok = false; }
      checks.push({ key:field.key, ok, hasCandidate:!!candValue });
      if(ok) score += 10;
      else if(candValue) score -= 12;
      else score -= 4;
    });
    return { score, required, checks, matched:checks.filter((row)=> row.ok).length };
  }
  function resolveHardwareRequirement(req, roomId, rawMaterial){
    const r = req && typeof req === 'object' ? req : null;
    const group = r && text(r.hardwareGroup) ? text(r.hardwareGroup) : hardwareGroupFromMaterial(rawMaterial);
    const preferredProducer = resolvePreferredHardwareProducer(roomId, group, group === 'hinges' ? 'BLUM' : '');
    if(!r || r.kind === 'none' || r.kind === 'future'){
      return { item:null, preferredProducer, requirement:r, warning:r && r.kind === 'future' ? text(r.reason) : '' };
    }
    const allRows = getAccessoryCatalogRows().map(normalizeCandidateItem).filter((item)=>{
      if(!item || text(item.status) === 'inactive') return false;
      if(!categoryMatches(item.hardwareCategory || item.category, r.category || '')) return false;
      return true;
    });
    const directCandidates = findRequirementSourceCandidates(r, allRows, preferredProducer);
    function pickBestCandidate(rows, opts){
      const cfg = Object.assign({ direct:false }, opts || {});
      let best = null;
      (Array.isArray(rows) ? rows : []).forEach((item)=>{
        if(!isTechnicallyUsableCandidate(item, r)) return;
        const compat = hingeCandidateCompatibility(item, r);
        if(!compat.allowed) return;
        const param = compareRequirementParams(item, r);
        if(r && r.kind === 'hinge' && text(r.hardwareGroup) === 'hinges' && param.required > 0 && param.matched < param.required) return;
        const fallback = candidateNameFallbackScore(item, r);
        const priceBonus = Number(item && item.price) > 0 ? 2 : 0;
        const producerBonus = preferredProducer && norm(item.manufacturer) === norm(preferredProducer) ? 55 : 0;
        const directBonus = cfg.direct ? 8 : 0;
        const score = compat.score + param.score + fallback + priceBonus + producerBonus + directBonus;
        const record = { item, score, param, fallback, compat };
        if(!best || record.score > best.score) best = record;
      });
      return best;
    }
    const preferredRows = preferredProducer ? allRows.filter((item)=> norm(item.manufacturer) === norm(preferredProducer)) : [];
    const preferredBest = pickBestCandidate(preferredRows, { direct:false });
    if(preferredBest && (preferredBest.param.matched > 0 || preferredBest.fallback >= 4 || preferredBest.score > 0)){
      return { item:preferredBest.item, preferredProducer, requirement:r, score:preferredBest.score, preferredProducerMatch:true };
    }
    if(directCandidates && directCandidates.length){
      const directBest = pickBestCandidate(directCandidates, { direct:true });
      if(directBest) return { item:directBest.item, preferredProducer, requirement:r, score:directBest.score, directSourceId:true };
    }
    const best = pickBestCandidate(allRows, { direct:false });
    if(best && (best.param.matched > 0 || best.fallback >= 4 || best.score > 0)){
      return { item:best.item, preferredProducer, requirement:r, score:best.score };
    }
    return { item:null, preferredProducer, requirement:r, warning:'Nie znaleziono konkretnej pozycji katalogu spełniającej wymaganie techniczne.' };
  }


  function isHingeRequirement(req){
    return !!(req && req.kind === 'hinge' && text(req.hardwareGroup) === 'hinges');
  }

  function makeRequirementPart(req){
    const qty = Math.max(0, Math.round(Number(req && req.qty) || 0));
    if(!(qty > 0)) return null;
    const suffix = req && req.doorLabel ? ' — ' + text(req.doorLabel) : '';
    return {
      name:(text(req && req.label) || 'Komplet zawiasowy') + suffix,
      qty,
      a:0,
      b:0,
      dims:'—',
      material:'Okucia: komplet zawiasowy',
      hardwareRequirement:req || null,
      source:'centralHardwareRequirements'
    };
  }

  function collectCentralHingeRequirementParts(roomId, cabinet){
    const api = FC.cabinetHardwareRequirements;
    if(!(api && typeof api.getHingeRequirementsWithQty === 'function')) return null;
    try{
      const rows = api.getHingeRequirementsWithQty(roomId, cabinet) || [];
      return (Array.isArray(rows) ? rows : [])
        .filter((req)=> isHingeRequirement(req))
        .map(makeRequirementPart)
        .filter(Boolean);
    }catch(_){ return null; }
  }

  function collectAccessoryPartsForCabinet(roomId, cabinet){
    const centralHinges = collectCentralHingeRequirementParts(roomId, cabinet);
    const parts = [];
    if(Array.isArray(centralHinges)) parts.push.apply(parts, centralHinges);

    const cutlist = FC.cabinetCutlist && typeof FC.cabinetCutlist.getCabinetCutList === 'function'
      ? (FC.cabinetCutlist.getCabinetCutList(cabinet, roomId) || [])
      : [];
    (Array.isArray(cutlist) ? cutlist : []).forEach((part)=>{
      const req = part && part.hardwareRequirement && typeof part.hardwareRequirement === 'object' ? part.hardwareRequirement : null;
      if(Array.isArray(centralHinges) && isHingeRequirement(req)) return;
      parts.push(part);
    });
    return parts;
  }

  function findRequirementSourceCandidates(req, rows, preferredProducer){
    const ids = Array.isArray(req && req.catalogOptionSourceItemIds)
      ? req.catalogOptionSourceItemIds.map(text).filter(Boolean)
      : [];
    if(!ids.length) return null;
    const idSet = new Set(ids);
    const sourceRows = (Array.isArray(rows) ? rows : []).filter((item)=> {
      if(!(item && idSet.has(text(item.id)))) return false;
      const compat = hingeCandidateCompatibility(item, req);
      if(!compat.allowed) return false;
      const param = compareRequirementParams(item, req);
      if(req && req.kind === 'hinge' && text(req.hardwareGroup) === 'hinges' && param.required > 0 && param.matched < param.required) return false;
      return true;
    });
    if(!sourceRows.length) return null;
    const preferred = text(preferredProducer);
    const preferredRows = preferred
      ? sourceRows.filter((item)=> norm(item.manufacturer) === norm(preferred))
      : [];
    const pool = preferredRows.length ? preferredRows : sourceRows;
    return pool.slice().sort((a, b)=> {
      const priceA = Number(a && a.price) || 0;
      const priceB = Number(b && b.price) || 0;
      if((priceB > 0) !== (priceA > 0)) return (priceB > 0 ? 1 : 0) - (priceA > 0 ? 1 : 0);
      if(text(a && a.hardwareUnit) === 'kpl.' && text(b && b.hardwareUnit) !== 'kpl.') return -1;
      if(text(b && b.hardwareUnit) === 'kpl.' && text(a && a.hardwareUnit) !== 'kpl.') return 1;
      return priceA - priceB;
    });
  }

  function collectAccessories(selectedRooms){
    const rows = new Map();
    const cabs = source.selectedCabinets(selectedRooms);
    cabs.forEach(({ roomId, roomLabel:rl, cabinet })=>{
      const parts = collectAccessoryPartsForCabinet(roomId, cabinet);
      parts.forEach((part)=>{
        const a = Number(part && part.a) || 0;
        const b = Number(part && part.b) || 0;
        const mat = String(part && (part.material || part.name) || '').trim();
        if(a > 0 && b > 0) return;
        if(!mat) return;
        const req = part && part.hardwareRequirement && typeof part.hardwareRequirement === 'object' ? part.hardwareRequirement : null;
        const resolved = resolveHardwareRequirement(req, roomId, mat);
        const priceItem = resolved.item || catalog.accessoryPriceLookup(mat) || catalog.accessoryPriceLookup(displayHardwareNameFromPreferences(mat, roomId));
        const fallbackName = req && text(req.label)
          ? `Wymaganie: ${text(req.label)}${resolved.preferredProducer ? ' — ' + resolved.preferredProducer : ''}`
          : displayHardwareNameFromPreferences(mat, roomId);
        const name = priceItem ? hardwareItemLabel(priceItem) : fallbackName;
        const reqKey = req && (text(req.typeId) || text(req.ruleId) || text(req.label));
        const key = utils.slug(priceItem && (priceItem.id || priceItem.symbol || priceItem.name) || [resolved.preferredProducer, reqKey, name].filter(Boolean).join('_'));
        const qty = Math.max(0, Number(part && part.qty) || 0) || 1;
        const prev = rows.get(key) || {
          key,
          type:'accessory',
          name,
          qty:0,
          unitPrice:0,
          total:0,
          unit:text(priceItem && priceItem.hardwareUnit) || 'szt.',
          rooms:new Set(),
          warnings:[],
          noteParts:new Set(),
          hardwareRequirement:req || null,
          resolvedHardwareItemId:text(priceItem && priceItem.id),
          resolvedHardwareSymbol:text(priceItem && priceItem.symbol),
        };
        prev.qty += qty;
        prev.rooms.add(rl);
        if(priceItem){
          prev.name = hardwareItemLabel(priceItem);
          prev.unit = text(priceItem.hardwareUnit) || prev.unit || 'szt.';
          prev.unitPrice = Number(priceItem.price) || prev.unitPrice || 0;
          prev.starterPrice = !!(priceItem.starterPrice === true && !String(priceItem.priceUserEditedAt || '').trim());
          prev.priceUserEditedAt = String(priceItem.priceUserEditedAt || '');
          const src = moneySource(priceItem);
          if(src) prev.noteParts.add(src);
        }else{
          prev.warnings.push(`Wymagane okucie „${text(req && req.label) || mat}”${resolved.preferredProducer ? ' producent ' + resolved.preferredProducer : ''}, ale nie znaleziono konkretnej pozycji w katalogu okuć.`);
        }
        if(req){
          prev.noteParts.add('Wymaganie: ' + requirementText(req));
          if(resolved.preferredProducer) prev.noteParts.add('Producent z preferencji: ' + resolved.preferredProducer);
        }
        if(!prev.unitPrice) prev.warnings.push('Akcesorium ma 0 zł — sprawdź cenę w katalogu okuć.');
        prev.calculation = req
          ? 'Cena = ilość okuć wymagana przez szafki × cena konkretnej pozycji dobranej z katalogu okuć po producencie i cechach technicznych.'
          : 'Cena = ilość okuć/akcesoriów × cena do wyceny z katalogu okuć.';
        prev.total = prev.qty * prev.unitPrice;
        rows.set(key, prev);
      });
    });
    return Array.from(rows.values()).map((row)=> Object.assign({}, row, {
      rooms:Array.from(row.rooms).join(', '),
      note:Array.from(row.noteParts || []).join(' • '),
      warnings:Array.from(new Set(row.warnings || [])),
    }));
  }

  function collectBuiltInAppliances(selectedRooms){
    const rows = new Map();
    const add = (name, roomLabel)=>{
      const key = utils.slug(name);
      const prev = rows.get(key) || { key, type:'service', category:'AGD', name, qty:0, unit:'szt.', unitPrice:0, total:0, rooms:new Set() };
      prev.qty += 1;
      prev.rooms.add(roomLabel);
      const svc = catalog.servicePriceLookup(name);
      prev.unitPrice = Number(svc && svc.price) || prev.unitPrice || 0;
      prev.starterPrice = !!(svc && svc.starterPrice === true && !String(svc.priceUserEditedAt || '').trim());
      prev.priceUserEditedAt = String(svc && svc.priceUserEditedAt || '');
      prev.calculation = 'Cena = liczba urządzeń AGD z zaznaczonym montażem × cena usługi AGD z cennika.';
      prev.total = prev.qty * prev.unitPrice;
      rows.set(key, prev);
    };
    source.selectedCabinets(selectedRooms).forEach(({ roomLabel:rl, cabinet })=>{
      const api = FC.laborApplianceRules;
      if(api && typeof api.isMountingEnabled === 'function' && typeof api.getApplianceForCabinet === 'function'){
        if(!api.isMountingEnabled(cabinet)) return;
        const appliance = api.getApplianceForCabinet(cabinet);
        if(appliance && appliance.serviceName) add(appliance.serviceName, rl);
        return;
      }
      const cab = cabinet || {};
      const sub = String(cab.subType || '');
      const details = cab.details || {};
      if(sub === 'zmywarkowa') add('Zmywarka do zabudowy', rl);
      if(sub === 'lodowkowa' && String(details.fridgeOption || 'zabudowa') === 'zabudowa') add('Lodówka do zabudowy', rl);
      if(sub === 'piekarnikowa') add('Piekarnik do zabudowy', rl);
      if(sub === 'okap') add('Okap podszafkowy / teleskopowy', rl);
    });
    return Array.from(rows.values()).map((row)=> Object.assign({}, row, { rooms:Array.from(row.rooms).join(', ') }));
  }

  function collectElementLines(selectionOverride){
    const normalizedSelection = selectionApi.normalizeQuoteSelection(selectionOverride);
    const aggregate = source.getSelectedAggregate(normalizedSelection);
    const scope = normalizedSelection.materialScope;
    const materialsOrdered = source.getScopedMaterials(aggregate, normalizedSelection);
    const rows = new Map();
    materialsOrdered.forEach((material)=>{
      const group = aggregate && aggregate.groups ? aggregate.groups[material] : null;
      const selectedParts = FC.rozrysScope && typeof FC.rozrysScope.getGroupPartsForScope === 'function'
        ? FC.rozrysScope.getGroupPartsForScope(group, scope)
        : ((group && group.parts) || []);
      (Array.isArray(selectedParts) ? selectedParts : []).forEach((part)=>{
        const qty = Math.max(0, Number(part && part.qty) || 0);
        if(!(qty > 0)) return;
        const width = Math.max(0, Math.round(Number(part && part.w) || 0));
        const height = Math.max(0, Math.round(Number(part && part.h) || 0));
        const name = String(part && part.name || 'Element').trim() || 'Element';
        const key = `${material}||${name}||${width}||${height}`;
        const prev = rows.get(key) || {
          key: utils.slug(key),
          type:'element',
          category:'Element',
          name,
          qty:0,
          unit:'szt.',
          unitPrice:0,
          total:0,
          materialLabel:String(material || '').trim(),
          width,
          height,
          rooms:(aggregate && Array.isArray(aggregate.selectedRooms) ? aggregate.selectedRooms : []).map(source.roomLabel).join(', '),
          note:'',
        };
        prev.qty += qty;
        rows.set(key, prev);
      });
    });
    return Array.from(rows.values()).sort((a,b)=>{
      const an = String(a && a.name || '');
      const bn = String(b && b.name || '');
      const cmp = an.localeCompare(bn, 'pl');
      if(cmp !== 0) return cmp;
      if((Number(b && b.width) || 0) !== (Number(a && a.width) || 0)) return (Number(b && b.width) || 0) - (Number(a && a.width) || 0);
      return (Number(b && b.height) || 0) - (Number(a && a.height) || 0);
    });
  }

  function collectClientPdfDetails(selectionOverride){
    const normalizedSelection = selectionApi.normalizeQuoteSelection(selectionOverride);
    return {
      elements: collectElementLines(normalizedSelection),
      materials: (function(){
        const aggregate = source.getSelectedAggregate(normalizedSelection);
        return source.getScopedMaterials(aggregate, normalizedSelection).map((material)=> ({
          key: utils.slug(material),
          type:'material-summary',
          name:String(material || '').trim(),
        })).filter((row)=> row.name);
      })(),
      accessories: collectAccessories(selectionApi.decodeSelectedRooms(normalizedSelection)),
      services: offer.collectQuoteRateLines(),
      agd: collectBuiltInAppliances(selectionApi.decodeSelectedRooms(normalizedSelection)),
    };
  }

  FC.wycenaCoreLines = {
    collectAccessories,
    collectBuiltInAppliances,
    collectElementLines,
    collectClientPdfDetails,
  };
})();

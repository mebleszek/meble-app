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
    return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
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
  function getAccessoryCatalogRows(){
    try{
      if(FC.catalogStore && typeof FC.catalogStore === 'function'){
        const store = FC.catalogStore();
        if(store && typeof store.getAccessories === 'function') return store.getAccessories();
      }
    }catch(_){ }
    try{ return Array.isArray(typeof accessories !== 'undefined' ? accessories : []) ? accessories : []; }catch(_){ return []; }
  }
  function getHardwareTechnicalDefinitions(){
    try{
      if(FC.catalogStore && typeof FC.catalogStore === 'function'){
        const store = FC.catalogStore();
        if(store && typeof store.getHardwareTechnicalParams === 'function') return store.getHardwareTechnicalParams();
      }
    }catch(_){ }
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
  function compareRequirementParams(candidate, req){
    const tech = FC.hardwareTechnicalParams || null;
    const definitions = getHardwareTechnicalDefinitions();
    const category = text(req && req.category) || text(candidate && candidate.hardwareCategory);
    const reqParams = req && req.technicalParams && typeof req.technicalParams === 'object' ? req.technicalParams : {};
    const candParams = candidate && candidate.technicalParams && typeof candidate.technicalParams === 'object' ? candidate.technicalParams : {};
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
    const rows = getAccessoryCatalogRows().map(normalizeCandidateItem).filter((item)=>{
      if(!item || text(item.status) === 'inactive') return false;
      if(!categoryMatches(item.hardwareCategory || item.category, r.category || '')) return false;
      if(preferredProducer && norm(item.manufacturer) !== norm(preferredProducer)) return false;
      return true;
    });
    let best = null;
    rows.forEach((item)=>{
      const param = compareRequirementParams(item, r);
      const fallback = candidateNameFallbackScore(item, r);
      const priceBonus = Number(item && item.price) > 0 ? 2 : 0;
      const score = param.score + fallback + priceBonus;
      const record = { item, score, param, fallback };
      if(!best || record.score > best.score) best = record;
    });
    if(best && (best.param.matched > 0 || best.fallback >= 4 || best.score > 0)){
      return { item:best.item, preferredProducer, requirement:r, score:best.score };
    }
    return { item:null, preferredProducer, requirement:r, warning:'Nie znaleziono konkretnej pozycji katalogu spełniającej wymaganie techniczne.' };
  }

  function collectAccessories(selectedRooms){
    const rows = new Map();
    const cabs = source.selectedCabinets(selectedRooms);
    cabs.forEach(({ roomId, roomLabel:rl, cabinet })=>{
      const parts = FC.cabinetCutlist && typeof FC.cabinetCutlist.getCabinetCutList === 'function' ? (FC.cabinetCutlist.getCabinetCutList(cabinet, roomId) || []) : [];
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

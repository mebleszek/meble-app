// js/app/room-preferences/room-preferences-bulk-plan.js
// Etap 2A: planowanie bezpiecznego zastosowania preferencji strefowych do istniejących szafek.

(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  const ZONE_KEYS = ['lower','middle','upper'];
  const FIELD_KEYS = ['body','front','back','opening'];
  const ZONE_LABELS = {
    lower:'Strefa dolna / stojące',
    middle:'Strefa środkowa / moduły',
    upper:'Strefa górna / wiszące'
  };
  const FIELD_LABELS = {
    body:'Korpus',
    front:'Fronty',
    back:'Plecy',
    opening:'Otwieranie'
  };

  function text(value){ return String(value == null ? '' : value).trim(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; } }
  function isPlainObject(value){ return !!value && typeof value === 'object' && (value.constructor === Object || Object.getPrototypeOf(value) === null); }

  function getRoomData(room){
    const key = text(room);
    try{ return key && projectData && projectData[key] ? projectData[key] : null; }catch(_){ return null; }
  }

  function getCabinets(room){
    const data = getRoomData(room);
    return data && Array.isArray(data.cabinets) ? data.cabinets.filter(Boolean) : [];
  }

  function getSets(room){
    const data = getRoomData(room);
    return data && Array.isArray(data.sets) ? data.sets.filter(Boolean) : [];
  }

  function getFronts(room){
    const data = getRoomData(room);
    return data && Array.isArray(data.fronts) ? data.fronts.filter(Boolean) : [];
  }

  function normalizeSelection(selection){
    const src = isPlainObject(selection) ? selection : {};
    const zonesRaw = isPlainObject(src.zones) ? src.zones : {};
    const fieldsRaw = isPlainObject(src.fields) ? src.fields : {};
    const zones = {};
    const fields = {};
    ZONE_KEYS.forEach((key)=>{ zones[key] = !!zonesRaw[key]; });
    FIELD_KEYS.forEach((key)=>{ fields[key] = !!fieldsRaw[key]; });
    return { zones, fields };
  }

  function hasAnySelected(map, keys){ return keys.some((key)=> !!(map && map[key])); }

  function zoneForCabinet(cab, opts){
    const c = cab && typeof cab === 'object' ? cab : {};
    if(opts && opts.setAsLower && text(c.setId)) return 'lower';
    try{
      const api = ns.roomPreferences || {};
      if(typeof api.zoneKeyForCabinetType === 'function') return api.zoneKeyForCabinetType(c.type);
    }catch(_){ }
    const type = text(c.type).toLowerCase();
    if(type === 'wisząca' || type === 'wiszaca') return 'upper';
    if(type === 'moduł' || type === 'modul') return 'middle';
    return 'lower';
  }

  function resolveZoneDefaults(room, zoneKey, fallback){
    try{
      const api = ns.roomPreferences || {};
      if(typeof api.resolveZoneDefaults === 'function') return api.resolveZoneDefaults(room, zoneKey, fallback || {});
    }catch(_){ }
    return Object.assign({}, fallback || {});
  }

  function resolveZoneFront(room, zoneKey, fallback){
    try{
      const api = ns.roomPreferences || {};
      if(typeof api.resolveZoneFrontMaterial === 'function') return api.resolveZoneFrontMaterial(room, zoneKey, fallback || {});
    }catch(_){ }
    const resolved = resolveZoneDefaults(room, zoneKey, fallback || {});
    return { material:text(resolved.frontMaterial || resolved.material), color:text(resolved.frontColor || resolved.color) };
  }

  function frontSourceKey(front){
    const payload = front && front.frontMaterialSource && typeof front.frontMaterialSource === 'object' ? front.frontMaterialSource : null;
    const key = text(payload && (payload.source || payload.zone || payload.key));
    return ZONE_KEYS.includes(key) ? key : (key === 'custom' ? 'custom' : '');
  }

  function setSourceKey(set){
    const raw = set && typeof set === 'object' ? set : {};
    const nested = raw.frontSource && typeof raw.frontSource === 'object' ? raw.frontSource : null;
    const key = text((nested && (nested.source || nested.zone || nested.key)) || raw.frontSourceKey || raw.source);
    return ZONE_KEYS.includes(key) ? key : (key === 'custom' ? 'custom' : '');
  }

  function different(a, b){ return text(a) !== text(b); }

  function addCount(bucket, zoneKey, fieldKey, amount){
    const qty = Number(amount) || 0;
    if(!qty) return;
    bucket.total += qty;
    bucket.byZone[zoneKey] = bucket.byZone[zoneKey] || { total:0, fields:{} };
    bucket.byZone[zoneKey].total += qty;
    bucket.byZone[zoneKey].fields[fieldKey] = (bucket.byZone[zoneKey].fields[fieldKey] || 0) + qty;
    bucket.byField[fieldKey] = (bucket.byField[fieldKey] || 0) + qty;
  }

  function countPlainCabinetFronts(room, cab, zoneKey){
    const fronts = getFronts(room).filter((front)=> String(front && front.cabId || '') === String(cab && cab.id || ''));
    const target = resolveZoneFront(room, zoneKey, cab || {});
    if(fronts.length){
      return fronts.filter((front)=> different(front.material, target.material) || different(front.color, target.color)).length;
    }
    return (different(cab && cab.frontMaterial, target.material) || different(cab && cab.frontColor, target.color)) ? 1 : 0;
  }

  function countSourceFronts(room, fronts, zoneKey){
    const target = resolveZoneFront(room, zoneKey, {});
    return fronts.filter((front)=> frontSourceKey(front) === zoneKey && (different(front.material, target.material) || different(front.color, target.color))).length;
  }

  function buildPlan(room, selection){
    const normalized = normalizeSelection(selection);
    const plan = {
      room:text(room),
      selection:normalized,
      ready: hasAnySelected(normalized.zones, ZONE_KEYS) && hasAnySelected(normalized.fields, FIELD_KEYS),
      total:0,
      byZone:{},
      byField:{},
      notes:[],
      hasChanges:false
    };
    const cabinets = getCabinets(room);
    const fronts = getFronts(room);
    const sets = getSets(room);

    if(!cabinets.length && !sets.length && !fronts.length){
      plan.notes.push('Brak szafek w tym pomieszczeniu.');
      return plan;
    }

    if(!hasAnySelected(normalized.zones, ZONE_KEYS)) plan.notes.push('Wybierz przynajmniej jedną strefę.');
    if(!hasAnySelected(normalized.fields, FIELD_KEYS)) plan.notes.push('Wybierz, co zmienić.');
    if(!plan.ready) return plan;

    cabinets.forEach((cab)=>{
      const zoneKey = zoneForCabinet(cab, { setAsLower:true });
      if(!normalized.zones[zoneKey]) return;
      const defaults = resolveZoneDefaults(room, zoneKey, cab);
      if(normalized.fields.body && different(cab.bodyColor, defaults.bodyColor)) addCount(plan, zoneKey, 'body', 1);
      if(normalized.fields.back && different(cab.backMaterial, defaults.backMaterial)) addCount(plan, zoneKey, 'back', 1);
      if(normalized.fields.opening && different(cab.openingSystem, defaults.openingSystem)) addCount(plan, zoneKey, 'opening', 1);
    });

    if(normalized.fields.front){
      const cabinetsById = new Map(cabinets.map((cab)=> [String(cab && cab.id || ''), cab]));
      cabinets.forEach((cab)=>{
        if(!cab || text(cab.setId)) return;
        const isFridge = text(cab.type) === 'stojąca' && text(cab.subType) === 'lodowkowa';
        if(isFridge) return;
        const zoneKey = zoneForCabinet(cab, { setAsLower:false });
        if(!normalized.zones[zoneKey]) return;
        addCount(plan, zoneKey, 'front', countPlainCabinetFronts(room, cab, zoneKey));
      });

      ZONE_KEYS.forEach((zoneKey)=>{
        if(!normalized.zones[zoneKey]) return;
        const sourceFronts = fronts.filter((front)=>{
          if(!front || !frontSourceKey(front)) return false;
          if(text(front.setId)) return frontSourceKey(front) === zoneKey;
          const cab = cabinetsById.get(String(front.cabId || ''));
          return cab && text(cab.subType) === 'lodowkowa' && frontSourceKey(front) === zoneKey;
        });
        addCount(plan, zoneKey, 'front', countSourceFronts(room, sourceFronts, zoneKey));
      });
    }

    // Zestaw jako rekord techniczny też ma korpus/plecy/otwieranie, ale nie liczymy go drugi raz w sumie.
    if(sets.length && normalized.zones.lower && (normalized.fields.body || normalized.fields.back || normalized.fields.opening)){
      plan.notes.push('Zestawy: korpusy, plecy i otwieranie są traktowane jak strefa dolna / stojące.');
    }
    plan.hasChanges = plan.total > 0;
    if(!plan.hasChanges) plan.notes.push('Brak realnych różnic do zastosowania dla wybranego zakresu.');
    return plan;
  }

  function formatPlanSummary(plan){
    const p = plan && typeof plan === 'object' ? plan : {};
    if(!p.ready) return (p.notes || []).join(' ') || 'Wybierz zakres zmian.';
    if(!p.hasChanges) return 'Brak zmian do zastosowania.';
    const pieces = [];
    ZONE_KEYS.forEach((zoneKey)=>{
      const row = p.byZone && p.byZone[zoneKey];
      if(!row) return;
      const fields = FIELD_KEYS.filter((fieldKey)=> row.fields && row.fields[fieldKey]).map((fieldKey)=> `${FIELD_LABELS[fieldKey]}: ${row.fields[fieldKey]}`);
      if(fields.length) pieces.push(`${ZONE_LABELS[zoneKey]} — ${fields.join(', ')}`);
    });
    return pieces.join(' | ');
  }

  ns.roomPreferencesBulkPlan = {
    ZONE_KEYS: ZONE_KEYS.slice(),
    FIELD_KEYS: FIELD_KEYS.slice(),
    ZONE_LABELS: clone(ZONE_LABELS),
    FIELD_LABELS: clone(FIELD_LABELS),
    normalizeSelection,
    zoneForCabinet,
    resolveZoneDefaults,
    resolveZoneFront,
    frontSourceKey,
    setSourceKey,
    buildPlan,
    formatPlanSummary
  };
})();

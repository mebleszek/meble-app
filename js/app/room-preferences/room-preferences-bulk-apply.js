// js/app/room-preferences/room-preferences-bulk-apply.js
// Etap 2A: zastosowanie zatwierdzonego planu preferencji strefowych.

(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});
  const ZONE_KEYS = ['lower','middle','upper'];

  function text(value){ return String(value == null ? '' : value).trim(); }
  function getPlanner(){ return ns.roomPreferencesBulkPlan || {}; }
  function isPlainObject(value){ return !!value && typeof value === 'object' && (value.constructor === Object || Object.getPrototypeOf(value) === null); }
  function getRoomData(room){ try{ return projectData && projectData[text(room)] ? projectData[text(room)] : null; }catch(_){ return null; } }
  function different(a, b){ return text(a) !== text(b); }

  function resolveZoneDefaults(room, zoneKey, fallback){
    const planner = getPlanner();
    if(planner && typeof planner.resolveZoneDefaults === 'function') return planner.resolveZoneDefaults(room, zoneKey, fallback || {});
    return Object.assign({}, fallback || {});
  }

  function resolveZoneFront(room, zoneKey, fallback){
    const planner = getPlanner();
    if(planner && typeof planner.resolveZoneFront === 'function') return planner.resolveZoneFront(room, zoneKey, fallback || {});
    const resolved = resolveZoneDefaults(room, zoneKey, fallback || {});
    return { material:text(resolved.frontMaterial || resolved.material), color:text(resolved.frontColor || resolved.color) };
  }

  function zoneForCabinet(cab, opts){
    const planner = getPlanner();
    if(planner && typeof planner.zoneForCabinet === 'function') return planner.zoneForCabinet(cab, opts);
    const type = text(cab && cab.type).toLowerCase();
    if(type === 'wisząca' || type === 'wiszaca') return 'upper';
    if(type === 'moduł' || type === 'modul') return 'middle';
    return 'lower';
  }

  function frontSourceKey(front){
    const planner = getPlanner();
    if(planner && typeof planner.frontSourceKey === 'function') return planner.frontSourceKey(front);
    const payload = front && front.frontMaterialSource && typeof front.frontMaterialSource === 'object' ? front.frontMaterialSource : null;
    const key = text(payload && payload.source);
    return ZONE_KEYS.includes(key) ? key : '';
  }

  function setSourceKey(set){
    const planner = getPlanner();
    if(planner && typeof planner.setSourceKey === 'function') return planner.setSourceKey(set);
    const raw = set && typeof set === 'object' ? set : {};
    const nested = raw.frontSource && typeof raw.frontSource === 'object' ? raw.frontSource : null;
    const key = text((nested && nested.source) || raw.frontSourceKey || raw.source);
    return ZONE_KEYS.includes(key) ? key : '';
  }

  function normalizeSelection(selection){
    const planner = getPlanner();
    if(planner && typeof planner.normalizeSelection === 'function') return planner.normalizeSelection(selection);
    const src = isPlainObject(selection) ? selection : {};
    return { zones:src.zones || {}, fields:src.fields || {} };
  }

  function buildPlan(room, selection){
    const planner = getPlanner();
    if(planner && typeof planner.buildPlan === 'function') return planner.buildPlan(room, selection);
    return { room:text(room), selection:normalizeSelection(selection), ready:false, total:0, hasChanges:false, notes:['Brak planera zmian.'] };
  }

  function setIfDifferent(target, key, value){
    const next = text(value);
    if(!target || !next || !different(target[key], next)) return 0;
    target[key] = next;
    return 1;
  }

  function regenerateCabinetFronts(room, cab){
    try{
      if(ns.cabinetFronts && typeof ns.cabinetFronts.generateFrontsForCabinet === 'function'){
        ns.cabinetFronts.generateFrontsForCabinet(room, cab);
        return true;
      }
    }catch(_){ }
    return false;
  }

  function applyCabinetMaterials(room, roomData, selection, counters){
    const cabinets = Array.isArray(roomData.cabinets) ? roomData.cabinets : [];
    cabinets.forEach((cab)=>{
      if(!cab || typeof cab !== 'object') return;
      const zoneKey = zoneForCabinet(cab, { setAsLower:true });
      if(!selection.zones[zoneKey]) return;
      const defaults = resolveZoneDefaults(room, zoneKey, cab);
      if(selection.fields.body) counters.body += setIfDifferent(cab, 'bodyColor', defaults.bodyColor);
      if(selection.fields.back) counters.back += setIfDifferent(cab, 'backMaterial', defaults.backMaterial);
      if(selection.fields.opening) counters.opening += setIfDifferent(cab, 'openingSystem', defaults.openingSystem);
    });
  }

  function applyPlainCabinetFronts(room, roomData, selection, counters){
    if(!selection.fields.front) return;
    const cabinets = Array.isArray(roomData.cabinets) ? roomData.cabinets : [];
    cabinets.forEach((cab)=>{
      if(!cab || typeof cab !== 'object' || text(cab.setId)) return;
      const isFridge = text(cab.type) === 'stojąca' && text(cab.subType) === 'lodowkowa';
      if(isFridge) return;
      const zoneKey = zoneForCabinet(cab, { setAsLower:false });
      if(!selection.zones[zoneKey]) return;
      const target = resolveZoneFront(room, zoneKey, cab);
      let changed = 0;
      changed += setIfDifferent(cab, 'frontMaterial', target.material);
      changed += setIfDifferent(cab, 'frontColor', target.color);
      if(changed){
        regenerateCabinetFronts(room, cab);
        counters.front += 1;
      }
    });
  }

  function applySourceFronts(room, roomData, selection, counters){
    if(!selection.fields.front) return;
    const fronts = Array.isArray(roomData.fronts) ? roomData.fronts : [];
    const cabinets = Array.isArray(roomData.cabinets) ? roomData.cabinets : [];
    const cabinetsById = new Map(cabinets.map((cab)=> [String(cab && cab.id || ''), cab]));
    const touchedFridgeCabIds = new Set();
    const touchedSetIds = new Set();

    fronts.forEach((front)=>{
      const zoneKey = frontSourceKey(front);
      if(!zoneKey || !selection.zones[zoneKey]) return;
      const target = resolveZoneFront(room, zoneKey, front);
      let changed = 0;
      changed += setIfDifferent(front, 'material', target.material);
      changed += setIfDifferent(front, 'color', target.color);
      if(changed){
        counters.front += 1;
        if(text(front.cabId)) touchedFridgeCabIds.add(text(front.cabId));
        if(text(front.setId)) touchedSetIds.add(text(front.setId));
      }
    });

    touchedFridgeCabIds.forEach((cabId)=>{
      const cab = cabinetsById.get(String(cabId));
      if(cab && text(cab.subType) === 'lodowkowa') regenerateCabinetFronts(room, cab);
    });

    const sets = Array.isArray(roomData.sets) ? roomData.sets : [];
    sets.forEach((set)=>{
      if(!set || !touchedSetIds.has(text(set.id))) return;
      const zoneKey = setSourceKey(set);
      if(!zoneKey || !selection.zones[zoneKey]) return;
      const target = resolveZoneFront(room, zoneKey, set);
      setIfDifferent(set, 'frontMaterial', target.material);
      setIfDifferent(set, 'frontColor', target.color);
      cabinets.forEach((cab)=>{
        if(!cab || text(cab.setId) !== text(set.id)) return;
        setIfDifferent(cab, 'frontMaterial', target.material);
        setIfDifferent(cab, 'frontColor', target.color);
      });
    });
  }

  function applySetRecordMaterials(room, roomData, selection, counters){
    if(!selection.zones.lower) return;
    const sets = Array.isArray(roomData.sets) ? roomData.sets : [];
    if(!sets.length) return;
    sets.forEach((set)=>{
      if(!set || typeof set !== 'object') return;
      const defaults = resolveZoneDefaults(room, 'lower', set);
      if(selection.fields.body) setIfDifferent(set, 'bodyColor', defaults.bodyColor);
      if(selection.fields.back) setIfDifferent(set, 'backMaterial', defaults.backMaterial);
      if(selection.fields.opening) setIfDifferent(set, 'openingSystem', defaults.openingSystem);
    });
  }

  function saveAndRender(){
    try{
      if(ns.project && typeof ns.project.save === 'function') projectData = ns.project.save(projectData);
    }catch(_){ }
    try{ if(typeof renderCabinets === 'function') renderCabinets(); }catch(_){ }
    try{ if(ns.wywiadRoomPreferences && typeof ns.wywiadRoomPreferences.renderSummary === 'function'){ ns.wywiadRoomPreferences.renderSummary(); } }catch(_){ }
  }

  function apply(room, selection){
    const normalized = normalizeSelection(selection);
    const plan = buildPlan(room, normalized);
    if(!plan.ready || !plan.hasChanges) return { ok:false, plan, changed:{ body:0, front:0, back:0, opening:0 }, message:'Brak zmian do zastosowania.' };
    const roomData = getRoomData(room);
    if(!roomData) return { ok:false, plan, changed:{ body:0, front:0, back:0, opening:0 }, message:'Brak pomieszczenia.' };
    const counters = { body:0, front:0, back:0, opening:0 };

    applyCabinetMaterials(room, roomData, normalized, counters);
    applySetRecordMaterials(room, roomData, normalized, counters);
    applyPlainCabinetFronts(room, roomData, normalized, counters);
    applySourceFronts(room, roomData, normalized, counters);

    saveAndRender();
    return { ok:true, plan:buildPlan(room, normalized), changed:counters, message:'Zastosowano preferencje do istniejących szafek.' };
  }

  ns.roomPreferencesBulkApply = { apply, buildPlan };
})();

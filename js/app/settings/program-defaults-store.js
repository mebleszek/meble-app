// js/app/settings/program-defaults-store.js
// Globalne domyślne materiały i okucia programu.

(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  const STORAGE_KEY = (FC.constants && FC.constants.STORAGE_KEYS && FC.constants.STORAGE_KEYS.programDefaults) || 'fc_program_defaults_v1';

  const ZONE_KEYS = ['lower','middle','upper'];
  const DEFAULT_ZONE = { bodyColor:'', frontMaterial:'', frontColor:'', backMaterial:'', openingSystem:'', bodyPcvMode:'body', bodyPcvCustomColor:'' };
  const DEFAULT_PROGRAM_DEFAULTS = {
    version:2,
    general:{ finishStandard:'', blendStandard:'' },
    zones:{ lower:Object.assign({}, DEFAULT_ZONE), middle:Object.assign({}, DEFAULT_ZONE), upper:Object.assign({}, DEFAULT_ZONE) },
    hardware:{ hingesManufacturer:'', drawerSystemManufacturer:'', drawerSystemKey:'', liftManufacturer:'', slidingSystemManufacturer:'', cargoManufacturer:'', accessoriesManufacturer:'' }
  };

  function clone(value){
    try{ return (FC.utils && typeof FC.utils.clone === 'function') ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function text(value){ return String(value == null ? '' : value).trim(); }

  function normalizeProgramDefaults(raw){
    const src = raw && typeof raw === 'object' ? raw : {};
    const materials = src.materials && typeof src.materials === 'object' ? src.materials : src;
    const hardware = src.hardware && typeof src.hardware === 'object' ? src.hardware : src;
    const general = src.general || {};
    const zones = {};
    const legacy = {
      bodyColor:text(materials.bodyColor || materials.defaultBodyColor),
      frontMaterial:text(materials.frontMaterial || materials.defaultFrontMaterial),
      frontColor:text(materials.frontColor || materials.defaultFrontColor),
      backMaterial:text(materials.backMaterial || materials.defaultBackMaterial)
    };
    ZONE_KEYS.forEach((key)=>{
      const candidate = src.zones && src.zones[key];
      const zone = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : legacy;
      zones[key] = {
        bodyColor:text(zone.bodyColor), frontMaterial:text(zone.frontMaterial), frontColor:text(zone.frontColor), backMaterial:text(zone.backMaterial),
        openingSystem:text(zone.openingSystem),
        bodyPcvMode:zone.bodyPcvMode === 'front' ? 'front' : 'body',
        bodyPcvCustomColor:text(zone.bodyPcvCustomColor)
      };
    });
    return {
      version:2,
      general:{ finishStandard:text(general.finishStandard), blendStandard:text(general.blendStandard) },
      zones,
      hardware:{
        hingesManufacturer:text(hardware.hingesManufacturer || hardware.hingeManufacturer || hardware.defaultHingesManufacturer),
        drawerSystemManufacturer:text(hardware.drawerSystemManufacturer || hardware.drawersManufacturer || hardware.drawerManufacturer || hardware.defaultDrawerSystemManufacturer),
        drawerSystemKey:text(hardware.drawerSystemKey),
        liftManufacturer:text(hardware.liftManufacturer || hardware.liftsManufacturer || hardware.defaultLiftManufacturer),
        slidingSystemManufacturer:text(hardware.slidingSystemManufacturer || hardware.slidingManufacturer || hardware.defaultSlidingSystemManufacturer),
        cargoManufacturer:text(hardware.cargoManufacturer || hardware.organizerManufacturer || hardware.defaultCargoManufacturer),
        accessoriesManufacturer:text(hardware.accessoriesManufacturer || hardware.otherAccessoriesManufacturer || hardware.defaultAccessoriesManufacturer)
      }
    };
  }

  function read(){
    try{
      const storage = FC.storage;
      if(storage && typeof storage.getJSON === 'function') return normalizeProgramDefaults(storage.getJSON(STORAGE_KEY, DEFAULT_PROGRAM_DEFAULTS));
    }catch(_){ }
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return normalizeProgramDefaults(raw ? JSON.parse(raw) : DEFAULT_PROGRAM_DEFAULTS);
    }catch(_){ return normalizeProgramDefaults(DEFAULT_PROGRAM_DEFAULTS); }
  }

  function write(next){
    const normalized = normalizeProgramDefaults(next);
    try{
      const storage = FC.storage;
      if(storage && typeof storage.setJSON === 'function'){
        if(storage.setJSON(STORAGE_KEY, normalized) === false) return null;
      }
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }catch(_){ return null; }
    return clone(normalized);
  }

  function reset(){ return write(DEFAULT_PROGRAM_DEFAULTS); }

  function getZoneDefaults(zone){ return clone(read().zones[ZONE_KEYS.includes(zone) ? zone : 'lower']); }
  // Compatibility projection; all values still come from the canonical zones.
  function getMaterialDefaults(zone){
    const z = getZoneDefaults(zone);
    return { bodyColor:z.bodyColor, frontMaterial:z.frontMaterial, frontColor:z.frontColor, backMaterial:z.backMaterial };
  }
  function getGeneralDefaults(){ return clone(read().general); }
  function getHardwareDefaults(){ return clone(read().hardware); }

  function applyMaterialsToDraft(draft, defaults){
    const target = draft && typeof draft === 'object' ? draft : {};
    const source = normalizeProgramDefaults(defaults || read()).zones.lower;
    if(source.bodyColor) target.bodyColor = source.bodyColor;
    if(source.frontMaterial) target.frontMaterial = source.frontMaterial;
    if(source.frontColor) target.frontColor = source.frontColor;
    if(source.backMaterial) target.backMaterial = source.backMaterial;
    return target;
  }

  function hasMeaningfulDefaults(value){
    const defaults = normalizeProgramDefaults(value || read());
    return Object.values(defaults.general).some(Boolean)
      || Object.values(defaults.zones).some((zone)=> Object.entries(zone).some(([key,value])=> key === 'bodyPcvMode' ? value === 'front' : !!text(value)))
      || Object.values(defaults.hardware).some((value)=> !!text(value));
  }

  function buildSummary(value){
    const defaults = normalizeProgramDefaults(value || read());
    const parts = [];
    if(defaults.general.finishStandard) parts.push(defaults.general.finishStandard);
    if(defaults.general.blendStandard) parts.push(defaults.general.blendStandard);
    ZONE_KEYS.forEach((key)=>{
      const z = defaults.zones[key];
      const values = [z.bodyColor, z.frontMaterial, z.frontColor, z.backMaterial, z.openingSystem, z.bodyPcvMode === 'front' ? 'PCV pod kolor frontu' : '', z.bodyPcvCustomColor].filter(Boolean);
      if(values.length) parts.push(({ lower:'Dolna', middle:'Środkowa', upper:'Górna' })[key] + ': ' + values.join(' / '));
    });
    Object.values(defaults.hardware).filter(Boolean).forEach((value)=> parts.push(value));
    return parts.length ? parts.join(' • ') : 'Brak globalnych domyślnych — program użyje starych awaryjnych wartości.';
  }

  FC.programDefaults = {
    STORAGE_KEY,
    DEFAULT_PROGRAM_DEFAULTS: clone(DEFAULT_PROGRAM_DEFAULTS),
    normalizeProgramDefaults,
    read,
    write,
    reset,
    getMaterialDefaults,
    getZoneDefaults,
    getGeneralDefaults,
    getHardwareDefaults,
    applyMaterialsToDraft,
    hasMeaningfulDefaults,
    buildSummary
  };
})();

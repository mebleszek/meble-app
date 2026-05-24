// js/app/settings/program-defaults-store.js
// Globalne domyślne materiały i okucia programu.

(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  const STORAGE_KEY = (FC.constants && FC.constants.STORAGE_KEYS && FC.constants.STORAGE_KEYS.programDefaults) || 'fc_program_defaults_v1';

  const DEFAULT_PROGRAM_DEFAULTS = {
    version: 1,
    materials: {
      bodyColor: '',
      frontMaterial: '',
      frontColor: '',
      backMaterial: ''
    },
    hardware: {
      hingesManufacturer: '',
      drawerSystemManufacturer: '',
      liftManufacturer: '',
      slidingSystemManufacturer: '',
      cargoManufacturer: '',
      accessoriesManufacturer: ''
    }
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
    return {
      version: 1,
      materials: {
        bodyColor: text(materials.bodyColor || materials.defaultBodyColor),
        frontMaterial: text(materials.frontMaterial || materials.defaultFrontMaterial),
        frontColor: text(materials.frontColor || materials.defaultFrontColor),
        backMaterial: text(materials.backMaterial || materials.defaultBackMaterial)
      },
      hardware: {
        hingesManufacturer: text(hardware.hingesManufacturer || hardware.hingeManufacturer || hardware.defaultHingesManufacturer),
        drawerSystemManufacturer: text(hardware.drawerSystemManufacturer || hardware.drawersManufacturer || hardware.drawerManufacturer || hardware.defaultDrawerSystemManufacturer),
        liftManufacturer: text(hardware.liftManufacturer || hardware.liftsManufacturer || hardware.defaultLiftManufacturer),
        slidingSystemManufacturer: text(hardware.slidingSystemManufacturer || hardware.slidingManufacturer || hardware.defaultSlidingSystemManufacturer),
        cargoManufacturer: text(hardware.cargoManufacturer || hardware.organizerManufacturer || hardware.defaultCargoManufacturer),
        accessoriesManufacturer: text(hardware.accessoriesManufacturer || hardware.otherAccessoriesManufacturer || hardware.defaultAccessoriesManufacturer)
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
      if(storage && typeof storage.setJSON === 'function') storage.setJSON(STORAGE_KEY, normalized);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }catch(_){ }
    return clone(normalized);
  }

  function reset(){ return write(DEFAULT_PROGRAM_DEFAULTS); }

  function getMaterialDefaults(){ return clone(read().materials); }
  function getHardwareDefaults(){ return clone(read().hardware); }

  function applyMaterialsToDraft(draft, defaults){
    const target = draft && typeof draft === 'object' ? draft : {};
    const source = normalizeProgramDefaults(defaults || read()).materials;
    if(source.bodyColor) target.bodyColor = source.bodyColor;
    if(source.frontMaterial) target.frontMaterial = source.frontMaterial;
    if(source.frontColor) target.frontColor = source.frontColor;
    if(source.backMaterial) target.backMaterial = source.backMaterial;
    return target;
  }

  function hasMeaningfulDefaults(value){
    const defaults = normalizeProgramDefaults(value || read());
    return Object.keys(defaults.materials).some((key)=> !!text(defaults.materials[key]))
      || Object.keys(defaults.hardware).some((key)=> !!text(defaults.hardware[key]));
  }

  function buildSummary(value){
    const defaults = normalizeProgramDefaults(value || read());
    const parts = [];
    const mat = defaults.materials;
    const hw = defaults.hardware;
    if(mat.bodyColor) parts.push('korpus: ' + mat.bodyColor);
    if(mat.frontMaterial || mat.frontColor) parts.push('front: ' + [mat.frontMaterial, mat.frontColor].filter(Boolean).join(' / '));
    if(mat.backMaterial) parts.push('plecy: ' + mat.backMaterial);
    if(hw.hingesManufacturer) parts.push('zawiasy: ' + hw.hingesManufacturer);
    if(hw.drawerSystemManufacturer) parts.push('szuflady/prowadnice: ' + hw.drawerSystemManufacturer);
    if(hw.liftManufacturer) parts.push('podnośniki: ' + hw.liftManufacturer);
    if(hw.slidingSystemManufacturer) parts.push('przesuwne: ' + hw.slidingSystemManufacturer);
    if(hw.cargoManufacturer) parts.push('cargo/organizery: ' + hw.cargoManufacturer);
    if(hw.accessoriesManufacturer) parts.push('pozostałe akcesoria: ' + hw.accessoriesManufacturer);
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
    getHardwareDefaults,
    applyMaterialsToDraft,
    hasMeaningfulDefaults,
    buildSummary
  };
})();

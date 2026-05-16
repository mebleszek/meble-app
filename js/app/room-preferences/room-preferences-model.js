// js/app/room-preferences/room-preferences-model.js
// Model preferencji standardu zapisanych przy konkretnym pomieszczeniu.
// Etap 1B: preferencje są strefowe: dolna/stojące, środkowa/moduły, górna/wiszące.

(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  const ZONE_KEYS = ['lower','middle','upper'];
  const ZONE_META = {
    lower: { key:'lower', label:'Strefa dolna / stojące', shortLabel:'Dolna', type:'stojąca', openingOptionsKey:'standing' },
    middle: { key:'middle', label:'Strefa środkowa / moduły', shortLabel:'Środkowa', type:'moduł', openingOptionsKey:'module' },
    upper: { key:'upper', label:'Strefa górna / wiszące', shortLabel:'Górna', type:'wisząca', openingOptionsKey:'hanging' }
  };

  const DEFAULT_ZONE_PREFERENCES = {
    bodyColor: '',
    frontMaterial: '',
    frontColor: '',
    backMaterial: '',
    openingSystem: ''
  };

  const DEFAULT_ROOM_PREFERENCES = {
    finishStandard: '',
    blendStandard: '',
    zones: {
      lower: Object.assign({}, DEFAULT_ZONE_PREFERENCES),
      middle: Object.assign({}, DEFAULT_ZONE_PREFERENCES),
      upper: Object.assign({}, DEFAULT_ZONE_PREFERENCES)
    },
    // legacy-only: zachowywane przy normalizacji starych projektów, nie jest już pokazywane w UI WYWIADU.
    hardwareManufacturer: ''
  };

  const OPENING_OPTIONS = {
    standing: ['uchwyt klienta','TIP-ON','krawędziowy HEXA GTV','UKW','korytkowy'],
    hanging: ['uchwyt klienta','podchwyt','TIP-ON','krawędziowy HEXA GTV','korytkowy','UKW'],
    module: ['uchwyt klienta','TIP-ON','krawędziowy HEXA GTV','UKW','korytkowy']
  };

  function clone(value){
    try{ if(ns.utils && typeof ns.utils.clone === 'function') return ns.utils.clone(value); }catch(_){ }
    try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; }
  }

  function text(value){ return String(value == null ? '' : value).trim(); }
  function isPlainObject(value){ return !!value && typeof value === 'object' && (value.constructor === Object || Object.getPrototypeOf(value) === null); }

  function normalizeZonePreferences(raw, legacy){
    const src = isPlainObject(raw) ? raw : {};
    const legacySrc = isPlainObject(legacy) ? legacy : {};
    return {
      bodyColor: text(src.bodyColor || legacySrc.bodyColor),
      frontMaterial: text(src.frontMaterial || legacySrc.frontMaterial),
      frontColor: text(src.frontColor || legacySrc.frontColor),
      backMaterial: text(src.backMaterial || legacySrc.backMaterial),
      openingSystem: text(src.openingSystem || legacySrc.openingSystem)
    };
  }

  function legacyZoneFor(src, zoneKey){
    const legacyOpening = text(src && src.openingSystem);
    if(zoneKey === 'upper'){
      return {
        bodyColor: src && src.bodyColor,
        frontMaterial: src && src.frontMaterial,
        frontColor: src && src.frontColor,
        backMaterial: src && src.backMaterial,
        openingSystem: src && (src.openingSystemHanging || legacyOpening)
      };
    }
    if(zoneKey === 'middle'){
      return {
        bodyColor: src && src.bodyColor,
        frontMaterial: src && src.frontMaterial,
        frontColor: src && src.frontColor,
        backMaterial: src && src.backMaterial,
        openingSystem: src && (src.openingSystemModule || legacyOpening)
      };
    }
    return {
      bodyColor: src && src.bodyColor,
      frontMaterial: src && src.frontMaterial,
      frontColor: src && src.frontColor,
      backMaterial: src && src.backMaterial,
      openingSystem: src && (src.openingSystemStanding || src.openingSystemLower || legacyOpening)
    };
  }

  function normalizeRoomPreferences(raw){
    const src = isPlainObject(raw) ? raw : {};
    const rawZones = isPlainObject(src.zones) ? src.zones : {};
    const out = {
      finishStandard: text(src.finishStandard),
      blendStandard: text(src.blendStandard),
      zones: {},
      hardwareManufacturer: text(src.hardwareManufacturer)
    };
    ZONE_KEYS.forEach((zoneKey)=>{
      out.zones[zoneKey] = normalizeZonePreferences(rawZones[zoneKey], legacyZoneFor(src, zoneKey));
    });
    return out;
  }

  function ensureProjectRoom(room){
    const key = text(room);
    if(!key) return null;
    try{
      if(typeof projectData === 'undefined' || !projectData || typeof projectData !== 'object') return null;
      projectData[key] = projectData[key] && typeof projectData[key] === 'object'
        ? projectData[key]
        : { cabinets:[], fronts:[], sets:[], settings:{} };
      projectData[key].preferences = normalizeRoomPreferences(projectData[key].preferences);
      return projectData[key];
    }catch(_){ return null; }
  }

  function getRoomPreferences(room){
    const key = text(room);
    try{
      const roomData = (typeof projectData !== 'undefined' && projectData && projectData[key]) ? projectData[key] : null;
      return normalizeRoomPreferences(roomData && roomData.preferences);
    }catch(_){ return normalizeRoomPreferences(null); }
  }

  function saveProject(){
    try{
      if(ns.project && typeof ns.project.save === 'function'){
        projectData = ns.project.save(projectData);
      }
    }catch(_){ }
    return projectData;
  }

  function setRoomPreferences(room, nextPreferences, opts){
    const key = text(room);
    const roomData = ensureProjectRoom(key);
    if(!roomData) return normalizeRoomPreferences(null);
    roomData.preferences = normalizeRoomPreferences(nextPreferences);
    if(!(opts && opts.skipSave)) saveProject();
    return clone(roomData.preferences);
  }

  function zoneKeyForCabinetType(typeValue){
    const type = text(typeValue).toLowerCase();
    if(type === 'wisząca' || type === 'wiszaca') return 'upper';
    if(type === 'moduł' || type === 'modul') return 'middle';
    return 'lower';
  }

  function openingKeyForType(typeValue){
    const zoneKey = zoneKeyForCabinetType(typeValue);
    if(zoneKey === 'upper') return 'openingSystemHanging';
    if(zoneKey === 'middle') return 'openingSystemModule';
    return 'openingSystemStanding';
  }

  function getZonePreferences(preferences, zoneOrType){
    const prefs = normalizeRoomPreferences(preferences);
    const raw = text(zoneOrType);
    const zoneKey = ZONE_KEYS.includes(raw) ? raw : zoneKeyForCabinetType(raw);
    return clone((prefs.zones && prefs.zones[zoneKey]) || DEFAULT_ZONE_PREFERENCES);
  }

  function getOpeningSystemForCabinetType(preferences, typeValue){
    const zone = getZonePreferences(preferences, typeValue);
    return text(zone.openingSystem);
  }

  function applyPreferencesToDraft(room, draft){
    const target = draft && typeof draft === 'object' ? draft : {};
    const prefs = getRoomPreferences(room);
    const zone = getZonePreferences(prefs, target.type);
    if(zone.bodyColor) target.bodyColor = zone.bodyColor;
    if(zone.frontMaterial) target.frontMaterial = zone.frontMaterial;
    if(zone.frontColor) target.frontColor = zone.frontColor;
    if(zone.backMaterial) target.backMaterial = zone.backMaterial;
    if(zone.openingSystem) target.openingSystem = zone.openingSystem;
    return target;
  }

  function hasMeaningfulZone(zone){
    const normalized = normalizeZonePreferences(zone);
    return Object.keys(DEFAULT_ZONE_PREFERENCES).some((key)=> !!text(normalized[key]));
  }

  function hasMeaningfulPreferences(preferences){
    const prefs = normalizeRoomPreferences(preferences);
    if(text(prefs.finishStandard) || text(prefs.blendStandard) || text(prefs.hardwareManufacturer)) return true;
    return ZONE_KEYS.some((zoneKey)=> hasMeaningfulZone(prefs.zones && prefs.zones[zoneKey]));
  }

  function summarizeZone(zoneKey, zone){
    const z = normalizeZonePreferences(zone);
    const chunks = [];
    if(z.bodyColor) chunks.push('korpus: ' + z.bodyColor);
    if(z.frontMaterial || z.frontColor) chunks.push('front: ' + [z.frontMaterial, z.frontColor].filter(Boolean).join(' / '));
    if(z.backMaterial) chunks.push('plecy: ' + z.backMaterial);
    if(z.openingSystem) chunks.push('otwieranie: ' + z.openingSystem);
    return chunks.length ? (ZONE_META[zoneKey].shortLabel + ': ' + chunks.join(', ')) : '';
  }

  function getSummary(preferences){
    const prefs = normalizeRoomPreferences(preferences);
    const chunks = [];
    if(prefs.finishStandard) chunks.push('wykończenie: ' + prefs.finishStandard);
    if(prefs.blendStandard) chunks.push('blendy: ' + prefs.blendStandard);
    ZONE_KEYS.forEach((zoneKey)=>{
      const summary = summarizeZone(zoneKey, prefs.zones && prefs.zones[zoneKey]);
      if(summary) chunks.push(summary);
    });
    return chunks.length ? chunks.join(' • ') : 'Brak preferencji strefowych — nowe szafki użyją globalnych domyślnych z trybiku albo awaryjnych wartości programu.';
  }

  ns.roomPreferences = Object.assign({}, ns.roomPreferences || {}, {
    DEFAULT_ZONE_PREFERENCES: clone(DEFAULT_ZONE_PREFERENCES),
    DEFAULT_ROOM_PREFERENCES: clone(DEFAULT_ROOM_PREFERENCES),
    ROOM_PREFERENCE_ZONES: clone(ZONE_META),
    ZONE_KEYS: ZONE_KEYS.slice(),
    OPENING_OPTIONS: clone(OPENING_OPTIONS),
    normalizeZonePreferences,
    normalizeRoomPreferences,
    ensureProjectRoom,
    getRoomPreferences,
    setRoomPreferences,
    zoneKeyForCabinetType,
    openingKeyForType,
    getZonePreferences,
    getOpeningSystemForCabinetType,
    applyPreferencesToDraft,
    hasMeaningfulPreferences,
    getSummary
  });
})();

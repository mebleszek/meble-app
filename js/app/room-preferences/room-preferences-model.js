// js/app/room-preferences/room-preferences-model.js
// Model preferencji standardu zapisanych przy konkretnym pomieszczeniu.

(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  const DEFAULT_ROOM_PREFERENCES = {
    finishStandard: '',
    blendStandard: '',
    bodyColor: '',
    frontMaterial: '',
    frontColor: '',
    backMaterial: '',
    openingSystemStanding: '',
    openingSystemHanging: '',
    openingSystemModule: '',
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

  function normalizeRoomPreferences(raw){
    const src = raw && typeof raw === 'object' ? raw : {};
    const legacyOpening = text(src.openingSystem);
    const out = Object.assign({}, DEFAULT_ROOM_PREFERENCES, {
      finishStandard: text(src.finishStandard),
      blendStandard: text(src.blendStandard),
      bodyColor: text(src.bodyColor),
      frontMaterial: text(src.frontMaterial),
      frontColor: text(src.frontColor),
      backMaterial: text(src.backMaterial),
      openingSystemStanding: text(src.openingSystemStanding || src.openingSystemLower || legacyOpening),
      openingSystemHanging: text(src.openingSystemHanging || legacyOpening),
      openingSystemModule: text(src.openingSystemModule || legacyOpening),
      hardwareManufacturer: text(src.hardwareManufacturer)
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

  function openingKeyForType(typeValue){
    const type = text(typeValue).toLowerCase();
    if(type === 'wisząca' || type === 'wiszaca') return 'openingSystemHanging';
    if(type === 'moduł' || type === 'modul') return 'openingSystemModule';
    return 'openingSystemStanding';
  }

  function getOpeningSystemForCabinetType(preferences, typeValue){
    const prefs = normalizeRoomPreferences(preferences);
    return text(prefs[openingKeyForType(typeValue)]);
  }

  function applyPreferencesToDraft(room, draft){
    const target = draft && typeof draft === 'object' ? draft : {};
    const prefs = getRoomPreferences(room);
    if(prefs.bodyColor) target.bodyColor = prefs.bodyColor;
    if(prefs.frontMaterial) target.frontMaterial = prefs.frontMaterial;
    if(prefs.frontColor) target.frontColor = prefs.frontColor;
    if(prefs.backMaterial) target.backMaterial = prefs.backMaterial;
    const opening = getOpeningSystemForCabinetType(prefs, target.type);
    if(opening) target.openingSystem = opening;
    return target;
  }

  function hasMeaningfulPreferences(preferences){
    const prefs = normalizeRoomPreferences(preferences);
    return Object.keys(DEFAULT_ROOM_PREFERENCES).some((key)=> !!text(prefs[key]));
  }

  function getSummary(preferences){
    const prefs = normalizeRoomPreferences(preferences);
    const chunks = [];
    if(prefs.finishStandard) chunks.push('wykończenie: ' + prefs.finishStandard);
    if(prefs.blendStandard) chunks.push('blendy: ' + prefs.blendStandard);
    if(prefs.bodyColor) chunks.push('korpus: ' + prefs.bodyColor);
    if(prefs.frontMaterial || prefs.frontColor) chunks.push('front: ' + [prefs.frontMaterial, prefs.frontColor].filter(Boolean).join(' / '));
    if(prefs.backMaterial) chunks.push('plecy: ' + prefs.backMaterial);
    if(prefs.openingSystemStanding) chunks.push('dolne/stojące: ' + prefs.openingSystemStanding);
    if(prefs.openingSystemHanging) chunks.push('górne: ' + prefs.openingSystemHanging);
    if(prefs.openingSystemModule) chunks.push('moduł: ' + prefs.openingSystemModule);
    if(prefs.hardwareManufacturer) chunks.push('okucia: ' + prefs.hardwareManufacturer);
    return chunks.length ? chunks.join(' • ') : 'Brak zapisanych preferencji — nowe szafki użyją dotychczasowych domyślnych wartości.';
  }

  ns.roomPreferences = Object.assign({}, ns.roomPreferences || {}, {
    DEFAULT_ROOM_PREFERENCES: clone(DEFAULT_ROOM_PREFERENCES),
    OPENING_OPTIONS: clone(OPENING_OPTIONS),
    normalizeRoomPreferences,
    ensureProjectRoom,
    getRoomPreferences,
    setRoomPreferences,
    openingKeyForType,
    getOpeningSystemForCabinetType,
    applyPreferencesToDraft,
    hasMeaningfulPreferences,
    getSummary
  });
})();

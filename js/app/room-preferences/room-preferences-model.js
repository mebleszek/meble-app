// js/app/room-preferences/room-preferences-model.js
// Model preferencji zapisanych przy konkretnym pomieszczeniu.
// Materiały/kolory są strefowe, a producenci okuć są osobnym wyborem z katalogu producentów.

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
    openingSystem: '',
    bodyPcvMode: 'body'
  };

  const HARDWARE_PRODUCER_GROUPS = [
    { key:'hinges', label:'Zawiasy', shortLabel:'Zawiasy', defaultField:'hingesManufacturer' },
    { key:'drawers', label:'Szuflady / prowadnice', shortLabel:'Szuflady', defaultField:'drawerSystemManufacturer' },
    { key:'lifts', label:'Podnośniki', shortLabel:'Podnośniki', defaultField:'liftManufacturer' },
    { key:'cargo', label:'Cargo', shortLabel:'Cargo', defaultField:'cargoManufacturer' },
    { key:'accessories', label:'Pozostałe akcesoria', shortLabel:'Akcesoria', defaultField:'accessoriesManufacturer' }
  ];

  const DEFAULT_HARDWARE_PRODUCER_PREFERENCES = HARDWARE_PRODUCER_GROUPS.reduce((out, group)=>{
    out[group.key] = '';
    return out;
  }, {});

  const DRAWER_SYSTEM_OPTIONS = [
    { key:'', label:'— nie ustawiaj —', manufacturer:'', system:'', model:'', drawerSystem:'' },
    { key:'box_runners', label:'Skrzynkowe — same prowadnice', manufacturer:'', system:'skrzynkowe', model:'', drawerSystem:'skrzynkowe', materialSpec:'box_18_bottom_10' },
    { key:'blum_tandembox_antaro', label:'Blum TANDEMBOX Antaro', manufacturer:'Blum', system:'systemowe', brand:'blum', model:'tandembox_antaro', drawerSystem:'systemowe', materialSpec:'producer_spec' },
    { key:'blum_legrabox', label:'Blum LEGRABOX', manufacturer:'Blum', system:'systemowe', brand:'blum', model:'legrabox', drawerSystem:'systemowe', materialSpec:'producer_spec' },
    { key:'blum_merivobox', label:'Blum MERIVOBOX', manufacturer:'Blum', system:'systemowe', brand:'blum', model:'merivobox', drawerSystem:'systemowe', materialSpec:'producer_spec' },
    { key:'gtv_axis_pro', label:'GTV Axis Pro', manufacturer:'GTV', system:'systemowe', brand:'gtv', model:'axis_pro', drawerSystem:'systemowe', materialSpec:'producer_spec' },
    { key:'rejs_systemowe', label:'Rejs — system szuflady', manufacturer:'Rejs', system:'systemowe', brand:'rejs', model:'rejs_systemowe', drawerSystem:'systemowe', materialSpec:'producer_spec' }
  ];

  const DEFAULT_HARDWARE_DRAWER_SYSTEM_PREFERENCES = { drawers:'' };

  const DEFAULT_ROOM_PREFERENCES = {
    finishStandard: '',
    blendStandard: '',
    zones: {
      lower: Object.assign({}, DEFAULT_ZONE_PREFERENCES),
      middle: Object.assign({}, DEFAULT_ZONE_PREFERENCES),
      upper: Object.assign({}, DEFAULT_ZONE_PREFERENCES)
    },
    hardwareProducers: Object.assign({}, DEFAULT_HARDWARE_PRODUCER_PREFERENCES),
    hardwareDrawerSystems: Object.assign({}, DEFAULT_HARDWARE_DRAWER_SYSTEM_PREFERENCES),
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
  function normalizePcvMode(value){
    try{ if(ns.materialEdgeStore && typeof ns.materialEdgeStore.normalizePcvMode === 'function') return ns.materialEdgeStore.normalizePcvMode(value); }catch(_){ }
    const raw = text(value).toLowerCase();
    return ['front','fronts','pod kolor frontow','pod kolor frontów'].includes(raw) ? 'front' : 'body';
  }
  function pcvModeLabel(value){
    try{ if(ns.materialEdgeStore && typeof ns.materialEdgeStore.pcvModeLabel === 'function') return ns.materialEdgeStore.pcvModeLabel(value); }catch(_){ }
    return normalizePcvMode(value) === 'front' ? 'pod kolor frontów' : 'pod kolor płyty';
  }
  function isPlainObject(value){ return !!value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.toString.call(value) === '[object Object]'; }

  function normalizeZonePreferences(raw, legacy){
    const src = isPlainObject(raw) ? raw : {};
    const legacySrc = isPlainObject(legacy) ? legacy : {};
    return {
      bodyColor: text(src.bodyColor || legacySrc.bodyColor),
      frontMaterial: text(src.frontMaterial || legacySrc.frontMaterial),
      frontColor: text(src.frontColor || legacySrc.frontColor),
      backMaterial: text(src.backMaterial || legacySrc.backMaterial),
      openingSystem: text(src.openingSystem || legacySrc.openingSystem),
      bodyPcvMode: normalizePcvMode(src.bodyPcvMode || src.pcvMode || src.edgeColorMode || legacySrc.bodyPcvMode || legacySrc.pcvMode || legacySrc.edgeColorMode)
    };
  }

  function normalizeDrawerSystemKey(value){
    const raw = text(value);
    if(!raw) return '';
    const normalized = raw.toLowerCase().replace(/[\s\-]+/g, '_');
    const hit = DRAWER_SYSTEM_OPTIONS.find((opt)=> opt.key === raw || opt.key === normalized || text(opt.label).toLowerCase() === raw.toLowerCase());
    return hit ? hit.key : '';
  }

  function getDrawerSystemOption(value){
    const key = normalizeDrawerSystemKey(value);
    return clone(DRAWER_SYSTEM_OPTIONS.find((opt)=> opt.key === key) || DRAWER_SYSTEM_OPTIONS[0]);
  }

  function getDrawerSystemOptions(){ return clone(DRAWER_SYSTEM_OPTIONS); }

  function normalizeHardwareDrawerSystemPreferences(raw, legacy){
    const src = isPlainObject(raw) ? raw : {};
    const legacySrc = isPlainObject(legacy) ? legacy : {};
    return {
      drawers: normalizeDrawerSystemKey(src.drawers || src.drawerSystem || legacySrc.drawerSystemPreference || legacySrc.defaultDrawerSystem || legacySrc.drawerSystem)
    };
  }

  function normalizeHardwareProducerPreferences(raw, legacy){
    const src = isPlainObject(raw) ? raw : {};
    const legacySrc = isPlainObject(legacy) ? legacy : {};
    const legacyAll = text(legacySrc.hardwareManufacturer || legacySrc.manufacturer);
    const out = {};
    HARDWARE_PRODUCER_GROUPS.forEach((group)=>{
      const key = group.key;
      const defaultField = group.defaultField;
      out[key] = text(src[key] || src[defaultField] || legacySrc[key] || legacySrc[defaultField] || legacyAll);
    });
    return out;
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
      hardwareProducers: normalizeHardwareProducerPreferences(src.hardwareProducers || src.hardware, src),
      hardwareDrawerSystems: normalizeHardwareDrawerSystemPreferences(src.hardwareDrawerSystems || src.drawerSystems || src.hardwareDrawerSystem, src),
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



  function getProgramMaterialDefaults(){
    try{
      if(ns.programDefaults && typeof ns.programDefaults.getMaterialDefaults === 'function'){
        return ns.programDefaults.getMaterialDefaults() || {};
      }
    }catch(_){ }
    return {};
  }

  function getProgramHardwareDefaults(){
    try{
      if(ns.programDefaults && typeof ns.programDefaults.getHardwareDefaults === 'function'){
        return ns.programDefaults.getHardwareDefaults() || {};
      }
    }catch(_){ }
    return {};
  }

  function applyMaterialFields(target, source){
    const out = target && typeof target === 'object' ? target : {};
    const src = source && typeof source === 'object' ? source : {};
    if(text(src.bodyColor)) out.bodyColor = text(src.bodyColor);
    if(text(src.frontMaterial)) out.frontMaterial = text(src.frontMaterial);
    if(text(src.frontColor)) out.frontColor = text(src.frontColor);
    if(text(src.backMaterial)) out.backMaterial = text(src.backMaterial);
    if(text(src.openingSystem)) out.openingSystem = text(src.openingSystem);
    if(src.bodyPcvMode != null || src.pcvMode != null || src.edgeColorMode != null) out.bodyPcvMode = normalizePcvMode(src.bodyPcvMode || src.pcvMode || src.edgeColorMode);
    return out;
  }

  function normalizeFallbackDefaults(fallback){
    const src = fallback && typeof fallback === 'object' ? fallback : {};
    return {
      bodyColor: text(src.bodyColor),
      frontMaterial: text(src.frontMaterial || src.material),
      frontColor: text(src.frontColor || src.color),
      backMaterial: text(src.backMaterial),
      openingSystem: text(src.openingSystem),
      bodyPcvMode: normalizePcvMode(src.bodyPcvMode || src.pcvMode || src.edgeColorMode)
    };
  }

  function resolveZoneDefaults(room, zoneOrType, fallback){
    const resolved = normalizeFallbackDefaults(fallback);
    const globalDefaults = getProgramMaterialDefaults();
    applyMaterialFields(resolved, {
      bodyColor: globalDefaults.bodyColor,
      frontMaterial: globalDefaults.frontMaterial,
      frontColor: globalDefaults.frontColor,
      backMaterial: globalDefaults.backMaterial
    });
    const prefs = getRoomPreferences(room);
    const zone = getZonePreferences(prefs, zoneOrType);
    applyMaterialFields(resolved, zone);
    return resolved;
  }

  function applyZoneDefaultsToDraft(room, draft, zoneOrType){
    const target = draft && typeof draft === 'object' ? draft : {};
    const resolved = resolveZoneDefaults(room, zoneOrType || target.type, target);
    applyMaterialFields(target, resolved);
    return target;
  }

  function resolveZoneFrontMaterial(room, zoneOrType, fallback){
    const resolved = resolveZoneDefaults(room, zoneOrType, fallback);
    return {
      material: text(resolved.frontMaterial),
      color: text(resolved.frontColor),
      frontMaterial: text(resolved.frontMaterial),
      frontColor: text(resolved.frontColor)
    };
  }

  function getHardwareProducerGroup(groupKey){
    const key = text(groupKey);
    return HARDWARE_PRODUCER_GROUPS.find((group)=> group.key === key) || null;
  }

  function getHardwareProducerPreferences(preferences){
    return normalizeHardwareProducerPreferences((normalizeRoomPreferences(preferences).hardwareProducers || {}), preferences);
  }

  function getHardwareDrawerSystemPreferences(preferences){
    return normalizeHardwareDrawerSystemPreferences((normalizeRoomPreferences(preferences).hardwareDrawerSystems || {}), preferences);
  }

  function resolveDrawerSystemPreference(room, fallback){
    const fallbackKey = normalizeDrawerSystemKey(fallback);
    const prefs = getRoomPreferences(room);
    const roomKey = normalizeDrawerSystemKey(prefs.hardwareDrawerSystems && prefs.hardwareDrawerSystems.drawers);
    return getDrawerSystemOption(roomKey || fallbackKey || '');
  }

  function applyDrawerSystemPreferenceToDetails(room, details, opts){
    const target = details && typeof details === 'object' ? details : {};
    const force = !!(opts && opts.force);
    const opt = resolveDrawerSystemPreference(room, opts && opts.fallback);
    if(!opt || !opt.key) return target;
    if(!force && (target.drawerSystem || target.drawerBrand || target.drawerModel)) return target;
    target.drawerSystem = opt.drawerSystem || opt.system || 'skrzynkowe';
    if(opt.brand || opt.manufacturer) target.drawerBrand = opt.brand || String(opt.manufacturer || '').toLowerCase();
    if(opt.model) target.drawerModel = opt.model;
    target.drawerPreferenceApplied = opt.key;
    return target;
  }

  function resolveHardwareProducerPreference(room, groupKey, fallback){
    const group = getHardwareProducerGroup(groupKey);
    if(!group) return text(fallback);
    const prefs = getRoomPreferences(room);
    const roomValue = text(prefs.hardwareProducers && prefs.hardwareProducers[group.key]);
    if(roomValue) return roomValue;
    const defaults = getProgramHardwareDefaults();
    const globalValue = text(defaults[group.defaultField] || defaults[group.key]);
    const drawerPref = group.key === 'drawers' ? resolveDrawerSystemPreference(room, '').manufacturer : '';
    return drawerPref || globalValue || text(fallback);
  }

  function hasMeaningfulZone(zone){
    const normalized = normalizeZonePreferences(zone);
    return Object.keys(DEFAULT_ZONE_PREFERENCES).some((key)=> !!text(normalized[key]));
  }

  function hasMeaningfulHardwareProducers(preferences){
    const prefs = normalizeRoomPreferences(preferences);
    return HARDWARE_PRODUCER_GROUPS.some((group)=> !!text(prefs.hardwareProducers && prefs.hardwareProducers[group.key]));
  }

  function hasMeaningfulPreferences(preferences){
    const prefs = normalizeRoomPreferences(preferences);
    if(text(prefs.finishStandard) || text(prefs.blendStandard) || text(prefs.hardwareManufacturer) || hasMeaningfulHardwareProducers(prefs) || text(prefs.hardwareDrawerSystems && prefs.hardwareDrawerSystems.drawers)) return true;
    return ZONE_KEYS.some((zoneKey)=> hasMeaningfulZone(prefs.zones && prefs.zones[zoneKey]));
  }

  function summarizeZone(zoneKey, zone){
    const z = normalizeZonePreferences(zone);
    const chunks = [];
    if(z.bodyColor) chunks.push('korpus: ' + z.bodyColor);
    if(z.frontMaterial || z.frontColor) chunks.push('front: ' + [z.frontMaterial, z.frontColor].filter(Boolean).join(' / '));
    if(z.backMaterial) chunks.push('plecy: ' + z.backMaterial);
    if(z.openingSystem) chunks.push('otwieranie: ' + z.openingSystem);
    if(z.bodyPcvMode && normalizePcvMode(z.bodyPcvMode) !== 'body') chunks.push('PCV: ' + pcvModeLabel(z.bodyPcvMode));
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
    return chunks.length ? chunks.join(' • ') : 'Brak preferencji materiałów i kolorów — nowe szafki użyją globalnych domyślnych z trybiku albo awaryjnych wartości programu.';
  }

  function getHardwareProducerSummary(preferences){
    const prefs = normalizeRoomPreferences(preferences);
    const chunks = [];
    HARDWARE_PRODUCER_GROUPS.forEach((group)=>{
      const value = text(prefs.hardwareProducers && prefs.hardwareProducers[group.key]);
      if(group.key === 'drawers'){
        const opt = getDrawerSystemOption(prefs.hardwareDrawerSystems && prefs.hardwareDrawerSystems.drawers);
        if(opt && opt.key){ chunks.push(group.shortLabel + ': ' + opt.label); return; }
      }
      if(value) chunks.push(group.shortLabel + ': ' + value);
    });
    return chunks.length ? chunks.join(' • ') : 'Brak preferencji producentów okuć — program użyje globalnych domyślnych z trybiku albo dotychczasowych wartości szafki.';
  }

  ns.roomPreferences = Object.assign({}, ns.roomPreferences || {}, {
    DEFAULT_ZONE_PREFERENCES: clone(DEFAULT_ZONE_PREFERENCES),
    DEFAULT_HARDWARE_PRODUCER_PREFERENCES: clone(DEFAULT_HARDWARE_PRODUCER_PREFERENCES),
    DEFAULT_HARDWARE_DRAWER_SYSTEM_PREFERENCES: clone(DEFAULT_HARDWARE_DRAWER_SYSTEM_PREFERENCES),
    DRAWER_SYSTEM_OPTIONS: clone(DRAWER_SYSTEM_OPTIONS),
    DEFAULT_ROOM_PREFERENCES: clone(DEFAULT_ROOM_PREFERENCES),
    ROOM_PREFERENCE_ZONES: clone(ZONE_META),
    HARDWARE_PRODUCER_GROUPS: clone(HARDWARE_PRODUCER_GROUPS),
    ZONE_KEYS: ZONE_KEYS.slice(),
    OPENING_OPTIONS: clone(OPENING_OPTIONS),
    normalizeZonePreferences,
    normalizeHardwareProducerPreferences,
    normalizeHardwareDrawerSystemPreferences,
    normalizeDrawerSystemKey,
    normalizeRoomPreferences,
    normalizePcvMode,
    pcvModeLabel,
    ensureProjectRoom,
    getRoomPreferences,
    setRoomPreferences,
    zoneKeyForCabinetType,
    openingKeyForType,
    getZonePreferences,
    getOpeningSystemForCabinetType,
    getProgramMaterialDefaults,
    getProgramHardwareDefaults,
    getHardwareProducerPreferences,
    getHardwareDrawerSystemPreferences,
    getDrawerSystemOptions,
    getDrawerSystemOption,
    getHardwareProducerGroup,
    resolveHardwareProducerPreference,
    resolveDrawerSystemPreference,
    applyDrawerSystemPreferenceToDetails,
    resolveZoneDefaults,
    resolveZoneFrontMaterial,
    applyZoneDefaultsToDraft,
    applyPreferencesToDraft,
    hasMeaningfulHardwareProducers,
    hasMeaningfulPreferences,
    getSummary,
    getHardwareProducerSummary
  });
})();

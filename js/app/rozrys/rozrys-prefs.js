(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const OVERRIDE_KEY = 'fc_rozrys_overrides_v1';
  const EDGE_KEY = 'fc_edge_v1';
  const PANEL_PREFS_KEY = 'fc_rozrys_panel_prefs_v1';
  const ACCORDION_PREFS_KEY = 'fc_rozrys_material_accordion_v1';

  function readJson(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      const obj = raw ? JSON.parse(raw) : fallback;
      return (obj && typeof obj === 'object') ? obj : fallback;
    }catch(_){
      return fallback;
    }
  }

  function writeJson(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value && typeof value === 'object' ? value : {})); }catch(_){ }
  }

  function parseLocaleNumber(v){
    if(v === null || v === undefined) return NaN;
    if(typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    const s = String(v).trim().replace(',', '.');
    if(!s) return NaN;
    return Number(s);
  }

  function cmToMm(v){
    const n = parseLocaleNumber(v);
    if(!Number.isFinite(n)) return 0;
    return Math.round(n * 10);
  }

  function mmToStr(mm){
    const n = Math.round(Number(mm) || 0);
    return String(n);
  }

  function mmToUnitStr(mm, unit){
    const u = (unit === 'cm') ? 'cm' : 'mm';
    const n = Math.round(Number(mm) || 0);
    if(u === 'mm') return String(n);
    const cm = n / 10;
    const s = (Math.round(cm * 10) / 10).toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  }

  function loadOverrides(){ return readJson(OVERRIDE_KEY, {}); }
  function saveOverrides(obj){ writeJson(OVERRIDE_KEY, obj || {}); }
  function loadPanelPrefs(){ return readJson(PANEL_PREFS_KEY, {}); }
  function savePanelPrefs(obj){ writeJson(PANEL_PREFS_KEY, obj || {}); }
  function loadAccordionPrefs(){ return readJson(ACCORDION_PREFS_KEY, {}); }
  function saveAccordionPrefs(obj){ writeJson(ACCORDION_PREFS_KEY, obj || {}); }
  function loadEdgeStore(){ return readJson(EDGE_KEY, {}); }

  function getAccordionPref(scopeKey){
    try{
      const prefs = loadAccordionPrefs();
      const entry = prefs && typeof prefs === 'object' ? prefs[String(scopeKey || '')] : null;
      return (entry && typeof entry === 'object') ? entry : { material:'', open:false };
    }catch(_){
      return { material:'', open:false };
    }
  }

  function setAccordionPref(scopeKey, material, open){
    try{
      const prefs = loadAccordionPrefs();
      prefs[String(scopeKey || '')] = { material: String(material || ''), open: !!open };
      saveAccordionPrefs(prefs);
    }catch(_){ }
  }

  function getGrainStore(){
    return (FC && FC.rozrysGrain) || null;
  }

  function getMaterialGrainEnabled(material, hasGrain){
    try{
      const store = getGrainStore();
      if(store && typeof store.getMaterialEnabled === 'function') return !!store.getMaterialEnabled(material, hasGrain);
    }catch(_){ }
    return !!hasGrain;
  }

  function setMaterialGrainEnabled(material, enabled, hasGrain){
    try{
      const store = getGrainStore();
      if(store && typeof store.setMaterialEnabled === 'function') store.setMaterialEnabled(material, enabled, hasGrain);
    }catch(_){ }
  }

  function getMaterialGrainExceptions(material, allowedKeys, hasGrain){
    try{
      const store = getGrainStore();
      if(!store) return {};
      if(typeof store.pruneMaterialExceptions === 'function' && Array.isArray(allowedKeys)) return store.pruneMaterialExceptions(material, allowedKeys, hasGrain);
      if(typeof store.getMaterialExceptions === 'function') return store.getMaterialExceptions(material) || {};
    }catch(_){ }
    return {};
  }

  function setMaterialGrainExceptions(material, exceptions, hasGrain){
    try{
      const store = getGrainStore();
      if(store && typeof store.setMaterialExceptions === 'function') store.setMaterialExceptions(material, exceptions, hasGrain);
    }catch(_){ }
  }

  function partSignature(p){
    if(p && p.sourceSig){
      return `${p.sourceSig}||${String(p.grainMode || p.direction || 'default')}||${p.w}x${p.h}`;
    }
    return `${p && p.material || ''}||${p && p.name || ''}||${p && p.w || 0}x${p && p.h || 0}`;
  }

  FC.rozrysPrefs = {
    OVERRIDE_KEY,
    EDGE_KEY,
    PANEL_PREFS_KEY,
    ACCORDION_PREFS_KEY,
    parseLocaleNumber,
    cmToMm,
    mmToStr,
    mmToUnitStr,
    loadOverrides,
    saveOverrides,
    loadPanelPrefs,
    savePanelPrefs,
    loadAccordionPrefs,
    saveAccordionPrefs,
    loadEdgeStore,
    getAccordionPref,
    setAccordionPref,
    getMaterialGrainEnabled,
    setMaterialGrainEnabled,
    getMaterialGrainExceptions,
    setMaterialGrainExceptions,
    partSignature,
  };
})();

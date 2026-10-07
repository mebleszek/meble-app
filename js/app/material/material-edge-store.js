// js/app/material/material-edge-store.js
// Dane obrzeży w zakładce MATERIAŁ — podpisy elementów, domyślne okleiny i zapis edge store.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const EDGE_KEY = 'fc_edge_v1';
  const PCV_MODE_BODY = 'body';
  const PCV_MODE_FRONT = 'front';

  function cmToMm(value){
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 10) : 0;
  }

  function getPartOptionsApi(){
    try{ return (window.FC && window.FC.materialPartOptions) || null; }catch(_){ return null; }
  }

  function normalizeMaterialKey(material){
    const partOptionsApi = getPartOptionsApi();
    try{
      if(partOptionsApi && typeof partOptionsApi.normalizeMaterialKey === 'function'){
        return String(partOptionsApi.normalizeMaterialKey(material || '') || '').trim();
      }
    }catch(_){ }
    const raw = String(material || '').trim();
    const m = raw.match(/^\s*Front\s*:\s*[^•]+?\s*•\s*(.+)$/i);
    return m ? String(m[1] || '').trim() : raw;
  }

  function normalizePcvMode(value){
    const raw = String(value == null ? '' : value).trim().toLowerCase();
    if(['front','fronts','front_color','frontcolor','pod_front','pod-kolor-frontow','pod kolor frontow','pod kolor frontów','fronts_color'].includes(raw)) return PCV_MODE_FRONT;
    return PCV_MODE_BODY;
  }

  function pcvModeLabel(value){
    return normalizePcvMode(value) === PCV_MODE_FRONT ? 'pod kolor frontów' : 'pod kolor płyty';
  }

  function getCabinetPcvMode(cabinet){
    const cab = cabinet && typeof cabinet === 'object' ? cabinet : {};
    return normalizePcvMode(cab.bodyPcvMode || cab.pcvMode || cab.edgeColorMode || cab.corpusPcvMode || cab.carcassPcvMode);
  }

  function normalizeText(value){
    return String(value == null ? '' : value)
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/[ąćęłńóśźż]/g, (ch)=> ({'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z'}[ch] || ch))
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function getMaterialItems(){
    try{
      if(FC.catalogStore && typeof FC.catalogStore === 'function'){
        const store = FC.catalogStore();
        if(store && typeof store.getMaterials === 'function') return store.getMaterials() || [];
      }
    }catch(_){ }
    try{ return Array.isArray(typeof materials !== 'undefined' ? materials : []) ? materials : []; }catch(_){ return []; }
  }

  function splitFrontMaterial(material){
    const raw = String(material || '').trim();
    const match = raw.match(/^\s*Front\s*:\s*([^•]+?)(?:\s*•\s*(.+))?\s*$/i);
    if(!match) return null;
    return {
      materialType:String(match[1] || '').trim().toLowerCase(),
      name:String(match[2] || '').trim(),
      raw,
    };
  }

  function findMaterialRow(material){
    const raw = String(material || '').trim();
    if(!raw) return null;
    const front = splitFrontMaterial(raw);
    const candidates = [raw, normalizeMaterialKey(raw), front && front.name].map((value)=> normalizeText(value)).filter(Boolean);
    const list = getMaterialItems();
    return (Array.isArray(list) ? list : []).find((row)=> {
      const name = normalizeText(row && row.name);
      if(!name) return false;
      if(candidates.includes(name)) return true;
      const symbol = normalizeText(row && row.symbol);
      const manufacturer = normalizeText(row && row.manufacturer);
      if(symbol && candidates.some((candidate)=> candidate === symbol || candidate.includes(symbol))) return true;
      return !!(manufacturer && symbol && candidates.some((candidate)=> candidate.includes(manufacturer) && candidate.includes(symbol)));
    }) || null;
  }

  function resolveMaterialType(material){
    const raw = String(material || '').trim();
    const front = splitFrontMaterial(raw);
    if(front && front.materialType) return front.materialType;

    const row = findMaterialRow(raw);
    if(row && String(row.materialType || '').trim()) return String(row.materialType || '').trim().toLowerCase();

    const key = normalizeText(raw);
    if(!key) return '';
    if(key === 'laminat' || key.includes(' laminat') || key.includes('laminat ')) return 'laminat';
    if(key.includes('hdf') || key.includes('plecy')) return 'hdf';
    if(key.includes('lakier')) return 'lakier';
    if(key.includes('akryl')) return 'akryl';
    if(key.includes('blat')) return 'blat';
    if(key.includes('obrzez') || key.includes('pcv')) return 'obrzeże';
    if(key.includes('okucia') || key.includes('zawias') || key.includes('podnosnik')) return 'okucia';
    return '';
  }

  function isPcvEligibleMaterial(material){
    return resolveMaterialType(material) === 'laminat';
  }

  function isPcvEligiblePart(part){
    if(part && part.pcvEligible === false) return false;
    const qty = Number(part && part.qty) || 0;
    const a = Number(part && part.a) || 0;
    const b = Number(part && part.b) || 0;
    return qty > 0 && a > 0 && b > 0 && isPcvEligibleMaterial(part && part.material);
  }

  function signatureFromPart(part){
    const partOptionsApi = getPartOptionsApi();
    try{
      if(partOptionsApi && typeof partOptionsApi.signatureFromPart === 'function'){
        return String(partOptionsApi.signatureFromPart(part) || '');
      }
    }catch(_){ }
    const p = part || {};
    return `${normalizeMaterialKey(p.material)}||${String(p.name || '').trim()}||${cmToMm(p.a)}x${cmToMm(p.b)}`;
  }

  function getDirection(sig){
    const partOptionsApi = getPartOptionsApi();
    try{
      if(partOptionsApi && typeof partOptionsApi.getDirection === 'function') return partOptionsApi.getDirection(sig);
    }catch(_){ }
    return 'default';
  }

  function labelForDirection(sig){
    const dir = getDirection(sig);
    const partOptionsApi = getPartOptionsApi();
    try{
      if(partOptionsApi && typeof partOptionsApi.labelForDirection === 'function') return partOptionsApi.labelForDirection(dir);
    }catch(_){ }
    return 'Domyślny z materiału';
  }

  function loadStore(){
    try{
      const raw = localStorage.getItem(EDGE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(_){ return {}; }
  }

  function explicitEdges(value){
    const edges = value || {};
    return { w1:!!edges.w1, w2:!!edges.w2, h1:!!edges.h1, h2:!!edges.h2 };
  }

  function sameEdges(a, b){
    return ['w1','w2','h1','h2'].every((edge)=> !!(a && a[edge]) === !!(b && b[edge]));
  }

  function sessionEdgeBaseline(){
    const session = FC.session;
    if(!(session && session.active && session.snapshot && Object.prototype.hasOwnProperty.call(session.snapshot, EDGE_KEY))) return null;
    try{
      const raw = session.snapshot[EDGE_KEY];
      const store = raw === null ? {} : JSON.parse(raw);
      if(!(store && typeof store === 'object' && !Array.isArray(store))) return null;
      return { raw, store };
    }catch(_){ return null; }
  }

  function desiredStoreRaw(store){
    const baseline = sessionEdgeBaseline();
    const keys = Object.keys(store);
    if(baseline && keys.length === Object.keys(baseline.store).length && keys.every((key)=>
      Object.prototype.hasOwnProperty.call(baseline.store, key)
      && JSON.stringify(store[key]) === JSON.stringify(baseline.store[key]))){
      // Preserve the original missing key, whitespace, and ordering when all records return to baseline.
      return baseline.raw;
    }
    return JSON.stringify(store);
  }

  function saveStore(obj, config){
    const cfg = config || {};
    if(cfg.persist === false) return true;
    try{
      const nextRaw = desiredStoreRaw(obj || {});
      const prevRaw = localStorage.getItem(EDGE_KEY);
      if(prevRaw === nextRaw) return true;
      const session = FC.session;
      if(!(session && typeof session.begin === 'function' && session.begin() === true)) return false;
      if(nextRaw === null) localStorage.removeItem(EDGE_KEY);
      else localStorage.setItem(EDGE_KEY, nextRaw);
    }catch(_){ return false; }
    try{ window.FC && FC.views && typeof FC.views.refreshSessionButtons === 'function' && FC.views.refreshSessionButtons(); }catch(_){ }
    try{ typeof cfg.onAfterSave === 'function' && cfg.onAfterSave(obj || {}); }catch(_){ }
    return true;
  }

  function defaultEdgesForPart(part, cabinet){
    const name = String((part && part.name) || '').toLowerCase();
    const cabType = String((cabinet && cabinet.type) || '').toLowerCase();
    if(name.includes('front') || name.includes('drzwi') || name.includes('blenda') || name.includes('maskown') || name.includes('szufl') || name.includes('klapa')){
      return { w1:true, w2:true, h1:true, h2:true };
    }
    if(name.includes('plecy') || name.includes('hdf') || name.includes('tył') || name.includes('tyl')){
      return { w1:false, w2:false, h1:false, h2:false };
    }
    if(cabType.includes('wis') && name.includes('bok')){
      return { w1:true, w2:false, h1:true, h2:true };
    }
    if(
      name.includes('bok') || name.includes('półka') || name.includes('polka') || name.includes('wieniec') ||
      name.includes('trawers') || name.includes('przegrod') || name.includes('ściank') || name.includes('sciank') ||
      name.includes('dno') || name.includes('góra') || name.includes('gora') || name.includes('cok')
    ){
      return { w1:true, w2:false, h1:false, h2:false };
    }
    return { w1:false, w2:false, h1:false, h2:false };
  }

  function edgingMetersForPart(part, edges){
    const qty = Number(part && part.qty) || 0;
    const a = Number(part && part.a) || 0;
    const b = Number(part && part.b) || 0;
    if(!(qty > 0 && a > 0 && b > 0)) return 0;
    const e = edges || {};
    const cm = ((e.w1 ? 1 : 0) + (e.w2 ? 1 : 0)) * a + ((e.h1 ? 1 : 0) + (e.h2 ? 1 : 0)) * b;
    return (cm * qty) / 100;
  }

  function createEdgeStore(config){
    const cfg = config || {};
    const store = cfg.initialStore && typeof cfg.initialStore === 'object'
      ? Object.assign({}, cfg.initialStore)
      : loadStore();
    const defaultsBySig = new Map();

    function getEdges(sig, part, cabinet){
      if(!isPcvEligiblePart(part)) return { w1:false, w2:false, h1:false, h2:false };
      const key = String(sig || '');
      const defaults = defaultEdgesForPart(part, cabinet);
      if(key) defaultsBySig.set(key, defaults);
      const existing = key ? (store[key] || null) : null;
      // Defaults are derived RAM data, never members of the persisted override store.
      return explicitEdges(existing || defaults);
    }

    function setEdges(sig, patch){
      const key = String(sig || '');
      if(!key) return false;
      const hadKey = Object.prototype.hasOwnProperty.call(store, key);
      const prev = store[key];
      const defaults = defaultsBySig.get(key);
      // getEdges supplies part/cabinet defaults; a signature alone cannot determine them safely.
      if(!defaults) return false;
      const effective = explicitEdges(prev || defaults);
      const next = explicitEdges(Object.assign({}, effective, patch || {}));
      if(sameEdges(next, effective)) return true;
      const baseline = sessionEdgeBaseline();
      const baselineRecord = baseline && baseline.store[key];
      if(baselineRecord && typeof baselineRecord === 'object' && sameEdges(next, baselineRecord)){
        // Restore the touched record exactly, including a pre-existing redundant override.
        store[key] = baselineRecord;
      }else if(sameEdges(next, defaults)){
        delete store[key];
      }else{
        store[key] = next;
      }
      if(!saveStore(store, cfg)){
        if(hadKey) store[key] = prev;
        else delete store[key];
        return false;
      }
      return true;
    }

    function calcEdgeMetersForParts(parts, cabinet){
      let sum = 0;
      (Array.isArray(parts) ? parts : []).forEach((part)=>{
        if(!(Number(part && part.a) > 0 && Number(part && part.b) > 0)) return;
        if(!isPcvEligiblePart(part)) return;
        const sig = signatureFromPart(part);
        const e = getEdges(sig, part, cabinet);
        sum += edgingMetersForPart(part, e);
      });
      return sum;
    }

    function calcEdgeMetersByPcvModeForParts(parts, cabinet){
      const out = { body:0, front:0, total:0, mode:getCabinetPcvMode(cabinet) };
      const mode = out.mode;
      (Array.isArray(parts) ? parts : []).forEach((part)=>{
        if(!(Number(part && part.a) > 0 && Number(part && part.b) > 0)) return;
        if(!isPcvEligiblePart(part)) return;
        const sig = signatureFromPart(part);
        const e = getEdges(sig, part, cabinet);
        const meters = edgingMetersForPart(part, e);
        out[mode] += meters;
        out.total += meters;
      });
      return out;
    }

    function openPartOptions(part, sig, options){
      const opts = options || {};
      const partOptionsApi = getPartOptionsApi();
      try{
        if(!(partOptionsApi && typeof partOptionsApi.openOptionsModal === 'function')) return;
        try{
          if(window.FC && FC.listScrollMemory && typeof FC.listScrollMemory.rememberForCabinet === 'function'){
            FC.listScrollMemory.rememberForCabinet('material', opts.cabinetId || opts.selectedCabinetId || '');
          }
        }catch(_){ }
        const fmtCm = typeof opts.fmtCm === 'function' ? opts.fmtCm : function(value){ return String(value || 0); };
        partOptionsApi.openOptionsModal({
          sig,
          name: String((part && part.name) || 'Element'),
          material: normalizeMaterialKey(part && part.material),
          sizeText: `${fmtCm(part && part.a)} × ${fmtCm(part && part.b)} cm`,
          initialDirection: getDirection(sig),
          onSave: typeof opts.onSave === 'function' ? opts.onSave : function(){},
          onClose: function(){
            try{ window.FC && FC.listScrollMemory && typeof FC.listScrollMemory.restorePending === 'function' && FC.listScrollMemory.restorePending(); }catch(_){ }
            try{ typeof opts.onClose === 'function' && opts.onClose(); }catch(_){ }
          },
        });
      }catch(_){ }
    }

    return {
      store,
      getEdges,
      setEdges,
      calcEdgeMetersForParts,
      calcEdgeMetersByPcvModeForParts,
      openPartOptions,
      signatureFromPart,
      getDirection,
      labelForDirection,
      normalizeMaterialKey,
      resolveMaterialType,
      normalizePcvMode,
      pcvModeLabel,
      getCabinetPcvMode,
      isPcvEligibleMaterial,
      isPcvEligiblePart,
      edgingMetersForPart,
    };
  }

  FC.materialEdgeStore = {
    EDGE_KEY,
    cmToMm,
    normalizeMaterialKey,
    normalizePcvMode,
    pcvModeLabel,
    getCabinetPcvMode,
    resolveMaterialType,
    isPcvEligibleMaterial,
    isPcvEligiblePart,
    signatureFromPart,
    PCV_MODE_BODY,
    PCV_MODE_FRONT,
    defaultEdgesForPart,
    edgingMetersForPart,
    createEdgeStore,
  };
})();

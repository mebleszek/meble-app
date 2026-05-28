// js/app/cabinet/front-material-source.js
// Resolves front material sources: lower/middle/upper zone or custom material.

(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  const SOURCE_KEYS = ['lower','middle','upper','custom'];
  const SOURCE_OPTIONS = [
    { v:'lower', t:'Jak strefa dolna / stojące' },
    { v:'middle', t:'Jak strefa środkowa / moduły' },
    { v:'upper', t:'Jak strefa górna / wiszące' },
    { v:'custom', t:'Własny materiał' }
  ];
  const SOURCE_LABELS = {
    lower:'jak dolna / stojące',
    middle:'jak środkowa / moduły',
    upper:'jak górna / wiszące',
    custom:'własny'
  };

  function text(value){ return String(value == null ? '' : value).trim(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; } }

  function getMaterials(){
    try{ return Array.isArray(materials) ? materials : []; }catch(_){ return []; }
  }

  function firstColorForMaterialType(typeValue){
    const type = text(typeValue || 'laminat') || 'laminat';
    const hit = getMaterials().find((mat)=> mat && text(mat.materialType) === type);
    return text(hit && hit.name);
  }

  function normalizeSourceKey(value, fallback){
    const key = text(value || fallback || 'custom');
    return SOURCE_KEYS.includes(key) ? key : 'custom';
  }

  function normalizeSource(raw, fallback){
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
      source: normalizeSourceKey(src.source || src.zone || src.key, fallback || 'custom'),
      material: text(src.material || src.frontMaterial),
      color: text(src.color || src.frontColor)
    };
  }

  function normalizeFlatSource(details, prefix, fallbackSource, fallbackMaterial, fallbackColor){
    const d = details && typeof details === 'object' ? details : {};
    const cap = String(prefix || '').charAt(0).toUpperCase() + String(prefix || '').slice(1);
    const key = 'fridgeFrontSource' + cap;
    const matKey = 'fridgeFrontCustomMaterial' + cap;
    const colKey = 'fridgeFrontCustomColor' + cap;
    const source = normalizeSourceKey(d[key], fallbackSource || 'custom');
    return {
      source,
      material: text(d[matKey] || fallbackMaterial),
      color: text(d[colKey] || fallbackColor)
    };
  }

  function getProgramMaterialDefaults(){
    try{
      if(ns.programDefaults && typeof ns.programDefaults.getMaterialDefaults === 'function'){
        return ns.programDefaults.getMaterialDefaults() || {};
      }
    }catch(_){ }
    return {};
  }

  function getZoneMaterial(room, zoneKey){
    const zone = normalizeSourceKey(zoneKey, 'lower');
    try{
      if(ns.roomPreferences && typeof ns.roomPreferences.resolveZoneFrontMaterial === 'function'){
        const resolved = ns.roomPreferences.resolveZoneFrontMaterial(room, zone, {});
        return {
          material: text(resolved && (resolved.material || resolved.frontMaterial)),
          color: text(resolved && (resolved.color || resolved.frontColor))
        };
      }
    }catch(_){ }
    try{
      if(ns.roomPreferences && typeof ns.roomPreferences.getRoomPreferences === 'function' && typeof ns.roomPreferences.getZonePreferences === 'function'){
        const prefs = ns.roomPreferences.getRoomPreferences(room);
        const z = ns.roomPreferences.getZonePreferences(prefs, zone);
        return {
          material: text(z && z.frontMaterial),
          color: text(z && z.frontColor)
        };
      }
    }catch(_){ }
    return { material:'', color:'' };
  }

  function resolve(room, sourceSpec, fallback){
    const fb = fallback && typeof fallback === 'object' ? fallback : {};
    const spec = normalizeSource(sourceSpec, fb.source || 'custom');
    let material = '';
    let color = '';

    if(spec.source === 'custom'){
      material = text(spec.material || fb.material || fb.frontMaterial);
      color = text(spec.color || fb.color || fb.frontColor);
    } else {
      const zoneMat = getZoneMaterial(room, spec.source);
      material = text(zoneMat.material);
      color = text(zoneMat.color);
    }

    const defaults = getProgramMaterialDefaults();
    material = text(material || defaults.frontMaterial || fb.material || fb.frontMaterial || 'laminat') || 'laminat';
    color = text(color || defaults.frontColor || fb.color || fb.frontColor || firstColorForMaterialType(material));

    return {
      source: spec.source,
      material,
      color,
      label: SOURCE_LABELS[spec.source] || spec.source
    };
  }

  function getCabinetFallback(cab){
    const c = cab && typeof cab === 'object' ? cab : {};
    return {
      source:'custom',
      material:text(c.frontMaterial || 'laminat') || 'laminat',
      color:text(c.frontColor)
    };
  }

  function getFridgeSource(details, partKey, fallback){
    const d = details && typeof details === 'object' ? details : {};
    const nested = d.fridgeFrontSources && typeof d.fridgeFrontSources === 'object' ? d.fridgeFrontSources : null;
    const part = text(partKey || 'single') || 'single';
    if(nested && nested[part]) return normalizeSource(nested[part], fallback && fallback.source);
    return normalizeFlatSource(d, part, fallback && fallback.source, fallback && fallback.material, fallback && fallback.color);
  }

  function resolveFridgeFront(room, cab, partKey){
    const fallback = getCabinetFallback(cab);
    const source = getFridgeSource(cab && cab.details, partKey, fallback);
    return resolve(room, source, fallback);
  }

  function normalizeSetSource(setOrSpec, fallback){
    const raw = setOrSpec && typeof setOrSpec === 'object' ? setOrSpec : {};
    if(raw.frontSource && typeof raw.frontSource === 'object') return normalizeSource(raw.frontSource, fallback && fallback.source);
    return normalizeSource({
      source: raw.frontSourceKey || raw.source || 'custom',
      material: raw.frontSourceMaterial || raw.frontMaterial,
      color: raw.frontSourceColor || raw.frontColor
    }, fallback && fallback.source);
  }

  function resolveSetFront(room, setOrSpec, fallback){
    const fb = fallback && typeof fallback === 'object' ? fallback : {
      source:'custom',
      material:text(setOrSpec && setOrSpec.frontMaterial),
      color:text(setOrSpec && setOrSpec.frontColor)
    };
    return resolve(room, normalizeSetSource(setOrSpec, fb), fb);
  }

  function serializeSourceForFront(resolved){
    const r = resolved && typeof resolved === 'object' ? resolved : {};
    return {
      source: normalizeSourceKey(r.source, 'custom'),
      label: text(r.label || SOURCE_LABELS[r.source] || r.source)
    };
  }

  ns.frontMaterialSource = {
    SOURCE_OPTIONS: clone(SOURCE_OPTIONS),
    SOURCE_KEYS: SOURCE_KEYS.slice(),
    SOURCE_LABELS: clone(SOURCE_LABELS),
    normalizeSourceKey,
    normalizeSource,
    normalizeFlatSource,
    resolve,
    resolveFridgeFront,
    normalizeSetSource,
    resolveSetFront,
    serializeSourceForFront,
    firstColorForMaterialType
  };
})();

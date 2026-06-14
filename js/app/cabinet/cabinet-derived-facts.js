// js/app/cabinet/cabinet-derived-facts.js
// Cache faktów pochodnych szafki: formatki, materiały, PCV, wymagania, robocizna i logistyka.
(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  const VERSION = '20260614_cabinet_derived_facts_v1';
  const CACHE_FIELD = 'derivedFacts';
  const STATS_LIMIT = 20;
  let computingDepth = 0;
  let sessionStats = resetStats();

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value, fallback){
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) ? n : (Number.isFinite(fallback) ? fallback : 0);
  }
  function round(value, digits){
    const d = Math.max(0, Math.round(Number(digits) || 0));
    const m = Math.pow(10, d);
    return Math.round((Number(value) || 0) * m) / m;
  }
  function nowMs(){
    try{ return performance && typeof performance.now === 'function' ? performance.now() : Date.now(); }
    catch(_){ return Date.now(); }
  }
  function jsonSize(value){ try{ return JSON.stringify(value == null ? null : value).length; }catch(_){ return 0; } }
  function clone(value){
    try{ if(FC.utils && typeof FC.utils.clone === 'function') return FC.utils.clone(value); }catch(_){ }
    try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; }
  }
  function stableStringify(value){
    const seen = [];
    const encode = function(input){
      if(input == null || typeof input !== 'object') return JSON.stringify(input);
      if(seen.indexOf(input) >= 0) return '"[Circular]"';
      seen.push(input);
      if(Array.isArray(input)) return '[' + input.map(encode).join(',') + ']';
      return '{' + Object.keys(input).sort().map((key)=> JSON.stringify(key) + ':' + encode(input[key])).join(',') + '}';
    };
    return encode(value);
  }
  function hashString(value){
    const str = String(value || '');
    let h = 2166136261;
    for(let i = 0; i < str.length; i += 1){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }
  function cabinetWithoutCache(cabinet){
    const src = cabinet && typeof cabinet === 'object' ? cabinet : {};
    const out = clone(src) || {};
    try{ delete out[CACHE_FIELD]; }catch(_){ }
    try{ delete out._derivedFacts; }catch(_){ }
    return out;
  }
  function currentInvestorCarrying(){
    try{
      const api = FC.carryingLogistics || {};
      const inv = typeof api.currentInvestor === 'function' ? api.currentInvestor() : null;
      const carrying = inv && inv.carrying ? inv.carrying : null;
      if(typeof api.normalizeCarrying === 'function') return api.normalizeCarrying(carrying || {});
      return clone(carrying || {});
    }catch(_){ return {}; }
  }
  function inputPayload(roomId, cabinet){
    return {
      calculatorVersion:VERSION,
      roomId:text(roomId),
      cabinet:cabinetWithoutCache(cabinet),
      carrying:currentInvestorCarrying()
    };
  }
  function inputHash(roomId, cabinet){ return hashString(stableStringify(inputPayload(roomId, cabinet))); }
  function cacheOf(cabinet){
    const cache = cabinet && cabinet[CACHE_FIELD] && typeof cabinet[CACHE_FIELD] === 'object' ? cabinet[CACHE_FIELD] : null;
    if(!cache || text(cache.kind) !== 'cabinet-derived-facts') return null;
    return cache;
  }
  function isCurrent(roomId, cabinet){
    const cache = cacheOf(cabinet);
    return !!(cache && text(cache.version) === VERSION && text(cache.inputHash) === inputHash(roomId, cabinet));
  }
  function cacheStatus(roomId, cabinet){
    const cache = cacheOf(cabinet);
    if(!cache) return 'missing';
    if(text(cache.version) !== VERSION) return 'version';
    if(text(cache.inputHash) !== inputHash(roomId, cabinet)) return 'stale';
    return 'hit';
  }
  function resetStats(){
    return { hits:0, recalculations:0, missing:0, stale:0, version:0, reads:0, writes:0, errors:0, cabinets:0, timingsMs:{ total:0, cutlists:0, requirements:0, workFacts:0, logistics:0, materials:0 }, recent:[] };
  }
  function addRecent(row){
    try{
      sessionStats.recent.push(row);
      while(sessionStats.recent.length > STATS_LIMIT) sessionStats.recent.shift();
    }catch(_){ }
  }
  function addTiming(target, source){
    const t = source && source.timingsMs || {};
    Object.keys(target.timingsMs).forEach((key)=> { target.timingsMs[key] += Number(t[key]) || 0; });
  }
  function note(status, roomId, cabinet, extra){
    addRecent(Object.assign({ status, roomId:text(roomId), cabinetId:text(cabinet && cabinet.id), at:new Date().toISOString() }, extra || {}));
  }
  function isFrontPart(part){
    const name = text(part && part.name).toLowerCase();
    const material = text(part && part.material).toLowerCase();
    return name === 'front' || name.indexOf('front ') === 0 || name.indexOf('front-') === 0 || material.indexOf('front:') === 0;
  }
  function isHardwarePart(part){
    const material = text(part && part.material).toLowerCase();
    const name = text(part && part.name).toLowerCase();
    return material.indexOf('okucia') === 0 || /zawias|prowadnik|podnośnik|podnosnik|cargo|okucie/.test(name);
  }
  function partQty(part){ return Math.max(0, num(part && part.qty, 0)) || 1; }
  function cm(value){ const n = Math.max(0, num(value, 0)); return n > 1000 ? n / 10 : n; }
  function partAreaM2(part){
    const a = cm(part && part.a);
    const b = cm(part && part.b);
    return a > 0 && b > 0 ? (a / 100) * (b / 100) * partQty(part) : 0;
  }
  function materialSurfaceByKey(parts){
    const out = {};
    (Array.isArray(parts) ? parts : []).forEach((part)=> {
      if(!(cm(part && part.a) > 0 && cm(part && part.b) > 0)) return;
      const mat = text(part && part.material) || '—';
      out[mat] = round((Number(out[mat]) || 0) + partAreaM2(part), 4);
    });
    return out;
  }
  function totalsFromParts(parts){
    try{
      const common = FC.materialCommon || {};
      if(common && typeof common.totalsFromParts === 'function') return common.totalsFromParts(parts || {}) || {};
      if(typeof root.totalsFromParts === 'function') return root.totalsFromParts(parts || {}) || {};
    }catch(_){ }
    return materialSurfaceByKey(parts);
  }
  function edgeSplitFor(parts, cabinet){
    try{
      const edgeApi = FC.materialEdgeStore && typeof FC.materialEdgeStore.createEdgeStore === 'function'
        ? FC.materialEdgeStore.createEdgeStore({ persist:false })
        : null;
      if(edgeApi && typeof edgeApi.calcEdgeMetersByPcvModeForParts === 'function'){
        const split = edgeApi.calcEdgeMetersByPcvModeForParts(parts || [], cabinet || {}) || {};
        const body = Number(split.body) || 0;
        const front = Number(split.front) || 0;
        return { body:round(body, 3), front:round(front, 3), total:round(Number(split.total) || body + front, 3), mode:text(split.mode) || '' };
      }
      if(edgeApi && typeof edgeApi.calcEdgeMetersForParts === 'function'){
        const body = Number(edgeApi.calcEdgeMetersForParts(parts || [], cabinet || {})) || 0;
        return { body:round(body, 3), front:0, total:round(body, 3), mode:'body' };
      }
    }catch(_){ }
    return { body:0, front:0, total:0, mode:'' };
  }
  function getCabinetCutListRaw(roomId, cabinet){
    try{
      const api = FC.cabinetCutlist || FC.cabinetCutList || {};
      if(api && typeof api.getCabinetCutList === 'function') return clone(api.getCabinetCutList(cabinet || {}, roomId) || []);
    }catch(_){ }
    return [];
  }
  function getFrontPartsRaw(roomId, cabinet, allParts){
    let rows = [];
    try{
      const hw = FC.frontHardware || {};
      if(hw && typeof hw.getCabinetFrontCutListForMaterials === 'function') rows = hw.getCabinetFrontCutListForMaterials(roomId, clone(cabinet || {})) || [];
    }catch(_){ rows = []; }
    rows = (Array.isArray(rows) ? rows : []).filter(isFrontPart);
    if(rows.length) return clone(rows);
    return clone((Array.isArray(allParts) ? allParts : []).filter(isFrontPart));
  }
  function hardwareRequirements(roomId, cabinet){
    const out = { all:[], hinges:[], drawers:[] };
    const cab = clone(cabinet || {});
    try{
      const api = FC.cabinetHardwareRequirements || {};
      if(api && typeof api.getCabinetHardwareRequirements === 'function') out.all = clone(api.getCabinetHardwareRequirements(roomId, cab) || []);
    }catch(_){ }
    try{
      const api = FC.cabinetHardwareRequirements || {};
      if(api && typeof api.getHingeRequirementsWithQty === 'function') out.hinges = clone(api.getHingeRequirementsWithQty(roomId, cab) || []);
    }catch(_){ }
    try{
      const api = FC.cabinetDrawerRequirements || {};
      if(api && typeof api.getDrawerRequirementsWithQty === 'function') out.drawers = clone(api.getDrawerRequirementsWithQty(roomId, cab) || []);
      else if(api && typeof api.getDrawerRequirements === 'function') out.drawers = clone(api.getDrawerRequirements(roomId, cab) || []);
    }catch(_){ }
    return out;
  }
  function workFacts(roomId, cabinet){
    try{
      const api = FC.workQuantityFacts || {};
      if(api && typeof api.getCabinetFacts === 'function') return clone(api.getCabinetFacts(roomId, cabinet || {}) || []);
    }catch(_){ }
    return [];
  }
  function rawFactValues(facts){
    return (Array.isArray(facts) ? facts : []).reduce((acc, fact)=> {
      if(fact && fact.available) acc[fact.code] = fact.value;
      return acc;
    }, {});
  }
  function carryingEvaluation(roomId, cabinet){
    try{
      const api = FC.carryingLogistics || {};
      if(api && typeof api.evaluateCabinet === 'function') return clone(api.evaluateCabinet(roomId, cabinet || {}) || null);
    }catch(_){ }
    return null;
  }
  function summarizeLaborRequirements(facts, reqs, logistics){
    return {
      quantitySources:(Array.isArray(facts) ? facts : []).map((fact)=> ({ code:fact.code, value:fact.value, displayValue:fact.displayValue, available:!!fact.available, source:fact.source, warning:fact.warning })).filter((row)=> row.available || row.warning),
      hingeCount:(reqs.hinges || []).reduce((sum, row)=> sum + Math.max(0, Math.round(num(row && row.qty, 0))), 0),
      drawerCount:(reqs.drawers || []).reduce((sum, row)=> sum + Math.max(0, Math.round(num(row && row.qty, 0))), 0),
      carrying:logistics ? {
        floorUnits:logistics.floorUnits,
        peopleCount:logistics.peopleCount,
        requiresDisassembly:!!logistics.requiresDisassembly,
        liftFits:!!logistics.liftFits,
        stairsItemCount:logistics.carryingItemCount,
        highFrontCount:logistics.highFronts && logistics.highFronts.itemCount || 0
      } : null
    };
  }
  function calculate(roomId, cabinet){
    const started = nowMs();
    const timings = { total:0, cutlists:0, requirements:0, workFacts:0, logistics:0, materials:0 };
    const hash = inputHash(roomId, cabinet);
    computingDepth += 1;
    try{
      let t = nowMs();
      const allParts = getCabinetCutListRaw(roomId, cabinet);
      const frontParts = getFrontPartsRaw(roomId, cabinet, allParts);
      const corpusParts = allParts.filter((part)=> !isFrontPart(part) && !isHardwarePart(part));
      const hardwareParts = allParts.filter(isHardwarePart);
      timings.cutlists = round(nowMs() - t, 3);

      t = nowMs();
      const reqs = hardwareRequirements(roomId, cabinet);
      timings.requirements = round(nowMs() - t, 3);

      t = nowMs();
      const logistics = carryingEvaluation(roomId, cabinet);
      timings.logistics = round(nowMs() - t, 3);

      t = nowMs();
      const facts = workFacts(roomId, cabinet);
      const factMap = facts.reduce((acc, fact)=> { if(fact && fact.code) acc[fact.code] = fact; return acc; }, {});
      timings.workFacts = round(nowMs() - t, 3);

      t = nowMs();
      const material = {
        surfacesM2:materialSurfaceByKey(allParts),
        corpusSurfacesM2:materialSurfaceByKey(corpusParts),
        frontSurfacesM2:materialSurfaceByKey(frontParts),
        totals:totalsFromParts(allParts),
        edgeMetersByMode:edgeSplitFor(allParts, cabinet),
        partCount:allParts.length,
        corpusPartCount:corpusParts.length,
        frontPartCount:frontParts.length,
        hardwarePartCount:hardwareParts.length
      };
      timings.materials = round(nowMs() - t, 3);

      const cache = {
        kind:'cabinet-derived-facts',
        version:VERSION,
        inputHash:hash,
        roomId:text(roomId),
        cabinetId:text(cabinet && cabinet.id),
        calculatedAt:new Date().toISOString(),
        calculatorVersion:VERSION,
        cutlists:{ all:clone(allParts), corpus:clone(corpusParts), fronts:clone(frontParts), hardware:clone(hardwareParts) },
        material,
        workFacts:{ list:facts, map:factMap, rawValues:rawFactValues(facts) },
        hardwareRequirements:reqs,
        laborRequirements:summarizeLaborRequirements(facts, reqs, logistics),
        logistics,
        highFronts:logistics && logistics.highFronts ? clone(logistics.highFronts) : null,
        sizes:{ allParts:jsonSize(allParts), workFacts:jsonSize(facts), logistics:jsonSize(logistics), hardwareRequirements:jsonSize(reqs) },
        timingsMs:timings
      };
      timings.total = round(nowMs() - started, 3);
      cache.timingsMs = timings;
      return cache;
    } finally {
      computingDepth = Math.max(0, computingDepth - 1);
    }
  }
  function writeCache(roomId, cabinet, cache){
    if(!(cabinet && typeof cabinet === 'object' && cache)) return cache;
    cabinet[CACHE_FIELD] = cache;
    sessionStats.writes += 1;
    return cache;
  }
  function ensureCabinetFacts(roomId, cabinet, options){
    const opts = options && typeof options === 'object' ? options : {};
    sessionStats.reads += 1;
    sessionStats.cabinets += 1;
    const status = cacheStatus(roomId, cabinet);
    if(status === 'hit'){
      sessionStats.hits += 1;
      note('hit', roomId, cabinet);
      return { status:'hit', fromCache:true, cache:cacheOf(cabinet), recalculated:false };
    }
    if(status === 'missing') sessionStats.missing += 1;
    else if(status === 'stale') sessionStats.stale += 1;
    else if(status === 'version') sessionStats.version += 1;
    if(opts.recalculate === false){
      note(status, roomId, cabinet, { recalculated:false });
      return { status, fromCache:false, cache:cacheOf(cabinet), recalculated:false };
    }
    try{
      const cache = calculate(roomId, cabinet || {});
      writeCache(roomId, cabinet, cache);
      sessionStats.recalculations += 1;
      addTiming(sessionStats, cache);
      note(status, roomId, cabinet, { recalculated:true, ms:cache && cache.timingsMs && cache.timingsMs.total });
      return { status, fromCache:false, cache, recalculated:true };
    }catch(err){
      sessionStats.errors += 1;
      note('error', roomId, cabinet, { message:String(err && err.message || err || 'błąd') });
      return { status:'error', fromCache:false, cache:cacheOf(cabinet), recalculated:false, error:String(err && err.message || err || 'błąd') };
    }
  }
  function project(){
    try{ return FC.rozrys && typeof FC.rozrys.safeGetProject === 'function' ? FC.rozrys.safeGetProject() : (typeof projectData !== 'undefined' ? projectData : root.projectData); }
    catch(_){ return null; }
  }
  function normalizeRooms(rooms){
    if(Array.isArray(rooms)) return rooms.map(text).filter(Boolean);
    try{
      const proj = project() || {};
      return Object.keys(proj).filter((key)=> key !== 'meta' && key !== 'schemaVersion' && proj[key] && typeof proj[key] === 'object' && Array.isArray(proj[key].cabinets));
    }catch(_){ return []; }
  }
  function persistProject(){
    try{
      if(typeof projectData !== 'undefined' && FC.project && typeof FC.project.save === 'function'){
        root.projectData = FC.project.save(root.projectData || projectData);
        return true;
      }
      if(typeof projectData !== 'undefined' && FC.storage && typeof FC.storage.setJSON === 'function' && typeof STORAGE_KEYS !== 'undefined' && STORAGE_KEYS && STORAGE_KEYS.projectData){
        FC.storage.setJSON(STORAGE_KEYS.projectData, projectData);
        return true;
      }
    }catch(_){ }
    return false;
  }
  function summarizeEnsure(results, started){
    const summary = {
      cabinetCount:results.length,
      cacheHits:0,
      recalculations:0,
      missing:0,
      stale:0,
      version:0,
      errors:0,
      totalMs:round(nowMs() - started, 3),
      timingsMs:{ total:0, cutlists:0, requirements:0, workFacts:0, logistics:0, materials:0 },
      rows:[]
    };
    results.forEach((row)=> {
      if(row.status === 'hit') summary.cacheHits += 1;
      if(row.recalculated) summary.recalculations += 1;
      if(row.status === 'missing') summary.missing += 1;
      if(row.status === 'stale') summary.stale += 1;
      if(row.status === 'version') summary.version += 1;
      if(row.status === 'error') summary.errors += 1;
      addTiming(summary, row.cache || {});
      summary.rows.push({ roomId:row.roomId, cabinetId:row.cabinetId, status:row.status, recalculated:!!row.recalculated, ms:row.cache && row.cache.timingsMs && row.cache.timingsMs.total || 0 });
    });
    Object.keys(summary.timingsMs).forEach((key)=> { summary.timingsMs[key] = round(summary.timingsMs[key], 3); });
    return summary;
  }
  function ensureForRooms(rooms, options){
    const opts = options && typeof options === 'object' ? options : {};
    const started = nowMs();
    const proj = project() || {};
    const ids = normalizeRooms(rooms);
    const results = [];
    ids.forEach((roomId)=> {
      const list = proj && proj[roomId] && Array.isArray(proj[roomId].cabinets) ? proj[roomId].cabinets : [];
      list.forEach((cabinet)=> {
        const res = ensureCabinetFacts(roomId, cabinet, { recalculate:opts.recalculate !== false });
        results.push(Object.assign(res || {}, { roomId, cabinetId:text(cabinet && cabinet.id) }));
      });
    });
    const summary = summarizeEnsure(results, started);
    if(opts.persist !== false && summary.recalculations > 0) summary.persisted = persistProject();
    return summary;
  }
  function getWorkFacts(roomId, cabinet, options){
    if(computingDepth > 0) return null;
    const res = ensureCabinetFacts(roomId, cabinet, options || {});
    return res && res.cache && res.cache.workFacts && Array.isArray(res.cache.workFacts.list) ? clone(res.cache.workFacts.list) : null;
  }
  function getFactMap(roomId, cabinet, options){
    if(computingDepth > 0) return null;
    const res = ensureCabinetFacts(roomId, cabinet, options || {});
    return res && res.cache && res.cache.workFacts && res.cache.workFacts.map ? clone(res.cache.workFacts.map) : null;
  }
  function getCutlist(roomId, cabinet, options){
    const res = ensureCabinetFacts(roomId, cabinet, options || {});
    return res && res.cache && res.cache.cutlists ? clone(res.cache.cutlists.all || []) : null;
  }
  function getLogistics(roomId, cabinet, options){
    const res = ensureCabinetFacts(roomId, cabinet, options || {});
    return res && res.cache ? clone(res.cache.logistics || null) : null;
  }
  function normalizeFrontMaterialKey(materialKey){
    const raw = text(materialKey);
    const m = raw.match(/^\s*Front\s*:\s*[^•]+?\s*•\s*(.+)$/i);
    return m ? text(m[1]) : raw;
  }
  function resolveRozrysPart(part){
    try{
      const store = FC.materialPartOptions || null;
      if(store && typeof store.resolvePartForRozrys === 'function') return store.resolvePartForRozrys(part);
    }catch(_){ }
    const materialKey = normalizeFrontMaterialKey(text(part && part.material));
    const w = Math.round(num(part && part.a, 0) * 10);
    const h = Math.round(num(part && part.b, 0) * 10);
    return {
      materialKey,
      name:text(part && part.name) || 'Element',
      sourceSig:`${materialKey}||${text(part && part.name) || 'Element'}||${w}x${h}`,
      direction:'default',
      ignoreGrain:false,
      w,
      h,
      qty:Math.max(1, Math.round(num(part && part.qty, 0)))
    };
  }
  function sortRozrysParts(rows){
    return (Array.isArray(rows) ? rows : []).sort((a, b)=> {
      const mat = text(a && a.material).localeCompare(text(b && b.material), 'pl');
      if(mat) return mat;
      const name = text(a && a.name).localeCompare(text(b && b.name), 'pl');
      if(name) return name;
      return (Number(b && b.h) || 0) - (Number(a && a.h) || 0) || (Number(b && b.w) || 0) - (Number(a && a.w) || 0);
    });
  }
  function aggregatePartsForRooms(rooms, options){
    const opts = options && typeof options === 'object' ? options : {};
    const proj = project() || {};
    const ids = normalizeRooms(rooms);
    if(opts.ensure !== false) ensureForRooms(ids, { persist:opts.persist !== false, recalculate:true });
    const groups = {};
    const ensureGroup = function(key){
      if(!groups[key]) groups[key] = { key, frontMap:new Map(), corpusMap:new Map(), sourceMaterials:new Set(), rooms:new Set() };
      return groups[key];
    };
    ids.forEach((roomId)=> {
      const cabinets = proj && proj[roomId] && Array.isArray(proj[roomId].cabinets) ? proj[roomId].cabinets : [];
      cabinets.forEach((cabinet)=> {
        const cache = cacheOf(cabinet);
        const parts = cache && cache.cutlists && Array.isArray(cache.cutlists.all) ? cache.cutlists.all : getCabinetCutListRaw(roomId, cabinet);
        (Array.isArray(parts) ? parts : []).forEach((part)=> {
          const sourceMaterial = text(part && part.material);
          if(!sourceMaterial) return;
          const resolved = resolveRozrysPart(part);
          if(!resolved) return;
          const w = Number(resolved.w) || 0;
          const h = Number(resolved.h) || 0;
          const qty = Number(resolved.qty) || 0;
          if(!(w > 0 && h > 0 && qty > 0)) return;
          const materialKey = text(resolved.materialKey);
          if(!materialKey) return;
          const group = ensureGroup(materialKey);
          group.sourceMaterials.add(sourceMaterial);
          group.rooms.add(roomId);
          const isFront = text(resolved.name) === 'Front' || /^\s*Front\s*:/i.test(sourceMaterial);
          const map = isFront ? group.frontMap : group.corpusMap;
          const key = `${resolved.sourceSig}||${resolved.direction}||${w}||${h}`;
          if(map.has(key)) map.get(key).qty += qty;
          else map.set(key, { name:resolved.name, w, h, qty, material:materialKey, sourceSig:resolved.sourceSig, grainMode:resolved.direction, ignoreGrain:!!resolved.ignoreGrain });
        });
      });
    });
    const materials = Object.keys(groups).sort((a, b)=> a.localeCompare(b, 'pl'));
    const byMaterial = {};
    const outGroups = {};
    materials.forEach((material)=> {
      const group = groups[material];
      const frontParts = sortRozrysParts(Array.from(group.frontMap.values()));
      const corpusParts = sortRozrysParts(Array.from(group.corpusMap.values()));
      const allParts = sortRozrysParts(frontParts.concat(corpusParts));
      byMaterial[material] = allParts;
      outGroups[material] = { key:material, frontParts, corpusParts, allParts, hasFronts:frontParts.length > 0, hasCorpus:corpusParts.length > 0, sourceMaterials:Array.from(group.sourceMaterials), rooms:Array.from(group.rooms) };
    });
    return { byMaterial, materials, groups:outGroups, selectedRooms:ids, source:'cabinet-derived-facts' };
  }
  function stats(){
    const out = clone(sessionStats);
    Object.keys(out.timingsMs || {}).forEach((key)=> { out.timingsMs[key] = round(out.timingsMs[key], 3); });
    return out;
  }

  FC.cabinetDerivedFacts = {
    VERSION,
    CACHE_FIELD,
    isComputing(){ return computingDepth > 0; },
    inputHash,
    isCurrent,
    cacheStatus,
    calculate,
    ensureCabinetFacts,
    ensureForRooms,
    getWorkFacts,
    getFactMap,
    getCutlist,
    getLogistics,
    aggregatePartsForRooms,
    getStats:stats,
    resetStats(){ sessionStats = resetStats(); return stats(); },
    _debug:{ stableStringify, hashString, materialSurfaceByKey, edgeSplitFor, cabinetWithoutCache, inputPayload }
  };
})();

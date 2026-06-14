// js/app/material/material-tab-data.js
// Model danych dla zakładki MATERIAŁ — zbieranie szafek, części, sum m² i oklein poza renderem.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function getCommon(){ return (window.FC && FC.materialCommon) || {}; }
  function getHardware(){ return (window.FC && FC.frontHardware) || {}; }

  function fmtCm(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return '0';
    const s = (Math.round(n * 10) / 10).toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  }

  function resolveDeps(){
    const common = getCommon();
    const hw = getHardware();
    const mergeTotalsFn = (typeof mergeTotals === 'function')
      ? mergeTotals
      : ((typeof window.mergeTotals === 'function') ? window.mergeTotals : ((typeof common.mergeTotals === 'function') ? common.mergeTotals : function(dst, src){ Object.keys(src || {}).forEach((k)=>{ dst[k] = (Number(dst[k]) || 0) + (Number(src[k]) || 0); }); return dst; }));
    const totalsFromPartsFn = (typeof totalsFromParts === 'function')
      ? totalsFromParts
      : ((typeof window.totalsFromParts === 'function') ? window.totalsFromParts : ((typeof common.totalsFromParts === 'function') ? common.totalsFromParts : function(){ return {}; }));
    const renderTotalsFn = (typeof renderTotals === 'function')
      ? renderTotals
      : ((typeof window.renderTotals === 'function') ? window.renderTotals : ((typeof common.renderTotals === 'function') ? common.renderTotals : function(container){ if(container) container.innerHTML = ''; }));
    const getAssemblyRuleTextFn = (typeof getCabinetAssemblyRuleText === 'function')
      ? getCabinetAssemblyRuleText
      : ((typeof window.getCabinetAssemblyRuleText === 'function') ? window.getCabinetAssemblyRuleText : ((typeof common.getCabinetAssemblyRuleText === 'function') ? common.getCabinetAssemblyRuleText : function(){ return 'Skręcanie: —'; }));
    const getCabinetCutListFn = (typeof getCabinetCutList === 'function') ? getCabinetCutList : ((typeof window.getCabinetCutList === 'function') ? window.getCabinetCutList : function(){ return []; });
    const handleWeightKg = (typeof window.FC_HANDLE_WEIGHT_KG !== 'undefined') ? window.FC_HANDLE_WEIGHT_KG : (Number(hw.FC_HANDLE_WEIGHT_KG) || 0);
    const frontWeights = (window.FC_FRONT_WEIGHT_KG_M2 && typeof window.FC_FRONT_WEIGHT_KG_M2 === 'object')
      ? window.FC_FRONT_WEIGHT_KG_M2
      : (hw.FC_FRONT_WEIGHT_KG_M2 || { laminat:0, akryl:0, lakier:0 });
    return {
      mergeTotalsFn,
      totalsFromPartsFn,
      renderTotalsFn,
      getAssemblyRuleTextFn,
      getCabinetCutListFn,
      handleWeightKg,
      frontWeights,
    };
  }

  function getRoomCabinets(room){
    try{
      const project = (typeof projectData !== 'undefined') ? projectData : (window.projectData || {});
      const list = project && project[room] && Array.isArray(project[room].cabinets) ? project[room].cabinets : [];
      return list;
    }catch(_){ return []; }
  }

  function getCabinetPartsFromFacts(room, cabinet, deps){
    try{
      const api = FC.cabinetDerivedFacts || null;
      if(api && typeof api.getCutlist === 'function'){
        const parts = api.getCutlist(room, cabinet, { recalculate:true, persist:false });
        if(Array.isArray(parts)) return parts;
      }
    }catch(_){ }
    return deps.getCabinetCutListFn(cabinet, room) || [];
  }

  function buildCabinetBadge(cabinet){
    return cabinet && cabinet.setId && typeof cabinet.setNumber === 'number'
      ? `<span class="badge">Zestaw ${cabinet.setNumber}</span>`
      : '';
  }

  function normalizeMaterialScope(scope){
    const raw = scope && typeof scope === 'object' ? scope : {};
    const includeFronts = raw.includeFronts !== false;
    const includeCorpus = raw.includeCorpus !== false;
    return {
      kind:(raw.kind === 'material' && String(raw.material || '').trim()) ? 'material' : 'all',
      material:(raw.kind === 'material' && String(raw.material || '').trim()) ? String(raw.material || '').trim() : '',
      includeFronts: includeFronts || (!includeFronts && !includeCorpus),
      includeCorpus: includeCorpus || (!includeFronts && !includeCorpus),
    };
  }

  function isFrontPart(part){
    const name = String(part && part.name || '').trim().toLowerCase();
    const material = String(part && part.material || '').trim();
    return name === 'front' || /^\s*front\s*:/i.test(material);
  }

  function normalizePartMaterialKey(part, edgeApi){
    try{
      if(edgeApi && typeof edgeApi.normalizeMaterialKey === 'function') return String(edgeApi.normalizeMaterialKey(part && part.material) || '').trim();
    }catch(_){ }
    try{
      if(FC.materialEdgeStore && typeof FC.materialEdgeStore.normalizeMaterialKey === 'function') return String(FC.materialEdgeStore.normalizeMaterialKey(part && part.material) || '').trim();
    }catch(_){ }
    return String(part && part.material || '').trim();
  }

  function partMatchesScope(part, scope, edgeApi){
    const normalized = normalizeMaterialScope(scope);
    if(normalized.kind === 'material' && normalizePartMaterialKey(part, edgeApi) !== normalized.material) return false;
    const front = isFrontPart(part);
    if(front && !normalized.includeFronts) return false;
    if(!front && !normalized.includeCorpus) return false;
    return true;
  }

  function collectRoomMaterials(room, options){
    const opts = options || {};
    const deps = resolveDeps();
    const edgeApi = opts.edgeApi || (FC.materialEdgeStore && typeof FC.materialEdgeStore.createEdgeStore === 'function'
      ? FC.materialEdgeStore.createEdgeStore()
      : null);
    const cabinets = getRoomCabinets(room);
    const projectTotals = {};
    let projectEdgeMeters = 0;
    const projectEdgeMetersByMode = { body:0, front:0, total:0 };

    const cabinetRows = cabinets.map((cabinet, index)=>{
      const parts = getCabinetPartsFromFacts(room, cabinet, deps);
      const totals = deps.totalsFromPartsFn(parts);
      deps.mergeTotalsFn(projectTotals, totals);
      const edgeMetersByMode = edgeApi && typeof edgeApi.calcEdgeMetersByPcvModeForParts === 'function'
        ? edgeApi.calcEdgeMetersByPcvModeForParts(parts, cabinet)
        : { body:(edgeApi && typeof edgeApi.calcEdgeMetersForParts === 'function' ? edgeApi.calcEdgeMetersForParts(parts, cabinet) : 0), front:0, total:0, mode:'body' };
      if(!(Number(edgeMetersByMode.total) > 0)) edgeMetersByMode.total = (Number(edgeMetersByMode.body) || 0) + (Number(edgeMetersByMode.front) || 0);
      const edgeMeters = Number(edgeMetersByMode.total) || 0;
      projectEdgeMeters += edgeMeters;
      projectEdgeMetersByMode.body += Number(edgeMetersByMode.body) || 0;
      projectEdgeMetersByMode.front += Number(edgeMetersByMode.front) || 0;
      projectEdgeMetersByMode.total += edgeMeters;
      return {
        cabinet,
        index,
        badge: buildCabinetBadge(cabinet),
        parts,
        totals,
        edgeMeters,
        edgeMetersByMode,
      };
    });

    return {
      room,
      cabinets,
      cabinetRows,
      projectTotals,
      projectEdgeMeters,
      projectEdgeMetersByMode,
      deps,
      edgeApi,
      fmtCm,
    };
  }

  function collectEdgeMetersForRooms(rooms, options){
    const opts = options || {};
    const deps = resolveDeps();
    const edgeApi = opts.edgeApi || (FC.materialEdgeStore && typeof FC.materialEdgeStore.createEdgeStore === 'function'
      ? FC.materialEdgeStore.createEdgeStore({ persist: opts.persist !== false })
      : null);
    const selectedRooms = Array.isArray(rooms) ? rooms.map((room)=> String(room || '').trim()).filter(Boolean) : [];
    const scope = normalizeMaterialScope(opts.materialScope || {});
    let edgeMeters = 0;
    const edgeMetersByMode = { body:0, front:0, total:0 };
    const details = [];

    selectedRooms.forEach((room)=>{
      const cabinets = getRoomCabinets(room);
      cabinets.forEach((cabinet, index)=>{
        const parts = getCabinetPartsFromFacts(room, cabinet, deps).filter((part)=> partMatchesScope(part, scope, edgeApi));
        const cabSplit = edgeApi && typeof edgeApi.calcEdgeMetersByPcvModeForParts === 'function'
          ? edgeApi.calcEdgeMetersByPcvModeForParts(parts, cabinet)
          : { body:(edgeApi && typeof edgeApi.calcEdgeMetersForParts === 'function' ? edgeApi.calcEdgeMetersForParts(parts, cabinet) : 0), front:0, total:0, mode:'body' };
        if(!(Number(cabSplit.total) > 0)) cabSplit.total = (Number(cabSplit.body) || 0) + (Number(cabSplit.front) || 0);
        const cabEdgeMeters = Number(cabSplit.total) || 0;
        edgeMeters += cabEdgeMeters;
        edgeMetersByMode.body += Number(cabSplit.body) || 0;
        edgeMetersByMode.front += Number(cabSplit.front) || 0;
        edgeMetersByMode.total += cabEdgeMeters;
        details.push({ room, cabinet, index, parts, edgeMeters:cabEdgeMeters, edgeMetersByMode:cabSplit });
      });
    });

    return {
      rooms:selectedRooms,
      materialScope:scope,
      edgeMeters,
      edgeMetersByMode,
      details,
      edgeApi,
    };
  }

  FC.materialTabData = {
    fmtCm,
    resolveDeps,
    getRoomCabinets,
    getCabinetPartsFromFacts,
    collectRoomMaterials,
    collectEdgeMetersForRooms,
    isFrontPart,
    partMatchesScope,
    normalizeMaterialScope,
  };
})();

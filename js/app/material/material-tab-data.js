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

  function buildCabinetBadge(cabinet){
    return cabinet && cabinet.setId && typeof cabinet.setNumber === 'number'
      ? `<span class="badge">Zestaw ${cabinet.setNumber}</span>`
      : '';
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

    const cabinetRows = cabinets.map((cabinet, index)=>{
      const parts = deps.getCabinetCutListFn(cabinet, room) || [];
      const totals = deps.totalsFromPartsFn(parts);
      deps.mergeTotalsFn(projectTotals, totals);
      const edgeMeters = edgeApi && typeof edgeApi.calcEdgeMetersForParts === 'function'
        ? edgeApi.calcEdgeMetersForParts(parts, cabinet)
        : 0;
      projectEdgeMeters += edgeMeters;
      return {
        cabinet,
        index,
        badge: buildCabinetBadge(cabinet),
        parts,
        totals,
        edgeMeters,
      };
    });

    return {
      room,
      cabinets,
      cabinetRows,
      projectTotals,
      projectEdgeMeters,
      deps,
      edgeApi,
      fmtCm,
    };
  }

  FC.materialTabData = {
    fmtCm,
    resolveDeps,
    getRoomCabinets,
    collectRoomMaterials,
  };
})();

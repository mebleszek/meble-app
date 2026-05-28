(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return null; } }

  function getCommon(){ return FC.serviceCuttingCommon || null; }

  function buildState(draft, materialMeta){
    const src = getCommon() && typeof getCommon().normalizeDraft === 'function'
      ? getCommon().normalizeDraft(draft)
      : (draft || {});
    return {
      heur: 'basic',
      optimaxProfile: 'max',
      direction: 'start-along',
      unit: src.unit === 'cm' ? 'cm' : 'mm',
      boardW: Number(materialMeta && materialMeta.boardW) || Number(src.boardW) || 2800,
      boardH: Number(materialMeta && materialMeta.boardH) || Number(src.boardH) || 2070,
      kerf: Number(src.kerf) || 4,
      edgeTrim: Number(src.edgeTrim) || 10,
      grain: true,
      grainExceptions: {},
      minScrapW: 0,
      minScrapH: 0,
    };
  }

  function generatePlan(draft){
    const common = getCommon();
    if(!common || !FC.rozrysEngine) return { ok:false, error:'Brak modułów usługowego rozrysu.' };
    const normalized = common.normalizeDraft(draft);
    const materialMeta = common.resolveMaterialMeta(normalized);
    const parts = common.buildPlanParts(normalized.parts, materialMeta.name);
    if(!parts.length) return { ok:false, error:'Dodaj co najmniej jedną formatkę z poprawnymi wymiarami.' };
    const edgeStore = common.buildEdgeStore(normalized.parts);
    const state = buildState(normalized, materialMeta);
    const plan = FC.rozrysEngine.computePlan(state, parts, {
      loadEdgeStore: ()=> edgeStore,
      partSignature: (p)=> String(p && p.id || p && p.key || ''),
      isPartRotationAllowed: ()=> false,
      cutOptimizer: FC.cutOptimizer,
    });
    return {
      ok:true,
      state,
      materialMeta,
      parts,
      plan,
      savedPlan: {
        state: clone(state),
        materialMeta: clone(materialMeta),
        parts: clone(parts),
        plan: clone(plan),
      }
    };
  }

  function renderPlan(target, payload){
    if(!target) return;
    if(!(payload && payload.ok && payload.plan && FC.rozrysRender)){
      target.innerHTML = '';
      const msg = (payload && payload.error) || 'Nie udało się wygenerować rozrysu.';
      const box = document.createElement('div');
      box.className = 'muted';
      box.textContent = msg;
      target.appendChild(box);
      return;
    }
    const materialName = String(payload.materialMeta && payload.materialMeta.name || 'Materiał');
    const meta = {
      material: materialName,
      unit: payload.state.unit,
      kerf: payload.state.kerf,
      edgeSubMm: 0,
      boardW: payload.state.boardW,
      boardH: payload.state.boardH,
      trim: payload.state.edgeTrim,
      meta: payload.plan && payload.plan.meta,
      parts: payload.parts,
      scopeMode: 'service',
      selectedRooms: [],
    };
    FC.rozrysRender.renderOutput(payload.plan, meta, {
      out: target,
      buildCsv: FC.rozrysPrint && FC.rozrysPrint.buildCsv,
      downloadText: FC.rozrysPrint && FC.rozrysPrint.downloadText,
      openPrintView: FC.rozrysPrint && FC.rozrysPrint.openPrintView,
      measurePrintHeaderMm: FC.rozrysPrint && FC.rozrysPrint.measurePrintHeaderMm,
      mmToUnitStr: FC.rozrysPrefs && FC.rozrysPrefs.mmToUnitStr,
      drawSheet: FC.rozrysSheetDraw && FC.rozrysSheetDraw.drawSheet,
      openSheetListModal: FC.rozrysSummary && FC.rozrysSummary.openSheetListModal,
      openValidationListModal: FC.rozrysSummary && FC.rozrysSummary.openValidationListModal,
      buildRozrysDiagnostics: null,
      cutOptimizer: FC.cutOptimizer,
    });
  }

  FC.serviceCuttingRozrys = {
    generatePlan,
    renderPlan,
  };
})();

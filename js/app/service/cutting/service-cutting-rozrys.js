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
    const hasGrain = !!(materialMeta && materialMeta.hasGrain);
    return {
      heur: 'basic',
      optimaxProfile: 'max',
      direction: 'start-along',
      unit: src.unit === 'cm' ? 'cm' : 'mm',
      boardW: Number(materialMeta && materialMeta.boardW) || Number(src.boardW) || 2800,
      boardH: Number(materialMeta && materialMeta.boardH) || Number(src.boardH) || 2070,
      kerf: Number(src.kerf) || 4,
      edgeTrim: Number(src.edgeTrim) || 10,
      grain: hasGrain,
      grainExceptions: {},
      minScrapW: 0,
      minScrapH: 0,
    };
  }

  function computeSinglePlan(normalized, materialMeta, sourceParts){
    const common = getCommon();
    const parts = common.buildPlanParts(sourceParts, materialMeta.name);
    if(!parts.length) return { ok:false, error:'Dodaj co najmniej jedną formatkę z poprawnymi wymiarami.' };
    const edgeStore = common.buildEdgeStore(sourceParts);
    const state = buildState(normalized, materialMeta);
    const plan = FC.rozrysEngine.computePlan(state, parts, {
      loadEdgeStore: ()=> edgeStore,
      partSignature: (p)=> String(p && p.id || p && p.key || ''),
      isPartRotationAllowed: (_p, grainOn)=> !grainOn,
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

  function generatePlan(draft){
    const common = getCommon();
    if(!common || !FC.rozrysEngine) return { ok:false, error:'Brak modułów usługowego rozrysu.' };
    const normalized = common.normalizeDraft(draft);
    if(!Array.isArray(normalized.parts) || !normalized.parts.length) return { ok:false, error:'Dodaj co najmniej jedną formatkę z poprawnymi wymiarami.' };
    const groups = typeof common.groupPartsByMaterial === 'function' ? common.groupPartsByMaterial(normalized) : [];
    if(groups.length > 1){
      const groupResults = groups.map((group)=> computeSinglePlan(normalized, group.materialMeta, group.parts));
      const failed = groupResults.find((row)=> !row.ok);
      if(failed) return failed;
      return {
        ok:true,
        multi:true,
        groups:groupResults,
        plan:{ multi:true, groups:groupResults.map((row)=> row.savedPlan) },
        savedPlan:{ multi:true, groups:groupResults.map((row)=> row.savedPlan) },
      };
    }
    const materialMeta = groups.length ? groups[0].materialMeta : common.resolveMaterialMeta(normalized);
    const sourceParts = groups.length ? groups[0].parts : normalized.parts;
    return computeSinglePlan(normalized, materialMeta, sourceParts);
  }

  function renderSingle(target, payload){
    if(!target || !(payload && payload.ok && payload.plan && FC.rozrysRender)) return false;
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
    return true;
  }

  function renderPlan(target, payload){
    if(!target) return;
    target.innerHTML = '';
    if(!(payload && payload.ok)){
      const msg = (payload && payload.error) || 'Nie udało się wygenerować rozrysu.';
      const box = document.createElement('div');
      box.className = 'muted';
      box.textContent = msg;
      target.appendChild(box);
      return;
    }
    if(payload.multi && Array.isArray(payload.groups)){
      payload.groups.forEach((group, index)=>{
        const wrap = document.createElement('div');
        wrap.style.margin = index ? '18px 0 0' : '0';
        const title = document.createElement('div');
        title.style.fontWeight = '900';
        title.style.fontSize = '18px';
        title.style.marginBottom = '8px';
        title.textContent = `${group.materialMeta && group.materialMeta.name || 'Materiał'}${group.materialMeta && group.materialMeta.thickness ? ' / ' + group.materialMeta.thickness + ' mm' : ''}`;
        const out = document.createElement('div');
        wrap.appendChild(title);
        wrap.appendChild(out);
        target.appendChild(wrap);
        renderSingle(out, group);
      });
      return;
    }
    if(!renderSingle(target, payload)){
      const box = document.createElement('div');
      box.className = 'muted';
      box.textContent = 'Nie udało się wygenerować rozrysu.';
      target.appendChild(box);
    }
  }

  FC.serviceCuttingRozrys = {
    generatePlan,
    renderPlan,
  };
})();

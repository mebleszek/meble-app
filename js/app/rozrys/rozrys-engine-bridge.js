(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createApi(deps){
    deps = deps || {};
    const apiFC = deps.FC || FC;
    const loadEdgeStore = typeof deps.loadEdgeStore === 'function' ? deps.loadEdgeStore : (()=> ({}));
    const partSignature = typeof deps.partSignature === 'function' ? deps.partSignature : ((part)=> `${part && part.material || ''}||${part && part.name || ''}||${part && part.w || 0}x${part && part.h || 0}`);
    const isPartRotationAllowed = typeof deps.isPartRotationAllowed === 'function' ? deps.isPartRotationAllowed : (()=> true);
    const mmToUnitStr = typeof deps.mmToUnitStr === 'function' ? deps.mmToUnitStr : ((mm)=> String(Math.round(Number(mm) || 0)));

    function drawSheet(canvas, sheet, displayUnit, edgeSubMm, boardMeta){
      if(apiFC.rozrysSheetDraw && typeof apiFC.rozrysSheetDraw.drawSheet === 'function'){
        return apiFC.rozrysSheetDraw.drawSheet(canvas, sheet, displayUnit, edgeSubMm, boardMeta, { mmToUnitStr });
      }
    }

    function scheduleSheetCanvasRefresh(scope){
      if(apiFC.rozrysSheetDraw && typeof apiFC.rozrysSheetDraw.scheduleSheetCanvasRefresh === 'function'){
        return apiFC.rozrysSheetDraw.scheduleSheetCanvasRefresh(scope, { drawSheet });
      }
    }

    function engineOptions(options){
      return Object.assign({pcvMode:deps.pcvMode,projectId:deps.projectId},options || {},{
        loadEdgeStore,partSignature,isPartRotationAllowed,cutOptimizer:apiFC.cutOptimizer});
    }
    function computePlan(state, parts, options){
      if(apiFC.rozrysEngine && typeof apiFC.rozrysEngine.computePlan === 'function'){
        const opts=engineOptions(options);
        return apiFC.rozrysEngine.computePlan(state, opts.pcvMode==='project' ? parts.map(apiFC.projectPcvResolver.withQuantity) : parts, opts);
      }
      return { sheets: [], note: 'Brak modułu rozrysEngine.' };
    }

    function getOptimaxProfilePreset(profile, direction){
      if(apiFC.rozrysEngine && typeof apiFC.rozrysEngine.getOptimaxProfilePreset === 'function'){
        return apiFC.rozrysEngine.getOptimaxProfilePreset(profile, direction);
      }
      return {};
    }

    function normalizeCutDirection(dir){
      if(apiFC.rozrysEngine && typeof apiFC.rozrysEngine.normalizeCutDirection === 'function'){
        return apiFC.rozrysEngine.normalizeCutDirection(dir);
      }
      return 'start-along';
    }

    function speedLabel(mode){
      if(apiFC.rozrysEngine && typeof apiFC.rozrysEngine.speedLabel === 'function') return apiFC.rozrysEngine.speedLabel(mode);
      return String(mode || '');
    }

    function directionLabel(dir){
      if(apiFC.rozrysEngine && typeof apiFC.rozrysEngine.directionLabel === 'function') return apiFC.rozrysEngine.directionLabel(dir);
      return String(dir || '');
    }

    function formatHeurLabel(st){
      if(apiFC.rozrysEngine && typeof apiFC.rozrysEngine.formatHeurLabel === 'function') return apiFC.rozrysEngine.formatHeurLabel(st);
      return String((st && st.heur) || '');
    }

    function computePlanPanelProAsync(state, parts, onProgress, control, panelOpts, options){
      if(apiFC.rozrysEngine && typeof apiFC.rozrysEngine.computePlanPanelProAsync === 'function'){
        const opts=engineOptions(options);
        return apiFC.rozrysEngine.computePlanPanelProAsync(state, opts.pcvMode==='project' ? parts.map(apiFC.projectPcvResolver.withQuantity) : parts, onProgress, control, panelOpts, opts);
      }
      return Promise.resolve({ sheets: [], note: 'Brak modułu rozrysEngine.' });
    }

    return {
      drawSheet,
      scheduleSheetCanvasRefresh,
      computePlan,
      getOptimaxProfilePreset,
      normalizeCutDirection,
      speedLabel,
      directionLabel,
      formatHeurLabel,
      computePlanPanelProAsync,
    };
  }

  FC.rozrysEngineBridge = { createApi };
})();

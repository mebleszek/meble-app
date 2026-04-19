(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createApi(ctx){
    const cfg = Object.assign({ FC }, ctx || {});
    const apiFC = cfg.FC || FC;

    const api = {
      tryAutoRenderFromCache(payload){
        if(apiFC.rozrysRender && typeof apiFC.rozrysRender.tryAutoRenderFromCache === 'function'){
          return apiFC.rozrysRender.tryAutoRenderFromCache(payload || {});
        }
        const out = payload && payload.out;
        if(out) out.innerHTML = '';
        if(payload && typeof payload.setGenBtnMode === 'function') payload.setGenBtnMode('idle');
        return false;
      },

      buildEntriesForScope(selection, aggregate, deps){
        if(apiFC.rozrysRender && typeof apiFC.rozrysRender.buildEntriesForScope === 'function'){
          return apiFC.rozrysRender.buildEntriesForScope(selection, aggregate, deps || {});
        }
        return [];
      },

      splitMaterialAccordionTitle(material){
        if(apiFC.rozrysAccordion && typeof apiFC.rozrysAccordion.splitMaterialAccordionTitle === 'function'){
          return apiFC.rozrysAccordion.splitMaterialAccordionTitle(material);
        }
        return { line1:String(material || 'Materiał'), line2:'' };
      },

      createMaterialAccordionSection(material, options, deps){
        if(apiFC.rozrysAccordion && typeof apiFC.rozrysAccordion.createMaterialAccordionSection === 'function'){
          return apiFC.rozrysAccordion.createMaterialAccordionSection(material, options, deps || {});
        }
        const h = deps && typeof deps.h === 'function' ? deps.h : ((tag)=> document.createElement(tag));
        const wrap = h('div');
        const body = h('div');
        wrap.appendChild(body);
        return { wrap, body, trigger:null, setOpenState:()=>{} };
      },

      renderMaterialAccordionPlans(scopeKey, scopeMode, entries, payload){
        if(apiFC.rozrysAccordion && typeof apiFC.rozrysAccordion.renderMaterialAccordionPlans === 'function'){
          return apiFC.rozrysAccordion.renderMaterialAccordionPlans(scopeKey, scopeMode, entries, payload || {});
        }
        const out = payload && payload.out;
        if(out) out.innerHTML = '';
        return false;
      },

      renderOutput(plan, meta, payload){
        if(apiFC.rozrysRender && typeof apiFC.rozrysRender.renderOutput === 'function'){
          return apiFC.rozrysRender.renderOutput(plan, meta, payload || {});
        }
        const target = payload && (payload.target || payload.out);
        if(target) target.innerHTML = '';
        return undefined;
      },

      renderLoadingInto(target, text, subText, payload){
        if(apiFC.rozrysRender && typeof apiFC.rozrysRender.renderLoadingInto === 'function'){
          return apiFC.rozrysRender.renderLoadingInto(target, text, subText, payload || {});
        }
        const out = payload && payload.out;
        const tgt = target || out;
        if(tgt) tgt.innerHTML = '';
        return null;
      },
    };

    api.createController = function(controllerCtx){
      const ctx = controllerCtx || {};
      return {
        tryAutoRenderFromCache(){
          return api.tryAutoRenderFromCache({
            _rozrysRunning: typeof ctx.isRozrysRunning === 'function' ? ctx.isRozrysRunning() : false,
            normalizeMaterialScopeForAggregate: ctx.normalizeMaterialScopeForAggregate,
            decodeMaterialScope: ctx.decodeMaterialScope,
            matSelValue: ctx.matSelValue,
            agg: ctx.agg,
            buildEntriesForScope: (selection, aggregate)=> api.buildEntriesForScope(selection, aggregate, {
              normalizeMaterialScopeForAggregate: ctx.normalizeMaterialScopeForAggregate,
              aggregatePartsForProject: ctx.aggregatePartsForProject,
              getOrderedMaterialsForSelection: ctx.getOrderedMaterialsForSelection,
              getGroupPartsForScope: ctx.getGroupPartsForScope,
            }),
            out: ctx.out,
            setGenBtnMode: ctx.setGenBtnMode,
            loadPlanCache: ctx.loadPlanCache,
            getBaseState: ctx.getBaseState,
            toMmByUnit: ctx.toMmByUnit,
            getRealHalfStockForMaterial: ctx.getRealHalfStockForMaterial,
            getExactSheetStockForMaterial: ctx.getExactSheetStockForMaterial,
            getLargestSheetFormatForMaterial: ctx.getLargestSheetFormatForMaterial,
            materialHasGrain: ctx.materialHasGrain,
            getMaterialGrainEnabled: ctx.getMaterialGrainEnabled,
            getMaterialGrainExceptions: ctx.getMaterialGrainExceptions,
            partSignature: ctx.partSignature,
            buildStockSignatureForMaterial: ctx.buildStockSignatureForMaterial,
            makePlanCacheKey: ctx.makePlanCacheKey,
            getAccordionScopeKey: ctx.getAccordionScopeKey,
            getRozrysScopeMode: ctx.getRozrysScopeMode,
            renderMaterialAccordionPlans: (scopeKey, scopeMode, entries)=> api.renderMaterialAccordionPlans(scopeKey, scopeMode, entries, {
              out: ctx.out,
              getAccordionPref: ctx.getAccordionPref,
              materialHasGrain: ctx.materialHasGrain,
              getMaterialGrainEnabled: ctx.getMaterialGrainEnabled,
              setAccordionPref: ctx.setAccordionPref,
              setMaterialGrainEnabled: ctx.setMaterialGrainEnabled,
              tryAutoRenderFromCache: ()=> typeof ctx.tryAutoRenderFromCache === 'function' ? ctx.tryAutoRenderFromCache() : false,
              openMaterialGrainExceptions: ctx.openMaterialGrainExceptions,
              renderOutput: (plan, meta, target)=> typeof ctx.renderOutput === 'function' ? ctx.renderOutput(plan, meta, target) : undefined,
              formatHeurLabel: ctx.formatHeurLabel,
              scheduleSheetCanvasRefresh: ctx.scheduleSheetCanvasRefresh,
            }),
            setCacheState: ctx.setCacheState,
          });
        },

        buildEntriesForScope(selection, aggregate){
          return api.buildEntriesForScope(selection, aggregate, {
            normalizeMaterialScopeForAggregate: ctx.normalizeMaterialScopeForAggregate,
            aggregatePartsForProject: ctx.aggregatePartsForProject,
            getOrderedMaterialsForSelection: ctx.getOrderedMaterialsForSelection,
            getGroupPartsForScope: ctx.getGroupPartsForScope,
          });
        },

        splitMaterialAccordionTitle(material){
          return api.splitMaterialAccordionTitle(material);
        },

        createMaterialAccordionSection(material, options){
          return api.createMaterialAccordionSection(material, options, {
            scheduleSheetCanvasRefresh: ctx.scheduleSheetCanvasRefresh,
            h: ctx.h,
          });
        },

        renderMaterialAccordionPlans(scopeKey, scopeMode, entries){
          return api.renderMaterialAccordionPlans(scopeKey, scopeMode, entries, {
            out: ctx.out,
            getAccordionPref: ctx.getAccordionPref,
            materialHasGrain: ctx.materialHasGrain,
            getMaterialGrainEnabled: ctx.getMaterialGrainEnabled,
            setAccordionPref: ctx.setAccordionPref,
            setMaterialGrainEnabled: ctx.setMaterialGrainEnabled,
            tryAutoRenderFromCache: ()=> typeof ctx.tryAutoRenderFromCache === 'function' ? ctx.tryAutoRenderFromCache() : false,
            openMaterialGrainExceptions: ctx.openMaterialGrainExceptions,
            renderOutput: (plan, meta, target)=> typeof ctx.renderOutput === 'function' ? ctx.renderOutput(plan, meta, target) : undefined,
            formatHeurLabel: ctx.formatHeurLabel,
            scheduleSheetCanvasRefresh: ctx.scheduleSheetCanvasRefresh,
          });
        },

        renderOutput(plan, meta, target){
          return api.renderOutput(plan, meta, {
            target: target || ctx.out,
            out: ctx.out,
            buildRozrysDiagnostics: ctx.buildRozrysDiagnostics,
            validationSummaryLabel: ctx.validationSummaryLabel,
            openValidationListModal: ctx.openValidationListModal,
            openSheetListModal: ctx.openSheetListModal,
            buildCsv: ctx.buildCsv,
            downloadText: ctx.downloadText,
            openPrintView: ctx.openPrintView,
            measurePrintHeaderMm: ctx.measurePrintHeaderMm,
            mmToUnitStr: ctx.mmToUnitStr,
            drawSheet: ctx.drawSheet,
            cutOptimizer: ctx.cutOptimizer,
          });
        },

        renderLoading(text){
          return api.renderLoadingInto(null, text, undefined, { out: ctx.out });
        },

        renderLoadingInto(target, text, subText){
          return api.renderLoadingInto(target, text, subText, { out: ctx.out });
        },
      };
    };

    return api;
  }

  FC.rozrysOutputBridge = { createApi };
})();

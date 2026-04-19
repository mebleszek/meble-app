(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createApi(ctx){
    const scope = (ctx && ctx.FC) || FC;
    return {
      buildResolvedSnapshotFromParts(parts, deps){
        const rv = scope.rozrysValidation;
        if(!(rv && typeof rv.rowsFromParts === 'function')) return [];
        const partSignature = deps && deps.partSignature;
        if(typeof partSignature !== 'function') return [];
        return rv.rowsFromParts((parts || []).map((p)=>({
          key: partSignature({ material: p.material, name: p.name, w: p.w, h: p.h, sourceSig: p.sourceSig, grainMode: p.grainMode || p.direction }),
          material: p.material,
          name: p.name,
          w: p.w,
          h: p.h,
          qty: p.qty,
        })));
      },

      buildRawSnapshotForMaterial(targetMaterial, mode, selectedRooms, deps){
        const safeGetProject = deps && deps.safeGetProject;
        const normalizeRoomSelection = deps && deps.normalizeRoomSelection;
        const getRooms = deps && deps.getRooms;
        const resolveCabinetCutListFn = deps && deps.resolveCabinetCutListFn;
        const isFrontMaterialKey = deps && deps.isFrontMaterialKey;
        const resolveRozrysPartFromSource = deps && deps.resolveRozrysPartFromSource;
        const partSignature = deps && deps.partSignature;
        if(typeof safeGetProject !== 'function' || typeof normalizeRoomSelection !== 'function' || typeof getRooms !== 'function') return [];
        if(typeof resolveCabinetCutListFn !== 'function' || typeof resolveRozrysPartFromSource !== 'function' || typeof partSignature !== 'function') return [];
        const proj = safeGetProject();
        if(!proj || !targetMaterial) return [];
        const rows = [];
        const rooms = normalizeRoomSelection(Array.isArray(selectedRooms) ? selectedRooms : getRooms());
        const scopeMode = (mode === 'fronts' || mode === 'corpus' || mode === 'both') ? mode : 'both';
        for(const room of rooms){
          const cabinets = (proj[room] && Array.isArray(proj[room].cabinets)) ? proj[room].cabinets : [];
          for(let cabIndex = 0; cabIndex < cabinets.length; cabIndex += 1){
            const cab = cabinets[cabIndex];
            const cutListFn = resolveCabinetCutListFn();
            if(typeof cutListFn !== 'function') continue;
            const parts = cutListFn(cab, room) || [];
            for(const p of parts){
              const sourceMaterial = String(p.material || '').trim();
              if(!sourceMaterial) continue;
              const isFront = (String(p.name || '').trim() === 'Front') || (typeof isFrontMaterialKey === 'function' && isFrontMaterialKey(sourceMaterial));
              if(scopeMode === 'fronts' && !isFront) continue;
              if(scopeMode === 'corpus' && isFront) continue;
              const resolved = resolveRozrysPartFromSource(p);
              const materialKey = resolved.materialKey;
              if(materialKey !== targetMaterial) continue;
              const w = resolved.w;
              const h = resolved.h;
              const qty = resolved.qty;
              if(!(w > 0 && h > 0 && qty > 0)) continue;
              rows.push({
                key: partSignature({ material: materialKey, name: resolved.name, w, h, sourceSig: resolved.sourceSig, grainMode: resolved.direction }),
                material: materialKey,
                name: resolved.name,
                sourceSig: resolved.sourceSig,
                grainMode: resolved.direction,
                ignoreGrain: !!resolved.ignoreGrain,
                w,
                h,
                qty,
                room,
                source: String((cab && (cab.name || cab.label || cab.type || cab.kind)) || 'Szafka'),
                cabinet: `#${cabIndex + 1}`,
                sourceRows: 1,
              });
            }
          }
        }
        return rows;
      },

      buildRozrysDiagnostics(targetMaterial, mode, parts, plan, selectedRooms, deps){
        if(scope.rozrysSummary && typeof scope.rozrysSummary.buildRozrysDiagnostics === 'function'){
          return scope.rozrysSummary.buildRozrysDiagnostics(targetMaterial, mode, parts, plan, selectedRooms, {
            buildRawSnapshotForMaterial: deps && deps.buildRawSnapshotForMaterial,
            buildResolvedSnapshotFromParts: deps && deps.buildResolvedSnapshotFromParts,
          });
        }
        return null;
      },

      validationSummaryLabel(diag){
        if(scope.rozrysSummary && typeof scope.rozrysSummary.validationSummaryLabel === 'function') return scope.rozrysSummary.validationSummaryLabel(diag);
        return { text:'Walidacja: brak danych', tone:'is-warn' };
      },

      openValidationListModal(material, diag, unit, deps){
        if(scope.rozrysSummary && typeof scope.rozrysSummary.openValidationListModal === 'function'){
          return scope.rozrysSummary.openValidationListModal(material, diag, unit, { mmToUnitStr: deps && deps.mmToUnitStr, openPrintView: deps && deps.openPrintView });
        }
      },

      openSheetListModal(material, sheetTitle, rows, unit, deps){
        if(scope.rozrysSummary && typeof scope.rozrysSummary.openSheetListModal === 'function'){
          return scope.rozrysSummary.openSheetListModal(material, sheetTitle, rows, unit, { mmToUnitStr: deps && deps.mmToUnitStr, openPrintView: deps && deps.openPrintView });
        }
      },

      buildCsv(sheets, meta){
        if(scope.rozrysPrint && typeof scope.rozrysPrint.buildCsv === 'function') return scope.rozrysPrint.buildCsv(sheets, meta);
        return '';
      },

      downloadText(filename, content, mime, deps){
        if(scope.rozrysPrint && typeof scope.rozrysPrint.downloadText === 'function'){
          return scope.rozrysPrint.downloadText(filename, content, mime, { openInfo: deps && deps.openInfo });
        }
      },

      openPrintView(html, deps){
        if(scope.rozrysPrint && typeof scope.rozrysPrint.openPrintView === 'function'){
          return scope.rozrysPrint.openPrintView(html, { openInfo: deps && deps.openInfo });
        }
      },

      pxToMm(px){
        if(scope.rozrysPrint && typeof scope.rozrysPrint.pxToMm === 'function') return scope.rozrysPrint.pxToMm(px);
        const n = Number(px);
        return Number.isFinite(n) ? n * 25.4 / 96 : 0;
      },

      measurePrintHeaderMm(titleText, metaText){
        if(scope.rozrysPrint && typeof scope.rozrysPrint.measurePrintHeaderMm === 'function'){
          return scope.rozrysPrint.measurePrintHeaderMm(titleText, metaText);
        }
        return 14;
      },

      splitMaterialAccordionTitle(material){
        if(scope.rozrysAccordion && typeof scope.rozrysAccordion.splitMaterialAccordionTitle === 'function'){
          return scope.rozrysAccordion.splitMaterialAccordionTitle(material);
        }
        return { line1:String(material || 'Materiał'), line2:'' };
      },

      createMaterialAccordionSection(material, options, deps){
        if(scope.rozrysAccordion && typeof scope.rozrysAccordion.createMaterialAccordionSection === 'function'){
          return scope.rozrysAccordion.createMaterialAccordionSection(material, options, { scheduleSheetCanvasRefresh: deps && deps.scheduleSheetCanvasRefresh });
        }
        const createEl = deps && deps.createElement;
        const wrap = typeof createEl === 'function' ? createEl('div') : document.createElement('div');
        const body = typeof createEl === 'function' ? createEl('div') : document.createElement('div');
        wrap.appendChild(body);
        return { wrap, body, trigger:null, setOpenState:()=>{} };
      },

      renderMaterialAccordionPlans(scopeKey, scopeMode, entries, deps){
        if(scope.rozrysAccordion && typeof scope.rozrysAccordion.renderMaterialAccordionPlans === 'function'){
          return scope.rozrysAccordion.renderMaterialAccordionPlans(scopeKey, scopeMode, entries, {
            out: deps && deps.out,
            getAccordionPref: deps && deps.getAccordionPref,
            materialHasGrain: deps && deps.materialHasGrain,
            getMaterialGrainEnabled: deps && deps.getMaterialGrainEnabled,
            setAccordionPref: deps && deps.setAccordionPref,
            setMaterialGrainEnabled: deps && deps.setMaterialGrainEnabled,
            tryAutoRenderFromCache: deps && deps.tryAutoRenderFromCache,
            openMaterialGrainExceptions: deps && deps.openMaterialGrainExceptions,
            renderOutput: deps && deps.renderOutput,
            formatHeurLabel: deps && deps.formatHeurLabel,
            scheduleSheetCanvasRefresh: deps && deps.scheduleSheetCanvasRefresh,
          });
        }
        if(deps && deps.out) deps.out.innerHTML = '';
        return false;
      },

      renderOutput(plan, meta, deps){
        if(scope.rozrysRender && typeof scope.rozrysRender.renderOutput === 'function'){
          return scope.rozrysRender.renderOutput(plan, meta, {
            target: deps && (deps.target || deps.out),
            out: deps && deps.out,
            buildRozrysDiagnostics: deps && deps.buildRozrysDiagnostics,
            validationSummaryLabel: deps && deps.validationSummaryLabel,
            openValidationListModal: deps && deps.openValidationListModal,
            openSheetListModal: deps && deps.openSheetListModal,
            buildCsv: deps && deps.buildCsv,
            downloadText: deps && deps.downloadText,
            openPrintView: deps && deps.openPrintView,
            measurePrintHeaderMm: deps && deps.measurePrintHeaderMm,
            mmToUnitStr: deps && deps.mmToUnitStr,
            drawSheet: deps && deps.drawSheet,
            cutOptimizer: deps && deps.cutOptimizer,
          });
        }
        const target = deps && (deps.target || deps.out);
        if(target) target.innerHTML = '';
      },

      renderLoadingInto(target, text, subText, deps){
        if(scope.rozrysRender && typeof scope.rozrysRender.renderLoadingInto === 'function'){
          return scope.rozrysRender.renderLoadingInto(target, text, subText, { out: deps && deps.out });
        }
        const tgt = target || (deps && deps.out);
        if(tgt) tgt.innerHTML = '';
        return null;
      },

      loadPlanCache(){
        if(scope.rozrysCache && typeof scope.rozrysCache.loadPlanCache === 'function') return scope.rozrysCache.loadPlanCache();
        return {};
      },

      savePlanCache(cache){
        if(scope.rozrysCache && typeof scope.rozrysCache.savePlanCache === 'function') scope.rozrysCache.savePlanCache(cache);
      },

      makePlanCacheKey(st, parts, deps){
        if(scope.rozrysCache && typeof scope.rozrysCache.makePlanCacheKey === 'function'){
          return scope.rozrysCache.makePlanCacheKey(st, parts, {
            partSignature: deps && deps.partSignature,
            isPartRotationAllowed: deps && deps.isPartRotationAllowed,
            loadEdgeStore: deps && deps.loadEdgeStore,
          });
        }
        return 'plan_fallback';
      },
    };
  }

  scopeAttach();
  function scopeAttach(){
    FC.rozrysRuntime = { createApi };
  }
})();

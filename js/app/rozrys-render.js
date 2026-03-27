(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      for(const k in attrs){
        if(k === 'class') el.className = attrs[k];
        else if(k === 'html') el.innerHTML = attrs[k];
        else if(k === 'text') el.textContent = attrs[k];
        else el.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach((ch)=> el.appendChild(ch));
    return el;
  }

  function buildEntriesForScope(selection, aggregate, deps){
    const cfg = Object.assign({
      normalizeMaterialScopeForAggregate:null,
      aggregatePartsForProject:null,
      getOrderedMaterialsForSelection:null,
      getGroupPartsForScope:null,
    }, deps || {});
    const scope = typeof cfg.normalizeMaterialScopeForAggregate === 'function'
      ? cfg.normalizeMaterialScopeForAggregate(selection, aggregate)
      : selection;
    const aggRef = aggregate && typeof aggregate === 'object'
      ? aggregate
      : (typeof cfg.aggregatePartsForProject === 'function' ? cfg.aggregatePartsForProject() : { groups:{}, materials:[] });
    const orderedMaterials = typeof cfg.getOrderedMaterialsForSelection === 'function'
      ? (cfg.getOrderedMaterialsForSelection(scope, aggRef) || [])
      : [];
    return orderedMaterials.map((material)=>{
      const group = aggRef.groups && aggRef.groups[material] ? aggRef.groups[material] : null;
      const parts = typeof cfg.getGroupPartsForScope === 'function' ? cfg.getGroupPartsForScope(group, scope) : [];
      return { material, parts };
    }).filter((entry)=> Array.isArray(entry.parts) && entry.parts.length);
  }

  function renderLoadingInto(target, text, subText, deps){
    const cfg = Object.assign({ out:null }, deps || {});
    const tgt = target || cfg.out;
    if(!tgt) return null;
    tgt.innerHTML = '';
    const box = h('div', { class:'rozrys-loading' });
    const top = h('div', { class:'rozrys-loading-top' });
    const spinner = h('div', { class:'rozrys-spinner' });
    const copy = h('div', { class:'rozrys-status-copy' });
    const textEl = h('div', { class:'rozrys-loading-text', text: text || 'Liczę…' });
    const subEl = h('div', { class:'muted xs rozrys-loading-sub', text: subText || '' });
    const progWrap = h('div', { class:'rozrys-progress is-indeterminate' });
    const progBar = h('div', { class:'rozrys-progress-bar' });
    const metaEl = h('div', { class:'muted xs rozrys-progress-meta', text:'Startuję liczenie…' });
    progWrap.appendChild(progBar);
    copy.appendChild(textEl);
    copy.appendChild(subEl);
    copy.appendChild(progWrap);
    copy.appendChild(metaEl);
    top.appendChild(spinner);
    top.appendChild(copy);
    box.appendChild(top);
    tgt.appendChild(box);
    return {
      box, textEl, subEl, progWrap, progBar, metaEl, target: tgt,
      setProgress(percent, metaText){
        const n = Number(percent);
        if(Number.isFinite(n)) {
          progWrap.classList.remove('is-indeterminate');
          progBar.style.width = `${Math.max(0, Math.min(100, n))}%`;
        } else {
          progWrap.classList.add('is-indeterminate');
          progBar.style.width = '';
        }
        if(typeof metaText === 'string') metaEl.textContent = metaText;
      }
    };
  }

  function renderOutput(plan, meta, deps){
    const cfg = Object.assign({
      out:null,
      buildRozrysDiagnostics:null,
      validationSummaryLabel:null,
      openValidationListModal:null,
      openSheetListModal:null,
      buildCsv:null,
      downloadText:null,
      openPrintView:null,
      measurePrintHeaderMm:null,
      mmToUnitStr:null,
      drawSheet:null,
      cutOptimizer:null,
    }, deps || {});
    const tgt = cfg.target || cfg.out;
    if(!tgt) return;
    tgt.innerHTML = '';
    const opt = cfg.cutOptimizer || FC.cutOptimizer || {};
    const sheets = plan && Array.isArray(plan.sheets) ? plan.sheets : [];
    const u = (meta && (meta.unit === 'cm' || meta.unit === 'mm'))
      ? meta.unit
      : (meta && meta.meta && (meta.meta.unit === 'cm' || meta.meta.unit === 'mm'))
        ? meta.meta.unit
        : 'mm';
    const diagnostics = typeof cfg.buildRozrysDiagnostics === 'function'
      ? cfg.buildRozrysDiagnostics(meta && meta.material, meta && meta.scopeMode, meta && meta.parts, plan, meta && meta.selectedRooms)
      : null;
    const validationLabel = typeof cfg.validationSummaryLabel === 'function'
      ? cfg.validationSummaryLabel(diagnostics)
      : { tone:'is-muted', text:'Brak walidacji' };
    const lists = FC.rozrysLists;

    const getSupplyMeta = (sheet)=>{
      const source = String((sheet && sheet.supplySource) || '');
      if(source === 'stock') return { text:'z magazynu', cls:'is-stock' };
      if(source === 'order') return { text:'zamówić', cls:'is-order' };
      return null;
    };

    const getBoardMeta = (sheet)=>{
      const boardW = Math.max(1,
        Number((sheet && sheet.fullBoardW) || (sheet && sheet.boardW) || (meta && meta.meta && meta.meta.boardW) || (meta && meta.boardW) || 0)
      );
      const boardH = Math.max(1,
        Number((sheet && sheet.fullBoardH) || (sheet && sheet.boardH) || (meta && meta.meta && meta.meta.boardH) || (meta && meta.boardH) || 0)
      );
      const trim = Math.max(0,
        Number((sheet && sheet.trimMm) || (meta && meta.meta && meta.meta.trim) || (meta && meta.trim) || 0)
      );
      const referenceBoardW = Math.max(boardW,
        Number((meta && meta.meta && meta.meta.boardW) || (meta && meta.boardW) || 0)
      );
      const referenceBoardH = Math.max(boardH,
        Number((meta && meta.meta && meta.meta.boardH) || (meta && meta.boardH) || 0)
      );
      return { boardW, boardH, trim, referenceBoardW, referenceBoardH };
    };

    const calcDisplayWaste = (sheet)=>{
      const bm = getBoardMeta(sheet);
      const halfBoardW = Math.max(1, Number((sheet && sheet.realHalfBoardW) || (sheet && sheet.virtualBoardW) || bm.boardW) || bm.boardW);
      const halfBoardH = Math.max(1, Number((sheet && sheet.realHalfBoardH) || (sheet && sheet.virtualBoardH) || bm.boardH) || bm.boardH);
      const total = Math.max(0, halfBoardW * halfBoardH);
      const used = typeof opt.placedArea === 'function' ? opt.placedArea(sheet) : 0;
      const waste = Math.max(0, total - used);
      return { total, used, waste, trim: bm.trim, boardW: bm.boardW, boardH: bm.boardH, wasteBoardW: halfBoardW, wasteBoardH: halfBoardH, virtualHalf: !!(sheet && sheet.virtualHalf), realHalf: !!(sheet && (sheet.realHalf || sheet.realHalfFromStock)) };
    };

    if(!sheets.length){
      const msg = (plan && plan.note) ? String(plan.note) : 'Brak wyniku.';
      tgt.appendChild(h('div', { class:'muted', text: msg }));
      return;
    }

    const sheetFraction = (sheet)=>{
      const f = Number(sheet && sheet.virtualFraction);
      return (Number.isFinite(f) && f > 0) ? f : 1;
    };
    const formatSheetCount = (n)=> Number.isInteger(n) ? String(n) : String(n.toFixed(1)).replace('.', ',');
    const sum = sheets.reduce((acc,s)=>{
      const w = calcDisplayWaste(s);
      acc.area += w.total;
      acc.used += w.used;
      acc.waste += w.waste;
      acc.count += sheetFraction(s);
      if(s && s.virtualHalf) acc.hasVirtualHalf = true;
      if(s && (s.realHalf || s.realHalfFromStock)) acc.hasRealHalf = true;
      return acc;
    }, { area:0, used:0, waste:0, count:0, hasVirtualHalf:false, hasRealHalf:false });

    const pct = sum.area>0 ? (sum.waste/sum.area)*100 : 0;
    const summaryPayload = {
      count: sum.count,
      sheetCountText: formatSheetCount(sum.count),
      hasVirtualHalf: sum.hasVirtualHalf,
      hasRealHalf: sum.hasRealHalf,
    };
    if(lists && typeof lists.renderSummaryCard === 'function'){
      tgt.appendChild(lists.renderSummaryCard({ meta, diagnostics, validationLabel, summary: summaryPayload, wastePct: pct }));
    }

    const edgeSubMm = Math.max(0, Number(meta.edgeSubMm)||0);
    const printLayout = FC.rozrysPrintLayout;
    const printDeps = printLayout ? {
      openPrint({ sheets, meta, unit, summary }){
        const rotatePdfSheets = true;
        const imgs = [];
        try{
          const canvasList = Array.from(tgt.querySelectorAll('canvas[data-rozrys-sheet="1"]'));
          canvasList.forEach((cv)=>{
            const payload = cv && cv.__rozrysDrawPayload ? cv.__rozrysDrawPayload : null;
            if(!payload || typeof cfg.drawSheet !== 'function') return;
            const tmp = document.createElement('canvas');
            cfg.drawSheet(tmp, payload.sheet, payload.displayUnit || unit, payload.edgeSubMm, payload.boardMeta || null, true);
            let exportCanvas = tmp;
            if(rotatePdfSheets){
              const rotated = document.createElement('canvas');
              rotated.width = tmp.height;
              rotated.height = tmp.width;
              const rctx = rotated.getContext('2d');
              if(rctx){
                rctx.translate(rotated.width / 2, rotated.height / 2);
                rctx.rotate(Math.PI / 2);
                rctx.drawImage(tmp, -tmp.width / 2, -tmp.height / 2);
                exportCanvas = rotated;
              }
            }
            imgs.push({ src:exportCanvas.toDataURL('image/png'), width:exportCanvas.width || 0, height:exportCanvas.height || 0 });
            tmp.remove();
          });
        }catch(_){ }

        const printTitle = `Rozrys — ${meta.material}`;
        const heurLabel = meta && meta.heur ? ` • Heurystyka: ${meta.heur}` : '';
        const printMetaLine = `Płyty: ${summary.sheetCountText} • Kerf: ${meta.kerf}${unit}${heurLabel}${edgeSubMm>0 ? ` • Wymiary do cięcia: TAK (${edgeSubMm}mm)` : ''}`;
        const html = typeof printLayout.buildPrintHtml === 'function'
          ? printLayout.buildPrintHtml({
              sheets,
              imgs,
              meta,
              unit,
              rotatePdfSheets,
              printTitle,
              printMetaLine,
              totalSheetCount:summary.count,
            }, {
              getBoardMeta,
              calcDisplayWaste,
              measurePrintHeaderMm: cfg.measurePrintHeaderMm,
              mmToUnitStr: cfg.mmToUnitStr,
            })
          : '';
        if(html) cfg.openPrintView(html);
      }
    } : null;

    if(lists && typeof lists.renderExportRow === 'function'){
      tgt.appendChild(lists.renderExportRow({
        diagnostics,
        sheets,
        meta,
        unit:u,
        summary: summaryPayload,
        edgeSubMm,
      }, {
        openValidationListModal: cfg.openValidationListModal,
        buildCsv: cfg.buildCsv,
        downloadText: cfg.downloadText,
        openPrintView: cfg.openPrintView,
        printLayout: printDeps,
      }));
    }

    if(lists && typeof lists.renderSheetCards === 'function'){
      lists.renderSheetCards({ sheets, meta, diagnostics, unit:u, edgeSubMm }, {
        drawSheet: cfg.drawSheet,
        openSheetListModal: cfg.openSheetListModal,
        mmToUnitStr: cfg.mmToUnitStr,
        getSupplyMeta,
        getBoardMeta,
        calcDisplayWaste,
      }).forEach((card)=> tgt.appendChild(card));
    }
  }

  function tryAutoRenderFromCache(deps){
    const cfg = Object.assign({
      _rozrysRunning:false,
      normalizeMaterialScopeForAggregate:null,
      decodeMaterialScope:null,
      matSelValue:'',
      agg:null,
      buildEntriesForScope:null,
      out:null,
      setGenBtnMode:null,
      loadPlanCache:null,
      getBaseState:null,
      toMmByUnit:null,
      getRealHalfStockForMaterial:null,
      getExactSheetStockForMaterial:null,
      getLargestSheetFormatForMaterial:null,
      materialHasGrain:null,
      getMaterialGrainEnabled:null,
      getMaterialGrainExceptions:null,
      partSignature:null,
      buildStockSignatureForMaterial:null,
      makePlanCacheKey:null,
      getAccordionScopeKey:null,
      getRozrysScopeMode:null,
      renderMaterialAccordionPlans:null,
      setCacheState:null,
    }, deps || {});
    try{
      if(cfg._rozrysRunning) return false;
      const scope = typeof cfg.normalizeMaterialScopeForAggregate === 'function' && typeof cfg.decodeMaterialScope === 'function'
        ? cfg.normalizeMaterialScopeForAggregate(cfg.decodeMaterialScope(cfg.matSelValue), cfg.agg)
        : cfg.decodeMaterialScope(cfg.matSelValue);
      const entries = typeof cfg.buildEntriesForScope === 'function' ? cfg.buildEntriesForScope(scope, cfg.agg) : [];
      if(!entries.length){
        if(cfg.out) cfg.out.innerHTML = '';
        if(typeof cfg.setGenBtnMode === 'function') cfg.setGenBtnMode('idle');
        if(typeof cfg.setCacheState === 'function') cfg.setCacheState({ lastAutoRenderHit:false, lastScopeKey:'' });
        return false;
      }

      const cache = typeof cfg.loadPlanCache === 'function' ? cfg.loadPlanCache() : {};
      const stBase = typeof cfg.getBaseState === 'function' ? cfg.getBaseState() : {};
      const hits = [];
      let allHit = true;
      for(const entry of entries){
        const material = entry.material;
        const parts = entry.parts || [];
        const fullWmm = typeof cfg.toMmByUnit === 'function' ? (cfg.toMmByUnit(stBase.unit, stBase.boardW) || 2800) : 2800;
        const fullHmm = typeof cfg.toMmByUnit === 'function' ? (cfg.toMmByUnit(stBase.unit, stBase.boardH) || 2070) : 2070;
        const halfStock = typeof cfg.getRealHalfStockForMaterial === 'function' ? cfg.getRealHalfStockForMaterial(material, fullWmm, fullHmm) : { qty:0, width:0, height:0 };
        const exactStock = typeof cfg.getExactSheetStockForMaterial === 'function' ? cfg.getExactSheetStockForMaterial(material, fullWmm, fullHmm) : { qty:0, width:0, height:0 };
        const fullStock = typeof cfg.getLargestSheetFormatForMaterial === 'function' ? cfg.getLargestSheetFormatForMaterial(material, fullWmm, fullHmm) : { qty:0, width:0, height:0 };
        const hasGrain = typeof cfg.materialHasGrain === 'function' ? cfg.materialHasGrain(material) : false;
        const st = Object.assign({}, stBase, {
          material,
          grain: !!(hasGrain && typeof cfg.getMaterialGrainEnabled === 'function' && cfg.getMaterialGrainEnabled(material, hasGrain)),
          grainExceptions: typeof cfg.getMaterialGrainExceptions === 'function'
            ? cfg.getMaterialGrainExceptions(material, parts.map((p)=> cfg.partSignature ? cfg.partSignature(p) : ''), hasGrain)
            : {},
          selectedRooms: (cfg.agg && cfg.agg.selectedRooms || []).slice(),
          realHalfQty: Math.max(0, Number(halfStock.qty) || 0),
          realHalfBoardW: Math.round(Number(halfStock.width) || 0),
          realHalfBoardH: Math.round(Number(halfStock.height) || 0),
          stockExactQty: Math.max(0, Number(exactStock.qty) || 0),
          stockFullBoardW: Math.round(Number(fullStock.width) || 0),
          stockFullBoardH: Math.round(Number(fullStock.height) || 0),
          stockPolicy: 'stock_limit_v4',
          stockSignature: typeof cfg.buildStockSignatureForMaterial === 'function' ? cfg.buildStockSignatureForMaterial(material) : '',
        });
        const cacheKey = typeof cfg.makePlanCacheKey === 'function' ? cfg.makePlanCacheKey(st, parts) : '';
        if(cacheKey && cache[cacheKey] && cache[cacheKey].plan){
          hits.push({ material, parts, st, plan: cache[cacheKey].plan });
        } else {
          allHit = false;
        }
      }
      const anyHit = typeof cfg.renderMaterialAccordionPlans === 'function'
        ? cfg.renderMaterialAccordionPlans(
            typeof cfg.getAccordionScopeKey === 'function' ? cfg.getAccordionScopeKey(scope, cfg.agg) : '',
            typeof cfg.getRozrysScopeMode === 'function' ? cfg.getRozrysScopeMode(scope) : 'all',
            hits
          )
        : false;
      if(typeof cfg.setGenBtnMode === 'function') cfg.setGenBtnMode(allHit && anyHit ? 'done' : 'idle');
      if(typeof cfg.setCacheState === 'function') cfg.setCacheState({
        lastAutoRenderHit: !!anyHit,
        lastScopeKey: typeof cfg.getAccordionScopeKey === 'function' ? cfg.getAccordionScopeKey(scope, cfg.agg) : '',
      });
      return anyHit;
    }catch(_){
      if(cfg.out) cfg.out.innerHTML = '';
      if(typeof cfg.setGenBtnMode === 'function') cfg.setGenBtnMode('idle');
      if(typeof cfg.setCacheState === 'function') cfg.setCacheState({ lastAutoRenderHit:false });
      return false;
    }
  }

  FC.rozrysRender = {
    buildEntriesForScope,
    renderLoadingInto,
    renderOutput,
    tryAutoRenderFromCache,
  };
})();

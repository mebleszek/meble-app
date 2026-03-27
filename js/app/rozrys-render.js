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
    const tgt = (cfg.target || cfg.out);
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
    const cancelledNote = (meta && meta.cancelled) ? '<div class="muted xs" style="margin-top:6px;font-weight:700">Generowanie przerwane — pokazuję najlepszy wynik do tej pory.</div>' : '';
    const realHalfNote = sum.hasRealHalf ? '<div class="muted xs" style="margin-top:6px">Końcówka policzona na realnej połówce z magazynu, ale rysowana na pełnym arkuszu.</div>' : '';
    const virtualNote = sum.hasVirtualHalf ? '<div class="muted xs" style="margin-top:6px">Ostatnia końcówka liczona wirtualnie jako 0,5 płyty, ale rysowana na pełnym arkuszu.</div>' : '';
    const summaryCard = h('div', { class:'card', style:'margin:0' });
    summaryCard.appendChild(h('div', { html:`
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div><strong>Materiał:</strong> ${meta.material}</div>
        <div><strong>Płyty:</strong> ${formatSheetCount(sum.count)} szt.</div>
        <div><strong>Odpad:</strong> ${pct.toFixed(1)}%</div>
      </div>
      ${cancelledNote}
      ${realHalfNote}
      ${virtualNote}
    ` }));
    const validationRow = h('div', { class:'rozrys-validation-summary' });
    validationRow.appendChild(h('span', { class:`rozrys-pill ${validationLabel.tone}`, text:validationLabel.text }));
    if(diagnostics){
      validationRow.appendChild(h('span', { class:'rozrys-pill is-raw', text:`Snapshot: ${diagnostics.resolvedRows.length} pozycji` }));
    }
    summaryCard.appendChild(validationRow);
    tgt.appendChild(summaryCard);

    const expRow = h('div', { class:'rozrys-list-actions', style:'justify-content:flex-end' });
    if(diagnostics && typeof cfg.openValidationListModal === 'function'){
      const listBtn = h('button', { class:'btn-primary', type:'button', text:'Lista formatek' });
      listBtn.addEventListener('click', ()=> cfg.openValidationListModal(meta.material, diagnostics, u));
      expRow.appendChild(listBtn);
    }
    if(typeof cfg.buildCsv === 'function' && typeof cfg.downloadText === 'function'){
      const csvBtn = h('button', { class:'btn-primary', type:'button' });
      csvBtn.textContent = 'Eksport CSV';
      csvBtn.addEventListener('click', ()=>{
        const csv = cfg.buildCsv(sheets, meta);
        cfg.downloadText('rozrys.csv', csv, 'text/csv;charset=utf-8');
      });
      expRow.appendChild(csvBtn);
    }
    if(typeof cfg.openPrintView === 'function' && typeof cfg.measurePrintHeaderMm === 'function' && typeof cfg.drawSheet === 'function' && typeof cfg.mmToUnitStr === 'function'){
      const pdfBtn = h('button', { class:'btn-primary', type:'button' });
      pdfBtn.textContent = 'Eksport PDF (drukuj)';
      pdfBtn.addEventListener('click', ()=>{
        const edgeSubMm = Math.max(0, Number(meta.edgeSubMm)||0);
        const escapeHtml = (value)=> String(value == null ? '' : value).replace(/[&<>"]/g, (ch)=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch] || ch));
        const imgs = [];
        const rotatePdfSheets = true;
        try{
          sheets.forEach((s)=>{
            const c = document.createElement('canvas');
            const tmp = document.createElement('div');
            tmp.style.width = '1100px';
            tmp.style.position = 'absolute';
            tmp.style.left = '-99999px';
            tmp.style.top = '0';
            tmp.style.pointerEvents = 'none';
            tmp.appendChild(c);
            document.body.appendChild(tmp);
            cfg.drawSheet(c, s, u, edgeSubMm, getBoardMeta(s));
            let exportCanvas = c;
            if(rotatePdfSheets){
              const rotated = document.createElement('canvas');
              rotated.width = c.height || 0;
              rotated.height = c.width || 0;
              const rctx = rotated.getContext('2d');
              if(rctx){
                rctx.translate(rotated.width / 2, rotated.height / 2);
                rctx.rotate(Math.PI / 2);
                rctx.drawImage(c, -(c.width || 0) / 2, -(c.height || 0) / 2);
                exportCanvas = rotated;
              }
            }
            imgs.push({ src:exportCanvas.toDataURL('image/png'), width:exportCanvas.width || 0, height:exportCanvas.height || 0 });
            tmp.remove();
          });
        }catch(_){ }

        const edgeNote = (edgeSubMm>0) ? ` • Wymiary do cięcia: TAK (${edgeSubMm}mm)` : '';
        const printTitle = `Rozrys — ${meta.material}`;
        const printMetaLine = `Płyty: ${formatSheetCount(sum.count)} • Kerf: ${meta.kerf}${u} • Heurystyka: ${meta.heur}${edgeNote}`;
        const PRINT = {
          pageW: 194,
          pageH: 281,
          headerH: cfg.measurePrintHeaderMm(printTitle, printMetaLine),
          headerGap: 4,
          bodyPadX: 4,
          bodyPadBottom: 3,
          pageGap: 5,
          itemGap: 5,
          metaH: 6,
          imgPad: 2,
        };
        const refBoard = sheets.reduce((acc, s)=>{
          const bm = getBoardMeta(s);
          const refW = Number((bm && bm.referenceBoardW) || (bm && bm.boardW) || 0);
          const refH = Number((bm && bm.referenceBoardH) || (bm && bm.boardH) || 0);
          return {
            w: Math.max(acc.w, rotatePdfSheets ? refH : refW),
            h: Math.max(acc.h, rotatePdfSheets ? refW : refH),
          };
        }, {
          w: Math.max(1, rotatePdfSheets
            ? Number((meta && meta.boardH) || (meta && meta.meta && meta.meta.boardH) || 0)
            : Number((meta && meta.boardW) || (meta && meta.meta && meta.meta.boardW) || 0)),
          h: Math.max(1, rotatePdfSheets
            ? Number((meta && meta.boardW) || (meta && meta.meta && meta.meta.boardW) || 0)
            : Number((meta && meta.boardH) || (meta && meta.meta && meta.meta.boardH) || 0))
        });
        const bodyW = Math.max(10, PRINT.pageW - PRINT.bodyPadX * 2);
        const bodyH = Math.max(10, PRINT.pageH - PRINT.headerH - PRINT.headerGap - PRINT.bodyPadBottom);
        const globalScaleMm = Math.max(0.01, Math.min(
          (bodyW - 2 * PRINT.imgPad) / Math.max(1, refBoard.w),
          (bodyH - PRINT.metaH - 2 * PRINT.imgPad) / Math.max(1, refBoard.h)
        ));

        const sheetItems = sheets.map((s, i)=>{
          const bm = getBoardMeta(s);
          const ws = calcDisplayWaste(s);
          const sheetWastePct = ws.total > 0 ? ((ws.waste / ws.total) * 100) : 0;
          const virtualTxt = ws.realHalf ? ' • real 0,5 z magazynu' : (ws.virtualHalf ? ' • virtual 0,5 płyty' : '');
          const supply = getSupplyMeta(s);
          const supplyTxt = supply ? ` • ${supply.text}` : '';
          const img = imgs[i] || { src:'', width:0, height:0 };
          const effectiveBoardW = rotatePdfSheets ? Number(bm.boardH || 0) : Number(bm.boardW || 0);
          const effectiveBoardH = rotatePdfSheets ? Number(bm.boardW || 0) : Number(bm.boardH || 0);
          const renderW = Math.max(6, effectiveBoardW * globalScaleMm);
          const renderH = Math.max(6, effectiveBoardH * globalScaleMm);
          return {
            index: i,
            src: img.src || '',
            renderW,
            renderH,
            totalBlockH: PRINT.metaH + PRINT.imgPad + renderH,
            metaHtml: `<strong>Arkusz ${i+1}</strong> — ${cfg.mmToUnitStr(bm.boardW, u)}×${cfg.mmToUnitStr(bm.boardH, u)} ${u} • Odpad: ${sheetWastePct.toFixed(1)}%${virtualTxt}${supplyTxt}`,
          };
        });

        const canPairOnSamePage = (a, b)=>{
          if(!a || !b) return false;
          const combinedH = a.totalBlockH + b.totalBlockH + PRINT.itemGap;
          const maxW = Math.max(a.renderW, b.renderW) + PRINT.imgPad * 2;
          return combinedH <= bodyH && maxW <= bodyW;
        };

        const pages = [];
        for(let i=0; i<sheetItems.length;){
          const current = sheetItems[i];
          const next = sheetItems[i + 1];
          if(canPairOnSamePage(current, next)){
            pages.push([current, next]);
            i += 2;
            continue;
          }
          pages.push([current]);
          i += 1;
        }

        let html = `<!doctype html><html><head><meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Rozrys</title>
          <style>
            @page{ size:210mm 297mm; margin:8mm; }
            html, body{ margin:0; padding:0; }
            body{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:#111827; }
            .print-page{
              box-sizing:border-box;
              width:194mm;
              height:281mm;
              margin:0;
              page-break-after:always;
              break-after:page;
              page-break-inside:avoid;
              break-inside:avoid-page;
              overflow:hidden;
              display:flex;
              flex-direction:column;
              justify-content:flex-start;
            }
            .print-page:last-child{ page-break-after:auto; break-after:auto; }
            .page-head{ margin:0 0 4mm; min-height:${PRINT.headerH.toFixed(2)}mm; flex:0 0 auto; overflow-wrap:anywhere; word-break:break-word; }
            .title{ font-size:18px; font-weight:800; line-height:1.2; margin:0 0 2mm; overflow-wrap:anywhere; word-break:break-word; }
            .meta{ font-size:12px; line-height:1.35; color:#374151; margin:0; overflow-wrap:anywhere; word-break:break-word; }
            .page-body{
              flex:1 1 auto;
              min-height:0;
              width:100%;
              box-sizing:border-box;
              padding:0 ${PRINT.bodyPadX.toFixed(2)}mm ${PRINT.bodyPadBottom.toFixed(2)}mm;
              display:flex;
              flex-direction:column;
              align-items:flex-start;
              justify-content:flex-start;
              gap:${PRINT.itemGap.toFixed(2)}mm;
              overflow:hidden;
            }
            .sheet-card{
              width:100%;
              flex:0 0 auto;
              display:flex;
              flex-direction:column;
              align-items:flex-start;
              page-break-inside:avoid;
              break-inside:avoid-page;
            }
            .sheet-meta{ font-size:12px; color:#111827; margin:0 0 2mm; }
            .img-wrap{
              width:100%;
              display:flex;
              align-items:flex-start;
              justify-content:flex-start;
              overflow:hidden;
            }
            img.sheet-img{
              display:block;
              width:auto;
              height:auto;
              max-width:none;
              max-height:none;
              border:1px solid #333;
              border-radius:10px;
              background:#fff;
            }
          </style>
        </head><body>`;
        pages.forEach((group)=>{
          html += `<section class="print-page">`;
          html += `<div class="page-head">`;
          html += `<div class="title">${escapeHtml(printTitle)}</div>`;
          html += `<p class="meta">${escapeHtml(printMetaLine)}</p>`;
          html += `</div>`;
          html += `<div class="page-body">`;
          group.forEach((item)=>{
            html += `<article class="sheet-card">`;
            html += `<p class="sheet-meta">${item.metaHtml}</p>`;
            html += `<div class="img-wrap"><img class="sheet-img" src="${item.src}" alt="Arkusz ${item.index + 1}" style="width:${item.renderW.toFixed(2)}mm;height:${item.renderH.toFixed(2)}mm" /></div>`;
            html += `</article>`;
          });
          html += `</div>`;
          html += `</section>`;
        });
        html += `</body></html>`;
        cfg.openPrintView(html);
      });
      expRow.appendChild(pdfBtn);
    }
    tgt.appendChild(expRow);

    const edgeSubMm = Math.max(0, Number(meta.edgeSubMm)||0);
    sheets.forEach((s,i)=>{
      const box = h('div', { class:'card', style:'margin-top:12px' });
      const bm = getBoardMeta(s);
      const ws = calcDisplayWaste(s);
      const sheetWastePct = ws.total > 0 ? ((ws.waste / ws.total) * 100) : 0;
      const head = h('div', { style:'display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start' });
      head.appendChild(h('div', { style:'font-weight:900', text:`Arkusz ${i+1} • odpad ${sheetWastePct.toFixed(1)}%${ws.realHalf ? ' • real 0,5 z magazynu' : (ws.virtualHalf ? ' • virtual 0,5 płyty' : '')}` }));
      const tools = h('div', { class:'rozrys-sheet-tools' });
      const supplyMeta = getSupplyMeta(s);
      if(supplyMeta){
        tools.appendChild(h('span', { class:`rozrys-stock-chip ${supplyMeta.cls}`, text:supplyMeta.text }));
      }
      if(diagnostics && diagnostics.sheets && diagnostics.sheets[i] && typeof cfg.openSheetListModal === 'function'){
        const sheetBtn = h('button', { class:'btn', type:'button', text:'Formatki arkusza' });
        sheetBtn.addEventListener('click', ()=> cfg.openSheetListModal(meta.material, `Arkusz ${i+1}`, diagnostics.sheets[i].rows, u));
        tools.appendChild(sheetBtn);
      }
      if(typeof cfg.mmToUnitStr === 'function'){
        tools.appendChild(h('div', { class:'muted xs', text:`${cfg.mmToUnitStr(bm.boardW, u)}×${cfg.mmToUnitStr(bm.boardH, u)} ${u}` }));
      }
      head.appendChild(tools);
      box.appendChild(head);
      const canvas = document.createElement('canvas');
      canvas.style.marginTop = '10px';
      canvas.style.display = 'block';
      canvas.style.maxWidth = '100%';
      box.appendChild(canvas);
      tgt.appendChild(box);
      canvas.dataset.rozrysSheet = '1';
      canvas.__rozrysDrawPayload = { sheet: s, displayUnit: u, edgeSubMm, boardMeta: getBoardMeta(s) };
      if(typeof cfg.drawSheet === 'function') cfg.drawSheet(canvas, s, u, edgeSubMm, getBoardMeta(s));
    });
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
      return anyHit;
    }catch(_){
      if(cfg.out) cfg.out.innerHTML = '';
      if(typeof cfg.setGenBtnMode === 'function') cfg.setGenBtnMode('idle');
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

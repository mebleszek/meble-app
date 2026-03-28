(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, (ch)=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch] || ch));
  }

  function formatSheetCount(n){
    return Number.isInteger(n) ? String(n) : String(Number(n || 0).toFixed(1)).replace('.', ',');
  }

  function buildPrintHtml(payload, deps){
    const cfg = Object.assign({
      getBoardMeta:null,
      calcDisplayWaste:null,
      measurePrintHeaderMm:null,
      mmToUnitStr:null,
    }, deps || {});
    const sheets = Array.isArray(payload && payload.sheets) ? payload.sheets : [];
    const imgs = Array.isArray(payload && payload.imgs) ? payload.imgs : [];
    const rotatePdfSheets = !!(payload && payload.rotatePdfSheets);
    const printTitle = String(payload && payload.printTitle || 'Rozrys');
    const printMetaLine = String(payload && payload.printMetaLine || '');
    const unit = String(payload && payload.unit || 'mm');
    const measureHeader = typeof cfg.measurePrintHeaderMm === 'function' ? cfg.measurePrintHeaderMm : (()=> 14);
    const mmToUnitStr = typeof cfg.mmToUnitStr === 'function' ? cfg.mmToUnitStr : ((mm)=> String(mm));
    const getBoardMeta = typeof cfg.getBoardMeta === 'function' ? cfg.getBoardMeta : ((sheet)=>({ boardW:Number(sheet && sheet.boardW) || 0, boardH:Number(sheet && sheet.boardH) || 0, referenceBoardW:Number(sheet && sheet.boardW) || 0, referenceBoardH:Number(sheet && sheet.boardH) || 0 }));
    const calcDisplayWaste = typeof cfg.calcDisplayWaste === 'function' ? cfg.calcDisplayWaste : (()=>({ total:0, waste:0, realHalf:false, virtualHalf:false }));

    const PRINT = {
      pageW: 194,
      pageH: 281,
      headerH: measureHeader(printTitle, printMetaLine),
      headerGap: 4,
      bodyPadX: 4,
      bodyPadBottom: 3,
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
        ? Number(payload && payload.meta && (payload.meta.boardH || (payload.meta.meta && payload.meta.meta.boardH)) || 0)
        : Number(payload && payload.meta && (payload.meta.boardW || (payload.meta.meta && payload.meta.meta.boardW)) || 0)),
      h: Math.max(1, rotatePdfSheets
        ? Number(payload && payload.meta && (payload.meta.boardW || (payload.meta.meta && payload.meta.meta.boardW)) || 0)
        : Number(payload && payload.meta && (payload.meta.boardH || (payload.meta.meta && payload.meta.meta.boardH)) || 0))
    });

    const bodyW = Math.max(10, PRINT.pageW - PRINT.bodyPadX * 2);
    const bodyH = Math.max(10, PRINT.pageH - PRINT.headerH - PRINT.headerGap - PRINT.bodyPadBottom);
    const globalScaleMm = Math.max(0.01, Math.min(
      (bodyW - 2 * PRINT.imgPad) / Math.max(1, refBoard.w),
      (bodyH - PRINT.metaH - 2 * PRINT.imgPad) / Math.max(1, refBoard.h)
    ));

    const sheetItems = sheets.map((sheet, i)=>{
      const bm = getBoardMeta(sheet);
      const ws = calcDisplayWaste(sheet);
      const sheetWastePct = ws.total > 0 ? ((ws.waste / ws.total) * 100) : 0;
      const virtualTxt = ws.realHalf ? ' • real 0,5 z magazynu' : (ws.virtualHalf ? ' • virtual 0,5 płyty' : '');
      const supplySource = String((sheet && sheet.supplySource) || '');
      const supplyTxt = supplySource === 'stock' ? ' • z magazynu' : (supplySource === 'order' ? ' • zamówić' : '');
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
        metaHtml: `<strong>Arkusz ${i+1}</strong> — ${mmToUnitStr(bm.boardW, unit)}×${mmToUnitStr(bm.boardH, unit)} ${unit} • Odpad: ${sheetWastePct.toFixed(1)}%${virtualTxt}${supplyTxt}`,
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
    return html;
  }

  FC.rozrysPrintLayout = {
    escapeHtml,
    formatSheetCount,
    buildPrintHtml,
  };
})();

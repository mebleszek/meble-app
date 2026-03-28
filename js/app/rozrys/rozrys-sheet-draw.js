(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function scheduleSheetCanvasRefresh(scope, deps){
    const cfg = Object.assign({ drawSheet:null }, deps || {});
    const root = (scope && typeof scope.querySelectorAll === 'function') ? scope : null;
    if(!root) return;
    const drawFn = typeof cfg.drawSheet === 'function' ? cfg.drawSheet : drawSheet;
    const redraw = ()=>{
      root.querySelectorAll('canvas[data-rozrys-sheet="1"]').forEach((canvas)=>{
        const payload = canvas.__rozrysDrawPayload;
        if(!payload) return;
        try{ drawFn(canvas, payload.sheet, payload.displayUnit, payload.edgeSubMm, payload.boardMeta); }catch(_){ }
      });
    };
    try{
      requestAnimationFrame(()=> requestAnimationFrame(redraw));
    }catch(_){
      setTimeout(redraw, 0);
    }
  }

  function drawSheet(canvas, sheet, displayUnit, edgeSubMm, boardMeta, deps){
    const cfg = Object.assign({ mmToUnitStr:null }, deps || {});
    const fmt = typeof cfg.mmToUnitStr === 'function'
      ? cfg.mmToUnitStr
      : ((mm, unit)=> `${Math.round(Number(mm) || 0)} ${unit === 'cm' ? 'cm' : 'mm'}`);
    try{
      const ctx = canvas.getContext('2d');
      const unit = (displayUnit === 'cm') ? 'cm' : 'mm';
      const helpers = FC.rozrysSheetHelpers || {};
      const metrics = typeof helpers.resolveBoardMetrics === 'function'
        ? helpers.resolveBoardMetrics(canvas, sheet, boardMeta)
        : { boardW:Math.max(1, Number(sheet && sheet.boardW) || 1), boardH:Math.max(1, Number(sheet && sheet.boardH) || 1), trimMm:0, usableW:1, usableH:1, scale:1 };
      if(typeof helpers.applyCanvasSize === 'function') helpers.applyCanvasSize(canvas, metrics.boardW, metrics.boardH, metrics.scale);
      else {
        canvas.width = Math.max(1, Math.round(metrics.boardW * metrics.scale));
        canvas.height = Math.max(1, Math.round(metrics.boardH * metrics.scale));
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#0b1f33';
      ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
      const math = typeof helpers.createCanvasMath === 'function' ? helpers.createCanvasMath(ctx) : null;
      const snapRect = math && math.snapRect ? math.snapRect : ((x, y, w, h)=>({ sx:x, sy:y, sw:w, sh:h }));
      const strokeLine = math && math.strokeLine ? math.strokeLine : ((x1, y1, x2, y2)=>{ ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); });
      if(typeof helpers.drawTrimArea === 'function') helpers.drawTrimArea(ctx, canvas, metrics.trimMm, metrics.usableW, metrics.usableH, metrics.scale, snapRect);
      const halfInfo = typeof helpers.buildHalfDividerInfo === 'function' ? helpers.buildHalfDividerInfo(sheet, metrics.boardW, metrics.boardH) : null;
      const placements = (sheet && sheet.placements || []).filter((p)=> !p.unplaced);
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      placements.forEach((placement)=>{
        if(typeof helpers.drawPlacement === 'function'){
          helpers.drawPlacement(ctx, placement, { trimMm:metrics.trimMm, scale:metrics.scale }, {
            fmt,
            unit,
            edgeSubMm,
            snapRect,
            strokeLine,
          });
        }
      });
      if(typeof helpers.drawHalfDivider === 'function') helpers.drawHalfDivider(ctx, canvas, halfInfo, metrics.boardW, metrics.boardH, metrics.scale, strokeLine);
    }catch(_){ }
  }

  FC.rozrysSheetDraw = {
    scheduleSheetCanvasRefresh,
    drawSheet,
  };
})();

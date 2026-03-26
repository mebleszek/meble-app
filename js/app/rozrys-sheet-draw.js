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
      const metaBoardW = Number(boardMeta && boardMeta.boardW) || Number(sheet && sheet.fullBoardW) || Number(sheet && sheet.boardW) || 0;
      const metaBoardH = Number(boardMeta && boardMeta.boardH) || Number(sheet && sheet.fullBoardH) || Number(sheet && sheet.boardH) || 0;
      const trimMm = Math.max(0, Number(boardMeta && boardMeta.trim) || Number(sheet && sheet.trimMm) || 0);
      const W = Math.max(1, metaBoardW);
      const H = Math.max(1, metaBoardH);
      const usableW = Math.max(1, W - 2 * trimMm);
      const usableH = Math.max(1, H - 2 * trimMm);
      const refBoardW = Math.max(W,
        Number(boardMeta && boardMeta.referenceBoardW) ||
        Number(sheet && sheet.referenceBoardW) ||
        Number(sheet && sheet.selectedBoardW) ||
        Number(sheet && sheet.baseBoardW) ||
        0
      );
      const refBoardH = Math.max(H,
        Number(boardMeta && boardMeta.referenceBoardH) ||
        Number(sheet && sheet.referenceBoardH) ||
        Number(sheet && sheet.selectedBoardH) ||
        Number(sheet && sheet.baseBoardH) ||
        0
      );

      const measuredParentW = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
      const viewportW = (typeof window !== 'undefined' && Number(window.innerWidth) > 0) ? Math.max(320, Number(window.innerWidth) - 48) : 900;
      const maxW = Math.min(900, measuredParentW > 180 ? measuredParentW : viewportW);
      const maxH = Math.max(220, Math.min(1400, (typeof window !== 'undefined' && Number(window.innerHeight) > 0) ? Number(window.innerHeight) * 0.72 : 1400));
      const scaleByW = maxW / refBoardW;
      const scaleByH = maxH / refBoardH;
      const scale = Math.max(0.05, Math.min(scaleByW, scaleByH));
      canvas.width = Math.max(1, Math.round(W * scale));
      canvas.height = Math.max(1, Math.round(H * scale));
      try{
        canvas.style.width = `${canvas.width}px`;
        canvas.style.height = `${canvas.height}px`;
        canvas.style.maxWidth = '100%';
        canvas.style.display = 'block';
      }catch(_){ }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#0b1f33';
      ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

      const snap = (v, lw)=>{
        const n = Math.round(v);
        return (lw % 2) ? (n + 0.5) : n;
      };
      const snapRect = (x, y, w, h, lw)=>{
        const sx = snap(x, lw);
        const sy = snap(y, lw);
        const sw = Math.max(0, Math.round(w));
        const sh = Math.max(0, Math.round(h));
        return { sx, sy, sw, sh };
      };
      const strokeLine = (x1, y1, x2, y2, lw)=>{
        const sx1 = snap(x1, lw);
        const sy1 = snap(y1, lw);
        const sx2 = snap(x2, lw);
        const sy2 = snap(y2, lw);
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
      };

      if(trimMm > 0){
        const trimPx = trimMm * scale;
        const usableRect = snapRect(trimPx, trimPx, usableW * scale, usableH * scale, 1);
        ctx.save();
        ctx.fillStyle = 'rgba(11, 31, 51, 0.04)';
        ctx.fillRect(0, 0, canvas.width, trimPx);
        ctx.fillRect(0, canvas.height - trimPx, canvas.width, trimPx);
        ctx.fillRect(0, trimPx, trimPx, Math.max(0, canvas.height - trimPx * 2));
        ctx.fillRect(canvas.width - trimPx, trimPx, trimPx, Math.max(0, canvas.height - trimPx * 2));
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(11, 31, 51, 0.55)';
        ctx.strokeRect(usableRect.sx, usableRect.sy, Math.max(0, usableRect.sw - 1), Math.max(0, usableRect.sh - 1));
        ctx.restore();
      }

      const halfBoardW = Math.max(0, Number(sheet && (sheet.realHalfBoardW || sheet.virtualBoardW)) || 0);
      const halfBoardH = Math.max(0, Number(sheet && (sheet.realHalfBoardH || sheet.virtualBoardH)) || 0);
      const halfDividerAxis = String((sheet && sheet.halfDividerAxis) || '').toLowerCase();
      const halfDividerPos = Math.max(0, Number(sheet && sheet.halfDividerPos) || 0);
      const showHalfDivider = !!(sheet && (sheet.realHalf || sheet.realHalfFromStock || sheet.virtualHalf))
        && ((halfDividerAxis === 'vertical' && halfDividerPos > 0 && halfDividerPos < W)
          || (halfDividerAxis === 'horizontal' && halfDividerPos > 0 && halfDividerPos < H)
          || (!halfDividerAxis && ((halfBoardW > 0 && halfBoardW < W) || (halfBoardH > 0 && halfBoardH < H))));
      const drawHalfDivider = ()=>{
        if(!showHalfDivider) return;
        ctx.save();
        ctx.setLineDash([10, 6]);
        ctx.strokeStyle = 'rgba(11, 31, 51, 0.98)';
        ctx.lineWidth = 2;
        if(halfDividerAxis === 'vertical'){
          const x = halfDividerPos * scale;
          strokeLine(x, 0, x, canvas.height, 2);
        }else if(halfDividerAxis === 'horizontal'){
          const y = halfDividerPos * scale;
          strokeLine(0, y, canvas.width, y, 2);
        }else if(halfBoardW > 0 && halfBoardW < W){
          const x = halfBoardW * scale;
          strokeLine(x, 0, x, canvas.height, 2);
        }else if(halfBoardH > 0 && halfBoardH < H){
          const y = halfBoardH * scale;
          strokeLine(0, y, canvas.width, y, 2);
        }
        ctx.restore();
      };

      const placements = (sheet && sheet.placements || []).filter((p)=> !p.unplaced);
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      const sub = Math.max(0, Number(edgeSubMm) || 0);
      const getCutDims = (p)=>{
        if(!(sub > 0)) return { w:p.w, h:p.h };
        const cW = (p.edgeH1 ? 1 : 0) + (p.edgeH2 ? 1 : 0);
        const cH = (p.edgeW1 ? 1 : 0) + (p.edgeW2 ? 1 : 0);
        return {
          w: Math.max(0, Math.round((p.w || 0) - sub * cW)),
          h: Math.max(0, Math.round((p.h || 0) - sub * cH)),
        };
      };

      placements.forEach((p)=>{
        const x = (trimMm + p.x) * scale;
        const y = (trimMm + p.y) * scale;
        const w = p.w * scale;
        const hh = p.h * scale;
        const gap = 1;
        const vx = Math.round(x + gap);
        const vy = Math.round(y + gap);
        const vw = Math.max(0, Math.round(w - gap * 2));
        const vh = Math.max(0, Math.round(hh - gap * 2));

        ctx.fillStyle = 'rgba(11, 141, 183, 0.10)';
        ctx.fillRect(vx, vy, vw, vh);
        ctx.strokeStyle = 'rgba(11, 31, 51, 0.55)';
        {
          const r = snapRect(vx, vy, vw, vh, 1);
          ctx.lineWidth = 1;
          ctx.strokeRect(r.sx, r.sy, Math.max(0, r.sw - 1), Math.max(0, r.sh - 1));
        }

        ctx.fillStyle = '#0b1f33';
        const cut = getCutDims(p);
        const wLabel = `${fmt(cut.w, unit)}`;
        const hLabel = `${fmt(cut.h, unit)}`;
        const fontSize = 12;
        const hasEdges = !!(p.edgeW1 || p.edgeW2 || p.edgeH1 || p.edgeH2);
        const edgeInset = 3;
        const dimInset = edgeInset + 1;
        if(hasEdges){
          ctx.save();
          ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(11, 31, 51, 0.45)';
          const shortPad = (len)=> Math.max(1, Math.floor(len * 0.025));
          const padX = shortPad(vw);
          const padY = shortPad(vh);
          if(p.edgeW1) strokeLine(vx + padX, vy + edgeInset, vx + vw - padX, vy + edgeInset, 1);
          if(p.edgeW2) strokeLine(vx + padX, vy + vh - edgeInset, vx + vw - padX, vy + vh - edgeInset, 1);
          if(p.edgeH1) strokeLine(vx + edgeInset, vy + padY, vx + edgeInset, vy + vh - padY, 1);
          if(p.edgeH2) strokeLine(vx + vw - edgeInset, vy + padY, vx + vw - edgeInset, vy + vh - padY, 1);
          ctx.restore();
        }

        {
          const tw = ctx.measureText(wLabel).width;
          const tx = vx + (vw - tw) / 2;
          const mt = ctx.measureText('0');
          const ascent = (mt && mt.actualBoundingBoxAscent) ? mt.actualBoundingBoxAscent : Math.round(fontSize * 0.8);
          const baseY = vy + dimInset + ascent;
          ctx.fillText(wLabel, tx, baseY);
        }

        {
          const mtH = ctx.measureText(hLabel);
          const ascH = (mtH && mtH.actualBoundingBoxAscent) ? mtH.actualBoundingBoxAscent : Math.round(fontSize * 0.8);
          const desH = (mtH && mtH.actualBoundingBoxDescent) ? mtH.actualBoundingBoxDescent : Math.round(fontSize * 0.2);
          const textH = ascH + desH;
          const originX = vx + edgeInset + 1 + (textH / 2);
          ctx.save();
          ctx.translate(originX, vy + vh / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(hLabel, 0, 0);
          ctx.restore();
        }
      });
      drawHalfDivider();
    }catch(_){ }
  }

  FC.rozrysSheetDraw = {
    scheduleSheetCanvasRefresh,
    drawSheet,
  };
})();

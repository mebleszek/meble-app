(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function resolveBoardMetrics(canvas, sheet, boardMeta){
    const metaBoardW = Number(boardMeta && boardMeta.boardW) || Number(sheet && sheet.fullBoardW) || Number(sheet && sheet.boardW) || 0;
    const metaBoardH = Number(boardMeta && boardMeta.boardH) || Number(sheet && sheet.fullBoardH) || Number(sheet && sheet.boardH) || 0;
    const trimMm = Math.max(0, Number(boardMeta && boardMeta.trim) || Number(sheet && sheet.trimMm) || 0);
    const boardW = Math.max(1, metaBoardW);
    const boardH = Math.max(1, metaBoardH);
    const usableW = Math.max(1, boardW - 2 * trimMm);
    const usableH = Math.max(1, boardH - 2 * trimMm);
    const refBoardW = Math.max(boardW,
      Number(boardMeta && boardMeta.referenceBoardW) ||
      Number(sheet && sheet.referenceBoardW) ||
      Number(sheet && sheet.selectedBoardW) ||
      Number(sheet && sheet.baseBoardW) ||
      0
    );
    const refBoardH = Math.max(boardH,
      Number(boardMeta && boardMeta.referenceBoardH) ||
      Number(sheet && sheet.referenceBoardH) ||
      Number(sheet && sheet.selectedBoardH) ||
      Number(sheet && sheet.baseBoardH) ||
      0
    );
    const measuredParentW = canvas && canvas.parentElement ? canvas.parentElement.clientWidth : 0;
    const viewportW = (typeof window !== 'undefined' && Number(window.innerWidth) > 0) ? Math.max(320, Number(window.innerWidth) - 48) : 900;
    const maxW = Math.min(900, measuredParentW > 180 ? measuredParentW : viewportW);
    const maxH = Math.max(220, Math.min(1400, (typeof window !== 'undefined' && Number(window.innerHeight) > 0) ? Number(window.innerHeight) * 0.72 : 1400));
    const scaleByW = maxW / refBoardW;
    const scaleByH = maxH / refBoardH;
    const scale = Math.max(0.05, Math.min(scaleByW, scaleByH));
    return { boardW, boardH, trimMm, usableW, usableH, refBoardW, refBoardH, scale };
  }

  function applyCanvasSize(canvas, boardW, boardH, scale){
    canvas.width = Math.max(1, Math.round(boardW * scale));
    canvas.height = Math.max(1, Math.round(boardH * scale));
    try{
      canvas.style.width = '100%';
      canvas.style.maxWidth = `${canvas.width}px`;
      canvas.style.height = 'auto';
      canvas.style.aspectRatio = `${boardW} / ${boardH}`;
      canvas.style.display = 'block';
    }catch(_){ }
  }

  function createCanvasMath(ctx){
    const snap = (v, lw)=>{
      const n = Math.round(v);
      return (lw % 2) ? (n + 0.5) : n;
    };
    const snapRect = (x, y, w, h, lw)=>({
      sx: snap(x, lw),
      sy: snap(y, lw),
      sw: Math.max(0, Math.round(w)),
      sh: Math.max(0, Math.round(h)),
    });
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
    return { snap, snapRect, strokeLine };
  }

  function drawTrimArea(ctx, canvas, trimMm, usableW, usableH, scale, snapRect){
    if(!(trimMm > 0)) return;
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

  function buildHalfDividerInfo(sheet, boardW, boardH){
    const halfBoardW = Math.max(0, Number(sheet && (sheet.realHalfBoardW || sheet.virtualBoardW)) || 0);
    const halfBoardH = Math.max(0, Number(sheet && (sheet.realHalfBoardH || sheet.virtualBoardH)) || 0);
    const halfDividerAxis = String((sheet && sheet.halfDividerAxis) || '').toLowerCase();
    const halfDividerPos = Math.max(0, Number(sheet && sheet.halfDividerPos) || 0);
    const visible = !!(sheet && (sheet.realHalf || sheet.realHalfFromStock || sheet.virtualHalf))
      && ((halfDividerAxis === 'vertical' && halfDividerPos > 0 && halfDividerPos < boardW)
        || (halfDividerAxis === 'horizontal' && halfDividerPos > 0 && halfDividerPos < boardH)
        || (!halfDividerAxis && ((halfBoardW > 0 && halfBoardW < boardW) || (halfBoardH > 0 && halfBoardH < boardH))));
    return { visible, halfBoardW, halfBoardH, halfDividerAxis, halfDividerPos };
  }

  function drawHalfDivider(ctx, canvas, info, boardW, boardH, scale, strokeLine){
    if(!info || !info.visible) return;
    ctx.save();
    ctx.setLineDash([10, 6]);
    ctx.strokeStyle = 'rgba(11, 31, 51, 0.98)';
    ctx.lineWidth = 2;
    if(info.halfDividerAxis === 'vertical'){
      const x = info.halfDividerPos * scale;
      strokeLine(x, 0, x, canvas.height, 2);
    }else if(info.halfDividerAxis === 'horizontal'){
      const y = info.halfDividerPos * scale;
      strokeLine(0, y, canvas.width, y, 2);
    }else if(info.halfBoardW > 0 && info.halfBoardW < boardW){
      const x = info.halfBoardW * scale;
      strokeLine(x, 0, x, canvas.height, 2);
    }else if(info.halfBoardH > 0 && info.halfBoardH < boardH){
      const y = info.halfBoardH * scale;
      strokeLine(0, y, canvas.width, y, 2);
    }
    ctx.restore();
  }

  function getCutDims(part, edgeSubMm){
    const sub = Math.max(0, Number(edgeSubMm) || 0);
    if(!(sub > 0)) return { w:part.w, h:part.h };
    const cW = (part.edgeH1 ? 1 : 0) + (part.edgeH2 ? 1 : 0);
    const cH = (part.edgeW1 ? 1 : 0) + (part.edgeW2 ? 1 : 0);
    return {
      w: Math.max(0, Math.round((part.w || 0) - sub * cW)),
      h: Math.max(0, Math.round((part.h || 0) - sub * cH)),
    };
  }

  function drawPlacement(ctx, placement, layout, deps){
    const cfg = Object.assign({ fmt:null, unit:'mm', edgeSubMm:0, snapRect:null, strokeLine:null }, deps || {});
    const fmt = typeof cfg.fmt === 'function' ? cfg.fmt : ((mm, unit)=> `${Math.round(Number(mm) || 0)} ${unit}`);
    const x = (layout.trimMm + placement.x) * layout.scale;
    const y = (layout.trimMm + placement.y) * layout.scale;
    const w = placement.w * layout.scale;
    const hh = placement.h * layout.scale;
    const gap = 1;
    const vx = Math.round(x + gap);
    const vy = Math.round(y + gap);
    const vw = Math.max(0, Math.round(w - gap * 2));
    const vh = Math.max(0, Math.round(hh - gap * 2));
    ctx.fillStyle = 'rgba(11, 141, 183, 0.10)';
    ctx.fillRect(vx, vy, vw, vh);
    ctx.strokeStyle = 'rgba(11, 31, 51, 0.55)';
    const r = cfg.snapRect(vx, vy, vw, vh, 1);
    ctx.lineWidth = 1;
    ctx.strokeRect(r.sx, r.sy, Math.max(0, r.sw - 1), Math.max(0, r.sh - 1));
    ctx.fillStyle = '#0b1f33';
    const cut = getCutDims(placement, cfg.edgeSubMm);
    const wLabel = `${fmt(cut.w, cfg.unit)}`;
    const hLabel = `${fmt(cut.h, cfg.unit)}`;
    const fontSize = 12;
    const hasEdges = !!(placement.edgeW1 || placement.edgeW2 || placement.edgeH1 || placement.edgeH2);
    const edgeInset = 3;
    const dimInset = edgeInset + 1;
    if(hasEdges){
      ctx.save();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(11, 31, 51, 0.45)';
      const shortPad = (len)=> Math.max(1, Math.floor(len * 0.025));
      const padX = shortPad(vw);
      const padY = shortPad(vh);
      if(placement.edgeW1) cfg.strokeLine(vx + padX, vy + edgeInset, vx + vw - padX, vy + edgeInset, 1);
      if(placement.edgeW2) cfg.strokeLine(vx + padX, vy + vh - edgeInset, vx + vw - padX, vy + vh - edgeInset, 1);
      if(placement.edgeH1) cfg.strokeLine(vx + edgeInset, vy + padY, vx + edgeInset, vy + vh - padY, 1);
      if(placement.edgeH2) cfg.strokeLine(vx + vw - edgeInset, vy + padY, vx + vw - edgeInset, vy + vh - padY, 1);
      ctx.restore();
    }
    const tw = ctx.measureText(wLabel).width;
    const tx = vx + (vw - tw) / 2;
    const mt = ctx.measureText('0');
    const ascent = (mt && mt.actualBoundingBoxAscent) ? mt.actualBoundingBoxAscent : Math.round(fontSize * 0.8);
    const baseY = vy + dimInset + ascent;
    ctx.fillText(wLabel, tx, baseY);

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

  FC.rozrysSheetHelpers = {
    resolveBoardMetrics,
    applyCanvasSize,
    createCanvasMath,
    drawTrimArea,
    buildHalfDividerInfo,
    drawHalfDivider,
    getCutDims,
    drawPlacement,
  };
})();

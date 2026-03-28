(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function sameSheetFormat(aW, aH, bW, bH){
    const aw = Math.round(Number(aW) || 0);
    const ah = Math.round(Number(aH) || 0);
    const bw = Math.round(Number(bW) || 0);
    const bh = Math.round(Number(bH) || 0);
    return (aw === bw && ah === bh) || (aw === bh && ah === bw);
  }

  function buildStockSignatureForRows(rows){
    return (Array.isArray(rows) ? rows : []).slice()
      .sort((a, b)=>{
        if(a.width !== b.width) return a.width - b.width;
        if(a.height !== b.height) return a.height - b.height;
        return a.qty - b.qty;
      })
      .map((row)=> `${row.width}x${row.height}:${row.qty}`)
      .join('|');
  }

  function canPartFitSheet(part, boardWmm, boardHmm, trimMm, allowRotate){
    const pw = Math.max(0, Math.round(Number(part && part.w) || 0));
    const ph = Math.max(0, Math.round(Number(part && part.h) || 0));
    const usableW = Math.max(0, Math.round(Number(boardWmm) || 0) - 2 * Math.max(0, Math.round(Number(trimMm) || 0)));
    const usableH = Math.max(0, Math.round(Number(boardHmm) || 0) - 2 * Math.max(0, Math.round(Number(trimMm) || 0)));
    if(!(usableW > 0 && usableH > 0 && pw > 0 && ph > 0)) return false;
    if(pw <= usableW && ph <= usableH) return true;
    if(allowRotate && ph <= usableW && pw <= usableH) return true;
    return false;
  }

  function filterPartsForSheet(parts, boardWmm, boardHmm, trimMm, grainOn, overrides, deps){
    const cfg = Object.assign({ isPartRotationAllowed:null }, deps || {});
    return (Array.isArray(parts) ? parts : [])
      .map((part)=> Object.assign({}, part, { qty: Math.max(0, Math.round(Number(part && part.qty) || 0)) }))
      .filter((part)=>{
        if(!(part.qty > 0)) return false;
        const allowRotate = typeof cfg.isPartRotationAllowed === 'function'
          ? !!cfg.isPartRotationAllowed(part, !!grainOn, overrides || {})
          : true;
        return canPartFitSheet(part, boardWmm, boardHmm, trimMm, allowRotate);
      });
  }

  function getExactSheetStockForRows(rows, boardWmm, boardHmm){
    const filtered = (Array.isArray(rows) ? rows : []).filter((row)=> sameSheetFormat(row.width, row.height, boardWmm, boardHmm));
    if(!filtered.length) return { qty:0, width:Math.round(Number(boardWmm) || 0), height:Math.round(Number(boardHmm) || 0) };
    filtered.sort((a, b)=> (Number(b.qty) || 0) - (Number(a.qty) || 0));
    const best = filtered[0];
    return {
      qty: Math.max(0, Number(best && best.qty) || 0),
      width: Math.round(Number(best && best.width) || 0),
      height: Math.round(Number(best && best.height) || 0),
    };
  }

  function getLargestSheetFormatForRows(rows, fallbackWmm, fallbackHmm){
    const list = (Array.isArray(rows) ? rows : []).slice();
    list.sort((a, b)=>{
      const aa = (Number(a && a.width) || 0) * (Number(a && a.height) || 0);
      const bb = (Number(b && b.width) || 0) * (Number(b && b.height) || 0);
      if(bb !== aa) return bb - aa;
      if((Number(b && b.width) || 0) !== (Number(a && a.width) || 0)) return (Number(b && b.width) || 0) - (Number(a && a.width) || 0);
      return (Number(b && b.height) || 0) - (Number(a && a.height) || 0);
    });
    const best = list[0] || null;
    const fallbackW = Math.round(Number(fallbackWmm) || 0);
    const fallbackH = Math.round(Number(fallbackHmm) || 0);
    const fallbackArea = fallbackW * fallbackH;
    const bestW = Math.round(Number(best && best.width) || 0);
    const bestH = Math.round(Number(best && best.height) || 0);
    const bestArea = bestW * bestH;
    if(!(bestArea > 0) || fallbackArea >= bestArea){
      return { width:fallbackW, height:fallbackH, qty:Math.max(0, Number(best && best.qty) || 0) };
    }
    return { width:bestW, height:bestH, qty:Math.max(0, Number(best && best.qty) || 0) };
  }

  function clonePlanSheetsWithSupply(sheets, opts){
    const cfg = Object.assign({ supplySource:'order', supplyText:'zamówić', fullBoardW:0, fullBoardH:0, trimMm:0 }, opts || {});
    return (Array.isArray(sheets) ? sheets : []).map((sheet)=> Object.assign({}, sheet, {
      placements: Array.isArray(sheet && sheet.placements) ? sheet.placements.map((pl)=> Object.assign({}, pl)) : [],
      supplySource: cfg.supplySource,
      supplyText: cfg.supplyText,
      fullBoardW: Math.max(0, Math.round(Number(cfg.fullBoardW) || Number(sheet && sheet.fullBoardW) || 0)),
      fullBoardH: Math.max(0, Math.round(Number(cfg.fullBoardH) || Number(sheet && sheet.fullBoardH) || 0)),
      trimMm: Math.max(0, Math.round(Number(cfg.trimMm) || Number(sheet && sheet.trimMm) || 0)),
    }));
  }

  function partShapeKey(name, w, h){
    const nm = String(name || 'Element').trim() || 'Element';
    const ww = Math.max(1, Math.round(Number(w) || 0));
    const hh = Math.max(1, Math.round(Number(h) || 0));
    return `${nm}||${ww}x${hh}`;
  }

  function buildPartLookup(parts, deps){
    const cfg = Object.assign({ partSignature:null }, deps || {});
    const bySig = new Set();
    const byShape = new Map();
    (Array.isArray(parts) ? parts : []).forEach((part)=>{
      if(!part) return;
      const sig = typeof cfg.partSignature === 'function' ? cfg.partSignature(part) : `${part && part.material || ''}||${part && part.name || ''}||${part && part.w || 0}x${part && part.h || 0}`;
      if(sig) bySig.add(String(sig));
      const keys = new Set([
        partShapeKey(part && part.name, part && part.w, part && part.h),
        partShapeKey(part && part.name, part && part.h, part && part.w),
      ]);
      keys.forEach((shapeKey)=>{
        if(!byShape.has(shapeKey)) byShape.set(shapeKey, []);
        byShape.get(shapeKey).push(String(sig || ''));
      });
    });
    return { bySig, byShape };
  }

  function countPlacedPartsByKey(sheets, deps){
    const cfg = Object.assign({ parts:null, partSignature:null }, deps || {});
    const lookup = buildPartLookup(cfg.parts, { partSignature: cfg.partSignature });
    const exact = new Map();
    const fallback = new Map();
    (Array.isArray(sheets) ? sheets : []).forEach((sheet)=>{
      (Array.isArray(sheet && sheet.placements) ? sheet.placements : []).forEach((pl)=>{
        if(!pl || pl.unplaced) return;
        const key = String(pl.key || '').trim();
        if(key && lookup.bySig.has(key)){
          exact.set(key, (exact.get(key) || 0) + 1);
          return;
        }
        const shapeKey = partShapeKey(pl && pl.name, pl && pl.w, pl && pl.h);
        const altShapeKey = partShapeKey(pl && pl.name, pl && pl.h, pl && pl.w);
        const chosen = lookup.byShape.has(shapeKey) ? shapeKey : (lookup.byShape.has(altShapeKey) ? altShapeKey : shapeKey);
        fallback.set(chosen, (fallback.get(chosen) || 0) + 1);
      });
    });
    return { exact, fallback };
  }

  function subtractPlacedParts(parts, usedMap, deps){
    const cfg = Object.assign({ partSignature:null }, deps || {});
    const exact = usedMap && usedMap.exact instanceof Map ? usedMap.exact : (usedMap instanceof Map ? usedMap : new Map());
    const fallback = usedMap && usedMap.fallback instanceof Map ? new Map(usedMap.fallback) : new Map();
    return (Array.isArray(parts) ? parts : []).map((part)=>{
      const sig = typeof cfg.partSignature === 'function' ? cfg.partSignature(part) : `${part && part.material || ''}||${part && part.name || ''}||${part && part.w || 0}x${part && part.h || 0}`;
      let qty = Math.max(0, Math.round(Number(part && part.qty) || 0) - Math.max(0, Number(exact.get(sig)) || 0));
      if(qty > 0){
        const primaryShape = partShapeKey(part && part.name, part && part.w, part && part.h);
        const secondaryShape = partShapeKey(part && part.name, part && part.h, part && part.w);
        const shapeKeys = primaryShape === secondaryShape ? [primaryShape] : [primaryShape, secondaryShape];
        for(const shapeKey of shapeKeys){
          if(!(qty > 0)) break;
          const available = Math.max(0, Number(fallback.get(shapeKey)) || 0);
          if(!(available > 0)) continue;
          const used = Math.min(available, qty);
          qty -= used;
          fallback.set(shapeKey, available - used);
        }
      }
      return qty > 0 ? Object.assign({}, part, { qty }) : null;
    }).filter(Boolean);
  }

  FC.rozrysSheetModel = {
    sameSheetFormat,
    buildStockSignatureForRows,
    canPartFitSheet,
    filterPartsForSheet,
    getExactSheetStockForRows,
    getLargestSheetFormatForRows,
    clonePlanSheetsWithSupply,
    partShapeKey,
    buildPartLookup,
    countPlacedPartsByKey,
    subtractPlacedParts,
  };
})();

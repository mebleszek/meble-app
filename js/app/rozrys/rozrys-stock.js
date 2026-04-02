(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function getRealHalfStockForMaterial(material, fullWmm, fullHmm){
    try{
      const rows = (FC.magazyn && FC.magazyn.findHalfSheetsForMaterial)
        ? FC.magazyn.findHalfSheetsForMaterial(material, fullWmm, fullHmm)
        : [];
      if(!rows || !rows.length) return { qty:0, width:0, height:0 };
      const row = rows.slice().sort((a, b)=> (Number(b && b.qty) || 0) - (Number(a && a.qty) || 0))[0];
      return {
        qty: Math.max(0, Number(row && row.qty) || 0),
        width: Math.round(Number(row && row.width) || 0),
        height: Math.round(Number(row && row.height) || 0),
      };
    }catch(_){
      return { qty:0, width:0, height:0 };
    }
  }

  function toMmByUnit(unit, value){
    const u = unit === 'cm' ? 'cm' : 'mm';
    const n = Number(value);
    if(!Number.isFinite(n)) return 0;
    return u === 'mm' ? Math.round(n) : Math.round(n * 10);
  }

  function fromMmByUnit(unit, valueMm){
    const mm = Math.max(0, Math.round(Number(valueMm) || 0));
    if(unit === 'cm') return Math.round((mm / 10) * 10) / 10;
    return mm;
  }

  function sameSheetFormat(aW, aH, bW, bH){
    if(FC.rozrysSheetModel && typeof FC.rozrysSheetModel.sameSheetFormat === 'function'){
      return FC.rozrysSheetModel.sameSheetFormat(aW, aH, bW, bH);
    }
    const aw = Math.round(Number(aW) || 0);
    const ah = Math.round(Number(aH) || 0);
    const bw = Math.round(Number(bW) || 0);
    const bh = Math.round(Number(bH) || 0);
    return (aw === bw && ah === bh) || (aw === bh && ah === bw);
  }

  function getDefaultRozrysOptionValues(unit){
    const u = unit === 'mm' ? 'mm' : 'cm';
    return {
      unit: u,
      edge: '0',
      boardW: u === 'mm' ? 2800 : 280,
      boardH: u === 'mm' ? 2070 : 207,
      kerf: u === 'mm' ? 4 : 0.4,
      trim: u === 'mm' ? 10 : 1,
      minW: 0,
      minH: 0,
    };
  }

  function getSheetRowsForMaterial(material, opts){
    const cfg = Object.assign({ includeZero:true }, opts || {});
    try{
      const rows = (FC.magazyn && typeof FC.magazyn.findForMaterial === 'function') ? FC.magazyn.findForMaterial(material) : [];
      return (Array.isArray(rows) ? rows : []).map((row)=> ({
        id: String(row && row.id || ''),
        material: String(row && row.material || ''),
        width: Math.max(0, Math.round(Number(row && row.width) || 0)),
        height: Math.max(0, Math.round(Number(row && row.height) || 0)),
        qty: Math.max(0, Math.round(Number(row && row.qty) || 0)),
      })).filter((row)=> row.width > 0 && row.height > 0 && (cfg.includeZero || row.qty > 0));
    }catch(_){
      return [];
    }
  }

  function buildStockSignatureForMaterial(material){
    const rows = getSheetRowsForMaterial(material, { includeZero:true });
    if(FC.rozrysSheetModel && typeof FC.rozrysSheetModel.buildStockSignatureForRows === 'function'){
      return FC.rozrysSheetModel.buildStockSignatureForRows(rows);
    }
    return rows.map((row)=> `${row.width}x${row.height}:${row.qty}`).join('|');
  }

  function canPartFitSheet(part, boardWmm, boardHmm, trimMm, allowRotate){
    if(FC.rozrysSheetModel && typeof FC.rozrysSheetModel.canPartFitSheet === 'function'){
      return FC.rozrysSheetModel.canPartFitSheet(part, boardWmm, boardHmm, trimMm, allowRotate);
    }
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
    if(FC.rozrysSheetModel && typeof FC.rozrysSheetModel.filterPartsForSheet === 'function'){
      return FC.rozrysSheetModel.filterPartsForSheet(parts, boardWmm, boardHmm, trimMm, grainOn, overrides, deps);
    }
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

  function getExactSheetStockForMaterial(material, boardWmm, boardHmm){
    const rows = getSheetRowsForMaterial(material, { includeZero:false });
    if(FC.rozrysSheetModel && typeof FC.rozrysSheetModel.getExactSheetStockForRows === 'function'){
      return FC.rozrysSheetModel.getExactSheetStockForRows(rows, boardWmm, boardHmm);
    }
    const filtered = rows.filter((row)=> sameSheetFormat(row.width, row.height, boardWmm, boardHmm));
    if(!filtered.length) return { qty:0, width:Math.round(Number(boardWmm) || 0), height:Math.round(Number(boardHmm) || 0) };
    filtered.sort((a, b)=> (Number(b.qty) || 0) - (Number(a.qty) || 0));
    const best = filtered[0];
    return {
      qty: Math.max(0, Number(best && best.qty) || 0),
      width: Math.round(Number(best && best.width) || 0),
      height: Math.round(Number(best && best.height) || 0),
    };
  }

  function getLargestSheetFormatForMaterial(material, fallbackWmm, fallbackHmm){
    const rows = getSheetRowsForMaterial(material, { includeZero:true });
    if(FC.rozrysSheetModel && typeof FC.rozrysSheetModel.getLargestSheetFormatForRows === 'function'){
      return FC.rozrysSheetModel.getLargestSheetFormatForRows(rows, fallbackWmm, fallbackHmm);
    }
    return { width:Math.round(Number(fallbackWmm) || 0), height:Math.round(Number(fallbackHmm) || 0), qty:0 };
  }

  function clonePlanSheetsWithSupply(sheets, opts){
    if(FC.rozrysSheetModel && typeof FC.rozrysSheetModel.clonePlanSheetsWithSupply === 'function'){
      return FC.rozrysSheetModel.clonePlanSheetsWithSupply(sheets, opts);
    }
    return Array.isArray(sheets) ? sheets.slice() : [];
  }

  function partShapeKey(name, w, h){
    if(FC.rozrysSheetModel && typeof FC.rozrysSheetModel.partShapeKey === 'function'){
      return FC.rozrysSheetModel.partShapeKey(name, w, h);
    }
    const nm = String(name || 'Element').trim() || 'Element';
    const ww = Math.max(1, Math.round(Number(w) || 0));
    const hh = Math.max(1, Math.round(Number(h) || 0));
    return `${nm}||${ww}x${hh}`;
  }

  function buildPartLookup(parts, deps){
    if(FC.rozrysSheetModel && typeof FC.rozrysSheetModel.buildPartLookup === 'function'){
      return FC.rozrysSheetModel.buildPartLookup(parts, deps);
    }
    return { bySig:new Set(), byShape:new Map() };
  }

  function countPlacedPartsByKey(sheets, deps){
    if(FC.rozrysSheetModel && typeof FC.rozrysSheetModel.countPlacedPartsByKey === 'function'){
      return FC.rozrysSheetModel.countPlacedPartsByKey(sheets, deps);
    }
    return { exact:new Map(), fallback:new Map() };
  }

  function subtractPlacedParts(parts, usedMap, deps){
    if(FC.rozrysSheetModel && typeof FC.rozrysSheetModel.subtractPlacedParts === 'function'){
      return FC.rozrysSheetModel.subtractPlacedParts(parts, usedMap, deps);
    }
    return Array.isArray(parts) ? parts.slice() : [];
  }

  function buildPlanMetaFromState(st){
    const boardW = toMmByUnit(st && st.unit, st && st.boardW) || 2800;
    const boardH = toMmByUnit(st && st.unit, st && st.boardH) || 2070;
    const trim = toMmByUnit(st && st.unit, st && st.edgeTrim) || 10;
    return { trim, boardW, boardH, unit: (st && st.unit === 'cm') ? 'cm' : 'mm' };
  }


  async function applySheetStockLimit(material, st, parts, plan, opts, deps){
    const cfg = Object.assign({ onStatus:null }, opts || {});
    const api = Object.assign({ computePlanWithCurrentEngine:null, partSignature:null, isPartRotationAllowed:null }, deps || {});
    const basePlan = plan && typeof plan === 'object' ? plan : { sheets:[] };
    const currentWmm = toMmByUnit(st && st.unit, st && st.boardW) || 2800;
    const currentHmm = toMmByUnit(st && st.unit, st && st.boardH) || 2070;
    const trimMm = toMmByUnit(st && st.unit, st && st.edgeTrim) || 10;
    const areaOf = (row)=> (Math.max(0, Number(row && row.width) || 0) * Math.max(0, Number(row && row.height) || 0));
    const stockRows = getSheetRowsForMaterial(material, { includeZero:false })
      .filter((row)=> Math.max(0, Number(row && row.qty) || 0) > 0)
      .sort((a,b)=>{
        const aExact = sameSheetFormat(a && a.width, a && a.height, currentWmm, currentHmm) ? 1 : 0;
        const bExact = sameSheetFormat(b && b.width, b && b.height, currentWmm, currentHmm) ? 1 : 0;
        if(aExact !== bExact) return aExact - bExact;
        const aa = areaOf(a);
        const bb = areaOf(b);
        if(aa !== bb) return aa - bb;
        if((Number(a && a.width) || 0) !== (Number(b && b.width) || 0)) return (Number(a && a.width) || 0) - (Number(b && b.width) || 0);
        return (Number(a && a.height) || 0) - (Number(b && b.height) || 0);
      });

    const stockSheets = [];
    let remainingParts = (Array.isArray(parts) ? parts : []).map((part)=> Object.assign({}, part, { qty: Math.max(0, Math.round(Number(part && part.qty) || 0)) })).filter((part)=> part.qty > 0);
    const notes = [];
    let cancelled = !!(basePlan && basePlan.cancelled);

    if(stockRows.length){
      for(const row of stockRows){
        if(!remainingParts.length) break;
        const rowQty = Math.max(0, Math.round(Number(row && row.qty) || 0));
        const rowW = Math.max(0, Math.round(Number(row && row.width) || 0));
        const rowH = Math.max(0, Math.round(Number(row && row.height) || 0));
        if(!(rowQty > 0 && rowW > 0 && rowH > 0)) continue;
        try{
          if(typeof cfg.onStatus === 'function') cfg.onStatus(`Sprawdzam magazyn: ${Math.round(rowW/10)}×${Math.round(rowH/10)} cm • stan ${rowQty} szt.`);
        }catch(_){ }
        const rowState = Object.assign({}, st, {
          boardW: fromMmByUnit(st && st.unit, rowW),
          boardH: fromMmByUnit(st && st.unit, rowH),
          realHalfQty: 0,
          realHalfBoardW: 0,
          realHalfBoardH: 0,
        });
        const candidateParts = filterPartsForSheet(remainingParts, rowW, rowH, trimMm, !!rowState.grain, rowState.grainExceptions || {}, { isPartRotationAllowed: api.isPartRotationAllowed });
        if(!candidateParts.length) continue;
        let rowPlan = typeof api.computePlanWithCurrentEngine === 'function'
          ? await api.computePlanWithCurrentEngine(rowState, candidateParts)
          : null;
        let rowSheetsRaw = Array.isArray(rowPlan && rowPlan.sheets) ? rowPlan.sheets : [];
        if(!rowSheetsRaw.length && candidateParts.length !== remainingParts.length && typeof api.computePlanWithCurrentEngine === 'function'){
          rowPlan = await api.computePlanWithCurrentEngine(rowState, remainingParts);
          rowSheetsRaw = Array.isArray(rowPlan && rowPlan.sheets) ? rowPlan.sheets : [];
        }
        const usableCount = Math.min(rowQty, rowSheetsRaw.length);
        if(usableCount <= 0) continue;
        const usedSheetsRaw = rowSheetsRaw.slice(0, usableCount);
        stockSheets.push(...clonePlanSheetsWithSupply(usedSheetsRaw, {
          supplySource:'stock',
          supplyText:'z magazynu',
          fullBoardW: rowW,
          fullBoardH: rowH,
          trimMm,
        }));
        const usedMap = countPlacedPartsByKey(usedSheetsRaw, { parts: remainingParts, partSignature: api.partSignature });
        remainingParts = subtractPlacedParts(remainingParts, usedMap, { partSignature: api.partSignature });
        cancelled = cancelled || !!(rowPlan && rowPlan.cancelled);
        if(rowPlan && rowPlan.note) notes.push(rowPlan.note);
      }
    }

    if(!remainingParts.length){
      return Object.assign({}, basePlan, {
        sheets: stockSheets,
        cancelled,
        note: notes.filter(Boolean).join(' • ') || undefined,
        meta: Object.assign({}, basePlan.meta || buildPlanMetaFromState(st)),
        stockContext: {
          selectedBoardW: currentWmm,
          selectedBoardH: currentHmm,
          usedStockSheets: stockSheets.length,
          orderedSheets: 0,
        }
      });
    }

    let orderPlan = basePlan;
    if(stockRows.length){
      try{ if(typeof cfg.onStatus === 'function') cfg.onStatus('Brakujące formatki przerzucam na pełną płytę…'); }catch(_){ }
      orderPlan = typeof api.computePlanWithCurrentEngine === 'function'
        ? await api.computePlanWithCurrentEngine(st, remainingParts)
        : basePlan;
    }
    const orderSheets = clonePlanSheetsWithSupply((orderPlan && orderPlan.sheets) || [], {
      supplySource:'order',
      supplyText:'zamówić',
      fullBoardW: currentWmm,
      fullBoardH: currentHmm,
      trimMm,
    });
    if(orderPlan && orderPlan.note) notes.push(orderPlan.note);
    cancelled = cancelled || !!(orderPlan && orderPlan.cancelled);

    return Object.assign({}, basePlan, {
      sheets: stockSheets.concat(orderSheets),
      cancelled,
      note: notes.filter(Boolean).join(' • ') || undefined,
      meta: Object.assign({}, basePlan.meta || buildPlanMetaFromState(st)),
      stockContext: {
        selectedBoardW: currentWmm,
        selectedBoardH: currentHmm,
        usedStockSheets: stockSheets.length,
        orderedSheets: orderSheets.length,
      }
    });
  }

  FC.rozrysStock = {
    getRealHalfStockForMaterial,
    toMmByUnit,
    fromMmByUnit,
    sameSheetFormat,
    getDefaultRozrysOptionValues,
    getSheetRowsForMaterial,
    buildStockSignatureForMaterial,
    canPartFitSheet,
    filterPartsForSheet,
    getExactSheetStockForMaterial,
    getLargestSheetFormatForMaterial,
    clonePlanSheetsWithSupply,
    countPlacedPartsByKey,
    subtractPlacedParts,
    buildPlanMetaFromState,
    applySheetStockLimit,
  };
})();

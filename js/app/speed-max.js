(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const reg = FC.rozkrojSpeeds = FC.rozkrojSpeeds || {};
  const opt = FC.cutOptimizer;

  const SIMILAR_MM = 75;

  function axisThickness(axis, oriented){ return axis === 'along' ? oriented.w : oriented.h; }
  function axisLength(axis, oriented){ return axis === 'along' ? oriented.h : oriented.w; }
  function rectThickness(axis, rect){ return axis === 'along' ? rect.w : rect.h; }
  function rectLength(axis, rect){ return axis === 'along' ? rect.h : rect.w; }
  function opposite(axis){ return axis === 'along' ? 'across' : 'along'; }
  function removeByIds(items, set){ return items.filter(it => !set.has(it.id)); }

  function listSeedVariants(items, rect, axis){
    const sorted = opt.sortByAreaDesc(items);
    const out = [];
    const seen = new Set();
    for(const item of sorted){
      for(const o of opt.orientations(item)){
        const t = axisThickness(axis, o);
        const len = axisLength(axis, o);
        if(t > rectThickness(axis, rect) || len > rectLength(axis, rect)) continue;
        const key = `${item.id}|${o.rotated}|${t}|${len}`;
        if(seen.has(key)) continue;
        seen.add(key);
        out.push({ item, oriented:o, bandSize:t, length:len, area:o.w*o.h });
      }
    }
    return out;
  }

  function buildDpBand(items, rect, axis, kerf, seed, options){
    const bandSize = seed.bandSize;
    const capacity = rectLength(axis, rect);
    const seedLen = axisLength(axis, seed.oriented);
    if(seedLen > capacity) return null;
    const seedArea = seed.oriented.w * seed.oriented.h;

    const candidates = [];
    for(const item of items){
      if(item.id === seed.item.id) continue;
      for(const o of opt.orientations(item)){
        const t = axisThickness(axis, o);
        const len = axisLength(axis, o);
        if(t > bandSize || len > capacity) continue;
        const similar = Math.abs(bandSize - t) <= SIMILAR_MM;
        const closeness = Math.max(0, 1 - ((bandSize - t) / Math.max(1, bandSize)));
        const value = (o.w * o.h) * 1000
          + Math.round(closeness * 100000)
          + (similar ? 70000 : 0)
          + len;
        candidates.push({ item, oriented:o, len, thickness:t, area:o.w*o.h, value, similar });
      }
    }

    const maxCap = Math.max(0, capacity - seedLen + kerf);
    const dp = Array(maxCap + 1).fill(null);
    dp[0] = { value: 0, picks: [] };
    for(let i=0;i<candidates.length;i++){
      const cand = candidates[i];
      const weight = cand.len + kerf;
      for(let c=maxCap;c>=weight;c--){
        const prev = dp[c - weight];
        if(!prev) continue;
        const nextValue = prev.value + cand.value;
        if(!dp[c] || nextValue > dp[c].value){
          dp[c] = { value: nextValue, picks: prev.picks.concat(i) };
        }
      }
    }
    let best = { value: -Infinity, picks: [] };
    for(const st of dp){ if(st && st.value > best.value) best = st; }

    const chosen = [{ item: seed.item, oriented: seed.oriented, area: seedArea, thickness: bandSize, len: seedLen }];
    const usedIds = new Set([seed.item.id]);
    for(const idx of best.picks){
      const cand = candidates[idx];
      if(usedIds.has(cand.item.id)) continue;
      usedIds.add(cand.item.id);
      chosen.push({ item: cand.item, oriented: cand.oriented, area: cand.area, thickness: cand.thickness, len: cand.len });
    }

    const base = finalizeBand(chosen, rect, axis, kerf, seed, bandSize);
    if(!options.enableRepair || base.occupancy >= 0.8) return base;
    return repairBand(items, rect, axis, kerf, seed, base) || base;
  }

  function finalizeBand(chosen, rect, axis, kerf, seed, bandSize){
    const cap = rectLength(axis, rect);
    const area = chosen.reduce((sum, c)=> sum + c.area, 0);
    const sorted = chosen.slice().sort((a,b)=>{
      const at = a.thickness, bt = b.thickness;
      if(bt !== at) return bt - at;
      if(b.area !== a.area) return b.area - a.area;
      return String(a.item.id).localeCompare(String(b.item.id), 'pl');
    });
    const placements = [];
    let cursor = 0;
    for(const c of sorted){
      const x = axis === 'along' ? rect.x : rect.x + cursor;
      const y = axis === 'along' ? rect.y + cursor : rect.y;
      placements.push(opt.makePlacement(c.item, x, y, c.oriented));
      cursor += c.len + kerf;
    }
    const occupancy = opt.occupancyFrom(area, bandSize * cap);
    return {
      axis,
      seedId: seed.item.id,
      bandSize,
      area,
      occupancy,
      accepted: occupancy >= 0.9,
      placements,
      ids: new Set(sorted.map(c=>c.item.id)),
      count: sorted.length,
      firstArea: seed.area,
    };
  }

  function repairBand(items, rect, axis, kerf, seed, band){
    if(!band || band.occupancy >= 0.8) return band;
    const firstArea = Math.max(1, band.firstArea || seed.area || 1);
    const chosenItems = (band.placements || []).map(p=>items.find(it=>it.id === p.id)).filter(Boolean);
    const tinyIds = new Set();
    for(const it of chosenItems){
      const ar = (Number(it.w)||0) * (Number(it.h)||0);
      if(ar <= firstArea * 0.5 && it.id !== seed.item.id) tinyIds.add(it.id);
    }
    if(!tinyIds.size) return band;
    const filtered = items.filter(it=> !tinyIds.has(it.id) || it.id === seed.item.id);
    const retry = buildDpBand(filtered, rect, axis, kerf, seed, { enableRepair:false });
    if(retry && retry.occupancy > band.occupancy) return retry;
    return band;
  }

  function buildBestBand(items, rect, axis, kerf, options){
    const seeds = listSeedVariants(items, rect, axis);
    let bestAccepted = null;
    let bestAny = null;
    for(const seed of seeds){
      if(options.isCancelled && options.isCancelled()) return bestAccepted || bestAny;
      const band = buildDpBand(items, rect, axis, kerf, seed, options);
      if(!band) continue;
      if(band.accepted && opt.compareBand(band, bestAccepted) > 0) bestAccepted = band;
      if(opt.compareBand(band, bestAny) > 0) bestAny = band;
    }
    return bestAccepted || bestAny;
  }

  function consumeBandsRect(rect, axis, bands){
    const total = bands.reduce((sum, b)=> sum + (b.bandSize || 0), 0);
    if(axis === 'along') return { x: rect.x + total, y: rect.y, w: rect.w - total, h: rect.h };
    return { x: rect.x, y: rect.y + total, w: rect.w, h: rect.h - total };
  }

  function solveRect(items, rect, axis, kerf, options, depth){
    if(!items.length || rect.w <= 0 || rect.h <= 0) return { placements: [], ids: new Set(), usedArea: 0, primaryBands: 0 };
    const band1 = buildBestBand(items, rect, axis, kerf, options);
    if(!band1) return { placements: [], ids: new Set(), usedArea: 0, primaryBands: 0 };

    let bands = [band1];
    if(band1.accepted){
      const rectAfter1 = consumeBandsRect(rect, axis, bands);
      const rem1 = removeByIds(items, band1.ids);
      if(rectAfter1.w > 0 && rectAfter1.h > 0 && rem1.length){
        const band2 = buildBestBand(rem1, rectAfter1, axis, kerf, options);
        if(band2 && band2.accepted && band1.occupancy >= 0.9 && band2.occupancy >= 0.9){
          bands.push(band2);
        }
      }
    }

    const placements = [];
    const usedIds = new Set();
    let usedArea = 0;
    for(const b of bands){
      for(const p of (b.placements || [])) placements.push(p);
      for(const id of (b.ids || [])) usedIds.add(id);
      usedArea += b.area || 0;
    }

    const remItems = removeByIds(items, usedIds);
    const residual = consumeBandsRect(rect, axis, bands);
    if(remItems.length && residual.w > 0 && residual.h > 0 && opt.anyItemFits(remItems, residual)){
      const sub = solveRect(remItems, residual, opposite(axis), kerf, options, depth + 1);
      for(const p of (sub.placements || [])) placements.push(p);
      for(const id of (sub.ids || [])) usedIds.add(id);
      usedArea += sub.usedArea || 0;
    }

    return { placements, ids: usedIds, usedArea, primaryBands: bands.length };
  }

  function summarizeSheets(sheets){
    const usedArea = sheets.reduce((sum, s)=> sum + opt.placedArea(s), 0);
    const waste = sheets.reduce((sum, s)=> sum + opt.calcWaste(s).waste, 0);
    const placementCount = sheets.reduce((sum, s)=> sum + ((s.placements || []).filter(p=>p && !p.unplaced).length), 0);
    return { sheets, usedArea, waste, placementCount, primaryBands: 0 };
  }

  function buildSheet(items, boardW, boardH, kerf, options, fixedAxis){
    const rect = { x:0, y:0, w:boardW, h:boardH };
    const result = solveRect(items, rect, fixedAxis, kerf, options, 0);
    const sheet = opt.createSheet(boardW, boardH);
    for(const p of (result.placements || [])) sheet.placements.push(p);
    return {
      sheet,
      usedIds: result.ids,
      usedArea: result.usedArea || 0,
      placementCount: sheet.placements.length,
      waste: opt.boardArea(boardW, boardH) - (result.usedArea || 0),
      primaryBands: result.primaryBands || 0,
    };
  }

  function pickAxis(startStrategy, items, boardW, boardH, kerf, options){
    const previewAxis = (axis)=> buildSheet(items, boardW, boardH, kerf, Object.assign({}, options, { enableRepair:false }), axis);
    return startStrategy && typeof startStrategy.resolvePrimaryAxis === 'function'
      ? startStrategy.resolvePrimaryAxis({ previewAxis })
      : 'along';
  }

  reg['max'] = {
    id: 'max',
    label: 'MAX',
    pack(itemsIn, boardW, boardH, kerf, options){
      const items = opt.cloneItems(itemsIn);
      const sheets = [];
      const startStrategy = options && options.startStrategy;
      const isCancelled = options && options.isCancelled;
      const onProgress = options && options.onProgress;
      let currentSheet = 0;
      while(items.length){
        if(isCancelled && isCancelled()) break;
        const axis = pickAxis(startStrategy, items, boardW, boardH, kerf, Object.assign({}, options, { enableRepair:true }));
        const built = buildSheet(items, boardW, boardH, kerf, Object.assign({}, options, { enableRepair:true }), axis);
        const sheet = built.sheet;
        if(!sheet.placements.length){
          const fallback = opt.packShelf([items[0]], boardW, boardH, kerf, axis)[0];
          if(fallback && fallback.placements && fallback.placements[0]) sheet.placements.push(fallback.placements[0]);
          built.usedIds = new Set(sheet.placements.map(p=>p.id));
          built.usedArea = opt.placedArea(sheet);
        }
        sheets.push(sheet);
        const next = removeByIds(items, built.usedIds || new Set());
        items.length = 0;
        for(const it of next) items.push(it);
        currentSheet += 1;
        if(onProgress) onProgress({ phase:'sheet', currentSheet, remaining: items.length, bestSheets: sheets.length });
        if(!(built.usedIds && built.usedIds.size)) break;
      }
      return summarizeSheets(sheets);
    },
    previewAxis(items, boardW, boardH, kerf, axis){
      return buildSheet(items, boardW, boardH, kerf, { enableRepair:false }, axis);
    }
  };
})(typeof self !== 'undefined' ? self : window);

(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const reg = FC.rozkrojSpeeds = FC.rozkrojSpeeds || {};
  const opt = FC.cutOptimizer;

  function axisThickness(axis, oriented){ return axis === 'along' ? oriented.w : oriented.h; }
  function axisLength(axis, oriented){ return axis === 'along' ? oriented.h : oriented.w; }
  function axisRectThickness(axis, rect){ return axis === 'along' ? rect.w : rect.h; }
  function axisRectLength(axis, rect){ return axis === 'along' ? rect.h : rect.w; }
  function opposite(axis){ return axis === 'along' ? 'across' : 'along'; }
  function countKerf(count, kerf){ return count > 1 ? (count - 1) * kerf : 0; }
  function removeByIds(items, set){ return items.filter(it => !set.has(it.id)); }

  function listSeeds(items, rect, axis){
    const out = [];
    const seen = new Set();
    for(const item of opt.sortByAreaDesc(items)){
      for(const o of opt.orientations(item)){
        const t = axisThickness(axis, o);
        const len = axisLength(axis, o);
        if(t > axisRectThickness(axis, rect) || len > axisRectLength(axis, rect)) continue;
        const key = `${item.id}|${o.rotated}|${t}|${len}`;
        if(seen.has(key)) continue;
        seen.add(key);
        out.push({ item, oriented:o, bandSize:t, seedArea:o.w*o.h });
      }
    }
    return out;
  }

  function buildBand(items, rect, axis, kerf, seed){
    const bandSize = seed.bandSize;
    const cap = axisRectLength(axis, rect);
    const avail = cap - axisLength(axis, seed.oriented);
    if(avail < 0) return null;
    const others = [];
    for(const item of items){
      if(item.id === seed.item.id) continue;
      for(const o of opt.orientations(item)){
        const t = axisThickness(axis, o);
        const len = axisLength(axis, o);
        if(t > bandSize || len > cap) continue;
        const closeness = Math.max(0, 1 - ((bandSize - t) / Math.max(1, bandSize)));
        const score = (o.w * o.h) * 1000 + Math.round(closeness * 10000) + len;
        others.push({ item, oriented:o, len, score });
      }
    }
    const capacity = Math.max(0, avail + kerf);
    const dp = Array(capacity + 1).fill(null);
    dp[0] = { score: 0, pick: [] };
    for(let i=0;i<others.length;i++){
      const cand = others[i];
      const weight = cand.len + kerf;
      for(let c=capacity;c>=weight;c--){
        const prev = dp[c - weight];
        if(!prev) continue;
        const nextScore = prev.score + cand.score;
        if(!dp[c] || nextScore > dp[c].score){
          dp[c] = { score: nextScore, pick: prev.pick.concat(i) };
        }
      }
    }
    let best = { score: -1, pick: [] };
    for(const st of dp){ if(st && st.score > best.score) best = st; }
    const chosen = [{ item: seed.item, oriented: seed.oriented }];
    const usedIds = new Set([seed.item.id]);
    for(const idx of best.pick){
      const cand = others[idx];
      if(usedIds.has(cand.item.id)) continue;
      usedIds.add(cand.item.id);
      chosen.push({ item: cand.item, oriented: cand.oriented });
    }
    const area = chosen.reduce((sum, c)=> sum + c.oriented.w * c.oriented.h, 0);
    const occ = opt.occupancyFrom(area, bandSize * cap);
    const sorted = chosen.slice().sort((a,b)=>{
      const aw = axisThickness(axis, a.oriented);
      const bw = axisThickness(axis, b.oriented);
      if(bw !== aw) return bw - aw;
      const al = axisLength(axis, a.oriented);
      const bl = axisLength(axis, b.oriented);
      return bl - al;
    });
    const placements = [];
    let cursor = 0;
    for(const c of sorted){
      const t = axisThickness(axis, c.oriented);
      const len = axisLength(axis, c.oriented);
      const x = axis === 'along' ? rect.x : rect.x + cursor;
      const y = axis === 'along' ? rect.y + cursor : rect.y;
      placements.push(opt.makePlacement(c.item, x, y, c.oriented));
      cursor += len + kerf;
    }
    return {
      axis,
      bandSize,
      area,
      occupancy: occ,
      accepted: occ >= 0.9,
      placements,
      ids: new Set(sorted.map(c=>c.item.id)),
      count: sorted.length,
    };
  }

  function applyBand(sheet, band){
    for(const p of (band.placements || [])) sheet.placements.push(p);
  }

  function nextRect(rect, axis, totalBands){
    const used = totalBands.reduce((sum, b)=> sum + b.bandSize, 0) + Math.max(0, totalBands.length - 1) * 0;
    if(axis === 'along') return { x: rect.x + used, y: rect.y, w: rect.w - used, h: rect.h };
    return { x: rect.x, y: rect.y + used, w: rect.w, h: rect.h - used };
  }

  function solveRect(items, rect, axis, kerf, depth, maxSeeds){
    if(!items.length || rect.w <= 0 || rect.h <= 0) return { placements: [], ids: new Set(), usedArea: 0, primaryBands: 0 };
    const seeds = listSeeds(items, rect, axis).slice(0, maxSeeds);
    let best = null;
    for(const seed of seeds){
      const b1 = buildBand(items, rect, axis, kerf, seed);
      if(!b1) continue;
      const rem1 = removeByIds(items, b1.ids);
      let bands = [b1];
      if(b1.accepted){
        const r1 = axis === 'along'
          ? { x: rect.x + b1.bandSize, y: rect.y, w: rect.w - b1.bandSize, h: rect.h }
          : { x: rect.x, y: rect.y + b1.bandSize, w: rect.w, h: rect.h - b1.bandSize };
        if(r1.w > 0 && r1.h > 0){
          const seeds2 = listSeeds(rem1, r1, axis).slice(0, Math.max(1, Math.floor(maxSeeds / 2)));
          let best2 = null;
          for(const seed2 of seeds2){
            const b2 = buildBand(rem1, r1, axis, kerf, seed2);
            if(b2 && b2.accepted && opt.compareBand(b2, best2) > 0) best2 = b2;
          }
          if(best2) bands.push(best2);
        }
      }
      const usedIds = new Set();
      let placements = [];
      let usedArea = 0;
      for(const b of bands){
        for(const id of b.ids) usedIds.add(id);
        placements = placements.concat(b.placements);
        usedArea += b.area;
      }
      const rem2 = removeByIds(items, usedIds);
      const residual = axis === 'along'
        ? { x: rect.x + bands.reduce((s,b)=> s + b.bandSize, 0), y: rect.y, w: rect.w - bands.reduce((s,b)=> s + b.bandSize, 0), h: rect.h }
        : { x: rect.x, y: rect.y + bands.reduce((s,b)=> s + b.bandSize, 0), w: rect.w, h: rect.h - bands.reduce((s,b)=> s + b.bandSize, 0) };
      if(rem2.length && residual.w > 0 && residual.h > 0 && opt.anyItemFits(rem2, residual)){
        const sub = solveRect(rem2, residual, opposite(axis), kerf, depth + 1, Math.max(2, Math.floor(maxSeeds / 2)));
        placements = placements.concat(sub.placements);
        usedArea += sub.usedArea;
        for(const id of sub.ids) usedIds.add(id);
      }
      const cand = { placements, ids: usedIds, usedArea, primaryBands: bands.length };
      if(opt.compareSheetScores({ usedArea: cand.usedArea, placementCount: cand.placements.length, waste: opt.boardArea(rect.w, rect.h) - cand.usedArea, primaryBands: cand.primaryBands }, best && { usedArea: best.usedArea, placementCount: best.placements.length, waste: opt.boardArea(rect.w, rect.h) - best.usedArea, primaryBands: best.primaryBands }) > 0){
        best = cand;
      }
    }
    return best || { placements: [], ids: new Set(), usedArea: 0, primaryBands: 0 };
  }

  function pack(itemsIn, boardW, boardH, kerf, options, maxSeeds){
    const startStrategy = options && options.startStrategy;
    const remaining = opt.cloneItems(itemsIn);
    const sheets = [];
    const isCancelled = options && options.isCancelled;
    const onProgress = options && options.onProgress;
    let sheetNo = 0;
    while(remaining.length){
      if(isCancelled && isCancelled()) break;
      const rect = { x:0, y:0, w:boardW, h:boardH };
      const fixedAxis = startStrategy && typeof startStrategy.resolvePrimaryAxis === 'function'
        ? startStrategy.resolvePrimaryAxis({ previewAxis:(axis)=> solveRect(remaining, rect, axis, kerf, 0, maxSeeds) })
        : 'along';
      const result = solveRect(remaining, rect, fixedAxis, kerf, 0, maxSeeds);
      const sheet = opt.createSheet(boardW, boardH);
      for(const p of (result.placements || [])) sheet.placements.push(p);
      if(!sheet.placements.length){
        const fallback = opt.packShelf([remaining[0]], boardW, boardH, kerf, fixedAxis)[0];
        if(fallback && fallback.placements && fallback.placements[0]) sheet.placements.push(fallback.placements[0]);
      }
      sheets.push(sheet);
      const usedIds = new Set((sheet.placements || []).map(p=>p.id));
      const next = removeByIds(remaining, usedIds);
      remaining.length = 0;
      for(const it of next) remaining.push(it);
      sheetNo += 1;
      if(onProgress) onProgress({ phase:'sheet', currentSheet: sheetNo, remaining: remaining.length, bestSheets: sheets.length });
      if(usedIds.size === 0) break;
    }
    const usedArea = sheets.reduce((sum, s)=> sum + opt.placedArea(s), 0);
    const waste = sheets.reduce((sum, s)=> sum + opt.calcWaste(s).waste, 0);
    const placementCount = sheets.reduce((sum, s)=> sum + (s.placements || []).length, 0);
    return { sheets, usedArea, waste, placementCount, primaryBands: 0 };
  }

  reg['dokladnie'] = {
    id: 'dokladnie',
    label: 'Dokładnie',
    pack(items, boardW, boardH, kerf, options){
      return pack(items, boardW, boardH, kerf, options || {}, 8);
    },
    previewAxis(items, boardW, boardH, kerf, axis){
      const strategy = { resolvePrimaryAxis(){ return axis; } };
      return pack(items, boardW, boardH, kerf, { startStrategy: strategy }, 4);
    }
  };
})(typeof self !== 'undefined' ? self : window);

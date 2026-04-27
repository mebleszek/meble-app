(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const opt = FC.cutOptimizer;
  const C = FC.speedMaxCore || {};
  const SIMILAR_MM = C.SIMILAR_MM;
  const IDEAL_OCCUPANCY = C.IDEAL_OCCUPANCY;
  const MIN_OK_OCCUPANCY = C.MIN_OK_OCCUPANCY;
  const MAX_TOP_SEEDS = C.MAX_TOP_SEEDS;
  const TINY_RATIO = C.TINY_RATIO;
  const LENGTHWISE_AXIS = C.LENGTHWISE_AXIS;
  const axisThickness = C.axisThickness;
  const axisLength = C.axisLength;
  const rectThickness = C.rectThickness;
  const rectLength = C.rectLength;
  const opposite = C.opposite;
  const emitStage = C.emitStage;
  const compareBands = C.compareBands;

  function scoreSeed(seed){
    if(!seed) return -Infinity;
    return (seed.area || 0) * 1000 + (seed.bandSize || 0);
  }

  function collectSeedOptions(items, rect, axis){
    const sorted = opt.sortByAreaDesc(items);
    const out = [];
    const seen = new Set();
    for(const item of sorted){
      const ors = opt.orientations(item).filter((o)=>{
        return axisThickness(axis, o) <= rectThickness(axis, rect) && axisLength(axis, o) <= rectLength(axis, rect);
      });
      ors.sort((a, b) => ((b.w * b.h) - (a.w * a.h)) || (axisThickness(axis, b) - axisThickness(axis, a)) || (axisLength(axis, b) - axisLength(axis, a)));
      for(const oriented of ors){
        const sig = `${oriented.w}x${oriented.h}`;
        if(seen.has(sig)) continue;
        seen.add(sig);
        out.push({
          item,
          oriented,
          bandSize: axisThickness(axis, oriented),
          area: oriented.w * oriented.h,
          signature: sig,
        });
      }
    }
    out.sort((a, b) => scoreSeed(b) - scoreSeed(a));
    return out;
  }

  function chooseBestOrientationForBand(item, axis, bandSize, capacity){
    let best = null;
    for(const oriented of opt.orientations(item)){
      const thickness = axisThickness(axis, oriented);
      const len = axisLength(axis, oriented);
      const diff = bandSize - thickness;
      if(diff < 0 || diff > SIMILAR_MM) continue;
      if(len > capacity) continue;
      const closeness = Math.max(0, 1 - (diff / Math.max(1, SIMILAR_MM)));
      const area = oriented.w * oriented.h;
      const score = area * 1000 + (diff === 0 ? 100000 : 0) + Math.round(closeness * 60000) + len;
      const cand = { item, oriented, thickness, len, area, diff, closeness, score };
      if(!best || cand.score > best.score) best = cand;
    }
    return best;
  }

  function makeEntryFromParts(parts, kerf, bandSize){
    if(!parts || !parts.length) return null;
    const ids = parts.map(p => p.item.id);
    const count = parts.length;
    const len = parts.reduce((sum, p) => sum + (p.len || 0), 0) + Math.max(0, count - 1) * kerf;
    const area = parts.reduce((sum, p) => sum + (p.area || 0), 0);
    const avgCloseness = parts.reduce((sum, p) => sum + (p.closeness || 0), 0) / Math.max(1, count);
    const exactMatches = parts.reduce((sum, p) => sum + (p.diff === 0 ? 1 : 0), 0);
    return {
      ids,
      parts,
      len,
      area,
      bandSize,
      isBlock: count > 1,
      value: area * 1000
        + exactMatches * 100000
        + Math.round(avgCloseness * 60000)
        + Math.max.apply(null, parts.map(p => p.len || 0))
        + (count > 1 ? (25000 + count * 5000) : 0),
    };
  }

  function buildCandidateEntries(items, rect, axis, kerf, seed){
    const capacity = rectLength(axis, rect);
    const bandSize = seed.bandSize;
    const seedArea = seed.area;
    const grouped = new Map();
    const singles = [];

    for(const item of items){
      if(item.id === seed.item.id) continue;
      const chosen = chooseBestOrientationForBand(item, axis, bandSize, capacity);
      if(!chosen) continue;
      const sig = `${chosen.oriented.w}x${chosen.oriented.h}`;
      if(!grouped.has(sig)) grouped.set(sig, []);
      grouped.get(sig).push(chosen);
    }

    const entries = [];
    grouped.forEach((group)=>{
      group.sort((a, b) => String(a.item.id).localeCompare(String(b.item.id), 'pl'));
      const tiny = !!group[0] && (group[0].area <= seedArea * TINY_RATIO);
      const blockFits = !!group[0] && ((group[0].len * 2) + kerf <= capacity);
      if(tiny && group.length >= 2 && blockFits){
        const copy = group.slice();
        while(copy.length >= 2){
          const parts = [copy.shift(), copy.shift()];
          const entry = makeEntryFromParts(parts, kerf, bandSize);
          if(entry) entries.push(entry);
        }
        while(copy.length) singles.push(copy.shift());
      }else{
        for(const part of group) singles.push(part);
      }
    });

    for(const part of singles){
      const entry = makeEntryFromParts([part], kerf, bandSize);
      if(entry) entries.push(entry);
    }

    entries.sort((a, b) => {
      if((b.area || 0) !== (a.area || 0)) return (b.area || 0) - (a.area || 0);
      if(!!b.isBlock !== !!a.isBlock) return b.isBlock ? 1 : -1;
      if((b.len || 0) !== (a.len || 0)) return (b.len || 0) - (a.len || 0);
      return String((a.ids && a.ids[0]) || '').localeCompare(String((b.ids && b.ids[0]) || ''), 'pl');
    });
    return entries;
  }

  function finalizeBand(entries, rect, axis, kerf, seed, bandSize, targetOccupancy){
    const cap = rectLength(axis, rect);
    const area = entries.reduce((sum, e) => sum + (e.area || 0), 0);
    const orderedEntries = entries.slice().sort((a, b) => {
      if((b.area || 0) !== (a.area || 0)) return (b.area || 0) - (a.area || 0);
      if(!!b.isBlock !== !!a.isBlock) return b.isBlock ? 1 : -1;
      if((b.len || 0) !== (a.len || 0)) return (b.len || 0) - (a.len || 0);
      return String((a.ids && a.ids[0]) || '').localeCompare(String((b.ids && b.ids[0]) || ''), 'pl');
    });
    const placements = [];
    const ids = new Set();
    const partsFlat = [];
    let cursor = 0;
    for(const entry of orderedEntries){
      for(const part of (entry.parts || [])){
        const x = axis === 'along' ? rect.x : rect.x + cursor;
        const y = axis === 'along' ? rect.y + cursor : rect.y;
        placements.push(opt.makePlacement(part.item, x, y, part.oriented));
        ids.add(part.item.id);
        partsFlat.push(part);
        cursor += (part.len || 0) + kerf;
      }
    }
    const occupancy = opt.occupancyFrom(area, Math.max(1, bandSize * cap));
    return {
      axis,
      seedId: seed.item.id,
      bandSize,
      area,
      occupancy,
      accepted: occupancy >= IDEAL_OCCUPANCY,
      targetMet: occupancy >= targetOccupancy,
      placements,
      ids,
      count: partsFlat.length,
      firstArea: seed.area,
      targetOccupancy,
      parts: partsFlat,
    };
  }

  function buildDpBand(items, rect, axis, kerf, seed, targetOccupancy, options){
    const bandSize = seed.bandSize;
    const capacity = rectLength(axis, rect);
    const seedLen = axisLength(axis, seed.oriented);
    if(seedLen > capacity) return null;
    const seedArea = seed.oriented.w * seed.oriented.h;
    const seedPart = {
      item: seed.item,
      oriented: seed.oriented,
      thickness: bandSize,
      len: seedLen,
      area: seedArea,
      diff: 0,
      closeness: 1,
      score: seedArea * 1000 + 100000 + seedLen,
    };
    const seedEntry = makeEntryFromParts([seedPart], kerf, bandSize);
    const candidates = buildCandidateEntries(items, rect, axis, kerf, seed);

    const maxCap = Math.max(0, capacity - seedLen - kerf);
    const dp = Array(maxCap + 1).fill(null);
    dp[0] = { value: 0, picks: [] };
    for(let i = 0; i < candidates.length; i++){
      if(options && options.isCancelled && options.isCancelled()) return null;
      const cand = candidates[i];
      const weight = cand.len + kerf;
      if(weight > maxCap) continue;
      for(let c = maxCap; c >= weight; c--){
        const prev = dp[c - weight];
        if(!prev) continue;
        const nextValue = prev.value + cand.value;
        if(!dp[c] || nextValue > dp[c].value){
          dp[c] = { value: nextValue, picks: prev.picks.concat(i) };
        }
      }
    }

    let bestState = { value: -Infinity, picks: [] };
    for(const st of dp){ if(st && st.value > bestState.value) bestState = st; }

    const chosenEntries = [seedEntry];
    for(const idx of bestState.picks){
      const cand = candidates[idx];
      if(cand) chosenEntries.push(cand);
    }

    const base = finalizeBand(chosenEntries, rect, axis, kerf, seed, bandSize, targetOccupancy);
    if(base.occupancy >= IDEAL_OCCUPANCY || (options && options.enableRepair === false)) return base;
    return repairBand(items, rect, axis, kerf, seed, targetOccupancy, base, options) || base;
  }

  function repairBand(items, rect, axis, kerf, seed, targetOccupancy, band, options){
    if(!band || band.occupancy >= IDEAL_OCCUPANCY) return band;
    const firstArea = Math.max(1, band.firstArea || seed.area || 1);
    const tinyIds = new Set();
    for(const part of (band.parts || [])){
      const ar = Number(part.area) || ((Number(part.item && part.item.w) || 0) * (Number(part.item && part.item.h) || 0));
      if(part.item && part.item.id !== seed.item.id && ar <= firstArea * TINY_RATIO) tinyIds.add(part.item.id);
    }
    if(!tinyIds.size) return band;
    const filtered = items.filter(it => !tinyIds.has(it.id) || it.id === seed.item.id);
    const retry = buildDpBand(filtered, rect, axis, kerf, seed, targetOccupancy, Object.assign({}, options, { enableRepair:false }));
    if(retry && compareBands(retry, band) > 0) return retry;
    return band;
  }

  function buildBestBandForSeeds(items, rect, axis, kerf, targetOccupancy, options, phase){
    const seeds = collectSeedOptions(items, rect, axis);
    if(!seeds.length) return null;
    const seedLimit = Math.min(seeds.length, MAX_TOP_SEEDS);
    for(let i = 0; i < seedLimit; i++){
      if(options && options.isCancelled && options.isCancelled()) return null;
      const seed = seeds[i];
      emitStage(options, {
        phase: phase || 'band-search',
        axis,
        seedIndex: i + 1,
        seedTotal: seedLimit,
        occupancyTarget: targetOccupancy,
        seed: seed.signature,
      });
      const band = buildDpBand(items, rect, axis, kerf, seed, targetOccupancy, options);
      if(!band) continue;
      if(targetOccupancy > 0){
        if(band.targetMet) return band;
        continue;
      }
      return band;
    }
    return null;
  }

  function buildBestBandAtTarget(items, rect, axis, kerf, targetOccupancy, options, phase){
    return buildBestBandForSeeds(items, rect, axis, kerf, targetOccupancy, options, phase);
  }

  function chooseFallbackOrientation(item, axis, bandSize, capacity){
    let best = null;
    for(const oriented of opt.orientations(item)){
      const thickness = axisThickness(axis, oriented);
      const len = axisLength(axis, oriented);
      if(thickness > bandSize) continue;
      if(len > capacity) continue;
      const area = oriented.w * oriented.h;
      const score = thickness * 1000000 + area * 1000 + len;
      const cand = { item, oriented, thickness, len, area, diff: Math.max(0, bandSize - thickness), closeness: bandSize > 0 ? (thickness / bandSize) : 0, score };
      if(!best || cand.score > best.score) best = cand;
    }
    return best;
  }

  function buildGreedyFallbackBand(items, rect, axis, kerf, seed){
    const bandSize = seed.bandSize;
    const capacity = rectLength(axis, rect);
    const seedLen = axisLength(axis, seed.oriented);
    if(seedLen > capacity) return null;
    const seedArea = seed.oriented.w * seed.oriented.h;
    const seedPart = {
      item: seed.item,
      oriented: seed.oriented,
      thickness: bandSize,
      len: seedLen,
      area: seedArea,
      diff: 0,
      closeness: 1,
      score: bandSize * 1000000 + seedArea * 1000 + seedLen,
    };

    const parts = [seedPart];
    const usedIds = new Set([seed.item.id]);
    let cursor = seedLen;

    const candidates = [];
    for(const item of items){
      if(usedIds.has(item.id)) continue;
      const chosen = chooseFallbackOrientation(item, axis, bandSize, capacity);
      if(!chosen) continue;
      candidates.push(chosen);
    }
    candidates.sort((a, b) => {
      if((b.thickness || 0) !== (a.thickness || 0)) return (b.thickness || 0) - (a.thickness || 0);
      if((b.area || 0) !== (a.area || 0)) return (b.area || 0) - (a.area || 0);
      if((b.len || 0) !== (a.len || 0)) return (b.len || 0) - (a.len || 0);
      return String(b.item.id || '').localeCompare(String(a.item.id || ''), 'pl');
    });

    for(const cand of candidates){
      const need = (parts.length ? kerf : 0) + (cand.len || 0);
      if(cursor + need > capacity) continue;
      parts.push(cand);
      usedIds.add(cand.item.id);
      cursor += need;
    }

    const entries = parts.map((part)=> makeEntryFromParts([part], kerf, bandSize)).filter(Boolean);
    return finalizeBand(entries, rect, axis, kerf, seed, bandSize, 0);
  }

  function buildFallbackForAxis(items, rect, axis, kerf, options, phase){
    const seeds = collectSeedOptions(items, rect, axis);
    if(!seeds.length) return null;
    const seedLimit = Math.min(seeds.length, MAX_TOP_SEEDS);
    for(let i = 0; i < seedLimit; i++){
      if(options && options.isCancelled && options.isCancelled()) return null;
      const seed = seeds[i];
      emitStage(options, {
        phase: phase || 'fallback-search',
        axis,
        seedIndex: i + 1,
        seedTotal: seedLimit,
        occupancyTarget: 0,
        seed: seed.signature,
      });
      const band = buildGreedyFallbackBand(items, rect, axis, kerf, seed);
      if(band) return band;
    }
    return null;
  }

  function buildBestFallbackBand(items, rect, axis, kerf, options, phase){
    const axes = [];
    const pushAxis = (ax)=>{ if(ax && !axes.includes(ax)) axes.push(ax); };
    pushAxis(LENGTHWISE_AXIS);
    pushAxis(axis);
    pushAxis(opposite(axis));
    let best = null;
    for(const ax of axes){
      const band = buildFallbackForAxis(items, rect, ax, kerf, options, phase ? `${phase}-${ax}` : phase);
      if(compareBands(band, best) > 0) best = band;
      if(best && ax === LENGTHWISE_AXIS) return best;
    }
    return best;
  }

  FC.speedMaxBands = {
    collectSeedOptions,
    buildBestBandAtTarget,
    buildBestFallbackBand,
    buildBestBandForSeeds,
  };
})(typeof self !== 'undefined' ? self : window);

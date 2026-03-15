(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const reg = FC.rozkrojSpeeds = FC.rozkrojSpeeds || {};
  const opt = FC.cutOptimizer;

  const SIMILAR_MM = 75;
  const IDEAL_OCCUPANCY = 0.9;
  const MIN_OK_OCCUPANCY = 0.85;
  const MAX_TOP_SEEDS = 5;
  const TINY_RATIO = 0.5;
  // Uwaga: w obecnym mapowaniu osi fizyczny kierunek 'po długości płyty'
  // odpowiada wewnętrznej osi 'across'. Nie zmieniać bez korekty trybów startu.
  const LENGTHWISE_AXIS = 'across';

  function axisThickness(axis, oriented){ return axis === 'along' ? oriented.w : oriented.h; }
  function axisLength(axis, oriented){ return axis === 'along' ? oriented.h : oriented.w; }
  function rectThickness(axis, rect){ return axis === 'along' ? rect.w : rect.h; }
  function rectLength(axis, rect){ return axis === 'along' ? rect.h : rect.w; }
  function opposite(axis){ return axis === 'along' ? 'across' : 'along'; }
  function removeByIds(items, set){ return items.filter(it => !set.has(it.id)); }
  function emitStage(options, payload){ try{ options && typeof options.reportStage === 'function' && options.reportStage(payload || {}); }catch(_){ } }

  function compareBands(a, b){
    if(!b) return 1;
    if(!a) return -1;
    if(!!a.targetMet !== !!b.targetMet) return a.targetMet ? 1 : -1;
    if(!!a.accepted !== !!b.accepted) return a.accepted ? 1 : -1;
    if((a.occupancy || 0) !== (b.occupancy || 0)) return (a.occupancy || 0) > (b.occupancy || 0) ? 1 : -1;
    if((a.area || 0) !== (b.area || 0)) return (a.area || 0) > (b.area || 0) ? 1 : -1;
    if((a.count || 0) !== (b.count || 0)) return (a.count || 0) > (b.count || 0) ? 1 : -1;
    if((a.bandSize || 0) !== (b.bandSize || 0)) return (a.bandSize || 0) > (b.bandSize || 0) ? 1 : -1;
    return 0;
  }

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

  function consumeBandsRect(rect, axis, bands){
    const total = bands.reduce((sum, b) => sum + (b.bandSize || 0), 0);
    if(axis === 'along') return { x: rect.x + total, y: rect.y, w: rect.w - total, h: rect.h };
    return { x: rect.x, y: rect.y + total, w: rect.w, h: rect.h - total };
  }

  function createState(items, boardW, boardH){
    return {
      items: opt.cloneItems(items),
      rect: { x:0, y:0, w:boardW, h:boardH },
      placements: [],
      usedIds: new Set(),
      usedArea: 0,
      primaryBands: 0,
      strongStartBands: 0,
      startArea: 0,
      startOccupancySum: 0,
      firstBandSize: 0,
      secondBandSize: 0,
      totalBands: 0,
      axisSwitches: 0,
    };
  }

  function canContinue(state){
    return !!(state && state.items && state.items.length && state.rect && state.rect.w > 0 && state.rect.h > 0 && opt.anyItemFits(state.items, state.rect));
  }

  function applyBand(state, band, isStartBand){
    if(!state || !band) return false;
    for(const p of (band.placements || [])) state.placements.push(p);
    for(const id of (band.ids || [])) state.usedIds.add(id);
    state.usedArea += band.area || 0;
    state.items = removeByIds(state.items, band.ids || new Set());
    state.rect = consumeBandsRect(state.rect, band.axis, [band]);
    state.totalBands += 1;
    if(isStartBand){
      state.primaryBands += 1;
      state.startArea += band.area || 0;
      state.startOccupancySum += band.occupancy || 0;
      if((band.occupancy || 0) >= IDEAL_OCCUPANCY) state.strongStartBands += 1;
      if(state.primaryBands === 1) state.firstBandSize = band.bandSize || 0;
      else if(state.primaryBands === 2) state.secondBandSize = band.bandSize || 0;
    }
    return true;
  }

  function tryTargetBand(state, axis, kerf, targetOccupancy, options, phase, isStartBand){
    if(!canContinue(state)) return null;
    const band = buildBestBandAtTarget(state.items, state.rect, axis, kerf, targetOccupancy, options, phase);
    if(!band) return null;
    applyBand(state, band, !!isStartBand);
    emitStage(options, { phase: `${phase || 'band'}-done`, axis, occupancy: band.occupancy || 0, occupancyTarget: targetOccupancy, bandNo: state.totalBands, totalBands: state.totalBands });
    return band;
  }

  function tryFallbackBand(state, axis, kerf, options, phase, isStartBand){
    if(!canContinue(state)) return null;
    const band = buildBestFallbackBand(state.items, state.rect, axis, kerf, options, phase);
    if(!band) return null;
    applyBand(state, band, !!isStartBand);
    emitStage(options, { phase: `${phase || 'fallback'}-done`, axis, occupancy: band.occupancy || 0, occupancyTarget: 0, bandNo: state.totalBands, totalBands: state.totalBands });
    return band;
  }

  function fillResidual(state, axis, kerf, options){
    let currentAxis = axis;
    let guard = 0;
    const maxGuard = Math.max(32, ((state && state.items && state.items.length) || 0) * 6 + 16);
    while(canContinue(state) && guard < maxGuard){
      if(options && options.isCancelled && options.isCancelled()) break;
      guard += 1;

      emitStage(options, { phase:'residual-90-pick', axis: currentAxis, totalBands: state.totalBands });
      const ideal90 = tryTargetBand(state, currentAxis, kerf, IDEAL_OCCUPANCY, options, 'residual-90', false);
      if(ideal90) continue;

      emitStage(options, { phase:'residual-85-pick', axis: currentAxis, totalBands: state.totalBands });
      const okay85 = tryTargetBand(state, currentAxis, kerf, MIN_OK_OCCUPANCY, options, 'residual-85', false);
      if(okay85) continue;

      const otherAxis = opposite(currentAxis);
      emitStage(options, { phase:'axis-switch-check', from: currentAxis, to: otherAxis, totalBands: state.totalBands });

      const other90 = buildBestBandAtTarget(state.items, state.rect, otherAxis, kerf, IDEAL_OCCUPANCY, options, 'residual-switch-90');
      if(other90){
        state.axisSwitches += 1;
        currentAxis = otherAxis;
        applyBand(state, other90, false);
        emitStage(options, { phase:'axis-switched', axis: currentAxis, occupancy: other90.occupancy || 0, totalBands: state.totalBands });
        continue;
      }

      const other85 = buildBestBandAtTarget(state.items, state.rect, otherAxis, kerf, MIN_OK_OCCUPANCY, options, 'residual-switch-85');
      if(other85){
        state.axisSwitches += 1;
        currentAxis = otherAxis;
        applyBand(state, other85, false);
        emitStage(options, { phase:'axis-switched', axis: currentAxis, occupancy: other85.occupancy || 0, totalBands: state.totalBands });
        continue;
      }

      const fallback = buildBestFallbackBand(state.items, state.rect, currentAxis, kerf, options, 'fallback');
      if(!fallback) break;
      if(fallback.axis !== currentAxis) state.axisSwitches += 1;
      currentAxis = fallback.axis || currentAxis;
      applyBand(state, fallback, false);
      emitStage(options, { phase:'fallback-band-used', axis: currentAxis, occupancy: fallback.occupancy || 0, totalBands: state.totalBands });
    }
    return state;
  }

  function summarizeState(state){
    return {
      placements: state.placements,
      ids: state.usedIds,
      usedArea: state.usedArea || 0,
      primaryBands: state.primaryBands || 0,
      strongStartBands: state.strongStartBands || 0,
      startArea: state.startArea || 0,
      startOccupancySum: state.startOccupancySum || 0,
      firstBandSize: state.firstBandSize || 0,
      secondBandSize: state.secondBandSize || 0,
      totalBands: state.totalBands || 0,
      axisSwitches: state.axisSwitches || 0,
      placementsCount: (state.placements || []).length,
    };
  }

  function comparePlan(a, b, boardW, boardH){
    if(!b) return 1;
    if(!a) return -1;
    const sa = {
      usedArea: a.usedArea || 0,
      placementCount: (a.placements || []).length,
      waste: opt.boardArea(boardW, boardH) - (a.usedArea || 0),
      primaryBands: a.strongStartBands || a.primaryBands || 0,
    };
    const sb = {
      usedArea: b.usedArea || 0,
      placementCount: (b.placements || []).length,
      waste: opt.boardArea(boardW, boardH) - (b.usedArea || 0),
      primaryBands: b.strongStartBands || b.primaryBands || 0,
    };
    const base = opt.compareSheetScores(sa, sb);
    if(base !== 0) return base;
    if((a.startArea || 0) !== (b.startArea || 0)) return (a.startArea || 0) > (b.startArea || 0) ? 1 : -1;
    if((a.startOccupancySum || 0) !== (b.startOccupancySum || 0)) return (a.startOccupancySum || 0) > (b.startOccupancySum || 0) ? 1 : -1;
    if((a.totalBands || 0) !== (b.totalBands || 0)) return (a.totalBands || 0) > (b.totalBands || 0) ? 1 : -1;
    if((a.firstBandSize || 0) !== (b.firstBandSize || 0)) return (a.firstBandSize || 0) > (b.firstBandSize || 0) ? 1 : -1;
    if((a.secondBandSize || 0) !== (b.secondBandSize || 0)) return (a.secondBandSize || 0) > (b.secondBandSize || 0) ? 1 : -1;
    return 0;
  }

  function buildSingleVariant(items, boardW, boardH, kerf, options, startAxis){
    const state = createState(items, boardW, boardH);
    emitStage(options, { phase:'start-axis', axis:startAxis });

    emitStage(options, { phase:'start-pass-1-pick', axis:startAxis, totalBands: state.totalBands });
    let firstBand = tryTargetBand(state, startAxis, kerf, IDEAL_OCCUPANCY, options, 'start-pass-1', true);
    if(!firstBand) firstBand = tryTargetBand(state, startAxis, kerf, MIN_OK_OCCUPANCY, options, 'start-pass-1-85', true);
    if(!firstBand) firstBand = tryFallbackBand(state, startAxis, kerf, options, 'start-pass-1-fallback', true);

    if(firstBand && canContinue(state)){
      emitStage(options, { phase:'start-pass-2-pick', axis:startAxis, totalBands: state.totalBands });
      let secondBand = tryTargetBand(state, startAxis, kerf, IDEAL_OCCUPANCY, options, 'start-pass-2', true);
      if(!secondBand) secondBand = tryTargetBand(state, startAxis, kerf, MIN_OK_OCCUPANCY, options, 'start-pass-2-85', true);
      if(!secondBand) tryFallbackBand(state, startAxis, kerf, options, 'start-pass-2-fallback', true);
    }

    if(canContinue(state)){
      state.axisSwitches += 1;
      emitStage(options, { phase:'mandatory-axis-switch', from:startAxis, to:opposite(startAxis), totalBands: state.totalBands });
      fillResidual(state, opposite(startAxis), kerf, options);
    }

    return summarizeState(state);
  }

  function buildSheetPlan(items, boardW, boardH, kerf, options, fixedAxis){
    if(fixedAxis === 'along' || fixedAxis === 'across') return buildSingleVariant(items, boardW, boardH, kerf, options, fixedAxis);
    emitStage(options, { phase:'compare-variants', axis:'along' });
    const along = buildSingleVariant(items, boardW, boardH, kerf, options, 'along');
    emitStage(options, { phase:'compare-variants', axis:'across' });
    const across = buildSingleVariant(items, boardW, boardH, kerf, options, 'across');
    return comparePlan(along, across, boardW, boardH) >= 0 ? along : across;
  }

  function buildSheet(items, boardW, boardH, kerf, options, fixedAxis){
    const result = buildSheetPlan(items, boardW, boardH, kerf, options, fixedAxis);
    const sheet = opt.createSheet(boardW, boardH);
    for(const p of (result.placements || [])) sheet.placements.push(p);
    return {
      sheet,
      usedIds: result.ids,
      usedArea: result.usedArea || 0,
      placementCount: sheet.placements.length,
      waste: opt.boardArea(boardW, boardH) - (result.usedArea || 0),
      primaryBands: result.primaryBands || 0,
      strongStartBands: result.strongStartBands || 0,
      startArea: result.startArea || 0,
      startOccupancySum: result.startOccupancySum || 0,
      firstBandSize: result.firstBandSize || 0,
      secondBandSize: result.secondBandSize || 0,
      totalBands: result.totalBands || 0,
      axisSwitches: result.axisSwitches || 0,
    };
  }

  function getVirtualHalfDims(boardW, boardH){
    if(boardW >= boardH){
      return { w: boardW, h: Math.max(1, Math.floor(boardH / 2)) };
    }
    return { w: Math.max(1, Math.floor(boardW / 2)), h: boardH };
  }

  function maybeApplyVirtualHalf(lastItems, boardW, boardH, kerf, options, built){
    if(!built || !built.sheet || !Array.isArray(lastItems) || !lastItems.length) return;
    const half = getVirtualHalfDims(boardW, boardH);
    const preview = buildSheetPlan(opt.cloneItems(lastItems), half.w, half.h, kerf, Object.assign({}, options, { reportStage:null, onProgress:null }), undefined);
    if(preview && preview.ids && preview.ids.size === lastItems.length){
      built.sheet.virtualFraction = 0.5;
      built.sheet.virtualHalf = true;
      built.sheet.virtualBoardW = half.w;
      built.sheet.virtualBoardH = half.h;
    }
  }

  function pickAxis(startStrategy, items, boardW, boardH, kerf, options){
    const previewAxis = (axis) => buildSheet(items, boardW, boardH, kerf, Object.assign({}, options, { reportStage:null }), axis);
    return startStrategy && typeof startStrategy.resolvePrimaryAxis === 'function'
      ? startStrategy.resolvePrimaryAxis({ previewAxis })
      : 'along';
  }

  function summarizeSheets(sheets){
    const usedArea = sheets.reduce((sum, s) => sum + opt.placedArea(s), 0);
    const waste = sheets.reduce((sum, s) => sum + opt.calcWaste(s).waste, 0);
    const placementCount = sheets.reduce((sum, s) => sum + ((s.placements || []).filter(p => p && !p.unplaced).length), 0);
    return { sheets, usedArea, waste, placementCount, primaryBands: 0 };
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
        const axis = pickAxis(startStrategy, items, boardW, boardH, kerf, Object.assign({}, options));
        if(onProgress) onProgress({ phase:'sheet-start', currentSheet, nextSheet: currentSheet + 1, remaining: items.length, bestSheets: sheets.length, axis });
        const built = buildSheet(items, boardW, boardH, kerf, Object.assign({}, options, {
          reportStage: (info)=>{
            if(onProgress) onProgress(Object.assign({
              currentSheet,
              nextSheet: currentSheet + 1,
              remaining: items.length,
              bestSheets: sheets.length,
              axis,
            }, info || {}));
          }
        }), axis);

        const sheet = built.sheet;
        if(!sheet.placements.length){
          const fallback = opt.packShelf([items[0]], boardW, boardH, kerf, axis)[0];
          if(fallback && fallback.placements && fallback.placements[0]) sheet.placements.push(fallback.placements[0]);
          built.usedIds = new Set(sheet.placements.map(p => p.id));
          built.usedArea = opt.placedArea(sheet);
        }

        const next = removeByIds(items, built.usedIds || new Set());
        if(next.length === 0 && built.usedIds && built.usedIds.size === items.length){
          maybeApplyVirtualHalf(items, boardW, boardH, kerf, options, built);
        }
        sheets.push(sheet);
        items.length = 0;
        for(const it of next) items.push(it);
        currentSheet += 1;
        if(onProgress) onProgress({
          phase:'sheet-closed',
          currentSheet,
          nextSheet: items.length ? (currentSheet + 1) : currentSheet,
          remaining: items.length,
          bestSheets: sheets.length,
          axis,
        });
        if(!(built.usedIds && built.usedIds.size)) break;
      }
      return summarizeSheets(sheets);
    },
    previewAxis(items, boardW, boardH, kerf, axis){
      return buildSheet(items, boardW, boardH, kerf, {}, axis);
    }
  };
})(typeof self !== 'undefined' ? self : window);

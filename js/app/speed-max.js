(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const reg = FC.rozkrojSpeeds = FC.rozkrojSpeeds || {};
  const opt = FC.cutOptimizer;

  const SIMILAR_MM = 75;
  const IDEAL_OCCUPANCY = 0.9;

  function axisThickness(axis, oriented){ return axis === 'along' ? oriented.w : oriented.h; }
  function axisLength(axis, oriented){ return axis === 'along' ? oriented.h : oriented.w; }
  function rectThickness(axis, rect){ return axis === 'along' ? rect.w : rect.h; }
  function rectLength(axis, rect){ return axis === 'along' ? rect.h : rect.w; }
  function opposite(axis){ return axis === 'along' ? 'across' : 'along'; }
  function removeByIds(items, set){ return items.filter(it => !set.has(it.id)); }
  function emitStage(options, payload){ try{ options && typeof options.reportStage === 'function' && options.reportStage(payload || {}); }catch(_){ } }

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
        out.push({ item, oriented:o, bandSize:t, length:len, area:o.w * o.h });
      }
    }
    return out;
  }

  function bandSignature(band){
    if(!band) return '';
    const parts = (band.placements || []).map(p => `${p.id}:${p.rotated ? 1 : 0}:${p.w}x${p.h}`).sort();
    return `${band.axis}|${band.bandSize}|${parts.join('|')}`;
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
        candidates.push({ item, oriented:o, len, thickness:t, area:o.w * o.h, value, similar });
      }
    }

    const maxCap = Math.max(0, capacity - seedLen + kerf);
    const dp = Array(maxCap + 1).fill(null);
    dp[0] = { value: 0, picks: [] };
    for(let i = 0; i < candidates.length; i++){
      const cand = candidates[i];
      const weight = cand.len + kerf;
      for(let c = maxCap; c >= weight; c--){
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
    const area = chosen.reduce((sum, c) => sum + c.area, 0);
    const sorted = chosen.slice().sort((a, b) => {
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
      accepted: occupancy >= IDEAL_OCCUPANCY,
      placements,
      ids: new Set(sorted.map(c => c.item.id)),
      count: sorted.length,
      firstArea: seed.area,
    };
  }

  function repairBand(items, rect, axis, kerf, seed, band){
    if(!band || band.occupancy >= 0.8) return band;
    const firstArea = Math.max(1, band.firstArea || seed.area || 1);
    const chosenItems = (band.placements || []).map(p => items.find(it => it.id === p.id)).filter(Boolean);
    const tinyIds = new Set();
    for(const it of chosenItems){
      const ar = (Number(it.w) || 0) * (Number(it.h) || 0);
      if(ar <= firstArea * 0.5 && it.id !== seed.item.id) tinyIds.add(it.id);
    }
    if(!tinyIds.size) return band;
    const filtered = items.filter(it => !tinyIds.has(it.id) || it.id === seed.item.id);
    const retry = buildDpBand(filtered, rect, axis, kerf, seed, { enableRepair:false });
    if(retry && retry.occupancy > band.occupancy) return retry;
    return band;
  }

  function buildBandCandidates(items, rect, axis, kerf, options, acceptedOnly, phase){
    const seeds = listSeedVariants(items, rect, axis);
    const bySignature = new Map();
    const reportEvery = Math.max(8, Math.min(24, Math.round(seeds.length / 12) || 8));
    for(let idx = 0; idx < seeds.length; idx++){
      if(options.isCancelled && options.isCancelled()) break;
      const seed = seeds[idx];
      if(idx === 0 || idx === seeds.length - 1 || ((idx + 1) % reportEvery) === 0){
        emitStage(options, { phase: phase || 'band-search', axis, seedIndex: idx + 1, seedTotal: seeds.length });
      }
      const band = buildDpBand(items, rect, axis, kerf, seed, options);
      if(!band) continue;
      if(acceptedOnly && !band.accepted) continue;
      const sig = bandSignature(band);
      const prev = bySignature.get(sig);
      if(opt.compareBand(band, prev) > 0) bySignature.set(sig, band);
      if(acceptedOnly && band.accepted && band.occupancy >= 0.999){
        break;
      }
    }
    return Array.from(bySignature.values()).sort((a, b) => opt.compareBand(b, a));
  }

  function buildBestAcceptedBand(items, rect, axis, kerf, options, phase){
    const candidates = buildBandCandidates(items, rect, axis, kerf, options, true, phase);
    return candidates[0] || null;
  }

  function buildBestAnyBand(items, rect, axis, kerf, options, phase){
    const candidates = buildBandCandidates(items, rect, axis, kerf, options, false, phase);
    let bestAccepted = null;
    let bestAny = null;
    for(const band of candidates){
      if(!band) continue;
      if(band.accepted && opt.compareBand(band, bestAccepted) > 0) bestAccepted = band;
      if(opt.compareBand(band, bestAny) > 0) bestAny = band;
    }
    return bestAccepted || bestAny;
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

  function fillAxisWithIdealBands(state, axis, kerf, options, maxBands, phaseBase, isStartBand){
    let added = 0;
    while(canContinue(state) && added < maxBands){
      emitStage(options, { phase: `${phaseBase || 'ideal'}-pick`, axis, bandNo: added + 1, totalBands: state.totalBands });
      const band = buildBestAcceptedBand(state.items, state.rect, axis, kerf, options, `${phaseBase || 'ideal'}-search`);
      if(!band) break;
      applyBand(state, band, !!isStartBand);
      added += 1;
      emitStage(options, { phase: `${phaseBase || 'ideal'}-done`, axis, bandNo: added, occupancy: band.occupancy || 0, totalBands: state.totalBands });
    }
    return added;
  }

  function takeFallbackBand(state, axis, kerf, options, phaseBase, isStartBand){
    if(!canContinue(state)) return false;
    emitStage(options, { phase: `${phaseBase || 'fallback'}-pick`, axis, totalBands: state.totalBands });
    const band = buildBestAnyBand(state.items, state.rect, axis, kerf, options, `${phaseBase || 'fallback'}-search`);
    if(!band) return false;
    applyBand(state, band, !!isStartBand);
    emitStage(options, { phase: `${phaseBase || 'fallback'}-done`, axis, occupancy: band.occupancy || 0, totalBands: state.totalBands });
    return true;
  }

  function fillResidual(state, axis, kerf, options){
    let currentAxis = axis;
    let guard = 0;
    const maxGuard = Math.max(32, ((state && state.items && state.items.length) || 0) * 6 + 16);
    while(canContinue(state) && guard < maxGuard){
      guard += 1;
      const idealAdded = fillAxisWithIdealBands(state, currentAxis, kerf, options, Number.POSITIVE_INFINITY, `residual-${currentAxis}`, false);
      if(idealAdded > 0) continue;

      const otherAxis = opposite(currentAxis);
      emitStage(options, { phase:'axis-switch-check', from: currentAxis, to: otherAxis, totalBands: state.totalBands });
      const otherIdeal = buildBestAcceptedBand(state.items, state.rect, otherAxis, kerf, options, `residual-${otherAxis}-search`);
      if(otherIdeal){
        state.axisSwitches += 1;
        applyBand(state, otherIdeal, false);
        currentAxis = otherAxis;
        emitStage(options, { phase:'axis-switched', axis: currentAxis, totalBands: state.totalBands });
        continue;
      }

      const fallbackCurrent = buildBestAnyBand(state.items, state.rect, currentAxis, kerf, options, `fallback-${currentAxis}-search`);
      const fallbackOther = buildBestAnyBand(state.items, state.rect, otherAxis, kerf, options, `fallback-${otherAxis}-search`);
      let chosen = null;
      let chosenAxis = currentAxis;
      if(fallbackCurrent && fallbackOther){
        if(opt.compareBand(fallbackOther, fallbackCurrent) > 0){
          chosen = fallbackOther;
          chosenAxis = otherAxis;
        }else{
          chosen = fallbackCurrent;
          chosenAxis = currentAxis;
        }
      }else if(fallbackCurrent){
        chosen = fallbackCurrent;
        chosenAxis = currentAxis;
      }else if(fallbackOther){
        chosen = fallbackOther;
        chosenAxis = otherAxis;
      }
      if(!chosen) break;
      if(chosenAxis !== currentAxis) state.axisSwitches += 1;
      currentAxis = chosenAxis;
      applyBand(state, chosen, false);
      emitStage(options, { phase:'fallback-band-used', axis: currentAxis, occupancy: chosen.occupancy || 0, totalBands: state.totalBands });
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

    const startIdealBands = fillAxisWithIdealBands(state, startAxis, kerf, options, 2, 'start', true);
    if(startIdealBands === 0){
      takeFallbackBand(state, startAxis, kerf, options, 'start-fallback', true);
    }

    if(canContinue(state)){
      state.axisSwitches += 1;
      emitStage(options, { phase:'mandatory-axis-switch', from:startAxis, to:opposite(startAxis), totalBands: state.totalBands });
      fillResidual(state, opposite(startAxis), kerf, options);
    }

    return summarizeState(state);
  }

  function buildSheetPlan(items, boardW, boardH, kerf, options, fixedAxis){
    if(fixedAxis === 'along' || fixedAxis === 'across'){
      return buildSingleVariant(items, boardW, boardH, kerf, options, fixedAxis);
    }
    const along = buildSingleVariant(items, boardW, boardH, kerf, options, 'along');
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

  function pickAxis(startStrategy, items, boardW, boardH, kerf, options){
    const previewAxis = (axis) => buildSheet(items, boardW, boardH, kerf, Object.assign({}, options, { enableRepair:false, reportStage:null }), axis);
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
        const axis = pickAxis(startStrategy, items, boardW, boardH, kerf, Object.assign({}, options, { enableRepair:true }));
        if(onProgress) onProgress({ phase:'sheet-start', currentSheet, nextSheet: currentSheet + 1, remaining: items.length, bestSheets: sheets.length, axis });
        const built = buildSheet(items, boardW, boardH, kerf, Object.assign({}, options, {
          enableRepair:true,
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

        sheets.push(sheet);
        const next = removeByIds(items, built.usedIds || new Set());
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
      return buildSheet(items, boardW, boardH, kerf, { enableRepair:false }, axis);
    }
  };
})(typeof self !== 'undefined' ? self : window);

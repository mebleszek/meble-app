(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const opt = FC.cutOptimizer;
  const C = FC.speedMaxCore || {};
  const Bands = FC.speedMaxBands || {};
  const IDEAL_OCCUPANCY = C.IDEAL_OCCUPANCY;
  const MIN_OK_OCCUPANCY = C.MIN_OK_OCCUPANCY;
  const opposite = C.opposite;
  const removeByIds = C.removeByIds;
  const emitStage = C.emitStage;
  const buildBestBandAtTarget = Bands.buildBestBandAtTarget;
  const buildBestFallbackBand = Bands.buildBestFallbackBand;

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

  FC.speedMaxSheetPlan = {
    buildSheet,
    buildSheetPlan,
    buildSingleVariant,
    comparePlan,
  };
})(typeof self !== 'undefined' ? self : window);

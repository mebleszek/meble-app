(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const opt = FC.cutOptimizer;
  const Plan = FC.speedMaxSheetPlan || {};
  const buildSheet = Plan.buildSheet;
  const buildSheetPlan = Plan.buildSheetPlan;

  function getVirtualHalfDims(boardW, boardH){
    if(boardW >= boardH){
      return { w: boardW, h: Math.max(1, Math.floor(boardH / 20) * 10) };
    }
    return { w: Math.max(1, Math.floor(boardW / 20) * 10), h: boardH };
  }

  function resolveHalfDims(boardW, boardH, options){
    const rw = Math.round(Number(options && options.realHalfBoardW) || 0);
    const rh = Math.round(Number(options && options.realHalfBoardH) || 0);
    if(rw > 0 && rh > 0){
      const fitsDirect = rw <= boardW && rh <= boardH;
      if(fitsDirect) return { w: rw, h: rh };
    }
    return getVirtualHalfDims(boardW, boardH);
  }

  function buildSheetFromPlan(result, fullBoardW, fullBoardH, wasteBoardW, wasteBoardH, tags){
    const sheet = opt.createSheet(fullBoardW, fullBoardH);
    for(const p of (result.placements || [])) sheet.placements.push(p);
    const halfDividerAxis = (wasteBoardW > 0 && wasteBoardW < fullBoardW) ? 'vertical'
      : ((wasteBoardH > 0 && wasteBoardH < fullBoardH) ? 'horizontal' : '');
    const halfDividerPos = halfDividerAxis === 'vertical' ? wasteBoardW
      : (halfDividerAxis === 'horizontal' ? wasteBoardH : 0);
    if(tags && tags.virtualHalf){
      sheet.virtualFraction = 0.5;
      sheet.virtualHalf = true;
      sheet.virtualBoardW = wasteBoardW;
      sheet.virtualBoardH = wasteBoardH;
      sheet.halfDividerAxis = halfDividerAxis;
      sheet.halfDividerPos = halfDividerPos;
    }
    if(tags && tags.realHalf){
      sheet.virtualFraction = 0.5;
      sheet.realHalf = true;
      sheet.realHalfFromStock = true;
      sheet.realHalfBoardW = wasteBoardW;
      sheet.realHalfBoardH = wasteBoardH;
      sheet.halfDividerAxis = halfDividerAxis;
      sheet.halfDividerPos = halfDividerPos;
    }
    return {
      sheet,
      usedIds: result.ids,
      usedArea: result.usedArea || 0,
      placementCount: sheet.placements.length,
      waste: (wasteBoardW * wasteBoardH) - (result.usedArea || 0),
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

  function tryBuildHalfSheet(lastItems, boardW, boardH, kerf, options, startStrategy, useRealHalf){
    if(!Array.isArray(lastItems) || !lastItems.length) return null;
    const half = resolveHalfDims(boardW, boardH, options);
    const silentOptions = Object.assign({}, options, { reportStage:null, onProgress:null });
    const halfAxis = pickAxis(startStrategy, opt.cloneItems(lastItems), half.w, half.h, kerf, silentOptions);
    const preview = buildSheetPlan(opt.cloneItems(lastItems), half.w, half.h, kerf, silentOptions, halfAxis);
    if(preview && preview.ids && preview.ids.size === lastItems.length){
      return buildSheetFromPlan(preview, boardW, boardH, half.w, half.h, useRealHalf ? { realHalf:true } : { virtualHalf:true });
    }
    return null;
  }

  function maybeApplyVirtualHalf(lastItems, boardW, boardH, kerf, options, built, startStrategy){
    if(!built || !built.sheet || !Array.isArray(lastItems) || !lastItems.length) return;
    const halfBuilt = tryBuildHalfSheet(lastItems, boardW, boardH, kerf, Object.assign({}, options, { realHalfBoardW:0, realHalfBoardH:0 }), startStrategy, false);
    if(halfBuilt && halfBuilt.sheet && halfBuilt.usedIds && halfBuilt.usedIds.size === lastItems.length){
      built.sheet = halfBuilt.sheet;
      built.usedIds = halfBuilt.usedIds;
      built.usedArea = halfBuilt.usedArea || 0;
      built.placementCount = halfBuilt.placementCount || 0;
      built.waste = halfBuilt.waste || 0;
      built.primaryBands = halfBuilt.primaryBands || 0;
      built.strongStartBands = halfBuilt.strongStartBands || 0;
      built.startArea = halfBuilt.startArea || 0;
      built.startOccupancySum = halfBuilt.startOccupancySum || 0;
      built.firstBandSize = halfBuilt.firstBandSize || 0;
      built.secondBandSize = halfBuilt.secondBandSize || 0;
      built.totalBands = halfBuilt.totalBands || 0;
      built.axisSwitches = halfBuilt.axisSwitches || 0;
    }
  }

  function pickAxis(startStrategy, items, boardW, boardH, kerf, options){
    const previewAxis = (axis) => buildSheet(items, boardW, boardH, kerf, Object.assign({}, options, { reportStage:null }), axis);
    return startStrategy && typeof startStrategy.resolvePrimaryAxis === 'function'
      ? startStrategy.resolvePrimaryAxis({ previewAxis })
      : 'along';
  }

  FC.speedMaxHalfSheet = {
    getVirtualHalfDims,
    resolveHalfDims,
    buildSheetFromPlan,
    tryBuildHalfSheet,
    maybeApplyVirtualHalf,
    pickAxis,
  };
})(typeof self !== 'undefined' ? self : window);

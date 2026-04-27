(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const reg = FC.rozkrojSpeeds = FC.rozkrojSpeeds || {};
  const opt = FC.cutOptimizer;
  const Core = FC.speedMaxCore || {};
  const Plan = FC.speedMaxSheetPlan || {};
  const HalfSheet = FC.speedMaxHalfSheet || {};
  const LENGTHWISE_AXIS = Core.LENGTHWISE_AXIS;
  const removeByIds = Core.removeByIds;
  const buildSheet = Plan.buildSheet;
  const tryBuildHalfSheet = HalfSheet.tryBuildHalfSheet;
  const maybeApplyVirtualHalf = HalfSheet.maybeApplyVirtualHalf;
  const pickAxis = HalfSheet.pickAxis;

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
      let realHalfRemaining = Math.max(0, Number(options && options.realHalfQty) || 0);

      while(items.length){
        if(isCancelled && isCancelled()) break;

        if(realHalfRemaining > 0){
          const realHalfBuilt = tryBuildHalfSheet(items, boardW, boardH, kerf, options, startStrategy, true);
          if(realHalfBuilt && realHalfBuilt.usedIds && realHalfBuilt.usedIds.size === items.length){
            if(onProgress) onProgress({ phase:'sheet-start', currentSheet, nextSheet: currentSheet + 1, remaining: items.length, bestSheets: sheets.length, axis: LENGTHWISE_AXIS });
            sheets.push(realHalfBuilt.sheet);
            items.length = 0;
            realHalfRemaining -= 1;
            currentSheet += 1;
            if(onProgress) onProgress({
              phase:'sheet-closed',
              currentSheet,
              nextSheet: currentSheet,
              remaining: 0,
              bestSheets: sheets.length,
              axis: LENGTHWISE_AXIS,
            });
            break;
          }
        }

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

        let sheet = built.sheet;
        if(!sheet.placements.length){
          const fallback = opt.packShelf([items[0]], boardW, boardH, kerf, axis)[0];
          if(fallback && fallback.placements && fallback.placements[0]) sheet.placements.push(fallback.placements[0]);
          built.usedIds = new Set(sheet.placements.map(p => p.id));
          built.usedArea = opt.placedArea(sheet);
        }

        const next = removeByIds(items, built.usedIds || new Set());
        if(next.length === 0 && built.usedIds && built.usedIds.size === items.length && realHalfRemaining <= 0){
          maybeApplyVirtualHalf(items, boardW, boardH, kerf, options, built, startStrategy);
          sheet = built.sheet;
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

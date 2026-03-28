(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const reg = FC.rozkrojSpeeds = FC.rozkrojSpeeds || {};
  const opt = FC.cutOptimizer;

  function summarizeSheets(sheets){
    const all = sheets || [];
    const usedArea = all.reduce((sum, s)=> sum + opt.placedArea(s), 0);
    const waste = all.reduce((sum, s)=> sum + opt.calcWaste(s).waste, 0);
    const placementCount = all.reduce((sum, s)=> sum + ((s.placements || []).filter(p=>p && !p.unplaced).length), 0);
    return { sheets: all, usedArea, waste, placementCount, primaryBands: 0 };
  }

  reg['turbo'] = {
    id: 'turbo',
    label: 'Turbo',
    pack(items, boardW, boardH, kerf, options){
      const axis = options && options.startStrategy && typeof options.startStrategy.resolvePrimaryAxis === 'function'
        ? options.startStrategy.resolvePrimaryAxis({})
        : 'along';
      const sheets = opt.packShelf(items, boardW, boardH, kerf, axis);
      return summarizeSheets(sheets);
    },
    previewAxis(items, boardW, boardH, kerf, axis){
      const sheets = opt.packShelf(items, boardW, boardH, kerf, axis);
      return summarizeSheets(sheets);
    }
  };
})(typeof self !== 'undefined' ? self : window);

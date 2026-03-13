/* optima-solver.js — tryb Optima: wybór lepszego startu per arkusz */
(function(root){
  'use strict';
  root.FC = root.FC || {};
  root.FC.optimaSolver = Object.assign({}, root.FC.optimaSolver || {}, {
    packOptima(itemsIn, boardW, boardH, kerf, options){
      const core = root.FC && root.FC.optimaCore;
      if(core && typeof core.packMode === 'function'){
        return core.packMode(itemsIn, boardW, boardH, kerf, Object.assign({}, options || {}, { solverMode:'optima' }));
      }
      return [];
    }
  });
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));

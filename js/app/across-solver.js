/* across-solver.js — tryb pasów poprzecznych oparty na rdzeniu Optima */
(function(root){
  'use strict';
  root.FC = root.FC || {};
  root.FC.acrossSolver = Object.assign({}, root.FC.acrossSolver || {}, {
    packAcross(itemsIn, boardW, boardH, kerf, options){
      const core = root.FC && root.FC.optimaCore;
      if(core && typeof core.packMode === 'function'){
        return core.packMode(itemsIn, boardW, boardH, kerf, Object.assign({}, options || {}, { solverMode:'across' }));
      }
      return [];
    }
  });
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));

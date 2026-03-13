/* along-solver.js — tryb pasów wzdłużnych oparty na rdzeniu Optima */
(function(root){
  'use strict';
  root.FC = root.FC || {};
  root.FC.alongSolver = Object.assign({}, root.FC.alongSolver || {}, {
    packAlong(itemsIn, boardW, boardH, kerf, options){
      const core = root.FC && root.FC.optimaCore;
      if(core && typeof core.packMode === 'function'){
        return core.packMode(itemsIn, boardW, boardH, kerf, Object.assign({}, options || {}, { solverMode:'along' }));
      }
      return [];
    }
  });
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));

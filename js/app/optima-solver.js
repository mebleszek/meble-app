/* optima-solver.js — tryb Optima */
(function(root){
  'use strict';
  root.FC = root.FC || {};
  function packOptima(itemsIn, boardW, boardH, kerf, options){
    const core = root.FC && root.FC.optimaCore;
    if(!core || typeof core.packByMode !== 'function') return [];
    return core.packByMode(itemsIn, boardW, boardH, kerf, Object.assign({}, options || {}, { mode: 'optima' }));
  }
  root.FC.optimaSolver = Object.assign({}, root.FC.optimaSolver || {}, { packOptima });
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));

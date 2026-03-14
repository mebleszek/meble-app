/* across-solver.js — tryb Preferuj pasy w poprzek */
(function(root){
  'use strict';
  root.FC = root.FC || {};
  function packAcross(itemsIn, boardW, boardH, kerf, options){
    const core = root.FC && root.FC.optimaCore;
    if(!core || typeof core.packByMode !== 'function') return [];
    return core.packByMode(itemsIn, boardW, boardH, kerf, Object.assign({}, options || {}, { mode: 'across' }));
  }
  root.FC.acrossSolver = Object.assign({}, root.FC.acrossSolver || {}, { packAcross });
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));

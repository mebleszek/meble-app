/* along-solver.js — tryb Preferuj pasy wzdłuż */
(function(root){
  'use strict';
  root.FC = root.FC || {};
  function packAlong(itemsIn, boardW, boardH, kerf, options){
    const core = root.FC && root.FC.optimaCore;
    if(!core || typeof core.packByMode !== 'function') return [];
    return core.packByMode(itemsIn, boardW, boardH, kerf, Object.assign({}, options || {}, { mode: 'along' }));
  }
  root.FC.alongSolver = Object.assign({}, root.FC.alongSolver || {}, { packAlong });
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));

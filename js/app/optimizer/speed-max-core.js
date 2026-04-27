(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};

  const SIMILAR_MM = 50;
  const IDEAL_OCCUPANCY = 0.95;
  const MIN_OK_OCCUPANCY = 0.9;
  const MAX_TOP_SEEDS = 5;
  const TINY_RATIO = 0.5;
  // Uwaga: w obecnym mapowaniu osi fizyczny kierunek 'po długości płyty'
  // odpowiada wewnętrznej osi 'across'. Nie zmieniać bez korekty trybów startu.
  const LENGTHWISE_AXIS = 'across';

  function axisThickness(axis, oriented){ return axis === 'along' ? oriented.w : oriented.h; }
  function axisLength(axis, oriented){ return axis === 'along' ? oriented.h : oriented.w; }
  function rectThickness(axis, rect){ return axis === 'along' ? rect.w : rect.h; }
  function rectLength(axis, rect){ return axis === 'along' ? rect.h : rect.w; }
  function opposite(axis){ return axis === 'along' ? 'across' : 'along'; }
  function removeByIds(items, set){ return items.filter(it => !set.has(it.id)); }
  function emitStage(options, payload){ try{ options && typeof options.reportStage === 'function' && options.reportStage(payload || {}); }catch(_){ } }

  function compareBands(a, b){
    if(!b) return 1;
    if(!a) return -1;
    if(!!a.targetMet !== !!b.targetMet) return a.targetMet ? 1 : -1;
    if(!!a.accepted !== !!b.accepted) return a.accepted ? 1 : -1;
    if((a.occupancy || 0) !== (b.occupancy || 0)) return (a.occupancy || 0) > (b.occupancy || 0) ? 1 : -1;
    if((a.area || 0) !== (b.area || 0)) return (a.area || 0) > (b.area || 0) ? 1 : -1;
    if((a.count || 0) !== (b.count || 0)) return (a.count || 0) > (b.count || 0) ? 1 : -1;
    if((a.bandSize || 0) !== (b.bandSize || 0)) return (a.bandSize || 0) > (b.bandSize || 0) ? 1 : -1;
    return 0;
  }

  FC.speedMaxCore = {
    SIMILAR_MM,
    IDEAL_OCCUPANCY,
    MIN_OK_OCCUPANCY,
    MAX_TOP_SEEDS,
    TINY_RATIO,
    LENGTHWISE_AXIS,
    axisThickness,
    axisLength,
    rectThickness,
    rectLength,
    opposite,
    removeByIds,
    emitStage,
    compareBands,
  };
})(typeof self !== 'undefined' ? self : window);

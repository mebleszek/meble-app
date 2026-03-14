(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const reg = FC.rozkrojStarts = FC.rozkrojStarts || {};
  reg['start-optimax'] = {
    id: 'start-optimax',
    label: 'Opti-max',
    resolvePrimaryAxis(ctx){
      const along = ctx && typeof ctx.previewAxis === 'function' ? ctx.previewAxis('along') : null;
      const across = ctx && typeof ctx.previewAxis === 'function' ? ctx.previewAxis('across') : null;
      if(along && !across) return 'along';
      if(across && !along) return 'across';
      if(!along && !across) return 'along';
      if((along.usedArea || 0) !== (across.usedArea || 0)) return (along.usedArea || 0) >= (across.usedArea || 0) ? 'along' : 'across';
      if((along.placementCount || 0) !== (across.placementCount || 0)) return (along.placementCount || 0) >= (across.placementCount || 0) ? 'along' : 'across';
      if((along.waste || 0) !== (across.waste || 0)) return (along.waste || 0) <= (across.waste || 0) ? 'along' : 'across';
      return 'along';
    }
  };
})(typeof self !== 'undefined' ? self : window);

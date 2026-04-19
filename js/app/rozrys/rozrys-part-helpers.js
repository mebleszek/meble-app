(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createApi(ctx){
    const cfg = Object.assign({ FC, host:window, cmToMm:(v)=> Math.round(Number(v) || 0), partSignature:(part)=> `${part && part.material || ''}||${part && part.name || ''}||${part && part.w || 0}x${part && part.h || 0}` }, ctx || {});
    const apiFC = cfg.FC || FC;
    const host = cfg.host || window;
    const cmToMm = typeof cfg.cmToMm === 'function' ? cfg.cmToMm : ((v)=> Math.round(Number(v) || 0));
    const partSignature = typeof cfg.partSignature === 'function' ? cfg.partSignature : ((part)=> `${part && part.material || ''}||${part && part.name || ''}||${part && part.w || 0}x${part && part.h || 0}`);

    function getPartOptionsStore(){
      return (apiFC && apiFC.materialPartOptions) || null;
    }

    function normalizeFrontLaminatMaterialKey(materialKey){
      const m = String(materialKey || '').match(/^\s*Front\s*:\s*laminat\s*•\s*(.+)$/i);
      return m ? String(m[1] || '').trim() : String(materialKey || '').trim();
    }

    function resolveCabinetCutListFn(){
      try{
        if(apiFC.cabinetCutlist && typeof apiFC.cabinetCutlist.getCabinetCutList === 'function') return apiFC.cabinetCutlist.getCabinetCutList.bind(apiFC.cabinetCutlist);
      }catch(_){ }
      try{
        if(typeof getCabinetCutList === 'function') return getCabinetCutList;
      }catch(_){ }
      try{
        if(host && typeof host.getCabinetCutList === 'function') return host.getCabinetCutList;
      }catch(_){ }
      return null;
    }

    function resolveRozrysPartFromSource(p){
      try{
        const store = getPartOptionsStore();
        if(store && typeof store.resolvePartForRozrys === 'function') return store.resolvePartForRozrys(p);
      }catch(_){ }
      const materialKey = normalizeFrontLaminatMaterialKey(String((p && p.material) || '').trim());
      return {
        materialKey,
        name: String((p && p.name) || 'Element'),
        sourceSig: `${materialKey}||${String((p && p.name) || 'Element')}||${cmToMm(p && p.a)}x${cmToMm(p && p.b)}`,
        direction: 'default',
        ignoreGrain: false,
        w: cmToMm(p && p.a),
        h: cmToMm(p && p.b),
        qty: Math.max(1, Math.round(Number(p && p.qty) || 0)),
      };
    }

    function materialPartDirectionLabel(part){
      try{
        const store = getPartOptionsStore();
        if(store && typeof store.labelForDirection === 'function') return store.labelForDirection(part && part.direction);
      }catch(_){ }
      return 'Domyślny z materiału';
    }

    function isPartRotationAllowed(part, grainOn, overrides){
      if(!grainOn) return true;
      if(part && part.ignoreGrain) return true;
      const sig = partSignature(part);
      return !!(overrides && overrides[sig]);
    }

    function isFrontMaterialKey(materialKey){
      return /^\s*Front\s*:/i.test(String(materialKey || ''));
    }

    return {
      getPartOptionsStore,
      resolveCabinetCutListFn,
      resolveRozrysPartFromSource,
      materialPartDirectionLabel,
      isPartRotationAllowed,
      isFrontMaterialKey,
      normalizeFrontLaminatMaterialKey,
    };
  }

  FC.rozrysPartHelpers = { createApi };
})();

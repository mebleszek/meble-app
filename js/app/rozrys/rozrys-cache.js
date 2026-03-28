(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const PLAN_CACHE_KEY = 'fc_rozrys_plan_cache_v2';

  function hashStr(s){
    let h = 5381;
    const str = String(s || '');
    for(let i = 0; i < str.length; i++){
      h = ((h << 5) + h) + str.charCodeAt(i);
      h = h >>> 0;
    }
    return h.toString(16);
  }

  function loadPlanCache(){
    try{
      const raw = localStorage.getItem(PLAN_CACHE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(_){
      return {};
    }
  }

  function savePlanCache(cache){
    try{
      const entries = Object.entries(cache || {});
      if(entries.length > 100){
        entries.sort((a, b)=> (b[1].ts || 0) - (a[1].ts || 0));
        const keep = entries.slice(0, 100);
        const next = {};
        for(const [k, v] of keep) next[k] = v;
        cache = next;
      }
      localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify(cache || {}));
    }catch(_){ }
  }

  function makePlanCacheKey(st, parts, deps){
    const cfg = Object.assign({
      partSignature:null,
      isPartRotationAllowed:null,
      loadEdgeStore:null,
    }, deps || {});
    const overrides = Object.assign({}, st && st.grainExceptions || {});
    const edgeStore = typeof cfg.loadEdgeStore === 'function' ? (cfg.loadEdgeStore() || {}) : {};
    const items = (Array.isArray(parts) ? parts : []).map((p)=>{
      const sig = typeof cfg.partSignature === 'function' ? cfg.partSignature(p) : `${p && p.material || ''}||${p && p.name || ''}||${p && p.w || 0}x${p && p.h || 0}`;
      const allow = typeof cfg.isPartRotationAllowed === 'function'
        ? !!cfg.isPartRotationAllowed(p, !!(st && st.grain), overrides)
        : true;
      const e = edgeStore[sig] || {};
      return {
        k: sig,
        n: p && p.name,
        w: p && p.w,
        h: p && p.h,
        q: p && p.qty,
        ra: allow,
        ew1: !!e.w1,
        ew2: !!e.w2,
        eh1: !!e.h1,
        eh2: !!e.h2
      };
    }).sort((a, b)=> (a.k < b.k ? -1 : a.k > b.k ? 1 : (a.w - b.w) || (a.h - b.h)));
    const keyObj = {
      st: {
        material: st && st.material,
        unit: st && st.unit,
        edgeSubMm: st && st.edgeSubMm,
        boardW: st && st.boardW,
        boardH: st && st.boardH,
        kerf: st && st.kerf,
        edgeTrim: st && st.edgeTrim,
        minScrapW: st && st.minScrapW,
        minScrapH: st && st.minScrapH,
        grain: st && st.grain,
        heur: st && st.heur,
        optimaxProfile: st && st.optimaxProfile,
        direction: st && st.direction,
        realHalfQty: Number(st && st.realHalfQty) || 0,
        realHalfBoardW: Number(st && st.realHalfBoardW) || 0,
        realHalfBoardH: Number(st && st.realHalfBoardH) || 0,
        stockExactQty: Number(st && st.stockExactQty) || 0,
        stockFullBoardW: Number(st && st.stockFullBoardW) || 0,
        stockFullBoardH: Number(st && st.stockFullBoardH) || 0,
        stockPolicy: String(st && st.stockPolicy || ''),
        stockSignature: String(st && st.stockSignature || ''),
      },
      items
    };
    return 'plan_' + hashStr(JSON.stringify(keyObj));
  }

  FC.rozrysCache = {
    hashStr,
    loadPlanCache,
    savePlanCache,
    makePlanCacheKey,
  };
})();

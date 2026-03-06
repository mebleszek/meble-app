/* panel-pro-worker.js — cięższe liczenie rozkroju "pod piłę panelową" w Web Workerze
   - Nie zmienia UI; odciąża główny wątek.
   - Importuje istniejący cut-optimizer (Guillotine Beam Search).
   - Robi multi-start (różne sortowania + losowe tasowania) w budżecie czasu.
*/

// In worker there is no `window` by default; the optimizer expects `window.FC`.
self.window = self;

try{
  importScripts('cut-optimizer.js');
}catch(e){
  // fallback: try absolute from /js/app (when worker is created with different base)
  try{ importScripts('/js/app/cut-optimizer.js'); }catch(_){ }
}

(function(){
  'use strict';

  const opt = (self.FC && self.FC.cutOptimizer) ? self.FC.cutOptimizer : null;

  function now(){ return (self.performance && performance.now) ? performance.now() : Date.now(); }

  function scoreSheets(sheets){
    if(!opt || !opt.calcWaste) return { sheets: (sheets||[]).length, waste: Number.POSITIVE_INFINITY };
    const waste = (sheets||[]).reduce((sum,s)=> sum + opt.calcWaste(s).waste, 0);
    return { sheets: (sheets||[]).length, waste };
  }

  function better(a, b){
    if(!b) return true;
    if(a.sc.sheets !== b.sc.sheets) return a.sc.sheets < b.sc.sheets;
    return a.sc.waste < b.sc.waste;
  }

  function mulberry32(seed){
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rnd){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(rnd() * (i+1));
      const t = a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }

  function sortVariants(items){
    const byAreaDesc = items.slice().sort((a,b)=>(b.w*b.h)-(a.w*a.h));
    const byMaxSideDesc = items.slice().sort((a,b)=>Math.max(b.w,b.h)-Math.max(a.w,a.h));
    const byMinSideDesc = items.slice().sort((a,b)=>Math.min(b.w,b.h)-Math.min(a.w,a.h));
    const byPerimDesc = items.slice().sort((a,b)=>((b.w+b.h)-(a.w+a.h)));
    return [byAreaDesc, byMaxSideDesc, byPerimDesc, byMinSideDesc];
  }

  function packPanelPro(items, W, H, K, opts){
    if(!opt || typeof opt.packGuillotineBeam !== 'function'){
      return { sheets: [], note: 'Brak packGuillotineBeam w workerze.' };
    }

    const timeBudgetMs = Math.max(1000, Math.round(Number(opts && opts.timeBudgetMs) || 30000));
    const perSheetMs = Math.max(120, Math.round(Number(opts && opts.perSheetMs) || 420));
    const beamWidth = Math.max(40, Math.round(Number(opts && opts.beamWidth) || 220));
    const cutPref = (opts && (opts.cutPref || opts.direction)) || 'auto';
    const prefList = (cutPref === 'auto') ? ['along','across'] : [cutPref];

    const started = now();
    const base = sortVariants(items);

    // deterministic runs first
    let best = null;
    const tryOne = (arr)=>{
      for(const pref of prefList){
        const sheets = opt.packGuillotineBeam(arr, W, H, K, { beamWidth, timeMs: perSheetMs, cutPref: pref, scrapFirst:true });
        const sc = scoreSheets(sheets);
        const res = { sheets, sc };
        if(better(res, best)) best = res;
      }
    };
    base.forEach(tryOne);

    // randomized multi-start
    let iters = 0;
    let lastProgress = started;
    while(now() - started < timeBudgetMs){
      const seed = (Date.now() + iters*9973) >>> 0;
      const rnd = mulberry32(seed);
      const pick = base[Math.floor(rnd()*base.length)];
      // mix: shuffle within buckets (keeps some structure)
      const arr = shuffle(pick, rnd);
      tryOne(arr);
      iters++;

      const t = now();
      if(t - lastProgress > 500){
        lastProgress = t;
        self.postMessage({
          type:'progress',
          elapsedMs: Math.round(t - started),
          iters,
          best: best ? { sheets: best.sc.sheets, waste: best.sc.waste } : null,
        });
      }
    }

    if(best) return { sheets: best.sheets };
    // Fallback: still evaluate both preferences when auto.
    let fallbackBest = null;
    for(const pref of prefList){
      const sheets = opt.packGuillotineBeam(items, W, H, K, { beamWidth, timeMs: perSheetMs, cutPref: pref, scrapFirst:true });
      const sc = scoreSheets(sheets);
      const res = { sheets, sc };
      if(better(res, fallbackBest)) fallbackBest = res;
    }
    return { sheets: fallbackBest ? fallbackBest.sheets : [] };
  }

  self.onmessage = (ev)=>{
    const msg = ev && ev.data ? ev.data : {};
    if(msg.cmd !== 'panel_pro') return;
    try{
      const items = Array.isArray(msg.items) ? msg.items : [];
      const W = Number(msg.W)||2800;
      const H = Number(msg.H)||2070;
      const K = Number(msg.K)||4;
      const res = packPanelPro(items, W, H, K, msg.options || {});
      self.postMessage({ type:'done', result: res });
    }catch(e){
      self.postMessage({ type:'error', error: String(e && (e.message||e) || 'Błąd') });
    }
  };
})();

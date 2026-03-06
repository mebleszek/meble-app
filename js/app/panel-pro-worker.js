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

  let _cancelled = false;
  let _activeRunId = 0;
  let _pendingCancelRunId = 0;
  // Keep best-so-far globally so we can respond immediately on cancel.
  let _bestSoFar = null; // { sheets, sc }

  function setBest(res){
    if(!res) return;
    if(!_bestSoFar || better(res, _bestSoFar)) _bestSoFar = res;
  }

  function packPanelPro(items, W, H, K, opts){
    if(!opt || typeof opt.packGuillotineBeam !== 'function'){
      return { sheets: [], note: 'Brak packGuillotineBeam w workerze.' };
    }

    const timeBudgetMs = Math.max(1000, Math.round(Number(opts && opts.timeBudgetMs) || 30000));
    const perSheetMs = Math.max(120, Math.round(Number(opts && opts.perSheetMs) || 420));
    const beamWidth = Math.max(40, Math.round(Number(opts && opts.beamWidth) || 220));
    const cutPref = (opts && (opts.cutPref || opts.direction)) || 'auto';
    // When user selects Auto, also let the optimizer decide (auto) in addition
    // to forced preferences. This often reduces "dziury" in some layouts.
    const prefList = (cutPref === 'auto') ? ['auto','along','across'] : [cutPref];

    const started = now();
    const base = sortVariants(items);

    // Map items by id so we can reconstruct pools from placements in a repair step.
    const itemById = new Map();
    for(const it of (items||[])){
      if(it && it.id!=null) itemById.set(String(it.id), it);
    }

    // deterministic runs first
    let best = null;
    const tryOne = (arr)=>{
      for(const pref of prefList){
        if(_cancelled) return;
        const sheets = opt.packGuillotineBeam(arr, W, H, K, { beamWidth, timeMs: perSheetMs, cutPref: pref, scrapFirst:true });
        const sc = scoreSheets(sheets);
        const res = { sheets, sc };
        if(better(res, best)) best = res;
        setBest(res);
      }
    };
    base.forEach(tryOne);

    // randomized multi-start
    let iters = 0;
    let lastProgress = started;
    while(now() - started < timeBudgetMs){
      if(_cancelled) break;
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

    // --- Ultra post-pass ("przekozacki" local repair) ---
    // The main multi-start search can end with a weakly-filled last sheet.
    // Here we run 20 repair attempts that repack the tail (last 3–4 sheets)
    // and optionally "borrow" up to 10 items from the previous sheet to enable swaps.
    function placementsToItems(sheet){
      const out = [];
      if(!sheet || !Array.isArray(sheet.placements)) return out;
      for(const p of sheet.placements){
        if(!p || p.unplaced) continue;
        const it = itemById.get(String(p.id));
        if(it) out.push(it);
      }
      return out;
    }

    function cloneHeadSheets(sheets, keepCount){
      return sheets.slice(0, keepCount).map(sh=>({
        boardW: sh.boardW,
        boardH: sh.boardH,
        placements: (sh.placements||[]).slice(),
        _freeRects: sh._freeRects ? sh._freeRects.slice() : undefined,
        _usedArea: sh._usedArea
      }));
    }

    function tryImproveTail(current){
      if(!current || !Array.isArray(current.sheets) || current.sheets.length < 2) return current;
      const sheets0 = current.sheets;
      const n = sheets0.length;
      const attempts = 20;
      let bestLocal = { sheets: sheets0, sc: scoreSheets(sheets0) };

      for(let a=0; a<attempts; a++){
        if(_cancelled) break;
        const win = (a % 5 === 0) ? 4 : 3; // occasionally try a wider window
        const startIdx = Math.max(0, n - win);
        let pool = [];
        for(let i=startIdx;i<n;i++) pool = pool.concat(placementsToItems(sheets0[i]));
        if(!pool.length) continue;

        // Borrow up to 10 items from the sheet just before the window.
        const borrowMax = 10;
        const borrowFromIdx = startIdx - 1;
        let borrowed = [];
        if(borrowFromIdx >= 0){
          const candidates = placementsToItems(sheets0[borrowFromIdx]);
          if(candidates.length){
            const seed = ((Date.now() + a*1337) >>> 0);
            const rnd = mulberry32(seed);
            borrowed = shuffle(candidates, rnd).slice(0, Math.min(borrowMax, candidates.length));
            pool = pool.concat(borrowed);
          }
        }

        const seed2 = ((Date.now() + a*9973) >>> 0);
        const rnd2 = mulberry32(seed2);
        const arr = shuffle(pool, rnd2);

        // Stronger parameters for tail repair.
        const tailBeam = Math.max(180, beamWidth);
        const tailMs = Math.max(220, Math.min(650, perSheetMs + 180));

        for(const pref of prefList){
          if(_cancelled) break;
          const repacked = opt.packGuillotineBeam(arr, W, H, K, { beamWidth: tailBeam, timeMs: tailMs, cutPref: pref, scrapFirst:true });
          const replacedStart = borrowed.length ? borrowFromIdx : startIdx;
          const newHead = cloneHeadSheets(sheets0, replacedStart);
          const newSheets = newHead.concat(repacked);
          const sc = scoreSheets(newSheets);
          const res = { sheets: newSheets, sc };
          if(better(res, bestLocal)) bestLocal = res;
          setBest(res);
        }
      }
      return bestLocal;
    }

    if(best){
      // Spend the remaining time for repair if available.
      if(!_cancelled){
        const remainingMs = timeBudgetMs - (now() - started);
        if(remainingMs > 300){
          const improved = tryImproveTail(best);
          if(improved && better(improved, best)) best = improved;
        }
      }
      return { sheets: best.sheets, cancelled: _cancelled };
    }
    // Fallback: still evaluate both preferences when auto.
    let fallbackBest = null;
    for(const pref of prefList){
      if(_cancelled) break;
      const sheets = opt.packGuillotineBeam(items, W, H, K, { beamWidth, timeMs: perSheetMs, cutPref: pref, scrapFirst:true });
      const sc = scoreSheets(sheets);
      const res = { sheets, sc };
      if(better(res, fallbackBest)) fallbackBest = res;
      setBest(res);
    }
    return { sheets: fallbackBest ? fallbackBest.sheets : [], cancelled: _cancelled };
  }

  self.onmessage = (ev)=>{
    const msg = ev && ev.data ? ev.data : {};
    if(msg.cmd === 'cancel'){
      // Cancel current run.
      // IMPORTANT: on mobile the UI may send cancel without runId or with mismatched runId.
      // We still want to stop ASAP.
      const rid = Number(msg.runId)||0;

      if(!_activeRunId){
        // Not started yet – remember request.
        _pendingCancelRunId = rid || 1;
      }

      // If rid is 0, treat it as "cancel whatever is running".
      if(rid === 0 || rid === _activeRunId){
        _cancelled = true;
        // Respond immediately with best-so-far if we have it.
        if(_bestSoFar && Array.isArray(_bestSoFar.sheets)){
          try{ self.postMessage({ type:'done', result:{ sheets:_bestSoFar.sheets, cancelled:true }, runId:_activeRunId }); }catch(_){ }
        }
      } else {
        // Remember so we can apply when that run becomes active.
        _pendingCancelRunId = rid;
        // Also cancel the current run (better UX than doing nothing).
        _cancelled = true;
        if(_bestSoFar && Array.isArray(_bestSoFar.sheets)){
          try{ self.postMessage({ type:'done', result:{ sheets:_bestSoFar.sheets, cancelled:true }, runId:_activeRunId }); }catch(_){ }
        }
      }
      return;
    }
    if(msg.cmd !== 'panel_pro') return;
    try{
      _cancelled = false;
      _activeRunId = Number(msg.runId)||0;
      _bestSoFar = null;
      if(_pendingCancelRunId && _pendingCancelRunId === _activeRunId){
        _cancelled = true;
        _pendingCancelRunId = 0;
      }
      const items = Array.isArray(msg.items) ? msg.items : [];
      const W = Number(msg.W)||2800;
      const H = Number(msg.H)||2070;
      const K = Number(msg.K)||4;
      const res = packPanelPro(items, W, H, K, msg.options || {});
      self.postMessage({ type:'done', result: res, runId: _activeRunId });
    }catch(e){
      self.postMessage({ type:'error', error: String(e && (e.message||e) || 'Błąd'), runId: _activeRunId });
    }
  };
})();

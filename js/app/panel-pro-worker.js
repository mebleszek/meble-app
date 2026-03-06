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
    // NOTE (praktyka): "auto" w packGuillotineBeam potrafi generować układy
    // OK procentowo, ale fatalne pod piłę (mnóstwo zmian kierunku cięcia).
    // W Ultra "Auto" oznacza: wybierz najlepsze spośród along/across.
    const prefList = (cutPref === 'auto') ? ['along','across'] : [cutPref];


    const started = now();
    const base = sortVariants(items);

    // Map items by id for quick lookup when doing post-pass repair.
    const itemById = new Map();
    for(const it of items){
      if(it && (it.id!==undefined && it.id!==null)) itemById.set(it.id, it);
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

    // === "Przekozacki" post-pass (repair) ===
    // Goal: reduce "pusta ostatnia płyta" by repacking the tail (last 2-3 sheets)
    // and optionally borrowing up to 10 elements from 1-2 sheets earlier.
    // This is intentionally local: we do NOT repack the whole solution.
    function idsFromSheet(sheet){
      const out = [];
      const pls = (sheet && Array.isArray(sheet.placements)) ? sheet.placements : [];
      for(const p of pls){
        if(p && p.unplaced) continue;
        if(p && (p.id!==undefined && p.id!==null)) out.push(p.id);
      }
      return out;
    }

    function repackTailWithBorrow(prefixSheets, tailSheets, borrowIds, cutPref){
      // Build pool: all items that were placed on tail sheets + borrowed ids.
      const poolIds = [];
      for(const s of tailSheets){
        poolIds.push(...idsFromSheet(s));
      }
      if(Array.isArray(borrowIds) && borrowIds.length) poolIds.push(...borrowIds);

      // Map ids -> items; de-dup ids.
      const uniq = [];
      const seen = new Set();
      for(const id of poolIds){
        if(seen.has(id)) continue;
        seen.add(id);
        const it = itemById.get(id);
        if(it) uniq.push(it);
      }
      if(!uniq.length) return null;

      // Repack only the pool into new sheets.
      const newTail = opt.packGuillotineBeam(uniq, W, H, K, {
        beamWidth,
        // Keep it snappy: we may do many trials.
        timeMs: Math.min(260, Math.max(120, Math.round(perSheetMs * 0.6))),
        cutPref,
        scrapFirst: true,
      });

      const combined = (prefixSheets||[]).concat(newTail||[]);
      const sc = scoreSheets(combined);
      return { sheets: combined, sc };
    }

    function doCrazyPostPass(currentBest){
      if(_cancelled) return currentBest;
      if(!currentBest || !Array.isArray(currentBest.sheets)) return currentBest;

      const sheets = currentBest.sheets;
      if(sheets.length < 3) return currentBest;

      // Only worth it when the last sheet is "light" (few items) or when we have many sheets.
      const lastIds = idsFromSheet(sheets[sheets.length-1]);
      if(sheets.length <= 4 && lastIds.length > 10) return currentBest;

      const trials = Math.max(0, Math.round(Number(opts && opts.crazyTailTrials) || 20));
      if(!trials) return currentBest;

      let bestLocal = currentBest;

      // Candidate borrow sheets: 1-2 sheets before the tail.
      const borrowCandidates = [];
      const idxA = sheets.length - 4;
      const idxB = sheets.length - 5;
      if(idxA >= 0) borrowCandidates.push(idxA);
      if(idxB >= 0) borrowCandidates.push(idxB);

      // Tail sizes: last 2 or last 3 sheets.
      const tailSizes = [3, 2];

      const startPost = now();
      for(let t=0; t<trials; t++){
        if(_cancelled) break;
        // Respect remaining time budget.
        if(now() - started > timeBudgetMs) break;

        const seed = ((Date.now() + 1337) + t*7919) >>> 0;
        const rnd = mulberry32(seed);

        const tailSize = tailSizes[Math.floor(rnd()*tailSizes.length)];
        const tailStart = Math.max(0, sheets.length - tailSize);
        const prefix = sheets.slice(0, tailStart);
        const tail = sheets.slice(tailStart);

        // Borrow up to 10 ids from 1-2 candidate sheets.
        const borrowMax = 10;
        const borrowIds = [];
        const borrowFromCount = (borrowCandidates.length && rnd() < 0.65) ? (rnd() < 0.35 ? 2 : 1) : 0;
        if(borrowFromCount){
          const cand = shuffle(borrowCandidates, rnd).slice(0, borrowFromCount);
          for(const idx of cand){
            const ids = idsFromSheet(sheets[idx]);
            if(!ids.length) continue;
            const pickCount = Math.min(borrowMax - borrowIds.length, Math.max(1, Math.floor(rnd()*Math.min(6, ids.length))));
            const shuffledIds = shuffle(ids, rnd);
            for(let i=0;i<pickCount && borrowIds.length<borrowMax;i++) borrowIds.push(shuffledIds[i]);
          }
        }

        // Try different cut preferences even when overall is auto.
        const pref = prefList[Math.floor(rnd()*prefList.length)];
        const candRes = repackTailWithBorrow(prefix, tail, borrowIds, pref);
        if(!candRes) continue;
        if(better(candRes, bestLocal)) bestLocal = candRes;
        setBest(bestLocal);

        // progress ping (cheap)
        const tt = now();
        if(tt - startPost > 650 && (t % 5 === 4)){
          try{
            self.postMessage({
              type:'progress',
              elapsedMs: Math.round(tt - started),
              iters: iters + t + 1,
              best: bestLocal ? { sheets: bestLocal.sc.sheets, waste: bestLocal.sc.waste } : null,
            });
          }catch(_){ }
        }
      }

      return bestLocal;
    }

    if(best && !_cancelled){
      best = doCrazyPostPass(best);
    }

    if(best) return { sheets: best.sheets, cancelled: _cancelled };
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

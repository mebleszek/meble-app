/* UWAGA: ten plik nie jest ładowany przez index.html jako zwykły script.
   Jest używany pośrednio jako Web Worker z js/app/rozrys.js.
   Zmieniać ostrożnie i testować ścieżkę workerową osobno. */
/* panel-pro-worker.js — cięższe liczenie rozkroju "pod piłę panelową" w Web Workerze
   - Nie zmienia UI; odciąża główny wątek.
   - Importuje istniejący cut-optimizer (Guillotine Beam Search).
   - Robi multi-start (różne sortowania + losowe tasowania) w budżecie czasu.
*/

// In worker there is no `window` by default; the optimizer expects `window.FC`.
self.window = self;

const SOLVER_VER = '20260313_optima_cleanup_v1';
try{
  importScripts('optima-core.js?v=' + SOLVER_VER, 'along-solver.js?v=' + SOLVER_VER, 'across-solver.js?v=' + SOLVER_VER, 'optima-solver.js?v=' + SOLVER_VER, 'cut-optimizer.js?v=' + SOLVER_VER);
}catch(e){
  // fallback: try absolute from /js/app (when worker is created with different base)
  try{ importScripts('/js/app/optima-core.js?v=' + SOLVER_VER, '/js/app/along-solver.js?v=' + SOLVER_VER, '/js/app/across-solver.js?v=' + SOLVER_VER, '/js/app/optima-solver.js?v=' + SOLVER_VER, '/js/app/cut-optimizer.js?v=' + SOLVER_VER); }catch(_){ }
}

(function(){
  'use strict';

  const opt = (self.FC && self.FC.cutOptimizer) ? self.FC.cutOptimizer : null;

  function now(){ return (self.performance && performance.now) ? performance.now() : Date.now(); }

  function groupAreaMax(items, keyFn){
    const map = new Map();
    for(const it of (items||[])){
      const key = keyFn(it);
      const prev = map.get(key) || { count:0, area:0 };
      prev.count += 1;
      prev.area += (Number(it.w)||0) * (Number(it.h)||0);
      map.set(key, prev);
    }
    let best = 0;
    for(const v of map.values()){
      if(v.count >= 2 && v.area > best) best = v.area;
    }
    return best;
  }

  function meaningfulFreeRects(sheet){
    return ((sheet && Array.isArray(sheet._freeRects)) ? sheet._freeRects : []).filter(r=>r && r.w >= 120 && r.h >= 120);
  }

  function largestReusableStripArea(sheet){
    const arr = meaningfulFreeRects(sheet);
    const W = Number(sheet && sheet.boardW) || 0;
    const H = Number(sheet && sheet.boardH) || 0;
    let best = 0;
    for(const r of arr){
      const fullH = H > 0 && r.h >= H * 0.92 && r.w >= 180;
      const fullW = W > 0 && r.w >= W * 0.92 && r.h >= 180;
      if(fullH || fullW) best = Math.max(best, r.w * r.h);
    }
    return best;
  }

  function sheetBandArea(sheet){
    const pls = (sheet && Array.isArray(sheet.placements)) ? sheet.placements.filter(p=>p && !p.unplaced) : [];
    if(pls.length < 2) return 0;
    const byWidth = groupAreaMax(pls, p=>'w:' + p.w);
    const byHeight = groupAreaMax(pls, p=>'h:' + p.h);
    const byRowBand = groupAreaMax(pls, p=>'row:' + p.y + ':' + p.h);
    const byColBand = groupAreaMax(pls, p=>'col:' + p.x + ':' + p.w);
    return Math.max(byWidth, byHeight, byRowBand, byColBand);
  }

  function scoreSheets(sheets){
    if(!opt || !opt.calcWaste) return { sheets: (sheets||[]).length, waste: Number.POSITIVE_INFINITY };
    const arr = (sheets||[]);
    let waste = arr.reduce((sum,s)=> sum + opt.calcWaste(s).waste, 0);

    // Tie-breaker: penalize "duże mieszanie kierunków" na jednej płycie.
    // Cel praktyczny: nie wymuszać częstego obracania całej płyty. Dopuszczamy rotacje,
    // ale preferujemy sytuacje, gdy obrócone elementy mieszczą się w "pasie" <= 1000 mm.
    // (np. można odciąć wzdłuż 30–100 cm i dopiero ten pas obracać).
    const MAX_ROTATE_STRIP_MM = 1000;
    for(const s of arr){
      const area = (Number(s && s.boardW) || 0) * (Number(s && s.boardH) || 0);
      if(area <= 0) continue;

      const pls = (s && s.placements) ? s.placements.filter(p=>p && !p.unplaced) : [];
      if(pls.length >= 2){
        let hasR = false, hasN = false;
        let minX=1e18, minY=1e18, maxX=-1e18, maxY=-1e18;
        for(const p of pls){
          if(p.rotated) {
            hasR = true;
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x + p.w);
            maxY = Math.max(maxY, p.y + p.h);
          } else {
            hasN = true;
          }
        }
        if(hasR && hasN){
          const bw = (maxX>minX) ? (maxX-minX) : 0;
          const bh = (maxY>minY) ? (maxY-minY) : 0;
          const okStrip = (bw <= MAX_ROTATE_STRIP_MM) || (bh <= MAX_ROTATE_STRIP_MM);
          if(!okStrip){
            // 8% płyty jako kara – tylko tie-breaker, nie przebija "mniej płyt".
            waste += area * 0.08;
          }
        }
      }

      // Opti-like preference: keep one sensowny duży prostokąt odpadu / pas do dalszego użycia,
      // a nie wiele drobnych ścinków.
      const free = meaningfulFreeRects(s);
      const largestFree = free.reduce((m,r)=>Math.max(m, r.w*r.h), 0);
      const stripFree = largestReusableStripArea(s);
      const bandArea = sheetBandArea(s);

      if(free.length > 4){
        waste += area * Math.min(0.05, (free.length - 4) * 0.008);
      }
      if(largestFree > 0){
        waste -= Math.min(area * 0.03, largestFree * 0.12);
      }
      if(stripFree > 0){
        waste -= Math.min(area * 0.035, stripFree * 0.18);
      }
      if(bandArea > 0){
        waste -= Math.min(area * 0.04, bandArea * 0.06);
      }
    }

    return { sheets: arr.length, waste: Math.max(0, waste) };
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
    // Dodatkowe warianty "pasowe" – pomagają znaleźć układ typu: odetnij pas 730mm i dopakuj drobnicę.
    const byWidthDesc = items.slice().sort((a,b)=>b.w-a.w);
    const byHeightDesc = items.slice().sort((a,b)=>b.h-a.h);
    return [byAreaDesc, byMaxSideDesc, byPerimDesc, byMinSideDesc, byWidthDesc, byHeightDesc];
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

    let _heartbeat = null;
    try{

    const maxAttempts = Math.max(1, Math.round(Number(opts && opts.maxAttempts) || 150));
    const endgameAttempts = Math.max(0, Math.round(Number(opts && opts.endgameAttempts) || 200));
    const perSheetMs = Math.max(120, Math.round(Number(opts && opts.perSheetMs) || 420));
    const beamWidth = Math.max(40, Math.round(Number(opts && opts.beamWidth) || 220));
    const hardStopMs = Math.max(4000, maxAttempts * 1500);
    const rawPref = (opts && (opts.cutPref || opts.direction)) || 'along';
    const cutPref = (rawPref === 'across') ? 'across' : (rawPref === 'optima' ? 'optima' : 'along');
    const rawMode = (opts && opts.cutMode) || cutPref;
    const cutMode = (rawMode === 'across') ? 'across' : (rawMode === 'optima' ? 'optima' : 'along');
    const minScrapW = Math.max(0, Math.round((opts && opts.minScrapW != null) ? Number(opts.minScrapW) : 100));
    const minScrapH = Math.max(0, Math.round((opts && opts.minScrapH != null) ? Number(opts.minScrapH) : 100));
    const prefList = [cutPref];

    const packOne = (arr, pref, ms)=>{
      if(cutMode === 'optima' && opt.packOptima){
        return opt.packOptima(arr, W, H, K, {
          profile: (opts && opts.optimaxProfile) || 'D',
          perSheetMs: ms,
          minScrapW,
          minScrapH,
          solverMode: 'optima',
          isCancelled: ()=>_cancelled,
        });
      }
      if(cutMode === 'along' && opt.packStripBands){
        return opt.packStripBands(arr, W, H, K, 'along');
      }
      if(cutMode === 'across' && opt.packStripBands){
        return opt.packStripBands(arr, W, H, K, 'across');
      }
      return opt.packGuillotineBeam(arr, W, H, K, {
        beamWidth,
        timeMs: ms,
        cutPref: pref,
        scrapFirst: true,
        minScrapW,
        minScrapH,
      });
    };

    const started = now();
    const base = sortVariants(items);

    // Map items by id for quick lookup when doing post-pass repair.
    const itemById = new Map();
    for(const it of items){
      if(it && (it.id!==undefined && it.id!==null)) itemById.set(it.id, it);
    }

    const progress = { phase:'main', iters:0, tailIters:0, currentAttempt:0, currentTailAttempt:0, step:'idle' };
    let lastProgressKey = '';
    function reportProgress(force){
      try{
        const bestRef = _bestSoFar || best;
        const bestMsg = bestRef ? { sheets: bestRef.sc.sheets, waste: bestRef.sc.waste } : null;
        const key = [progress.phase, progress.iters, progress.tailIters, progress.currentAttempt, progress.currentTailAttempt, progress.step, bestMsg ? bestMsg.sheets : '-', bestMsg ? Math.round(bestMsg.waste) : '-'].join('|');
        if(!force && key === lastProgressKey) return;
        lastProgressKey = key;
        self.postMessage({
          type:'progress',
          phase: progress.phase,
          step: progress.step,
          elapsedMs: Math.round(now() - started),
          iters: progress.iters,
          currentAttempt: progress.currentAttempt,
          maxAttempts,
          tailIters: progress.tailIters,
          currentTailAttempt: progress.currentTailAttempt,
          endgameAttempts,
          best: bestMsg,
        });
      }catch(_){ }
    }

    _heartbeat = setInterval(()=>{
      try{
        if(_cancelled) return;
        if(progress.step === 'running' || progress.phase === 'tail') reportProgress(true);
      }catch(_){ }
    }, 250);



    // deterministic runs first
    let best = null;

    if(cutMode === 'optima' && opt.packOptima){
      progress.phase = 'main';
      progress.step = 'running';
      progress.currentAttempt = 1;
      reportProgress(true);
      const sheets = packOne(items, cutMode, perSheetMs);
      const sc = scoreSheets(sheets);
      best = { sheets, sc };
      setBest(best);
      progress.iters = 1;
      progress.currentAttempt = 1;
      progress.step = 'done-main';
      reportProgress(true);
      return { sheets: best.sheets, cancelled: _cancelled };
    }
    const tryOne = (arr)=>{
      for(const pref of prefList){
        if(_cancelled) return;
        const sheets = packOne(arr, pref, perSheetMs);
        const sc = scoreSheets(sheets);
        const res = { sheets, sc };
        if(better(res, best)) best = res;
        setBest(res);
      }
    };
    let iters = 0;
    for(const arr of base){
      if(_cancelled || iters >= maxAttempts || (now() - started) >= hardStopMs) break;
      progress.phase = 'main';
      progress.step = 'running';
      progress.currentAttempt = Math.min(maxAttempts, iters + 1);
      reportProgress(true);
      tryOne(arr);
      iters++;
      progress.iters = iters;
      progress.currentAttempt = Math.min(maxAttempts, iters + 1);
      progress.step = 'running';
      reportProgress(true);
    }

    // randomized multi-start
    progress.phase = 'main';
    while(iters < maxAttempts && (now() - started) < hardStopMs){
      if(_cancelled) break;
      progress.phase = 'main';
      progress.step = 'running';
      progress.currentAttempt = Math.min(maxAttempts, iters + 1);
      reportProgress(true);
      const seed = (Date.now() + iters*9973) >>> 0;
      const rnd = mulberry32(seed);
      const pick = base[Math.floor(rnd()*base.length)];
      // mix: shuffle within buckets (keeps some structure)
      const arr = shuffle(pick, rnd);
      tryOne(arr);
      iters++;
      progress.iters = iters;
      progress.currentAttempt = Math.min(maxAttempts, iters + 1);
      progress.step = 'running';
      reportProgress(true);
    }
    progress.iters = iters;
    progress.currentAttempt = Math.min(maxAttempts, iters);
    progress.step = 'done-main';
    reportProgress(true);



    if(best) return { sheets: best.sheets, cancelled: _cancelled };
    // Fallback: evaluate the normalized preferred direction once more.
    let fallbackBest = null;
    for(const pref of prefList){
      if(_cancelled) break;
      const sheets = packOne(items, pref, perSheetMs);
      const sc = scoreSheets(sheets);
      const res = { sheets, sc };
      if(better(res, fallbackBest)) fallbackBest = res;
      setBest(res);
    }
    return { sheets: fallbackBest ? fallbackBest.sheets : [], cancelled: _cancelled };
    } finally {
      try{ if(_heartbeat) clearInterval(_heartbeat); }catch(_){ }
    }
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

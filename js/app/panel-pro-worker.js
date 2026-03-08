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

  function groupAreaStats(items, keyFn){
    const map = new Map();
    for(const it of (items||[])){
      const key = keyFn(it);
      const prev = map.get(key) || { count:0, area:0 };
      prev.count += 1;
      prev.area += (Number(it.w)||0) * (Number(it.h)||0);
      map.set(key, prev);
    }
    let best = 0;
    let repeated = 0;
    for(const v of map.values()){
      if(v.count >= 2){
        if(v.area > best) best = v.area;
        repeated += v.area;
      }
    }
    return { best, repeated };
  }

  function groupAreaMax(items, keyFn){
    return groupAreaStats(items, keyFn).best;
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

  function sheetStructureMetrics(sheet){
    const pls = (sheet && Array.isArray(sheet.placements)) ? sheet.placements.filter(p=>p && !p.unplaced) : [];
    if(pls.length < 2) return { bandArea:0, repeatedArea:0, axisCoherence:0, usedArea:0 };
    const usedArea = pls.reduce((sum,p)=> sum + ((Number(p.w)||0) * (Number(p.h)||0)), 0);
    const byWidth = groupAreaStats(pls, p=>'w:' + p.w);
    const byHeight = groupAreaStats(pls, p=>'h:' + p.h);
    const byRowBand = groupAreaStats(pls, p=>'row:' + p.y + ':' + p.h);
    const byColBand = groupAreaStats(pls, p=>'col:' + p.x + ':' + p.w);
    const bandArea = Math.max(byWidth.best, byHeight.best, byRowBand.best, byColBand.best);
    const repeatedRows = byRowBand.repeated + byHeight.repeated * 0.35;
    const repeatedCols = byColBand.repeated + byWidth.repeated * 0.35;
    const repeatedArea = Math.max(repeatedRows, repeatedCols);
    const axisCoherence = usedArea > 0 ? Math.max(repeatedRows, repeatedCols) / usedArea : 0;
    return { bandArea, repeatedArea, axisCoherence, usedArea };
  }

  function sheetBandArea(sheet){
    return sheetStructureMetrics(sheet).bandArea;
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
      const structure = sheetStructureMetrics(s);
      const bandArea = structure.bandArea;
      const repeatedArea = structure.repeatedArea;
      const axisCoherence = structure.axisCoherence;
      const narrowScrapArea = free.reduce((sum,r)=>{
        const minSide = Math.min(r.w, r.h);
        return sum + (minSide < 120 ? (r.w*r.h) : 0);
      }, 0);

      if(free.length > 4){
        waste += area * Math.min(0.06, (free.length - 4) * 0.010);
      }
      if(largestFree > 0){
        waste -= Math.min(area * 0.03, largestFree * 0.12);
      }
      if(stripFree > 0){
        waste -= Math.min(area * 0.04, stripFree * 0.18);
      }
      if(bandArea > 0){
        waste -= Math.min(area * 0.06, bandArea * 0.08);
      }
      if(repeatedArea > 0){
        waste -= Math.min(area * 0.07, repeatedArea * 0.05);
      }
      if(axisCoherence > 0.58){
        waste -= area * Math.min(0.05, (axisCoherence - 0.58) * 0.18);
      } else if(axisCoherence < 0.42){
        waste += area * Math.min(0.05, (0.42 - axisCoherence) * 0.16);
      }
      if(narrowScrapArea > 0){
        waste += Math.min(area * 0.05, narrowScrapArea * 0.12);
      }

      // Lekka kara za "poszarpaną" ostatnią płytę z wieloma małymi wyspami.
      if(s === arr[arr.length-1]){
        const pls2 = (s && s.placements) ? s.placements.filter(p=>p && !p.unplaced) : [];
        if(pls2.length > 0){
          const bbox = pls2.reduce((acc,p)=>({
            minX: Math.min(acc.minX, p.x),
            minY: Math.min(acc.minY, p.y),
            maxX: Math.max(acc.maxX, p.x + p.w),
            maxY: Math.max(acc.maxY, p.y + p.h),
          }), { minX:1e18, minY:1e18, maxX:-1e18, maxY:-1e18 });
          const bw = Math.max(0, bbox.maxX - bbox.minX);
          const bh = Math.max(0, bbox.maxY - bbox.minY);
          const bboxArea = bw * bh;
          const usedArea = pls2.reduce((sum,p)=> sum + ((p.w||0)*(p.h||0)), 0);
          if(bboxArea > 0){
            const fill = usedArea / bboxArea;
            if(fill < 0.74) waste += area * 0.02;
          }
        }
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

    const timeBudgetMs = Math.max(1000, Math.round(Number(opts && opts.timeBudgetMs) || 30000));
    const perSheetMs = Math.max(120, Math.round(Number(opts && opts.perSheetMs) || 420));
    const beamWidth = Math.max(40, Math.round(Number(opts && opts.beamWidth) || 220));
    const cutPref = (opts && (opts.cutPref || opts.direction)) || 'auto';
    const cutMode = (opts && opts.cutMode) || 'optional';
    const minScrapW = Math.max(0, Math.round((opts && opts.minScrapW != null) ? Number(opts.minScrapW) : 100));
    const minScrapH = Math.max(0, Math.round((opts && opts.minScrapH != null) ? Number(opts.minScrapH) : 100));
    const edgeTrimNewSheet = Math.max(0, Math.round((opts && opts.edgeTrimNewSheet != null) ? Number(opts.edgeTrimNewSheet) : 0));
    const edgeTrimScrap = Math.max(0, Math.round((opts && opts.edgeTrimScrap != null) ? Number(opts.edgeTrimScrap) : 0));
    const hybridRuns = Math.max(1, Math.round(Number(opts && opts.hybridRuns) || 1));
    // NOTE (praktyka): "auto" w packGuillotineBeam potrafi generować układy
    // OK procentowo, ale fatalne pod piłę (mnóstwo zmian kierunku cięcia).
    // W Ultra "Auto" oznacza: wybierz najlepsze spośród along/across.
    const prefList = (cutPref === 'auto') ? ['along','across'] : [cutPref];

    const packGuillotine = (arr, pref, ms)=>{
      const out = opt.packGuillotineBeam(arr, W, H, K, {
        beamWidth,
        timeMs: ms,
        cutPref: pref,
        scrapFirst: true,
        minScrapW,
        minScrapH,
        edgeTrimNewSheet,
        edgeTrimScrap,
      });
      attempts += 1;
      emitProgress(false);
      return out;
    };

    const packOptionalHybrid = (arr, pref, ms)=>{
      const candidates = [];
      const boardArea = W * H;

      const analyzeCandidate = (cand)=>{
        let repeatedArea = 0;
        let bandArea = 0;
        let axisCoherenceSum = 0;
        let usedArea = 0;
        for(const s of (cand.sheets||[])){
          const m = sheetStructureMetrics(s);
          repeatedArea += m.repeatedArea;
          bandArea += m.bandArea;
          axisCoherenceSum += m.axisCoherence;
          usedArea += m.usedArea;
        }
        return {
          repeatedArea,
          bandArea,
          coherence: usedArea > 0 ? Math.max(0, Math.min(1, repeatedArea / usedArea)) : 0,
          avgAxisCoherence: (cand.sheets && cand.sheets.length) ? (axisCoherenceSum / cand.sheets.length) : 0,
        };
      };

      const chooseBetterCandidate = (a, b)=>{
        if(!b) return a;
        if(!a) return b;
        if(a.sc.sheets !== b.sc.sheets) return (a.sc.sheets < b.sc.sheets) ? a : b;

        const wasteGap = Math.abs(a.sc.waste - b.sc.waste);
        const structureMargin = boardArea * 0.04;
        const aStrip = /^strip/.test(a.family);
        const bStrip = /^strip/.test(b.family);

        if(aStrip !== bStrip && wasteGap <= structureMargin){
          return aStrip ? a : b;
        }

        const aScore = a.sc.waste - (a.meta.repeatedArea * 0.045) - (a.meta.bandArea * 0.035) - (boardArea * Math.max(0, a.meta.avgAxisCoherence - 0.62) * 0.55);
        const bScore = b.sc.waste - (b.meta.repeatedArea * 0.045) - (b.meta.bandArea * 0.035) - (boardArea * Math.max(0, b.meta.avgAxisCoherence - 0.62) * 0.55);
        if(Math.abs(aScore - bScore) > (boardArea * 0.012)) return (aScore < bScore) ? a : b;
        return (a.sc.waste <= b.sc.waste) ? a : b;
      };

      const add = (family, sheets, alreadyCounted)=>{
        if(!alreadyCounted) attempts += 1;
        if(Array.isArray(sheets) && sheets.length){
          const sc = scoreSheets(sheets);
          candidates.push({ family, sheets, sc, meta: analyzeCandidate({ sheets }) });
        }
        emitProgress(false);
      };

      add('guillotine-' + pref, packGuillotine(arr, pref, ms), true);
      const altPref = (pref === 'along') ? 'across' : 'along';
      if(pref !== altPref){
        add('guillotine-' + altPref, packGuillotine(arr, altPref, Math.max(120, Math.round(ms * 0.8))), true);
      }
      if(opt.packStripBands){
        add('strip-along', opt.packStripBands(arr, W, H, K, 'along', { edgeTrimNewSheet }));
        add('strip-across', opt.packStripBands(arr, W, H, K, 'across', { edgeTrimNewSheet }));
      }

      let best = null;
      for(const cand of candidates) best = chooseBetterCandidate(cand, best);

      // Heavy profiles: deepen only the family that already looks promising.
      if(hybridRuns > 1 && best && best.sheets && best.sheets.length){
        const extraFamily = /^strip/.test(best.family) ? best.family.replace(/^strip-/, '') : best.family.replace(/^guillotine-/, '');
        for(let i=1;i<hybridRuns;i++){
          const extraMs = Math.max(ms, Math.round(ms * (1 + i*0.30)));
          add('guillotine-' + extraFamily, packGuillotine(arr, extraFamily, extraMs), true);
        }
        best = null;
        for(const cand of candidates) best = chooseBetterCandidate(cand, best);
      }
      return best ? best.sheets : [];
    };

    const packOne = (arr, pref, ms)=>{
      if(cutMode === 'along' || cutMode === 'across'){
        if(opt.packStripBands){
          return opt.packStripBands(arr, W, H, K, cutMode, { edgeTrimNewSheet });
        }
      }
      if(cutMode === 'optional') return packOptionalHybrid(arr, pref, ms);
      return packGuillotine(arr, pref, ms);
    };

    const started = now();
    const base = sortVariants(items);
    let attempts = 0;
    let lastProgress = started;

    const emitProgress = (force)=>{
      const t = now();
      if(!force && (t - lastProgress) <= 180) return;
      lastProgress = t;
      self.postMessage({
        type:'progress',
        elapsedMs: Math.round(t - started),
        iters: attempts,
        best: best ? { sheets: best.sc.sheets, waste: best.sc.waste } : (_bestSoFar ? { sheets: _bestSoFar.sc.sheets, waste: _bestSoFar.sc.waste } : null),
      });
    };

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
        const sheets = packOne(arr, pref, perSheetMs);
        const sc = scoreSheets(sheets);
        const res = { sheets, sc };
        if(better(res, best)) best = res;
        setBest(res);
      }
    };
    base.forEach(tryOne);

    emitProgress(true);

    // randomized multi-start
    while(now() - started < timeBudgetMs){
      if(_cancelled) break;
      const seed = (Date.now() + attempts*9973) >>> 0;
      const rnd = mulberry32(seed);
      const pick = base[Math.floor(rnd()*base.length)];
      // mix: shuffle within buckets (keeps some structure)
      const arr = shuffle(pick, rnd);
      tryOne(arr);
      emitProgress(false);
    }

    emitProgress(true);

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
      const newTail = packOne(uniq, cutPref, Math.min(260, Math.max(120, Math.round(perSheetMs * 0.6))));

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
              iters: attempts + t + 1,
              best: bestLocal ? { sheets: bestLocal.sc.sheets, waste: bestLocal.sc.waste } : null,
            });
          }catch(_){ }
        }
      }

      return bestLocal;
    }

    if(best && !_cancelled && cutMode === 'optional'){
      best = doCrazyPostPass(best);
    }

    // === Optimax post-pass: strip-first + fill long strips with small parts from tail ===
    // Triggered only when opts.optimax=true.
    // Idea: if an earlier sheet has a long free strip (full height/width), treat it as a temporary "magazyn".
    // Then try to pack small parts taken from the last ~35% of sheets into those strips.
    // Finally, repack the remaining tail pool. This often removes the "pusta ostatnia płyta" and reduces waste.
    function doOptimaxStripFill(currentBest){
      if(_cancelled) return currentBest;
      if(!currentBest || !Array.isArray(currentBest.sheets)) return currentBest;
      const sheets0 = currentBest.sheets;
      if(sheets0.length < 2) return currentBest;

      const tailCount = Math.max(1, Math.ceil(sheets0.length * 0.35));
      const tailStart = Math.max(0, sheets0.length - tailCount);
      if(tailStart <= 0) return currentBest;

      // Pool ids from tail sheets
      const poolIds = [];
      for(let i=tailStart;i<sheets0.length;i++) poolIds.push(...idsFromSheet(sheets0[i]));
      if(!poolIds.length) return currentBest;

      // Build pool items (small-first)
      const poolItems = [];
      {
        const seen = new Set();
        for(const id of poolIds){
          if(seen.has(id)) continue;
          seen.add(id);
          const it = itemById.get(id);
          if(it) poolItems.push(it);
        }
        poolItems.sort((a,b)=> (a.w*a.h) - (b.w*b.h));
      }

      // Clone prefix sheets and keep their placements; we'll add placements into strips.
      const prefix = [];
      for(let i=0;i<tailStart;i++){
        const s = sheets0[i];
        prefix.push({ boardW:s.boardW, boardH:s.boardH, placements: (s.placements||[]).slice(), _freeRects: (s._freeRects||[]).slice() });
      }

      const remainingById = new Set(poolItems.map(it=>it.id));
      const removeFromSet = (ids)=>{ for(const id of ids){ remainingById.delete(id); } };

      // Find strip-like free rects: full height/width (within 5%) and at least 30cm thickness.
      // Dodatkowo: nie chcemy obracać "wielkiej płyty" – pas do obracania max 1000 mm.
      const minStrip = 300; // mm
      const maxRotateStrip = 1000; // mm
      const strips = [];
      for(let si=0; si<prefix.length; si++){
        const s = prefix[si];
        const fr = Array.isArray(s._freeRects) ? s._freeRects : [];
        for(const r of fr){
          if(!r || r.w<=0 || r.h<=0) continue;
          const fullH = (r.h >= (H * 0.95)) && (r.w >= minStrip);
          const fullW = (r.w >= (W * 0.95)) && (r.h >= minStrip);
          // tylko pasy, które mają "grubość" <= 1 m – wtedy realnie da się je obracać.
          const thick = fullH ? r.w : (fullW ? r.h : 1e18);
          if((fullH || fullW) && thick <= maxRotateStrip){
            strips.push({ sheetIndex: si, rect: r, fullH, fullW });
          }
        }
      }
      if(!strips.length) return currentBest;

      // Try to fill strips with up to N small parts.
      // We do a few rounds; keep it cheap.
      let poolCursor = 0;
      for(const srec of strips){
        if(_cancelled) break;
        if(poolCursor >= poolItems.length) break;

        const rect = srec.rect;
        // build subset of remaining small items
        const subset = [];
        let tries = 0;
        while(poolCursor < poolItems.length && subset.length < 30 && tries < 120){
          const it = poolItems[poolCursor++];
          tries++;
          if(!it) continue;
          if(!remainingById.has(it.id)) continue;
          subset.push(it);
        }
        if(!subset.length) continue;

        // Prefer stable cut direction within a strip.
        const stripPref = srec.fullH ? 'along' : 'across';
        const packed = (opt.packStripBands && (cutMode === 'along' || cutMode === 'across'))
          ? opt.packStripBands(subset, rect.w, rect.h, K, stripPref, { edgeTrimNewSheet: 0 })
          : opt.packGuillotineBeam(subset, rect.w, rect.h, K, {
              beamWidth: Math.max(60, Math.min(140, Math.round(beamWidth*0.6))),
              timeMs: 140,
              cutPref: stripPref,
              scrapFirst: false,
              minScrapW,
              minScrapH,
            });
        if(!packed || !packed[0] || !Array.isArray(packed[0].placements)) continue;
        const pls = packed[0].placements.filter(p=>p && !p.unplaced);
        if(!pls.length) continue;

        // Apply placements into the parent sheet with offset.
        const dst = prefix[srec.sheetIndex];
        for(const p of pls){
          dst.placements.push({
            id: p.id,
            key: p.key,
            name: p.name,
            x: rect.x + p.x,
            y: rect.y + p.y,
            w: p.w,
            h: p.h,
            rotated: !!p.rotated,
            unplaced: false,
          });
        }
        removeFromSet(pls.map(p=>p.id));

        // progress ping
        const tt = now();
        if(tt - started > 800){
          try{
            self.postMessage({
              type:'progress',
              elapsedMs: Math.round(tt - started),
              iters: attempts,
              best: _bestSoFar ? { sheets:_bestSoFar.sc.sheets, waste:_bestSoFar.sc.waste } : null,
            });
          }catch(_){ }
        }
      }

      // Build remaining pool and repack into tail.
      const remItems = [];
      for(const it of poolItems){
        if(remainingById.has(it.id)) remItems.push(it);
      }
      if(!remItems.length) {
        // Tail eliminated.
        const sc = scoreSheets(prefix);
        const res = { sheets: prefix, sc };
        if(better(res, currentBest)) return res;
        return currentBest;
      }

      // Repack remaining tail.
      const newTail = packOne(remItems, (opts && (opts.cutPref||opts.direction)) || 'along', Math.min(260, Math.max(140, Math.round(perSheetMs*0.7))));
      const combined = prefix.concat(newTail||[]);
      const sc = scoreSheets(combined);
      const res = { sheets: combined, sc };
      if(better(res, currentBest)) return res;
      return currentBest;
    }

    if(best && !_cancelled && opts && opts.optimax && cutMode === 'optional'){
      best = doOptimaxStripFill(best);
      setBest(best);
    }

    if(best){ emitProgress(true); return { sheets: best.sheets, cancelled: _cancelled }; }
    // Fallback: still evaluate both preferences when auto.
    let fallbackBest = null;
    for(const pref of prefList){
      if(_cancelled) break;
      const sheets = packOne(items, pref, perSheetMs);
      const sc = scoreSheets(sheets);
      const res = { sheets, sc };
      if(better(res, fallbackBest)) fallbackBest = res;
      setBest(res);
    }
    emitProgress(true);
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

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

  function tailMetrics(sheets){
    const arr = Array.isArray(sheets) ? sheets : [];
    const boardArea = (sheet)=> Math.max(1, (Number(sheet && sheet.boardW) || 0) * (Number(sheet && sheet.boardH) || 0));
    const usedArea = (sheet)=> ((sheet && Array.isArray(sheet.placements)) ? sheet.placements : []).reduce((sum,p)=> sum + ((p && !p.unplaced) ? ((Number(p.w)||0) * (Number(p.h)||0)) : 0), 0);
    const bboxFill = (sheet)=>{
      const pls = (sheet && Array.isArray(sheet.placements)) ? sheet.placements.filter(p=>p && !p.unplaced) : [];
      if(!pls.length) return 0;
      const bbox = pls.reduce((acc,p)=>({
        minX: Math.min(acc.minX, p.x),
        minY: Math.min(acc.minY, p.y),
        maxX: Math.max(acc.maxX, p.x + p.w),
        maxY: Math.max(acc.maxY, p.y + p.h),
      }), { minX:1e18, minY:1e18, maxX:-1e18, maxY:-1e18 });
      const bw = Math.max(0, bbox.maxX - bbox.minX);
      const bh = Math.max(0, bbox.maxY - bbox.minY);
      const area = bw * bh;
      const used = usedArea(sheet);
      return area > 0 ? (used / area) : 0;
    };
    const last = arr.length ? arr[arr.length - 1] : null;
    const prev = arr.length > 1 ? arr[arr.length - 2] : null;
    const lastArea = boardArea(last);
    const prevArea = boardArea(prev);
    const lastUsed = usedArea(last);
    const prevUsed = usedArea(prev);
    const lastFree = last ? meaningfulFreeRects(last).reduce((mx,r)=>Math.max(mx, r.w*r.h), 0) : 0;
    const prevFree = prev ? meaningfulFreeRects(prev).reduce((mx,r)=>Math.max(mx, r.w*r.h), 0) : 0;
    const tailArea = lastArea + prevArea;
    const tailUsed = lastUsed + prevUsed;
    return {
      lastUsedRatio: lastArea > 0 ? (lastUsed / lastArea) : 0,
      prevUsedRatio: prevArea > 0 ? (prevUsed / prevArea) : 0,
      tail2UsedRatio: tailArea > 0 ? (tailUsed / tailArea) : 0,
      lastBBoxFill: bboxFill(last),
      prevBBoxFill: bboxFill(prev),
      lastLargestFree: lastFree,
      prevLargestFree: prevFree,
    };
  }

  function tailAwareBetter(a, b, boardArea){
    if(!b) return true;
    if(!a) return false;
    if(a.sc.sheets !== b.sc.sheets) return a.sc.sheets < b.sc.sheets;
    const margin = Math.max(boardArea * 0.08, 1);
    const ta = tailMetrics(a.sheets);
    const tb = tailMetrics(b.sheets);
    const wasteGap = Math.abs(a.sc.waste - b.sc.waste);
    if(wasteGap <= margin){
      if(Math.abs(ta.lastUsedRatio - tb.lastUsedRatio) >= 0.09) return ta.lastUsedRatio > tb.lastUsedRatio;
      if(Math.abs(ta.tail2UsedRatio - tb.tail2UsedRatio) >= 0.06) return ta.tail2UsedRatio > tb.tail2UsedRatio;
      if(Math.abs(ta.lastBBoxFill - tb.lastBBoxFill) >= 0.10) return ta.lastBBoxFill > tb.lastBBoxFill;
    }
    if(wasteGap <= boardArea * 0.04){
      if(Math.abs(ta.lastUsedRatio - tb.lastUsedRatio) >= 0.05) return ta.lastUsedRatio > tb.lastUsedRatio;
    }
    return better(a, b);
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

      // Mocniejsza kara za słabo wykorzystaną / poszarpaną ostatnią płytę.
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
          const usedArea2 = pls2.reduce((sum,p)=> sum + ((p.w||0)*(p.h||0)), 0);
          const usedRatio = area > 0 ? (usedArea2 / area) : 0;
          if(bboxArea > 0){
            const fill = usedArea2 / bboxArea;
            if(fill < 0.80) waste += area * Math.min(0.060, (0.80 - fill) * 0.18);
          }
          if(usedRatio < 0.62){
            waste += area * Math.min(0.095, (0.62 - usedRatio) * 0.22);
          }
          const largestFree2 = meaningfulFreeRects(s).reduce((mx,r)=>Math.max(mx, r.w*r.h), 0);
          if(usedRatio < 0.52 && largestFree2 > area * 0.28){
            waste += area * 0.018;
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

  function makePlacementFromCandidate(it, cand, x, y){
    return {
      id: it.id,
      key: it.key,
      name: it.name,
      x, y,
      w: cand.w,
      h: cand.h,
      rotated: !!cand.rotated,
      edgeW1: cand.rotated ? it.edgeH1 : it.edgeW1,
      edgeW2: cand.rotated ? it.edgeH2 : it.edgeW2,
      edgeH1: cand.rotated ? it.edgeW1 : it.edgeH1,
      edgeH2: cand.rotated ? it.edgeW2 : it.edgeH2,
    };
  }

  function buildAdaptiveStripSheet(itemsIn, boardW, boardH, kerf, direction, options){
    const W = Math.max(10, Math.round(Number(boardW)||0));
    const H = Math.max(10, Math.round(Number(boardH)||0));
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const swap = (direction === 'across' || direction === 'wpoprz');
    const BW = swap ? H : W;
    const BH = swap ? W : H;
    const trimNew = Math.max(0, Math.round(Number(options && options.edgeTrimNewSheet) || 0));
    const rem = (itemsIn || []).map(it=>Object.assign({}, it));

    const workX = trimNew;
    const workY = trimNew;
    const workW = Math.max(10, BW - 2 * trimNew);
    const workH = Math.max(10, BH - 2 * trimNew);
    const maxX = workX + workW;
    const maxY = workY + workH;

    function candidatesForItem(it){
      const out = [{ w: Number(it.w)||0, h: Number(it.h)||0, rotated:false }];
      if(it.rotationAllowed) out.push({ w: Number(it.h)||0, h: Number(it.w)||0, rotated:true });
      return out.filter(c=>c.w > 0 && c.h > 0);
    }

    function swapRectBack(r){
      return { x:r.y, y:r.x, w:r.h, h:r.w };
    }

    function swapPlacementBack(p){
      const nx = p.y;
      const ny = p.x;
      const nw = p.h;
      const nh = p.w;
      const ew1 = p.edgeW1, ew2 = p.edgeW2, eh1 = p.edgeH1, eh2 = p.edgeH2;
      p.x = nx; p.y = ny; p.w = nw; p.h = nh;
      p.edgeW1 = eh1; p.edgeW2 = eh2;
      p.edgeH1 = ew1; p.edgeH2 = ew2;
      return p;
    }

    function chooseBandHeight(availH, availW){
      const stats = new Map();
      let fallback = null;
      for(let i=0;i<rem.length;i++){
        const it = rem[i];
        for(const cand of adaptiveCandidatesForItem(it)){
          if(cand.w > availW || cand.h > availH) continue;
          const key = cand.h;
          let st = stats.get(key);
          if(!st){
            st = { h:cand.h, count:0, area:0, width:0, maxW:0, exact2:0 };
            stats.set(key, st);
          }
          st.count += 1;
          st.area += cand.w * cand.h;
          st.width += cand.w;
          st.maxW = Math.max(st.maxW, cand.w);
          if(cand.h === key) st.exact2 += 1;
          const fbScore = (cand.w * cand.h) + (cand.h * 1000) + cand.w;
          if(!fallback || fbScore > fallback.score){
            fallback = { h:cand.h, score:fbScore };
          }
        }
      }
      let best = null;
      for(const st of stats.values()){
        const repeated = st.count >= 2 ? 1 : 0;
        const fillPotential = Math.min(availW, st.width + Math.max(0, st.count - 1) * K);
        const score = (repeated * 9000000) + (st.count * 1600000) + (fillPotential * 320) + (st.area * 0.45) + (st.h * 900) + (st.maxW * 25);
        if(!best || score > best.score){
          best = { h:st.h, score, repeated };
        }
      }
      if(best) return best.h;
      return fallback ? fallback.h : 0;
    }

    function pickExactForBand(spaceW, bandH){
      let best = null;
      for(let i=0;i<rem.length;i++){
        const it = rem[i];
        for(const cand of adaptiveCandidatesForItem(it)){
          if(cand.h !== bandH || cand.w > spaceW) continue;
          const score = (cand.w * 1000000) + (cand.h * 1000) + (cand.w * cand.h);
          if(!best || score > best.score) best = { idx:i, it, cand, score };
        }
      }
      return best;
    }

    function pickTailFiller(spaceW, bandH){
      let best = null;
      for(let i=0;i<rem.length;i++){
        const it = rem[i];
        for(const cand of adaptiveCandidatesForItem(it)){
          if(cand.w > spaceW || cand.h > bandH) continue;
          const gapH = bandH - cand.h;
          const gapW = spaceW - cand.w;
          const exactH = gapH === 0 ? 1 : 0;
          const score = (exactH * 7000000) - (gapH * 3800) - (gapW * 45) + (cand.w * cand.h * 0.8) + (cand.w * 600);
          if(!best || score > best.score) best = { idx:i, it, cand, score };
        }
      }
      return best;
    }

    const sheet = { boardW: W, boardH: H, placements: [], _freeRects: [] };
    const placedIds = [];
    let cursorY = workY;
    let exactArea = 0;
    let fillerArea = 0;
    let rowCount = 0;

    while(rem.length && cursorY < maxY){
      const availH = maxY - cursorY;
      const bandH = chooseBandHeight(availH, workW);
      if(!bandH) break;
      let cursorX = workX;
      let rowPlaced = 0;
      let rowUsedW = 0;

      while(rem.length && cursorX < maxX){
        const exact = pickExactForBand(maxX - cursorX, bandH);
        if(!exact) break;
        const p = makePlacementFromCandidate(exact.it, exact.cand, cursorX, cursorY);
        sheet.placements.push(p);
        placedIds.push(exact.it.id);
        exactArea += p.w * p.h;
        rowPlaced += 1;
        rowUsedW += p.w;
        cursorX += p.w + K;
        rem.splice(exact.idx, 1);
      }

      while(rem.length && cursorX < maxX){
        const filler = pickTailFiller(maxX - cursorX, bandH);
        if(!filler) break;
        const p = makePlacementFromCandidate(filler.it, filler.cand, cursorX, cursorY);
        sheet.placements.push(p);
        placedIds.push(filler.it.id);
        fillerArea += p.w * p.h;
        rowPlaced += 1;
        rowUsedW += p.w;
        cursorX += p.w + K;
        rem.splice(filler.idx, 1);
      }

      if(!rowPlaced) break;
      rowCount += 1;
      const tailW = Math.max(0, maxX - cursorX);
      if(tailW >= 80 && bandH >= 80){
        sheet._freeRects.push({ x: cursorX, y: cursorY, w: tailW, h: bandH });
      }
      cursorY += bandH + K;
    }

    const bottomH = Math.max(0, maxY - cursorY);
    if(bottomH >= 80 && workW >= 80){
      sheet._freeRects.push({ x: workX, y: cursorY, w: workW, h: bottomH });
    }

    if(!sheet.placements.length && rem.length){
      const it = rem[0];
      sheet.placements.push({ id: it.id, key: it.key, name: it.name, x:0, y:0, w:it.w, h:it.h, rotated:false, unplaced:true });
    }

    if(swap){
      sheet.placements = sheet.placements.map(p=> swapPlacementBack(p));
      sheet._freeRects = sheet._freeRects.map(swapRectBack);
    }
    sheet.boardW = W;
    sheet.boardH = H;

    return {
      sheet,
      placedIds,
      exactArea,
      fillerArea,
      rowCount,
      usedArea: sheet.placements.reduce((sum,p)=> sum + ((p && !p.unplaced) ? ((p.w||0)*(p.h||0)) : 0), 0),
      remaining: rem,
      direction,
    };
  }


  function adaptiveCandidatesForItem(it){
    const out = [{ w: Number(it.w)||0, h: Number(it.h)||0, rotated:false }];
    if(it && it.rotationAllowed) out.push({ w: Number(it.h)||0, h: Number(it.w)||0, rotated:true });
    return out.filter(c=>c.w > 0 && c.h > 0);
  }

  function chooseRegionLineSizes(rem, region, axis, K, limit){
    const stats = new Map();
    let fallback = null;
    const rw = Math.max(0, Number(region && region.w) || 0);
    const rh = Math.max(0, Number(region && region.h) || 0);
    const cap = Math.max(1, Math.round(Number(limit) || 1));
    for(let i=0;i<rem.length;i++){
      const it = rem[i];
      for(const cand of adaptiveCandidatesForItem(it)){
        if(cand.w > rw || cand.h > rh) continue;
        const key = axis === 'col' ? cand.w : cand.h;
        let st = stats.get(key);
        if(!st){
          st = { size:key, count:0, area:0, primary:0, maxPrimary:0, exactCount:0 };
          stats.set(key, st);
        }
        const primary = axis === 'col' ? cand.h : cand.w;
        st.count += 1;
        st.area += cand.w * cand.h;
        st.primary += primary;
        st.maxPrimary = Math.max(st.maxPrimary, primary);
        if((axis === 'col' ? cand.w : cand.h) === key) st.exactCount += 1;
        const fbScore = (cand.w * cand.h) + (key * 1000) + primary;
        if(!fallback || fbScore > fallback.score){
          fallback = { size:key, score:fbScore, repeated:0 };
        }
      }
    }
    const regionPrimary = axis === 'col' ? rh : rw;
    const ranked = [];
    for(const st of stats.values()){
      const repeated = st.count >= 2 ? 1 : 0;
      const kerfNeed = Math.max(0, st.count - 1) * K;
      const fillPotential = Math.min(regionPrimary, st.primary + kerfNeed);
      const score = (repeated * 9000000) + (st.count * 1500000) + (fillPotential * 320) + (st.area * 0.42) + (st.size * 800) + (st.maxPrimary * 22);
      ranked.push({ size:st.size, score, repeated });
    }
    ranked.sort((a,b)=> b.score - a.score);
    if(!ranked.length && fallback) ranked.push(fallback);
    return ranked.slice(0, cap);
  }

  function chooseRegionLineSize(rem, region, axis, K){
    const arr = chooseRegionLineSizes(rem, region, axis, K, 1);
    return arr.length ? arr[0].size : 0;
  }
  function chooseRegionSplitSizes(rem, region, axis, K, limit){
    const rw = Math.max(0, Number(region && region.w) || 0);
    const rh = Math.max(0, Number(region && region.h) || 0);
    const regionSpan = axis === 'col' ? rw : rh;
    const sizes = chooseRegionLineSizes(rem, region, axis, K, Math.max(2, Math.round(Number(limit) || 2) + 1))
      .map(x=> Math.max(0, Math.round(Number(x && x.size) || 0)));
    const out = [];
    const seen = new Set();
    for(const raw of sizes){
      const sz = Math.max(80, raw);
      if(sz >= regionSpan - 80) continue;
      if(seen.has(sz)) continue;
      seen.add(sz);
      out.push(sz);
    }
    const half = Math.max(80, Math.round((regionSpan - K) / 2));
    if(half >= 80 && half <= regionSpan - 80 && !seen.has(half)) out.push(half);
    const twoThirds = Math.max(80, Math.round((regionSpan - K) * 0.62));
    if(twoThirds >= 80 && twoThirds <= regionSpan - 80 && !seen.has(twoThirds)) out.push(twoThirds);
    return out.slice(0, Math.max(1, Math.round(Number(limit) || 1)));
  }

  function buildRegionSplitCandidate(region, axis, splitSize, K, state){
    const rw = Math.max(0, Number(region && region.w) || 0);
    const rh = Math.max(0, Number(region && region.h) || 0);
    const cut = Math.max(80, Math.round(Number(splitSize) || 0));
    if(axis === 'row'){
      if(cut >= rh - 80) return null;
      const bottomY = region.y + cut + K;
      const bottomH = Math.max(0, region.y + rh - bottomY);
      if(bottomH < 80) return null;
      const top = { x: region.x, y: region.y, w: rw, h: cut };
      const bottom = { x: region.x, y: bottomY, w: rw, h: bottomH };
      const balance = 1 - (Math.abs(top.h - bottom.h) / Math.max(1, rh));
      let score = state.boardArea * 0.001;
      score += (balance * state.boardArea * 0.0035);
      if(state.prefDir === 'along') score += state.boardArea * 0.0025;
      return { kind:'split', axis, lineSize:cut, placements:[], usedIdx:[], regions:[top, bottom], usedArea:0, score };
    }
    if(cut >= rw - 80) return null;
    const rightX = region.x + cut + K;
    const rightW = Math.max(0, region.x + rw - rightX);
    if(rightW < 80) return null;
    const left = { x: region.x, y: region.y, w: cut, h: rh };
    const right = { x: rightX, y: region.y, w: rightW, h: rh };
    const balance = 1 - (Math.abs(left.w - right.w) / Math.max(1, rw));
    let score = state.boardArea * 0.001;
    score += (balance * state.boardArea * 0.0035);
    if(state.prefDir === 'across') score += state.boardArea * 0.0025;
    return { kind:'split', axis, lineSize:cut, placements:[], usedIdx:[], regions:[left, right], usedArea:0, score };
  }

  function pickRegionExact(rem, axis, lineSize, spacePrimary, regionSecondary, blocked){
    let best = null;
    for(let i=0;i<rem.length;i++){
      if(blocked && blocked.has(i)) continue;
      const it = rem[i];
      for(const cand of adaptiveCandidatesForItem(it)){
        const candPrimary = axis === 'col' ? cand.h : cand.w;
        const candSecondary = axis === 'col' ? cand.w : cand.h;
        if(candPrimary > spacePrimary || candSecondary !== lineSize || candSecondary > regionSecondary) continue;
        const score = (candPrimary * 1000000) + (candSecondary * 1000) + (cand.w * cand.h);
        if(!best || score > best.score) best = { idx:i, it, cand, score };
      }
    }
    return best;
  }

  function pickRegionFiller(rem, axis, lineSize, spacePrimary, blocked){
    let best = null;
    for(let i=0;i<rem.length;i++){
      if(blocked && blocked.has(i)) continue;
      const it = rem[i];
      for(const cand of adaptiveCandidatesForItem(it)){
        const candPrimary = axis === 'col' ? cand.h : cand.w;
        const candSecondary = axis === 'col' ? cand.w : cand.h;
        if(candPrimary > spacePrimary || candSecondary > lineSize) continue;
        const gapSecondary = lineSize - candSecondary;
        const gapPrimary = spacePrimary - candPrimary;
        const exactSecondary = gapSecondary === 0 ? 1 : 0;
        const score = (exactSecondary * 7000000) - (gapSecondary * 3800) - (gapPrimary * 42) + (cand.w * cand.h * 0.8) + (candPrimary * 600);
        if(!best || score > best.score) best = { idx:i, it, cand, score };
      }
    }
    return best;
  }

  function buildRegionBandCandidateForLine(rem, region, axis, lineSize, K, prefDir, boardArea){
    const rw = Math.max(0, Number(region && region.w) || 0);
    const rh = Math.max(0, Number(region && region.h) || 0);
    if(rw < 80 || rh < 80 || !lineSize) return null;

    const placements = [];
    const usedIdx = [];
    const blocked = new Set();
    let exactArea = 0;
    let fillerArea = 0;
    let exactCount = 0;
    let cursorPrimary = axis === 'col' ? region.y : region.x;
    const limitPrimary = axis === 'col' ? (region.y + rh) : (region.x + rw);
    const regionSecondary = axis === 'col' ? rw : rh;

    while(rem.length && cursorPrimary < limitPrimary){
      const exact = pickRegionExact(rem, axis, lineSize, limitPrimary - cursorPrimary, regionSecondary, blocked);
      if(!exact) break;
      const p = axis === 'col'
        ? makePlacementFromCandidate(exact.it, exact.cand, region.x, cursorPrimary)
        : makePlacementFromCandidate(exact.it, exact.cand, cursorPrimary, region.y);
      placements.push(p);
      usedIdx.push(exact.idx);
      blocked.add(exact.idx);
      exactArea += p.w * p.h;
      exactCount += 1;
      cursorPrimary += (axis === 'col' ? p.h : p.w) + K;
    }

    while(rem.length && cursorPrimary < limitPrimary){
      const filler = pickRegionFiller(rem, axis, lineSize, limitPrimary - cursorPrimary, blocked);
      if(!filler) break;
      const p = axis === 'col'
        ? makePlacementFromCandidate(filler.it, filler.cand, region.x, cursorPrimary)
        : makePlacementFromCandidate(filler.it, filler.cand, cursorPrimary, region.y);
      placements.push(p);
      usedIdx.push(filler.idx);
      blocked.add(filler.idx);
      fillerArea += p.w * p.h;
      cursorPrimary += (axis === 'col' ? p.h : p.w) + K;
    }

    if(!placements.length) return null;

    const usedArea = exactArea + fillerArea;
    const usedPrimary = Math.max(0, cursorPrimary - (axis === 'col' ? region.y : region.x) - K);
    const mainFill = axis === 'col'
      ? (rh > 0 ? (usedPrimary / rh) : 0)
      : (rw > 0 ? (usedPrimary / rw) : 0);
    const lineArea = axis === 'col' ? (lineSize * rh) : (rw * lineSize);
    const lineFill = lineArea > 0 ? (usedArea / lineArea) : 0;
    const regions = [];
    if(axis === 'row'){
      const tailW = Math.max(0, region.x + rw - cursorPrimary);
      if(tailW >= 80 && lineSize >= 80) regions.push({ x: cursorPrimary, y: region.y, w: tailW, h: lineSize });
      const bottomY = region.y + lineSize + K;
      const bottomH = Math.max(0, region.y + rh - bottomY);
      if(rw >= 80 && bottomH >= 80) regions.push({ x: region.x, y: bottomY, w: rw, h: bottomH });
    } else {
      const tailH = Math.max(0, region.y + rh - cursorPrimary);
      if(lineSize >= 80 && tailH >= 80) regions.push({ x: region.x, y: cursorPrimary, w: lineSize, h: tailH });
      const rightX = region.x + lineSize + K;
      const rightW = Math.max(0, region.x + rw - rightX);
      if(rightW >= 80 && rh >= 80) regions.push({ x: rightX, y: region.y, w: rightW, h: rh });
    }

    let score = usedArea + (exactArea * 0.28) + (exactCount * 22000) + (lineFill * (axis === 'col' ? (lineSize * rh) : (rw * lineSize)) * 0.55) + (mainFill * (axis === 'col' ? rh : rw) * 1200);
    if(exactCount >= 2) score += 160000;
    if(prefDir === 'along' && axis === 'row') score += boardArea * 0.004;
    if(prefDir === 'across' && axis === 'col') score += boardArea * 0.004;
    if(lineFill < 0.74) score -= boardArea * Math.min(0.020, (0.74 - lineFill) * 0.10);

    return { axis, region, lineSize, placements, usedIdx, regions, usedArea, exactArea, fillerArea, exactCount, score };
  }

  function buildRegionBandCandidate(rem, region, axis, K, prefDir, boardArea){
    const top = chooseRegionLineSizes(rem, region, axis, K, 1);
    return top.length ? buildRegionBandCandidateForLine(rem, region, axis, top[0].size, K, prefDir, boardArea) : null;
  }

  function removeItemsByIndices(rem, usedIdx){
    if(!Array.isArray(rem) || !rem.length) return [];
    const used = new Set(usedIdx || []);
    const out = [];
    for(let i=0;i<rem.length;i++) if(!used.has(i)) out.push(rem[i]);
    return out;
  }

  function regionArea(region){
    return Math.max(0, (Number(region && region.w) || 0) * (Number(region && region.h) || 0));
  }

  function chooseRegionAnchorCandidates(rem, region, limit){
    const rw = Math.max(0, Number(region && region.w) || 0);
    const rh = Math.max(0, Number(region && region.h) || 0);
    const cap = Math.max(1, Math.round(Number(limit) || 1));
    const out = [];
    for(let i=0;i<rem.length;i++){
      const it = rem[i];
      const baseW = Number(it && it.w) || 0;
      const baseH = Number(it && it.h) || 0;
      let sameW = 0;
      let sameH = 0;
      for(let j=0;j<rem.length;j++){
        if(i === j) continue;
        const jt = rem[j];
        const jw = Number(jt && jt.w) || 0;
        const jh = Number(jt && jt.h) || 0;
        if(jw === baseW || jh === baseW) sameW += 1;
        if(jh === baseH || jw === baseH) sameH += 1;
      }
      for(const cand of adaptiveCandidatesForItem(it)){
        if(cand.w > rw || cand.h > rh) continue;
        const fill = (cand.w * cand.h) / Math.max(1, rw * rh);
        const score = (cand.w * cand.h)
          + (Math.max(sameW, sameH) * 22000)
          + (Math.min(rw - cand.w, rh - cand.h) * -8)
          + (fill * 100000)
          + ((cand.w >= rw * 0.45 || cand.h >= rh * 0.45) ? 18000 : 0);
        out.push({ idx:i, it, cand, score });
      }
    }
    out.sort((a,b)=> b.score - a.score);
    return out.slice(0, cap);
  }

  function buildRegionBlockCandidate(rem, region, anchor, K, state){
    if(!anchor || !anchor.cand || !anchor.it) return null;
    const rw = Math.max(0, Number(region && region.w) || 0);
    const rh = Math.max(0, Number(region && region.h) || 0);
    const aw = Number(anchor.cand.w) || 0;
    const ah = Number(anchor.cand.h) || 0;
    if(aw <= 0 || ah <= 0 || aw > rw || ah > rh) return null;

    const placement = makePlacementFromCandidate(anchor.it, anchor.cand, region.x, region.y);
    const regions = [];
    const rightX = region.x + aw + K;
    const rightW = Math.max(0, region.x + rw - rightX);
    if(rightW >= 80 && ah >= 80) regions.push({ x: rightX, y: region.y, w: rightW, h: ah });
    const bottomY = region.y + ah + K;
    const bottomH = Math.max(0, region.y + rh - bottomY);
    if(rw >= 80 && bottomH >= 80) regions.push({ x: region.x, y: bottomY, w: rw, h: bottomH });

    let score = (aw * ah) * 1.05;
    score += Math.max(0, (rw * rh) * ((aw * ah) / Math.max(1, rw * rh)) * 0.12);
    score += (regions.length <= 2 ? state.boardArea * 0.002 : 0);
    if(state.prefDir === 'along' && aw >= ah) score += state.boardArea * 0.0015;
    if(state.prefDir === 'across' && ah >= aw) score += state.boardArea * 0.0015;
    return {
      kind: 'block',
      placements: [placement],
      usedIdx: [anchor.idx],
      regions,
      usedArea: aw * ah,
      score,
      anchorW: aw,
      anchorH: ah,
    };
  }

  function sortRegionsForRecursion(regions, mode){
    const arr = (regions || []).slice();
    if(mode === 'small-first') arr.sort((a,b)=> regionArea(a) - regionArea(b));
    else arr.sort((a,b)=> regionArea(b) - regionArea(a));
    return arr;
  }

  function solveRegionRecursive(rem, region, K, state, depth){
    const rw = Math.max(0, Number(region && region.w) || 0);
    const rh = Math.max(0, Number(region && region.h) || 0);
    if(!rem.length || rw < 80 || rh < 80){
      return { placements: [], placedIds: [], remaining: rem.slice(), freeRects: (rw >= 80 && rh >= 80) ? [region] : [], usedArea: 0, score: 0, depth };
    }
    if(state.deadline && now() > state.deadline){
      return { placements: [], placedIds: [], remaining: rem.slice(), freeRects: [region], usedArea: 0, score: 0, depth, timedOut:true };
    }
    if(state.nodeBudget <= 0 || depth >= state.maxDepth){
      return { placements: [], placedIds: [], remaining: rem.slice(), freeRects: [region], usedArea: 0, score: 0, depth, budgetHit:true };
    }
    state.nodeBudget -= 1;

    const axes = state.prefDir === 'along' ? ['row','col'] : (state.prefDir === 'across' ? ['col','row'] : ['row','col']);
    let best = null;

    const finalizeRecursiveCandidate = (baseCand, remAfterBase, axisTag)=>{
      const orderModes = baseCand.regions.length >= 2 ? ['large-first', 'small-first'] : ['large-first'];
      for(const orderMode of orderModes){
        let childRem = remAfterBase.slice();
        let childPlacements = baseCand.placements.slice();
        let childIds = baseCand.placements.map(p=>p.id);
        let childFreeRects = [];
        let childUsedArea = baseCand.usedArea;
        let childScore = baseCand.score;
        let timeout = false;
        const orderedRegions = sortRegionsForRecursion(baseCand.regions, orderMode);
        for(const sub of orderedRegions){
          const subRes = solveRegionRecursive(childRem, sub, K, state, depth + 1);
          if(subRes.timedOut) timeout = true;
          childRem = subRes.remaining.slice();
          childPlacements = childPlacements.concat(subRes.placements || []);
          childIds = childIds.concat(subRes.placedIds || []);
          childFreeRects = childFreeRects.concat(subRes.freeRects || []);
          childUsedArea += subRes.usedArea || 0;
          childScore += subRes.score || 0;
        }

        const regArea = rw * rh;
        const usedRatio = regArea > 0 ? (childUsedArea / regArea) : 0;
        const sheetMeta = sheetStructureMetrics({ placements: childPlacements });
        const largestFree = childFreeRects.reduce((mx, r)=> Math.max(mx, regionArea(r)), 0);
        const freePenalty = childFreeRects.length > 1 ? (childFreeRects.length - 1) * state.boardArea * 0.0025 : 0;
        childScore += (usedRatio * regArea * 0.75);
        childScore += Math.min(regArea * 0.18, largestFree * 0.09);
        childScore += Math.min(regArea * 0.14, sheetMeta.repeatedArea * 0.06);
        childScore += Math.min(regArea * 0.10, sheetMeta.bandArea * 0.05);
        childScore -= freePenalty;
        if(axisTag === 'row' && state.prefDir === 'along') childScore += state.boardArea * 0.0025;
        if(axisTag === 'col' && state.prefDir === 'across') childScore += state.boardArea * 0.0025;
        if(baseCand.kind === 'block') childScore += state.boardArea * 0.0080;
        if(baseCand.kind === 'split') childScore += state.boardArea * 0.0100;
        if(orderMode === 'large-first' && childFreeRects.length <= 2) childScore += state.boardArea * 0.0015;

        const cand = {
          placements: childPlacements,
          placedIds: childIds,
          remaining: childRem,
          freeRects: childFreeRects,
          usedArea: childUsedArea,
          score: childScore,
          depth,
          axis: axisTag,
          lineSize: baseCand.lineSize || 0,
          timedOut: timeout,
          kind: baseCand.kind || 'band',
        };

        if(!best ||
           cand.usedArea > best.usedArea + (state.boardArea * 0.004) ||
           (Math.abs(cand.usedArea - best.usedArea) <= (state.boardArea * 0.004) && cand.score > best.score)){
          best = cand;
        }
      }
    };

    for(const axis of axes){
      const lineChoices = chooseRegionLineSizes(rem, region, axis, K, state.lineVariants);
      for(const lineChoice of lineChoices){
        if(state.deadline && now() > state.deadline) break;
        const band = buildRegionBandCandidateForLine(rem, region, axis, lineChoice.size, K, state.prefDir, state.boardArea);
        if(!band) continue;
        const remAfterBand = removeItemsByIndices(rem, band.usedIdx);
        finalizeRecursiveCandidate(band, remAfterBand, axis);
      }
      const splitChoices = chooseRegionSplitSizes(rem, region, axis, K, Math.max(2, state.lineVariants));
      for(const splitSize of splitChoices){
        if(state.deadline && now() > state.deadline) break;
        const split = buildRegionSplitCandidate(region, axis, splitSize, K, state);
        if(!split) continue;
        finalizeRecursiveCandidate(split, rem.slice(), axis);
      }
    }

    const anchors = chooseRegionAnchorCandidates(rem, region, Math.max(3, state.lineVariants + 2));
    for(const anchor of anchors){
      if(state.deadline && now() > state.deadline) break;
      const block = buildRegionBlockCandidate(rem, region, anchor, K, state);
      if(!block) continue;
      const remAfterBlock = removeItemsByIndices(rem, block.usedIdx);
      finalizeRecursiveCandidate(block, remAfterBlock, block.anchorW >= block.anchorH ? 'row' : 'col');
    }

    if(best) return best;
    return { placements: [], placedIds: [], remaining: rem.slice(), freeRects: [region], usedArea: 0, score: 0, depth };
  }

  function buildRecursiveOptionalSheet(itemsIn, boardW, boardH, kerf, options){
    const W = Math.max(10, Math.round(Number(boardW)||0));
    const H = Math.max(10, Math.round(Number(boardH)||0));
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const trimNew = Math.max(0, Math.round(Number(options && options.edgeTrimNewSheet) || 0));
    let rem = (itemsIn || []).map(it=>Object.assign({}, it));
    const root = { x: trimNew, y: trimNew, w: Math.max(10, W - 2 * trimNew), h: Math.max(10, H - 2 * trimNew) };
    const state = {
      prefDir: options && options.preferredDirection,
      boardArea: W * H,
      maxDepth: Math.max(4, Math.round(Number(options && options.maxDepth) || 10)),
      lineVariants: Math.max(1, Math.round(Number(options && options.lineVariants) || 2)),
      nodeBudget: Math.max(30, Math.round(Number(options && options.nodeBudget) || 160)),
      deadline: (options && options.deadline) || 0,
    };
    const solved = solveRegionRecursive(rem, root, K, state, 0);
    const sheet = { boardW: W, boardH: H, placements: (solved.placements || []).slice(), _freeRects: (solved.freeRects || []).slice() };
    if(!sheet.placements.length && rem.length){
      const it = rem[0];
      sheet.placements.push({ id: it.id, key: it.key, name: it.name, x:0, y:0, w:it.w, h:it.h, rotated:false, unplaced:true });
    }
    return {
      sheet,
      placedIds: (solved.placedIds || []).slice(),
      remaining: (solved.remaining || rem).slice(),
      usedArea: solved.usedArea || 0,
      score: solved.score || 0,
    };
  }

  function packRecursiveOptional(itemsIn, boardW, boardH, kerf, options){
    let rem = (itemsIn || []).map(it=>Object.assign({}, it));
    const sheets = [];
    const started = now();
    while(rem.length){
      const perSheetDeadline = (options && options.deadline)
        ? Math.min(options.deadline, now() + Math.max(180, Math.round(Number(options && options.perSheetSliceMs) || 900)))
        : (now() + Math.max(180, Math.round(Number(options && options.perSheetSliceMs) || 900)));
      const built = buildRecursiveOptionalSheet(rem, boardW, boardH, kerf, Object.assign({}, options || {}, { deadline: perSheetDeadline }));
      if(!built || !built.sheet || !(built.sheet.placements||[]).some(p=>p && !p.unplaced)) break;
      sheets.push(built.sheet);
      const taken = new Set(built.placedIds || []);
      rem = rem.filter(it=> !taken.has(it.id));
      if(options && options.deadline && now() > options.deadline) break;
      if(now() - started > 120000) break;
    }
    if(rem.length){
      const fallbackSheets = packAdaptiveBands(rem, boardW, boardH, kerf, options || {});
      if(Array.isArray(fallbackSheets) && fallbackSheets.length) sheets.push(...fallbackSheets);
    }
    return sheets;
  }

  function regionCanFitAnyItem(rem, region){
    const rw = Math.max(0, Number(region && region.w) || 0);
    const rh = Math.max(0, Number(region && region.h) || 0);
    if(rw < 80 || rh < 80) return false;
    for(let i=0;i<(rem||[]).length;i++){
      const it = rem[i];
      for(const cand of adaptiveCandidatesForItem(it)){
        if(cand.w <= rw && cand.h <= rh) return true;
      }
    }
    return false;
  }

  function potentialFitCount(rem, region, cap){
    const rw = Math.max(0, Number(region && region.w) || 0);
    const rh = Math.max(0, Number(region && region.h) || 0);
    const limit = Math.max(1, Math.round(Number(cap) || 9999));
    let count = 0;
    let area = 0;
    for(let i=0;i<(rem||[]).length;i++){
      const it = rem[i];
      let fits = false;
      for(const cand of adaptiveCandidatesForItem(it)){
        if(cand.w <= rw && cand.h <= rh){ fits = true; break; }
      }
      if(fits){
        count += 1;
        area += (Number(it.w)||0) * (Number(it.h)||0);
        if(count >= limit) break;
      }
    }
    return { count, area };
  }

  function chooseBeamRegionIndex(state){
    const open = Array.isArray(state && state.openRegions) ? state.openRegions : [];
    if(!open.length) return -1;
    let bestIdx = 0;
    let bestScore = -Infinity;
    for(let i=0;i<open.length;i++){
      const region = open[i];
      const area = regionArea(region);
      const fit = potentialFitCount(state.remaining, region, 12);
      const score = area + (fit.count * 160000) + (fit.area * 0.08);
      if(score > bestScore){ bestScore = score; bestIdx = i; }
    }
    return bestIdx;
  }

  function regionCandidateScoreBonus(candidate, region, state){
    const regArea = Math.max(1, regionArea(region));
    const usedArea = Math.max(0, Number(candidate && candidate.usedArea) || 0);
    const usedRatio = usedArea / regArea;
    const children = Array.isArray(candidate && candidate.regions) ? candidate.regions : [];
    const childAreas = children.map(regionArea).sort((a,b)=>b-a);
    const largestChild = childAreas[0] || 0;
    const secondChild = childAreas[1] || 0;
    let bonus = 0;
    bonus += usedRatio * regArea * 0.18;
    bonus += Math.min(regArea * 0.08, largestChild * 0.03);
    if(secondChild > 0) bonus += Math.min(regArea * 0.04, secondChild * 0.015);
    if((candidate && candidate.kind) === 'split'){
      bonus += state.boardArea * 0.010;
      if(childAreas.length === 2){
        const balance = 1 - (Math.abs(childAreas[0] - childAreas[1]) / Math.max(1, childAreas[0] + childAreas[1]));
        bonus += balance * state.boardArea * 0.008;
      }
    }
    if((candidate && candidate.kind) === 'block') bonus += state.boardArea * 0.004;
    if((candidate && candidate.kind) === 'band') bonus += state.boardArea * 0.003;
    return bonus;
  }

  function generateTreeBeamCandidates(rem, region, K, state){
    const out = [];
    const axes = state.prefDir === 'along' ? ['row','col'] : (state.prefDir === 'across' ? ['col','row'] : ['row','col']);
    const regionFit = potentialFitCount(rem, region, 24);
    for(const axis of axes){
      const lineChoices = chooseRegionLineSizes(rem, region, axis, K, Math.max(2, state.lineVariants));
      for(const lineChoice of lineChoices){
        const band = buildRegionBandCandidateForLine(rem, region, axis, lineChoice.size, K, state.prefDir, state.boardArea);
        if(!band) continue;
        band.kind = 'band';
        band.score = (band.score || 0) + regionCandidateScoreBonus(band, region, state);
        out.push(band);
      }
      if(state.allowSplits && state.zeroSplitDepth < state.maxZeroSplits){
        const splitChoices = chooseRegionSplitSizes(rem, region, axis, K, Math.max(2, state.lineVariants + 1));
        for(const splitSize of splitChoices){
          const split = buildRegionSplitCandidate(region, axis, splitSize, K, state);
          if(!split) continue;
          let childFitCount = 0;
          let childFitArea = 0;
          let usefulChildren = 0;
          for(const sub of split.regions || []){
            const fit = potentialFitCount(rem, sub, 16);
            childFitCount += fit.count;
            childFitArea += fit.area;
            if(fit.count > 0) usefulChildren += 1;
          }
          if(childFitCount <= 0) continue;
          split.score = (split.score || 0) + (childFitArea * 0.05) + (usefulChildren * state.boardArea * 0.006) + regionCandidateScoreBonus(split, region, state);
          out.push(split);
        }
      }
    }
    const anchors = chooseRegionAnchorCandidates(rem, region, Math.max(4, state.lineVariants + 2));
    for(const anchor of anchors){
      const block = buildRegionBlockCandidate(rem, region, anchor, K, state);
      if(!block) continue;
      block.score = (block.score || 0) + regionCandidateScoreBonus(block, region, state);
      out.push(block);
    }
    out.sort((a,b)=> (b.score||0) - (a.score||0));
    // Dedupe similar candidates so beam explores more families.
    const uniq = [];
    const seen = new Set();
    for(const cand of out){
      const key = [cand.kind||'?', cand.axis||'?', Math.round(Number(cand.lineSize)||0), Math.round(Number(cand.anchorW)||0), Math.round(Number(cand.anchorH)||0)].join(':');
      if(seen.has(key)) continue;
      seen.add(key);
      uniq.push(cand);
      if(uniq.length >= Math.max(6, state.branchWidth * 2)) break;
    }
    // If region has many possible items, encourage at least one pure split branch near the top.
    if(regionFit.count >= 4 && state.allowSplits && state.zeroSplitDepth < state.maxZeroSplits){
      uniq.sort((a,b)=>{
        const ak = a.kind === 'split' ? 1 : 0;
        const bk = b.kind === 'split' ? 1 : 0;
        if(ak !== bk) return bk - ak;
        return (b.score||0) - (a.score||0);
      });
      uniq.sort((a,b)=> (b.score||0) - (a.score||0));
    }
    return uniq.slice(0, Math.max(4, state.branchWidth));
  }

  function applyTreeBeamCandidate(state, regionIndex, candidate){
    const region = state.openRegions[regionIndex];
    const nextOpen = state.openRegions.slice(0, regionIndex).concat(state.openRegions.slice(regionIndex + 1));
    const nextClosed = state.closedRegions.slice();
    const nextPlacements = state.placements.slice().concat(candidate.placements || []);
    const nextPlacedIds = state.placedIds.slice().concat((candidate.placements || []).map(p=>p.id));
    const nextRegions = [];
    for(const sub of (candidate.regions || [])){
      if(!sub || regionArea(sub) < 6400) continue;
      nextRegions.push(sub);
    }
    for(const sub of nextRegions){
      if(regionCanFitAnyItem(state.remaining, sub)) nextOpen.push(sub);
      else nextClosed.push(sub);
    }
    const nextRemaining = (candidate.kind === 'split') ? state.remaining.slice() : removeItemsByIndices(state.remaining, candidate.usedIdx || []);
    return {
      openRegions: nextOpen,
      closedRegions: nextClosed,
      placements: nextPlacements,
      placedIds: nextPlacedIds,
      remaining: nextRemaining,
      usedArea: state.usedArea + Math.max(0, Number(candidate.usedArea)||0),
      partialScore: state.partialScore + Math.max(0, Number(candidate.score)||0),
      zeroSplitDepth: (candidate.kind === 'split') ? (state.zeroSplitDepth + 1) : 0,
      steps: state.steps + 1,
      branchKinds: state.branchKinds.concat([candidate.kind || '?']),
    };
  }

  function estimatePartialStateScore(st, boardArea){
    const usedArea = Math.max(0, Number(st && st.usedArea) || 0);
    const open = Array.isArray(st && st.openRegions) ? st.openRegions : [];
    const closed = Array.isArray(st && st.closedRegions) ? st.closedRegions : [];
    const openArea = open.reduce((sum,r)=> sum + regionArea(r), 0);
    const largestOpen = open.reduce((mx,r)=> Math.max(mx, regionArea(r)), 0);
    const placements = Array.isArray(st && st.placements) ? st.placements : [];
    const meta = sheetStructureMetrics({ placements });
    let score = Math.max(0, Number(st && st.partialScore) || 0);
    score += usedArea * 0.60;
    score += placements.length * 22000;
    score += Math.min(boardArea * 0.12, meta.repeatedArea * 0.05);
    score += Math.min(boardArea * 0.10, meta.bandArea * 0.04);
    score += Math.min(boardArea * 0.06, largestOpen * 0.04);
    score -= open.length * (boardArea * 0.0035);
    score -= closed.length * (boardArea * 0.0015);
    score -= Math.min(boardArea * 0.06, openArea * 0.010);
    score -= (Math.max(0, Number(st && st.zeroSplitDepth) || 0) * boardArea * 0.010);
    return score;
  }

  function buildTreeBeamOptionalSheet(itemsIn, boardW, boardH, kerf, options){
    const W = Math.max(10, Math.round(Number(boardW)||0));
    const H = Math.max(10, Math.round(Number(boardH)||0));
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const trimNew = Math.max(0, Math.round(Number(options && options.edgeTrimNewSheet) || 0));
    const deadline = (options && options.deadline) || 0;
    const boardArea = W * H;
    const root = { x: trimNew, y: trimNew, w: Math.max(10, W - 2 * trimNew), h: Math.max(10, H - 2 * trimNew) };
    const beamWidth = Math.max(4, Math.round(Number(options && options.beamWidth) || 8));
    const branchWidth = Math.max(4, Math.round(Number(options && options.branchWidth) || 6));
    const maxSteps = Math.max(10, Math.round(Number(options && options.maxSteps) || 22));
    const nodeBudget = Math.max(40, Math.round(Number(options && options.nodeBudget) || 180));
    const init = {
      openRegions: [root],
      closedRegions: [],
      placements: [],
      placedIds: [],
      remaining: (itemsIn || []).map(it=>Object.assign({}, it)),
      usedArea: 0,
      partialScore: 0,
      zeroSplitDepth: 0,
      steps: 0,
      branchKinds: [],
    };
    let beam = [init];
    let explored = 0;

    while(beam.length && explored < nodeBudget){
      if(deadline && now() > deadline) break;
      const next = [];
      let anyExpanded = false;
      for(const st of beam){
        if(explored >= nodeBudget) break;
        if(deadline && now() > deadline) break;
        if(!st.openRegions.length || !st.remaining.length || st.steps >= maxSteps){
          next.push(st);
          continue;
        }
        const regionIndex = chooseBeamRegionIndex(st);
        if(regionIndex < 0){
          next.push(st);
          continue;
        }
        const region = st.openRegions[regionIndex];
        const cands = generateTreeBeamCandidates(st.remaining, region, K, {
          prefDir: options && options.preferredDirection,
          boardArea,
          lineVariants: Math.max(2, Math.round(Number(options && options.lineVariants) || 3)),
          branchWidth,
          allowSplits: true,
          maxZeroSplits: Math.max(2, Math.round(Number(options && options.maxZeroSplits) || 3)),
          zeroSplitDepth: st.zeroSplitDepth,
        });
        if(!cands.length){
          next.push({
            openRegions: st.openRegions.slice(0, regionIndex).concat(st.openRegions.slice(regionIndex + 1)),
            closedRegions: st.closedRegions.concat([region]),
            placements: st.placements.slice(),
            placedIds: st.placedIds.slice(),
            remaining: st.remaining.slice(),
            usedArea: st.usedArea,
            partialScore: st.partialScore - boardArea * 0.002,
            zeroSplitDepth: 0,
            steps: st.steps + 1,
            branchKinds: st.branchKinds.slice(),
          });
          explored += 1;
          continue;
        }
        anyExpanded = true;
        for(const cand of cands.slice(0, branchWidth)){
          next.push(applyTreeBeamCandidate(st, regionIndex, cand));
          explored += 1;
          if(explored >= nodeBudget) break;
        }
      }
      if(!next.length) break;
      next.sort((a,b)=> estimatePartialStateScore(b, boardArea) - estimatePartialStateScore(a, boardArea));
      // light dedupe by placements + region count + branch fingerprint
      const deduped = [];
      const seen = new Set();
      for(const st of next){
        const key = [st.placements.length, st.openRegions.length, st.closedRegions.length, st.zeroSplitDepth, st.branchKinds.slice(-4).join(',')].join('|');
        if(seen.has(key)) continue;
        seen.add(key);
        deduped.push(st);
        if(deduped.length >= beamWidth) break;
      }
      beam = deduped;
      if(!anyExpanded) break;
    }

    let best = null;
    for(const st of beam){
      const freeRects = st.closedRegions.concat(st.openRegions).filter(r=>r && regionArea(r) >= 6400);
      const sheet = { boardW: W, boardH: H, placements: st.placements.slice(), _freeRects: freeRects.slice() };
      const sc = scoreSheets([sheet]);
      const tail = tailMetrics([sheet]);
      const composite = sc.waste - (estimatePartialStateScore(st, boardArea) * 0.12) - (boardArea * Math.max(0, tail.lastUsedRatio - 0.45) * 0.10);
      const cand = { sheet, placedIds: st.placedIds.slice(), remaining: st.remaining.slice(), usedArea: st.usedArea, composite };
      if(!best || cand.usedArea > best.usedArea + boardArea * 0.003 || (Math.abs(cand.usedArea - best.usedArea) <= boardArea * 0.003 && cand.composite < best.composite)) best = cand;
    }

    if(!best){
      const sheet = { boardW: W, boardH: H, placements: [], _freeRects: [root] };
      return { sheet, placedIds: [], remaining: init.remaining.slice(), usedArea: 0, composite: Number.POSITIVE_INFINITY };
    }
    if(!best.sheet.placements.length && best.remaining.length){
      const it = best.remaining[0];
      best.sheet.placements.push({ id: it.id, key: it.key, name: it.name, x:0, y:0, w:it.w, h:it.h, rotated:false, unplaced:true });
    }
    return best;
  }

  function packOptionalTreeBeam(itemsIn, boardW, boardH, kerf, options){
    let rem = (itemsIn || []).map(it=>Object.assign({}, it));
    const sheets = [];
    const overallDeadline = (options && options.deadline) || 0;
    while(rem.length){
      const perSheetDeadline = overallDeadline
        ? Math.min(overallDeadline, now() + Math.max(260, Math.round(Number(options && options.perSheetSliceMs) || 1200)))
        : (now() + Math.max(260, Math.round(Number(options && options.perSheetSliceMs) || 1200)));
      const built = buildTreeBeamOptionalSheet(rem, boardW, boardH, kerf, Object.assign({}, options || {}, { deadline: perSheetDeadline }));
      if(!built || !built.sheet || !(built.sheet.placements||[]).some(p=>p && !p.unplaced)) break;
      sheets.push(built.sheet);
      const taken = new Set(built.placedIds || []);
      rem = rem.filter(it=> !taken.has(it.id));
      if(overallDeadline && now() > overallDeadline) break;
    }
    if(rem.length){
      const fallbackSheets = packAdaptiveBands(rem, boardW, boardH, kerf, options || {});
      if(Array.isArray(fallbackSheets) && fallbackSheets.length) sheets.push(...fallbackSheets);
    }
    return sheets;
  }


  function buildAdaptiveMosaicSheet(itemsIn, boardW, boardH, kerf, options){
    const W = Math.max(10, Math.round(Number(boardW)||0));
    const H = Math.max(10, Math.round(Number(boardH)||0));
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const trimNew = Math.max(0, Math.round(Number(options && options.edgeTrimNewSheet) || 0));
    const prefDir = options && options.preferredDirection;
    const workX = trimNew;
    const workY = trimNew;
    const workW = Math.max(10, W - 2 * trimNew);
    const workH = Math.max(10, H - 2 * trimNew);
    let rem = (itemsIn || []).map(it=>Object.assign({}, it));
    const sheet = { boardW: W, boardH: H, placements: [], _freeRects: [] };
    const placedIds = [];
    const regions = [{ x: workX, y: workY, w: workW, h: workH }];
    const boardArea = W * H;

    while(rem.length && regions.length){
      regions.sort((a,b)=> (b.w*b.h) - (a.w*a.h));
      let best = null;
      const regionLimit = Math.min(regions.length, 8);
      for(let ri=0; ri<regionLimit; ri++){
        const region = regions[ri];
        const rowCand = buildRegionBandCandidate(rem, region, 'row', K, prefDir, boardArea);
        const colCand = buildRegionBandCandidate(rem, region, 'col', K, prefDir, boardArea);
        for(const cand of [rowCand, colCand]){
          if(!cand) continue;
          if(!best || cand.score > best.score) best = Object.assign({ regionIndex: ri }, cand);
        }
      }
      if(!best) break;

      const usedSet = new Set(best.usedIdx);
      const usedSorted = Array.from(usedSet).sort((a,b)=> b-a);
      for(const idx of usedSorted){
        const it = rem[idx];
        if(it) placedIds.push(it.id);
        rem.splice(idx, 1);
      }
      for(const p of best.placements) sheet.placements.push(p);
      regions.splice(best.regionIndex, 1);
      for(const nr of best.regions){
        if(nr && nr.w >= 80 && nr.h >= 80) regions.push(nr);
      }
    }

    sheet._freeRects = regions.slice();

    if(!sheet.placements.length && rem.length){
      const it = rem[0];
      sheet.placements.push({ id: it.id, key: it.key, name: it.name, x:0, y:0, w:it.w, h:it.h, rotated:false, unplaced:true });
    }

    return {
      sheet,
      placedIds,
      remaining: rem,
      usedArea: sheet.placements.reduce((sum,p)=> sum + ((p && !p.unplaced) ? ((p.w||0)*(p.h||0)) : 0), 0),
    };
  }

  function packAdaptiveBands(itemsIn, boardW, boardH, kerf, options){
    let rem = (itemsIn || []).map(it=>Object.assign({}, it));
    const sheets = [];
    while(rem.length){
      const built = buildAdaptiveMosaicSheet(rem, boardW, boardH, kerf, options || {});
      if(!built || !built.sheet || !(built.sheet.placements||[]).some(p=>p && !p.unplaced)) break;
      sheets.push(built.sheet);
      const taken = new Set(built.placedIds);
      rem = rem.filter(it=> !taken.has(it.id));
    }
    if(rem.length){
      const fallback = buildAdaptiveStripSheet(rem, boardW, boardH, kerf, 'along', options || {});
      if(fallback && fallback.sheet) sheets.push(fallback.sheet);
    }
    return sheets;
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
        let largestFree = 0;
        for(const s of (cand.sheets||[])){
          const m = sheetStructureMetrics(s);
          repeatedArea += m.repeatedArea;
          bandArea += m.bandArea;
          axisCoherenceSum += m.axisCoherence;
          usedArea += m.usedArea;
          largestFree = Math.max(largestFree, meaningfulFreeRects(s).reduce((mx,r)=>Math.max(mx, r.w*r.h), 0));
        }
        return {
          repeatedArea,
          bandArea,
          coherence: usedArea > 0 ? Math.max(0, Math.min(1, repeatedArea / usedArea)) : 0,
          avgAxisCoherence: (cand.sheets && cand.sheets.length) ? (axisCoherenceSum / cand.sheets.length) : 0,
          largestFree,
        };
      };

      const familyClass = (name)=>{
        if(/^treebeam/.test(name)) return 'treebeam';
        if(/^recursive/.test(name)) return 'recursive';
        if(/^adaptive/.test(name)) return 'adaptive';
        if(/^strip/.test(name)) return 'strip';
        return 'guillotine';
      };

      const chooseBetterCandidate = (a, b)=>{
        if(!b) return a;
        if(!a) return b;
        if(a.sc.sheets !== b.sc.sheets) return (a.sc.sheets < b.sc.sheets) ? a : b;

        const aType = familyClass(a.family);
        const bType = familyClass(b.family);
        const wasteGap = Math.abs(a.sc.waste - b.sc.waste);
        const treeBeamMargin = boardArea * 0.170;
        const recursiveMargin = boardArea * 0.140;
        const adaptiveMargin = boardArea * 0.060;
        const stripMargin = boardArea * 0.055;
        const aTail = tailMetrics(a.sheets);
        const bTail = tailMetrics(b.sheets);

        if(aType !== bType){
          if((aType === 'treebeam' || bType === 'treebeam') && wasteGap <= treeBeamMargin){
            if(Math.abs(aTail.lastUsedRatio - bTail.lastUsedRatio) >= 0.04){
              return aTail.lastUsedRatio > bTail.lastUsedRatio ? a : b;
            }
            return aType === 'treebeam' ? a : b;
          }
          if((aType === 'recursive' || bType === 'recursive') && wasteGap <= recursiveMargin){
            if(Math.abs(aTail.lastUsedRatio - bTail.lastUsedRatio) >= 0.06){
              return aTail.lastUsedRatio > bTail.lastUsedRatio ? a : b;
            }
            return aType === 'recursive' ? a : b;
          }
          if((aType === 'adaptive' || bType === 'adaptive') && wasteGap <= adaptiveMargin){
            if(Math.abs(aTail.lastUsedRatio - bTail.lastUsedRatio) >= 0.08){
              return aTail.lastUsedRatio > bTail.lastUsedRatio ? a : b;
            }
            return aType === 'adaptive' ? a : b;
          }
          if((aType === 'strip' || bType === 'strip') && wasteGap <= stripMargin){
            if(Math.abs(aTail.lastUsedRatio - bTail.lastUsedRatio) >= 0.06){
              return aTail.lastUsedRatio > bTail.lastUsedRatio ? a : b;
            }
            return aType === 'strip' ? a : b;
          }
        }

        const aRecursive = aType === 'recursive' ? 1 : 0;
        const bRecursive = bType === 'recursive' ? 1 : 0;
        const aTree = aType === 'treebeam' ? 1 : 0;
        const bTree = bType === 'treebeam' ? 1 : 0;
        const aScore = a.sc.waste - (a.meta.repeatedArea * 0.070) - (a.meta.bandArea * 0.060) - (boardArea * Math.max(0, a.meta.avgAxisCoherence - 0.58) * 0.80) - (a.meta.largestFree * 0.10) - (boardArea * Math.max(0, aTail.lastUsedRatio - 0.48) * 0.12) - (aRecursive * boardArea * 0.060) - (aTree * boardArea * 0.090);
        const bScore = b.sc.waste - (b.meta.repeatedArea * 0.070) - (b.meta.bandArea * 0.060) - (boardArea * Math.max(0, b.meta.avgAxisCoherence - 0.58) * 0.80) - (b.meta.largestFree * 0.10) - (boardArea * Math.max(0, bTail.lastUsedRatio - 0.48) * 0.12) - (bRecursive * boardArea * 0.060) - (bTree * boardArea * 0.090);
        if(Math.abs(aScore - bScore) > (boardArea * 0.010)) return (aScore < bScore) ? a : b;
        if(tailAwareBetter(a, b, boardArea)) return a;
        return b;
      };

      const add = (family, sheets, alreadyCounted)=>{
        if(!alreadyCounted) attempts += 1;
        if(Array.isArray(sheets) && sheets.length){
          const sc = scoreSheets(sheets);
          candidates.push({ family, sheets, sc, meta: analyzeCandidate({ sheets }) });
        }
        emitProgress(false);
      };

      const recursiveNodeBudget = Math.max(120, Math.round(beamWidth * 0.90));
      const recursiveDeadline = now() + Math.max(240, Math.round(ms * 1.35));
      const treeDeadline = now() + Math.max(420, Math.round(ms * 1.85));
      add('treebeam-main', packOptionalTreeBeam(arr, W, H, K, { edgeTrimNewSheet, preferredDirection: null, lineVariants: 4, branchWidth: Math.max(5, Math.round(beamWidth * 0.05)), beamWidth: Math.max(6, Math.round(beamWidth * 0.06)), nodeBudget: Math.max(180, Math.round(beamWidth * 1.55)), deadline: treeDeadline, perSheetSliceMs: Math.max(520, Math.round(ms * 1.12)), maxZeroSplits: 3, maxSteps: 26 }), false);
      add('treebeam-pref-' + pref, packOptionalTreeBeam(arr, W, H, K, { edgeTrimNewSheet, preferredDirection: pref, lineVariants: 4, branchWidth: Math.max(5, Math.round(beamWidth * 0.05)), beamWidth: Math.max(6, Math.round(beamWidth * 0.06)), nodeBudget: Math.max(180, Math.round(beamWidth * 1.55)), deadline: treeDeadline, perSheetSliceMs: Math.max(520, Math.round(ms * 1.12)), maxZeroSplits: 3, maxSteps: 26 }), false);
      add('recursive-main', packRecursiveOptional(arr, W, H, K, { edgeTrimNewSheet, preferredDirection: null, maxDepth: 12, lineVariants: 3, nodeBudget: Math.max(180, Math.round(recursiveNodeBudget * 1.35)), deadline: recursiveDeadline, perSheetSliceMs: Math.max(340, Math.round(ms * 0.78)) }), false);
      add('recursive-pref-' + pref, packRecursiveOptional(arr, W, H, K, { edgeTrimNewSheet, preferredDirection: pref, maxDepth: 12, lineVariants: 3, nodeBudget: Math.max(180, Math.round(recursiveNodeBudget * 1.35)), deadline: recursiveDeadline, perSheetSliceMs: Math.max(340, Math.round(ms * 0.78)) }), false);
      add('adaptive-main', packAdaptiveBands(arr, W, H, K, { edgeTrimNewSheet }), false);
      add('adaptive-pref-' + pref, packAdaptiveBands(arr, W, H, K, { edgeTrimNewSheet, preferredDirection: pref }), false);
      if(opt.packStripBands){
        add('strip-along', opt.packStripBands(arr, W, H, K, 'along', { edgeTrimNewSheet }));
        add('strip-across', opt.packStripBands(arr, W, H, K, 'across', { edgeTrimNewSheet }));
      }
      add('guillotine-' + pref, packGuillotine(arr, pref, ms), true);
      const altPref = (pref === 'along') ? 'across' : 'along';
      if(pref !== altPref){
        add('guillotine-' + altPref, packGuillotine(arr, altPref, Math.max(120, Math.round(ms * 0.7))), true);
      }

      let best = null;
      for(const cand of candidates) best = chooseBetterCandidate(cand, best);

      if(hybridRuns > 1 && best && best.sheets && best.sheets.length){
        const extraType = familyClass(best.family);
        for(let i=1;i<hybridRuns;i++){
          const extraMs = Math.max(ms, Math.round(ms * (1 + i*0.24)));
          if(extraType === 'treebeam'){
            add('treebeam-deep-' + i, packOptionalTreeBeam(arr, W, H, K, { edgeTrimNewSheet, preferredDirection: (i % 2 ? pref : altPref), lineVariants: 5, branchWidth: Math.max(6, Math.round(beamWidth * 0.06)), beamWidth: Math.max(7, Math.round(beamWidth * 0.07)), nodeBudget: Math.max(240, Math.round(beamWidth * (1.9 + i*0.26))), deadline: now() + Math.max(650, Math.round(extraMs * 1.85)), perSheetSliceMs: Math.max(620, Math.round(extraMs * 1.20)), maxZeroSplits: 4, maxSteps: 30 }), false);
          } else if(extraType === 'recursive'){
            add('recursive-deep-' + i, packRecursiveOptional(arr, W, H, K, { edgeTrimNewSheet, preferredDirection: (i % 2 ? pref : altPref), maxDepth: 13, lineVariants: 4, nodeBudget: Math.max(220, Math.round(beamWidth * (1.45 + i*0.22))), deadline: now() + Math.max(420, Math.round(extraMs * 1.45)), perSheetSliceMs: Math.max(420, Math.round(extraMs * 0.92)) }), false);
          } else if(extraType === 'adaptive'){
            add('adaptive-deep-' + i, packAdaptiveBands(arr, W, H, K, { edgeTrimNewSheet, preferredDirection: (i % 2 ? pref : altPref) }), false);
          } else if(extraType === 'strip' && opt.packStripBands){
            const dir = /across$/.test(best.family) ? 'across' : 'along';
            add('strip-deep-' + dir + '-' + i, opt.packStripBands(arr, W, H, K, dir, { edgeTrimNewSheet }));
          } else {
            const dir = /across$/.test(best.family) ? 'across' : 'along';
            add('guillotine-deep-' + dir + '-' + i, packGuillotine(arr, dir, extraMs), true);
          }
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
      if(cutMode === 'optional') return packOptionalTreeBeam(arr, W, H, K, { edgeTrimNewSheet, preferredDirection: pref, lineVariants: 5, branchWidth: Math.max(6, Math.round(beamWidth * 0.06)), beamWidth: Math.max(7, Math.round(beamWidth * 0.07)), nodeBudget: Math.max(260, Math.round(beamWidth * 1.9)), deadline: now() + Math.max(650, Math.round(ms * 1.85)), perSheetSliceMs: Math.max(620, Math.round(ms * 1.20)), maxZeroSplits: 4, maxSteps: 30 });
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

    function deterministicTailCompaction(currentBest){
      if(_cancelled) return currentBest;
      if(!currentBest || !Array.isArray(currentBest.sheets)) return currentBest;
      const sheets = currentBest.sheets;
      if(sheets.length < 2) return currentBest;

      let bestLocal = currentBest;
      const tailSizes = [2, 3];
      const variants = [];
      for(const tailSize of tailSizes){
        if(sheets.length < tailSize) continue;
        const tailStart = Math.max(0, sheets.length - tailSize);
        const prefix = sheets.slice(0, tailStart);
        const tail = sheets.slice(tailStart);
        const ids = [];
        for(const s of tail) ids.push(...idsFromSheet(s));
        if(!ids.length) continue;
        const uniq = [];
        const seen = new Set();
        for(const id of ids){
          if(seen.has(id)) continue;
          seen.add(id);
          const it = itemById.get(id);
          if(it) uniq.push(it);
        }
        if(!uniq.length) continue;

        variants.push(prefix.concat(packAdaptiveBands(uniq, W, H, K, { edgeTrimNewSheet, preferredDirection:'along' }) || []));
        variants.push(prefix.concat(packAdaptiveBands(uniq, W, H, K, { edgeTrimNewSheet, preferredDirection:'across' }) || []));
        variants.push(prefix.concat(packAdaptiveBands(uniq, W, H, K, { edgeTrimNewSheet }) || []));
        if(opt.packStripBands){
          variants.push(prefix.concat(opt.packStripBands(uniq, W, H, K, 'along', { edgeTrimNewSheet }) || []));
          variants.push(prefix.concat(opt.packStripBands(uniq, W, H, K, 'across', { edgeTrimNewSheet }) || []));
        }
      }

      for(const sheets2 of variants){
        if(_cancelled) break;
        if(!Array.isArray(sheets2) || !sheets2.length) continue;
        const cand = { sheets: sheets2, sc: scoreSheets(sheets2) };
        if(tailAwareBetter(cand, bestLocal, W * H)) bestLocal = cand;
      }

      return bestLocal;
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
        if(tailAwareBetter(candRes, bestLocal, W * H)) bestLocal = candRes;
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
      best = deterministicTailCompaction(best);
      setBest(best);
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

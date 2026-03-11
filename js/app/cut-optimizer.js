/* cut-optimizer.js — proste heurystyki rozkroju (MVP)
   - Shelf (pasy) + MaxRects (lepsza)
   - Dane w mm (liczby całkowite), kerf w mm
   - Obsługa ograniczeń słoi (rotationAllowed)
   Uwaga: To NIE jest CAD. Ma być użyteczne i stabilne, bez crashy.
*/

(function(){
  'use strict';

  window.FC = window.FC || {};

  function clampInt(v, fallback){
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function rectFits(r, w, h){
    return (w <= r.w && h <= r.h);
  }

  function rectIntersects(a, b){
    return !(b.x >= a.x + a.w ||
             b.x + b.w <= a.x ||
             b.y >= a.y + a.h ||
             b.y + b.h <= a.y);
  }

  // Split a free rect by an overlapping placed rect into up to 4 non-overlapping rects.
  // Standard MaxRects split that preserves correctness (prevents overlapping free rects
  // that could later yield overlapping placements).
  function splitFreeRectByIntersection(free, placed){
    const out = [];
    if(!rectIntersects(free, placed)) return [free];

    const fx = free.x, fy = free.y, fw = free.w, fh = free.h;
    const px = placed.x, py = placed.y, pw = placed.w, ph = placed.h;

    const fr = fx + fw;
    const fb = fy + fh;
    const pr = px + pw;
    const pb = py + ph;

    // left
    if(px > fx){
      out.push({ x: fx, y: fy, w: px - fx, h: fh });
    }
    // right
    if(pr < fr){
      out.push({ x: pr, y: fy, w: fr - pr, h: fh });
    }
    // top
    if(py > fy){
      const topX = Math.max(fx, px);
      const topR = Math.min(fr, pr);
      const topW = topR - topX;
      if(topW > 0) out.push({ x: topX, y: fy, w: topW, h: py - fy });
    }
    // bottom
    if(pb < fb){
      const botX = Math.max(fx, px);
      const botR = Math.min(fr, pr);
      const botW = botR - botX;
      if(botW > 0) out.push({ x: botX, y: pb, w: botW, h: fb - pb });
    }
    return out.filter(r=>r.w>0 && r.h>0);
  }

  // Split free rect by placed rect (guillotine-ish split: right + bottom)
  function splitFreeRect(free, placed){
    const out = [];
    // right
    const rw = free.w - (placed.x - free.x) - placed.w;
    const rx = placed.x + placed.w;
    if(rw > 0){
      out.push({ x: rx, y: free.y, w: rw, h: free.h });
    }
    // bottom
    const bh = free.h - (placed.y - free.y) - placed.h;
    const by = placed.y + placed.h;
    if(bh > 0){
      out.push({ x: free.x, y: by, w: free.w, h: bh });
    }
    // left strip above? (keep simple; pruning will remove overlaps)
    return out;
  }

  function pruneFreeRects(freeRects){
    // remove contained rects
    const out = [];
    for(let i=0;i<freeRects.length;i++){
      const a = freeRects[i];
      if(a.w<=0 || a.h<=0) continue;
      let contained = false;
      for(let j=0;j<freeRects.length;j++){
        if(i===j) continue;
        const b = freeRects[j];
        if(b.w<=0 || b.h<=0) continue;
        if(a.x>=b.x && a.y>=b.y && (a.x+a.w)<= (b.x+b.w) && (a.y+a.h) <= (b.y+b.h)){
          contained = true; break;
        }
      }
      if(!contained) out.push(a);
    }
    return out;
  }

  function sortRectsByMaxSideDesc(items){
    return items.slice().sort((p,q)=>{
      const pa = Math.max(p.w, p.h);
      const qa = Math.max(q.w, q.h);
      return qa - pa;
    });
  }

  function makeItems(partsMm){
    const items = [];
    for(const p of (partsMm||[])){
      const qty = clampInt(p.qty, 1);
      for(let i=0;i<qty;i++){
        items.push({
          id: `${p.key||p.name||'el'}#${i+1}`,
          key: p.key || p.name || 'el',
          name: p.name || 'Element',
          w: clampInt(p.w, 1),
          h: clampInt(p.h, 1),
          material: p.material || '',
          rotationAllowed: !!p.rotationAllowed,
          // Edge banding markers for drawing (optional)
          edgeW1: !!p.edgeW1,
          edgeW2: !!p.edgeW2,
          edgeH1: !!p.edgeH1,
          edgeH2: !!p.edgeH2,
        });
      }
    }
    return items;
  }

  // ===== Shelf heuristic (rows). direction:
  // 'auto' | 'wzdłuż' | 'wpoprz'  => for wpoprz swap board axes.
  function packShelf(itemsIn, boardW, boardH, kerf, direction){
    const W = clampInt(boardW, 2800);
    const H = clampInt(boardH, 2070);
    const K = Math.max(0, Math.round(Number(kerf)||0));

    // coordinate system swap for cross-cut preference
    const swap = (direction === 'wpoprz');
    const BW = swap ? H : W;
    const BH = swap ? W : H;

    const items = sortRectsByMaxSideDesc(itemsIn);
    const sheets = [];

    function newSheet(){
      sheets.push({ boardW: BW, boardH: BH, placements: [] });
      return sheets[sheets.length-1];
    }

    let sheet = newSheet();
    let cursorX = 0;
    let cursorY = 0;
    let rowH = 0;

    function placeOne(it){
      const opts = [];
      // try as-is
      opts.push({ w: it.w, h: it.h, rotated: false });
      if(it.rotationAllowed) opts.push({ w: it.h, h: it.w, rotated: true });

      for(const o of opts){
        // new row if doesn't fit
        if(cursorX + o.w > BW){
          cursorX = 0;
          cursorY = cursorY + rowH + (rowH>0 ? K : 0);
          rowH = 0;
        }
        // new sheet if doesn't fit vertically
        if(cursorY + o.h > BH){
          sheet = newSheet();
          cursorX = 0;
          cursorY = 0;
          rowH = 0;
        }
        // if still doesn't fit, try next orientation
        if(cursorX + o.w <= BW && cursorY + o.h <= BH){
          sheet.placements.push({
            id: it.id,
            key: it.key,
            name: it.name,
            x: cursorX,
            y: cursorY,
            w: o.w,
            h: o.h,
            rotated: o.rotated,
            edgeW1: o.rotated ? it.edgeH1 : it.edgeW1,
            edgeW2: o.rotated ? it.edgeH2 : it.edgeW2,
            edgeH1: o.rotated ? it.edgeW1 : it.edgeH1,
            edgeH2: o.rotated ? it.edgeW2 : it.edgeH2,
          });
          cursorX = cursorX + o.w + K;
          rowH = Math.max(rowH, o.h);
          return true;
        }
      }
      return false;
    }

    for(const it of items){
      // If auto direction, try with given BW/BH first; caller can run twice for swap.
      placeOne(it);
    }

    // swap back placements if needed
    if(swap){
      sheets.forEach(s=>{
        s.placements.forEach(p=>{
          const nx = p.y;
          const ny = p.x;
          const nw = p.h;
          const nh = p.w;
          p.x = nx; p.y = ny; p.w = nw; p.h = nh;
          const ew1 = p.edgeW1, ew2 = p.edgeW2, eh1 = p.edgeH1, eh2 = p.edgeH2;
          p.edgeW1 = eh1; p.edgeW2 = eh2;
          p.edgeH1 = ew1; p.edgeH2 = ew2;
        });
        s.boardW = W;
        s.boardH = H;
      });
    } else {
      sheets.forEach(s=>{ s.boardW = W; s.boardH = H; });
    }

    return sheets;
  }


  // ===== Strip bands (Opti-like pass mode)
  // direction:
  // - 'along'  => horizontal strips running along the long edge shown on screen
  // - 'across' => same logic after swapping board axes (vertical strips in final view)
  // The row height is defined by the anchor piece; smaller pieces may fill the tail of the strip.
  function packStripBands(itemsIn, boardW, boardH, kerf, direction){
    const W = clampInt(boardW, 2800);
    const H = clampInt(boardH, 2070);
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const swap = (direction === 'across' || direction === 'wpoprz');
    const BW = swap ? H : W;
    const BH = swap ? W : H;
    const MAX_TAIL_WASTE = 100; // <= 10 cm w rzędzie to akceptowalny odpad

    let remMaster = (itemsIn||[]).map(it=>Object.assign({}, it));
    const sheets = [];

    function toCandidates(it){
      const out = [{ w: it.w, h: it.h, rotated:false }];
      if(it.rotationAllowed && !(it.w === it.h)) out.push({ w: it.h, h: it.w, rotated:true });
      return out;
    }

    function finalDims(c){
      return swap ? { fw: c.h, fh: c.w } : { fw: c.w, fh: c.h };
    }

    function prefersFinalOrientation(c){
      const d = finalDims(c);
      if(direction === 'across' || direction === 'wpoprz') return d.fw >= d.fh;
      if(direction === 'along' || direction === 'wzdluz') return d.fh >= d.fw;
      return true;
    }

    function getCandidates(it, fitFn, allowFallback){
      const all = toCandidates(it).filter(fitFn);
      if(!all.length) return all;
      const pref = all.filter(prefersFinalOrientation);
      if(pref.length) return pref;
      return allowFallback ? all : [];
    }

    function orientationBonus(c, weight){
      return prefersFinalOrientation(c) ? weight : -Math.abs(weight);
    }

    function rotationModeBonus(c, strategy){
      const mode = strategy && strategy.rotateMode ? String(strategy.rotateMode) : 'auto';
      if(mode === 'auto') return 0;
      if(mode === 'prefer-rotated') return c.rotated ? 90000 : -20000;
      if(mode === 'prefer-natural') return c.rotated ? -15000 : 50000;
      if(mode === 'prefer-tail-rotated') return c.rotated ? 140000 : -25000;
      return 0;
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

    function placeFromCandidate(sheet, it, cand, x, y){
      sheet.placements.push({
        id: it.id,
        key: it.key,
        name: it.name,
        x,
        y,
        w: cand.w,
        h: cand.h,
        rotated: !!cand.rotated,
        edgeW1: cand.rotated ? it.edgeH1 : it.edgeW1,
        edgeW2: cand.rotated ? it.edgeH2 : it.edgeW2,
        edgeH1: cand.rotated ? it.edgeW1 : it.edgeH1,
        edgeH2: cand.rotated ? it.edgeW2 : it.edgeH2,
      });
    }

    function fillResidualRects(sheet, freeRects, remList, strategy){
      let free = pruneFreeRects((freeRects||[]).filter(r=>r && r.w > 0 && r.h > 0));
      while(remList.length && free.length){
        let best = null;
        for(let fi=0; fi<free.length; fi++){
          const fr = free[fi];
          for(let i=0;i<remList.length;i++){
            const it = remList[i];
            let opts = getCandidates(it, c => c.w <= fr.w && c.h <= fr.h, false);
            if(!opts.length) opts = getCandidates(it, c => c.w <= fr.w && c.h <= fr.h, true);
            for(const c of opts){
              const shortSide = Math.min(fr.w - c.w, fr.h - c.h);
              const longSide = Math.max(fr.w - c.w, fr.h - c.h);
              const exactW = (fr.w - c.w === 0) ? 1 : 0;
              const exactH = (fr.h - c.h === 0) ? 1 : 0;
              const sc =
                (exactW * 600000) +
                (exactH * 350000) +
                orientationBonus(c, 180000) +
                rotationModeBonus(c, strategy) +
                (c.w * c.h * (strategy.areaWeight || 2)) -
                (shortSide * (strategy.shortPenalty || 1200)) -
                (longSide * (strategy.longPenalty || 200));
              if(!best || sc > best.sc){
                best = { fi, idx:i, it, cand:c, fr, sc };
              }
            }
          }
        }
        if(!best) break;
        placeFromCandidate(sheet, best.it, best.cand, best.fr.x, best.fr.y);
        const placedK = { x: best.fr.x, y: best.fr.y, w: best.cand.w + K, h: best.cand.h + K };
        const nextFree = [];
        for(const fr of free){
          if(rectIntersects(fr, placedK)) nextFree.push(...splitFreeRectByIntersection(fr, placedK));
          else nextFree.push(fr);
        }
        free = pruneFreeRects(nextFree.filter(r=>r.w >= 40 && r.h >= 40));
        remList.splice(best.idx, 1);
      }
      return free;
    }

    function collectStripHeights(remList, availableH){
      const byH = new Map();
      for(const it of remList){
        let opts = getCandidates(it, c => c.w <= BW && c.h <= availableH, false);
        if(!opts.length) opts = getCandidates(it, c => c.w <= BW && c.h <= availableH, true);
        for(const c of opts){
          const e = byH.get(c.h) || { h:c.h, area:0, count:0 };
          e.area += c.w * c.h;
          e.count += 1;
          byH.set(c.h, e);
        }
      }
      const arr = Array.from(byH.values());
      arr.sort((a,b)=>{
        if(b.area !== a.area) return b.area - a.area;
        if(b.count !== a.count) return b.count - a.count;
        return b.h - a.h;
      });
      return arr.slice(0, 14).map(v=>v.h);
    }

    function buildStripPlan(remList, rowH, strategy){
      const n = remList.length;
      const dp = new Array(BW + 1).fill(null);
      dp[0] = { score: 0, area: 0, count: 0, gapArea: 0, exactCount: 0, rotatedCount: 0, prev: -1, item: -1, cand: null };

      for(let i=0;i<n;i++){
        const it = remList[i];
        let options = getCandidates(it, c => c.w <= BW && c.h <= rowH, false);
        if(!options.length) options = getCandidates(it, c => c.w <= BW && c.h <= rowH, true);
        if(strategy.exactOnly){
          const exact = options.filter(c => c.h === rowH);
          if(exact.length) options = exact;
        }
        if(!options.length) continue;
        const next = dp.slice();
        for(let used=0; used<=BW; used++){
          const state = dp[used];
          if(!state) continue;
          for(const c of options){
            const extraW = (state.count > 0 ? K : 0) + c.w;
            const nw = used + extraW;
            if(nw > BW) continue;
            const gapH = rowH - c.h;
            const tail = BW - nw;
            const fitBonus = tail <= MAX_TAIL_WASTE ? (strategy.tailBonus || 200000) : 0;
            const exactHeight = gapH === 0 ? 1 : 0;
            const localScore = state.score
              + (c.w * c.h * (strategy.areaWeight || 1000))
              + (exactHeight * (strategy.exactHBonus || 80000))
              + orientationBonus(c, strategy.orientationWeight || 240000)
              + rotationModeBonus(c, strategy)
              - (gapH * c.w * (strategy.gapPenalty || 6))
              - (tail <= MAX_TAIL_WASTE ? 0 : tail * (strategy.tailPenalty || 20))
              + fitBonus;
            const prevBest = next[nw];
            if(!prevBest || localScore > prevBest.score){
              next[nw] = {
                score: localScore,
                area: state.area + c.w*c.h,
                count: state.count + 1,
                gapArea: state.gapArea + (gapH * c.w),
                exactCount: state.exactCount + (exactHeight ? 1 : 0),
                rotatedCount: state.rotatedCount + (c.rotated ? 1 : 0),
                prev: used,
                item: i,
                cand: c
              };
            }
          }
        }
        for(let x=0;x<=BW;x++) dp[x] = next[x];
      }

      let bestW = 0;
      let bestState = dp[0];
      for(let used=1; used<=BW; used++){
        const st = dp[used];
        if(!st) continue;
        const tail = BW - used;
        const occupancy = st.area / Math.max(1, BW * rowH);
        const exactRatio = st.count ? (st.exactCount / st.count) : 0;
        const gapRatio = st.gapArea / Math.max(1, BW * rowH);
        const closeness = tail <= MAX_TAIL_WASTE ? (strategy.tailCloseBonus || 250000) : -(tail * (strategy.tailClosePenalty || 400));
        const finishBias = occupancy >= 0.85 ? (strategy.finishBias || 140000) : 0;
        const total = st.score
          + closeness
          + finishBias
          + occupancy * (strategy.occWeight || 100000)
          + exactRatio * (strategy.uniformBonus || 180000)
          - gapRatio * (strategy.gapAreaPenalty || 220000)
          + ((strategy.exactOnly && exactRatio >= 0.999) ? (strategy.exactOnlyBonus || 260000) : 0);
        const cur = bestState ? (
          bestState.score
          + ((BW - bestW) <= MAX_TAIL_WASTE ? (strategy.tailCloseBonus || 250000) : -((BW - bestW) * (strategy.tailClosePenalty || 400)))
          + ((bestState.area / Math.max(1, BW * rowH)) >= 0.85 ? (strategy.finishBias || 140000) : 0)
          + (bestState.area / Math.max(1, BW * rowH)) * (strategy.occWeight || 100000)
          + ((bestState.count ? (bestState.exactCount / bestState.count) : 0) * (strategy.uniformBonus || 180000))
          - ((bestState.gapArea / Math.max(1, BW * rowH)) * (strategy.gapAreaPenalty || 220000))
          + ((strategy.exactOnly && (bestState.count ? (bestState.exactCount / bestState.count) : 0) >= 0.999) ? (strategy.exactOnlyBonus || 260000) : 0)
        ) : -1e18;
        if(!bestState || total > cur){
          bestState = st;
          bestW = used;
        }
      }
      if(!bestState || bestState.count <= 0) return null;

      const chosen = [];
      const usedItems = new Set();
      let cursor = bestW;
      while(cursor > 0){
        const st = dp[cursor];
        if(!st || st.item < 0 || !st.cand) break;
        if(!usedItems.has(st.item)){
          chosen.push({ idx: st.item, it: remList[st.item], cand: st.cand });
          usedItems.add(st.item);
        }
        cursor = st.prev;
      }
      if(!chosen.length) return null;
      chosen.reverse();
      chosen.sort((a,b)=>{
        if(b.cand.h !== a.cand.h) return b.cand.h - a.cand.h;
        return b.cand.w - a.cand.w;
      });

      let usedW = 0;
      let usedArea = 0;
      for(let i=0;i<chosen.length;i++){
        usedW += chosen[i].cand.w + (i>0 ? K : 0);
        usedArea += chosen[i].cand.w * chosen[i].cand.h;
      }
      const tail = BW - usedW;
      const occupancy = usedArea / Math.max(1, BW * rowH);
      const exactCount = chosen.filter(v => v.cand.h === rowH).length;
      const exactRatio = chosen.length ? (exactCount / chosen.length) : 0;
      const gapArea = chosen.reduce((sum, v) => sum + ((rowH - v.cand.h) * v.cand.w), 0);
      const gapRatio = gapArea / Math.max(1, BW * rowH);
      return {
        rowH,
        items: chosen,
        usedW,
        usedArea,
        occupancy,
        tail,
        exactCount,
        exactRatio,
        gapArea,
        gapRatio,
        score: usedArea
          + occupancy * (strategy.occWeight || 100000)
          + (tail <= MAX_TAIL_WASTE ? (strategy.tailBonus || 200000) : -tail * (strategy.tailPenalty || 200))
          + exactRatio * (strategy.uniformBonus || 180000)
          - gapRatio * (strategy.gapAreaPenalty || 220000)
          + ((strategy.exactOnly && exactRatio >= 0.999) ? (strategy.exactOnlyBonus || 260000) : 0)
      };
    }

    function chooseBestStrip(remList, availableH, strategy){
      const heights = collectStripHeights(remList, availableH);
      let best = null;
      for(const h of heights){
        const plan = buildStripPlan(remList, h, strategy);
        if(!plan) continue;
        const sc =
          plan.score
          + (plan.occupancy >= 0.85 ? 250000 : 0)
          + (plan.tail <= MAX_TAIL_WASTE ? 220000 : 0)
          + (plan.exactRatio >= 0.999 ? 220000 : 0)
          + (plan.exactRatio * (strategy.uniformBonus || 180000))
          - (plan.gapRatio * (strategy.gapAreaPenalty || 220000))
          + (h * (strategy.heightBias || 500));
        if(!best || sc > best.sc) best = { plan, sc };
      }
      return best ? best.plan : null;
    }

    function totalArea(list){
      return (list||[]).reduce((sum, it)=> sum + (Math.max(0, Number(it.w)||0) * Math.max(0, Number(it.h)||0)), 0);
    }

    function sheetBBoxArea(sheet){
      let maxX = 0, maxY = 0;
      for(const p of (sheet && sheet.placements) || []){
        maxX = Math.max(maxX, (p.x||0) + (p.w||0));
        maxY = Math.max(maxY, (p.y||0) + (p.h||0));
      }
      return Math.max(0, maxX) * Math.max(0, maxY);
    }

    function shouldTryTwoSheetEndgame(remList){
      const area = totalArea(remList);
      const boardArea = BW * BH;
      if(!remList || !remList.length) return false;
      return remList.length <= 64 && area <= boardArea * 1.96 && area >= boardArea * 0.55;
    }

    function scoreSheetResult(res, firstWeight, secondWeight){
      if(!res || !res.sheet) return -1e18;
      const occ = (res.usedArea || 0) / Math.max(1, BW * BH);
      const bboxA = sheetBBoxArea(res.sheet);
      const bboxRatio = bboxA / Math.max(1, BW * BH);
      const compactBonus = (1 - Math.min(1, bboxRatio)) * 300000;
      return res.score * (firstWeight || 1) + occ * (secondWeight || 1) + compactBonus;
    }

    function estimateUniformRowBonus(sheet){
      const rows = new Map();
      for(const p of (sheet && sheet.placements) || []){
        const key = `${p.y||0}:${p.h||0}`;
        const e = rows.get(key) || { count:0, area:0 };
        e.count += 1;
        e.area += (p.w||0) * (p.h||0);
        rows.set(key, e);
      }
      let bonus = 0;
      for(const r of rows.values()){
        if(r.count >= 2) bonus += 1;
        if(r.count >= 3) bonus += 0.5;
      }
      return bonus;
    }

    function buildBestTwoSheets(remList){
      const endStrategies = strategies.concat([
        { name:'late-rotated', areaWeight:1100, exactHBonus:90000, gapPenalty:7, tailPenalty:18, tailBonus:280000, tailCloseBonus:300000, finishBias:180000, occWeight:130000, heightBias:520, orientationWeight:260000, shortPenalty:1100, longPenalty:200, uniformBonus:220000, gapAreaPenalty:260000, rotateMode:'prefer-rotated' },
        { name:'late-natural', areaWeight:1050, exactHBonus:85000, gapPenalty:6, tailPenalty:18, tailBonus:260000, tailCloseBonus:290000, finishBias:170000, occWeight:120000, heightBias:520, orientationWeight:260000, shortPenalty:1100, longPenalty:210, uniformBonus:220000, gapAreaPenalty:240000, rotateMode:'prefer-natural' },
        { name:'late-tail-rot', areaWeight:1100, exactHBonus:90000, gapPenalty:8, tailPenalty:12, tailBonus:340000, tailCloseBonus:360000, finishBias:220000, occWeight:145000, heightBias:420, orientationWeight:260000, shortPenalty:1000, longPenalty:180, uniformBonus:260000, gapAreaPenalty:220000, rotateMode:'prefer-tail-rotated' },
        { name:'late-exact-band', areaWeight:1020, exactHBonus:190000, gapPenalty:16, tailPenalty:12, tailBonus:360000, tailCloseBonus:380000, finishBias:220000, occWeight:130000, heightBias:900, orientationWeight:320000, shortPenalty:1600, longPenalty:220, uniformBonus:420000, gapAreaPenalty:460000, exactOnly:true, exactOnlyBonus:520000 },
        { name:'late-exact-band-rot', areaWeight:1020, exactHBonus:190000, gapPenalty:16, tailPenalty:12, tailBonus:360000, tailCloseBonus:380000, finishBias:220000, occWeight:130000, heightBias:900, orientationWeight:320000, shortPenalty:1600, longPenalty:220, uniformBonus:420000, gapAreaPenalty:460000, exactOnly:true, exactOnlyBonus:520000, rotateMode:'prefer-rotated' }
      ]);
      let best = null;
      for(const s1 of endStrategies){
        const first = buildSheetVariant(remList, s1);
        if(!first) continue;
        if(!first.rem || !first.rem.length){
          const pairScore = scoreSheetResult(first, 1.35, 1000000);
          if(!best || pairScore > best.score) best = { score: pairScore, sheets:[first.sheet], rem: first.rem };
          continue;
        }
        for(const s2 of endStrategies){
          const second = buildSheetVariant(first.rem, s2);
          if(!second) continue;
          const rem2 = second.rem || [];
          if(rem2.length) continue;
          const firstOcc = (first.usedArea || 0) / Math.max(1, BW * BH);
          const secondOcc = (second.usedArea || 0) / Math.max(1, BW * BH);
          const secondBBox = sheetBBoxArea(second.sheet) / Math.max(1, BW * BH);
          const firstRows = estimateUniformRowBonus(first.sheet);
          const secondRows = estimateUniformRowBonus(second.sheet);
          const pairScore =
            scoreSheetResult(first, 1.45, 1200000)
            + scoreSheetResult(second, 0.95, 500000)
            + firstOcc * 700000
            - secondBBox * 260000
            + firstRows * 180000
            + secondRows * 120000
            + (firstOcc >= 0.88 ? 220000 : 0)
            + (secondOcc >= 0.78 ? 80000 : 0)
            - ((second.sheet.placements||[]).length * 1500);
          if(!best || pairScore > best.score){
            best = { score: pairScore, sheets:[first.sheet, second.sheet], rem: rem2 };
          }
        }
      }
      return best;
    }

    function buildSheetVariant(sourceRem, strategy){
      const rem = sourceRem.map(it=>Object.assign({}, it));
      const sheet = { boardW: BW, boardH: BH, placements: [] };
      const residual = [];
      let cursorY = 0;
      let placedAny = false;

      while(rem.length){
        const availableH = BH - cursorY;
        if(availableH <= 40) break;
        const plan = chooseBestStrip(rem, availableH, strategy);
        if(!plan) break;

        let cursorX = 0;
        const rowH = plan.rowH;
        const usedIds = [];
        for(const picked of plan.items){
          placeFromCandidate(sheet, picked.it, picked.cand, cursorX, cursorY);
          if(rowH - picked.cand.h - K > 40){
            residual.push({ x: cursorX, y: cursorY + picked.cand.h + K, w: picked.cand.w, h: rowH - picked.cand.h - K });
          }
          cursorX += picked.cand.w + K;
          usedIds.push(picked.it.id);
          placedAny = true;
        }

        for(let r=rem.length-1; r>=0; r--){
          if(usedIds.includes(rem[r].id)) rem.splice(r, 1);
        }

        const usedW = Math.max(0, cursorX - K);
        const tailX = usedW + K;
        const tailW = BW - tailX;
        if(tailW > 40 && rowH > 40){
          residual.push({ x: tailX, y: cursorY, w: tailW, h: rowH });
        }
        cursorY += rowH + K;
      }

      if(!placedAny) return null;
      const bottomH = BH - cursorY;
      if(bottomH > 40){
        residual.push({ x:0, y: cursorY, w: BW, h: bottomH });
      }
      const freeLeft = fillResidualRects(sheet, residual, rem, strategy);
      const usedArea = sheet.placements.reduce((s,p)=> s + (p.w * p.h), 0);
      const occupancy = usedArea / Math.max(1, BW * BH);
      const bigWaste = (freeLeft||[]).reduce((m,r)=> Math.max(m, r.w*r.h), 0);
      const bboxArea = sheetBBoxArea(sheet);
      const score = usedArea * 50 + occupancy * 1000000 + (occupancy >= 0.85 ? 400000 : 0) - bigWaste * 0.08 - bboxArea * 0.01 + sheet.placements.length * 500;
      return { sheet, rem, score, usedArea, occupancy, bboxArea };
    }

    const strategies = [
      { name:'balanced', areaWeight:1000, exactHBonus:80000, gapPenalty:6, tailPenalty:20, tailBonus:220000, tailCloseBonus:260000, finishBias:150000, occWeight:100000, heightBias:500, orientationWeight:260000, shortPenalty:1200, longPenalty:200, uniformBonus:180000, gapAreaPenalty:220000 },
      { name:'tight-tail', areaWeight:1000, exactHBonus:70000, gapPenalty:8, tailPenalty:30, tailBonus:300000, tailCloseBonus:340000, finishBias:150000, occWeight:110000, heightBias:300, orientationWeight:260000, shortPenalty:1400, longPenalty:220, uniformBonus:180000, gapAreaPenalty:240000 },
      { name:'exact-height', areaWeight:900, exactHBonus:140000, gapPenalty:10, tailPenalty:18, tailBonus:200000, tailCloseBonus:220000, finishBias:140000, occWeight:90000, heightBias:800, orientationWeight:260000, shortPenalty:1200, longPenalty:260, uniformBonus:220000, gapAreaPenalty:260000 },
      { name:'dense', areaWeight:1200, exactHBonus:90000, gapPenalty:5, tailPenalty:26, tailBonus:180000, tailCloseBonus:220000, finishBias:200000, occWeight:130000, heightBias:450, orientationWeight:260000, shortPenalty:1000, longPenalty:180, uniformBonus:150000, gapAreaPenalty:180000 },
      { name:'compact', areaWeight:950, exactHBonus:60000, gapPenalty:12, tailPenalty:16, tailBonus:280000, tailCloseBonus:300000, finishBias:120000, occWeight:95000, heightBias:650, orientationWeight:260000, shortPenalty:1500, longPenalty:240, uniformBonus:220000, gapAreaPenalty:260000 },
      { name:'exact-band', areaWeight:980, exactHBonus:180000, gapPenalty:16, tailPenalty:14, tailBonus:320000, tailCloseBonus:360000, finishBias:180000, occWeight:100000, heightBias:900, orientationWeight:300000, shortPenalty:1600, longPenalty:260, uniformBonus:380000, gapAreaPenalty:420000, exactOnly:true, exactOnlyBonus:420000 },
      { name:'exact-band-rot', areaWeight:980, exactHBonus:180000, gapPenalty:16, tailPenalty:14, tailBonus:320000, tailCloseBonus:360000, finishBias:180000, occWeight:100000, heightBias:900, orientationWeight:300000, shortPenalty:1600, longPenalty:260, uniformBonus:380000, gapAreaPenalty:420000, exactOnly:true, exactOnlyBonus:420000, rotateMode:'prefer-rotated' },
    ];

    while(remMaster.length){
      if(shouldTryTwoSheetEndgame(remMaster)){
        const late = buildBestTwoSheets(remMaster);
        if(late && late.sheets && late.sheets.length){
          remMaster = late.rem || [];
          for(const sh of late.sheets){
            const sheet = sh;
            if(swap){
              sheet.placements.forEach(swapPlacementBack);
              sheet.boardW = W;
              sheet.boardH = H;
            } else {
              sheet.boardW = W;
              sheet.boardH = H;
            }
            sheets.push(sheet);
          }
          continue;
        }
      }

      let bestVariant = null;
      for(const strategy of strategies){
        const variant = buildSheetVariant(remMaster, strategy);
        if(!variant) continue;
        if(!bestVariant || variant.score > bestVariant.score) bestVariant = variant;
      }

      if(!bestVariant){
        const it = remMaster.shift();
        if(!it) break;
        const sheet = { boardW: BW, boardH: BH, placements: [{ id: it.id, key: it.key, name: it.name, x:0, y:0, w: it.w, h: it.h, rotated:false, unplaced:true }] };
        if(swap){
          sheet.placements.forEach(swapPlacementBack);
          sheet.boardW = W; sheet.boardH = H;
        } else {
          sheet.boardW = W; sheet.boardH = H;
        }
        sheets.push(sheet);
        continue;
      }

      remMaster = bestVariant.rem;
      const sheet = bestVariant.sheet;
      if(swap){
        sheet.placements.forEach(swapPlacementBack);
        sheet.boardW = W;
        sheet.boardH = H;
      } else {
        sheet.boardW = W;
        sheet.boardH = H;
      }
      sheets.push(sheet);
    }

    return sheets;
  }



  // ===== MaxRects (best short-side fit)
  function packMaxRects(itemsIn, boardW, boardH, kerf){
    const W = clampInt(boardW, 2800);
    const H = clampInt(boardH, 2070);
    const K = Math.max(0, Math.round(Number(kerf)||0));

    const items = sortRectsByMaxSideDesc(itemsIn);
    const sheets = [];

    function newSheet(){
      const sheet = {
        boardW: W,
        boardH: H,
        placements: [],
        freeRects: [{ x:0, y:0, w:W, h:H }]
      };
      sheets.push(sheet);
      return sheet;
    }

    let sheet = newSheet();

    function scoreFit(free, w, h){
      const leftoverH = free.h - h;
      const leftoverW = free.w - w;
      const shortSide = Math.min(leftoverH, leftoverW);
      const longSide = Math.max(leftoverH, leftoverW);
      return { shortSide, longSide };
    }

    function findPosition(sheet, it){
      let best = null;
      for(const free of sheet.freeRects){
        const candidates = [];
        candidates.push({ w: it.w, h: it.h, rotated:false });
        if(it.rotationAllowed) candidates.push({ w: it.h, h: it.w, rotated:true });

        for(const c of candidates){
          const w = c.w;
          const h = c.h;
          if(!rectFits(free, w, h)) continue;
          const sc = scoreFit(free, w, h);
          if(!best || sc.shortSide < best.sc.shortSide || (sc.shortSide === best.sc.shortSide && sc.longSide < best.sc.longSide)){
            best = { x: free.x, y: free.y, w, h, rotated: c.rotated, sc, free };
          }
        }
      }
      return best;
    }

    function place(sheet, it, pos){
      const placed = { x: pos.x, y: pos.y, w: pos.w, h: pos.h };
      sheet.placements.push({
        id: it.id,
        key: it.key,
        name: it.name,
        x: placed.x,
        y: placed.y,
        w: placed.w,
        h: placed.h,
        rotated: pos.rotated,
        edgeW1: pos.rotated ? it.edgeH1 : it.edgeW1,
        edgeW2: pos.rotated ? it.edgeH2 : it.edgeW2,
        edgeH1: pos.rotated ? it.edgeW1 : it.edgeH1,
        edgeH2: pos.rotated ? it.edgeW2 : it.edgeH2,
      });

      // Apply kerf as a safety margin (to the right and bottom) to prevent near-touch
      // overlaps and to model the saw cut width.
      const placedK = { x: placed.x, y: placed.y, w: placed.w + K, h: placed.h + K };

      // Correct MaxRects update: split ALL intersecting free rects against placed rect.
      const nextFree = [];
      for(const fr of sheet.freeRects){
        if(rectIntersects(fr, placedK)){
          nextFree.push(...splitFreeRectByIntersection(fr, placedK));
        } else {
          nextFree.push(fr);
        }
      }
      sheet.freeRects = pruneFreeRects(nextFree);
    }

    for(const it of items){
      let pos = findPosition(sheet, it);
      if(!pos){
        sheet = newSheet();
        pos = findPosition(sheet, it);
      }
      if(pos) place(sheet, it, pos);
      else {
        // element too big even on empty sheet — keep as "unplaced" on last sheet (debug)
        sheet.placements.push({ id: it.id, key: it.key, name: it.name, x:0, y:0, w: it.w, h: it.h, rotated:false, unplaced:true });
      }
    }

    return sheets;
  }

  // ===== SUPER: multi-start search (kilka sekund)
  // Runs several orderings + small random perturbations and picks the best result
  // by (#sheets, waste). Uses existing stable packers.
  function packSuper(itemsIn, boardW, boardH, kerf, options){
    const W = clampInt(boardW, 2800);
    const H = clampInt(boardH, 2070);
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const opts = options || {};
    const timeMs = Math.max(200, Math.round(Number(opts.timeMs)||2500));
    const beamWidth = Math.max(20, Math.round(Number(opts.beamWidth)||120));

    // Deterministic-ish RNG (seed based on items) so results are stable for the same input.
    let seed = 1337;
    for(const it of itemsIn){
      seed = (seed * 1664525 + 1013904223 + (it.w*31 + it.h*17)) >>> 0;
    }
    const rnd = ()=>{
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const shuffle = (arr)=>{
      const a = arr.slice();
      for(let i=a.length-1;i>0;i--){
        const j = Math.floor(rnd()*(i+1));
        const t=a[i]; a[i]=a[j]; a[j]=t;
      }
      return a;
    };

    const score = (sheets)=>{
      const waste = sheets.reduce((sum,s)=> sum + calcWaste(s).waste, 0);
      return { sheets: sheets.length, waste };
    };
    const better = (a, b)=>{
      if(!b) return true;
      if(a.sc.sheets !== b.sc.sheets) return a.sc.sheets < b.sc.sheets;
      return a.sc.waste < b.sc.waste;
    };

    // Base orderings
    const byAreaDesc = itemsIn.slice().sort((a,b)=>(b.w*b.h)-(a.w*a.h));
    const byPerimDesc = itemsIn.slice().sort((a,b)=>((b.w+b.h)-(a.w+a.h)));
    const byMaxSideDesc = sortRectsByMaxSideDesc(itemsIn);
    const byMinSideDesc = itemsIn.slice().sort((a,b)=>Math.min(b.w,b.h)-Math.min(a.w,a.h));

    const candidates = [byAreaDesc, byMaxSideDesc, byPerimDesc, byMinSideDesc];
    const started = Date.now();
    let best = null;

    const tryOne = (arr)=>{
      const mr = packMaxRects(arr, W, H, K);
      const sc = score(mr);
      const res = { sheets: mr, sc };
      if(better(res, best)) best = res;

      // Also try Guillotine PRO quickly if available
      if(window.FC && window.FC.cutOptimizer && typeof window.FC.cutOptimizer.packGuillotineBeam === 'function'){
        const gb = window.FC.cutOptimizer.packGuillotineBeam(arr, W, H, K, {
          beamWidth,
          timeMs: Math.min(600, Math.max(250, Math.round(timeMs/6)))
        });
        const sc2 = score(gb);
        const res2 = { sheets: gb, sc: sc2 };
        if(better(res2, best)) best = res2;
      }
    };

    // First deterministic passes
    for(const c of candidates) tryOne(c);

    // Random perturbations until time budget
    while(Date.now() - started < timeMs){
      const base = candidates[Math.floor(rnd()*candidates.length)];
      tryOne(shuffle(base));
    }

    return best ? best.sheets : packMaxRects(itemsIn, W, H, K);
  }

  function calcWaste(sheet){
    const areaBoard = sheet.boardW * sheet.boardH;
    const used = (sheet.placements||[]).filter(p=>!p.unplaced).reduce((s,p)=>s + (p.w*p.h),0);
    const waste = Math.max(0, areaBoard - used);
    return {
      areaBoard,
      used,
      waste,
      wastePct: areaBoard>0 ? (waste/areaBoard)*100 : 0,
    };
  }

  window.FC.cutOptimizer = {
    makeItems,
    packShelf,
    packStripBands,
    packMaxRects,
    packSuper,
    calcWaste,
  };
})();

// ===== Guillotine Beam Search ("Gilotyna PRO")
// Cel: praktyczny plan pod cięcia pełnym przejazdem, bez nakładania elementów.
// To nadal heurystyka, ale z "myśleniem" (beam search) – zwykle lepiej niż Shelf.
(function(){
  'use strict';
  if(!window.FC || !window.FC.cutOptimizer) return;
  const opt = window.FC.cutOptimizer;

  function clampInt(v, fallback){
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function rectFits(r, w, h){
    return (w <= r.w && h <= r.h);
  }

  function pruneFreeRects(freeRects){
    const out = [];
    for(let i=0;i<freeRects.length;i++){
      const a = freeRects[i];
      if(a.w<=0 || a.h<=0) continue;
      let contained = false;
      for(let j=0;j<freeRects.length;j++){
        if(i===j) continue;
        const b = freeRects[j];
        if(b.w<=0 || b.h<=0) continue;
        if(a.x>=b.x && a.y>=b.y && (a.x+a.w)<= (b.x+b.w) && (a.y+a.h) <= (b.y+b.h)){
          contained = true; break;
        }
      }
      if(!contained) out.push(a);
    }
    // stable-ish ordering
    return out.sort((p,q)=> (p.y-q.y) || (p.x-q.x) || ((p.w*p.h) - (q.w*q.h)));
  }

  // Soft preference for "professional" strip/band style layouts.
  // This is deliberately only a tie-breaker inside the beam search:
  // - reward placements that extend existing rows/columns,
  // - reward repeated widths/heights,
  // - keep strong anchors on sheet edges.
  // It must NEVER dominate usedArea / sheet count.
  function scorePlacementAlignment(existingPlacements, placement, boardW, boardH){
    const pls = Array.isArray(existingPlacements) ? existingPlacements : [];
    const p = placement || {};
    const px2 = (p.x||0) + (p.w||0);
    const py2 = (p.y||0) + (p.h||0);
    let score = 0;

    if((p.x||0) === 0 || px2 === boardW) score += 1.0;
    if((p.y||0) === 0 || py2 === boardH) score += 1.0;

    for(const q of pls){
      if(!q || q.unplaced) continue;
      const qx2 = (q.x||0) + (q.w||0);
      const qy2 = (q.y||0) + (q.h||0);

      // Shared strip/band edges.
      if((p.x||0) === (q.x||0) || px2 === qx2) score += 0.65;
      if((p.y||0) === (q.y||0) || py2 === qy2) score += 0.65;

      // Repeated dimensions tend to build cleaner bands / strips.
      if((p.w||0) === (q.w||0)) score += 0.35;
      if((p.h||0) === (q.h||0)) score += 0.35;

      // Exact adjacency without overlap extends a pass / shelf naturally.
      if(px2 === (q.x||0) || qx2 === (p.x||0)) score += 0.22;
      if(py2 === (q.y||0) || qy2 === (p.y||0)) score += 0.22;
    }
    return score;
  }

  function sortByAreaDesc(items){
    return items.slice().sort((a,b)=> (b.w*b.h) - (a.w*a.h));
  }

  // Guillotine split (NON-overlapping):
  // We place always at top-left corner of a free rect.
  // Two valid, non-overlapping splits exist:
  //  - Horizontal-first: make a top band (height = placed.h) then split that band vertically.
  //  - Vertical-first: make a left band (width = placed.w) then split that band horizontally.
  // We choose automatically by keeping the larger secondary leftover (simple but stable).
  // cutPref:
  //  - 'auto'   : choose split by leftover score (default)
  //  - 'along'  : prefer making vertical cuts first (rip strips)
  //  - 'across' : prefer making horizontal cuts first (cross cuts)
  function splitFreeRectGuillotine(free, placed, cutPref){
    const outA = [];
    const outB = [];

    // A) Horizontal-first
    // Right of placed within the top band
    const rwA = (free.x + free.w) - (placed.x + placed.w);
    if(rwA > 0){
      outA.push({ x: placed.x + placed.w, y: free.y, w: rwA, h: placed.h });
    }
    // Bottom band
    const bhA = (free.y + free.h) - (placed.y + placed.h);
    if(bhA > 0){
      outA.push({ x: free.x, y: placed.y + placed.h, w: free.w, h: bhA });
    }

    // B) Vertical-first
    // Bottom of placed within the left band
    const bhB = (free.y + free.h) - (placed.y + placed.h);
    if(bhB > 0){
      outB.push({ x: free.x, y: placed.y + placed.h, w: placed.w, h: bhB });
    }
    // Right band
    const rwB = (free.x + free.w) - (placed.x + placed.w);
    if(rwB > 0){
      outB.push({ x: placed.x + placed.w, y: free.y, w: rwB, h: free.h });
    }

    if(cutPref === 'across') return outA;
    if(cutPref === 'along') return outB;

    const score = (arr)=> arr.reduce((m,r)=> Math.max(m, r.w*r.h), 0);
    return score(outA) >= score(outB) ? outA : outB;
  }

  function placeInFreeRect(state, free, item, w, h, rotated, kerf, cutPref){
    const K = kerf;
    const placed = { x: free.x, y: free.y, w, h };
    const placement = {
      id: item.id,
      key: item.key,
      name: item.name,
      x: placed.x,
      y: placed.y,
      w: placed.w,
      h: placed.h,
      rotated: !!rotated,
      edgeW1: rotated ? item.edgeH1 : item.edgeW1,
      edgeW2: rotated ? item.edgeH2 : item.edgeW2,
      edgeH1: rotated ? item.edgeW1 : item.edgeH1,
      edgeH2: rotated ? item.edgeW2 : item.edgeH2,
    };

    const newFree = state.freeRects.filter(fr => fr !== free);
    const split = splitFreeRectGuillotine(free, placed, cutPref);

    // Apply kerf as spacing between placed rect and remaining free rects.
    // We shrink and shift only on the side adjacent to the placed rect.
    const adjusted = split.map(r=>{
      let ax=r.x, ay=r.y, aw=r.w, ah=r.h;
      if(r.x >= placed.x + placed.w){ ax = r.x + K; aw = r.w - K; }
      if(r.y >= placed.y + placed.h){ ay = r.y + K; ah = r.h - K; }
      return { x: ax, y: ay, w: aw, h: ah };
    }).filter(r=> r.w>0 && r.h>0);

    newFree.push(...adjusted);
    return {
      placements: state.placements.concat([placement]),
      freeRects: pruneFreeRects(newFree),
      usedArea: state.usedArea + (w*h),
      alignmentScore: (state.alignmentScore||0) + scorePlacementAlignment(state.placements, placement, state.boardW, state.boardH),
    };
  }

  function fillOneSheetBeam(items, W, H, K, beamWidth, timeMs, cutPref){
    const start = Date.now();
    const maxBeam = clampInt(beamWidth, 40);
    const budgetMs = Math.max(60, clampInt(timeMs, 300));

    const remaining = sortByAreaDesc(items);
    let beam = [{ placements: [], freeRects: [{ x:0, y:0, w:W, h:H }], usedArea: 0, usedIdx: new Set(), alignmentScore: 0, boardW: W, boardH: H }];

    const CAND_ITEMS = 8;
    const CAND_FREES = 14;

    while(Date.now() - start < budgetMs){
      const next = [];
      for(const st of beam){
        const cand = [];
        for(let i=0;i<remaining.length && cand.length<CAND_ITEMS;i++){
          if(!st.usedIdx.has(i)) cand.push({ idx:i, it: remaining[i] });
        }
        if(cand.length===0) continue;

        const freeList = st.freeRects.slice(0, CAND_FREES);
        for(const f of freeList){
          for(const c of cand){
            const it = c.it;
            const opts = [{ w: it.w, h: it.h, rotated:false }];
            if(it.rotationAllowed) opts.push({ w: it.h, h: it.w, rotated:true });
            for(const o of opts){
              if(!rectFits(f, o.w, o.h)) continue;
              const placedState = placeInFreeRect(st, f, it, o.w, o.h, o.rotated, K, cutPref);
              const usedIdx = new Set(st.usedIdx);
              usedIdx.add(c.idx);
              next.push({
                placements: placedState.placements,
                freeRects: placedState.freeRects,
                usedArea: placedState.usedArea,
                usedIdx,
                alignmentScore: placedState.alignmentScore || 0,
                boardW: W,
                boardH: H,
              });
            }
          }
        }
      }
      if(next.length===0) break;

      next.sort((a,b)=>{
        if(b.usedArea !== a.usedArea) return b.usedArea - a.usedArea;
        if((b.alignmentScore||0) !== (a.alignmentScore||0)) return (b.alignmentScore||0) - (a.alignmentScore||0);
        const aMax = a.freeRects.reduce((m,r)=>Math.max(m,r.w*r.h),0);
        const bMax = b.freeRects.reduce((m,r)=>Math.max(m,r.w*r.h),0);
        if(bMax !== aMax) return bMax - aMax;
        return (a.freeRects.length||0) - (b.freeRects.length||0);
      });
      beam = next.slice(0, maxBeam);

      const best = beam[0];
      let canPlaceMore = false;
      outer: for(const f of best.freeRects){
        for(let i=0;i<remaining.length;i++){
          if(best.usedIdx.has(i)) continue;
          const it = remaining[i];
          if(rectFits(f, it.w, it.h) || (it.rotationAllowed && rectFits(f, it.h, it.w))){
            canPlaceMore = true; break outer;
          }
        }
      }
      if(!canPlaceMore) break;
    }

    const best = beam[0] || { placements: [], freeRects: [{x:0,y:0,w:W,h:H}], usedArea:0, usedIdx: new Set(), alignmentScore:0, boardW:W, boardH:H };
    const rest = [];
    for(let i=0;i<remaining.length;i++) if(!best.usedIdx.has(i)) rest.push(remaining[i]);
    // IMPORTANT: expose freeRects so caller can keep using scrap areas across sheets.
    return { placements: best.placements, remaining: rest, freeRects: best.freeRects || [], usedArea: best.usedArea || 0 };
  }

  // Try to place remaining items into already-created sheets using their current freeRects.
  // This is a "scrap-first" pass that tends to eliminate last sheets with small leftovers.
  function tryFillExistingSheets(sheets, remaining, W, H, K, cutPref){
    if(!sheets.length || !remaining.length) return { sheets, remaining, placed:false };

    // Work on a mutable copy of remaining (largest first)
    let rem = sortByAreaDesc(remaining);
    let placedAny = false;

    // Greedy: iterate sheets in order; for each sheet, try to place any remaining item into any freeRect.
    for(const sh of sheets){
      if(!rem.length) break;
      if(!sh._freeRects || !sh._freeRects.length) continue;

      // Build a state wrapper compatible with placeInFreeRect
      let st = {
        placements: sh.placements,
        freeRects: sh._freeRects,
        usedArea: sh._usedArea || 0,
      };

      // Attempt multiple passes because each placement changes freeRects
      let localPlaced = true;
      while(localPlaced && rem.length){
        localPlaced = false;

        // For each item (big to small), find first fit in this sheet.
        outerItem: for(let i=0;i<rem.length;i++){
          const it = rem[i];
          // Try each free rect (largest first helps)
          const freeSorted = st.freeRects.slice().sort((a,b)=>(b.w*b.h)-(a.w*a.h));
          for(const f of freeSorted){
            const opts = [{ w: it.w, h: it.h, rotated:false }];
            if(it.rotationAllowed) opts.push({ w: it.h, h: it.w, rotated:true });
            for(const o of opts){
              if(!rectFits(f, o.w, o.h)) continue;
              st = placeInFreeRect(st, f, it, o.w, o.h, o.rotated, K, cutPref);
              // remove this item instance
              rem.splice(i,1);
              placedAny = true;
              localPlaced = true;
              break outerItem;
            }
          }
        }
      }

      // persist back to sheet
      sh.placements = st.placements;
      sh._freeRects = st.freeRects;
      sh._usedArea = st.usedArea;
    }

    return { sheets, remaining: rem, placed: placedAny };
  }

  function packGuillotineBeam(itemsIn, boardW, boardH, kerf, options){
    const W = clampInt(boardW, 2800);
    const H = clampInt(boardH, 2070);
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const beamWidth = options && options.beamWidth ? options.beamWidth : 60;
    const timeMs = options && options.timeMs ? options.timeMs : 450;
    const cutPref = (options && options.cutPref) ? options.cutPref : 'auto';

    const scrapFirst = !!(options && options.scrapFirst);
    let remaining = sortByAreaDesc(itemsIn);
    const sheets = [];

    // If enabled, prefer reusing scraps on existing sheets before allocating a new board.
    if(scrapFirst){
      while(remaining.length>0){
        const filled = tryFillExistingSheets(sheets, remaining, W, H, K, cutPref);
        remaining = filled.remaining;
        if(!remaining.length) break;

        const res = fillOneSheetBeam(remaining, W, H, K, beamWidth, timeMs, cutPref);
      const placements = res.placements || [];
      if(placements.length===0){
        const it = remaining[0];
        sheets.push({ boardW: W, boardH: H, placements: [{ id: it.id, key: it.key, name: it.name, x:0, y:0, w: it.w, h: it.h, rotated:false, unplaced:true }] });
        remaining = remaining.slice(1);
        continue;
      }
      const sheet = { boardW: W, boardH: H, placements };
      // Keep internal freeRects for later scrap reuse. Filter: keep only meaningful scraps (>=10cm x 10cm).
      const minScrapW = Math.max(0, Math.round((options && options.minScrapW != null) ? Number(options.minScrapW) : 100));
      const minScrapH = Math.max(0, Math.round((options && options.minScrapH != null) ? Number(options.minScrapH) : 100));
      sheet._freeRects = (res.freeRects || []).filter(r=>r.w>=minScrapW && r.h>=minScrapH);
      sheet._usedArea = res.usedArea || 0;
      sheets.push(sheet);
      remaining = res.remaining;
    }

      // Final pass: one more attempt to backfill any leftover into scraps
      if(remaining.length && sheets.length){
        const filled2 = tryFillExistingSheets(sheets, remaining, W, H, K, cutPref);
        remaining = filled2.remaining;
      }
    }

    // Default (legacy) behavior: fill sheets sequentially.
    while(remaining.length>0){
      const res = fillOneSheetBeam(remaining, W, H, K, beamWidth, timeMs, cutPref);
      const placements = res.placements || [];
      if(!placements.length){
        const it = remaining[0];
        sheets.push({ boardW: W, boardH: H, placements: [{ id: it.id, key: it.key, name: it.name, x:0, y:0, w: it.w, h: it.h, rotated:false, unplaced:true }] });
        remaining = remaining.slice(1);
        continue;
      }
      sheets.push({ boardW: W, boardH: H, placements });
      remaining = res.remaining;
    }
    return sheets;
  }

  opt.packGuillotineBeam = packGuillotineBeam;
})();

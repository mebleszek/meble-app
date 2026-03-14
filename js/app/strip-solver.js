/* strip-solver.js — wydzielony solver trybów pasowych (wzdłuż / w poprzek)
   Trzymany osobno, żeby eksperymenty z Optimax optional nie ryzykowały regresji
   w klasycznych trybach pasowych.
*/

(function(root){
  'use strict';

  root.FC = root.FC || {};

  function clampInt(v, fallback){
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function rectIntersects(a, b){
    return !(b.x >= a.x + a.w ||
             b.x + b.w <= a.x ||
             b.y >= a.y + a.h ||
             b.y + b.h <= a.y);
  }

  function splitFreeRectByIntersection(free, placed){
    const out = [];
    if(!rectIntersects(free, placed)) return [free];

    const fx = free.x, fy = free.y, fw = free.w, fh = free.h;
    const px = placed.x, py = placed.y, pw = placed.w, ph = placed.h;

    const fr = fx + fw;
    const fb = fy + fh;
    const pr = px + pw;
    const pb = py + ph;

    if(px > fx){
      out.push({ x: fx, y: fy, w: px - fx, h: fh });
    }
    if(pr < fr){
      out.push({ x: pr, y: fy, w: fr - pr, h: fh });
    }
    if(py > fy){
      const topX = Math.max(fx, px);
      const topR = Math.min(fr, pr);
      const topW = topR - topX;
      if(topW > 0) out.push({ x: topX, y: fy, w: topW, h: py - fy });
    }
    if(pb < fb){
      const botX = Math.max(fx, px);
      const botR = Math.min(fr, pr);
      const botW = botR - botX;
      if(botW > 0) out.push({ x: botX, y: pb, w: botW, h: fb - pb });
    }
    return out.filter(r=>r.w>0 && r.h>0);
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
    return out;
  }


  function calcResidualWasteMetrics(freeRects){
    const free = Array.isArray(freeRects) ? freeRects : [];
    let disposalArea = 0;
    let disposalCount = 0;
    let reusableArea = 0;
    let longThinCount = 0;
    for(const r of free){
      const w = Number(r && r.w) || 0;
      const h = Number(r && r.h) || 0;
      if(w <= 0 || h <= 0) continue;
      const area = w * h;
      const minSide = Math.min(w, h);
      const maxSide = Math.max(w, h);
      const reusable = minSide >= 100 && area >= 30000;
      if(reusable) reusableArea += area;
      else {
        disposalArea += area;
        disposalCount += 1;
      }
      if(minSide < 110 && maxSide >= 420) longThinCount += 1;
    }
    return { disposalArea, disposalCount, reusableArea, longThinCount };
  }

  function widthBucket(n){
    return Math.max(10, Math.round((Number(n) || 0) / 10) * 10);
  }

  function isResidualSmallCandidate(c){
    const w = Number(c && c.w) || 0;
    const h = Number(c && c.h) || 0;
    return Math.min(w, h) <= 220 || (w * h) <= 120000;
  }

  function sortAcceptedBandItems(items){
    const arr = Array.isArray(items) ? items.slice() : [];
    arr.sort((a,b)=>{
      const aw = Number(a && a.cand && a.cand.w) || 0;
      const bw = Number(b && b.cand && b.cand.w) || 0;
      if(bw !== aw) return bw - aw;
      const ah = Number(a && a.cand && a.cand.h) || 0;
      const bh = Number(b && b.cand && b.cand.h) || 0;
      if(bh !== ah) return bh - ah;
      const ai = Number(a && a.idx);
      const bi = Number(b && b.idx);
      if(Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) return ai - bi;
      return 0;
    });
    return arr;
  }

  function finalizeAcceptedPlan(plan){
    if(!plan || !Array.isArray(plan.items) || plan.items.length < 2) return plan;
    plan.items = sortAcceptedBandItems(plan.items);
    return plan;
  }

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

    function collectResidualRowHeights(remList, fr){
      const byH = new Map();
      const widthSupport = new Map();
      for(const it of remList){
        let opts = getCandidates(it, c => c.w <= fr.w && c.h <= fr.h, false);
        if(!opts.length) opts = getCandidates(it, c => c.w <= fr.w && c.h <= fr.h, true);
        for(const c of opts){
          if(!isResidualSmallCandidate(c)) continue;
          const e = byH.get(c.h) || { h:c.h, area:0, count:0 };
          e.area += c.w * c.h;
          e.count += 1;
          byH.set(c.h, e);
          const bucket = widthBucket(c.w);
          widthSupport.set(bucket, (widthSupport.get(bucket) || 0) + 1);
        }
      }
      const heights = Array.from(byH.values())
        .sort((a,b)=> (b.count - a.count) || (b.area - a.area) || (b.h - a.h))
        .slice(0, 8)
        .map(v => v.h);
      return { heights, widthSupport };
    }

    function buildResidualSharedRowPlan(remList, fr, strategy){
      const meta = collectResidualRowHeights(remList, fr);
      if(!meta.heights.length) return null;
      let bestPlan = null;
      for(const rowH of meta.heights){
        const n = remList.length;
        const dp = new Array(fr.w + 1).fill(null);
        dp[0] = { score: 0, area: 0, count: 0, gapArea: 0, prev: -1, item: -1, cand: null };
        for(let i=0;i<n;i++){
          const it = remList[i];
          let options = getCandidates(it, c => c.w <= fr.w && c.h <= rowH, false);
          if(!options.length) options = getCandidates(it, c => c.w <= fr.w && c.h <= rowH, true);
          options = options.filter(isResidualSmallCandidate);
          if(!options.length) continue;
          const next = dp.slice();
          for(let used=0; used<=fr.w; used++){
            const st = dp[used];
            if(!st) continue;
            for(const c of options){
              const extraW = (st.count > 0 ? K : 0) + c.w;
              const nw = used + extraW;
              if(nw > fr.w) continue;
              const tail = fr.w - nw;
              const gapH = rowH - c.h;
              const bucket = widthBucket(c.w);
              const support = meta.widthSupport.get(bucket) || 1;
              const heightClose = gapH <= 20 ? 1 : 0;
              const localScore = st.score
                + (c.w * c.h * ((strategy.areaWeight || 1000) * 0.6))
                + orientationBonus(c, 120000)
                + rotationModeBonus(c, strategy)
                + (support >= 2 ? 90000 * Math.min(3, support) : 0)
                + (heightClose ? 70000 : -(gapH * 120))
                + (tail <= MAX_TAIL_WASTE ? 120000 : -(tail * 180));
              const prevBest = next[nw];
              if(!prevBest || localScore > prevBest.score){
                next[nw] = {
                  score: localScore,
                  area: st.area + c.w * c.h,
                  count: st.count + 1,
                  gapArea: st.gapArea + (gapH * c.w),
                  prev: used,
                  item: i,
                  cand: c
                };
              }
            }
          }
          for(let x=0;x<=fr.w;x++) dp[x] = next[x];
        }

        let bestW = 0;
        let bestState = dp[0];
        for(let used=1; used<=fr.w; used++){
          const st = dp[used];
          if(!st || st.count < 2) continue;
          const tail = fr.w - used;
          const occ = st.area / Math.max(1, fr.w * rowH);
          const gapRatio = st.gapArea / Math.max(1, fr.w * rowH);
          const total = st.score + occ * 220000 - gapRatio * 180000 + (tail <= MAX_TAIL_WASTE ? 150000 : -tail * 250);
          const current = bestState && bestState.count >= 2
            ? bestState.score + (bestState.area / Math.max(1, fr.w * rowH)) * 220000 - (bestState.gapArea / Math.max(1, fr.w * rowH)) * 180000 + ((fr.w - bestW) <= MAX_TAIL_WASTE ? 150000 : -(fr.w - bestW) * 250)
            : -1e18;
          if(!bestState || total > current){
            bestState = st;
            bestW = used;
          }
        }
        if(!bestState || bestState.count < 2) continue;

        const chosen = [];
        const usedIdx = new Set();
        let cursor = bestW;
        while(cursor > 0){
          const st = dp[cursor];
          if(!st || st.item < 0 || !st.cand) break;
          if(!usedIdx.has(st.item)){
            chosen.push({ idx: st.item, it: remList[st.item], cand: st.cand });
            usedIdx.add(st.item);
          }
          cursor = st.prev;
        }
        if(chosen.length < 2) continue;
        chosen.reverse();
        let usedW = 0;
        let sameBucketPairs = 0;
        for(let i=0;i<chosen.length;i++){
          usedW += chosen[i].cand.w + (i > 0 ? K : 0);
          if(i > 0 && widthBucket(chosen[i - 1].cand.w) === widthBucket(chosen[i].cand.w)) sameBucketPairs += 1;
        }
        const tail = fr.w - usedW;
        const score = bestState.score + sameBucketPairs * 90000 + (tail <= MAX_TAIL_WASTE ? 120000 : -tail * 250);
        const plan = { fr, rowH, items: chosen, usedW, tail, score, sameBucketPairs };
        if(!bestPlan || plan.score > bestPlan.score) bestPlan = plan;
      }
      return bestPlan;
    }

    function fillResidualRects(sheet, freeRects, remList, strategy){
      let free = pruneFreeRects((freeRects||[]).filter(r=>r && r.w > 0 && r.h > 0));
      while(remList.length && free.length){
        let bestRow = null;
        for(let fi=0; fi<free.length; fi++){
          const fr = free[fi];
          if(fr.w < 180 || fr.h < 80) continue;
          const rowPlan = buildResidualSharedRowPlan(remList, fr, strategy);
          if(rowPlan && (!bestRow || rowPlan.score > bestRow.plan.score)) bestRow = { fi, plan: rowPlan };
        }
        if(bestRow && bestRow.plan && bestRow.plan.items && bestRow.plan.items.length >= 2){
          finalizeAcceptedPlan(bestRow.plan);
          let cursorX = bestRow.plan.fr.x;
          const usedIds = [];
          for(const picked of bestRow.plan.items){
            placeFromCandidate(sheet, picked.it, picked.cand, cursorX, bestRow.plan.fr.y);
            cursorX += picked.cand.w + K;
            usedIds.push(picked.it.id);
          }
          // recompute by splitting against newly inserted placements only
          const inserted = sheet.placements.slice(-bestRow.plan.items.length).map(p => ({ x:p.x, y:p.y, w:p.w + K, h:p.h + K }));
          let splitFree = free.slice();
          for(const placedK of inserted){
            const tmp = [];
            for(const fr of splitFree){
              if(rectIntersects(fr, placedK)) tmp.push(...splitFreeRectByIntersection(fr, placedK));
              else tmp.push(fr);
            }
            splitFree = pruneFreeRects(tmp.filter(r=>r.w >= 40 && r.h >= 40));
          }
          free = splitFree;
          for(let r=remList.length-1; r>=0; r--){
            if(usedIds.includes(remList[r].id)) remList.splice(r, 1);
          }
          continue;
        }

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

    function collectStripWidthBuckets(remList, rowH){
      const byBucket = new Map();
      for(const it of remList){
        let opts = getCandidates(it, c => c.w <= BW && c.h <= rowH, false);
        if(!opts.length) opts = getCandidates(it, c => c.w <= BW && c.h <= rowH, true);
        if(!opts.length) continue;
        for(const c of opts){
          const bucket = widthBucket(c.w);
          const e = byBucket.get(bucket) || { bucket, count:0, area:0 };
          e.count += 1;
          e.area += c.w * c.h;
          byBucket.set(bucket, e);
        }
      }
      return Array.from(byBucket.values())
        .sort((a,b)=> (b.count - a.count) || (b.area - a.area) || (b.bucket - a.bucket))
        .slice(0, 4)
        .map(v => v.bucket);
    }

    function calcRowGroupingMetrics(chosen){
      const items = Array.isArray(chosen) ? chosen : [];
      const buckets = items.map(v => widthBucket(v && v.cand ? v.cand.w : 0));
      const counts = new Map();
      let sameBucketPairs = 0;
      let singletonBuckets = 0;
      let smallSingletons = 0;
      let widthSpreadPenalty = 0;
      let tinyTailPenalty = 0;
      for(let i=0;i<buckets.length;i++){
        const b = buckets[i];
        counts.set(b, (counts.get(b) || 0) + 1);
        if(i > 0){
          if(buckets[i-1] === b) sameBucketPairs += 1;
          if(Math.abs(buckets[i-1] - b) >= 70) widthSpreadPenalty += 1;
        }
      }
      for(const [bucket, count] of counts.entries()){
        if(count === 1){
          singletonBuckets += 1;
          if(bucket <= 380) smallSingletons += 1;
        }
      }
      const tail = items.slice(-4);
      for(const it of tail){
        const w = Number(it && it.cand ? it.cand.w : 0) || 0;
        if(w > 0 && w <= 140) tinyTailPenalty += 1;
      }
      return { sameBucketPairs, singletonBuckets, smallSingletons, widthSpreadPenalty, tinyTailPenalty };
    }

    function buildStripPlan(remList, rowH, strategy, preferredBucket){
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
            const bucket = widthBucket(c.w);
            const bucketBias = preferredBucket
              ? (bucket === preferredBucket
                  ? (strategy.bucketMatchBonus || 150000)
                  : (Math.abs(bucket - preferredBucket) <= 20
                      ? (strategy.bucketNearBonus || 60000)
                      : ((Math.min(c.w, c.h) <= 220 || c.w <= 380) ? -(strategy.bucketMissPenalty || 70000) : 0)))
              : 0;
            const localScore = state.score
              + (c.w * c.h * (strategy.areaWeight || 1000))
              + (exactHeight * (strategy.exactHBonus || 80000))
              + orientationBonus(c, strategy.orientationWeight || 240000)
              + rotationModeBonus(c, strategy)
              + bucketBias
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
      const grouping = calcRowGroupingMetrics(chosen);
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
        grouping,
        score: usedArea
          + occupancy * (strategy.occWeight || 100000)
          + (tail <= MAX_TAIL_WASTE ? (strategy.tailBonus || 200000) : -tail * (strategy.tailPenalty || 200))
          + exactRatio * (strategy.uniformBonus || 180000)
          + grouping.sameBucketPairs * (strategy.groupPairBonus || 90000)
          - grouping.singletonBuckets * (strategy.singletonPenalty || 45000)
          - grouping.smallSingletons * (strategy.smallSingletonPenalty || 70000)
          - grouping.widthSpreadPenalty * (strategy.widthSpreadPenalty || 40000)
          - grouping.tinyTailPenalty * (strategy.tinyTailPenalty || 85000)
          - gapRatio * (strategy.gapAreaPenalty || 220000)
          + ((strategy.exactOnly && exactRatio >= 0.999) ? (strategy.exactOnlyBonus || 260000) : 0)
      };
    }

    function chooseBestStrip(remList, availableH, strategy){
      const heights = collectStripHeights(remList, availableH);
      let best = null;
      for(const h of heights){
        const preferredBuckets = [null].concat(collectStripWidthBuckets(remList, h));
        for(const preferredBucket of preferredBuckets){
          const plan = buildStripPlan(remList, h, strategy, preferredBucket);
          if(!plan) continue;
          const sc =
            plan.score
            + (plan.occupancy >= 0.85 ? 250000 : 0)
            + (plan.tail <= MAX_TAIL_WASTE ? 220000 : 0)
            + (plan.exactRatio >= 0.999 ? 220000 : 0)
            + (plan.exactRatio * (strategy.uniformBonus || 180000))
            + ((plan.grouping && plan.grouping.sameBucketPairs) ? plan.grouping.sameBucketPairs * 60000 : 0)
            - ((plan.grouping && plan.grouping.smallSingletons) ? plan.grouping.smallSingletons * 80000 : 0)
            - ((plan.grouping && plan.grouping.tinyTailPenalty) ? plan.grouping.tinyTailPenalty * 90000 : 0)
            - (plan.gapRatio * (strategy.gapAreaPenalty || 220000))
            + (h * (strategy.heightBias || 500));
          if(!best || sc > best.sc) best = { plan, sc };
        }
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
      const waste = res.waste || calcResidualWasteMetrics([]);
      const rowBonus = Number(res.rowBonus) || 0;
      return res.score * (firstWeight || 1)
        + occ * (secondWeight || 1)
        + compactBonus
        + rowBonus * 45000
        - waste.disposalCount * 35000
        - waste.longThinCount * 28000;
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
          const firstRows = Number(first.rowBonus) || estimateUniformRowBonus(first.sheet);
          const secondRows = Number(second.rowBonus) || estimateUniformRowBonus(second.sheet);
          const pairWaste = (first.waste ? first.waste.disposalArea : 0) + (second.waste ? second.waste.disposalArea : 0);
          const pairThin = (first.waste ? first.waste.longThinCount : 0) + (second.waste ? second.waste.longThinCount : 0);
          const pairScore =
            scoreSheetResult(first, 1.45, 1200000)
            + scoreSheetResult(second, 0.95, 500000)
            + firstOcc * 700000
            - secondBBox * 260000
            + firstRows * 180000
            + secondRows * 120000
            + (firstOcc >= 0.88 ? 220000 : 0)
            + (secondOcc >= 0.78 ? 80000 : 0)
            - ((second.sheet.placements||[]).length * 1500)
            - pairWaste * 0.04
            - pairThin * 30000;
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

        finalizeAcceptedPlan(plan);
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
      const waste = calcResidualWasteMetrics(freeLeft);
      const rowBonus = estimateUniformRowBonus(sheet);
      const score = usedArea * 50
        + occupancy * 1000000
        + (occupancy >= 0.85 ? 400000 : 0)
        - bigWaste * 0.08
        - bboxArea * 0.01
        + sheet.placements.length * 500
        + rowBonus * 85000
        - waste.disposalArea * 0.12
        - waste.disposalCount * 60000
        - waste.longThinCount * 45000
        + waste.reusableArea * 0.01;
      return { sheet, rem, score, usedArea, occupancy, bboxArea, waste, rowBonus };
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

  root.FC.stripSolver = Object.assign({}, root.FC.stripSolver || {}, {
    packStripBands,
  });
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));

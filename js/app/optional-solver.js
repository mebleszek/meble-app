/* optional-solver.js — solver trybu „Opcjonalnie kierunek cięcia”
   Założenia:
   - liczy płyta po płycie,
   - dla każdej płyty porównuje kilka rodzin wariantów,
   - może zrobić jeden główny split i zmienić kierunek w drugiej części płyty,
   - na końcówce dopieszcza ostatnie 2 płyty, a na sam koniec jeszcze raz ostatnią.
*/
(function(root){
  'use strict';

  root.FC = root.FC || {};
  const strip = root.FC.stripSolver;

  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function clampInt(v, fallback){
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }
  function sumArea(items){
    let s = 0;
    for(const it of (items||[])) s += (Number(it.w)||0) * (Number(it.h)||0);
    return s;
  }
  function placementArea(sheet){
    let s = 0;
    for(const p of ((sheet && sheet.placements) || [])){
      if(p && !p.unplaced) s += (Number(p.w)||0) * (Number(p.h)||0);
    }
    return s;
  }
  function usedIds(sheet){
    return new Set((((sheet && sheet.placements) || []).filter(p=>p && !p.unplaced).map(p=>p.id)));
  }
  function removeByIds(items, ids){
    return (items||[]).filter(it => !ids.has(it.id));
  }
  function offsetSheet(sheet, dx, dy){
    const s = clone(sheet);
    s.placements = (s.placements || []).map(p=>Object.assign({}, p, { x:(p.x||0)+dx, y:(p.y||0)+dy }));
    return s;
  }
  function mergeSheets(boardW, boardH, parts){
    const placements = [];
    for(const s of (parts||[])){
      for(const p of ((s && s.placements) || [])) placements.push(p);
    }
    return { boardW, boardH, placements };
  }
  function groupDimSupport(items, dimKey, maxDim){
    const map = new Map();
    for(const it of (items||[])){
      const opts = [{ w:it.w, h:it.h }];
      if(it.rotationAllowed && it.w !== it.h) opts.push({ w:it.h, h:it.w });
      for(const o of opts){
        const d = (dimKey === 'h') ? o.h : o.w;
        if(!(d > 0 && d <= maxDim)) continue;
        const prev = map.get(d) || { dim:d, area:0, count:0 };
        prev.area += o.w * o.h;
        prev.count += 1;
        map.set(d, prev);
      }
    }
    return Array.from(map.values()).sort((a,b)=>{
      if(b.count !== a.count) return b.count - a.count;
      if(b.area !== a.area) return b.area - a.area;
      return b.dim - a.dim;
    });
  }

  function rectIntersects(a, b){
    return !(b.x >= a.x + a.w || b.x + b.w <= a.x || b.y >= a.y + a.h || b.y + b.h <= a.y);
  }
  function splitFreeRectByIntersection(free, placed){
    const out = [];
    if(!rectIntersects(free, placed)) return [free];
    const fx = free.x, fy = free.y, fw = free.w, fh = free.h;
    const px = placed.x, py = placed.y, pw = placed.w, ph = placed.h;
    const fr = fx + fw, fb = fy + fh, pr = px + pw, pb = py + ph;
    if(px > fx) out.push({ x:fx, y:fy, w:px-fx, h:fh });
    if(pr < fr) out.push({ x:pr, y:fy, w:fr-pr, h:fh });
    if(py > fy){
      const x = Math.max(fx, px), r = Math.min(fr, pr), w = r - x;
      if(w > 0) out.push({ x, y:fy, w, h:py-fy });
    }
    if(pb < fb){
      const x = Math.max(fx, px), r = Math.min(fr, pr), w = r - x;
      if(w > 0) out.push({ x, y:pb, w, h:fb-pb });
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
        if(a.x>=b.x && a.y>=b.y && (a.x+a.w)<= (b.x+b.w) && (a.y+a.h)<= (b.y+b.h)){ contained = true; break; }
      }
      if(!contained) out.push(a);
    }
    return out;
  }
  function calcFreeRects(sheet, kerf){
    const K = Math.max(0, Math.round(Number(kerf)||0));
    let free = [{ x:0, y:0, w:Number(sheet.boardW)||0, h:Number(sheet.boardH)||0 }];
    const pls = ((sheet && sheet.placements) || []).filter(p=>p && !p.unplaced);
    for(const p of pls){
      const placed = { x:p.x, y:p.y, w:p.w + K, h:p.h + K };
      const next = [];
      for(const fr of free){
        if(rectIntersects(fr, placed)) next.push(...splitFreeRectByIntersection(fr, placed));
        else next.push(fr);
      }
      free = pruneFreeRects(next.filter(r=>r.w > 0 && r.h > 0));
    }
    return free;
  }
  function bandMetrics(sheet, axis){
    const pls = ((sheet && sheet.placements) || []).filter(p=>p && !p.unplaced);
    const W = Number(sheet && sheet.boardW) || 1;
    const H = Number(sheet && sheet.boardH) || 1;
    const rows = new Map();
    const cols = new Map();
    for(const p of pls){
      const rk = `${p.y||0}:${p.h||0}`;
      const ck = `${p.x||0}:${p.w||0}`;
      const r = rows.get(rk) || { minX:1e9, maxX:0, count:0, area:0 };
      r.minX = Math.min(r.minX, p.x||0); r.maxX = Math.max(r.maxX, (p.x||0)+(p.w||0)); r.count += 1; r.area += (p.w||0)*(p.h||0); rows.set(rk, r);
      const c = cols.get(ck) || { minY:1e9, maxY:0, count:0, area:0 };
      c.minY = Math.min(c.minY, p.y||0); c.maxY = Math.max(c.maxY, (p.y||0)+(p.h||0)); c.count += 1; c.area += (p.w||0)*(p.h||0); cols.set(ck, c);
    }
    let closeRows = 0, closeCols = 0, singletonRows = 0, singletonCols = 0;
    for(const r of rows.values()){
      const tail = W - r.maxX;
      if(r.minX <= 6 && tail <= 100) closeRows += 1;
      if(r.count === 1 && tail > 100) singletonRows += 1;
    }
    for(const c of cols.values()){
      const tail = H - c.maxY;
      if(c.minY <= 6 && tail <= 100) closeCols += 1;
      if(c.count === 1 && tail > 100) singletonCols += 1;
    }
    if(axis === 'along') return { close: closeRows, singleton: singletonRows, otherClose: closeCols, otherSingleton: singletonCols };
    if(axis === 'across') return { close: closeCols, singleton: singletonCols, otherClose: closeRows, otherSingleton: singletonRows };
    return { close: Math.max(closeRows, closeCols), singleton: Math.min(singletonRows, singletonCols), otherClose: Math.min(closeRows, closeCols), otherSingleton: Math.max(singletonRows, singletonCols) };
  }

  function isSmallPlacement(p){
    const area = (Number(p && p.w) || 0) * (Number(p && p.h) || 0);
    return Math.min(Number(p && p.w) || 0, Number(p && p.h) || 0) <= 180 || area <= 85000;
  }
  function smallGroupMetrics(sheet){
    const pls = ((sheet && sheet.placements) || []).filter(p=>p && !p.unplaced && isSmallPlacement(p));
    const rows = new Map();
    const cols = new Map();
    for(const p of pls){
      const rk = `${p.y||0}:${p.h||0}`;
      const ck = `${p.x||0}:${p.w||0}`;
      const r = rows.get(rk) || { count:0, span:0, min:1e9, max:0 };
      r.count += 1; r.min = Math.min(r.min, p.x||0); r.max = Math.max(r.max, (p.x||0)+(p.w||0)); r.span = r.max - r.min; rows.set(rk, r);
      const c = cols.get(ck) || { count:0, span:0, min:1e9, max:0 };
      c.count += 1; c.min = Math.min(c.min, p.y||0); c.max = Math.max(c.max, (p.y||0)+(p.h||0)); c.span = c.max - c.min; cols.set(ck, c);
    }
    let sharedRows = 0, isolatedRows = 0, sharedCols = 0, isolatedCols = 0;
    for(const r of rows.values()){
      if(r.count >= 2) sharedRows += 1;
      else isolatedRows += 1;
    }
    for(const c of cols.values()){
      if(c.count >= 2) sharedCols += 1;
      else isolatedCols += 1;
    }
    return { sharedRows, isolatedRows, sharedCols, isolatedCols, smallCount: pls.length };
  }
  function scrapMetrics(freeRects){
    const free = Array.isArray(freeRects) ? freeRects : [];
    let disposalArea = 0, disposalCount = 0, reusableArea = 0, reusableCount = 0, longStrips = 0;
    for(const r of free){
      const area = (Number(r && r.w) || 0) * (Number(r && r.h) || 0);
      const minSide = Math.min(Number(r && r.w) || 0, Number(r && r.h) || 0);
      const maxSide = Math.max(Number(r && r.w) || 0, Number(r && r.h) || 0);
      const reusable = minSide >= 100 && area >= 30000;
      if(reusable){
        reusableArea += area;
        reusableCount += 1;
        if(minSide < 140 && maxSide >= 600) longStrips += 1;
      } else {
        disposalArea += area;
        disposalCount += 1;
      }
    }
    return { disposalArea, disposalCount, reusableArea, reusableCount, longStrips };
  }
  function scoreSheet(sheet, kerf, axis, lookaheadOcc){
    const W = Number(sheet && sheet.boardW) || 0;
    const H = Number(sheet && sheet.boardH) || 0;
    const area = Math.max(1, W * H);
    const used = placementArea(sheet);
    const occ = used / area;
    const free = calcFreeRects(sheet, kerf).filter(r=>r.w >= 25 && r.h >= 25);
    const largestFree = free.reduce((m,r)=>Math.max(m, r.w*r.h), 0);
    const bm = bandMetrics(sheet, axis);
    const sm = scrapMetrics(free);
    const gm = smallGroupMetrics(sheet);
    const placements = ((sheet && sheet.placements) || []).filter(p=>p && !p.unplaced);
    let score = 0;
    score += occ * 1000000;
    score += bm.close * 130000;
    score += bm.otherClose * 50000;
    score -= bm.singleton * 175000;
    score -= bm.otherSingleton * 90000;
    score += gm.sharedRows * 85000;
    score += gm.sharedCols * 50000;
    score -= gm.isolatedRows * 65000;
    score -= gm.isolatedCols * 45000;
    score -= (largestFree / area) * 140000;
    score -= (sm.disposalArea / area) * 260000;
    score -= sm.disposalCount * 42000;
    score -= sm.longStrips * 28000;
    score -= Math.max(0, free.length - 4) * 15000;
    score += (sm.reusableArea / area) * 35000;
    score += (Number(lookaheadOcc)||0) * 260000;
    if(occ >= 0.90) score += 120000;
    else if(occ >= 0.85) score += 65000;
    if(gm.smallCount >= 3 && (gm.sharedRows + gm.sharedCols) === 0) score -= 90000;
    if(placements.length <= 1) score -= 120000;
    return { score, occ, used, freeRects: free.length, largestFree, disposalArea: sm.disposalArea, disposalCount: sm.disposalCount, reusableArea: sm.reusableArea, sharedRows: gm.sharedRows, sharedCols: gm.sharedCols };
  }

  function scoreSheetPair(s1, s2, kerf){
    const a = scoreSheet(s1, kerf, 'auto', 0);
    const b = scoreSheet(s2, kerf, 'auto', 0);
    const pairOcc = ((Number(a.used)||0) + (Number(b.used)||0)) / Math.max(1, ((Number(s1 && s1.boardW)||0)*(Number(s1 && s1.boardH)||0)) + ((Number(s2 && s2.boardW)||0)*(Number(s2 && s2.boardH)||0)));
    const pairScore = a.score + b.score + pairOcc * 180000 - (a.disposalArea + b.disposalArea) / Math.max(1, (Number(s1 && s1.boardW)||0)*(Number(s1 && s1.boardH)||0)) * 100000;
    return { score: pairScore, occ: pairOcc, disposalArea: (a.disposalArea||0) + (b.disposalArea||0) };
  }

  function orientForFixedDim(it, fixedDim, mode){
    const out = [];
    if(mode === 'hband'){
      if((Number(it.h)||0) === fixedDim) out.push({ w:Number(it.w)||0, h:fixedDim, rotated:false });
      if(it.rotationAllowed && (Number(it.w)||0) === fixedDim && (Number(it.h)||0) !== fixedDim) out.push({ w:Number(it.h)||0, h:fixedDim, rotated:true });
    } else if(mode === 'vband'){
      if((Number(it.w)||0) === fixedDim) out.push({ w:fixedDim, h:Number(it.h)||0, rotated:false });
      if(it.rotationAllowed && (Number(it.h)||0) === fixedDim && (Number(it.w)||0) !== fixedDim) out.push({ w:fixedDim, h:Number(it.w)||0, rotated:true });
    }
    return out.filter(o=>o.w>0 && o.h>0);
  }

  function chooseBestBandSubset(items, fixedDim, mode, limitLen, kerf){
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const options = [];
    for(const it of (items||[])){
      const oriented = orientForFixedDim(it, fixedDim, mode);
      if(!oriented.length) continue;
      oriented.sort((a,b)=>{
        const al = mode === 'hband' ? a.w : a.h;
        const bl = mode === 'hband' ? b.w : b.h;
        if(bl !== al) return bl - al;
        return (a.rotated?1:0) - (b.rotated?1:0);
      });
      const best = oriented[0];
      const len = mode === 'hband' ? best.w : best.h;
      if(!(len > 0 && len <= limitLen)) continue;
      options.push({ id: it.id, len, w: best.w, h: best.h, rotated: !!best.rotated });
    }
    if(options.length < 2) return null;

    const freq = new Map();
    for(const o of options) freq.set(o.len, (freq.get(o.len) || 0) + 1);
    options.sort((a,b)=>{
      const fa = freq.get(a.len) || 0;
      const fb = freq.get(b.len) || 0;
      if(fb !== fa) return fb - fa;
      if(b.len !== a.len) return b.len - a.len;
      return String(a.id).localeCompare(String(b.id));
    });

    const trimmed = options.slice(0, Math.min(options.length, 28));
    const dp = Array(limitLen + 1).fill(null);
    dp[0] = { score:0, count:0, prev:-1, itemIndex:-1 };
    for(let i=0;i<trimmed.length;i++){
      const opt = trimmed[i];
      for(let s=limitLen;s>=opt.len;s--){
        const prev = dp[s - opt.len];
        if(prev === null) continue;
        const candScore = prev.score + (opt.len * 100) + ((freq.get(opt.len) || 0) * 1800) + (prev.count * 250);
        const cur = dp[s];
        if(cur === null || candScore > cur.score || (candScore === cur.score && (prev.count + 1) > cur.count)){
          dp[s] = { score: candScore, count: prev.count + 1, prev: s - opt.len, itemIndex: i };
        }
      }
    }

    let bestS = -1, bestScore = -1e18;
    for(let s=1;s<=limitLen;s++){
      const state = dp[s];
      if(state === null || state.count < 2) continue;
      const consumed = s + Math.max(0, state.count - 1) * K;
      if(consumed > limitLen) continue;
      const leftover = limitLen - consumed;
      let score = state.score;
      score -= leftover * 20;
      score += state.count * 5000;
      if(leftover <= 80) score += 140000;
      else if(leftover <= 120) score += 80000;
      else if(leftover <= 180) score += 30000;
      if(score > bestScore){ bestScore = score; bestS = s; }
    }
    if(bestS < 0) return null;

    const usedIdx = [];
    let cur = bestS;
    while(cur > 0 && dp[cur] && dp[cur].itemIndex >= 0){
      const st = dp[cur];
      usedIdx.push(st.itemIndex);
      cur = st.prev;
    }
    usedIdx.reverse();
    const selected = usedIdx.map(i => trimmed[i]);
    if(selected.length < 2) return null;
    let span = 0;
    for(let i=0;i<selected.length;i++) span += selected[i].len + (i > 0 ? K : 0);
    return { selected, span };
  }


  function subsetIds(subset){
    return new Set((((subset && subset.selected) || []).map(s => s.id)));
  }

  function subsetArea(subset){
    let a = 0;
    for(const s of (((subset && subset.selected) || []))) a += (Number(s.w)||0) * (Number(s.h)||0);
    return a;
  }

  function bandOccupancy(subset, fixedDim, mode, limitLen){
    const area = subsetArea(subset);
    const bandArea = Math.max(1, (mode === 'hband' ? fixedDim * limitLen : fixedDim * limitLen));
    return area / bandArea;
  }

  function buildSeededBandCandidate(items, W, H, K, startAxis){
    const mode = startAxis === 'along' ? 'hband' : 'vband';
    const limitLen = startAxis === 'along' ? W : H;
    const maxDim = startAxis === 'along' ? H : W;
    const dimKey = startAxis === 'along' ? 'h' : 'w';
    const dims = groupDimSupport(items, dimKey, maxDim).slice(0, 10).map(v => v.dim);
    if(!dims.length) return null;

    let best = null;
    for(const dim1 of dims){
      const sub1 = chooseBestBandSubset(items, dim1, mode, limitLen, K);
      if(!sub1 || !sub1.selected || !sub1.selected.length) continue;
      const occ1 = bandOccupancy(sub1, dim1, mode, limitLen);
      let bands = [{ subset: sub1, fixedDim: dim1, occ: occ1 }];
      let rem = removeByIds(items, subsetIds(sub1));
      let usedDim = dim1;
      if(occ1 >= 0.90 && rem.length){
        let bestSecond = null;
        for(const dim2 of dims){
          const second = chooseBestBandSubset(rem, dim2, mode, limitLen, K);
          if(!second || !second.selected || !second.selected.length) continue;
          const occ2 = bandOccupancy(second, dim2, mode, limitLen);
          const totalNeed = usedDim + K + dim2;
          const totalLimit = startAxis === 'along' ? H : W;
          if(totalNeed > totalLimit) continue;
          if(occ2 < 0.90) continue;
          const score = occ2 * 100000 + subsetArea(second);
          if(!bestSecond || score > bestSecond.score) bestSecond = { subset: second, fixedDim: dim2, occ: occ2, score };
        }
        if(bestSecond){
          bands.push(bestSecond);
          rem = removeByIds(rem, subsetIds(bestSecond.subset));
          usedDim += K + bestSecond.fixedDim;
        }
      }

      const totalLeadDim = bands.reduce((s,b)=> s + b.fixedDim, 0) + Math.max(0, bands.length - 1) * K;
      const parts = [];
      if(mode === 'hband'){
        let y = 0;
        for(const band of bands){
          let x = 0;
          const placements = [];
          for(const s of band.subset.selected){
            placements.push({ id:s.id, x, y, w:s.w, h:s.h, rotated:s.rotated });
            x += s.w + K;
          }
          parts.push({ boardW:W, boardH:H, placements });
          y += band.fixedDim + K;
        }
        const remH = H - totalLeadDim - K;
        if(remH > 120 && rem.length){
          const same = packFirstSheet(rem, W, remH, K, 'along');
          const other = packFirstSheet(rem, W, remH, K, 'across');
          let chosen = null;
          for(const candidate of [same, other]){
            if(!candidate || !candidate.placements || !candidate.placements.length) continue;
            const sc = scoreSheet(candidate, K, 'auto', 0).score;
            if(!chosen || sc > chosen.score) chosen = { sheet: candidate, score: sc };
          }
          if(chosen){
            parts.push(offsetSheet(chosen.sheet, 0, totalLeadDim + K));
          }
        }
      } else {
        let x = 0;
        for(const band of bands){
          let y = 0;
          const placements = [];
          for(const s of band.subset.selected){
            placements.push({ id:s.id, x, y, w:s.w, h:s.h, rotated:s.rotated });
            y += s.h + K;
          }
          parts.push({ boardW:W, boardH:H, placements });
          x += band.fixedDim + K;
        }
        const remW = W - totalLeadDim - K;
        if(remW > 120 && rem.length){
          const same = packFirstSheet(rem, remW, H, K, 'across');
          const other = packFirstSheet(rem, remW, H, K, 'along');
          let chosen = null;
          for(const candidate of [same, other]){
            if(!candidate || !candidate.placements || !candidate.placements.length) continue;
            const sc = scoreSheet(candidate, K, 'auto', 0).score;
            if(!chosen || sc > chosen.score) chosen = { sheet: candidate, score: sc };
          }
          if(chosen){
            parts.push(offsetSheet(chosen.sheet, totalLeadDim + K, 0));
          }
        }
      }
      const merged = mergeSheets(W, H, parts);
      const ids = usedIds(merged);
      if(!ids.size) continue;
      const remFinal = removeByIds(items, ids);
      const localScore = scoreSheet(merged, K, startAxis, 0).score + occ1 * 140000 + (bands.length === 2 ? 120000 : 0);
      if(!best || localScore > best.localScore){
        best = {
          kind:`seed-${startAxis}-${bands.map(b=>b.fixedDim).join('-')}`,
          axis:startAxis,
          sheet: merged,
          rem: remFinal,
          ids,
          localScore,
          leadBands: bands.length,
          leadOcc: occ1,
        };
      }
    }
    return best;
  }

  function buildGroupedBandCandidate(items, W, H, K, fixedDim, mode, restDir){
    const limitLen = mode === 'hband' ? W : H;
    const subset = chooseBestBandSubset(items, fixedDim, mode, limitLen, K);
    if(!subset || !subset.selected || subset.selected.length < 2) return null;

    const parts = [];
    let rem = (items || []).slice();
    const selIds = new Set(subset.selected.map(s => s.id));
    rem = removeByIds(rem, selIds);

    const leadPlacements = [];
    if(mode === 'hband'){
      let x = 0;
      for(const s of subset.selected){
        leadPlacements.push({ id:s.id, x, y:0, w:s.w, h:s.h, rotated:s.rotated });
        x += s.w + K;
      }
      parts.push({ boardW:W, boardH:H, placements: leadPlacements });
      const usedW = subset.span;
      const rightW = W - usedW - K;
      if(rightW > 120 && rem.length){
        const right = packFirstSheet(rem, rightW, fixedDim, K, restDir);
        if(right && right.placements && right.placements.length){
          const ids = usedIds(right);
          rem = removeByIds(rem, ids);
          parts.push(offsetSheet(right, usedW + K, 0));
        }
      }
      const bottomH = H - fixedDim - K;
      if(bottomH > 120 && rem.length){
        const bottom = packFirstSheet(rem, W, bottomH, K, restDir);
        if(bottom && bottom.placements && bottom.placements.length){
          const ids = usedIds(bottom);
          rem = removeByIds(rem, ids);
          parts.push(offsetSheet(bottom, 0, fixedDim + K));
        }
      }
    } else {
      let y = 0;
      for(const s of subset.selected){
        leadPlacements.push({ id:s.id, x:0, y, w:s.w, h:s.h, rotated:s.rotated });
        y += s.h + K;
      }
      parts.push({ boardW:W, boardH:H, placements: leadPlacements });
      const usedH = subset.span;
      const bottomH = H - usedH - K;
      if(bottomH > 120 && rem.length){
        const bottom = packFirstSheet(rem, fixedDim, bottomH, K, restDir);
        if(bottom && bottom.placements && bottom.placements.length){
          const ids = usedIds(bottom);
          rem = removeByIds(rem, ids);
          parts.push(offsetSheet(bottom, 0, usedH + K));
        }
      }
      const rightW = W - fixedDim - K;
      if(rightW > 120 && rem.length){
        const right = packFirstSheet(rem, rightW, H, K, restDir);
        if(right && right.placements && right.placements.length){
          const ids = usedIds(right);
          rem = removeByIds(rem, ids);
          parts.push(offsetSheet(right, fixedDim + K, 0));
        }
      }
    }

    const merged = mergeSheets(W, H, parts);
    const ids = usedIds(merged);
    return { kind:`group-${mode}-${fixedDim}-${restDir}`, axis:'auto', sheet:merged, rem: removeByIds(items, ids), ids };
  }

  function packFirstSheet(items, W, H, K, dir){
    if(!strip || typeof strip.packStripBands !== 'function') return null;
    const sheets = strip.packStripBands(items, W, H, K, dir) || [];
    if(!sheets.length) return null;
    return clone(sheets[0]);
  }

  function buildFullCandidate(items, W, H, K, dir){
    const sheet = packFirstSheet(items, W, H, K, dir);
    if(!sheet) return null;
    const ids = usedIds(sheet);
    return { kind:`full-${dir}`, axis:dir, sheet, rem: removeByIds(items, ids), ids };
  }

  function scoreRectForTeacherFill(fr){
    const area = (Number(fr && fr.w) || 0) * (Number(fr && fr.h) || 0);
    const minSide = Math.min(Number(fr && fr.w) || 0, Number(fr && fr.h) || 0);
    const maxSide = Math.max(Number(fr && fr.w) || 0, Number(fr && fr.h) || 0);
    return area + (minSide >= 220 ? 60000 : 0) + (maxSide >= 600 ? 40000 : 0) - Math.max(0, 180 - minSide) * 600;
  }

  function mergePlacementSheets(baseSheet, extraParts, boardW, boardH){
    const placements = [];
    for(const p of (((baseSheet && baseSheet.placements) || []))) placements.push(Object.assign({}, p));
    for(const part of (extraParts || [])){
      for(const p of (((part && part.placements) || []))) placements.push(Object.assign({}, p));
    }
    return { boardW, boardH, placements };
  }

  function buildTeacherRefinedCandidate(items, W, H, K, baseDir, fillDir, maxRectsToFill){
    const base = buildFullCandidate(items, W, H, K, baseDir);
    if(!base || !base.sheet || !base.sheet.placements || !base.sheet.placements.length) return null;
    const freeRects = calcFreeRects(base.sheet, K)
      .filter(r => (Number(r && r.w) || 0) >= 140 && (Number(r && r.h) || 0) >= 140)
      .sort((a,b)=> scoreRectForTeacherFill(b) - scoreRectForTeacherFill(a));
    if(!freeRects.length) return base;

    let rem = base.rem.slice();
    const extraSheets = [];
    let usedAny = false;
    const limit = Math.max(1, Math.round(Number(maxRectsToFill) || 1));
    for(const fr of freeRects.slice(0, limit)){
      if(!rem.length) break;
      const packed = packFirstSheet(rem, fr.w, fr.h, K, fillDir);
      if(!packed || !packed.placements || !packed.placements.length) continue;
      const ids = usedIds(packed);
      if(!ids.size) continue;
      usedAny = true;
      rem = removeByIds(rem, ids);
      extraSheets.push(offsetSheet(packed, fr.x, fr.y));
    }
    if(!usedAny) return base;
    const merged = mergePlacementSheets(base.sheet, extraSheets, W, H);
    const ids = usedIds(merged);
    return {
      kind:`teach-${baseDir}-${fillDir}-${limit}`,
      axis:fillDir === baseDir ? baseDir : 'auto',
      sheet: merged,
      rem: removeByIds(items, ids),
      ids,
      teacherBaseDir: baseDir,
      teacherFillDir: fillDir,
      teacherRects: limit,
    };
  }

  function buildHybridHorizontal(items, W, H, K, splitH, topDir, bottomDir){
    if(!(splitH > 0 && splitH < H - 40)) return null;
    const top = packFirstSheet(items, W, splitH, K, topDir);
    if(!top || !top.placements || !top.placements.length) return null;
    const topIds = usedIds(top);
    const rem1 = removeByIds(items, topIds);
    const restH = H - splitH - K;
    if(restH <= 40){
      const mergedOnly = mergeSheets(W, H, [top]);
      const ids = usedIds(mergedOnly);
      return { kind:`hy-h-${topDir}-${bottomDir}-${splitH}`, axis:topDir, sheet:mergedOnly, rem: removeByIds(items, ids), ids };
    }
    const bottom = packFirstSheet(rem1, W, restH, K, bottomDir);
    const bottomPart = bottom ? offsetSheet(bottom, 0, splitH + K) : null;
    const merged = mergeSheets(W, H, [top, bottomPart].filter(Boolean));
    const ids = usedIds(merged);
    return { kind:`hy-h-${topDir}-${bottomDir}-${splitH}`, axis:topDir, sheet:merged, rem: removeByIds(items, ids), ids };
  }

  function buildHybridVertical(items, W, H, K, splitW, leftDir, rightDir){
    if(!(splitW > 0 && splitW < W - 40)) return null;
    const left = packFirstSheet(items, splitW, H, K, leftDir);
    if(!left || !left.placements || !left.placements.length) return null;
    const leftIds = usedIds(left);
    const rem1 = removeByIds(items, leftIds);
    const restW = W - splitW - K;
    if(restW <= 40){
      const mergedOnly = mergeSheets(W, H, [left]);
      const ids = usedIds(mergedOnly);
      return { kind:`hy-v-${leftDir}-${rightDir}-${splitW}`, axis:leftDir, sheet:mergedOnly, rem: removeByIds(items, ids), ids };
    }
    const right = packFirstSheet(rem1, restW, H, K, rightDir);
    const rightPart = right ? offsetSheet(right, splitW + K, 0) : null;
    const merged = mergeSheets(W, H, [left, rightPart].filter(Boolean));
    const ids = usedIds(merged);
    return { kind:`hy-v-${leftDir}-${rightDir}-${splitW}`, axis:leftDir, sheet:merged, rem: removeByIds(items, ids), ids };
  }

  function estimateNextOcc(items, W, H, K){
    if(!items || !items.length) return 1;
    const a = buildFullCandidate(items, W, H, K, 'along');
    const b = buildFullCandidate(items, W, H, K, 'across');
    let best = 0;
    for(const c of [a,b]){
      if(!c) continue;
      const sc = scoreSheet(c.sheet, K, c.axis, 0);
      if(sc.occ > best) best = sc.occ;
    }
    return best;
  }

  function candidateDimensions(items, W, H, attempts, endgame){
    const take = endgame ? 12 : Math.max(4, Math.min(8, Math.floor(attempts / 6) || 4));
    const hBase = groupDimSupport(items, 'h', H).slice(0, take);
    const wBase = groupDimSupport(items, 'w', W).slice(0, take);
    const smallHs = Array.from(new Set((items||[])
      .filter(it => Math.min(it.w||0, it.h||0) <= 180)
      .flatMap(it => [it.h, (it.rotationAllowed && it.w !== it.h) ? it.w : null])
      .filter(v => v > 0 && v <= H))).slice(0, endgame ? 8 : 4);
    const smallWs = Array.from(new Set((items||[])
      .filter(it => Math.min(it.w||0, it.h||0) <= 180)
      .flatMap(it => [it.w, (it.rotationAllowed && it.w !== it.h) ? it.h : null])
      .filter(v => v > 0 && v <= W))).slice(0, endgame ? 8 : 4);
    return {
      hs: Array.from(new Set(hBase.map(v=>v.dim).concat(smallHs))),
      ws: Array.from(new Set(wBase.map(v=>v.dim).concat(smallWs))),
    };
  }

  function buildCandidateList(items, W, H, K, attempts, endgame){
    const { hs, ws } = candidateDimensions(items, W, H, attempts, endgame);
    const builders = [];
    builders.push(()=>buildSeededBandCandidate(items, W, H, K, 'along'));
    builders.push(()=>buildSeededBandCandidate(items, W, H, K, 'across'));
    // Baselines taught by the stable strip solvers.
    builders.push(()=>buildFullCandidate(items, W, H, K, 'along'));
    builders.push(()=>buildFullCandidate(items, W, H, K, 'across'));
    builders.push(()=>buildTeacherRefinedCandidate(items, W, H, K, 'along', 'across', 1));
    builders.push(()=>buildTeacherRefinedCandidate(items, W, H, K, 'across', 'along', 1));
    if(endgame || attempts >= 24){
      builders.push(()=>buildTeacherRefinedCandidate(items, W, H, K, 'along', 'across', 2));
      builders.push(()=>buildTeacherRefinedCandidate(items, W, H, K, 'across', 'along', 2));
      builders.push(()=>buildTeacherRefinedCandidate(items, W, H, K, 'along', 'along', 2));
      builders.push(()=>buildTeacherRefinedCandidate(items, W, H, K, 'across', 'across', 2));
    }
    for(const h of hs.slice(0, Math.min(hs.length, endgame ? 10 : 6))){
      builders.push(()=>buildGroupedBandCandidate(items, W, H, K, h, 'hband', 'along'));
      builders.push(()=>buildGroupedBandCandidate(items, W, H, K, h, 'hband', 'across'));
    }
    for(const w of ws.slice(0, Math.min(ws.length, endgame ? 10 : 6))){
      builders.push(()=>buildGroupedBandCandidate(items, W, H, K, w, 'vband', 'along'));
      builders.push(()=>buildGroupedBandCandidate(items, W, H, K, w, 'vband', 'across'));
    }
    for(const h of hs){
      builders.push(()=>buildHybridHorizontal(items, W, H, K, h, 'along', 'across'));
      builders.push(()=>buildHybridHorizontal(items, W, H, K, h, 'across', 'along'));
      if(endgame){
        builders.push(()=>buildHybridHorizontal(items, W, H, K, h, 'along', 'along'));
        builders.push(()=>buildHybridHorizontal(items, W, H, K, h, 'across', 'across'));
      }
    }
    for(const w of ws){
      builders.push(()=>buildHybridVertical(items, W, H, K, w, 'across', 'along'));
      builders.push(()=>buildHybridVertical(items, W, H, K, w, 'along', 'across'));
      if(endgame){
        builders.push(()=>buildHybridVertical(items, W, H, K, w, 'along', 'along'));
        builders.push(()=>buildHybridVertical(items, W, H, K, w, 'across', 'across'));
      }
    }
    return builders.slice(0, Math.max(4, attempts));
  }

  function chooseBestNextSheet(items, W, H, K, opts){
    const attempts = Math.max(2, Math.round(Number(opts && opts.attempts) || 50));
    const lookahead = !!(opts && opts.lookahead);
    const endgame = !!(opts && opts.endgame);
    const builders = buildCandidateList(items, W, H, K, attempts, endgame);
    let best = null;
    let tries = 0;
    for(const make of builders){
      tries += 1;
      const cand = make();
      if(!cand || !cand.sheet || !cand.sheet.placements || !cand.sheet.placements.length) continue;
      const nextOcc = lookahead ? estimateNextOcc(cand.rem, W, H, K) : 0;
      const sc = scoreSheet(cand.sheet, K, cand.axis, nextOcc);
      cand.score = sc.score;
      cand.metrics = sc;
      cand.tries = tries;
      if(cand.kind && String(cand.kind).indexOf('teach-') === 0){
        cand.score += 55000;
        if(cand.teacherFillDir && cand.teacherBaseDir && cand.teacherFillDir !== cand.teacherBaseDir) cand.score += 85000;
        cand.score -= (sc.disposalCount || 0) * 12000;
      }
      if(cand.kind && String(cand.kind).indexOf('group-') === 0){
        cand.score += 120000;
        cand.score += (sc.sharedRows || 0) * 35000;
        cand.score += (sc.sharedCols || 0) * 25000;
        cand.score -= (sc.disposalCount || 0) * 18000;
      }
      if(cand.kind && String(cand.kind).indexOf('seed-') === 0){
        cand.score += 170000;
        cand.score += (cand.leadBands || 0) * 45000;
        cand.score += (cand.leadOcc || 0) * 120000;
        cand.score -= (sc.disposalCount || 0) * 22000;
      }
      if(!best || cand.score > best.score) best = cand;
    }
    return best;
  }

  function chooseBestTwoSheetTail(items, W, H, K, opts){
    const attempts = Math.max(10, Math.round(Number(opts && opts.attempts) || 80));
    const builders = buildCandidateList(items, W, H, K, attempts, true);
    const firsts = [];
    for(const make of builders){
      const cand = make();
      if(!cand || !cand.sheet || !cand.sheet.placements || !cand.sheet.placements.length) continue;
      const sc = scoreSheet(cand.sheet, K, cand.axis, 0);
      cand.score = sc.score;
      cand.metrics = sc;
      if(cand.kind && String(cand.kind).indexOf('teach-') === 0){
        cand.score += 55000;
        if(cand.teacherFillDir && cand.teacherBaseDir && cand.teacherFillDir !== cand.teacherBaseDir) cand.score += 85000;
        cand.score -= (sc.disposalCount || 0) * 12000;
      }
      if(cand.kind && String(cand.kind).indexOf('group-') === 0){
        cand.score += 120000;
        cand.score += (sc.sharedRows || 0) * 35000;
        cand.score += (sc.sharedCols || 0) * 25000;
        cand.score -= (sc.disposalCount || 0) * 18000;
      }
      if(cand.kind && String(cand.kind).indexOf('seed-') === 0){
        cand.score += 170000;
        cand.score += (cand.leadBands || 0) * 45000;
        cand.score += (cand.leadOcc || 0) * 120000;
        cand.score -= (sc.disposalCount || 0) * 22000;
      }
      firsts.push(cand);
    }
    firsts.sort((a,b)=>b.score - a.score);
    const take = firsts.slice(0, Math.min(12, firsts.length));
    let best = null;
    for(const first of take){
      if(!first.rem.length){
        const total = first.score + 250000;
        if(!best || total > best.score) best = { score: total, sheets:[first.sheet], rem:first.rem };
        continue;
      }
      const second = chooseBestNextSheet(first.rem, W, H, K, { attempts: Math.max(8, Math.floor(attempts / 2)), lookahead:false, endgame:true });
      if(!second) continue;
      const pairMetrics = scoreSheetPair(first.sheet, second.sheet, K);
      const total = first.score + second.score + pairMetrics.score + (first.metrics.sharedRows * 30000) + (second.metrics.sharedRows * 30000) - (first.metrics.disposalCount + second.metrics.disposalCount) * 22000;
      if(!best || total > best.score){
        best = { score: total, sheets:[first.sheet, second.sheet], rem: second.rem };
      }
    }
    return best;
  }

  function polishLastSheet(lastItems, W, H, K, attempts){
    return chooseBestNextSheet(lastItems, W, H, K, { attempts, lookahead:false, endgame:true });
  }

  function packOptionalBySheet(itemsIn, boardW, boardH, kerf, opts){
    const W = clampInt(boardW, 2800);
    const H = clampInt(boardH, 2070);
    const K = Math.max(0, Math.round(Number(kerf)||0));
    let rem = (itemsIn||[]).map(it=>Object.assign({}, it));
    const sheets = [];
    const boardArea = W * H;
    const attempts = Math.max(2, Math.round(Number(opts && opts.maxAttempts) || Number(opts && opts.attempts) || 50));
    const endgameAttempts = Math.max(20, Math.round(Number(opts && opts.endgameAttempts) || 200));
    const onProgress = (opts && typeof opts.onProgress === 'function') ? opts.onProgress : null;

    function emit(step){
      if(!onProgress) return;
      try{ onProgress({ builtSheets: sheets.length, remainingItems: rem.length, step: step || 'sheet' }); }catch(_){ }
    }

    while(rem.length){
      const remArea = sumArea(rem);
      const nearTail = remArea <= boardArea * 2.2 || rem.length <= 18;
      if(nearTail){
        const pair = chooseBestTwoSheetTail(rem, W, H, K, { attempts: Math.max(attempts, Math.floor(endgameAttempts / 2)) });
        if(pair && pair.sheets && pair.sheets.length){
          for(const s of pair.sheets) sheets.push(s);
          rem = pair.rem || [];
          emit('tail-pair');
          break;
        }
      }
      const best = chooseBestNextSheet(rem, W, H, K, { attempts, lookahead:true, endgame:false });
      if(!best){
        const fallback = buildFullCandidate(rem, W, H, K, 'along') || buildFullCandidate(rem, W, H, K, 'across');
        if(!fallback) break;
        sheets.push(fallback.sheet);
        rem = fallback.rem;
        emit('fallback');
        continue;
      }
      sheets.push(best.sheet);
      rem = best.rem;
      emit('sheet');
    }

    if(sheets.length >= 2){
      const penultimate = sheets[sheets.length - 2];
      const last = sheets[sheets.length - 1];
      const pairIds = new Set([...usedIds(penultimate), ...usedIds(last)]);
      const pairItems = (itemsIn||[]).filter(it => pairIds.has(it.id));
      const rebalanced = chooseBestTwoSheetTail(pairItems, W, H, K, { attempts: Math.max(attempts, Math.floor(endgameAttempts * 0.75)) });
      if(rebalanced && rebalanced.sheets && rebalanced.sheets.length === 2){
        const oldPair = scoreSheetPair(penultimate, last, K);
        const newPair = scoreSheetPair(rebalanced.sheets[0], rebalanced.sheets[1], K);
        if(newPair.score > oldPair.score + 30000 || newPair.disposalArea < oldPair.disposalArea - 20000){
          sheets[sheets.length - 2] = rebalanced.sheets[0];
          sheets[sheets.length - 1] = rebalanced.sheets[1];
          emit('tail-rebalance');
        }
      }
    }

    if(sheets.length){
      const last = sheets[sheets.length - 1];
      const lastIds = usedIds(last);
      const lastItems = (itemsIn||[]).filter(it => lastIds.has(it.id));
      const polished = polishLastSheet(lastItems, W, H, K, endgameAttempts);
      if(polished && polished.sheet){
        const oldOcc = placementArea(last) / Math.max(1, boardArea);
        const newOcc = placementArea(polished.sheet) / Math.max(1, boardArea);
        const oldScore = scoreSheet(last, K, 'auto', 0).score;
        const newScore = scoreSheet(polished.sheet, K, 'auto', 0).score;
        if(newOcc > oldOcc + 0.01 || newScore > oldScore + 25000){
          sheets[sheets.length - 1] = polished.sheet;
          emit('last-polish');
        }
      }
    }

    return sheets;
  }

  root.FC.optionalSolver = Object.assign({}, root.FC.optionalSolver || {}, {
    packOptionalBySheet,
  });
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));

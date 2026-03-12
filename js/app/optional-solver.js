/* optional-solver.js — przebudowany solver trybu „Opcjonalnie kierunek cięcia”
   Założenia:
   - nie rusza działających trybów pasowych (strip-solver.js),
   - buduje arkusz od 1–2 pasów startowych z grup podobnych wymiarów,
   - po sekcji startowej dogęszcza resztę prostokąta solverem pasowym,
   - ocenia jakość odpadu i próbuje poprawiać końcówkę ostatnich 2 płyt.
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
  function itemArea(it){ return (Number(it && it.w) || 0) * (Number(it && it.h) || 0); }
  function placementArea(sheet){
    let s = 0;
    for(const p of (((sheet && sheet.placements) || []).filter(Boolean))){
      if(!p.unplaced) s += (Number(p.w)||0) * (Number(p.h)||0);
    }
    return s;
  }
  function usedIds(sheet){
    return new Set((((sheet && sheet.placements) || []).filter(p=>p && !p.unplaced).map(p=>p.id)));
  }
  function removeByIds(items, ids){
    return (items || []).filter(it => !ids.has(it.id));
  }
  function orientItem(it, rotated){
    if(rotated){
      return {
        w: Number(it.h) || 0,
        h: Number(it.w) || 0,
        rotated: true,
        edgeW1: it.edgeH1,
        edgeW2: it.edgeH2,
        edgeH1: it.edgeW1,
        edgeH2: it.edgeW2,
      };
    }
    return {
      w: Number(it.w) || 0,
      h: Number(it.h) || 0,
      rotated: false,
      edgeW1: it.edgeW1,
      edgeW2: it.edgeW2,
      edgeH1: it.edgeH1,
      edgeH2: it.edgeH2,
    };
  }
  function itemOrientations(it){
    const out = [orientItem(it, false)];
    if(it && it.rotationAllowed && Number(it.w) !== Number(it.h)) out.push(orientItem(it, true));
    return out;
  }
  function offsetSheet(sheet, dx, dy){
    const s = clone(sheet);
    s.placements = (s.placements || []).map(p=>Object.assign({}, p, { x:(p.x||0)+dx, y:(p.y||0)+dy }));
    return s;
  }
  function mergePlacements(boardW, boardH, placements){
    return { boardW, boardH, placements: (placements || []).slice() };
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
      const placed = { x:p.x, y:p.y, w:(p.w||0) + K, h:(p.h||0) + K };
      const next = [];
      for(const fr of free){
        if(rectIntersects(fr, placed)) next.push(...splitFreeRectByIntersection(fr, placed));
        else next.push(fr);
      }
      free = pruneFreeRects(next.filter(r=>r.w>0 && r.h>0));
    }
    return free;
  }
  function scrapMetrics(freeRects){
    let disposalArea = 0, disposalCount = 0, reusableArea = 0, longThinCount = 0;
    for(const r of (freeRects || [])){
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
  function bandFamilyMetrics(placements, primaryAxis){
    const groups = new Map();
    for(const p of (placements || [])){
      const dim = primaryAxis === 'v' ? (Number(p.w) || 0) : (Number(p.h) || 0);
      const bucket = Math.round(dim / 10) * 10;
      const prev = groups.get(bucket) || { bucket, count:0, area:0 };
      prev.count += 1;
      prev.area += (Number(p.w)||0) * (Number(p.h)||0);
      groups.set(bucket, prev);
    }
    const arr = Array.from(groups.values()).sort((a,b)=> (b.count-a.count) || (b.area-a.area));
    const dominant = arr[0] || { count:0 };
    const singletons = arr.filter(g=>g.count === 1).length;
    return { familyCount: arr.length, dominantCount: dominant.count || 0, singletons };
  }

  function scoreSheet(sheet, kerf, meta){
    const area = Math.max(1, (Number(sheet.boardW)||0) * (Number(sheet.boardH)||0));
    const occ = placementArea(sheet) / area;
    const free = calcFreeRects(sheet, kerf).filter(r=>r.w>=20 && r.h>=20);
    const sm = scrapMetrics(free);
    const fam = bandFamilyMetrics((sheet.placements || []).filter(p=>p && !p.unplaced), (meta && meta.primaryAxis) || 'v');
    let score = 0;
    score += occ * 1000000;
    score -= (sm.disposalArea / area) * 360000;
    score -= sm.disposalCount * 42000;
    score -= sm.longThinCount * 24000;
    score += (sm.reusableArea / area) * 30000;
    score += fam.dominantCount * 16000;
    score -= fam.singletons * 18000;
    if(meta && meta.seedBands){
      for(const b of meta.seedBands){
        score += (b.fillRatio || 0) * 180000;
        if((b.fillRatio || 0) >= 0.90) score += 70000;
        else if((b.fillRatio || 0) >= 0.80) score += 25000;
        else score -= 60000;
      }
    }
    if(meta && meta.kind === 'seed') score += 30000;
    if(meta && meta.kind === 'fallback-strip') score -= 25000;
    return {
      score,
      occupancy: occ,
      disposalArea: sm.disposalArea,
      disposalCount: sm.disposalCount,
      reusableArea: sm.reusableArea,
      families: fam.familyCount,
      dominantFamily: fam.dominantCount,
    };
  }

  function uniqueGuideDims(items, axis, maxDim, tolerance){
    const raw = [];
    for(const it of (items || [])){
      for(const o of itemOrientations(it)){
        const dim = axis === 'v' ? o.w : o.h;
        const other = axis === 'v' ? o.h : o.w;
        if(dim <= 0 || other <= 0) continue;
        if(dim > maxDim) continue;
        raw.push({ dim, area:o.w*o.h, id:it.id });
      }
    }
    raw.sort((a,b)=> (b.area-a.area) || (b.dim-a.dim));
    const used = [];
    const out = [];
    for(const r of raw){
      if(used.some(v=>Math.abs(v-r.dim) <= tolerance)) continue;
      used.push(r.dim);
      out.push(r.dim);
      if(out.length >= 12) break;
    }
    return out;
  }

  function buildBand(items, limitPrimary, limitCross, kerf, axis, guideDim, opts){
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const tol = Math.max(20, Math.round(Number((opts && opts.clusterTolerance) || 75)));
    const minRatio = Number((opts && opts.minFamilyRatio) || 0.72);
    const candidates = [];
    for(const it of (items || [])){
      const options = [];
      for(const o of itemOrientations(it)){
        const primary = axis === 'v' ? o.w : o.h;
        const cross = axis === 'v' ? o.h : o.w;
        if(primary <= 0 || cross <= 0) continue;
        if(primary > limitPrimary || cross > limitCross) continue;
        const lower = Math.min(guideDim - tol, guideDim * minRatio);
        const similar = primary >= lower && primary <= guideDim + tol;
        if(!similar) continue;
        const gap = Math.abs(primary - guideDim);
        const smallPenalty = primary < guideDim * 0.85 ? (guideDim * 0.85 - primary) * 800 : 0;
        const score = (o.w * o.h) * 1000 - gap * 1400 - smallPenalty - cross * 30;
        options.push({ o, score, primary, cross });
      }
      if(!options.length) continue;
      options.sort((a,b)=> b.score - a.score);
      candidates.push({ item:it, options });
    }
    if(!candidates.length) return null;

    const cap = Math.max(0, limitCross);
    const dp = new Array(cap + 1).fill(null);
    dp[0] = { score:0, area:0, prev:-1, choice:null, used:new Set() };
    for(let i=0;i<candidates.length;i++){
      const next = dp.slice();
      for(let used=0; used<=cap; used++){
        const st = dp[used];
        if(!st) continue;
        for(const opt of candidates[i].options){
          const add = (used > 0 ? K : 0) + opt.cross;
          const nu = used + add;
          if(nu > cap) continue;
          if(st.used.has(candidates[i].item.id)) continue;
          const nextUsed = new Set(st.used);
          nextUsed.add(candidates[i].item.id);
          const localScore = st.score + opt.score + ((cap - nu) <= 100 ? 90000 : -((cap - nu) * 120));
          const prevBest = next[nu];
          if(!prevBest || localScore > prevBest.score){
            next[nu] = {
              score: localScore,
              area: st.area + (opt.o.w * opt.o.h),
              prev: used,
              choice: { idx:i, orient:opt.o, primary:opt.primary, cross:opt.cross },
              used: nextUsed,
            };
          }
        }
      }
      for(let c=0;c<=cap;c++) dp[c] = next[c];
    }

    let best = null;
    for(let used=0; used<=cap; used++){
      const st = dp[used];
      if(!st || st.used.size === 0) continue;
      let maxPrimary = 0;
      let count = 0;
      let cur = st;
      while(cur && cur.choice){
        maxPrimary = Math.max(maxPrimary, cur.choice.primary);
        count += 1;
        cur = dp[cur.prev];
      }
      if(maxPrimary <= 0) continue;
      const fillRatio = st.area / (Math.max(1, maxPrimary) * limitCross);
      const variancePenalty = Math.abs(maxPrimary - guideDim) * 500;
      const totalScore = st.score + fillRatio * 220000 - variancePenalty + count * 6000;
      if(!best || totalScore > best.totalScore){
        best = { totalScore, usedCross:used, state:st, bandPrimary:maxPrimary, fillRatio, count };
      }
    }
    if(!best) return null;

    const picked = [];
    let cur = best.state;
    while(cur && cur.choice){
      const rec = cur.choice;
      picked.push({ item:candidates[rec.idx].item, orient:rec.orient, primary:rec.primary, cross:rec.cross });
      cur = dp[cur.prev];
    }
    picked.reverse();
    if(!picked.length) return null;

    const bandPrimary = best.bandPrimary;
    const placements = [];
    let cursor = 0;
    for(const p of picked){
      if(axis === 'v'){
        placements.push({
          id:p.item.id, key:p.item.key, name:p.item.name,
          x:0, y:cursor, w:p.orient.w, h:p.orient.h,
          rotated:!!p.orient.rotated,
          edgeW1:p.orient.edgeW1, edgeW2:p.orient.edgeW2,
          edgeH1:p.orient.edgeH1, edgeH2:p.orient.edgeH2,
        });
        cursor += p.orient.h + K;
      } else {
        placements.push({
          id:p.item.id, key:p.item.key, name:p.item.name,
          x:cursor, y:0, w:p.orient.w, h:p.orient.h,
          rotated:!!p.orient.rotated,
          edgeW1:p.orient.edgeW1, edgeW2:p.orient.edgeW2,
          edgeH1:p.orient.edgeH1, edgeH2:p.orient.edgeH2,
        });
        cursor += p.orient.w + K;
      }
    }

    return {
      axis,
      guideDim,
      bandPrimary,
      fillRatio: best.fillRatio,
      score: best.totalScore,
      placements,
      ids: new Set(picked.map(p=>p.item.id)),
      usedArea: picked.reduce((s,p)=> s + p.orient.w * p.orient.h, 0),
    };
  }

  function buildSeededCandidate(items, boardW, boardH, kerf, primaryAxis, guideA, guideB, opts){
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const W = boardW, H = boardH;
    const placements = [];
    const seedBands = [];
    let remaining = (items || []).slice();
    let residual = { x:0, y:0, w:W, h:H };

    const applyBand = (band)=>{
      const offsetX = residual.x;
      const offsetY = residual.y;
      const shifted = band.placements.map(p=>Object.assign({}, p, { x:(p.x||0)+offsetX, y:(p.y||0)+offsetY }));
      placements.push(...shifted);
      seedBands.push({ axis:band.axis, guideDim:band.guideDim, bandPrimary:band.bandPrimary, fillRatio:band.fillRatio });
      remaining = removeByIds(remaining, band.ids);
      if(primaryAxis === 'v'){
        residual = { x: residual.x + band.bandPrimary + K, y: residual.y, w: residual.w - band.bandPrimary - K, h: residual.h };
      } else {
        residual = { x: residual.x, y: residual.y + band.bandPrimary + K, w: residual.w, h: residual.h - band.bandPrimary - K };
      }
    };

    const first = buildBand(remaining, primaryAxis === 'v' ? residual.w : residual.h, primaryAxis === 'v' ? residual.h : residual.w, kerf, primaryAxis, guideA, opts);
    if(!first) return null;
    if(first.fillRatio < 0.80) return null;
    applyBand(first);

    if(guideB && residual.w > 0 && residual.h > 0){
      const second = buildBand(remaining, primaryAxis === 'v' ? residual.w : residual.h, primaryAxis === 'v' ? residual.h : residual.w, kerf, primaryAxis, guideB, opts);
      if(second && second.fillRatio >= 0.90){
        applyBand(second);
      }
    }

    const residualCandidates = [];
    if(residual.w > 100 && residual.h > 100 && remaining.length && strip && typeof strip.packStripBands === 'function'){
      const directions = ['along', 'across'];
      for(const dir of directions){
        const packed = strip.packStripBands(remaining, residual.w, residual.h, kerf, dir) || [];
        const firstSheet = packed[0] || { boardW: residual.w, boardH: residual.h, placements: [] };
        const residualSheet = offsetSheet(firstSheet, residual.x, residual.y);
        const merged = mergePlacements(W, H, placements.concat(residualSheet.placements || []));
        residualCandidates.push({
          kind: 'seed',
          primaryAxis,
          seedBands: clone(seedBands),
          residualDirection: dir,
          sheet: merged,
        });
      }
    } else {
      residualCandidates.push({ kind:'seed', primaryAxis, seedBands: clone(seedBands), residualDirection: 'none', sheet: mergePlacements(W, H, placements) });
    }

    let best = null;
    for(const cand of residualCandidates){
      const sc = scoreSheet(cand.sheet, kerf, cand);
      if(!best || sc.score > best.sc.score) best = { cand, sc };
    }
    return best;
  }

  function buildFallbackStrip(items, boardW, boardH, kerf, direction){
    if(!strip || typeof strip.packStripBands !== 'function') return null;
    const packed = strip.packStripBands(items, boardW, boardH, kerf, direction) || [];
    const firstSheet = packed[0] || { boardW, boardH, placements: [] };
    const meta = { kind:'fallback-strip', primaryAxis: direction === 'along' ? 'v' : 'h', seedBands: [] };
    return { cand: meta, sheet: firstSheet, sc: scoreSheet(firstSheet, kerf, meta) };
  }

  function buildCandidateList(items, boardW, boardH, kerf, opts){
    const candidates = [];
    const guidesV = uniqueGuideDims(items, 'v', boardW, opts.clusterTolerance || 75);
    const guidesH = uniqueGuideDims(items, 'h', boardH, opts.clusterTolerance || 75);
    const topV = guidesV.slice(0, 8);
    const topH = guidesH.slice(0, 8);

    for(let i=0;i<topV.length;i++){
      const guideA = topV[i];
      const solo = buildSeededCandidate(items, boardW, boardH, kerf, 'v', guideA, null, opts);
      if(solo) candidates.push(solo);
      for(let j=i+1;j<topV.length && j<i+4;j++){
        const duo = buildSeededCandidate(items, boardW, boardH, kerf, 'v', guideA, topV[j], opts);
        if(duo) candidates.push(duo);
      }
    }
    for(let i=0;i<topH.length;i++){
      const guideA = topH[i];
      const solo = buildSeededCandidate(items, boardW, boardH, kerf, 'h', guideA, null, opts);
      if(solo) candidates.push(solo);
      for(let j=i+1;j<topH.length && j<i+4;j++){
        const duo = buildSeededCandidate(items, boardW, boardH, kerf, 'h', guideA, topH[j], opts);
        if(duo) candidates.push(duo);
      }
    }

    const fallbackAlong = buildFallbackStrip(items, boardW, boardH, kerf, 'along');
    if(fallbackAlong) candidates.push(fallbackAlong);
    const fallbackAcross = buildFallbackStrip(items, boardW, boardH, kerf, 'across');
    if(fallbackAcross) candidates.push(fallbackAcross);

    return candidates;
  }

  function chooseBestCandidate(items, boardW, boardH, kerf, opts){
    const list = buildCandidateList(items, boardW, boardH, kerf, opts);
    let best = null;
    for(const entry of list){
      const cand = entry.cand || entry.meta || {};
      const sheet = entry.sheet || cand.sheet;
      const sc = entry.sc || scoreSheet(sheet, kerf, cand);
      if(!best || sc.score > best.sc.score) best = { sheet, sc, meta: cand };
    }
    return best;
  }

  function scoreSheetPair(s1, s2, kerf){
    const a = scoreSheet(s1, kerf, { kind:'pair', primaryAxis:'v', seedBands:[] });
    const b = scoreSheet(s2, kerf, { kind:'pair', primaryAxis:'v', seedBands:[] });
    const area = Math.max(1, (Number(s1.boardW)||0) * (Number(s1.boardH)||0) + (Number(s2.boardW)||0) * (Number(s2.boardH)||0));
    return {
      score: a.score + b.score,
      disposalArea: (a.disposalArea || 0) + (b.disposalArea || 0),
      occupancy: (placementArea(s1) + placementArea(s2)) / area,
    };
  }

  function repackTailTwoSheets(sheets, kerf, opts){
    if(!Array.isArray(sheets) || sheets.length < 2) return sheets;
    const out = sheets.slice();
    const last = out[out.length - 1];
    const prev = out[out.length - 2];
    const ids = new Set([...(usedIds(prev)), ...(usedIds(last))]);
    const pool = [];
    for(const s of [prev, last]){
      for(const p of ((s && s.placements) || []).filter(x=>x && !x.unplaced)){
        if(ids.has(p.id) && !pool.some(v=>v.id === p.id)){
          pool.push({
            id:p.id, key:p.key, name:p.name,
            w:Number(p.rotated ? p.h : p.w),
            h:Number(p.rotated ? p.w : p.h),
            rotationAllowed: true,
            edgeW1:p.rotated ? p.edgeH1 : p.edgeW1,
            edgeW2:p.rotated ? p.edgeH2 : p.edgeW2,
            edgeH1:p.rotated ? p.edgeW1 : p.edgeH1,
            edgeH2:p.rotated ? p.edgeW2 : p.edgeH2,
          });
        }
      }
    }
    let rem = pool.slice();
    const rebuilt = [];
    for(let i=0;i<2;i++){
      if(!rem.length) rebuilt.push({ boardW:last.boardW, boardH:last.boardH, placements:[] });
      else {
        const best = chooseBestCandidate(rem, last.boardW, last.boardH, kerf, opts);
        if(!best) break;
        rebuilt.push(best.sheet);
        rem = removeByIds(rem, usedIds(best.sheet));
      }
    }
    if(rebuilt.length !== 2) return sheets;
    const oldSc = scoreSheetPair(prev, last, kerf);
    const newSc = scoreSheetPair(rebuilt[0], rebuilt[1], kerf);
    if(newSc.score > oldSc.score || newSc.disposalArea < oldSc.disposalArea){
      out[out.length - 2] = rebuilt[0];
      out[out.length - 1] = rebuilt[1];
    }
    return out;
  }

  function polishLastSheet(sheets, kerf, opts){
    if(!Array.isArray(sheets) || !sheets.length) return sheets;
    const out = sheets.slice();
    const last = out[out.length - 1];
    const pool = [];
    for(const p of ((last && last.placements) || []).filter(x=>x && !x.unplaced)){
      if(!pool.some(v=>v.id === p.id)){
        pool.push({
          id:p.id, key:p.key, name:p.name,
          w:Number(p.rotated ? p.h : p.w),
          h:Number(p.rotated ? p.w : p.h),
          rotationAllowed: true,
          edgeW1:p.rotated ? p.edgeH1 : p.edgeW1,
          edgeW2:p.rotated ? p.edgeH2 : p.edgeW2,
          edgeH1:p.rotated ? p.edgeW1 : p.edgeH1,
          edgeH2:p.rotated ? p.edgeW2 : p.edgeH2,
        });
      }
    }
    const rebuilt = chooseBestCandidate(pool, last.boardW, last.boardH, kerf, Object.assign({}, opts, { clusterTolerance: Math.max(75, (opts.clusterTolerance||75)) }));
    if(!rebuilt) return sheets;
    const oldSc = scoreSheet(last, kerf, { kind:'old-last', primaryAxis:'v', seedBands:[] });
    const newSc = scoreSheet(rebuilt.sheet, kerf, rebuilt.meta);
    if(newSc.score > oldSc.score || newSc.disposalArea < oldSc.disposalArea) out[out.length - 1] = rebuilt.sheet;
    return out;
  }

  function packOptionalBySheet(itemsIn, boardW, boardH, kerf, opts){
    const W = clampInt(boardW, 2800);
    const H = clampInt(boardH, 2070);
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const settings = Object.assign({
      clusterTolerance: 75,
      minFamilyRatio: 0.72,
      onProgress: null,
    }, opts || {});

    let remaining = (itemsIn || []).map(it=>Object.assign({}, it));
    const sheets = [];
    let builtSheets = 0;

    while(remaining.length){
      if(typeof settings.onProgress === 'function'){
        try{ settings.onProgress({ step:'sheet', builtSheets }); }catch(_){ }
      }
      const best = chooseBestCandidate(remaining, W, H, K, settings);
      if(!best || !best.sheet || !usedIds(best.sheet).size) break;
      sheets.push(best.sheet);
      remaining = removeByIds(remaining, usedIds(best.sheet));
      builtSheets += 1;
    }

    let out = sheets;
    out = repackTailTwoSheets(out, K, settings);
    out = polishLastSheet(out, K, settings);
    return out;
  }

  root.FC.optionalSolver = Object.assign({}, root.FC.optionalSolver || {}, {
    packOptionalBySheet,
  });
})(typeof self !== 'undefined' ? self : window);

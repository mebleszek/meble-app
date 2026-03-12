/* optional-solver.js — tryb „Opcjonalnie” przepisany od nowa
   Cel:
   - nie dotykać solverów pasowych w strip-solver.js,
   - budować arkusz konstrukcyjnie: 1–2 pasy startowe -> zmiana kierunku -> dogęszczenie,
   - częściej grupować podobne szerokości / wysokości,
   - minimalizować śmieciowy odpad i mikro-ogonki.
*/
(function(root){
  'use strict';

  root.FC = root.FC || {};
  const strip = root.FC.stripSolver;

  function clampInt(v, fallback){
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }
  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function areaOf(it){ return (Number(it && it.w) || 0) * (Number(it && it.h) || 0); }
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
  function offsetSheet(sheet, dx, dy){
    const s = clone(sheet || { placements:[] });
    s.placements = (s.placements || []).map(p=>Object.assign({}, p, { x:(p.x||0)+dx, y:(p.y||0)+dy }));
    return s;
  }
  function mergePlacements(boardW, boardH, placements){
    return { boardW, boardH, placements: (placements || []).slice() };
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
  function widthBucket(n, step){
    const s = Math.max(5, Math.round(Number(step)||10));
    return Math.round((Number(n)||0) / s) * s;
  }
  function bandFamilyMetrics(placements, primaryAxis){
    const groups = new Map();
    for(const p of (placements || [])){
      const dim = primaryAxis === 'v' ? (Number(p.w) || 0) : (Number(p.h) || 0);
      const bucket = widthBucket(dim, 10);
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
    score -= (sm.disposalArea / area) * 420000;
    score -= sm.disposalCount * 52000;
    score -= sm.longThinCount * 30000;
    score += (sm.reusableArea / area) * 30000;
    score += fam.dominantCount * 14000;
    score -= fam.singletons * 16000;
    if(meta && Array.isArray(meta.seedBands)){
      for(const b of meta.seedBands){
        score += (b.fillRatio || 0) * 200000;
        if((b.fillRatio || 0) >= 0.90) score += 80000;
        else if((b.fillRatio || 0) >= 0.80) score += 30000;
        else score -= 90000;
      }
    }
    if(meta && meta.residualDirection){
      if(meta.primaryAxis === 'v' && meta.residualDirection === 'across') score += 40000;
      if(meta.primaryAxis === 'h' && meta.residualDirection === 'along') score += 40000;
    }
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

  function topSeedItems(items, limit){
    return (items || []).slice().sort((a,b)=> areaOf(b) - areaOf(a)).slice(0, Math.max(8, limit || 18));
  }

  function guideDimsFromItem(it, axis){
    const dims = [];
    for(const o of itemOrientations(it)){
      const primary = axis === 'v' ? o.w : o.h;
      const cross = axis === 'v' ? o.h : o.w;
      if(primary > 0 && cross > 0){
        dims.push({ guide: primary, orient: o, cross });
      }
    }
    return dims;
  }

  function buildClusterBand(items, axis, limitPrimary, limitCross, kerf, guideDim, preferredItemId, opts){
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const tol = Math.max(20, Math.round(Number((opts && opts.clusterTolerance) || 75)));
        const candidates = [];
    for(const it of (items || [])){
      const variants = [];
      for(const o of itemOrientations(it)){
        const primary = axis === 'v' ? o.w : o.h;
        const cross = axis === 'v' ? o.h : o.w;
        if(primary <= 0 || cross <= 0) continue;
        if(primary > limitPrimary || cross > limitCross) continue;
        const lower = Math.max(0, guideDim - tol);
        const upper = guideDim + tol;
        const similar = primary >= lower && primary <= upper;
        if(!similar) continue;
        const gap = Math.abs(primary - guideDim);
        const prefer = (preferredItemId && it.id === preferredItemId) ? 120000 : 0;
        const familyBonus = Math.max(0, tol - gap) * 1200;
        const score = (o.w * o.h) * 1000 + familyBonus + prefer - gap * 1200 - cross * 25;
        variants.push({ orient:o, primary, cross, score });
      }
      if(!variants.length) continue;
      variants.sort((a,b)=> b.score - a.score);
      candidates.push({ item:it, variants });
    }
    if(!candidates.length) return null;

    const cap = Math.max(0, Math.round(limitCross));
    const dp = new Array(cap + 1).fill(null);
    dp[0] = { score:0, area:0, count:0, prev:-1, choice:null, used:new Set() };
    for(let i=0;i<candidates.length;i++){
      const next = dp.slice();
      for(let used=0; used<=cap; used++){
        const st = dp[used];
        if(!st) continue;
        for(const v of candidates[i].variants){
          if(st.used.has(candidates[i].item.id)) continue;
          const add = (used > 0 ? K : 0) + v.cross;
          const nu = used + add;
          if(nu > cap) continue;
          const usedSet = new Set(st.used);
          usedSet.add(candidates[i].item.id);
          const tail = cap - nu;
          const tailPenalty = tail > 120 ? tail * 250 : -((120 - tail) * 200);
          const localScore = st.score + v.score - tailPenalty + 5000;
          const prevBest = next[nu];
          if(!prevBest || localScore > prevBest.score){
            next[nu] = {
              score: localScore,
              area: st.area + (v.orient.w * v.orient.h),
              count: st.count + 1,
              prev: used,
              choice: { idx:i, orient:v.orient, primary:v.primary, cross:v.cross },
              used: usedSet,
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
      let bandPrimary = 0;
      let cur = st;
      while(cur && cur.choice){
        bandPrimary = Math.max(bandPrimary, cur.choice.primary);
        cur = dp[cur.prev];
      }
      if(bandPrimary <= 0) continue;
      const fillRatio = st.area / Math.max(1, bandPrimary * cap);
      const score = st.score + fillRatio * 240000 + st.count * 8000 - Math.abs(bandPrimary - guideDim) * 400;
      if(!best || score > best.score) best = { score, st, bandPrimary, fillRatio };
    }
    if(!best) return null;

    const picked = [];
    let cur = best.st;
    while(cur && cur.choice){
      const ch = cur.choice;
      picked.push({ item:candidates[ch.idx].item, orient:ch.orient, primary:ch.primary, cross:ch.cross });
      cur = dp[cur.prev];
    }
    picked.reverse();
    if(!picked.length) return null;

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
      bandPrimary: best.bandPrimary,
      fillRatio: best.fillRatio,
      placements,
      ids: new Set(picked.map(p=>p.item.id)),
      usedArea: picked.reduce((s,p)=> s + p.orient.w * p.orient.h, 0),
    };
  }


  function familyGuidesFromRemaining(items, axis, limitPrimary, limitCross, opts){
    const tol = Math.max(20, Math.round(Number((opts && opts.clusterTolerance) || 75)));
    const bucketStep = Math.max(10, Math.round(tol / 2));
    const buckets = new Map();
    for(const it of (items || [])){
      for(const o of itemOrientations(it)){
        const primary = axis === 'v' ? o.w : o.h;
        const cross = axis === 'v' ? o.h : o.w;
        if(primary <= 0 || cross <= 0) continue;
        if(primary > limitPrimary || cross > limitCross) continue;
        const key = widthBucket(primary, bucketStep);
        const prev = buckets.get(key) || { guide:key, count:0, area:0, members:0 };
        prev.count += 1;
        prev.area += primary * cross;
        prev.members += 1;
        buckets.set(key, prev);
      }
    }
    return Array.from(buckets.values())
      .sort((a,b)=> (b.count-a.count) || (b.area-a.area) || (b.guide-a.guide))
      .map(v=>v.guide)
      .slice(0, 10);
  }

  function packBandsInAxis(items, rect, kerf, axis, opts){
    const K = Math.max(0, Math.round(Number(kerf)||0));
    let remaining = (items || []).slice();
    const placements = [];
    let residual = { x:0, y:0, w:Number(rect.w)||0, h:Number(rect.h)||0 };
    const ids = new Set();
    const minFill = Math.max(0.45, Number((opts && opts.minOppositeResidualFill) || 0.58));
    const weakStop = Math.max(0.38, minFill - 0.10);
    let bandsMade = 0;

    while(remaining.length && residual.w > 60 && residual.h > 60){
      const limitPrimary = axis === 'v' ? residual.w : residual.h;
      const limitCross = axis === 'v' ? residual.h : residual.w;
      const guides = familyGuidesFromRemaining(remaining, axis, limitPrimary, limitCross, opts);
      if(!guides.length) break;
      let bestBand = null;
      for(const guide of guides){
        const band = buildClusterBand(remaining, axis, limitPrimary, limitCross, K, guide, null, opts);
        if(!band || !band.ids || !band.ids.size) continue;
        const tail = Math.max(0, limitCross - ((axis === 'v')
          ? Math.max(...band.placements.map(p=> (p.y||0) + (p.h||0)), 0)
          : Math.max(...band.placements.map(p=> (p.x||0) + (p.w||0)), 0)));
        const score = (band.fillRatio || 0) * 100000 + (band.usedArea || 0) - tail * 120;
        if(!bestBand || score > bestBand._score){
          bestBand = Object.assign({ _score: score }, band);
        }
      }
      if(!bestBand) break;
      if(bandsMade > 0 && (bestBand.fillRatio || 0) < weakStop) break;
      if(bandsMade === 0 && (bestBand.fillRatio || 0) < minFill) break;

      const shifted = bestBand.placements.map(p=>Object.assign({}, p, { x:(p.x||0)+residual.x, y:(p.y||0)+residual.y }));
      placements.push(...shifted);
      for(const id of bestBand.ids) ids.add(id);
      remaining = removeByIds(remaining, bestBand.ids);
      if(axis === 'v'){
        residual = { x: residual.x + bestBand.bandPrimary + K, y: residual.y, w: residual.w - bestBand.bandPrimary - K, h: residual.h };
      } else {
        residual = { x: residual.x, y: residual.y + bestBand.bandPrimary + K, w: residual.w, h: residual.h - bestBand.bandPrimary - K };
      }
      bandsMade += 1;
    }

    return {
      direction: axis === 'v' ? 'along' : 'across',
      sheet: mergePlacements(Number(rect.w)||0, Number(rect.h)||0, placements),
      ids,
      bandsMade,
    };
  }

  function residualFillCandidate(remaining, rect, kerf, primaryAxis, opts){
    if(!remaining.length) return null;
    const oppositeAxis = primaryAxis === 'v' ? 'h' : 'v';
    const direct = packBandsInAxis(remaining, rect, kerf, oppositeAxis, opts);
    const firstSheet = (direct && direct.sheet) || { boardW:rect.w, boardH:rect.h, placements:[] };
    const sc = scoreSheet(firstSheet, kerf, { primaryAxis: oppositeAxis, seedBands:[] });
    return { direction: direct.direction, sheet:firstSheet, score: sc.score, sc, occ: sc.occupancy || 0, ids: direct.ids || new Set() };
  }

  function buildConstructiveSheet(items, boardW, boardH, kerf, seedItem, seedAxis, guideA, guideB, opts){
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const W = boardW, H = boardH;
    const placements = [];
    const seedBands = [];
    let remaining = (items || []).slice();
    let residual = { x:0, y:0, w:W, h:H };

    const applyBand = (band)=>{
      const shifted = band.placements.map(p=>Object.assign({}, p, { x:(p.x||0)+residual.x, y:(p.y||0)+residual.y }));
      placements.push(...shifted);
      seedBands.push({ axis:band.axis, guideDim:band.guideDim, bandPrimary:band.bandPrimary, fillRatio:band.fillRatio });
      remaining = removeByIds(remaining, band.ids);
      if(seedAxis === 'v'){
        residual = { x: residual.x + band.bandPrimary + K, y: residual.y, w: residual.w - band.bandPrimary - K, h: residual.h };
      } else {
        residual = { x: residual.x, y: residual.y + band.bandPrimary + K, w: residual.w, h: residual.h - band.bandPrimary - K };
      }
    };

    const threshold1 = Number((opts && opts.minBandFill) || 0.80);
    const threshold2 = Number((opts && opts.secondBandFill) || 0.90);
    const band1 = buildClusterBand(remaining, seedAxis, seedAxis === 'v' ? residual.w : residual.h, seedAxis === 'v' ? residual.h : residual.w, kerf, guideA, seedItem && seedItem.id, opts);
    if(!band1) return null;
    applyBand(band1);

    // Drugi pas tylko gdy pierwszy jest naprawdę mocny i drugi też mocny.
    if((band1.fillRatio || 0) >= threshold2 && guideB && residual.w > 120 && residual.h > 120){
      const band2 = buildClusterBand(remaining, seedAxis, seedAxis === 'v' ? residual.w : residual.h, seedAxis === 'v' ? residual.h : residual.w, kerf, guideB, null, opts);
      if(band2 && (band2.fillRatio || 0) >= threshold2){
        applyBand(band2);
      }
    }

    let residualDirection = 'none';
    // Po 1-2 pasach na sztywno próbujemy kierunku przeciwnego.
    if(residual.w > 100 && residual.h > 100 && remaining.length){
      const refilled = residualFillCandidate(remaining, residual, kerf, seedAxis, opts);
      if(refilled){
        const shifted = offsetSheet(refilled.sheet, residual.x, residual.y);
        placements.push(...(shifted.placements || []));
        remaining = removeByIds(remaining, refilled.ids && refilled.ids.size ? refilled.ids : usedIds(refilled.sheet));
        residualDirection = refilled.direction;
      }
    }

    const sheet = mergePlacements(W, H, placements);
    const meta = { kind:'constructive', primaryAxis:seedAxis, residualDirection, seedBands };
    const sc = scoreSheet(sheet, kerf, meta);
    // Nie wywalamy słabego pasa — wybór najlepszego robi się później, żeby optional nie wpadał od razu w fallback.
    return { sheet, meta, sc, firstBandFill:(band1.fillRatio||0), accepted: (band1.fillRatio||0) >= threshold1 };
  }

  function generateSeedPlans(items, boardW, boardH, kerf, opts){
    const W = boardW, H = boardH;
    const out = [];
    const seeds = topSeedItems(items, opts.seedLimit || 18);
    for(const seed of seeds){
      for(const axis of ['v','h']){
        const guides = guideDimsFromItem(seed, axis)
          .filter(g=> (axis === 'v' ? g.guide <= W && g.cross <= H : g.guide <= H && g.cross <= W))
          .sort((a,b)=> areaOf({ w:b.orient.w, h:b.orient.h }) - areaOf({ w:a.orient.w, h:a.orient.h }));
        for(const g of guides.slice(0,2)){
          const familyGuides = [g.guide];
          // poszukaj drugiego podobnego prowadzącego wymiaru z pozostałych dużych elementów
          for(const other of seeds){
            if(other.id === seed.id) continue;
            for(const og of guideDimsFromItem(other, axis)){
              if(Math.abs(og.guide - g.guide) <= Math.max(75, opts.clusterTolerance || 75) && familyGuides.length < 3){
                familyGuides.push(og.guide);
              }
            }
            if(familyGuides.length >= 3) break;
          }
          out.push({ seed, axis, guideA:g.guide, guideB:familyGuides[1] || null });
        }
      }
    }
    return out;
  }

  function buildFallback(items, boardW, boardH, kerf){
    if(!strip || typeof strip.packStripBands !== 'function') return null;
    const along = strip.packStripBands(items, boardW, boardH, kerf, 'along') || [];
    const across = strip.packStripBands(items, boardW, boardH, kerf, 'across') || [];
    const cands = [];
    if(along[0]) cands.push({ sheet:along[0], meta:{ kind:'fallback', primaryAxis:'v', seedBands:[], residualDirection:'along' }, sc: scoreSheet(along[0], kerf, { primaryAxis:'v', seedBands:[] }) });
    if(across[0]) cands.push({ sheet:across[0], meta:{ kind:'fallback', primaryAxis:'h', seedBands:[], residualDirection:'across' }, sc: scoreSheet(across[0], kerf, { primaryAxis:'h', seedBands:[] }) });
    cands.sort((a,b)=> b.sc.score - a.sc.score);
    return cands[0] || null;
  }

  function chooseBestConstructive(items, boardW, boardH, kerf, opts){
    const plans = generateSeedPlans(items, boardW, boardH, kerf, opts);
    let bestAccepted = null;
    let bestAny = null;
    for(const plan of plans){
      const built = buildConstructiveSheet(items, boardW, boardH, kerf, plan.seed, plan.axis, plan.guideA, plan.guideB, opts);
      if(!built || !usedIds(built.sheet).size) continue;
      if(!bestAny || built.sc.score > bestAny.sc.score) bestAny = built;
      if(built.accepted && (!bestAccepted || built.sc.score > bestAccepted.sc.score)) bestAccepted = built;
    }
    if(bestAccepted) return bestAccepted;
    if(bestAny) return bestAny;
    return buildFallback(items, boardW, boardH, kerf);
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
    const seen = new Set();
    const pool = [];
    for(const s of [prev, last]){
      for(const p of ((s && s.placements) || []).filter(x=>x && !x.unplaced)){
        if(seen.has(p.id)) continue;
        seen.add(p.id);
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
    let rem = pool.slice();
    const rebuilt = [];
    for(let i=0;i<2;i++){
      if(!rem.length){ rebuilt.push({ boardW:last.boardW, boardH:last.boardH, placements:[] }); continue; }
      const best = chooseBestConstructive(rem, last.boardW, last.boardH, kerf, opts);
      if(!best) break;
      rebuilt.push(best.sheet);
      rem = removeByIds(rem, usedIds(best.sheet));
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
    const seen = new Set();
    for(const p of ((last && last.placements) || []).filter(x=>x && !x.unplaced)){
      if(seen.has(p.id)) continue;
      seen.add(p.id);
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
    const rebuilt = chooseBestConstructive(pool, last.boardW, last.boardH, kerf, opts);
    if(!rebuilt) return sheets;
    const oldSc = scoreSheet(last, kerf, { kind:'old-last', primaryAxis:'v', seedBands:[] });
    if(rebuilt.sc.score > oldSc.score || rebuilt.sc.disposalArea < oldSc.disposalArea){
      out[out.length - 1] = rebuilt.sheet;
    }
    return out;
  }

  function packOptionalBySheet(itemsIn, boardW, boardH, kerf, opts){
    const W = clampInt(boardW, 2800);
    const H = clampInt(boardH, 2070);
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const settings = Object.assign({
      clusterTolerance: 75,
      familyMinRatio: 0.74,
      minBandFill: 0.80,
      secondBandFill: 0.90,
      seedLimit: 24,
      minOppositeResidualFill: 0.58,
      onProgress: null,
    }, opts || {});

    let remaining = (itemsIn || []).map(it=>Object.assign({}, it));
    const sheets = [];
    let builtSheets = 0;

    while(remaining.length){
      if(typeof settings.onProgress === 'function'){
        try{ settings.onProgress({ step:'sheet', builtSheets }); }catch(_){ }
      }
      const best = chooseBestConstructive(remaining, W, H, K, settings);
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

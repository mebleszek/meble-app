/* optional-solver.js — tryb „Opcjonalnie” przepisany od nowa
   Cel:
   - nie dotykać solverów pasowych w strip-solver.js,
   - budować arkusz konstrukcyjnie: 1–2 pasy startowe -> zmiana kierunku -> dogęszczenie,
   - częściej grupować podobne szerokości / wysokości,
   - minimalizować śmieciowy odpad i mikro-ogonki,
   - preferować 1–2 mocne pasy startowe i poprawiać słabe pasy małą, podobną grupą.
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
  function avg(nums){
    if(!nums || !nums.length) return 0;
    return nums.reduce((s,n)=>s + (Number(n)||0), 0) / nums.length;
  }
  function uniqueNumbers(arr){
    const seen = new Set();
    const out = [];
    for(const v of (arr || [])){
      const n = Math.round(Number(v) || 0);
      if(n <= 0 || seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    return out;
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
    score += occ * 1600000;
    score -= (sm.disposalArea / area) * 520000;
    score -= sm.disposalCount * 60000;
    score -= sm.longThinCount * 40000;
    score += (sm.reusableArea / area) * 20000;
    score += fam.dominantCount * 8000;
    score -= fam.singletons * 20000;
    if(meta && Array.isArray(meta.seedBands)){
      for(const b of meta.seedBands){
        score += (b.fillRatio || 0) * 200000;
        if((b.fillRatio || 0) >= 0.90) score += 80000;
        else if((b.fillRatio || 0) >= 0.80) score += 30000;
        else score -= 90000;
      }
    }
    if(meta && Array.isArray(meta.residualBands)){
      for(const b of meta.residualBands){
        score += (b.fillRatio || 0) * 50000;
        if((b.fillRatio || 0) < 0.80) score -= 35000;
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
    const targetCross = Number(opts && opts.targetCross) || 0;
    const targetCrossTol = Math.max(20, Math.round(Number((opts && opts.targetCrossTolerance) || 75)));
    const requirePreferred = !!(opts && opts.requirePreferredItem && preferredItemId);
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
        if(primary < lower || primary > upper) continue;
        const gap = Math.abs(primary - guideDim);
        const prefer = (preferredItemId && it.id === preferredItemId) ? 140000 : 0;
        const familyBonus = Math.max(0, tol - gap) * 1200;
        const wideBonus = (opts && opts.preferWideBand) ? primary * 900 : 0;
        const crossGap = targetCross ? Math.abs(cross - targetCross) : 0;
        const crossBonus = targetCross ? Math.max(0, targetCrossTol - crossGap) * 900 : 0;
        const crossPenalty = targetCross ? crossGap * 180 : 0;
        const score = (o.w * o.h) * 1000 + familyBonus + prefer + wideBonus + crossBonus - crossPenalty - gap * 1200 - cross * 25;
        variants.push({ orient:o, primary, cross, score });
      }
      if(!variants.length) continue;
      variants.sort((a,b)=> b.score - a.score);
      candidates.push({ item:it, variants });
    }
    if(!candidates.length) return null;

    const cap = Math.max(0, Math.round(limitCross));
    const dp = new Array(cap + 1).fill(null);
    dp[0] = { score:0, area:0, count:0, prev:-1, choice:null, used:new Set(), hasPreferred:false };
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
          const hasPreferred = st.hasPreferred || (preferredItemId && candidates[i].item.id === preferredItemId);
          const localScore = st.score + v.score - tailPenalty + 5000 + (hasPreferred ? 2000 : 0);
          const prevBest = next[nu];
          if(!prevBest || localScore > prevBest.score){
            next[nu] = {
              score: localScore,
              area: st.area + (v.orient.w * v.orient.h),
              count: st.count + 1,
              prev: used,
              choice: { idx:i, orient:v.orient, primary:v.primary, cross:v.cross },
              used: usedSet,
              hasPreferred,
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
      if(requirePreferred && !st.hasPreferred) continue;
      let bandPrimary = 0;
      let cur = st;
      while(cur && cur.choice){
        bandPrimary = Math.max(bandPrimary, cur.choice.primary);
        cur = dp[cur.prev];
      }
      if(bandPrimary <= 0) continue;
      const fillRatio = st.area / Math.max(1, bandPrimary * cap);
      const wideBandScore = (opts && opts.preferWideBand) ? bandPrimary * 500 : 0;
      const preferredScore = st.hasPreferred ? 35000 : 0;
      const score = st.score + fillRatio * 240000 + st.count * 8000 + wideBandScore + preferredScore - Math.abs(bandPrimary - guideDim) * 400;
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
    if(requirePreferred && !picked.some(p=>p.item && p.item.id === preferredItemId)) return null;

    picked.sort((a,b)=>{
      const ap = (preferredItemId && a.item.id === preferredItemId) ? 1 : 0;
      const bp = (preferredItemId && b.item.id === preferredItemId) ? 1 : 0;
      if(bp !== ap) return bp - ap;
      if(b.primary !== a.primary) return b.primary - a.primary;
      if(b.cross !== a.cross) return b.cross - a.cross;
      return (b.orient.w * b.orient.h) - (a.orient.w * a.orient.h);
    });

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

    const firstEntry = picked[0] || null;
    return {
      axis,
      guideDim,
      bandPrimary: best.bandPrimary,
      fillRatio: best.fillRatio,
      wasteRatio: Math.max(0, 1 - best.fillRatio),
      placements,
      ids: new Set(picked.map(p=>p.item.id)),
      usedArea: picked.reduce((s,p)=> s + p.orient.w * p.orient.h, 0),
      picked,
      firstEntry,
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
      .slice(0, 12);
  }

  function fixedPoolItemFromPicked(entry){
    return {
      id: entry.item.id,
      key: entry.item.key,
      name: entry.item.name,
      w: Number(entry.orient.w) || 0,
      h: Number(entry.orient.h) || 0,
      rotationAllowed: false,
      edgeW1: entry.orient.edgeW1,
      edgeW2: entry.orient.edgeW2,
      edgeH1: entry.orient.edgeH1,
      edgeH2: entry.orient.edgeH2,
    };
  }

  function repairWeakBand(originalBand, items, axis, limitPrimary, limitCross, kerf, opts){
    if(!originalBand || !originalBand.firstEntry) return originalBand;
    if((originalBand.wasteRatio || 0) <= 0.20) return originalBand;
    const anchor = originalBand.firstEntry;
    const smallThreshold = Math.max(1, (Number(anchor.cross) || 0) * 0.50);
    const smallPicked = (originalBand.picked || []).filter((e, idx)=> idx > 0 && (Number(e.cross) || 0) <= smallThreshold);
    if(!smallPicked.length) return originalBand;

    const kept = (originalBand.picked || []).filter((e, idx)=> idx === 0 || (Number(e.cross) || 0) > smallThreshold);
    const used = new Set((originalBand.picked || []).map(e=>e.item.id));
    const targetCross = avg(smallPicked.map(e=>e.cross));
    const tolPrimary = Math.max(20, Math.round(Number((opts && opts.clusterTolerance) || 75)));
    const tolCross = Math.max(20, Math.round(Number((opts && opts.smallGroupTolerance) || 75)));

    const external = [];
    for(const it of (items || [])){
      if(used.has(it.id)) continue;
      let canUse = false;
      for(const o of itemOrientations(it)){
        const primary = axis === 'v' ? o.w : o.h;
        const cross = axis === 'v' ? o.h : o.w;
        if(primary <= 0 || cross <= 0) continue;
        if(primary > limitPrimary || cross > limitCross) continue;
        if(Math.abs(primary - (originalBand.guideDim || 0)) > tolPrimary) continue;
        if(Math.abs(cross - targetCross) > tolCross) continue;
        if(cross > (Number(anchor.cross) || 0) * 0.85) continue;
        canUse = true;
        break;
      }
      if(canUse) external.push(it);
    }
    if(external.length < 2) return originalBand;

    const pool = kept.map(fixedPoolItemFromPicked).concat(external);
    const repaired = buildClusterBand(pool, axis, limitPrimary, limitCross, kerf, originalBand.guideDim, anchor.item.id, Object.assign({}, opts, {
      preferWideBand: true,
      requirePreferredItem: true,
      targetCross,
      targetCrossTolerance: tolCross,
    }));
    if(!repaired) return originalBand;
    if((repaired.fillRatio || 0) >= (originalBand.fillRatio || 0) + 0.015) return repaired;
    if((repaired.fillRatio || 0) >= (originalBand.fillRatio || 0) - 0.005 && (repaired.picked || []).length > (originalBand.picked || []).length + 1) return repaired;
    return originalBand;
  }

  function bandBeats(a, b){
    if(!a) return true;
    const af = Number(a && a.fillRatio) || 0;
    const bf = Number(b && b.fillRatio) || 0;
    if(bf > af + 0.0001) return true;
    if(Math.abs(bf - af) <= 0.0001){
      return (Number(b && b.usedArea) || 0) > (Number(a && a.usedArea) || 0);
    }
    return false;
  }

  function tryAlternativeBand(items, axis, limitPrimary, limitCross, kerf, guideDim, seedItemId, currentBest, opts){
    const guides = familyGuidesFromRemaining(items, axis, limitPrimary, limitCross, opts);
    const allGuides = uniqueNumbers([guideDim].concat(guides));
    let best = currentBest || null;
    const seedItem = (items || []).find(it => seedItemId && it.id === seedItemId) || null;

    if(seedItem){
      for(const dim of guideDimsFromItem(seedItem, axis)){
        const alt = buildClusterBand(items, axis, limitPrimary, limitCross, kerf, dim.guide, seedItemId, Object.assign({}, opts, { preferWideBand:true, requirePreferredItem:true }));
        if(alt && bandBeats(best, alt)) best = alt;
        if(best && (best.fillRatio || 0) >= Number((opts && opts.minBandFill) || 0.80)) return best;
      }
    }

    for(const guide of allGuides){
      const band = buildClusterBand(items, axis, limitPrimary, limitCross, kerf, guide, seedItemId, Object.assign({}, opts, { preferWideBand:true, requirePreferredItem: !!seedItemId }));
      if(!band) continue;
      if(bandBeats(best, band)) best = band;
      if(best && (best.fillRatio || 0) >= Number((opts && opts.minBandFill) || 0.80)) return best;
    }
    return best;
  }

  function packBandsInAxis(items, rect, kerf, axis, opts){
    const K = Math.max(0, Math.round(Number(kerf)||0));
    let remaining = (items || []).slice();
    const placements = [];
    let residual = { x:0, y:0, w:Number(rect.w)||0, h:Number(rect.h)||0 };
    const ids = new Set();
    const bands = [];
    let bandsMade = 0;

    while(remaining.length && residual.w > 60 && residual.h > 60){
      const limitPrimary = axis === 'v' ? residual.w : residual.h;
      const limitCross = axis === 'v' ? residual.h : residual.w;
      const guides = familyGuidesFromRemaining(remaining, axis, limitPrimary, limitCross, opts);
      if(!guides.length) break;

      let bestBand = null;
      for(const guide of guides){
        let band = buildClusterBand(remaining, axis, limitPrimary, limitCross, K, guide, null, Object.assign({}, opts, { preferWideBand: true }));
        if(!band || !band.ids || !band.ids.size) continue;
        if((band.wasteRatio || 0) > 0.20){
          band = repairWeakBand(band, remaining, axis, limitPrimary, limitCross, K, opts);
        }
        const score = (band.fillRatio || 0) * 100000 + (band.usedArea || 0) + (band.bandPrimary || 0) * 200 - (band.wasteRatio || 0) * 40000;
        if(!bestBand || score > bestBand._score){
          bestBand = Object.assign({ _score: score }, band);
        }
      }
      if(!bestBand) break;

      if((bestBand.fillRatio || 0) < Number((opts && opts.minBandFill) || 0.80)){
        const improved = tryAlternativeBand(remaining, axis, limitPrimary, limitCross, K, bestBand.guideDim, bestBand.firstEntry && bestBand.firstEntry.item && bestBand.firstEntry.item.id, bestBand, opts);
        if(improved) bestBand = Object.assign({}, improved, { _score: bestBand._score });
      }

      if((bestBand.fillRatio || 0) < 0.35 && bandsMade > 0) break;
      if(!bestBand.ids || !bestBand.ids.size) break;

      const shifted = bestBand.placements.map(p=>Object.assign({}, p, { x:(p.x||0)+residual.x, y:(p.y||0)+residual.y }));
      placements.push(...shifted);
      bands.push({
        direction: axis === 'v' ? 'along' : 'across',
        fillRatio: bestBand.fillRatio || 0,
        wasteRatio: bestBand.wasteRatio || 0,
        bandPrimary: bestBand.bandPrimary || 0,
        guideDim: bestBand.guideDim || 0,
      });
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
      bands,
    };
  }

  function residualFillCandidate(remaining, rect, kerf, primaryAxis, opts){
    if(!remaining.length) return null;
    const preferredDirection = primaryAxis === 'v' ? 'across' : 'along';
    const candidates = [];

    for(const axis of ['v','h']){
      const dir = axis === 'v' ? 'along' : 'across';
      try{
        const direct = packBandsInAxis(remaining, rect, kerf, axis, opts);
        if(direct && direct.sheet){
          const sc = scoreSheet(direct.sheet, kerf, { primaryAxis: axis, seedBands: [], residualBands: direct.bands || [] });
          candidates.push({ direction: dir, sheet: direct.sheet, ids: direct.ids || new Set(), bands: direct.bands || [], sc, occ: sc.occupancy || 0, via: 'constructive' });
        }
      }catch(_){ }

      if(strip && typeof strip.packStripBands === 'function'){
        try{
          const sheets = strip.packStripBands(remaining, rect.w, rect.h, kerf, dir) || [];
          if(sheets && sheets[0]){
            const sc = scoreSheet(sheets[0], kerf, { primaryAxis: axis, seedBands: [] });
            candidates.push({ direction: dir, sheet: sheets[0], ids: usedIds(sheets[0]), bands: [], sc, occ: sc.occupancy || 0, via: 'strip' });
          }
        }catch(_){ }
      }
    }

    if(!candidates.length) return null;
    candidates.sort((a,b)=>{
      const as = (Number(a.sc && a.sc.score) || 0) + (a.direction === preferredDirection ? 20000 : 0) + ((a.occ || 0) * 20000);
      const bs = (Number(b.sc && b.sc.score) || 0) + (b.direction === preferredDirection ? 20000 : 0) + ((b.occ || 0) * 20000);
      return bs - as;
    });
    return candidates[0];
  }

  function buildConstructiveSheet(items, boardW, boardH, kerf, seedItem, seedAxis, guideA, guideB, opts){
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const W = boardW, H = boardH;
    const placements = [];
    const seedBands = [];
    let remaining = (items || []).slice();
    let residual = { x:0, y:0, w:W, h:H };
    const seedItemId = seedItem && seedItem.id ? seedItem.id : null;

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

    let band1 = buildClusterBand(remaining, seedAxis, seedAxis === 'v' ? residual.w : residual.h, seedAxis === 'v' ? residual.h : residual.w, kerf, guideA, seedItemId, Object.assign({}, opts, { preferWideBand:true, requirePreferredItem: !!seedItemId }));
    if(!band1) return null;
    if((band1.wasteRatio || 0) > 0.20){
      band1 = repairWeakBand(band1, remaining, seedAxis, seedAxis === 'v' ? residual.w : residual.h, seedAxis === 'v' ? residual.h : residual.w, kerf, opts);
    }
    if((band1.fillRatio || 0) < threshold1){
      const improved = tryAlternativeBand(remaining, seedAxis, seedAxis === 'v' ? residual.w : residual.h, seedAxis === 'v' ? residual.h : residual.w, kerf, guideA, seedItemId, band1, opts);
      if(improved) band1 = improved;
    }
    if(!band1) return null;
    applyBand(band1);

    if((band1.fillRatio || 0) >= threshold2 && guideB && residual.w > 120 && residual.h > 120){
      let band2 = buildClusterBand(remaining, seedAxis, seedAxis === 'v' ? residual.w : residual.h, seedAxis === 'v' ? residual.h : residual.w, kerf, guideB, null, Object.assign({}, opts, { preferWideBand:true }));
      if(band2 && (band2.wasteRatio || 0) > 0.20){
        band2 = repairWeakBand(band2, remaining, seedAxis, seedAxis === 'v' ? residual.w : residual.h, seedAxis === 'v' ? residual.h : residual.w, kerf, opts);
      }
      if(band2 && (band2.fillRatio || 0) >= threshold2){
        applyBand(band2);
      }
    }

    let residualDirection = 'none';
    let residualBands = [];
    if(residual.w > 100 && residual.h > 100 && remaining.length){
      const refilled = residualFillCandidate(remaining, residual, kerf, seedAxis, opts);
      if(refilled){
        const shifted = offsetSheet(refilled.sheet, residual.x, residual.y);
        placements.push(...(shifted.placements || []));
        remaining = removeByIds(remaining, refilled.ids && refilled.ids.size ? refilled.ids : usedIds(refilled.sheet));
        residualDirection = refilled.direction;
        residualBands = refilled.bands || [];
      }
    }

    const sheet = mergePlacements(W, H, placements);
    const meta = { kind:'constructive', primaryAxis:seedAxis, residualDirection, residualBands, seedBands, firstBandPrimary:(band1.bandPrimary||0) };
    const sc = scoreSheet(sheet, kerf, meta);
    return { sheet, meta, sc, firstBandFill:(band1.fillRatio||0), accepted: (band1.fillRatio||0) >= threshold1 };
  }

  function familyClusters(items, axis, limitPrimary, limitCross, opts){
    const tol = Math.max(20, Math.round(Number((opts && opts.clusterTolerance) || 75)));
    const step = Math.max(10, Math.round(tol / 2));
    const buckets = new Map();
    for(const it of (items || [])){
      for(const o of itemOrientations(it)){
        const primary = axis === 'v' ? o.w : o.h;
        const cross = axis === 'v' ? o.h : o.w;
        if(primary <= 0 || cross <= 0) continue;
        if(primary > limitPrimary || cross > limitCross) continue;
        const key = widthBucket(primary, step);
        const prev = buckets.get(key) || { guide:key, count:0, area:0, maxPrimary:0, maxArea:0 };
        prev.count += 1;
        prev.area += primary * cross;
        prev.maxPrimary = Math.max(prev.maxPrimary, primary);
        prev.maxArea = Math.max(prev.maxArea, primary * cross);
        buckets.set(key, prev);
      }
    }
    return Array.from(buckets.values())
      .sort((a,b)=> (b.maxPrimary-a.maxPrimary) || (b.area-a.area) || (b.count-a.count) || (b.guide-a.guide));
  }

  function generateSeedPlans(items, boardW, boardH, kerf, opts){
    const W = boardW, H = boardH;
    const out = [];
    const maxAttempts = Math.max(1, Math.round(Number((opts && opts.maxAttempts) || 150)));
    const seedLimit = Math.max(8, Math.round(Number((opts && opts.seedLimit) || 24)));
    const tol = Math.max(20, Math.round(Number((opts && opts.clusterTolerance) || 75)));
    const seeds = topSeedItems(items, seedLimit);

    for(const axis of ['v','h']){
      const limitPrimary = axis === 'v' ? W : H;
      const limitCross = axis === 'v' ? H : W;
      const fams = familyClusters(items, axis, limitPrimary, limitCross, opts).slice(0, 8);
      const famGuides = fams.map(f=>f.guide);
      for(let idx=0; idx<seeds.length; idx++){
        const seed = seeds[idx];
        const dims = guideDimsFromItem(seed, axis)
          .filter(d=>d.guide <= limitPrimary && d.cross <= limitCross)
          .sort((a,b)=> (b.guide-a.guide) || (b.cross-a.cross));
        for(let d=0; d<dims.length; d++){
          const dim = dims[d];
          const related = uniqueNumbers([dim.guide].concat(famGuides.filter(g=>Math.abs(g - dim.guide) <= tol * 1.25))).slice(0, 4);
          out.push({
            axis,
            guideA: dim.guide,
            guideB: related[1] || null,
            seedItemId: seed.id,
            seedWideScore: (dim.guide * 3000) + areaOf(seed) + (d === 0 ? 50000 : 25000),
            seedOrder: idx,
            rotationRank: d,
          });
          for(let k=1; k<Math.min(related.length, 3); k++){
            out.push({
              axis,
              guideA: dim.guide,
              guideB: related[k],
              seedItemId: seed.id,
              seedWideScore: (Math.max(dim.guide, related[k]) * 3400) + areaOf(seed) + (d === 0 ? 50000 : 25000) + k * 5000,
              seedOrder: idx,
              rotationRank: d,
            });
          }
        }
      }

      for(const fam of fams.slice(0, Math.min(6, fams.length))){
        out.push({ axis, guideA:fam.guide, guideB:null, seedItemId:null, seedWideScore:fam.guide * 1400 + fam.area, seedOrder:9999, rotationRank:0 });
      }
    }

    return out
      .sort((a,b)=> (a.seedOrder-b.seedOrder) || (a.rotationRank-b.rotationRank) || (b.seedWideScore-a.seedWideScore) || ((b.guideA||0)-(a.guideA||0)))
      .slice(0, maxAttempts * 2);
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
    const maxAttempts = Math.max(1, Math.round(Number((opts && opts.maxAttempts) || 150)));
    let bestStrong = null;
    let bestAccepted = null;
    let bestAny = null;
    let tries = 0;
    function better(a, b){
      if(!a) return true;
      const ao = Number(a.sc && a.sc.occupancy) || 0;
      const bo = Number(b.sc && b.sc.occupancy) || 0;
      if(Math.abs(bo - ao) > 0.015) return bo > ao;
      const af = Number(a.meta && a.meta.firstBandPrimary) || 0;
      const bf = Number(b.meta && b.meta.firstBandPrimary) || 0;
      if(Math.abs(bf - af) > 20) return bf > af;
      const ad = Number(a.sc && a.sc.disposalArea) || 0;
      const bd = Number(b.sc && b.sc.disposalArea) || 0;
      if(Math.abs(ad - bd) > 5000) return bd < ad;
      return (Number(b.sc && b.sc.score) || 0) > (Number(a.sc && a.sc.score) || 0);
    }
    for(const plan of plans){
      if(tries >= maxAttempts) break;
      const seedItem = plan.seedItemId ? ((items || []).find(it=>it.id === plan.seedItemId) || null) : null;
      const built = buildConstructiveSheet(items, boardW, boardH, kerf, seedItem, plan.axis, plan.guideA, plan.guideB, opts);
      tries += 1;
      if(typeof opts.onProgress === 'function'){
        try{ opts.onProgress({ step:'attempt', currentAttempt:tries, maxAttempts }); }catch(_){ }
      }
      if(!built || !usedIds(built.sheet).size) continue;
      built.sc.score += (plan.seedWideScore || 0) * 0.01;
      if(better(bestAny, built)) bestAny = built;
      if(built.accepted && better(bestAccepted, built)) bestAccepted = built;
      if(built.accepted && (Number(built.sc && built.sc.occupancy) || 0) >= 0.80 && better(bestStrong, built)) bestStrong = built;
    }
    if(bestStrong) return bestStrong;
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
    if((newSc.occupancy >= oldSc.occupancy + 0.01) || (newSc.disposalArea + 10000 < oldSc.disposalArea && newSc.occupancy >= oldSc.occupancy - 0.01)){
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
    if(((Number(rebuilt.sc && rebuilt.sc.occupancy)||0) >= (Number(oldSc && oldSc.occupancy)||0) + 0.01) || ((Number(rebuilt.sc && rebuilt.sc.disposalArea)||0) + 5000 < (Number(oldSc && oldSc.disposalArea)||0) && (Number(rebuilt.sc && rebuilt.sc.occupancy)||0) >= (Number(oldSc && oldSc.occupancy)||0) - 0.01)){
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
      seedWideRatio: 0.65,
      seedLimit: 24,
      minOppositeResidualFill: 0.66,
      smallGroupTolerance: 75,
      onProgress: null,
      maxAttempts: 150,
      targetSheetOccupancy: 0.80,
    }, opts || {});

    let remaining = (itemsIn || []).map(it=>Object.assign({}, it));
    const sheets = [];
    let builtSheets = 0;

    while(remaining.length){
      if(typeof settings.onProgress === 'function'){
        try{ settings.onProgress({ step:'sheet', builtSheets, currentAttempt:0, maxAttempts:settings.maxAttempts }); }catch(_){ }
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

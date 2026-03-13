/* optima-core.js — wspólny silnik pasowy dla trybów Optimax
   Zasady:
   - każdy arkusz startuje 1 lub 2 pasami w jednym kierunku,
   - po starcie kierunek MUSI się zmienić,
   - brak późniejszego "porządkowania końcówki" po policzeniu,
   - tryby along / across / optima różnią się tylko wyborem kierunku startowego.
*/
(function(root){
  'use strict';

  root.FC = root.FC || {};

  function now(){
    return (root.performance && typeof root.performance.now === 'function') ? root.performance.now() : Date.now();
  }

  function clampInt(v, fallback){
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function areaOf(it){
    return Math.max(0, Number(it && it.w) || 0) * Math.max(0, Number(it && it.h) || 0);
  }

  function cloneItem(it){
    return Object.assign({}, it);
  }

  function widthBucket(n){
    return Math.max(0, Math.round((Number(n) || 0) / 75) * 75);
  }

  function isSmallCandidate(c){
    const w = Number(c && c.w) || 0;
    const h = Number(c && c.h) || 0;
    return Math.min(w, h) <= 220 || (w * h) <= 120000;
  }

  function getProfileConfig(profile){
    const key = String(profile || 'D').toUpperCase();
    const map = {
      A: { perSheetMs: 5000,  seedLimit: 8,  rowSeedLimit: 5 },
      B: { perSheetMs: 12000, seedLimit: 12, rowSeedLimit: 7 },
      C: { perSheetMs: 20000, seedLimit: 18, rowSeedLimit: 10 },
      D: { perSheetMs: 30000, seedLimit: 24, rowSeedLimit: 14 },
    };
    return map[key] || map.D;
  }

  function normalizeMode(mode, options){
    const raw = String(mode || (options && options.solverMode) || (options && options.cutMode) || '').toLowerCase();
    if(raw === 'across') return 'across';
    if(raw === 'along') return 'along';
    return 'optima';
  }

  function orientationCandidates(it, BW, BH, swap){
    const out = [];
    const add = (w0, h0, rotated)=>{
      const w = swap ? h0 : w0;
      const h = swap ? w0 : h0;
      if(w <= BW && h <= BH) out.push({ w, h, rotated: !!rotated, srcW: w0, srcH: h0 });
    };
    add(it.w, it.h, false);
    if(it.rotationAllowed && it.w !== it.h) add(it.h, it.w, true);
    return out;
  }

  function supportMaps(rem, BW, BH, swap){
    const byH = new Map();
    const byW = new Map();
    for(const it of rem){
      const seen = new Set();
      for(const c of orientationCandidates(it, BW, BH, swap)){
        const hk = widthBucket(c.h);
        const wk = widthBucket(c.w);
        if(!seen.has('h:' + hk)){
          byH.set(hk, (byH.get(hk) || 0) + 1);
          seen.add('h:' + hk);
        }
        if(!seen.has('w:' + wk)){
          byW.set(wk, (byW.get(wk) || 0) + 1);
          seen.add('w:' + wk);
        }
      }
    }
    return { byH, byW };
  }

  function buildSeedCandidates(rem, BW, BH, swap, limit){
    const sup = supportMaps(rem, BW, BH, swap);
    const out = [];
    for(let idx=0; idx<rem.length; idx++){
      const it = rem[idx];
      for(const c of orientationCandidates(it, BW, BH, swap)){
        const area = c.w * c.h;
        const hBucket = widthBucket(c.h);
        const wBucket = widthBucket(c.w);
        const supportH = sup.byH.get(hBucket) || 0;
        const supportW = sup.byW.get(wBucket) || 0;
        const score = area * 3
          + c.w * 120
          + c.h * 80
          + supportH * 90000
          + supportW * 25000;
        out.push({ idx, it, cand: c, rowH: c.h, score, hBucket, wBucket });
      }
    }
    out.sort((a,b)=> b.score - a.score);
    const dedup = [];
    const seen = new Set();
    const bucketCap = new Map();
    for(const s of out){
      const key = String(s.it.id) + ':' + (s.cand.rotated ? 'r' : 'n');
      if(seen.has(key)) continue;
      const bucketKey = s.hBucket;
      const usedInBucket = bucketCap.get(bucketKey) || 0;
      if(usedInBucket >= 4) continue;
      seen.add(key);
      bucketCap.set(bucketKey, usedInBucket + 1);
      dedup.push(s);
      if(dedup.length >= limit) break;
    }
    return dedup;
  }

  function pickRowOptions(it, BW, rowH, swap, preferredBucket, mode){
    const out = [];
    for(const c of orientationCandidates(it, BW, rowH, swap)){
      if(c.h > rowH) continue;
      const bucket = widthBucket(c.w);
      if(mode && mode.similarBucket != null && Math.abs(bucket - mode.similarBucket) > 75) continue;
      if(mode && mode.smallOnly && !isSmallCandidate(c)) continue;
      const gap = rowH - c.h;
      const exact = gap === 0;
      let score = (c.w * c.h) * 1000 + (exact ? 80000 : 0) - gap * c.w * 7;
      if(preferredBucket != null){
        const diff = Math.abs(bucket - preferredBucket);
        if(diff === 0) score += 90000;
        else if(diff <= 75) score += 50000;
        else score -= diff * 400;
      }
      if(mode && mode.preferSmalls && isSmallCandidate(c)) score += 35000;
      if(mode && mode.preferWide) score += c.w * 30;
      out.push({ cand: c, score, bucket });
    }
    out.sort((a,b)=> b.score - a.score);
    return out.slice(0, 3);
  }

  function reconstructRow(dp, endUsed, rem, forced){
    const chosen = [];
    let cursor = endUsed;
    while(cursor > 0){
      const st = dp[cursor];
      if(!st || st.idx == null || st.idx < 0 || !st.cand) break;
      chosen.push({ idx: st.idx, it: rem[st.idx], cand: st.cand, bucket: widthBucket(st.cand.w) });
      cursor = st.prev;
    }
    chosen.reverse();
    if(forced && forced.it && forced.cand){
      chosen.unshift({ idx: forced.idx, it: forced.it, cand: forced.cand, bucket: widthBucket(forced.cand.w), forced:true });
    }
    return chosen;
  }

  function sortRowItems(items, swap){
    const arr = items.slice();
    arr.sort((a,b)=>{
      const primaryA = swap ? a.cand.h : a.cand.w;
      const primaryB = swap ? b.cand.h : b.cand.w;
      if(primaryB !== primaryA) return primaryB - primaryA;
      return (b.cand.w * b.cand.h) - (a.cand.w * a.cand.h);
    });
    return arr;
  }

  function buildRow(rem, BW, K, rowH, forced, preferredBucket, mode){
    if(rowH <= 0 || BW <= 0) return null;
    const maxW = BW;
    const dp = new Array(maxW + 1).fill(null);
    let startUsed = 0;
    let startArea = 0;
    let startCount = 0;
    if(forced && forced.cand){
      if(forced.cand.w > BW || forced.cand.h > rowH) return null;
      startUsed = forced.cand.w;
      startArea = forced.cand.w * forced.cand.h;
      startCount = 1;
    }
    dp[startUsed] = { score: startArea * 1000, area: startArea, count: startCount, prev: -1, idx: -1, cand: null };

    for(let idx=0; idx<rem.length; idx++){
      const it = rem[idx];
      if(forced && String(it.id) === String(forced.it.id)) continue;
      const options = pickRowOptions(it, BW, rowH, !!(mode && mode.swap), preferredBucket, mode);
      if(!options.length) continue;
      const next = dp.slice();
      for(let used=0; used<=maxW; used++){
        const st = dp[used];
        if(!st) continue;
        for(const opt of options){
          const extraW = (st.count > 0 ? K : 0) + opt.cand.w;
          const nu = used + extraW;
          if(nu > maxW) continue;
          const tail = maxW - nu;
          const localScore = st.score + opt.score - (tail > 100 ? tail * 25 : 0);
          const prev = next[nu];
          if(!prev || localScore > prev.score){
            next[nu] = {
              score: localScore,
              area: st.area + opt.cand.w * opt.cand.h,
              count: st.count + 1,
              prev: used,
              idx,
              cand: opt.cand,
            };
          }
        }
      }
      for(let i=0;i<=maxW;i++) dp[i] = next[i];
    }

    let bestUsed = startUsed;
    let bestState = dp[startUsed];
    for(let used=startUsed; used<=maxW; used++){
      const st = dp[used];
      if(!st || st.count <= 0) continue;
      const tail = maxW - used;
      const occ = st.area / Math.max(1, maxW * rowH);
      const total = st.score
        + occ * 900000
        + (tail <= 100 ? 220000 : -tail * 500)
        + (occ >= 0.90 ? 180000 : 0)
        + (occ >= 0.80 ? 80000 : 0);
      const cur = bestState ? (
        bestState.score
        + (bestState.area / Math.max(1, maxW * rowH)) * 900000
        + ((maxW - bestUsed) <= 100 ? 220000 : -((maxW - bestUsed) * 500))
        + ((bestState.area / Math.max(1, maxW * rowH)) >= 0.90 ? 180000 : 0)
        + ((bestState.area / Math.max(1, maxW * rowH)) >= 0.80 ? 80000 : 0)
      ) : -1e18;
      if(!bestState || total > cur){
        bestState = st;
        bestUsed = used;
      }
    }
    if(!bestState || bestState.count <= 0) return null;

    const rawItems = reconstructRow(dp, bestUsed, rem, forced);
    const items = sortRowItems(rawItems, !!(mode && mode.swap));
    let usedArea = 0;
    let usedW = 0;
    let exactCount = 0;
    for(let i=0; i<items.length; i++){
      usedArea += items[i].cand.w * items[i].cand.h;
      usedW += items[i].cand.w + (i > 0 ? K : 0);
      if(items[i].cand.h === rowH) exactCount += 1;
    }
    const tail = Math.max(0, BW - usedW);
    const occupancy = usedArea / Math.max(1, BW * rowH);
    return {
      rowH,
      items,
      usedArea,
      usedW,
      tail,
      occupancy,
      exactRatio: items.length ? (exactCount / items.length) : 0,
      wasteRatio: 1 - occupancy,
      score: bestState.score,
    };
  }

  function chooseBestRow(rem, BW, availableH, K, swap, cfg, threshold, mode){
    const seedLimit = Math.max(3, Number(cfg && cfg.rowSeedLimit) || 6);
    const seeds = buildSeedCandidates(rem, BW, availableH, swap, seedLimit);
    let best = null;
    let bestAccepted = null;
    for(const seed of seeds){
      if(seed.rowH > availableH) continue;
      const preferredBucket = widthBucket(seed.cand.w);
      const row = buildRow(rem, BW, K, seed.rowH, seed, preferredBucket, Object.assign({ swap }, mode || {}));
      if(!row) continue;
      if(!best || row.score > best.score || (row.score === best.score && row.occupancy > best.occupancy)) best = row;
      if(row.occupancy >= threshold){
        if(!bestAccepted || row.score > bestAccepted.score || (row.score === bestAccepted.score && row.occupancy > bestAccepted.occupancy)) bestAccepted = row;
      }
    }
    return bestAccepted || best;
  }

  function removeSelected(rem, ids){
    const set = new Set((ids||[]).map(v=>String(v)));
    return rem.filter(it => !set.has(String(it.id)));
  }

  function pushUnique(rem, it){
    const key = String(it && it.id);
    for(const x of rem){ if(String(x && x.id) === key) return; }
    rem.push(cloneItem(it));
  }

  function buildSheetFreeRects(rows, BW, BH, K){
    const out = [];
    let cursorY = 0;
    for(const row of rows){
      if(!row || !Array.isArray(row.items) || !row.items.length) continue;
      let cursorX = 0;
      for(let i=0;i<row.items.length;i++){
        const p = row.items[i];
        if(row.rowH - p.cand.h - K > 40){
          out.push({ x: cursorX, y: cursorY + p.cand.h + K, w: p.cand.w, h: row.rowH - p.cand.h - K });
        }
        cursorX += p.cand.w + (i < row.items.length - 1 ? K : 0);
      }
      const tailX = cursorX + K;
      const tailW = BW - tailX;
      if(tailW > 40 && row.rowH > 40) out.push({ x: tailX, y: cursorY, w: tailW, h: row.rowH });
      cursorY += row.rowH + K;
    }
    const bottomH = BH - cursorY;
    if(bottomH > 40) out.push({ x:0, y:cursorY, w:BW, h:bottomH });
    return out.filter(r => r.w > 0 && r.h > 0);
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

  function swapRectBack(r){
    return { x: r.y, y: r.x, w: r.h, h: r.w };
  }

  function rowsCursorAfter(rows, K){
    let cursor = 0;
    for(const row of rows) cursor += row.rowH + K;
    return cursor;
  }

  function buildBlock(rows, rectW, rectH, K, swap, offsetX, offsetY, minScrapW, minScrapH){
    const BW = swap ? rectH : rectW;
    const BH = swap ? rectW : rectH;
    const placements = [];
    let usedArea = 0;
    let cursorY = 0;
    for(const row of rows){
      let cursorX = 0;
      for(const picked of row.items){
        const it = picked.it;
        const cand = picked.cand;
        usedArea += cand.w * cand.h;
        placements.push({
          id: it.id,
          key: it.key,
          name: it.name,
          x: cursorX,
          y: cursorY,
          w: cand.w,
          h: cand.h,
          rotated: !!cand.rotated,
          rotationAllowed: !!it.rotationAllowed,
          srcW: it.w,
          srcH: it.h,
          edgeW1: cand.rotated ? it.edgeH1 : it.edgeW1,
          edgeW2: cand.rotated ? it.edgeH2 : it.edgeW2,
          edgeH1: cand.rotated ? it.edgeW1 : it.edgeH1,
          edgeH2: cand.rotated ? it.edgeW2 : it.edgeH2,
        });
        cursorX += cand.w + K;
      }
      cursorY += row.rowH + K;
    }
    let freeRects = buildSheetFreeRects(rows, BW, BH, K);
    if(swap){
      placements.forEach(swapPlacementBack);
      freeRects = freeRects.map(swapRectBack);
    }
    placements.forEach(p=>{ p.x += offsetX; p.y += offsetY; });
    freeRects = freeRects
      .filter(r => r.w >= minScrapW && r.h >= minScrapH)
      .map(r => ({ x: r.x + offsetX, y: r.y + offsetY, w: r.w, h: r.h }));
    return { placements, freeRects, usedArea, cursorAfter: rowsCursorAfter(rows, K) };
  }

  function scoreRows(rows, BW, BH){
    let usedArea = 0;
    let weakRows = 0;
    let strongRows = 0;
    let occSum = 0;
    for(const row of rows){
      usedArea += row.usedArea || 0;
      occSum += row.occupancy || 0;
      if((row.occupancy || 0) >= 0.90) strongRows += 1;
      if((row.occupancy || 0) < 0.80) weakRows += 1;
    }
    const occ = usedArea / Math.max(1, BW * BH);
    const avgRowOcc = rows.length ? occSum / rows.length : 0;
    return usedArea
      + occ * 1200000
      + avgRowOcc * 300000
      + strongRows * 160000
      - weakRows * 220000
      - rows.length * 4000;
  }

  function repairRows(rows, rem, BW, K, swap){
    for(let ri=0; ri<rows.length; ri++){
      const row = rows[ri];
      if(!row || row.wasteRatio <= 0.20 || !row.items || row.items.length < 2) continue;
      const sortedByArea = row.items.slice().sort((a,b)=> (b.cand.w*b.cand.h) - (a.cand.w*a.cand.h));
      const largest = sortedByArea[0];
      if(!largest) continue;
      const removed = sortedByArea.filter(v => (v.cand.w * v.cand.h) <= (largest.cand.w * largest.cand.h) * 0.5);
      if(!removed.length) continue;
      const removedBuckets = removed.map(v => widthBucket(v.cand.w)).sort((a,b)=>a-b);
      const midBucket = removedBuckets[Math.floor(removedBuckets.length / 2)] || widthBucket(largest.cand.w);
      const pool = [];
      const poolSeen = new Set();
      const addPool = (it)=>{
        const key = String(it.id);
        if(poolSeen.has(key)) return;
        poolSeen.add(key);
        pool.push(cloneItem(it));
      };
      for(const picked of row.items) addPool(picked.it);
      for(const it of rem){
        for(const c of orientationCandidates(it, BW, row.rowH, swap)){
          if(!isSmallCandidate(c)) continue;
          if(Math.abs(widthBucket(c.w) - midBucket) <= 75){ addPool(it); break; }
        }
      }
      const forced = { idx: -1, it: largest.it, cand: largest.cand };
      const rebuilt = buildRow(pool, BW, K, row.rowH, forced, midBucket, { swap, smallOnly:false, preferSmalls:true, similarBucket: midBucket });
      if(!rebuilt || rebuilt.occupancy <= row.occupancy + 0.03) continue;

      const newIds = new Set(rebuilt.items.map(v => String(v.it.id)));
      for(const picked of row.items){
        const key = String(picked.it.id);
        if(!newIds.has(key)) pushUnique(rem, picked.it);
      }
      for(let i=rem.length-1; i>=0; i--){
        if(newIds.has(String(rem[i].id))) rem.splice(i, 1);
      }
      rows[ri] = rebuilt;
    }
  }

  function shouldKeepSecondBand(firstRow, secondRow, BW, BH){
    if(!firstRow || !secondRow) return false;
    if(firstRow.occupancy < 0.90 || secondRow.occupancy < 0.90) return false;
    const boardArea = Math.max(1, BW * BH);
    const secondAreaRatio = secondRow.usedArea / boardArea;
    const vsFirst = secondRow.usedArea / Math.max(1, firstRow.usedArea);
    return secondAreaRatio >= 0.14 || vsFirst >= 0.55;
  }

  function packRectRows(remSource, rectW, rectH, K, swap, cfg, threshold, minScrapW, minScrapH, isCancelled){
    const BW = swap ? rectH : rectW;
    const BH = swap ? rectW : rectH;
    let rem = remSource.map(cloneItem);
    const rows = [];
    let availableH = BH;
    while(rem.length && availableH > 40){
      if(isCancelled && isCancelled()) break;
      const row = chooseBestRow(rem, BW, availableH, K, swap, cfg, threshold, { preferWide:true });
      if(!row) break;
      rows.push(row);
      rem = removeSelected(rem, row.items.map(v => v.it.id));
      availableH -= (row.rowH + K);
      if(row.rowH <= 0) break;
    }
    if(rows.length) repairRows(rows, rem, BW, K, swap);
    const block = buildBlock(rows, rectW, rectH, K, swap, 0, 0, minScrapW, minScrapH);
    return { rows, rem, block, localBW: BW, localBH: BH };
  }

  function buildSheetVariant(remSource, W, H, K, startSwap, seed, cfg, minScrapW, minScrapH, isCancelled){
    const BW = startSwap ? H : W;
    const BH = startSwap ? W : H;
    let rem = remSource.map(cloneItem);

    const firstRow = buildRow(rem, BW, K, seed.rowH, seed, widthBucket(seed.cand.w), { swap: startSwap, preferWide:true });
    if(!firstRow || firstRow.occupancy < 0.80) return null;

    const seedRows = [firstRow];
    rem = removeSelected(rem, firstRow.items.map(v => v.it.id));
    let availableH = BH - (firstRow.rowH + K);

    if(availableH > 40 && rem.length){
      const secondRow = chooseBestRow(rem, BW, availableH, K, startSwap, cfg, 0.90, { preferWide:true });
      if(shouldKeepSecondBand(firstRow, secondRow, BW, BH)){
        seedRows.push(secondRow);
        rem = removeSelected(rem, secondRow.items.map(v => v.it.id));
        availableH -= (secondRow.rowH + K);
      }
    }

    repairRows(seedRows, rem, BW, K, startSwap);

    const seedBlock = buildBlock(seedRows, W, H, K, startSwap, 0, 0, minScrapW, minScrapH);
    const seedCursorAfter = seedBlock.cursorAfter;

    let residualRect = null;
    if(!startSwap){
      const residualH = H - seedCursorAfter;
      if(residualH > 40) residualRect = { x: 0, y: seedCursorAfter, w: W, h: residualH, swap: true };
    } else {
      const residualW = W - seedCursorAfter;
      if(residualW > 40) residualRect = { x: seedCursorAfter, y: 0, w: residualW, h: H, swap: false };
    }

    let residualBlock = { placements: [], freeRects: [], usedArea: 0 };
    let residualRows = [];
    if(residualRect && rem.length && !(isCancelled && isCancelled())){
      const packed = packRectRows(rem, residualRect.w, residualRect.h, K, residualRect.swap, cfg, 0.90, minScrapW, minScrapH, isCancelled);
      rem = packed.rem;
      residualRows = packed.rows;
      residualBlock = packed.block;
      residualBlock.placements.forEach(p=>{ p.x += residualRect.x; p.y += residualRect.y; });
      residualBlock.freeRects = residualBlock.freeRects.map(r => ({ x: r.x + residualRect.x, y: r.y + residualRect.y, w: r.w, h: r.h }));
    }

    const placements = seedBlock.placements.concat(residualBlock.placements);
    const freeRects = seedBlock.freeRects.concat(residualBlock.freeRects);
    const usedArea = seedBlock.usedArea + residualBlock.usedArea;
    const boardArea = Math.max(1, W * H);
    const seedScore = scoreRows(seedRows, BW, BH);
    const residualScore = residualRows.length ? scoreRows(residualRows, residualRect.swap ? residualRect.h : residualRect.w, residualRect.swap ? residualRect.w : residualRect.h) : 0;
    const score = seedScore
      + residualScore
      + usedArea
      + (placements.length ? (usedArea / boardArea) * 1200000 : 0)
      + (seedRows.length === 2 ? 120000 : 0)
      + 220000; // bonus za wymuszoną zmianę kierunku po starcie

    return {
      sheet: {
        boardW: W,
        boardH: H,
        placements,
        _usedArea: usedArea,
        _swapUsed: !!startSwap,
        _freeRects: freeRects,
      },
      rem,
      score,
      swap: startSwap,
    };
  }

  function compareSolutions(a, b){
    if(!b) return true;
    if(a.length !== b.length) return a.length < b.length;
    const scoreA = a.reduce((sum, s)=> sum + (Number(s._usedArea) || 0), 0);
    const scoreB = b.reduce((sum, s)=> sum + (Number(s._usedArea) || 0), 0);
    if(scoreA !== scoreB) return scoreA > scoreB;
    const lastA = a[a.length - 1];
    const lastB = b[b.length - 1];
    const occA = (Number(lastA && lastA._usedArea) || 0) / Math.max(1, (Number(lastA && lastA.boardW) || 0) * (Number(lastA && lastA.boardH) || 0));
    const occB = (Number(lastB && lastB._usedArea) || 0) / Math.max(1, (Number(lastB && lastB.boardW) || 0) * (Number(lastB && lastB.boardH) || 0));
    return occA > occB;
  }

  function fallbackUnplaced(item, W, H){
    return {
      boardW: W,
      boardH: H,
      placements:[{
        id: item.id,
        key: item.key,
        name: item.name,
        x:0,
        y:0,
        w: item.w,
        h: item.h,
        rotated:false,
        unplaced:true,
        srcW: item.w,
        srcH: item.h,
        rotationAllowed: !!item.rotationAllowed,
      }],
      _usedArea:0,
      _freeRects:[],
      _swapUsed:false,
    };
  }

  function packMode(itemsIn, boardW, boardH, kerf, options){
    const W = clampInt(boardW, 2800);
    const H = clampInt(boardH, 2070);
    const K = Math.max(0, Math.round(Number(kerf) || 0));
    const cfg = getProfileConfig(options && options.profile);
    const minScrapW = Math.max(0, Math.round((options && options.minScrapW != null) ? Number(options.minScrapW) : 100));
    const minScrapH = Math.max(0, Math.round((options && options.minScrapH != null) ? Number(options.minScrapH) : 100));
    const isCancelled = (options && typeof options.isCancelled === 'function') ? options.isCancelled : ()=>false;
    const mode = normalizeMode(options && options.solverMode, options);
    const orientations = (mode === 'along') ? [true] : (mode === 'across') ? [false] : [false, true];
    let remMaster = (itemsIn || []).map(cloneItem);
    const sheets = [];

    while(remMaster.length){
      if(isCancelled()) break;
      const started = now();
      let best = null;
      const attempts = [];
      for(const swap of orientations){
        const BW = swap ? H : W;
        const BH = swap ? W : H;
        const seeds = buildSeedCandidates(remMaster, BW, BH, swap, cfg.seedLimit);
        for(const seed of seeds) attempts.push({ swap, seed });
      }

      for(const attempt of attempts){
        if(isCancelled()) break;
        if(now() - started > cfg.perSheetMs) break;
        const variant = buildSheetVariant(remMaster, W, H, K, attempt.swap, attempt.seed, cfg, minScrapW, minScrapH, isCancelled);
        if(!variant) continue;
        if(!best || variant.score > best.score) best = variant;
      }

      if(!best){
        const it = remMaster.shift();
        if(!it) break;
        sheets.push(fallbackUnplaced(it, W, H));
        continue;
      }

      sheets.push(best.sheet);
      remMaster = best.rem;
    }

    return sheets;
  }

  root.FC.optimaCore = Object.assign({}, root.FC.optimaCore || {}, {
    packMode,
    compareSolutions,
  });
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));

/* optima-solver.js — tryb Optima dla Optimax
   Heurystyka pasowa z próbami startu od 1–2 mocnych pasów, próbą obrotu arkusza,
   naprawą słabych pasów i dopieszczaniem końcówki.
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

  function widthBucket(n){
    return Math.max(0, Math.round((Number(n) || 0) / 75) * 75);
  }

  function areaOf(it){
    return Math.max(0, Number(it && it.w) || 0) * Math.max(0, Number(it && it.h) || 0);
  }

  function cloneItem(it){
    return Object.assign({}, it);
  }

  function isSmallCandidate(c){
    const w = Number(c && c.w) || 0;
    const h = Number(c && c.h) || 0;
    return Math.min(w, h) <= 220 || (w * h) <= 120000;
  }

  function getProfileConfig(profile){
    const key = String(profile || 'D').toUpperCase();
    const map = {
      A: { perSheetMs: 5000,  seedLimit: 8,  rowSeedLimit: 5,  tailPasses: 1 },
      B: { perSheetMs: 12000, seedLimit: 12, rowSeedLimit: 7,  tailPasses: 1 },
      C: { perSheetMs: 20000, seedLimit: 18, rowSeedLimit: 10, tailPasses: 2 },
      D: { perSheetMs: 30000, seedLimit: 24, rowSeedLimit: 14, tailPasses: 3 },
    };
    return map[key] || map.D;
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

  function buildSeedCandidates(rem, BW, BH, swap, limit, mode){
    const sup = supportMaps(rem, BW, BH, swap);
    const out = [];
    const preferLargest = !!(mode && mode.largestFirst);
    for(let idx=0; idx<rem.length; idx++){
      const it = rem[idx];
      for(const c of orientationCandidates(it, BW, BH, swap)){
        const hBucket = widthBucket(c.h);
        const wBucket = widthBucket(c.w);
        const supportH = sup.byH.get(hBucket) || 0;
        const supportW = sup.byW.get(wBucket) || 0;
        const area = (c.w * c.h);
        const score = area * (preferLargest ? 3 : 1)
          + c.w * 90
          + c.h * 40
          + supportH * (preferLargest ? 65000 : 85000)
          + supportW * (preferLargest ? 18000 : 25000);
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
      let score = (c.w * c.h) * 1000
        + (exact ? 80000 : 0)
        - gap * c.w * 7;
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

    const items = reconstructRow(dp, bestUsed, rem, forced);
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

  function buildSheetObject(rows, BW, BH, W, H, K, swap, minScrapW, minScrapH){
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
    const sheet = {
      boardW: swap ? W : W,
      boardH: swap ? H : H,
      placements,
      _usedArea: usedArea,
      _swapUsed: !!swap,
      _freeRects: freeRects.filter(r => r.w >= minScrapW && r.h >= minScrapH),
    };
    return sheet;
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

      const oldIds = new Set(row.items.map(v => String(v.it.id)));
      const newIds = new Set(rebuilt.items.map(v => String(v.it.id)));
      // return dropped old items back to pool
      for(const picked of row.items){
        const key = String(picked.it.id);
        if(!newIds.has(key)) pushUnique(rem, picked.it);
      }
      // remove newly used items from remaining pool
      for(let i=rem.length-1; i>=0; i--){
        if(newIds.has(String(rem[i].id))) rem.splice(i, 1);
      }
      rows[ri] = rebuilt;
    }
  }

  function buildSheetVariant(remSource, W, H, K, swap, seed, cfg, minScrapW, minScrapH, isCancelled){
    const BW = swap ? H : W;
    const BH = swap ? W : H;
    const rem = remSource.map(cloneItem);
    const rows = [];
    let availableH = BH;

    const seedRow = buildRow(rem, BW, K, seed.rowH, seed, widthBucket(seed.cand.w), { swap, preferWide:true });
    if(!seedRow) return null;
    if(seedRow.occupancy < 0.80) return null;
    rows.push(seedRow);
    let remNow = removeSelected(rem, seedRow.items.map(v => v.it.id));
    availableH -= (seedRow.rowH + K);

    if(availableH > 40){
      const second = chooseBestRow(remNow, BW, availableH, K, swap, cfg, 0.90, { preferWide:true });
      if(second && second.occupancy >= 0.90 && seedRow.occupancy >= 0.90){
        rows.push(second);
        remNow = removeSelected(remNow, second.items.map(v => v.it.id));
        availableH -= (second.rowH + K);
      }
    }

    while(remNow.length && availableH > 40){
      if(isCancelled && isCancelled()) break;
      const row = chooseBestRow(remNow, BW, availableH, K, swap, cfg, 0.80, null);
      if(!row) break;
      rows.push(row);
      remNow = removeSelected(remNow, row.items.map(v => v.it.id));
      availableH -= (row.rowH + K);
      if(row.rowH <= 0) break;
    }

    repairRows(rows, remNow, BW, K, swap);

    const sheet = buildSheetObject(rows, BW, BH, W, H, K, swap, minScrapW, minScrapH);
    const score = scoreRows(rows, BW, BH);
    return { sheet, rem: remNow, rows, score, swap };
  }

  function placementsToItems(sheet){
    const out = [];
    const seen = new Set();
    for(const p of (sheet && sheet.placements) || []){
      if(!p || p.unplaced) continue;
      const key = String(p.id);
      if(seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: p.id,
        key: p.key,
        name: p.name,
        w: p.srcW || p.w,
        h: p.srcH || p.h,
        rotationAllowed: p.rotationAllowed !== false,
        edgeW1: !!p.edgeW1,
        edgeW2: !!p.edgeW2,
        edgeH1: !!p.edgeH1,
        edgeH2: !!p.edgeH2,
      });
    }
    return out;
  }

  function variantRankScore(variant, preferAcross, tailBias){
    if(!variant) return -1e18;
    let score = Number(variant.score) || 0;
    if(preferAcross && !variant.swap) score += tailBias ? 360000 : 140000;
    return score;
  }

  function compareSolutions(a, b, options){
    const preferAcross = !!(options && (options.preferAcross || options.forceTailAcross || options.cutMode === 'across'));
    if(!b) return true;
    if(a.length !== b.length) return a.length < b.length;
    const scoreA = a.reduce((sum, s)=> sum + (Number(s._usedArea) || 0), 0);
    const scoreB = b.reduce((sum, s)=> sum + (Number(s._usedArea) || 0), 0);
    if(scoreA !== scoreB) return scoreA > scoreB;
    const lastA = a[a.length - 1];
    const lastB = b[b.length - 1];
    const occA = (Number(lastA && lastA._usedArea) || 0) / Math.max(1, (Number(lastA && lastA.boardW) || 0) * (Number(lastA && lastA.boardH) || 0));
    const occB = (Number(lastB && lastB._usedArea) || 0) / Math.max(1, (Number(lastB && lastB.boardW) || 0) * (Number(lastB && lastB.boardH) || 0));
    if(Math.abs(occA - occB) > 1e-9) return occA > occB;
    if(preferAcross){
      const aAcross = !!(lastA && lastA._swapUsed === false);
      const bAcross = !!(lastB && lastB._swapUsed === false);
      if(aAcross !== bAcross) return aAcross;
    }
    return false;
  }

  function packOptimaCore(itemsIn, boardW, boardH, kerf, options, skipTailPolish){
    const W = clampInt(boardW, 2800);
    const H = clampInt(boardH, 2070);
    const K = Math.max(0, Math.round(Number(kerf) || 0));
    const cfg = getProfileConfig(options && options.profile);
    const minScrapW = Math.max(0, Math.round((options && options.minScrapW != null) ? Number(options.minScrapW) : 100));
    const minScrapH = Math.max(0, Math.round((options && options.minScrapH != null) ? Number(options.minScrapH) : 100));
    const isCancelled = (options && typeof options.isCancelled === 'function') ? options.isCancelled : ()=>false;
    const preferAcross = !!(options && (options.preferAcross || options.forceTailAcross || options.cutMode === 'across'));
    const acrossOnly = !!(options && options.acrossOnly);
    const seedLargestFirst = !!(options && options.seedLargestFirst);
    let remMaster = (itemsIn || []).map(cloneItem);
    const sheets = [];

    while(remMaster.length){
      if(isCancelled()) break;
      const started = now();
      let best = null;
      const attempts = [];
      const swapOrder = acrossOnly ? [false] : (preferAcross ? [false, true] : [false, true]);
      for(const swap of swapOrder){
        const BW = swap ? H : W;
        const BH = swap ? W : H;
        const seeds = buildSeedCandidates(remMaster, BW, BH, swap, cfg.seedLimit, { largestFirst: seedLargestFirst || preferAcross });
        for(const seed of seeds) attempts.push({ swap, seed });
      }
      if(!attempts.length){
        const it = remMaster.shift();
        if(!it) break;
        sheets.push({ boardW: W, boardH: H, placements:[{ id: it.id, key: it.key, name: it.name, x:0, y:0, w: it.w, h: it.h, rotated:false, unplaced:true, srcW: it.w, srcH: it.h, rotationAllowed: !!it.rotationAllowed }], _usedArea:0, _freeRects:[] });
        continue;
      }
      for(const attempt of attempts){
        if(isCancelled()) break;
        if(now() - started > cfg.perSheetMs) break;
        const variant = buildSheetVariant(remMaster, W, H, K, attempt.swap, attempt.seed, cfg, minScrapW, minScrapH, isCancelled);
        if(!variant) continue;
        const tailish = variant.rem.length === 0 || remMaster.length <= Math.max(8, Math.ceil((itemsIn || []).length * 0.2));
        if(!best || variantRankScore(variant, preferAcross, tailish) > variantRankScore(best, preferAcross, tailish)) best = variant;
      }
      if(!best){
        const it = remMaster.shift();
        if(!it) break;
        sheets.push({ boardW: W, boardH: H, placements:[{ id: it.id, key: it.key, name: it.name, x:0, y:0, w: it.w, h: it.h, rotated:false, unplaced:true, srcW: it.w, srcH: it.h, rotationAllowed: !!it.rotationAllowed }], _usedArea:0, _freeRects:[] });
        continue;
      }
      sheets.push(best.sheet);
      remMaster = best.rem;
    }

    if(!skipTailPolish && sheets.length && !isCancelled()){
      const passes = Math.max(1, Number(cfg.tailPasses) || 1);
      for(let pass=0; pass<passes; pass++){
        if(isCancelled()) break;
        for(const tailCount of [2, 1]){
          if(sheets.length < tailCount) continue;
          const tail = sheets.slice(-tailCount);
          const tailItems = [];
          for(const sh of tail) tailItems.push(...placementsToItems(sh));
          if(!tailItems.length) continue;
          const tailOpts = Object.assign({}, options, {
            profile: options && options.profile ? options.profile : 'D',
            preferAcross,
            seedLargestFirst: seedLargestFirst || preferAcross,
            acrossOnly: !!(preferAcross && tailCount === 1),
          });
          const sortedTailItems = tailItems.slice().sort((a,b)=>{
            const areaDiff = areaOf(b) - areaOf(a);
            if(areaDiff !== 0) return areaDiff;
            return Math.max(b.w, b.h) - Math.max(a.w, a.h);
          });
          const repacked = packOptimaCore(sortedTailItems, W, H, K, tailOpts, true);
          if(repacked && repacked.length <= tailCount && compareSolutions(repacked, tail, tailOpts)){
            sheets.splice(sheets.length - tailCount, tailCount, ...repacked);
          }
        }
      }
    }

    if(!skipTailPolish && preferAcross && sheets.length === 1 && !isCancelled()){
      const onlyItems = placementsToItems(sheets[0]).sort((a,b)=>{
        const areaDiff = areaOf(b) - areaOf(a);
        if(areaDiff !== 0) return areaDiff;
        return Math.max(b.w, b.h) - Math.max(a.w, a.h);
      });
      const forcedAcross = packOptimaCore(onlyItems, W, H, K, Object.assign({}, options, {
        preferAcross: true,
        seedLargestFirst: true,
        acrossOnly: true,
      }), true);
      if(forcedAcross && forcedAcross.length === 1 && compareSolutions(forcedAcross, sheets, { preferAcross: true, forceTailAcross: true })){
        return forcedAcross;
      }
    }

    return sheets;
  }

  function packOptima(itemsIn, boardW, boardH, kerf, options){
    return packOptimaCore(itemsIn, boardW, boardH, kerf, options || {}, false);
  }

  root.FC.optimaSolver = Object.assign({}, root.FC.optimaSolver || {}, {
    packOptima,
  });
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));

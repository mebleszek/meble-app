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
  function scoreSheet(sheet, kerf, axis, lookaheadOcc){
    const W = Number(sheet && sheet.boardW) || 0;
    const H = Number(sheet && sheet.boardH) || 0;
    const area = Math.max(1, W * H);
    const used = placementArea(sheet);
    const occ = used / area;
    const free = calcFreeRects(sheet, kerf).filter(r=>r.w >= 40 && r.h >= 40);
    const largestFree = free.reduce((m,r)=>Math.max(m, r.w*r.h), 0);
    const reusable = free.reduce((m,r)=>Math.max(m, (r.w >= 160 && r.h >= 160) ? (r.w*r.h) : 0), 0);
    const bm = bandMetrics(sheet, axis);
    const placements = ((sheet && sheet.placements) || []).filter(p=>p && !p.unplaced);
    let score = 0;
    score += occ * 1000000;
    score += bm.close * 140000;
    score += bm.otherClose * 60000;
    score -= bm.singleton * 160000;
    score -= bm.otherSingleton * 80000;
    score -= (largestFree / area) * 200000;
    score -= Math.max(0, free.length - 3) * 22000;
    score += (reusable / area) * 50000;
    score += (Number(lookaheadOcc)||0) * 240000;
    if(occ >= 0.90) score += 120000;
    else if(occ >= 0.85) score += 70000;
    if(placements.length <= 1) score -= 120000;
    return { score, occ, used, freeRects: free.length, largestFree };
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
    const hArr = groupDimSupport(items, 'h', H).slice(0, endgame ? 10 : Math.max(3, Math.min(6, Math.floor(attempts / 8) || 3)));
    const wArr = groupDimSupport(items, 'w', W).slice(0, endgame ? 10 : Math.max(3, Math.min(6, Math.floor(attempts / 8) || 3)));
    return {
      hs: hArr.map(v=>v.dim),
      ws: wArr.map(v=>v.dim),
    };
  }

  function buildCandidateList(items, W, H, K, attempts, endgame){
    const { hs, ws } = candidateDimensions(items, W, H, attempts, endgame);
    const builders = [];
    builders.push(()=>buildFullCandidate(items, W, H, K, 'along'));
    builders.push(()=>buildFullCandidate(items, W, H, K, 'across'));
    for(const h of hs){
      builders.push(()=>buildHybridHorizontal(items, W, H, K, h, 'along', 'across'));
      builders.push(()=>buildHybridHorizontal(items, W, H, K, h, 'across', 'along'));
    }
    for(const w of ws){
      builders.push(()=>buildHybridVertical(items, W, H, K, w, 'across', 'along'));
      builders.push(()=>buildHybridVertical(items, W, H, K, w, 'along', 'across'));
    }
    // Slight extra diversity on endgame.
    if(endgame){
      for(const h of hs.slice(0, 4)){
        builders.push(()=>buildHybridHorizontal(items, W, H, K, h, 'along', 'along'));
        builders.push(()=>buildHybridHorizontal(items, W, H, K, h, 'across', 'across'));
      }
      for(const w of ws.slice(0, 4)){
        builders.push(()=>buildHybridVertical(items, W, H, K, w, 'along', 'along'));
        builders.push(()=>buildHybridVertical(items, W, H, K, w, 'across', 'across'));
      }
    }
    return builders.slice(0, Math.max(2, attempts));
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
      firsts.push(cand);
    }
    firsts.sort((a,b)=>b.score - a.score);
    const take = firsts.slice(0, Math.min(8, firsts.length));
    let best = null;
    for(const first of take){
      if(!first.rem.length){
        const total = first.score + 250000;
        if(!best || total > best.score) best = { score: total, sheets:[first.sheet], rem:first.rem };
        continue;
      }
      const second = chooseBestNextSheet(first.rem, W, H, K, { attempts: Math.max(8, Math.floor(attempts / 2)), lookahead:false, endgame:true });
      if(!second) continue;
      const total = first.score + second.score + (first.metrics.occ * 180000) + (second.metrics.occ * 100000) - ((second.metrics.largestFree / Math.max(1, W*H)) * 140000);
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

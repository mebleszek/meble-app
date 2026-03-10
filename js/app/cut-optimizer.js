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
  function packStripBandsStable(itemsIn, boardW, boardH, kerf, direction){
    const W = clampInt(boardW, 2800);
    const H = clampInt(boardH, 2070);
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const swap = (direction === 'across' || direction === 'wpoprz');
    const BW = swap ? H : W;
    const BH = swap ? W : H;

    const rem = (itemsIn||[]).map(it=>Object.assign({}, it));
    const sheets = [];

    function toCandidates(it){
      const out = [{ w: it.w, h: it.h, rotated:false }];
      if(it.rotationAllowed) out.push({ w: it.h, h: it.w, rotated:true });
      return out;
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

    function chooseAnchor(maxRowH){
      let best = null;
      for(let i=0;i<rem.length;i++){
        const it = rem[i];
        for(const c of toCandidates(it)){
          if(c.w > BW || c.h > maxRowH) continue;
          const sc = (c.h * 1000000) + (c.w * 1000) + (c.w * c.h);
          if(!best || sc > best.sc){
            best = { idx:i, it, cand:c, sc };
          }
        }
      }
      return best;
    }

    function chooseBestForStrip(spaceW, rowH){
      let best = null;
      for(let i=0;i<rem.length;i++){
        const it = rem[i];
        for(const c of toCandidates(it)){
          if(c.w > spaceW || c.h > rowH) continue;
          const heightGap = rowH - c.h;
          const widthWaste = spaceW - c.w;
          const exactHeight = (heightGap === 0) ? 1 : 0;
          const sc = (exactHeight * 1000000) - (heightGap * 2500) - widthWaste + (c.w * c.h * 0.001);
          if(!best || sc > best.sc){
            best = { idx:i, it, cand:c, sc };
          }
        }
      }
      return best;
    }

    while(rem.length){
      const sheet = { boardW: BW, boardH: BH, placements: [] };
      let cursorY = 0;
      let placedAny = false;

      while(rem.length){
        const availableH = BH - cursorY;
        const anchor = chooseAnchor(availableH);
        if(!anchor) break;

        let cursorX = 0;
        const rowH = anchor.cand.h;
        const first = {
          id: anchor.it.id,
          key: anchor.it.key,
          name: anchor.it.name,
          x: cursorX,
          y: cursorY,
          w: anchor.cand.w,
          h: anchor.cand.h,
          rotated: !!anchor.cand.rotated,
          edgeW1: anchor.cand.rotated ? anchor.it.edgeH1 : anchor.it.edgeW1,
          edgeW2: anchor.cand.rotated ? anchor.it.edgeH2 : anchor.it.edgeW2,
          edgeH1: anchor.cand.rotated ? anchor.it.edgeW1 : anchor.it.edgeH1,
          edgeH2: anchor.cand.rotated ? anchor.it.edgeW2 : anchor.it.edgeH2,
        };
        sheet.placements.push(first);
        placedAny = true;
        cursorX += anchor.cand.w + K;
        rem.splice(anchor.idx, 1);

        while(rem.length && cursorX < BW){
          const fit = chooseBestForStrip(BW - cursorX, rowH);
          if(!fit) break;
          sheet.placements.push({
            id: fit.it.id,
            key: fit.it.key,
            name: fit.it.name,
            x: cursorX,
            y: cursorY,
            w: fit.cand.w,
            h: fit.cand.h,
            rotated: !!fit.cand.rotated,
            edgeW1: fit.cand.rotated ? fit.it.edgeH1 : fit.it.edgeW1,
            edgeW2: fit.cand.rotated ? fit.it.edgeH2 : fit.it.edgeW2,
            edgeH1: fit.cand.rotated ? fit.it.edgeW1 : fit.it.edgeH1,
            edgeH2: fit.cand.rotated ? fit.it.edgeW2 : fit.it.edgeH2,
          });
          cursorX += fit.cand.w + K;
          rem.splice(fit.idx, 1);
        }

        cursorY += rowH + K;
      }

      if(!placedAny){
        const it = rem.shift();
        if(it){
          sheet.placements.push({ id: it.id, key: it.key, name: it.name, x:0, y:0, w: it.w, h: it.h, rotated:false, unplaced:true });
        }
      }

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

  function packStripBands(itemsIn, boardW, boardH, kerf, direction, options){
    return packStripBandsStable(itemsIn, boardW, boardH, kerf, direction);
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
    packStripBandsStable,
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

  function insetRect(rect, trim){
    const t = Math.max(0, Math.round(Number(trim)||0));
    if(!rect) return null;
    if(t <= 0) return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    const w = rect.w - 2*t;
    const h = rect.h - 2*t;
    if(w <= 0 || h <= 0) return null;
    return { x: rect.x + t, y: rect.y + t, w, h };
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

  function fillOneSheetBeam(items, W, H, K, beamWidth, timeMs, cutPref, initialFreeRects){
    const start = Date.now();
    const maxBeam = clampInt(beamWidth, 40);
    const budgetMs = Math.max(60, clampInt(timeMs, 300));

    const remaining = sortByAreaDesc(items);
    const seedFreeRects = Array.isArray(initialFreeRects) && initialFreeRects.length ? initialFreeRects.map(r=>({ x:r.x, y:r.y, w:r.w, h:r.h })) : [{ x:0, y:0, w:W, h:H }];
    let beam = [{ placements: [], freeRects: seedFreeRects, usedArea: 0, usedIdx: new Set(), alignmentScore: 0, boardW: W, boardH: H }];

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

    const best = beam[0] || { placements: [], freeRects: seedFreeRects, usedArea:0, usedIdx: new Set(), alignmentScore:0, boardW:W, boardH:H };
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
    const edgeTrimNewSheet = Math.max(0, Math.round(Number(options && options.edgeTrimNewSheet)||0));
    const edgeTrimScrap = Math.max(0, Math.round(Number(options && options.edgeTrimScrap)||0));

    const scrapFirst = !!(options && options.scrapFirst);
    let remaining = sortByAreaDesc(itemsIn);
    const sheets = [];
    const initialFree = insetRect({ x:0, y:0, w:W, h:H }, edgeTrimNewSheet) || { x:0, y:0, w:W, h:H };
    const normalizeScraps = (freeRects)=>{
      const minScrapW = Math.max(0, Math.round((options && options.minScrapW != null) ? Number(options.minScrapW) : 100));
      const minScrapH = Math.max(0, Math.round((options && options.minScrapH != null) ? Number(options.minScrapH) : 100));
      return (freeRects || []).map(r=> insetRect(r, edgeTrimScrap)).filter(r=>r && r.w>=minScrapW && r.h>=minScrapH);
    };

    // If enabled, prefer reusing scraps on existing sheets before allocating a new board.
    if(scrapFirst){
      while(remaining.length>0){
        const filled = tryFillExistingSheets(sheets, remaining, W, H, K, cutPref);
        remaining = filled.remaining;
        if(!remaining.length) break;

        const res = fillOneSheetBeam(remaining, W, H, K, beamWidth, timeMs, cutPref, [initialFree]);
      const placements = res.placements || [];
      if(placements.length===0){
        const it = remaining[0];
        sheets.push({ boardW: W, boardH: H, placements: [{ id: it.id, key: it.key, name: it.name, x:0, y:0, w: it.w, h: it.h, rotated:false, unplaced:true }] });
        remaining = remaining.slice(1);
        continue;
      }
      const sheet = { boardW: W, boardH: H, placements };
      sheet._freeRects = normalizeScraps(res.freeRects);
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
      const res = fillOneSheetBeam(remaining, W, H, K, beamWidth, timeMs, cutPref, [initialFree]);
      const placements = res.placements || [];
      if(!placements.length){
        const it = remaining[0];
        sheets.push({ boardW: W, boardH: H, placements: [{ id: it.id, key: it.key, name: it.name, x:0, y:0, w: it.w, h: it.h, rotated:false, unplaced:true }] });
        remaining = remaining.slice(1);
        continue;
      }
      const sheet = { boardW: W, boardH: H, placements };
      sheet._freeRects = normalizeScraps(res.freeRects);
      sheet._usedArea = res.usedArea || 0;
      sheets.push(sheet);
      remaining = res.remaining;
    }
    return sheets;
  }

  opt.packGuillotineBeam = packGuillotineBeam;
})();

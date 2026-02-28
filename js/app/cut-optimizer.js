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
        });
        s.boardW = W;
        s.boardH = H;
      });
    } else {
      sheets.forEach(s=>{ s.boardW = W; s.boardH = H; });
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
      });
      // create new free rects from the one we used
      const newRects = splitFreeRect(pos.free, placed);
      // add kerf spacing around placed area (simple safety): shrink new rects by kerf on the near edges
      const adjusted = newRects.map(r=>({
        x: r.x + (r.x>placed.x ? K : 0),
        y: r.y + (r.y>placed.y ? K : 0),
        w: r.w - (r.x>placed.x ? K : 0),
        h: r.h - (r.y>placed.y ? K : 0)
      }));
      // remove used free rect
      sheet.freeRects = sheet.freeRects.filter(fr => fr !== pos.free);
      sheet.freeRects.push(...adjusted);
      sheet.freeRects = pruneFreeRects(sheet.freeRects);
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
    packMaxRects,
    packGuillotineBeam,
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

  function sortByAreaDesc(items){
    return items.slice().sort((a,b)=> (b.w*b.h) - (a.w*a.h));
  }

  // Guillotine split: right + bottom
  function splitFreeRectGuillotine(free, placed){
    const out = [];
    const rx = placed.x + placed.w;
    const rw = (free.x + free.w) - rx;
    if(rw > 0) out.push({ x: rx, y: free.y, w: rw, h: free.h });
    const by = placed.y + placed.h;
    const bh = (free.y + free.h) - by;
    if(bh > 0) out.push({ x: free.x, y: by, w: free.w, h: bh });
    return out;
  }

  function placeInFreeRect(state, free, item, w, h, rotated, kerf){
    const K = kerf;
    const placed = { x: free.x, y: free.y, w, h };
    const placement = { id: item.id, key: item.key, name: item.name, x: placed.x, y: placed.y, w: placed.w, h: placed.h, rotated: !!rotated };
    const newFree = state.freeRects.filter(fr => fr !== free);
    const split = splitFreeRectGuillotine(free, placed);
    const adjusted = split.map(r=>{
      const ax = (r.x > placed.x) ? (r.x + K) : r.x;
      const ay = (r.y > placed.y) ? (r.y + K) : r.y;
      const aw = r.w - ((r.x > placed.x) ? K : 0);
      const ah = r.h - ((r.y > placed.y) ? K : 0);
      return { x: ax, y: ay, w: aw, h: ah };
    });
    newFree.push(...adjusted);
    return {
      placements: state.placements.concat([placement]),
      freeRects: pruneFreeRects(newFree),
      usedArea: state.usedArea + (w*h),
    };
  }

  function fillOneSheetBeam(items, W, H, K, beamWidth, timeMs){
    const start = Date.now();
    const maxBeam = clampInt(beamWidth, 40);
    const budgetMs = Math.max(60, clampInt(timeMs, 300));

    const remaining = sortByAreaDesc(items);
    let beam = [{ placements: [], freeRects: [{ x:0, y:0, w:W, h:H }], usedArea: 0, usedIdx: new Set() }];

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
              const placedState = placeInFreeRect(st, f, it, o.w, o.h, o.rotated, K);
              const usedIdx = new Set(st.usedIdx);
              usedIdx.add(c.idx);
              next.push({ placements: placedState.placements, freeRects: placedState.freeRects, usedArea: placedState.usedArea, usedIdx });
            }
          }
        }
      }
      if(next.length===0) break;

      next.sort((a,b)=>{
        if(b.usedArea !== a.usedArea) return b.usedArea - a.usedArea;
        const aMax = a.freeRects.reduce((m,r)=>Math.max(m,r.w*r.h),0);
        const bMax = b.freeRects.reduce((m,r)=>Math.max(m,r.w*r.h),0);
        return bMax - aMax;
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

    const best = beam[0] || { placements: [], usedIdx: new Set() };
    const rest = [];
    for(let i=0;i<remaining.length;i++) if(!best.usedIdx.has(i)) rest.push(remaining[i]);
    return { placements: best.placements, remaining: rest };
  }

  function packGuillotineBeam(itemsIn, boardW, boardH, kerf, options){
    const W = clampInt(boardW, 2800);
    const H = clampInt(boardH, 2070);
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const beamWidth = options && options.beamWidth ? options.beamWidth : 60;
    const timeMs = options && options.timeMs ? options.timeMs : 450;

    let remaining = sortByAreaDesc(itemsIn);
    const sheets = [];
    while(remaining.length>0){
      const res = fillOneSheetBeam(remaining, W, H, K, beamWidth, timeMs);
      const placements = res.placements || [];
      if(placements.length===0){
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

/* cut-optimizer.js — proste heurystyki rozkroju (MVP)
   - Shelf (pasy) + Guillotine PRO (dokładniejsza, pod plan cięć)
   - (pozostawione) MaxRects — układ, nie plan cięć
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

  function area(r){ return r.w * r.h; }

  function containsRect(a,b){
    return (b.x>=a.x && b.y>=a.y && (b.x+b.w)<= (a.x+a.w) && (b.y+b.h) <= (a.y+a.h));
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

  // ===== Guillotine PRO (beam search; realny "plan cięć" pod gilotynę)
  // - tworzy układ guillotine-friendly
  // - automatycznie wybiera orientację podziału na każdym kroku
  // - nie wymaga preferencji kierunku cięcia od użytkownika
  // mode: 'fast' | 'accurate'
  function packGuillotinePro(itemsIn, boardW, boardH, kerf, mode){
    const W = clampInt(boardW, 2800);
    const H = clampInt(boardH, 2070);
    const K = Math.max(0, Math.round(Number(kerf)||0));
    const beam = (mode === 'accurate') ? 60 : 20;

    const items = sortRectsByMaxSideDesc(itemsIn);
    const sheets = [];

    function newState(){
      return {
        free: [{ x:0, y:0, w:W, h:H }],
        placements: [],
        used: 0,
      };
    }

    function scoreState(st){
      // niżej = lepiej
      const freeArea = st.free.reduce((s,r)=>s+area(r),0);
      const maxFree = st.free.reduce((m,r)=>Math.max(m, area(r)), 0);
      // preferuj mniej „poszatkowanych” prostokątów
      const frag = st.free.length;
      return (freeArea - maxFree) + frag * 5000;
    }

    function splitGuillotine(free, placed, splitKind){
      // Założenie: placed jest w lewym-górnym rogu free
      const out = [];
      const wRem = free.w - placed.w - K;
      const hRem = free.h - placed.h - K;
      if(splitKind === 'H'){
        // 1) cięcie poziome po wysokości elementu -> dolny prostokąt pełnej szerokości
        if(hRem > 0){
          out.push({ x: free.x, y: free.y + placed.h + K, w: free.w, h: hRem });
        }
        // 2) w górnym pasie docinamy pionowo -> prawy prostokąt wysokości elementu
        if(wRem > 0){
          out.push({ x: free.x + placed.w + K, y: free.y, w: wRem, h: placed.h });
        }
      } else {
        // 'V'
        // 1) cięcie pionowe po szerokości elementu -> prawy prostokąt pełnej wysokości
        if(wRem > 0){
          out.push({ x: free.x + placed.w + K, y: free.y, w: wRem, h: free.h });
        }
        // 2) w lewym pasie docinamy poziomo -> dolny prostokąt szerokości elementu
        if(hRem > 0){
          out.push({ x: free.x, y: free.y + placed.h + K, w: placed.w, h: hRem });
        }
      }
      return out.filter(r=>r.w>0 && r.h>0);
    }

    function prune(list){
      const cleaned = list.filter(r=>r.w>0 && r.h>0);
      // usuń zawarte
      const out = [];
      for(let i=0;i<cleaned.length;i++){
        const a = cleaned[i];
        let contained = false;
        for(let j=0;j<cleaned.length;j++){
          if(i===j) continue;
          const b = cleaned[j];
          if(containsRect(b,a)) { contained = true; break; }
        }
        if(!contained) out.push(a);
      }
      return out;
    }

    function expand(states, it){
      const next = [];
      for(const st of states){
        for(const free of st.free){
          const candidates = [];
          candidates.push({ w: it.w, h: it.h, rotated:false });
          if(it.rotationAllowed) candidates.push({ w: it.h, h: it.w, rotated:true });
          for(const c of candidates){
            if(!rectFits(free, c.w, c.h)) continue;
            const placed = { x: free.x, y: free.y, w: c.w, h: c.h };
            // dwie możliwości podziału
            for(const splitKind of ['H','V']){
              const ns = {
                free: st.free.filter(r=>r!==free).slice(),
                placements: st.placements.slice(),
                used: st.used + area(placed),
              };
              ns.placements.push({
                id: it.id,
                key: it.key,
                name: it.name,
                x: placed.x,
                y: placed.y,
                w: placed.w,
                h: placed.h,
                rotated: c.rotated,
              });
              ns.free.push(...splitGuillotine(free, placed, splitKind));
              ns.free = prune(ns.free);
              next.push(ns);
            }
          }
        }
      }
      if(!next.length) return null;
      next.sort((a,b)=>scoreState(a)-scoreState(b));
      return next.slice(0, beam);
    }

    let idx = 0;
    while(idx < items.length){
      let states = [newState()];
      let placedAny = false;
      let startIdx = idx;
      while(idx < items.length){
        const it = items[idx];
        const n = expand(states, it);
        if(!n){
          break;
        }
        states = n;
        placedAny = true;
        idx++;
      }

      // jeśli nie udało się wstawić nawet jednego elementu na pustą płytę
      if(!placedAny){
        const s = { boardW: W, boardH: H, placements: [] };
        const it = items[idx];
        s.placements.push({ id: it.id, key: it.key, name: it.name, x:0, y:0, w: it.w, h: it.h, rotated:false, unplaced:true });
        sheets.push(s);
        idx++;
        continue;
      }

      const best = states[0];
      sheets.push({ boardW: W, boardH: H, placements: best.placements });

      // safety: jeśli algorytm utknął bez postępu, przeskocz
      if(idx === startIdx) idx++;
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
    const bw = sheet.usableW || sheet.boardW;
    const bh = sheet.usableH || sheet.boardH;
    const areaBoard = bw * bh;
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
    packGuillotinePro,
    packMaxRects,
    calcWaste,
  };
})();

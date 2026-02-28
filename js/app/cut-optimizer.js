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

  // ===== Shelf heuristic ("pasy"). direction:
  // 'wzdłuż'  -> układanie w wierszach (X rośnie, nowy wiersz w dół)
  // 'wpoprz'  -> układanie w kolumnach (Y rośnie, nowa kolumna w prawo)
  // 'auto'    -> decyzję podejmuje warstwa wyżej (rozrys.js)
  function packShelf(itemsIn, boardW, boardH, kerf, direction){
    const W = clampInt(boardW, 2800);
    const H = clampInt(boardH, 2070);
    const K = Math.max(0, Math.round(Number(kerf)||0));

    const mode = (direction === 'wpoprz') ? 'col' : 'row';
    const BW = W;
    const BH = H;

    const items = sortRectsByMaxSideDesc(itemsIn);
    const sheets = [];

    function newSheet(){
      sheets.push({ boardW: BW, boardH: BH, placements: [] });
      return sheets[sheets.length-1];
    }

    let sheet = newSheet();
    let cursorX = 0;
    let cursorY = 0;
    let rowH = 0;     // for row-mode
    let colW = 0;     // for col-mode

    function placeOne(it){
      const opts = [];
      // try as-is
      opts.push({ w: it.w, h: it.h, rotated: false });
      if(it.rotationAllowed) opts.push({ w: it.h, h: it.w, rotated: true });

      for(const o of opts){
        if(mode === 'row'){
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
        } else {
          // column-mode ("w poprzek")
          if(cursorY + o.h > BH){
            cursorY = 0;
            cursorX = cursorX + colW + (colW>0 ? K : 0);
            colW = 0;
          }
          if(cursorX + o.w > BW){
            sheet = newSheet();
            cursorX = 0;
            cursorY = 0;
            colW = 0;
          }
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
            cursorY = cursorY + o.h + K;
            colW = Math.max(colW, o.w);
            return true;
          }
        }
      }
      return false;
    }

    for(const it of items){
      // If auto direction, try with given BW/BH first; caller can run twice for swap.
      placeOne(it);
    }

    sheets.forEach(s=>{ s.boardW = W; s.boardH = H; });

    return sheets;
  }

  // ===== MaxRects (best short-side fit)
  // Poprawione: pełny split wszystkich przecinających się freeRect + pruning.
  // Kerf: traktujemy jako odstęp między elementami (padding w algorytmie),
  // a w placements przechowujemy realne w/h (bez paddingu).
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
          // wymagaj miejsca także na kerf jako odstęp (po prawej i na dole)
          const wNeed = Math.min(w + K, W); // clamp (gdy element prawie na całą płytę)
          const hNeed = Math.min(h + K, H);
          if(!rectFits(free, wNeed, hNeed)) continue;
          const sc = scoreFit(free, wNeed, hNeed);
          if(!best || sc.shortSide < best.sc.shortSide || (sc.shortSide === best.sc.shortSide && sc.longSide < best.sc.longSide)){
            best = { x: free.x, y: free.y, w, h, rotated: c.rotated, sc, free };
          }
        }
      }
      return best;
    }

    function intersects(a, b){
      return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
    }

    function splitFreeByPlaced(free, placedPad){
      const out = [];
      // left
      if(placedPad.x > free.x){
        out.push({ x: free.x, y: free.y, w: placedPad.x - free.x, h: free.h });
      }
      // right
      const rX = placedPad.x + placedPad.w;
      const rW = (free.x + free.w) - rX;
      if(rW > 0){
        out.push({ x: rX, y: free.y, w: rW, h: free.h });
      }
      // top
      if(placedPad.y > free.y){
        out.push({ x: free.x, y: free.y, w: free.w, h: placedPad.y - free.y });
      }
      // bottom
      const bY = placedPad.y + placedPad.h;
      const bH = (free.y + free.h) - bY;
      if(bH > 0){
        out.push({ x: free.x, y: bY, w: free.w, h: bH });
      }
      return out.filter(r=>r.w>0 && r.h>0);
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

      // Kerf padding area (to keep a gap between parts)
      const placedPad = { x: placed.x, y: placed.y, w: placed.w + K, h: placed.h + K };
      placedPad.w = Math.min(placedPad.w, sheet.boardW - placedPad.x);
      placedPad.h = Math.min(placedPad.h, sheet.boardH - placedPad.y);

      const next = [];
      for(const fr of sheet.freeRects){
        if(!intersects(fr, placedPad)){
          next.push(fr);
          continue;
        }
        next.push(...splitFreeByPlaced(fr, placedPad));
      }
      sheet.freeRects = pruneFreeRects(next);
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
    calcWaste,
  };
})();

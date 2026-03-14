(function(root){
  'use strict';

  const FC = root.FC = root.FC || {};

  function clampInt(v, def){
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? n : def;
  }

  function boardArea(w, h){
    return Math.max(0, Number(w) || 0) * Math.max(0, Number(h) || 0);
  }

  function placedArea(sheet){
    const arr = (sheet && Array.isArray(sheet.placements)) ? sheet.placements : [];
    let sum = 0;
    for(const p of arr){ if(p && !p.unplaced) sum += (Number(p.w) || 0) * (Number(p.h) || 0); }
    return sum;
  }

  function calcWaste(sheet){
    const total = boardArea(sheet && sheet.boardW, sheet && sheet.boardH);
    const used = placedArea(sheet);
    const waste = Math.max(0, total - used);
    return { total, used, waste, occupancy: total > 0 ? (used / total) : 0 };
  }

  function occupancyFrom(area, rectArea){
    return rectArea > 0 ? (area / rectArea) : 0;
  }

  function sortByAreaDesc(items){
    return (items || []).slice().sort((a,b)=>{
      const aa = (Number(a.w)||0) * (Number(a.h)||0);
      const bb = (Number(b.w)||0) * (Number(b.h)||0);
      if(bb !== aa) return bb - aa;
      const am = Math.max(Number(a.w)||0, Number(a.h)||0);
      const bm = Math.max(Number(b.w)||0, Number(b.h)||0);
      if(bm !== am) return bm - am;
      return String(a.id||'').localeCompare(String(b.id||''), 'pl');
    });
  }

  function countArea(items){
    let sum = 0;
    for(const it of (items || [])) sum += (Number(it.w)||0) * (Number(it.h)||0);
    return sum;
  }

  function makeItems(partsMm){
    const items = [];
    for(const p of (partsMm || [])){
      const qty = Math.max(1, clampInt(p.qty, 1));
      for(let i=0;i<qty;i++){
        items.push({
          id: `${p.key || p.name || 'el'}#${i+1}`,
          key: p.key || p.name || 'el',
          name: p.name || 'Element',
          w: Math.max(1, clampInt(p.w, 1)),
          h: Math.max(1, clampInt(p.h, 1)),
          material: p.material || '',
          rotationAllowed: !!p.rotationAllowed,
          edgeW1: !!p.edgeW1,
          edgeW2: !!p.edgeW2,
          edgeH1: !!p.edgeH1,
          edgeH2: !!p.edgeH2,
        });
      }
    }
    return items;
  }

  function cloneItem(it){ return Object.assign({}, it); }
  function cloneItems(items){ return (items || []).map(cloneItem); }

  function itemArea(it){ return (Number(it.w)||0) * (Number(it.h)||0); }

  function orientations(item){
    const list = [{ w: item.w, h: item.h, rotated: false }];
    if(item.rotationAllowed && item.w !== item.h){
      list.push({ w: item.h, h: item.w, rotated: true });
    }
    return list;
  }

  function fitsInRect(item, rect){
    for(const o of orientations(item)){
      if(o.w <= rect.w && o.h <= rect.h) return true;
    }
    return false;
  }

  function anyItemFits(items, rect){
    for(const it of (items || [])) if(fitsInRect(it, rect)) return true;
    return false;
  }

  function swapEdgesForRotation(item){
    return {
      edgeW1: item.edgeH1,
      edgeW2: item.edgeH2,
      edgeH1: item.edgeW1,
      edgeH2: item.edgeW2,
    };
  }

  function makePlacement(item, x, y, oriented){
    const edges = oriented.rotated ? swapEdgesForRotation(item) : {
      edgeW1: item.edgeW1,
      edgeW2: item.edgeW2,
      edgeH1: item.edgeH1,
      edgeH2: item.edgeH2,
    };
    return {
      id: item.id,
      key: item.key,
      name: item.name,
      x, y,
      w: oriented.w,
      h: oriented.h,
      rotated: !!oriented.rotated,
      edgeW1: !!edges.edgeW1,
      edgeW2: !!edges.edgeW2,
      edgeH1: !!edges.edgeH1,
      edgeH2: !!edges.edgeH2,
    };
  }

  function createSheet(boardW, boardH){
    return { boardW, boardH, placements: [] };
  }

  function removeItemsById(items, idSet){
    return (items || []).filter(it => !idSet.has(it.id));
  }

  function estimateSheetsByArea(items, boardW, boardH){
    const total = countArea(items);
    const per = Math.max(1, boardArea(boardW, boardH));
    return Math.max(1, Math.ceil(total / per));
  }

  function compareSheetScores(a, b){
    if(!b) return 1;
    if(!a) return -1;
    if(a.usedArea !== b.usedArea) return a.usedArea > b.usedArea ? 1 : -1;
    if(a.placementCount !== b.placementCount) return a.placementCount > b.placementCount ? 1 : -1;
    if(a.waste !== b.waste) return a.waste < b.waste ? 1 : -1;
    if(a.primaryBands !== b.primaryBands) return a.primaryBands > b.primaryBands ? 1 : -1;
    return 0;
  }

  function bandScore(band){
    if(!band) return -Infinity;
    return (band.accepted ? 1e12 : 0)
      + Math.round((band.occupancy || 0) * 1e9)
      + (band.area || 0) * 1000
      + (band.count || 0) * 100
      - (band.bandSize || 0);
  }

  function compareBand(a, b){
    const sa = bandScore(a), sb = bandScore(b);
    if(sa === sb) return 0;
    return sa > sb ? 1 : -1;
  }

  function normalizeStartMode(v){
    if(v === 'start-across' || v === 'across') return 'start-across';
    if(v === 'start-optimax' || v === 'optimax' || v === 'optima') return 'start-optimax';
    return 'start-along';
  }

  function normalizeSpeedMode(v){
    const s = String(v || '').toLowerCase();
    if(s === 'turbo') return 'turbo';
    if(s === 'dokladnie' || s === 'dokładnie' || s === 'exact') return 'dokladnie';
    return 'max';
  }

  // axis: 'along' => columns, 'across' => rows
  function packShelf(itemsIn, boardW, boardH, kerf, axis){
    const W = Math.max(1, clampInt(boardW, 2800));
    const H = Math.max(1, clampInt(boardH, 2070));
    const K = Math.max(0, clampInt(kerf, 0));
    const items = sortByAreaDesc(cloneItems(itemsIn));
    const useCols = (axis === 'along');
    const BW = useCols ? H : W;
    const BH = useCols ? W : H;
    const sheets = [];

    function newSheet(){
      const s = { boardW: BW, boardH: BH, placements: [] };
      sheets.push(s);
      return s;
    }

    let sheet = newSheet();
    let cx = 0, cy = 0, rowH = 0;

    for(const item of items){
      let placed = false;
      const opts = orientations(item).filter(o=>o.w <= BW && o.h <= BH);
      opts.sort((a,b)=> ((b.w*b.h) - (a.w*a.h)) || (b.w - a.w) || (b.h - a.h));
      for(const o of opts){
        if(cx > 0 && cx + o.w > BW){
          cx = 0;
          cy += rowH + (rowH > 0 ? K : 0);
          rowH = 0;
        }
        if(cy > 0 && cy + o.h > BH){
          sheet = newSheet();
          cx = 0; cy = 0; rowH = 0;
        }
        if(cx + o.w <= BW && cy + o.h <= BH){
          sheet.placements.push(makePlacement(item, cx, cy, o));
          cx += o.w + K;
          rowH = Math.max(rowH, o.h);
          placed = true;
          break;
        }
      }
      if(!placed){
        const fallback = opts[0];
        if(fallback){
          sheet = newSheet();
          sheet.placements.push(makePlacement(item, 0, 0, fallback));
          cx = fallback.w + K;
          cy = 0;
          rowH = fallback.h;
        }
      }
    }

    if(useCols){
      for(const s of sheets){
        for(const p of s.placements){
          const nx = p.y;
          const ny = p.x;
          const nw = p.h;
          const nh = p.w;
          const ew1 = p.edgeW1, ew2 = p.edgeW2, eh1 = p.edgeH1, eh2 = p.edgeH2;
          p.x = nx; p.y = ny; p.w = nw; p.h = nh;
          p.edgeW1 = eh1; p.edgeW2 = eh2;
          p.edgeH1 = ew1; p.edgeH2 = ew2;
        }
        s.boardW = W;
        s.boardH = H;
      }
    } else {
      for(const s of sheets){ s.boardW = W; s.boardH = H; }
    }
    return sheets;
  }

  FC.cutOptimizer = {
    clampInt,
    boardArea,
    placedArea,
    calcWaste,
    occupancyFrom,
    sortByAreaDesc,
    countArea,
    itemArea,
    makeItems,
    cloneItem,
    cloneItems,
    orientations,
    fitsInRect,
    anyItemFits,
    makePlacement,
    createSheet,
    removeItemsById,
    estimateSheetsByArea,
    compareSheetScores,
    compareBand,
    normalizeStartMode,
    normalizeSpeedMode,
    packShelf,
  };
})(typeof self !== 'undefined' ? self : window);

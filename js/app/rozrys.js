/* rozrys.js — ROZRYS (MVP) podobny do e-rozrys: wejście z zakładki ROZRYS
   Wymagania:
   - Źródło formatek: zakładka "Materiały" (getCabinetCutList)
   - osobne rozkroje per materiał
   - magazyn płyt (opcjonalnie) do podpowiadania formatów
   - kerf 4mm
   - obsługa słoi: globalnie + per-element override "pozwól obrót"
   - wybór heurystyki + kierunku cięcia
   - eksport: CSV + "PDF" przez okno drukowania
*/

(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const OVERRIDE_KEY = 'fc_rozrys_overrides_v1';
  const EDGE_KEY = 'fc_edge_v1';
  const PANEL_PREFS_KEY = 'fc_rozrys_panel_prefs_v1';

  function safeGetProject(){
    try{
      if(typeof projectData !== 'undefined' && projectData) return projectData;
      return (window.projectData || null);
    }catch(_){
      return null;
    }
  }

  function getRooms(){
    try{
      if(FC.schema && Array.isArray(FC.schema.ROOMS)) return FC.schema.ROOMS;
    }catch(_){ }
    return ['kuchnia','szafa','pokoj','lazienka'];
  }

  function parseLocaleNumber(v){
    if(v === null || v === undefined) return NaN;
    if(typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    const s = String(v).trim().replace(',', '.');
    if(!s) return NaN;
    return Number(s);
  }

  function cmToMm(v){
    // obsługa 0.1cm -> 1mm
    const n = parseLocaleNumber(v);
    if(!Number.isFinite(n)) return 0;
    return Math.round(n * 10);
  }

  function mmToStr(mm){
    const n = Math.round(Number(mm)||0);
    return String(n);
  }

  // Display length stored in millimeters in the selected unit.
  // - mm: integer
  // - cm: one decimal when needed, without trailing .0
  function mmToUnitStr(mm, unit){
    const u = (unit === 'cm') ? 'cm' : 'mm';
    const n = Math.round(Number(mm)||0);
    if(u === 'mm') return String(n);
    const cm = n / 10;
    const s = (Math.round(cm * 10) / 10).toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  }

  function loadOverrides(){
    try{
      const raw = localStorage.getItem(OVERRIDE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(_){
      return {};
    }
  }

  function saveOverrides(obj){
    try{ localStorage.setItem(OVERRIDE_KEY, JSON.stringify(obj || {})); }catch(_){ }
  }

  function loadPanelPrefs(){
    try{
      const raw = localStorage.getItem(PANEL_PREFS_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(_){
      return {};
    }
  }

  function savePanelPrefs(obj){
    try{ localStorage.setItem(PANEL_PREFS_KEY, JSON.stringify(obj || {})); }catch(_){ }
  }

  function loadEdgeStore(){
    try{
      const raw = localStorage.getItem(EDGE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(_){
      return {};
    }
  }

  function partSignature(p){
    // stabilny klucz do override: materiał + nazwa + w/h
    return `${p.material||''}||${p.name||''}||${p.w}x${p.h}`;
  }

  function aggregatePartsForProject(){
    const proj = safeGetProject();
    if(!proj) return { byMaterial: {}, materials: [] };

    const byMaterial = {};
    const rooms = getRooms();
    for(const room of rooms){
      const cabinets = (proj[room] && Array.isArray(proj[room].cabinets)) ? proj[room].cabinets : [];
      for(const cab of cabinets){
        if(typeof getCabinetCutList !== 'function') continue;
        const parts = getCabinetCutList(cab, room) || [];
        for(const p of parts){
          const material = String(p.material||'').trim();
          if(!material) continue;
          const w = cmToMm(p.a);
          const h = cmToMm(p.b);
          if(!(w>0 && h>0)) continue;
          const name = String(p.name||'Element');
          const key = `${name}||${w}||${h}`;
          byMaterial[material] = byMaterial[material] || new Map();
          const map = byMaterial[material];
          if(map.has(key)){
            map.get(key).qty += Number(p.qty)||0;
          } else {
            map.set(key, {
              name,
              w,
              h,
              qty: Number(p.qty)||1,
              material,
            });
          }
        }
      }
    }

    const outByMat = {};
    const materials = Object.keys(byMaterial).sort((a,b)=>a.localeCompare(b,'pl'));
    for(const m of materials){
      outByMat[m] = Array.from(byMaterial[m].values()).sort((a,b)=>{
        const aa = Math.max(a.w,a.h);
        const bb = Math.max(b.w,b.h);
        return bb-aa;
      });
    }
    return { byMaterial: outByMat, materials };
  }

  function isFrontMaterialKey(materialKey){
    return /^\s*Front\s*:/i.test(String(materialKey||''));
  }

  function normalizeFrontLaminatMaterialKey(materialKey){
    // Jeśli front jest z laminatu i ma kolor jak korpus, łączymy pod ten sam klucz materiału.
    // Fronty w Materiałach mają postać: "Front: laminat • <KOLOR>".
    const m = String(materialKey||'').match(/^\s*Front\s*:\s*laminat\s*•\s*(.+)$/i);
    return m ? String(m[1]||'').trim() : String(materialKey||'').trim();
  }

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      for(const k in attrs){
        if(k==='class') el.className = attrs[k];
        else if(k==='html') el.innerHTML = attrs[k];
        else if(k==='text') el.textContent = attrs[k];
        else el.setAttribute(k, attrs[k]);
      }
    }
    (children||[]).forEach(ch=> el.appendChild(ch));
    return el;
  }

  // edgeSubMm: 0 => show nominal dimensions, >0 => show "do cięcia" dims (kompensacja okleiny)
  // Zasada kompensacji (zgodnie z ustaleniem):
  // - okleina na krawędziach W (top/bottom) zwiększa wymiar H => odejmujemy od H
  // - okleina na krawędziach H (left/right) zwiększa wymiar W => odejmujemy od W
  function drawSheet(canvas, sheet, displayUnit, edgeSubMm, boardMeta){
    try{
      const ctx = canvas.getContext('2d');
      const unit = (displayUnit === 'cm') ? 'cm' : 'mm';
      const metaBoardW = Number(boardMeta && boardMeta.boardW) || Number(sheet.fullBoardW) || Number(sheet.boardW) || 0;
      const metaBoardH = Number(boardMeta && boardMeta.boardH) || Number(sheet.fullBoardH) || Number(sheet.boardH) || 0;
      const trimMm = Math.max(0, Number(boardMeta && boardMeta.trim) || Number(sheet.trimMm) || 0);
      const W = Math.max(1, metaBoardW);
      const H = Math.max(1, metaBoardH);
      const usableW = Math.max(1, W - 2*trimMm);
      const usableH = Math.max(1, H - 2*trimMm);

      const maxW = Math.min(900, canvas.parentElement ? canvas.parentElement.clientWidth : 900);
      const scale = maxW / W;
      canvas.width = Math.round(W * scale);
      canvas.height = Math.round(H * scale);

      ctx.clearRect(0,0,canvas.width, canvas.height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#0b1f33';
      ctx.strokeRect(0.5,0.5,canvas.width-1,canvas.height-1);

      // Pixel-snapping helpers (reduces anti-aliasing differences: "czarne" vs "szare" linie)
      // For odd line widths (1px) draw on half-pixel boundaries.
      const snap = (v, lw)=>{
        const n = Math.round(v);
        return (lw % 2) ? (n + 0.5) : n;
      };
      const snapRect = (x,y,w,h,lw)=>{
        const sx = snap(x, lw);
        const sy = snap(y, lw);
        // keep size consistent after snapping start
        const sw = Math.max(0, Math.round(w));
        const sh = Math.max(0, Math.round(h));
        return { sx, sy, sw, sh };
      };
      const strokeLine = (x1,y1,x2,y2,lw)=>{
        const sx1 = snap(x1, lw);
        const sy1 = snap(y1, lw);
        const sx2 = snap(x2, lw);
        const sy2 = snap(y2, lw);
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
      };

      if(trimMm > 0){
        const trimPx = trimMm * scale;
        const usableRect = snapRect(trimPx, trimPx, usableW * scale, usableH * scale, 1);
        ctx.save();
        ctx.fillStyle = 'rgba(11, 31, 51, 0.04)';
        ctx.fillRect(0, 0, canvas.width, trimPx);
        ctx.fillRect(0, canvas.height - trimPx, canvas.width, trimPx);
        ctx.fillRect(0, trimPx, trimPx, Math.max(0, canvas.height - trimPx*2));
        ctx.fillRect(canvas.width - trimPx, trimPx, trimPx, Math.max(0, canvas.height - trimPx*2));
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(11, 31, 51, 0.55)';
        ctx.strokeRect(usableRect.sx, usableRect.sy, Math.max(0, usableRect.sw-1), Math.max(0, usableRect.sh-1));
        ctx.restore();
      }

      const halfBoardW = Math.max(0, Number(sheet && (sheet.realHalfBoardW || sheet.virtualBoardW)) || 0);
      const halfBoardH = Math.max(0, Number(sheet && (sheet.realHalfBoardH || sheet.virtualBoardH)) || 0);
      const halfDividerAxis = String((sheet && sheet.halfDividerAxis) || '').toLowerCase();
      const halfDividerPos = Math.max(0, Number(sheet && sheet.halfDividerPos) || 0);
      const showHalfDivider = !!(sheet && (sheet.realHalf || sheet.realHalfFromStock || sheet.virtualHalf))
        && ((halfDividerAxis === 'vertical' && halfDividerPos > 0 && halfDividerPos < W)
          || (halfDividerAxis === 'horizontal' && halfDividerPos > 0 && halfDividerPos < H)
          || (!halfDividerAxis && ((halfBoardW > 0 && halfBoardW < W) || (halfBoardH > 0 && halfBoardH < H))));
      const drawHalfDivider = ()=>{
        if(!showHalfDivider) return;
        ctx.save();
        ctx.setLineDash([10, 6]);
        ctx.strokeStyle = 'rgba(11, 31, 51, 0.98)';
        ctx.lineWidth = 2;
        if(halfDividerAxis === 'vertical'){
          const x = halfDividerPos * scale;
          strokeLine(x, 0, x, canvas.height, 2);
        } else if(halfDividerAxis === 'horizontal'){
          const y = halfDividerPos * scale;
          strokeLine(0, y, canvas.width, y, 2);
        } else if(halfBoardW > 0 && halfBoardW < W){
          const x = halfBoardW * scale;
          strokeLine(x, 0, x, canvas.height, 2);
        } else if(halfBoardH > 0 && halfBoardH < H){
          const y = halfBoardH * scale;
          strokeLine(0, y, canvas.width, y, 2);
        }
        ctx.restore();
      };

      const placements = (sheet.placements||[]).filter(p=>!p.unplaced);
      // Base font; for tiny parts we will temporarily shrink it.
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      const sub = Math.max(0, Number(edgeSubMm)||0);
      const getCutDims = (p)=>{
        if(!(sub>0)) return { w:p.w, h:p.h };
        const cW = (p.edgeH1?1:0) + (p.edgeH2?1:0);
        const cH = (p.edgeW1?1:0) + (p.edgeW2?1:0);
        // cross-dimension compensation
        const w = Math.max(0, Math.round((p.w||0) - sub*cW));
        const h = Math.max(0, Math.round((p.h||0) - sub*cH));
        return { w, h };
      };

      placements.forEach(p=>{
        const x = (trimMm + p.x) * scale;
        const y = (trimMm + p.y) * scale;
        const w = p.w * scale;
        const hh = p.h * scale;

        // Visual gap between parts (for readability only).
        // Shrink each part by 1px on every side => 2px gap between adjacent parts.
        const gap = 1;
        // Round to whole pixels before we apply pixel-snapping.
        // This makes left/right and top/bottom offsets visually symmetric.
        const vx = Math.round(x + gap);
        const vy = Math.round(y + gap);
        const vw = Math.max(0, Math.round(w - gap*2));
        const vh = Math.max(0, Math.round(hh - gap*2));

        ctx.fillStyle = 'rgba(11, 141, 183, 0.10)';
        ctx.fillRect(vx,vy,vw,vh);
        ctx.strokeStyle = 'rgba(11, 31, 51, 0.55)';
        {
          const r = snapRect(vx, vy, vw, vh, 1);
          ctx.lineWidth = 1;
          // draw inside the filled rect
          ctx.strokeRect(r.sx, r.sy, Math.max(0, r.sw-1), Math.max(0, r.sh-1));
        }

        // ===== Dimension labels + okleina (ciągła linia: 3px od krawędzi, wymiary: 6px) =====
        // Wymiary mają być rysowane zawsze tak samo jak na "600x510":
        // - wymiar W (wzdłuż słoja / 1) poziomo u góry
        // - wymiar H (w poprzek / 2) pionowo po lewej (obrót 90°)
        // Bez specjalnych wyjątków dla małych elementów (mogą wyjść poza ramkę).
        ctx.fillStyle = '#0b1f33';
        const cut = getCutDims(p);
        const wLabel = `${mmToUnitStr(cut.w, unit)}`;
        const hLabel = `${mmToUnitStr(cut.h, unit)}`;

        const pad = 4;
        // Keep a constant font size (user requirement: never rotate; keep centered even if it overflows).
        const fontSize = 12;

        // Edge banding markers (optional): solid line 3px from border; shorten by 5% so it's visible on short edges.
        const hasEdges = !!(p.edgeW1 || p.edgeW2 || p.edgeH1 || p.edgeH2);
        const edgeInset = 3; // px inside the part (okleina)
        // Dimensions should sit very close to the okleina marker for readability.
        // Requirement: digits ~1px away from okleina line.
        // => put dimension text at (edgeInset + 1) from the same border.
        const dimInset = edgeInset + 1;
        if(hasEdges){
          ctx.save();
          ctx.setLineDash([]);
          // Slightly lighter than the part outline so it doesn't overpower dimensions.
          ctx.strokeStyle = 'rgba(11, 31, 51, 0.45)';

          const shortPad = (len)=>{
            const p5 = Math.max(1, Math.floor(len * 0.025)); // 2.5% each side => 95% visible
            return p5;
          };
          const padX = shortPad(vw);
          const padY = shortPad(vh);
          // top (dim1 side A)
          if(p.edgeW1){
            strokeLine(vx+padX, vy+edgeInset, vx+vw-padX, vy+edgeInset, 1);
          }
          // bottom (dim1 side B)
          if(p.edgeW2){
            strokeLine(vx+padX, vy+vh-edgeInset, vx+vw-padX, vy+vh-edgeInset, 1);
          }
          // left (dim2 side A)
          if(p.edgeH1){
            strokeLine(vx+edgeInset, vy+padY, vx+edgeInset, vy+vh-padY, 1);
          }
          // right (dim2 side B)
          if(p.edgeH2){
            strokeLine(vx+vw-edgeInset, vy+padY, vx+vw-edgeInset, vy+vh-padY, 1);
          }
          ctx.restore();
        }

        // top label (width) — centered; visually keep ~6px from top border
        {
          const tw = ctx.measureText(wLabel).width;
          const tx = vx + (vw - tw) / 2;
          const mt = ctx.measureText('0');
          const ascent = (mt && mt.actualBoundingBoxAscent) ? mt.actualBoundingBoxAscent : Math.round(fontSize * 0.8);
          const baseY = vy + dimInset + ascent;
          ctx.fillText(wLabel, tx, baseY);
        }

        // height label — ALWAYS rotated 90° on the left, centered vertically (like "600x510").
        // IMPORTANT: keep the visual gap to the okleina line consistent with top label.
        // We want the nearest edge of glyphs to be ~1px from the okleina marker.
        {
          const mtH = ctx.measureText(hLabel);
          const ascH = (mtH && mtH.actualBoundingBoxAscent) ? mtH.actualBoundingBoxAscent : Math.round(fontSize * 0.8);
          const desH = (mtH && mtH.actualBoundingBoxDescent) ? mtH.actualBoundingBoxDescent : Math.round(fontSize * 0.2);
          const textH = ascH + desH;

          // Left okleina marker is at (vx + edgeInset). Keep ~1px between marker and text.
          // When rotated, the text height becomes horizontal extent. With textBaseline='middle',
          // half of that extent is on the left side of the origin.
          const originX = vx + edgeInset + 1 + (textH / 2);

          ctx.save();
          ctx.translate(originX, vy + vh/2);
          ctx.rotate(-Math.PI/2);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(hLabel, 0, 0);
          ctx.restore();
        }
      });
      drawHalfDivider();
    }catch(_){ }
  }

  function buildCsv(sheets, meta){
    const lines = [];
    lines.push(['material','sheet_no','board_w_mm','board_h_mm','item','w_mm','h_mm','x_mm','y_mm','rotated'].join(';'));
    const sub = Math.max(0, Number(meta && meta.edgeSubMm)||0);
    const cutDims = (p)=>{
      if(!(sub>0)) return { w:p.w, h:p.h };
      const cW = (p.edgeH1?1:0) + (p.edgeH2?1:0);
      const cH = (p.edgeW1?1:0) + (p.edgeW2?1:0);
      return {
        w: Math.max(0, Math.round((p.w||0) - sub*cW)),
        h: Math.max(0, Math.round((p.h||0) - sub*cH)),
      };
    };
    sheets.forEach((s, i)=>{
      (s.placements||[]).filter(p=>!p.unplaced).forEach(p=>{
        const d = cutDims(p);
        lines.push([
          meta.material || '',
          String(i+1),
          String(s.boardW),
          String(s.boardH),
          (p.name||p.key||p.id||''),
          String(d.w),
          String(d.h),
          String(p.x),
          String(p.y),
          p.rotated ? '1':'0'
        ].join(';'));
      });
    });
    return lines.join('\n');
  }

  function downloadText(filename, content, mime){
    try{
      const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }catch(_){
      alert('Nie udało się pobrać pliku.');
    }
  }

  function openPrintView(html){
    try{
      const w = window.open('', '_blank');
      if(!w) return alert('Przeglądarka zablokowała okno (pop-up).');
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(()=>{ try{ w.print(); }catch(_){ } }, 250);
    }catch(_){
      alert('Nie udało się otworzyć podglądu PDF.');
    }
  }

  function computePlan(state, parts){
    const opt = FC.cutOptimizer;
    if(!opt) return { sheets: [], note: 'Brak modułu cutOptimizer.' };

    const grainOn = !!state.grain;
    const overrides = loadOverrides();
    const edgeStore = loadEdgeStore();

    const partsMm = (parts||[]).map(p=>{
      const sig = partSignature(p);
      const allow = grainOn ? !!overrides[sig] : true;
      const e = edgeStore[sig] || {};
      return {
        key: sig,
        name: p.name,
        w: p.w,
        h: p.h,
        qty: p.qty,
        material: p.material,
        rotationAllowed: grainOn ? allow : true,
        edgeW1: !!e.w1,
        edgeW2: !!e.w2,
        edgeH1: !!e.h1,
        edgeH2: !!e.h2,
      };
    });
    const items = opt.makeItems(partsMm);

    const unit = (state.unit === 'mm') ? 'mm' : 'cm';
    const toMm = (v)=> {
      const n = Number(v);
      if(!Number.isFinite(n)) return 0;
      return unit === 'mm' ? Math.round(n) : Math.round(n * 10);
    };

    const W0 = toMm(state.boardW) || 2800;
    const H0 = toMm(state.boardH) || 2070;
    const K  = toMm(state.kerf)   || 4;
    const trim = toMm(state.edgeTrim) || 20; // default 2 cm

    // usable area after edge trimming (equalizing)
    const W = Math.max(10, W0 - 2*trim);
    const H = Math.max(10, H0 - 2*trim);

    let sheets = [];

    if(state.heur === 'super'){
      if(typeof opt.packSuper !== 'function'){
        return { sheets: [], note: 'Brak modułu SUPER (packSuper).' };
      }
      // Multi-start search (few seconds). Best result by (#sheets, waste).
      sheets = opt.packSuper(items, W, H, K, { timeMs: 2600, beamWidth: 140 });
    }
    else if(state.heur === 'panel30'){
      // Panel saw friendly: guillotine-only plan with longer thinking time.
      // Uses the existing Guillotine Beam Search (non-overlapping by construction).
      if(typeof opt.packGuillotineBeam !== 'function'){
        return { sheets: [], note: 'Brak modułu Gilotyna PRO (packGuillotineBeam).' };
      }
      sheets = opt.packGuillotineBeam(items, W, H, K, {
        beamWidth: 260,
        timeMs: 30000,
        cutPref: normalizeCutDirection(state.direction),
        scrapFirst: true,
      });
    }
    else if(state.heur === 'gpro'){
      if(typeof opt.packGuillotineBeam !== 'function'){
        return { sheets: [], note: 'Brak modułu Gilotyna PRO (packGuillotineBeam).' };
      }
      // Dokładne upakowanie (szybciej niż Panel PRO, ale lepiej niż Shelf)
      sheets = opt.packGuillotineBeam(items, W, H, K, {
        beamWidth: 80,
        timeMs: 700,
      });
    } else {
      const dir = normalizeCutDirection(state.direction);
      const toShelfDir = (d)=> (d==='across') ? 'wpoprz' : 'wzdłuż';
      sheets = opt.packShelf(items, W, H, K, toShelfDir(dir));
    }
    // store meta for drawing offset
    return { sheets, meta: { trim, boardW: W0, boardH: H0, unit } };
  }

  function getOptimaxProfilePreset(){
    return {};
  }

  function normalizeCutDirection(dir){
    if(dir === 'start-across' || dir === 'across') return 'start-across';
    if(dir === 'start-optimax' || dir === 'optimax' || dir === 'optima') return 'start-optimax';
    return 'start-along';
  }

  function speedLabel(mode){
    const m = String(mode || 'max').toLowerCase();
    if(m === 'turbo') return 'Turbo';
    if(m === 'dokladnie' || m === 'dokładnie') return 'Dokładnie';
    return 'MAX';
  }

  function directionLabel(dir){
    const norm = normalizeCutDirection(dir);
    if(norm === 'start-across') return 'Pierwsze pasy w poprzek';
    if(norm === 'start-optimax') return 'Opti-max';
    return 'Pierwsze pasy wzdłuż';
  }

  function formatHeurLabel(st){
    if(st && st.heur === 'optimax'){
      return `${speedLabel(st.optimaxProfile || 'max')} • ${directionLabel(st.direction)}`;
    }
    return String((st && st.heur) || '');
  }

  // ===== Panel-saw PRO / Optimax in Web Worker (non-blocking) =====
  // Uwaga: na mobile WebWorker potrafi "zawisnąć" sporadycznie (brak done/error).
  // Dlatego uruchamiamy worker per-run (bez re-używania singletona) + watchdog + hard reset.
  function computePlanPanelProAsync(state, parts, onProgress, control, panelOpts){
    return new Promise((resolve)=>{
      const opt = FC.cutOptimizer;
      if(!opt) return resolve({ sheets: [], note: 'Brak modułu cutOptimizer.' });
      const requestedSpeedMode = opt && typeof opt.normalizeSpeedMode === 'function'
        ? opt.normalizeSpeedMode((panelOpts && (panelOpts.speedMode || panelOpts.optimaxProfile)) || state.optimaxProfile)
        : String(((panelOpts && (panelOpts.speedMode || panelOpts.optimaxProfile)) || state.optimaxProfile || 'max')).toLowerCase();
      const blockMainThreadFallback = requestedSpeedMode === 'max';

      const grainOn = !!state.grain;
      const overrides = loadOverrides();
      const edgeStore = loadEdgeStore();

      const partsMm = (parts||[]).map(p=>{
        const sig = partSignature(p);
        const allow = grainOn ? !!overrides[sig] : true;
        const e = edgeStore[sig] || {};
        return {
          key: sig,
          name: p.name,
          w: p.w,
          h: p.h,
          qty: p.qty,
          material: p.material,
          rotationAllowed: grainOn ? allow : true,
          edgeW1: !!e.w1,
          edgeW2: !!e.w2,
          edgeH1: !!e.h1,
          edgeH2: !!e.h2,
        };
      });
      const items = opt.makeItems(partsMm);

      const unit = (state.unit === 'mm') ? 'mm' : 'cm';
      const toMm = (v)=> {
        const n = Number(v);
        if(!Number.isFinite(n)) return 0;
        return unit === 'mm' ? Math.round(n) : Math.round(n * 10);
      };

      const W0 = toMm(state.boardW) || 2800;
      const H0 = toMm(state.boardH) || 2070;
      const K  = toMm(state.kerf)   || 4;
      const trim = toMm(state.edgeTrim) || 20;
      const W = Math.max(10, W0 - 2*trim);
      const H = Math.max(10, H0 - 2*trim);

      // worker per-run (bardziej niezawodne na telefonach)
      let worker = null;
      try{
        // bump query to avoid stale cached worker on GH Pages / mobile browsers
        worker = new Worker('js/app/panel-pro-worker.js?v=20260315_half_reflow_v5');
      }catch(e){
        if(blockMainThreadFallback){
          return resolve({ sheets: [], note: 'Nie udało się uruchomić Web Workera dla trybu MAX.', workerFailed: true, noSyncFallback: true, meta: { trim, boardW: W0, boardH: H0, unit } });
        }
        // fallback (sync, limited)
        try{
          const startMode = normalizeCutDirection(state.direction);
          const speedMode = FC.cutOptimizer && FC.cutOptimizer.normalizeSpeedMode ? FC.cutOptimizer.normalizeSpeedMode(state.optimaxProfile) : 'max';
          const startStrategy = FC.rozkrojStarts && FC.rozkrojStarts[startMode];
          const speed = FC.rozkrojSpeeds && FC.rozkrojSpeeds[speedMode];
          const packed = speed && typeof speed.pack === 'function'
            ? speed.pack(items, W, H, K, { startStrategy, startMode, speedMode })
            : { sheets: opt.packShelf(items, W, H, K, 'along') };
          return resolve({ sheets: packed.sheets || [], meta: { trim, boardW: W0, boardH: H0, unit } });
        }catch(_){
          return resolve({ sheets: [], note: 'Nie udało się uruchomić Web Worker.', workerFailed: true, meta: { trim, boardW: W0, boardH: H0, unit } });
        }
      }

      let settled = false;
      let tmr = null;

      // allow caller to cancel this run
      const runId = (control && Number(control.runId)) ? Number(control.runId) : 0;
      if(control){
        // If UI requested cancel before we managed to attach a working cancel() (race), honor it.
        const postCancel = ()=>{ try{ worker && worker.postMessage({ cmd:'cancel', runId }); }catch(_){ } };
        control.cancel = ()=>{ control._cancelRequested = true; postCancel(); };
        // If cancel was requested earlier, send it immediately.
        if(control._cancelRequested) postCancel();
      }

      const cleanup = ()=>{
        try{ worker.removeEventListener('message', handle); }catch(_){ }
        try{ worker.removeEventListener('error', onErr); }catch(_){ }
        try{ worker.removeEventListener('messageerror', onMsgErr); }catch(_){ }
        if(tmr){ try{ clearTimeout(tmr); }catch(_){ } tmr = null; }
        try{ worker.terminate(); }catch(_){ }
        worker = null;
      };

      const finish = (payload)=>{
        if(settled) return;
        settled = true;
        cleanup();
        resolve(payload);
      };
      // hard-terminate fallback (used by UI when cancel seems stuck)
      if(control){
        control._terminate = ()=>{
          try{ worker && worker.terminate && worker.terminate(); }catch(_){ }
          // unblock UI even if worker does not respond
          try{ finish({ sheets: [], cancelled: true, note: "Generowanie przerwane.", meta: { trim, boardW: W0, boardH: H0, unit } }); }catch(_){ }
        };
      }


      const handle = (ev)=>{
        const msg = ev && ev.data ? ev.data : {};
        if(msg.type === 'progress'){
          try{ onProgress && onProgress(msg); }catch(_){ }
          return;
        }
        if(msg.type === 'done'){
          const result = msg.result || {};
          finish({ sheets: result.sheets || [], cancelled: !!result.cancelled, meta: { trim, boardW: W0, boardH: H0, unit } });
          return;
        }
        if(msg.type === 'error'){
          finish({ sheets: [], note: msg.error || 'Błąd worker', workerFailed: true, noSyncFallback: !!blockMainThreadFallback, meta: { trim, boardW: W0, boardH: H0, unit } });
        }
      };

      const onErr = ()=>{
        // Worker script failed to load or runtime error
        finish({ sheets: [], note: 'Błąd Web Workera (nie udało się wykonać obliczeń).', workerFailed: true, noSyncFallback: !!blockMainThreadFallback, meta: { trim, boardW: W0, boardH: H0, unit } });
      };

      const onMsgErr = ()=>{
        finish({ sheets: [], note: 'Błąd komunikacji z Web Workerem.', workerFailed: true, noSyncFallback: !!blockMainThreadFallback, meta: { trim, boardW: W0, boardH: H0, unit } });
      };

      worker.addEventListener('message', handle);
      worker.addEventListener('error', onErr);
      worker.addEventListener('messageerror', onMsgErr);

      const o = Object.assign({ startMode: normalizeCutDirection(state.direction), speedMode: String(state.optimaxProfile || 'max').toLowerCase(), sheetEstimate: Number(panelOpts && panelOpts.sheetEstimate) || 1 }, (panelOpts||{}));

      try{
        worker.postMessage({
          cmd: 'panel_pro',
          runId,
          items,
          W, H, K,
          options: o
        });
      }catch(e){
        // Posting failed: cleanup and return
        finish({ sheets: [], note: 'Nie udało się wystartować liczenia.', workerFailed: true, noSyncFallback: !!blockMainThreadFallback, meta: { trim, boardW: W0, boardH: H0, unit } });
      }
    });
  }

  function render(){
    const root = document.getElementById('rozrysRoot');
    if(!root) return;

    const agg = aggregatePartsForProject();

    root.innerHTML = '';

    const card = h('div', { class:'card' });
    const panelPrefs = loadPanelPrefs();
    const headerRow = h('div', { style:'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap' });
    headerRow.appendChild(h('h3', { style:'margin:0', text:'Optimax — optymalizacja rozkroju' }));
    card.appendChild(headerRow);

    if(!agg.materials.length){
      card.appendChild(h('div', { class:'muted', style:'margin-top:10px', html:'Brak rozpiski materiałów. Dodaj szafki, żeby ROZRYS miał co ciąć.' }));
      root.appendChild(card);
      return;
    }

    // state (ui) — keep local per render
    const state = {
      material: agg.materials[0],
      unit: (panelPrefs.unit === 'cm' ? 'cm' : 'mm'),
      boardW: 2800,
      boardH: 2070,
      kerf: Number.isFinite(Number(panelPrefs.kerf)) ? Math.max(0, Number(panelPrefs.kerf)) : 4,
      edgeTrim: Number.isFinite(Number(panelPrefs.edgeTrim)) ? Math.max(0, Number(panelPrefs.edgeTrim)) : 20,
      grain: true,
      heur: 'optimax',
      optimaxProfile: 'max',
      minScrapW: Number.isFinite(Number(panelPrefs.minScrapW)) ? Math.max(0, Number(panelPrefs.minScrapW)) : 0,
      minScrapH: Number.isFinite(Number(panelPrefs.minScrapH)) ? Math.max(0, Number(panelPrefs.minScrapH)) : 0,
      direction: 'start-optimax',
    };

    // if magazyn has hint for first material
    function toDisp(mm){ return state.unit === 'mm' ? mm : (mm/10); }
    function fromDisp(v){ return state.unit === 'mm' ? Number(v) : (Number(v) * 10); }

    try{
      const hint = (FC.magazyn && FC.magazyn.getPreferredFormat) ? FC.magazyn.getPreferredFormat(state.material) : null;
      if(hint){
        state.boardW = toDisp(hint.width || 2800);
        state.boardH = toDisp(hint.height || 2070);
      }
    }catch(_){ }

    // top row: material + format arkusza + opcje
    const controls = h('div', { class:'grid-3', style:'margin-top:12px' });
    // material select
    const matWrap = h('div');
    matWrap.appendChild(h('label', { text:'Materiał / grupa' }));
    const matSel = h('select', { id:'rozMat' });
    // Specjalne tryby (generowanie na raz)
    [
      { v:'__ALL__', t:'WSZYSTKIE' },
      { v:'__FRONTS__', t:'FRONTY' },
      { v:'__NO_FRONTS__', t:'BEZ FRONTÓW' },
    ].forEach(x=>{
      const o = document.createElement('option');
      o.value = x.v;
      o.textContent = x.t;
      matSel.appendChild(o);
    });
    // Separator (disabled)
    {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = '────────';
      o.disabled = true;
      matSel.appendChild(o);
    }
    // Konkretny materiał
    agg.materials.forEach(m=>{
      const o = document.createElement('option');
      o.value = m;
      o.textContent = m;
      matSel.appendChild(o);
    });
    matSel.value = state.material;
    matWrap.appendChild(matSel);
    controls.appendChild(matWrap);

    // hidden option controls controlled through modal
    const unitWrap = h('div');
    unitWrap.appendChild(h('label', { text:'Jednostki' }));
    const unitSel = h('select', { id:'rozUnit' });
    unitSel.innerHTML = `
      <option value="cm" ${state.unit==='cm'?'selected':''}>cm</option>
      <option value="mm" ${state.unit==='mm'?'selected':''}>mm</option>
    `;
    unitWrap.appendChild(unitSel);

    const edgeWrap = h('div');
    edgeWrap.appendChild(h('label', { text:'Wymiary do cięcia' }));
    const edgeSel = h('select', { id:'rozEdgeSub' });
    edgeSel.innerHTML = `
      <option value="0">Nominalne</option>
      <option value="1">Po odjęciu 1 mm okleiny</option>
      <option value="2">Po odjęciu 2 mm okleiny</option>
    `;
    edgeSel.value = ['0','1','2'].includes(String(panelPrefs.edgeSubMm)) ? String(panelPrefs.edgeSubMm) : '0';
    edgeWrap.appendChild(edgeSel);

    // board size
    const sizeWrap = h('div');
    sizeWrap.appendChild(h('label', { text:`Format arkusza (${state.unit})` }));
    const sizeRow = h('div', { style:'display:flex;gap:8px' });
    const inW = h('input', { id:'rozW', type:'number', value:String(state.boardW) });
    const inH = h('input', { id:'rozH', type:'number', value:String(state.boardH) });
    sizeRow.appendChild(inW); sizeRow.appendChild(inH);
    sizeWrap.appendChild(sizeRow);
    controls.appendChild(sizeWrap);

    const optionsWrap = h('div');
    optionsWrap.appendChild(h('label', { text:'Ustawienia dodatkowe' }));
    optionsWrap.appendChild(h('div', { class:'muted xs', style:'margin-bottom:8px', text:'Jednostki, wymiary do cięcia, rzaz, obrównanie i najmniejszy odpad ustawisz w oknie opcji.' }));
    const openOptionsBtnInline = h('button', { class:'btn', type:'button', text:'Opcje rozkroju' });
    optionsWrap.appendChild(openOptionsBtnInline);
    controls.appendChild(optionsWrap);

    // hidden option inputs
    const kerfWrap = h('div');
    kerfWrap.appendChild(h('label', { text:`Rzaz piły (${state.unit})` }));
    const inK = h('input', { id:'rozK', type:'number', value:String(state.kerf) });
    kerfWrap.appendChild(inK);

    const trimWrap = h('div');
    trimWrap.appendChild(h('label', { text:`Obrównanie krawędzi — arkusz standardowy (${state.unit})` }));
    const inTrim = h('input', { id:'rozTrim', type:'number', value:String(state.edgeTrim) });
    trimWrap.appendChild(inTrim);

    const minScrapWrap = h('div');
    minScrapWrap.appendChild(h('label', { text:`Najmniejszy użyteczny odpad (${state.unit})` }));
    const minScrapRow = h('div', { style:'display:flex;gap:8px' });
    const inMinW = h('input', { id:'rozMinScrapW', type:'number', value:String(state.minScrapW) });
    const inMinH = h('input', { id:'rozMinScrapH', type:'number', value:String(state.minScrapH) });
    minScrapRow.appendChild(inMinW);
    minScrapRow.appendChild(inMinH);
    minScrapWrap.appendChild(minScrapRow);

    const controls2 = h('div', { class:'grid-3', style:'margin-top:12px' });

    const grainWrap = h('div');
    grainWrap.appendChild(h('label', { text:'Struktura / kierunek' }));
    const grainRow = h('div', { style:'display:flex;align-items:center;gap:10px' });
    const grainChk = h('input', { id:'rozGrain', type:'checkbox' });
    grainChk.checked = true;
    grainRow.appendChild(grainChk);
    grainRow.appendChild(h('div', { class:'muted xs', text:'Arkusz posiada strukturę — pilnuj kierunku i blokuj obrót poza wyjątkami.' }));
    grainWrap.appendChild(grainRow);
    controls2.appendChild(grainWrap);

    const heurWrap = h('div');
    heurWrap.appendChild(h('label', { text:'Szybkość liczenia' }));
    const heurSel = h('select', { id:'rozHeur' });
    heurSel.innerHTML = `
      <option value="turbo">Turbo</option>
      <option value="dokladnie">Dokładnie</option>
      <option value="max" selected>MAX</option>
    `;
    heurWrap.appendChild(heurSel);
    controls2.appendChild(heurWrap);

    const dirWrap = h('div');
    dirWrap.appendChild(h('label', { text:'Kierunek cięcia' }));
    const dirSel = h('select', { id:'rozDir' });
    dirSel.innerHTML = `
      <option value="start-along">Pierwsze pasy wzdłuż</option>
      <option value="start-across">Pierwsze pasy w poprzek</option>
      <option value="start-optimax" selected>Opti-max</option>
    `;
    dirWrap.appendChild(dirSel);
    controls2.appendChild(dirWrap);

    const controls3 = h('div', { style:'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px' });

    const profileHintWrap = h('div');
    profileHintWrap.appendChild(h('label', { text:'Jak czytać tryby szybkości' }));
    profileHintWrap.appendChild(h('div', { class:'muted xs', text:'Turbo = najprostszy shelf. Dokładnie = lżejsze myślenie pasowe. MAX = Twój algorytm 1–7 bez otwierania nowej płyty przed domknięciem poprzedniej.' }));
    controls3.appendChild(profileHintWrap);

    const modeHintWrap = h('div');
    modeHintWrap.appendChild(h('label', { text:'Kierunek startu' }));
    modeHintWrap.appendChild(h('div', { class:'muted xs', text:'Pierwsze pasy wzdłuż / w poprzek wymuszają start. Opti-max wybiera lepszy start dla każdej płyty osobno.' }));
    controls3.appendChild(modeHintWrap);

    card.appendChild(controls);
    card.appendChild(controls2);
    card.appendChild(controls3);
    function persistOptionPrefs(){
      savePanelPrefs({
        unit: unitSel.value,
        edgeSubMm: Math.max(0, Number(edgeSel.value)||0),
        kerf: Math.max(0, Number(inK.value)||0),
        edgeTrim: Math.max(0, Number(inTrim.value)||0),
        minScrapW: Math.max(0, Number(inMinW.value)||0),
        minScrapH: Math.max(0, Number(inMinH.value)||0),
      });
    }

    function applyUnitChange(next){
      const prev = state.unit;
      if(prev === next) return;
      const factor = (prev==='cm' && next==='mm') ? 10 : (prev==='mm' && next==='cm') ? 0.1 : 1;
      const conv = (el)=>{
        const n = Number(el.value);
        if(!Number.isFinite(n)) return;
        const v = n * factor;
        el.value = (next==='cm') ? String(Math.round(v*10)/10) : String(Math.round(v));
      };
      conv(inW); conv(inH); conv(inK); conv(inTrim); conv(inMinW); conv(inMinH);
      state.unit = next;
      unitSel.value = next;
      sizeWrap.querySelector('label').textContent = `Format arkusza (${next})`;
      kerfWrap.querySelector('label').textContent = `Rzaz piły (${next})`;
      trimWrap.querySelector('label').textContent = `Obrównanie krawędzi — arkusz standardowy (${next})`;
      minScrapWrap.querySelector('label').textContent = `Najmniejszy użyteczny odpad (${next})`;
    }

    function openOptionsModal(){
      const back = h('div', { class:'modal-back', style:'display:flex', 'data-modal-close':'rozrys-options' });
      const modal = h('div', { class:'modal', style:'max-width:720px' });
      modal.addEventListener('pointerdown', (e)=>{ e.stopPropagation(); });
      const header = h('div', { class:'header' }, [
        h('div', { style:'font-weight:800', text:'Opcje rozkroju' })
      ]);
      const body = h('div', { class:'body' });
      const form = h('div', { class:'grid-2', style:'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px' });

      const modalUnitWrap = h('div');
      modalUnitWrap.appendChild(h('label', { text:'Jednostki' }));
      const modalUnitSel = h('select');
      modalUnitSel.innerHTML = `
        <option value="cm" ${unitSel.value==='cm'?'selected':''}>cm</option>
        <option value="mm" ${unitSel.value==='mm'?'selected':''}>mm</option>
      `;
      modalUnitWrap.appendChild(modalUnitSel);
      form.appendChild(modalUnitWrap);

      const modalEdgeWrap = h('div');
      modalEdgeWrap.appendChild(h('label', { text:'Wymiary do cięcia' }));
      const modalEdgeSel = h('select');
      modalEdgeSel.innerHTML = edgeSel.innerHTML;
      modalEdgeSel.value = edgeSel.value;
      modalEdgeWrap.appendChild(modalEdgeSel);
      form.appendChild(modalEdgeWrap);

      const modalKerfWrap = h('div');
      modalKerfWrap.appendChild(h('label', { text:`Rzaz piły (${unitSel.value})` }));
      const modalKerf = h('input', { type:'number', value:String(inK.value) });
      modalKerfWrap.appendChild(modalKerf);
      form.appendChild(modalKerfWrap);

      const modalTrimWrap = h('div');
      modalTrimWrap.appendChild(h('label', { text:`Obrównanie krawędzi — arkusz standardowy (${unitSel.value})` }));
      const modalTrim = h('input', { type:'number', value:String(inTrim.value) });
      modalTrimWrap.appendChild(modalTrim);
      form.appendChild(modalTrimWrap);

      const modalMinWrap = h('div');
      modalMinWrap.appendChild(h('label', { text:`Najmniejszy użyteczny odpad (${unitSel.value})` }));
      const modalMinRow = h('div', { style:'display:flex;gap:8px' });
      const modalMinW = h('input', { type:'number', value:String(inMinW.value) });
      const modalMinH = h('input', { type:'number', value:String(inMinH.value) });
      modalMinRow.appendChild(modalMinW);
      modalMinRow.appendChild(modalMinH);
      modalMinWrap.appendChild(modalMinRow);
      form.appendChild(modalMinWrap);

      const note = h('div', { class:'muted xs', style:'grid-column:1 / -1', text:'Zapisane opcje będą pamiętane dla kolejnych wejść do panelu rozkroju.' });
      form.appendChild(note);
      body.appendChild(form);

      function syncModalLabels(){
        const u = modalUnitSel.value === 'cm' ? 'cm' : 'mm';
        modalKerfWrap.querySelector('label').textContent = `Rzaz piły (${u})`;
        modalTrimWrap.querySelector('label').textContent = `Obrównanie krawędzi — arkusz standardowy (${u})`;
        modalMinWrap.querySelector('label').textContent = `Najmniejszy użyteczny odpad (${u})`;
      }
      function convertModalNumericFields(prevUnit, nextUnit){
        if(prevUnit === nextUnit) return;
        const factor = (prevUnit === 'cm' && nextUnit === 'mm') ? 10 : (prevUnit === 'mm' && nextUnit === 'cm') ? 0.1 : 1;
        const conv = (el)=>{
          const n = parseLocaleNumber(el.value);
          if(!Number.isFinite(n)) return;
          const v = n * factor;
          el.value = (nextUnit === 'cm') ? String(Math.round(v * 10) / 10) : String(Math.round(v));
        };
        conv(modalKerf);
        conv(modalTrim);
        conv(modalMinW);
        conv(modalMinH);
      }
      modalUnitSel.addEventListener('change', ()=>{
        const prevUnit = modalUnitSel.dataset.prevUnit || unitSel.value || 'mm';
        const nextUnit = modalUnitSel.value === 'cm' ? 'cm' : 'mm';
        convertModalNumericFields(prevUnit, nextUnit);
        modalUnitSel.dataset.prevUnit = nextUnit;
        syncModalLabels();
        updateDirtyState();
      });
      modalUnitSel.dataset.prevUnit = modalUnitSel.value === 'cm' ? 'cm' : 'mm';

      const footer = h('div', { style:'display:flex;justify-content:flex-end;gap:10px;margin-top:14px;flex-wrap:wrap' });
      const cancelBtn = h('button', { class:'btn-primary', type:'button', text:'Anuluj' });
      const saveBtn = h('button', { class:'btn-primary', type:'button', text:'Zapisz opcje' });
      footer.appendChild(cancelBtn);
      footer.appendChild(saveBtn);
      body.appendChild(footer);

      modal.appendChild(header);
      modal.appendChild(body);
      back.appendChild(modal);
      document.body.appendChild(back);
      try{ document.documentElement.classList.add('modal-lock'); document.body.classList.add('modal-lock'); }catch(_){ }

      function closeModal(){
        try{ back.remove(); }catch(_){ }
        try{ document.documentElement.classList.remove('modal-lock'); document.body.classList.remove('modal-lock'); }catch(_){ }
      }

      function normalizeLenToMm(value, unit){
        const n = parseLocaleNumber(value);
        if(!Number.isFinite(n)) return 0;
        return unit === 'cm' ? Math.round(n * 10) : Math.round(n);
      }
      function currentModalSignature(){
        const u = modalUnitSel.value === 'cm' ? 'cm' : 'mm';
        return JSON.stringify({
          unit: u,
          edge: String(modalEdgeSel.value || ''),
          kerfMm: normalizeLenToMm(modalKerf.value, u),
          trimMm: normalizeLenToMm(modalTrim.value, u),
          minWMm: normalizeLenToMm(modalMinW.value, u),
          minHMm: normalizeLenToMm(modalMinH.value, u),
        });
      }
      const initialSignature = currentModalSignature();
      let isDirty = false;

      function setButtonTone(btn, tone){
        btn.classList.remove('btn', 'btn-primary', 'btn-danger', 'btn-success');
        if(tone === 'danger') btn.classList.add('btn-danger');
        else if(tone === 'success') btn.classList.add('btn-success');
        else btn.classList.add('btn-primary');
      }

      function updateDirtyState(){
        isDirty = currentModalSignature() !== initialSignature;
        setButtonTone(cancelBtn, isDirty ? 'danger' : 'primary');
        setButtonTone(saveBtn, isDirty ? 'success' : 'primary');
      }

      function confirmDiscardIfDirty(){
        if(!isDirty) return Promise.resolve(true);
        if(window.FC && window.FC.confirmBox && typeof window.FC.confirmBox.ask === 'function'){
          return window.FC.confirmBox.ask({
            title:'ANULOWAĆ ZMIANY?',
            message:'Niezapisane zmiany w opcjach rozkroju zostaną utracone.',
            confirmText:'✕ ANULUJ ZMIANY',
            cancelText:'✓ WRÓĆ',
            confirmTone:'danger',
            cancelTone:'success'
          });
        }
        return Promise.resolve(window.confirm('Czy na pewno chcesz anulować zmiany?'));
      }

      function confirmSaveIfDirty(){
        if(!isDirty) return Promise.resolve(true);
        if(window.FC && window.FC.confirmBox && typeof window.FC.confirmBox.ask === 'function'){
          return window.FC.confirmBox.ask({
            title:'ZAPISAĆ ZMIANY?',
            message:'Zmienione opcje rozkroju zostaną zapisane i użyte przy kolejnych wejściach do panelu.',
            confirmText:'✓ ZAPISZ',
            cancelText:'✕ WRÓĆ',
            confirmTone:'success',
            cancelTone:'danger'
          });
        }
        return Promise.resolve(window.confirm('Czy zapisać zmienione opcje?'));
      }

      function wireDirty(el){
        if(!el) return;
        el.addEventListener('input', updateDirtyState);
        el.addEventListener('change', updateDirtyState);
      }
      [modalEdgeSel, modalKerf, modalTrim, modalMinW, modalMinH].forEach(wireDirty);
      updateDirtyState();

      cancelBtn.addEventListener('click', async ()=>{
        if(!(await confirmDiscardIfDirty())) return;
        closeModal();
      });
      back.addEventListener('pointerdown', async (e)=>{
        if(e.target !== back) return;
        if(!(await confirmDiscardIfDirty())) return;
        closeModal();
      });
      saveBtn.addEventListener('click', async ()=>{
        if(!(await confirmSaveIfDirty())) return;
        if(!isDirty){
          closeModal();
          return;
        }
        applyUnitChange(modalUnitSel.value);
        edgeSel.value = modalEdgeSel.value;
        inK.value = String(Math.max(0, parseLocaleNumber(modalKerf.value)||0));
        inTrim.value = String(Math.max(0, parseLocaleNumber(modalTrim.value)||0));
        inMinW.value = String(Math.max(0, parseLocaleNumber(modalMinW.value)||0));
        inMinH.value = String(Math.max(0, parseLocaleNumber(modalMinH.value)||0));
        persistOptionPrefs();
        closeModal();
        tryAutoRenderFromCache();
      });
    }

    // action buttons
    const btnRow = h('div', { style:'display:flex;gap:10px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap' });
    const saveToMag = h('button', { class:'btn', type:'button' });
    saveToMag.textContent = 'Zapisz format do magazynu';
    const genBtn = h('button', { class:'btn-generate-green', type:'button' });
    genBtn.textContent = 'Generuj rozkrój';
    btnRow.appendChild(saveToMag);
    btnRow.appendChild(genBtn);
    card.appendChild(btnRow);

    const statusBox = h('div', { class:'rozrys-status', style:'display:none;margin-top:12px' });
    const statusTop = h('div', { class:'rozrys-status-top' });
    const statusSpinner = h('div', { class:'rozrys-spinner' });
    const statusCopy = h('div', { class:'rozrys-status-copy' });
    const statusMain = h('div', { class:'rozrys-status-main', text:'Liczę…' });
    const statusSub = h('div', { class:'muted xs rozrys-status-sub', text:'' });
    const statusProg = h('div', { class:'rozrys-progress is-indeterminate' });
    const statusProgBar = h('div', { class:'rozrys-progress-bar' });
    const statusMeta = h('div', { class:'muted xs rozrys-progress-meta', text:'' });
    statusProg.appendChild(statusProgBar);
    statusCopy.appendChild(statusMain);
    statusCopy.appendChild(statusSub);
    statusCopy.appendChild(statusProg);
    statusCopy.appendChild(statusMeta);
    statusTop.appendChild(statusSpinner);
    statusTop.appendChild(statusCopy);
    statusBox.appendChild(statusTop);
    card.appendChild(statusBox);

    // overrides list container
    const overridesBox = h('div', { style:'margin-top:12px;display:none' });
    card.appendChild(overridesBox);

    // output
    const out = h('div', { style:'margin-top:12px' });
    card.appendChild(out);

    root.appendChild(card);

    function applyHintFromMagazyn(material){
      try{
        const hint = (FC.magazyn && FC.magazyn.getPreferredFormat) ? FC.magazyn.getPreferredFormat(material) : null;
        if(hint){
          const wmm = hint.width || 2800;
          const hmm = hint.height || 2070;
          const u = unitSel.value;
          inW.value = String(u==='mm' ? wmm : (Math.round((wmm/10)*10)/10));
          inH.value = String(u==='mm' ? hmm : (Math.round((hmm/10)*10)/10));
        }
      }catch(_){ }
    }

    // Helper: whether current material (by name) is marked as having grain in the price list.
    function getRealHalfStockForMaterial(material, fullWmm, fullHmm){
      try{
        const rows = (FC.magazyn && FC.magazyn.findHalfSheetsForMaterial)
          ? FC.magazyn.findHalfSheetsForMaterial(material, fullWmm, fullHmm)
          : [];
        if(!rows || !rows.length) return { qty: 0, width: 0, height: 0 };
        const row = rows.slice().sort((a,b)=> (Number(b && b.qty)||0) - (Number(a && a.qty)||0))[0];
        return {
          qty: Math.max(0, Number(row && row.qty) || 0),
          width: Math.round(Number(row && row.width) || 0),
          height: Math.round(Number(row && row.height) || 0),
        };
      }catch(_){
        return { qty: 0, width: 0, height: 0 };
      }
    }

    function materialHasGrain(name){
      try{ return !!(FC && typeof FC.materialHasGrain === 'function' && FC.materialHasGrain(name)); }catch(_){ return false; }
    }

    function updateGrainAvailability(){
      const sel = String(matSel.value||'');
      // For bulk modes keep the checkbox enabled; grain will apply only to materials that have grain.
      if(sel === '__ALL__' || sel === '__FRONTS__' || sel === '__NO_FRONTS__'){
        grainChk.disabled = false;
        return;
      }
      if(!sel || sel.startsWith('__')){
        grainChk.checked = false;
        grainChk.disabled = true;
        return;
      }
      const has = materialHasGrain(sel);
      if(has){
        grainChk.disabled = false;
      } else {
        // If material has no grain, don't enforce direction and don't show overrides.
        grainChk.checked = false;
        grainChk.disabled = true;
      }
    }

    function renderOverrides(){
      const sel = String(matSel.value||'');
      const grainOn = (!!grainChk.checked) && (!!sel) && (!sel.startsWith('__')) && materialHasGrain(sel);
      overridesBox.innerHTML = '';
      overridesBox.style.display = grainOn ? 'block' : 'none';
      if(!grainOn) return;

      const parts = agg.byMaterial[matSel.value] || [];
      const overrides = loadOverrides();

      overridesBox.appendChild(h('div', { class:'muted xs', style:'font-weight:900;margin-bottom:6px', text:'Wyjątki: pozwól obrót dla wybranych elementów (mimo słoi)' }));
      const list = h('div', { style:'display:flex;flex-direction:column;gap:6px' });
      parts.forEach(p=>{
        const sig = partSignature(p);
        const row = h('label', { style:'display:flex;align-items:center;gap:10px' });
        const cb = h('input', { type:'checkbox' });
        cb.checked = !!overrides[sig];
        cb.addEventListener('change', ()=>{
          const o = loadOverrides();
          if(cb.checked) o[sig] = true;
          else delete o[sig];
          saveOverrides(o);
          tryAutoRenderFromCache();
        });
        row.appendChild(cb);
        const u = unitSel.value === 'cm' ? 'cm' : 'mm';
        row.appendChild(h('div', { class:'muted xs', text:`${p.name} • ${mmToUnitStr(p.w, u)}×${mmToUnitStr(p.h, u)} ${u} • ilość ${p.qty}` }));
        list.appendChild(row);
      });
      overridesBox.appendChild(list);
    }

    function getBaseState(){
      return {
        unit: unitSel.value,
        edgeSubMm: Math.max(0, Number(edgeSel.value)||0),
        boardW: Number(inW.value)|| (unitSel.value==="mm"?2800:280),
        boardH: Number(inH.value)|| (unitSel.value==="mm"?2070:207),
        kerf: Number(inK.value)|| (unitSel.value==="mm"?4:0.4),
        edgeTrim: Number(inTrim.value)|| (unitSel.value==="mm"?20:2),
        minScrapW: Math.max(0, Number(inMinW.value)||0),
        minScrapH: Math.max(0, Number(inMinH.value)||0),
        // Grain is applied per-material (only where the price list marks it as having grain).
        grain: !!grainChk.checked,
        heur: 'optimax',
        optimaxProfile: heurSel.value,
        direction: normalizeCutDirection(dirSel.value),
      };
    }

    function tryAutoRenderFromCache(){
      try{
        if(_rozrysRunning) return false;
        const sel = matSel.value;
        if(!sel){
          // Variant B: no selection => clear output
          out.innerHTML = '';
          setGenBtnMode('idle');
          return false;
        }

        // Variant B: special modes should also auto-render from cache,
        // but never keep stale results when cache miss.
        if(sel === "__ALL__" || sel === "__FRONTS__" || sel === "__NO_FRONTS__"){
          out.innerHTML = '';
          const mode = (sel === "__ALL__") ? "all" : (sel === "__FRONTS__") ? "fronts" : "nofronts";
          const derived = deriveAggForMode(mode);
          const stBase = getBaseState();
          const cache = loadPlanCache();

  function setGlobalStatus(){ }
          let allHit = true;
          let anyHit = false;
          for(const m of derived.materials){
            const parts = derived.byMaterial[m] || [];
            const box = h('div', { style:'margin-top:12px' });
            out.appendChild(box);
            const st = Object.assign({}, stBase, { material: m, grain: !!(stBase.grain && materialHasGrain(m)) });
            const cacheKey = makePlanCacheKey(st, parts);
            if(cache[cacheKey] && cache[cacheKey].plan){
              const plan = cache[cacheKey].plan;
              renderOutput(plan, { material: m, kerf: st.kerf, heur: formatHeurLabel(st), unit: st.unit, edgeSubMm: st.edgeSubMm, meta: plan.meta }, box);
              anyHit = true;
            } else {
              allHit = false;
              box.innerHTML = '';
            }
          }
          setGenBtnMode(allHit && anyHit ? 'done' : 'idle');
          return anyHit;
        }

        if(String(sel).startsWith('__')){
          out.innerHTML = '';
          setGenBtnMode('idle');
          return false;
        }
        const material = sel;
        const parts = agg.byMaterial[material] || [];
        if(!parts.length){
          // Variant B: clear output when nothing to render
          out.innerHTML = '';
          setGenBtnMode('idle');
          return false;
        }
        const base = getBaseState();
        const st = Object.assign({}, base, { material, grain: !!(base.grain && materialHasGrain(material)) });
        const cache = loadPlanCache();

  function setGlobalStatus(){ }
        const cacheKey = makePlanCacheKey(st, parts);
        if(cache[cacheKey] && cache[cacheKey].plan){
          const plan = cache[cacheKey].plan;
          renderOutput(plan, { material, kerf: st.kerf, heur: formatHeurLabel(st), unit: st.unit, edgeSubMm: st.edgeSubMm, meta: plan.meta }, null);
          setGenBtnMode('done');
          return true;
        }
        // Variant B: cache miss => clear view (no stale result)
        out.innerHTML = '';
        setGenBtnMode('idle');
        return false;
      }catch(_){
        out.innerHTML = '';
        setGenBtnMode('idle');
        return false;
      }
    }

    function renderOutput(plan, meta, target){
      const tgt = target || out;
      // Always clear target; otherwise spinners can remain in WSZYSTKIE mode
      // or when re-rendering into an existing box.
      tgt.innerHTML = '';
      const opt = FC.cutOptimizer;
      const sheets = plan.sheets || [];
      const u = (meta && (meta.unit === 'cm' || meta.unit === 'mm'))
        ? meta.unit
        : (meta && meta.meta && (meta.meta.unit === 'cm' || meta.meta.unit === 'mm'))
          ? meta.meta.unit
          : 'mm';

      const getBoardMeta = (sheet)=>{
        const boardW = Math.max(1,
          Number((meta && meta.meta && meta.meta.boardW) || (meta && meta.boardW) || (sheet && sheet.fullBoardW) || (sheet && sheet.boardW) || 0)
        );
        const boardH = Math.max(1,
          Number((meta && meta.meta && meta.meta.boardH) || (meta && meta.boardH) || (sheet && sheet.fullBoardH) || (sheet && sheet.boardH) || 0)
        );
        const trim = Math.max(0,
          Number((meta && meta.meta && meta.meta.trim) || (meta && meta.trim) || (sheet && sheet.trimMm) || 0)
        );
        return { boardW, boardH, trim };
      };
      const calcDisplayWaste = (sheet)=>{
        const bm = getBoardMeta(sheet);
        const halfBoardW = Math.max(1, Number((sheet && sheet.realHalfBoardW) || (sheet && sheet.virtualBoardW) || bm.boardW) || bm.boardW);
        const halfBoardH = Math.max(1, Number((sheet && sheet.realHalfBoardH) || (sheet && sheet.virtualBoardH) || bm.boardH) || bm.boardH);
        const total = Math.max(0, halfBoardW * halfBoardH);
        const used = opt.placedArea(sheet);
        const waste = Math.max(0, total - used);
        return { total, used, waste, trim: bm.trim, boardW: bm.boardW, boardH: bm.boardH, wasteBoardW: halfBoardW, wasteBoardH: halfBoardH, virtualHalf: !!(sheet && sheet.virtualHalf), realHalf: !!(sheet && (sheet.realHalf || sheet.realHalfFromStock)) };
      };
      if(!sheets.length){
        const msg = (plan && plan.note) ? String(plan.note) : 'Brak wyniku.';
        tgt.appendChild(h('div', { class:'muted', text: msg }));
        return;
      }

      const sheetFraction = (sheet)=>{
        const f = Number(sheet && sheet.virtualFraction);
        return (Number.isFinite(f) && f > 0) ? f : 1;
      };
      const formatSheetCount = (n)=> Number.isInteger(n) ? String(n) : String(n.toFixed(1)).replace('.', ',');
      const sum = sheets.reduce((acc,s)=>{
        const w = calcDisplayWaste(s);
        acc.area += w.total;
        acc.used += w.used;
        acc.waste += w.waste;
        acc.count += sheetFraction(s);
        if(s && s.virtualHalf) acc.hasVirtualHalf = true;
        if(s && (s.realHalf || s.realHalfFromStock)) acc.hasRealHalf = true;
        return acc;
      }, { area:0, used:0, waste:0, count:0, hasVirtualHalf:false, hasRealHalf:false });

      const pct = sum.area>0 ? (sum.waste/sum.area)*100 : 0;

      const cancelledNote = (meta && meta.cancelled) ? '<div class="muted xs" style="margin-top:6px;font-weight:700">Generowanie przerwane — pokazuję najlepszy wynik do tej pory.</div>' : '';
      const realHalfNote = sum.hasRealHalf ? '<div class="muted xs" style="margin-top:6px">Końcówka policzona na realnej połówce z magazynu, ale rysowana na pełnym arkuszu.</div>' : '';
      const virtualNote = sum.hasVirtualHalf ? '<div class="muted xs" style="margin-top:6px">Ostatnia końcówka liczona wirtualnie jako 0,5 płyty, ale rysowana na pełnym arkuszu.</div>' : '';
      tgt.appendChild(h('div', { class:'card', style:'margin:0', html:`
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div><strong>Materiał:</strong> ${meta.material}</div>
          <div><strong>Płyty:</strong> ${formatSheetCount(sum.count)} szt.</div>
          <div><strong>Odpad:</strong> ${pct.toFixed(1)}%</div>
        </div>
        ${cancelledNote}
        ${realHalfNote}
        ${virtualNote}
      ` }));

      const expRow = h('div', { style:'display:flex;gap:10px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap' });
      const csvBtn = h('button', { class:'btn', type:'button' });
      csvBtn.textContent = 'Eksport CSV';
      csvBtn.addEventListener('click', ()=>{
        const csv = buildCsv(sheets, meta);
        downloadText('rozrys.csv', csv, 'text/csv;charset=utf-8');
      });
      const pdfBtn = h('button', { class:'btn', type:'button' });
      pdfBtn.textContent = 'Eksport PDF (drukuj)';
      pdfBtn.addEventListener('click', ()=>{
        // proste HTML do wydruku (renderujemy tutaj, a do okna wysyłamy obrazy, żeby zachować identyczny wygląd jak ROZRYS)
        const edgeSubMm = Math.max(0, Number(meta.edgeSubMm)||0);
        const imgs = [];
        try{
          sheets.forEach((s)=>{
            const c = document.createElement('canvas');
            // sztuczny kontener o stałej szerokości dla spójnego skalowania
            const tmp = document.createElement('div');
            tmp.style.width = '980px';
            tmp.style.position = 'absolute';
            tmp.style.left = '-99999px';
            tmp.appendChild(c);
            document.body.appendChild(tmp);
            drawSheet(c, s, u, edgeSubMm, getBoardMeta(s));
            imgs.push(c.toDataURL('image/png'));
            tmp.remove();
          });
        }catch(_){ }

        let html = `<!doctype html><html><head><meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Rozrys</title>
          <style>
            body{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding:16px; }
            h1{ font-size:18px; margin:0 0 10px; }
            .meta{ font-size:12px; color:#333; margin-bottom:12px; }
            .sheet{ margin:14px 0; page-break-inside:avoid; }
            img{ width:100%; max-width:980px; border:1px solid #333; border-radius:10px; }
          </style>
        </head><body>`;
        html += `<h1>Rozrys — ${meta.material}</h1>`;
        const edgeNote = (edgeSubMm>0) ? ` • Wymiary do cięcia: TAK (${edgeSubMm}mm)` : '';
        html += `<div class="meta">Płyty: ${formatSheetCount(sum.count)} • Kerf: ${meta.kerf}${u} • Heurystyka: ${meta.heur}${edgeNote}</div>`;
        sheets.forEach((s,i)=>{
          const bm = getBoardMeta(s);
          const ws = calcDisplayWaste(s);
          const sheetWastePct = ws.total > 0 ? ((ws.waste / ws.total) * 100) : 0;
          const virtualTxt = ws.realHalf ? ' • real 0,5 z magazynu' : (ws.virtualHalf ? ' • virtual 0,5 płyty' : '');
          html += `<div class="sheet"><div class="meta"><strong>Arkusz ${i+1}</strong> — ${mmToUnitStr(bm.boardW, u)}×${mmToUnitStr(bm.boardH, u)} ${u} • Odpad: ${sheetWastePct.toFixed(1)}%${virtualTxt}</div>`;
          const src = imgs[i] || '';
          html += `<img src="${src}" alt="Arkusz ${i+1}" /></div>`;
        });
        html += `</body></html>`;
        openPrintView(html);
      });
      expRow.appendChild(csvBtn);
      expRow.appendChild(pdfBtn);
      tgt.appendChild(expRow);

      const edgeSubMm = Math.max(0, Number(meta.edgeSubMm)||0);
      sheets.forEach((s,i)=>{
        const box = h('div', { class:'card', style:'margin-top:12px' });
        const bm = getBoardMeta(s);
        const ws = calcDisplayWaste(s);
        const sheetWastePct = ws.total > 0 ? ((ws.waste / ws.total) * 100) : 0;
        box.appendChild(h('div', { style:'display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap' }, [
          h('div', { style:'font-weight:900', text:`Arkusz ${i+1} • odpad ${sheetWastePct.toFixed(1)}%${ws.realHalf ? ' • real 0,5 z magazynu' : (ws.virtualHalf ? ' • virtual 0,5 płyty' : '')}` }),
          h('div', { class:'muted xs', text:`${mmToUnitStr(bm.boardW, u)}×${mmToUnitStr(bm.boardH, u)} ${u}` })
        ]));
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.marginTop = '10px';
        box.appendChild(canvas);
        tgt.appendChild(box);
        drawSheet(canvas, s, u, edgeSubMm, getBoardMeta(s));
      });
    }

    function renderLoading(text){
      return renderLoadingInto(null, text);
    }

    function renderLoadingInto(target, text, subText){
      const tgt = target || out;
      tgt.innerHTML = '';
      const box = h('div', { class:'rozrys-loading' });
      const top = h('div', { class:'rozrys-loading-top' });
      const spinner = h('div', { class:'rozrys-spinner' });
      const copy = h('div', { class:'rozrys-status-copy' });
      const textEl = h('div', { class:'rozrys-loading-text', text: text || 'Liczę…' });
      const subEl = h('div', { class:'muted xs rozrys-loading-sub', text: subText || '' });
      const progWrap = h('div', { class:'rozrys-progress is-indeterminate' });
      const progBar = h('div', { class:'rozrys-progress-bar' });
      const metaEl = h('div', { class:'muted xs rozrys-progress-meta', text:'Startuję liczenie…' });
      progWrap.appendChild(progBar);
      copy.appendChild(textEl);
      copy.appendChild(subEl);
      copy.appendChild(progWrap);
      copy.appendChild(metaEl);
      top.appendChild(spinner);
      top.appendChild(copy);
      box.appendChild(top);
      tgt.appendChild(box);
      return {
        box, textEl, subEl, progWrap, progBar, metaEl, target: tgt,
        setProgress(percent, metaText){
          const n = Number(percent);
          if(Number.isFinite(n)) {
            progWrap.classList.remove('is-indeterminate');
            progBar.style.width = `${Math.max(0, Math.min(100, n))}%`;
          } else {
            progWrap.classList.add('is-indeterminate');
            progBar.style.width = '';
          }
          if(typeof metaText === 'string') metaEl.textContent = metaText;
        }
      };
    }

    
    // ===== Cache planów rozkroju (żeby nie liczyć ponownie)
    const PLAN_CACHE_KEY = 'fc_rozrys_plan_cache_v1';

    function hashStr(s){
      // szybki, stabilny hash (djb2)
      let h = 5381;
      for(let i=0;i<s.length;i++){
        h = ((h << 5) + h) + s.charCodeAt(i);
        h = h >>> 0;
      }
      return h.toString(16);
    }

    function loadPlanCache(){
      try{
        const raw = localStorage.getItem(PLAN_CACHE_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        return (obj && typeof obj === 'object') ? obj : {};
      }catch(_){
        return {};
      }
    }

    function savePlanCache(cache){
      try{
        // proste ograniczenie rozmiaru: trzymamy max 10 wpisów (ostatnie użyte)
        const entries = Object.entries(cache || {});
        if(entries.length > 10){
          entries.sort((a,b)=> (b[1].ts||0) - (a[1].ts||0));
          const keep = entries.slice(0, 10);
          const next = {};
          for(const [k,v] of keep) next[k] = v;
          cache = next;
        }
        localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify(cache || {}));
      }catch(_){}
    }

    function makePlanCacheKey(st, parts){
      // uwzględniamy: ustawienia + lista formatek + wyjątki słojów + okleiny (wpływają na edgeSub)
      const overrides = loadOverrides();
      const edgeStore = loadEdgeStore();
      const items = (parts||[]).map(p=>{
        const sig = partSignature(p);
        const allow = st.grain ? !!overrides[sig] : true;
        const e = edgeStore[sig] || {};
        return {
          k: sig,
          n: p.name,
          w: p.w,
          h: p.h,
          q: p.qty,
          ra: st.grain ? allow : true,
          ew1: !!e.w1, ew2: !!e.w2, eh1: !!e.h1, eh2: !!e.h2
        };
      }).sort((a,b)=> (a.k<b.k?-1:a.k>b.k?1:(a.w-b.w)||(a.h-b.h)));
      const keyObj = {
        st: {
          material: st.material,
          unit: st.unit,
          edgeSubMm: st.edgeSubMm,
          boardW: st.boardW, boardH: st.boardH,
          kerf: st.kerf, edgeTrim: st.edgeTrim,
          minScrapW: st.minScrapW,
          minScrapH: st.minScrapH,
          grain: st.grain,
          heur: st.heur,
          optimaxProfile: st.optimaxProfile,
          direction: st.direction,
          realHalfQty: Number(st.realHalfQty)||0,
          realHalfBoardW: Number(st.realHalfBoardW)||0,
          realHalfBoardH: Number(st.realHalfBoardH)||0,
        },
        items
      };
      return 'plan_' + hashStr(JSON.stringify(keyObj));
    }

function deriveAggForMode(mode){
  // mode: 'all' | 'fronts' | 'nofronts'
  const accByMat = {};
  const pushPart = (matKey, p)=>{
    const key = `${p.name}||${p.w}||${p.h}`;
    accByMat[matKey] = accByMat[matKey] || new Map();
    const map = accByMat[matKey];
    if(map.has(key)) map.get(key).qty += Number(p.qty)||0;
    else map.set(key, { name:p.name, w:p.w, h:p.h, qty:Number(p.qty)||1, material: matKey });
  };
  for(const mat of agg.materials){
    const parts = agg.byMaterial[mat] || [];
    for(const p of parts){
      const isFront = (p.name === "Front") || isFrontMaterialKey(p.material);
      if(mode === "fronts" && !isFront) continue;
      if(mode === "nofronts" && isFront) continue;
      const matKey = (mode === "all") ? normalizeFrontLaminatMaterialKey(p.material) : p.material;
      pushPart(matKey, Object.assign({}, p, { material: matKey }));
    }
  }
  const materials = Object.keys(accByMat).sort((a,b)=>a.localeCompare(b,"pl"));
  const byMaterial = {};
  for(const m of materials){
    byMaterial[m] = Array.from(accByMat[m].values()).sort((a,b)=>{
      const aa = Math.max(a.w,a.h);
      const bb = Math.max(b.w,b.h);
      return bb-aa;
    });
  }
  return { byMaterial, materials };
}

let _rozrysRunId = 0;
let _rozrysRunning = false;
function setGlobalStatus(active, title, subtitle, percent, metaText){
  try{
    statusBox.style.display = 'none';
    statusMain.textContent = 'Liczę…';
    statusSub.textContent = '';
    statusMeta.textContent = '';
    statusProg.classList.add('is-indeterminate');
    statusProgBar.style.width = '';
  }catch(_){ }
}
try{ setGlobalStatus(false); }catch(_){ }
let _rozrysBtnMode = 'idle'; // idle | running | done
let _rozrysCancelRequested = false;
let _rozrysActiveCancel = null;
let _rozrysCancelTmr = null;
let _rozrysActiveTerminate = null;

function setGenBtnMode(mode){
  _rozrysBtnMode = mode;
  genBtn.classList.remove('btn-generate-green', 'btn-generate-blue', 'btn-generate-red');
  if(mode === 'running'){
    genBtn.textContent = 'Anuluj';
    genBtn.classList.add('btn-generate-red');
    genBtn.disabled = false;
    return;
  }
  if(mode === 'done'){
    genBtn.textContent = 'Generuj ponownie';
    genBtn.classList.add('btn-generate-blue');
    genBtn.disabled = false;
    return;
  }
  // idle = brak zapamiętanego rozkroju dla aktualnych ustawień
  genBtn.textContent = 'Generuj rozkrój';
  genBtn.classList.add('btn-generate-green');
  genBtn.disabled = false;
}

function requestCancel(){
  if(!_rozrysRunning) return;
  _rozrysCancelRequested = true;
  try{ setGlobalStatus(true, 'Anulowanie…', 'Wysyłam przerwanie do workera.', NaN, 'Jeśli worker nie odpowie, za chwilę wymuszę zatrzymanie.'); }catch(_){ }
  try{ _rozrysActiveCancel && _rozrysActiveCancel(); }catch(_){ }
  // twardy fallback: jeśli worker nie odpowie, terminate żeby UI nie wisiało
  if(_rozrysCancelTmr){ try{ clearTimeout(_rozrysCancelTmr); }catch(_){ } _rozrysCancelTmr = null; }
  _rozrysCancelTmr = setTimeout(()=>{
    if(!_rozrysRunning) return;
    try{ _rozrysActiveTerminate && _rozrysActiveTerminate(); }catch(_){ }
  }, 700);
}

async function generate(force){
  if(_rozrysRunning) return;
  _rozrysRunning = true;
  _rozrysCancelRequested = false;
  const runId = (++_rozrysRunId);
  setGenBtnMode('running');
  try{ await new Promise((resolve)=>{
    try{ requestAnimationFrame(()=> resolve()); }
    catch(_){ setTimeout(resolve, 0); }
  }); }catch(_){ }
  try{
  const sel = matSel.value;
  const baseSt = {
    unit: unitSel.value,
    edgeSubMm: Math.max(0, Number(edgeSel.value)||0),
    boardW: Number(inW.value)|| (unitSel.value==="mm"?2800:280),
    boardH: Number(inH.value)|| (unitSel.value==="mm"?2070:207),
    kerf: Number(inK.value)|| (unitSel.value==="mm"?4:0.4),
    edgeTrim: Number(inTrim.value)|| (unitSel.value==="mm"?20:2),
    minScrapW: Math.max(0, Number(inMinW.value)||0),
    minScrapH: Math.max(0, Number(inMinH.value)||0),
    grain: !!grainChk.checked,
    heur: 'optimax',
    optimaxProfile: heurSel.value,
    direction: normalizeCutDirection(dirSel.value),
  };

  const cache = loadPlanCache();

  const overallStartedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  let _overallTick = null;
  let _globalProgressInfo = { material:'', profile:'MAX', phase:'main', bestSheets:null, currentSheet:0, nextSheet:1, remaining:null, sheetEstimate:1, axis:null, seedIndex:null, seedTotal:null };
  function fmtElapsed(ms){ return `${(Math.max(0, Number(ms)||0)/1000).toFixed(1)} s`; }
  function axisProgressLabel(axis){ return axis === 'along' ? 'wzdłuż' : (axis === 'across' ? 'w poprzek' : '—'); }
  function buildProgressMeta(info, estimate){
    const phase = String(info && info.phase || 'main');
    const currentSheet = Math.max(0, Number(info && info.currentSheet) || 0);
    const nextSheet = Math.max(1, Number(info && info.nextSheet) || (currentSheet > 0 ? currentSheet + 1 : 1));
    const seedIndex = Number(info && info.seedIndex) || 0;
    const seedTotal = Number(info && info.seedTotal) || 0;
    const axisTxt = axisProgressLabel((info && info.axis) || (info && info.to) || null);
    const suffix = (seedIndex > 0 && seedTotal > 0) ? ` • wariant ${seedIndex}/${seedTotal}` : '';
    if(phase === 'sheet-closed'){
      return (Number(info && info.remaining) || 0) > 0
        ? `Postęp: zamknięta płyta ${currentSheet} z ~${estimate} • liczę płytę ${nextSheet}`
        : `Postęp: zamknięta płyta ${currentSheet} z ~${estimate}`;
    }
    if(phase === 'sheet-start') return `Start płyty ${nextSheet} z ~${estimate}`;
    if(phase === 'mandatory-axis-switch') return `Zmiana kierunku pasów: teraz ${axisTxt}`;
    if(phase === 'axis-switch-check') return `Brak idealnego pasa ${axisTxt} — sprawdzam drugi kierunek`;
    if(phase === 'axis-switched') return `Przełączono kierunek pasów na ${axisTxt}`;
    if(phase === 'fallback-band-used') return `Brak idealnego pasa — używam najlepszego dostępnego ${axisTxt}`;
    if(phase.indexOf('start') === 0) return `Analiza pasów startowych ${axisTxt}${suffix}`;
    if(phase.indexOf('residual') === 0) return `Domykanie arkusza pasami ${axisTxt}${suffix}`;
    if(currentSheet > 0) return `Postęp: zamknięta płyta ${currentSheet} z ~${estimate} • liczę płytę ${nextSheet}`;
    return 'Trwa liczenie — worker odpowiada w tle.';
  }
  function progressPercent(info, estimate){
    const currentSheet = Math.max(0, Number(info && info.currentSheet) || 0);
    return currentSheet > 0 ? Math.min(98, (currentSheet / Math.max(estimate, currentSheet)) * 100) : NaN;
  }
  function refreshGlobalTicker(){
    try{
      if(!_rozrysRunning) return;
      const prof = String(_globalProgressInfo.profile || 'MAX');
      const elapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - overallStartedAt;
      const bestTxt = _globalProgressInfo.bestSheets ? `${_globalProgressInfo.bestSheets} płyt` : '—';
      const estimate = Math.max(1, Number(_globalProgressInfo.sheetEstimate) || 1);
      const pct = progressPercent(_globalProgressInfo, estimate);
      const subtitle = `Liczę kolor: ${_globalProgressInfo.material || '—'} • Szacunek: ~${estimate} płyt • Najlepsze: ${bestTxt}`;
      const meta = buildProgressMeta(_globalProgressInfo, estimate);
      setGlobalStatus(true, `${prof} • ${fmtElapsed(elapsed)}`, subtitle, pct, meta);
    }catch(_){ }
  }
  function startGlobalTicker(material, profile, sheetEstimate){
    _globalProgressInfo.material = material || '';
    _globalProgressInfo.profile = profile || 'D';
    _globalProgressInfo.phase = 'main';
    _globalProgressInfo.bestSheets = null;
    _globalProgressInfo.currentSheet = 0;
    _globalProgressInfo.nextSheet = 1;
    _globalProgressInfo.remaining = null;
    _globalProgressInfo.sheetEstimate = Math.max(1, Number(sheetEstimate) || 1);
    _globalProgressInfo.axis = null;
    _globalProgressInfo.seedIndex = null;
    _globalProgressInfo.seedTotal = null;
    refreshGlobalTicker();
    if(_overallTick) return;
    _overallTick = setInterval(refreshGlobalTicker, 250);
  }
  function stopGlobalTicker(){
    try{ if(_overallTick) clearInterval(_overallTick); }catch(_){ }
    _overallTick = null;
  }

  const runOne = async (material, parts, target)=>{
    if(runId !== _rozrysRunId) return;
    const st = Object.assign({}, baseSt, { material, grain: !!(baseSt.grain && materialHasGrain(material)) });
    const unit3 = (st.unit === 'mm') ? 'mm' : 'cm';
    const toMm3 = (v)=>{
      const n = Number(v);
      if(!Number.isFinite(n)) return 0;
      return unit3 === 'mm' ? Math.round(n) : Math.round(n * 10);
    };
    const fullWmmForStock = toMm3(st.boardW) || 2800;
    const fullHmmForStock = toMm3(st.boardH) || 2070;
    const halfStock = getRealHalfStockForMaterial(material, fullWmmForStock, fullHmmForStock);
    st.realHalfQty = Math.max(0, Number(halfStock.qty) || 0);
    st.realHalfBoardW = Math.round(Number(halfStock.width) || 0);
    st.realHalfBoardH = Math.round(Number(halfStock.height) || 0);
    const cacheKey = makePlanCacheKey(st, parts);
    if(!force && cache[cacheKey] && cache[cacheKey].plan){
      const cached = cache[cacheKey].plan;
      if(runId !== _rozrysRunId) return;
      renderOutput(cached, { material, kerf: st.kerf, heur: formatHeurLabel(st), unit: st.unit, edgeSubMm: st.edgeSubMm, meta: cached.meta }, target);
      setGenBtnMode('done');
      return;
    }

    // Optimax mode: profile-driven worker for strip-oriented cut styles.
    if(st.heur === "optimax"){
      const preset = getOptimaxProfilePreset(st.optimaxProfile, st.direction);
      const cutMode = normalizeCutDirection(st.direction);
      const unit2 = (st.unit === 'mm') ? 'mm' : 'cm';
      const toMm2 = (v)=>{
        const n = Number(v);
        if(!Number.isFinite(n)) return 0;
        return unit2 === 'mm' ? Math.round(n) : Math.round(n * 10);
      };
      const W02 = toMm2(st.boardW) || 2800;
      const H02 = toMm2(st.boardH) || 2070;
      const K2  = toMm2(st.kerf)   || 4;
      const trim2 = toMm2(st.edgeTrim) || 20;
      const minScrapW2 = toMm2(st.minScrapW) || 0;
      const minScrapH2 = toMm2(st.minScrapH) || 0;
      const W2 = Math.max(10, W02 - 2*trim2);
      const H2 = Math.max(10, H02 - 2*trim2);
      const roughArea = (parts||[]).reduce((sum, p)=> sum + ((Number(p.w)||0) * (Number(p.h)||0) * Math.max(1, Number(p.qty)||1)), 0);
      const roughSheetsEstimate = Math.max(1, Math.ceil(roughArea / Math.max(1, W2 * H2)));

      const profileLabel = speedLabel(st.optimaxProfile || 'max');
      const loading = renderLoadingInto(target || null, `${profileLabel} • ${directionLabel(st.direction)} • 0.0 s`, `Liczę kolor: ${material} • Szacunek: ~${roughSheetsEstimate} płyt • Najlepsze: —`);
      startGlobalTicker(material, profileLabel, roughSheetsEstimate);
      const materialStartedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const materialProgress = { phase:'main', bestSheets:null, currentSheet:0, nextSheet:1, remaining:null, sheetEstimate:roughSheetsEstimate, axis:null, seedIndex:null, seedTotal:null };
      function refreshMaterialTicker(){
        try{
          const elapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - materialStartedAt;
          const bestTxt = materialProgress.bestSheets ? `${materialProgress.bestSheets} płyt` : '—';
          const currentSheet = Math.max(0, Number(materialProgress.currentSheet) || 0);
          const est = Math.max(1, Number(materialProgress.sheetEstimate) || roughSheetsEstimate || 1);
          const pct = progressPercent(materialProgress, est);
          const metaText = buildProgressMeta(materialProgress, est);
          if(loading && loading.textEl) loading.textEl.textContent = `${profileLabel} • ${directionLabel(st.direction)} • ${fmtElapsed(elapsed)}`;
          if(loading && loading.subEl) loading.subEl.textContent = `Liczę kolor: ${material} • Szacunek: ~${est} płyt • Najlepsze: ${bestTxt}`;
          if(loading && typeof loading.setProgress === 'function') loading.setProgress(pct, metaText);
          _globalProgressInfo.material = material;
          _globalProgressInfo.profile = profileLabel;
          _globalProgressInfo.phase = materialProgress.phase;
          _globalProgressInfo.bestSheets = materialProgress.bestSheets;
          _globalProgressInfo.currentSheet = currentSheet;
          _globalProgressInfo.nextSheet = Math.max(1, Number(materialProgress.nextSheet) || (currentSheet > 0 ? currentSheet + 1 : 1));
          _globalProgressInfo.remaining = materialProgress.remaining;
          _globalProgressInfo.sheetEstimate = est;
          _globalProgressInfo.axis = materialProgress.axis;
          _globalProgressInfo.seedIndex = materialProgress.seedIndex;
          _globalProgressInfo.seedTotal = materialProgress.seedTotal;
          refreshGlobalTicker();
        }catch(_){ }
      }
      const materialTicker = setInterval(refreshMaterialTicker, 250);
      refreshMaterialTicker();
      try{
        if(loading && typeof loading.setProgress === 'function') loading.setProgress(NaN, 'Inicjalizacja workera…');
        if(loading && loading.subEl) loading.subEl.textContent = `Liczę kolor: ${material} • Szacunek: ~${roughSheetsEstimate} płyt • Start workera…`;
        setGlobalStatus(true, `${profileLabel} • ${directionLabel(st.direction)} • 0.0 s`, `Liczę kolor: ${material} • Szacunek: ~${roughSheetsEstimate} płyt • Start workera…`, NaN, 'Inicjalizacja workera…');
      }catch(_){ }
      let plan = null;
      const control = { runId };
      _rozrysActiveCancel = ()=>{
        try{ control._cancelRequested = true; }catch(_){ }
        try{ control.cancel && control.cancel(); }catch(_){ }
      };
      _rozrysActiveTerminate = ()=>{
        try{ control._terminate && control._terminate(); }catch(_){ }
      };
      try{
        plan = await computePlanPanelProAsync(st, parts, (p)=>{
          try{
            materialProgress.phase = (p && p.phase) ? String(p.phase) : 'main';
            materialProgress.bestSheets = (p && Number(p.bestSheets)) ? Number(p.bestSheets) : null;
            materialProgress.currentSheet = (p && typeof p.currentSheet === 'number') ? Number(p.currentSheet) : materialProgress.currentSheet;
            materialProgress.nextSheet = (p && typeof p.nextSheet === 'number') ? Number(p.nextSheet) : materialProgress.nextSheet;
            materialProgress.remaining = (p && typeof p.remaining === 'number') ? Number(p.remaining) : materialProgress.remaining;
            materialProgress.sheetEstimate = (p && Number(p.sheetEstimate)) ? Number(p.sheetEstimate) : materialProgress.sheetEstimate;
            materialProgress.axis = (p && p.axis) ? String(p.axis) : materialProgress.axis;
            materialProgress.seedIndex = (p && typeof p.seedIndex === 'number') ? Number(p.seedIndex) : materialProgress.seedIndex;
            materialProgress.seedTotal = (p && typeof p.seedTotal === 'number') ? Number(p.seedTotal) : materialProgress.seedTotal;
            refreshMaterialTicker();
          }catch(_){ }
        }, control, {
          beamWidth: preset.beamWidth,
          endgameAttempts: preset.endgameAttempts,
          cutPref: cutMode,
          cutMode,
          minScrapW: minScrapW2,
          minScrapH: minScrapH2,
          speedMode: String(st.optimaxProfile || 'max').toLowerCase(),
          optimaxProfile: String(st.optimaxProfile || 'max').toLowerCase(),
          sheetEstimate: roughSheetsEstimate,
          optimax: true,
          realHalfQty: Math.max(0, Number(st.realHalfQty) || 0),
          realHalfBoardW: Math.round(Number(st.realHalfBoardW) || 0),
          realHalfBoardH: Math.round(Number(st.realHalfBoardH) || 0),
        });
      }catch(e){
        plan = { sheets: [], note: 'Błąd podczas liczenia (Optimax).' };
      } finally {
        try{ clearInterval(materialTicker); }catch(_){ }
        _rozrysActiveCancel = null;
        _rozrysActiveTerminate = null;
        if(_rozrysCancelTmr){ try{ clearTimeout(_rozrysCancelTmr); }catch(_){ } _rozrysCancelTmr = null; }
      }

      // Jeśli worker timeout/wywalił się — daj szybki fallback zamiast "Brak wyniku".
      // Dla MAX nie schodzimy już na synchroniczny fallback na głównym wątku,
      // bo to zamraża UI i sprawia wrażenie zawieszenia jeszcze przed startem.
      if((!plan || !Array.isArray(plan.sheets) || plan.sheets.length === 0) && !(plan && plan.noSyncFallback)){
        try{
          const opt2 = FC.cutOptimizer;
          const grainOn2 = !!st.grain;
          const overrides2 = loadOverrides();
          const edgeStore2 = loadEdgeStore();
          const partsMm2 = (parts||[]).map(p=>{
            const sig = partSignature(p);
            const allow = grainOn2 ? !!overrides2[sig] : true;
            const e = edgeStore2[sig] || {};
            return {
              key: sig,
              name: p.name,
              w: p.w,
              h: p.h,
              qty: p.qty,
              material: p.material,
              rotationAllowed: grainOn2 ? allow : true,
              edgeW1: !!e.w1,
              edgeW2: !!e.w2,
              edgeH1: !!e.h1,
              edgeH2: !!e.h2,
            };
          });
          const items2 = opt2.makeItems(partsMm2);
          const unit2 = (st.unit === 'mm') ? 'mm' : 'cm';
          const toMm2 = (v)=>{
            const n = Number(v);
            if(!Number.isFinite(n)) return 0;
            return unit2 === 'mm' ? Math.round(n) : Math.round(n * 10);
          };
          const W02 = toMm2(st.boardW) || 2800;
          const H02 = toMm2(st.boardH) || 2070;
          const K2  = toMm2(st.kerf)   || 4;
          const trim2 = toMm2(st.edgeTrim) || 20;
          const minScrapW2 = toMm2(st.minScrapW) || 0;
          const minScrapH2 = toMm2(st.minScrapH) || 0;
          const W2 = Math.max(10, W02 - 2*trim2);
          const H2 = Math.max(10, H02 - 2*trim2);
          const startMode2 = normalizeCutDirection(st.direction);
          const speedMode2 = FC.cutOptimizer && FC.cutOptimizer.normalizeSpeedMode ? FC.cutOptimizer.normalizeSpeedMode(st.optimaxProfile) : 'max';
          const startStrategy2 = FC.rozkrojStarts && FC.rozkrojStarts[startMode2];
          const speed2 = FC.rozkrojSpeeds && FC.rozkrojSpeeds[speedMode2];
          const packed2 = speed2 && typeof speed2.pack === 'function'
            ? speed2.pack(items2, W2, H2, K2, {
                startStrategy: startStrategy2,
                startMode: startMode2,
                speedMode: speedMode2,
                realHalfQty: Math.max(0, Number(st.realHalfQty) || 0),
                realHalfBoardW: Math.round(Number(st.realHalfBoardW) || 0),
                realHalfBoardH: Math.round(Number(st.realHalfBoardH) || 0),
              })
            : { sheets: opt2.packShelf(items2, W2, H2, K2, 'along') };
          plan = { sheets: packed2.sheets || [], cancelled: !!(plan && plan.cancelled), meta: { trim: trim2, boardW: W02, boardH: H02, unit: unit2 }, note: plan && plan.note ? plan.note : undefined };
        }catch(_){ }
      }
      try{ cache[cacheKey] = { ts: Date.now(), plan }; savePlanCache(cache); }catch(_){}
      renderOutput(plan, { material, kerf: st.kerf, heur: formatHeurLabel(st), unit: st.unit, edgeSubMm: st.edgeSubMm, meta: plan.meta, cancelled: !!plan.cancelled }, target);
      try{ setGlobalStatus(false, '', ''); }catch(_){ }
      setGenBtnMode('done');
      return;
    }

    const plan = computePlan(st, parts);
    try{ cache[cacheKey] = { ts: Date.now(), plan }; savePlanCache(cache); }catch(_){}
    renderOutput(plan, { material, kerf: st.kerf, heur: formatHeurLabel(st), unit: st.unit, edgeSubMm: st.edgeSubMm, meta: plan.meta }, target);
    setGenBtnMode('done');
  };

  if(sel === "__ALL__" || sel === "__FRONTS__" || sel === "__NO_FRONTS__"){
    out.innerHTML = "";
    const mode = (sel === "__ALL__") ? "all" : (sel === "__FRONTS__") ? "fronts" : "nofronts";
    const derived = deriveAggForMode(mode);
    if(!derived.materials.length){
      out.appendChild(h("div", { class:"muted", text:"Brak elementów do wygenerowania dla wybranego trybu." }));
      return;
    }
    for(const m of derived.materials){
      const parts = derived.byMaterial[m] || [];
      const box = h("div", { style:"margin-top:12px" });
      out.appendChild(box);
      await runOne(m, parts, box);
      if(_rozrysCancelRequested) break;
    }
    return;
  }

  const material = sel;
  const parts = agg.byMaterial[material] || [];
  await runOne(material, parts, null);
  } finally {
    _rozrysRunning = false;
    try{ stopGlobalTicker(); }catch(_){ }
    try{ setGlobalStatus(false); }catch(_){ }
    if(_rozrysBtnMode === 'running') setGenBtnMode('idle');
  }
}

// events
    unitSel.addEventListener('change', ()=>{
      applyUnitChange(unitSel.value);
      persistOptionPrefs();
      tryAutoRenderFromCache();
    });

    matSel.addEventListener('change', ()=>{
      const v = matSel.value;
      if(v && !String(v).startsWith('__')) applyHintFromMagazyn(v);
      updateGrainAvailability();
      renderOverrides();
      tryAutoRenderFromCache();
    });
    grainChk.addEventListener('change', ()=>{
      renderOverrides();
      tryAutoRenderFromCache();
    });
    heurSel.addEventListener('change', ()=>{
      tryAutoRenderFromCache();
    });
    dirSel.addEventListener('change', ()=>{
      tryAutoRenderFromCache();
    });
    openOptionsBtnInline.addEventListener('click', openOptionsModal);
    inMinW.addEventListener('change', ()=>{ persistOptionPrefs(); tryAutoRenderFromCache(); });
    inMinH.addEventListener('change', ()=>{ persistOptionPrefs(); tryAutoRenderFromCache(); });

    edgeSel.addEventListener('change', ()=>{
      persistOptionPrefs();
      tryAutoRenderFromCache();
    });

    saveToMag.addEventListener('click', ()=>{
      if(!(FC.magazyn && FC.magazyn.upsertSheet)) return alert('Brak modułu magazynu');
      const material = matSel.value;
      const u = unitSel.value;
      const w = (u==='mm') ? (Number(inW.value)||0) : Math.round((Number(inW.value)||0)*10);
      const hh = (u==='mm') ? (Number(inH.value)||0) : Math.round((Number(inH.value)||0)*10);
      if(!(w>0 && hh>0)) return alert('Podaj format płyty');
      FC.magazyn.upsertSheet({ material, width:w, height:hh, qty:0 });
      alert('Zapisano format w Magazyn (ilość = 0).');
    });

    genBtn.addEventListener('click', ()=>{
      if(_rozrysRunning){
        requestCancel();
        return;
      }
      // "Generuj ponownie" must bypass cache and recompute.
      const force = (_rozrysBtnMode === 'done');
      generate(force);
    });

    // auto preview from cache when user tweaks parameters
    [inW, inH].forEach(el=>{
      el.addEventListener('input', ()=>{
        tryAutoRenderFromCache();
      });
      el.addEventListener('change', ()=>{
        tryAutoRenderFromCache();
      });
    });
    [inK, inTrim].forEach(el=>{
      el.addEventListener('input', ()=>{
        persistOptionPrefs();
        tryAutoRenderFromCache();
      });
      el.addEventListener('change', ()=>{
        persistOptionPrefs();
        tryAutoRenderFromCache();
      });
    });

    // initial
    persistOptionPrefs();
    updateGrainAvailability();
    renderOverrides();
    tryAutoRenderFromCache();
  }

  FC.rozrys = {
    render,
    aggregatePartsForProject,
  };
})();

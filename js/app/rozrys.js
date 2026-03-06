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

  function cmToMm(v){
    // obsługa 0.1cm -> 1mm
    const n = Number(v);
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
  function drawSheet(canvas, sheet, displayUnit, edgeSubMm){
    try{
      const ctx = canvas.getContext('2d');
      const unit = (displayUnit === 'cm') ? 'cm' : 'mm';
      const W = sheet.boardW;
      const H = sheet.boardH;

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
        const x = p.x * scale;
        const y = p.y * scale;
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
        cutPref: state.direction || 'auto',
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
      const dir = state.direction || 'auto';
      const toShelfDir = (d)=> (d==='along') ? 'wzdłuż' : (d==='across') ? 'wpoprz' : d;
      if(dir === 'auto'){
        const a = opt.packShelf(items, W, H, K, 'wzdłuż');
        const b = opt.packShelf(items, W, H, K, 'wpoprz');
        const score = (ss)=>{
          const totalWaste = ss.reduce((sum,s)=>sum + opt.calcWaste(s).waste,0);
          return { sheets: ss.length, waste: totalWaste };
        };
        const sa = score(a);
        const sb = score(b);
        sheets = (sb.sheets < sa.sheets || (sb.sheets === sa.sheets && sb.waste < sa.waste)) ? b : a;
      } else {
        sheets = opt.packShelf(items, W, H, K, toShelfDir(dir));
      }
    }
    // store meta for drawing offset
    return { sheets, meta: { trim, boardW: W0, boardH: H0, unit } };
  }

  // ===== Panel-saw PRO (30s) in Web Worker (non-blocking) =====
  // Uwaga: na mobile WebWorker potrafi "zawisnąć" sporadycznie (brak done/error).
  // Dlatego uruchamiamy worker per-run (bez re-używania singletona) + watchdog + hard reset.
  function computePlanPanelProAsync(state, parts, onProgress, control){
    return new Promise((resolve)=>{
      const opt = FC.cutOptimizer;
      if(!opt) return resolve({ sheets: [], note: 'Brak modułu cutOptimizer.' });

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
        worker = new Worker('js/app/panel-pro-worker.js?v=20260306_02');
      }catch(e){
        // fallback (sync, limited)
        try{
          const sheets = opt.packGuillotineBeam(items, W, H, K, { beamWidth: 120, timeMs: 800, scrapFirst:true });
          return resolve({ sheets, meta: { trim, boardW: W0, boardH: H0, unit } });
        }catch(_){
          return resolve({ sheets: [], note: 'Nie udało się uruchomić Web Worker.' });
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
          finish({ sheets: [], note: msg.error || 'Błąd worker', meta: { trim, boardW: W0, boardH: H0, unit } });
        }
      };

      const onErr = ()=>{
        // Worker script failed to load or runtime error
        finish({ sheets: [], note: 'Błąd Web Workera (nie udało się wykonać obliczeń).', meta: { trim, boardW: W0, boardH: H0, unit } });
      };

      const onMsgErr = ()=>{
        finish({ sheets: [], note: 'Błąd komunikacji z Web Workerem.', meta: { trim, boardW: W0, boardH: H0, unit } });
      };

      worker.addEventListener('message', handle);
      worker.addEventListener('error', onErr);
      worker.addEventListener('messageerror', onMsgErr);

      // Watchdog: if worker never responds (mobile/browser edge cases), unblock UI.
      tmr = setTimeout(()=>{
        finish({ sheets: [], note: 'Liczenie przerwane: przekroczono limit czasu (brak odpowiedzi workera).', meta: { trim, boardW: W0, boardH: H0, unit } });
      }, 35000);

      try{
        worker.postMessage({
          cmd: 'panel_pro',
          runId,
          items,
          W, H, K,
          options: { timeBudgetMs: 30000, perSheetMs: 420, beamWidth: 220, cutPref: state.direction || 'auto' }
        });
      }catch(e){
        // Posting failed: cleanup and return
        finish({ sheets: [], note: 'Nie udało się wystartować liczenia.', meta: { trim, boardW: W0, boardH: H0, unit } });
      }
    });
  }

  function render(){
    const root = document.getElementById('rozrysRoot');
    if(!root) return;

    const agg = aggregatePartsForProject();

    root.innerHTML = '';

    const card = h('div', { class:'card' });
    card.appendChild(h('div', { style:'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap' }, [
      h('h3', { style:'margin:0', text:'Rozrys płyt (MVP)' }),
      h('div', { class:'muted xs', text:'Źródło: Materiały → rozpiska mebli' })
    ]));

    if(!agg.materials.length){
      card.appendChild(h('div', { class:'muted', style:'margin-top:10px', html:'Brak rozpiski materiałów. Dodaj szafki, żeby ROZRYS miał co ciąć.' }));
      root.appendChild(card);
      return;
    }

    // state (ui) — keep local per render
    const state = {
      material: agg.materials[0],
      unit: 'cm',
      boardW: 280,
      boardH: 207,
      kerf: 0.4,
      edgeTrim: 2,
      grain: true,
      heur: 'shelf',
      direction: 'auto',
    };

    // if magazyn has hint for first material
    function toDisp(mm){ return state.unit === 'mm' ? mm : (mm/10); }
    function fromDisp(v){ return state.unit === 'mm' ? Number(v) : (Number(v) * 10); }

    try{
      const hint = (FC.magazyn && FC.magazyn.findForMaterial) ? FC.magazyn.findForMaterial(state.material) : [];
      if(hint && hint[0]){
        state.boardW = toDisp(hint[0].width || 2800);
        state.boardH = toDisp(hint[0].height || 2070);
      }
    }catch(_){ }

    // top row: material + units + edge compensation
    const controls = h('div', { class:'grid-3', style:'margin-top:12px' });
    // material select
    const matWrap = h('div');
    matWrap.appendChild(h('label', { text:'Materiał' }));
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
    matWrap.appendChild(matSel);
    controls.appendChild(matWrap);

    // units selector
    const unitWrap = h('div');
    unitWrap.appendChild(h('label', { text:'Jednostki' }));
    const unitSel = h('select', { id:'rozUnit' });
    unitSel.innerHTML = `
      <option value="cm" ${state.unit==='cm'?'selected':''}>cm</option>
      <option value="mm" ${state.unit==='mm'?'selected':''}>mm</option>
    `;
    unitWrap.appendChild(unitSel);
    controls.appendChild(unitWrap);

    // edge compensation selector (labels/exports only)
    const edgeWrap = h('div');
    edgeWrap.appendChild(h('label', { text:'Odjąć okleinę?' }));
    const edgeSel = h('select', { id:'rozEdgeSub' });
    edgeSel.innerHTML = `
      <option value="0" selected>NIE</option>
      <option value="1">Tak - 1mm</option>
      <option value="2">Tak - 2mm</option>
    `;
    edgeWrap.appendChild(edgeSel);
    controls.appendChild(edgeWrap);

    // second row: board size + kerf + trim (move format inputs lower as requested)
    const controlsSize = h('div', { class:'grid-3', style:'margin-top:12px' });

    // board size
    const sizeWrap = h('div');
    sizeWrap.appendChild(h('label', { text:`Format płyty (${state.unit})` }));
    const sizeRow = h('div', { style:'display:flex;gap:8px' });
    const inW = h('input', { id:'rozW', type:'number', value:String(state.boardW) });
    const inH = h('input', { id:'rozH', type:'number', value:String(state.boardH) });
    sizeRow.appendChild(inW); sizeRow.appendChild(inH);
    sizeWrap.appendChild(sizeRow);
    controlsSize.appendChild(sizeWrap);

    // kerf
    const kerfWrap = h('div');
    kerfWrap.appendChild(h('label', { text:`Kerf (${state.unit})` }));
    const inK = h('input', { id:'rozK', type:'number', value:String(state.kerf) });
    kerfWrap.appendChild(inK);
    controlsSize.appendChild(kerfWrap);

    // edge trim
    const trimWrap = h('div');
    trimWrap.appendChild(h('label', { text:`Równanie płyty w koło (${state.unit})` }));
    const inTrim = h('input', { id:'rozTrim', type:'number', value:String(state.edgeTrim) });
    trimWrap.appendChild(inTrim);
    controlsSize.appendChild(trimWrap);

    // second row: grain + heuristic + direction
    const controls2 = h('div', { class:'grid-3', style:'margin-top:12px' });

    const grainWrap = h('div');
    grainWrap.appendChild(h('label', { text:'Słoje' }));
    const grainRow = h('div', { style:'display:flex;align-items:center;gap:10px' });
    const grainChk = h('input', { id:'rozGrain', type:'checkbox' });
    grainChk.checked = true;
    grainRow.appendChild(grainChk);
    grainRow.appendChild(h('div', { class:'muted xs', text:'Pilnuj kierunku (obrót zablokowany, chyba że zaznaczysz wyjątek).' }));
    grainWrap.appendChild(grainRow);
    controls2.appendChild(grainWrap);

    const heurWrap = h('div');
    heurWrap.appendChild(h('label', { text:'Heurystyka' }));
    const heurSel = h('select', { id:'rozHeur' });
    heurSel.innerHTML = `
      <option value="shelf">Szybkie i proste</option>
      <option value="gpro">Dokładne upakowanie</option>
      <option value="super">Super upakowanie</option>
      <option value="panel30">Ultra 30sekund</option>
    `;
    heurWrap.appendChild(heurSel);
    controls2.appendChild(heurWrap);

    const dirWrap = h('div');
    dirWrap.appendChild(h('label', { text:'Kierunek cięcia (pod piłę)' }));
    const dirSel = h('select', { id:'rozDir' });
    dirSel.innerHTML = `
      <option value="auto">Auto</option>
      <option value="along">Preferuj w poprzek</option>
      <option value="across">Preferuj wzdłuż</option>
    `;
    dirWrap.appendChild(dirSel);
    controls2.appendChild(dirWrap);

    card.appendChild(controls);
    card.appendChild(controlsSize);
    card.appendChild(controls2);

    // action buttons
    const btnRow = h('div', { style:'display:flex;gap:10px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap' });
    const saveToMag = h('button', { class:'btn', type:'button' });
    saveToMag.textContent = 'Zapisz format do magazynu';
    const genBtn = h('button', { class:'btn-primary', type:'button' });
    genBtn.textContent = 'Generuj rozkrój';
    btnRow.appendChild(saveToMag);
    btnRow.appendChild(genBtn);
    card.appendChild(btnRow);

    // overrides list container
    const overridesBox = h('div', { style:'margin-top:12px;display:none' });
    card.appendChild(overridesBox);

    // output
    const out = h('div', { style:'margin-top:12px' });
    card.appendChild(out);

    root.appendChild(card);

    function applyHintFromMagazyn(material){
      try{
        const hint = (FC.magazyn && FC.magazyn.findForMaterial) ? FC.magazyn.findForMaterial(material) : [];
        if(hint && hint[0]){
          const wmm = hint[0].width || 2800;
          const hmm = hint[0].height || 2070;
          const u = unitSel.value;
          inW.value = String(u==='mm' ? wmm : (Math.round((wmm/10)*10)/10));
          inH.value = String(u==='mm' ? hmm : (Math.round((hmm/10)*10)/10));
        }
      }catch(_){ }
    }

    // Helper: whether current material (by name) is marked as having grain in the price list.
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
        // Grain is applied per-material (only where the price list marks it as having grain).
        grain: !!grainChk.checked,
        heur: heurSel.value,
        direction: dirSel.value,
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
              renderOutput(plan, { material: m, kerf: st.kerf, heur: st.heur, unit: st.unit, edgeSubMm: st.edgeSubMm, meta: plan.meta }, box);
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
        const cacheKey = makePlanCacheKey(st, parts);
        if(cache[cacheKey] && cache[cacheKey].plan){
          const plan = cache[cacheKey].plan;
          renderOutput(plan, { material, kerf: st.kerf, heur: st.heur, unit: st.unit, edgeSubMm: st.edgeSubMm, meta: plan.meta }, null);
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
      if(!sheets.length){
        tgt.appendChild(h('div', { class:'muted', text:'Brak wyniku.' }));
        return;
      }

      const sum = sheets.reduce((acc,s)=>{
        const w = opt.calcWaste(s);
        acc.area += w.areaBoard;
        acc.used += w.used;
        acc.waste += w.waste;
        return acc;
      }, { area:0, used:0, waste:0 });

      const pct = sum.area>0 ? (sum.waste/sum.area)*100 : 0;

      const cancelledNote = (meta && meta.cancelled) ? '<div class="muted xs" style="margin-top:6px;font-weight:700">Generowanie przerwane — pokazuję najlepszy wynik do tej pory.</div>' : '';
      tgt.appendChild(h('div', { class:'card', style:'margin:0', html:`
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div><strong>Materiał:</strong> ${meta.material}</div>
          <div><strong>Płyty:</strong> ${sheets.length} szt.</div>
          <div><strong>Odpad:</strong> ${pct.toFixed(1)}%</div>
        </div>
        ${cancelledNote}
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
            drawSheet(c, s, u, edgeSubMm);
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
        html += `<div class="meta">Płyty: ${sheets.length} • Kerf: ${meta.kerf}${u} • Heurystyka: ${meta.heur}${edgeNote}</div>`;
        sheets.forEach((s,i)=>{
          html += `<div class="sheet"><div class="meta"><strong>Arkusz ${i+1}</strong> — ${mmToUnitStr(s.boardW, u)}×${mmToUnitStr(s.boardH, u)} ${u}</div>`;
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
        box.appendChild(h('div', { style:'display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap' }, [
          h('div', { style:'font-weight:900', text:`Arkusz ${i+1}` }),
          h('div', { class:'muted xs', text:`${mmToUnitStr(s.boardW, u)}×${mmToUnitStr(s.boardH, u)} ${u}` })
        ]));
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.marginTop = '10px';
        box.appendChild(canvas);
        tgt.appendChild(box);
        drawSheet(canvas, s, u, edgeSubMm);
      });
    }

    function renderLoading(text){
      return renderLoadingInto(null, text);
    }

    function renderLoadingInto(target, text){
      const tgt = target || out;
      tgt.innerHTML = '';
      const box = h('div', { class:'rozrys-loading' });
      box.appendChild(h('div', { class:'rozrys-spinner' }));
      const textEl = h('div', { class:'rozrys-loading-text', text: text || 'Liczę…' });
      box.appendChild(textEl);
      tgt.appendChild(box);
      return { box, textEl, target: tgt };
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
          grain: st.grain,
          heur: st.heur,
          direction: st.direction,
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
let _rozrysBtnMode = 'idle'; // idle | running | done
let _rozrysCancelRequested = false;
let _rozrysActiveCancel = null;

function setGenBtnMode(mode){
  _rozrysBtnMode = mode;
  if(mode === 'running'){
    genBtn.textContent = 'Anuluj rozkrój';
    genBtn.disabled = false;
    return;
  }
  if(mode === 'done'){
    genBtn.textContent = 'Generuj ponownie';
    genBtn.disabled = false;
    return;
  }
  // idle
  genBtn.textContent = 'Generuj rozkrój';
  genBtn.disabled = false;
}

function requestCancel(){
  if(!_rozrysRunning) return;
  _rozrysCancelRequested = true;
  try{ _rozrysActiveCancel && _rozrysActiveCancel(); }catch(_){ }
}

async function generate(force){
  if(_rozrysRunning) return;
  _rozrysRunning = true;
  _rozrysCancelRequested = false;
  const runId = (++_rozrysRunId);
  setGenBtnMode('running');
  try{
  const sel = matSel.value;
  const baseSt = {
    unit: unitSel.value,
    edgeSubMm: Math.max(0, Number(edgeSel.value)||0),
    boardW: Number(inW.value)|| (unitSel.value==="mm"?2800:280),
    boardH: Number(inH.value)|| (unitSel.value==="mm"?2070:207),
    kerf: Number(inK.value)|| (unitSel.value==="mm"?4:0.4),
    edgeTrim: Number(inTrim.value)|| (unitSel.value==="mm"?20:2),
    grain: !!grainChk.checked,
    heur: heurSel.value,
    direction: dirSel.value,
  };

  const cache = loadPlanCache();

  const runOne = async (material, parts, target)=>{
    if(runId !== _rozrysRunId) return;
    const st = Object.assign({}, baseSt, { material, grain: !!(baseSt.grain && materialHasGrain(material)) });
    const cacheKey = makePlanCacheKey(st, parts);
    if(!force && cache[cacheKey] && cache[cacheKey].plan){
      const cached = cache[cacheKey].plan;
      if(runId !== _rozrysRunId) return;
      renderOutput(cached, { material, kerf: st.kerf, heur: st.heur, unit: st.unit, edgeSubMm: st.edgeSubMm, meta: cached.meta }, target);
      setGenBtnMode('done');
      return;
    }

    // Pro mode: panel saw (30s) should not block UI.
    if(st.heur === "panel30"){
      const loading = renderLoadingInto(target || null, "Liczę… 0.0 s");
      let plan = null;
      const startedAt = (window.performance && performance.now) ? performance.now() : Date.now();
      let tick = null;
      const control = { runId };
      // Make cancel responsive even if user taps very quickly (before worker is ready).
      _rozrysActiveCancel = ()=>{
        try{ control._cancelRequested = true; }catch(_){ }
        try{ control.cancel && control.cancel(); }catch(_){ }
      };
      try{
        // Lokalny licznik czasu — niezależny od progress z workera
        tick = setInterval(()=>{
          const now = (window.performance && performance.now) ? performance.now() : Date.now();
          const t = ((now - startedAt)/1000).toFixed(1);
          if(loading && loading.textEl) loading.textEl.textContent = `Liczę… ${t} s`;
        }, 120);

        plan = await computePlanPanelProAsync(st, parts, (p)=>{
          try{ void(p); }catch(_){ }
        }, control);
      }catch(e){
        plan = { sheets: [], note: 'Błąd podczas liczenia (Ultra 30sek).' };
      } finally {
        if(tick){ try{ clearInterval(tick); }catch(_){ } tick = null; }
        _rozrysActiveCancel = null;
      }

      // Jeśli worker timeout/wywalił się — daj szybki fallback zamiast "Brak wyniku".
      if(!plan || !Array.isArray(plan.sheets) || plan.sheets.length === 0){
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
          const W2 = Math.max(10, W02 - 2*trim2);
          const H2 = Math.max(10, H02 - 2*trim2);
          const sheets2 = opt2.packGuillotineBeam(items2, W2, H2, K2, {
            beamWidth: 110,
            timeMs: 900,
            cutPref: st.direction || 'auto',
            scrapFirst: true,
          });
          plan = { sheets: sheets2, cancelled: !!(plan && plan.cancelled), meta: { trim: trim2, boardW: W02, boardH: H02, unit: unit2 }, note: plan && plan.note ? plan.note : undefined };
        }catch(_){ }
      }
      try{ cache[cacheKey] = { ts: Date.now(), plan }; savePlanCache(cache); }catch(_){}
      renderOutput(plan, { material, kerf: st.kerf, heur: st.heur, unit: st.unit, edgeSubMm: st.edgeSubMm, meta: plan.meta, cancelled: !!plan.cancelled }, target);
      setGenBtnMode('done');
      return;
    }

    const plan = computePlan(st, parts);
    try{ cache[cacheKey] = { ts: Date.now(), plan }; savePlanCache(cache); }catch(_){}
    renderOutput(plan, { material, kerf: st.kerf, heur: st.heur, unit: st.unit, edgeSubMm: st.edgeSubMm, meta: plan.meta }, target);
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
    if(_rozrysBtnMode === 'running') setGenBtnMode('idle');
  }
}

// events
    unitSel.addEventListener('change', ()=>{
      const prev = state.unit;
      const next = unitSel.value;
      if(prev === next) return;
      const factor = (prev==='cm' && next==='mm') ? 10 : (prev==='mm' && next==='cm') ? 0.1 : 1;
      const conv = (el)=>{
        const n = Number(el.value);
        if(!Number.isFinite(n)) return;
        const v = n * factor;
        // keep 1 decimal max in cm
        el.value = (next==='cm') ? String(Math.round(v*10)/10) : String(Math.round(v));
      };
      conv(inW); conv(inH); conv(inK); conv(inTrim);
      state.unit = next;
      // update labels
      sizeWrap.querySelector('label').textContent = `Format płyty (${next})`;
      kerfWrap.querySelector('label').textContent = `Kerf (${next})`;
      trimWrap.querySelector('label').textContent = `Równanie płyty w koło (${next})`;
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
      const usesDir = (heurSel.value === 'shelf' || heurSel.value === 'panel30');
      dirSel.disabled = !usesDir;
      if(!usesDir) dirSel.value = 'auto';
      tryAutoRenderFromCache();
    });
    dirSel.addEventListener('change', ()=>{
      tryAutoRenderFromCache();
    });

    edgeSel.addEventListener('change', ()=>{
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
    [inW, inH, inK, inTrim].forEach(el=>{
      el.addEventListener('input', ()=>{
        tryAutoRenderFromCache();
      });
      el.addEventListener('change', ()=>{
        tryAutoRenderFromCache();
      });
    });

    // initial
    updateGrainAvailability();
    renderOverrides();
    tryAutoRenderFromCache();
  }

  FC.rozrys = {
    render,
    aggregatePartsForProject,
  };
})();

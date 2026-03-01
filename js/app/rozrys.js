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

  function drawSheet(canvas, sheet){
    try{
      const ctx = canvas.getContext('2d');
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

      const placements = (sheet.placements||[]).filter(p=>!p.unplaced);
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      placements.forEach(p=>{
        const x = p.x * scale;
        const y = p.y * scale;
        const w = p.w * scale;
        const hh = p.h * scale;
        ctx.fillStyle = 'rgba(11, 141, 183, 0.10)';
        ctx.fillRect(x,y,w,hh);
        ctx.strokeStyle = 'rgba(11, 31, 51, 0.55)';
        ctx.strokeRect(x+0.5,y+0.5,Math.max(0,w-1),Math.max(0,hh-1));

        // Edge banding markers (optional): draw CORNER TICKS inside the part.
        // Why: full-length lines can cross dimension labels (especially on small parts).
        // Corner ticks remain readable and do not create "double-thick" borders.
        const hasEdges = !!(p.edgeW1 || p.edgeW2 || p.edgeH1 || p.edgeH2);
        if(hasEdges){
          ctx.save();
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(11, 31, 51, 0.85)';
          const inset = Math.max(2, Math.min(7, Math.floor(Math.min(w, hh) / 6))); // px inside
          const minSide = Math.max(0, Math.min(w, hh));
          const tickLen = Math.max(8, Math.min(18, Math.floor(minSide * 0.22)));

          function tick(x1,y1,x2,y2){
            ctx.beginPath();
            ctx.moveTo(x1,y1);
            ctx.lineTo(x2,y2);
            ctx.stroke();
          }

          // top edge ticks
          if(p.edgeW1){
            tick(x+inset, y+inset, x+inset+tickLen, y+inset);
            tick(x+w-inset-tickLen, y+inset, x+w-inset, y+inset);
          }
          // bottom edge ticks
          if(p.edgeW2){
            tick(x+inset, y+hh-inset, x+inset+tickLen, y+hh-inset);
            tick(x+w-inset-tickLen, y+hh-inset, x+w-inset, y+hh-inset);
          }
          // left edge ticks
          if(p.edgeH1){
            tick(x+inset, y+inset, x+inset, y+inset+tickLen);
            tick(x+inset, y+hh-inset-tickLen, x+inset, y+hh-inset);
          }
          // right edge ticks
          if(p.edgeH2){
            tick(x+w-inset, y+inset, x+w-inset, y+inset+tickLen);
            tick(x+w-inset, y+hh-inset-tickLen, x+w-inset, y+hh-inset);
          }

          ctx.restore();
        }
        // wymiary na właściwych bokach: szerokość na górze, wysokość po lewej
        ctx.fillStyle = '#0b1f33';
        const wLabel = `${mmToStr(p.w)}`;
        const hLabel = `${mmToStr(p.h)}`;

        // top label (width)
        if(w > 34){
          const tw = ctx.measureText(wLabel).width;
          ctx.fillText(wLabel, x + Math.max(4, (w - tw) / 2), y + 16);
        } else {
          ctx.fillText(wLabel, x + 4, y + 16);
        }

        // left label (height) rotated
        if(hh > 34){
          ctx.save();
          ctx.translate(x + 12, y + hh/2);
          ctx.rotate(-Math.PI/2);
          const th = ctx.measureText(hLabel).width;
          ctx.fillText(hLabel, -th/2, 0);
          ctx.restore();
        } else {
          ctx.fillText(hLabel, x + 4, y + 30);
        }
      });
    }catch(_){ }
  }

  function buildCsv(sheets, meta){
    const lines = [];
    lines.push(['material','sheet_no','board_w_mm','board_h_mm','item','w_mm','h_mm','x_mm','y_mm','rotated'].join(';'));
    sheets.forEach((s, i)=>{
      (s.placements||[]).filter(p=>!p.unplaced).forEach(p=>{
        lines.push([
          meta.material || '',
          String(i+1),
          String(s.boardW),
          String(s.boardH),
          (p.name||p.key||p.id||''),
          String(p.w),
          String(p.h),
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

    if(state.heur === 'gpro' || state.heur === 'gpro_ultra'){
      if(typeof opt.packGuillotineBeam !== 'function'){
        return { sheets: [], note: 'Brak modułu Gilotyna PRO (packGuillotineBeam).' };
      }
      const ultra = (state.heur === 'gpro_ultra');
      sheets = opt.packGuillotineBeam(items, W, H, K, {
        beamWidth: ultra ? 140 : 70,
        timeMs: ultra ? 1400 : 500,
      });
    } else {
      const dir = state.direction || 'auto';
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
        sheets = opt.packShelf(items, W, H, K, dir);
      }
    }
    // store meta for drawing offset
    return { sheets, meta: { trim, boardW: W0, boardH: H0, unit } };
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

    const controls = h('div', { class:'grid-3', style:'margin-top:12px' });
    // material select
    const matWrap = h('div');
    matWrap.appendChild(h('label', { text:'Materiał' }));
    const matSel = h('select', { id:'rozMat' });
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

    // board size
    const sizeWrap = h('div');
    sizeWrap.appendChild(h('label', { text:`Format płyty (${state.unit})` }));
    const sizeRow = h('div', { style:'display:flex;gap:8px' });
    const inW = h('input', { id:'rozW', type:'number', value:String(state.boardW) });
    const inH = h('input', { id:'rozH', type:'number', value:String(state.boardH) });
    sizeRow.appendChild(inW); sizeRow.appendChild(inH);
    sizeWrap.appendChild(sizeRow);
    controls.appendChild(sizeWrap);

    // kerf
    const kerfWrap = h('div');
    kerfWrap.appendChild(h('label', { text:`Kerf (${state.unit})` }));
    const inK = h('input', { id:'rozK', type:'number', value:String(state.kerf) });
    kerfWrap.appendChild(inK);
    controls.appendChild(kerfWrap);

    // edge trim
    const trimWrap = h('div');
    trimWrap.appendChild(h('label', { text:`Równanie płyty w koło (${state.unit})` }));
    const inTrim = h('input', { id:'rozTrim', type:'number', value:String(state.edgeTrim) });
    trimWrap.appendChild(inTrim);
    controls.appendChild(trimWrap);

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
      <option value="shelf">Szybka (pasy / półki)</option>
      <option value="gpro">Dokładna (Gilotyna PRO)</option>
      <option value="gpro_ultra">Ultra (Gilotyna PRO • dłużej liczy)</option>
    `;
    heurWrap.appendChild(heurSel);
    controls2.appendChild(heurWrap);

    const dirWrap = h('div');
    dirWrap.appendChild(h('label', { text:'Kierunek cięcia (dla "pasy")' }));
    const dirSel = h('select', { id:'rozDir' });
    dirSel.innerHTML = `
      <option value="auto">Auto</option>
      <option value="wzdłuż">Wzdłuż</option>
      <option value="wpoprz">W poprzek</option>
    `;
    dirWrap.appendChild(dirSel);
    controls2.appendChild(dirWrap);

    card.appendChild(controls);
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

    function renderOverrides(){
      const grainOn = !!grainChk.checked;
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
        });
        row.appendChild(cb);
        row.appendChild(h('div', { class:'muted xs', text:`${p.name} • ${p.w}×${p.h} mm • ilość ${p.qty}` }));
        list.appendChild(row);
      });
      overridesBox.appendChild(list);
    }

    function renderOutput(plan, meta){
      out.innerHTML = '';
      const opt = FC.cutOptimizer;
      const sheets = plan.sheets || [];
      if(!sheets.length){
        out.appendChild(h('div', { class:'muted', text:'Brak wyniku.' }));
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

      out.appendChild(h('div', { class:'card', style:'margin:0', html:`
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div><strong>Materiał:</strong> ${meta.material}</div>
          <div><strong>Płyty:</strong> ${sheets.length} szt.</div>
          <div><strong>Odpad:</strong> ${pct.toFixed(1)}%</div>
        </div>
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
        // proste HTML do wydruku
        let html = `<!doctype html><html><head><meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Rozrys</title>
          <style>
            body{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding:16px; }
            h1{ font-size:18px; margin:0 0 10px; }
            .meta{ font-size:12px; color:#333; margin-bottom:12px; }
            .sheet{ margin:14px 0; page-break-inside:avoid; }
            canvas{ width:100%; max-width:980px; border:1px solid #333; border-radius:10px; }
          </style>
        </head><body>`;
        html += `<h1>Rozrys — ${meta.material}</h1>`;
        html += `<div class="meta">Płyty: ${sheets.length} • Kerf: ${meta.kerf}mm • Heurystyka: ${meta.heur}</div>`;
        sheets.forEach((s,i)=>{
          html += `<div class="sheet"><div class="meta"><strong>Arkusz ${i+1}</strong> — ${s.boardW}×${s.boardH} mm</div>`;
          html += `<canvas id="c${i}" width="${s.boardW}" height="${s.boardH}"></canvas></div>`;
        });
        html += `<script>(function(){
          const sheets = ${JSON.stringify(sheets)};
          function draw(i){
            const s = sheets[i];
            const c = document.getElementById('c'+i);
            const ctx = c.getContext('2d');
            ctx.clearRect(0,0,c.width,c.height);
            ctx.strokeStyle='#000';
            ctx.strokeRect(0.5,0.5,c.width-1,c.height-1);
            ctx.font='36px sans-serif';
            ctx.fillStyle='rgba(0,0,0,0.06)';
            (s.placements||[]).filter(p=>!p.unplaced).forEach(p=>{
              ctx.fillRect(p.x,p.y,p.w,p.h);
              ctx.strokeStyle='rgba(0,0,0,0.55)';
              ctx.strokeRect(p.x+0.5,p.y+0.5,Math.max(0,p.w-1),Math.max(0,p.h-1));
              ctx.fillStyle='#000';
              ctx.fillText(p.w+'×'+p.h, p.x+20, p.y+60);
              ctx.fillStyle='rgba(0,0,0,0.06)';
            });
          }
          for(let i=0;i<sheets.length;i++) draw(i);
        })();<\/script>`;
        html += `</body></html>`;
        openPrintView(html);
      });
      expRow.appendChild(csvBtn);
      expRow.appendChild(pdfBtn);
      out.appendChild(expRow);

      sheets.forEach((s,i)=>{
        const box = h('div', { class:'card', style:'margin-top:12px' });
        box.appendChild(h('div', { style:'display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap' }, [
          h('div', { style:'font-weight:900', text:`Arkusz ${i+1}` }),
          h('div', { class:'muted xs', text:`${s.boardW}×${s.boardH} mm` })
        ]));
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.marginTop = '10px';
        box.appendChild(canvas);
        out.appendChild(box);
        drawSheet(canvas, s);
      });
    }

    function generate(){
      const material = matSel.value;
      const parts = agg.byMaterial[material] || [];
      const st = {
        material,
        unit: unitSel.value,
        boardW: Number(inW.value)|| (unitSel.value==='mm'?2800:280),
        boardH: Number(inH.value)|| (unitSel.value==='mm'?2070:207),
        kerf: Number(inK.value)|| (unitSel.value==='mm'?4:0.4),
        edgeTrim: Number(inTrim.value)|| (unitSel.value==='mm'?20:2),
        grain: !!grainChk.checked,
        heur: heurSel.value,
        direction: dirSel.value,
      };

      const plan = computePlan(st, parts);
      renderOutput(plan, { material, kerf: st.kerf, heur: st.heur, meta: plan.meta });
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
      out.innerHTML = '';
    });

    matSel.addEventListener('change', ()=>{
      applyHintFromMagazyn(matSel.value);
      renderOverrides();
      out.innerHTML = '';
    });
    grainChk.addEventListener('change', ()=>{
      renderOverrides();
      out.innerHTML = '';
    });
    heurSel.addEventListener('change', ()=>{
      const isShelf = (heurSel.value === 'shelf');
      dirSel.disabled = !isShelf;
      if(!isShelf) dirSel.value = 'auto';
      out.innerHTML = '';
    });
    dirSel.addEventListener('change', ()=>{
      out.innerHTML = '';
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
      generate();
    });

    // initial
    renderOverrides();
  }

  FC.rozrys = {
    render,
    aggregatePartsForProject,
  };
})();

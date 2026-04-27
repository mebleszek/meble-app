// js/tabs/rysunek.js
// Zakładka RYSUNEK — wydzielony renderer z app.js, rejestrowany w routerze zakładek.

(function(){
  'use strict';
  window.FC = window.FC || {};
  window.FC.tabsRysunek = window.FC.tabsRysunek || {};

  function renderDrawingTab(list, room){
  ensureLayout(room);
  const pd = projectData[room];
  const seg = getActiveSegment(room);

  // ephemeral UI state
  if(!uiState.drawing){
    uiState.drawing = {
      selected: null,        // {row, index}
      zoom: 6,            // px per cm (skalowanie rysunku)
      rangeStart: null,
      hRange: null,          // {row, x0cm, x1cm}
      vRange: null,          // {x0cm,x1cm, topRow, bottomRow, rows}
      drag: null             // internal
    };
  }
  const st = uiState.drawing;
  const rysunekDialogs = FC.rysunekDialogs || {};

  function showRysunekInfo(message, title){
    if(rysunekDialogs && typeof rysunekDialogs.info === 'function'){
      rysunekDialogs.info({ title: title || 'Rysunek', message:String(message || ''), okOnly:true });
    }
  }

  function askRysunekConfirm(methodName){
    if(rysunekDialogs && typeof rysunekDialogs[methodName] === 'function') return rysunekDialogs[methodName]();
    return Promise.resolve(false);
  }

  function askRysunekNumber(title, label, defaultValue){
    if(rysunekDialogs && typeof rysunekDialogs.askNumber === 'function') return rysunekDialogs.askNumber({ title, label, defaultValue });
    return Promise.resolve(null);
  }

  function saveRysunekProject(){
    if(FC.layoutState && typeof FC.layoutState.saveProject === 'function') return FC.layoutState.saveProject();
    return saveProject();
  }

  list.innerHTML = '';

  const outer = document.createElement('div');
  outer.className = 'drawing-wrap';

  // toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'drawing-toolbar';
  toolbar.innerHTML = `
    <div class="group">
      <span class="pill">Rysunek 2D (drag & drop)</span>
      <span class="muted xs">Przeciągnij kafelki aby zmienić kolejność. Kliknij, aby dodać panel/blendę/przerwę. Shift+klik zaznacza zakres (cokół / blenda górna).</span>
    </div>
    
    <div class="group" style="margin-left:auto">
      <span class="muted xs" style="margin-right:6px">Zoom:</span>
      <button id="zoomOut" class="btn" title="Pomniejsz">−</button>
      <input id="zoomSlider" type="range" min="1" max="16" step="1" style="width:140px" />
      <button id="zoomIn" class="btn" title="Powiększ">+</button>
      <span id="zoomVal" class="pill" style="min-width:64px;text-align:center">10px/cm</span>
      <button id="drawRebuild" class="btn">↻ Odbuduj z listy szafek</button>
          </div>

  `;
  outer.appendChild(toolbar);

  // layout: stage + inspector
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = '1fr';
  grid.style.gap = '12px';

  const stage = document.createElement('div');
  stage.className = 'drawing-stage';
  stage.style.position = 'relative';
  stage.style.overflowX = 'auto';
  stage.style.overflowY = 'hidden';
  stage.style.webkitOverflowScrolling = 'touch';

  const svgHost = document.createElement('div');
  svgHost.id = 'svgHost';
  stage.appendChild(svgHost);

  const inspector = document.createElement('div');
  inspector.className = 'card';
  inspector.style.margin = '0';
  inspector.style.maxWidth = '520px';
  inspector.style.justifySelf='center';
  inspector.innerHTML = `
    <h3 class="section-title" style="margin:0 0 10px 0">Inspektor</h3>
    <div id="insBody" class="muted xs">Kliknij kafelek (szafkę lub przerwę).</div>
    <div class="hr"></div>
    <h3 class="section-title" style="margin:0 0 10px 0">Wykończenia (segment)</h3>
    <div id="finList"></div>
  `;

  grid.appendChild(stage);
  grid.appendChild(inspector);
  outer.appendChild(grid);
  list.appendChild(outer);

  // toolbar actions
  toolbar.querySelector('#drawRebuild').onclick = async ()=>{
    if(!(await askRysunekConfirm('confirmRebuildLayout'))) return;
    seg.rows.base = [];
    seg.rows.module = [];
    seg.rows.wall = [];
    (pd.cabinets||[]).forEach(c=>{
      const row = (c.type === 'wisząca') ? 'wall' : (c.type === 'moduł' ? 'module' : 'base');
      seg.rows[row].push({ kind:'cabinet', id:c.id });
    });
    st.selected = null;
    st.rangeStart = null;
    st.hRange = null;
    st.vRange = null;
    saveRysunekProject();
    renderCabinets();
  };
  // zoom controls
  const zoomSlider = toolbar.querySelector('#zoomSlider');
  const zoomVal = toolbar.querySelector('#zoomVal');
  const zoomOut = toolbar.querySelector('#zoomOut');
  const zoomIn = toolbar.querySelector('#zoomIn');
  zoomSlider.value = String(Math.max(1, Math.min(16, Number(st.zoom)||10)));
  zoomVal.textContent = `${zoomSlider.value}px/cm`;

  function setZoom(val){
    st.zoom = Math.max(1, Math.min(16, Number(val)||10));
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    renderCabinets(); // prze-renderuje rysunek z nową skalą
  }
  zoomSlider.addEventListener('input', ()=>{ zoomVal.textContent = `${zoomSlider.value}px/cm`; });
  zoomSlider.addEventListener('change', ()=> setZoom(zoomSlider.value));
  zoomOut.addEventListener('click', ()=> setZoom((Number(st.zoom)||10) - 1));
  zoomIn.addEventListener('click', ()=> setZoom((Number(st.zoom)||10) + 1));


  // helpers
  const s = pd.settings || {};
  const autoTopHeight = Math.max(0,
    (Number(s.roomHeight)||0)
    - (Number(s.bottomHeight)||0)
    - (Number(s.legHeight)||0) // w Twoim UI bottomHeight jest "z nogami", ale zostawiamy to symbolicznie
    - (Number(s.counterThickness)||0)
    - (Number(s.gapHeight)||0)
    - (Number(s.ceilingBlende)||0)
  );
  const defaultBaseH = Math.max(40, Number(s.bottomHeight)||90);
const defaultWallH = Math.max(40, autoTopHeight || 70);
const defaultModuleH = 60;

function cabHeightCm(el, fallback){
  if(!el || el.kind!=='cabinet') return fallback;
  const c = getCabById(room, el.id);
  const h = c ? Number(c.height)||0 : 0;
  return (h>0) ? h : fallback;
}
function maxRowHeightCm(rowKey, fallback){
  const arr = seg.rows[rowKey] || [];
  let mx = fallback;
  arr.forEach(el=>{
    if(el.kind==='cabinet'){
      const h = cabHeightCm(el, fallback);
      if(h>mx) mx=h;
    }
  });
  return Math.max(40, mx);
}
function elHeightCm(rowKey, el){
  const fb = (rowKey==='base') ? defaultBaseH : (rowKey==='wall') ? defaultWallH : defaultModuleH;
  if(!el) return fb;
  if(el.kind==='gap') return fb;
  return cabHeightCm(el, fb);
}

const baseH = maxRowHeightCm('base', defaultBaseH);
const wallH = maxRowHeightCm('wall', defaultWallH);
const moduleH = maxRowHeightCm('module', defaultModuleH);

// rysunek w proporcji: 1cm = SCALE px (w pionie i poziomie)
  const SCALE = Math.max(1, Math.min(16, Number(st.zoom)||10)); // px/cm (skalowanie rysunku)
  const PAD_L = 20, PAD_T = 18, PAD_R = 20, PAD_B = 18;
  const ROW_GAP = 0;
  const LABEL_H = 0; 

  const rows = [
    { key:'wall', label:'GÓRNE', hCm: wallH },
    { key:'module', label:'MODUŁY', hCm: moduleH },
    { key:'base', label:'DOLNE', hCm: baseH }
  ];

  function elWidthCm(rowKey, el){
    if(el.kind==='gap') return Number(el.width)||0;
    const c = getCabById(room, el.id);
    return c ? Number(c.width)||0 : 0;
  }
  function elLabel(rowKey, el){
    if(el.kind==='gap') return `PRZERWA ${Number(el.width)||0}cm`;
    const c = getCabById(room, el.id);
    if(!c) return `SZAFKA`;
    const t = (c.subType || c.type || 'szafka');
    return `${t} ${Number(c.width)||0}cm`;
  }

  function computePositions(rowKey){
    const arr = seg.rows[rowKey] || [];
    let x = Number(seg.offsets?.[rowKey]||0);
    const pos = [];
    for(let i=0;i<arr.length;i++){
      const w = elWidthCm(rowKey, arr[i]);
      pos.push({ index:i, el:arr[i], x0:x, x1:x+w, w });
      x += w;
    }
    return pos;
  }

  const totals = rows.map(r=>{
    const pos = computePositions(r.key);
    const last = pos[pos.length-1];
    return (last ? last.x1 : 0) + Number(seg.offsets?.[r.key]||0);
  });
  const totalCm = Math.max(60, ...totals);

  // SVG sizing
  const contentW = totalCm*SCALE;
  const contentH = rows.reduce((acc,r)=>acc + (r.hCm*SCALE) + LABEL_H, 0) + ROW_GAP*(rows.length-1);
  const vbW = PAD_L + contentW + PAD_R;
  const vbH = PAD_T + contentH + PAD_B;

  // extra left space so left-side finishes (e.g., left blend/panel) are visible
  const finishesAll = (projectData[room].finishes||[]).filter(f=>f.segmentId===seg.id);
  const maxLeftCm = finishesAll.reduce((m,f)=>{
    if((f.side==='L') && (f.type==='panel' || f.type==='blenda_pion' || f.type==='blenda_pion_full')){
      return Math.max(m, Number(f.width)||0);
    }
    return m;
  }, 0);
  const EXTRA_L = Math.max(0, Math.round(maxLeftCm*SCALE + 40));

  // widen viewport to include left overhang
  const vbW2 = vbW + EXTRA_L;


  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox', `${-EXTRA_L} 0 ${vbW2} ${vbH}`);
  svg.setAttribute('preserveAspectRatio','xMinYMin meet');
  svg.style.width = `${vbW2}px`;
  svg.style.height = `${vbH}px`;
  svg.style.display = 'block';

  // defs (subtle grid)
  const defs = document.createElementNS(svgNS,'defs');
  defs.innerHTML = `
    <pattern id="gridSmall" width="${SCALE*10}" height="${SCALE*10}" patternUnits="userSpaceOnUse">
      <path d="M ${SCALE*10} 0 L 0 0 0 ${SCALE*10}" fill="none" stroke="#eef2f7" stroke-width="1"/>
    </pattern>
  `;
  svg.appendChild(defs);
  const bg = document.createElementNS(svgNS,'rect');
  bg.setAttribute('x', -EXTRA_L); bg.setAttribute('y', 0);
  bg.setAttribute('width', vbW2); bg.setAttribute('height', vbH);
  bg.setAttribute('fill', 'url(#gridSmall)');
  bg.setAttribute('rx', 12); bg.setAttribute('ry', 12);
  bg.style.opacity = '0.7';
  svg.appendChild(bg);

  function mkText(x,y,txt,cls){
    const t = document.createElementNS(svgNS,'text');
    t.setAttribute('x',x); t.setAttribute('y',y);
    t.setAttribute('class', cls||'svg-label');
    t.textContent = txt;
    svg.appendChild(t);
    return t;
  }
  function mkRect(x,y,w,h,cls,attrs){
    const r = document.createElementNS(svgNS,'rect');
    r.setAttribute('x',x); r.setAttribute('y',y);
    r.setAttribute('width',w); r.setAttribute('height',h);
    r.setAttribute('rx',10); r.setAttribute('ry',10);
    r.setAttribute('class', cls);
    if(attrs){ Object.keys(attrs).forEach(k=>r.setAttribute(k, attrs[k])); }
    svg.appendChild(r);
    return r;
  }
  function mkGroup(attrs){
    const g = document.createElementNS(svgNS,'g');
    if(attrs){ Object.keys(attrs).forEach(k=>g.setAttribute(k, attrs[k])); }
    svg.appendChild(g);
    return g;
  }

  // range highlight (non-interactive)
  const rangeG = document.createElementNS(svgNS,'g');
  rangeG.style.pointerEvents = 'none';

  // finishes overlay (non-interactive)
  const finG = document.createElementNS(svgNS,'g');
  finG.style.pointerEvents = 'none';

  // interactive elements group
  const elG = document.createElementNS(svgNS,'g');
  svg.appendChild(elG);
  svg.appendChild(finG);
  svg.appendChild(rangeG);

  

  // Ensure overlays (range highlight + finishes) render ABOVE cabinets.
  // (Appending moves existing nodes to the end of SVG children list.)
  svg.appendChild(rangeG);
  svg.appendChild(finG);
// row y mapping (anchor countertop/reference line at default base height; taller base can extend upward)
  const rowY = {};
  // floorY = bottom of BASE row when base height == defaultBaseH
  // NOTE: keep module zone anchored; do NOT shift floorY based on tallest wall cabinet.
  const wallRefH = Number((pd.settings||{}).wallRefH)||60;
  let floorY = PAD_T
    + (LABEL_H + wallRefH*SCALE + ROW_GAP)
    + (LABEL_H + moduleH*SCALE + ROW_GAP)
    + (LABEL_H + defaultBaseH*SCALE);

  // Place BASE so its bottom stays at floorY
  rowY['base'] = floorY - (LABEL_H + baseH*SCALE);
  // Countertop/reference line is based on the ROOM default base height (not the tallest base cabinet)
  const counterY = floorY - (LABEL_H + defaultBaseH*SCALE);
  // Place MODULE so its bottom sits on the countertop/reference line
  rowY['module'] = counterY - (ROW_GAP + LABEL_H + moduleH*SCALE);
// Stack WALL above MODULE
  rowY['wall'] = rowY['module'] - (ROW_GAP + LABEL_H + wallH*SCALE);

  // If anything would go above the top padding, shift everything down
  const minY = Math.min(rowY['wall'], rowY['module'], rowY['base']);
  if(minY < PAD_T){
    const shift = PAD_T - minY;
    rowY['base'] += shift;
    rowY['module'] += shift;
    rowY['wall'] += shift;
    floorY += shift;
  }

  // Render rows
  function renderAll(){
    // clear groups
    while(elG.firstChild) elG.removeChild(elG.firstChild);
    while(rangeG.firstChild) rangeG.removeChild(rangeG.firstChild);
    while(finG.firstChild) finG.removeChild(finG.firstChild);
    // (row labels hidden)
    // range highlight
    if(st.hRange && st.hRange.row){
      const row = st.hRange.row;
      const x0cm = Number(st.hRange.x0cm)||0;
      const x1cm = Number(st.hRange.x1cm)||0;
      const x0 = PAD_L + Math.min(x0cm,x1cm)*SCALE;
      const x1 = PAD_L + Math.max(x0cm,x1cm)*SCALE;
      const hcm = (row==='wall'?wallH:(row==='module'?moduleH:baseH));
      const y = rowY[row] + LABEL_H - 6;
      const h = hcm*SCALE + 12;
      const rr = document.createElementNS(svgNS,'rect');
      rr.setAttribute('x', x0);
      rr.setAttribute('y', y);
      rr.setAttribute('width', Math.max(8, x1-x0));
      rr.setAttribute('height', h);
      rr.setAttribute('rx', 14); rr.setAttribute('ry', 14);
      rr.setAttribute('class','svg-range');
      rangeG.appendChild(rr);
    }
// vertical range highlight (od dołu do góry)
if(st.vRange && st.vRange.x1cm > st.vRange.x0cm){
  const x0 = PAD_L + st.vRange.x0cm*SCALE;
  const x1 = PAD_L + st.vRange.x1cm*SCALE;
  const topRow = st.vRange.topRow || 'wall';
  const bottomRow = st.vRange.bottomRow || 'base';
  const y0 = rowY[topRow] + LABEL_H - 6;
  const y1 = rowY[bottomRow] + LABEL_H + ((rows.find(rr=>rr.key===bottomRow)?.hCm)||60)*SCALE + 6;
  const rr = document.createElementNS(svgNS,'rect');
  rr.setAttribute('x', x0);
  rr.setAttribute('y', Math.min(y0,y1));
  rr.setAttribute('width', Math.max(8, x1-x0));
  rr.setAttribute('height', Math.max(10, Math.abs(y1-y0)));
  rr.setAttribute('rx', 14); rr.setAttribute('ry', 14);
  rr.setAttribute('fill', 'rgba(14,165,233,0.08)');
  rr.setAttribute('stroke', 'rgba(14,165,233,0.65)');
  rr.setAttribute('stroke-width', '2');
  rangeG.appendChild(rr);
}
    // elements
    const drawOrder = (projectData[room].layout && Array.isArray(projectData[room].layout.zOrderRows)) ? projectData[room].layout.zOrderRows : ['base','module','wall'];
    drawOrder.forEach(rowKey=>{
      const r = rows.find(rr=>rr.key===rowKey);
      if(!r) return;
      const row = r.key;
      const pos = computePositions(row);
      pos.forEach(p=>{
        const x = PAD_L + p.x0*SCALE;
        const elHcm = elHeightCm(row, p.el);
        let y = rowY[row] + LABEL_H;
        if(row!=='wall') y += Math.max(0, (r.hCm - elHcm))*SCALE;
        const w = Math.max(24, p.w*SCALE);
        const h = Math.max(10, elHcm*SCALE);
        const g = document.createElementNS(svgNS,'g');
        g.setAttribute('data-row', row);
        g.setAttribute('data-index', String(p.index));
        g.setAttribute('data-kind', p.el.kind);
        g.setAttribute('data-id', p.el.id || '');
        g.style.cursor = 'grab';

        const isSel = st.selected && st.selected.row===row && st.selected.index===p.index;
        const rect = document.createElementNS(svgNS,'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('rx', 12); rect.setAttribute('ry', 12);
        rect.setAttribute('fill', p.el.kind==='gap' ? '#fff' : '#eaf6ff');
        rect.setAttribute('stroke', isSel ? '#0ea5e9' : (p.el.kind==='gap' ? '#94a3b8' : '#8fd3ff'));
        rect.setAttribute('stroke-width', isSel ? '3' : '2');
        if(p.el.kind==='gap'){
          rect.setAttribute('stroke-dasharray', '6 4');
        }

        g.appendChild(rect);

        // drag handle (mobile)
        if(p.el.kind!=='gap'){
          const grip = document.createElementNS(svgNS,'rect');
          grip.setAttribute('x', x + w - 20);
          grip.setAttribute('y', y + 6);
          grip.setAttribute('width', 14);
          grip.setAttribute('height', 14);
          grip.setAttribute('rx', 3); grip.setAttribute('ry', 3);
          grip.setAttribute('fill', '#0ea5e9');
          grip.setAttribute('data-grip','1');
          grip.style.cursor = 'grab';
          grip.style.touchAction = 'none';
          g.appendChild(grip);

          const gripTxt = document.createElementNS(svgNS,'text');
          gripTxt.setAttribute('x', x + w - 17);
          gripTxt.setAttribute('y', y + 17);
          gripTxt.setAttribute('fill', '#fff');
          gripTxt.setAttribute('font-size','12');
          gripTxt.setAttribute('font-weight','900');
          gripTxt.setAttribute('pointer-events','none');
          gripTxt.textContent = '≡';
          g.appendChild(gripTxt);
        }

        const text = document.createElementNS(svgNS,'text');
        text.setAttribute('x', x + 8);
        text.setAttribute('y', y + 18);
        text.setAttribute('class', 'svg-label');
        text.textContent = elLabel(row, p.el);

        g.appendChild(text);
        elG.appendChild(g);

        // pointer handlers for drag & click
        g.addEventListener('pointerdown', (ev)=>{
          const isGrip = (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-grip')==='1');
          const isMouse = (ev.pointerType === 'mouse');
          const isTouch = !isMouse;
          // Drag only from grip on touch; mouse can drag from anywhere
          if(!isGrip && !isMouse){
            return;
          }

          try{ ev.preventDefault(); }catch(_){}
          g.setPointerCapture(ev.pointerId);
          st.drag = {
            pointerId: ev.pointerId,
            row,
            startIndex: p.index,
            startClientX: ev.clientX,
            moved: false,
            startPxX: x,
            gEl: g
          };
          g.style.cursor = 'grabbing';
        });

        g.addEventListener('pointermove', (ev)=>{
          // cancel long-press if user moves finger
          if(st._lp && st._lp.pointerId === ev.pointerId && !st._lp.fired){
            const dx0 = ev.clientX - st._lp.startX;
            const dy0 = ev.clientY - st._lp.startY;
            if(Math.abs(dx0) > 6 || Math.abs(dy0) > 6){
              clearTimeout(st._lp.timer);
              st._lp = null;
            }
          }

          if(!st.drag || st.drag.pointerId !== ev.pointerId) return;
          const dx = ev.clientX - st.drag.startClientX;
          if(Math.abs(dx) > 4) st.drag.moved = true;
          // translate group visually
          g.setAttribute('transform', `translate(${dx},0)`);
        });

        g.addEventListener('pointerup', (ev)=>{
          // clear long-press timer (if any)
          if(st._lp && st._lp.pointerId === ev.pointerId){
            const fired = st._lp.fired;
            clearTimeout(st._lp.timer);
            st._lp = null;
            // if long-press fired, do not also treat this as a click
            if(fired) return;
          }

          // TAP without drag context (common on mobile because we only start drag from the grip)
          if(!st.drag || st.drag.pointerId !== ev.pointerId){
            // prevent accidental "tap after drag" triggering click
            if(st._justDragged && (Date.now() - st._justDragged) < 220) return;
            handleClick(row, p.index, ev.shiftKey);
            return;
          }

          const drag = st.drag;
          g.releasePointerCapture(ev.pointerId);
          g.style.cursor = 'grab';
          const dx = ev.clientX - drag.startClientX;
          g.removeAttribute('transform');
          st.drag = null;
          st._justDragged = drag.moved ? Date.now() : 0;

          if(!drag.moved){
            handleClick(row, p.index, ev.shiftKey);
            return;
          }

          // commit reorder
          commitReorder(row, drag.startIndex, dx);
        });

        g.addEventListener('pointercancel', ()=>{
          if(st._lp){
            try{ clearTimeout(st._lp.timer); }catch(_){}
            st._lp = null;
          }
          if(st.drag && st.drag.gEl === g){
            g.removeAttribute('transform');
            g.style.cursor='grab';
            st.drag = null;
          }
        });

        // Fallback click handler (some Android viewers are flaky with pointerup on SVG)
        g.addEventListener('click', (ev)=>{
          if(st._justDragged && (Date.now() - st._justDragged) < 250) return;
          handleClick(row, p.index, !!ev.shiftKey);
        });

        // Touch fallback for drag & drop on mobile (when PointerEvents are not delivered properly)
        let _touchActive = false;
        g.addEventListener('touchstart', (ev)=>{
          const t = ev.touches && ev.touches[0];
          if(!t) return;
          const isGrip = (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-grip')==='1');
          if(!isGrip) return; // drag only from grip to keep horizontal scroll usable
          _touchActive = true;
          try{ ev.preventDefault(); }catch(_){}
          st.drag = {
            pointerId: 'touch',
            row,
            startIndex: p.index,
            startClientX: t.clientX,
            moved: false,
            startPxX: x,
            gEl: g
          };
          g.style.cursor = 'grabbing';
        }, {passive:false});

        g.addEventListener('touchmove', (ev)=>{
          if(!_touchActive || !st.drag || st.drag.pointerId !== 'touch' || st.drag.gEl !== g) return;
          const t = ev.touches && ev.touches[0];
          if(!t) return;
          try{ ev.preventDefault(); }catch(_){}
          const dx = t.clientX - st.drag.startClientX;
          if(Math.abs(dx) > 4) st.drag.moved = true;
          g.setAttribute('transform', `translate(${dx},0)`);
        }, {passive:false});

        function _touchEnd(ev){
          if(!_touchActive) return;
          _touchActive = false;
          if(!st.drag || st.drag.pointerId !== 'touch' || st.drag.gEl !== g) return;
          try{ ev.preventDefault(); }catch(_){}
          const drag = st.drag;
          const t = (ev.changedTouches && ev.changedTouches[0]) || null;
          const clientX = t ? t.clientX : drag.startClientX;
          const dx = clientX - drag.startClientX;
          g.removeAttribute('transform');
          g.style.cursor = 'grab';
          st.drag = null;
          st._justDragged = drag.moved ? Date.now() : 0;

          if(!drag.moved){
            handleClick(row, p.index, false);
            return;
          }
          commitReorder(row, drag.startIndex, dx);
        }
        g.addEventListener('touchend', _touchEnd, {passive:false});
        g.addEventListener('touchcancel', _touchEnd, {passive:false});
      });
    });


    // gap marks overlay (X) — keep gaps visible even if covered by another row
    rows.forEach(rr=>{
      const row = rr.key;
      const pos = computePositions(row);
      pos.forEach(p=>{
        if(p.el.kind!=='gap') return;
        const x = PAD_L + p.x0*SCALE;
        const elHcm = elHeightCm(row, p.el);
        let y = rowY[row] + LABEL_H;
        if(row!=='wall') y += Math.max(0, (rr.hCm - elHcm))*SCALE;
        const w = Math.max(24, p.w*SCALE);
        const h = Math.max(10, elHcm*SCALE);
        const inset = 8;
        const x0 = x + inset, x1 = x + w - inset;
        const y0 = y + inset, y1 = y + h - inset;

        const l1 = document.createElementNS(svgNS,'line');
        l1.setAttribute('x1', x0); l1.setAttribute('y1', y0);
        l1.setAttribute('x2', x1); l1.setAttribute('y2', y1);
        l1.setAttribute('stroke', '#94a3b8');
        l1.setAttribute('stroke-width', '2');
        finG.appendChild(l1);

        const l2 = document.createElementNS(svgNS,'line');
        l2.setAttribute('x1', x0); l2.setAttribute('y1', y1);
        l2.setAttribute('x2', x1); l2.setAttribute('y2', y0);
        l2.setAttribute('stroke', '#94a3b8');
        l2.setAttribute('stroke-width', '2');
        finG.appendChild(l2);
      });
    });

    // finishes overlays (after elements so they appear on top, but non-interactive)
    const finishes = (pd.finishes||[]).filter(f=>f.segmentId===seg.id);
    finishes.forEach(f=>{
      if(f.type==='panel' || f.type==='blenda_pion'){
        const row = f.row;
        const idx = f.index;
        const pos = computePositions(row);
        const p = pos[idx];
        if(!p) return;
        const baseX0 = PAD_L + p.x0*SCALE;
        const baseX1 = PAD_L + p.x1*SCALE;
        const rowCfg = rows.find(rr=>rr.key===row);
        const elHcm = elHeightCm(row, p.el);
        let y = rowY[row] + LABEL_H;
        if(row!=='wall') y += Math.max(0, (((rowCfg?.hCm||elHcm) - elHcm)))*SCALE;

        // Panele boczne: wydłuż o cokół (dolne) lub blendę górną (górne)
        const s = (pd.settings || {});
        let addHcm = 0;
        if(f.type==='panel'){
          if(row==='base') addHcm = Number(s.legHeight)||0;
          if(row==='wall') addHcm = Number(s.ceilingBlende)||0;
        }

        // dla górnych panel wydłużamy do góry (odejmujemy od y)
        if(f.type==='panel' && row==='wall' && addHcm>0){
          y = Math.max(0, y - addHcm*SCALE);
        }

        const h = Math.max(10, (elHcm + (addHcm||0))*SCALE);
        const w = Math.max(8, (Number(f.width)||2)*SCALE);
        const x = (f.side==='L') ? (baseX0 - w) : baseX1;
        const rr = document.createElementNS(svgNS,'rect');
        rr.setAttribute('x', x);
        rr.setAttribute('y', y);
        rr.setAttribute('width', w);
        rr.setAttribute('height', h);
        rr.setAttribute('rx', 10); rr.setAttribute('ry', 10);
        rr.setAttribute('fill', f.type==='panel' ? 'rgba(2,132,199,0.35)' : 'rgba(14,165,233,0.18)');
        rr.setAttribute('stroke', f.type==='panel' ? 'rgba(2,132,199,0.85)' : 'rgba(14,165,233,0.55)');
        rr.setAttribute('stroke-width', '2');
        finG.appendChild(rr);
      }

      if(f.type==='blenda_pion_full'){
        const x0cm = Number(f.x0cm)||0;
        const x1cm = Number(f.x1cm)||0;
        const wcm = Number(f.width)||2;
        const side = f.side || 'R';
        const x0 = PAD_L + x0cm*SCALE;
        const x1 = PAD_L + x1cm*SCALE;
        const w = Math.max(8, wcm*SCALE);
        const x = (side==='L') ? (x0 - w) : x1;

        const topRow = f.topRow || 'wall';
        const bottomRow = f.bottomRow || 'base';
        if(rowY[topRow]==null || rowY[bottomRow]==null) return;

        const topY = rowY[topRow] + LABEL_H;
        const botHcm = (bottomRow==='wall'?wallH:(bottomRow==='module'?moduleH:baseH));
        const bottomY = rowY[bottomRow] + LABEL_H + botHcm*SCALE;

        const y = Math.min(topY, bottomY);
        const h = Math.max(10, Math.abs(bottomY - topY));

        const rr = document.createElementNS(svgNS,'rect');
        rr.setAttribute('x', x);
        rr.setAttribute('y', y);
        rr.setAttribute('width', w);
        rr.setAttribute('height', h);
        rr.setAttribute('rx', 10); rr.setAttribute('ry', 10);
        rr.setAttribute('fill', 'rgba(14,165,233,0.18)');
        rr.setAttribute('stroke', 'rgba(14,165,233,0.85)');
        rr.setAttribute('stroke-width', '3');
        finG.appendChild(rr);
      }

      if(f.type==='cokol' || f.type==='blenda_gorna'){
        const row = f.row;
        const pos = computePositions(row);

        let x0cm = (f.x0cm!=null) ? Number(f.x0cm) : null;
        let x1cm = (f.x1cm!=null) ? Number(f.x1cm) : null;

        // fallback: legacy indices
        if(x0cm==null || x1cm==null){
          const a = Math.max(0, Math.min(f.startIndex, f.endIndex));
          const b = Math.min(pos.length-1, Math.max(f.startIndex, f.endIndex));
          if(!pos[a] || !pos[b]) return;
          x0cm = pos[a].x0;
          x1cm = pos[b].x1;
        }

        const span0 = Math.min(x0cm,x1cm);
        const span1 = Math.max(x0cm,x1cm);

        let lenCm = (f.lengthCm!=null) ? Number(f.lengthCm)||0 : (span1 - span0);
        if(f.lengthCm==null && f.includeGaps === false){
          lenCm = 0;
          pos.forEach(pp=>{
            if(pp.el.kind!=='cabinet') return;
            const ov = Math.min(pp.x1, span1) - Math.max(pp.x0, span0);
            if(ov>0) lenCm += ov;
          });
        }

        const px0 = PAD_L + span0*SCALE;
        const pxW = Math.max(10, lenCm*SCALE);
        const isCokol = (f.type==='cokol');
        const yBase = rowY[row] + LABEL_H + (row==='wall' ? wallH : baseH)*SCALE;
        const y = isCokol ? (yBase + 8) : Math.max(2, (rowY[row] + LABEL_H - 14));
        const rr = document.createElementNS(svgNS,'rect');
        rr.setAttribute('x', px0);
        rr.setAttribute('y', y);
        rr.setAttribute('width', pxW);
        rr.setAttribute('height', 10);
        rr.setAttribute('rx', 8); rr.setAttribute('ry', 8);
        rr.setAttribute('fill', isCokol ? 'rgba(2,132,199,0.35)' : 'rgba(14,165,233,0.18)');
        rr.setAttribute('stroke', isCokol ? 'rgba(2,132,199,0.85)' : 'rgba(14,165,233,0.55)');
        rr.setAttribute('stroke-width', '2');
        finG.appendChild(rr);
      }
    });
  }

  function handleClick(row, index, isShift){
    const arr = seg.rows[row] || [];
    if(!arr[index]) return;
    st.selected = { row, index };
    // Zakresy są sterowane przyciskami START/KONIEC + "Wyczyść zakres"
    // Nie kasujemy ich automatycznie przy zwykłym kliknięciu (mobile UX).
    saveProject();
    renderCabinets();
  }


function commitReorder(row, fromIndex, dxPx){
    const arr = seg.rows[row] || [];
    if(fromIndex < 0 || fromIndex >= arr.length) return;
    const pos = computePositions(row);
    const item = arr[fromIndex];
    const w = (pos[fromIndex] ? pos[fromIndex].w : elWidthCm(row, item));
    const startX0 = pos[fromIndex] ? pos[fromIndex].x0 : 0;
    const newCenterCm = (startX0 + w/2) + (dxPx / SCALE);

    // remove item
    arr.splice(fromIndex, 1);

    // compute insertion index by scanning midpoints
    let insertAt = arr.length;
    let x = Number(seg.offsets?.[row]||0);
    for(let i=0;i<arr.length;i++){
      const wi = elWidthCm(row, arr[i]);
      const mid = x + wi/2;
      if(newCenterCm < mid){
        insertAt = i;
        break;
      }
      x += wi;
    }
    arr.splice(insertAt, 0, item);

    // after reorder, keep selection on the moved item
    st.selected = { row, index: insertAt };
    st.hRange = null;

    saveProject();
    renderCabinets();
  }

  // Inspector rendering
  const insBody = inspector.querySelector('#insBody');
  const finList = inspector.querySelector('#finList');

  function renderInspector(){
    const sel = st.selected;
    if(!sel){
      insBody.innerHTML = `<div class="muted xs">Kliknij kafelek (szafkę lub przerwę).<br/>Zaznacz zakres: Ustaw START i KONIEC.</div>`;
      return;
    }
    const row = sel.row;
    const el = (seg.rows[row]||[])[sel.index];
    if(!el){
      insBody.innerHTML = `<div class="muted xs">Brak elementu.</div>`;
      return;
    }

    const title = document.createElement('div');
    title.style.fontWeight = '900';
    title.style.marginBottom = '8px';
    title.textContent = (el.kind==='gap')
      ? `PRZERWA • ${Number(el.width)||0}cm • ${humanRow(row)}`
      : `${(getCabById(room, el.id)?.subType || getCabById(room, el.id)?.type || 'Szafka')} • ${Number(getCabById(room, el.id)?.width)||0}cm • ${humanRow(row)}`;

    const box = document.createElement('div');
    box.innerHTML = '';
    box.appendChild(title);

    // Layer order controls (row z-order)
    const zWrap = document.createElement('div');
    zWrap.style.display='flex';
    zWrap.style.gap='8px';
    zWrap.style.alignItems='center';
    zWrap.style.margin='0 0 10px 0';
    const zLbl = document.createElement('div');
    zLbl.className='muted xs';
    zLbl.textContent = 'Warstwa: ' + humanRow(row);
    const btnUp = document.createElement('button');
    btnUp.className='btn';
    btnUp.textContent='▲ wyżej';
    const btnDn = document.createElement('button');
    btnDn.className='btn';
    btnDn.textContent='▼ niżej';
    btnUp.onclick = ()=>{
      const lo = projectData[room].layout;
      const arr = (lo && Array.isArray(lo.zOrderRows)) ? lo.zOrderRows.slice() : ['base','module','wall'];
      const i = arr.indexOf(row);
      // wyżej = bardziej na wierzch (rysowane później)
      if(i>=0 && i < arr.length-1){ const t=arr[i+1]; arr[i+1]=arr[i]; arr[i]=t; }
      if(lo) lo.zOrderRows = arr;
      saveProject();
      renderCabinets();
    };
    btnDn.onclick = ()=>{
      const lo = projectData[room].layout;
      const arr = (lo && Array.isArray(lo.zOrderRows)) ? lo.zOrderRows.slice() : ['base','module','wall'];
      const i = arr.indexOf(row);
      // niżej = bardziej pod spodem (rysowane wcześniej)
      if(i>0){ const t=arr[i-1]; arr[i-1]=arr[i]; arr[i]=t; }
      if(lo) lo.zOrderRows = arr;
      saveProject();
      renderCabinets();
    };
    zWrap.appendChild(zLbl);
    zWrap.appendChild(btnUp);
    zWrap.appendChild(btnDn);
    box.appendChild(zWrap);

    // Zakres (START/END) — mobile-friendly
    const rSel = document.createElement('div');
    rSel.style.display='flex';
    rSel.style.flexDirection='column';
    rSel.style.gap='8px';
    rSel.style.margin='0 0 12px 0';

    const rInfo = document.createElement('div');
    rInfo.className='muted xs';
    const rs = st.rangeStart;
    const rTxt = [];
    if(rs){
      const aEl = (seg.rows[rs.row]||[])[rs.index];
      const aLbl = aEl ? (aEl.kind==='gap' ? 'PRZERWA' : (getCabById(room, aEl.id)?.subType || getCabById(room, aEl.id)?.type || 'Szafka')) : '—';
      rTxt.push('START: ' + aLbl + ' (' + humanRow(rs.row) + ')');
    }
    if(st.hRange){
      const len = Math.abs((Number(st.hRange.x1cm)||0) - (Number(st.hRange.x0cm)||0));
      rTxt.push('ZAKRES: ' + humanRow(st.hRange.row) + ' • dł.: ' + len.toFixed(1) + 'cm');
    }
    if(st.vRange){
      rTxt.push('ZAKRES PION: ' + humanRow(st.vRange.topRow) + '→' + humanRow(st.vRange.bottomRow));
    }
    rInfo.textContent = rTxt.length ? rTxt.join(' • ') : 'Zakres: ustaw START i KONIEC.';

    const rBtns = document.createElement('div');
    rBtns.style.display='flex';
    rBtns.style.gap='8px';
    rBtns.style.flexWrap='wrap';

    const bStart = document.createElement('button');
    bStart.className='btn';
    bStart.textContent='Ustaw START';
    bStart.onclick = ()=>{
      if(el.kind==='gap'){ showRysunekInfo('START nie może być przerwą. Wybierz szafkę.'); return; }
      st.rangeStart = { row, index: sel.index };
      st.hRange = null;
      st.vRange = null;
      saveProject();
      renderCabinets();
    };

    const bEnd = document.createElement('button');
    bEnd.className='btn-primary';
    bEnd.textContent='Ustaw KONIEC';
    bEnd.onclick = ()=>{
      if(el.kind==='gap'){ showRysunekInfo('KONIEC nie może być przerwą. Wybierz szafkę.'); return; }
      if(!st.rangeStart){
        st.rangeStart = { row, index: sel.index };
        st.hRange = null;
        st.vRange = null;
        saveProject();
        renderCabinets();
        return;
      }
      const a = st.rangeStart;
      // same row => horizontal range (tak jak pion: po X)
      if(a.row === row){
        const pos = computePositions(row);
        const pa = pos[a.index];
        const pb = pos[sel.index];
        if(pa && pb){
          const x0cm = Math.min(pa.x0, pb.x0);
          const x1cm = Math.max(pa.x1, pb.x1);
          // Blendy/cokół tylko po ciągłych szafkach – bez przerw w środku
          const i0 = Math.min(a.index, sel.index);
          const i1 = Math.max(a.index, sel.index);
          const rowEls = (seg.rows[row]||[]);
          let hasGap = false;
          for(let i=i0;i<=i1;i++){ if(rowEls[i] && rowEls[i].kind==='gap'){ hasGap=true; break; } }
          if(hasGap){
            showRysunekInfo('Zakres zawiera przerwę. Blendy/cokół można dodać tylko na ciągłych szafkach.');
            st.rangeStart = { row, index: sel.index };
            st.hRange = null; st.vRange = null;
            saveProject(); renderCabinets();
            return;
          }
          st.hRange = { row, x0cm, x1cm, startIndex: a.index, endIndex: sel.index };
          st.vRange = null;
        } else {
          st.rangeStart = { row, index: sel.index };
          st.hRange = null;
          st.vRange = null;
          saveProject();
          renderCabinets();
          return;
        }
      } else {
        const posA = computePositions(a.row);
        const posB = computePositions(row);
        const pa = posA[a.index];
        const pb = posB[sel.index];
        if(pa && pb){
          const x0cm = Math.max(pa.x0, pb.x0);
          const x1cm = Math.min(pa.x1, pb.x1);
          if(x1cm > x0cm){
            const order = ['wall','module','base']; // top -> bottom
            const ia = order.indexOf(a.row);
            const ib = order.indexOf(row);
            const topRow = order[Math.min(ia, ib)];
            const bottomRow = order[Math.max(ia, ib)];
            const rowsIncl = order.slice(Math.min(ia, ib), Math.max(ia, ib)+1);
            // Blenda pion pełna tylko jeżeli w kolumnie nie ma przerw w żadnym z rzędów
            let hasGapV = false;
            for(const rk of rowsIncl){
              const posR = computePositions(rk);
              const elsR = (seg.rows[rk]||[]);
              for(let i=0;i<elsR.length;i++){
                if(elsR[i].kind==='gap'){
                  const pr = posR[i];
                  if(pr && pr.x1 > x0cm && pr.x0 < x1cm){ hasGapV = true; break; }
                }
              }
              if(hasGapV) break;
            }
            if(hasGapV){
              showRysunekInfo('Zakres pionowy przechodzi przez przerwę. Blendy można dodać tylko na ciągłych szafkach.');
              st.rangeStart = { row, index: sel.index };
              st.hRange = null; st.vRange = null;
              saveProject(); renderCabinets();
              return;
            }
            st.vRange = { x0cm, x1cm, topRow, bottomRow, rows: rowsIncl };
            st.hRange = null;
          } else {
            // no overlap => reset start to this
            st.rangeStart = { row, index: sel.index };
            st.hRange = null;
            st.vRange = null;
            saveProject();
            renderCabinets();
            return;
          }
        }
      }
      st.rangeStart = null;
      saveProject();
      renderCabinets();
    };

    const bClear = document.createElement('button');
    bClear.className='btn';
    bClear.textContent='Wyczyść zakres';
    bClear.onclick = ()=>{
      st.rangeStart = null;
      st.hRange = null;
      st.vRange = null;
      saveProject();
      renderCabinets();
    };

    rBtns.appendChild(bStart);
    rBtns.appendChild(bEnd);
    rBtns.appendChild(bClear);

    rSel.appendChild(rInfo);
    rSel.appendChild(rBtns);
    box.appendChild(rSel);


// Vertical range actions (od dołu do góry)
if(st.vRange && st.vRange.x1cm > st.vRange.x0cm){
  const vr = st.vRange;
  const rowDiv = document.createElement('div');
  rowDiv.style.display='flex';
  rowDiv.style.flexDirection='column';
  rowDiv.style.gap='8px';
  rowDiv.style.marginBottom='10px';

  const info = document.createElement('div');
  info.className='muted xs';
  info.textContent = `Zakres pionowy: ${humanRow(vr.topRow)} → ${humanRow(vr.bottomRow)} (kolumna)`;
  rowDiv.appendChild(info);

  // Opcje zakresu pionowego (mobile-friendly): co doliczać do wysokości
  if(vr.includeTopBlende === undefined){
    // domyślnie: jeśli w kolumnie są GÓRNE, dolicz blendę górną
    vr.includeTopBlende = true;
  }
  if(vr.includePlinth === undefined){
    // domyślnie: jeśli zakres obejmuje DOLNE, dolicz cokół
    vr.includePlinth = (Array.isArray(vr.rows)? vr.rows.includes('base') : (vr.bottomRow==='base' || vr.topRow==='base'));
  }
  const optWrap = document.createElement('div');
  optWrap.style.display='flex';
  optWrap.style.flexWrap='wrap';
  optWrap.style.gap='8px';

  const btnTopOpt = document.createElement('button');
  btnTopOpt.className='btn';
  const paintTop = ()=>{ btnTopOpt.textContent = 'Blenda górna: ' + (vr.includeTopBlende ? 'TAK' : 'NIE'); };
  paintTop();
  btnTopOpt.onclick = ()=>{ vr.includeTopBlende = !vr.includeTopBlende; paintTop(); saveProject(); renderCabinets(); };

  const btnPlOpt = document.createElement('button');
  btnPlOpt.className='btn';
  const paintPl = ()=>{ btnPlOpt.textContent = 'Cokół: ' + (vr.includePlinth ? 'TAK' : 'NIE'); };
  paintPl();
  btnPlOpt.onclick = ()=>{ vr.includePlinth = !vr.includePlinth; paintPl(); saveProject(); renderCabinets(); };

  optWrap.appendChild(btnTopOpt);
  optWrap.appendChild(btnPlOpt);
  rowDiv.appendChild(optWrap);

  const btnL = document.createElement('button');
  btnL.className='btn-primary';
  btnL.textContent='Dodaj blendę pion pełna (lewa)';
  btnL.onclick = async ()=>{
    const w = await askRysunekNumber('Szerokość blendy', 'Szerokość blendy (cm):', 5);
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'blenda_pion_full', segmentId:seg.id, side:'L', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };

  const btnR = document.createElement('button');
  btnR.className='btn-primary';
  btnR.textContent='Dodaj blendę pion pełna (prawa)';
  btnR.onclick = async ()=>{
    const w = await askRysunekNumber('Szerokość blendy', 'Szerokość blendy (cm):', 5);
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'blenda_pion_full', segmentId:seg.id, side:'R', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };

  const btnC = document.createElement('button');
  btnC.className='btn';
  btnC.textContent='Wyczyść zakres pionowy';
  btnC.onclick = ()=>{ st.vRange=null; saveProject(); renderCabinets(); };

    const btnPL = document.createElement('button');
  btnPL.className='btn';
  btnPL.textContent='Dodaj panel pełny (lewy)';
  btnPL.onclick = async ()=>{
    const w = await askRysunekNumber('Grubość panela', 'Grubość panela (cm):', 1.8);
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'panel_pion_full', segmentId:seg.id, side:'L', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };

  const btnPR = document.createElement('button');
  btnPR.className='btn';
  btnPR.textContent='Dodaj panel pełny (prawy)';
  btnPR.onclick = async ()=>{
    const w = await askRysunekNumber('Grubość panela', 'Grubość panela (cm):', 1.8);
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'panel_pion_full', segmentId:seg.id, side:'R', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };
rowDiv.appendChild(btnL);
  rowDiv.appendChild(btnR);
  rowDiv.appendChild(btnC);

  box.appendChild(rowDiv);
}
    // Range actions
    if(st.hRange && st.hRange.row===row){
      const r = st.hRange;
      const btn1 = document.createElement('button');
      btn1.className='btn-primary';
      btn1.textContent = (row==='base') ? 'Dodaj cokół na zakresie' : (row==='wall') ? 'Dodaj blendę górną na zakresie' : 'Zakres w modułach: brak akcji';
      if(row==='module'){ btn1.disabled = true; btn1.className='btn'; }
      btn1.onclick = ()=>{
        // długość zakresu liczona jako suma szerokości SZAFEK w zakresie (bez przerw)
        const x0 = Math.min(Number(r.x0cm)||0, Number(r.x1cm)||0);
        const x1 = Math.max(Number(r.x0cm)||0, Number(r.x1cm)||0);
        let lenCm = 0;
        if(r.startIndex!=null && r.endIndex!=null){
          const i0 = Math.min(r.startIndex, r.endIndex);
          const i1 = Math.max(r.startIndex, r.endIndex);
          const rowEls = (seg.rows[row]||[]);
          for(let i=i0;i<=i1;i++){
            const e = rowEls[i];
            if(!e || e.kind!=='cabinet') continue;
            const c = getCabById(room, e.id);
            lenCm += (c ? Number(c.width)||0 : 0);
          }
        } else {
          const pos = computePositions(row);
          pos.forEach(pp=>{
            if(!pp || !pp.el || pp.el.kind!=='cabinet') return;
            const ov = Math.min(pp.x1, x1) - Math.max(pp.x0, x0);
            if(ov>0) lenCm += ov;
          });
        }
addFinish(room, {
          type: (row==='base') ? 'cokol' : 'blenda_gorna',
          segmentId: seg.id,
          row,
          startIndex: r.startIndex,
          endIndex: r.endIndex,
          x0cm: x0,
          x1cm: x1,
          lengthCm: Number(lenCm.toFixed(1)),
          includeGaps: false
        });
        st.hRange = null;
        saveProject();
        renderCabinets();
      };
      const btn2 = document.createElement('button');
      btn2.className='btn';
      btn2.textContent='Wyczyść zakres';
      btn2.onclick = ()=>{ st.hRange=null; saveProject(); renderCabinets(); };

      const rowDiv = document.createElement('div');
      rowDiv.style.display='flex';
      rowDiv.style.flexDirection='column';
      rowDiv.style.gap='8px';
      rowDiv.appendChild(btn1);
      rowDiv.appendChild(btn2);
      box.appendChild(rowDiv);

      insBody.innerHTML = '';
      insBody.appendChild(box);
      return;
    }

    // Element actions

    const actions = document.createElement('div');
    actions.style.display='flex';
    actions.style.flexDirection='column';
    actions.style.gap='8px';

    function askWidth(def){ return askRysunekNumber('Szerokość', 'Szerokość (cm):', def); }

    if(el.kind==='cabinet'){
      const btnPL = document.createElement('button');
      btnPL.className='btn';
      btnPL.textContent='Dodaj panel lewy';
      btnPL.onclick = async ()=>{
        const w = await askWidth(1.8); if(!(w>0)) return;
        addFinish(room, { type:'panel', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'L', width:w });
        renderCabinets();
      };
      const btnPR = document.createElement('button');
      btnPR.className='btn';
      btnPR.textContent='Dodaj panel prawy';
      btnPR.onclick = async ()=>{
        const w = await askWidth(1.8); if(!(w>0)) return;
        addFinish(room, { type:'panel', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'R', width:w });
        renderCabinets();
      };
      const btnBL = document.createElement('button');
      btnBL.className='btn';
      btnBL.textContent='Dodaj blendę pion lewa';
      btnBL.onclick = async ()=>{
        const w = await askWidth(5); if(!(w>0)) return;
        addFinish(room, { type:'blenda_pion', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'L', width:w });
        renderCabinets();
      };
      const btnBR = document.createElement('button');
      btnBR.className='btn';
      btnBR.textContent='Dodaj blendę pion prawa';
      btnBR.onclick = async ()=>{
        const w = await askWidth(5); if(!(w>0)) return;
        addFinish(room, { type:'blenda_pion', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'R', width:w });
        renderCabinets();
      };
      const btnGapA = document.createElement('button');
      btnGapA.className='btn';
      btnGapA.textContent='Wstaw przerwę po prawej';
      btnGapA.onclick = async ()=>{
        const w = await askWidth(5); if(!(w>0)) return;
        insertGapAfter(room, seg, row, sel.index, w);
        renderCabinets();
      };

      actions.appendChild(btnPL);
      actions.appendChild(btnPR);
      actions.appendChild(btnBL);
      actions.appendChild(btnBR);
      actions.appendChild(btnGapA);
    } else {
      // gap
      const btnEdit = document.createElement('button');
      btnEdit.className='btn';
      btnEdit.textContent='Zmień szerokość przerwy';
      btnEdit.onclick = async ()=>{
        const w = await askWidth(Number(el.width)||5);
        if(!(w>0)) return;
        el.width = w;
        saveProject();
        renderCabinets();
      };
      const btnDel = document.createElement('button');
      btnDel.className='btn-danger';
      btnDel.textContent='Usuń przerwę';
      btnDel.onclick = async ()=>{
        if(!(await askRysunekConfirm('confirmDeleteGap'))) return;
        (seg.rows[row]||[]).splice(sel.index,1);
        st.selected = null;
        saveProject();
        renderCabinets();
      };
      actions.appendChild(btnEdit);
      actions.appendChild(btnDel);
    }

    box.appendChild(actions);
    insBody.innerHTML = '';
    insBody.appendChild(box);
  }

  function renderFinishListPanel(){
    const segFin = (pd.finishes||[]).filter(f=>f.segmentId===seg.id);
    finList.innerHTML = '';
    if(segFin.length===0){
      finList.innerHTML = `<div class="muted xs">Brak.</div>`;
      return;
    }
    segFin.forEach(f=>{
      const row = document.createElement('div');
      row.className = 'finish-item';
      const meta = document.createElement('div');
      meta.className = 'meta';
      const b = document.createElement('b');
      b.textContent = finishLabel(f);
      const p = document.createElement('p');
      p.className = 'muted xs';
      p.style.margin='0';
      let extra = [];
      const s = pd.settings || {};

      const fmt = (n)=> {
        const v = Number(n);
        if(!isFinite(v)) return '0';
        // keep one decimal if needed
        return (Math.round(v*10)/10).toString();
      };

      if(f.type==='panel' || f.type==='blenda_pion'){
        const rowKey = f.row;
        const idx = Number(f.index)||0;
        const arr = seg.rows[rowKey] || [];
        const el = arr[idx] || null;
        const hCm = elHeightCm(rowKey, el);
        const wCm = Number(f.width)||0;
        extra.push(`${humanRow(rowKey)} • #${idx+1} • ${f.side} • szer ${fmt(wCm)}cm • wys ${fmt(hCm)}cm`);
      } else if(f.type==='blenda_pion_full'){
        const topRow = f.topRow || 'wall';
        const bottomRow = f.bottomRow || 'base';
        const side = f.side || 'R';
        const wCm = Number(f.width)||0;

        const topY = rowY[topRow] + LABEL_H;
        const botHcm = (bottomRow==='wall'?wallH:(bottomRow==='module'?moduleH:baseH));
        const bottomY = rowY[bottomRow] + LABEL_H + botHcm*SCALE;
        const hCm = Math.abs(bottomY - topY)/SCALE;

        extra.push(`kolumna ${humanRow(topRow)}→${humanRow(bottomRow)} • ${side} • szer ${fmt(wCm)}cm • wys ${fmt(hCm)}cm`);
      } else if(f.type==='cokol' || f.type==='blenda_gorna'){
        const rowKey = f.row;
        const pos = computePositions(rowKey);
        const a = Math.max(0, Math.min(Number(f.startIndex)||0, Number(f.endIndex)||0));
        const b = Math.min(pos.length-1, Math.max(Number(f.startIndex)||0, Number(f.endIndex)||0));

        let lenCm = (isFinite(Number(f.lengthCm)) && Number(f.lengthCm)>0) ? Number(f.lengthCm) : NaN;
        if(pos[a] && pos[b]){
          if(!isFinite(lenCm)){
            if(f.includeGaps === false){
              lenCm = 0;
              for(let i=a;i<=b;i++){
                if(pos[i].el && pos[i].el.kind==='cabinet') lenCm += Number(pos[i].w)||0;
              }
            } else {
              lenCm = (Number(pos[b].x1)||0) - (Number(pos[a].x0)||0);
            }
          }
        }
        const hCm = (f.type==='cokol') ? (Number(s.legHeight)||0) : (Number(s.ceilingBlende)||0);
        extra.push(`${humanRow(rowKey)} • zakres ${a+1}-${b+1} • dł ${fmt(lenCm)}cm • wys ${fmt(hCm)}cm`);
      }

      p.textContent = extra.join(' | ');
      meta.appendChild(b);
      meta.appendChild(p);

      const del = document.createElement('button');
      del.className='btn-danger';
      del.textContent='Usuń';
      del.onclick = ()=>{ removeFinish(room, f.id); renderCabinets(); };

      row.appendChild(meta);
      row.appendChild(del);
      finList.appendChild(row);
    });
  }

  // mount svg and render
  svgHost.innerHTML = '';
  svgHost.appendChild(svg);

  renderAll();
  renderInspector();
  renderFinishListPanel();

  }

  window.FC.tabsRysunek.renderDrawingTab = renderDrawingTab;
  window.renderDrawingTab = renderDrawingTab;

  function render(ctx){
    const list = ctx && ctx.listEl;
    const room = ctx && ctx.room;
    if(!list || !room) return;

    try{
      renderDrawingTab(list, room);
      return;
    }catch(e){
      try{ console.error('[rysunek] render error', e); }catch(_ ){ }
    }

    try{
      list.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'build-card';
      card.innerHTML = '<h3>Rysunek</h3><p class="muted">Nie udało się wyrenderować widoku. Odśwież stronę.</p>';
      list.appendChild(card);
    }catch(_ ){ }
  }

  function registerWithRetry(tries){
    tries = tries || 0;
    const reg = (window.FC && window.FC.tabsRouter && typeof window.FC.tabsRouter.register === 'function')
      ? window.FC.tabsRouter.register
      : ((window.FC.tabs && typeof window.FC.tabs.register === 'function') ? window.FC.tabs.register : null);

    if(typeof reg === 'function'){
      reg('rysunek', { mount(){}, render, unmount(){} });
      return;
    }

    if(tries < 30){
      setTimeout(()=>registerWithRetry(tries+1), 25);
    }
  }

  registerWithRetry(0);
})();

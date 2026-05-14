// UI importu PRO100 do zlecenia usługowego.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k,v])=>{
      if(v == null) return;
      if(k === 'class') el.className = v;
      else if(k === 'text') el.textContent = v;
      else if(k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v);
    });
    (children || []).forEach((child)=> child && el.appendChild(child));
    return el;
  }
  function text(value){ return String(value == null ? '' : value).trim(); }
  function escapeHtml(value){ return String(value == null ? '' : value).replace(/[&<>'"]/g, (ch)=> ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[ch] || ch)); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return null; } }
  function uid(prefix){ try{ return FC.utils && typeof FC.utils.uid === 'function' ? FC.utils.uid() : `${prefix || 'id'}_${Date.now()}_${Math.random().toString(16).slice(2)}`; }catch(_){ return `${prefix || 'id'}_${Date.now()}`; } }
  function parser(){ return FC.servicePro100Parser || null; }
  function catalog(){ return FC.catalogStore || null; }
  function getMaterials(){ try{ return catalog() && catalog().getSheetMaterials ? catalog().getSheetMaterials() : []; }catch(_){ return []; } }
  function saveMaterials(list){ try{ return catalog() && catalog().savePriceList ? catalog().savePriceList('materials', list) : list; }catch(_){ return list; } }
  function materialKey(row){ return parser() && parser().makeMaterialKey ? parser().makeMaterialKey(row && row.materialSymbol, row && row.thickness) : `${text(row && row.materialSymbol).toLowerCase()}|${text(row && row.thickness)}`; }
  function findMaterial(row, materials){
    const symbol = text(row && row.materialSymbol).toLowerCase();
    if(!symbol) return null;
    return (Array.isArray(materials) ? materials : []).find((item)=>{
      const itemSymbol = text(item && item.symbol).toLowerCase();
      const itemName = text(item && item.name).toLowerCase();
      return itemSymbol === symbol || itemName === symbol || itemName.includes(symbol);
    }) || null;
  }
  function uniqueMissingMaterials(rows, materials){
    const seen = new Set();
    const out = [];
    (Array.isArray(rows) ? rows : []).forEach((row)=>{
      const key = materialKey(row);
      if(seen.has(key) || findMaterial(row, materials)) return;
      seen.add(key);
      out.push({ key, symbol:text(row.materialSymbol), thickness:Number(row.thickness) || 0, hasGrain:false });
    });
    return out;
  }
  function buildResolvedMaterialMap(rows, missingState){
    const baseMaterials = getMaterials();
    const additions = [];
    const byKey = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row)=>{
      const key = materialKey(row);
      const existing = findMaterial(row, baseMaterials.concat(additions));
      if(existing){ byKey.set(key, existing); return; }
      const missing = (missingState || []).find((item)=> item.key === key) || { symbol:row.materialSymbol, thickness:row.thickness, hasGrain:false };
      const symbol = text(missing.symbol || row.materialSymbol);
      const created = {
        id: uid('mat_pro100'),
        materialType:'laminat',
        manufacturer:'PRO100',
        symbol,
        name:symbol,
        price:0,
        hasGrain:!!missing.hasGrain,
      };
      additions.push(created);
      byKey.set(key, created);
    });
    if(additions.length) saveMaterials(baseMaterials.concat(additions));
    return byKey;
  }
  function rowsToParts(rows, materialMap){
    return (Array.isArray(rows) ? rows : []).map((row, index)=>{
      const material = materialMap && materialMap.get(materialKey(row));
      return {
        id: text(row.id) || uid('pro100_part'),
        name:text(row.name) || `Formatka ${index + 1}`,
        qty:Math.max(1, Number(row.qty) || 1),
        along:Math.max(0, Number(row.along) || 0),
        across:Math.max(0, Number(row.across) || 0),
        edgesAlong:Math.max(0, Math.min(2, Number(row.edgesAlong) || 0)),
        edgesAcross:Math.max(0, Math.min(2, Number(row.edgesAcross) || 0)),
        thickness:Math.max(0, Number(row.thickness) || 0),
        materialId:text(material && material.id),
        materialName:text(material && material.name) || text(row.materialSymbol),
        materialSymbol:text(row.materialSymbol),
        hasGrain:!!(material && material.hasGrain),
        source:'pro100',
      };
    });
  }
  function fillPreview(target, parsed, missingState){
    target.innerHTML = '';
    if(!(parsed && parsed.ok)){
      target.appendChild(h('div', { class:'muted', text:'Wklej dane z PRO100 i kliknij Analizuj.' }));
      return;
    }
    const s = parsed.summary || {};
    target.appendChild(h('div', { class:'card', html:`<b>Podgląd importu</b><br>Formatki: ${Number(s.rows) || 0}, sztuk: ${Number(s.totalQty) || 0}, oklejanie: ${Number(s.edgeMeters) || 0} mb, cięcie obrysu: ${Number(s.cutMeters) || 0} mb, powierzchnia: ${Number(s.areaM2) || 0} m²` }));
    if(Array.isArray(s.materials) && s.materials.length){
      const rows = h('div', { style:'margin-top:8px;' });
      s.materials.forEach((row)=> rows.appendChild(h('div', { class:'muted xs', text:`${row.symbol} / ${row.thickness} mm — ${row.rows} wierszy, ${row.qty} szt., ${row.areaM2} m², ${row.edgeMeters} mb oklejania` })));
      target.appendChild(rows);
    }
    if(Array.isArray(parsed.warnings) && parsed.warnings.length){
      const warn = h('div', { class:'card', style:'margin-top:10px;border-color:rgba(220,38,38,.25);', html:`<b>Ostrzeżenia</b><br>${parsed.warnings.slice(0, 5).map((w)=> `Wiersz ${w.line}: ${escapeHtml(w.message)}`).join('<br>')}${parsed.warnings.length > 5 ? '<br>…' : ''}` });
      target.appendChild(warn);
    }
    const missing = Array.isArray(missingState) ? missingState : [];
    if(missing.length){
      const box = h('div', { class:'card', style:'margin-top:10px;' });
      box.appendChild(h('div', { text:'Brakujące kolory — dodaj do materiałów', style:'font-weight:800;margin-bottom:8px;' }));
      missing.forEach((item)=>{
        const row = h('label', { style:'display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:8px;margin:6px 0;' });
        row.appendChild(h('span', { text:`${item.symbol} / ${item.thickness} mm` }));
        const right = h('span', { style:'display:flex;align-items:center;gap:8px;font-weight:800;' });
        const cb = h('input', { type:'checkbox' });
        cb.checked = !!item.hasGrain;
        cb.addEventListener('change', ()=>{ item.hasGrain = !!cb.checked; });
        right.appendChild(cb);
        right.appendChild(h('span', { text:'Ma słoje' }));
        row.appendChild(right);
        box.appendChild(row);
      });
      target.appendChild(box);
    }
    const table = h('div', { style:'margin-top:10px;max-height:220px;overflow:auto;border:1px solid rgba(0,0,0,.08);border-radius:12px;' });
    table.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:6px">Nazwa</th><th>Dł.</th><th>Okl.</th><th>Szer.</th><th>Okl.</th><th>Gr.</th><th>Ilość</th><th>Kolor</th></tr></thead><tbody>${parsed.rows.slice(0, 80).map((row)=> `<tr><td style="padding:6px;border-top:1px solid rgba(0,0,0,.06)">${escapeHtml(row.name)}</td><td>${row.along}</td><td>${row.edgesAlong}</td><td>${row.across}</td><td>${row.edgesAcross}</td><td>${row.thickness}</td><td>${row.qty}</td><td>${escapeHtml(row.materialSymbol)}</td></tr>`).join('')}</tbody></table>`;
    target.appendChild(table);
  }

  function open(options){
    const cfg = Object.assign({ draft:null, onApply:null }, options || {});
    if(!parser()) return;
    let parsed = null;
    let missingState = [];
    const body = h('div', { class:'panel-box-form rozrys-panel-form rozrys-panel-form--stock' });
    const scroll = h('div', { class:'panel-box-form__scroll' });
    const area = h('textarea', { class:'investor-form-input investor-form-textarea', placeholder:'Wklej tabelę z PRO100: nazwa | długość | oklejanie | szerokość | oklejanie | grubość | ilość | kolor', style:'min-height:170px;font-family:monospace;' });
    const modeWrap = h('div', { style:'display:flex;gap:10px;align-items:center;margin:8px 0;flex-wrap:wrap;' });
    const appendCb = h('input', { type:'checkbox' }); appendCb.checked = true;
    modeWrap.appendChild(h('label', { style:'display:flex;align-items:center;gap:8px;font-weight:800;' }, [appendCb, h('span', { text:'Dopisz do obecnych formatek' })]));
    const preview = h('div', { style:'margin-top:10px;' });
    scroll.appendChild(area);
    scroll.appendChild(modeWrap);
    scroll.appendChild(preview);
    body.appendChild(scroll);
    const footer = h('div', { class:'panel-box-form__footer rozrys-panel-footer' });
    const actions = h('div', { class:'rozrys-panel-footer__actions' });
    const analyzeBtn = h('button', { class:'btn-primary', type:'button', text:'Analizuj' });
    const closeBtn = h('button', { class:'btn', type:'button', text:'Wyjdź' });
    const applyBtn = h('button', { class:'btn btn-success', type:'button', text:'Dodaj do usługi' });
    applyBtn.disabled = true;
    actions.appendChild(closeBtn); actions.appendChild(analyzeBtn); actions.appendChild(applyBtn); footer.appendChild(actions); body.appendChild(footer);

    function analyze(){
      parsed = parser().parse(area.value || '');
      missingState = parsed && parsed.ok ? uniqueMissingMaterials(parsed.rows, getMaterials()) : [];
      applyBtn.disabled = !(parsed && parsed.ok);
      fillPreview(preview, parsed, missingState);
    }
    analyzeBtn.addEventListener('click', analyze);
    let overlay = null;
    function closeSelf(){
      try{ if(overlay) overlay.remove(); }catch(_){ }
      try{ document.removeEventListener('keydown', onKey, true); }catch(_){ }
      overlay = null;
    }
    function onKey(event){ if(event.key === 'Escape'){ event.preventDefault(); closeSelf(); } }
    closeBtn.addEventListener('click', closeSelf);
    applyBtn.addEventListener('click', ()=>{
      if(!(parsed && parsed.ok)) return;
      const materialMap = buildResolvedMaterialMap(parsed.rows, missingState);
      const importedParts = rowsToParts(parsed.rows, materialMap);
      const firstPart = importedParts[0] || null;
      const current = cfg.draft && typeof cfg.draft === 'object' ? clone(cfg.draft) : {};
      const nextParts = appendCb.checked ? (Array.isArray(current.parts) ? current.parts : []).concat(importedParts) : importedParts;
      const patch = Object.assign({}, current, {
        enabled:true,
        materialMode:firstPart && firstPart.materialId ? 'catalog' : (current.materialMode || 'catalog'),
        materialId:firstPart && firstPart.materialId ? firstPart.materialId : text(current.materialId),
        materialName:firstPart && firstPart.materialName ? firstPart.materialName : text(current.materialName),
        parts:nextParts,
        importSummary:parsed.summary,
      });
      try{ if(typeof cfg.onApply === 'function') cfg.onApply(patch, { parsed, importedParts }); }catch(_){ }
      applyBtn.textContent = 'Dodano';
      setTimeout(()=>{ closeSelf(); }, 180);
    });
    fillPreview(preview, parsed, missingState);
    overlay = h('div', { class:'panel-box-backdrop panel-box-backdrop--top' });
    const box = h('div', { class:'panel-box panel-box--rozrys', role:'dialog', 'aria-modal':'true', style:'max-width:980px' });
    const head = h('div', { class:'panel-box__head' });
    head.appendChild(h('div', { class:'panel-box__title', text:'Import formatek PRO100' }));
    const x = h('button', { type:'button', class:'panel-box__close', 'aria-label':'Zamknij', text:'×' });
    x.addEventListener('click', closeSelf);
    head.appendChild(x);
    const boxBody = h('div', { class:'panel-box__body panel-box__body--form' }, [body]);
    box.appendChild(head);
    box.appendChild(boxBody);
    overlay.appendChild(box);
    box.addEventListener('pointerdown', (event)=> event.stopPropagation());
    document.addEventListener('keydown', onKey, true);
    try{ document.body.appendChild(overlay); }catch(_){ }
    setTimeout(()=>{ try{ area.focus(); }catch(_){ } }, 20);
  }

  FC.servicePro100Import = {
    open,
    uniqueMissingMaterials,
    rowsToParts,
    buildResolvedMaterialMap,
  };
})();

(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function byId(id){ return document.getElementById(id); }
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
  function normalizeText(value){ return String(value == null ? '' : value).trim(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return null; } }
  function store(){ return FC.serviceOrderStore || FC.catalogStore || null; }
  function info(title, message){ try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title, message }); }catch(_){ } }
  async function ask(cfg){ try{ return !!(await (FC.confirmBox && FC.confirmBox.ask ? FC.confirmBox.ask(cfg) : true)); }catch(_){ return true; } }

  function getOrder(id){
    const s = store();
    if(!s) return null;
    if(typeof s.getById === 'function') return s.getById(id);
    if(typeof s.getServiceOrders === 'function') return (s.getServiceOrders() || []).find((row)=> String(row.id || '') === String(id || '')) || null;
    return null;
  }

  function saveOrder(order){
    const s = store();
    if(!s) return null;
    if(typeof s.upsert === 'function') return s.upsert(order);
    if(typeof s.upsertServiceOrder === 'function') return s.upsertServiceOrder(order);
    return order;
  }

  function materialOptions(){
    try{ return FC.serviceCuttingCommon && FC.serviceCuttingCommon.getCatalogMaterials ? FC.serviceCuttingCommon.getCatalogMaterials() : []; }catch(_){ return []; }
  }

  function open(orderId){
    const order = getOrder(orderId);
    if(!order){ info('Brak zlecenia', 'Nie udało się odnaleźć wskazanego zlecenia usługowego.'); return; }
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
    const common = FC.serviceCuttingCommon;
    const rozrys = FC.serviceCuttingRozrys;
    if(!common || !rozrys){ info('Brak modułów', 'Nie udało się uruchomić widoku cięcia usługowego.'); return; }

    let draft = common.normalizeDraft(order.cutting || {});
    let dirty = false;
    let lastGenerated = draft.plan ? { ok:true, state:clone(draft.state || {}), materialMeta: common.resolveMaterialMeta(draft), parts: common.buildPlanParts(draft.parts, draft.materialName), plan: clone(draft.plan) } : null;

    const body = h('div', { class:'panel-box-form rozrys-panel-form rozrys-panel-form--stock' });
    const scroll = h('div', { class:'panel-box-form__scroll' });
    const topGrid = h('div', { class:'grid-2' });
    const partsWrap = h('div', { style:'grid-column:1 / -1;margin-top:10px;' });
    const partsHead = h('div', { style:'display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;' }, [
      h('div', { text:'Formatki do cięcia', style:'font-weight:800;font-size:18px;' }),
      h('button', { class:'btn-primary', type:'button', text:'Dodaj formatkę' })
    ]);
    const partsList = h('div');
    const previewWrap = h('div', { style:'grid-column:1 / -1;margin-top:14px;' });
    const previewHead = h('div', { text:'Rozrys usługowy', style:'font-weight:800;font-size:18px;margin-bottom:8px;' });
    const previewTarget = h('div', { style:'min-height:60px;' });

    const materialMode = h('select', { class:'investor-form-input' });
    materialMode.innerHTML = '<option value="catalog">Materiał z cennika</option><option value="client">Materiał klienta</option>';
    materialMode.value = draft.materialMode;

    const materialSelect = h('select', { class:'investor-form-input' });
    const materialNameInput = h('input', { class:'investor-form-input', type:'text', placeholder:'Nazwa materiału klienta' });
    materialNameInput.value = draft.materialName || '';
    const boardWInput = h('input', { class:'investor-form-input', type:'number', min:'1', step:'1' });
    const boardHInput = h('input', { class:'investor-form-input', type:'number', min:'1', step:'1' });
    const kerfInput = h('input', { class:'investor-form-input', type:'number', min:'0', step:'1' });
    const trimInput = h('input', { class:'investor-form-input', type:'number', min:'0', step:'1' });
    boardWInput.value = String(draft.boardW || 2800);
    boardHInput.value = String(draft.boardH || 2070);
    kerfInput.value = String(draft.kerf || 4);
    trimInput.value = String(draft.edgeTrim || 10);

    function refreshMaterialSelect(){
      const rows = materialOptions();
      materialSelect.innerHTML = '<option value="">Wybierz materiał</option>' + rows.map((row)=> `<option value="${String(row.id || '')}">${String(row.name || 'Materiał')}</option>`).join('');
      materialSelect.value = draft.materialId || '';
    }

    function field(label, input, full){
      const wrap = h('div', { class:'investor-choice-field' + (full ? ' investor-choice-field--full' : '') });
      if(full) wrap.style.gridColumn = '1 / -1';
      wrap.appendChild(h('label', { text:label }));
      wrap.appendChild(input);
      return wrap;
    }

    function markDirty(){ dirty = true; }

    function syncDraftFromInputs(){
      draft.materialMode = materialMode.value === 'client' ? 'client' : 'catalog';
      draft.materialId = normalizeText(materialSelect.value);
      draft.materialName = draft.materialMode === 'client' ? normalizeText(materialNameInput.value) : (()=>{
        const row = materialOptions().find((item)=> String(item.id || '') === String(materialSelect.value || ''));
        return normalizeText(row && row.name);
      })();
      draft.boardW = Math.max(1, Number(boardWInput.value) || 0);
      draft.boardH = Math.max(1, Number(boardHInput.value) || 0);
      draft.kerf = Math.max(0, Number(kerfInput.value) || 0);
      draft.edgeTrim = Math.max(0, Number(trimInput.value) || 0);
      draft.parts = Array.from(partsList.querySelectorAll('[data-part-row="1"]')).map((row, index)=> common.normalizePart({
        id: row.getAttribute('data-part-id') || '',
        name: row.querySelector('[data-field="name"]').value,
        qty: row.querySelector('[data-field="qty"]').value,
        along: row.querySelector('[data-field="along"]').value,
        across: row.querySelector('[data-field="across"]').value,
        edgesAlong: row.querySelector('[data-field="edgesAlong"]').value,
        edgesAcross: row.querySelector('[data-field="edgesAcross"]').value,
      }, index));
    }

    function renderParts(){
      partsList.innerHTML = '';
      if(!Array.isArray(draft.parts) || !draft.parts.length) draft.parts = [common.normalizePart({}, 0)];
      draft.parts.forEach((part, index)=>{
        const row = common.normalizePart(part, index);
        const item = h('div', { 'data-part-row':'1', 'data-part-id':row.id, style:'border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:10px;margin:8px 0;' });
        const grid = h('div', { class:'grid-2', style:'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;' });
        function inp(type, value, field, opts){
          const el = h(type === 'select' ? 'select' : 'input', { class:'investor-form-input', 'data-field':field, type:type === 'select' ? null : type });
          if(type === 'select') el.innerHTML = '<option value="0">0</option><option value="1">1</option><option value="2">2</option>';
          if(value != null) el.value = String(value);
          if(opts){ Object.entries(opts).forEach(([k,v])=>{ if(v != null) el.setAttribute(k, v); }); }
          el.addEventListener('input', markDirty);
          el.addEventListener('change', markDirty);
          return el;
        }
        grid.appendChild(field('Nazwa formatki', inp('text', row.name, 'name'), true));
        grid.appendChild(field('Ilość', inp('number', row.qty, 'qty', { min:'1', step:'1' })));
        grid.appendChild(field('1. wymiar — wzdłuż słoi', inp('number', row.along, 'along', { min:'1', step:'1' })));
        grid.appendChild(field('2. wymiar — w poprzek słoi', inp('number', row.across, 'across', { min:'1', step:'1' })));
        grid.appendChild(field('Oklejanie wzdłuż', inp('select', row.edgesAlong, 'edgesAlong')));
        grid.appendChild(field('Oklejanie w poprzek', inp('select', row.edgesAcross, 'edgesAcross')));
        item.appendChild(grid);
        const actions = h('div', { style:'display:flex;justify-content:flex-end;margin-top:8px;' }, [
          h('button', { class:'btn', type:'button', text:'Usuń' })
        ]);
        actions.querySelector('button').addEventListener('click', ()=>{
          draft.parts = draft.parts.filter((entry)=> String(entry.id || '') !== String(row.id || ''));
          if(!draft.parts.length) draft.parts = [common.normalizePart({}, 0)];
          markDirty();
          renderParts();
        });
        item.appendChild(actions);
        partsList.appendChild(item);
      });
    }

    function updateModeVisibility(){
      const catalog = materialMode.value !== 'client';
      materialSelect.closest('.investor-choice-field').style.display = catalog ? '' : 'none';
      materialNameInput.closest('.investor-choice-field').style.display = catalog ? 'none' : '';
    }

    function applySelectedMaterialMeta(){
      const material = common.resolveMaterialMeta(Object.assign({}, draft, { materialMode:materialMode.value, materialId:materialSelect.value, materialName:materialNameInput.value, boardW:boardWInput.value, boardH:boardHInput.value }));
      if(Number(material.boardW) > 0) boardWInput.value = String(material.boardW);
      if(Number(material.boardH) > 0) boardHInput.value = String(material.boardH);
    }

    refreshMaterialSelect();
    topGrid.appendChild(field('Tryb materiału', materialMode));
    topGrid.appendChild(field('Materiał z cennika', materialSelect));
    topGrid.appendChild(field('Materiał klienta', materialNameInput));
    topGrid.appendChild(field('Szerokość płyty', boardWInput));
    topGrid.appendChild(field('Wysokość płyty', boardHInput));
    topGrid.appendChild(field('Rzaz piły', kerfInput));
    topGrid.appendChild(field('Obrównanie', trimInput));
    updateModeVisibility();

    [materialMode, materialSelect, materialNameInput, boardWInput, boardHInput, kerfInput, trimInput].forEach((el)=>{
      el.addEventListener('input', markDirty);
      el.addEventListener('change', markDirty);
    });
    materialMode.addEventListener('change', ()=>{ updateModeVisibility(); if(materialMode.value !== 'client') applySelectedMaterialMeta(); });
    materialSelect.addEventListener('change', applySelectedMaterialMeta);

    partsHead.querySelector('button').addEventListener('click', ()=>{
      syncDraftFromInputs();
      draft.parts.push(common.normalizePart({}, draft.parts.length));
      markDirty();
      renderParts();
    });

    renderParts();
    previewWrap.appendChild(previewHead);
    previewWrap.appendChild(previewTarget);
    partsWrap.appendChild(partsHead);
    partsWrap.appendChild(partsList);
    scroll.appendChild(topGrid);
    scroll.appendChild(partsWrap);
    scroll.appendChild(previewWrap);
    body.appendChild(scroll);

    const footer = h('div', { style:'display:flex;justify-content:flex-end;gap:8px;margin-top:10px;' });
    const generateBtn = h('button', { class:'btn-primary', type:'button', text:'Generuj rozrys' });
    const saveBtn = h('button', { class:'btn-primary', type:'button', text:'Zapisz' });
    const closeBtn = h('button', { class:'btn', type:'button', text:'Wyjdź' });
    footer.appendChild(generateBtn);
    footer.appendChild(saveBtn);
    footer.appendChild(closeBtn);
    body.appendChild(footer);

    async function generate(){
      syncDraftFromInputs();
      const result = await rozrys.generatePlan(draft);
      if(!result || !result.ok){
        info('Brak rozrysu', (result && result.error) || 'Nie udało się wygenerować rozrysu.');
        rozrys.renderPlan(previewTarget, result || { ok:false, error:'Brak wyniku.' });
        return null;
      }
      lastGenerated = result;
      draft.plan = clone(result.plan);
      draft.generatedAt = Date.now();
      rozrys.renderPlan(previewTarget, result);
      markDirty();
      return result;
    }

    generateBtn.addEventListener('click', ()=>{ generate(); });
    saveBtn.addEventListener('click', async ()=>{
      syncDraftFromInputs();
      const next = Object.assign({}, order, { cutting:Object.assign({}, draft, { plan: clone(draft.plan), generatedAt: Number(draft.generatedAt) || 0 }), updatedAt:Date.now() });
      saveOrder(next);
      dirty = false;
      info('Zapisano', 'Zlecenie usługowe zostało zapisane.');
    });
    closeBtn.addEventListener('click', async ()=>{
      if(dirty){
        const ok = await ask({ title:'Zamknąć bez zapisu?', message:'Masz niezapisane zmiany w zleceniu usługowym.', confirmText:'Wyjdź', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' });
        if(!ok) return;
      }
      try{ FC.panelBox.close && FC.panelBox.close(); }catch(_){ }
    });

    FC.panelBox.open({ title:`Zlecenie usługowe — ${order.title || 'Nowe zlecenie'}`, contentNode:body, width:'1120px', boxClass:'panel-box--rozrys', dismissOnOverlay:false, dismissOnEsc:true });
    if(draft.plan){
      lastGenerated = { ok:true, state:{ unit:draft.unit, boardW:draft.boardW, boardH:draft.boardH, kerf:draft.kerf, edgeTrim:draft.edgeTrim }, materialMeta: common.resolveMaterialMeta(draft), parts: common.buildPlanParts(draft.parts, draft.materialName), plan: clone(draft.plan) };
      rozrys.renderPlan(previewTarget, lastGenerated);
    }
  }

  FC.serviceOrderDetail = { open };
})();

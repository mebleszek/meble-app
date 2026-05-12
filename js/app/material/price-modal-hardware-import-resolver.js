// js/app/material/price-modal-hardware-import-resolver.js
// Uzupełnianie braków obowiązkowych przy imporcie okuć i nowych okuć z arkusza cen dostawców.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function h(tag, props, children){
    const el = document.createElement(tag);
    Object.keys(props || {}).forEach((key)=>{
      const value = props[key];
      if(key === 'class') el.className = value;
      else if(key === 'text') el.textContent = value;
      else if(key === 'html') el.innerHTML = value;
      else if(key === 'style') el.setAttribute('style', value);
      else if(key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if(value !== false && value != null) el.setAttribute(key, value === true ? '' : String(value));
    });
    (Array.isArray(children) ? children : (children ? [children] : [])).forEach((child)=> el.appendChild(child));
    return el;
  }
  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.').replace(/\s+/g, '')); return Number.isFinite(n) ? n : 0; }
  function norm(value){ return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function fieldLabel(field){
    if(field === 'name') return 'Nazwa';
    if(field === 'price') return 'Cena netto albo brutto';
    if(field === 'manufacturer') return 'Producent';
    if(field === 'hardwareCategory' || field === 'itemCategory') return 'Kategoria';
    if(field === 'hardwareUnit' || field === 'itemUnit') return 'Jednostka';
    return field;
  }
  function summaryEntries(entry){
    if(entry && entry.kind === 'supplierPriceCreate'){
      const row = entry.parsed || {};
      return [
        ['Wiersz', row.__rowIndex || entry.rowIndex],
        ['Nazwa', row.itemName],
        ['Symbol', row.itemSymbol],
        ['Producent', row.itemManufacturer],
        ['Dostawca', row.supplierName || row.supplierId],
        ['Cena netto', row.catalogPriceNet],
        ['Cena brutto', row.catalogPriceGross],
        ['Kategoria', row.itemCategory],
        ['Jednostka', row.itemUnit],
      ].filter((rowEntry)=> text(rowEntry[1]));
    }
    const row = entry && entry.row || {};
    return [
      ['Wiersz', row.__rowIndex],
      ['Nazwa', row.name],
      ['Cena netto', row.catalogPriceNet],
      ['Cena brutto', row.catalogPriceGross],
      ['Jednostka', row.hardwareUnit],
      ['Producent', row.manufacturer],
      ['Kategoria', row.hardwareCategory],
      ['Symbol', row.symbol],
    ].filter((rowEntry)=> text(rowEntry[1]));
  }
  function renderSummary(entry){
    const wrap = h('div', { class:'card', style:'padding:10px;margin:10px 0' });
    wrap.appendChild(h('div', { style:'font-weight:900;margin-bottom:8px', text:'Dane wpisane w Excelu' }));
    const grid = h('div', { class:'grid-2', style:'gap:8px' });
    summaryEntries(entry).forEach((rowEntry)=>{
      const tile = h('div', { class:'list-item', style:'display:block;padding:8px' });
      tile.appendChild(h('div', { class:'muted-tag xs', text:rowEntry[0] }));
      tile.appendChild(h('div', { style:'font-weight:800', text:String(rowEntry[1]) }));
      grid.appendChild(tile);
    });
    wrap.appendChild(grid);
    return wrap;
  }
  function optionExists(options, value){
    const key = norm(value);
    return (options || []).some((opt)=> norm(opt && opt.value) === key || norm(opt && opt.label) === key);
  }
  function addOption(options, value){
    const label = text(value);
    if(!label) return options || [];
    if(optionExists(options, label)) return options || [];
    (options || []).push({ value:label, label });
    return options;
  }
  function appChoiceButton(label, value, options, onPick){
    const api = FC.rozrysChoice;
    const current = text(value);
    if(api && typeof api.createChoiceLauncher === 'function' && typeof api.openRozrysChoiceOverlay === 'function'){
      const found = (options || []).find((opt)=> String(opt.value) === current);
      const btn = api.createChoiceLauncher(found ? found.label : (current || 'Wybierz'), '');
      const arrow = btn.querySelector('.rozrys-choice-launch__arrow');
      if(arrow) arrow.remove();
      btn.addEventListener('click', async ()=>{
        const picked = await api.openRozrysChoiceOverlay({ title:label, value:current, options:options || [] });
        if(picked == null) return;
        const opt = (options || []).find((item)=> String(item.value) === String(picked));
        if(typeof onPick === 'function') onPick(String(picked), opt ? opt.label : String(picked));
      });
      return btn;
    }
    const btn = h('button', { type:'button', class:'btn', text:current || 'Wybierz' });
    btn.addEventListener('click', ()=>{
      const first = (options || [])[0];
      if(first && typeof onPick === 'function') onPick(String(first.value), String(first.label || first.value));
    });
    return btn;
  }
  function choiceField(title, value, options, onChange){
    const wrap = h('div', { class:'form-row' });
    wrap.appendChild(h('label', { text:title }));
    const mount = h('div', {});
    let current = text(value);
    const refresh = ()=>{
      mount.innerHTML = '';
      mount.appendChild(appChoiceButton(title, current, options, (picked)=>{ current = picked; if(typeof onChange === 'function') onChange(picked); refresh(); }));
    };
    refresh();
    wrap.appendChild(mount);
    return wrap;
  }
  function inputField(title, value, type, onChange){
    const wrap = h('div', { class:'form-row' });
    wrap.appendChild(h('label', { text:title }));
    const input = h('input', { type:type || 'text', value:text(value), inputmode:type === 'number' ? 'decimal' : null });
    input.addEventListener('input', ()=>{ if(typeof onChange === 'function') onChange(input.value); });
    wrap.appendChild(input);
    return wrap;
  }
  function validationMessage(textValue){ return h('div', { style:'margin-top:8px;color:#a40000;font-weight:800;white-space:pre-wrap', text:textValue }); }
  function openAddCategoryModal(options, data, onAdded){
    return new Promise((resolve)=>{
      let done = false;
      const overlay = h('div', { class:'panel-box-backdrop panel-box-backdrop--center' });
      const box = h('div', { class:'panel-box panel-box--rozrys', role:'dialog', 'aria-modal':'true', style:'max-width:520px' });
      const head = h('div', { class:'panel-box__head' });
      head.appendChild(h('div', { class:'panel-box__title', text:'Dodaj kategorię okucia' }));
      const closeBtn = h('button', { type:'button', class:'panel-box__close', 'aria-label':'Zamknij', text:'×' });
      head.appendChild(closeBtn);
      const body = h('div', { class:'panel-box__body' });
      const row = h('div', { class:'form-row' });
      row.appendChild(h('label', { text:'Nazwa kategorii' }));
      const input = h('input', { type:'text', value:'' });
      row.appendChild(input);
      body.appendChild(row);
      let errorNode = null;
      const actions = h('div', { style:'display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap' });
      const cancelBtn = h('button', { type:'button', class:'btn btn-danger', text:'Anuluj' });
      const saveBtn = h('button', { type:'button', class:'btn btn-success', text:'Zapisz' });
      actions.appendChild(cancelBtn); actions.appendChild(saveBtn);
      body.appendChild(actions);
      box.appendChild(head); box.appendChild(body); overlay.appendChild(box); document.body.appendChild(overlay);
      const cleanup = (value)=>{ if(done) return; done = true; try{ document.removeEventListener('keydown', onKey, true); }catch(_){ } try{ overlay.remove(); }catch(_){ } resolve(value || ''); };
      const showError = (message)=>{ if(errorNode) errorNode.remove(); errorNode = validationMessage(message); body.insertBefore(errorNode, actions); };
      const save = ()=>{
        const value = text(input.value);
        if(!value){ showError('Wpisz nazwę kategorii.'); return; }
        if(optionExists(options.categories || [], value)){ showError('Taka kategoria już istnieje.'); return; }
        options.categories = addOption(options.categories || [], value);
        data.categories = (Array.isArray(data.categories) ? data.categories.slice() : (options.categories || []).map((opt)=> opt.value).filter(Boolean));
        if(!data.categories.some((name)=> norm(name) === norm(value))) data.categories.push(value);
        try{
          const store = FC.catalogStore;
          if(store && typeof store.saveHardwareCategories === 'function') store.saveHardwareCategories(data.categories);
        }catch(_){ }
        if(typeof onAdded === 'function') onAdded(value);
        cleanup(value);
      };
      function onKey(e){ if(e.key === 'Escape'){ e.preventDefault(); cleanup(''); } if(e.key === 'Enter'){ e.preventDefault(); save(); } }
      closeBtn.addEventListener('click', ()=> cleanup(''));
      cancelBtn.addEventListener('click', ()=> cleanup(''));
      saveBtn.addEventListener('click', save);
      overlay.addEventListener('pointerdown', (e)=>{ if(e.target === overlay) cleanup(''); });
      box.addEventListener('pointerdown', (e)=> e.stopPropagation());
      document.addEventListener('keydown', onKey, true);
      setTimeout(()=>{ try{ input.focus(); }catch(_){ } }, 0);
    });
  }
  function categoryField(title, value, options, data, onChange){
    const wrap = h('div', { class:'form-row' });
    wrap.appendChild(h('label', { text:title }));
    const mount = h('div', { style:'display:grid;gap:8px' });
    let current = text(value);
    const refresh = ()=>{
      mount.innerHTML = '';
      mount.appendChild(appChoiceButton(title, current, options.categories || [], (picked)=>{ current = picked; if(typeof onChange === 'function') onChange(picked); refresh(); }));
      const addBtn = h('button', { type:'button', class:'btn', text:'Dodaj kategorię' });
      addBtn.addEventListener('click', async ()=>{
        const added = await openAddCategoryModal(options, data, (value)=>{ current = value; if(typeof onChange === 'function') onChange(value); });
        if(added) refresh();
      });
      mount.appendChild(addBtn);
    };
    refresh();
    wrap.appendChild(mount);
    return wrap;
  }
  function buildMissingForm(entry, options, data, onDraftChange){
    const supplierApi = FC.hardwareSupplierPriceXlsx || {};
    const supplierDraft = entry.kind === 'supplierPriceCreate' && typeof supplierApi.parseSupplierPriceRow === 'function'
      ? supplierApi.parseSupplierPriceRow(entry.row)
      : null;
    const draft = supplierDraft || Object.assign({}, entry.row || {});
    const form = h('div', { class:'card', style:'padding:10px;margin:10px 0' });
    form.appendChild(h('div', { style:'font-weight:900;margin-bottom:8px', text:'Uzupełnij brakujące pola obowiązkowe' }));
    entry.gaps.forEach((gap)=>{
      if(gap === 'name') form.appendChild(inputField('Nazwa', draft.name, 'text', (value)=>{ draft.name = value; onDraftChange(draft); }));
      if(gap === 'price'){
        form.appendChild(inputField('Cena netto', draft.catalogPriceNet, 'number', (value)=>{ draft.catalogPriceNet = value; onDraftChange(draft); }));
        form.appendChild(inputField('Cena brutto', draft.catalogPriceGross, 'number', (value)=>{ draft.catalogPriceGross = value; onDraftChange(draft); }));
      }
      if(gap === 'manufacturer') form.appendChild(choiceField('Producent', draft.manufacturer, options.manufacturers || [], (value)=>{ draft.manufacturer = value; onDraftChange(draft); }));
      if(gap === 'hardwareCategory') form.appendChild(categoryField('Kategoria', draft.hardwareCategory, options, data, (value)=>{ draft.hardwareCategory = value; onDraftChange(draft); }));
      if(gap === 'hardwareUnit') form.appendChild(choiceField('Jednostka', draft.hardwareUnit, options.units || [], (value)=>{ draft.hardwareUnit = value; onDraftChange(draft); }));
      if(gap === 'itemCategory') form.appendChild(categoryField('Kategoria', draft.itemCategory, options, data, (value)=>{ draft.itemCategory = value; onDraftChange(draft); }));
      if(gap === 'itemUnit') form.appendChild(choiceField('Jednostka', draft.itemUnit, options.units || [], (value)=>{ draft.itemUnit = value; onDraftChange(draft); }));
    });
    return { node:form, draft };
  }
  function missingForDraft(api, entry, draft){
    if(entry && entry.kind === 'supplierPriceCreate'){
      const gaps = [];
      if(!text(draft && draft.itemCategory)) gaps.push('itemCategory');
      if(!text(draft && draft.itemUnit)) gaps.push('itemUnit');
      return gaps;
    }
    return api && api._debug && typeof api._debug.requiredGapsForAccessory === 'function' ? api._debug.requiredGapsForAccessory(draft) : [];
  }
  function applyDraftToEntry(entry, draft){
    if(entry && entry.kind === 'supplierPriceCreate'){
      entry.row.kategoria = text(draft && draft.itemCategory);
      entry.row.jednostka = text(draft && draft.itemUnit);
      entry.row.itemCategory = text(draft && draft.itemCategory);
      entry.row.itemUnit = text(draft && draft.itemUnit);
      return;
    }
    Object.assign(entry.row, draft);
  }
  function getCombinedAccessories(data){
    const s = FC.catalogStore;
    const existing = s && s.getAccessories ? s.getAccessories() : [];
    const imported = Array.isArray(data && data.accessories) ? data.accessories.filter((row)=> !(row && row.__skipImport)) : [];
    return existing.concat(imported);
  }
  function findSupplierPriceCreateGaps(data, options){
    const api = FC.hardwareSupplierPriceXlsx;
    if(!(api && typeof api.supplierPriceCreateRequiredGaps === 'function')) return [];
    const manufacturers = (options && options.manufacturers || []).map((row)=> row && row.value || row && row.label || row).filter(Boolean);
    const suppliers = Array.isArray(data && data.suppliers) && data.suppliers.length ? data.suppliers : (options && options.suppliers || []);
    return api.supplierPriceCreateRequiredGaps(data && data.supplierPriceRows, getCombinedAccessories(data), suppliers, manufacturers).map((entry)=> Object.assign({ kind:'supplierPriceCreate' }, entry));
  }
  function allRequiredEntries(api, data, options){
    const accessoryEntries = api && typeof api.findRequiredGaps === 'function'
      ? api.findRequiredGaps(data).map((entry)=> Object.assign({ kind:'accessory' }, entry))
      : [];
    return accessoryEntries.concat(findSupplierPriceCreateGaps(data, options));
  }
  function resolveMissingRequired(data, mount){
    const api = FC.hardwareCatalogImportExport;
    if(!(api && typeof api.findRequiredGaps === 'function')) return Promise.resolve(data);
    const options = api.getRequiredChoiceOptions ? api.getRequiredChoiceOptions(data) : { manufacturers:[], categories:[], units:[], suppliers:[] };
    options.categories = Array.isArray(options.categories) ? options.categories : [];
    options.units = Array.isArray(options.units) ? options.units : [];
    let entries = allRequiredEntries(api, data, options);
    if(!entries.length) return Promise.resolve(data);
    return new Promise((resolve)=>{
      let currentIndex = 0;
      const render = ()=>{
        entries = allRequiredEntries(api, data, options);
        if(!entries.length){ resolve(data); return; }
        const entry = entries[Math.min(currentIndex, entries.length - 1)];
        let draft = entry.kind === 'supplierPriceCreate' && FC.hardwareSupplierPriceXlsx && typeof FC.hardwareSupplierPriceXlsx.parseSupplierPriceRow === 'function'
          ? FC.hardwareSupplierPriceXlsx.parseSupplierPriceRow(entry.row)
          : Object.assign({}, entry.row || {});
        let errorNode = null;
        mount.innerHTML = '';
        const box = h('div', { class:'card', style:'padding:12px;margin-bottom:10px' });
        box.appendChild(h('div', { style:'font-weight:900;font-size:18px;margin-bottom:4px', text:`Braki w pozycji ${Math.min(currentIndex + 1, entries.length)} z ${entries.length}` }));
        box.appendChild(h('div', { class:'muted-tag xs', text:`Wiersz Excela: ${entry.rowIndex}. Uzupełnij tylko tę pozycję albo ją pomiń.` }));
        const explain = entry.kind === 'supplierPriceCreate'
          ? 'Ta cena ma utworzyć nowe okucie. Wybierz kategorię i jednostkę — program nie wpisuje ich automatycznie.'
          : 'Brakuje: ' + entry.gaps.map(fieldLabel).join(', ');
        box.appendChild(h('div', { style:'margin-top:8px;color:#a40000;font-weight:800', text:explain }));
        box.appendChild(renderSummary(entry));
        const form = buildMissingForm(entry, options, data, (nextDraft)=>{ draft = Object.assign({}, draft, nextDraft); if(errorNode){ errorNode.remove(); errorNode = null; } });
        box.appendChild(form.node);
        const actions = h('div', { style:'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px' });
        const ignoreBtn = h('button', { type:'button', class:'btn btn-danger', text:'Ignoruj' });
        const ignoreAllBtn = h('button', { type:'button', class:'btn btn-danger', text:'Ignoruj wszystko' });
        const applyBtn = h('button', { type:'button', class:'btn btn-success', text:'Zatwierdź' });
        ignoreBtn.addEventListener('click', ()=>{ entry.row.__skipImport = true; currentIndex = 0; render(); });
        ignoreAllBtn.addEventListener('click', ()=>{ entries.forEach((item)=>{ if(item && item.row) item.row.__skipImport = true; }); resolve(data); });
        applyBtn.addEventListener('click', ()=>{
          const missing = missingForDraft(api, entry, draft);
          if(missing.length){
            if(errorNode) errorNode.remove();
            errorNode = validationMessage('Uzupełnij: ' + missing.map(fieldLabel).join(', '));
            box.appendChild(errorNode);
            return;
          }
          applyDraftToEntry(entry, draft);
          currentIndex = 0;
          render();
        });
        actions.appendChild(ignoreBtn); actions.appendChild(ignoreAllBtn); actions.appendChild(applyBtn);
        box.appendChild(actions);
        mount.appendChild(box);
      };
      render();
    });
  }

  FC.priceModalHardwareImportResolver = { resolveMissingRequired };
})();

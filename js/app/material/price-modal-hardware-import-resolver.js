// js/app/material/price-modal-hardware-import-resolver.js
// Uzupełnianie braków obowiązkowych przy imporcie okuć z Excela, pozycja po pozycji.
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
  function fieldLabel(field){
    if(field === 'name') return 'Nazwa';
    if(field === 'price') return 'Cena netto albo brutto';
    if(field === 'manufacturer') return 'Producent';
    if(field === 'hardwareCategory') return 'Kategoria';
    if(field === 'hardwareUnit') return 'Jednostka';
    return field;
  }
  function rowSummary(row){
    return [
      ['Wiersz', row && row.__rowIndex],
      ['Nazwa', row && row.name],
      ['Cena netto', row && row.catalogPriceNet],
      ['Cena brutto', row && row.catalogPriceGross],
      ['Jednostka', row && row.hardwareUnit],
      ['Producent', row && row.manufacturer],
      ['Kategoria', row && row.hardwareCategory],
      ['Symbol', row && row.symbol],
    ].filter((entry)=> text(entry[1]));
  }
  function renderSummary(row){
    const wrap = h('div', { class:'card', style:'padding:10px;margin:10px 0' });
    wrap.appendChild(h('div', { style:'font-weight:900;margin-bottom:8px', text:'Dane wpisane w Excelu' }));
    const grid = h('div', { class:'grid-2', style:'gap:8px' });
    rowSummary(row).forEach((entry)=>{
      const tile = h('div', { class:'list-item', style:'display:block;padding:8px' });
      tile.appendChild(h('div', { class:'muted-tag xs', text:entry[0] }));
      tile.appendChild(h('div', { style:'font-weight:800', text:String(entry[1]) }));
      grid.appendChild(tile);
    });
    wrap.appendChild(grid);
    return wrap;
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
  function buildMissingForm(entry, options, onDraftChange){
    const draft = Object.assign({}, entry.row || {});
    const form = h('div', { class:'card', style:'padding:10px;margin:10px 0' });
    form.appendChild(h('div', { style:'font-weight:900;margin-bottom:8px', text:'Uzupełnij brakujące pola obowiązkowe' }));
    entry.gaps.forEach((gap)=>{
      if(gap === 'name') form.appendChild(inputField('Nazwa', draft.name, 'text', (value)=>{ draft.name = value; onDraftChange(draft); }));
      if(gap === 'price'){
        form.appendChild(inputField('Cena netto', draft.catalogPriceNet, 'number', (value)=>{ draft.catalogPriceNet = value; onDraftChange(draft); }));
        form.appendChild(inputField('Cena brutto', draft.catalogPriceGross, 'number', (value)=>{ draft.catalogPriceGross = value; onDraftChange(draft); }));
      }
      if(gap === 'manufacturer') form.appendChild(choiceField('Producent', draft.manufacturer, options.manufacturers || [], (value)=>{ draft.manufacturer = value; onDraftChange(draft); }));
      if(gap === 'hardwareCategory') form.appendChild(choiceField('Kategoria', draft.hardwareCategory, options.categories || [], (value)=>{ draft.hardwareCategory = value; onDraftChange(draft); }));
      if(gap === 'hardwareUnit') form.appendChild(choiceField('Jednostka', draft.hardwareUnit, options.units || [], (value)=>{ draft.hardwareUnit = value; onDraftChange(draft); }));
    });
    return { node:form, draft };
  }
  function missingForDraft(api, draft){ return api && api._debug && typeof api._debug.requiredGapsForAccessory === 'function' ? api._debug.requiredGapsForAccessory(draft) : []; }
  function resolveMissingRequired(data, mount){
    const api = FC.hardwareCatalogImportExport;
    if(!(api && typeof api.findRequiredGaps === 'function')) return Promise.resolve(data);
    let entries = api.findRequiredGaps(data);
    if(!entries.length) return Promise.resolve(data);
    const options = api.getRequiredChoiceOptions ? api.getRequiredChoiceOptions(data) : { manufacturers:[], categories:[], units:[] };
    return new Promise((resolve)=>{
      let currentIndex = 0;
      const render = ()=>{
        entries = api.findRequiredGaps(data);
        if(!entries.length){ resolve(data); return; }
        const entry = entries[Math.min(currentIndex, entries.length - 1)];
        let draft = Object.assign({}, entry.row || {});
        let errorNode = null;
        mount.innerHTML = '';
        const box = h('div', { class:'card', style:'padding:12px;margin-bottom:10px' });
        box.appendChild(h('div', { style:'font-weight:900;font-size:18px;margin-bottom:4px', text:`Braki w pozycji ${Math.min(currentIndex + 1, entries.length)} z ${entries.length}` }));
        box.appendChild(h('div', { class:'muted-tag xs', text:`Wiersz Excela: ${entry.rowIndex}. Uzupełnij tylko tę pozycję albo ją pomiń.` }));
        box.appendChild(h('div', { style:'margin-top:8px;color:#a40000;font-weight:800', text:'Brakuje: ' + entry.gaps.map(fieldLabel).join(', ') }));
        box.appendChild(renderSummary(entry.row));
        const form = buildMissingForm(entry, options, (nextDraft)=>{ draft = Object.assign({}, draft, nextDraft); if(errorNode){ errorNode.remove(); errorNode = null; } });
        box.appendChild(form.node);
        const actions = h('div', { style:'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px' });
        const ignoreBtn = h('button', { type:'button', class:'btn btn-danger', text:'Ignoruj' });
        const ignoreAllBtn = h('button', { type:'button', class:'btn btn-danger', text:'Ignoruj wszystko' });
        const applyBtn = h('button', { type:'button', class:'btn btn-success', text:'Zatwierdź' });
        ignoreBtn.addEventListener('click', ()=>{ entry.row.__skipImport = true; currentIndex = 0; render(); });
        ignoreAllBtn.addEventListener('click', ()=>{ entries.forEach((item)=>{ if(item && item.row) item.row.__skipImport = true; }); resolve(data); });
        applyBtn.addEventListener('click', ()=>{
          const missing = missingForDraft(api, draft);
          if(missing.length){
            if(errorNode) errorNode.remove();
            errorNode = validationMessage('Uzupełnij: ' + missing.map(fieldLabel).join(', '));
            box.appendChild(errorNode);
            return;
          }
          Object.assign(entry.row, draft);
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

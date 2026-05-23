// js/app/material/price-modal-hardware-dictionaries.js
// Edytowalne słowniki kategorii okuć i dynamicznych parametrów technicznych per kategoria.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  function text(value){ return String(value == null ? '' : value).trim(); }
  function store(){ return ctx.catalogStore && ctx.catalogStore(); }
  function tech(){ return FC.hardwareTechnicalParams || {}; }
  function h(tag, attrs, children){
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach((key)=>{
      const value = attrs[key];
      if(key === 'class') el.className = value;
      else if(key === 'text') el.textContent = value;
      else if(key === 'html') el.innerHTML = value;
      else if(key === 'style') el.setAttribute('style', String(value));
      else if(key === 'checked') el.checked = !!value;
      else if(key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if(value !== false && value != null) el.setAttribute(key, value === true ? '' : String(value));
    });
    (Array.isArray(children) ? children : (children ? [children] : [])).forEach((child)=> el.appendChild(child));
    return el;
  }
  function uid(prefix){ try{ return FC.utils && FC.utils.uid ? FC.utils.uid() : ((prefix || 'id') + '_' + Date.now()); }catch(_){ return (prefix || 'id') + '_' + Date.now(); } }
  function normalizeCategories(list){ const hw = FC.hardwareCatalog || {}; return hw.normalizeCategoryList ? hw.normalizeCategoryList(list || []) : Array.from(new Set((list || []).map(text).filter(Boolean))); }
  function getCategories(){ const s = store(); return s && s.getHardwareCategories ? s.getHardwareCategories() : normalizeCategories([]); }
  function saveCategories(list){ const s = store(); return s && s.saveHardwareCategories ? s.saveHardwareCategories(list) : list; }
  function getTypes(){ const s = store(); return s && s.getHardwareTypes ? s.getHardwareTypes() : []; }
  function saveTypes(list){ const s = store(); return s && s.saveHardwareTypes ? s.saveHardwareTypes(list) : list; }
  function getParams(){ const s = store(); return s && s.getHardwareTechnicalParams ? s.getHardwareTechnicalParams() : (tech().DEFAULT_DEFINITIONS || []); }
  function saveParams(list){ const s = store(); return s && s.saveHardwareTechnicalParams ? s.saveHardwareTechnicalParams(list) : list; }
  function saveAccessories(list){ const s = store(); return s && s.savePriceList ? s.savePriceList('accessories', list) : list; }
  function getAccessories(){ const s = store(); return s && s.getAccessories ? s.getAccessories() : []; }
  function normalizeParams(list, categories){ return tech().normalizeDefinitions ? tech().normalizeDefinitions(list, categories) : (Array.isArray(list) ? list : []); }
  function safeKey(value){ return tech().safeKey ? tech().safeKey(value) : text(value).toLowerCase().replace(/[^a-z0-9]+/g, '_'); }
  function cloneParams(list){ return (Array.isArray(list) ? list : []).map((row)=> Object.assign({}, row || {}, { options:Array.isArray(row && row.options) ? row.options.slice() : [] })); }
  function signature(categories, params){
    const cleanCategories = normalizeCategories(categories);
    const cleanParams = normalizeParams(params, cleanCategories).map((row)=>({ category:text(row.category), key:text(row.key), label:text(row.label), fieldType:text(row.fieldType), unit:text(row.unit), options:(row.options || []).map(text), keyFeature:!!row.keyFeature, typePart:!!row.typePart, compareMode:text(row.compareMode), active:row.active !== false, order:Number(row.order) || 0 }));
    return JSON.stringify({ categories:cleanCategories, params:cleanParams });
  }
  function openHelp(title, key){
    const help = tech().FIELD_HELP || {};
    const message = help[key] || '';
    try{
      if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title:title || 'Informacja', message });
      else if(FC.panelBox && typeof FC.panelBox.open === 'function') FC.panelBox.open({ title:title || 'Informacja', message, width:'560px', boxClass:'panel-box--rozrys' });
    }catch(_){ }
  }
  function helpLabel(textLabel, helpKey){
    const row = h('div', { class:'label-help price-field-help' }, [h('span', { class:'label-help__text', text:textLabel || '' })]);
    if((tech().FIELD_HELP || {})[helpKey]){
      const btn = h('button', { type:'button', class:'info-trigger', 'aria-label':'Pomoc: ' + textLabel });
      btn.addEventListener('click', ()=> openHelp(textLabel, helpKey));
      row.appendChild(btn);
    }
    return row;
  }
  function cycleButton(options, value, onChange){
    const opts = Array.isArray(options) && options.length ? options : [];
    const btn = h('button', { type:'button', class:'btn hardware-cycle-btn' });
    function current(){ return opts.find((row)=> row.value === value) || opts[0] || { value:'', label:'—' }; }
    function render(){ const item = current(); btn.textContent = item.label || item.value || '—'; btn.dataset.value = item.value || ''; }
    btn.addEventListener('click', ()=>{
      const idx = Math.max(0, opts.findIndex((row)=> row.value === value));
      value = (opts[(idx + 1) % opts.length] || {}).value || '';
      render();
      onChange(value);
    });
    render();
    return btn;
  }
  function optionLabel(options, value, fallback){
    const row = (Array.isArray(options) ? options : []).find((item)=> item && item.value === value);
    return text(row && row.label) || text(value) || text(fallback) || '—';
  }
  function paramSummaryParts(item){
    const parts = [];
    parts.push(optionLabel(tech().DEFAULT_FIELD_TYPES || [], item.fieldType || 'text', 'Tekst / wybór'));
    parts.push(optionLabel(tech().DEFAULT_COMPARE_MODES || [], item.compareMode || 'equal', 'Dokładnie taka sama wartość'));
    if(item.keyFeature !== false) parts.push('kluczowa');
    if(item.typePart !== false) parts.push('buduje typ');
    if(item.active === false) parts.push('nieaktywna');
    const optionsCount = Array.isArray(item.options) ? item.options.length : 0;
    if(optionsCount > 0) parts.push(optionsCount + ' wartości');
    return parts;
  }
  const PARAM_EXPAND_MS = 420;
  const PARAM_COLLAPSE_MS = 260;
  function prefersReducedMotion(){
    try{ return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){ return false; }
  }
  function paramAccordionBody(node){
    return node && node.querySelector ? node.querySelector(':scope > .hardware-tech-param-row') : null;
  }
  function clearParamAccordionTimer(node){
    if(!node) return;
    if(node._fcParamAccordionTimer){
      clearTimeout(node._fcParamAccordionTimer);
      node._fcParamAccordionTimer = null;
    }
  }
  function resetParamAccordionAnimation(node){
    if(!node) return;
    clearParamAccordionTimer(node);
    node.classList.remove('hardware-param-animating', 'hardware-param-opening', 'hardware-param-closing');
    const body = paramAccordionBody(node);
    if(body){
      body.style.maxHeight = '';
      body.style.opacity = '';
      body.style.transform = '';
      body.style.overflow = '';
    }
  }
  function animateParamOpen(node, done){
    if(!node){ if(typeof done === 'function') done(); return; }
    const body = paramAccordionBody(node);
    if(prefersReducedMotion() || !body){
      resetParamAccordionAnimation(node);
      node.open = true;
      if(typeof done === 'function') afterDictionaryLayout(done);
      return;
    }
    resetParamAccordionAnimation(node);
    node.open = true;
    node.classList.add('hardware-param-animating', 'hardware-param-opening');
    body.style.overflow = 'hidden';
    body.style.maxHeight = '0px';
    body.style.opacity = '0';
    body.style.transform = 'translateY(-4px)';
    try{ void body.offsetHeight; }catch(_){ }
    const targetHeight = Math.max(1, body.scrollHeight || 1);
    const frame = typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (cb)=> setTimeout(cb, 0);
    frame(()=> frame(()=>{
      body.style.maxHeight = targetHeight + 'px';
      body.style.opacity = '1';
      body.style.transform = 'translateY(0)';
    }));
    node._fcParamAccordionTimer = setTimeout(()=>{
      resetParamAccordionAnimation(node);
      node.open = true;
      if(typeof done === 'function') done();
    }, PARAM_EXPAND_MS + 30);
  }
  function animateParamClose(node, done){
    if(!node){ if(typeof done === 'function') done(); return; }
    const body = paramAccordionBody(node);
    if(prefersReducedMotion() || !body || !node.open){
      resetParamAccordionAnimation(node);
      node.open = false;
      if(typeof done === 'function') done();
      return;
    }
    resetParamAccordionAnimation(node);
    node.open = true;
    node.classList.add('hardware-param-animating', 'hardware-param-closing');
    body.style.overflow = 'hidden';
    body.style.maxHeight = Math.max(1, body.scrollHeight || 1) + 'px';
    body.style.opacity = '1';
    body.style.transform = 'translateY(0)';
    try{ void body.offsetHeight; }catch(_){ }
    const frame = typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (cb)=> setTimeout(cb, 0);
    frame(()=> frame(()=>{
      body.style.maxHeight = '0px';
      body.style.opacity = '0';
      body.style.transform = 'translateY(-4px)';
    }));
    node._fcParamAccordionTimer = setTimeout(()=>{
      node.open = false;
      resetParamAccordionAnimation(node);
      if(typeof done === 'function') done();
    }, PARAM_COLLAPSE_MS + 30);
  }
  function categoryRenameMap(oldCategories, newCategories){
    const map = new Map();
    (Array.isArray(oldCategories) ? oldCategories : []).forEach((oldCat, index)=>{
      const oldName = text(oldCat); const nextName = text((newCategories || [])[index]);
      if(oldName && nextName && oldName !== nextName) map.set(oldName, nextName);
    });
    return map;
  }
  function applyCategoryRenames(oldCategories, newCategories, params){
    const map = categoryRenameMap(oldCategories, newCategories);
    if(!map.size) return { params, changed:0 };
    let changed = 0;
    const nextParams = params.map((row)=> map.has(text(row.category)) ? Object.assign({}, row, { category:map.get(text(row.category)) }) : row);
    const nextAccessories = getAccessories().map((item)=>{
      const out = Object.assign({}, item || {});
      if(map.has(text(out.hardwareCategory))){ out.hardwareCategory = map.get(text(out.hardwareCategory)); changed += 1; }
      return out;
    });
    if(changed > 0) saveAccessories(nextAccessories);
    return { params:nextParams, changed };
  }

  function categoryRow(value, index, onChange){
    const row = h('div', { class:'hardware-dictionary-row' });
    const input = h('input', { class:'investor-form-input', value:value || '', placeholder:'np. Zawiasy' });
    input.addEventListener('input', ()=> onChange(index, input.value, false, false));
    input.addEventListener('change', ()=> onChange(index, input.value, false, true));
    const remove = h('button', { type:'button', class:'btn btn-danger', text:'Usuń' });
    remove.addEventListener('click', ()=> onChange(index, null, true, true));
    row.appendChild(h('div', { class:'hardware-supplier-field' }, [helpLabel('Kategoria / rodzaj okucia', 'name'), input]));
    row.appendChild(remove);
    return row;
  }
  function parameterRow(field, onChange, onRemove, cfg){
    const item = Object.assign({ id:uid('hwp'), category:'', key:'', label:'', fieldType:'text', unit:'', options:[], keyFeature:true, typePart:true, compareMode:'equal', active:true, order:10 }, field || {});
    const detailsAttrs = { class:'hardware-tech-param-accordion', 'data-param-id':item.id || '' };
    if(cfg && cfg.open) detailsAttrs.open = true;
    const row = h('details', detailsAttrs);
    const title = h('span', { class:'hardware-tech-param-summary__title', text:item.label || 'Nowy parametr' });
    const meta = h('span', { class:'hardware-tech-param-summary__meta', text:paramSummaryParts(item).join(' • ') });
    const summary = h('summary', { class:'hardware-tech-param-summary' }, [
      h('span', { class:'hardware-tech-param-summary__text' }, [title, meta])
    ]);
    const body = h('div', { class:'hardware-tech-param-row' });
    function refreshSummary(){
      title.textContent = text(item.label) || 'Nowy parametr';
      meta.textContent = paramSummaryParts(item).join(' • ');
    }
    const label = h('input', { class:'investor-form-input', value:item.label || '', placeholder:'np. Kąt otwarcia' });
    const key = h('input', { class:'investor-form-input', value:item.key || '', placeholder:'np. kat_otwarcia' });
    const unit = h('input', { class:'investor-form-input', value:item.unit || '', placeholder:'mm / kg / °' });
    const options = h('input', { class:'investor-form-input', value:(item.options || []).join('; '), placeholder:'np. M; N; H albo lewa; prawa; uniwersalna' });
    const fieldType = cycleButton(tech().DEFAULT_FIELD_TYPES || [], item.fieldType || 'text', (value)=>{ item.fieldType = value; refreshSummary(); onChange(item); });
    const compare = cycleButton(tech().DEFAULT_COMPARE_MODES || [], item.compareMode || 'equal', (value)=>{ item.compareMode = value; refreshSummary(); onChange(item); });
    const keyFeature = h('label', { class:'rozrys-scope-chip price-labor-toggle' }, [h('input', { type:'checkbox', checked:item.keyFeature !== false }), h('span', { text:'Cecha kluczowa' })]);
    const typePart = h('label', { class:'rozrys-scope-chip price-labor-toggle' }, [h('input', { type:'checkbox', checked:item.typePart !== false }), h('span', { text:'Buduje typ' })]);
    const active = h('label', { class:'rozrys-scope-chip price-labor-toggle' }, [h('input', { type:'checkbox', checked:item.active !== false }), h('span', { text:'Aktywna' })]);
    label.addEventListener('input', ()=>{ item.label = label.value; if(!key.value.trim()) item.key = safeKey(label.value); refreshSummary(); onChange(item); });
    key.addEventListener('input', ()=>{ item.key = safeKey(key.value); onChange(item); });
    unit.addEventListener('input', ()=>{ item.unit = unit.value; onChange(item); });
    options.addEventListener('input', ()=>{ item.options = options.value.split(/[;|]/).map(text).filter(Boolean); refreshSummary(); onChange(item); });
    keyFeature.querySelector('input').addEventListener('change', (e)=>{ item.keyFeature = !!e.target.checked; if(item.typePart == null) item.typePart = item.keyFeature; refreshSummary(); onChange(item); });
    typePart.querySelector('input').addEventListener('change', (e)=>{ item.typePart = !!e.target.checked; refreshSummary(); onChange(item); });
    active.querySelector('input').addEventListener('change', (e)=>{ item.active = !!e.target.checked; refreshSummary(); onChange(item); });
    const remove = h('button', { type:'button', class:'btn btn-danger', text:'Usuń parametr' });
    remove.addEventListener('click', ()=> onRemove(item));
    body.appendChild(h('div', { class:'grid-2' }, [h('div', {}, [helpLabel('Nazwa parametru', 'name'), label]), h('div', {}, [helpLabel('Klucz Excel', 'key'), key])]));
    body.appendChild(h('div', { class:'grid-3', style:'margin-top:8px' }, [h('div', {}, [helpLabel('Typ pola', 'fieldType'), fieldType]), h('div', {}, [helpLabel('Jednostka', 'unit'), unit]), h('div', {}, [helpLabel('Sposób porównania', 'compareMode'), compare])]));
    body.appendChild(h('div', { style:'margin-top:8px' }, [helpLabel('Dozwolone wartości', 'options'), options]));
    body.appendChild(h('div', { class:'hardware-type-categories', style:'margin-top:8px' }, [keyFeature, typePart, active]));
    body.appendChild(remove);
    refreshSummary();
    row.appendChild(summary);
    row.appendChild(body);
    return row;
  }
  function dictionaryScrollerFor(node){
    return node && node.closest ? node.closest('.hardware-dictionary-scroll, .panel-box-form__scroll') : null;
  }
  function clampScrollTop(scroller, value){
    const maxTop = Math.max(0, Number(scroller && scroller.scrollHeight || 0) - Number(scroller && scroller.clientHeight || 0));
    const top = Number(value);
    if(!Number.isFinite(top)) return 0;
    return maxTop > 0 ? Math.max(0, Math.min(maxTop, top)) : Math.max(0, top);
  }
  function afterDictionaryLayout(fn){
    const win = typeof window !== 'undefined' ? window : {};
    const frame = typeof win.requestAnimationFrame === 'function' ? win.requestAnimationFrame.bind(win) : (cb)=> setTimeout(cb, 0);
    frame(()=> setTimeout(()=> frame(fn), 35));
  }
  function preserveActiveParamPosition(activeNode, mutate){
    const scroller = dictionaryScrollerFor(activeNode);
    if(!scroller || typeof scroller.scrollTop !== 'number' || typeof activeNode.getBoundingClientRect !== 'function') {
      mutate();
      return;
    }
    let beforeTop = 0;
    try{ beforeTop = activeNode.getBoundingClientRect().top; }catch(_){ beforeTop = 0; }
    mutate();
    try{
      const afterTop = activeNode.getBoundingClientRect().top;
      const delta = afterTop - beforeTop;
      if(Number.isFinite(delta) && Math.abs(delta) > 1){
        scroller.scrollTop = clampScrollTop(scroller, scroller.scrollTop + delta);
      }
    }catch(_){ }
  }
  function targetScrollTopForParam(scroller, node){
    if(!scroller || !node || typeof scroller.scrollTop !== 'number' || typeof node.getBoundingClientRect !== 'function' || typeof scroller.getBoundingClientRect !== 'function') return null;
    const nodeRect = node.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const topGap = 16;
    return clampScrollTop(scroller, scroller.scrollTop + (nodeRect.top - scrollerRect.top) - topGap);
  }
  function waitForParamScroll(scroller, fallbackMs, done){
    let finished = false;
    function finish(){
      if(finished) return;
      finished = true;
      try{ scroller && scroller.removeEventListener && scroller.removeEventListener('scrollend', finish); }catch(_){ }
      done();
    }
    try{ scroller && scroller.addEventListener && scroller.addEventListener('scrollend', finish, { once:true }); }catch(_){ }
    setTimeout(finish, fallbackMs || 420);
  }
  function scrollParamHeaderBeforeToggle(node, afterScroll){
    if(!node){ afterScroll(); return; }
    try{
      const scroller = dictionaryScrollerFor(node);
      const nextTop = targetScrollTopForParam(scroller, node);
      if(scroller && typeof scroller.scrollTop === 'number' && Number.isFinite(nextTop)){
        const distance = Math.abs(nextTop - scroller.scrollTop);
        if(distance < 4){
          afterDictionaryLayout(afterScroll);
          return;
        }
        if(typeof scroller.scrollTo === 'function') scroller.scrollTo({ top:nextTop, behavior:'smooth' });
        else scroller.scrollTop = nextTop;
        waitForParamScroll(scroller, Math.min(680, Math.max(280, distance * 0.55)), ()=> afterDictionaryLayout(afterScroll));
        return;
      }
      if(typeof node.scrollIntoView === 'function'){
        node.scrollIntoView({ block:'start', behavior:'smooth' });
        setTimeout(()=> afterDictionaryLayout(afterScroll), 360);
        return;
      }
    }catch(_){ }
    afterDictionaryLayout(afterScroll);
  }
  function alignParamHeaderAfterToggle(node){
    afterDictionaryLayout(()=>{
      try{
        const scroller = dictionaryScrollerFor(node);
        const nextTop = targetScrollTopForParam(scroller, node);
        if(!scroller || !Number.isFinite(nextTop)) return;
        if(Math.abs(nextTop - scroller.scrollTop) > 10){
          scroller.scrollTop = nextTop;
        }
      }catch(_){ }
    });
  }
  function scrollParamAccordionIntoView(node){
    if(!node) return;
    scrollParamHeaderBeforeToggle(node, ()=> alignParamHeaderAfterToggle(node));
  }
  function categoryAccordion(cat, params, onChange){
    const box = h('details', { class:'hardware-tech-category-accordion' });
    const summary = h('summary', { class:'hardware-tech-category-summary' }, [h('span', { text:cat || 'Bez kategorii' })]);
    box.appendChild(summary);
    const list = h('div', { class:'hardware-tech-param-list' });
    let openParamId = '';
    let closingPeerAccordions = false;
    let paramOpenSequence = 0;
    function rows(){ return params.filter((row)=> text(row.category) === text(cat)); }
    function closePeerAccordions(activeNode){
      Array.from(list.querySelectorAll(':scope > .hardware-tech-param-accordion')).forEach((node)=>{
        if(node !== activeNode && node.open) animateParamClose(node, ()=> alignParamHeaderAfterToggle(activeNode));
      });
    }
    function renderRows(){
      list.innerHTML = '';
      rows().sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)).forEach((param)=>{
        const node = parameterRow(param, (updated)=>{ Object.assign(param, updated, { category:cat }); onChange(); }, ()=>{
          const idx = params.indexOf(param);
          if(idx >= 0) params.splice(idx, 1);
          if(openParamId === param.id) openParamId = '';
          renderRows();
          onChange();
        }, { open:openParamId && openParamId === param.id });
        const paramSummary = node.querySelector(':scope > .hardware-tech-param-summary');
        if(paramSummary){
          paramSummary.addEventListener('click', (event)=>{
            event.preventDefault();
            const nextOpenId = param.id || '';
            paramOpenSequence += 1;
            const sequence = paramOpenSequence;
            if(node.open){
              animateParamClose(node);
              if(openParamId === nextOpenId) openParamId = '';
              return;
            }
            // Najpierw płynnie dojedź do zwiniętego nagłówka. Dopiero potem zwijaj poprzedni
            // parametr i rozwijaj nowy, żeby zamykanie długiego bloku nie szarpało startu ruchu.
            scrollParamHeaderBeforeToggle(node, ()=>{
              if(sequence !== paramOpenSequence) return;
              closingPeerAccordions = true;
              preserveActiveParamPosition(node, ()=>{
                closePeerAccordions(node);
                animateParamOpen(node, ()=> alignParamHeaderAfterToggle(node));
              });
              closingPeerAccordions = false;
              openParamId = nextOpenId;
              setTimeout(()=> alignParamHeaderAfterToggle(node), PARAM_EXPAND_MS + PARAM_COLLAPSE_MS + 80);
            });
          });
        }
        list.appendChild(node);
      });
    }
    const add = h('button', { type:'button', class:'btn hardware-tech-add-param-btn', text:'Dodaj parametr' });
    add.addEventListener('click', ()=>{
      const row = { id:uid('hwp'), category:cat, key:'', label:'', fieldType:'text', unit:'', options:[], keyFeature:true, typePart:true, compareMode:'equal', active:true, order:(rows().length + 1) * 10 };
      params.push(row);
      openParamId = row.id;
      renderRows();
      scrollParamAccordionIntoView(list.querySelector('[data-param-id="' + row.id + '"]'));
      onChange();
    });
    renderRows();
    box.appendChild(list); box.appendChild(add);
    return box;
  }

  function openHardwareDictionariesModal(){
    let categories = getCategories().slice();
    let params = cloneParams(getParams());
    const originalCategories = categories.slice();
    const originalTypes = getTypes();
    let cleanSignature = signature(categories, params);
    const body = h('div', { class:'panel-box-form hardware-dictionary-form' });
    const scroll = h('div', { class:'panel-box-form__scroll hardware-dictionary-scroll' });
    const catList = h('div', { class:'hardware-dictionary-list hardware-dictionary-category-list' });
    const paramList = h('div', { class:'hardware-dictionary-list hardware-dictionary-param-list' });
    const exit = h('button', { type:'button', class:'btn', text:'Wyjdź' });
    const cancel = h('button', { type:'button', class:'btn btn-danger', text:'Anuluj' });
    const save = h('button', { type:'button', class:'btn btn-success', text:'Zapisz' });
    function isDirty(){ return signature(categories, params) !== cleanSignature; }
    function updateActions(){ const dirty = isDirty(); exit.style.display = dirty ? 'none' : ''; cancel.style.display = dirty ? '' : 'none'; save.style.display = dirty ? '' : 'none'; }
    function render(){
      catList.innerHTML = '';
      categories.forEach((cat, index)=> catList.appendChild(categoryRow(cat, index, (i, value, remove, refresh)=>{
        if(remove){ categories.splice(i, 1); render(); return; }
        categories[i] = value;
        if(refresh) render(); else updateActions();
      })));
      paramList.innerHTML = '';
      normalizeCategories(categories).forEach((cat)=> paramList.appendChild(categoryAccordion(cat, params, updateActions)));
      updateActions();
    }
    const addCat = h('button', { type:'button', class:'btn', text:'Dodaj kategorię' });
    addCat.addEventListener('click', ()=>{ categories.push(''); render(); });
    exit.addEventListener('click', ()=>{ try{ FC.panelBox.close(); }catch(_){ } });
    cancel.addEventListener('click', ()=>{ try{ FC.panelBox.close(); }catch(_){ } });
    save.addEventListener('click', ()=>{
      const cleanCategories = normalizeCategories(categories);
      const renamed = applyCategoryRenames(originalCategories, cleanCategories, params);
      const cleanParams = normalizeParams(renamed.params, cleanCategories);
      saveCategories(cleanCategories);
      saveParams(cleanParams);
      // Legacy słownik typów zostaje zapisany bez zmiany, żeby starsze importy i filtry działały.
      saveTypes(originalTypes || []);
      categories = cleanCategories.slice();
      params = cloneParams(cleanParams);
      cleanSignature = signature(categories, params);
      try{ if(ctx.renderPriceModal) ctx.renderPriceModal(); }catch(_){ }
      try{ FC.panelBox.close(); }catch(_){ }
    });
    scroll.appendChild(h('div', { class:'quote-subsection-title', text:'Kategorie / rodzaje okuć' }));
    scroll.appendChild(catList);
    scroll.appendChild(addCat);
    scroll.appendChild(h('div', { class:'quote-subsection-title', text:'Parametry techniczne kategorii', style:'margin-top:14px' }));
    scroll.appendChild(paramList);
    body.appendChild(scroll);
    body.appendChild(h('div', { class:'panel-box-form__footer hardware-supplier-actions hardware-dictionary-actions' }, [exit, cancel, save]));
    render();
    FC.panelBox.open({ title:'Słowniki okuć', contentNode:body, width:'900px', boxClass:'panel-box--rozrys hardware-dictionary-panel', dismissOnOverlay:false, dismissOnEsc:true });
  }

  ctx.openHardwareDictionariesModal = openHardwareDictionariesModal;
  FC.priceModalHardwareDictionaries = { open:openHardwareDictionariesModal, _debug:{ applyCategoryRenames, signature } };
})();

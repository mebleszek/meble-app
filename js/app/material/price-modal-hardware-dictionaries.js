// js/app/material/price-modal-hardware-dictionaries.js
// Edytowalne słowniki kategorii okuć oraz typów/cech technicznych.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  function text(value){ return String(value == null ? '' : value).trim(); }
  function store(){ return ctx.catalogStore && ctx.catalogStore(); }
  function h(tag, attrs, children){
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach((key)=>{
      const value = attrs[key];
      if(key === 'class') el.className = value;
      else if(key === 'text') el.textContent = value;
      else if(key === 'html') el.innerHTML = value;
      else if(key === 'style') el.setAttribute('style', String(value));
      else if(key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if(value !== false && value != null) el.setAttribute(key, value === true ? '' : String(value));
    });
    (Array.isArray(children) ? children : (children ? [children] : [])).forEach((child)=> el.appendChild(child));
    return el;
  }
  function uid(prefix){
    try{ return FC.utils && FC.utils.uid ? FC.utils.uid() : ((prefix || 'id') + '_' + Date.now()); }
    catch(_){ return (prefix || 'id') + '_' + Date.now(); }
  }
  function cloneType(row){
    return Object.assign({ id:uid('hwt'), name:'', allowedCategories:[], active:true }, row || {}, {
      allowedCategories:Array.isArray(row && row.allowedCategories) ? row.allowedCategories.slice() : [],
      active:(row && row.active) !== false,
    });
  }
  function cloneTypes(list){ return (Array.isArray(list) ? list : []).map(cloneType); }
  function normalizeCategories(list){
    const hw = FC.hardwareCatalog || {};
    return hw.normalizeCategoryList ? hw.normalizeCategoryList(list || []) : Array.from(new Set((list || []).map(text).filter(Boolean)));
  }
  function normalizeTypes(list){
    const hw = FC.hardwareCatalog || {};
    return hw.normalizeTypeList ? hw.normalizeTypeList(list || []) : (Array.isArray(list) ? list : []);
  }
  function cleanTypesForCategories(types, categories){
    return normalizeTypes(cloneTypes(types).map((row)=> Object.assign({}, row, {
      allowedCategories:(row.allowedCategories || []).filter((cat)=> categories.includes(text(cat)))
    })));
  }
  function getCategories(){ const s = store(); return s && s.getHardwareCategories ? s.getHardwareCategories() : normalizeCategories([]); }
  function getTypes(){ const s = store(); return s && s.getHardwareTypes ? s.getHardwareTypes() : normalizeTypes([]); }
  function saveCategories(list){ const s = store(); return s && s.saveHardwareCategories ? s.saveHardwareCategories(list) : list; }
  function saveTypes(list){ const s = store(); return s && s.saveHardwareTypes ? s.saveHardwareTypes(list) : list; }
  function saveAccessories(list){ const s = store(); return s && s.savePriceList ? s.savePriceList('accessories', list) : list; }
  function getAccessories(){ const s = store(); return s && s.getAccessories ? s.getAccessories() : []; }
  function signature(categories, types){
    const cleanCategories = normalizeCategories(categories);
    const cleanTypes = cleanTypesForCategories(types, cleanCategories);
    return JSON.stringify({ categories:cleanCategories, types:cleanTypes.map((row)=>({ id:text(row.id), name:text(row.name), active:row.active !== false, allowedCategories:(row.allowedCategories || []).map(text).filter(Boolean) })) });
  }
  function typeRenameMap(oldTypes, newTypes){
    const map = new Map();
    const oldById = new Map();
    cloneTypes(oldTypes).forEach((row)=>{ if(text(row.id)) oldById.set(text(row.id), row); });
    cloneTypes(newTypes).forEach((row, index)=>{
      const old = (text(row.id) && oldById.get(text(row.id))) || cloneTypes(oldTypes)[index];
      const oldName = text(old && old.name);
      const nextName = text(row && row.name);
      if(oldName && nextName && oldName !== nextName) map.set(oldName, nextName);
    });
    return map;
  }
  function categoryRenameMap(oldCategories, newCategories){
    const map = new Map();
    (Array.isArray(oldCategories) ? oldCategories : []).forEach((oldCat, index)=>{
      const oldName = text(oldCat);
      const nextName = text((newCategories || [])[index]);
      if(oldName && nextName && oldName !== nextName) map.set(oldName, nextName);
    });
    return map;
  }
  function applyDictionaryRenames(oldCategories, newCategories, oldTypes, newTypes){
    const catMap = categoryRenameMap(oldCategories, newCategories);
    const typeMap = typeRenameMap(oldTypes, newTypes);
    if(!catMap.size && !typeMap.size) return 0;
    let changed = 0;
    const next = getAccessories().map((item)=>{
      const out = Object.assign({}, item || {});
      if(catMap.has(text(out.hardwareCategory))){ out.hardwareCategory = catMap.get(text(out.hardwareCategory)); changed += 1; }
      if(typeMap.has(text(out.hardwareType))){ out.hardwareType = typeMap.get(text(out.hardwareType)); changed += 1; }
      return out;
    });
    if(changed > 0) saveAccessories(next);
    return changed;
  }

  function categoryRow(value, index, onChange){
    const row = h('div', { class:'hardware-dictionary-row' });
    const input = h('input', { class:'investor-form-input', value:value || '', placeholder:'np. Zawiasy' });
    input.addEventListener('input', ()=> onChange(index, input.value, false, false));
    input.addEventListener('change', ()=> onChange(index, input.value, false, true));
    const remove = h('button', { type:'button', class:'btn btn-danger', text:'Usuń' });
    remove.addEventListener('click', ()=> onChange(index, null, true, true));
    row.appendChild(h('div', { class:'hardware-supplier-field' }, [h('label', { text:'Kategoria / rodzaj okucia' }), input]));
    row.appendChild(remove);
    return row;
  }

  function typeRow(rowData, index, categories, onChange){
    const item = cloneType(rowData);
    const row = h('div', { class:'hardware-type-row' });
    const name = h('input', { class:'investor-form-input', value:item.name || '', placeholder:'np. 110° nakładany' });
    name.addEventListener('input', ()=>{ item.name = name.value; onChange(index, item, false, false); });
    const active = h('label', { class:'rozrys-scope-chip price-labor-toggle hardware-type-active' }, [
      h('input', { type:'checkbox', checked:item.active !== false ? true : false }),
      h('span', { text:'Aktywny' })
    ]);
    const activeInput = active.querySelector('input');
    activeInput.addEventListener('change', ()=>{ item.active = !!activeInput.checked; onChange(index, item, false, false); });
    const cats = h('div', { class:'hardware-type-categories' });
    categories.forEach((cat)=>{
      const checked = !item.allowedCategories || !item.allowedCategories.length ? false : item.allowedCategories.map(text).includes(text(cat));
      const chip = h('label', { class:'rozrys-scope-chip price-labor-toggle hardware-type-category' }, [
        h('input', { type:'checkbox', checked:checked ? true : false }),
        h('span', { text:cat })
      ]);
      const input = chip.querySelector('input');
      input.addEventListener('change', ()=>{
        const set = new Set((item.allowedCategories || []).map(text).filter(Boolean));
        if(input.checked) set.add(cat); else set.delete(cat);
        item.allowedCategories = Array.from(set);
        onChange(index, item, false, false);
      });
      cats.appendChild(chip);
    });
    const remove = h('button', { type:'button', class:'btn btn-danger', text:'Usuń' });
    remove.addEventListener('click', ()=> onChange(index, null, true, true));
    row.appendChild(h('div', { class:'hardware-supplier-field' }, [h('label', { text:'Typ / cecha' }), name]));
    row.appendChild(h('div', { class:'hardware-supplier-field' }, [h('label', { text:'Dostępne dla kategorii' }), cats]));
    row.appendChild(active);
    row.appendChild(remove);
    return row;
  }

  function openHardwareDictionariesModal(){
    let categories = getCategories().slice();
    let types = cloneTypes(getTypes());
    const originalCategories = categories.slice();
    const originalTypes = cloneTypes(types);
    let cleanSignature = signature(categories, types);
    const body = h('div', { class:'panel-box-form hardware-dictionary-form' });
    const catList = h('div', { class:'hardware-dictionary-list' });
    const typeList = h('div', { class:'hardware-dictionary-list' });
    const exit = h('button', { type:'button', class:'btn', text:'Wyjdź' });
    const cancel = h('button', { type:'button', class:'btn btn-danger', text:'Anuluj' });
    const save = h('button', { type:'button', class:'btn btn-success', text:'Zapisz' });
    function isDirty(){ return signature(categories, types) !== cleanSignature; }
    function updateActions(){
      const dirty = isDirty();
      exit.style.display = dirty ? 'none' : '';
      cancel.style.display = dirty ? '' : 'none';
      save.style.display = dirty ? '' : 'none';
    }
    function render(){
      catList.innerHTML = '';
      categories.forEach((cat, index)=> catList.appendChild(categoryRow(cat, index, (i, value, remove, refresh)=>{
        if(remove){ categories.splice(i, 1); render(); return; }
        categories[i] = value;
        if(refresh) render(); else updateActions();
      })));
      typeList.innerHTML = '';
      types.forEach((row, index)=> typeList.appendChild(typeRow(row, index, categories, (i, value, remove, refresh)=>{
        if(remove){ types.splice(i, 1); render(); return; }
        types[i] = cloneType(value);
        if(refresh) render(); else updateActions();
      })));
      updateActions();
    }
    const addCat = h('button', { type:'button', class:'btn', text:'Dodaj kategorię' });
    addCat.addEventListener('click', ()=>{ categories.push(''); render(); });
    const addType = h('button', { type:'button', class:'btn', text:'Dodaj typ / cechę' });
    addType.addEventListener('click', ()=>{ types.push({ id:uid('hwt'), name:'', allowedCategories:[], active:true }); render(); });
    exit.addEventListener('click', ()=>{ try{ FC.panelBox.close(); }catch(_){ } });
    cancel.addEventListener('click', ()=>{ try{ FC.panelBox.close(); }catch(_){ } });
    save.addEventListener('click', ()=>{
      const cleanCategories = normalizeCategories(categories);
      const cleanTypes = cleanTypesForCategories(types, cleanCategories);
      saveCategories(cleanCategories);
      saveTypes(cleanTypes);
      applyDictionaryRenames(originalCategories, cleanCategories, originalTypes, cleanTypes);
      categories = cleanCategories.slice();
      types = cloneTypes(cleanTypes);
      cleanSignature = signature(categories, types);
      try{ if(ctx.renderPriceModal) ctx.renderPriceModal(); }catch(_){ }
      try{ FC.panelBox.close(); }catch(_){ }
    });
    body.appendChild(h('div', { class:'quote-subsection-title', text:'Kategorie / rodzaje okuć' }));
    body.appendChild(catList);
    body.appendChild(addCat);
    body.appendChild(h('div', { class:'quote-subsection-title', text:'Typy / cechy techniczne', style:'margin-top:14px' }));
    body.appendChild(typeList);
    body.appendChild(addType);
    body.appendChild(h('div', { class:'hardware-supplier-actions' }, [exit, cancel, save]));
    render();
    FC.panelBox.open({ title:'Słowniki okuć', contentNode:body, width:'820px', boxClass:'panel-box--rozrys hardware-dictionary-panel', dismissOnOverlay:false, dismissOnEsc:true });
  }

  ctx.openHardwareDictionariesModal = openHardwareDictionariesModal;
  FC.priceModalHardwareDictionaries = { open:openHardwareDictionariesModal, _debug:{ applyDictionaryRenames, typeRenameMap, categoryRenameMap } };
})();

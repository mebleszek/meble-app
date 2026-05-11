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
  function normalizeCategories(list){
    const hw = FC.hardwareCatalog || {};
    return hw.normalizeCategoryList ? hw.normalizeCategoryList(list || []) : Array.from(new Set((list || []).map(text).filter(Boolean)));
  }
  function normalizeTypes(list){
    const hw = FC.hardwareCatalog || {};
    return hw.normalizeTypeList ? hw.normalizeTypeList(list || []) : (Array.isArray(list) ? list : []);
  }
  function getCategories(){ const s = store(); return s && s.getHardwareCategories ? s.getHardwareCategories() : normalizeCategories([]); }
  function getTypes(){ const s = store(); return s && s.getHardwareTypes ? s.getHardwareTypes() : normalizeTypes([]); }
  function saveCategories(list){ const s = store(); return s && s.saveHardwareCategories ? s.saveHardwareCategories(list) : list; }
  function saveTypes(list){ const s = store(); return s && s.saveHardwareTypes ? s.saveHardwareTypes(list) : list; }

  function categoryRow(value, index, onChange){
    const row = h('div', { class:'hardware-dictionary-row' });
    const input = h('input', { class:'investor-form-input', value:value || '', placeholder:'np. Zawiasy' });
    input.addEventListener('input', ()=> onChange(index, input.value));
    input.addEventListener('change', ()=> onChange(index, input.value, false, true));
    const remove = h('button', { type:'button', class:'btn btn-danger', text:'Usuń' });
    remove.addEventListener('click', ()=> onChange(index, null, true));
    row.appendChild(h('div', { class:'hardware-supplier-field' }, [h('label', { text:'Kategoria / rodzaj okucia' }), input]));
    row.appendChild(remove);
    return row;
  }

  function typeRow(rowData, index, categories, onChange){
    const item = Object.assign({ id:uid('hwt'), name:'', allowedCategories:[], active:true }, rowData || {});
    const row = h('div', { class:'hardware-type-row' });
    const name = h('input', { class:'investor-form-input', value:item.name || '', placeholder:'np. 110° nakładany' });
    name.addEventListener('input', ()=>{ item.name = name.value; onChange(index, item); });
    const active = h('label', { class:'rozrys-scope-chip price-labor-toggle hardware-type-active' }, [
      h('input', { type:'checkbox', checked:item.active !== false ? true : false }),
      h('span', { text:'Aktywny' })
    ]);
    const activeInput = active.querySelector('input');
    activeInput.addEventListener('change', ()=>{ item.active = !!activeInput.checked; onChange(index, item); });
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
        onChange(index, item);
      });
      cats.appendChild(chip);
    });
    const remove = h('button', { type:'button', class:'btn btn-danger', text:'Usuń' });
    remove.addEventListener('click', ()=> onChange(index, null, true));
    row.appendChild(h('div', { class:'hardware-supplier-field' }, [h('label', { text:'Typ / cecha' }), name]));
    row.appendChild(h('div', { class:'hardware-supplier-field' }, [h('label', { text:'Dostępne dla kategorii' }), cats]));
    row.appendChild(active);
    row.appendChild(remove);
    return row;
  }

  function openHardwareDictionariesModal(){
    let categories = getCategories();
    let types = getTypes();
    const body = h('div', { class:'panel-box-form hardware-dictionary-form' });
    const catList = h('div', { class:'hardware-dictionary-list' });
    const typeList = h('div', { class:'hardware-dictionary-list' });
    function render(){
      catList.innerHTML = '';
      categories.forEach((cat, index)=> catList.appendChild(categoryRow(cat, index, (i, value, remove, refresh)=>{
        if(remove){ categories.splice(i, 1); render(); return; }
        categories[i] = value;
        if(refresh) render();
      })));
      typeList.innerHTML = '';
      types.forEach((row, index)=> typeList.appendChild(typeRow(row, index, categories, (i, value, remove)=>{
        if(remove){ types.splice(i, 1); render(); return; }
        types[i] = value;
      })));
    }
    const addCat = h('button', { type:'button', class:'btn', text:'Dodaj kategorię' });
    addCat.addEventListener('click', ()=>{ categories.push(''); render(); });
    const addType = h('button', { type:'button', class:'btn', text:'Dodaj typ / cechę' });
    addType.addEventListener('click', ()=>{ types.push({ id:uid('hwt'), name:'', allowedCategories:[], active:true }); render(); });
    const exit = h('button', { type:'button', class:'btn', text:'Wyjdź' });
    exit.addEventListener('click', ()=>{ try{ FC.panelBox.close(); }catch(_){ } });
    const save = h('button', { type:'button', class:'btn btn-success', text:'Zapisz' });
    save.addEventListener('click', ()=>{
      const cleanCategories = normalizeCategories(categories);
      const cleanTypes = normalizeTypes(types.map((row)=> Object.assign({}, row, { allowedCategories:(row.allowedCategories || []).filter((cat)=> cleanCategories.includes(cat)) })));
      saveCategories(cleanCategories);
      saveTypes(cleanTypes);
      try{ if(ctx.renderPriceModal) ctx.renderPriceModal(); }catch(_){ }
      try{ FC.panelBox.close(); }catch(_){ }
    });
    body.appendChild(h('div', { class:'quote-subsection-title', text:'Kategorie / rodzaje okuć' }));
    body.appendChild(catList);
    body.appendChild(addCat);
    body.appendChild(h('div', { class:'quote-subsection-title', text:'Typy / cechy techniczne', style:'margin-top:14px' }));
    body.appendChild(typeList);
    body.appendChild(addType);
    body.appendChild(h('div', { class:'hardware-supplier-actions' }, [exit, save]));
    render();
    FC.panelBox.open({ title:'Słowniki okuć', contentNode:body, width:'820px', boxClass:'panel-box--rozrys hardware-dictionary-panel', dismissOnOverlay:false, dismissOnEsc:true });
  }

  ctx.openHardwareDictionariesModal = openHardwareDictionariesModal;
  FC.priceModalHardwareDictionaries = { open:openHardwareDictionariesModal };
})();

// js/app/material/price-modal-options.js
// Budowanie opcji selectów i launcherów wyboru w modalu cenników.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  function ensureOption(selectEl, value, label){
    if(!selectEl) return null;
    const key = String(value == null ? '' : value);
    const existing = Array.from(selectEl.options || []).find((opt)=> String(opt.value || '') === key);
    if(existing) return existing;
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = String(label == null ? key : label);
    selectEl.appendChild(opt);
    return opt;
  }

  function setSelectOptions(selectEl, options, selectedValue, fallbackLabel){
    if(!selectEl) return;
    const prev = String(selectedValue == null ? '' : selectedValue);
    selectEl.innerHTML = '';
    (Array.isArray(options) ? options : []).forEach((entry)=>{
      const item = entry && typeof entry === 'object' ? entry : { value:entry, label:entry };
      ensureOption(selectEl, item.value, item.label);
    });
    if(prev && !Array.from(selectEl.options || []).some((opt)=> String(opt.value || '') === prev)) ensureOption(selectEl, prev, fallbackLabel || prev);
    selectEl.value = prev;
    if(String(selectEl.value || '') !== prev){
      const first = Array.from(selectEl.options || []).find((opt)=> String(opt.value || '') !== '') || (selectEl.options && selectEl.options[0]) || null;
      selectEl.value = first ? String(first.value || '') : '';
    }
  }

  function buildOrderedValues(baseList, dynamicList, selectedValue, includeAllLabel){
    const seen = new Set();
    const out = [];
    if(includeAllLabel != null){ out.push({ value:'', label:includeAllLabel }); seen.add(''); }
    function add(value){
      const raw = String(value == null ? '' : value).trim();
      if(!raw && includeAllLabel == null) return;
      if(seen.has(raw)) return;
      seen.add(raw);
      out.push({ value:raw, label:raw || includeAllLabel || '' });
    }
    (Array.isArray(baseList) ? baseList : []).forEach(add);
    (Array.isArray(dynamicList) ? dynamicList : []).forEach(add);
    if(selectedValue != null) add(selectedValue);
    return out;
  }

  function buildMaterialTypeOptions(selectedValue, opts){
    const cfg = Object.assign({ includeAll:false }, opts || {});
    const fromItems = ctx.currentListKind() === 'materials' ? ctx.currentList().map((item)=> item && item.materialType) : [];
    return buildOrderedValues(ctx.MATERIAL_TYPES, fromItems, selectedValue, cfg.includeAll ? 'Wszystkie typy' : null);
  }

  function buildManufacturerOptions(kind, typeVal, selectedValue, opts){
    const knownKinds = ['materials','accessories','quoteRates','workshopServices'];
    let listKind = String(kind || 'materials');
    let currentType = typeVal;
    let currentSelected = selectedValue;
    let currentOpts = opts;
    if(!knownKinds.includes(listKind)){
      currentOpts = selectedValue;
      currentSelected = typeVal;
      currentType = listKind === 'akcesoria' ? '' : listKind;
      listKind = listKind === 'akcesoria' ? 'accessories' : 'materials';
    }
    const cfg = Object.assign({ includeAll:false }, currentOpts || {});
    const registry = FC.materialRegistry || {};
    const list = listKind === ctx.currentListKind() ? ctx.currentList() : [];
    const source = [];
    if(listKind === 'accessories'){
      source.push(...((registry.ACCESSORY_MANUFACTURERS || []).slice()));
      list.forEach((item)=> source.push(item && item.manufacturer));
      return buildOrderedValues([], source, currentSelected, cfg.includeAll ? 'Wszyscy producenci' : null);
    }
    const manufacturers = registry.MANUFACTURERS || {};
    const normalizedType = String(currentType || '').trim();
    if(normalizedType){
      source.push(...((manufacturers[normalizedType] || []).slice()));
      list.forEach((item)=>{ if(String(item && item.materialType || '') === normalizedType) source.push(item && item.manufacturer); });
    }else{
      Object.keys(manufacturers).forEach((key)=> source.push(...(manufacturers[key] || [])));
      list.forEach((item)=> source.push(item && item.manufacturer));
    }
    return buildOrderedValues([], source, currentSelected, cfg.includeAll ? 'Wszyscy producenci' : null);
  }

  function buildCategoryOptions(kind, selectedValue, opts){
    const cfg = Object.assign({ includeAll:false }, opts || {});
    const base = kind === 'workshopServices' ? ctx.WORKSHOP_SERVICE_CATEGORIES : ctx.QUOTE_RATE_CATEGORIES;
    const dynamic = ctx.currentList().map((item)=> item && item.category);
    return buildOrderedValues(base, dynamic, selectedValue, cfg.includeAll ? 'Wszystkie kategorie' : null);
  }

  function buildServiceCategoryOptions(selectedValue, opts){ return buildCategoryOptions('quoteRates', selectedValue, opts); }
  function firstNonEmptyValue(options){
    const item = (Array.isArray(options) ? options : []).find((entry)=> String((entry && entry.value) != null ? entry.value : entry || '').trim() !== '');
    return item ? String(item.value != null ? item.value : item) : '';
  }
  function mountChoice(opts){
    const cfg = Object.assign({ selectEl:null, mountId:'', title:'Wybierz', buttonClass:'investor-choice-launch', disabled:false, placeholder:'Wybierz', onChange:null }, opts || {});
    const mount = cfg.mountId ? ctx.byId(cfg.mountId) : null;
    if(!(mount && cfg.selectEl && FC.investorChoice && typeof FC.investorChoice.mountChoice === 'function')) return null;
    return FC.investorChoice.mountChoice({ mount, selectEl:cfg.selectEl, title:cfg.title, buttonClass:cfg.buttonClass, disabled:!!cfg.disabled, placeholder:cfg.placeholder, onChange:cfg.onChange });
  }

  Object.assign(ctx, { ensureOption, setSelectOptions, buildMaterialTypeOptions, buildManufacturerOptions, buildCategoryOptions, buildServiceCategoryOptions, firstNonEmptyValue, mountChoice });
})();

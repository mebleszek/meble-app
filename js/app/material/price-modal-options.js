// js/app/material/price-modal-options.js
// Budowanie opcji selectów i launcherów wyboru w modalu cenników.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  function text(value){ return String(value == null ? '' : value).trim(); }

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
      const opt = ensureOption(selectEl, item.value, item.label);
      if(opt){
        opt.disabled = !!item.disabled;
        if(item.description) opt.setAttribute('data-description', item.description);
        else opt.removeAttribute('data-description');
      }
    });
    if(prev && !Array.from(selectEl.options || []).some((opt)=> String(opt.value || '') === prev)){
      const opt = ensureOption(selectEl, prev, fallbackLabel || prev);
      if(opt){ opt.disabled = false; opt.removeAttribute('data-description'); }
    }
    selectEl.value = prev;
    if(String(selectEl.value || '') !== prev){
      const first = Array.from(selectEl.options || []).find((opt)=> String(opt.value || '') !== '' && !opt.disabled) || (selectEl.options && selectEl.options[0]) || null;
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
      let hasStoreManufacturers = false;
      try{
        const store = ctx.catalogStore && ctx.catalogStore();
        if(store && typeof store.getHardwareManufacturers === 'function'){
          source.push(...store.getHardwareManufacturers());
          hasStoreManufacturers = true;
        }
      }catch(_){ }
      if(!hasStoreManufacturers) source.push(...((registry.ACCESSORY_MANUFACTURERS || []).slice()));
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

  function buildMaterialPriceUnitOptions(selectedValue){
    const opts = [
      { value:'sheet', label:'Arkusz' },
      { value:'m2', label:'m²' },
      { value:'mb', label:'mb' },
      { value:'piece', label:'szt.' },
    ];
    const selected = text(selectedValue);
    if(selected && !opts.some((row)=> row.value === selected)) opts.push({ value:selected, label:selected });
    return opts;
  }

  function currentHardwareItems(){
    try{ if(ctx.currentListKind && ctx.currentListKind() === 'accessories') return ctx.currentList(); }catch(_){ }
    try{ const store = ctx.catalogStore && ctx.catalogStore(); return store && store.getAccessories ? store.getAccessories() : []; }catch(_){ return []; }
  }

  function buildHardwareCategoryOptions(selectedValue, opts){
    const cfg = Object.assign({ includeAll:false }, opts || {});
    const hw = FC.hardwareCatalog || {};
    const dynamic = ctx.currentList().map((item)=> item && (item.hardwareCategory || item.category));
    let stored = [];
    try{ const store = ctx.catalogStore && ctx.catalogStore(); stored = store && store.getHardwareCategories ? store.getHardwareCategories() : []; }catch(_){ stored = []; }
    const options = hw && typeof hw.categoryOptions === 'function'
      ? hw.categoryOptions((stored || []).concat(dynamic), selectedValue)
      : buildOrderedValues(['Zawiasy','Szuflady / prowadnice','Podnośniki','Cargo / organizery','Inne'], (stored || []).concat(dynamic), selectedValue, null);
    return cfg.includeAll ? [{ value:'', label:'Wszystkie kategorie' }].concat(options) : options;
  }


  function buildHardwareTypeOptions(categoryValue, selectedValue, opts){
    const cfg = Object.assign({ includeAll:false, includeEmpty:true, emptyLabel:'Wybierz typ / cechę', manufacturer:'', hardwareSystem:'', currentId:'' }, opts || {});
    let types = [];
    try{ const store = ctx.catalogStore && ctx.catalogStore(); types = store && store.getHardwareTypes ? store.getHardwareTypes() : []; }catch(_){ types = []; }
    const hw = FC.hardwareCatalog || {};
    const baseOptions = hw && typeof hw.typeOptions === 'function'
      ? hw.typeOptions(types, categoryValue, selectedValue)
      : buildOrderedValues([], types.map((row)=> row && row.name), selectedValue, null);
    const options = (baseOptions || []).map((entry)=>{
      const item = entry && typeof entry === 'object' ? Object.assign({}, entry) : { value:entry, label:entry };
      const value = text(item.value);
      if(value && text(cfg.manufacturer) && hw && typeof hw.uniqueTypeConflict === 'function'){
        const conflict = hw.uniqueTypeConflict(currentHardwareItems(), { manufacturer:cfg.manufacturer, hardwareCategory:categoryValue, hardwareSystem:cfg.hardwareSystem, hardwareType:value }, cfg.currentId);
        if(conflict){
          item.disabled = true;
          item.description = 'Zajęte przez: ' + (text(conflict.name) || text(conflict.symbol) || 'inną pozycję');
        }
      }
      return item;
    });
    if(cfg.includeAll) return [{ value:'', label:'Wszystkie typy' }].concat(options);
    return cfg.includeEmpty === false ? options : [{ value:'', label:cfg.emptyLabel || 'Wybierz typ / cechę' }].concat(options);
  }

  function buildHardwareUnitOptions(selectedValue){
    const hw = FC.hardwareCatalog || {};
    return hw && typeof hw.unitOptions === 'function'
      ? hw.unitOptions(selectedValue)
      : buildOrderedValues(['szt.','kpl.','mb','m²','zestaw'], [], selectedValue, null);
  }

  function buildHardwareStatusOptions(){
    const hw = FC.hardwareCatalog || {};
    return hw && typeof hw.statusOptions === 'function'
      ? hw.statusOptions()
      : [{ value:'active', label:'Aktywne' }, { value:'hidden', label:'Ukryte' }, { value:'archived', label:'Archiwalne' }];
  }


  function buildHardwareSupplierOptions(selectedValue, opts){
    const cfg = Object.assign({ includeAll:false }, opts || {});
    const hw = FC.hardwareCatalog || {};
    let suppliers = [];
    try{
      const store = ctx.catalogStore && ctx.catalogStore();
      suppliers = store && typeof store.getHardwareSuppliers === 'function' ? store.getHardwareSuppliers() : [];
    }catch(_){ suppliers = []; }
    return hw && typeof hw.supplierOptions === 'function'
      ? hw.supplierOptions(suppliers, selectedValue, cfg.includeAll)
      : buildOrderedValues([], suppliers.map((row)=> row && (row.name || row.id)), selectedValue, cfg.includeAll ? 'Wszyscy dostawcy' : null);
  }

  function buildHardwareQuoteBaseOptions(){
    const hw = FC.hardwareCatalog || {};
    return hw && typeof hw.quoteBaseOptions === 'function'
      ? hw.quoteBaseOptions()
      : [{ value:'catalogGross', label:'Cena katalogowa bez rabatu' }, { value:'purchaseGross', label:'Cena po rabacie' }, { value:'manualGross', label:'Cena ręczna' }];
  }

  function buildHardwarePricingModeOptions(){
    const hw = FC.hardwareCatalog || {};
    return hw && typeof hw.pricingModeOptions === 'function'
      ? hw.pricingModeOptions()
      : [{ value:'markup', label:'Narzut %' }, { value:'manualPrice', label:'Cena ręczna' }];
  }

  function buildHardwareBundleCostModeOptions(){
    const hw = FC.hardwareCatalog || {};
    return hw && typeof hw.bundleCostModeOptions === 'function'
      ? hw.bundleCostModeOptions()
      : [{ value:'ownPrice', label:'Własna cena zestawu' }, { value:'components', label:'Licz ze składników' }];
  }
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

  Object.assign(ctx, { ensureOption, setSelectOptions, buildMaterialTypeOptions, buildManufacturerOptions, buildCategoryOptions, buildServiceCategoryOptions, buildMaterialPriceUnitOptions, buildHardwareCategoryOptions, buildHardwareTypeOptions, buildHardwareUnitOptions, buildHardwareStatusOptions, buildHardwareSupplierOptions, buildHardwareQuoteBaseOptions, buildHardwarePricingModeOptions, buildHardwareBundleCostModeOptions, firstNonEmptyValue, mountChoice });
})();

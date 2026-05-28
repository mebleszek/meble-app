// js/app/material/price-modal-hardware-filter-sort.js
// Rozszerzone filtry i sortowanie dla katalogu okuć.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){ Object.keys(attrs).forEach((key)=>{ if(key === 'class') el.className = attrs[key]; else if(key === 'text') el.textContent = attrs[key]; else el.setAttribute(key, attrs[key]); }); }
    (children || []).forEach((child)=> el.appendChild(child));
    return el;
  }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function filters(){
    ctx.runtimeState.filters = Object.assign({ manufacturer:'', hardwareCategory:'', hardwareUnit:'', supplierId:'', priceMin:'', priceMax:'', sortBy:'nameAsc' }, ctx.runtimeState.filters || {});
    return ctx.runtimeState.filters;
  }
  function fillSelect(select, options, value){
    if(!select) return;
    select.innerHTML = '';
    (options || []).forEach((entry)=>{
      const opt = entry && typeof entry === 'object' ? entry : { value:entry, label:entry };
      const option = document.createElement('option'); option.value = String(opt.value == null ? '' : opt.value); option.textContent = String(opt.label == null ? option.value : opt.label); select.appendChild(option);
    });
    select.value = String(value || '');
  }
  function mount(select, id, title, placeholder, onChange){
    try{ select.hidden = true; ctx.mountChoice({ selectEl:select, mountId:id, title, buttonClass:'investor-choice-launch', placeholder, onChange }); }catch(_){ }
  }
  function openHardwareFiltersModal(){
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
    const f = filters();
    const body = h('div', { class:'panel-box-form hardware-filter-form' });
    const manufacturer = h('select', { id:'hardwareFilterManufacturer' });
    const manufacturerLaunch = h('div', { id:'hardwareFilterManufacturerLaunch' });
    const category = h('select', { id:'hardwareFilterCategory' });
    const categoryLaunch = h('div', { id:'hardwareFilterCategoryLaunch' });
    const unit = h('select', { id:'hardwareFilterUnit' });
    const unitLaunch = h('div', { id:'hardwareFilterUnitLaunch' });
    const supplier = h('select', { id:'hardwareFilterSupplier' });
    const supplierLaunch = h('div', { id:'hardwareFilterSupplierLaunch' });
    const priceMin = h('input', { class:'investor-form-input', type:'number', step:'0.01', value:String(f.priceMin || ''), placeholder:'od' });
    const priceMax = h('input', { class:'investor-form-input', type:'number', step:'0.01', value:String(f.priceMax || ''), placeholder:'do' });
    fillSelect(manufacturer, ctx.buildManufacturerOptions ? ctx.buildManufacturerOptions('accessories', '', f.manufacturer, { includeAll:true }) : [], f.manufacturer);
    fillSelect(category, ctx.buildHardwareCategoryOptions ? ctx.buildHardwareCategoryOptions(f.hardwareCategory, { includeAll:true }) : [], f.hardwareCategory);
    fillSelect(unit, [{ value:'', label:'Wszystkie jednostki' }].concat(ctx.buildHardwareUnitOptions ? ctx.buildHardwareUnitOptions(f.hardwareUnit) : []), f.hardwareUnit);
    fillSelect(supplier, ctx.buildHardwareSupplierOptions ? ctx.buildHardwareSupplierOptions(f.supplierId, { includeAll:true }) : [], f.supplierId);
    body.appendChild(h('div', { class:'grid-2' }, [
      h('div', {}, [h('label', { text:'Producent' }), manufacturer, manufacturerLaunch]),
      h('div', {}, [h('label', { text:'Kategoria' }), category, categoryLaunch]),
    ]));
    body.appendChild(h('div', { class:'grid-2', style:'margin-top:10px' }, [
      h('div', {}, [h('label', { text:'Jednostka' }), unit, unitLaunch]),
      h('div', {}, [h('label', { text:'Dostawca' }), supplier, supplierLaunch]),
    ]));
    body.appendChild(h('div', { class:'grid-2', style:'margin-top:10px' }, [
      h('div', {}, [h('label', { text:'Cena do wyceny brutto' }), h('div', { class:'hardware-filter-price-range' }, [priceMin, priceMax])]),
    ]));
    const footer = h('div', { class:'panel-box-form__footer' });
    const clearBtn = h('button', { class:'btn', type:'button', text:'Wyczyść' });
    const backBtn = h('button', { class:'btn-primary', type:'button', text:'Wróć' });
    const applyBtn = h('button', { class:'btn-success', type:'button', text:'Zastosuj' });
    clearBtn.addEventListener('click', ()=>{ manufacturer.value = ''; category.value = ''; unit.value = ''; supplier.value = ''; priceMin.value = ''; priceMax.value = ''; });
    backBtn.addEventListener('click', ()=>{ try{ FC.panelBox.close(); }catch(_){ } });
    applyBtn.addEventListener('click', ()=>{
      f.manufacturer = manufacturer.value || '';
      f.hardwareCategory = category.value || '';
      f.hardwareUnit = unit.value || '';
      f.supplierId = supplier.value || '';
      f.priceMin = priceMin.value || '';
      f.priceMax = priceMax.value || '';
      ctx.renderPriceList && ctx.renderPriceList();
      try{ FC.panelBox.close(); }catch(_){ }
    });
    footer.appendChild(clearBtn); footer.appendChild(backBtn); footer.appendChild(applyBtn); body.appendChild(footer);
    FC.panelBox.open({ title:'Filtry okuć', contentNode:body, width:'720px', boxClass:'panel-box--rozrys hardware-filter-panel', dismissOnOverlay:false, dismissOnEsc:true });
    mount(manufacturer, 'hardwareFilterManufacturerLaunch', 'Wybierz producenta', 'Wszyscy producenci');
    mount(category, 'hardwareFilterCategoryLaunch', 'Wybierz kategorię', 'Wszystkie kategorie');
    mount(unit, 'hardwareFilterUnitLaunch', 'Wybierz jednostkę', 'Wszystkie jednostki');
    mount(supplier, 'hardwareFilterSupplierLaunch', 'Wybierz dostawcę', 'Wszyscy dostawcy');
  }

  const SORT_OPTIONS = [
    { value:'nameAsc', label:'Nazwa A–Z' },
    { value:'nameDesc', label:'Nazwa Z–A' },
    { value:'priceAsc', label:'Cena rosnąco' },
    { value:'priceDesc', label:'Cena malejąco' },
    { value:'manufacturerAsc', label:'Producent A–Z' },
    { value:'categoryAsc', label:'Kategoria A–Z' },
    { value:'updatedDesc', label:'Data ceny najnowsza' },
  ];
  function openHardwareSortModal(){
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
    const f = filters();
    const body = h('div', { class:'panel-box-form hardware-sort-form' });
    SORT_OPTIONS.forEach((opt)=>{
      const btn = h('button', { type:'button', class:'rozrys-choice-option' + (String(f.sortBy || 'nameAsc') === opt.value ? ' is-selected' : '') });
      btn.innerHTML = '<div class="rozrys-choice-option__title"></div>';
      btn.querySelector('.rozrys-choice-option__title').textContent = opt.label;
      btn.addEventListener('click', ()=>{ f.sortBy = opt.value; ctx.renderPriceList && ctx.renderPriceList(); try{ FC.panelBox.close(); }catch(_){ } });
      body.appendChild(btn);
    });
    FC.panelBox.open({ title:'Sortuj okucia', contentNode:body, width:'560px', boxClass:'panel-box--rozrys hardware-sort-panel', dismissOnOverlay:true, dismissOnEsc:true });
  }

  function matchesHardwareFilters(item){
    const f = filters();
    if(f.hardwareCategory && String(item && item.hardwareCategory || '') !== String(f.hardwareCategory)) return false;
    if(f.hardwareUnit && String(item && item.hardwareUnit || '') !== String(f.hardwareUnit)) return false;
    if(f.supplierId && String(item && item.supplierId || '') !== String(f.supplierId)) return false;
    const price = Number(item && item.price) || 0;
    if(f.priceMin !== '' && price < number(f.priceMin)) return false;
    if(f.priceMax !== '' && price > number(f.priceMax)) return false;
    return true;
  }
  function sortHardwareList(list){
    const f = filters();
    const sorted = (Array.isArray(list) ? list : []).slice();
    const key = String(f.sortBy || 'nameAsc');
    const collator = new Intl.Collator('pl', { sensitivity:'base' });
    const txt = (item, prop)=> String(item && item[prop] || '');
    sorted.sort((a,b)=>{
      if(key === 'nameDesc') return collator.compare(txt(b,'name'), txt(a,'name'));
      if(key === 'priceAsc') return (Number(a && a.price) || 0) - (Number(b && b.price) || 0);
      if(key === 'priceDesc') return (Number(b && b.price) || 0) - (Number(a && a.price) || 0);
      if(key === 'manufacturerAsc') return collator.compare(txt(a,'manufacturer'), txt(b,'manufacturer')) || collator.compare(txt(a,'name'), txt(b,'name'));
      if(key === 'categoryAsc') return collator.compare(txt(a,'hardwareCategory'), txt(b,'hardwareCategory')) || collator.compare(txt(a,'name'), txt(b,'name'));
      if(key === 'updatedDesc') return collator.compare(txt(b,'priceUpdatedAt'), txt(a,'priceUpdatedAt')) || collator.compare(txt(a,'name'), txt(b,'name'));
      return collator.compare(txt(a,'name'), txt(b,'name'));
    });
    return sorted;
  }

  Object.assign(ctx, { openHardwareFiltersModal, openHardwareSortModal, matchesHardwareFilters, sortHardwareList });
})();

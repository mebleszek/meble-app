// js/app/material/price-modal-filters.js
// Filtry, wyszukiwanie i akcje paska narzędzi list cennikowych.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const ctx = window.FC.priceModalContext || {};

  function syncFilterSelects(){
    const kind = ctx.currentListKind();
    const materialTypeEl = ctx.byId('priceFilterMaterialType');
    const manufacturerEl = ctx.byId('priceFilterManufacturer');
    const categoryEl = ctx.byId('priceFilterCategory');
    if(kind === 'materials'){
      ctx.setSelectOptions(materialTypeEl, ctx.buildMaterialTypeOptions(ctx.runtimeState.filters.materialType, { includeAll:true }), ctx.runtimeState.filters.materialType, 'Wszystkie typy');
      ctx.setSelectOptions(manufacturerEl, ctx.buildManufacturerOptions('materials', ctx.runtimeState.filters.materialType, ctx.runtimeState.filters.manufacturer, { includeAll:true }), ctx.runtimeState.filters.manufacturer, 'Wszyscy producenci');
    } else if(kind === 'accessories'){
      ctx.setSelectOptions(materialTypeEl, [{ value:'', label:'Wszystkie akcesoria' }], '', 'Wszystkie akcesoria');
      ctx.setSelectOptions(manufacturerEl, ctx.buildManufacturerOptions('accessories', '', ctx.runtimeState.filters.manufacturer, { includeAll:true }), ctx.runtimeState.filters.manufacturer, 'Wszyscy producenci');
    } else {
      ctx.setSelectOptions(categoryEl, ctx.buildCategoryOptions(kind, ctx.runtimeState.filters.category, { includeAll:true }), ctx.runtimeState.filters.category, 'Wszystkie kategorie');
    }
  }

  function mountFilterChoices(){
    const kind = ctx.currentListKind();
    const materialTypeEl = ctx.byId('priceFilterMaterialType');
    const manufacturerEl = ctx.byId('priceFilterManufacturer');
    const categoryEl = ctx.byId('priceFilterCategory');
    if(kind === 'materials'){
      ctx.mountChoice({ selectEl:materialTypeEl, mountId:'priceFilterMaterialTypeLaunch', title:'Wybierz typ materiału', buttonClass:'investor-choice-launch', placeholder:'Wszystkie typy', onChange:(value)=>{ ctx.runtimeState.filters.materialType = String(value || ''); syncFilterSelects(); ctx.renderPriceList(); } });
      ctx.mountChoice({ selectEl:manufacturerEl, mountId:'priceFilterManufacturerLaunch', title:'Wybierz producenta', buttonClass:'investor-choice-launch', placeholder:'Wszyscy producenci', onChange:(value)=>{ ctx.runtimeState.filters.manufacturer = String(value || ''); syncFilterSelects(); ctx.renderPriceList(); } });
      return;
    }
    if(kind === 'accessories'){
      ctx.mountChoice({ selectEl:manufacturerEl, mountId:'priceFilterManufacturerLaunch', title:'Wybierz producenta', buttonClass:'investor-choice-launch', placeholder:'Wszyscy producenci', onChange:(value)=>{ ctx.runtimeState.filters.manufacturer = String(value || ''); syncFilterSelects(); ctx.renderPriceList(); } });
      return;
    }
    ctx.mountChoice({ selectEl:categoryEl, mountId:'priceFilterCategoryLaunch', title:'Wybierz kategorię', buttonClass:'investor-choice-launch', placeholder:'Wszystkie kategorie', onChange:(value)=>{ ctx.runtimeState.filters.category = String(value || ''); syncFilterSelects(); ctx.renderPriceList(); } });
  }

  function bindToolbarEvents(){
    const search = ctx.byId('priceSearch');
    if(search){ search.oninput = ()=> ctx.renderPriceList(); search.onchange = ()=> ctx.renderPriceList(); }
    const clearBtn = ctx.byId('clearPriceFiltersBtn');
    if(clearBtn) clearBtn.onclick = ()=>{
      ctx.runtimeState.filters.materialType = '';
      ctx.runtimeState.filters.manufacturer = '';
      ctx.runtimeState.filters.category = '';
      if(search) search.value = '';
      syncFilterSelects();
      mountFilterChoices();
      ctx.renderPriceList();
    };
    const addBtn = ctx.byId('openPriceItemModalBtn');
    if(addBtn) addBtn.onclick = ()=> ctx.openPriceItemModal();
  }

  function matchesSearch(item, query){
    if(!query) return true;
    const haystack = [item && item.name, item && item.symbol, item && item.manufacturer, item && item.materialType, item && item.category].map((value)=> ctx.normalizeKey(value)).join(' ');
    return haystack.includes(query);
  }

  function filteredPriceList(){
    const kind = ctx.currentListKind();
    const q = ctx.normalizeKey((ctx.byId('priceSearch') && ctx.byId('priceSearch').value) || '');
    return ctx.currentList().filter((item)=>{
      if(!matchesSearch(item, q)) return false;
      if(kind === 'materials'){
        if(ctx.runtimeState.filters.materialType && String(item && item.materialType || '') !== String(ctx.runtimeState.filters.materialType || '')) return false;
        if(ctx.runtimeState.filters.manufacturer && String(item && item.manufacturer || '') !== String(ctx.runtimeState.filters.manufacturer || '')) return false;
        return true;
      }
      if(kind === 'accessories'){
        if(ctx.runtimeState.filters.manufacturer && String(item && item.manufacturer || '') !== String(ctx.runtimeState.filters.manufacturer || '')) return false;
        return true;
      }
      if(ctx.runtimeState.filters.category && String(item && item.category || '') !== String(ctx.runtimeState.filters.category || '')) return false;
      return true;
    });
  }

  Object.assign(ctx, { syncFilterSelects, mountFilterChoices, bindToolbarEvents, filteredPriceList });
})();

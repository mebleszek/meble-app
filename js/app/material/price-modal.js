// js/app/material/price-modal.js
// Cienka fasada modala cenników/katalogów po podziale na odpowiedzialności.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};
  FC.priceModal = FC.priceModal || {};

  async function closePriceModal(){
    if(ctx.runtimeState.itemModalOpen){
      const ok = await ctx.requestClosePriceItemModal();
      if(!ok) return false;
    }
    try{ unlockModalScroll(); }catch(_){ }
    ctx.appUiState().showPriceList = null;
    ctx.persistUi();
    const modal = ctx.byId('priceModal');
    if(modal) modal.style.display = 'none';
    return true;
  }

  function renderPriceModal(){
    const modal = ctx.byId('priceModal');
    const kind = ctx.currentListKind();
    const active = String((ctx.appUiState() && ctx.appUiState().showPriceList) || '');
    const wasOpen = modal && modal.style.display === 'flex';
    if(!active){
      ctx.doClosePriceItemModal();
      if(modal) modal.style.display = 'none';
      if(wasOpen) try{ unlockModalScroll(); }catch(_){ }
      return;
    }
    const cfg = ctx.currentConfig();
    if(modal) modal.style.display = 'flex';
    ctx.setModalShellOpen(modal, wasOpen);
    const materialFilters = ctx.byId('materialFilters');
    const serviceFilters = ctx.byId('serviceFilters');
    const addBtn = ctx.byId('openPriceItemModalBtn');
    if(ctx.byId('priceModalTitle')) ctx.byId('priceModalTitle').textContent = cfg.title;
    if(ctx.byId('priceModalSubtitle')) ctx.byId('priceModalSubtitle').textContent = cfg.subtitle;
    if(ctx.byId('priceModalIcon')) ctx.byId('priceModalIcon').textContent = cfg.icon;
    if(addBtn) addBtn.textContent = cfg.addLabel;
    if(materialFilters) materialFilters.style.display = (kind === 'materials' || kind === 'accessories') ? 'grid' : 'none';
    if(serviceFilters) serviceFilters.style.display = (kind === 'quoteRates' || kind === 'workshopServices') ? 'grid' : 'none';
    const materialTypeWrap = ctx.byId('priceFilterMaterialTypeLaunch') && ctx.byId('priceFilterMaterialTypeLaunch').parentElement;
    if(materialTypeWrap) materialTypeWrap.style.display = kind === 'materials' ? '' : 'none';
    ctx.syncFilterSelects();
    ctx.mountFilterChoices();
    ctx.bindToolbarEvents();
    ctx.renderPriceList();
    ctx.renderItemModal();
  }

  ctx.renderPriceModal = renderPriceModal;
  Object.assign(FC.priceModal, {
    renderPriceModal,
    closePriceModal,
    openPriceItemModal:ctx.openPriceItemModal,
    closePriceItemModal:ctx.requestClosePriceItemModal,
    requestClosePriceItemModal:ctx.requestClosePriceItemModal,
    saveActivePriceItem:ctx.saveActivePriceItem,
    deleteActivePriceItem:ctx.deleteActivePriceItem,
    saveMaterialFromForm:ctx.saveMaterialFromForm,
    saveServiceFromForm:ctx.saveServiceFromForm,
    deletePriceItem:ctx.deletePriceItem,
    _debug:{
      buildCategoryOptions:ctx.buildCategoryOptions,
      buildServiceCategoryOptions:ctx.buildServiceCategoryOptions,
      buildManufacturerOptions:ctx.buildManufacturerOptions,
      buildMaterialTypeOptions:ctx.buildMaterialTypeOptions,
      filteredPriceList:ctx.filteredPriceList,
      runtimeState:ctx.runtimeState,
    },
  });
})();

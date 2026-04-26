// js/app/material/price-modal-item-form.js
// Stan formularza i wewnętrzny modal dodawania/edycji pozycji katalogu.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const ctx = window.FC.priceModalContext || {};

  function filterMaterialWrapper(){ return ctx.byId('formMaterialTypeLaunch') && ctx.byId('formMaterialTypeLaunch').parentElement; }
  function filterManufacturerWrapper(){ return ctx.byId('formManufacturerLaunch') && ctx.byId('formManufacturerLaunch').parentElement; }
  function formCategoryWrapper(){ return ctx.byId('formCategoryLaunch') && ctx.byId('formCategoryLaunch').parentElement; }
  function formServiceNameWrapper(){ return ctx.byId('formServiceName') && ctx.byId('formServiceName').parentElement; }
  function formHasGrainRow(){ return ctx.byId('formHasGrain') && ctx.byId('formHasGrain').parentElement; }
  function defaultMaterialDraft(){
    const type = ctx.firstNonEmptyValue(ctx.buildMaterialTypeOptions('laminat')) || 'laminat';
    const manufacturer = ctx.firstNonEmptyValue(ctx.buildManufacturerOptions('materials', type, '', { includeAll:false }));
    return { materialType:type, manufacturer, symbol:'', name:'', price:'', hasGrain:false };
  }
  function defaultAccessoryDraft(){
    const manufacturer = ctx.firstNonEmptyValue(ctx.buildManufacturerOptions('accessories', '', '', { includeAll:false }));
    return { manufacturer, symbol:'', name:'', price:'' };
  }
  function defaultServiceDraft(kind){
    return { category:ctx.firstNonEmptyValue(ctx.buildCategoryOptions(kind, kind === 'workshopServices' ? 'Cięcie' : 'Montaż', { includeAll:false })) || (kind === 'workshopServices' ? 'Cięcie' : 'Montaż'), name:'', price:'' };
  }

  function currentEditedItem(){
    const editingId = ctx.appUiState() && ctx.appUiState().editingId;
    if(!editingId) return null;
    return ctx.currentList().find((item)=> item && item.id === editingId) || null;
  }
  function normalizePriceValue(value){ const raw = String(value == null ? '' : value).trim(); if(!raw) return ''; const parsed = Number(raw.replace(',', '.')); return Number.isFinite(parsed) ? parsed : raw; }
  function getCurrentMaterialDraft(){ return { materialType:String((ctx.byId('formMaterialType') && ctx.byId('formMaterialType').value) || ''), manufacturer:String((ctx.byId('formManufacturer') && ctx.byId('formManufacturer').value) || '').trim(), symbol:String((ctx.byId('formSymbol') && ctx.byId('formSymbol').value) || '').trim(), name:String((ctx.byId('formName') && ctx.byId('formName').value) || '').trim(), price:normalizePriceValue(ctx.byId('formPrice') && ctx.byId('formPrice').value), hasGrain:!!(ctx.byId('formHasGrain') && ctx.byId('formHasGrain').checked) }; }
  function getCurrentAccessoryDraft(){ return { manufacturer:String((ctx.byId('formManufacturer') && ctx.byId('formManufacturer').value) || '').trim(), symbol:String((ctx.byId('formSymbol') && ctx.byId('formSymbol').value) || '').trim(), name:String((ctx.byId('formName') && ctx.byId('formName').value) || '').trim(), price:normalizePriceValue(ctx.byId('formPrice') && ctx.byId('formPrice').value) }; }
  function getCurrentServiceDraft(){ return { category:String((ctx.byId('formCategory') && ctx.byId('formCategory').value) || '').trim(), name:String((ctx.byId('formServiceName') && ctx.byId('formServiceName').value) || '').trim(), price:normalizePriceValue(ctx.byId('formServicePrice') && ctx.byId('formServicePrice').value) }; }
  function currentItemSignature(){ const kind = ctx.currentConfig().formKind; const data = kind === 'material' ? getCurrentMaterialDraft() : (kind === 'accessory' ? getCurrentAccessoryDraft() : getCurrentServiceDraft()); return JSON.stringify(data); }
  function isItemDirty(){ return ctx.runtimeState.itemModalOpen && currentItemSignature() !== String(ctx.runtimeState.itemInitialSignature || ''); }

  function updateItemActionState(){
    const dirty = isItemDirty();
    const isEdit = !!(ctx.appUiState() && ctx.appUiState().editingId);
    const deleteBtn = ctx.byId('deletePriceItemBtn');
    const exitBtn = ctx.byId('priceItemExitBtn');
    const cancelBtn = ctx.byId('priceItemCancelBtn');
    const saveBtn = ctx.byId('priceItemSaveBtn');
    const footer = ctx.byId('priceItemFooter');
    if(footer) footer.style.display = ctx.runtimeState.itemModalOpen ? 'flex' : 'none';
    if(deleteBtn) deleteBtn.style.display = isEdit ? '' : 'none';
    if(exitBtn) exitBtn.style.display = dirty ? 'none' : '';
    if(cancelBtn) cancelBtn.style.display = dirty ? '' : 'none';
    if(saveBtn){ saveBtn.style.display = dirty ? '' : 'none'; saveBtn.textContent = isEdit ? 'Zapisz' : ctx.currentConfig().addLabel.replace(/^Dodaj\s+/i, 'Dodaj '); }
  }

  function wireItemDirtyEvents(){
    ['formSymbol','formName','formPrice','formServiceName','formServicePrice','formHasGrain','formMaterialType','formManufacturer','formCategory'].forEach((id)=>{
      const el = ctx.byId(id);
      if(!el) return;
      el.oninput = updateItemActionState;
      el.onchange = updateItemActionState;
    });
  }

  function applyMaterialFormState(item){
    const materialType = String(item && item.materialType || 'laminat');
    ctx.setSelectOptions(ctx.byId('formMaterialType'), ctx.buildMaterialTypeOptions(materialType), materialType, materialType);
    ctx.setSelectOptions(ctx.byId('formManufacturer'), ctx.buildManufacturerOptions('materials', materialType, item && item.manufacturer), String(item && item.manufacturer || ''), String(item && item.manufacturer || ''));
    if(ctx.byId('formSymbol')) ctx.byId('formSymbol').value = String(item && item.symbol || '');
    if(ctx.byId('formName')) ctx.byId('formName').value = String(item && item.name || '');
    if(ctx.byId('formPrice')) ctx.byId('formPrice').value = item && item.price != null ? item.price : '';
    if(ctx.byId('formHasGrain')) ctx.byId('formHasGrain').checked = !!(item && item.hasGrain);
  }
  function applyAccessoryFormState(item){
    ctx.setSelectOptions(ctx.byId('formManufacturer'), ctx.buildManufacturerOptions('accessories', '', item && item.manufacturer), String(item && item.manufacturer || ''), String(item && item.manufacturer || ''));
    if(ctx.byId('formSymbol')) ctx.byId('formSymbol').value = String(item && item.symbol || '');
    if(ctx.byId('formName')) ctx.byId('formName').value = String(item && item.name || '');
    if(ctx.byId('formPrice')) ctx.byId('formPrice').value = item && item.price != null ? item.price : '';
    if(ctx.byId('formHasGrain')) ctx.byId('formHasGrain').checked = false;
  }
  function applyServiceFormState(item){
    const category = String(item && item.category || (ctx.currentListKind() === 'workshopServices' ? 'Cięcie' : 'Montaż'));
    ctx.setSelectOptions(ctx.byId('formCategory'), ctx.buildCategoryOptions(ctx.currentListKind(), category), category, category);
    if(ctx.byId('formServiceName')) ctx.byId('formServiceName').value = String(item && item.name || '');
    if(ctx.byId('formServicePrice')) ctx.byId('formServicePrice').value = item && item.price != null ? item.price : '';
  }

  function renderItemModal(){
    const kind = ctx.currentListKind();
    const cfg = ctx.currentConfig();
    const isEdit = !!(ctx.appUiState() && ctx.appUiState().editingId);
    const item = currentEditedItem();
    if(ctx.byId('editingIndicator')) ctx.byId('editingIndicator').style.display = isEdit ? '' : 'none';
    if(ctx.byId('priceItemModalTitle')) ctx.byId('priceItemModalTitle').textContent = isEdit ? 'Edytuj pozycję' : cfg.addLabel;
    if(ctx.byId('priceItemModalSubtitle')) ctx.byId('priceItemModalSubtitle').textContent = cfg.subtitle;
    if(ctx.byId('priceItemModalIcon')) ctx.byId('priceItemModalIcon').textContent = cfg.icon;
    if(ctx.byId('priceFormTitle')) ctx.byId('priceFormTitle').textContent = isEdit ? 'Edytuj pozycję' : cfg.addLabel;
    if(ctx.byId('materialFormFields')) ctx.byId('materialFormFields').style.display = (cfg.formKind === 'material' || cfg.formKind === 'accessory') ? '' : 'none';
    if(ctx.byId('serviceFormFields')) ctx.byId('serviceFormFields').style.display = cfg.formKind === 'service' ? '' : 'none';
    const materialTypeWrap = filterMaterialWrapper();
    const manufacturerWrap = filterManufacturerWrapper();
    const grainRow = formHasGrainRow();
    if(materialTypeWrap) materialTypeWrap.style.display = cfg.formKind === 'material' ? '' : 'none';
    if(manufacturerWrap) manufacturerWrap.style.display = (cfg.formKind === 'material' || cfg.formKind === 'accessory') ? '' : 'none';
    if(grainRow) grainRow.style.display = cfg.formKind === 'material' ? 'flex' : 'none';
    if(cfg.formKind === 'material') applyMaterialFormState(item || defaultMaterialDraft());
    else if(cfg.formKind === 'accessory') applyAccessoryFormState(item || defaultAccessoryDraft());
    else applyServiceFormState(item || defaultServiceDraft(kind));
    if(cfg.formKind === 'service'){
      const categoryWrap = formCategoryWrapper();
      const nameWrap = formServiceNameWrapper();
      if(categoryWrap) categoryWrap.style.display = '';
      if(nameWrap) nameWrap.style.display = '';
    }
    wireItemDirtyEvents();
    ctx.runtimeState.itemInitialSignature = currentItemSignature();
    updateItemActionState();
  }

  function openPriceItemModal(id){
    const modal = ctx.byId('priceItemModal');
    if(!modal) return;
    const wasOpen = modal.style.display === 'flex';
    ctx.appUiState().editingId = id || null;
    ctx.persistUi();
    ctx.runtimeState.itemModalOpen = true;
    modal.style.display = 'flex';
    ctx.setModalShellOpen(modal, wasOpen);
    renderItemModal();
  }
  function doClosePriceItemModal(){
    ctx.runtimeState.itemModalOpen = false;
    ctx.runtimeState.itemInitialSignature = '';
    ctx.appUiState().editingId = null;
    ctx.persistUi();
    const modal = ctx.byId('priceItemModal');
    if(modal) modal.style.display = 'none';
    return true;
  }
  async function requestClosePriceItemModal(){
    if(!ctx.runtimeState.itemModalOpen) return true;
    if(isItemDirty()){
      const ok = await ctx.confirmDiscard();
      if(!ok) return false;
    }
    doClosePriceItemModal();
    return true;
  }

  Object.assign(ctx, { currentEditedItem, getCurrentMaterialDraft, getCurrentAccessoryDraft, getCurrentServiceDraft, isItemDirty, updateItemActionState, renderItemModal, openPriceItemModal, doClosePriceItemModal, requestClosePriceItemModal });
})();

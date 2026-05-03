// js/app/material/price-modal-item-form.js
// Stan formularza i wewnętrzny modal dodawania/edycji pozycji katalogu.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  function filterMaterialWrapper(){ return ctx.byId('formMaterialTypeLaunch') && ctx.byId('formMaterialTypeLaunch').parentElement; }
  function filterManufacturerWrapper(){ return ctx.byId('formManufacturerLaunch') && ctx.byId('formManufacturerLaunch').parentElement; }
  function formCategoryWrapper(){ return ctx.byId('formCategoryLaunch') && ctx.byId('formCategoryLaunch').parentElement; }
  function formServiceNameWrapper(){ return ctx.byId('formServiceName') && ctx.byId('formServiceName').parentElement; }
  function formHasGrainRow(){ return ctx.byId('formHasGrain') && ctx.byId('formHasGrain').parentElement; }
  function laborFields(){ return ctx.byId('laborFormFields'); }

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
    const isQuoteRates = kind === 'quoteRates';
    return {
      category:ctx.firstNonEmptyValue(ctx.buildCategoryOptions(kind, isQuoteRates ? 'Korpusy' : 'Cięcie', { includeAll:false })) || (isQuoteRates ? 'Korpusy' : 'Cięcie'),
      name:'',
      price:'',
      usage:isQuoteRates ? 'manual' : '',
      autoRole:'none',
      rateType:'workshop',
      timeBlockHours:0,
      defaultMultiplier:1,
      quantityMode:'none',
      quantityTiers:[],
      startHours:0,
      startQty:1,
      stepEveryQty:1,
      stepHours:0,
      volumePricePerM3:0,
      volumeTimeMode:'none',
      volumeTimePerM3:0,
      volumeTimeTiers:[],
      heightMinMm:0,
      heightMaxMm:0,
      active:true,
      internalOnly:true,
    };
  }

  function currentEditedItem(){
    const editingId = ctx.appUiState() && ctx.appUiState().editingId;
    if(!editingId) return null;
    return ctx.currentList().find((item)=> item && item.id === editingId) || null;
  }
  function normalizePriceValue(value){ const raw = String(value == null ? '' : value).trim(); if(!raw) return ''; const parsed = Number(raw.replace(',', '.')); return Number.isFinite(parsed) ? parsed : raw; }
  function readNumber(id){ return normalizePriceValue(ctx.byId(id) && ctx.byId(id).value); }
  function readString(id){ return String((ctx.byId(id) && ctx.byId(id).value) || '').trim(); }
  function readBool(id){ return !!(ctx.byId(id) && ctx.byId(id).checked); }
  function setValue(id, value){ const el = ctx.byId(id); if(el) el.value = value == null ? '' : String(value); }
  function setChecked(id, value){ const el = ctx.byId(id); if(el) el.checked = !!value; }

  function getCurrentMaterialDraft(){ return { materialType:String((ctx.byId('formMaterialType') && ctx.byId('formMaterialType').value) || ''), manufacturer:String((ctx.byId('formManufacturer') && ctx.byId('formManufacturer').value) || '').trim(), symbol:String((ctx.byId('formSymbol') && ctx.byId('formSymbol').value) || '').trim(), name:String((ctx.byId('formName') && ctx.byId('formName').value) || '').trim(), price:normalizePriceValue(ctx.byId('formPrice') && ctx.byId('formPrice').value), hasGrain:!!(ctx.byId('formHasGrain') && ctx.byId('formHasGrain').checked) }; }
  function getCurrentAccessoryDraft(){ return { manufacturer:String((ctx.byId('formManufacturer') && ctx.byId('formManufacturer').value) || '').trim(), symbol:String((ctx.byId('formSymbol') && ctx.byId('formSymbol').value) || '').trim(), name:String((ctx.byId('formName') && ctx.byId('formName').value) || '').trim(), price:normalizePriceValue(ctx.byId('formPrice') && ctx.byId('formPrice').value) }; }
  function getCurrentLaborDraft(base){
    if(ctx.currentListKind() !== 'quoteRates') return {};
    const labor = FC.laborCatalog || {};
    const tierText = readString('laborTierText');
    const volumeTierText = readString('laborVolumeTimeTierText');
    return {
      usage:readString('laborUsage') || 'manual',
      autoRole:readString('laborAutoRole') || 'none',
      rateType:readString('laborRateType') || 'workshop',
      rateKey:readString('laborAutoRole') === 'hourlyRate' ? (readString('laborRateType') || 'workshop') : '',
      timeBlockHours:Number(readNumber('laborTimeBlockHours')) || 0,
      defaultMultiplier:Number(readNumber('laborDefaultMultiplier')) || 1,
      quantityMode:readString('laborQuantityMode') || 'none',
      quantityTiers:labor.parseTierText ? labor.parseTierText(tierText) : [],
      startHours:Number(readNumber('laborStartHours')) || 0,
      startQty:Number(readNumber('laborStartQty')) || 1,
      stepEveryQty:Number(readNumber('laborStepEveryQty')) || 1,
      stepHours:Number(readNumber('laborStepHours')) || 0,
      volumePricePerM3:Number(readNumber('laborVolumePricePerM3')) || 0,
      volumeTimeMode:readString('laborVolumeTimeMode') || 'none',
      volumeTimePerM3:Number(readNumber('laborVolumeTimePerM3')) || 0,
      volumeTimeTiers:labor.parseVolumeTierText ? labor.parseVolumeTierText(volumeTierText) : [],
      heightMinMm:Number(readNumber('laborHeightMinMm')) || 0,
      heightMaxMm:Number(readNumber('laborHeightMaxMm')) || 0,
      active:readBool('laborActive'),
      internalOnly:readBool('laborInternalOnly'),
    };
  }
  function getCurrentServiceDraft(){
    const base = { category:String((ctx.byId('formCategory') && ctx.byId('formCategory').value) || '').trim(), name:String((ctx.byId('formServiceName') && ctx.byId('formServiceName').value) || '').trim(), price:normalizePriceValue(ctx.byId('formServicePrice') && ctx.byId('formServicePrice').value) };
    return Object.assign(base, getCurrentLaborDraft(base));
  }
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
    [
      'formSymbol','formName','formPrice','formServiceName','formServicePrice','formHasGrain','formMaterialType','formManufacturer','formCategory',
      'laborUsage','laborAutoRole','laborRateType','laborTimeBlockHours','laborDefaultMultiplier','laborQuantityMode','laborTierText',
      'laborStartHours','laborStartQty','laborStepEveryQty','laborStepHours','laborVolumePricePerM3','laborVolumeTimeMode','laborVolumeTimePerM3',
      'laborVolumeTimeTierText','laborHeightMinMm','laborHeightMaxMm','laborActive','laborInternalOnly'
    ].forEach((id)=>{
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
  function applyLaborFormState(item){
    const labor = FC.laborCatalog || {};
    const def = labor.normalizeDefinition ? labor.normalizeDefinition(item || defaultServiceDraft('quoteRates')) : (item || {});
    setValue('laborUsage', def.usage || 'manual');
    setValue('laborAutoRole', def.autoRole || 'none');
    setValue('laborRateType', def.rateType || def.rateKey || 'workshop');
    setValue('laborTimeBlockHours', Number(def.timeBlockHours) || 0);
    setValue('laborDefaultMultiplier', Number(def.defaultMultiplier) || 1);
    setValue('laborQuantityMode', def.quantityMode || 'none');
    setValue('laborTierText', labor.tiersToText ? labor.tiersToText(def.quantityTiers || []) : '');
    setValue('laborStartHours', Number(def.startHours) || 0);
    setValue('laborStartQty', Number(def.startQty) || 1);
    setValue('laborStepEveryQty', Number(def.stepEveryQty) || 1);
    setValue('laborStepHours', Number(def.stepHours) || 0);
    setValue('laborVolumePricePerM3', Number(def.volumePricePerM3) || 0);
    setValue('laborVolumeTimeMode', def.volumeTimeMode || 'none');
    setValue('laborVolumeTimePerM3', Number(def.volumeTimePerM3) || 0);
    setValue('laborVolumeTimeTierText', labor.volumeTiersToText ? labor.volumeTiersToText(def.volumeTimeTiers || []) : '');
    setValue('laborHeightMinMm', Number(def.heightMinMm) || 0);
    setValue('laborHeightMaxMm', Number(def.heightMaxMm) || 0);
    setChecked('laborActive', def.active !== false);
    setChecked('laborInternalOnly', def.internalOnly !== false);
  }
  function applyServiceFormState(item){
    const kind = ctx.currentListKind();
    const category = String(item && item.category || (kind === 'workshopServices' ? 'Cięcie' : 'Korpusy'));
    ctx.setSelectOptions(ctx.byId('formCategory'), ctx.buildCategoryOptions(kind, category), category, category);
    if(ctx.byId('formServiceName')) ctx.byId('formServiceName').value = String(item && item.name || '');
    if(ctx.byId('formServicePrice')) ctx.byId('formServicePrice').value = item && item.price != null ? item.price : '';
    if(kind === 'quoteRates') applyLaborFormState(item || defaultServiceDraft(kind));
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
    const laborWrap = laborFields();
    if(laborWrap) laborWrap.style.display = (cfg.formKind === 'service' && kind === 'quoteRates') ? '' : 'none';
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

// js/app/material/price-modal-hardware-form.js
// Pola formularza katalogu okuć/akcesoriów: domyślne wartości, odczyt i aplikacja stanu.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  function normalizePriceValue(value){
    const raw = String(value == null ? '' : value).trim();
    if(!raw) return '';
    const parsed = Number(raw.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : raw;
  }
  function readString(id){ return String((ctx.byId(id) && ctx.byId(id).value) || '').trim(); }
  function readNumber(id){ return normalizePriceValue(ctx.byId(id) && ctx.byId(id).value); }
  function setValue(id, value){ const el = ctx.byId(id); if(el) el.value = value == null ? '' : String(value); }

  const FIELD_IDS = [
    'hardwareCategory','hardwareUnit','hardwareStatus','hardwareSeries','hardwarePriceSource',
    'hardwarePurchasePrice','hardwareMarkupPercent','hardwarePriceUpdatedAt','hardwareNote'
  ];

  function defaultAccessoryDraft(){
    const manufacturer = ctx.firstNonEmptyValue(ctx.buildManufacturerOptions('accessories', '', '', { includeAll:false }));
    const category = ctx.firstNonEmptyValue(ctx.buildHardwareCategoryOptions ? ctx.buildHardwareCategoryOptions('Zawiasy') : [{ value:'Zawiasy' }]) || 'Zawiasy';
    return { manufacturer, symbol:'', name:'', price:'', hardwareCategory:category, hardwareUnit:'szt.', series:'', purchasePrice:'', markupPercent:'', priceSource:'', priceUpdatedAt:'', status:'active', note:'' };
  }

  function getCurrentAccessoryDraft(){
    return {
      manufacturer:String((ctx.byId('formManufacturer') && ctx.byId('formManufacturer').value) || '').trim(),
      symbol:String((ctx.byId('formSymbol') && ctx.byId('formSymbol').value) || '').trim(),
      name:String((ctx.byId('formName') && ctx.byId('formName').value) || '').trim(),
      price:normalizePriceValue(ctx.byId('formPrice') && ctx.byId('formPrice').value),
      hardwareCategory:readString('hardwareCategory') || 'Inne',
      hardwareUnit:readString('hardwareUnit') || 'szt.',
      series:readString('hardwareSeries'),
      purchasePrice:readNumber('hardwarePurchasePrice'),
      markupPercent:readNumber('hardwareMarkupPercent'),
      priceSource:readString('hardwarePriceSource'),
      priceUpdatedAt:readString('hardwarePriceUpdatedAt'),
      status:readString('hardwareStatus') || 'active',
      note:readString('hardwareNote'),
    };
  }

  function applyAccessoryFormState(item){
    const data = item || defaultAccessoryDraft();
    ctx.setSelectOptions(ctx.byId('formManufacturer'), ctx.buildManufacturerOptions('accessories', '', data && data.manufacturer), String(data && data.manufacturer || ''), String(data && data.manufacturer || ''));
    if(ctx.byId('formSymbol')) ctx.byId('formSymbol').value = String(data && data.symbol || '');
    if(ctx.byId('formName')) ctx.byId('formName').value = String(data && data.name || '');
    if(ctx.byId('formPrice')) ctx.byId('formPrice').value = data && data.price != null ? data.price : '';
    if(ctx.byId('formHasGrain')) ctx.byId('formHasGrain').checked = false;
    if(ctx.buildHardwareCategoryOptions) ctx.setSelectOptions(ctx.byId('hardwareCategory'), ctx.buildHardwareCategoryOptions(data && data.hardwareCategory), String(data && data.hardwareCategory || 'Inne'), String(data && data.hardwareCategory || 'Inne'));
    if(ctx.buildHardwareUnitOptions) ctx.setSelectOptions(ctx.byId('hardwareUnit'), ctx.buildHardwareUnitOptions(data && data.hardwareUnit), String(data && data.hardwareUnit || 'szt.'), String(data && data.hardwareUnit || 'szt.'));
    if(ctx.buildHardwareStatusOptions) ctx.setSelectOptions(ctx.byId('hardwareStatus'), ctx.buildHardwareStatusOptions(), String(data && data.status || 'active'), 'Aktywne');
    setValue('hardwareSeries', data && data.series || '');
    setValue('hardwarePriceSource', data && data.priceSource || '');
    setValue('hardwarePurchasePrice', data && data.purchasePrice != null ? data.purchasePrice : '');
    setValue('hardwareMarkupPercent', data && data.markupPercent != null ? data.markupPercent : '');
    setValue('hardwarePriceUpdatedAt', data && data.priceUpdatedAt || '');
    setValue('hardwareNote', data && data.note || '');
  }

  ctx.priceModalHardwareForm = { FIELD_IDS, defaultAccessoryDraft, getCurrentAccessoryDraft, applyAccessoryFormState };
})();

// js/app/material/price-modal-hardware-form.js
// Pola formularza katalogu okuć/akcesoriów: dostawcy, ceny netto/brutto, rabaty i cena do wyceny.
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
  function num(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function round2(value){ const n = Number(value); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function fmt(value){ const n = Number(value); return Number.isFinite(n) && n !== 0 ? String(Math.round(n * 100) / 100) : ''; }
  function rawValue(id){ return String((ctx.byId(id) && ctx.byId(id).value) || '').trim(); }
  function todayString(){ try{ return new Date().toISOString().slice(0, 10); }catch(_){ return ''; } }
  function readString(id){ return rawValue(id); }
  function readNumber(id){ return normalizePriceValue(ctx.byId(id) && ctx.byId(id).value); }
  function setValue(id, value){ const el = ctx.byId(id); if(el) el.value = value == null ? '' : String(value); }
  function setText(id, value){ const el = ctx.byId(id); if(el) el.textContent = String(value == null ? '' : value); }
  function disableField(id, disabled, reason){
    const el = ctx.byId(id); if(!el) return;
    el.disabled = !!disabled;
    if(disabled){ el.setAttribute('aria-disabled', 'true'); if(reason) el.title = reason; }
    else { el.removeAttribute('aria-disabled'); el.removeAttribute('title'); }
  }
  function getStore(){ return ctx.catalogStore && ctx.catalogStore(); }
  function getSettings(){
    const store = getStore();
    return store && typeof store.getHardwareSettings === 'function' ? store.getHardwareSettings() : ((FC.hardwareCatalog && FC.hardwareCatalog.DEFAULT_SETTINGS) || {});
  }
  function getSuppliers(){
    const store = getStore();
    return store && typeof store.getHardwareSuppliers === 'function' ? store.getHardwareSuppliers() : [];
  }
  function findSupplier(id){
    const key = String(id || '');
    return getSuppliers().find((row)=> String(row && row.id || '') === key) || null;
  }
  function netToGross(value, vat){ return FC.hardwareCatalog && FC.hardwareCatalog.netToGross ? FC.hardwareCatalog.netToGross(value, vat) : round2(num(value) * (1 + num(vat) / 100)); }
  function grossToNet(value, vat){ return FC.hardwareCatalog && FC.hardwareCatalog.grossToNet ? FC.hardwareCatalog.grossToNet(value, vat) : round2(num(value) / (1 + num(vat) / 100)); }

  const FIELD_IDS = [
    'hardwareCategory','hardwareUnit','hardwareStatus','hardwareSeries','hardwareSupplierId','hardwarePriceSource',
    'hardwareVatRate','hardwareCatalogPriceNet','hardwareCatalogPriceGross','hardwareSupplierDiscountPercent',
    'hardwarePurchasePriceNet','hardwarePurchasePriceGross','hardwareQuoteBase','hardwarePricingMode',
    'hardwareMarkupPercent','hardwareQuotePriceNet','hardwareQuotePriceGross','hardwarePriceUpdatedAt','hardwareNote','hardwareKitPriceMode','hardwareKitComponentsJson'
  ];

  function defaultAccessoryDraft(){
    const settings = getSettings();
    const supplier = findSupplier(settings.defaultSupplierId) || getSuppliers()[0] || null;
    const manufacturer = ctx.firstNonEmptyValue(ctx.buildManufacturerOptions('accessories', '', '', { includeAll:false }));
    const category = ctx.firstNonEmptyValue(ctx.buildHardwareCategoryOptions ? ctx.buildHardwareCategoryOptions('Zawiasy') : [{ value:'Zawiasy' }]) || 'Zawiasy';
    return {
      manufacturer, symbol:'', name:'', price:'', hardwareCategory:category, hardwareUnit:'szt.', series:'',
      supplierId:supplier ? supplier.id : (settings.defaultSupplierId || ''),
      priceSource:supplier ? supplier.name : '',
      vatRate:settings.defaultVatRate || 23,
      catalogPriceNet:'', catalogPriceGross:'',
      supplierDiscountPercent:supplier ? supplier.defaultDiscountPercent : 0,
      purchasePriceNet:'', purchasePriceGross:'',
      quoteBase:settings.defaultQuoteBase || 'catalogGross',
      pricingMode:settings.defaultPricingMode || 'markup',
      markupPercent:settings.defaultMarkupPercent || 20,
      quotePriceNet:'', quotePriceGross:'',
      priceUpdatedAt:todayString(), status:'active', note:'', kitPriceMode:'own', kitComponents:[]
    };
  }

  function syncHardwarePricing(opts){
    if(ctx.currentListKind && ctx.currentListKind() !== 'accessories') return;
    const cfg = Object.assign({ sourceId:'' }, opts || {});
    const vat = num(readString('hardwareVatRate')) || 23;
    const discount = num(readString('hardwareSupplierDiscountPercent'));
    const pricingMode = readString('hardwarePricingMode') || 'markup';
    const quoteBase = readString('hardwareQuoteBase') || 'catalogGross';
    const sourceId = cfg.sourceId || '';
    const kit = ctx.priceModalHardwareKit || null;
    const kitComponentsMode = !!(kit && typeof kit.isComponentsMode === 'function' && kit.isComponentsMode());
    const kitComponentsTotal = kitComponentsMode && typeof kit.getComponentsTotalGross === 'function' ? round2(kit.getComponentsTotalGross()) : 0;
    const clearedPair = {
      hardwareCatalogPriceNet:'hardwareCatalogPriceGross',
      hardwareCatalogPriceGross:'hardwareCatalogPriceNet',
      hardwareQuotePriceNet:'hardwareQuotePriceGross',
      hardwareQuotePriceGross:'hardwareQuotePriceNet',
    };
    if(Object.prototype.hasOwnProperty.call(clearedPair, sourceId) && rawValue(sourceId) === ''){
      setValue(clearedPair[sourceId], '');
    }

    let catalogNet = num(readString('hardwareCatalogPriceNet'));
    let catalogGross = num(readString('hardwareCatalogPriceGross'));
    if(kitComponentsMode && kitComponentsTotal > 0 && sourceId !== 'hardwareCatalogPriceNet' && sourceId !== 'hardwareCatalogPriceGross'){
      catalogGross = kitComponentsTotal;
      catalogNet = grossToNet(catalogGross, vat);
      setValue('hardwareCatalogPriceGross', fmt(catalogGross));
      setValue('hardwareCatalogPriceNet', fmt(catalogNet));
    }else if(sourceId === 'hardwareCatalogPriceNet' && catalogNet > 0){ catalogGross = netToGross(catalogNet, vat); setValue('hardwareCatalogPriceGross', fmt(catalogGross)); }
    else if(sourceId === 'hardwareCatalogPriceGross' && catalogGross > 0){ catalogNet = grossToNet(catalogGross, vat); setValue('hardwareCatalogPriceNet', fmt(catalogNet)); }
    else if(sourceId !== 'hardwareCatalogPriceNet' && sourceId !== 'hardwareCatalogPriceGross' && catalogGross > 0 && catalogNet <= 0){ catalogNet = grossToNet(catalogGross, vat); setValue('hardwareCatalogPriceNet', fmt(catalogNet)); }
    else if(sourceId !== 'hardwareCatalogPriceNet' && sourceId !== 'hardwareCatalogPriceGross' && catalogNet > 0 && catalogGross <= 0){ catalogGross = netToGross(catalogNet, vat); setValue('hardwareCatalogPriceGross', fmt(catalogGross)); }

    let purchaseGross = kitComponentsMode ? kitComponentsTotal : round2(catalogGross * (1 - discount / 100));
    let purchaseNet = kitComponentsMode ? grossToNet(purchaseGross, vat) : round2(catalogNet * (1 - discount / 100));
    if(purchaseGross <= 0 && purchaseNet > 0) purchaseGross = netToGross(purchaseNet, vat);
    if(purchaseNet <= 0 && purchaseGross > 0) purchaseNet = grossToNet(purchaseGross, vat);
    setValue('hardwarePurchasePriceGross', fmt(purchaseGross));
    setValue('hardwarePurchasePriceNet', fmt(purchaseNet));

    let baseGross = catalogGross;
    if(quoteBase === 'purchaseGross') baseGross = purchaseGross;
    if(quoteBase === 'manualGross') baseGross = num(readString('hardwareQuotePriceGross')) || catalogGross;
    let quoteGross = num(readString('hardwareQuotePriceGross'));
    let quoteNet = num(readString('hardwareQuotePriceNet'));
    if(pricingMode === 'markup'){
      const markup = num(readString('hardwareMarkupPercent'));
      quoteGross = round2(baseGross * (1 + markup / 100));
      quoteNet = quoteGross > 0 ? grossToNet(quoteGross, vat) : 0;
      setValue('hardwareQuotePriceGross', fmt(quoteGross));
      setValue('hardwareQuotePriceNet', fmt(quoteNet));
      disableField('hardwareMarkupPercent', false);
      disableField('hardwareQuotePriceGross', true, 'Cena do wyceny jest liczona z ceny bazowej i narzutu. Zmień tryb na Cena ręczna, aby wpisać ją ręcznie.');
      disableField('hardwareQuotePriceNet', true, 'Cena do wyceny jest liczona z ceny bazowej i narzutu.');
      setText('hardwareEffectiveMarkupPreview', 'Tryb narzutu: ' + (num(readString('hardwareMarkupPercent')) || 0).toFixed(2) + '%');
    }else{
      disableField('hardwareMarkupPercent', true, 'Wyłączone, bo cena do wyceny jest wpisywana ręcznie. Narzut wynikowy jest pokazany poniżej.');
      disableField('hardwareQuotePriceGross', false);
      disableField('hardwareQuotePriceNet', false);
      if(sourceId === 'hardwareQuotePriceNet' && quoteNet > 0){ quoteGross = netToGross(quoteNet, vat); setValue('hardwareQuotePriceGross', fmt(quoteGross)); }
      else if(sourceId === 'hardwareQuotePriceGross' && quoteGross > 0){ quoteNet = grossToNet(quoteGross, vat); setValue('hardwareQuotePriceNet', fmt(quoteNet)); }
      else if(sourceId !== 'hardwareQuotePriceNet' && sourceId !== 'hardwareQuotePriceGross' && quoteGross > 0 && quoteNet <= 0){ quoteNet = grossToNet(quoteGross, vat); setValue('hardwareQuotePriceNet', fmt(quoteNet)); }
      const effective = baseGross > 0 && quoteGross > 0 ? round2(((quoteGross / baseGross) - 1) * 100) : 0;
      setText('hardwareEffectiveMarkupPreview', 'Narzut wynikowy: ' + effective.toFixed(2) + '%');
    }
    const margin = round2((num(readString('hardwareQuotePriceGross')) || 0) - purchaseGross);
    const marginPct = purchaseGross > 0 ? round2((margin / purchaseGross) * 100) : 0;
    setText('hardwareMarginPreview', 'Marża względem realnego zakupu: ' + margin.toFixed(2) + ' PLN brutto' + (purchaseGross > 0 ? ' (' + marginPct.toFixed(2) + '%)' : ''));
    if(ctx.byId('formPrice')) ctx.byId('formPrice').value = fmt(num(readString('hardwareQuotePriceGross')));
  }

  function applySupplierDefaults(){
    const supplier = findSupplier(readString('hardwareSupplierId'));
    if(!supplier) return;
    setValue('hardwarePriceSource', supplier.name || '');
    setValue('hardwareSupplierDiscountPercent', supplier.defaultDiscountPercent || 0);
    setValue('hardwareVatRate', supplier.defaultVatRate || 23);
    syncHardwarePricing({ sourceId:'hardwareSupplierId' });
  }

  function getCurrentAccessoryDraft(){
    const priceGross = num(readString('hardwareQuotePriceGross')) || num(ctx.byId('formPrice') && ctx.byId('formPrice').value);
    const supplier = findSupplier(readString('hardwareSupplierId'));
    return {
      manufacturer:String((ctx.byId('formManufacturer') && ctx.byId('formManufacturer').value) || '').trim(),
      symbol:String((ctx.byId('formSymbol') && ctx.byId('formSymbol').value) || '').trim(),
      name:String((ctx.byId('formName') && ctx.byId('formName').value) || '').trim(),
      price:priceGross,
      hardwareCategory:readString('hardwareCategory') || 'Inne',
      hardwareUnit:readString('hardwareUnit') || 'szt.',
      series:readString('hardwareSeries'),
      supplierId:readString('hardwareSupplierId'),
      supplierName:supplier ? supplier.name : readString('hardwarePriceSource'),
      priceSource:readString('hardwarePriceSource') || (supplier ? supplier.name : ''),
      vatRate:readNumber('hardwareVatRate'),
      catalogPriceNet:readNumber('hardwareCatalogPriceNet'),
      catalogPriceGross:readNumber('hardwareCatalogPriceGross'),
      supplierDiscountPercent:readNumber('hardwareSupplierDiscountPercent'),
      purchasePriceNet:readNumber('hardwarePurchasePriceNet'),
      purchasePriceGross:readNumber('hardwarePurchasePriceGross'),
      purchasePrice:readNumber('hardwarePurchasePriceGross'),
      quoteBase:readString('hardwareQuoteBase') || 'catalogGross',
      pricingMode:readString('hardwarePricingMode') || 'markup',
      markupPercent:readNumber('hardwareMarkupPercent'),
      quotePriceNet:readNumber('hardwareQuotePriceNet'),
      quotePriceGross:priceGross,
      priceUpdatedAt:readString('hardwarePriceUpdatedAt'),
      status:readString('hardwareStatus') || 'active',
      note:readString('hardwareNote'),
      kitPriceMode:ctx.priceModalHardwareKit && typeof ctx.priceModalHardwareKit.getDraft === 'function' ? ctx.priceModalHardwareKit.getDraft().kitPriceMode : 'own',
      kitComponents:ctx.priceModalHardwareKit && typeof ctx.priceModalHardwareKit.getDraft === 'function' ? ctx.priceModalHardwareKit.getDraft().kitComponents : [],
      kitComponentsTotalGross:ctx.priceModalHardwareKit && typeof ctx.priceModalHardwareKit.getDraft === 'function' ? ctx.priceModalHardwareKit.getDraft().kitComponentsTotalGross : 0,
      kitReferenceTotalGross:ctx.priceModalHardwareKit && typeof ctx.priceModalHardwareKit.getDraft === 'function' ? ctx.priceModalHardwareKit.getDraft().kitReferenceTotalGross : 0,
    };
  }

  function applyAccessoryFormState(item){
    const data = Object.assign(defaultAccessoryDraft(), item || {});
    ctx.setSelectOptions(ctx.byId('formManufacturer'), ctx.buildManufacturerOptions('accessories', '', data && data.manufacturer), String(data && data.manufacturer || ''), String(data && data.manufacturer || ''));
    if(ctx.byId('formSymbol')) ctx.byId('formSymbol').value = String(data && data.symbol || '');
    if(ctx.byId('formName')) ctx.byId('formName').value = String(data && data.name || '');
    if(ctx.byId('formPrice')) ctx.byId('formPrice').value = data && data.price != null ? data.price : '';
    if(ctx.byId('formHasGrain')) ctx.byId('formHasGrain').checked = false;
    if(ctx.buildHardwareCategoryOptions) ctx.setSelectOptions(ctx.byId('hardwareCategory'), ctx.buildHardwareCategoryOptions(data && data.hardwareCategory), String(data && data.hardwareCategory || 'Inne'), String(data && data.hardwareCategory || 'Inne'));
    if(ctx.buildHardwareUnitOptions) ctx.setSelectOptions(ctx.byId('hardwareUnit'), ctx.buildHardwareUnitOptions(data && data.hardwareUnit), String(data && data.hardwareUnit || 'szt.'), String(data && data.hardwareUnit || 'szt.'));
    if(ctx.buildHardwareStatusOptions) ctx.setSelectOptions(ctx.byId('hardwareStatus'), ctx.buildHardwareStatusOptions(), String(data && data.status || 'active'), 'Aktywne');
    if(ctx.buildHardwareSupplierOptions) ctx.setSelectOptions(ctx.byId('hardwareSupplierId'), ctx.buildHardwareSupplierOptions(data && data.supplierId), String(data && data.supplierId || ''), String(data && data.supplierId || ''));
    if(ctx.buildHardwareQuoteBaseOptions) ctx.setSelectOptions(ctx.byId('hardwareQuoteBase'), ctx.buildHardwareQuoteBaseOptions(), String(data && data.quoteBase || 'catalogGross'), 'Cena katalogowa bez rabatu');
    if(ctx.buildHardwarePricingModeOptions) ctx.setSelectOptions(ctx.byId('hardwarePricingMode'), ctx.buildHardwarePricingModeOptions(), String(data && data.pricingMode || 'markup'), 'Narzut %');
    setValue('hardwareSeries', data && data.series || '');
    setValue('hardwarePriceSource', data && data.priceSource || '');
    setValue('hardwareVatRate', data && data.vatRate != null ? data.vatRate : 23);
    setValue('hardwareCatalogPriceNet', data && data.catalogPriceNet != null ? data.catalogPriceNet : '');
    setValue('hardwareCatalogPriceGross', data && data.catalogPriceGross != null ? data.catalogPriceGross : '');
    setValue('hardwareSupplierDiscountPercent', data && data.supplierDiscountPercent != null ? data.supplierDiscountPercent : '');
    setValue('hardwarePurchasePriceNet', data && data.purchasePriceNet != null ? data.purchasePriceNet : '');
    setValue('hardwarePurchasePriceGross', data && (data.purchasePriceGross != null ? data.purchasePriceGross : data.purchasePrice) || '');
    setValue('hardwareMarkupPercent', data && data.markupPercent != null ? data.markupPercent : '');
    setValue('hardwareQuotePriceNet', data && data.quotePriceNet != null ? data.quotePriceNet : '');
    setValue('hardwareQuotePriceGross', data && (data.quotePriceGross != null ? data.quotePriceGross : data.price) || '');
    setValue('hardwarePriceUpdatedAt', data && data.priceUpdatedAt || (!item ? todayString() : ''));
    setValue('hardwareNote', data && data.note || '');
    if(ctx.priceModalHardwareKit && typeof ctx.priceModalHardwareKit.applyAccessoryFormState === 'function') ctx.priceModalHardwareKit.applyAccessoryFormState(data || {});
    syncHardwarePricing({ sourceId:'' });
  }

  function handleHardwareFieldInput(event){
    const target = event && event.target;
    const id = target && target.id ? String(target.id) : '';
    if(ctx.priceModalHardwareKit && typeof ctx.priceModalHardwareKit.syncVisibility === 'function') ctx.priceModalHardwareKit.syncVisibility();
    if(id === 'hardwareSupplierId') applySupplierDefaults();
    else syncHardwarePricing({ sourceId:id });
  }

  ctx.priceModalHardwareForm = { FIELD_IDS, defaultAccessoryDraft, getCurrentAccessoryDraft, applyAccessoryFormState, syncHardwarePricing, handleHardwareFieldInput, applySupplierDefaults };
})();

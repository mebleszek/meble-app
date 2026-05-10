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
  function readString(id){ return String((ctx.byId(id) && ctx.byId(id).value) || '').trim(); }
  function readNumber(id){ return normalizePriceValue(ctx.byId(id) && ctx.byId(id).value); }
  function setValue(id, value){ const el = ctx.byId(id); if(el) el.value = value == null ? '' : String(value); }
  function setText(id, value){ const el = ctx.byId(id); if(el) el.textContent = String(value == null ? '' : value); }
  function todayIso(){ try{ const d = new Date(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${d.getFullYear()}-${m}-${day}`; }catch(_){ return ''; } }
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
  function bundleApi(){ return ctx.priceModalHardwareBundle || {}; }
  function supplierPricesApi(){ return ctx.priceModalHardwareSupplierPrices || {}; }

  const FIELD_IDS = [
    'hardwareCategory','hardwareUnit','hardwareType','hardwareStatus','hardwareSeries','hardwareSupplierId','hardwarePriceSource',
    'hardwareVatRate','hardwareCatalogPriceNet','hardwareCatalogPriceGross','hardwareSupplierDiscountPercent',
    'hardwarePurchasePriceNet','hardwarePurchasePriceGross','hardwareQuoteBase','hardwarePricingMode',
    'hardwareMarkupPercent','hardwareQuotePriceNet','hardwareQuotePriceGross','hardwarePriceUpdatedAt','hardwareNote',
    'hardwareBundleCostMode'
  ];

  function defaultAccessoryDraft(){
    const settings = getSettings();
    const supplier = findSupplier(settings.defaultSupplierId) || getSuppliers()[0] || null;
    const manufacturer = ctx.firstNonEmptyValue(ctx.buildManufacturerOptions('accessories', '', '', { includeAll:false }));
    const category = ctx.firstNonEmptyValue(ctx.buildHardwareCategoryOptions ? ctx.buildHardwareCategoryOptions('Zawiasy') : [{ value:'Zawiasy' }]) || 'Zawiasy';
    return {
      manufacturer, symbol:'', name:'', price:'', hardwareCategory:category, hardwareType:'', hardwareUnit:'szt.', series:'',
      supplierId:supplier ? supplier.id : (settings.defaultSupplierId || ''), priceSource:supplier ? supplier.name : '',
      vatRate:settings.defaultVatRate || 23, catalogPriceNet:'', catalogPriceGross:'',
      supplierDiscountPercent:supplier ? supplier.defaultDiscountPercent : 0, purchasePriceNet:'', purchasePriceGross:'',
      quoteBase:settings.defaultQuoteBase || 'catalogGross', pricingMode:settings.defaultPricingMode || 'markup', markupPercent:settings.defaultMarkupPercent || 20,
      quotePriceNet:'', quotePriceGross:'', priceUpdatedAt:todayIso(), status:'active', note:'',
      bundleCostMode:'ownPrice', bundleItems:[], bundleComponentsCatalogGross:0, bundleComponentsPurchaseGross:0, supplierPrices:[],
    };
  }

  function clearPairIfSourceEmpty(sourceId){
    const raw = readString(sourceId);
    if(raw !== '') return false;
    if(sourceId === 'hardwareCatalogPriceNet' || sourceId === 'hardwareCatalogPriceGross'){
      setValue('hardwareCatalogPriceNet', ''); setValue('hardwareCatalogPriceGross', '');
      setValue('hardwarePurchasePriceNet', ''); setValue('hardwarePurchasePriceGross', '');
      if(readString('hardwarePricingMode') === 'markup'){ setValue('hardwareQuotePriceNet', ''); setValue('hardwareQuotePriceGross', ''); }
      return true;
    }
    if((sourceId === 'hardwareQuotePriceNet' || sourceId === 'hardwareQuotePriceGross') && readString('hardwarePricingMode') === 'manualPrice'){
      setValue('hardwareQuotePriceNet', ''); setValue('hardwareQuotePriceGross', '');
      return true;
    }
    return false;
  }

  function syncCatalogAndPurchase(sourceId, vat, discount, bundleMode){
    const bundle = bundleApi();
    const bundleComponentsMode = bundle && typeof bundle.isVisible === 'function' && bundle.isVisible() && bundleMode === 'components';
    let catalogNet = num(readString('hardwareCatalogPriceNet'));
    let catalogGross = num(readString('hardwareCatalogPriceGross'));
    let purchaseGross = 0;
    let purchaseNet = 0;
    if(bundle && typeof bundle.updatePreview === 'function') bundle.updatePreview();
    if(bundleComponentsMode){
      const totals = typeof bundle.getTotals === 'function' ? bundle.getTotals() : { catalogGross:0, purchaseGross:0 };
      catalogGross = totals.catalogGross; catalogNet = catalogGross > 0 ? grossToNet(catalogGross, vat) : 0;
      purchaseGross = totals.purchaseGross; purchaseNet = purchaseGross > 0 ? grossToNet(purchaseGross, vat) : 0;
      setValue('hardwareCatalogPriceGross', fmt(catalogGross)); setValue('hardwareCatalogPriceNet', fmt(catalogNet));
      setValue('hardwarePurchasePriceGross', fmt(purchaseGross)); setValue('hardwarePurchasePriceNet', fmt(purchaseNet));
      disableField('hardwareCatalogPriceGross', true, 'Cena katalogowa jest liczona ze składników zestawu.');
      disableField('hardwareCatalogPriceNet', true, 'Cena katalogowa jest liczona ze składników zestawu.');
      disableField('hardwareSupplierDiscountPercent', true, 'Rabat dostawcy nie działa w trybie liczenia zestawu ze składników.');
      return { catalogGross, catalogNet, purchaseGross, purchaseNet };
    }
    disableField('hardwareCatalogPriceGross', false); disableField('hardwareCatalogPriceNet', false); disableField('hardwareSupplierDiscountPercent', false);
    if(!clearPairIfSourceEmpty(sourceId)){
      if(sourceId === 'hardwareCatalogPriceNet' && catalogNet > 0){ catalogGross = netToGross(catalogNet, vat); setValue('hardwareCatalogPriceGross', fmt(catalogGross)); }
      else if(sourceId === 'hardwareCatalogPriceGross' && catalogGross > 0){ catalogNet = grossToNet(catalogGross, vat); setValue('hardwareCatalogPriceNet', fmt(catalogNet)); }
      else if(catalogGross > 0 && catalogNet <= 0){ catalogNet = grossToNet(catalogGross, vat); setValue('hardwareCatalogPriceNet', fmt(catalogNet)); }
      else if(catalogNet > 0 && catalogGross <= 0){ catalogGross = netToGross(catalogNet, vat); setValue('hardwareCatalogPriceGross', fmt(catalogGross)); }
    }
    catalogNet = num(readString('hardwareCatalogPriceNet')); catalogGross = num(readString('hardwareCatalogPriceGross'));
    purchaseGross = round2(catalogGross * (1 - discount / 100)); purchaseNet = round2(catalogNet * (1 - discount / 100));
    if(purchaseGross <= 0 && purchaseNet > 0) purchaseGross = netToGross(purchaseNet, vat);
    if(purchaseNet <= 0 && purchaseGross > 0) purchaseNet = grossToNet(purchaseGross, vat);
    setValue('hardwarePurchasePriceGross', fmt(purchaseGross)); setValue('hardwarePurchasePriceNet', fmt(purchaseNet));
    return { catalogGross, catalogNet, purchaseGross, purchaseNet };
  }

  function syncQuotePrice(sourceId, vat, pricingMode, quoteBase, catalogGross, purchaseGross){
    let baseGross = catalogGross;
    if(quoteBase === 'purchaseGross') baseGross = purchaseGross;
    if(quoteBase === 'manualGross') baseGross = num(readString('hardwareQuotePriceGross')) || catalogGross;
    let quoteGross = num(readString('hardwareQuotePriceGross'));
    let quoteNet = num(readString('hardwareQuotePriceNet'));
    if(pricingMode === 'markup'){
      const markup = num(readString('hardwareMarkupPercent'));
      quoteGross = round2(baseGross * (1 + markup / 100)); quoteNet = quoteGross > 0 ? grossToNet(quoteGross, vat) : 0;
      setValue('hardwareQuotePriceGross', fmt(quoteGross)); setValue('hardwareQuotePriceNet', fmt(quoteNet));
      disableField('hardwareMarkupPercent', false);
      disableField('hardwareQuotePriceGross', true, 'Cena do wyceny jest liczona z ceny bazowej i narzutu. Zmień tryb na Cena ręczna, aby wpisać ją ręcznie.');
      disableField('hardwareQuotePriceNet', true, 'Cena do wyceny jest liczona z ceny bazowej i narzutu.');
      setText('hardwareEffectiveMarkupPreview', 'Tryb narzutu: ' + (num(readString('hardwareMarkupPercent')) || 0).toFixed(2) + '%');
      return quoteGross;
    }
    disableField('hardwareMarkupPercent', true, 'Wyłączone, bo cena do wyceny jest wpisywana ręcznie. Narzut wynikowy jest pokazany poniżej.');
    disableField('hardwareQuotePriceGross', false); disableField('hardwareQuotePriceNet', false);
    const cleared = clearPairIfSourceEmpty(sourceId);
    quoteGross = num(readString('hardwareQuotePriceGross')); quoteNet = num(readString('hardwareQuotePriceNet'));
    if(!cleared){
      if(sourceId === 'hardwareQuotePriceNet' && quoteNet > 0){ quoteGross = netToGross(quoteNet, vat); setValue('hardwareQuotePriceGross', fmt(quoteGross)); }
      else if(sourceId === 'hardwareQuotePriceGross' && quoteGross > 0){ quoteNet = grossToNet(quoteGross, vat); setValue('hardwareQuotePriceNet', fmt(quoteNet)); }
      else if(quoteGross > 0 && quoteNet <= 0){ quoteNet = grossToNet(quoteGross, vat); setValue('hardwareQuotePriceNet', fmt(quoteNet)); }
    }
    quoteGross = num(readString('hardwareQuotePriceGross'));
    const effective = baseGross > 0 && quoteGross > 0 ? round2(((quoteGross / baseGross) - 1) * 100) : 0;
    setText('hardwareEffectiveMarkupPreview', 'Narzut wynikowy: ' + effective.toFixed(2) + '%');
    return quoteGross;
  }

  function syncHardwarePricing(opts){
    if(ctx.currentListKind && ctx.currentListKind() !== 'accessories') return;
    const cfg = Object.assign({ sourceId:'' }, opts || {});
    const vat = num(readString('hardwareVatRate')) || 23;
    const discount = num(readString('hardwareSupplierDiscountPercent'));
    const pricingMode = readString('hardwarePricingMode') || 'markup';
    const quoteBase = readString('hardwareQuoteBase') || 'catalogGross';
    const bundleMode = readString('hardwareBundleCostMode') || 'ownPrice';
    const cost = syncCatalogAndPurchase(cfg.sourceId || '', vat, discount, bundleMode);
    const quoteGross = syncQuotePrice(cfg.sourceId || '', vat, pricingMode, quoteBase, cost.catalogGross, cost.purchaseGross);
    const margin = round2((num(readString('hardwareQuotePriceGross')) || 0) - cost.purchaseGross);
    const marginPct = cost.purchaseGross > 0 ? round2((margin / cost.purchaseGross) * 100) : 0;
    setText('hardwareMarginPreview', 'Marża względem realnego zakupu: ' + margin.toFixed(2) + ' PLN brutto' + (cost.purchaseGross > 0 ? ' (' + marginPct.toFixed(2) + '%)' : ''));
    if(ctx.byId('formPrice')) ctx.byId('formPrice').value = fmt(quoteGross);
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
    const bundle = bundleApi();
    const totals = bundle && typeof bundle.getTotals === 'function' ? bundle.getTotals() : { catalogGross:0, purchaseGross:0 };
    const priceGross = num(readString('hardwareQuotePriceGross')) || num(ctx.byId('formPrice') && ctx.byId('formPrice').value);
    const supplier = findSupplier(readString('hardwareSupplierId'));
    const supplierPrices = supplierPricesApi();
    return {
      manufacturer:String((ctx.byId('formManufacturer') && ctx.byId('formManufacturer').value) || '').trim(),
      symbol:String((ctx.byId('formSymbol') && ctx.byId('formSymbol').value) || '').trim(),
      name:String((ctx.byId('formName') && ctx.byId('formName').value) || '').trim(),
      price:priceGross,
      hardwareCategory:readString('hardwareCategory') || 'Inne', hardwareType:readString('hardwareType'), hardwareUnit:readString('hardwareUnit') || 'szt.', series:readString('hardwareSeries'),
      supplierId:readString('hardwareSupplierId'), supplierName:supplier ? supplier.name : readString('hardwarePriceSource'), priceSource:readString('hardwarePriceSource') || (supplier ? supplier.name : ''),
      supplierPrices:(supplierPrices && typeof supplierPrices.getItems === 'function') ? supplierPrices.getItems() : [],
      vatRate:readNumber('hardwareVatRate'), catalogPriceNet:readNumber('hardwareCatalogPriceNet'), catalogPriceGross:readNumber('hardwareCatalogPriceGross'), supplierDiscountPercent:readNumber('hardwareSupplierDiscountPercent'),
      purchasePriceNet:readNumber('hardwarePurchasePriceNet'), purchasePriceGross:readNumber('hardwarePurchasePriceGross'), purchasePrice:readNumber('hardwarePurchasePriceGross'),
      quoteBase:readString('hardwareQuoteBase') || 'catalogGross', pricingMode:readString('hardwarePricingMode') || 'markup', markupPercent:readNumber('hardwareMarkupPercent'),
      quotePriceNet:readNumber('hardwareQuotePriceNet'), quotePriceGross:priceGross, priceUpdatedAt:readString('hardwarePriceUpdatedAt'), status:readString('hardwareStatus') || 'active', note:readString('hardwareNote'),
      bundleCostMode:(bundle && typeof bundle.isVisible === 'function' && bundle.isVisible()) ? (readString('hardwareBundleCostMode') || 'ownPrice') : 'ownPrice',
      bundleItems:(bundle && typeof bundle.isVisible === 'function' && bundle.isVisible() && typeof bundle.getItems === 'function') ? bundle.getItems() : [],
      bundleComponentsCatalogGross:(bundle && typeof bundle.isVisible === 'function' && bundle.isVisible()) ? totals.catalogGross : 0,
      bundleComponentsPurchaseGross:(bundle && typeof bundle.isVisible === 'function' && bundle.isVisible()) ? totals.purchaseGross : 0,
    };
  }

  function applyAccessoryFormState(item){
    const data = Object.assign(defaultAccessoryDraft(), item || {});
    const bundle = bundleApi();
    const supplierPrices = supplierPricesApi();
    if(bundle && typeof bundle.setItems === 'function') bundle.setItems(data.bundleItems || []);
    if(supplierPrices && typeof supplierPrices.setItems === 'function') supplierPrices.setItems(data);
    ctx.setSelectOptions(ctx.byId('formManufacturer'), ctx.buildManufacturerOptions('accessories', '', data && data.manufacturer), String(data && data.manufacturer || ''), String(data && data.manufacturer || ''));
    if(ctx.byId('formSymbol')) ctx.byId('formSymbol').value = String(data && data.symbol || '');
    if(ctx.byId('formName')) ctx.byId('formName').value = String(data && data.name || '');
    if(ctx.byId('formPrice')) ctx.byId('formPrice').value = data && data.price != null ? data.price : '';
    if(ctx.byId('formHasGrain')) ctx.byId('formHasGrain').checked = false;
    if(ctx.buildHardwareCategoryOptions) ctx.setSelectOptions(ctx.byId('hardwareCategory'), ctx.buildHardwareCategoryOptions(data && data.hardwareCategory), String(data && data.hardwareCategory || 'Inne'), String(data && data.hardwareCategory || 'Inne'));
    if(ctx.buildHardwareUnitOptions) ctx.setSelectOptions(ctx.byId('hardwareUnit'), ctx.buildHardwareUnitOptions(data && data.hardwareUnit), String(data && data.hardwareUnit || 'szt.'), String(data && data.hardwareUnit || 'szt.'));
    if(ctx.buildHardwareTypeOptions) ctx.setSelectOptions(ctx.byId('hardwareType'), ctx.buildHardwareTypeOptions(data && data.hardwareCategory, data && data.hardwareType), String(data && data.hardwareType || ''), String(data && data.hardwareType || ''));
    if(ctx.buildHardwareStatusOptions) ctx.setSelectOptions(ctx.byId('hardwareStatus'), ctx.buildHardwareStatusOptions(), String(data && data.status || 'active'), 'Aktywne');
    if(ctx.buildHardwareSupplierOptions) ctx.setSelectOptions(ctx.byId('hardwareSupplierId'), ctx.buildHardwareSupplierOptions(data && data.supplierId), String(data && data.supplierId || ''), String(data && data.supplierId || ''));
    if(ctx.buildHardwareQuoteBaseOptions) ctx.setSelectOptions(ctx.byId('hardwareQuoteBase'), ctx.buildHardwareQuoteBaseOptions(), String(data && data.quoteBase || 'catalogGross'), 'Cena katalogowa bez rabatu');
    if(ctx.buildHardwarePricingModeOptions) ctx.setSelectOptions(ctx.byId('hardwarePricingMode'), ctx.buildHardwarePricingModeOptions(), String(data && data.pricingMode || 'markup'), 'Narzut %');
    if(ctx.buildHardwareBundleCostModeOptions) ctx.setSelectOptions(ctx.byId('hardwareBundleCostMode'), ctx.buildHardwareBundleCostModeOptions(), String(data && data.bundleCostMode || 'ownPrice'), 'Własna cena zestawu');
    setValue('hardwareSeries', data && data.series || ''); setValue('hardwarePriceSource', data && data.priceSource || ''); setValue('hardwareVatRate', data && data.vatRate != null ? data.vatRate : 23);
    setValue('hardwareCatalogPriceNet', data && data.catalogPriceNet != null ? data.catalogPriceNet : ''); setValue('hardwareCatalogPriceGross', data && data.catalogPriceGross != null ? data.catalogPriceGross : '');
    setValue('hardwareSupplierDiscountPercent', data && data.supplierDiscountPercent != null ? data.supplierDiscountPercent : ''); setValue('hardwarePurchasePriceNet', data && data.purchasePriceNet != null ? data.purchasePriceNet : '');
    setValue('hardwarePurchasePriceGross', data && (data.purchasePriceGross != null ? data.purchasePriceGross : data.purchasePrice) || ''); setValue('hardwareMarkupPercent', data && data.markupPercent != null ? data.markupPercent : '');
    setValue('hardwareQuotePriceNet', data && data.quotePriceNet != null ? data.quotePriceNet : ''); setValue('hardwareQuotePriceGross', data && (data.quotePriceGross != null ? data.quotePriceGross : data.price) || '');
    setValue('hardwarePriceUpdatedAt', data && data.priceUpdatedAt || ''); setValue('hardwareNote', data && data.note || '');
    if(supplierPrices && typeof supplierPrices.applySelectedToLegacyFields === 'function') supplierPrices.applySelectedToLegacyFields();
    if(bundle && typeof bundle.render === 'function') bundle.render();
    syncHardwarePricing({ sourceId:'' });
  }

  function handleHardwareFieldInput(event){
    const target = event && event.target;
    const id = target && target.id ? String(target.id) : '';
    if(id === 'hardwareSupplierId') applySupplierDefaults();
    else {
      const bundle = bundleApi();
      if(id === 'hardwareCategory' && ctx.buildHardwareTypeOptions){
        const currentType = readString('hardwareType');
        ctx.setSelectOptions(ctx.byId('hardwareType'), ctx.buildHardwareTypeOptions(readString('hardwareCategory'), currentType), currentType, currentType);
        try{ ctx.mountChoice && ctx.mountChoice({ selectEl:ctx.byId('hardwareType'), mountId:'hardwareTypeLaunch', title:'Wybierz typ / cechę', buttonClass:'investor-choice-launch', placeholder:'Typ / cecha', onChange:()=>{ try{ ctx.updateItemActionState && ctx.updateItemActionState(); }catch(_){} } }); }catch(_){}
      }
      if((id === 'hardwareUnit' || id === 'hardwareBundleCostMode') && bundle && typeof bundle.render === 'function') bundle.render();
      syncHardwarePricing({ sourceId:id });
    }
  }

  ctx.priceModalHardwareForm = { FIELD_IDS, defaultAccessoryDraft, getCurrentAccessoryDraft, applyAccessoryFormState, syncHardwarePricing, handleHardwareFieldInput, applySupplierDefaults };
})();

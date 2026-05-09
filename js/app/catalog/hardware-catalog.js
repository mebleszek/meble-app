// js/app/catalog/hardware-catalog.js
// Model katalogu okuć/akcesoriów: producenci, dostawcy, ceny, jednostki i normalizacja pól.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const DEFAULT_MANUFACTURERS = ['Blum','GTV','Peka','Rejs','Nomet','Häfele','Sevroll','Laguna','Hettich'];
  const DEFAULT_SUPPLIERS = [
    { id:'bivert', name:'Bivert', defaultDiscountPercent:0, defaultVatRate:23, active:true },
    { id:'mago', name:'MAGO', defaultDiscountPercent:0, defaultVatRate:23, active:true },
    { id:'invoice', name:'Faktura / zakup ręczny', defaultDiscountPercent:0, defaultVatRate:23, active:true },
    { id:'local', name:'Hurtownia lokalna', defaultDiscountPercent:0, defaultVatRate:23, active:true },
  ];
  const DEFAULT_SETTINGS = {
    defaultSupplierId:'bivert',
    defaultVatRate:23,
    defaultMarkupPercent:20,
    defaultQuoteBase:'catalogGross',
    defaultPricingMode:'markup',
  };
  const CATEGORIES = ['Zawiasy','Szuflady / prowadnice','Podnośniki','Cargo / organizery','Uchwyty / profile','Nóżki / cokoły','Systemy przesuwne','LED / elektryka','AGD / montażowe akcesoria','Drobnica','Inne'];
  const UNITS = ['szt.','kpl.','mb','m²','zestaw'];
  const BUNDLE_COST_MODES = [
    { value:'ownPrice', label:'Własna cena zestawu' },
    { value:'components', label:'Licz ze składników' },
  ];
  const STATUSES = [
    { value:'active', label:'Aktywne' },
    { value:'hidden', label:'Ukryte' },
    { value:'archived', label:'Archiwalne' },
  ];
  const QUOTE_BASES = [
    { value:'catalogGross', label:'Cena katalogowa bez rabatu' },
    { value:'purchaseGross', label:'Cena zakupu po rabacie' },
    { value:'manualGross', label:'Cena ręczna' },
  ];
  const PRICING_MODES = [
    { value:'markup', label:'Narzut %' },
    { value:'manualPrice', label:'Cena ręczna' },
  ];

  function clone(value){
    try{ return (FC.utils && typeof FC.utils.clone === 'function') ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }
  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function round2(value){ const n = Number(value); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function uidFromName(name){
    const raw = text(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return raw || ('supplier_' + Date.now());
  }
  function uniqueText(list){
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).forEach((value)=>{
      const raw = text(value);
      const key = raw.toLowerCase();
      if(!raw || seen.has(key)) return;
      seen.add(key);
      out.push(raw);
    });
    return out;
  }
  function normalizeManufacturerList(list){ return uniqueText((Array.isArray(list) ? list : []).concat(DEFAULT_MANUFACTURERS)); }
  function normalizeStatus(value){
    const raw = text(value) || 'active';
    return STATUSES.some((item)=> item.value === raw) ? raw : 'active';
  }
  function normalizeUnit(value){
    const raw = text(value) || 'szt.';
    if(raw.toLowerCase() === 'para') return 'kpl.';
    return UNITS.includes(raw) ? raw : raw;
  }
  function normalizeCategory(value){ return text(value) || 'Inne'; }
  function normalizeQuoteBase(value){
    const raw = text(value) || DEFAULT_SETTINGS.defaultQuoteBase;
    return QUOTE_BASES.some((item)=> item.value === raw) ? raw : DEFAULT_SETTINGS.defaultQuoteBase;
  }
  function normalizePricingMode(value){
    const raw = text(value) || DEFAULT_SETTINGS.defaultPricingMode;
    return PRICING_MODES.some((item)=> item.value === raw) ? raw : DEFAULT_SETTINGS.defaultPricingMode;
  }
  function normalizeBundleCostMode(value){
    const raw = text(value) || 'ownPrice';
    return BUNDLE_COST_MODES.some((item)=> item.value === raw) ? raw : 'ownPrice';
  }
  function normalizeBundleItems(list, selfId){
    const selfKey = text(selfId);
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).forEach((row)=>{
      const src = row && typeof row === 'object' ? row : {};
      const itemId = text(src.itemId || src.id || src.refId);
      if(!itemId || itemId === selfKey || seen.has(itemId)) return;
      seen.add(itemId);
      const qty = Math.max(0, number(src.qty != null ? src.qty : src.quantity));
      if(qty <= 0) return;
      out.push({ itemId, qty });
    });
    return out;
  }
  function isBundleUnit(value){
    const raw = text(value).toLowerCase();
    return raw === 'zestaw';
  }
  function netToGross(value, vat){ return round2(number(value) * (1 + number(vat) / 100)); }
  function grossToNet(value, vat){ const div = 1 + number(vat) / 100; return div ? round2(number(value) / div) : round2(number(value)); }
  function calcDiscountedGross(catalogGross, discount){ return round2(number(catalogGross) * (1 - number(discount) / 100)); }
  function calcDiscountedNet(catalogNet, discount){ return round2(number(catalogNet) * (1 - number(discount) / 100)); }
  function baseGrossFor(src){
    const quoteBase = normalizeQuoteBase(src && src.quoteBase);
    if(quoteBase === 'purchaseGross') return number(src && src.purchasePriceGross);
    if(quoteBase === 'manualGross') return number(src && src.manualBaseGross);
    return number(src && src.catalogPriceGross);
  }
  function resolveQuotePrice(src){
    const pricingMode = normalizePricingMode(src && src.pricingMode);
    if(pricingMode === 'manualPrice'){
      const manual = number(src && (src.quotePriceGross != null ? src.quotePriceGross : src.price));
      return manual > 0 ? round2(manual) : 0;
    }
    const base = baseGrossFor(src);
    const markup = number(src && src.markupPercent);
    if(base > 0) return round2(base * (1 + markup / 100));
    const legacyPrice = number(src && src.price);
    if(legacyPrice > 0) return legacyPrice;
    const purchase = number(src && src.purchasePriceGross != null ? src.purchasePriceGross : src.purchasePrice);
    return purchase > 0 ? purchase : 0;
  }
  function derivedMargin(src){
    const price = number(src && src.price);
    const cost = number(src && src.purchasePriceGross);
    return round2(price - cost);
  }
  function derivedMarkupPercent(src){
    const base = baseGrossFor(src);
    const price = number(src && src.price);
    if(base <= 0 || price <= 0) return 0;
    return round2(((price / base) - 1) * 100);
  }
  function normalizeSupplier(row){
    const src = row && typeof row === 'object' ? row : { name:row };
    const name = text(src.name || src.label || src.id);
    const id = text(src.id) || uidFromName(name);
    return {
      id,
      name:name || id,
      defaultDiscountPercent:number(src.defaultDiscountPercent != null ? src.defaultDiscountPercent : src.discountPercent),
      defaultVatRate:number(src.defaultVatRate != null ? src.defaultVatRate : src.vatRate) || 23,
      active:src.active !== false,
    };
  }
  function normalizeSupplierList(list){
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).concat(DEFAULT_SUPPLIERS).forEach((row)=>{
      const item = normalizeSupplier(row);
      const key = String(item.id || '').toLowerCase();
      if(!item.name || seen.has(key)) return;
      seen.add(key);
      out.push(item);
    });
    return out;
  }
  function normalizeSettings(settings){
    const src = settings && typeof settings === 'object' ? settings : {};
    return {
      defaultSupplierId:text(src.defaultSupplierId) || DEFAULT_SETTINGS.defaultSupplierId,
      defaultVatRate:number(src.defaultVatRate) || DEFAULT_SETTINGS.defaultVatRate,
      defaultMarkupPercent:number(src.defaultMarkupPercent != null ? src.defaultMarkupPercent : DEFAULT_SETTINGS.defaultMarkupPercent),
      defaultQuoteBase:normalizeQuoteBase(src.defaultQuoteBase),
      defaultPricingMode:normalizePricingMode(src.defaultPricingMode),
    };
  }
  function normalizeAccessory(row, uidFn, settings){
    const src = row && typeof row === 'object' ? row : {};
    const cfg = normalizeSettings(settings || {});
    const uid = typeof uidFn === 'function' ? uidFn : ((prefix)=> `${prefix}_${Date.now()}`);
    const vatRate = number(src.vatRate) || cfg.defaultVatRate;
    const catalogPriceGross = number(src.catalogPriceGross != null ? src.catalogPriceGross : (src.purchaseCatalogGross != null ? src.purchaseCatalogGross : src.catalogPrice));
    const catalogPriceNet = number(src.catalogPriceNet != null ? src.catalogPriceNet : (catalogPriceGross > 0 ? grossToNet(catalogPriceGross, vatRate) : 0));
    const discountPercent = number(src.supplierDiscountPercent != null ? src.supplierDiscountPercent : src.discountPercent);
    const purchaseGross = number(src.purchasePriceGross != null ? src.purchasePriceGross : (src.purchasePrice != null ? src.purchasePrice : calcDiscountedGross(catalogPriceGross, discountPercent)));
    const purchaseNet = number(src.purchasePriceNet != null ? src.purchasePriceNet : (purchaseGross > 0 ? grossToNet(purchaseGross, vatRate) : calcDiscountedNet(catalogPriceNet, discountPercent)));
    const quoteBase = normalizeQuoteBase(src.quoteBase || cfg.defaultQuoteBase);
    const pricingMode = normalizePricingMode(src.pricingMode || cfg.defaultPricingMode);
    const markupPercent = number(src.markupPercent != null ? src.markupPercent : cfg.defaultMarkupPercent);
    const quotePriceGross = number(src.quotePriceGross != null ? src.quotePriceGross : src.price);
    const baseDraft = {
      quoteBase,
      pricingMode,
      catalogPriceGross,
      catalogPriceNet,
      purchasePriceGross:purchaseGross,
      purchasePriceNet:purchaseNet,
      manualBaseGross:number(src.manualBaseGross),
      markupPercent,
      quotePriceGross,
      price:number(src.price),
    };
    const price = resolveQuotePrice(baseDraft);
    const quotePriceNet = number(src.quotePriceNet != null ? src.quotePriceNet : (price > 0 ? grossToNet(price, vatRate) : 0));
    const supplierId = text(src.supplierId) || cfg.defaultSupplierId;
    return {
      id:text(src.id) || uid('a'),
      manufacturer:text(src.manufacturer),
      symbol:text(src.symbol),
      name:text(src.name),
      price,
      hardwareCategory:normalizeCategory(src.hardwareCategory || src.category || ''),
      hardwareUnit:normalizeUnit(src.hardwareUnit || src.unit || 'szt.'),
      series:text(src.series),
      supplierId,
      priceSource:text(src.priceSource || src.supplierName || supplierId),
      vatRate,
      catalogPriceNet,
      catalogPriceGross,
      supplierDiscountPercent:discountPercent,
      purchasePriceNet:purchaseNet,
      purchasePriceGross:purchaseGross,
      purchasePrice:purchaseGross,
      quoteBase,
      pricingMode,
      markupPercent,
      quotePriceNet,
      quotePriceGross:price,
      marginGross:derivedMargin({ price, purchasePriceGross:purchaseGross }),
      effectiveMarkupPercent:derivedMarkupPercent(Object.assign({}, baseDraft, { price })),
      priceUpdatedAt:text(src.priceUpdatedAt),
      status:normalizeStatus(src.status),
      note:text(src.note),
      bundleCostMode:normalizeBundleCostMode(src.bundleCostMode),
      bundleItems:normalizeBundleItems(src.bundleItems, src.id),
      bundleComponentsCatalogGross:number(src.bundleComponentsCatalogGross),
      bundleComponentsPurchaseGross:number(src.bundleComponentsPurchaseGross),
    };
  }
  function statusLabel(value){
    const row = STATUSES.find((item)=> item.value === value);
    return row ? row.label : 'Aktywne';
  }
  function unitOptions(selected){
    const out = UNITS.map((value)=>({ value, label:value }));
    if(selected && !UNITS.includes(String(selected))) out.push({ value:String(selected), label:String(selected) });
    return out;
  }
  function statusOptions(){ return clone(STATUSES); }
  function categoryOptions(dynamic, selected){
    const base = CATEGORIES.concat(Array.isArray(dynamic) ? dynamic : []);
    if(selected) base.push(selected);
    return uniqueText(base).map((value)=>({ value, label:value }));
  }
  function supplierOptions(list, selected, includeAll){
    const suppliers = normalizeSupplierList(list || DEFAULT_SUPPLIERS);
    const opts = includeAll ? [{ value:'', label:'Wszyscy dostawcy' }] : [];
    suppliers.forEach((supplier)=> opts.push({ value:supplier.id, label:supplier.name }));
    if(selected && !opts.some((opt)=> String(opt.value) === String(selected))) opts.push({ value:String(selected), label:String(selected) });
    return opts;
  }
  function pricingModeOptions(){ return clone(PRICING_MODES); }
  function quoteBaseOptions(){ return clone(QUOTE_BASES); }

  FC.hardwareCatalog = {
    DEFAULT_MANUFACTURERS,
    DEFAULT_SUPPLIERS,
    DEFAULT_SETTINGS,
    CATEGORIES,
    UNITS,
    STATUSES,
    QUOTE_BASES,
    PRICING_MODES,
    BUNDLE_COST_MODES,
    normalizeManufacturerList,
    normalizeSupplier,
    normalizeSupplierList,
    normalizeSettings,
    normalizeAccessory,
    normalizeStatus,
    normalizeUnit,
    normalizeCategory,
    normalizeQuoteBase,
    normalizePricingMode,
    normalizeBundleCostMode,
    normalizeBundleItems,
    isBundleUnit,
    resolveQuotePrice,
    statusLabel,
    unitOptions,
    statusOptions,
    categoryOptions,
    supplierOptions,
    pricingModeOptions,
    quoteBaseOptions,
    bundleCostModeOptions(){ return clone(BUNDLE_COST_MODES); },
    netToGross,
    grossToNet,
    calcDiscountedGross,
    calcDiscountedNet,
    derivedMarkupPercent,
    derivedMargin,
  };
})();

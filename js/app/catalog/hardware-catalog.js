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
  const DEFAULT_CATEGORIES = ['Zawiasy','Szuflady / prowadnice','Podnośniki','Cargo / organizery','Uchwyty / profile','Nóżki / cokoły','Systemy przesuwne','LED / elektryka','AGD / montażowe akcesoria','Drobnica','Inne'];
  const CATEGORIES = DEFAULT_CATEGORIES;
  const DEFAULT_TYPES = [
    { id:'hinge_110_overlay', name:'110° nakładany', allowedCategories:['Zawiasy'], active:true },
    { id:'hinge_110_inset', name:'110° wpuszczany', allowedCategories:['Zawiasy'], active:true },
    { id:'hinge_155_zero', name:'155° zerowy uskok', allowedCategories:['Zawiasy'], active:true },
    { id:'hinge_170_corner', name:'170° narożny', allowedCategories:['Zawiasy'], active:true },
    { id:'drawer_m', name:'Szuflada M', allowedCategories:['Szuflady / prowadnice'], active:true },
    { id:'drawer_k', name:'Szuflada K', allowedCategories:['Szuflady / prowadnice'], active:true },
    { id:'runner_l500', name:'Prowadnica L500', allowedCategories:['Szuflady / prowadnice'], active:true },
    { id:'cargo_150', name:'Cargo 150', allowedCategories:['Cargo / organizery'], active:true },
    { id:'cargo_200', name:'Cargo 200', allowedCategories:['Cargo / organizery'], active:true },
    { id:'magic_corner', name:'Magic corner', allowedCategories:['Cargo / organizery'], active:true },
  ];
  const PRICE_STATUSES = [
    { value:'current', label:'Aktualna' },
    { value:'review', label:'Do sprawdzenia' },
    { value:'old', label:'Stara' },
    { value:'archived', label:'Archiwalna' },
  ];
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
  function safePart(value){ return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || ''; }
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
  function normalizeCategoryList(list){ return uniqueText((Array.isArray(list) ? list : []).concat(DEFAULT_CATEGORIES)); }
  function typeIdFromName(name){ return uidFromName(name || 'typ'); }
  function normalizeTypeDefinition(row){
    const src = row && typeof row === 'object' ? row : { name:row };
    const name = text(src.name || src.label || src.value || src.id);
    const id = text(src.id) || typeIdFromName(name);
    const allowed = uniqueText(Array.isArray(src.allowedCategories) ? src.allowedCategories : (Array.isArray(src.categories) ? src.categories : (text(src.category) ? [src.category] : [])));
    return { id, name:name || id, allowedCategories:allowed.length ? allowed : DEFAULT_CATEGORIES.slice(), active:src.active !== false };
  }
  function normalizeTypeList(list){
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).concat(DEFAULT_TYPES).forEach((row)=>{
      const item = normalizeTypeDefinition(row);
      const key = text(item.id).toLowerCase();
      if(!item.name || seen.has(key)) return;
      seen.add(key); out.push(item);
    });
    return out;
  }
  function normalizePriceStatus(value){
    const raw = text(value) || 'current';
    if(PRICE_STATUSES.some((item)=> item.value === raw)) return raw;
    const lower = raw.toLowerCase();
    if(['aktualna','aktualne','current','active'].includes(lower)) return 'current';
    if(['do sprawdzenia','sprawdzic','review'].includes(lower)) return 'review';
    if(['stara','stare','old'].includes(lower)) return 'old';
    if(['archiwalna','archiwalne','archived'].includes(lower)) return 'archived';
    return 'current';
  }
  function priceStatusOptions(){ return clone(PRICE_STATUSES); }
  function typeOptions(list, category, selected){
    const cat = text(category);
    const opts = [];
    normalizeTypeList(list || []).forEach((row)=>{
      const allowed = Array.isArray(row.allowedCategories) ? row.allowedCategories.map(text) : [];
      if(row.active === false) return;
      if(cat && allowed.length && !allowed.includes(cat) && text(row.name) !== text(selected)) return;
      opts.push({ value:row.name, label:row.name });
    });
    if(selected && !opts.some((opt)=> text(opt.value) === text(selected))) opts.push({ value:text(selected), label:text(selected) });
    return opts;
  }
  function uniqueTypeConflict(list, candidate, currentId){
    const c = candidate || {}; const key = [text(c.manufacturer).toLowerCase(), text(c.hardwareCategory).toLowerCase(), text(c.hardwareType).toLowerCase()].join('|');
    if(!text(c.manufacturer) || !text(c.hardwareCategory) || !text(c.hardwareType)) return null;
    return (Array.isArray(list) ? list : []).find((row)=> text(row && row.id) !== text(currentId) && [text(row && row.manufacturer).toLowerCase(), text(row && row.hardwareCategory).toLowerCase(), text(row && row.hardwareType).toLowerCase()].join('|') === key) || null;
  }
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
  function supplierPriceHasCatalogPrice(row){
    return number(row && row.catalogPriceNet) > 0 || number(row && row.catalogPriceGross) > 0;
  }
  function supplierFromList(suppliers, supplierId){
    const key = text(supplierId).toLowerCase();
    return (Array.isArray(suppliers) ? suppliers : []).find((row)=> text(row && row.id).toLowerCase() === key || text(row && row.name).toLowerCase() === key) || null;
  }
  function supplierFromName(suppliers, supplierName){
    const raw = text(supplierName);
    const key = raw.toLowerCase();
    const safe = safePart(raw);
    if(!key) return null;
    return (Array.isArray(suppliers) ? suppliers : []).find((row)=>{
      const name = text(row && row.name);
      return name.toLowerCase() === key || (safe && safePart(name) === safe);
    }) || null;
  }
  function resolveSupplierForPrice(suppliers, src){
    const source = src && typeof src === 'object' ? src : {};
    const byName = supplierFromName(suppliers, source.supplierName || source.dostawca || source.nazwa_dostawcy);
    const byId = supplierFromList(suppliers, source.supplierId || source.dostawca_id);
    return byName || byId || null;
  }
  function isSpreadsheetError(value){
    const raw = text(value).toUpperCase();
    return /^#(REF|VALUE|DIV\/0|NAME\?|N\/A|NUM|NULL)!?$/.test(raw);
  }
  function hasNumericInput(value){ return text(value) !== '' && !isSpreadsheetError(value) && number(value) > 0; }
  function normalizeSupplierPrice(row, suppliers, fallbackSupplierId){
    const src = row && typeof row === 'object' ? row : {};
    const resolved = resolveSupplierForPrice(suppliers, src) || null;
    const rawSupplier = text(src.supplierName || src.dostawca || src.nazwa_dostawcy || src.supplierId || src.dostawca_id) || text(fallbackSupplierId);
    const supplierId = text(resolved && resolved.id) || rawSupplier;
    if(!supplierId) return null;
    const rawNet = src.catalogPriceNet != null ? src.catalogPriceNet : (src.cena_netto != null ? src.cena_netto : src.net);
    const rawGross = src.catalogPriceGross != null ? src.catalogPriceGross : (src.cena_brutto != null ? src.cena_brutto : src.gross);
    let catalogPriceNet = hasNumericInput(rawNet) ? number(rawNet) : 0;
    let catalogPriceGross = hasNumericInput(rawGross) ? number(rawGross) : 0;
    const vat = number(resolved && resolved.defaultVatRate) || 23;
    if(catalogPriceNet > 0 && catalogPriceGross <= 0) catalogPriceGross = netToGross(catalogPriceNet, vat);
    if(catalogPriceGross > 0 && catalogPriceNet <= 0) catalogPriceNet = grossToNet(catalogPriceGross, vat);
    const entered = text(src.enteredPriceType || src.entered_price_type || src.priceType || src.typ_ceny);
    const enteredFallback = hasNumericInput(rawNet) ? 'net' : (hasNumericInput(rawGross) ? 'gross' : '');
    return {
      supplierId,
      catalogPriceNet,
      catalogPriceGross,
      enteredPriceType:entered || enteredFallback,
      priceDate:text(src.priceDate || src.priceUpdatedAt || src.data_ceny || src.date),
      priceStatus:normalizePriceStatus(src.priceStatus || src.status_ceny || src.statusCeny || src.status),
      useForQuote:src.useForQuote === true || ['tak','true','1','yes','y'].includes(text(src.useForQuote != null ? src.useForQuote : src.do_wyceny).toLowerCase()),
    };
  }
  function normalizeSupplierPrices(list, legacy, suppliers, settings){
    const cfg = normalizeSettings(settings || {});
    const source = legacy && typeof legacy === 'object' ? legacy : {};
    const supplierList = normalizeSupplierList(Array.isArray(suppliers) ? suppliers : []);
    const rows = [];
    (Array.isArray(list) ? list : []).forEach((row)=>{
      const normalized = normalizeSupplierPrice(row, supplierList, source.supplierId || cfg.defaultSupplierId);
      if(normalized && supplierPriceHasCatalogPrice(normalized)) rows.push(normalized);
    });
    if(!rows.length){
      const legacyNet = source.catalogPriceNet;
      const legacyGross = source.catalogPriceGross != null ? source.catalogPriceGross : (source.purchaseCatalogGross != null ? source.purchaseCatalogGross : source.catalogPrice);
      if(number(legacyNet) > 0 || number(legacyGross) > 0){
        const legacyRow = normalizeSupplierPrice({
          supplierId:source.supplierId || cfg.defaultSupplierId,
          catalogPriceNet:legacyNet,
          catalogPriceGross:legacyGross,
          priceDate:source.priceUpdatedAt,
          useForQuote:true,
          enteredPriceType:text(legacyNet) ? 'net' : 'gross'
        }, supplierList, cfg.defaultSupplierId);
        if(legacyRow) rows.push(legacyRow);
      }
    }
    const bySupplier = new Map();
    rows.forEach((row)=>{
      const key = text(row && row.supplierId).toLowerCase();
      if(!key) return;
      bySupplier.set(key, Object.assign({}, bySupplier.get(key) || {}, row));
    });
    const out = Array.from(bySupplier.values());
    let quoteIndex = -1;
    out.forEach((row, index)=>{ if(row.useForQuote) quoteIndex = index; });
    if(quoteIndex < 0 && out.length === 1 && supplierPriceHasCatalogPrice(out[0])) quoteIndex = 0;
    if(quoteIndex < 0 && text(source.supplierId)) quoteIndex = out.findIndex((row)=> text(row.supplierId) === text(source.supplierId));
    out.forEach((row, index)=>{ row.useForQuote = index === quoteIndex && quoteIndex >= 0; });
    return out;
  }
  function getQuoteSupplierPrice(list){
    const rows = Array.isArray(list) ? list : [];
    return rows.find((row)=> row && row.useForQuote && supplierPriceHasCatalogPrice(row)) || rows.find((row)=> row && row.useForQuote) || rows.find(supplierPriceHasCatalogPrice) || rows[0] || null;
  }
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
    const supplierList = normalizeSupplierList(Array.isArray(settings && settings.hardwareSuppliers) ? settings.hardwareSuppliers : (Array.isArray(settings && settings.suppliers) ? settings.suppliers : []));
    const uid = typeof uidFn === 'function' ? uidFn : ((prefix)=> `${prefix}_${Date.now()}`);
    const supplierPrices = normalizeSupplierPrices(src.supplierPrices, src, supplierList, cfg);
    const quoteSupplierPrice = getQuoteSupplierPrice(supplierPrices) || {};
    const supplierId = text(quoteSupplierPrice.supplierId || src.supplierId) || cfg.defaultSupplierId;
    const supplier = supplierFromList(supplierList, supplierId) || {};
    const vatRate = number(src.vatRate) || number(supplier.defaultVatRate) || cfg.defaultVatRate;
    const catalogPriceGross = number(quoteSupplierPrice.catalogPriceGross != null ? quoteSupplierPrice.catalogPriceGross : (src.catalogPriceGross != null ? src.catalogPriceGross : (src.purchaseCatalogGross != null ? src.purchaseCatalogGross : src.catalogPrice)));
    const catalogPriceNet = number(quoteSupplierPrice.catalogPriceNet != null ? quoteSupplierPrice.catalogPriceNet : (src.catalogPriceNet != null ? src.catalogPriceNet : (catalogPriceGross > 0 ? grossToNet(catalogPriceGross, vatRate) : 0)));
    const normalizedCatalogGross = catalogPriceGross > 0 ? catalogPriceGross : (catalogPriceNet > 0 ? netToGross(catalogPriceNet, vatRate) : 0);
    const normalizedCatalogNet = catalogPriceNet > 0 ? catalogPriceNet : (normalizedCatalogGross > 0 ? grossToNet(normalizedCatalogGross, vatRate) : 0);
    const discountPercent = number(src.supplierDiscountPercent != null ? src.supplierDiscountPercent : (src.discountPercent != null ? src.discountPercent : supplier.defaultDiscountPercent));
    const purchaseGross = calcDiscountedGross(normalizedCatalogGross, discountPercent);
    const purchaseNet = calcDiscountedNet(normalizedCatalogNet, discountPercent);
    const quoteBase = normalizeQuoteBase(src.quoteBase || cfg.defaultQuoteBase);
    const pricingMode = normalizePricingMode(src.pricingMode || cfg.defaultPricingMode);
    const markupPercent = number(src.markupPercent != null ? src.markupPercent : cfg.defaultMarkupPercent);
    const quotePriceGross = number(src.quotePriceGross != null ? src.quotePriceGross : src.price);
    const baseDraft = {
      quoteBase,
      pricingMode,
      catalogPriceGross:normalizedCatalogGross,
      catalogPriceNet:normalizedCatalogNet,
      purchasePriceGross:purchaseGross,
      purchasePriceNet:purchaseNet,
      manualBaseGross:number(src.manualBaseGross),
      markupPercent,
      quotePriceGross,
      price:number(src.price),
    };
    const price = resolveQuotePrice(baseDraft);
    const quotePriceNet = number(src.quotePriceNet != null ? src.quotePriceNet : (price > 0 ? grossToNet(price, vatRate) : 0));
    return {
      id:text(src.id) || uid('a'),
      manufacturer:text(src.manufacturer),
      symbol:text(src.symbol),
      name:text(src.name),
      price,
      hardwareCategory:normalizeCategory(src.hardwareCategory || src.category || ''),
      hardwareType:text(src.hardwareType || src.typeFeature || src.typ_cecha || src.typ || ''),
      hardwareUnit:normalizeUnit(src.hardwareUnit || src.unit || 'szt.'),
      series:text(src.series),
      supplierId,
      priceSource:text(text(quoteSupplierPrice.supplierId) ? ((supplier && supplier.name) || quoteSupplierPrice.supplierName || src.priceSource || supplierId) : (src.priceSource || src.supplierName || (supplier && supplier.name) || supplierId)),
      supplierPrices,
      vatRate,
      catalogPriceNet:normalizedCatalogNet,
      catalogPriceGross:normalizedCatalogGross,
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
      priceUpdatedAt:text(quoteSupplierPrice.priceDate || src.priceUpdatedAt),
      priceStatus:normalizePriceStatus(quoteSupplierPrice.priceStatus || src.priceStatus || src.status_ceny),
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
    DEFAULT_CATEGORIES,
    DEFAULT_TYPES,
    PRICE_STATUSES,
    CATEGORIES,
    UNITS,
    STATUSES,
    QUOTE_BASES,
    PRICING_MODES,
    BUNDLE_COST_MODES,
    normalizeManufacturerList,
    normalizeCategoryList,
    normalizeTypeDefinition,
    normalizeTypeList,
    normalizePriceStatus,
    priceStatusOptions,
    typeOptions,
    uniqueTypeConflict,
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
    normalizeSupplierPrices,
    normalizeSupplierPrice,
    getQuoteSupplierPrice,
    supplierPriceHasCatalogPrice,
    supplierFromList,
    supplierFromName,
    resolveSupplierForPrice,
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

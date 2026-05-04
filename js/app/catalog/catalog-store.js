(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const KEYS = (FC.constants && FC.constants.STORAGE_KEYS) || {};
  const storage = FC.storage || {
    getJSON(_key, fallback){ return JSON.parse(JSON.stringify(fallback)); },
    setJSON(){ }
  };
  const domain = FC.catalogDomain || {};
  const migration = FC.catalogMigration || {};
  const serviceOrderStore = FC.serviceOrderStore || null;
  const laborCatalog = FC.laborCatalog || null;
  const hardwareCatalog = FC.hardwareCatalog || null;

  const DEFAULT_SHEET_MATERIALS = [
    { id:'m1', materialType:'laminat', manufacturer:'Egger', symbol:'W1100', name:'Egger W1100 ST9 Biały Alpejski', price:35, hasGrain:false },
    { id:'m2', materialType:'akryl', manufacturer:'Rehau', symbol:'A01', name:'Akryl Biały', price:180, hasGrain:false },
  ];
  const DEFAULT_ACCESSORIES = [
    { id:'a1', manufacturer:'Blum', symbol:'B1', name:'Zawias Blum', price:18, hardwareCategory:'Zawiasy', hardwareUnit:'szt.', series:'', purchasePrice:0, markupPercent:0, priceSource:'', priceUpdatedAt:'', status:'active', note:'' },
  ];
  const DEFAULT_HARDWARE_MANUFACTURERS = hardwareCatalog && Array.isArray(hardwareCatalog.DEFAULT_MANUFACTURERS)
    ? hardwareCatalog.DEFAULT_MANUFACTURERS.slice()
    : ['Blum','GTV','Peka','Rejs','Nomet','Häfele','Sevroll','Laguna','Hettich'];
  const DEFAULT_QUOTE_RATES = laborCatalog && Array.isArray(laborCatalog.DEFAULT_HOURLY_RATES)
    ? laborCatalog.DEFAULT_HOURLY_RATES.concat(laborCatalog.DEFAULT_LABOR_DEFINITIONS || [])
    : [
        { id:'labor_rate_workshop', category:'Stawki godzinowe', name:'Stawka warsztatowa', price:120, autoRole:'hourlyRate', rateKey:'workshop', active:true },
        { id:'labor_rate_assembly', category:'Stawki godzinowe', name:'Stawka montażowa', price:140, autoRole:'hourlyRate', rateKey:'assembly', active:true },
        { id:'labor_rate_helper', category:'Stawki godzinowe', name:'Stawka pomocnika', price:60, autoRole:'hourlyRate', rateKey:'helper', active:true },
        { id:'labor_rate_specialist', category:'Stawki godzinowe', name:'Stawka specjalistyczna', price:180, autoRole:'hourlyRate', rateKey:'specialist', active:true },
        { id:'labor_body_h072', category:'Korpusy', name:'Skręcenie korpusu do 72 cm', price:0, usage:'cabinet', autoRole:'cabinetBody', rateType:'workshop', timeBlockHours:0.5, defaultMultiplier:1.25, heightMinMm:0, heightMaxMm:720, volumePricePerM3:50, active:true, internalOnly:true },
      ];
  const DEFAULT_WORKSHOP_SERVICES = [
    { id:'ws1', category:'Cięcie', name:'Przycięcie płyty', price:25 },
  ];
  const DEFAULT_SERVICE_ORDERS = [];

  const PRICE_LIST_CONFIG = (domain && domain.PRICE_LIST_CONFIG) || {
    materials: { key:'materials', storageKey:'sheetMaterials', title:'Materiały', subtitle:'', addLabel:'Dodaj materiał', icon:'🧩', formKind:'material' },
    accessories: { key:'accessories', storageKey:'accessories', title:'Akcesoria', subtitle:'', addLabel:'Dodaj akcesorium', icon:'🧷', formKind:'accessory' },
    quoteRates: { key:'quoteRates', storageKey:'quoteRates', title:'Stawki wyceny mebli', subtitle:'', addLabel:'Dodaj stawkę', icon:'💲', formKind:'service' },
    workshopServices: { key:'workshopServices', storageKey:'workshopServices', title:'Usługi stolarskie', subtitle:'', addLabel:'Dodaj usługę', icon:'🔧', formKind:'service' },
  };

  function clone(value){
    try{ return (FC.utils && FC.utils.clone) ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function uid(prefix){
    try{ return (FC.utils && typeof FC.utils.uid === 'function') ? FC.utils.uid() : ((prefix || 'id') + '_' + Date.now()); }
    catch(_){ return (prefix || 'id') + '_' + Date.now(); }
  }

  function readList(key, fallback){
    return storage && typeof storage.getJSON === 'function'
      ? storage.getJSON(KEYS[key] || key, fallback)
      : clone(fallback);
  }

  function writeList(key, list){
    try{
      if(storage && typeof storage.setJSON === 'function') storage.setJSON(KEYS[key] || key, list);
    }catch(_){ }
    return list;
  }

  function normalizeText(value){ return String(value == null ? '' : value).trim(); }

  function normalizeMaterialRow(row){
    const src = row && typeof row === 'object' ? row : {};
    return {
      id: normalizeText(src.id) || uid('m'),
      materialType: normalizeText(src.materialType) || 'laminat',
      manufacturer: normalizeText(src.manufacturer),
      symbol: normalizeText(src.symbol),
      name: normalizeText(src.name),
      price: Number(src.price) || 0,
      hasGrain: !!src.hasGrain,
    };
  }

  function normalizeAccessoryRow(row){
    try{
      if(hardwareCatalog && typeof hardwareCatalog.normalizeAccessory === 'function') return hardwareCatalog.normalizeAccessory(row, uid);
    }catch(_){ }
    const src = row && typeof row === 'object' ? row : {};
    return {
      id: normalizeText(src.id) || uid('a'),
      manufacturer: normalizeText(src.manufacturer),
      symbol: normalizeText(src.symbol),
      name: normalizeText(src.name),
      price: Number(src.price) || 0,
      hardwareCategory: normalizeText(src.hardwareCategory || src.category) || 'Inne',
      hardwareUnit: normalizeText(src.hardwareUnit || src.unit) || 'szt.',
      series: normalizeText(src.series),
      purchasePrice: Number(src.purchasePrice) || 0,
      markupPercent: Number(src.markupPercent) || 0,
      priceSource: normalizeText(src.priceSource),
      priceUpdatedAt: normalizeText(src.priceUpdatedAt),
      status: normalizeText(src.status) || 'active',
      note: normalizeText(src.note),
    };
  }

  function normalizeHardwareManufacturers(list){
    try{
      if(hardwareCatalog && typeof hardwareCatalog.normalizeManufacturerList === 'function') return hardwareCatalog.normalizeManufacturerList(list);
    }catch(_){ }
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).concat(DEFAULT_HARDWARE_MANUFACTURERS).forEach((value)=>{
      const raw = normalizeText(value);
      const key = raw.toLowerCase();
      if(!raw || seen.has(key)) return;
      seen.add(key);
      out.push(raw);
    });
    return out;
  }

  function normalizeServiceRow(row){
    const src = row && typeof row === 'object' ? row : {};
    const base = Object.assign({}, src, {
      id: normalizeText(src.id) || uid('s'),
      category: normalizeText(src.category) || 'Inne',
      name: normalizeText(src.name),
      price: Number(src.price) || 0,
    });
    try{
      if(laborCatalog && typeof laborCatalog.normalizeDefinition === 'function') return laborCatalog.normalizeDefinition(base);
    }catch(_){ }
    return base;
  }

  function normalizeServiceOrderRow(row){
    try{
      if(serviceOrderStore && typeof serviceOrderStore.normalizeOrder === 'function') return serviceOrderStore.normalizeOrder(row);
    }catch(_){ }
    const src = row && typeof row === 'object' ? row : {};
    const now = Date.now();
    return {
      id: normalizeText(src.id) || uid('so'),
      title: normalizeText(src.title) || 'Nowe zlecenie',
      customerName: normalizeText(src.customerName),
      phone: normalizeText(src.phone),
      city: normalizeText(src.city),
      description: normalizeText(src.description),
      status: normalizeText(src.status) || 'nowe',
      addedDate: normalizeText(src.addedDate) || (()=>{ try{ return new Date(now).toISOString().slice(0, 10); }catch(_){ return ''; } })(),
      updatedAt: Number(src.updatedAt) || now,
    };
  }

  function normalizeList(list, rowNormalizer, fallback){
    const arr = Array.isArray(list) ? list : clone(fallback || []);
    return arr.map((row)=> rowNormalizer(row)).filter((row)=> !!normalizeText(row.name || row.title));
  }

  function resolvePreferStoredSplit(arg){
    if(arg && typeof arg === 'object' && Object.prototype.hasOwnProperty.call(arg, 'preferStoredSplit')) return !!arg.preferStoredSplit;
    if(typeof arg === 'boolean'){
      // Backward compatibility: old signature was preferLegacy. false meant keep split keys, true meant rebuild from legacy.
      return !arg;
    }
    return false;
  }

  function splitLegacyMaterials(list){
    try{
      if(domain && typeof domain.splitLegacyMaterials === 'function') return domain.splitLegacyMaterials(list);
    }catch(_){ }
    const rows = normalizeList(list, normalizeMaterialRow, DEFAULT_SHEET_MATERIALS);
    const out = { sheetMaterials:[], accessories:[] };
    rows.forEach((row)=>{
      if(String(row.materialType || '').trim().toLowerCase() === 'akcesoria') out.accessories.push({ id:row.id, manufacturer:row.manufacturer, symbol:row.symbol, name:row.name, price:row.price });
      else out.sheetMaterials.push(row);
    });
    return out;
  }

  function migrateLegacy(options){
    const preferStoredSplit = resolvePreferStoredSplit(options);
    const legacyDefaults = DEFAULT_SHEET_MATERIALS.concat(DEFAULT_ACCESSORIES.map((row)=> Object.assign({ materialType:'akcesoria', hasGrain:false }, row)));
    const legacyMaterials = normalizeList(readList('materials', legacyDefaults), normalizeMaterialRow, legacyDefaults);
    const legacyServices = normalizeList(readList('services', DEFAULT_QUOTE_RATES), normalizeServiceRow, DEFAULT_QUOTE_RATES);

    const seeds = migration && typeof migration.buildSeeds === 'function'
      ? migration.buildSeeds({
          preferStoredSplit,
          legacyMaterials,
          legacyServices,
          storedSheetMaterials: readList('sheetMaterials', null),
          storedAccessories: readList('accessories', null),
          storedQuoteRates: readList('quoteRates', null),
          storedWorkshopServices: readList('workshopServices', null),
          storedServiceOrders: readList('serviceOrders', null),
          storedHardwareManufacturers: readList('hardwareManufacturers', null),
          defaults: {
            sheetMaterials: DEFAULT_SHEET_MATERIALS,
            accessories: DEFAULT_ACCESSORIES,
            quoteRates: DEFAULT_QUOTE_RATES,
            workshopServices: DEFAULT_WORKSHOP_SERVICES,
            serviceOrders: DEFAULT_SERVICE_ORDERS,
            hardwareManufacturers: DEFAULT_HARDWARE_MANUFACTURERS,
          },
          splitLegacyMaterials,
        })
      : {
          sheetMaterials: preferStoredSplit ? readList('sheetMaterials', DEFAULT_SHEET_MATERIALS) : splitLegacyMaterials(legacyMaterials).sheetMaterials,
          accessories: preferStoredSplit ? readList('accessories', DEFAULT_ACCESSORIES) : splitLegacyMaterials(legacyMaterials).accessories,
          quoteRates: preferStoredSplit ? readList('quoteRates', DEFAULT_QUOTE_RATES) : legacyServices,
          workshopServices: readList('workshopServices', DEFAULT_WORKSHOP_SERVICES),
          serviceOrders: readList('serviceOrders', DEFAULT_SERVICE_ORDERS),
        };

    const sheetMaterials = normalizeList(seeds.sheetMaterials, normalizeMaterialRow, DEFAULT_SHEET_MATERIALS).filter((row)=> String(row.materialType || '').trim().toLowerCase() !== 'akcesoria');
    const accessories = normalizeList(seeds.accessories, normalizeAccessoryRow, DEFAULT_ACCESSORIES);
    const quoteRateSeed = laborCatalog && typeof laborCatalog.ensureDefaultDefinitions === 'function'
      ? laborCatalog.ensureDefaultDefinitions(seeds.quoteRates)
      : seeds.quoteRates;
    const quoteRates = normalizeList(quoteRateSeed, normalizeServiceRow, DEFAULT_QUOTE_RATES);
    const workshopServices = normalizeList(seeds.workshopServices, normalizeServiceRow, DEFAULT_WORKSHOP_SERVICES);
    const serviceOrders = normalizeList(seeds.serviceOrders, normalizeServiceOrderRow, DEFAULT_SERVICE_ORDERS);
    const storedManufacturers = readList('hardwareManufacturers', DEFAULT_HARDWARE_MANUFACTURERS);
    const manufacturerSeed = Array.isArray(seeds.hardwareManufacturers) ? seeds.hardwareManufacturers : storedManufacturers;
    const hardwareManufacturers = normalizeHardwareManufacturers(manufacturerSeed.concat(accessories.map((row)=> row && row.manufacturer)));

    writeList('sheetMaterials', sheetMaterials);
    writeList('accessories', accessories);
    writeList('quoteRates', quoteRates);
    writeList('workshopServices', workshopServices);
    writeList('hardwareManufacturers', hardwareManufacturers);
    try{
      if(serviceOrderStore && typeof serviceOrderStore.writeAll === 'function') serviceOrderStore.writeAll(serviceOrders);
      else writeList('serviceOrders', serviceOrders);
    }catch(_){ writeList('serviceOrders', serviceOrders); }

    // Legacy compatibility while old modules still read these keys.
    writeList('materials', sheetMaterials);
    writeList('services', quoteRates);

    cache = { sheetMaterials, accessories, quoteRates, workshopServices, serviceOrders, hardwareManufacturers };
    syncRuntimeGlobals();
    return { sheetMaterials, accessories, quoteRates, workshopServices, serviceOrders, hardwareManufacturers };
  }

  let cache = { sheetMaterials:[], accessories:[], quoteRates:[], workshopServices:[], serviceOrders:[], hardwareManufacturers:[] };

  function syncRuntimeGlobals(){
    try{ if(typeof materials !== 'undefined') materials = cache.sheetMaterials.slice(); }catch(_){ }
    try{ if(typeof services !== 'undefined') services = cache.quoteRates.slice(); }catch(_){ }
    try{ window.materials = cache.sheetMaterials.slice(); }catch(_){ }
    try{ window.services = cache.quoteRates.slice(); }catch(_){ }
  }

  cache = migrateLegacy(false);

  function getPriceList(kind){
    const key = String(kind || 'materials');
    if(key === 'materials') return cache.sheetMaterials.slice();
    if(key === 'accessories') return cache.accessories.slice();
    if(key === 'quoteRates') return cache.quoteRates.slice();
    if(key === 'workshopServices') return cache.workshopServices.slice();
    return [];
  }

  // Compatibility getters used by catalog selectors and quote calculators.
  // Keep them as thin aliases so UI modules do not need to know storage keys.
  function getSheetMaterials(){ return getPriceList('materials'); }
  function getAccessories(){ return getPriceList('accessories'); }
  function getQuoteRates(){ return getPriceList('quoteRates'); }
  function getWorkshopServices(){ return getPriceList('workshopServices'); }
  function getHardwareManufacturers(){ return (cache.hardwareManufacturers || []).slice(); }
  function saveHardwareManufacturers(list){
    cache.hardwareManufacturers = normalizeHardwareManufacturers(list);
    writeList('hardwareManufacturers', cache.hardwareManufacturers);
    return getHardwareManufacturers();
  }

  function savePriceList(kind, list){
    const key = String(kind || 'materials');
    if(key === 'materials'){
      cache.sheetMaterials = normalizeList(list, normalizeMaterialRow, DEFAULT_SHEET_MATERIALS).filter((row)=> String(row.materialType || '').trim().toLowerCase() !== 'akcesoria');
      writeList('sheetMaterials', cache.sheetMaterials);
      writeList('materials', cache.sheetMaterials);
    }
    else if(key === 'accessories'){
      cache.accessories = normalizeList(list, normalizeAccessoryRow, DEFAULT_ACCESSORIES);
      cache.hardwareManufacturers = normalizeHardwareManufacturers((cache.hardwareManufacturers || []).concat(cache.accessories.map((row)=> row && row.manufacturer)));
      writeList('accessories', cache.accessories);
      writeList('hardwareManufacturers', cache.hardwareManufacturers);
    }
    else if(key === 'quoteRates'){
      cache.quoteRates = normalizeList(list, normalizeServiceRow, DEFAULT_QUOTE_RATES);
      writeList('quoteRates', cache.quoteRates);
      writeList('services', cache.quoteRates);
    }
    else if(key === 'workshopServices'){
      cache.workshopServices = normalizeList(list, normalizeServiceRow, DEFAULT_WORKSHOP_SERVICES);
      writeList('workshopServices', cache.workshopServices);
    }
    syncRuntimeGlobals();
    return getPriceList(key);
  }

  function readServiceOrdersFromStore(){
    try{
      if(serviceOrderStore && typeof serviceOrderStore.readAll === 'function'){
        return normalizeList(serviceOrderStore.readAll(), normalizeServiceOrderRow, DEFAULT_SERVICE_ORDERS);
      }
    }catch(_){ }
    return normalizeList(readList('serviceOrders', cache.serviceOrders), normalizeServiceOrderRow, DEFAULT_SERVICE_ORDERS);
  }

  function getServiceOrders(){
    cache.serviceOrders = readServiceOrdersFromStore();
    return cache.serviceOrders.slice();
  }
  function saveServiceOrders(list){
    cache.serviceOrders = normalizeList(list, normalizeServiceOrderRow, DEFAULT_SERVICE_ORDERS);
    try{
      if(serviceOrderStore && typeof serviceOrderStore.writeAll === 'function') serviceOrderStore.writeAll(cache.serviceOrders);
      else writeList('serviceOrders', cache.serviceOrders);
    }catch(_){ writeList('serviceOrders', cache.serviceOrders); }
    return cache.serviceOrders.slice();
  }
  function upsertServiceOrder(payload){
    const row = normalizeServiceOrderRow(payload || {});
    const next = getServiceOrders();
    const idx = next.findIndex((item)=> String(item.id || '') === String(row.id || ''));
    if(idx >= 0) next[idx] = Object.assign({}, next[idx], row, { updatedAt:Date.now() });
    else next.unshift(Object.assign({}, row, { updatedAt:Date.now() }));
    return saveServiceOrders(next);
  }
  function removeServiceOrder(id){
    const key = normalizeText(id);
    return saveServiceOrders(getServiceOrders().filter((item)=> normalizeText(item && item.id) !== key));
  }

  function getPriceConfig(kind){
    const key = String(kind || 'materials');
    return clone((PRICE_LIST_CONFIG && PRICE_LIST_CONFIG[key]) || (domain && domain.getCatalogConfig ? domain.getCatalogConfig(key) : PRICE_LIST_CONFIG.materials));
  }

  FC.catalogStore = {
    getPriceList,
    savePriceList,
    getPriceConfig,
    getSheetMaterials,
    getAccessories,
    getQuoteRates,
    getWorkshopServices,
    getHardwareManufacturers,
    saveHardwareManufacturers,
    getServiceOrders,
    saveServiceOrders,
    upsertServiceOrder,
    removeServiceOrder,
    migrateLegacy,
  };
})();

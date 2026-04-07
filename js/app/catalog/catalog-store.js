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

  const DEFAULT_SHEET_MATERIALS = [
    { id:'m1', materialType:'laminat', manufacturer:'Egger', symbol:'W1100', name:'Egger W1100 ST9 Biały Alpejski', price:35, hasGrain:false },
    { id:'m2', materialType:'akryl', manufacturer:'Rehau', symbol:'A01', name:'Akryl Biały', price:180, hasGrain:false },
  ];
  const DEFAULT_ACCESSORIES = [
    { id:'a1', manufacturer:'blum', symbol:'B1', name:'Zawias Blum', price:18 },
  ];
  const DEFAULT_QUOTE_RATES = [
    { id:'s1', category:'Montaż', name:'Montaż Express', price:120 },
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
    const src = row && typeof row === 'object' ? row : {};
    return {
      id: normalizeText(src.id) || uid('a'),
      manufacturer: normalizeText(src.manufacturer),
      symbol: normalizeText(src.symbol),
      name: normalizeText(src.name),
      price: Number(src.price) || 0,
    };
  }

  function normalizeServiceRow(row){
    const src = row && typeof row === 'object' ? row : {};
    return {
      id: normalizeText(src.id) || uid('s'),
      category: normalizeText(src.category) || 'Inne',
      name: normalizeText(src.name),
      price: Number(src.price) || 0,
    };
  }

  function normalizeServiceOrderRow(row){
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
          defaults: {
            sheetMaterials: DEFAULT_SHEET_MATERIALS,
            accessories: DEFAULT_ACCESSORIES,
            quoteRates: DEFAULT_QUOTE_RATES,
            workshopServices: DEFAULT_WORKSHOP_SERVICES,
            serviceOrders: DEFAULT_SERVICE_ORDERS,
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
    const quoteRates = normalizeList(seeds.quoteRates, normalizeServiceRow, DEFAULT_QUOTE_RATES);
    const workshopServices = normalizeList(seeds.workshopServices, normalizeServiceRow, DEFAULT_WORKSHOP_SERVICES);
    const serviceOrders = normalizeList(seeds.serviceOrders, normalizeServiceOrderRow, DEFAULT_SERVICE_ORDERS);

    writeList('sheetMaterials', sheetMaterials);
    writeList('accessories', accessories);
    writeList('quoteRates', quoteRates);
    writeList('workshopServices', workshopServices);
    writeList('serviceOrders', serviceOrders);

    // Legacy compatibility while old modules still read these keys.
    writeList('materials', sheetMaterials);
    writeList('services', quoteRates);

    cache = { sheetMaterials, accessories, quoteRates, workshopServices, serviceOrders };
    syncRuntimeGlobals();
    return { sheetMaterials, accessories, quoteRates, workshopServices, serviceOrders };
  }

  let cache = { sheetMaterials:[], accessories:[], quoteRates:[], workshopServices:[], serviceOrders:[] };

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

  function savePriceList(kind, list){
    const key = String(kind || 'materials');
    if(key === 'materials'){
      cache.sheetMaterials = normalizeList(list, normalizeMaterialRow, DEFAULT_SHEET_MATERIALS).filter((row)=> String(row.materialType || '').trim().toLowerCase() !== 'akcesoria');
      writeList('sheetMaterials', cache.sheetMaterials);
      writeList('materials', cache.sheetMaterials);
    }
    else if(key === 'accessories'){
      cache.accessories = normalizeList(list, normalizeAccessoryRow, DEFAULT_ACCESSORIES);
      writeList('accessories', cache.accessories);
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

  function getServiceOrders(){ return cache.serviceOrders.slice(); }
  function saveServiceOrders(list){
    cache.serviceOrders = normalizeList(list, normalizeServiceOrderRow, DEFAULT_SERVICE_ORDERS);
    writeList('serviceOrders', cache.serviceOrders);
    return getServiceOrders();
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
    getServiceOrders,
    saveServiceOrders,
    upsertServiceOrder,
    removeServiceOrder,
    migrateLegacy,
  };
})();

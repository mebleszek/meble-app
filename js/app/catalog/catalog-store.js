(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const KEYS = (FC.constants && FC.constants.STORAGE_KEYS) || {};
  const storage = FC.storage || {
    getJSON(_key, fallback){ return JSON.parse(JSON.stringify(fallback)); },
    setJSON(){ }
  };

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

  const PRICE_LIST_CONFIG = {
    materials: {
      key:'materials',
      storageKey:'sheetMaterials',
      title:'Cennik materiałów',
      subtitle:'Szukaj, filtruj i zarządzaj materiałami.',
      addLabel:'Dodaj produkt',
      icon:'🧩',
      formKind:'material',
    },
    accessories: {
      key:'accessories',
      storageKey:'accessories',
      title:'Akcesoria',
      subtitle:'Szukaj, filtruj i zarządzaj akcesoriami.',
      addLabel:'Dodaj akcesorium',
      icon:'🧷',
      formKind:'accessory',
    },
    quoteRates: {
      key:'quoteRates',
      storageKey:'quoteRates',
      title:'Stawki wyceny mebli',
      subtitle:'Szukaj, filtruj i zarządzaj stawkami wyceny mebli.',
      addLabel:'Dodaj stawkę',
      icon:'💲',
      formKind:'service',
    },
    workshopServices: {
      key:'workshopServices',
      storageKey:'workshopServices',
      title:'Usługi stolarskie',
      subtitle:'Szukaj, filtruj i zarządzaj usługami stolarskimi.',
      addLabel:'Dodaj usługę',
      icon:'🔧',
      formKind:'service',
    },
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

  function migrateLegacy(preferLegacy){
    const legacyMaterials = normalizeList(readList('materials', DEFAULT_SHEET_MATERIALS.concat(DEFAULT_ACCESSORIES.map((row)=> Object.assign({ materialType:'akcesoria', hasGrain:false }, row)))), normalizeMaterialRow, DEFAULT_SHEET_MATERIALS);
    const legacyServices = normalizeList(readList('services', DEFAULT_QUOTE_RATES), normalizeServiceRow, DEFAULT_QUOTE_RATES);

    const storedSheetMaterialsRaw = readList('sheetMaterials', null);
    const storedAccessoriesRaw = readList('accessories', null);
    const storedQuoteRatesRaw = readList('quoteRates', null);
    const storedWorkshopServicesRaw = readList('workshopServices', null);
    const storedServiceOrdersRaw = readList('serviceOrders', null);

    const preferLegacySplit = !!preferLegacy;
    const nextSheetSeed = preferLegacySplit
      ? legacyMaterials.filter((row)=> normalizeText(row.materialType).toLowerCase() !== 'akcesoria')
      : (Array.isArray(storedSheetMaterialsRaw) ? storedSheetMaterialsRaw : legacyMaterials.filter((row)=> normalizeText(row.materialType).toLowerCase() !== 'akcesoria'));
    const nextAccessoriesSeed = preferLegacySplit
      ? legacyMaterials.filter((row)=> normalizeText(row.materialType).toLowerCase() === 'akcesoria').map((row)=> ({ id:row.id, manufacturer:row.manufacturer, symbol:row.symbol, name:row.name, price:row.price }))
      : (Array.isArray(storedAccessoriesRaw) ? storedAccessoriesRaw : legacyMaterials.filter((row)=> normalizeText(row.materialType).toLowerCase() === 'akcesoria').map((row)=> ({ id:row.id, manufacturer:row.manufacturer, symbol:row.symbol, name:row.name, price:row.price })));
    const nextQuoteRatesSeed = preferLegacySplit ? legacyServices : (Array.isArray(storedQuoteRatesRaw) ? storedQuoteRatesRaw : legacyServices);

    const sheetMaterials = normalizeList(
      nextSheetSeed,
      normalizeMaterialRow,
      DEFAULT_SHEET_MATERIALS
    );
    const accessories = normalizeList(
      nextAccessoriesSeed,
      normalizeAccessoryRow,
      DEFAULT_ACCESSORIES
    );
    const quoteRates = normalizeList(nextQuoteRatesSeed, normalizeServiceRow, DEFAULT_QUOTE_RATES);
    const workshopServices = normalizeList(Array.isArray(storedWorkshopServicesRaw) ? storedWorkshopServicesRaw : DEFAULT_WORKSHOP_SERVICES, normalizeServiceRow, DEFAULT_WORKSHOP_SERVICES);
    const serviceOrders = normalizeList(Array.isArray(storedServiceOrdersRaw) ? storedServiceOrdersRaw : DEFAULT_SERVICE_ORDERS, normalizeServiceOrderRow, DEFAULT_SERVICE_ORDERS);

    writeList('sheetMaterials', sheetMaterials);
    writeList('accessories', accessories);
    writeList('quoteRates', quoteRates);
    writeList('workshopServices', workshopServices);
    writeList('serviceOrders', serviceOrders);

    // Legacy compatibility while old modules still read these keys.
    writeList('materials', sheetMaterials);
    writeList('services', quoteRates);

    return { sheetMaterials, accessories, quoteRates, workshopServices, serviceOrders };
  }

  let cache = migrateLegacy(false);

  function syncRuntimeGlobals(){
    try{ if(typeof materials !== 'undefined') materials = cache.sheetMaterials.slice(); }catch(_){ }
    try{ if(typeof services !== 'undefined') services = cache.quoteRates.slice(); }catch(_){ }
    try{ window.materials = cache.sheetMaterials.slice(); }catch(_){ }
    try{ window.services = cache.quoteRates.slice(); }catch(_){ }
  }

  syncRuntimeGlobals();

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
      cache.sheetMaterials = normalizeList(list, normalizeMaterialRow, DEFAULT_SHEET_MATERIALS);
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

  function upsertServiceOrder(row){
    const payload = normalizeServiceOrderRow(row);
    const next = getServiceOrders();
    const idx = next.findIndex((item)=> String(item.id) === String(payload.id));
    if(idx >= 0) next[idx] = Object.assign({}, next[idx], payload, { updatedAt:Date.now() });
    else next.push(Object.assign({}, payload, { updatedAt:Date.now() }));
    return saveServiceOrders(next);
  }

  function removeServiceOrder(id){
    return saveServiceOrders(getServiceOrders().filter((row)=> String(row.id) !== String(id)));
  }

  function getPriceConfig(kind){
    return PRICE_LIST_CONFIG[String(kind || 'materials')] || PRICE_LIST_CONFIG.materials;
  }

  function getSheetMaterials(){ return getPriceList('materials'); }
  function setSheetMaterials(list){ return savePriceList('materials', list); }
  function getAccessories(){ return getPriceList('accessories'); }
  function setAccessories(list){ return savePriceList('accessories', list); }
  function getQuoteRates(){ return getPriceList('quoteRates'); }
  function setQuoteRates(list){ return savePriceList('quoteRates', list); }
  function getWorkshopServices(){ return getPriceList('workshopServices'); }
  function setWorkshopServices(list){ return savePriceList('workshopServices', list); }

  function reload(){ cache = migrateLegacy(true); syncRuntimeGlobals(); return Object.assign({}, cache); }

  FC.catalogStore = {
    DEFAULT_SHEET_MATERIALS,
    DEFAULT_ACCESSORIES,
    DEFAULT_QUOTE_RATES,
    DEFAULT_WORKSHOP_SERVICES,
    DEFAULT_SERVICE_ORDERS,
    getPriceConfig,
    getPriceList,
    savePriceList,
    getSheetMaterials,
    setSheetMaterials,
    getAccessories,
    setAccessories,
    getQuoteRates,
    setQuoteRates,
    getWorkshopServices,
    setWorkshopServices,
    getServiceOrders,
    saveServiceOrders,
    upsertServiceOrder,
    removeServiceOrder,
    migrateLegacy: reload,
    syncRuntimeGlobals,
    _debug: { normalizeMaterialRow, normalizeAccessoryRow, normalizeServiceRow, normalizeServiceOrderRow, migrateLegacy }
  };
})();

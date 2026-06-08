(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function normalizeKey(value){
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  function catalogStore(){ return FC.catalogStore || null; }
  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }
  function getList(methodName, priceListKey){
    const store = catalogStore();
    if(!store) return [];
    if(typeof store[methodName] === 'function') return store[methodName]();
    if(typeof store.getPriceList === 'function') return store.getPriceList(priceListKey);
    return [];
  }
  function getSheetMaterials(){ return getList('getSheetMaterials', 'materials'); }
  function getAccessories(){ return getList('getAccessories', 'accessories'); }
  function getQuoteRates(){ return getList('getQuoteRates', 'quoteRates'); }
  function getWorkshopServices(){ return getList('getWorkshopServices', 'workshopServices'); }

  function matchByNameOrSymbol(rows, query){
    const key = normalizeKey(query);
    if(!key) return null;
    return (Array.isArray(rows) ? rows : []).find((row)=>{
      const nameKey = normalizeKey(row && row.name);
      const symbolKey = normalizeKey(row && row.symbol);
      return nameKey === key || symbolKey === key;
    }) || null;
  }

  function findSheetMaterial(query){ return matchByNameOrSymbol(getSheetMaterials(), query); }
  function findAccessory(query){ return matchByNameOrSymbol(getAccessories(), query); }
  function findQuoteRate(query){ return matchByNameOrSymbol(getQuoteRates(), query); }
  function findWorkshopService(query){ return matchByNameOrSymbol(getWorkshopServices(), query); }

  function getFurnitureCatalogSnapshot(){
    return {
      sheetMaterials: clone(getSheetMaterials()),
      accessories: clone(getAccessories()),
      quoteRates: clone(getQuoteRates()),
    };
  }

  function getWorkshopCatalogSnapshot(){
    return {
      workshopServices: clone(getWorkshopServices()),
    };
  }

  FC.catalogSelectors = {
    normalizeKey,
    getSheetMaterials,
    getAccessories,
    getQuoteRates,
    getWorkshopServices,
    findSheetMaterial,
    findAccessory,
    findQuoteRate,
    findWorkshopService,
    getFurnitureCatalogSnapshot,
    getWorkshopCatalogSnapshot,
  };
})();

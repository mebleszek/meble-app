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

  function materialAlias(value){
    const key=normalizeKey(value).replace(/ł/g,'l');
    // Deliberately narrow legacy spelling: same HDF thickness and white colour.
    const match=key.match(/^hdf\s+(?:(bialy|biala|biale)\s+)?(\d+(?:[.,]\d+)?)\s*mm(?:\s+(bialy|biala|biale))?$/);
    return match&&(match[1]||match[3])?'hdf:'+Number(match[2].replace(',','.'))+':white':key;
  }
  function findSheetMaterial(query,rows){
    const list=Array.isArray(rows)?rows:getSheetMaterials();
    const id=typeof query==='object'?String(query?.materialId||query?.id||''):String(query||'');
    const byId=list.filter(row=>String(row.id)===id);
    if(byId.length)return byId.length===1?byId[0]:null;
    const key=materialAlias(typeof query==='object'?query?.name:query);
    const matches=list.filter(row=>[row.name,row.symbol,...(Array.isArray(row.aliases)?row.aliases:[])].some(value=>value&&materialAlias(value)===key));
    return matches.length===1?matches[0]:null;
  }
  function materialFormat(query){
    const row=findSheetMaterial(query);
    return row&&Number(row.sheetWidthMm)>0&&Number(row.sheetHeightMm)>0&&['laminat','hdf'].includes(String(row.materialType).toLowerCase())?{
      width:Number(row.sheetWidthMm)||2800,height:Number(row.sheetHeightMm)||2070,
      thickness:Number(row.thicknessMm)||(String(row.materialType).toLowerCase()==='hdf'?3:18),hasGrain:!!row.hasGrain,materialId:row.id,
    }:null;
  }
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
    findSheetMaterial, materialFormat, materialAlias,
    findAccessory,
    findQuoteRate,
    findWorkshopService,
    getFurnitureCatalogSnapshot,
    getWorkshopCatalogSnapshot,
  };
})();

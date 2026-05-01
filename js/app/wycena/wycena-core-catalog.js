(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const utils = FC.wycenaCoreUtils;
  if(!utils){
    throw new Error('Brak FC.wycenaCoreUtils — sprawdź kolejność ładowania Wyceny.');
  }

  const AGD_SERVICE_DEFAULTS = [
    { category:'AGD', name:'Piekarnik do zabudowy', price:120 },
    { category:'AGD', name:'Mikrofalówka do zabudowy', price:100 },
    { category:'AGD', name:'Lodówka do zabudowy', price:180 },
    { category:'AGD', name:'Zmywarka do zabudowy', price:170 },
    { category:'AGD', name:'Płyta indukcyjna / ceramiczna', price:120 },
    { category:'AGD', name:'Okap podszafkowy / teleskopowy', price:120 },
    { category:'AGD', name:'Okap kominowy / wyspowy', price:180 },
    { category:'AGD', name:'Pralka do zabudowy', price:140 },
    { category:'AGD', name:'Suszarka do zabudowy', price:140 },
    { category:'AGD', name:'Ekspres do zabudowy', price:120 },
    { category:'AGD', name:'Podgrzewacz szufladowy', price:100 },
  ];

  function uniqByName(items){
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter((item)=>{
      const key = `${utils.slug(item && item.category)}::${utils.slug(item && item.name)}`;
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function ensureServiceCatalog(list){
    const current = Array.isArray(list) ? list.slice() : [];
    const existingKeys = new Set(current.map((item)=> `${utils.slug(item && item.category)}::${utils.slug(item && item.name)}`));
    let changed = false;
    AGD_SERVICE_DEFAULTS.forEach((item)=>{
      const key = `${utils.slug(item.category)}::${utils.slug(item.name)}`;
      if(existingKeys.has(key)) return;
      existingKeys.add(key);
      changed = true;
      current.push({ id:(FC.utils && FC.utils.uid ? FC.utils.uid() : `svc_${Date.now()}_${Math.random().toString(36).slice(2,8)}`), category:item.category, name:item.name, price:item.price });
    });
    return { list: uniqByName(current), changed };
  }

  function ensureServiceCatalogInRuntime(){
    try{
      const result = ensureServiceCatalog(typeof services !== 'undefined' ? services : []);
      if(result.changed){
        services = result.list;
        try{ FC.storage.setJSON(STORAGE_KEYS.services, services); }catch(_){ }
      }
      return result.list;
    }catch(_){
      return Array.isArray(typeof services !== 'undefined' ? services : []) ? services : [];
    }
  }

  function materialPriceLookup(materialName){
    const key = utils.normalizeText(materialName);
    try{
      if(FC.catalogSelectors && typeof FC.catalogSelectors.findSheetMaterial === 'function'){
        const found = FC.catalogSelectors.findSheetMaterial(key);
        if(found) return found;
      }
    }catch(_){ }
    const list = Array.isArray(typeof materials !== 'undefined' ? materials : []) ? materials : [];
    return list.find((item)=> utils.normalizeText(item && item.name) === key || utils.normalizeText(item && item.symbol) === key) || null;
  }

  function accessoryPriceLookup(accessoryName){
    const key = utils.normalizeText(accessoryName);
    try{
      if(FC.catalogSelectors && typeof FC.catalogSelectors.findAccessory === 'function'){
        const found = FC.catalogSelectors.findAccessory(key);
        if(found) return found;
      }
    }catch(_){ }
    return null;
  }

  function quoteRateLookup(rateName){
    const key = utils.normalizeText(rateName);
    try{
      if(FC.catalogSelectors && typeof FC.catalogSelectors.findQuoteRate === 'function'){
        const found = FC.catalogSelectors.findQuoteRate(key);
        if(found) return found;
      }
    }catch(_){ }
    return null;
  }

  function servicePriceLookup(serviceName){
    const key = utils.normalizeText(serviceName);
    try{
      if(FC.catalogSelectors && typeof FC.catalogSelectors.findQuoteRate === 'function'){
        const found = FC.catalogSelectors.findQuoteRate(key);
        if(found) return found;
      }
    }catch(_){ }
    const list = ensureServiceCatalogInRuntime();
    return list.find((item)=> utils.normalizeText(item && item.name) === key) || null;
  }

  FC.wycenaCoreCatalog = {
    AGD_SERVICE_DEFAULTS,
    ensureServiceCatalog,
    ensureServiceCatalogInRuntime,
    materialPriceLookup,
    accessoryPriceLookup,
    quoteRateLookup,
    servicePriceLookup,
  };
})();

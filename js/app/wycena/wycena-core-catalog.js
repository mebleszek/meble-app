(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const utils = FC.wycenaCoreUtils;

  function retryWycenaCoreModule(apiKey, missingLabel){
    try{
      const state = FC.__wycenaCoreModuleRetries = FC.__wycenaCoreModuleRetries || {};
      const count = state[apiKey] = (Number(state[apiKey]) || 0) + 1;
      if(count > 12){
        try{ console.warn('WYCENA: moduł nie wystartował po ponowieniach', apiKey, missingLabel); }catch(_){}
        return;
      }
      const current = document.currentScript && document.currentScript.getAttribute ? (document.currentScript.getAttribute('src') || '') : '';
      if(!current) return;
      window.setTimeout(function(){
        try{
          if(FC[apiKey]) return;
          const script = document.createElement('script');
          script.defer = true;
          script.async = false;
          script.src = current + (current.indexOf('?') === -1 ? '?' : '&') + 'wycena_dep_retry=' + count + '_' + Date.now();
          document.head.appendChild(script);
        }catch(_){}
      }, Math.min(1200, 80 * count));
    }catch(_){}
  }

  if(!utils){
    retryWycenaCoreModule('wycenaCoreCatalog', 'FC.wycenaCoreUtils');
    return;
  }

  const AGD_SERVICE_DEFAULTS = [
    { category:'Montaż AGD', name:'Montaż piekarnika do zabudowy', starterPrice:true, note:'Cena startowa — sprawdzić przed realną ofertą.', price:120 },
    { category:'Montaż AGD', name:'Montaż mikrofali do zabudowy', starterPrice:true, note:'Cena startowa — sprawdzić przed realną ofertą.', price:100 },
    { category:'Montaż AGD', name:'Montaż lodówki do zabudowy', starterPrice:true, note:'Cena startowa — sprawdzić przed realną ofertą.', price:180 },
    { category:'Montaż AGD', name:'Montaż zmywarki do zabudowy', starterPrice:true, note:'Cena startowa — sprawdzić przed realną ofertą.', price:170 },
    { category:'Montaż AGD', name:'Montaż płyty indukcyjnej / ceramicznej', starterPrice:true, note:'Cena startowa — sprawdzić przed realną ofertą.', price:120 },
    { category:'Montaż AGD', name:'Montaż okapu podszafkowego / teleskopowego', starterPrice:true, note:'Cena startowa — sprawdzić przed realną ofertą.', price:120 },
    { category:'Montaż AGD', name:'Montaż okapu kominowego / wyspowego', starterPrice:true, note:'Cena startowa — sprawdzić przed realną ofertą.', price:180 },
    { category:'Montaż AGD', name:'Montaż pralki do zabudowy', starterPrice:true, note:'Cena startowa — sprawdzić przed realną ofertą.', price:140 },
    { category:'Montaż AGD', name:'Montaż suszarki do zabudowy', starterPrice:true, note:'Cena startowa — sprawdzić przed realną ofertą.', price:140 },
    { category:'Montaż AGD', name:'Montaż ekspresu do zabudowy', starterPrice:true, note:'Cena startowa — sprawdzić przed realną ofertą.', price:120 },
    { category:'Montaż AGD', name:'Montaż podgrzewacza szufladowego', starterPrice:true, note:'Cena startowa — sprawdzić przed realną ofertą.', price:100 },
  ];
  function normalizeSlug(value){
    return String(value == null ? '' : value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function isLegacyAgdService(item){
    const category = String(item && item.category || '').trim().toLowerCase();
    const name = normalizeSlug(item && item.name);
    if(category === 'agd') return true;
    if(category === 'montaż agd' && name === 'montaz_okapu') return true;
    return false;
  }

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
    const current = (Array.isArray(list) ? list.slice() : []).filter((item)=> !isLegacyAgdService(item));
    const existingKeys = new Set(current.map((item)=> `${utils.slug(item && item.category)}::${utils.slug(item && item.name)}`));
    let changed = false;
    AGD_SERVICE_DEFAULTS.forEach((item)=>{
      const key = `${utils.slug(item.category)}::${utils.slug(item.name)}`;
      if(existingKeys.has(key)) return;
      existingKeys.add(key);
      changed = true;
      current.push({ id:(FC.utils && FC.utils.uid ? FC.utils.uid() : `svc_${Date.now()}_${Math.random().toString(36).slice(2,8)}`), category:item.category, name:item.name, price:item.price, starterPrice:item.starterPrice === true, note:String(item.note || '') });
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

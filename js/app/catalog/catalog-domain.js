(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const SHEET_MATERIAL_TYPES = ['laminat','akryl','lakier','blat'];
  const QUOTE_RATE_CATEGORIES = ['Montaż','AGD','Pomiar','Transport','Projekt','Inne'];
  const WORKSHOP_SERVICE_CATEGORIES = ['Cięcie','Oklejanie','Montaż','Naprawa','Transport','Inne'];

  const PRICE_LIST_CONFIG = {
    materials: {
      key:'materials',
      storageKey:'sheetMaterials',
      title:'Materiały',
      subtitle:'Szukaj, filtruj i zarządzaj materiałami arkuszowymi do mebli.',
      addLabel:'Dodaj materiał',
      icon:'🧩',
      formKind:'material',
      mode:'furnitureProjects',
    },
    accessories: {
      key:'accessories',
      storageKey:'accessories',
      title:'Akcesoria',
      subtitle:'Szukaj, filtruj i zarządzaj akcesoriami.',
      addLabel:'Dodaj akcesorium',
      icon:'🧷',
      formKind:'accessory',
      mode:'furnitureProjects',
    },
    quoteRates: {
      key:'quoteRates',
      storageKey:'quoteRates',
      title:'Stawki wyceny mebli',
      subtitle:'Szukaj, filtruj i zarządzaj stawkami używanymi przy wycenie projektów meblowych.',
      addLabel:'Dodaj stawkę',
      icon:'💲',
      formKind:'service',
      mode:'furnitureProjects',
    },
    workshopServices: {
      key:'workshopServices',
      storageKey:'workshopServices',
      title:'Usługi stolarskie',
      subtitle:'Szukaj, filtruj i zarządzaj cennikiem drobnych usług stolarskich.',
      addLabel:'Dodaj usługę',
      icon:'🔧',
      formKind:'service',
      mode:'workshopServices',
    },
  };

  function normalizeText(value){ return String(value == null ? '' : value).trim(); }
  function normalizeLower(value){ return normalizeText(value).toLowerCase(); }
  function clone(value){
    try{ return (FC.utils && typeof FC.utils.clone === 'function') ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }
  function getCatalogConfig(kind){
    const key = String(kind || 'materials');
    return clone(PRICE_LIST_CONFIG[key] || PRICE_LIST_CONFIG.materials);
  }
  function getCatalogKeys(){ return Object.keys(PRICE_LIST_CONFIG); }
  function getCatalogKeysForMode(mode){
    const current = String(mode || '').trim();
    return getCatalogKeys().filter((key)=> String((PRICE_LIST_CONFIG[key] && PRICE_LIST_CONFIG[key].mode) || '') === current);
  }
  function isAccessoryMaterialType(materialType){
    const raw = normalizeLower(materialType);
    return raw === 'akcesoria' || raw === 'accessories' || raw === 'akcesorium';
  }
  function isSheetMaterialType(materialType){
    const raw = normalizeLower(materialType);
    return SHEET_MATERIAL_TYPES.includes(raw);
  }
  function splitLegacyMaterials(list){
    const rows = Array.isArray(list) ? list : [];
    const out = { sheetMaterials:[], accessories:[] };
    rows.forEach((row)=>{
      if(!row || typeof row !== 'object') return;
      const materialType = normalizeLower(row.materialType);
      const normalized = Object.assign({}, row);
      if(isAccessoryMaterialType(materialType)){
        out.accessories.push({
          id: normalizeText(normalized.id),
          manufacturer: normalizeText(normalized.manufacturer),
          symbol: normalizeText(normalized.symbol),
          name: normalizeText(normalized.name),
          price: Number(normalized.price) || 0,
        });
        return;
      }
      if(!materialType || isSheetMaterialType(materialType)){
        out.sheetMaterials.push({
          id: normalizeText(normalized.id),
          materialType: materialType || 'laminat',
          manufacturer: normalizeText(normalized.manufacturer),
          symbol: normalizeText(normalized.symbol),
          name: normalizeText(normalized.name),
          price: Number(normalized.price) || 0,
          hasGrain: !!normalized.hasGrain,
        });
      }
    });
    return out;
  }

  FC.catalogDomain = {
    SHEET_MATERIAL_TYPES,
    QUOTE_RATE_CATEGORIES,
    WORKSHOP_SERVICE_CATEGORIES,
    PRICE_LIST_CONFIG,
    getCatalogConfig,
    getCatalogKeys,
    getCatalogKeysForMode,
    isAccessoryMaterialType,
    isSheetMaterialType,
    splitLegacyMaterials,
  };
})();

(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const KEYS = (FC.constants && FC.constants.STORAGE_KEYS) || {};
  const storage = FC.storage || {
    getJSON(_key, fallback){ return JSON.parse(JSON.stringify(fallback)); },
    setJSON(){ return false; }
  };
  const domain = FC.catalogDomain || {};
  const migration = FC.catalogMigration || {};
  const serviceOrderStore = FC.serviceOrderStore || null;
  const laborCatalog = FC.laborCatalog || null;
  const hardwareCatalog = FC.hardwareCatalog || null;
  const hardwareSeeds = FC.hardwareCatalogSeeds || null;
  const storagePolicy = FC.catalogStoragePolicy || null;

  const DEFAULT_SHEET_MATERIALS = [
    { id:'m1', materialType:'laminat', manufacturer:'Egger', symbol:'W1100', name:'Egger W1100 ST9 Biały Alpejski', price:280, priceUnit:'sheet', hasGrain:false, starterPrice:true, note:'Cena startowa — sprawdzić przed realną ofertą.' },
    { id:'m2', materialType:'akryl', manufacturer:'Rehau', symbol:'A01', name:'Akryl Biały', price:380, priceUnit:'m2', hasGrain:false, starterPrice:true, note:'Cena startowa za m² gotowego frontu.' },
    { id:'m3', materialType:'lakier', manufacturer:'Start', symbol:'LAK-MAT', name:'Front lakierowany standard', price:450, priceUnit:'m2', hasGrain:false, starterPrice:true, note:'Cena startowa za m² gotowego frontu.' },
    { id:'m4', materialType:'hdf', manufacturer:'Start', symbol:'HDF-3-BIALY', name:'HDF biały 3 mm', price:18, priceUnit:'m2', hasGrain:false, starterPrice:true, note:'Cena startowa za m² pleców.' },
    { id:'m5', materialType:'obrzeże', manufacturer:'Start', symbol:'PCV-STD', name:'Obrzeże PCV standard', price:3, priceUnit:'mb', hasGrain:false, starterPrice:true, note:'Cena startowa za mb; w wycenie doliczane jest +10% zapasu.' },
    { id:'m7', materialType:'obrzeże', manufacturer:'Start', symbol:'PCV-FRONT', name:'PCV pod kolor frontów', price:5, priceUnit:'mb', hasGrain:false, starterPrice:true, note:'Cena startowa za mb PCV liczonego jako pod kolor frontów; w wycenie doliczane jest +10% zapasu.' },
    { id:'m6', materialType:'blat', manufacturer:'Start', symbol:'BLAT-4100', name:'Blat roboczy 4100 mm', price:420, priceUnit:'piece', hasGrain:true, starterPrice:true, note:'Cena startowa za całą sztukę blatu 4,1 m.' },
  ];
  const DEFAULT_ACCESSORIES = hardwareSeeds && typeof hardwareSeeds.mergeAccessorySeeds === 'function'
    ? hardwareSeeds.mergeAccessorySeeds([])
    : [
        { id:'a1', manufacturer:'Blum', symbol:'B1', name:'Zawias Blum', price:18, hardwareCategory:'Zawiasy', hardwareUnit:'szt.', series:'', purchasePrice:0, markupPercent:0, priceSource:'', priceUpdatedAt:'', status:'active', note:'' },
        { id:'project_design_parts', category:'Projekt', name:'Projekt techniczny — formatki', price:0, usage:'universal', rateType:'specialist', quantitySource:'cabinet.part_count', timeBlockHours:0.0166666667, quantityMode:'linear', pricingMode:'time', active:true, internalOnly:true, starterPrice:true, note:'Projekt techniczny liczony od liczby formatek szafki. 1 min × stawka specjalistyczna 300 zł/h daje około 5 zł za formatkę.' },
        { id:'project_design_unusual', category:'Projekt', name:'Projekt techniczny — nietypowa szafka', price:0, usage:'universal', rateType:'specialist', quantitySource:'cabinet.unusual_project_count', timeBlockHours:0.25, quantityMode:'linear', pricingMode:'advanced', volumeTimeMode:'perM3', volumeTimePerM3:1, volumePricePerM3:0, active:true, internalOnly:true, starterPrice:true, note:'Dopłata projektowa dla szafki z ptaszkiem Nietypowy projekt: 15 min + gabarytoczas 1 h/m³.' },
      ];
  const DEFAULT_HARDWARE_MANUFACTURERS = hardwareCatalog && Array.isArray(hardwareCatalog.DEFAULT_MANUFACTURERS)
    ? hardwareCatalog.DEFAULT_MANUFACTURERS.slice()
    : ['Blum','GTV','Peka','Rejs','Nomet','Häfele','Sevroll','Laguna','Hettich'];
  const DEFAULT_HARDWARE_SUPPLIERS = hardwareCatalog && Array.isArray(hardwareCatalog.DEFAULT_SUPPLIERS)
    ? hardwareCatalog.DEFAULT_SUPPLIERS.slice()
    : [{ id:'bivert', name:'Bivert', defaultDiscountPercent:0, active:true }];
  const DEFAULT_HARDWARE_SETTINGS = hardwareCatalog && hardwareCatalog.DEFAULT_SETTINGS
    ? hardwareCatalog.DEFAULT_SETTINGS
    : { defaultSupplierId:'bivert', defaultVatRate:23, defaultMarkupPercent:20, defaultQuoteBase:'catalogGross', defaultPricingMode:'markup' };
  const DEFAULT_HARDWARE_CATEGORIES = hardwareCatalog && Array.isArray(hardwareCatalog.DEFAULT_CATEGORIES)
    ? hardwareCatalog.DEFAULT_CATEGORIES.slice()
    : ['Zawiasy','Prowadniki','Szuflady / prowadnice','Cargo / organizery','Inne'];
  const DEFAULT_HARDWARE_TYPES = hardwareCatalog && Array.isArray(hardwareCatalog.DEFAULT_TYPES)
    ? hardwareCatalog.DEFAULT_TYPES.slice()
    : [];
  const DEFAULT_HARDWARE_TECHNICAL_PARAMS = FC.hardwareTechnicalParams && Array.isArray(FC.hardwareTechnicalParams.DEFAULT_DEFINITIONS)
    ? FC.hardwareTechnicalParams.DEFAULT_DEFINITIONS.slice()
    : [];
  const DEFAULT_QUOTE_RATES = laborCatalog && Array.isArray(laborCatalog.DEFAULT_HOURLY_RATES)
    ? laborCatalog.DEFAULT_HOURLY_RATES.concat(laborCatalog.DEFAULT_LABOR_DEFINITIONS || [])
    : [
        { id:'labor_rate_workshop', category:'Stawki godzinowe', name:'Stawka warsztatowa', price:150, rateKey:'workshop', rateCode:'workshop', rateType:'workshop', active:true, systemRate:true, nonDeletable:true },
        { id:'labor_rate_assembly', category:'Stawki godzinowe', name:'Stawka montażowa', price:250, rateKey:'assembly', rateCode:'assembly', rateType:'assembly', active:true, systemRate:true, nonDeletable:true },
        { id:'labor_rate_specialist', category:'Stawki godzinowe', name:'Stawka specjalistyczna', price:300, rateKey:'specialist', rateCode:'specialist', rateType:'specialist', active:true, systemRate:true, nonDeletable:true },
        { id:'labor_rate_helper', category:'Stawki godzinowe', name:'Stawka pomocnika', price:80, rateKey:'helper', rateCode:'helper', rateType:'helper', active:true, systemRate:true, nonDeletable:true },
        { id:'labor_body_h090', category:'Korpusy', name:'Skręcenie korpusu do 90 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.body_height_mm', operator:'range', min:null, max:900 }], timeBlockHours:1, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Baza skręcenia niskiego korpusu. Wysokość liczona bez nóżek/cokołu.' },
        { id:'labor_body_h150', category:'Korpusy', name:'Skręcenie korpusu do 150 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.body_height_mm', operator:'range', min:901, max:1500 }], timeBlockHours:1, quantityMode:'linear', volumeTimeMode:'perM3', volumeTimePerM3:0.25, active:true, internalOnly:true, starterPrice:true, note:'Baza 60 min + gabarytoczas 0.25 h/m³ liczony z cabinet.body_volume_m3.' },
        { id:'labor_body_h210', category:'Korpusy', name:'Skręcenie korpusu do 210 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.body_height_mm', operator:'range', min:1501, max:2100 }], timeBlockHours:1, quantityMode:'linear', volumeTimeMode:'perM3', volumeTimePerM3:1, active:true, internalOnly:true, starterPrice:true, note:'Baza 60 min + gabarytoczas 1.00 h/m³ liczony z cabinet.body_volume_m3.' },
        { id:'labor_body_h230', category:'Korpusy', name:'Skręcenie korpusu do 230 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.body_height_mm', operator:'range', min:2101, max:2300 }], timeBlockHours:1, quantityMode:'linear', volumeTimeMode:'perM3', volumeTimePerM3:1.25, active:true, internalOnly:true, starterPrice:true, note:'Baza 60 min + gabarytoczas 1.25 h/m³ liczony z cabinet.body_volume_m3.' },
        { id:'labor_body_h999', category:'Korpusy', name:'Skręcenie korpusu powyżej 230 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.body_height_mm', operator:'range', min:2301, max:null }], timeBlockHours:1, quantityMode:'linear', volumeTimeMode:'perM3', volumeTimePerM3:1.5, active:true, internalOnly:true, starterPrice:true, note:'Baza 60 min + gabarytoczas 1.50 h/m³ liczony z cabinet.body_volume_m3.' },
        { id:'labor_body_width_090', category:'Korpusy', name:'Dopłata skręcanie — szerokość 701–900', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.width_mm', operator:'range', min:701, max:900 }], timeBlockHours:0.0833333333, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Dopłata za szerszy korpus: trudniejsze obracanie i dostęp do krawędzi.' },
        { id:'labor_body_width_110', category:'Korpusy', name:'Dopłata skręcanie — szerokość 901–1100', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.width_mm', operator:'range', min:901, max:1100 }], timeBlockHours:0.25, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Dopłata za szerszy korpus: trudniejsze obracanie i dostęp do krawędzi.' },
        { id:'labor_body_width_130', category:'Korpusy', name:'Dopłata skręcanie — szerokość 1101–1300', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.width_mm', operator:'range', min:1101, max:1300 }], timeBlockHours:0.5, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Dopłata za szeroki korpus zajmujący stół i utrudniający dojście.' },
        { id:'labor_body_width_999', category:'Korpusy', name:'Dopłata skręcanie — szerokość powyżej 130 cm', price:0, usage:'universal', rateType:'workshop', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.width_mm', operator:'range', min:1301, max:null }], timeBlockHours:1, quantityMode:'linear', active:true, internalOnly:true, starterPrice:true, note:'Dopłata za bardzo szeroki korpus — kontrola praktyczna po testach produkcji.' },
      ];
  const DEFAULT_WORKSHOP_SERVICES = [
    { id:'ws1', category:'Cięcie', name:'Przycięcie płyty', price:25, starterPrice:true, note:'Cena startowa — sprawdzić przed realną ofertą.' },
  ];
  const DEFAULT_SERVICE_ORDERS = [];

  const PRICE_LIST_CONFIG = (domain && domain.PRICE_LIST_CONFIG) || {
    materials: { key:'materials', storageKey:'sheetMaterials', title:'Materiały', subtitle:'', addLabel:'Dodaj materiał', icon:'🧩', formKind:'material' },
    accessories: { key:'accessories', storageKey:'accessories', title:'Akcesoria', subtitle:'', addLabel:'Dodaj akcesorium', icon:'🧷', formKind:'accessory' },
    quoteRates: { key:'quoteRates', storageKey:'quoteRates', title:'Cennik robocizny i usług', subtitle:'', addLabel:'Dodaj usługę / robociznę', icon:'💲', formKind:'service' },
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

  const CATALOG_LABELS = {
    materials:'Materiały (dane historyczne)', services:'Usługi (dane historyczne)',
    sheetMaterials:'Materiały', accessories:'Katalog okuć', quoteRates:'Cennik robocizny',
    workshopServices:'Usługi stolarskie', hardwareManufacturers:'Producenci okuć',
    hardwareSuppliers:'Dostawcy okuć', hardwareSettings:'Ustawienia cen okuć',
    hardwareCategories:'Kategorie okuć', hardwareTypes:'Typy okuć', hardwareTechnicalParams:'Parametry techniczne okuć',
  };
  // A fallback displayed after a failed read is never allowed to become the persisted catalog.
  // Only a fresh initialization after recovery can release this instance's lock.
  const recoveryRequired = new Map();
  let recoveryNoticeQueued = false, lastRecoveryNotice = '';

  function notifyRecoveryRequired(){
    if(FC.catalogStore && FC.catalogStore.notifyRecoveryRequired !== notifyRecoveryRequired) return;
    const labels = Array.from(recoveryRequired.keys()).map(key=>CATALOG_LABELS[key]);
    const signature = labels.join(', ');
    if(!signature || signature === lastRecoveryNotice || !(FC.infoBox && FC.infoBox.open)) return;
    FC.infoBox.open({ title:'Wymagane odzyskanie danych katalogu',
      message:'Nie można odczytać danych: ' + signature + '. Widoczne wartości zastępcze nie są odzyskanymi danymi użytkownika. Zapis tych katalogów został zablokowany. Odzyskaj poprawne dane i uruchom program ponownie.', okOnly:true });
    lastRecoveryNotice = signature;
  }

  function recoveryError(key){
    const error = new Error('Nie można odczytać katalogu „' + CATALOG_LABELS[key] + '”. Zapis został zablokowany, aby nie nadpisać danych wartościami zastępczymi. Odzyskaj poprawne dane i uruchom program ponownie.');
    error.code = 'CATALOG_RECOVERY_REQUIRED';
    error.key = recoveryRequired.get(key);
    return error;
  }

  function catalogRaw(name){
    return typeof localStorage !== 'undefined' ? localStorage.getItem(name) : storage.getRaw(name);
  }

  function assertCatalogReadable(key){
    if(!Object.prototype.hasOwnProperty.call(CATALOG_LABELS, key)) return;
    if(recoveryRequired.has(key)) throw recoveryError(key);
    const primary = storagePolicy ? storagePolicy.resolveKey(KEYS, key) : (KEYS[key] || key);
    const legacy = storagePolicy ? storagePolicy.legacyKey(key) : '';
    let source = primary;
    try{
      let raw = catalogRaw(primary);
      if(raw == null && legacy){ source = legacy; raw = catalogRaw(legacy); }
      if(raw == null) return;
      const value = JSON.parse(raw);
      if(key === 'hardwareSettings' ? (!value || typeof value !== 'object' || Array.isArray(value)) : !Array.isArray(value)) throw new Error('Niepoprawna struktura katalogu.');
    }catch(_){
      recoveryRequired.set(key, source);
      if(!recoveryNoticeQueued && typeof document !== 'undefined' && document.addEventListener){
        recoveryNoticeQueued = true;
        document.addEventListener('DOMContentLoaded', notifyRecoveryRequired, { once:true });
        if(document.readyState === 'complete') setTimeout(notifyRecoveryRequired, 0);
      }
      throw recoveryError(key);
    }
  }

  function assertCatalogWriteAllowed(key){
    assertCatalogReadable(key);
    // Missing split catalogs may be seeded from historical materials/services, never from their corrupt fallback.
    const source = { sheetMaterials:'materials', accessories:'materials', quoteRates:'services' }[key];
    if(source && catalogRaw(KEYS[key] || key) == null) assertCatalogReadable(source);
  }

  function markPartialWrite(error, confirmedKeys){
    if(!confirmedKeys.length) return error;
    error.partial = true;
    error.confirmedKeys = Array.from(new Set((error.confirmedKeys || []).concat(confirmedKeys)));
    error.failureMessage = error.failureMessage || error.message;
    error.message = 'Zapis częściowy: część danych została już zapisana, ale nie udało się zapisać całości. ' + error.failureMessage;
    return error;
  }

  function readList(key, fallback){
    try{ assertCatalogReadable(key); }
    catch(_){ return clone(fallback); }
    try{
      if(storagePolicy && typeof storagePolicy.hasManagedKey === 'function' && storagePolicy.hasManagedKey(key)){
        return storagePolicy.readJSON(storage, KEYS, key, fallback, clone);
      }
    }catch(_){ }
    return storage && typeof storage.getJSON === 'function'
      ? storage.getJSON(KEYS[key] || key, fallback)
      : clone(fallback);
  }

  function writeList(key, list){
    assertCatalogWriteAllowed(key);
    if(storagePolicy && typeof storagePolicy.writeJSON === 'function'){
      return storagePolicy.writeJSON(storage, KEYS, key, list);
    }
    const primary = KEYS[key] || key;
    try{
      const raw = JSON.stringify(list);
      if(!(storage && typeof storage.setJSON === 'function') || storage.setJSON(primary, list) === false) throw new Error('Magazyn odrzucił zapis.');
      const saved = typeof storage.getRaw === 'function' ? storage.getRaw(primary) : localStorage.getItem(primary);
      if(saved !== raw) throw new Error('Nie potwierdzono zapisanej wartości.');
    }catch(cause){
      const error = new Error('Nie udało się zapisać danych globalnych (' + primary + '). Spróbuj ponownie.');
      error.code = 'GLOBAL_WRITE_FAILED'; error.key = primary; error.cause = cause;
      throw error;
    }
    return list;
  }

  let currentHardwareSettings = null;

  function normalizeText(value){ return String(value == null ? '' : value).trim(); }

  function normalizeMaterialPriceUnit(value, materialType){
    const raw = normalizeText(value).toLowerCase();
    if(['sheet','arkusz','ark.','ark'].includes(raw)) return 'sheet';
    if(['m2','m²','metr2','metry2','metr kw','metry kw'].includes(raw)) return 'm2';
    if(['mb','metr','metry','metr bieżący','metr biezacy'].includes(raw)) return 'mb';
    if(['piece','szt','szt.','sztuka'].includes(raw)) return 'piece';
    const type = normalizeText(materialType).toLowerCase();
    if(type === 'akryl' || type === 'lakier' || type === 'hdf') return 'm2';
    if(type === 'obrzeże' || type === 'obrzeze') return 'mb';
    if(type === 'blat') return 'piece';
    return 'sheet';
  }

  function normalizeMaterialRow(row){
    const src = row && typeof row === 'object' ? row : {};
    const materialType = normalizeText(src.materialType) || 'laminat';
    return {
      id: normalizeText(src.id) || uid('m'),
      materialType,
      manufacturer: normalizeText(src.manufacturer),
      symbol: normalizeText(src.symbol),
      name: normalizeText(src.name),
      price: Number(src.price) || 0,
      priceUnit: normalizeMaterialPriceUnit(src.priceUnit || src.unitPriceMode || src.unit, materialType),
      hasGrain: !!src.hasGrain,
      starterPrice: src.starterPrice === true,
      priceUserEditedAt: normalizeText(src.priceUserEditedAt || src.userEditedAt),
      note: normalizeText(src.note),
    };
  }
  function materialSeedKey(row){
    const src = row && typeof row === 'object' ? row : {};
    const type = normalizeText(src.materialType).toLowerCase();
    const symbol = normalizeText(src.symbol).toLowerCase();
    const name = normalizeText(src.name).toLowerCase();
    return symbol ? `${type}::symbol::${symbol}` : `${type}::name::${name}`;
  }

  function isEdgeMaterialRow(row){
    const type = normalizeText(row && row.materialType).toLowerCase();
    const unit = normalizeMaterialPriceUnit(row && row.priceUnit, row && row.materialType);
    const name = normalizeText(row && row.name).toLowerCase();
    return unit === 'mb' || type === 'obrzeże' || type === 'obrzeze' || name.includes('obrze') || name.includes('pcv');
  }

  function isFrontColorEdgeRow(row){
    const symbol = normalizeText(row && row.symbol).toLowerCase();
    const name = normalizeText(row && row.name).toLowerCase();
    return symbol === 'pcv-front' || symbol === 'pcv_front' || name.includes('pod kolor front');
  }

  function ensureStarterMaterialSeeds(rows){
    const list = (Array.isArray(rows) ? rows : []).map((row)=> normalizeMaterialRow(row));
    const keys = new Set(list.map(materialSeedKey));

    // PCV zostało dodane po istniejących bazach użytkownika. Ma wejść jako normalna, widoczna pozycja startowa,
    // ale nie może nadpisać ręcznie wpisanych/edytowanych cenników ani tworzyć ABS.
    if(!list.some(isEdgeMaterialRow)){
      const edgeSeed = DEFAULT_SHEET_MATERIALS.find((row)=> normalizeMaterialPriceUnit(row && row.priceUnit, row && row.materialType) === 'mb' && !isFrontColorEdgeRow(row));
      if(edgeSeed){
        const normalized = normalizeMaterialRow(Object.assign({}, edgeSeed));
        const key = materialSeedKey(normalized);
        if(!keys.has(key)){
          keys.add(key);
          list.push(normalized);
        }
      }
    }

    // Druga cena PCV jest osobnym materiałem, bo PCV pod kolor frontów może mieć inną cenę za mb niż standard.
    // Dodajemy seed również do istniejących baz, które mają już PCV standard, ale nie mają jeszcze pozycji pod fronty.
    if(!list.some(isFrontColorEdgeRow)){
      const frontEdgeSeed = DEFAULT_SHEET_MATERIALS.find((row)=> isFrontColorEdgeRow(row));
      if(frontEdgeSeed){
        const normalized = normalizeMaterialRow(Object.assign({}, frontEdgeSeed));
        const key = materialSeedKey(normalized);
        if(!keys.has(key)){
          keys.add(key);
          list.push(normalized);
        }
      }
    }
    return list;
  }


  function normalizeAccessoryRow(row){
    try{
      if(hardwareCatalog && typeof hardwareCatalog.normalizeAccessory === 'function') return hardwareCatalog.normalizeAccessory(row, uid, currentHardwareSettings || DEFAULT_HARDWARE_SETTINGS);
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
      starterPrice: src.starterPrice === true,
      priceUserEditedAt: normalizeText(src.priceUserEditedAt || src.userEditedAt),
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

  function normalizeHardwareSuppliers(list){
    try{
      if(hardwareCatalog && typeof hardwareCatalog.normalizeSupplierList === 'function') return hardwareCatalog.normalizeSupplierList(list);
    }catch(_){ }
    return Array.isArray(list) ? list : DEFAULT_HARDWARE_SUPPLIERS.slice();
  }

  function normalizeHardwareSettings(settings){
    try{
      if(hardwareCatalog && typeof hardwareCatalog.normalizeSettings === 'function') return hardwareCatalog.normalizeSettings(settings);
    }catch(_){ }
    return Object.assign({}, DEFAULT_HARDWARE_SETTINGS, settings || {});
  }

  function normalizeHardwareCategories(list){
    try{
      if(hardwareCatalog && typeof hardwareCatalog.normalizeCategoryList === 'function') return hardwareCatalog.normalizeCategoryList(list);
    }catch(_){ }
    return Array.from(new Set((Array.isArray(list) ? list : []).concat(DEFAULT_HARDWARE_CATEGORIES).map(normalizeText).filter(Boolean)));
  }

  function normalizeHardwareTypes(list){
    try{
      if(hardwareCatalog && typeof hardwareCatalog.normalizeTypeList === 'function') return hardwareCatalog.normalizeTypeList(list);
    }catch(_){ }
    return Array.isArray(list) ? list : DEFAULT_HARDWARE_TYPES.slice();
  }

  function normalizeHardwareTechnicalParams(list, categories){
    try{
      if(FC.hardwareTechnicalParams && typeof FC.hardwareTechnicalParams.normalizeDefinitions === 'function') return FC.hardwareTechnicalParams.normalizeDefinitions(list, categories || cache.hardwareCategories || DEFAULT_HARDWARE_CATEGORIES);
    }catch(_){ }
    return Array.isArray(list) ? list : DEFAULT_HARDWARE_TECHNICAL_PARAMS.slice();
  }


  function normalizeServiceRow(row){
    const src = row && typeof row === 'object' ? row : {};
    const base = Object.assign({}, src, {
      id: normalizeText(src.id) || uid('s'),
      category: normalizeText(src.category) || 'Inne',
      name: normalizeText(src.name),
      price: Number(src.price) || 0,
      starterPrice: src.starterPrice === true,
      priceUserEditedAt: normalizeText(src.priceUserEditedAt || src.userEditedAt),
      note: normalizeText(src.note),
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
      if(String(row.materialType || '').trim().toLowerCase() === 'akcesoria'){
        const accessory = Object.assign({}, row);
        delete accessory.materialType;
        delete accessory.hasGrain;
        out.accessories.push(accessory);
      }
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
          storedHardwareSuppliers: readList('hardwareSuppliers', null),
          storedHardwareSettings: readList('hardwareSettings', null),
          storedHardwareCategories: readList('hardwareCategories', null),
          storedHardwareTypes: readList('hardwareTypes', null),
          storedHardwareTechnicalParams: readList('hardwareTechnicalParams', null),
          defaults: {
            sheetMaterials: DEFAULT_SHEET_MATERIALS,
            accessories: DEFAULT_ACCESSORIES,
            quoteRates: DEFAULT_QUOTE_RATES,
            workshopServices: DEFAULT_WORKSHOP_SERVICES,
            serviceOrders: DEFAULT_SERVICE_ORDERS,
            hardwareManufacturers: DEFAULT_HARDWARE_MANUFACTURERS,
            hardwareSuppliers: DEFAULT_HARDWARE_SUPPLIERS,
            hardwareSettings: DEFAULT_HARDWARE_SETTINGS,
            hardwareCategories: DEFAULT_HARDWARE_CATEGORIES,
            hardwareTypes: DEFAULT_HARDWARE_TYPES,
            hardwareTechnicalParams: DEFAULT_HARDWARE_TECHNICAL_PARAMS,
          },
          splitLegacyMaterials,
        })
      : {
          sheetMaterials: preferStoredSplit ? readList('sheetMaterials', DEFAULT_SHEET_MATERIALS) : splitLegacyMaterials(legacyMaterials).sheetMaterials,
          accessories: preferStoredSplit ? readList('accessories', DEFAULT_ACCESSORIES) : splitLegacyMaterials(legacyMaterials).accessories,
          quoteRates: preferStoredSplit ? readList('quoteRates', DEFAULT_QUOTE_RATES) : legacyServices,
          workshopServices: readList('workshopServices', DEFAULT_WORKSHOP_SERVICES),
          serviceOrders: readList('serviceOrders', DEFAULT_SERVICE_ORDERS),
          hardwareManufacturers: readList('hardwareManufacturers', DEFAULT_HARDWARE_MANUFACTURERS),
          hardwareSuppliers: readList('hardwareSuppliers', DEFAULT_HARDWARE_SUPPLIERS),
          hardwareSettings: readList('hardwareSettings', DEFAULT_HARDWARE_SETTINGS),
          hardwareCategories: readList('hardwareCategories', DEFAULT_HARDWARE_CATEGORIES),
          hardwareTypes: readList('hardwareTypes', DEFAULT_HARDWARE_TYPES),
          hardwareTechnicalParams: readList('hardwareTechnicalParams', DEFAULT_HARDWARE_TECHNICAL_PARAMS),
        };

    const hardwareSettings = normalizeHardwareSettings(seeds.hardwareSettings || readList('hardwareSettings', DEFAULT_HARDWARE_SETTINGS));
    const hardwareCategories = normalizeHardwareCategories(seeds.hardwareCategories || readList('hardwareCategories', DEFAULT_HARDWARE_CATEGORIES));
    const hardwareTypes = normalizeHardwareTypes(seeds.hardwareTypes || readList('hardwareTypes', DEFAULT_HARDWARE_TYPES));
    const hardwareTechnicalParams = normalizeHardwareTechnicalParams(seeds.hardwareTechnicalParams || readList('hardwareTechnicalParams', DEFAULT_HARDWARE_TECHNICAL_PARAMS), hardwareCategories);
    const supplierSeed = Array.isArray(seeds.hardwareSuppliers) ? seeds.hardwareSuppliers : readList('hardwareSuppliers', DEFAULT_HARDWARE_SUPPLIERS);
    const hardwareSuppliers = normalizeHardwareSuppliers(supplierSeed);
    currentHardwareSettings = Object.assign({}, hardwareSettings, { hardwareSuppliers, hardwareCategories, hardwareTypes, hardwareTechnicalParams });
    const sheetMaterials = ensureStarterMaterialSeeds(normalizeList(seeds.sheetMaterials, normalizeMaterialRow, DEFAULT_SHEET_MATERIALS)).filter((row)=> String(row.materialType || '').trim().toLowerCase() !== 'akcesoria');
    const accessorySeedRows = hardwareSeeds && typeof hardwareSeeds.mergeAccessorySeeds === 'function'
      ? hardwareSeeds.mergeAccessorySeeds(seeds.accessories)
      : seeds.accessories;
    const accessories = normalizeList(accessorySeedRows, normalizeAccessoryRow, DEFAULT_ACCESSORIES);
    const quoteRateSeed = laborCatalog && typeof laborCatalog.ensureDefaultDefinitions === 'function'
      ? laborCatalog.ensureDefaultDefinitions(seeds.quoteRates)
      : seeds.quoteRates;
    const quoteRates = normalizeList(quoteRateSeed, normalizeServiceRow, DEFAULT_QUOTE_RATES);
    const workshopServices = normalizeList(seeds.workshopServices, normalizeServiceRow, DEFAULT_WORKSHOP_SERVICES);
    const serviceOrders = normalizeList(seeds.serviceOrders, normalizeServiceOrderRow, DEFAULT_SERVICE_ORDERS);
    const storedManufacturers = readList('hardwareManufacturers', DEFAULT_HARDWARE_MANUFACTURERS);
    const manufacturerSeed = Array.isArray(seeds.hardwareManufacturers) ? seeds.hardwareManufacturers : storedManufacturers;
    const hardwareManufacturers = normalizeHardwareManufacturers(manufacturerSeed.concat(accessories.map((row)=> row && row.manufacturer)));

    // Service orders keep their separate store contract; C3.1 protects the global catalogs below.
    try{
      if(serviceOrderStore && typeof serviceOrderStore.writeAll === 'function') serviceOrderStore.writeAll(serviceOrders);
      else writeList('serviceOrders', serviceOrders);
    }catch(_){ }
    const failedKeys = [];
    const confirmedKeys = [];
    function persistMigrated(key, next){
      try{
        const source = { sheetMaterials:'materials', accessories:'materials', quoteRates:'services' }[key];
        if(!preferStoredSplit && source) assertCatalogReadable(source);
        const saved = writeList(key, next); confirmedKeys.push(KEYS[key] || key); return saved;
      }
      catch(_){ failedKeys.push(key); return readList(key, seeds[key]); }
    }

    cache = {
      sheetMaterials:persistMigrated('sheetMaterials', sheetMaterials),
      accessories:persistMigrated('accessories', accessories),
      quoteRates:persistMigrated('quoteRates', quoteRates),
      workshopServices:persistMigrated('workshopServices', workshopServices),
      hardwareManufacturers:persistMigrated('hardwareManufacturers', hardwareManufacturers),
      hardwareSuppliers:persistMigrated('hardwareSuppliers', hardwareSuppliers),
      hardwareSettings:persistMigrated('hardwareSettings', hardwareSettings),
      hardwareCategories:persistMigrated('hardwareCategories', hardwareCategories),
      hardwareTypes:persistMigrated('hardwareTypes', hardwareTypes),
      hardwareTechnicalParams:persistMigrated('hardwareTechnicalParams', hardwareTechnicalParams),
      serviceOrders,
    };
    // Update compatibility copies only after their authoritative key was confirmed.
    if(!failedKeys.includes('sheetMaterials')) persistMigrated('materials', cache.sheetMaterials);
    if(!failedKeys.includes('quoteRates')) persistMigrated('services', cache.quoteRates);
    refreshHardwareRuntimeSettings();
    syncRuntimeGlobals();
    return Object.assign({}, cache, { ok:failedKeys.length === 0, partial:failedKeys.length > 0 && confirmedKeys.length > 0, failedKeys, confirmedKeys });
  }

  let cache = { sheetMaterials:[], accessories:[], quoteRates:[], workshopServices:[], serviceOrders:[], hardwareManufacturers:[], hardwareSuppliers:[], hardwareSettings:Object.assign({}, DEFAULT_HARDWARE_SETTINGS), hardwareCategories:DEFAULT_HARDWARE_CATEGORIES.slice(), hardwareTypes:DEFAULT_HARDWARE_TYPES.slice(), hardwareTechnicalParams:DEFAULT_HARDWARE_TECHNICAL_PARAMS.slice() };

  function syncRuntimeGlobals(){
    try{ if(typeof materials !== 'undefined') materials = cache.sheetMaterials.slice(); }catch(_){ }
    try{ if(typeof services !== 'undefined') services = cache.quoteRates.slice(); }catch(_){ }
    try{ window.materials = cache.sheetMaterials.slice(); }catch(_){ }
    try{ window.services = cache.quoteRates.slice(); }catch(_){ }
  }

  cache = migrateLegacy(false);

  function getPriceList(kind){
    notifyRecoveryRequired();
    const key = String(kind || 'materials');
    if(key === 'materials') return clone(cache.sheetMaterials);
    if(key === 'accessories') return clone(cache.accessories);
    if(key === 'quoteRates') return clone(cache.quoteRates);
    if(key === 'workshopServices') return clone(cache.workshopServices);
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
    const next = normalizeHardwareManufacturers(list);
    writeList('hardwareManufacturers', next);
    cache.hardwareManufacturers = next;
    return getHardwareManufacturers();
  }
  function refreshHardwareRuntimeSettings(){
    currentHardwareSettings = Object.assign({}, cache.hardwareSettings || DEFAULT_HARDWARE_SETTINGS, {
      hardwareSuppliers:cache.hardwareSuppliers || [],
      hardwareCategories:cache.hardwareCategories || [],
      hardwareTypes:cache.hardwareTypes || [],
      hardwareTechnicalParams:cache.hardwareTechnicalParams || [],
    });
    return currentHardwareSettings;
  }
  function getHardwareSuppliers(){ return (cache.hardwareSuppliers || []).map((row)=> Object.assign({}, row)); }
  function saveHardwareSuppliers(list){
    const next = normalizeHardwareSuppliers(list);
    writeList('hardwareSuppliers', next);
    cache.hardwareSuppliers = next;
    refreshHardwareRuntimeSettings();
    return getHardwareSuppliers();
  }

  function getHardwareSettings(){ return Object.assign({}, cache.hardwareSettings || DEFAULT_HARDWARE_SETTINGS); }
  function saveHardwareSettings(settings){
    const next = normalizeHardwareSettings(settings);
    writeList('hardwareSettings', next);
    cache.hardwareSettings = next;
    refreshHardwareRuntimeSettings();
    return getHardwareSettings();
  }

  function getHardwareCategories(){ return (cache.hardwareCategories || []).slice(); }
  function saveHardwareCategories(list){
    const next = normalizeHardwareCategories(list);
    const params = normalizeHardwareTechnicalParams(cache.hardwareTechnicalParams || DEFAULT_HARDWARE_TECHNICAL_PARAMS, next);
    const confirmedKeys = [];
    try{
      writeList('hardwareCategories', next);
      confirmedKeys.push(KEYS.hardwareCategories || 'hardwareCategories');
      cache.hardwareCategories = next;
      refreshHardwareRuntimeSettings();
      writeList('hardwareTechnicalParams', params);
      cache.hardwareTechnicalParams = params;
      refreshHardwareRuntimeSettings();
      return getHardwareCategories();
    }catch(error){ throw markPartialWrite(error, confirmedKeys); }
  }

  function getHardwareTypes(){ return (cache.hardwareTypes || []).map((row)=> Object.assign({}, row, { allowedCategories:Array.isArray(row && row.allowedCategories) ? row.allowedCategories.slice() : [] })); }
  function saveHardwareTypes(list){
    const next = normalizeHardwareTypes(list);
    writeList('hardwareTypes', next);
    cache.hardwareTypes = next;
    refreshHardwareRuntimeSettings();
    return getHardwareTypes();
  }

  function getHardwareTechnicalParams(){ return normalizeHardwareTechnicalParams(cache.hardwareTechnicalParams || DEFAULT_HARDWARE_TECHNICAL_PARAMS, cache.hardwareCategories || []).map((row)=> Object.assign({}, row, { options:Array.isArray(row && row.options) ? row.options.slice() : [] })); }
  function saveHardwareTechnicalParams(list){
    const next = normalizeHardwareTechnicalParams(list, cache.hardwareCategories || []);
    writeList('hardwareTechnicalParams', next);
    cache.hardwareTechnicalParams = next;
    refreshHardwareRuntimeSettings();
    return getHardwareTechnicalParams();
  }

  function savePriceList(kind, list){
    const key = String(kind || 'materials');
    const confirmedKeys = [];
    try{
      if(key === 'materials'){
        const next = normalizeList(list, normalizeMaterialRow, DEFAULT_SHEET_MATERIALS).filter((row)=> String(row.materialType || '').trim().toLowerCase() !== 'akcesoria');
        writeList('sheetMaterials', next);
        confirmedKeys.push(KEYS.sheetMaterials || 'sheetMaterials');
        cache.sheetMaterials = next;
        writeList('materials', next);
      }
      else if(key === 'accessories'){
        refreshHardwareRuntimeSettings();
        const next = normalizeList(list, normalizeAccessoryRow, DEFAULT_ACCESSORIES);
        writeList('accessories', next);
        confirmedKeys.push(KEYS.accessories || 'accessories');
        cache.accessories = next;
        saveHardwareManufacturers((cache.hardwareManufacturers || []).concat(next.map((row)=> row && row.manufacturer)));
      }
      else if(key === 'quoteRates'){
        const normalized = normalizeList(list, normalizeServiceRow, DEFAULT_QUOTE_RATES);
        const seed = laborCatalog && typeof laborCatalog.ensureDefaultDefinitions === 'function' ? laborCatalog.ensureDefaultDefinitions(normalized) : normalized;
        const next = normalizeList(seed, normalizeServiceRow, DEFAULT_QUOTE_RATES);
        writeList('quoteRates', next);
        confirmedKeys.push(KEYS.quoteRates || 'quoteRates');
        cache.quoteRates = next;
        writeList('services', next);
      }
      else if(key === 'workshopServices'){
        const next = normalizeList(list, normalizeServiceRow, DEFAULT_WORKSHOP_SERVICES);
        writeList('workshopServices', next);
        confirmedKeys.push(KEYS.workshopServices || 'workshopServices');
        cache.workshopServices = next;
      }
      else throw new Error('Nieznany cennik: ' + key);
      return getPriceList(key);
    }catch(error){ throw markPartialWrite(error, confirmedKeys); }
    finally{ syncRuntimeGlobals(); }
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

  // Verified LOCAL-FIRST image, no normalization, storage writes or ID changes.
  function adoptVerified(model){
    FC.globalDataContract.validateBundle(model);
    const fields={sheetMaterials:'materials',accessories:'hardware',quoteRates:'labor',workshopServices:'workshopServices',hardwareManufacturers:'manufacturers',hardwareSuppliers:'suppliers',hardwareSettings:'hardwareSettings',hardwareCategories:'categories',hardwareTypes:'types',hardwareTechnicalParams:'technicalParams'};
    for(const [key,domain]of Object.entries(fields))cache[key]=clone(model[domain]);syncRuntimeGlobals();
  }

  FC.catalogStore = {
    adoptVerified,
    markPartialWrite,
    notifyRecoveryRequired,
    getPriceList,
    savePriceList,
    getPriceConfig,
    getSheetMaterials,
    getAccessories,
    getQuoteRates,
    getWorkshopServices,
    getHardwareManufacturers,
    saveHardwareManufacturers,
    getHardwareSuppliers,
    saveHardwareSuppliers,
    getHardwareSettings,
    saveHardwareSettings,
    getHardwareCategories,
    saveHardwareCategories,
    getHardwareTypes,
    saveHardwareTypes,
    getHardwareTechnicalParams,
    saveHardwareTechnicalParams,
    getServiceOrders,
    saveServiceOrders,
    upsertServiceOrder,
    removeServiceOrder,
    migrateLegacy,
  };
})();

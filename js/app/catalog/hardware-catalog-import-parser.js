// js/app/catalog/hardware-catalog-import-parser.js
// Parser plików JSON/XLSX katalogu okuć. Bez zapisu i bez decyzji importu.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const KIND = (FC.hardwareCatalogExportXlsx && FC.hardwareCatalogExportXlsx.KIND) || 'meble-app.hardware-catalog.export';

  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.').replace(/\s+/g, '')); return Number.isFinite(n) ? n : 0; }
  function optionalNumber(value){ return text(value) === '' ? undefined : number(value); }
  function bool(value){ const raw = text(value).toLowerCase(); return !['false','0','nie','no','n',''].includes(raw); }
  function safePart(value){ return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item'; }
  function headerKey(value){ return safePart(value).replace(/_+/g, '_'); }
  function valueFrom(row, names){ for(const name of names){ const key = headerKey(name); if(Object.prototype.hasOwnProperty.call(row, key)) return row[key]; } return ''; }
  function hasAnyValue(row, aliases){ return (aliases || []).some((name)=> text(valueFrom(row, [name]))); }
  function hasMeaningfulAccessoryData(row){
    const textStarters = ['id','nazwa','name','producent','manufacturer','symbol','notatka','note'];
    const priceStarters = ['cena_netto','cena_brutto','cena_katalogowa_netto','cena_katalogowa_brutto','price','cena_do_wyceny_brutto'];
    if(hasAnyValue(row, textStarters)) return true;
    return priceStarters.some((name)=> number(valueFrom(row, [name])) > 0);
  }
  function rowsToObjects(rows, options){
    const data = Array.isArray(rows) ? rows : [];
    const headers = (data[0] || []).map(headerKey);
    return data.slice(1).map((row, index)=>{
      const out = { __rowIndex:index + 2 };
      headers.forEach((h, i)=>{ if(h) out[h] = row[i] == null ? '' : row[i]; });
      return out;
    }).filter((row)=> options && options.kind === 'accessories' ? hasMeaningfulAccessoryData(row) : Object.keys(row).some((key)=> key !== '__rowIndex' && text(row[key])));
  }
  function normalizeSupplier(row){
    if(FC.hardwareCatalog && typeof FC.hardwareCatalog.normalizeSupplier === 'function') return FC.hardwareCatalog.normalizeSupplier(row || {});
    return Object.assign({}, row || {});
  }
  function parseAccessoryRow(row, technicalParams){
    const baseCategory = text(valueFrom(row, ['kategoria','hardwareCategory']));
    const api = FC.hardwareTechnicalParams || {};
    const defs = api.normalizeDefinitions ? api.normalizeDefinitions(technicalParams || api.DEFAULT_DEFINITIONS || [], [baseCategory]) : (technicalParams || []);
    const dynamic = {};
    (api.fieldsForCategory ? api.fieldsForCategory(defs, baseCategory) : []).forEach((field)=>{
      const key = api.columnKeyForField ? api.columnKeyForField(field) : field.key;
      if(field.fieldType === 'numberRange'){
        const keys = api.rangeColumnKeys ? api.rangeColumnKeys(field) : { from:key + '_od', to:key + '_do' };
        const from = valueFrom(row, [keys.from, key]);
        const to = valueFrom(row, [keys.to]);
        if(text(from) || text(to)) dynamic[field.key] = { from:optionalNumber(from), to:text(to) ? optionalNumber(to) : '' };
      }else if(field.fieldType === 'boolean'){
        const val = valueFrom(row, [key]);
        if(text(val)) dynamic[field.key] = { value:bool(val) };
      }else{
        const val = valueFrom(row, [key]);
        if(text(val)) dynamic[field.key] = { value:text(val) };
      }
    });
    return {
      __rowIndex:Number(row && row.__rowIndex) || 0,
      id:text(valueFrom(row, ['id'])),
      status:'active',
      manufacturer:text(valueFrom(row, ['producent','manufacturer'])),
      symbol:text(valueFrom(row, ['symbol'])),
      name:text(valueFrom(row, ['nazwa','name'])),
      hardwareCategory:text(valueFrom(row, ['kategoria','hardwareCategory'])),
      hardwareSystem:text(valueFrom(row, ['system_okucia','hardwareSystem','system','seria','series'])),
      hardwareType:text(valueFrom(row, ['typ_cecha','hardwareType','typ'])),
      hardwareUnit:text(valueFrom(row, ['jednostka','hardwareUnit'])),
      series:text(valueFrom(row, ['system_okucia','hardwareSystem','system','seria','series'])),
      drawerProfile:text(valueFrom(row, ['profil_szuflady','drawerProfile','profil'])),
      drawerLengthMm:optionalNumber(valueFrom(row, ['dlugosc_mm','drawerLengthMm','dlugosc_szuflady_mm'])),
      drawerLoadKg:optionalNumber(valueFrom(row, ['nosnosc_kg','drawerLoadKg','nosnosc'])),
      drawerReinforced:text(valueFrom(row, ['wzmocniona','drawerReinforced'])) ? bool(valueFrom(row, ['wzmocniona','drawerReinforced'])) : false,
      hardwareColor:text(valueFrom(row, ['kolor_okucia','hardwareColor'])),
      hardwareUsage:text(valueFrom(row, ['zastosowanie','hardwareUsage'])),
      technicalNote:text(valueFrom(row, ['uwagi_techniczne','technicalNote'])),
      technicalParams:dynamic,
      supplierId:text(valueFrom(row, ['dostawca_id','dostawca','supplierId'])),
      priceSource:text(valueFrom(row, ['zrodlo_ceny','priceSource'])),
      priceUpdatedAt:text(valueFrom(row, ['data_ceny','priceUpdatedAt'])),
      vatRate:optionalNumber(valueFrom(row, ['vat_proc','vatRate'])),
      catalogPriceGross:optionalNumber(valueFrom(row, ['cena_brutto','cena_katalogowa_brutto','catalogPriceGross'])),
      catalogPriceNet:optionalNumber(valueFrom(row, ['cena_netto','cena_katalogowa_netto','catalogPriceNet'])),
      supplierDiscountPercent:optionalNumber(valueFrom(row, ['rabat_dostawcy_proc','rabat_proc','rabat_%','supplierDiscountPercent'])),
      purchasePriceGross:optionalNumber(valueFrom(row, ['zakup_brutto','purchasePriceGross'])),
      purchasePriceNet:optionalNumber(valueFrom(row, ['zakup_netto','purchasePriceNet'])),
      quoteBase:text(valueFrom(row, ['baza_wyceny','quoteBase'])),
      pricingMode:text(valueFrom(row, ['sposob_liczenia','pricingMode'])),
      markupPercent:optionalNumber(valueFrom(row, ['narzut_proc','narzut_%','markupPercent'])),
      price:optionalNumber(valueFrom(row, ['cena_do_wyceny_brutto','price','quotePriceGross'])),
      quotePriceNet:optionalNumber(valueFrom(row, ['cena_do_wyceny_netto','quotePriceNet'])),
      bundleCostMode:text(valueFrom(row, ['tryb_ceny_zestawu','bundleCostMode'])),
      note:text(valueFrom(row, ['notatka','note'])),
    };
  }
  function parseCategoryRow(row){ return text(valueFrom(row, ['nazwa','name','kategoria'])); }
  function parseTypeRow(row){ return { id:text(valueFrom(row, ['id'])), name:text(valueFrom(row, ['nazwa','name','typ_cecha'])), allowedCategories:text(valueFrom(row, ['dozwolone_kategorie','allowedCategories'])).split(/[;,]/).map(text).filter(Boolean), active:text(valueFrom(row, ['aktywny','active'])) ? bool(valueFrom(row, ['aktywny','active'])) : true }; }
  function parseTechnicalParamRow(row){ return { id:text(valueFrom(row, ['id'])), category:text(valueFrom(row, ['kategoria','category'])), key:text(valueFrom(row, ['klucz','key'])), label:text(valueFrom(row, ['nazwa','label','name'])), fieldType:text(valueFrom(row, ['typ_pola','fieldType'])), unit:text(valueFrom(row, ['jednostka','unit'])), options:text(valueFrom(row, ['wartosci','options'])).split(/[;|]/).map(text).filter(Boolean), keyFeature:text(valueFrom(row, ['cecha_kluczowa','keyFeature'])) ? bool(valueFrom(row, ['cecha_kluczowa','keyFeature'])) : true, typePart:text(valueFrom(row, ['tworzy_typ','typePart'])) ? bool(valueFrom(row, ['tworzy_typ','typePart'])) : true, compareMode:text(valueFrom(row, ['sposob_porownania','compareMode'])), active:text(valueFrom(row, ['aktywny','active'])) ? bool(valueFrom(row, ['aktywny','active'])) : true, order:optionalNumber(valueFrom(row, ['kolejnosc','order'])) }; }
  function parseSupplierRow(row){ return normalizeSupplier({ id:text(valueFrom(row, ['id'])), name:text(valueFrom(row, ['nazwa','name'])), defaultDiscountPercent:number(valueFrom(row, ['rabat_domyslny_proc','defaultDiscountPercent'])), active:text(valueFrom(row, ['aktywny','active'])) ? bool(valueFrom(row, ['aktywny','active'])) : true }); }
  function accessoryKey(row){
    const id = text(row && row.id);
    if(id) return 'id:' + id;
    return ['sig', text(row && row.manufacturer).toLowerCase(), text(row && row.symbol).toLowerCase(), text(row && row.name).toLowerCase()].join('|');
  }
  function dedupeAccessories(rows){
    const byKey = new Map();
    (rows || []).forEach((row)=>{
      const key = accessoryKey(row);
      if(!key || key === 'sig|||') return;
      byKey.set(key, Object.assign({}, byKey.get(key) || {}, row));
    });
    return Array.from(byKey.values());
  }
  function parseWorkbook(workbook){
    const sheet = (name)=> workbook[name] || workbook[Object.keys(workbook || {}).find((key)=> headerKey(key) === headerKey(name))] || [];
    const categories = rowsToObjects(sheet('Kategorie_okuc')).map(parseCategoryRow).filter(Boolean);
    const technicalParams = rowsToObjects(sheet('Parametry_techniczne')).map(parseTechnicalParamRow).filter((row)=> text(row && row.category) && text(row && row.key));
    let accessories = rowsToObjects(sheet('Okucia'), { kind:'accessories' }).map((row)=> parseAccessoryRow(row, technicalParams));
    Object.keys(workbook || {}).forEach((sheetName)=>{
      if(headerKey(sheetName).indexOf('okucia_') !== 0 || headerKey(sheetName) === 'okucia') return;
      rowsToObjects(sheet(sheetName), { kind:'accessories' }).map((row)=> parseAccessoryRow(row, technicalParams)).forEach((row)=> accessories.push(row));
    });
    accessories = dedupeAccessories(accessories);
    const suppliers = rowsToObjects(sheet('Dostawcy')).map(parseSupplierRow).filter((row)=> text(row && row.name));
    const manufacturers = rowsToObjects(sheet('Producenci')).map((row)=> text(valueFrom(row, ['nazwa','name','producent']))).filter(Boolean);
    const types = rowsToObjects(sheet('Typy_cechy')).map(parseTypeRow).filter((row)=> text(row && row.name));
    const settings = {};
    rowsToObjects(sheet('Ustawienia')).forEach((row)=>{ const key = text(valueFrom(row, ['klucz','key'])); if(key) settings[key] = valueFrom(row, ['wartosc','value']); });
    const supplierPriceRows = rowsToObjects(sheet('Ceny_dostawcow'));
    const bundleRows = rowsToObjects(sheet('Sklad_zestawow')).map((row)=>({
      bundleId:text(valueFrom(row, ['zestaw_id','bundleId'])), bundleSymbol:text(valueFrom(row, ['zestaw_symbol','bundleSymbol'])), bundleName:text(valueFrom(row, ['zestaw_nazwa','bundleName'])), itemId:text(valueFrom(row, ['skladnik_id','itemId'])), itemSymbol:text(valueFrom(row, ['skladnik_symbol','itemSymbol'])), itemName:text(valueFrom(row, ['skladnik_nazwa','itemName'])), itemUnit:text(valueFrom(row, ['jednostka_skladnika','itemUnit'])), itemManufacturer:text(valueFrom(row, ['producent_skladnika','itemManufacturer'])), itemCategory:text(valueFrom(row, ['kategoria_skladnika','itemCategory'])), qty:number(valueFrom(row, ['ilosc','qty']))
    })).filter((row)=> row.qty > 0 && (row.bundleId || row.bundleName || row.itemId || row.itemName));
    return { accessories, manufacturers, suppliers, settings, categories, types, technicalParams, bundleRows, supplierPriceRows };
  }
  function parseJson(raw){
    const payload = JSON.parse(raw);
    if(payload && payload.kind === KIND && payload.data) return payload.data;
    if(payload && payload.accessories) return payload;
    if(payload && payload.data && payload.data.accessories) return payload.data;
    throw new Error('Ten JSON nie wygląda jak eksport katalogu okuć.');
  }
  async function parseFile(file){
    const name = text(file && file.name).toLowerCase();
    if(name.endsWith('.xlsx')){ if(!(FC.xlsxLite && typeof FC.xlsxLite.readWorkbook === 'function')) throw new Error('Brak modułu odczytu XLSX.'); return parseWorkbook(await FC.xlsxLite.readWorkbook(file)); }
    return parseJson(await file.text());
  }

  FC.hardwareCatalogImportParser = {
    parseFile,
    parseWorkbook,
    parseJson,
    rowsToObjects,
    parseAccessoryRow,
    parseCategoryRow,
    parseTypeRow,
    parseTechnicalParamRow,
    parseSupplierRow,
    _debug:{ valueFrom, headerKey, hasMeaningfulAccessoryData, rowsToObjects, parseAccessoryRow, parseWorkbook }
  };
})();

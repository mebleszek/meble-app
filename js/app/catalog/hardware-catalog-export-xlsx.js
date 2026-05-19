// js/app/catalog/hardware-catalog-export-xlsx.js
// Eksport katalogu okuć do JSON/XLSX: snapshot, arkusze i walidacje.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const KIND = 'meble-app.hardware-catalog.export';
  const VERSION = 10;
  const TEMPLATE_ROWS = 220;
  const ACCESSORY_COLUMNS = [
    ['nazwa','name'], ['jednostka','hardwareUnit'], ['producent','manufacturer'], ['kategoria','hardwareCategory'],
    ['system_okucia','hardwareSystem'], ['typ_cecha','hardwareType'], ['symbol','symbol'],
    ['profil_szuflady','drawerProfile'], ['dlugosc_mm','drawerLengthMm'], ['nosnosc_kg','drawerLoadKg'], ['wzmocniona','drawerReinforced'], ['kolor_okucia','hardwareColor'], ['zastosowanie','hardwareUsage'],
    ['tryb_ceny_zestawu','bundleCostMode'], ['uwagi_techniczne','technicalNote'], ['notatka','note'], ['id','id'],
  ];
  const SUPPLIER_COLUMNS = [['id','id'], ['nazwa','name'], ['rabat_domyslny_proc','defaultDiscountPercent'], ['aktywny','active']];
  const BUNDLE_COLUMNS = [
    ['zestaw_nazwa','bundleName'], ['skladnik_nazwa','itemName'], ['ilosc','qty'], ['zestaw_symbol','bundleSymbol'], ['skladnik_symbol','itemSymbol'], ['jednostka_skladnika','itemUnit'], ['producent_skladnika','itemManufacturer'], ['kategoria_skladnika','itemCategory'], ['zestaw_id','bundleId'], ['skladnik_id','itemId'],
  ];
  const PRICE_SOURCE_OPTIONS = ['Bivert','MAGO','Faktura','Hurtownia lokalna','Allegro','Ręcznie','Import Excel','Inne'];

  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.').replace(/\s+/g, '')); return Number.isFinite(n) ? n : 0; }
  function todayLocal(){ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function nowIso(){ try{ return new Date().toISOString(); }catch(_){ return String(Date.now()); } }
  function store(){ return FC.catalogStore || null; }
  function hw(){ return FC.hardwareCatalog || {}; }
  function optionValues(list, fallback){ const src = Array.isArray(list) ? list : fallback; return (src || []).map((row)=> text(row && typeof row === 'object' ? row.value : row)).filter(Boolean); }
  function listFormula(values){ return '"' + (values || []).map((value)=> text(value).replace(/,/g, ' ')).filter(Boolean).join(',') + '"'; }
  function xlCol(index){ let n = Number(index) + 1; let out = ''; while(n > 0){ const mod = (n - 1) % 26; out = String.fromCharCode(65 + mod) + out; n = Math.floor((n - 1) / 26); } return out; }
  function columnFor(prop){ const idx = ACCESSORY_COLUMNS.findIndex((pair)=> pair[1] === prop); return xlCol(idx < 0 ? 0 : idx); }
  function valueForColumn(obj, key){
    if(!obj || obj[key] == null) return '';
    if(key === 'drawerReinforced') return obj[key] ? 'TAK' : '';
    if(key === 'hardwareSystem') return obj.hardwareSystem || obj.series || '';
    return obj[key];
  }
  function isEmptyExportRow(obj){ return !(obj && (text(obj.id) || text(obj.name) || text(obj.manufacturer) || text(obj.symbol))); }

  function getSnapshot(){
    const s = store();
    return {
      accessories:s && s.getAccessories ? s.getAccessories() : [],
      manufacturers:s && s.getHardwareManufacturers ? s.getHardwareManufacturers() : [],
      suppliers:s && s.getHardwareSuppliers ? s.getHardwareSuppliers() : [],
      categories:s && s.getHardwareCategories ? s.getHardwareCategories() : [],
      types:s && s.getHardwareTypes ? s.getHardwareTypes() : [],
      technicalParams:s && s.getHardwareTechnicalParams ? s.getHardwareTechnicalParams() : ((FC.hardwareTechnicalParams && FC.hardwareTechnicalParams.DEFAULT_DEFINITIONS) || []),
      settings:s && s.getHardwareSettings ? s.getHardwareSettings() : {},
    };
  }
  function makeExportPayload(){ return { kind:KIND, version:VERSION, exportedAt:nowIso(), data:getSnapshot() }; }
  function downloadBlob(filename, blob){
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){ } try{ link.remove(); }catch(_){ } }, 0);
  }
  function exportJson(){
    const payload = makeExportPayload();
    const name = `hardware_catalog_backup_${todayLocal()}.json`;
    if(FC.dataBackupExport && typeof FC.dataBackupExport.downloadJson === 'function') FC.dataBackupExport.downloadJson(name, payload);
    else downloadBlob(name, new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8' }));
  }
  function defaultExportValues(_snap){ return { hardwareUnit:'szt.', hardwareCategory:'Zawiasy', hardwareSystem:'', hardwareType:'', drawerProfile:'', drawerLengthMm:'', drawerLoadKg:'', drawerReinforced:'', hardwareColor:'', hardwareUsage:'', bundleCostMode:'ownPrice' }; }
  function accessoryRow(obj, _rowNo, snap){ const source = isEmptyExportRow(obj) ? defaultExportValues(snap || {}) : obj || {}; return ACCESSORY_COLUMNS.map((pair)=> valueForColumn(source, pair[1])); }
  function buildAccessoryRows(accessories, snap){
    const rows = [ACCESSORY_COLUMNS.map((pair)=> pair[0])];
    const count = Math.max(TEMPLATE_ROWS, (accessories || []).length + 40);
    for(let i = 0; i < count; i++) rows.push(accessoryRow((accessories || [])[i] || {}, i + 2, snap || {}));
    return rows;
  }
  function buildSupplierRows(suppliers){ return [SUPPLIER_COLUMNS.map((pair)=> pair[0])].concat((suppliers || []).map((row)=> SUPPLIER_COLUMNS.map((pair)=> valueForColumn(row, pair[1])))); }
  function buildManufacturerRows(manufacturers){ return [['nazwa']].concat((manufacturers || []).map((name)=> [name])); }
  function buildCategoryRows(categories){ return [['nazwa']].concat((categories || []).map((name)=> [name])); }
  function buildTypeRows(types){ return [['nazwa','dozwolone_kategorie','aktywny','id']].concat((types || []).map((row)=> [row && row.name || '', (row && row.allowedCategories || []).join('; '), row && row.active === false ? 'NIE' : 'TAK', row && row.id || ''])); }
  function buildTechnicalParamRows(params){
    return [['kategoria','klucz','nazwa','typ_pola','jednostka','wartosci','cecha_kluczowa','tworzy_typ','sposob_porownania','aktywny','kolejnosc','id']].concat((params || []).map((row)=> [
      row && row.category || '', row && row.key || '', row && row.label || '', row && row.fieldType || 'text', row && row.unit || '', (row && row.options || []).join('; '), row && row.keyFeature === false ? 'NIE' : 'TAK', row && row.typePart === false ? 'NIE' : 'TAK', row && row.compareMode || 'equal', row && row.active === false ? 'NIE' : 'TAK', row && row.order || '', row && row.id || ''
    ]));
  }
  function dynamicValueFor(item, field){
    const api = FC.hardwareTechnicalParams || {};
    const params = item && item.technicalParams || {};
    const value = params[field.key];
    if(!value) return '';
    if(field.fieldType === 'boolean') return value.value ? 'TAK' : '';
    if(field.fieldType === 'numberRange'){
      const from = value.from != null ? value.from : '';
      const to = value.to != null ? value.to : '';
      return { from, to };
    }
    return value.value || '';
  }
  function groupColumnsForCategory(snap, category){
    const api = FC.hardwareTechnicalParams || {};
    const fields = api.fieldsForCategory ? api.fieldsForCategory(snap.technicalParams || [], category) : [];
    const base = [['nazwa','name'], ['jednostka','hardwareUnit'], ['producent','manufacturer'], ['kategoria','hardwareCategory'], ['system_okucia','hardwareSystem'], ['typ_cecha','hardwareType'], ['symbol','symbol']];
    const dyn = [];
    fields.forEach((field)=>{
      if(field.fieldType === 'numberRange'){
        const keys = api.rangeColumnKeys ? api.rangeColumnKeys(field) : { from:field.key + '_od', to:field.key + '_do' };
        dyn.push([keys.from, field.key + '.from', field]);
        dyn.push([keys.to, field.key + '.to', field]);
      }else{
        dyn.push([api.columnKeyForField ? api.columnKeyForField(field) : field.key, field.key, field]);
      }
    });
    return base.concat(dyn, [['tryb_ceny_zestawu','bundleCostMode'], ['uwagi_techniczne','technicalNote'], ['notatka','note'], ['id','id']]);
  }
  function groupedRowsForCategory(accessories, snap, category){
    const columns = groupColumnsForCategory(snap, category);
    const rows = [columns.map((pair)=> pair[0])];
    (accessories || []).filter((row)=> text(row && row.hardwareCategory) === text(category)).forEach((item)=>{
      rows.push(columns.map((pair)=>{
        const field = pair[2];
        if(field){
          const dynamic = dynamicValueFor(item, field);
          if(field.fieldType === 'numberRange') return String(pair[1]).endsWith('.to') ? (dynamic && dynamic.to || '') : (dynamic && dynamic.from || '');
          return dynamic;
        }
        return valueForColumn(item, pair[1]);
      }));
    });
    rows.push(columns.map((pair)=> pair[1] === 'hardwareCategory' ? category : (pair[1] === 'hardwareUnit' ? 'szt.' : '')));
    return rows;
  }
  function buildGroupedAccessorySheets(snap){
    const api = FC.hardwareTechnicalParams || {};
    const out = {};
    (snap.categories || []).forEach((category)=>{
      const sheetName = api.sheetNameForCategory ? api.sheetNameForCategory(category) : ('Okucia_' + text(category).replace(/[^a-z0-9]+/gi, '_')).slice(0,31);
      out[sheetName] = { rows:groupedRowsForCategory(snap.accessories || [], snap, category), freezeTopRow:true, widths:[34,12,18,24,24,24,18,16,16,16,16,16,18,20,20,24] };
    });
    return out;
  }
  function buildSettingsRows(settings){ return [['klucz','wartosc']].concat(Object.keys(settings || {}).map((key)=> [key, settings[key]])); }
  function buildBundleRows(accessories){
    const byId = new Map((accessories || []).map((row)=> [text(row && row.id), row]));
    const rows = [BUNDLE_COLUMNS.map((pair)=> pair[0])];
    (accessories || []).forEach((bundle)=>{
      (Array.isArray(bundle && bundle.bundleItems) ? bundle.bundleItems : []).forEach((entry)=>{
        const child = byId.get(text(entry && entry.itemId)) || {};
        const obj = { bundleName:bundle.name || '', itemName:child.name || '', qty:entry.qty || '', bundleSymbol:bundle.symbol || '', itemSymbol:child.symbol || '', itemUnit:child.hardwareUnit || '', itemManufacturer:child.manufacturer || '', itemCategory:child.hardwareCategory || '', bundleId:bundle.id || '', itemId:entry.itemId || '' };
        rows.push(BUNDLE_COLUMNS.map((pair)=> valueForColumn(obj, pair[1])));
      });
    });
    return rows;
  }
  function buildDictionaryRows(snap){
    const rows = [['typ','wartosc']];
    const add = (type, values)=> (values || []).forEach((value)=> rows.push([type, value]));
    add('kategoria', (snap.categories && snap.categories.length ? snap.categories : optionValues(hw().CATEGORIES, ['Zawiasy','Szuflady / prowadnice','Cargo / organizery','Inne'])));
    add('system_okucia', Array.from(new Set((snap.accessories || []).map((row)=> text((row && row.hardwareSystem) || (row && row.series))).filter(Boolean))));
    add('typ_cecha', (snap.types || []).map((row)=> row && row.name).filter(Boolean));
    add('parametr_techniczny', (snap.technicalParams || []).map((row)=> row && row.key).filter(Boolean));
    add('jednostka', optionValues(hw().UNITS, ['szt.','kpl.','mb','m²','zestaw']));
    add('baza_wyceny', optionValues(hw().QUOTE_BASES, [{ value:'catalogGross' }, { value:'purchaseGross' }, { value:'manualGross' }]));
    add('sposob_liczenia', optionValues(hw().PRICING_MODES, [{ value:'markup' }, { value:'manualPrice' }]));
    add('tryb_ceny_zestawu', optionValues(hw().BUNDLE_COST_MODES, [{ value:'ownPrice' }, { value:'components' }]));
    add('zrodlo_ceny', Array.from(new Set(PRICE_SOURCE_OPTIONS.concat((snap.accessories || []).map((row)=> text(row && row.priceSource)).filter(Boolean)))));
    return rows;
  }
  function accessoryValidations(_snap){
    const rowEnd = TEMPLATE_ROWS + 1;
    const categories = (Array.isArray(_snap && _snap.categories) && _snap.categories.length) ? _snap.categories : optionValues(hw().CATEGORIES, ['Zawiasy','Szuflady / prowadnice','Cargo / organizery','Inne']);
    const types = (Array.isArray(_snap && _snap.types) ? _snap.types.map((row)=> text(row && row.name)).filter(Boolean) : []);
    const units = optionValues(hw().UNITS, ['szt.','kpl.','mb','m²','zestaw']);
    const bundleModes = optionValues(hw().BUNDLE_COST_MODES, [{ value:'ownPrice' }, { value:'components' }]);
    const range = (prop)=> `${columnFor(prop)}2:${columnFor(prop)}${rowEnd}`;
    return [
      { sqref:range('hardwareUnit'), formula1:listFormula(units) },
      { sqref:range('manufacturer'), formula1:`Producenci!$A$2:$A$500` },
      { sqref:range('hardwareCategory'), formula1:listFormula(categories) },
      { sqref:range('hardwareType'), formula1:listFormula(types) },
      { sqref:range('bundleCostMode'), formula1:listFormula(bundleModes) },
    ];
  }
  function exportXlsx(){
    if(!(FC.xlsxLite && typeof FC.xlsxLite.makeWorkbookBlob === 'function')) throw new Error('Brak modułu XLSX.');
    const snap = getSnapshot();
    const supplierXlsx = FC.hardwareSupplierPriceXlsx || {};
    const sheets = Object.assign({
      Okucia:{ rows:buildAccessoryRows(snap.accessories, snap), validations:accessoryValidations(snap), freezeTopRow:true, widths:[36,12,18,24,24,24,18,16,14,14,12,16,18,22,26,28,24] },
      Ceny_dostawcow:{ rows:(supplierXlsx.buildSupplierPriceRows ? supplierXlsx.buildSupplierPriceRows(snap.accessories, snap.suppliers, snap.settings) : [['okucie_nazwa','okucie_symbol','producent','kategoria','jednostka','dostawca','cena_netto','cena_brutto','do_wyceny','status_ceny','data_ceny','okucie_id','dostawca_id']]), validations:(supplierXlsx.supplierPriceValidations ? supplierXlsx.supplierPriceValidations() : []), freezeTopRow:true, widths:[36,18,18,24,12,28,14,14,12,16,14,24,20] },
      Sklad_zestawow:{ rows:buildBundleRows(snap.accessories), freezeTopRow:true, widths:[34,34,10,18,18,16,20,24,24,24] },
      Dostawcy:{ rows:buildSupplierRows(snap.suppliers), freezeTopRow:true, widths:[20,28,20,12] },
      Producenci:{ rows:buildManufacturerRows(snap.manufacturers), freezeTopRow:true, widths:[24] },
      Kategorie_okuc:{ rows:buildCategoryRows(snap.categories), freezeTopRow:true, widths:[32] },
      Typy_cechy:{ rows:buildTypeRows(snap.types), freezeTopRow:true, widths:[24,36,12,24] },
      Parametry_techniczne:{ rows:buildTechnicalParamRows(snap.technicalParams), freezeTopRow:true, widths:[24,20,24,16,12,34,14,14,22,12,12,24] },
      Slowniki:{ rows:buildDictionaryRows(snap), freezeTopRow:true, widths:[24,34] },
      Ustawienia:{ rows:buildSettingsRows(snap.settings), freezeTopRow:true, widths:[28,24] },
    }, buildGroupedAccessorySheets(snap));
    const blob = FC.xlsxLite.makeWorkbookBlob(sheets);
    downloadBlob(`hardware_catalog_prices_${todayLocal()}.xlsx`, blob);
  }

  FC.hardwareCatalogExportXlsx = {
    KIND, VERSION, TEMPLATE_ROWS, ACCESSORY_COLUMNS, SUPPLIER_COLUMNS, BUNDLE_COLUMNS,
    getSnapshot, makeExportPayload, exportJson, exportXlsx,
    _debug:{ buildAccessoryRows, buildBundleRows, buildCategoryRows, buildTypeRows, buildTechnicalParamRows, buildGroupedAccessorySheets, buildSupplierRows, buildDictionaryRows, buildSettingsRows, accessoryValidations, columnFor }
  };
})();

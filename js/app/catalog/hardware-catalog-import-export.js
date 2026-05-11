// js/app/catalog/hardware-catalog-import-export.js
// Import/eksport katalogu okuć jako JSON i roboczy XLSX, z walidacją przed zapisem.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const KIND = 'meble-app.hardware-catalog.export';
  const VERSION = 7;
  const TEMPLATE_ROWS = 220;

  const ACCESSORY_COLUMNS = [
    ['nazwa','name'],
    ['jednostka','hardwareUnit'],
    ['producent','manufacturer'],
    ['kategoria','hardwareCategory'],
    ['typ_cecha','hardwareType'],
    ['symbol','symbol'],
    ['seria','series'],
    ['tryb_ceny_zestawu','bundleCostMode'],
    ['notatka','note'],
    ['id','id'],
  ];
  const SUPPLIER_COLUMNS = [['id','id'], ['nazwa','name'], ['rabat_domyslny_proc','defaultDiscountPercent'], ['vat_domyslny_proc','defaultVatRate'], ['aktywny','active']];
  const BUNDLE_COLUMNS = [
    ['zestaw_nazwa','bundleName'],
    ['skladnik_nazwa','itemName'],
    ['ilosc','qty'],
    ['zestaw_symbol','bundleSymbol'],
    ['skladnik_symbol','itemSymbol'],
    ['jednostka_skladnika','itemUnit'],
    ['producent_skladnika','itemManufacturer'],
    ['kategoria_skladnika','itemCategory'],
    ['zestaw_id','bundleId'],
    ['skladnik_id','itemId'],
  ];
  const PRICE_SOURCE_OPTIONS = ['Bivert','MAGO','Faktura','Hurtownia lokalna','Allegro','Ręcznie','Import Excel','Inne'];

  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.').replace(/\s+/g, '')); return Number.isFinite(n) ? n : 0; }
  function optionalNumber(value){ return text(value) === '' ? undefined : number(value); }
  function bool(value){ const raw = text(value).toLowerCase(); return !['false','0','nie','no','n',''].includes(raw); }
  function clone(value){ try{ return (FC.utils && FC.utils.clone) ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }catch(_){ return JSON.parse(JSON.stringify(value || null)); } }
  function nowIso(){ try{ return new Date().toISOString(); }catch(_){ return String(Date.now()); } }
  function todayLocal(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function safePart(value){ return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item'; }
  function signature(row){ return [safePart(row && row.manufacturer), safePart(row && row.symbol), safePart(row && row.name)].join('|'); }
  function makeGeneratedId(row){ return `hw_user_${safePart(row && row.manufacturer)}_${safePart(row && (row.symbol || row.name))}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }
  function store(){ return FC.catalogStore || null; }
  function hw(){ return FC.hardwareCatalog || {}; }
  function optionValues(list, fallback){
    const src = Array.isArray(list) ? list : fallback;
    return (src || []).map((row)=> text(row && typeof row === 'object' ? row.value : row)).filter(Boolean);
  }
  function optionLabels(list, fallback){
    const src = Array.isArray(list) ? list : fallback;
    return (src || []).map((row)=> row && typeof row === 'object' ? { value:text(row.value), label:text(row.label || row.value) } : { value:text(row), label:text(row) }).filter((row)=> row.value);
  }
  function listFormula(values){ return '"' + (values || []).map((value)=> text(value).replace(/,/g, ' ')).filter(Boolean).join(',') + '"'; }
  function round2(value){ const n = Number(value); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function netToGross(value, vat){ return (hw().netToGross || ((v, r)=> round2(number(v) * (1 + number(r) / 100))))(value, vat); }
  function grossToNet(value, vat){ return (hw().grossToNet || ((v, r)=> { const div = 1 + number(r) / 100; return div ? round2(number(v) / div) : round2(value); }))(value, vat); }
  function xlCol(index){ let n = Number(index) + 1; let out = ''; while(n > 0){ const mod = (n - 1) % 26; out = String.fromCharCode(65 + mod) + out; n = Math.floor((n - 1) / 26); } return out; }
  function columnFor(prop){ const idx = ACCESSORY_COLUMNS.findIndex((pair)=> pair[1] === prop); return xlCol(idx < 0 ? 0 : idx); }
  function headerKey(value){ return safePart(value).replace(/_+/g, '_'); }
  function valueFrom(row, names){ for(const name of names){ const key = headerKey(name); if(Object.prototype.hasOwnProperty.call(row, key)) return row[key]; } return ''; }
  function hasAnyValue(row, aliases){ return (aliases || []).some((name)=> text(valueFrom(row, [name]))); }
  function accessoryHasPrice(row){ return number(row && row.catalogPriceNet) > 0 || number(row && row.catalogPriceGross) > 0 || number(row && row.price) > 0 || number(row && row.quotePriceNet) > 0; }

  function normalizeAccessory(row, settings){
    const cfg = settings || (store() && store().getHardwareSettings ? store().getHardwareSettings() : undefined);
    if(FC.hardwareCatalog && typeof FC.hardwareCatalog.normalizeAccessory === 'function') return FC.hardwareCatalog.normalizeAccessory(row || {}, FC.utils && FC.utils.uid, cfg);
    return Object.assign({}, row || {});
  }
  function normalizeSupplier(row){
    if(FC.hardwareCatalog && typeof FC.hardwareCatalog.normalizeSupplier === 'function') return FC.hardwareCatalog.normalizeSupplier(row || {});
    return Object.assign({}, row || {});
  }
  function normalizeSettings(settings){
    if(FC.hardwareCatalog && typeof FC.hardwareCatalog.normalizeSettings === 'function') return FC.hardwareCatalog.normalizeSettings(settings || {});
    return Object.assign({}, settings || {});
  }
  function normalizeManufacturers(list){
    if(FC.hardwareCatalog && typeof FC.hardwareCatalog.normalizeManufacturerList === 'function') return FC.hardwareCatalog.normalizeManufacturerList(list || []);
    return Array.from(new Set((list || []).map(text).filter(Boolean)));
  }
  function getSnapshot(){
    const s = store();
    return {
      accessories:s && s.getAccessories ? s.getAccessories() : [],
      manufacturers:s && s.getHardwareManufacturers ? s.getHardwareManufacturers() : [],
      suppliers:s && s.getHardwareSuppliers ? s.getHardwareSuppliers() : [],
      categories:s && s.getHardwareCategories ? s.getHardwareCategories() : [],
      types:s && s.getHardwareTypes ? s.getHardwareTypes() : [],
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
  function valueForColumn(obj, key){ return obj && obj[key] != null ? obj[key] : ''; }
  function isEmptyExportRow(obj){ return !(obj && (text(obj.id) || text(obj.name) || text(obj.manufacturer) || text(obj.symbol))); }
  function defaultExportValues(_snap){
    return { hardwareUnit:'szt.', hardwareCategory:'Zawiasy', hardwareType:'', bundleCostMode:'ownPrice' };
  }
  function accessoryRow(obj, _rowNo, snap){
    const source = isEmptyExportRow(obj) ? defaultExportValues(snap || {}) : obj || {};
    return ACCESSORY_COLUMNS.map((pair)=> valueForColumn(source, pair[1]));
  }
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
  function buildSettingsRows(settings){ return [['klucz','wartosc']].concat(Object.keys(settings || {}).map((key)=> [key, settings[key]])); }
  function buildBundleRows(accessories){
    const byId = new Map((accessories || []).map((row)=> [text(row && row.id), row]));
    const rows = [BUNDLE_COLUMNS.map((pair)=> pair[0])];
    (accessories || []).forEach((bundle)=>{
      (Array.isArray(bundle && bundle.bundleItems) ? bundle.bundleItems : []).forEach((entry)=>{
        const child = byId.get(text(entry && entry.itemId)) || {};
        const obj = {
          bundleName:bundle.name || '',
          itemName:child.name || '',
          qty:entry.qty || '',
          bundleSymbol:bundle.symbol || '',
          itemSymbol:child.symbol || '',
          itemUnit:child.hardwareUnit || '',
          itemManufacturer:child.manufacturer || '',
          itemCategory:child.hardwareCategory || '',
          bundleId:bundle.id || '',
          itemId:entry.itemId || '',
        };
        rows.push(BUNDLE_COLUMNS.map((pair)=> valueForColumn(obj, pair[1])));
      });
    });
    return rows;
  }
  function buildDictionaryRows(snap){
    const rows = [['typ','wartosc']];
    const add = (type, values)=> (values || []).forEach((value)=> rows.push([type, value]));
    add('kategoria', (snap.categories && snap.categories.length ? snap.categories : optionValues(hw().CATEGORIES, ['Zawiasy','Szuflady / prowadnice','Cargo / organizery','Inne'])));
    add('typ_cecha', (snap.types || []).map((row)=> row && row.name).filter(Boolean));
    add('jednostka', optionValues(hw().UNITS, ['szt.','kpl.','mb','m²','zestaw']));
    add('vat_proc', ['23','8','0']);
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
    const blob = FC.xlsxLite.makeWorkbookBlob({
      Okucia:{ rows:buildAccessoryRows(snap.accessories, snap), validations:accessoryValidations(snap), freezeTopRow:true, widths:[36,12,18,24,24,18,18,22,28,24] },
      Ceny_dostawcow:{ rows:(FC.hardwareSupplierPriceXlsx && FC.hardwareSupplierPriceXlsx.buildSupplierPriceRows ? FC.hardwareSupplierPriceXlsx.buildSupplierPriceRows(snap.accessories, snap.suppliers) : [['okucie_nazwa','okucie_symbol','producent','dostawca','cena_netto','cena_brutto','do_wyceny','status_ceny','data_ceny','okucie_id','dostawca_id']]), validations:(FC.hardwareSupplierPriceXlsx && FC.hardwareSupplierPriceXlsx.supplierPriceValidations ? FC.hardwareSupplierPriceXlsx.supplierPriceValidations() : []), freezeTopRow:true, widths:[36,18,18,28,14,14,12,16,14,24,20] },
      Sklad_zestawow:{ rows:buildBundleRows(snap.accessories), freezeTopRow:true, widths:[34,34,10,18,18,16,20,24,24,24] },
      Dostawcy:{ rows:buildSupplierRows(snap.suppliers), freezeTopRow:true, widths:[20,28,20,18,12] },
      Producenci:{ rows:buildManufacturerRows(snap.manufacturers), freezeTopRow:true, widths:[24] },
      Kategorie_okuc:{ rows:buildCategoryRows(snap.categories), freezeTopRow:true, widths:[32] },
      Typy_cechy:{ rows:buildTypeRows(snap.types), freezeTopRow:true, widths:[24,36,12,24] },
      Slowniki:{ rows:buildDictionaryRows(snap), freezeTopRow:true, widths:[24,34] },
      Ustawienia:{ rows:buildSettingsRows(snap.settings), freezeTopRow:true, widths:[28,24] },
    });
    downloadBlob(`hardware_catalog_prices_${todayLocal()}.xlsx`, blob);
  }

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
  function parseAccessoryRow(row){
    return {
      __rowIndex:Number(row && row.__rowIndex) || 0,
      id:text(valueFrom(row, ['id'])),
      status:'active',
      manufacturer:text(valueFrom(row, ['producent','manufacturer'])),
      symbol:text(valueFrom(row, ['symbol'])),
      name:text(valueFrom(row, ['nazwa','name'])),
      hardwareCategory:text(valueFrom(row, ['kategoria','hardwareCategory'])),
      hardwareType:text(valueFrom(row, ['typ_cecha','hardwareType','typ'])),
      hardwareUnit:text(valueFrom(row, ['jednostka','hardwareUnit'])),
      series:text(valueFrom(row, ['seria','series'])),
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
  function parseSupplierRow(row){ return normalizeSupplier({ id:text(valueFrom(row, ['id'])), name:text(valueFrom(row, ['nazwa','name'])), defaultDiscountPercent:number(valueFrom(row, ['rabat_domyslny_proc','defaultDiscountPercent'])), defaultVatRate:number(valueFrom(row, ['vat_domyslny_proc','defaultVatRate'])), active:text(valueFrom(row, ['aktywny','active'])) ? bool(valueFrom(row, ['aktywny','active'])) : true }); }
  function parseWorkbook(workbook){
    const sheet = (name)=> workbook[name] || workbook[Object.keys(workbook || {}).find((key)=> headerKey(key) === headerKey(name))] || [];
    const accessories = rowsToObjects(sheet('Okucia'), { kind:'accessories' }).map(parseAccessoryRow);
    const suppliers = rowsToObjects(sheet('Dostawcy')).map(parseSupplierRow).filter((row)=> text(row && row.name));
    const manufacturers = rowsToObjects(sheet('Producenci')).map((row)=> text(valueFrom(row, ['nazwa','name','producent']))).filter(Boolean);
    const categories = rowsToObjects(sheet('Kategorie_okuc')).map(parseCategoryRow).filter(Boolean);
    const types = rowsToObjects(sheet('Typy_cechy')).map(parseTypeRow).filter((row)=> text(row && row.name));
    const settings = {};
    rowsToObjects(sheet('Ustawienia')).forEach((row)=>{ const key = text(valueFrom(row, ['klucz','key'])); if(key) settings[key] = valueFrom(row, ['wartosc','value']); });
    const supplierPriceRows = rowsToObjects(sheet('Ceny_dostawcow'));
    const bundleRows = rowsToObjects(sheet('Sklad_zestawow')).map((row)=>({
      bundleId:text(valueFrom(row, ['zestaw_id','bundleId'])),
      bundleSymbol:text(valueFrom(row, ['zestaw_symbol','bundleSymbol'])),
      bundleName:text(valueFrom(row, ['zestaw_nazwa','bundleName'])),
      itemId:text(valueFrom(row, ['skladnik_id','itemId'])),
      itemSymbol:text(valueFrom(row, ['skladnik_symbol','itemSymbol'])),
      itemName:text(valueFrom(row, ['skladnik_nazwa','itemName'])),
      itemUnit:text(valueFrom(row, ['jednostka_skladnika','itemUnit'])),
      itemManufacturer:text(valueFrom(row, ['producent_skladnika','itemManufacturer'])),
      itemCategory:text(valueFrom(row, ['kategoria_skladnika','itemCategory'])),
      qty:number(valueFrom(row, ['ilosc','qty']))
    })).filter((row)=> row.qty > 0 && (row.bundleId || row.bundleName || row.itemId || row.itemName));
    return { accessories, manufacturers, suppliers, settings, categories, types, bundleRows, supplierPriceRows };
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
  function indexExisting(existing){ const byId = new Map(); const bySig = new Map(); (existing || []).forEach((row)=>{ if(text(row && row.id)) byId.set(text(row.id), row); bySig.set(signature(row), row); }); return { byId, bySig }; }
  function validateChoice(label, value, allowed, rowIndex, warnings){ if(!text(value) || !allowed.length || allowed.includes(text(value))) return; warnings.push(`Okucia: wiersz ${rowIndex || '?'} pole ${label} ma wartość spoza listy programu: ${value}.`); }
  function requiredGapsForAccessory(src){
    const gaps = [];
    if(src && src.__skipImport) return gaps;
    if(!text(src && src.name)) gaps.push('name');
    if(!text(src && src.manufacturer)) gaps.push('manufacturer');
    if(!text(src && src.hardwareCategory)) gaps.push('hardwareCategory');
    if(!text(src && src.hardwareUnit)) gaps.push('hardwareUnit');
    return gaps;
  }
  function findRequiredGaps(data){
    return (Array.isArray(data && data.accessories) ? data.accessories : [])
      .map((row, index)=>({ row, index, rowIndex:Number(row && row.__rowIndex) || (index + 2), gaps:requiredGapsForAccessory(row) }))
      .filter((entry)=> entry.gaps.length);
  }
  function getRequiredChoiceOptions(data){
    const s = store();
    const snap = getSnapshot();
    const manufacturers = normalizeManufacturers((Array.isArray(data && data.manufacturers) ? data.manufacturers : []).concat(snap.manufacturers || []));
    const categories = optionLabels((s && s.getHardwareCategories ? s.getHardwareCategories() : hw().CATEGORIES), ['Zawiasy','Szuflady / prowadnice','Cargo / organizery','Inne']);
    const units = optionLabels(hw().UNITS, ['szt.','kpl.','mb','m²','zestaw']);
    return { manufacturers:manufacturers.map((name)=>({ value:name, label:name })), categories, units, settings:s && s.getHardwareSettings ? s.getHardwareSettings() : {}, suppliers:s && s.getHardwareSuppliers ? s.getHardwareSuppliers() : [] };
  }
  function resolveSupplierId(value, suppliers){
    const raw = text(value);
    if(!raw) return '';
    const found = (suppliers || []).find((row)=> text(row && row.id).toLowerCase() === raw.toLowerCase() || text(row && row.name).toLowerCase() === raw.toLowerCase());
    return found ? text(found.id) : raw;
  }
  function enrichAccessoryDefaults(src, settings, suppliers){
    const cfg = normalizeSettings(settings || {});
    const out = Object.assign({}, src || {});
    out.status = text(out.status) || 'active';
    out.vatRate = out.vatRate == null ? cfg.defaultVatRate : number(out.vatRate);
    out.supplierId = resolveSupplierId(out.supplierId, suppliers) || cfg.defaultSupplierId;
    const supplier = (suppliers || []).find((row)=> text(row && row.id) === text(out.supplierId)) || {};
    if(out.supplierDiscountPercent == null) out.supplierDiscountPercent = number(supplier.defaultDiscountPercent);
    if(out.markupPercent == null) out.markupPercent = cfg.defaultMarkupPercent;
    if(!text(out.quoteBase)) out.quoteBase = cfg.defaultQuoteBase;
    if(!text(out.pricingMode)) out.pricingMode = cfg.defaultPricingMode;
    if(!text(out.bundleCostMode)) out.bundleCostMode = 'ownPrice';
    if(!text(out.priceSource)) out.priceSource = 'Import Excel';
    if(out.catalogPriceGross == null && out.catalogPriceNet != null) out.catalogPriceGross = netToGross(out.catalogPriceNet, out.vatRate);
    if(out.catalogPriceNet == null && out.catalogPriceGross != null) out.catalogPriceNet = grossToNet(out.catalogPriceGross, out.vatRate);
    if(out.purchasePriceGross == null && out.purchasePriceNet != null) out.purchasePriceGross = netToGross(out.purchasePriceNet, out.vatRate);
    if(out.purchasePriceNet == null && out.purchasePriceGross != null) out.purchasePriceNet = grossToNet(out.purchasePriceGross, out.vatRate);
    if(out.price == null && out.quotePriceNet != null) out.price = netToGross(out.quotePriceNet, out.vatRate);
    if(out.quotePriceNet == null && out.price != null) out.quotePriceNet = grossToNet(out.price, out.vatRate);
    if(!text(out.priceUpdatedAt) && accessoryHasPrice(out)) out.priceUpdatedAt = todayLocal();
    return out;
  }
  function normalizeImportedAccessories(importRows, existing, warnings, errors, settings, suppliers){
    const existingIndex = indexExisting(existing);
    const usedIds = new Set();
    const importedByKey = new Map();
    const normalized = [];
    const currentStore = store();
    const allowed = { unit:optionValues(hw().UNITS, []), category:(currentStore && currentStore.getHardwareCategories ? currentStore.getHardwareCategories() : optionValues(hw().CATEGORIES, [])), type:(currentStore && currentStore.getHardwareTypes ? currentStore.getHardwareTypes().map((row)=> text(row && row.name)).filter(Boolean) : []), base:optionValues(hw().QUOTE_BASES, []), mode:optionValues(hw().PRICING_MODES, []), bundleMode:optionValues(hw().BUNDLE_COST_MODES, []) };
    (Array.isArray(importRows) ? importRows : []).filter((row)=> !(row && row.__skipImport)).forEach((raw)=>{
      const missing = requiredGapsForAccessory(raw);
      const rowIndex = Number(raw && raw.__rowIndex) || '?';
      if(missing.length){ errors.push(`Okucia: wiersz ${rowIndex} wymaga uzupełnienia pól obowiązkowych przed importem.`); return; }
      const src = enrichAccessoryDefaults(raw, settings, suppliers);
      validateChoice('jednostka', src.hardwareUnit, allowed.unit, rowIndex, warnings);
      validateChoice('kategoria', src.hardwareCategory, allowed.category, rowIndex, warnings);
      validateChoice('typ/cecha', src.hardwareType, allowed.type, rowIndex, warnings);
      validateChoice('baza_wyceny', src.quoteBase, allowed.base, rowIndex, warnings);
      validateChoice('sposob_liczenia', src.pricingMode, allowed.mode, rowIndex, warnings);
      validateChoice('tryb_ceny_zestawu', src.bundleCostMode, allowed.bundleMode, rowIndex, warnings);
      let id = text(src.id);
      const sig = signature(src);
      if(!id && existingIndex.bySig.has(sig)){ id = text(existingIndex.bySig.get(sig).id); warnings.push(`Okucia: wiersz ${rowIndex} bez ID dopasowano po producent+symbol+nazwa do istniejącej pozycji.`); }
      if(!id) id = makeGeneratedId(src);
      if(usedIds.has(id)){ errors.push(`Okucia: zdublowane ID w importowanym pliku: ${id}`); return; }
      usedIds.add(id);
      const normalizedRow = normalizeAccessory(Object.assign({}, src, { id }), settings);
      normalized.push(normalizedRow);
      importedByKey.set(text(normalizedRow.id), normalizedRow);
      importedByKey.set(signature(normalizedRow), normalizedRow);
    });
    return { rows:normalized, byKey:importedByKey };
  }
  function applyBundleRows(imported, bundleRows, existing){
    if(!Array.isArray(bundleRows) || !bundleRows.length) return;
    const existingIndex = indexExisting(existing || []);
    const importedIndex = indexExisting(imported.rows || []);
    const resolve = (id, symbol, name)=> {
      if(id && importedIndex.byId.has(id)) return importedIndex.byId.get(id);
      if(id && existingIndex.byId.has(id)) return existingIndex.byId.get(id);
      const foundImported = (imported.rows || []).find((row)=> safePart(row && row.symbol) === safePart(symbol) && safePart(row && row.name) === safePart(name));
      const foundExisting = (existing || []).find((row)=> safePart(row && row.symbol) === safePart(symbol) && safePart(row && row.name) === safePart(name));
      return foundImported || foundExisting || null;
    };
    const byId = new Map((imported.rows || []).map((row)=> [text(row.id), row]));
    bundleRows.forEach((entry)=>{
      const bundle = resolve(entry.bundleId, entry.bundleSymbol, entry.bundleName);
      const child = resolve(entry.itemId, entry.itemSymbol, entry.itemName);
      if(!bundle || !child || text(bundle.id) === text(child.id)) return;
      const target = byId.get(text(bundle.id));
      if(!target) return;
      target.bundleItems = Array.isArray(target.bundleItems) ? target.bundleItems : [];
      target.bundleItems = target.bundleItems.filter((row)=> text(row && row.itemId) !== text(child.id));
      target.bundleItems.push({ itemId:text(child.id), qty:number(entry.qty) || 1 });
    });
  }

  const ACCESSORY_DIFF_FIELDS = ['name','hardwareUnit','manufacturer','hardwareCategory','hardwareType','symbol','series','bundleCostMode','note'];
  function canonicalValue(value){
    if(Array.isArray(value)) return JSON.stringify(value.map((row)=> row && typeof row === 'object' ? Object.keys(row).sort().reduce((out, key)=>{ out[key] = row[key]; return out; }, {}) : row));
    if(value && typeof value === 'object') return JSON.stringify(value);
    return text(value);
  }
  function sameBundleItems(a, b){
    const clean = (list)=> (Array.isArray(list) ? list : [])
      .map((row)=>({ itemId:text(row && row.itemId), qty:number(row && row.qty) || 0 }))
      .filter((row)=> row.itemId && row.qty > 0)
      .sort((x, y)=> (x.itemId + ':' + x.qty).localeCompare(y.itemId + ':' + y.qty));
    return JSON.stringify(clean(a)) === JSON.stringify(clean(b));
  }
  function sameImportedAccessory(existing, imported){
    if(!existing || !imported) return false;
    return ACCESSORY_DIFF_FIELDS.every((field)=> canonicalValue(existing && existing[field]) === canonicalValue(imported && imported[field]))
      && sameBundleItems(existing && existing.bundleItems, imported && imported.bundleItems);
  }
  function classifyImportedAccessories(importedRows, existingById){
    const addedIds = new Set();
    const changedIds = new Set();
    const unchangedIds = new Set();
    (importedRows || []).forEach((row)=>{
      const id = text(row && row.id);
      const existing = existingById.get(id);
      if(!existing){ addedIds.add(id); return; }
      if(sameImportedAccessory(existing, row)) unchangedIds.add(id);
      else changedIds.add(id);
    });
    return { addedIds, changedIds, unchangedIds };
  }
  function mergeAccessories(existing, importedRows, classification){
    const importedById = new Map((importedRows || []).map((row)=> [text(row && row.id), row]));
    const keepOrReplace = (row)=>{
      const id = text(row && row.id);
      return classification.changedIds.has(id) ? (importedById.get(id) || row) : row;
    };
    return (existing || []).map(keepOrReplace).concat((importedRows || []).filter((row)=> classification.addedIds.has(text(row && row.id))));
  }
  function buildImportPlan(data, options){
    const mode = text(options && options.mode) === 'replace' ? 'replace' : 'merge';
    const s = store();
    if(!(s && typeof s.savePriceList === 'function')) throw new Error('Brak catalogStore.savePriceList.');
    const existing = s.getAccessories ? s.getAccessories() : [];
    const warnings = [];
    const errors = [];
    const importedSettings = Object.keys(data && data.settings || {}).length ? normalizeSettings(data.settings) : (s.getHardwareSettings ? s.getHardwareSettings() : {});
    const suppliers = Array.isArray(data && data.suppliers) && data.suppliers.length ? data.suppliers.map(normalizeSupplier).filter((row)=> text(row && row.name)) : (s.getHardwareSuppliers ? s.getHardwareSuppliers() : []);
    const categories = Array.isArray(data && data.categories) && data.categories.length ? data.categories : (s.getHardwareCategories ? s.getHardwareCategories() : []);
    const types = Array.isArray(data && data.types) && data.types.length ? data.types : (s.getHardwareTypes ? s.getHardwareTypes() : []);
    const importedAccessories = normalizeImportedAccessories(data && data.accessories, existing, warnings, errors, importedSettings, suppliers);
    applyBundleRows(importedAccessories, data && data.bundleRows, existing);
    const existingById = new Map(existing.map((row)=> [text(row && row.id), row]));
    const importedIds = new Set(importedAccessories.rows.map((row)=> text(row && row.id)));
    const classification = classifyImportedAccessories(importedAccessories.rows, existingById);
    const addCount = classification.addedIds.size;
    const accessoryUpdateCount = classification.changedIds.size;
    const unchangedCount = classification.unchangedIds.size;
    const removeCount = mode === 'replace' ? existing.filter((row)=> !importedIds.has(text(row && row.id))).length : 0;
    let nextAccessories = mode === 'replace' ? importedAccessories.rows : mergeAccessories(existing, importedAccessories.rows, classification);
    let supplierPriceSummary = { touchedIds:[], rows:0, added:0, updated:0, unchanged:0, skipped:0 };
    if(FC.hardwareSupplierPriceXlsx && typeof FC.hardwareSupplierPriceXlsx.applySupplierPriceRows === 'function'){
      supplierPriceSummary = FC.hardwareSupplierPriceXlsx.applySupplierPriceRows(nextAccessories, data && data.supplierPriceRows, suppliers, warnings) || supplierPriceSummary;
      const settingsForNormalize = Object.assign({}, importedSettings, { hardwareSuppliers:suppliers });
      nextAccessories = nextAccessories.map((row)=> normalizeAccessory(row, settingsForNormalize));
    }
    const manufacturers = normalizeManufacturers((Array.isArray(data && data.manufacturers) ? data.manufacturers : []).concat(nextAccessories.map((row)=> row.manufacturer)));
    const priceChanged = number(supplierPriceSummary.added) + number(supplierPriceSummary.updated);
    return {
      mode,
      errors,
      warnings,
      next:{ accessories:nextAccessories, suppliers, manufacturers, settings:importedSettings, categories, types },
      summary:{
        imported:importedAccessories.rows.length,
        accessoryRows:importedAccessories.rows.length,
        added:addCount,
        updated:accessoryUpdateCount,
        unchanged:unchangedCount,
        removed:removeCount,
        suppliers:suppliers.length,
        manufacturers:manufacturers.length,
        supplierPrices:supplierPriceSummary.rows || 0,
        supplierPricesAdded:supplierPriceSummary.added || 0,
        supplierPricesUpdated:supplierPriceSummary.updated || 0,
        supplierPricesUnchanged:supplierPriceSummary.unchanged || 0,
        supplierPricesSkipped:supplierPriceSummary.skipped || 0,
        totalChanged:accessoryUpdateCount + addCount + priceChanged,
      }
    };
  }
  function applyImportPlan(plan){
    const s = store();
    if(plan && plan.errors && plan.errors.length) throw new Error('Import ma błędy walidacji.');
    if(!(s && typeof s.savePriceList === 'function')) throw new Error('Brak zapisu katalogu.');
    if(s.saveHardwareSettings) s.saveHardwareSettings(plan.next.settings || {});
    if(s.saveHardwareSuppliers) s.saveHardwareSuppliers(plan.next.suppliers || []);
    if(s.saveHardwareCategories) s.saveHardwareCategories(plan.next.categories || []);
    if(s.saveHardwareTypes) s.saveHardwareTypes(plan.next.types || []);
    s.savePriceList('accessories', plan.next.accessories || []);
    if(s.saveHardwareManufacturers) s.saveHardwareManufacturers(plan.next.manufacturers || []);
    return plan.summary || {};
  }

  FC.hardwareCatalogImportExport = {
    KIND, VERSION, ACCESSORY_COLUMNS, SUPPLIER_COLUMNS, BUNDLE_COLUMNS,
    getSnapshot, makeExportPayload, exportJson, exportXlsx, parseFile, parseWorkbook, parseJson,
    buildImportPlan, applyImportPlan, findRequiredGaps, getRequiredChoiceOptions,
    _debug:{ rowsToObjects, parseAccessoryRow, buildAccessoryRows, buildBundleRows, buildCategoryRows, buildTypeRows, accessoryValidations, buildDictionaryRows, requiredGapsForAccessory, enrichAccessoryDefaults, columnFor, sameImportedAccessory, classifyImportedAccessories }
  };
})();

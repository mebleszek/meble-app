// js/app/catalog/hardware-catalog-import-export.js
// Import/eksport katalogu okuć jako JSON i roboczy XLSX, z walidacją przed zapisem.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const KIND = 'meble-app.hardware-catalog.export';
  const VERSION = 1;

  const ACCESSORY_COLUMNS = [
    ['id','id'], ['status','status'], ['producent','manufacturer'], ['symbol','symbol'], ['nazwa','name'], ['kategoria','hardwareCategory'], ['jednostka','hardwareUnit'], ['seria','series'],
    ['dostawca_id','supplierId'], ['zrodlo_ceny','priceSource'], ['data_ceny','priceUpdatedAt'], ['vat_proc','vatRate'],
    ['cena_katalogowa_brutto','catalogPriceGross'], ['cena_katalogowa_netto','catalogPriceNet'], ['rabat_dostawcy_proc','supplierDiscountPercent'],
    ['zakup_brutto','purchasePriceGross'], ['zakup_netto','purchasePriceNet'], ['baza_wyceny','quoteBase'], ['sposob_liczenia','pricingMode'],
    ['narzut_proc','markupPercent'], ['cena_do_wyceny_brutto','price'], ['cena_do_wyceny_netto','quotePriceNet'], ['tryb_ceny_zestawu','bundleCostMode'], ['notatka','note']
  ];
  const SUPPLIER_COLUMNS = [['id','id'], ['nazwa','name'], ['rabat_domyslny_proc','defaultDiscountPercent'], ['vat_domyslny_proc','defaultVatRate'], ['aktywny','active']];
  const BUNDLE_COLUMNS = [['zestaw_id','bundleId'], ['zestaw_symbol','bundleSymbol'], ['zestaw_nazwa','bundleName'], ['skladnik_id','itemId'], ['skladnik_symbol','itemSymbol'], ['skladnik_nazwa','itemName'], ['ilosc','qty']];

  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.').replace(/\s+/g, '')); return Number.isFinite(n) ? n : 0; }
  function bool(value){ const raw = text(value).toLowerCase(); return !['false','0','nie','no','n',''].includes(raw); }
  function clone(value){ try{ return (FC.utils && FC.utils.clone) ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }catch(_){ return JSON.parse(JSON.stringify(value || null)); } }
  function nowIso(){ try{ return new Date().toISOString(); }catch(_){ return String(Date.now()); } }
  function todayLocal(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function safePart(value){ return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item'; }
  function signature(row){ return [safePart(row && row.manufacturer), safePart(row && row.symbol), safePart(row && row.name)].join('|'); }
  function makeGeneratedId(row){ return `hw_user_${safePart(row && row.manufacturer)}_${safePart(row && row.symbol || row && row.name)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }
  function store(){ return FC.catalogStore || null; }
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
      settings:s && s.getHardwareSettings ? s.getHardwareSettings() : {},
    };
  }
  function makeExportPayload(){
    return { kind:KIND, version:VERSION, exportedAt:nowIso(), data:getSnapshot() };
  }
  function downloadBlob(filename, blob){
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){ } try{ link.remove(); }catch(_){ } }, 0);
  }
  function exportJson(){
    const payload = makeExportPayload();
    const name = `hardware_catalog_backup_${todayLocal()}.json`;
    if(FC.dataBackupExport && typeof FC.dataBackupExport.downloadJson === 'function') FC.dataBackupExport.downloadJson(name, payload);
    else downloadBlob(name, new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8' }));
  }
  function rowFromColumns(obj, columns){ return columns.map((pair)=> obj && obj[pair[1]] != null ? obj[pair[1]] : ''); }
  function buildAccessoryRows(accessories){ return [ACCESSORY_COLUMNS.map((pair)=> pair[0])].concat((accessories || []).map((row)=> rowFromColumns(row, ACCESSORY_COLUMNS))); }
  function buildSupplierRows(suppliers){ return [SUPPLIER_COLUMNS.map((pair)=> pair[0])].concat((suppliers || []).map((row)=> rowFromColumns(row, SUPPLIER_COLUMNS))); }
  function buildManufacturerRows(manufacturers){ return [['nazwa']].concat((manufacturers || []).map((name)=> [name])); }
  function buildSettingsRows(settings){ return [['klucz','wartosc']].concat(Object.keys(settings || {}).map((key)=> [key, settings[key]])); }
  function buildBundleRows(accessories){
    const byId = new Map((accessories || []).map((row)=> [text(row && row.id), row]));
    const rows = [BUNDLE_COLUMNS.map((pair)=> pair[0])];
    (accessories || []).forEach((bundle)=>{
      (Array.isArray(bundle && bundle.bundleItems) ? bundle.bundleItems : []).forEach((entry)=>{
        const child = byId.get(text(entry && entry.itemId)) || {};
        rows.push([bundle.id || '', bundle.symbol || '', bundle.name || '', entry.itemId || '', child.symbol || '', child.name || '', entry.qty || '']);
      });
    });
    return rows;
  }
  function exportXlsx(){
    if(!(FC.xlsxLite && typeof FC.xlsxLite.makeWorkbookBlob === 'function')) throw new Error('Brak modułu XLSX.');
    const snap = getSnapshot();
    const blob = FC.xlsxLite.makeWorkbookBlob({
      Okucia:buildAccessoryRows(snap.accessories),
      Sklad_zestawow:buildBundleRows(snap.accessories),
      Dostawcy:buildSupplierRows(snap.suppliers),
      Producenci:buildManufacturerRows(snap.manufacturers),
      Ustawienia:buildSettingsRows(snap.settings),
    });
    downloadBlob(`hardware_catalog_prices_${todayLocal()}.xlsx`, blob);
  }
  function headerKey(value){ return safePart(value).replace(/_+/g, '_'); }
  function rowsToObjects(rows){
    const data = Array.isArray(rows) ? rows : [];
    const headers = (data[0] || []).map(headerKey);
    return data.slice(1).map((row)=>{
      const out = {};
      headers.forEach((h, i)=>{ if(h) out[h] = row[i] == null ? '' : row[i]; });
      return out;
    }).filter((row)=> Object.keys(row).some((key)=> text(row[key])));
  }
  function valueFrom(row, names){
    for(const name of names){ const key = headerKey(name); if(Object.prototype.hasOwnProperty.call(row, key)) return row[key]; }
    return '';
  }
  function parseAccessoryRow(row){
    return {
      id:text(valueFrom(row, ['id'])),
      status:text(valueFrom(row, ['status'])) || 'active',
      manufacturer:text(valueFrom(row, ['producent','manufacturer'])),
      symbol:text(valueFrom(row, ['symbol'])),
      name:text(valueFrom(row, ['nazwa','name'])),
      hardwareCategory:text(valueFrom(row, ['kategoria','hardwareCategory'])) || 'Inne',
      hardwareUnit:text(valueFrom(row, ['jednostka','hardwareUnit'])) || 'szt.',
      series:text(valueFrom(row, ['seria','series'])),
      supplierId:text(valueFrom(row, ['dostawca_id','supplierId'])),
      priceSource:text(valueFrom(row, ['zrodlo_ceny','priceSource'])),
      priceUpdatedAt:text(valueFrom(row, ['data_ceny','priceUpdatedAt'])),
      vatRate:number(valueFrom(row, ['vat_proc','vatRate'])),
      catalogPriceGross:number(valueFrom(row, ['cena_katalogowa_brutto','catalogPriceGross'])),
      catalogPriceNet:number(valueFrom(row, ['cena_katalogowa_netto','catalogPriceNet'])),
      supplierDiscountPercent:number(valueFrom(row, ['rabat_dostawcy_proc','supplierDiscountPercent'])),
      purchasePriceGross:number(valueFrom(row, ['zakup_brutto','purchasePriceGross'])),
      purchasePriceNet:number(valueFrom(row, ['zakup_netto','purchasePriceNet'])),
      quoteBase:text(valueFrom(row, ['baza_wyceny','quoteBase'])),
      pricingMode:text(valueFrom(row, ['sposob_liczenia','pricingMode'])),
      markupPercent:number(valueFrom(row, ['narzut_proc','markupPercent'])),
      price:number(valueFrom(row, ['cena_do_wyceny_brutto','price','quotePriceGross'])),
      quotePriceNet:number(valueFrom(row, ['cena_do_wyceny_netto','quotePriceNet'])),
      bundleCostMode:text(valueFrom(row, ['tryb_ceny_zestawu','bundleCostMode'])),
      note:text(valueFrom(row, ['notatka','note'])),
    };
  }
  function parseSupplierRow(row){
    return normalizeSupplier({
      id:text(valueFrom(row, ['id'])),
      name:text(valueFrom(row, ['nazwa','name'])),
      defaultDiscountPercent:number(valueFrom(row, ['rabat_domyslny_proc','defaultDiscountPercent'])),
      defaultVatRate:number(valueFrom(row, ['vat_domyslny_proc','defaultVatRate'])),
      active:text(valueFrom(row, ['aktywny','active'])) ? bool(valueFrom(row, ['aktywny','active'])) : true,
    });
  }
  function parseWorkbook(workbook){
    const sheet = (name)=> workbook[name] || workbook[Object.keys(workbook || {}).find((key)=> headerKey(key) === headerKey(name))] || [];
    const accessories = rowsToObjects(sheet('Okucia')).map(parseAccessoryRow);
    const suppliers = rowsToObjects(sheet('Dostawcy')).map(parseSupplierRow).filter((row)=> text(row && row.name));
    const manufacturers = rowsToObjects(sheet('Producenci')).map((row)=> text(valueFrom(row, ['nazwa','name','producent']))).filter(Boolean);
    const settings = {};
    rowsToObjects(sheet('Ustawienia')).forEach((row)=>{
      const key = text(valueFrom(row, ['klucz','key']));
      if(key) settings[key] = valueFrom(row, ['wartosc','value']);
    });
    const bundleRows = rowsToObjects(sheet('Sklad_zestawow')).map((row)=>({
      bundleId:text(valueFrom(row, ['zestaw_id','bundleId'])),
      bundleSymbol:text(valueFrom(row, ['zestaw_symbol','bundleSymbol'])),
      bundleName:text(valueFrom(row, ['zestaw_nazwa','bundleName'])),
      itemId:text(valueFrom(row, ['skladnik_id','itemId'])),
      itemSymbol:text(valueFrom(row, ['skladnik_symbol','itemSymbol'])),
      itemName:text(valueFrom(row, ['skladnik_nazwa','itemName'])),
      qty:number(valueFrom(row, ['ilosc','qty'])),
    })).filter((row)=> row.qty > 0 && (row.bundleId || row.bundleName || row.itemId || row.itemName));
    return { accessories, manufacturers, suppliers, settings, bundleRows };
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
    if(name.endsWith('.xlsx')){
      if(!(FC.xlsxLite && typeof FC.xlsxLite.readWorkbook === 'function')) throw new Error('Brak modułu odczytu XLSX.');
      return parseWorkbook(await FC.xlsxLite.readWorkbook(file));
    }
    return parseJson(await file.text());
  }
  function indexExisting(existing){
    const byId = new Map();
    const bySig = new Map();
    (existing || []).forEach((row)=>{ if(text(row && row.id)) byId.set(text(row.id), row); bySig.set(signature(row), row); });
    return { byId, bySig };
  }
  function normalizeImportedAccessories(importRows, existing, warnings, errors, settings){
    const existingIndex = indexExisting(existing);
    const usedIds = new Set();
    const importedByKey = new Map();
    const normalized = [];
    (Array.isArray(importRows) ? importRows : []).forEach((raw, rowIndex)=>{
      const src = Object.assign({}, raw || {});
      if(!text(src.name) || !text(src.manufacturer)){ errors.push(`Okucia: wiersz ${rowIndex + 2} nie ma producenta albo nazwy.`); return; }
      let id = text(src.id);
      const sig = signature(src);
      if(!id && existingIndex.bySig.has(sig)){
        id = text(existingIndex.bySig.get(sig).id);
        warnings.push(`Okucia: wiersz ${rowIndex + 2} bez ID dopasowano po producent+symbol+nazwa do istniejącej pozycji.`);
      }
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
      const sig = [safePart(''), safePart(symbol), safePart(name)].join('|');
      const foundImported = (imported.rows || []).find((row)=> safePart(row && row.symbol) === safePart(symbol) && safePart(row && row.name) === safePart(name));
      const foundExisting = (existing || []).find((row)=> safePart(row && row.symbol) === safePart(symbol) && safePart(row && row.name) === safePart(name));
      return foundImported || foundExisting || imported.byKey.get(sig) || null;
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
  function buildImportPlan(data, options){
    const mode = text(options && options.mode) === 'replace' ? 'replace' : 'merge';
    const s = store();
    if(!(s && typeof s.savePriceList === 'function')) throw new Error('Brak catalogStore.savePriceList.');
    const existing = s.getAccessories ? s.getAccessories() : [];
    const warnings = [];
    const errors = [];
    const importedSettings = Object.keys(data && data.settings || {}).length ? normalizeSettings(data.settings) : (s.getHardwareSettings ? s.getHardwareSettings() : {});
    const importedAccessories = normalizeImportedAccessories(data && data.accessories, existing, warnings, errors, importedSettings);
    applyBundleRows(importedAccessories, data && data.bundleRows, existing);
    const existingById = new Map(existing.map((row)=> [text(row && row.id), row]));
    const importedIds = new Set(importedAccessories.rows.map((row)=> text(row && row.id)));
    const updateCount = importedAccessories.rows.filter((row)=> existingById.has(text(row && row.id))).length;
    const addCount = importedAccessories.rows.length - updateCount;
    const removeCount = mode === 'replace' ? existing.filter((row)=> !importedIds.has(text(row && row.id))).length : 0;
    const nextAccessories = mode === 'replace'
      ? importedAccessories.rows
      : existing.map((row)=> importedIds.has(text(row && row.id)) ? importedAccessories.rows.find((item)=> text(item.id) === text(row.id)) : row).concat(importedAccessories.rows.filter((row)=> !existingById.has(text(row.id))));
    const suppliers = Array.isArray(data && data.suppliers) && data.suppliers.length ? data.suppliers.map(normalizeSupplier).filter((row)=> text(row && row.name)) : (s.getHardwareSuppliers ? s.getHardwareSuppliers() : []);
    const manufacturers = normalizeManufacturers((Array.isArray(data && data.manufacturers) ? data.manufacturers : []).concat(nextAccessories.map((row)=> row.manufacturer)));
    const settings = importedSettings;
    return { mode, errors, warnings, next:{ accessories:nextAccessories, suppliers, manufacturers, settings }, summary:{ imported:importedAccessories.rows.length, added:addCount, updated:updateCount, removed:removeCount, suppliers:suppliers.length, manufacturers:manufacturers.length } };
  }
  function applyImportPlan(plan){
    const s = store();
    if(plan && plan.errors && plan.errors.length) throw new Error('Import ma błędy walidacji.');
    if(!(s && typeof s.savePriceList === 'function')) throw new Error('Brak zapisu katalogu.');
    if(s.saveHardwareSettings) s.saveHardwareSettings(plan.next.settings || {});
    if(s.saveHardwareSuppliers) s.saveHardwareSuppliers(plan.next.suppliers || []);
    s.savePriceList('accessories', plan.next.accessories || []);
    if(s.saveHardwareManufacturers) s.saveHardwareManufacturers(plan.next.manufacturers || []);
    return plan.summary || {};
  }

  FC.hardwareCatalogImportExport = { KIND, VERSION, ACCESSORY_COLUMNS, SUPPLIER_COLUMNS, BUNDLE_COLUMNS, getSnapshot, makeExportPayload, exportJson, exportXlsx, parseFile, parseWorkbook, parseJson, buildImportPlan, applyImportPlan, _debug:{ rowsToObjects, parseAccessoryRow, buildAccessoryRows, buildBundleRows } };
})();

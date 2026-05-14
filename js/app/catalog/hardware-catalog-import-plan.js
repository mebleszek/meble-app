// js/app/catalog/hardware-catalog-import-plan.js
// Plan importu katalogu okuć: walidacja, diff, resolver-data i finalny zapis.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ACCESSORY_DIFF_FIELDS = ['name','hardwareUnit','manufacturer','hardwareCategory','hardwareType','symbol','series','bundleCostMode','note'];

  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.').replace(/\s+/g, '')); return Number.isFinite(n) ? n : 0; }
  function clone(value){ try{ return (FC.utils && FC.utils.clone) ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }catch(_){ return JSON.parse(JSON.stringify(value || null)); } }
  function todayLocal(){ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function safePart(value){ return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item'; }
  function signature(row){ return [safePart(row && row.manufacturer), safePart(row && row.symbol), safePart(row && row.name)].join('|'); }
  function makeGeneratedId(row){ return `hw_user_${safePart(row && row.manufacturer)}_${safePart(row && (row.symbol || row.name))}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }
  function store(){ return FC.catalogStore || null; }
  function hw(){ return FC.hardwareCatalog || {}; }
  function optionValues(list, fallback){ const src = Array.isArray(list) ? list : fallback; return (src || []).map((row)=> text(row && typeof row === 'object' ? row.value : row)).filter(Boolean); }
  function optionLabels(list, fallback){ const src = Array.isArray(list) ? list : fallback; return (src || []).map((row)=> row && typeof row === 'object' ? { value:text(row.value), label:text(row.label || row.value) } : { value:text(row), label:text(row) }).filter((row)=> row.value); }
  function round2(value){ const n = Number(value); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function netToGross(value, vat){ return (hw().netToGross || ((v, r)=> round2(number(v) * (1 + number(r) / 100))))(value, vat); }
  function grossToNet(value, vat){ return (hw().grossToNet || ((v, r)=> { const div = 1 + number(r) / 100; return div ? round2(number(v) / div) : round2(value); }))(value, vat); }

  function getSnapshot(){ return FC.hardwareCatalogExportXlsx && FC.hardwareCatalogExportXlsx.getSnapshot ? FC.hardwareCatalogExportXlsx.getSnapshot() : { accessories:[], manufacturers:[], suppliers:[], categories:[], types:[], settings:{} }; }
  function normalizeAccessory(row, settings){
    const cfg = settings || (store() && store().getHardwareSettings ? store().getHardwareSettings() : undefined);
    if(FC.hardwareCatalog && typeof FC.hardwareCatalog.normalizeAccessory === 'function') return FC.hardwareCatalog.normalizeAccessory(row || {}, FC.utils && FC.utils.uid, cfg);
    return Object.assign({}, row || {});
  }
  function normalizeSupplier(row){ if(FC.hardwareCatalog && typeof FC.hardwareCatalog.normalizeSupplier === 'function') return FC.hardwareCatalog.normalizeSupplier(row || {}); return Object.assign({}, row || {}); }
  function normalizeSettings(settings){ if(FC.hardwareCatalog && typeof FC.hardwareCatalog.normalizeSettings === 'function') return FC.hardwareCatalog.normalizeSettings(settings || {}); return Object.assign({}, settings || {}); }
  function normalizeManufacturers(list){ if(FC.hardwareCatalog && typeof FC.hardwareCatalog.normalizeManufacturerList === 'function') return FC.hardwareCatalog.normalizeManufacturerList(list || []); return Array.from(new Set((list || []).map(text).filter(Boolean))); }
  function existingManufacturerChoices(existing){
    const s = store();
    const current = s && s.getHardwareManufacturers ? s.getHardwareManufacturers() : [];
    return normalizeManufacturers((current || []).concat((existing || []).map((row)=> row && row.manufacturer)));
  }
  function accessoryHasPrice(row){ return number(row && row.catalogPriceNet) > 0 || number(row && row.catalogPriceGross) > 0 || number(row && row.price) > 0 || number(row && row.quotePriceNet) > 0; }
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
    out.vatRate = cfg.defaultVatRate;
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
    const storedCategories = s && s.getHardwareCategories ? s.getHardwareCategories() : [];
    const categories = optionLabels((Array.isArray(data && data.categories) ? data.categories : []).concat(storedCategories.length ? storedCategories : optionValues(hw().CATEGORIES, ['Zawiasy','Szuflady / prowadnice','Cargo / organizery','Inne'])), ['Zawiasy','Szuflady / prowadnice','Cargo / organizery','Inne']);
    const units = optionLabels(hw().UNITS, ['szt.','kpl.','mb','m²','zestaw']);
    const importedSuppliers = Array.isArray(data && data.suppliers) && data.suppliers.length ? data.suppliers.map(normalizeSupplier).filter((row)=> text(row && row.name)) : [];
    const storedSuppliers = s && s.getHardwareSuppliers ? s.getHardwareSuppliers() : [];
    const suppliers = importedSuppliers.length ? importedSuppliers : storedSuppliers;
    return { manufacturers:manufacturers.map((name)=>({ value:name, label:name })), categories, units, settings:s && s.getHardwareSettings ? s.getHardwareSettings() : {}, suppliers };
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
  function canonicalValue(value){
    if(Array.isArray(value)) return JSON.stringify(value.map((row)=> row && typeof row === 'object' ? Object.keys(row).sort().reduce((out, key)=>{ out[key] = row[key]; return out; }, {}) : row));
    if(value && typeof value === 'object') return JSON.stringify(value);
    return text(value);
  }
  function sameBundleItems(a, b){
    const clean = (list)=> (Array.isArray(list) ? list : []).map((row)=>({ itemId:text(row && row.itemId), qty:number(row && row.qty) || 0 })).filter((row)=> row.itemId && row.qty > 0).sort((x, y)=> (x.itemId + ':' + x.qty).localeCompare(y.itemId + ':' + y.qty));
    return JSON.stringify(clean(a)) === JSON.stringify(clean(b));
  }
  function sameImportedAccessory(existing, imported){ return !!(existing && imported) && ACCESSORY_DIFF_FIELDS.every((field)=> canonicalValue(existing && existing[field]) === canonicalValue(imported && imported[field])) && sameBundleItems(existing && existing.bundleItems, imported && imported.bundleItems); }
  function classifyImportedAccessories(importedRows, existingById){
    const addedIds = new Set();
    const changedIds = new Set();
    const unchangedIds = new Set();
    (importedRows || []).forEach((row)=>{
      const id = text(row && row.id);
      const existing = existingById.get(id);
      if(!existing){ addedIds.add(id); return; }
      if(sameImportedAccessory(existing, row)) unchangedIds.add(id); else changedIds.add(id);
    });
    return { addedIds, changedIds, unchangedIds };
  }
  function mergeAccessories(existing, importedRows, classification){
    const importedById = new Map((importedRows || []).map((row)=> [text(row && row.id), row]));
    const keepOrReplace = (row)=>{ const id = text(row && row.id); return classification.changedIds.has(id) ? (importedById.get(id) || row) : row; };
    return (existing || []).map(keepOrReplace).concat((importedRows || []).filter((row)=> classification.addedIds.has(text(row && row.id))));
  }
  function buildImportPlan(data, options){
    const mode = text(options && options.mode) === 'replace' ? 'replace' : 'merge';
    const s = store();
    if(!(s && typeof s.savePriceList === 'function')) throw new Error('Brak catalogStore.savePriceList.');
    const existing = clone(s.getAccessories ? s.getAccessories() : []);
    const warnings = [];
    const errors = [];
    const importedSettings = Object.keys(data && data.settings || {}).length ? normalizeSettings(data.settings) : (s.getHardwareSettings ? s.getHardwareSettings() : {});
    const suppliers = Array.isArray(data && data.suppliers) && data.suppliers.length ? data.suppliers.map(normalizeSupplier).filter((row)=> text(row && row.name)) : (s.getHardwareSuppliers ? s.getHardwareSuppliers() : []);
    const categories = Array.isArray(data && data.categories) && data.categories.length ? data.categories : (s.getHardwareCategories ? s.getHardwareCategories() : []);
    const types = Array.isArray(data && data.types) && data.types.length ? data.types : (s.getHardwareTypes ? s.getHardwareTypes() : []);
    const importedAccessories = normalizeImportedAccessories(data && data.accessories, existing, warnings, errors, importedSettings, suppliers);
    let supplierPriceAccessorySummary = { created:0, skipped:0 };
    const supplierXlsx = FC.hardwareSupplierPriceXlsx || {};
    if(typeof supplierXlsx.createAccessoriesFromSupplierPriceRows === 'function'){
      supplierPriceAccessorySummary = supplierXlsx.createAccessoriesFromSupplierPriceRows(importedAccessories.rows, existing, data && data.supplierPriceRows, suppliers, existingManufacturerChoices(existing), importedSettings, warnings) || supplierPriceAccessorySummary;
    }
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
    if(typeof supplierXlsx.applySupplierPriceRows === 'function'){
      supplierPriceSummary = supplierXlsx.applySupplierPriceRows(nextAccessories, data && data.supplierPriceRows, suppliers, warnings, importedSettings) || supplierPriceSummary;
      const settingsForNormalize = Object.assign({}, importedSettings, { hardwareSuppliers:suppliers });
      nextAccessories = nextAccessories.map((row)=> normalizeAccessory(row, settingsForNormalize));
    }
    const manufacturers = normalizeManufacturers((Array.isArray(data && data.manufacturers) ? data.manufacturers : []).concat(nextAccessories.map((row)=> row.manufacturer)));
    const priceChanged = number(supplierPriceSummary.added) + number(supplierPriceSummary.updated);
    return {
      mode, errors, warnings,
      next:{ accessories:nextAccessories, suppliers, manufacturers, settings:importedSettings, categories, types },
      summary:{ imported:importedAccessories.rows.length, accessoryRows:importedAccessories.rows.length, added:addCount, updated:accessoryUpdateCount, unchanged:unchangedCount, removed:removeCount, suppliers:suppliers.length, manufacturers:manufacturers.length, supplierPrices:supplierPriceSummary.rows || 0, supplierPricesAdded:supplierPriceSummary.added || 0, supplierPricesUpdated:supplierPriceSummary.updated || 0, supplierPricesUnchanged:supplierPriceSummary.unchanged || 0, supplierPricesSkipped:supplierPriceSummary.skipped || 0, supplierPriceCreatedAccessories:supplierPriceAccessorySummary.created || 0, supplierPriceCreateSkipped:supplierPriceAccessorySummary.skipped || 0, supplierPriceChanges:Array.isArray(supplierPriceSummary.changes) ? supplierPriceSummary.changes : [], totalChanged:accessoryUpdateCount + addCount + priceChanged }
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

  FC.hardwareCatalogImportPlan = {
    buildImportPlan,
    applyImportPlan,
    findRequiredGaps,
    getRequiredChoiceOptions,
    _debug:{ requiredGapsForAccessory, enrichAccessoryDefaults, sameImportedAccessory, classifyImportedAccessories, existingManufacturerChoices, normalizeImportedAccessories, mergeAccessories, applyBundleRows }
  };
})();

// js/app/catalog/hardware-supplier-price-import.js
// Import arkusza `Ceny_dostawcow`: parser, dopasowanie okucia/dostawcy, diff i aplikowanie cen.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const SUPPLIER_PRICE_COLUMNS = (FC.hardwareSupplierPriceExport && FC.hardwareSupplierPriceExport.SUPPLIER_PRICE_COLUMNS) || [
    ['okucie_nazwa','itemName'], ['okucie_symbol','itemSymbol'], ['producent','itemManufacturer'], ['kategoria','itemCategory'], ['jednostka','itemUnit'], ['dostawca','supplierName'], ['cena_netto','catalogPriceNet'], ['cena_brutto','catalogPriceGross'], ['do_wyceny','useForQuote'], ['status_ceny','priceStatus'], ['data_ceny','priceDate'], ['system_okucia','itemSystem'], ['nazwa_techniczna','itemType'], ['profil_szuflady','drawerProfile'], ['dlugosc_mm','drawerLengthMm'], ['nosnosc_kg','drawerLoadKg'], ['wzmocniona','drawerReinforced'], ['kolor_okucia','hardwareColor'], ['zastosowanie','hardwareUsage'], ['okucie_id','itemId'], ['dostawca_id','supplierId']
  ];

  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.').replace(/\s+/g, '')); return Number.isFinite(n) ? n : 0; }
  function optionalNumber(value){ return text(value) === '' ? '' : number(value); }
  function round2(value){ const n = Number(value); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function todayLocal(){ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function isSpreadsheetError(value){ const raw = text(value).toUpperCase(); return /^#(REF|VALUE|DIV\/0|NAME\?|N\/A|NUM|NULL)!?$/.test(raw); }
  function hasNumericInput(value){ return text(value) !== '' && !isSpreadsheetError(value) && number(value) > 0; }
  function netToGross(value, vat){ const hw = FC.hardwareCatalog || {}; return hw.netToGross ? hw.netToGross(value, vat) : round2(number(value) * (1 + number(vat) / 100)); }
  function grossToNet(value, vat){ const hw = FC.hardwareCatalog || {}; return hw.grossToNet ? hw.grossToNet(value, vat) : round2(number(value) / (1 + number(vat) / 100)); }
  function normalizePriceStatus(value){ const hw = FC.hardwareCatalog || {}; return hw.normalizePriceStatus ? hw.normalizePriceStatus(value) : (text(value) || 'current'); }
  function safePart(value){ return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || ''; }
  function bool(value){ return ['tak','true','1','yes','y'].includes(text(value).toLowerCase()); }
  function headerKey(value){ return safePart(value).replace(/_+/g, '_'); }
  function valueFrom(row, names){ for(const name of names){ const key = headerKey(name); if(Object.prototype.hasOwnProperty.call(row, key)) return row[key]; } return ''; }
  function supplierById(suppliers, id){ const key = text(id).toLowerCase(); return (suppliers || []).find((row)=> text(row && row.id).toLowerCase() === key || text(row && row.name).toLowerCase() === key) || null; }
  function supplierByName(suppliers, name){
    const raw = text(name);
    const key = raw.toLowerCase();
    const safe = safePart(raw);
    if(!key) return null;
    return (suppliers || []).find((row)=>{
      const rowName = text(row && row.name);
      return rowName.toLowerCase() === key || (safe && safePart(rowName) === safe);
    }) || null;
  }
  function parseSupplierPriceRow(row){
    const rawNet = valueFrom(row, ['cena_netto','catalogPriceNet']);
    const rawGross = valueFrom(row, ['cena_brutto','catalogPriceGross']);
    const rawUseForQuote = valueFrom(row, ['do_wyceny','useForQuote']);
    const rawStatus = valueFrom(row, ['status_ceny','priceStatus']);
    return {
      __rowIndex:Number(row && row.__rowIndex) || 0,
      itemId:text(valueFrom(row, ['okucie_id','itemId'])),
      itemName:text(valueFrom(row, ['okucie_nazwa','itemName','nazwa'])),
      itemSymbol:text(valueFrom(row, ['okucie_symbol','itemSymbol','symbol'])),
      itemManufacturer:text(valueFrom(row, ['producent','manufacturer','itemManufacturer','okucie_producent'])),
      itemCategory:text(valueFrom(row, ['kategoria','hardwareCategory','itemCategory','okucie_kategoria'])),
      itemSystem:text(valueFrom(row, ['system_okucia','hardwareSystem','itemSystem','seria','series'])),
      itemType:text(valueFrom(row, ['nazwa_techniczna','technicalName','hardwareType','itemType','typ_cecha','typ'])),
      itemUnit:text(valueFrom(row, ['jednostka','hardwareUnit','itemUnit','okucie_jednostka'])),
      drawerProfile:text(valueFrom(row, ['profil_szuflady','drawerProfile'])),
      drawerLengthMm:optionalNumber(valueFrom(row, ['dlugosc_mm','drawerLengthMm','dlugosc_szuflady_mm'])),
      drawerLoadKg:optionalNumber(valueFrom(row, ['nosnosc_kg','drawerLoadKg'])),
      drawerReinforced:text(valueFrom(row, ['wzmocniona','drawerReinforced'])) ? bool(valueFrom(row, ['wzmocniona','drawerReinforced'])) : false,
      hardwareColor:text(valueFrom(row, ['kolor_okucia','hardwareColor'])),
      hardwareUsage:text(valueFrom(row, ['zastosowanie','hardwareUsage'])),
      supplierId:text(valueFrom(row, ['dostawca_id','supplierId'])),
      supplierName:text(valueFrom(row, ['dostawca','supplierName','nazwa_dostawcy'])),
      catalogPriceNet:hasNumericInput(rawNet) ? number(rawNet) : 0,
      catalogPriceGross:hasNumericInput(rawGross) ? number(rawGross) : 0,
      enteredPriceType:hasNumericInput(rawNet) ? 'net' : (hasNumericInput(rawGross) ? 'gross' : ''),
      useForQuoteSpecified:text(rawUseForQuote) !== '',
      useForQuote:bool(rawUseForQuote),
      priceStatusSpecified:text(rawStatus) !== '',
      priceStatus:normalizePriceStatus(rawStatus),
      priceDate:text(valueFrom(row, ['data_ceny','priceDate','priceUpdatedAt'])),
    };
  }
  function hasSupplierPriceData(row){
    return !!(text(valueFrom(row, ['okucie_id','okucie_nazwa','okucie_symbol','producent','manufacturer','system_okucia','nazwa_techniczna','typ_cecha','dostawca','dostawca_id'])) || hasNumericInput(valueFrom(row, ['cena_netto','catalogPriceNet'])) || hasNumericInput(valueFrom(row, ['cena_brutto','catalogPriceGross'])));
  }
  function logicalAccessoryKey(item){ return text(item && item.id) || [safePart(item && item.manufacturer), safePart(item && item.symbol), safePart(item && item.name)].join('|'); }
  function uniqueLogicalMatches(matches){
    const byKey = new Map();
    (matches || []).filter(Boolean).forEach((item)=>{
      const key = logicalAccessoryKey(item);
      if(key && !byKey.has(key)) byKey.set(key, item);
    });
    return Array.from(byKey.values());
  }
  function uniqueMatch(matches, warnings, row, label){
    const clean = uniqueLogicalMatches((matches || []).filter(Boolean));
    if(clean.length === 1) return clean[0];
    if(clean.length > 1 && warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} pasuje do kilku okuć (${label}). Uzupełnij producent+symbol albo okucie_id.`);
    return null;
  }
  function resolveAccessory(accessories, row, warnings){
    const rows = Array.isArray(accessories) ? accessories : [];
    const byId = rows.find((item)=> text(item && item.id) && text(item.id) === text(row.itemId));
    if(byId) return byId;
    const manufacturer = safePart(row.itemManufacturer);
    const sym = safePart(row.itemSymbol);
    const name = safePart(row.itemName);
    if(manufacturer && sym) return uniqueMatch(rows.filter((item)=> safePart(item && item.manufacturer) === manufacturer && safePart(item && item.symbol) === sym), warnings, row, 'producent+symbol') || null;
    if(sym && name){ const found = uniqueMatch(rows.filter((item)=> safePart(item && item.symbol) === sym && safePart(item && item.name) === name), warnings, row, 'symbol+nazwa'); if(found) return found; }
    if(sym){
      const found = uniqueMatch(rows.filter((item)=> safePart(item && item.symbol) === sym), warnings, row, 'symbol');
      if(found){ if(!manufacturer && warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} dopasowano po samym symbolu. Bezpieczniej uzupełnić kolumnę producent.`); return found; }
    }
    if(name) return uniqueMatch(rows.filter((item)=> safePart(item && item.name) === name), warnings, row, 'nazwa');
    return null;
  }
  function resolveSupplier(suppliers, row, warnings){
    const byName = supplierByName(suppliers || [], row && row.supplierName);
    const byId = supplierById(suppliers || [], row && row.supplierId);
    if(byName){
      if(byId && text(byId.id) !== text(byName.id) && warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} ma dostawcę "${row.supplierName}", ale techniczne dostawca_id wskazuje "${byId.name || byId.id}". Użyto nazwy z kolumny dostawca.`);
      return byName;
    }
    return byId || null;
  }
  function globalVatRate(settings){ const hw = FC.hardwareCatalog || {}; return hw.globalVatRate ? hw.globalVatRate(settings || {}) : (number(settings && settings.defaultVatRate) || 23); }
  function normalizedNextPrice(row, supplier, existing, settings){
    const vat = globalVatRate(settings || {});
    let catalogPriceNet = number(row.catalogPriceNet);
    let catalogPriceGross = number(row.catalogPriceGross);
    if(catalogPriceNet > 0 && catalogPriceGross <= 0) catalogPriceGross = netToGross(catalogPriceNet, vat);
    if(catalogPriceGross > 0 && catalogPriceNet <= 0) catalogPriceNet = grossToNet(catalogPriceGross, vat);
    const priceChanged = !existing || round2(number(existing && existing.catalogPriceNet)) !== round2(catalogPriceNet) || round2(number(existing && existing.catalogPriceGross)) !== round2(catalogPriceGross);
    return {
      supplierId:supplier.id,
      catalogPriceNet,
      catalogPriceGross,
      enteredPriceType:row.enteredPriceType || (row.catalogPriceNet > 0 ? 'net' : 'gross'),
      priceDate:text(row.priceDate) || (priceChanged ? todayLocal() : text(existing && existing.priceDate)) || todayLocal(),
      priceStatus:row.priceStatusSpecified ? normalizePriceStatus(row.priceStatus) : normalizePriceStatus((existing && existing.priceStatus) || 'current'),
      useForQuote:row.useForQuoteSpecified ? !!row.useForQuote : !!(existing && existing.useForQuote),
    };
  }
  function sameSupplierPrice(a, b){
    if(!a || !b) return false;
    return text(a.supplierId) === text(b.supplierId)
      && round2(number(a.catalogPriceNet)) === round2(number(b.catalogPriceNet))
      && round2(number(a.catalogPriceGross)) === round2(number(b.catalogPriceGross))
      && text(a.priceDate) === text(b.priceDate)
      && normalizePriceStatus(a.priceStatus) === normalizePriceStatus(b.priceStatus)
      && !!a.useForQuote === !!b.useForQuote;
  }
  function publicPrice(price){
    if(!price) return null;
    return { supplierId:text(price.supplierId), catalogPriceNet:round2(number(price.catalogPriceNet)), catalogPriceGross:round2(number(price.catalogPriceGross)), priceDate:text(price.priceDate), priceStatus:normalizePriceStatus(price.priceStatus), useForQuote:!!price.useForQuote };
  }
  function supplierPriceChangeDetail(raw, row, item, supplier, existing, nextPrice){
    return { action:existing ? 'updated' : 'added', rowIndex:row.__rowIndex || raw && raw.__rowIndex || 0, itemId:text(item && item.id), itemName:text(item && item.name), itemSymbol:text(item && item.symbol), itemManufacturer:text(item && item.manufacturer), supplierId:text(supplier && supplier.id), supplierName:text(supplier && supplier.name || supplier && supplier.id), oldPrice:publicPrice(existing), newPrice:publicPrice(nextPrice), affectsQuote:!!(existing && existing.useForQuote) || !!(nextPrice && nextPrice.useForQuote), rawRow:raw || null };
  }
  function manufacturerByName(manufacturers, value){
    const safe = safePart(value);
    if(!safe) return '';
    return (manufacturers || []).map(text).find((name)=> safePart(name) === safe) || '';
  }
  function generatedAccessoryId(row){ return `hw_price_${safePart(row.itemManufacturer)}_${safePart(row.itemSymbol || row.itemName)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }
  function createAccessoryFromPriceRow(row, manufacturerName, settings, suppliers){
    const raw = {
      id:generatedAccessoryId(row), status:'active', manufacturer:manufacturerName,
      symbol:text(row.itemSymbol), name:text(row.itemName), hardwareCategory:text(row.itemCategory), hardwareUnit:text(row.itemUnit),
      hardwareSystem:text(row.itemSystem), series:text(row.itemSystem), hardwareType:text(row.itemType),
      drawerProfile:text(row.drawerProfile), drawerLengthMm:row.drawerLengthMm, drawerLoadKg:row.drawerLoadKg, drawerReinforced:!!row.drawerReinforced,
      hardwareColor:text(row.hardwareColor), hardwareUsage:text(row.hardwareUsage), bundleCostMode:'ownPrice'
    };
    const normalize = FC.hardwareCatalog && FC.hardwareCatalog.normalizeAccessory;
    if(typeof normalize === 'function') return normalize(raw, null, Object.assign({}, settings || {}, { hardwareSuppliers:suppliers || [] }));
    return raw;
  }
  function exactManufacturerSymbolMatches(accessories, row){
    const manufacturer = safePart(row && row.itemManufacturer);
    const symbol = safePart(row && row.itemSymbol);
    if(!manufacturer || !symbol) return [];
    return (accessories || []).filter((item)=> safePart(item && item.manufacturer) === manufacturer && safePart(item && item.symbol) === symbol);
  }
  function sourceRows(supplierPriceRows){
    return (supplierPriceRows || []).filter(hasSupplierPriceData).map((raw)=>({ raw, parsed:parseSupplierPriceRow(raw) })).filter((entry)=> entry.parsed.catalogPriceNet > 0 || entry.parsed.catalogPriceGross > 0);
  }
  function createAccessoriesFromSupplierPriceRows(targetAccessories, existingAccessories, supplierPriceRows, suppliers, manufacturers, settings, warnings){
    const summary = { created:0, skipped:0 };
    const target = Array.isArray(targetAccessories) ? targetAccessories : [];
    const all = (Array.isArray(existingAccessories) ? existingAccessories.slice() : []).concat(target);
    sourceRows(supplierPriceRows).filter((entry)=> !(entry.raw && entry.raw.__skipImport)).forEach((entry)=>{
      const row = entry.parsed;
      const exactMatches = uniqueLogicalMatches(exactManufacturerSymbolMatches(all, row));
      if(exactMatches.length){ if(exactMatches.length > 1 && warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} pasuje do kilku różnych okuć po producent+symbol. Nie utworzono duplikatu.`); return; }
      if(!(text(row.itemManufacturer) && text(row.itemSymbol) && text(row.itemName))){ summary.skipped += 1; if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} nie tworzy nowego okucia, bo brakuje producenta, symbolu albo nazwy.`); return; }
      const manufacturerName = manufacturerByName(manufacturers || [], row.itemManufacturer);
      if(!manufacturerName){ summary.skipped += 1; if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} ma producenta spoza słownika: ${row.itemManufacturer}. Nie utworzono nowego okucia.`); return; }
      const supplier = resolveSupplier(suppliers || [], row, warnings);
      if(!supplier){ summary.skipped += 1; if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} ma nieznanego dostawcę: ${row.supplierName || row.supplierId || '—'}. Nie utworzono nowego okucia.`); return; }
      if(!text(row.itemCategory) || !text(row.itemUnit)){ summary.skipped += 1; if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} wymaga wyboru kategorii i jednostki przed utworzeniem nowego okucia.`); return; }
      const created = createAccessoryFromPriceRow(row, manufacturerName, settings, suppliers || []);
      target.push(created); all.push(created); summary.created += 1;
      if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} utworzył nowe okucie "${created.name}" po producencie i symbolu.`);
    });
    return summary;
  }
  function supplierPriceCreateRequiredGaps(supplierPriceRows, accessories, suppliers, manufacturers){
    const targetRows = Array.isArray(accessories) ? accessories : [];
    const out = [];
    sourceRows(supplierPriceRows).filter((entry)=> !(entry.raw && entry.raw.__skipImport)).forEach((entry)=>{
      const row = entry.parsed;
      if(uniqueLogicalMatches(exactManufacturerSymbolMatches(targetRows, row)).length) return;
      if(!(text(row.itemManufacturer) && text(row.itemSymbol) && text(row.itemName))) return;
      if(!manufacturerByName(manufacturers || [], row.itemManufacturer)) return;
      const gaps = [];
      if(!resolveSupplier(suppliers || [], row, null)) gaps.push('supplierName');
      if(!text(row.itemCategory)) gaps.push('itemCategory');
      if(!text(row.itemUnit)) gaps.push('itemUnit');
      if(gaps.length) out.push({ row:entry.raw, parsed:row, rowIndex:row.__rowIndex || entry.raw.__rowIndex || 0, gaps });
    });
    return out;
  }
  function supplierPriceMissingSupplierGaps(supplierPriceRows, accessories, suppliers){
    const targetRows = Array.isArray(accessories) ? accessories : [];
    const out = [];
    sourceRows(supplierPriceRows).filter((entry)=> !(entry.raw && entry.raw.__skipImport)).forEach((entry)=>{
      const row = entry.parsed;
      const item = resolveAccessory(targetRows, row, null);
      if(!item || resolveSupplier(suppliers || [], row, null)) return;
      out.push({ row:entry.raw, parsed:row, item, rowIndex:row.__rowIndex || entry.raw.__rowIndex || 0, gaps:['supplierName'] });
    });
    return out;
  }
  function applySupplierPriceRows(accessories, supplierPriceRows, suppliers, warnings, settings){
    const summary = { touchedIds:[], rows:0, added:0, updated:0, unchanged:0, skipped:0, changes:[] };
    const touched = new Set();
    const rows = sourceRows(supplierPriceRows);
    const ignoredByResolver = rows.filter((entry)=> entry.raw && entry.raw.__skipImport).length;
    const activeRows = rows.filter((entry)=> !(entry.raw && entry.raw.__skipImport));
    summary.rows = rows.length;
    summary.skipped = ignoredByResolver;
    activeRows.forEach((entry)=>{
      const row = entry.parsed;
      const item = resolveAccessory(accessories, row, warnings);
      if(!item){ summary.skipped += 1; if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} nie pasuje do żadnego okucia.`); return; }
      const supplier = resolveSupplier(suppliers || [], row, warnings);
      if(!supplier){ summary.skipped += 1; if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} ma nieznanego dostawcę: ${row.supplierName || row.supplierId || '—'}.`); return; }
      const prices = (Array.isArray(item.supplierPrices) ? item.supplierPrices : []).map((price)=> Object.assign({}, price));
      const existing = prices.find((price)=> text(price && price.supplierId) === text(supplier.id)) || null;
      const nextPrice = normalizedNextPrice(row, supplier, existing, settings || {});
      const changed = !existing || !sameSupplierPrice(existing, nextPrice);
      if(row.useForQuoteSpecified && row.useForQuote){ prices.forEach((price)=>{ if(text(price && price.supplierId) !== text(supplier.id) && price.useForQuote){ price.useForQuote = false; } }); }
      if(changed){
        summary.changes.push(supplierPriceChangeDetail(entry.raw, row, item, supplier, existing, nextPrice));
        item.supplierPrices = prices.filter((price)=> text(price && price.supplierId) !== text(supplier.id));
        item.supplierPrices.push(nextPrice);
        if(existing) summary.updated += 1; else summary.added += 1;
        touched.add(text(item.id));
      }else{
        summary.unchanged += 1;
        item.supplierPrices = prices;
      }
    });
    summary.touchedIds = Array.from(touched);
    return summary;
  }

  FC.hardwareSupplierPriceImport = {
    SUPPLIER_PRICE_COLUMNS,
    parseSupplierPriceRow,
    hasSupplierPriceData,
    applySupplierPriceRows,
    createAccessoriesFromSupplierPriceRows,
    supplierPriceCreateRequiredGaps,
    supplierPriceMissingSupplierGaps,
    _debug:{ supplierByName, supplierById, resolveSupplier, resolveAccessory, sameSupplierPrice, supplierPriceChangeDetail, exactManufacturerSymbolMatches, uniqueLogicalMatches, createAccessoriesFromSupplierPriceRows, supplierPriceCreateRequiredGaps, supplierPriceMissingSupplierGaps, normalizedNextPrice, sourceRows }
  };
})();

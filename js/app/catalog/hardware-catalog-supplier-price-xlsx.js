// js/app/catalog/hardware-catalog-supplier-price-xlsx.js
// Arkusz XLSX wielu cen dostawców dla jednego okucia: eksport, import i bezpieczne dopasowanie po danych użytkowych.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const SUPPLIER_PRICE_COLUMNS = [
    ['okucie_nazwa','itemName'],
    ['okucie_symbol','itemSymbol'],
    ['producent','itemManufacturer'],
    ['kategoria','itemCategory'],
    ['jednostka','itemUnit'],
    ['dostawca','supplierName'],
    ['cena_netto','catalogPriceNet'],
    ['cena_brutto','catalogPriceGross'],
    ['do_wyceny','useForQuote'],
    ['status_ceny','priceStatus'],
    ['data_ceny','priceDate'],
    ['okucie_id','itemId'],
    ['dostawca_id','supplierId'],
  ];
  const TEMPLATE_PRICE_ROWS = 260;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.').replace(/\s+/g, '')); return Number.isFinite(n) ? n : 0; }
  function round2(value){ const n = Number(value); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function todayLocal(){ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function isSpreadsheetError(value){ const raw = text(value).toUpperCase(); return /^#(REF|VALUE|DIV\/0|NAME\?|N\/A|NUM|NULL)!?$/.test(raw); }
  function hasNumericInput(value){ return text(value) !== '' && !isSpreadsheetError(value) && number(value) > 0; }
  function netToGross(value, vat){ const hw = FC.hardwareCatalog || {}; return hw.netToGross ? hw.netToGross(value, vat) : round2(number(value) * (1 + number(vat) / 100)); }
  function grossToNet(value, vat){ const hw = FC.hardwareCatalog || {}; return hw.grossToNet ? hw.grossToNet(value, vat) : round2(number(value) / (1 + number(vat) / 100)); }
  function normalizePriceStatus(value){ const hw = FC.hardwareCatalog || {}; return hw.normalizePriceStatus ? hw.normalizePriceStatus(value) : (text(value) || 'current'); }
  function safePart(value){ return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || ''; }
  function bool(value){ return ['tak','true','1','yes','y'].includes(text(value).toLowerCase()); }
  function valueForColumn(obj, key){ return obj && obj[key] != null ? obj[key] : ''; }
  function col(index){ let n = Number(index) + 1; let out = ''; while(n > 0){ const mod = (n - 1) % 26; out = String.fromCharCode(65 + mod) + out; n = Math.floor((n - 1) / 26); } return out; }
  function colFor(prop){ const idx = SUPPLIER_PRICE_COLUMNS.findIndex((pair)=> pair[1] === prop); return col(idx < 0 ? 0 : idx); }
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
  function listFormula(values){ return '"' + (values || []).map((value)=> text(value).replace(/,/g, ' ')).filter(Boolean).join(',') + '"'; }
  function normalizePrices(item, suppliers, settings){
    const hw = FC.hardwareCatalog || {};
    if(hw && typeof hw.normalizeSupplierPrices === 'function') return hw.normalizeSupplierPrices(item && item.supplierPrices, item || {}, suppliers || [], settings || {});
    return Array.isArray(item && item.supplierPrices) ? item.supplierPrices : [];
  }
  function priceRow(item, price, suppliers){
    const supplier = supplierById(suppliers || [], price && price.supplierId) || {};
    return {
      itemName:item && item.name || '',
      itemSymbol:item && item.symbol || '',
      itemManufacturer:item && item.manufacturer || '',
      itemCategory:item && item.hardwareCategory || '',
      itemUnit:item && item.hardwareUnit || '',
      supplierName:supplier.name || price.supplierId || '',
      catalogPriceNet:price && price.catalogPriceNet || '',
      catalogPriceGross:price && price.catalogPriceGross || '',
      useForQuote:price && price.useForQuote ? 'TAK' : 'NIE',
      priceStatus:price && price.priceStatus || item && item.priceStatus || 'current',
      priceDate:price && price.priceDate || item && item.priceUpdatedAt || '',
      itemId:item && item.id || '',
      supplierId:price && price.supplierId || '',
    };
  }
  function emptyPriceRow(_rowNo){
    return { itemName:'', itemSymbol:'', itemManufacturer:'', itemCategory:'', itemUnit:'', supplierName:'', catalogPriceNet:'', catalogPriceGross:'', useForQuote:'NIE', priceStatus:'current', priceDate:'', itemId:'', supplierId:'' };
  }
  function rowValues(obj){
    return SUPPLIER_PRICE_COLUMNS.map((pair)=> obj._formulas && obj._formulas[pair[1]] ? obj._formulas[pair[1]] : valueForColumn(obj, pair[1]));
  }
  function buildSupplierPriceRows(accessories, suppliers, settings){
    const rows = [SUPPLIER_PRICE_COLUMNS.map((pair)=> pair[0])];
    (accessories || []).forEach((item)=>{
      normalizePrices(item, suppliers || [], settings || {}).forEach((price)=>{
        if(!(price && (number(price.catalogPriceNet) > 0 || number(price.catalogPriceGross) > 0))) return;
        rows.push(rowValues(priceRow(item, price, suppliers || [])));
      });
    });
    const wanted = Math.max(TEMPLATE_PRICE_ROWS, rows.length + 40);
    while(rows.length < wanted){ rows.push(rowValues(emptyPriceRow(rows.length + 1))); }
    return rows;
  }
  function supplierPriceValidations(){
    const rowEnd = TEMPLATE_PRICE_ROWS + 1;
    const hw = FC.hardwareCatalog || {};
    const units = (Array.isArray(hw.UNITS) ? hw.UNITS : ['szt.','kpl.','mb','m²','zestaw']).map((row)=> text(row && typeof row === 'object' ? row.value : row)).filter(Boolean);
    return [
      { sqref:`${colFor('itemManufacturer')}2:${colFor('itemManufacturer')}${rowEnd}`, formula1:'Producenci!$A$2:$A$500' },
      { sqref:`${colFor('itemCategory')}2:${colFor('itemCategory')}${rowEnd}`, formula1:'Kategorie_okuc!$A$2:$A$500' },
      { sqref:`${colFor('itemUnit')}2:${colFor('itemUnit')}${rowEnd}`, formula1:listFormula(units) },
      { sqref:`${colFor('supplierName')}2:${colFor('supplierName')}${rowEnd}`, formula1:'Dostawcy!$B$2:$B$500' },
      { sqref:`${colFor('useForQuote')}2:${colFor('useForQuote')}${rowEnd}`, formula1:listFormula(['TAK','NIE']) },
      { sqref:`${colFor('priceStatus')}2:${colFor('priceStatus')}${rowEnd}`, formula1:listFormula(['current','review','old','archived']) },
    ];
  }
  function headerKey(value){ return safePart(value).replace(/_+/g, '_'); }
  function valueFrom(row, names){ for(const name of names){ const key = headerKey(name); if(Object.prototype.hasOwnProperty.call(row, key)) return row[key]; } return ''; }
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
      itemUnit:text(valueFrom(row, ['jednostka','hardwareUnit','itemUnit','okucie_jednostka'])),
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
    return !!(text(valueFrom(row, ['okucie_id','okucie_nazwa','okucie_symbol','producent','manufacturer','dostawca','dostawca_id'])) || hasNumericInput(valueFrom(row, ['cena_netto','catalogPriceNet'])) || hasNumericInput(valueFrom(row, ['cena_brutto','catalogPriceGross'])));
  }
  function uniqueMatch(matches, warnings, row, label){
    // Import z XLSX często widzi to samo okucie dwa razy: raz z aktualnego katalogu
    // i raz z arkusza `Okucia` eksportowanego z programu. To nie jest prawdziwy
    // duplikat i nie może blokować resolvera brakującego dostawcy w `Ceny_dostawcow`.
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
    if(manufacturer && sym){
      const found = uniqueMatch(rows.filter((item)=> safePart(item && item.manufacturer) === manufacturer && safePart(item && item.symbol) === sym), warnings, row, 'producent+symbol');
      return found || null;
    }
    if(sym && name){
      const found = uniqueMatch(rows.filter((item)=> safePart(item && item.symbol) === sym && safePart(item && item.name) === name), warnings, row, 'symbol+nazwa');
      if(found) return found;
    }
    if(sym){
      const found = uniqueMatch(rows.filter((item)=> safePart(item && item.symbol) === sym), warnings, row, 'symbol');
      if(found){
        if(!manufacturer && warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} dopasowano po samym symbolu. Bezpieczniej uzupełnić kolumnę producent.`);
        return found;
      }
    }
    if(name) return uniqueMatch(rows.filter((item)=> safePart(item && item.name) === name), warnings, row, 'nazwa');
    return null;
  }
  function resolveSupplier(suppliers, row, warnings){
    const byName = supplierByName(suppliers || [], row && row.supplierName);
    const byId = supplierById(suppliers || [], row && row.supplierId);
    if(byName){
      if(byId && text(byId.id) !== text(byName.id) && warnings){
        warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} ma dostawcę "${row.supplierName}", ale techniczne dostawca_id wskazuje "${byId.name || byId.id}". Użyto nazwy z kolumny dostawca.`);
      }
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
    const priceChanged = !existing
      || round2(number(existing && existing.catalogPriceNet)) !== round2(catalogPriceNet)
      || round2(number(existing && existing.catalogPriceGross)) !== round2(catalogPriceGross);
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
    return {
      supplierId:text(price.supplierId),
      catalogPriceNet:round2(number(price.catalogPriceNet)),
      catalogPriceGross:round2(number(price.catalogPriceGross)),
      priceDate:text(price.priceDate),
      priceStatus:normalizePriceStatus(price.priceStatus),
      useForQuote:!!price.useForQuote,
    };
  }
  function supplierPriceChangeDetail(raw, row, item, supplier, existing, nextPrice){
    return {
      action:existing ? 'updated' : 'added',
      rowIndex:row.__rowIndex || raw && raw.__rowIndex || 0,
      itemId:text(item && item.id),
      itemName:text(item && item.name),
      itemSymbol:text(item && item.symbol),
      itemManufacturer:text(item && item.manufacturer),
      supplierId:text(supplier && supplier.id),
      supplierName:text(supplier && supplier.name || supplier && supplier.id),
      oldPrice:publicPrice(existing),
      newPrice:publicPrice(nextPrice),
      affectsQuote:!!(existing && existing.useForQuote) || !!(nextPrice && nextPrice.useForQuote),
      rawRow:raw || null,
    };
  }
  function manufacturerByName(manufacturers, value){
    const safe = safePart(value);
    if(!safe) return '';
    return (manufacturers || []).map(text).find((name)=> safePart(name) === safe) || '';
  }
  function generatedAccessoryId(row){
    return `hw_price_${safePart(row.itemManufacturer)}_${safePart(row.itemSymbol || row.itemName)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }
  function createAccessoryFromPriceRow(row, manufacturerName, settings, suppliers){
    const raw = {
      id:generatedAccessoryId(row),
      status:'active',
      manufacturer:manufacturerName,
      symbol:text(row.itemSymbol),
      name:text(row.itemName),
      hardwareCategory:text(row.itemCategory),
      hardwareUnit:text(row.itemUnit),
      hardwareType:'',
      bundleCostMode:'ownPrice',
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
  function logicalAccessoryKey(item){
    return text(item && item.id) || [safePart(item && item.manufacturer), safePart(item && item.symbol), safePart(item && item.name)].join('|');
  }
  function uniqueLogicalMatches(matches){
    const byKey = new Map();
    (matches || []).filter(Boolean).forEach((item)=>{
      const key = logicalAccessoryKey(item);
      if(key && !byKey.has(key)) byKey.set(key, item);
    });
    return Array.from(byKey.values());
  }
  function createAccessoriesFromSupplierPriceRows(targetAccessories, existingAccessories, supplierPriceRows, suppliers, manufacturers, settings, warnings){
    const summary = { created:0, skipped:0 };
    const target = Array.isArray(targetAccessories) ? targetAccessories : [];
    const all = (Array.isArray(existingAccessories) ? existingAccessories.slice() : []).concat(target);
    const parsedRows = (supplierPriceRows || [])
      .filter((row)=> !(row && row.__skipImport))
      .filter(hasSupplierPriceData)
      .map(parseSupplierPriceRow)
      .filter((row)=> row.catalogPriceNet > 0 || row.catalogPriceGross > 0);
    parsedRows.forEach((row)=>{
      const exactMatches = uniqueLogicalMatches(exactManufacturerSymbolMatches(all, row));
      if(exactMatches.length){
        if(exactMatches.length > 1 && warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} pasuje do kilku różnych okuć po producent+symbol. Nie utworzono duplikatu.`);
        return;
      }
      const hasMinimum = text(row.itemManufacturer) && text(row.itemSymbol) && text(row.itemName);
      if(!hasMinimum){
        summary.skipped += 1;
        if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} nie tworzy nowego okucia, bo brakuje producenta, symbolu albo nazwy.`);
        return;
      }
      const manufacturerName = manufacturerByName(manufacturers || [], row.itemManufacturer);
      if(!manufacturerName){
        summary.skipped += 1;
        if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} ma producenta spoza słownika: ${row.itemManufacturer}. Nie utworzono nowego okucia.`);
        return;
      }
      const supplier = resolveSupplier(suppliers || [], row, warnings);
      if(!supplier){
        summary.skipped += 1;
        if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} ma nieznanego dostawcę: ${row.supplierName || row.supplierId || '—'}. Nie utworzono nowego okucia.`);
        return;
      }
      if(!text(row.itemCategory) || !text(row.itemUnit)){
        summary.skipped += 1;
        if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} wymaga wyboru kategorii i jednostki przed utworzeniem nowego okucia.`);
        return;
      }
      const created = createAccessoryFromPriceRow(row, manufacturerName, settings, suppliers || []);
      target.push(created);
      all.push(created);
      summary.created += 1;
      if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} utworzył nowe okucie "${created.name}" po producencie i symbolu.`);
    });
    return summary;
  }

  function supplierPriceCreateRequiredGaps(supplierPriceRows, accessories, suppliers, manufacturers){
    const targetRows = Array.isArray(accessories) ? accessories : [];
    const parsedRows = (supplierPriceRows || [])
      .filter((row)=> !(row && row.__skipImport))
      .filter(hasSupplierPriceData)
      .map((raw)=>({ raw, parsed:parseSupplierPriceRow(raw) }))
      .filter((entry)=> entry.parsed.catalogPriceNet > 0 || entry.parsed.catalogPriceGross > 0);
    const out = [];
    parsedRows.forEach((entry)=>{
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
    const parsedRows = (supplierPriceRows || [])
      .filter((row)=> !(row && row.__skipImport))
      .filter(hasSupplierPriceData)
      .map((raw)=>({ raw, parsed:parseSupplierPriceRow(raw) }))
      .filter((entry)=> entry.parsed.catalogPriceNet > 0 || entry.parsed.catalogPriceGross > 0);
    const out = [];
    parsedRows.forEach((entry)=>{
      const row = entry.parsed;
      const item = resolveAccessory(targetRows, row, null);
      if(!item) return;
      if(resolveSupplier(suppliers || [], row, null)) return;
      out.push({ row:entry.raw, parsed:row, item, rowIndex:row.__rowIndex || entry.raw.__rowIndex || 0, gaps:['supplierName'] });
    });
    return out;
  }

  function applySupplierPriceRows(accessories, supplierPriceRows, suppliers, warnings, settings){
    const summary = { touchedIds:[], rows:0, added:0, updated:0, unchanged:0, skipped:0, changes:[] };
    const touched = new Set();
    const sourceRows = (supplierPriceRows || [])
      .filter(hasSupplierPriceData)
      .map((raw)=>({ raw, parsed:parseSupplierPriceRow(raw) }))
      .filter((entry)=> entry.parsed.catalogPriceNet > 0 || entry.parsed.catalogPriceGross > 0);
    const ignoredByResolver = sourceRows.filter((entry)=> entry.raw && entry.raw.__skipImport).length;
    const activeRows = sourceRows.filter((entry)=> !(entry.raw && entry.raw.__skipImport));
    summary.rows = sourceRows.length;
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
      if(row.useForQuoteSpecified && row.useForQuote){
        prices.forEach((price)=>{ if(text(price && price.supplierId) !== text(supplier.id) && price.useForQuote){ price.useForQuote = false; } });
      }
      if(changed){
        summary.changes.push(supplierPriceChangeDetail(entry.raw, row, item, supplier, existing, nextPrice));
        item.supplierPrices = prices.filter((price)=> text(price && price.supplierId) !== text(supplier.id));
        item.supplierPrices.push(nextPrice);
        if(existing) summary.updated += 1;
        else summary.added += 1;
        touched.add(text(item.id));
      }else{
        summary.unchanged += 1;
        item.supplierPrices = prices;
      }
    });
    summary.touchedIds = Array.from(touched);
    return summary;
  }

  FC.hardwareSupplierPriceXlsx = {
    SUPPLIER_PRICE_COLUMNS,
    buildSupplierPriceRows,
    supplierPriceValidations,
    parseSupplierPriceRow,
    hasSupplierPriceData,
    applySupplierPriceRows,
    createAccessoriesFromSupplierPriceRows,
    supplierPriceCreateRequiredGaps,
    supplierPriceMissingSupplierGaps,
    _debug:{ colFor, rowValues, emptyPriceRow, normalizePrices, supplierByName, resolveSupplier, resolveAccessory, sameSupplierPrice, supplierPriceChangeDetail, exactManufacturerSymbolMatches, uniqueLogicalMatches, createAccessoriesFromSupplierPriceRows, supplierPriceCreateRequiredGaps, supplierPriceMissingSupplierGaps }
  };
})();

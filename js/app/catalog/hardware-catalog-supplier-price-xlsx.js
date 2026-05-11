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
  function normalizePrices(item, suppliers){
    const hw = FC.hardwareCatalog || {};
    if(hw && typeof hw.normalizeSupplierPrices === 'function') return hw.normalizeSupplierPrices(item && item.supplierPrices, item || {}, suppliers || [], {});
    return Array.isArray(item && item.supplierPrices) ? item.supplierPrices : [];
  }
  function priceRow(item, price, suppliers){
    const supplier = supplierById(suppliers || [], price && price.supplierId) || {};
    return {
      itemName:item && item.name || '',
      itemSymbol:item && item.symbol || '',
      itemManufacturer:item && item.manufacturer || '',
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
    return { itemName:'', itemSymbol:'', itemManufacturer:'', supplierName:'', catalogPriceNet:'', catalogPriceGross:'', useForQuote:'NIE', priceStatus:'current', priceDate:'', itemId:'', supplierId:'' };
  }
  function rowValues(obj){
    return SUPPLIER_PRICE_COLUMNS.map((pair)=> obj._formulas && obj._formulas[pair[1]] ? obj._formulas[pair[1]] : valueForColumn(obj, pair[1]));
  }
  function buildSupplierPriceRows(accessories, suppliers){
    const rows = [SUPPLIER_PRICE_COLUMNS.map((pair)=> pair[0])];
    (accessories || []).forEach((item)=>{
      normalizePrices(item, suppliers || []).forEach((price)=>{
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
    return [
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
    const clean = (matches || []).filter(Boolean);
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
      if(found) return found;
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
  function normalizedNextPrice(row, supplier, existing){
    const vat = number(supplier && supplier.defaultVatRate) || 23;
    let catalogPriceNet = number(row.catalogPriceNet);
    let catalogPriceGross = number(row.catalogPriceGross);
    if(catalogPriceNet > 0 && catalogPriceGross <= 0) catalogPriceGross = netToGross(catalogPriceNet, vat);
    if(catalogPriceGross > 0 && catalogPriceNet <= 0) catalogPriceNet = grossToNet(catalogPriceGross, vat);
    return {
      supplierId:supplier.id,
      catalogPriceNet,
      catalogPriceGross,
      enteredPriceType:row.enteredPriceType || (row.catalogPriceNet > 0 ? 'net' : 'gross'),
      priceDate:text(row.priceDate) || text(existing && existing.priceDate),
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
  function applySupplierPriceRows(accessories, supplierPriceRows, suppliers, warnings){
    const summary = { touchedIds:[], rows:0, added:0, updated:0, unchanged:0, skipped:0 };
    const touched = new Set();
    const parsedRows = (supplierPriceRows || [])
      .filter(hasSupplierPriceData)
      .map(parseSupplierPriceRow)
      .filter((row)=> row.catalogPriceNet > 0 || row.catalogPriceGross > 0);
    summary.rows = parsedRows.length;
    parsedRows.forEach((row)=>{
      const item = resolveAccessory(accessories, row, warnings);
      if(!item){ summary.skipped += 1; if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} nie pasuje do żadnego okucia.`); return; }
      const supplier = resolveSupplier(suppliers || [], row, warnings);
      if(!supplier){ summary.skipped += 1; if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} ma nieznanego dostawcę: ${row.supplierName || row.supplierId || '—'}.`); return; }
      const prices = Array.isArray(item.supplierPrices) ? item.supplierPrices.slice() : [];
      const existing = prices.find((price)=> text(price && price.supplierId) === text(supplier.id)) || null;
      const nextPrice = normalizedNextPrice(row, supplier, existing);
      const changed = !existing || !sameSupplierPrice(existing, nextPrice);
      if(row.useForQuoteSpecified && row.useForQuote){
        prices.forEach((price)=>{ if(text(price && price.supplierId) !== text(supplier.id) && price.useForQuote){ price.useForQuote = false; } });
      }
      if(changed){
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
    _debug:{ colFor, rowValues, emptyPriceRow, normalizePrices, supplierByName, resolveSupplier, resolveAccessory, sameSupplierPrice }
  };
})();

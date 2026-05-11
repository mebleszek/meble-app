// js/app/catalog/hardware-catalog-supplier-price-xlsx.js
// Arkusz Ceny_dostawcow: jeden wiersz = jedna aktualna cena danego okucia u danego dostawcy.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const SUPPLIER_PRICE_COLUMNS = [
    ['okucie_nazwa','itemName'],
    ['okucie_symbol','itemSymbol'],
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
    return { itemName:'', itemSymbol:'', supplierName:'', catalogPriceNet:'', catalogPriceGross:'', useForQuote:'NIE', priceStatus:'current', priceDate:'', itemId:'', supplierId:'' };
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
    return {
      __rowIndex:Number(row && row.__rowIndex) || 0,
      itemId:text(valueFrom(row, ['okucie_id','itemId'])),
      itemName:text(valueFrom(row, ['okucie_nazwa','itemName','nazwa'])),
      itemSymbol:text(valueFrom(row, ['okucie_symbol','itemSymbol','symbol'])),
      supplierId:text(valueFrom(row, ['dostawca_id','supplierId'])),
      supplierName:text(valueFrom(row, ['dostawca','supplierName','nazwa_dostawcy'])),
      catalogPriceNet:hasNumericInput(rawNet) ? number(rawNet) : 0,
      catalogPriceGross:hasNumericInput(rawGross) ? number(rawGross) : 0,
      enteredPriceType:hasNumericInput(rawNet) ? 'net' : (hasNumericInput(rawGross) ? 'gross' : ''),
      useForQuote:bool(valueFrom(row, ['do_wyceny','useForQuote'])),
      priceStatus:normalizePriceStatus(valueFrom(row, ['status_ceny','priceStatus'])),
      priceDate:text(valueFrom(row, ['data_ceny','priceDate','priceUpdatedAt'])),
    };
  }
  function hasSupplierPriceData(row){
    return !!(text(valueFrom(row, ['okucie_id','okucie_nazwa','okucie_symbol','dostawca','dostawca_id'])) || hasNumericInput(valueFrom(row, ['cena_netto','catalogPriceNet'])) || hasNumericInput(valueFrom(row, ['cena_brutto','catalogPriceGross'])));
  }
  function resolveAccessory(accessories, row){
    const byId = (accessories || []).find((item)=> text(item && item.id) && text(item.id) === text(row.itemId));
    if(byId) return byId;
    const sym = safePart(row.itemSymbol);
    const name = safePart(row.itemName);
    return (accessories || []).find((item)=> (sym && safePart(item && item.symbol) === sym) || (name && safePart(item && item.name) === name)) || null;
  }
  function resolveSupplier(suppliers, row){
    return supplierById(suppliers || [], row.supplierId || row.supplierName) || null;
  }
  function applySupplierPriceRows(accessories, supplierPriceRows, suppliers, warnings){
    const touched = new Set();
    const rows = (supplierPriceRows || []).filter(hasSupplierPriceData).map(parseSupplierPriceRow).filter((row)=> row.catalogPriceNet > 0 || row.catalogPriceGross > 0);
    rows.forEach((row)=>{
      const item = resolveAccessory(accessories, row);
      if(!item){ if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} nie pasuje do żadnego okucia.`); return; }
      const supplier = resolveSupplier(suppliers || [], row);
      if(!supplier){ if(warnings) warnings.push(`Ceny dostawców: wiersz ${row.__rowIndex || '?'} ma nieznanego dostawcę: ${row.supplierName || row.supplierId || '—'}.`); return; }
      const vat = number(supplier.defaultVatRate) || 23;
      let catalogPriceNet = number(row.catalogPriceNet);
      let catalogPriceGross = number(row.catalogPriceGross);
      if(catalogPriceNet > 0 && catalogPriceGross <= 0) catalogPriceGross = netToGross(catalogPriceNet, vat);
      if(catalogPriceGross > 0 && catalogPriceNet <= 0) catalogPriceNet = grossToNet(catalogPriceGross, vat);
      item.supplierPrices = Array.isArray(item.supplierPrices) ? item.supplierPrices.filter((price)=> text(price && price.supplierId) !== text(supplier.id)) : [];
      if(row.useForQuote) item.supplierPrices.forEach((price)=>{ price.useForQuote = false; });
      item.supplierPrices.push({ supplierId:supplier.id, catalogPriceNet, catalogPriceGross, enteredPriceType:row.enteredPriceType || (row.catalogPriceNet > 0 ? 'net' : 'gross'), priceDate:row.priceDate, priceStatus:normalizePriceStatus(row.priceStatus), useForQuote:!!row.useForQuote });
      touched.add(text(item.id));
    });
    return { touchedIds:Array.from(touched), rows:rows.length };
  }


  FC.hardwareSupplierPriceXlsx = {
    SUPPLIER_PRICE_COLUMNS,
    buildSupplierPriceRows,
    supplierPriceValidations,
    parseSupplierPriceRow,
    hasSupplierPriceData,
    applySupplierPriceRows,
    _debug:{ colFor, rowValues, emptyPriceRow, normalizePrices }
  };
})();

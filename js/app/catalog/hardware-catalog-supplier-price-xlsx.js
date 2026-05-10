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
    ['data_ceny','priceDate'],
    ['okucie_id','itemId'],
    ['dostawca_id','supplierId'],
  ];
  const TEMPLATE_PRICE_ROWS = 260;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.').replace(/\s+/g, '')); return Number.isFinite(n) ? n : 0; }
  function safePart(value){ return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || ''; }
  function bool(value){ return ['tak','true','1','yes','y'].includes(text(value).toLowerCase()); }
  function valueForColumn(obj, key){ return obj && obj[key] != null ? obj[key] : ''; }
  function col(index){ let n = Number(index) + 1; let out = ''; while(n > 0){ const mod = (n - 1) % 26; out = String.fromCharCode(65 + mod) + out; n = Math.floor((n - 1) / 26); } return out; }
  function colFor(prop){ const idx = SUPPLIER_PRICE_COLUMNS.findIndex((pair)=> pair[1] === prop); return col(idx < 0 ? 0 : idx); }
  function formulaCell(formula){ return { formula }; }
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
      priceDate:price && price.priceDate || item && item.priceUpdatedAt || '',
      itemId:item && item.id || '',
      supplierId:price && price.supplierId || '',
    };
  }
  function emptyPriceRow(rowNo){
    const net = `${colFor('catalogPriceNet')}${rowNo}`;
    const gross = `${colFor('catalogPriceGross')}${rowNo}`;
    return {
      itemName:'', itemSymbol:'', supplierName:'', catalogPriceNet:'', catalogPriceGross:'', useForQuote:'NIE', priceDate:'', itemId:'', supplierId:'',
      _formulas:{
        catalogPriceNet:formulaCell(`IF(${gross}<>"",ROUND(${gross}/1.23,2),"")`),
        catalogPriceGross:formulaCell(`IF(${net}<>"",ROUND(${net}*1.23,2),"")`),
      }
    };
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
    ];
  }
  function headerKey(value){ return safePart(value).replace(/_+/g, '_'); }
  function valueFrom(row, names){ for(const name of names){ const key = headerKey(name); if(Object.prototype.hasOwnProperty.call(row, key)) return row[key]; } return ''; }
  function parseSupplierPriceRow(row){
    return {
      __rowIndex:Number(row && row.__rowIndex) || 0,
      itemId:text(valueFrom(row, ['okucie_id','itemId'])),
      itemName:text(valueFrom(row, ['okucie_nazwa','itemName','nazwa'])),
      itemSymbol:text(valueFrom(row, ['okucie_symbol','itemSymbol','symbol'])),
      supplierId:text(valueFrom(row, ['dostawca_id','supplierId'])),
      supplierName:text(valueFrom(row, ['dostawca','supplierName','nazwa_dostawcy'])),
      catalogPriceNet:number(valueFrom(row, ['cena_netto','catalogPriceNet'])),
      catalogPriceGross:number(valueFrom(row, ['cena_brutto','catalogPriceGross'])),
      useForQuote:bool(valueFrom(row, ['do_wyceny','useForQuote'])),
      priceDate:text(valueFrom(row, ['data_ceny','priceDate','priceUpdatedAt'])),
    };
  }
  function hasSupplierPriceData(row){
    return !!(text(valueFrom(row, ['okucie_id','okucie_nazwa','okucie_symbol','dostawca','dostawca_id'])) || number(valueFrom(row, ['cena_netto','cena_brutto'])) > 0);
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
      item.supplierPrices = Array.isArray(item.supplierPrices) ? item.supplierPrices.filter((price)=> text(price && price.supplierId) !== text(supplier.id)) : [];
      if(row.useForQuote) item.supplierPrices.forEach((price)=>{ price.useForQuote = false; });
      item.supplierPrices.push({ supplierId:supplier.id, catalogPriceNet:row.catalogPriceNet, catalogPriceGross:row.catalogPriceGross, enteredPriceType:row.catalogPriceNet > 0 ? 'net' : 'gross', priceDate:row.priceDate, useForQuote:!!row.useForQuote });
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

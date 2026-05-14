// js/app/catalog/hardware-supplier-price-export.js
// Eksport arkusza `Ceny_dostawcow`: kolumny, puste wiersze i walidacje XLSX.
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
  function col(index){ let n = Number(index) + 1; let out = ''; while(n > 0){ const mod = (n - 1) % 26; out = String.fromCharCode(65 + mod) + out; n = Math.floor((n - 1) / 26); } return out; }
  function colFor(prop){ const idx = SUPPLIER_PRICE_COLUMNS.findIndex((pair)=> pair[1] === prop); return col(idx < 0 ? 0 : idx); }
  function supplierById(suppliers, id){ const key = text(id).toLowerCase(); return (suppliers || []).find((row)=> text(row && row.id).toLowerCase() === key || text(row && row.name).toLowerCase() === key) || null; }
  function valueForColumn(obj, key){ return obj && obj[key] != null ? obj[key] : ''; }
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

  FC.hardwareSupplierPriceExport = {
    SUPPLIER_PRICE_COLUMNS,
    TEMPLATE_PRICE_ROWS,
    buildSupplierPriceRows,
    supplierPriceValidations,
    _debug:{ colFor, rowValues, emptyPriceRow, normalizePrices, supplierById, priceRow }
  };
})();

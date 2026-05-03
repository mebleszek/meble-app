// js/tabs/wywiad-labor-summary.js
// Podgląd dodatków robocizny zapisanych przy szafce w WYWIADZIE.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function qty(value){
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  function make(tag, className, content){
    const el = document.createElement(tag);
    if(className) el.className = className;
    if(content != null) el.textContent = content;
    return el;
  }
  function catalogRows(){
    try{
      if(FC.catalogSelectors && typeof FC.catalogSelectors.getQuoteRates === 'function') return FC.catalogSelectors.getQuoteRates();
      if(FC.catalogStore && typeof FC.catalogStore.getPriceList === 'function') return FC.catalogStore.getPriceList('quoteRates');
    }catch(_){ }
    return [];
  }
  function normalize(row){
    try{ return FC.laborCatalog && typeof FC.laborCatalog.normalizeDefinition === 'function' ? FC.laborCatalog.normalizeDefinition(row) : row; }
    catch(_){ return row; }
  }
  function describe(row){
    try{ return FC.laborCatalog && typeof FC.laborCatalog.describeDefinition === 'function' ? FC.laborCatalog.describeDefinition(row) : ''; }
    catch(_){ return ''; }
  }
  function getDefinitions(){
    return (Array.isArray(catalogRows()) ? catalogRows() : [])
      .map(normalize)
      .filter((row)=> row && row.active !== false);
  }
  function laborItems(cabinet){
    const items = Array.isArray(cabinet && cabinet.laborItems) ? cabinet.laborItems : [];
    return items.map((item)=> ({ rateId:text(item && (item.rateId || item.id)), qty:qty(item && item.qty), note:text(item && item.note) })).filter((item)=> item.rateId);
  }
  function resolveItems(cabinet){
    const defs = getDefinitions();
    const map = new Map(defs.map((row)=> [String(row && row.id || ''), row]));
    return laborItems(cabinet).map((item)=> {
      const def = map.get(String(item.rateId)) || null;
      return Object.assign({}, item, {
        name: def ? text(def.name) : item.rateId,
        description: def ? describe(def) : '',
      });
    });
  }
  function getHeaderText(cabinet){
    const rows = resolveItems(cabinet);
    if(!rows.length) return '';
    const names = rows.slice(0, 3).map((row)=> `${row.name}${row.qty > 1 ? ' ×' + row.qty : ''}`);
    const rest = rows.length > 3 ? ` +${rows.length - 3}` : '';
    return `Dodatki robocizny: ${names.join(', ')}${rest}`;
  }
  function renderCabinetLaborSummary(cabinet){
    const rows = resolveItems(cabinet);
    if(!rows.length) return null;
    const block = make('div', 'front-block cabinet-labor-summary');
    const head = make('div', 'head');
    head.appendChild(make('div', '', 'Dodatki robocizny'));
    head.appendChild(make('div', 'front-meta', `${rows.length} poz.`));
    block.appendChild(head);
    rows.forEach((row)=> {
      const line = make('div', 'front-row cabinet-labor-summary__row');
      const left = make('div');
      left.appendChild(make('div', 'cabinet-labor-summary__name', row.name || row.rateId));
      const metaParts = [`Ilość: ${row.qty}`];
      if(row.description) metaParts.push(row.description);
      if(row.note) metaParts.push(row.note);
      left.appendChild(make('div', 'front-meta', metaParts.join(' • ')));
      line.appendChild(left);
      line.appendChild(make('div', 'cabinet-labor-summary__qty', `×${row.qty}`));
      block.appendChild(line);
    });
    return block;
  }

  FC.wywiadLaborSummary = {
    getDefinitions,
    resolveItems,
    getHeaderText,
    renderCabinetLaborSummary,
  };
})();

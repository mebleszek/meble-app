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
  function getApplianceText(cabinet){
    try{
      const api = FC.laborApplianceRules;
      return api && typeof api.describeCabinetMounting === 'function' ? api.describeCabinetMounting(cabinet) : '';
    }catch(_){ return ''; }
  }
  function getHeaderText(cabinet){
    const rows = resolveItems(cabinet);
    const applianceText = getApplianceText(cabinet);
    const parts = [];
    if(applianceText) parts.push(applianceText);
    if(rows.length){
      const names = rows.slice(0, 3).map((row)=> `${row.name}${row.qty > 1 ? ' ×' + row.qty : ''}`);
      const rest = rows.length > 3 ? ` +${rows.length - 3}` : '';
      parts.push(`Czynności: ${names.join(', ')}${rest}`);
    }
    return parts.join(' • ');
  }
  function renderCabinetLaborSummary(cabinet){
    const rows = resolveItems(cabinet);
    const applianceText = getApplianceText(cabinet);
    if(!rows.length && !applianceText) return null;
    const block = make('div', 'front-block cabinet-labor-summary');
    const head = make('div', 'head');
    head.appendChild(make('div', '', 'Czynności robocizny'));
    head.appendChild(make('div', 'front-meta', `${rows.length + (applianceText ? 1 : 0)} poz.`));
    block.appendChild(head);
    if(applianceText){
      const appLine = make('div', 'front-row cabinet-labor-summary__row');
      const left = make('div');
      left.appendChild(make('div', 'cabinet-labor-summary__name', applianceText));
      left.appendChild(make('div', 'front-meta', 'Automatycznie z typu szafki, z możliwością wyłączenia w edycji.'));
      appLine.appendChild(left);
      appLine.appendChild(make('div', 'cabinet-labor-summary__qty', ''));
      block.appendChild(appLine);
    }
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

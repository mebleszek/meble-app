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
  function getApplianceInfo(cabinet){
    try{
      const api = FC.laborApplianceRules;
      if(!(api && typeof api.describeCabinetMounting === 'function')) return null;
      const textValue = api.describeCabinetMounting(cabinet);
      if(!textValue) return null;
      const enabled = typeof api.isMountingEnabled === 'function' ? !!api.isMountingEnabled(cabinet) : !/bez montażu/i.test(textValue);
      return { text:textValue, enabled };
    }catch(_){ return null; }
  }
  function getApplianceText(cabinet){
    const info = getApplianceInfo(cabinet);
    return info ? info.text : '';
  }
  function getHeaderLines(cabinet){
    const rows = resolveItems(cabinet);
    const lines = [];
    const appliance = getApplianceInfo(cabinet);
    if(appliance){
      lines.push({
        kind:'mounting',
        enabled:!!appliance.enabled,
        text:appliance.text,
      });
    }
    rows.forEach((row)=> {
      lines.push({
        kind:'labor',
        text:`Czynności: ${row.name || row.rateId}`,
      });
    });
    return lines;
  }
  function getHeaderText(cabinet){
    return getHeaderLines(cabinet).map((line)=> line.text).join(' • ');
  }
  function renderHeaderSummary(cabinet){
    const lines = getHeaderLines(cabinet);
    if(!lines.length) return null;
    const wrap = make('div', 'cabinet-header__meta cabinet-header__meta--labor');
    lines.forEach((line)=> {
      const cls = ['cabinet-header__labor-line'];
      if(line.kind === 'mounting') cls.push(line.enabled ? 'cabinet-header__labor-line--mount-on' : 'cabinet-header__labor-line--mount-off');
      else cls.push('cabinet-header__labor-line--item');
      wrap.appendChild(make('div', cls.join(' '), line.text));
    });
    return wrap;
  }
  function renderCabinetLaborSummary(cabinet){
    const rows = resolveItems(cabinet);
    const appliance = getApplianceInfo(cabinet);
    const applianceText = appliance ? appliance.text : '';
    if(!rows.length && !applianceText) return null;
    const block = make('div', 'front-block cabinet-labor-summary');
    const head = make('div', 'head');
    head.appendChild(make('div', '', 'Czynności robocizny'));
    head.appendChild(make('div', 'front-meta', `${rows.length + (applianceText ? 1 : 0)} poz.`));
    block.appendChild(head);
    if(applianceText){
      const appLine = make('div', 'front-row cabinet-labor-summary__row');
      const left = make('div');
      const nameClass = `cabinet-labor-summary__name ${appliance && appliance.enabled ? 'cabinet-labor-summary__name--mount-on' : 'cabinet-labor-summary__name--mount-off'}`;
      left.appendChild(make('div', nameClass, applianceText));
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
    getHeaderLines,
    renderHeaderSummary,
    renderCabinetLaborSummary,
  };
})();

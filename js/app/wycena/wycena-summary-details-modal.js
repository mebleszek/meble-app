// js/app/wycena/wycena-summary-details-modal.js
// Modal audytu podsumowania WYCENY: pokazuje szczegóły każdej kwoty bez zmiany wyglądu linijek podsumowania.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function formatDecimal(value, precision){
    const n = Math.round(num(value) * Math.pow(10, precision == null ? 2 : precision)) / Math.pow(10, precision == null ? 2 : precision);
    return n.toFixed(precision == null ? 2 : precision).replace(/\.?0+$/, '').replace('.', ',');
  }
  function money(value){ return (Math.round(num(value) * 100) / 100).toFixed(2).replace('.', ',') + ' zł'; }
  function rateMoney(value){ return formatDecimal(value, 2) + ' zł/h'; }
  function hours(value){ return formatDecimal(value, 2) + ' h'; }
  function pct(value, total){ const t = num(total); if(!(t > 0)) return '0%'; return (Math.round((num(value) / t) * 1000) / 10).toFixed(1).replace('.0', '').replace('.', ',') + '%'; }
  function h(tag, attrs, children){
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach((key)=>{
      const value = attrs[key];
      if(key === 'class') el.className = value;
      else if(key === 'text') el.textContent = value;
      else if(key === 'html') el.innerHTML = value;
      else if(value !== false && value != null) el.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : (children ? [children] : [])).forEach((child)=> el.appendChild(child));
    return el;
  }
  function getRegister(snapshot){
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
    if(snap.calculationRegister && snap.calculationRegister.lines) return snap.calculationRegister;
    if(snap.lines && snap.lines.calculationRegister) return snap.lines.calculationRegister;
    try{
      if(FC.quoteCalculationRegister && typeof FC.quoteCalculationRegister.buildRegister === 'function'){
        return FC.quoteCalculationRegister.buildRegister(snap.lines || {}, snap.commercial || {});
      }
    }catch(_){ }
    return { lines:[], totals:(snap.totals || {}), warnings:[] };
  }
  function grouped(rows, keyFn){
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row)=>{
      const key = text(typeof keyFn === 'function' ? keyFn(row) : row && row[keyFn]) || 'Inne';
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return Array.from(map.entries());
  }
  function addInfoButton(target, title, message){
    const msg = text(message);
    if(!msg) return;
    if(FC.helpRegistry && typeof FC.helpRegistry.createTrigger === 'function'){
      target.appendChild(FC.helpRegistry.createTrigger({ key:'wycena.audit.' + (FC.helpRegistry.safeKey ? FC.helpRegistry.safeKey(text(title)) : text(title)), title:title || 'Algorytm liczenia', message:msg, scope:'wycena', className:'info-trigger quote-detail-info', stop:true, ariaLabel:'Pokaż algorytm: ' + text(title) }));
      return;
    }
    const btn = h('button', { type:'button', class:'info-trigger quote-detail-info', 'aria-label':'Pokaż algorytm: ' + text(title) });
    btn.addEventListener('click', (event)=>{
      event.preventDefault(); event.stopPropagation();
      try{ if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title:title || 'Algorytm liczenia', message:msg }); }
      catch(_){ }
    });
    target.appendChild(btn);
  }
  function humanWarningText(message){
    const msg = text(message);
    if(msg === 'Cena startowa — sprawdź i edytuj w cenniku przed realną ofertą.') return 'To jest stawka startowa. Przed wysłaniem oferty sprawdź ją w cenniku.';
    return msg.replace(/\bPLN\b/g, 'zł');
  }
  function humanCountWord(count, one, few, many){
    const n = Math.abs(Math.round(num(count)));
    if(n === 1) return one;
    if(n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)) return few || many || one;
    return many || few || one;
  }
  function laborRowsTotalHours(rows){
    return (Array.isArray(rows) ? rows : []).reduce((sum, row)=> {
      const raw = rawLabor(row);
      const hoursValue = num(raw.hours != null ? raw.hours : (row && row.hours != null ? row.hours : raw.baseHours));
      return sum + Math.max(0, hoursValue);
    }, 0);
  }
  function laborActionSummary(count, sum, rows){
    const n = Math.max(0, Math.round(num(count)));
    const base = `${n} ${humanCountWord(n, 'czynność', 'czynności', 'czynności')} razem = ${money(sum)}`;
    const totalHours = laborRowsTotalHours(rows);
    return totalHours > 0 ? `${base} • czas: ${hours(totalHours)}` : base;
  }
  function splitLaborSourceLabel(value){
    const parts = text(value).split(/\s+—\s+/).map(text).filter(Boolean);
    if(!parts.length) return { base:'', detail:'' };
    const last = parts[parts.length - 1] || '';
    const isDoorDetail = /\b(lewe|prawe|lewy|prawy|drzwiczki|drzwi|front)\b/i.test(last);
    if(isDoorDetail && parts.length > 1){
      return { base:parts.slice(0, -1).join(' — '), detail:last };
    }
    return { base:parts.join(' — '), detail:'' };
  }
  function laborCabinetGroupTitle(row){
    const split = splitLaborSourceLabel(row && row.sourceLabel);
    return split.base || text(row && row.sourceLabel) || text(row && row.subsection) || 'Szafka';
  }
  function laborCabinetGroupKey(row){
    const id = text(row && row.sourceId);
    if(id) return 'cabinet:' + id;
    return 'cabinet-label:' + laborCabinetGroupTitle(row);
  }
  function laborSourceDetail(row){
    return splitLaborSourceLabel(row && row.sourceLabel).detail;
  }
  function catalogQuoteRates(){
    try{ return FC.catalogSelectors && typeof FC.catalogSelectors.getQuoteRates === 'function' ? FC.catalogSelectors.getQuoteRates() : []; }
    catch(_){ return []; }
  }
  function lowerFirst(value){
    const raw = text(value);
    return raw ? raw.charAt(0).toLowerCase() + raw.slice(1) : '';
  }
  function laborRateLabel(row){
    const raw = row && row.raw && typeof row.raw === 'object' ? row.raw : {};
    const code = text(raw.rateType || row && row.rateType);
    let label = '';
    try{ if(FC.laborCatalog && typeof FC.laborCatalog.getRateLabel === 'function') label = FC.laborCatalog.getRateLabel(code, catalogQuoteRates()); }catch(_){ }
    if(!label){
      const fallback = { workshop:'Warsztatowa', assembly:'Montażowa', specialist:'Specjalistyczna', helper:'Pomocnika' };
      label = fallback[code] || '';
    }
    if(!text(label)) return 'Stawka';
    return /^stawka\b/i.test(label) ? label : 'Stawka ' + lowerFirst(label);
  }
  function parseFrontRows(note){
    const raw = text(note);
    const match = raw.match(/Fronty z MATERIAŁ\/WYCENA:\s*(.+)$/i);
    if(!match) return [];
    return match[1].split(',').map((chunk)=>{
      const part = text(chunk);
      const found = part.match(/^(\d+(?:[\.,]\d+)?)\s*[×x]\s*([0-9]+(?:[\.,][0-9]+)?)\s*×\s*([0-9]+(?:[\.,][0-9]+)?)/i);
      if(!found) return null;
      return { qty:num(found[1]), dims:`${formatDecimal(found[2], 1)} × ${formatDecimal(found[3], 1)}`.replace(/,0\b/g, '') };
    }).filter(Boolean);
  }
  function rawLabor(row){ return row && row.raw && typeof row.raw === 'object' ? row.raw : {}; }
  function laborSubject(row){
    const raw = rawLabor(row);
    const quantity = Math.max(0, num(row && row.quantity || raw.quantity || 1));
    const unit = text(row && row.unit || raw.unit || 'szt.');
    const role = text(raw.sourceRole || row && row.sourceRole);
    const code = text(raw.workAutomatCode || raw.laborAutomatCode || row && (row.workAutomatCode || row.laborAutomatCode));
    const name = text(row && row.name).toLowerCase();
    const detail = laborSourceDetail(row);
    const withDetail = (value)=> detail ? `${detail}: ${value}` : value;
    if(role === 'front-labor' || code === 'front_mount' || name.includes('frontu')){
      const rows = parseFrontRows(raw.note || row && row.note);
      const label = `${formatDecimal(quantity, 2)} ${quantity === 1 ? 'front' : 'frontów'}`;
      if(rows.length === 1) return withDetail(`${label} ${rows[0].dims} cm`);
      if(rows.length > 1) return withDetail(`${label}: ${rows.map((part)=> `${formatDecimal(part.qty, 2)} × ${part.dims} cm`).join(', ')}`);
      return withDetail(`${label}`);
    }
    if(role === 'shelf-labor' || code === 'shelf_mount' || name.includes('pół')) return withDetail(`${formatDecimal(quantity, 2)} ${humanCountWord(quantity, 'półka', 'półki', 'półek')}`);
    if(role === 'cabinet-body-labor' || code === 'cabinet_body') return withDetail(`${formatDecimal(quantity || 1, 2)} ${quantity === 1 ? 'korpusu' : 'korpusów'}`);
    if(role === 'hinge-labor' || code === 'hinge_mount' || name.includes('zawias')) return withDetail(`${formatDecimal(quantity, 2)} ${quantity === 1 ? 'zawiasu' : 'zawiasów'}`);
    if(text(raw.sourceType) === 'appliance') return text(raw.sourceLabel) || 'montaż AGD';
    if(text(raw.sourceKind) === 'manual' || text(raw.sourceType).includes('manual')) return withDetail(quantity > 0 ? `${formatDecimal(quantity, 2)} szt. — czynność ręczna` : 'czynność ręczna');
    if(unit === 'szt.' || unit === 'szt') return withDetail(`${formatDecimal(quantity, 2)} szt.`);
    if(unit) return withDetail(`${formatDecimal(quantity, 2)} ${unit}`);
    return withDetail('czynność ręczna');
  }
  function laborTimeFormula(row){
    const raw = rawLabor(row);
    const quantity = Math.max(0, num(row && row.quantity || raw.quantity || 1)) || 1;
    const unit = text(row && row.unit || raw.unit);
    const baseHours = num(raw.baseHours);
    const pricedHours = num(raw.hours);
    const volumeHours = num(raw.volumeHours);
    const multiplier = num(raw.multiplier) || 1;
    if((unit === 'szt.' || unit === 'szt') && quantity > 0 && baseHours > 0){
      const perUnit = baseHours / quantity;
      const qtyBase = quantity * perUnit;
      if(volumeHours > 0 || Math.abs(multiplier - 1) > 0.0001){
        const parts = [`${formatDecimal(quantity, 2)} × ${hours(perUnit)}`];
        if(volumeHours > 0) parts.push(`czas gabarytowy ${hours(volumeHours)}`);
        const beforeMultiplier = parts.join(' + ');
        return Math.abs(multiplier - 1) > 0.0001
          ? `(${beforeMultiplier}) × ${formatDecimal(multiplier, 2)} = ${hours(pricedHours || (qtyBase + volumeHours) * multiplier)}`
          : `${beforeMultiplier} = ${hours(pricedHours || qtyBase + volumeHours)}`;
      }
      return `${formatDecimal(quantity, 2)} × ${hours(perUnit)} = ${hours(pricedHours || baseHours)}`;
    }
    if(pricedHours > 0) return hours(pricedHours);
    return '';
  }
  function laborFormula(row){
    const raw = rawLabor(row);
    const quantity = Math.max(0, num(row && row.quantity || raw.quantity || 1)) || 1;
    const total = num(row && row.total || raw.total);
    const hourlyRate = num(raw.hourlyRate);
    const baseHours = num(raw.baseHours);
    const pricedHours = num(raw.hours);
    const fixedPrice = num(raw.fixedPrice);
    const volumePrice = num(raw.volumePrice);
    const volumeHours = num(raw.volumeHours);
    const multiplier = num(raw.multiplier) || 1;
    const sourceRole = text(raw.sourceRole);
    const unit = text(row && row.unit || raw.unit);
    const simpleLinearPiece = (unit === 'szt.' || unit === 'szt') && quantity > 0 && hourlyRate > 0 && baseHours > 0 && fixedPrice <= 0 && volumePrice <= 0 && volumeHours <= 0 && (Math.abs(multiplier - 1) < 0.0001 || sourceRole === 'front-labor');
    if(simpleLinearPiece){
      const perUnit = baseHours / quantity;
      return `${formatDecimal(quantity, 2)} × ${hours(perUnit)} × ${rateMoney(hourlyRate)} = ${money(total)}`;
    }
    const parts = [];
    if(pricedHours > 0 && hourlyRate > 0) parts.push(`${hours(pricedHours)} × ${rateMoney(hourlyRate)}`);
    if(volumePrice > 0) parts.push(`dopłata gabarytowa ${money(volumePrice)}`);
    if(fixedPrice > 0) parts.push(`kwota stała ${money(fixedPrice)}`);
    return parts.length ? `${parts.join(' + ')} = ${money(total)}` : money(total);
  }
  function laborTimeRows(row){
    const raw = rawLabor(row);
    const quantity = Math.max(0, num(row && row.quantity || raw.quantity || 1)) || 1;
    const unit = text(row && row.unit || raw.unit);
    const baseHours = num(raw.baseHours);
    const pricedHours = num(raw.hours);
    const out = [];
    if((unit === 'szt.' || unit === 'szt') && quantity > 0 && baseHours > 0){
      out.push(['Czas na 1 sztukę:', hours(baseHours / quantity)]);
      const formula = laborTimeFormula(row);
      if(formula) out.push(['Czas razem:', formula]);
    }else if(pricedHours > 0){
      out.push(['Czas wyceniony:', hours(pricedHours)]);
    }
    return out;
  }
  function renderLaborLine(row){
    const item = h('div', { class:'quote-detail-line quote-detail-line--labor' });
    const main = h('div', { class:'quote-detail-line__main' });
    const name = h('div', { class:'quote-detail-line__name' });
    name.appendChild(h('span', { text:text(row && row.name) || 'Czynność robocizny' }));
    if(row && row.starterPrice) name.appendChild(h('span', { class:'quote-detail-chip quote-detail-chip--warning', text:'Cena startowa' }));
    addInfoButton(name, row && row.name, row && row.calculation);
    main.appendChild(name);
    const details = h('div', { class:'quote-detail-labor-human' });
    details.appendChild(h('div', { class:'quote-detail-labor-human__row', text:'Dotyczy: ' + laborSubject(row) }));
    laborTimeRows(row).forEach((time)=> details.appendChild(h('div', { class:'quote-detail-labor-human__row', text:`${time[0]} ${time[1]}` })));
    const raw = rawLabor(row);
    if(num(raw.hourlyRate) > 0) details.appendChild(h('div', { class:'quote-detail-labor-human__row', text:`${laborRateLabel(row)}: ${rateMoney(raw.hourlyRate)}` }));
    details.appendChild(h('div', { class:'quote-detail-labor-human__row quote-detail-labor-human__row--total', text:'Razem: ' + laborFormula(row) }));
    main.appendChild(details);
    item.appendChild(main);
    const warnings = Array.isArray(row && row.warnings) ? row.warnings : [];
    warnings.forEach((msg)=> item.appendChild(h('div', { class:'quote-detail-warning', text:humanWarningText(msg) })));
    return item;
  }

  function renderLine(row){
    if(text(row && row.section) === 'labor') return renderLaborLine(row);
    const item = h('div', { class:'quote-detail-line' });
    const main = h('div', { class:'quote-detail-line__main' });
    const name = h('div', { class:'quote-detail-line__name' });
    name.appendChild(h('span', { text:text(row && row.name) || 'Pozycja' }));
    if(row && row.starterPrice) name.appendChild(h('span', { class:'quote-detail-chip quote-detail-chip--warning', text:'Cena startowa' }));
    addInfoButton(name, row && row.name, row && row.calculation);
    main.appendChild(name);
    const meta = [text(row && row.sourceLabel), text(row && row.rooms), text(row && row.note)].filter(Boolean).join(' • ');
    if(meta) main.appendChild(h('div', { class:'quote-detail-line__meta', text:meta }));
    const price = h('div', { class:'quote-detail-line__price' });
    price.appendChild(h('div', { class:'quote-detail-line__qty', text:`${num(row && row.quantity)}${row && row.unit ? ' ' + text(row.unit) : ''} × ${money(row && row.unitPrice)}` }));
    price.appendChild(h('div', { class:'quote-detail-line__total', text:money(row && row.total) }));
    item.appendChild(main); item.appendChild(price);
    const warnings = Array.isArray(row && row.warnings) ? row.warnings : [];
    warnings.forEach((msg)=> item.appendChild(h('div', { class:'quote-detail-warning', text:humanWarningText(msg) })));
    return item;
  }
  function sectionTitle(section){
    const labels = FC.quoteCalculationRegister && FC.quoteCalculationRegister.SECTION_LABELS || {};
    return labels[section] || section || 'Szczegóły';
  }
  const QUOTE_DETAIL_ACCORDION_MS = 420;
  function prefersReducedMotion(){
    try{ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){ return false; }
  }
  function frame(fn){
    try{
      if(window.requestAnimationFrame) window.requestAnimationFrame(()=> window.requestAnimationFrame(fn));
      else setTimeout(fn, 0);
    }catch(_){ setTimeout(fn, 0); }
  }
  function groupPanel(group){ return group ? group.querySelector(':scope > .rozrys-material-accordion__body') : null; }
  function groupTrigger(group){ return group ? group.querySelector(':scope .rozrys-material-accordion__trigger') : null; }
  function resetGroupMotion(group){
    const panel = groupPanel(group);
    if(!group || !panel) return;
    if(group._quoteDetailAccordionTimer){
      clearTimeout(group._quoteDetailAccordionTimer);
      group._quoteDetailAccordionTimer = null;
    }
    group.classList.remove('is-ui-pattern-animating');
    panel.style.maxHeight = '';
    panel.style.opacity = '';
    panel.style.transform = '';
    panel.style.overflow = '';
  }
  function setGroupState(group, open){
    if(!group) return;
    const panel = groupPanel(group);
    const btn = groupTrigger(group);
    group.classList.toggle('is-open', !!open);
    if(btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if(panel) panel.hidden = !open;
  }
  function closeGroupInstant(group){
    if(!group) return;
    resetGroupMotion(group);
    setGroupState(group, false);
  }
  function closeSiblingGroups(group){
    const parent = group && group.parentNode;
    if(!parent) return;
    Array.from(parent.querySelectorAll('.quote-detail-group.is-open')).forEach((node)=>{
      if(node !== group) closeGroupInstant(node);
    });
  }
  function openGroupAnimated(group){
    const panel = groupPanel(group);
    if(!group || !panel){ setGroupState(group, true); return; }
    resetGroupMotion(group);
    setGroupState(group, true);
    if(prefersReducedMotion()) return;
    group.classList.add('is-ui-pattern-animating');
    panel.style.overflow = 'hidden';
    panel.style.maxHeight = '0px';
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(-4px)';
    try{ void panel.offsetHeight; }catch(_){ }
    const targetHeight = Math.max(1, panel.scrollHeight || 1);
    frame(()=>{
      panel.style.maxHeight = targetHeight + 'px';
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0)';
    });
    group._quoteDetailAccordionTimer = setTimeout(()=>{
      resetGroupMotion(group);
      setGroupState(group, true);
    }, QUOTE_DETAIL_ACCORDION_MS + 40);
  }
  function getDetailsBody(group){
    let node = group && group.parentNode;
    while(node){
      if(node.id === 'quoteSummaryDetailsBody' || (node.classList && node.classList.contains('quote-detail-modal__body'))) return node;
      node = node.parentNode;
    }
    return null;
  }
  function scrollGroupIntoDetailsBody(group, behavior){
    const body = getDetailsBody(group);
    if(!group || !body) return;
    const scrollBehavior = behavior || 'smooth';
    try{
      const directTop = Math.max(0, (group.offsetTop || 0) - 10);
      body.scrollTo({ top:directTop, behavior:scrollBehavior });
      return;
    }catch(_){ }
    try{
      const groupRect = group.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const viewportTop = bodyRect.top + 10;
      const viewportBottom = bodyRect.bottom - 16;
      const fitsViewport = groupRect.height <= Math.max(0, viewportBottom - viewportTop);
      let target = body.scrollTop;
      if(groupRect.top < viewportTop){
        target += groupRect.top - viewportTop;
      }else if(groupRect.bottom > viewportBottom){
        if(fitsViewport) target += groupRect.bottom - viewportBottom;
        else target += groupRect.top - viewportTop;
      }else if(groupRect.top > viewportTop + 2){
        target += groupRect.top - viewportTop;
      }
      body.scrollTo({ top:Math.max(0, target), behavior:scrollBehavior });
    }catch(_){
      try{ group.scrollIntoView({ block:'start', behavior:scrollBehavior }); }catch(__){ }
    }
  }
  function setGroupOpen(group, open, opts){
    const cfg = opts || {};
    if(!group) return;
    if(open){
      if(cfg.closeOthers !== false) closeSiblingGroups(group);
      openGroupAnimated(group);
    }else{
      closeGroupInstant(group);
    }
    if(open && cfg.keepScroll !== false){
      const scrollBehavior = cfg.instantScroll ? 'auto' : 'smooth';
      const runner = ()=> scrollGroupIntoDetailsBody(group, scrollBehavior);
      try{ window.requestAnimationFrame(runner); }
      catch(_){ setTimeout(runner, 0); }
    }
  }
  function renderGroup(container, title, rows, sum, options){
    const cfg = options || {};
    const box = h('section', { class:'quote-detail-group rozrys-material-accordion' + (cfg.open ? ' is-open' : ''), 'data-ui-pattern-accordion':'true' });
    const head = h('div', { class:'rozrys-material-accordion__head' });
    const button = h('button', { type:'button', class:'quote-detail-group__toggle rozrys-material-accordion__trigger', 'aria-expanded':cfg.open ? 'true' : 'false' });
    const titleBox = h('div', { class:'rozrys-material-accordion__title' });
    titleBox.appendChild(h('div', { class:'rozrys-material-accordion__title-line1', text:title }));
    const count = Array.isArray(rows) ? rows.length : 0;
    let summaryText = '';
    if(cfg.section === 'labor') summaryText = laborActionSummary(count, sum, rows);
    else{
      const metaParts = [];
      if(count) metaParts.push(`${count} ${count === 1 ? 'pozycja' : 'pozycji'}`);
      metaParts.push(money(sum));
      summaryText = metaParts.join(' • ');
    }
    titleBox.appendChild(h('div', { class:'rozrys-material-accordion__title-line2', text:summaryText }));
    button.appendChild(titleBox);
    button.appendChild(h('span', { class:'rozrys-material-accordion__chevron', 'aria-hidden':'true', html:'&#9662;' }));
    head.appendChild(button);
    box.appendChild(head);
    const panel = h('div', { class:'quote-detail-group__panel rozrys-material-accordion__body' });
    panel.hidden = !cfg.open;
    if(Array.isArray(rows) && rows.length){
      rows.sort((a,b)=> num(b && b.total) - num(a && a.total)).forEach((row)=> panel.appendChild(renderLine(row)));
    }else{
      panel.appendChild(h('div', { class:'quote-detail-empty', text:cfg.emptyText || 'Brak pozycji w tej kategorii dla tej oferty.' }));
    }
    box.appendChild(panel);
    button.addEventListener('click', (event)=>{
      event.preventDefault();
      setGroupOpen(box, !box.classList.contains('is-open'), { closeOthers:true });
    });
    container.appendChild(box);
    return box;
  }
  function renderLaborRows(container, rows){
    if(!rows.length){
      renderGroup(container, 'Brak pozycji', [], 0, { open:true, section:'labor', emptyText:'Brak pozycji w tej kategorii dla tej oferty.' });
      return;
    }
    const map = new Map();
    rows.forEach((row)=>{
      const key = laborCabinetGroupKey(row);
      if(!map.has(key)) map.set(key, { title:laborCabinetGroupTitle(row), rows:[] });
      const group = map.get(key);
      const candidateTitle = laborCabinetGroupTitle(row);
      if(candidateTitle && (!group.title || candidateTitle.length < group.title.length)) group.title = candidateTitle;
      group.rows.push(row);
    });
    Array.from(map.values()).forEach((group, index)=>{
      renderGroup(container, group.title || 'Szafka', group.rows, group.rows.reduce((sum, row)=> sum + num(row && row.total), 0), { open:index === 0, section:'labor' });
    });
  }
  function renderRows(container, rows, groupBy, section){
    const currentSection = text(section);
    if(currentSection === 'labor'){
      renderLaborRows(container, rows);
      return;
    }
    if(!rows.length){
      renderGroup(container, 'Brak pozycji', [], 0, { open:true, section:currentSection, emptyText:'Brak pozycji w tej kategorii dla tej oferty.' });
      return;
    }
    grouped(rows, groupBy || 'subsection').forEach(([group, groupRows], index)=>{
      renderGroup(container, group, groupRows, groupRows.reduce((sum, row)=> sum + num(row && row.total), 0), { open:index === 0, section:currentSection });
    });
  }
  function renderTotal(container, register){
    const lines = Array.isArray(register && register.lines) ? register.lines : [];
    const totals = register && register.totals || {};
    const grand = num(totals.grand || totals.subtotal);
    const ranking = lines.filter((row)=> num(row && row.total) > 0).sort((a,b)=> num(b.total) - num(a.total)).slice(0, 20);
    const summaryRows = [
      ['Materiały', totals.materials], ['Akcesoria', totals.accessories], ['Robocizna szafek', totals.labor], ['Robocizna / stawki wyceny', totals.quoteRates], ['Montaż AGD', totals.services], ['Rabat', -num(totals.discount)]
    ].map(([label, value])=>({ name:label, quantity:1, unit:'', unitPrice:num(value), total:num(value), calculation:'Udział działu w sumie oferty.', note:pct(Math.abs(num(value)), grand || totals.subtotal) + ' wartości oferty' }));
    renderGroup(container, 'Podział kosztów', summaryRows, grand, { open:true });
    renderGroup(container, 'Co kosztuje najwięcej', ranking.map((row, index)=> Object.assign({}, row, { name:`${index + 1}. ${row.name}` })), ranking.reduce((sum, row)=> sum + num(row && row.total), 0), { open:false, emptyText:'Brak dodatnich pozycji kosztowych.' });
  }
  function collectSectionWarnings(register, section){
    const current = text(section || 'total');
    const lines = Array.isArray(register && register.lines) ? register.lines : [];
    const out = [];
    lines.forEach((row)=>{
      if(current !== 'total' && text(row && row.section) !== current) return;
      (Array.isArray(row && row.warnings) ? row.warnings : []).forEach((msg)=>{
        if(text(msg)) out.push({ section:text(row.section), sectionLabel:text(row.sectionLabel), message:text(msg) });
      });
    });
    (Array.isArray(register && register.warnings) ? register.warnings : []).forEach((row)=>{
      const rowSection = text(row && row.section);
      if(current !== 'total' && rowSection && rowSection !== current) return;
      if(current !== 'total' && !rowSection) return;
      const label = current === 'total' && text(row && row.sectionLabel) ? text(row.sectionLabel) + ': ' : '';
      if(text(row && row.message)) out.push({ section:rowSection, sectionLabel:text(row && row.sectionLabel), message:label + text(row.message) });
    });
    const seen = new Set();
    return out.filter((row)=>{ const key = text(row.section) + '|' + text(row.message); if(!text(row.message) || seen.has(key)) return false; seen.add(key); return true; });
  }
  function renderWarnings(container, register, section){
    const warnings = collectSectionWarnings(register, section);
    if(!warnings.length) return;
    const box = h('section', { class:'quote-detail-group quote-detail-group--warnings rozrys-material-accordion', 'data-ui-pattern-accordion':'true' });
    const head = h('div', { class:'rozrys-material-accordion__head' });
    const button = h('button', { type:'button', class:'quote-detail-group__toggle rozrys-material-accordion__trigger', 'aria-expanded':'false' });
    const titleBox = h('div', { class:'rozrys-material-accordion__title' });
    titleBox.appendChild(h('div', { class:'rozrys-material-accordion__title-line1', text:'Ostrzeżenia / rzeczy do sprawdzenia' }));
    titleBox.appendChild(h('div', { class:'rozrys-material-accordion__title-line2', text:`${warnings.length} ${warnings.length === 1 ? 'pozycja' : 'pozycji'} • Sprawdź` }));
    button.appendChild(titleBox);
    button.appendChild(h('span', { class:'rozrys-material-accordion__chevron', 'aria-hidden':'true', html:'&#9662;' }));
    head.appendChild(button);
    box.appendChild(head);
    const panel = h('div', { class:'quote-detail-group__panel quote-detail-warnings__panel rozrys-material-accordion__body' });
    panel.hidden = true;
    warnings.forEach((row)=> panel.appendChild(h('div', { class:'quote-detail-warning', text:humanWarningText(row && row.message || row) })));
    box.appendChild(panel);
    button.addEventListener('click', (event)=>{
      event.preventDefault();
      setGroupOpen(box, !box.classList.contains('is-open'), { closeOthers:true });
    });
    container.appendChild(box);
  }
  function ensureModal(){
    let overlay = document.getElementById('quoteSummaryDetailsModal');
    if(overlay) return overlay;
    overlay = h('div', { id:'quoteSummaryDetailsModal', class:'modal-back quote-detail-modal-back', role:'dialog', 'aria-modal':'true', style:'display:none' });
    const modal = h('div', { class:'modal quote-detail-modal' });
    const head = h('div', { class:'header quote-detail-modal__header' });
    const titleWrap = h('div', { class:'quote-detail-modal__titleWrap' });
    titleWrap.appendChild(h('div', { id:'quoteSummaryDetailsTitle', class:'window-modal-title', text:'Szczegóły wyceny' }));
    titleWrap.appendChild(h('div', { id:'quoteSummaryDetailsSubtitle', class:'window-modal-subtitle', text:'Audyt wewnętrzny — dane ze snapshotu oferty.' }));
    const closeWrap = h('div', { class:'quote-detail-modal__closeWrap' });
    const close = h('button', { type:'button', class:'window-close-btn', 'aria-label':'Zamknij szczegóły wyceny', text:'×' });
    close.addEventListener('click', closeModal);
    closeWrap.appendChild(close);
    head.appendChild(titleWrap); head.appendChild(closeWrap);
    const body = h('div', { id:'quoteSummaryDetailsBody', class:'body quote-detail-modal__body ui-pattern-accordion-motion', 'data-ui-pattern-accordion-group':'true' });
    const foot = h('div', { class:'quote-detail-modal__footer' });
    const exit = h('button', { type:'button', class:'btn-primary', text:'Wróć' });
    exit.addEventListener('click', closeModal);
    foot.appendChild(exit);
    modal.appendChild(head); modal.appendChild(body); modal.appendChild(foot);
    overlay.appendChild(modal);
    overlay.addEventListener('click', (event)=>{ if(event.target === overlay) closeModal(); });
    document.addEventListener('keydown', (event)=>{ if(event.key === 'Escape' && overlay.style.display === 'flex') closeModal(); });
    document.body.appendChild(overlay);
    return overlay;
  }
  function closeModal(){
    const overlay = document.getElementById('quoteSummaryDetailsModal');
    if(overlay) overlay.style.display = 'none';
    try{ if(typeof unlockModalScroll === 'function') unlockModalScroll(); }catch(_){ }
  }
  function open(snapshot, section){
    const overlay = ensureModal();
    const body = document.getElementById('quoteSummaryDetailsBody');
    const title = document.getElementById('quoteSummaryDetailsTitle');
    const subtitle = document.getElementById('quoteSummaryDetailsSubtitle');
    if(!body) return;
    const register = getRegister(snapshot);
    const lines = Array.isArray(register.lines) ? register.lines : [];
    body.innerHTML = '';
    const current = text(section || 'total');
    if(title) title.textContent = current === 'labor' ? 'Szczegóły robocizny szafek' : (current === 'total' ? 'Analiza oferty' : 'Szczegóły: ' + sectionTitle(current));
    if(subtitle) subtitle.textContent = current === 'labor' ? 'Sprawdź, co zostało policzone i skąd wzięła się kwota.' : 'Audyt wewnętrzny — pozycje zapisane w rejestrze wyliczeń tej oferty.';
    renderWarnings(body, register, current);
    if(current === 'total') renderTotal(body, register);
    else renderRows(body, lines.filter((row)=> row.section === current), current === 'labor' ? 'sourceLabel' : 'subsection', current);
    body.scrollTop = 0;
    overlay.style.display = 'flex';
    // Przy pierwszym otwarciu zostawiamy body na początku modala.
    // Automatyczne przewijanie działa dopiero po kliknięciu akordeonu, żeby nie chować nagłówków sekcji.
    try{ if(typeof lockModalScroll === 'function') lockModalScroll(); }catch(_){ }
  }

  FC.wycenaSummaryDetailsModal = { open, close:closeModal, getRegister };
})();

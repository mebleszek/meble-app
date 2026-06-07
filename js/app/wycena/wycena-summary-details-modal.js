// js/app/wycena/wycena-summary-details-modal.js
// Modal audytu podsumowania WYCENY: pokazuje szczegóły każdej kwoty bez zmiany wyglądu linijek podsumowania.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function money(value){ return (Math.round(num(value) * 100) / 100).toFixed(2) + ' PLN'; }
  function pct(value, total){ const t = num(total); if(!(t > 0)) return '0%'; return (Math.round((num(value) / t) * 1000) / 10).toFixed(1).replace('.0', '') + '%'; }
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
  function renderLine(row){
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
    warnings.forEach((msg)=> item.appendChild(h('div', { class:'quote-detail-warning', text:msg })));
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
  function groupPanel(group){ return group ? group.querySelector(':scope > .quote-detail-group__panel') : null; }
  function groupTrigger(group){ return group ? group.querySelector(':scope .quote-detail-group__toggle') : null; }
  function resetGroupMotion(group){
    const panel = groupPanel(group);
    if(!group || !panel) return;
    if(group._quoteDetailAccordionTimer){
      clearTimeout(group._quoteDetailAccordionTimer);
      group._quoteDetailAccordionTimer = null;
    }
    group.classList.remove('is-quote-detail-animating');
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
    group.classList.add('is-quote-detail-animating');
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
    const box = h('section', { class:'quote-detail-group rozrys-material-accordion' + (cfg.open ? ' is-open' : '') });
    const head = h('div', { class:'quote-detail-group__head rozrys-material-accordion__head' });
    const button = h('button', { type:'button', class:'quote-detail-group__header quote-detail-group__toggle rozrys-material-accordion__trigger', 'aria-expanded':cfg.open ? 'true' : 'false' });
    const left = h('div', { class:'quote-detail-group__titleWrap rozrys-material-accordion__title' });
    left.appendChild(h('div', { class:'quote-detail-group__title rozrys-material-accordion__title-line1', text:title }));
    const count = Array.isArray(rows) ? rows.length : 0;
    if(count) left.appendChild(h('div', { class:'quote-detail-group__count', text:`${count} poz.` }));
    button.appendChild(left);
    const right = h('div', { class:'quote-detail-group__right' });
    right.appendChild(h('div', { class:'quote-detail-group__sum', text:money(sum) }));
    right.appendChild(h('span', { class:'quote-detail-group__chevron rozrys-material-accordion__chevron', 'aria-hidden':'true', html:'&#9662;' }));
    button.appendChild(right);
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
  function renderRows(container, rows, groupBy){
    if(!rows.length){
      renderGroup(container, 'Brak pozycji', [], 0, { open:true, emptyText:'Brak pozycji w tej kategorii dla tej oferty.' });
      return;
    }
    grouped(rows, groupBy || 'subsection').forEach(([group, groupRows], index)=>{
      renderGroup(container, group, groupRows, groupRows.reduce((sum, row)=> sum + num(row && row.total), 0), { open:index === 0 });
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
    const box = h('section', { class:'quote-detail-group quote-detail-group--warnings rozrys-material-accordion' });
    const head = h('div', { class:'quote-detail-group__head rozrys-material-accordion__head' });
    const button = h('button', { type:'button', class:'quote-detail-group__header quote-detail-group__toggle rozrys-material-accordion__trigger', 'aria-expanded':'false' });
    const left = h('div', { class:'quote-detail-group__titleWrap rozrys-material-accordion__title' });
    left.appendChild(h('div', { class:'quote-detail-group__title rozrys-material-accordion__title-line1', text:'Ostrzeżenia / rzeczy do sprawdzenia' }));
    left.appendChild(h('div', { class:'quote-detail-group__count', text:`${warnings.length} ${warnings.length === 1 ? 'pozycja' : 'pozycji'}` }));
    button.appendChild(left);
    const right = h('div', { class:'quote-detail-group__right' });
    right.appendChild(h('div', { class:'quote-detail-group__sum', text:'Sprawdź' }));
    right.appendChild(h('span', { class:'quote-detail-group__chevron rozrys-material-accordion__chevron', 'aria-hidden':'true', html:'&#9662;' }));
    button.appendChild(right);
    head.appendChild(button);
    box.appendChild(head);
    const panel = h('div', { class:'quote-detail-group__panel quote-detail-warnings__panel rozrys-material-accordion__body' });
    panel.hidden = true;
    warnings.forEach((row)=> panel.appendChild(h('div', { class:'quote-detail-warning', text:text(row && row.message || row) })));
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
    const body = h('div', { id:'quoteSummaryDetailsBody', class:'body quote-detail-modal__body' });
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
    if(title) title.textContent = current === 'total' ? 'Analiza oferty' : 'Szczegóły: ' + sectionTitle(current);
    if(subtitle) subtitle.textContent = 'Audyt wewnętrzny — pozycje zapisane w rejestrze wyliczeń tej oferty.';
    renderWarnings(body, register, current);
    if(current === 'total') renderTotal(body, register);
    else renderRows(body, lines.filter((row)=> row.section === current), current === 'labor' ? 'sourceLabel' : 'subsection');
    body.scrollTop = 0;
    overlay.style.display = 'flex';
    // Przy pierwszym otwarciu zostawiamy body na początku modala.
    // Automatyczne przewijanie działa dopiero po kliknięciu akordeonu, żeby nie chować nagłówków sekcji.
    try{ if(typeof lockModalScroll === 'function') lockModalScroll(); }catch(_){ }
  }

  FC.wycenaSummaryDetailsModal = { open, close:closeModal, getRegister };
})();

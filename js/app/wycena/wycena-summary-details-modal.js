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
  function renderRows(container, rows, groupBy){
    if(!rows.length){
      container.appendChild(h('div', { class:'quote-detail-empty', text:'Brak pozycji w tej kategorii dla tej oferty.' }));
      return;
    }
    grouped(rows, groupBy || 'subsection').forEach(([group, groupRows])=>{
      const box = h('section', { class:'quote-detail-group' });
      const header = h('div', { class:'quote-detail-group__header' });
      header.appendChild(h('div', { class:'quote-detail-group__title', text:group }));
      header.appendChild(h('div', { class:'quote-detail-group__sum', text:money(groupRows.reduce((sum, row)=> sum + num(row && row.total), 0)) }));
      box.appendChild(header);
      groupRows.sort((a,b)=> num(b && b.total) - num(a && a.total)).forEach((row)=> box.appendChild(renderLine(row)));
      container.appendChild(box);
    });
  }
  function renderTotal(container, register){
    const lines = Array.isArray(register && register.lines) ? register.lines : [];
    const totals = register && register.totals || {};
    const grand = num(totals.grand || totals.subtotal);
    const ranking = lines.filter((row)=> num(row && row.total) > 0).sort((a,b)=> num(b.total) - num(a.total)).slice(0, 20);
    const summary = h('section', { class:'quote-detail-group' });
    summary.appendChild(h('div', { class:'quote-detail-group__header' }, [h('div', { class:'quote-detail-group__title', text:'Podział kosztów' }), h('div', { class:'quote-detail-group__sum', text:money(grand) })]));
    [
      ['Materiały', totals.materials], ['Akcesoria', totals.accessories], ['Robocizna szafek', totals.labor], ['Robocizna / stawki wyceny', totals.quoteRates], ['Montaż AGD', totals.services], ['Rabat', -num(totals.discount)]
    ].forEach(([label, value])=>{
      const row = h('div', { class:'quote-detail-total-row' });
      row.appendChild(h('span', { text:label }));
      row.appendChild(h('strong', { text:`${money(value)} • ${pct(Math.abs(num(value)), grand || totals.subtotal)}` }));
      summary.appendChild(row);
    });
    container.appendChild(summary);
    const rank = h('section', { class:'quote-detail-group' });
    rank.appendChild(h('div', { class:'quote-detail-group__header' }, [h('div', { class:'quote-detail-group__title', text:'Co kosztuje najwięcej' }), h('div', { class:'quote-detail-group__sum', text:`${ranking.length} poz.` })]));
    if(!ranking.length) rank.appendChild(h('div', { class:'quote-detail-empty', text:'Brak dodatnich pozycji kosztowych.' }));
    ranking.forEach((row, index)=>{
      const item = renderLine(Object.assign({}, row, { name:`${index + 1}. ${row.name}` }));
      rank.appendChild(item);
    });
    container.appendChild(rank);
  }
  function renderWarnings(container, register){
    const warnings = Array.isArray(register && register.warnings) ? register.warnings : [];
    if(!warnings.length) return;
    const box = h('section', { class:'quote-detail-warnings' });
    box.appendChild(h('div', { class:'quote-detail-warnings__title', text:'Ostrzeżenia / rzeczy do sprawdzenia' }));
    warnings.forEach((row)=> box.appendChild(h('div', { class:'quote-detail-warning', text:text(row && row.message || row) })));
    container.appendChild(box);
  }
  function ensureModal(){
    let overlay = document.getElementById('quoteSummaryDetailsModal');
    if(overlay) return overlay;
    overlay = h('div', { id:'quoteSummaryDetailsModal', class:'modal-back quote-detail-modal-back', role:'dialog', 'aria-modal':'true', style:'display:none' });
    const modal = h('div', { class:'modal quote-detail-modal' });
    const head = h('div', { class:'header quote-detail-modal__header' });
    const titleWrap = h('div');
    titleWrap.appendChild(h('div', { id:'quoteSummaryDetailsTitle', class:'window-modal-title', text:'Szczegóły wyceny' }));
    titleWrap.appendChild(h('div', { id:'quoteSummaryDetailsSubtitle', class:'window-modal-subtitle', text:'Audyt wewnętrzny — dane ze snapshotu oferty.' }));
    const close = h('button', { type:'button', class:'window-close-btn', 'aria-label':'Zamknij szczegóły wyceny', text:'×' });
    close.addEventListener('click', closeModal);
    head.appendChild(titleWrap); head.appendChild(close);
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
    renderWarnings(body, register);
    if(current === 'total') renderTotal(body, register);
    else renderRows(body, lines.filter((row)=> row.section === current), current === 'labor' ? 'sourceLabel' : 'subsection');
    overlay.style.display = 'flex';
    try{ if(typeof lockModalScroll === 'function') lockModalScroll(); }catch(_){ }
  }

  FC.wycenaSummaryDetailsModal = { open, close:closeModal, getRegister };
})();

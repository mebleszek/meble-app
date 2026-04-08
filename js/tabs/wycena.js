// js/tabs/wycena.js
// Zakładka WYCENA — snapshot, PDF klienta i historia wycen w obrębie projektu.

(function(){
  'use strict';
  window.FC = window.FC || {};

  function money(v){ return `${(Number(v)||0).toFixed(2)} PLN`; }

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      Object.keys(attrs).forEach((k)=>{
        if(k === 'class') el.className = attrs[k];
        else if(k === 'text') el.textContent = attrs[k];
        else if(k === 'html') el.innerHTML = attrs[k];
        else el.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach((ch)=> el.appendChild(ch));
    return el;
  }

  function buildRowMeta(row){
    const parts = [];
    const note = String(row && row.note || '').trim();
    const rooms = String(row && row.rooms || '').trim();
    if(note) parts.push(note);
    if(rooms && (!note || rooms !== note)) parts.push(`Pomieszczenia: ${rooms}`);
    return parts.join(' • ');
  }

  function formatDateTime(value){
    const ts = Number(value) > 0 ? Number(value) : Date.parse(String(value || ''));
    if(!Number.isFinite(ts) || ts <= 0) return '—';
    try{
      const d = new Date(ts);
      const pad = (n)=> String(n).padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }catch(_){ return '—'; }
  }

  function getCurrentProjectId(){
    try{ return window.FC.projectStore && typeof window.FC.projectStore.getCurrentProjectId === 'function' ? window.FC.projectStore.getCurrentProjectId() : ''; }catch(_){ return ''; }
  }

  function getCurrentInvestorId(){
    try{ return window.FC.investors && typeof window.FC.investors.getCurrentId === 'function' ? String(window.FC.investors.getCurrentId() || '') : ''; }catch(_){ return ''; }
  }

  function getSnapshotHistory(){
    try{
      if(!(window.FC.quoteSnapshotStore && typeof window.FC.quoteSnapshotStore.listForProject === 'function')) return [];
      const projectId = String(getCurrentProjectId() || '');
      if(projectId) return window.FC.quoteSnapshotStore.listForProject(projectId);
      const investorId = String(getCurrentInvestorId() || '');
      if(investorId && typeof window.FC.quoteSnapshotStore.listForInvestor === 'function') return window.FC.quoteSnapshotStore.listForInvestor(investorId);
    }catch(_){ }
    return [];
  }

  function normalizeSnapshot(source){
    const snap = source && typeof source === 'object' ? source : null;
    if(!snap) return null;
    if(snap.lines && snap.totals) return snap;
    try{
      if(window.FC.quoteSnapshot && typeof window.FC.quoteSnapshot.buildSnapshot === 'function') return window.FC.quoteSnapshot.buildSnapshot(snap);
    }catch(_){ }
    return snap;
  }

  let lastQuote = null;
  let isBusy = false;

  function resolveDisplayedQuote(){
    if(lastQuote) return normalizeSnapshot(lastQuote);
    const history = getSnapshotHistory();
    if(history.length){
      lastQuote = history[0];
      return normalizeSnapshot(lastQuote);
    }
    return null;
  }

  function renderEmpty(card){
    card.appendChild(h('p', { class:'muted', text:'Wycena pobiera materiały z działu Materiał, liczbę arkuszy z aktualnego ROZRYS dla wybranych pomieszczeń oraz pozycje AGD z dodanych szafek.' }));
  }

  function renderSection(card, title, rows, emptyText){
    const wrap = h('section', { class:'card quote-section', style:'margin-top:12px;padding:14px;' });
    wrap.appendChild(h('h4', { text:title, style:'margin:0 0 10px' }));
    if(!rows || !rows.length){
      wrap.appendChild(h('div', { class:'muted', text:emptyText || 'Brak pozycji.' }));
      card.appendChild(wrap);
      return;
    }

    const list = h('div', { class:'quote-list' });
    const head = h('div', { class:'quote-list__head' });
    ['Pozycja','Ilość','Cena','Wartość'].forEach((label)=> head.appendChild(h('div', { class:'quote-list__cell quote-list__cell--head', text:label })));
    list.appendChild(head);

    rows.forEach((row)=>{
      const item = h('article', { class:'quote-list__item' });
      const main = h('div', { class:'quote-list__row' });
      main.appendChild(h('div', { class:'quote-list__cell quote-list__cell--name', text:row.name || 'Pozycja' }));
      main.appendChild(h('div', { class:'quote-list__cell quote-list__cell--qty', text:String(row.qty || 0) + (row.unit ? ` ${row.unit}` : '') }));
      main.appendChild(h('div', { class:'quote-list__cell quote-list__cell--price', text:money(row.unitPrice) }));
      main.appendChild(h('div', { class:'quote-list__cell quote-list__cell--total', text:money(row.total) }));
      item.appendChild(main);
      const metaText = buildRowMeta(row);
      if(metaText) item.appendChild(h('div', { class:'quote-list__meta', text:metaText }));
      list.appendChild(item);
    });

    wrap.appendChild(list);
    card.appendChild(wrap);
  }

  function renderHistory(card, ctx){
    const history = getSnapshotHistory();
    const section = h('section', { class:'card quote-section', style:'margin-top:12px;padding:14px;' });
    section.appendChild(h('h4', { text:'Historia wycen', style:'margin:0 0 10px' }));
    if(!history.length){
      section.appendChild(h('div', { class:'muted', text:'Brak zapisanych snapshotów wyceny dla tego projektu.' }));
      card.appendChild(section);
      return;
    }
    const wrap = h('div', { class:'quote-history' });
    history.slice(0, 8).forEach((snapshot, index)=>{
      const snap = normalizeSnapshot(snapshot) || {};
      const item = h('article', { class:'quote-history__item' });
      const top = h('div', { class:'quote-history__top' });
      const titleBox = h('div', { class:'quote-history__content' });
      const roomLabels = Array.isArray(snap.scope && snap.scope.roomLabels) ? snap.scope.roomLabels : [];
      titleBox.appendChild(h('div', { class:'quote-history__title', text:index === 0 ? `Ostatni snapshot — ${formatDateTime(snap.generatedAt)}` : formatDateTime(snap.generatedAt) }));
      const meta = [];
      if(roomLabels.length) meta.push(`Zakres: ${roomLabels.join(', ')}`);
      meta.push(`Razem: ${money(snap.totals && snap.totals.grand)}`);
      top.appendChild(titleBox);
      titleBox.appendChild(h('div', { class:'quote-history__meta', text:meta.join(' • ') }));
      const actions = h('div', { class:'quote-history__actions' });
      const openBtn = h('button', { class:'btn', type:'button', text:'Podgląd' });
      openBtn.addEventListener('click', ()=>{
        lastQuote = snap;
        render(ctx);
      });
      actions.appendChild(openBtn);
      const pdfBtn = h('button', { class:'btn-primary', type:'button', text:'PDF' });
      pdfBtn.addEventListener('click', ()=>{
        try{ window.FC.quotePdf && typeof window.FC.quotePdf.openQuotePdf === 'function' && window.FC.quotePdf.openQuotePdf(snap); }catch(_){ }
      });
      actions.appendChild(pdfBtn);
      top.appendChild(actions);
      item.appendChild(top);
      wrap.appendChild(item);
    });
    section.appendChild(wrap);
    card.appendChild(section);
  }

  function render(ctx){
    const list = ctx && ctx.listEl;
    if(!list) return;
    list.innerHTML = '';
    const card = h('div', { class:'build-card quote-root' });
    const head = h('div', { class:'quote-topbar' });
    head.appendChild(h('h3', { text:'Wycena', style:'margin:0' }));
    const actions = h('div', { class:'quote-topbar__actions' });
    const runBtn = h('button', { class:'btn-primary', type:'button', text: isBusy ? 'Liczę…' : 'Wyceń' });
    if(isBusy) runBtn.disabled = true;
    runBtn.addEventListener('click', async ()=>{
      if(isBusy) return;
      isBusy = true;
      render(ctx);
      try{
        if(window.FC && window.FC.wycenaCore && typeof window.FC.wycenaCore.buildQuoteSnapshot === 'function'){
          lastQuote = await window.FC.wycenaCore.buildQuoteSnapshot();
        } else if(window.FC && window.FC.wycenaCore && typeof window.FC.wycenaCore.collectQuoteData === 'function'){
          lastQuote = await window.FC.wycenaCore.collectQuoteData();
        }
      }catch(err){
        try{ console.error('[wycena] collect failed', err); }catch(_){ }
        lastQuote = { error: String(err && err.message || err || 'Błąd wyceny'), materialLines:[], accessoryLines:[], agdLines:[], totals:{ materials:0, accessories:0, services:0, grand:0 }, roomLabels:[] };
      }finally{
        isBusy = false;
        render(ctx);
      }
    });
    actions.appendChild(runBtn);

    const currentQuote = resolveDisplayedQuote();
    const pdfBtn = h('button', { class:'btn-primary', type:'button', text:'PDF' });
    if(!currentQuote || currentQuote.error) pdfBtn.disabled = true;
    pdfBtn.addEventListener('click', ()=>{
      try{ window.FC.quotePdf && typeof window.FC.quotePdf.openQuotePdf === 'function' && window.FC.quotePdf.openQuotePdf(currentQuote); }catch(_){ }
    });
    actions.appendChild(pdfBtn);
    head.appendChild(actions);
    card.appendChild(head);

    if(!currentQuote){
      renderEmpty(card);
    } else if(currentQuote.error){
      card.appendChild(h('div', { class:'muted', text:currentQuote.error, style:'margin-top:10px;color:#b42318' }));
    } else {
      const roomLabels = Array.isArray(currentQuote.roomLabels) ? currentQuote.roomLabels : (currentQuote.scope && Array.isArray(currentQuote.scope.roomLabels) ? currentQuote.scope.roomLabels : []);
      const materialLines = Array.isArray(currentQuote.materialLines) ? currentQuote.materialLines : (currentQuote.lines && Array.isArray(currentQuote.lines.materials) ? currentQuote.lines.materials : []);
      const accessoryLines = Array.isArray(currentQuote.accessoryLines) ? currentQuote.accessoryLines : (currentQuote.lines && Array.isArray(currentQuote.lines.accessories) ? currentQuote.lines.accessories : []);
      const agdLines = Array.isArray(currentQuote.agdLines) ? currentQuote.agdLines : (currentQuote.lines && Array.isArray(currentQuote.lines.agdServices) ? currentQuote.lines.agdServices : []);
      const generatedAt = currentQuote.generatedAt || currentQuote.generatedDate || null;
      if(generatedAt){
        card.appendChild(h('p', { class:'muted quote-scope', text:`Snapshot: ${formatDateTime(generatedAt)}`, style:'margin-top:8px' }));
      }
      if(Array.isArray(roomLabels) && roomLabels.length){
        card.appendChild(h('p', { class:'muted quote-scope', text:`Zakres: ${roomLabels.join(', ')}`, style:'margin-top:6px' }));
      }
      renderSection(card, 'Materiały z ROZRYS', materialLines, 'Brak pozycji materiałowych.');
      renderSection(card, 'Akcesoria', accessoryLines, 'Brak pozycji akcesoriów.');
      renderSection(card, 'Sprzęty do zabudowy / montaż AGD', agdLines, 'Brak wykrytych sprzętów do zabudowy.');
      const totals = h('div', { class:'card quote-totals', style:'margin-top:12px;padding:14px;' });
      totals.appendChild(h('h4', { text:'Podsumowanie', style:'margin:0 0 8px' }));
      [
        ['Materiały', currentQuote.totals && currentQuote.totals.materials],
        ['Akcesoria', currentQuote.totals && currentQuote.totals.accessories],
        ['Montaż AGD', currentQuote.totals && currentQuote.totals.services],
        ['Razem', currentQuote.totals && currentQuote.totals.grand],
      ].forEach(([label, value])=>{
        const row = h('div', { class:'quote-totals__row' });
        row.appendChild(h('span', { text:label }));
        row.appendChild(h('span', { text:money(value) }));
        totals.appendChild(row);
      });
      card.appendChild(totals);
    }
    renderHistory(card, ctx);
    list.appendChild(card);
  }

  (window.FC.tabsRouter || window.FC.tabs || {}).register?.('wycena', { mount(){}, render, unmount(){} });
})();

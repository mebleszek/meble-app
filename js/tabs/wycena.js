// js/tabs/wycena.js
// Zakładka WYCENA — pierwszy szkielet oparty o Materiały, ROZRYS i Cennik usług.

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

  let lastQuote = null;
  let isBusy = false;

  function renderEmpty(card){
    card.appendChild(h('p', { class:'muted', text:'Wycena pobiera materiały z działu Materiał, liczbę arkuszy z aktualnego ROZRYS dla wybranych pomieszczeń oraz pozycje AGD z dodanych szafek.' }));
  }

  function renderSection(card, title, rows, emptyText){
    const wrap = h('div', { class:'card', style:'margin-top:12px;padding:12px;' });
    wrap.appendChild(h('h4', { text:title, style:'margin:0 0 8px' }));
    if(!rows || !rows.length){
      wrap.appendChild(h('div', { class:'muted', text:emptyText || 'Brak pozycji.' }));
      card.appendChild(wrap);
      return;
    }
    const table = h('table', { class:'table-list table-list--resolved' });
    table.style.width = '100%';
    const thead = h('thead');
    const head = h('tr');
    ['Pozycja','Ilość','Cena','Wartość','Uwagi'].forEach((label)=> head.appendChild(h('th', { text:label })));
    thead.appendChild(head);
    table.appendChild(thead);
    const tbody = h('tbody');
    rows.forEach((row)=>{
      const tr = h('tr');
      tr.appendChild(h('td', { text:row.name || 'Pozycja' }));
      tr.appendChild(h('td', { text: String(row.qty || 0) + (row.unit ? ` ${row.unit}` : '') }));
      tr.appendChild(h('td', { text: money(row.unitPrice) }));
      tr.appendChild(h('td', { text: money(row.total) }));
      tr.appendChild(h('td', { text: row.note || row.rooms || '—' }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    card.appendChild(wrap);
  }

  function render(ctx){
    const list = ctx && ctx.listEl;
    if(!list) return;
    list.innerHTML = '';
    const card = h('div', { class:'build-card' });
    const head = h('div', { style:'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap' });
    head.appendChild(h('h3', { text:'Wycena', style:'margin:0' }));
    const actions = h('div', { style:'display:flex;gap:8px;align-items:center;flex-wrap:wrap' });
    const runBtn = h('button', { class:'btn-primary', type:'button', text: isBusy ? 'Liczę…' : 'Wyceń' });
    if(isBusy) runBtn.disabled = true;
    runBtn.addEventListener('click', async ()=>{
      if(isBusy) return;
      isBusy = true;
      render(ctx);
      try{
        if(window.FC && window.FC.wycenaCore && typeof window.FC.wycenaCore.collectQuoteData === 'function'){
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
    head.appendChild(actions);
    card.appendChild(head);

    if(!lastQuote){
      renderEmpty(card);
    } else if(lastQuote.error){
      card.appendChild(h('div', { class:'muted', text:lastQuote.error, style:'margin-top:10px;color:#b42318' }));
    } else {
      if(Array.isArray(lastQuote.roomLabels) && lastQuote.roomLabels.length){
        card.appendChild(h('p', { class:'muted', text:`Zakres: ${lastQuote.roomLabels.join(', ')}`, style:'margin-top:8px' }));
      }
      renderSection(card, 'Materiały z ROZRYS', lastQuote.materialLines, 'Brak pozycji materiałowych.');
      renderSection(card, 'Akcesoria', lastQuote.accessoryLines, 'Brak pozycji akcesoriów.');
      renderSection(card, 'Sprzęty do zabudowy / montaż AGD', lastQuote.agdLines, 'Brak wykrytych sprzętów do zabudowy.');
      const totals = h('div', { class:'card', style:'margin-top:12px;padding:12px;' });
      totals.appendChild(h('h4', { text:'Podsumowanie', style:'margin:0 0 8px' }));
      [
        ['Materiały', lastQuote.totals && lastQuote.totals.materials],
        ['Akcesoria', lastQuote.totals && lastQuote.totals.accessories],
        ['Montaż AGD', lastQuote.totals && lastQuote.totals.services],
        ['Razem', lastQuote.totals && lastQuote.totals.grand],
      ].forEach(([label, value])=>{
        const row = h('div', { style:'display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-weight:700' });
        row.appendChild(h('span', { text:label }));
        row.appendChild(h('span', { text:money(value) }));
        totals.appendChild(row);
      });
      card.appendChild(totals);
    }
    list.appendChild(card);
  }

  (window.FC.tabsRouter || window.FC.tabs || {}).register?.('wycena', { mount(){}, render, unmount(){} });
})();

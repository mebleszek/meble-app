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

  function buildRowMeta(row){
    const parts = [];
    const note = String(row && row.note || '').trim();
    const rooms = String(row && row.rooms || '').trim();
    if(note) parts.push(note);
    if(rooms && (!note || rooms !== note)) parts.push(`Pomieszczenia: ${rooms}`);
    return parts.join(' • ');
  }

  let lastQuote = null;
  let isBusy = false;

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
    head.appendChild(actions);
    card.appendChild(head);

    if(!lastQuote){
      renderEmpty(card);
    } else if(lastQuote.error){
      card.appendChild(h('div', { class:'muted', text:lastQuote.error, style:'margin-top:10px;color:#b42318' }));
    } else {
      const roomLabels = Array.isArray(lastQuote.roomLabels) ? lastQuote.roomLabels : (lastQuote.scope && Array.isArray(lastQuote.scope.roomLabels) ? lastQuote.scope.roomLabels : []);
      const materialLines = Array.isArray(lastQuote.materialLines) ? lastQuote.materialLines : (lastQuote.lines && Array.isArray(lastQuote.lines.materials) ? lastQuote.lines.materials : []);
      const accessoryLines = Array.isArray(lastQuote.accessoryLines) ? lastQuote.accessoryLines : (lastQuote.lines && Array.isArray(lastQuote.lines.accessories) ? lastQuote.lines.accessories : []);
      const agdLines = Array.isArray(lastQuote.agdLines) ? lastQuote.agdLines : (lastQuote.lines && Array.isArray(lastQuote.lines.agdServices) ? lastQuote.lines.agdServices : []);
      if(Array.isArray(roomLabels) && roomLabels.length){
        card.appendChild(h('p', { class:'muted quote-scope', text:`Zakres: ${roomLabels.join(', ')}`, style:'margin-top:8px' }));
      }
      renderSection(card, 'Materiały z ROZRYS', materialLines, 'Brak pozycji materiałowych.');
      renderSection(card, 'Akcesoria', accessoryLines, 'Brak pozycji akcesoriów.');
      renderSection(card, 'Sprzęty do zabudowy / montaż AGD', agdLines, 'Brak wykrytych sprzętów do zabudowy.');
      const totals = h('div', { class:'card quote-totals', style:'margin-top:12px;padding:14px;' });
      totals.appendChild(h('h4', { text:'Podsumowanie', style:'margin:0 0 8px' }));
      [
        ['Materiały', lastQuote.totals && lastQuote.totals.materials],
        ['Akcesoria', lastQuote.totals && lastQuote.totals.accessories],
        ['Montaż AGD', lastQuote.totals && lastQuote.totals.services],
        ['Razem', lastQuote.totals && lastQuote.totals.grand],
      ].forEach(([label, value])=>{
        const row = h('div', { class:'quote-totals__row' });
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

(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  // Odpowiedzialność modułu: render podglądu aktywnej/historycznej oferty WYCENY.
  // Nie trzyma stanu zakładki i nie zapisuje danych — dostaje wyłącznie zależności z tabs/wycena.js.

  function normalizeDeps(deps){
    return deps && typeof deps === 'object' ? deps : {};
  }

  function renderEmpty(card, deps){
    const d = normalizeDeps(deps);
    card.appendChild(d.h('p', { class:'muted', text:'Wycena pobiera materiały z działu Materiał, uruchamia rozkrój w tle na logice ROZRYS dla pomieszczeń i zakresu wybranych bezpośrednio tutaj oraz dolicza pozycje AGD z dodanych szafek. Dodaj także stawki wyceny i pola handlowe, aby wygenerować ofertę dla klienta.' }));
  }

  function renderSection(card, title, rows, emptyText, deps){
    const d = normalizeDeps(deps);
    const h = d.h;
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
      main.appendChild(h('div', { class:'quote-list__cell quote-list__cell--price', text:d.money(row.unitPrice) }));
      main.appendChild(h('div', { class:'quote-list__cell quote-list__cell--total', text:d.money(row.total) }));
      item.appendChild(main);
      const metaText = d.buildRowMeta(row);
      if(metaText) item.appendChild(h('div', { class:'quote-list__meta', text:metaText }));
      list.appendChild(item);
    });

    wrap.appendChild(list);
    card.appendChild(wrap);
  }

  function renderCommercialSection(card, snapshot, ctx, deps){
    const d = normalizeDeps(deps);
    const h = d.h;
    const commercial = snapshot && snapshot.commercial || {};
    const totals = snapshot && snapshot.totals || {};
    const section = h('section', { class:'card quote-section', style:'margin-top:12px;padding:14px;' });
    section.appendChild(h('h4', { text:'Warunki oferty', style:'margin:0 0 10px' }));
    const list = h('div', { class:'quote-commercial-list' });
    const addRow = (label, value, strong)=>{
      const text = String(value || '').trim();
      if(!text) return;
      const row = h('div', { class:'quote-commercial-list__row' });
      row.appendChild(h('div', { class:'quote-commercial-list__label', text:label }));
      row.appendChild(h('div', { class:`quote-commercial-list__value${strong ? ' is-strong' : ''}`, text }));
      list.appendChild(row);
    };
    addRow('Wersja oferty', commercial.versionName);
    addRow('Typ oferty', commercial.preliminary ? 'Wstępna wycena (bez pomiaru)' : 'Wycena');
    addRow('Zakres elementów', d.getMaterialScopeLabel(snapshot));
    if(Number(commercial.discountPercent) > 0) addRow('Rabat', `${Number(commercial.discountPercent).toFixed(2)}%`, true);
    else if(Number(commercial.discountAmount) > 0) addRow('Rabat', d.money(commercial.discountAmount), true);
    addRow('Ważność oferty', commercial.offerValidity);
    addRow('Termin realizacji', commercial.leadTime);
    addRow('Warunki montażu / transportu', commercial.deliveryTerms);
    addRow('Notatka dla klienta', commercial.customerNote);
    if(!list.childNodes.length) list.appendChild(h('div', { class:'muted', text:'Brak dodatkowych pól handlowych dla tej wersji oferty.' }));
    section.appendChild(list);
    const totalsCard = h('div', { class:'card quote-totals', style:'margin-top:12px;padding:14px;' });
    totalsCard.appendChild(h('h4', { text:'Podsumowanie', style:'margin:0 0 8px' }));
    [
      ['Materiały', totals.materials],
      ['Akcesoria', totals.accessories],
      ['Robocizna / stawki wyceny', totals.quoteRates],
      ['Montaż AGD', totals.services],
      ['Suma przed rabatem', totals.subtotal],
      ['Rabat', totals.discount],
      ['Razem', totals.grand],
    ].forEach(([label, value], index, arr)=>{
      const row = h('div', { class:`quote-totals__row${index === arr.length - 1 ? ' quote-totals__row--grand' : ''}` });
      row.appendChild(h('span', { text:label }));
      row.appendChild(h('span', { text:d.money(value) }));
      totalsCard.appendChild(row);
    });
    if(d.canAcceptSnapshot(snapshot)){
      const previewActions = h('div', { class:'quote-preview-actions' });
      const acceptBtn = h('button', { class:'btn-success', type:'button', text:'Zaakceptuj ofertę' });
      acceptBtn.addEventListener('click', ()=> {
        void d.acceptSnapshot(snapshot, ctx, { rememberScroll:true, anchorId:'quotePreviewStart', fallbackAnchorId:'quoteActivePreview' });
      });
      previewActions.appendChild(acceptBtn);
      totalsCard.appendChild(previewActions);
    }
    card.appendChild(section);
    card.appendChild(totalsCard);
  }

  function getScopeRoomLabels(currentQuote){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getScopeRoomLabels === 'function') return FC.quoteSnapshotStore.getScopeRoomLabels(currentQuote);
    }catch(_){ }
    return Array.isArray(currentQuote && currentQuote.roomLabels) ? currentQuote.roomLabels : (currentQuote && currentQuote.scope && Array.isArray(currentQuote.scope.roomLabels) ? currentQuote.scope.roomLabels : []);
  }

  function renderPreview(card, currentQuote, ctx, deps){
    const d = normalizeDeps(deps);
    const h = d.h;
    if(!currentQuote){
      renderEmpty(card, d);
      return;
    }
    if(currentQuote.error){
      card.appendChild(h('div', { class:'muted', text:currentQuote.error, style:'margin-top:10px;color:#b42318' }));
      return;
    }

    const roomLabels = getScopeRoomLabels(currentQuote);
    const lines = currentQuote.lines || {};
    const materialLines = Array.isArray(currentQuote.materialLines) ? currentQuote.materialLines : (Array.isArray(lines.materials) ? lines.materials : []);
    const accessoryLines = Array.isArray(currentQuote.accessoryLines) ? currentQuote.accessoryLines : (Array.isArray(lines.accessories) ? lines.accessories : []);
    const agdLines = Array.isArray(currentQuote.agdLines) ? currentQuote.agdLines : (Array.isArray(lines.agdServices) ? lines.agdServices : []);
    const quoteRateLines = Array.isArray(currentQuote.quoteRateLines) ? currentQuote.quoteRateLines : (Array.isArray(lines.quoteRates) ? lines.quoteRates : []);
    const generatedAt = currentQuote.generatedAt || currentQuote.generatedDate || null;
    if(generatedAt){
      card.appendChild(h('div', { id:'quotePreviewStart' }));
      const isLatest = d.getSnapshotId(currentQuote) === d.getSnapshotId(d.getSnapshotHistory()[0]);
      const previewMeta = h('div', { class:'quote-preview-meta' });
      previewMeta.appendChild(h('span', { class:`quote-preview-badge${isLatest ? ' is-latest' : ''}`, text:isLatest ? 'Aktualna wersja oferty' : 'Wersja oferty z historii' }));
      if(d.isPreliminarySnapshot(currentQuote)) previewMeta.appendChild(h('span', { class:'quote-preview-badge quote-preview-badge--preliminary', text:'Wstępna wycena' }));
      if(d.isSelectedSnapshot(currentQuote)) previewMeta.appendChild(h('span', { class:'quote-preview-badge quote-preview-badge--selected', text:'Zaakceptowana' }));
      if(d.getVersionName(currentQuote)) previewMeta.appendChild(h('span', { class:'quote-preview-badge quote-preview-badge--version', text:d.getVersionName(currentQuote) }));
      previewMeta.appendChild(h('p', { class:'muted quote-scope', text:`Wersja oferty: ${d.formatDateTime(generatedAt)}` }));
      card.appendChild(previewMeta);
    }
    if(Array.isArray(roomLabels) && roomLabels.length){
      card.appendChild(h('p', { class:'muted quote-scope', text:`Pomieszczenia: ${roomLabels.join(', ')}`, style:'margin-top:6px' }));
    }
    card.appendChild(h('p', { class:'muted quote-scope', text:`Zakres elementów: ${d.getMaterialScopeLabel(currentQuote)}`, style:'margin-top:6px' }));
    renderSection(card, 'Materiały z ROZRYS', materialLines, 'Brak pozycji materiałowych.', d);
    renderSection(card, 'Akcesoria', accessoryLines, 'Brak pozycji akcesoriów.', d);
    renderSection(card, 'Robocizna / stawki wyceny mebli', quoteRateLines, 'Brak pozycji robocizny.', d);
    renderSection(card, 'Sprzęty do zabudowy / montaż AGD', agdLines, 'Brak wykrytych sprzętów do zabudowy.', d);
    renderCommercialSection(card, currentQuote, ctx, d);
  }

  FC.wycenaTabPreview = {
    renderPreview,
    renderEmpty,
    renderSection,
    renderCommercialSection,
  };
})();

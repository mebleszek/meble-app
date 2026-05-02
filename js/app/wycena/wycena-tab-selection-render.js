(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const model = FC.wycenaTabSelectionModel || {};
  const normalizeDraftSelection = typeof model.normalizeDraftSelection === 'function'
    ? model.normalizeDraftSelection
    : (()=> ({ selectedRooms:[], materialScope:{ kind:'all', material:'', includeFronts:true, includeCorpus:true } }));
  const buildSelectionSummary = typeof model.buildSelectionSummary === 'function'
    ? model.buildSelectionSummary
    : (()=> ({ roomsMeta:{ title:'Brak pomieszczeń', subtitle:'' }, scopeMeta:{ title:'Zakres wyceny', subtitle:'Fronty + korpusy', detail:'Wybór jak w ROZRYS' }, roomsText:'Brak pomieszczeń', scopeText:'Fronty + korpusy' }));

  function renderQuoteSelectionSection(card, ctx, deps){
    const h = deps && typeof deps.h === 'function' ? deps.h : null;
    const labelWithInfo = deps && typeof deps.labelWithInfo === 'function' ? deps.labelWithInfo : null;
    const openRooms = deps && typeof deps.openQuoteRoomsPicker === 'function' ? deps.openQuoteRoomsPicker : null;
    const openScope = deps && typeof deps.openQuoteScopePicker === 'function' ? deps.openQuoteScopePicker : null;
    const getOfferDraft = deps && typeof deps.getOfferDraft === 'function' ? deps.getOfferDraft : ()=> ({});
    const getMaterialScopeLabel = deps && typeof deps.getMaterialScopeLabel === 'function' ? deps.getMaterialScopeLabel : (()=> 'Fronty + korpusy');
    if(typeof h !== 'function' || typeof labelWithInfo !== 'function') return;
    const selection = normalizeDraftSelection(getOfferDraft());
    const summary = buildSelectionSummary(selection, { getMaterialScopeLabel });
    const section = h('section', { class:'card quote-selection-card panel-box--rozrys', style:'margin-top:12px;padding:14px;' });
    const grid = h('div', { class:'quote-selection-grid rozrys-selection-grid' });

    const roomsField = h('div', { class:'quote-selection-field rozrys-field rozrys-selection-grid__rooms' });
    roomsField.appendChild(labelWithInfo('Pomieszczenia do wyceny', 'Pomieszczenia do wyceny', 'Wybierz pomieszczenia bez wchodzenia do ROZRYS. Kliknięcie „Wyceń” uruchomi rozkrój w tle dokładnie dla tego zakresu.'));
    const roomsBtn = h('button', { type:'button', class:'btn rozrys-picker-launch rozrys-picker-launch--rooms quote-selection-launch--rooms' });
    const roomsValue = h('div', { class:'rozrys-picker-launch__value' });
    roomsValue.appendChild(h('div', { class:'rozrys-picker-launch__title', text:String(summary.roomsMeta && summary.roomsMeta.title || summary.roomsText) }));
    if(summary.roomsMeta && summary.roomsMeta.subtitle) roomsValue.appendChild(h('div', { class:'rozrys-picker-launch__subtitle', text:String(summary.roomsMeta.subtitle || '') }));
    roomsBtn.appendChild(roomsValue);
    roomsBtn.addEventListener('click', ()=> { if(typeof openRooms === 'function') openRooms(ctx); });
    roomsField.appendChild(roomsBtn);
    grid.appendChild(roomsField);

    const scopeField = h('div', { class:'quote-selection-field rozrys-field rozrys-selection-grid__material' });
    scopeField.appendChild(labelWithInfo('Zakres elementów do wyceny', 'Zakres elementów do wyceny', 'Zakres działa jak w ROZRYS: możesz liczyć korpusy i fronty razem albo tylko jedną z tych grup.'));
    const scopeBtn = h('button', { type:'button', class:'btn rozrys-picker-launch rozrys-picker-launch--material quote-selection-launch--scope' });
    const scopeValue = h('div', { class:'rozrys-picker-launch__value' });
    scopeValue.appendChild(h('div', { class:'rozrys-picker-launch__title', text:String(summary.scopeMeta && summary.scopeMeta.title || summary.scopeText) }));
    if(summary.scopeMeta && summary.scopeMeta.subtitle) scopeValue.appendChild(h('div', { class:'rozrys-picker-launch__subtitle', text:String(summary.scopeMeta.subtitle || '') }));
    if(summary.scopeMeta && summary.scopeMeta.detail) scopeValue.appendChild(h('div', { class:'rozrys-picker-launch__detail', text:String(summary.scopeMeta.detail || '') }));
    scopeBtn.appendChild(scopeValue);
    scopeBtn.addEventListener('click', ()=> { if(typeof openScope === 'function') openScope(ctx); });
    scopeField.appendChild(scopeBtn);
    grid.appendChild(scopeField);
    section.appendChild(grid);

    const info = h('div', { class:'quote-scope-info' });
    info.appendChild(h('div', { class:'quote-scope-info__title', text:'Zakres bieżącej wyceny' }));
    info.appendChild(h('div', { class:'quote-scope-info__body', text:`Pomieszczenia: ${summary.roomsText}
Zakres: ${getMaterialScopeLabel(selection)}
Kliknięcie „Wyceń” użyje logiki ROZRYS w tle dla tego wyboru.` }));
    section.appendChild(info);
    card.appendChild(section);
  }

  FC.wycenaTabSelectionRender = {
    renderQuoteSelectionSection,
  };
})();

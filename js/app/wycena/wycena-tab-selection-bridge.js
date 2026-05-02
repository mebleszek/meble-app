(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  // Odpowiedzialność modułu: cienki adapter między zakładką WYCENA a modułami wyboru zakresu.

  function getFn(deps, name, fallback){
    return deps && typeof deps[name] === 'function' ? deps[name] : fallback;
  }

  function defaultVersionName(preliminary, options){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.defaultVersionName === 'function'){
      try{ return FC.wycenaTabSelection.defaultVersionName(preliminary, options); }catch(_){ }
    }
    return preliminary ? 'Wstępna oferta' : 'Oferta';
  }

  function buildSelectionScopeSummary(selection, deps){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.buildSelectionScopeSummary === 'function'){
      try{ return FC.wycenaTabSelection.buildSelectionScopeSummary(selection); }catch(_){ }
    }
    const normalizeRoomIds = getFn(deps, 'normalizeRoomIds', (items)=> Array.isArray(items) ? Array.from(new Set(items.map((item)=> String(item || '').trim()).filter(Boolean))) : []);
    const selectedRooms = normalizeRoomIds(selection && selection.selectedRooms);
    return { roomIds:selectedRooms, roomLabels:selectedRooms.slice(), scopeLabel:selectedRooms.join(', ') || 'wybrany zakres', isMultiRoom:selectedRooms.length > 1 };
  }

  function shouldPromptForVersionNameOnGenerate(selection, draft, deps){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.shouldPromptForVersionNameOnGenerate === 'function'){
      try{ return !!FC.wycenaTabSelection.shouldPromptForVersionNameOnGenerate(selection, draft, { getCurrentProjectId:getFn(deps, 'getCurrentProjectId', ()=> '') }); }catch(_){ }
    }
    return false;
  }

  async function ensureVersionNameBeforeGenerate(selection, deps){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.ensureVersionNameBeforeGenerate === 'function'){
      try{
        return await FC.wycenaTabSelection.ensureVersionNameBeforeGenerate(selection, {
          getOfferDraft:getFn(deps, 'getOfferDraft', ()=> ({ rateSelections:[], commercial:{} })),
          patchOfferDraft:getFn(deps, 'patchOfferDraft', ()=> null),
          getCurrentProjectId:getFn(deps, 'getCurrentProjectId', ()=> ''),
        });
      }catch(_){ }
    }
    return { cancelled:false, versionName:defaultVersionName(false, { selection }) };
  }

  function getVersionName(snapshot, deps){
    const normalizeSnapshot = getFn(deps, 'normalizeSnapshot', (source)=> source || null);
    const isPreliminarySnapshot = getFn(deps, 'isPreliminarySnapshot', ()=> false);
    const snap = normalizeSnapshot(snapshot) || {};
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getEffectiveVersionName === 'function'){
        const effective = String(FC.quoteSnapshotStore.getEffectiveVersionName(snap) || '').trim();
        if(effective) return effective;
      }
    }catch(_){ }
    return String(snap && snap.commercial && snap.commercial.versionName || snap && snap.meta && snap.meta.versionName || '').trim()
      || defaultVersionName(isPreliminarySnapshot(snap), snap && snap.scope ? { scope:snap.scope } : {});
  }

  function normalizeDraftSelection(draft){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.normalizeDraftSelection === 'function'){
      try{ return FC.wycenaTabSelection.normalizeDraftSelection(draft); }catch(_){ }
    }
    return { selectedRooms:[], materialScope:{ kind:'all', material:'', includeFronts:true, includeCorpus:true } };
  }

  function getRoomLabelsFromSelection(selection){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.getRoomLabelsFromSelection === 'function'){
      try{ return FC.wycenaTabSelection.getRoomLabelsFromSelection(selection); }catch(_){ }
    }
    return [];
  }

  function getRoomsPickerMeta(selection){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.getRoomsPickerMeta === 'function'){
      try{ return FC.wycenaTabSelection.getRoomsPickerMeta(selection); }catch(_){ }
    }
    return { title:'Brak pomieszczeń', subtitle:'' };
  }

  function getScopePickerMeta(selection, deps){
    const getMaterialScopeLabel = getFn(deps, 'getMaterialScopeLabel', ()=> 'Korpusy + fronty');
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.getScopePickerMeta === 'function'){
      try{ return FC.wycenaTabSelection.getScopePickerMeta(selection, { getMaterialScopeLabel }); }catch(_){ }
    }
    return { title:'Zakres wyceny', subtitle:getMaterialScopeLabel(selection), detail:'Wybór jak w ROZRYS' };
  }

  function buildSelectionSummary(selection, deps){
    const getMaterialScopeLabel = getFn(deps, 'getMaterialScopeLabel', ()=> 'Korpusy + fronty');
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.buildSelectionSummary === 'function'){
      try{ return FC.wycenaTabSelection.buildSelectionSummary(selection, { getMaterialScopeLabel }); }catch(_){ }
    }
    return {
      roomLabels:[],
      roomsMeta:{ title:'Brak pomieszczeń', subtitle:'' },
      scopeMeta:getScopePickerMeta(selection, { getMaterialScopeLabel }),
      roomsText:'Brak pomieszczeń',
      scopeText:getMaterialScopeLabel(selection),
    };
  }

  function openQuoteRoomsPicker(ctx, deps){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.openQuoteRoomsPicker === 'function'){
      try{
        return FC.wycenaTabSelection.openQuoteRoomsPicker(ctx, {
          getOfferDraft:getFn(deps, 'getOfferDraft', ()=> ({ rateSelections:[], commercial:{} })),
          patchOfferDraft:getFn(deps, 'patchOfferDraft', ()=> null),
          render:getFn(deps, 'render', ()=> {}),
          askConfirm:getFn(deps, 'askConfirm', async()=> true),
        });
      }catch(_){ }
    }
  }

  function openQuoteScopePicker(ctx, deps){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.openQuoteScopePicker === 'function'){
      try{
        return FC.wycenaTabSelection.openQuoteScopePicker(ctx, {
          getOfferDraft:getFn(deps, 'getOfferDraft', ()=> ({ rateSelections:[], commercial:{} })),
          patchOfferDraft:getFn(deps, 'patchOfferDraft', ()=> null),
          render:getFn(deps, 'render', ()=> {}),
          askConfirm:getFn(deps, 'askConfirm', async()=> true),
          h:getFn(deps, 'h'),
        });
      }catch(_){ }
    }
  }

  function renderQuoteSelectionSection(card, ctx, deps){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.renderQuoteSelectionSection === 'function'){
      try{
        return FC.wycenaTabSelection.renderQuoteSelectionSection(card, ctx, {
          h:getFn(deps, 'h'),
          labelWithInfo:getFn(deps, 'labelWithInfo'),
          openQuoteRoomsPicker:getFn(deps, 'openQuoteRoomsPicker', (nextCtx)=> openQuoteRoomsPicker(nextCtx, deps)),
          openQuoteScopePicker:getFn(deps, 'openQuoteScopePicker', (nextCtx)=> openQuoteScopePicker(nextCtx, deps)),
          getOfferDraft:getFn(deps, 'getOfferDraft', ()=> ({ rateSelections:[], commercial:{} })),
          getMaterialScopeLabel:getFn(deps, 'getMaterialScopeLabel', ()=> 'Korpusy + fronty'),
        });
      }catch(_){ }
    }
  }

  FC.wycenaTabSelectionBridge = Object.assign({}, FC.wycenaTabSelectionBridge || {}, {
    defaultVersionName,
    buildSelectionScopeSummary,
    shouldPromptForVersionNameOnGenerate,
    ensureVersionNameBeforeGenerate,
    getVersionName,
    normalizeDraftSelection,
    getRoomLabelsFromSelection,
    getRoomsPickerMeta,
    getScopePickerMeta,
    buildSelectionSummary,
    openQuoteRoomsPicker,
    openQuoteScopePicker,
    renderQuoteSelectionSection,
  });
})();

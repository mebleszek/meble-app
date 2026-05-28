(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  // Odpowiedzialność modułu: cienki adapter zakładki WYCENA do edytora oferty.

  function getFn(deps, name, fallback){
    return deps && typeof deps[name] === 'function' ? deps[name] : fallback;
  }

  function buildOfferSummary(draft, deps){
    if(FC.wycenaTabEditor && typeof FC.wycenaTabEditor.buildOfferSummary === 'function'){
      try{
        return FC.wycenaTabEditor.buildOfferSummary(draft, {
          money:getFn(deps, 'money'),
          num:getFn(deps, 'num'),
          normalizeDraftSelection:getFn(deps, 'normalizeDraftSelection'),
          buildSelectionSummary:getFn(deps, 'buildSelectionSummary'),
        });
      }catch(_){ }
    }
    return 'Brak dodatkowych ustawień oferty';
  }

  function buildSelectionMap(draft, deps){
    if(FC.wycenaTabEditor && typeof FC.wycenaTabEditor.buildSelectionMap === 'function'){
      try{ return FC.wycenaTabEditor.buildSelectionMap(draft, { num:getFn(deps, 'num') }); }catch(_){ }
    }
    return Object.create(null);
  }

  function saveRateSelectionRows(selections, deps){
    if(FC.wycenaTabEditor && typeof FC.wycenaTabEditor.saveRateSelectionRows === 'function'){
      try{ return FC.wycenaTabEditor.saveRateSelectionRows(selections, { patchOfferDraft:getFn(deps, 'patchOfferDraft', ()=> null), num:getFn(deps, 'num') }); }catch(_){ }
    }
    return null;
  }

  function buildField(labelText, inputNode, full, deps){
    if(FC.wycenaTabEditor && typeof FC.wycenaTabEditor.buildField === 'function'){
      try{ return FC.wycenaTabEditor.buildField(labelText, inputNode, full, { h:getFn(deps, 'h') }); }catch(_){ }
    }
    return null;
  }

  function makeRateSelectionRows(catalog, selectionMap, deps){
    if(FC.wycenaTabEditor && typeof FC.wycenaTabEditor.makeRateSelectionRows === 'function'){
      try{ return FC.wycenaTabEditor.makeRateSelectionRows(catalog, selectionMap, { num:getFn(deps, 'num') }); }catch(_){ }
    }
    return [];
  }

  function renderPreliminaryToggle(card, ctx, deps){
    if(FC.wycenaTabEditor && typeof FC.wycenaTabEditor.renderPreliminaryToggle === 'function'){
      try{
        return FC.wycenaTabEditor.renderPreliminaryToggle(card, ctx, {
          h:getFn(deps, 'h'),
          getOfferDraft:getFn(deps, 'getOfferDraft', ()=> ({ rateSelections:[], commercial:{} })),
          patchOfferDraft:getFn(deps, 'patchOfferDraft', ()=> null),
          normalizeDraftSelection:getFn(deps, 'normalizeDraftSelection'),
          defaultVersionName:getFn(deps, 'defaultVersionName'),
          render:getFn(deps, 'render', ()=> {}),
        });
      }catch(_){ }
    }
  }

  function renderOfferEditor(card, ctx, deps){
    if(FC.wycenaTabEditor && typeof FC.wycenaTabEditor.renderOfferEditor === 'function'){
      try{
        return FC.wycenaTabEditor.renderOfferEditor(card, ctx, {
          h:getFn(deps, 'h'),
          getOfferDraft:getFn(deps, 'getOfferDraft', ()=> ({ rateSelections:[], commercial:{} })),
          patchOfferDraft:getFn(deps, 'patchOfferDraft', ()=> null),
          normalizeDraftSelection:getFn(deps, 'normalizeDraftSelection'),
          defaultVersionName:getFn(deps, 'defaultVersionName'),
          buildOfferSummary:getFn(deps, 'buildOfferSummary', (draft)=> buildOfferSummary(draft, deps)),
          buildSelectionMap:getFn(deps, 'buildSelectionMap', (draft)=> buildSelectionMap(draft, deps)),
          saveRateSelectionRows:getFn(deps, 'saveRateSelectionRows', (rows)=> saveRateSelectionRows(rows, deps)),
          buildField:getFn(deps, 'buildField', (label, inputNode, full)=> buildField(label, inputNode, full, deps)),
          makeRateSelectionRows:getFn(deps, 'makeRateSelectionRows', (catalog, selectionMap)=> makeRateSelectionRows(catalog, selectionMap, deps)),
          money:getFn(deps, 'money'),
          num:getFn(deps, 'num'),
          render:getFn(deps, 'render', ()=> {}),
          getIsOpen:getFn(deps, 'getIsOpen', ()=> false),
          setIsOpen:getFn(deps, 'setIsOpen', ()=> {}),
        });
      }catch(_){ }
    }
  }

  FC.wycenaTabEditorBridge = Object.assign({}, FC.wycenaTabEditorBridge || {}, {
    buildOfferSummary,
    buildSelectionMap,
    saveRateSelectionRows,
    buildField,
    makeRateSelectionRows,
    renderPreliminaryToggle,
    renderOfferEditor,
  });
})();

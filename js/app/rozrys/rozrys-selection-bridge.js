(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createNoopController(){
    return {
      updateRoomsPickerButton(){},
      updateMaterialPickerButton(){},
      persistSelectionPrefs(){},
      syncHiddenSelections(){},
      refreshSelectionState(){},
      buildScopeDraftControls(){},
      openRoomsPicker(){},
      openMaterialPicker(){},
    };
  }

  function createController(ctx, deps){
    const cfg = Object.assign({
      getRooms:null,
      savePanelPrefs:null,
      loadPanelPrefs:null,
      encodeRoomsSelection:null,
      encodeMaterialScope:null,
      normalizeMaterialScopeForAggregate:null,
      aggregatePartsForProject:null,
      askRozrysConfirm:null,
      normalizeRoomSelection:null,
      roomLabel:null,
      splitMaterialAccordionTitle:null,
      makeMaterialScope:null,
    }, deps || {});

    const getScopeSummary = function(scope, aggregate){
      if(FC.rozrysScope && typeof FC.rozrysScope.getScopeSummary === 'function'){
        return FC.rozrysScope.getScopeSummary(scope, aggregate, {
          splitMaterialAccordionTitle: cfg.splitMaterialAccordionTitle,
          aggregatePartsForProject: cfg.aggregatePartsForProject,
        });
      }
      return { title:'Wszystkie materiały', subtitle:'', detail:'' };
    };

    const getRoomsSummary = function(rooms){
      if(FC.rozrysScope && typeof FC.rozrysScope.getRoomsSummary === 'function'){
        return FC.rozrysScope.getRoomsSummary(rooms, { getRooms: cfg.getRooms });
      }
      return { title:'Pomieszczenia', subtitle:'' };
    };

    if(!(FC.rozrysSelectionUi && typeof FC.rozrysSelectionUi.createController === 'function')){
      return createNoopController();
    }

    return FC.rozrysSelectionUi.createController(ctx, {
      getScopeSummary,
      getRoomsSummary,
      savePanelPrefs: cfg.savePanelPrefs,
      loadPanelPrefs: cfg.loadPanelPrefs,
      encodeRoomsSelection: cfg.encodeRoomsSelection,
      encodeMaterialScope: cfg.encodeMaterialScope,
      normalizeMaterialScopeForAggregate: cfg.normalizeMaterialScopeForAggregate,
      aggregatePartsForProject: cfg.aggregatePartsForProject,
      askRozrysConfirm: cfg.askRozrysConfirm,
      normalizeRoomSelection: cfg.normalizeRoomSelection,
      roomLabel: cfg.roomLabel,
      splitMaterialAccordionTitle: cfg.splitMaterialAccordionTitle,
      makeMaterialScope: cfg.makeMaterialScope,
    });
  }

  FC.rozrysSelectionBridge = {
    createApi(){
      return { createController };
    }
  };
})();

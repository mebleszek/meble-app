(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createController(ctx, deps){
    const cfg = Object.assign({
      getScopeSummary:null,
      getRoomsSummary:null,
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
    const api = {};

    api.updateRoomsPickerButton = function(){
      const meta = cfg.getRoomsSummary(ctx.getSelectedRooms());
      ctx.roomsPickerValue.innerHTML = '';
      ctx.roomsPickerValue.appendChild(ctx.h('div', { class:'rozrys-picker-launch__title', text:meta.title }));
      if(meta.subtitle) ctx.roomsPickerValue.appendChild(ctx.h('div', { class:'rozrys-picker-launch__subtitle', text:meta.subtitle }));
    };

    api.updateMaterialPickerButton = function(){
      const meta = cfg.getScopeSummary(ctx.getMaterialScope(), ctx.getAggregate());
      ctx.matPickerValue.innerHTML = '';
      ctx.matPickerValue.appendChild(ctx.h('div', { class:'rozrys-picker-launch__title', text:meta.title }));
      if(meta.subtitle) ctx.matPickerValue.appendChild(ctx.h('div', { class:'rozrys-picker-launch__subtitle', text:meta.subtitle }));
      if(meta.detail) ctx.matPickerValue.appendChild(ctx.h('div', { class:'rozrys-picker-launch__detail', text:meta.detail }));
    };

    api.persistSelectionPrefs = function(){
      cfg.savePanelPrefs(Object.assign({}, cfg.loadPanelPrefs(), {
        selectedRooms: cfg.encodeRoomsSelection(ctx.getSelectedRooms()),
        materialScope: cfg.encodeMaterialScope(ctx.getMaterialScope()),
      }));
    };

    api.syncHiddenSelections = function(){
      ctx.roomsSel.value = cfg.encodeRoomsSelection(ctx.getSelectedRooms());
      ctx.matSel.value = cfg.encodeMaterialScope(ctx.getMaterialScope());
      const aggregate = ctx.getAggregate();
      const scope = ctx.getMaterialScope();
      const material = (scope.kind === 'material' && scope.material) ? scope.material : ((aggregate.materials && aggregate.materials[0]) || '');
      ctx.state.material = material;
      try{
        if(ctx.rozState){
          ctx.rozState.setSelectedRooms(ctx.getSelectedRooms());
          ctx.rozState.setAggregate(aggregate);
          ctx.rozState.setMaterialScope(scope);
          ctx.rozState.patchOptionState({ material });
        }
      }catch(_){ }
    };

    api.refreshSelectionState = function(opts){
      const local = Object.assign({ keepFormatHint:true, rerender:true }, opts || {});
      ctx.setAggregate(cfg.aggregatePartsForProject(ctx.getSelectedRooms()));
      ctx.setMaterialScope(cfg.normalizeMaterialScopeForAggregate(ctx.getMaterialScope(), ctx.getAggregate()));
      api.syncHiddenSelections();
      api.updateRoomsPickerButton();
      api.updateMaterialPickerButton();
      api.persistSelectionPrefs();
      if(local.rerender && typeof ctx.tryAutoRenderFromCache === 'function') ctx.tryAutoRenderFromCache();
    };

    api.buildScopeDraftControls = function(holder, draftScope, hasFronts, hasCorpus, opts){
      const local = Object.assign({ allowEmpty:false, onChange:null }, opts || {});
      const chips = ctx.h('div', { class:'rozrys-scope-chips' });
      const notify = ()=>{ try{ if(typeof local.onChange === 'function') local.onChange(); }catch(_){ } };
      const bindChip = (label, key, enabled)=>{
        if(!enabled) return null;
        const chip = ctx.h('label', { class:'rozrys-scope-chip' });
        const cb = ctx.h('input', { type:'checkbox' });
        const syncChipState = ()=> chip.classList.toggle('is-checked', !!cb.checked);
        cb.checked = !!draftScope[key];
        syncChipState();
        cb.addEventListener('change', ()=>{
          draftScope[key] = !!cb.checked;
          if(!local.allowEmpty && !draftScope.includeFronts && !draftScope.includeCorpus){
            draftScope[key] = true;
            cb.checked = true;
          }
          syncChipState();
          notify();
        });
        chip.appendChild(cb);
        chip.appendChild(ctx.h('span', { text:label }));
        chips.appendChild(chip);
        return chip;
      };
      if(hasFronts && hasCorpus){
        bindChip('Fronty', 'includeFronts', true);
        bindChip('Korpusy', 'includeCorpus', true);
      }else if(hasFronts || hasCorpus){
        if(hasFronts){
          draftScope.includeCorpus = false;
          bindChip('Fronty', 'includeFronts', true);
        }
        if(hasCorpus){
          draftScope.includeFronts = false;
          bindChip('Korpusy', 'includeCorpus', true);
        }
      }
      holder.appendChild(chips);
    };

    api.openRoomsPicker = function(){
      if(!(FC.rozrysPickers && typeof FC.rozrysPickers.openRoomsPicker === 'function')) return;
      return FC.rozrysPickers.openRoomsPicker({
        getSelectedRooms: ()=> ctx.getSelectedRooms(),
        setSelectedRooms: (rooms)=>{
          ctx.setSelectedRooms(Array.isArray(rooms) ? rooms.slice() : []);
          try{ if(ctx.rozState) ctx.rozState.setSelectedRooms(ctx.getSelectedRooms()); }catch(_){ }
        },
        getRooms: ctx.getRooms,
        normalizeRoomSelection: cfg.normalizeRoomSelection,
        roomLabel: cfg.roomLabel,
        askConfirm: cfg.askRozrysConfirm,
        refreshSelectionState: api.refreshSelectionState,
      });
    };

    api.openMaterialPicker = function(){
      if(!(FC.rozrysPickers && typeof FC.rozrysPickers.openMaterialPicker === 'function')) return;
      return FC.rozrysPickers.openMaterialPicker({
        getMaterialScope: ()=> ctx.getMaterialScope(),
        setMaterialScope: (nextScope)=>{
          ctx.setMaterialScope(nextScope);
          try{ if(ctx.rozState) ctx.rozState.setMaterialScope(ctx.getMaterialScope()); }catch(_){ }
        },
        makeMaterialScope: cfg.makeMaterialScope,
        aggregate: ctx.getAggregate(),
        splitMaterialAccordionTitle: cfg.splitMaterialAccordionTitle,
        buildScopeDraftControls: api.buildScopeDraftControls,
        normalizeMaterialScopeForAggregate: cfg.normalizeMaterialScopeForAggregate,
        askConfirm: cfg.askRozrysConfirm,
        refreshSelectionState: api.refreshSelectionState,
      });
    };

    return api;
  }

  FC.rozrysSelectionUi = { createController };
})();

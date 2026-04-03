(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function cloneSelection(selection){
    const src = selection && typeof selection === 'object' ? selection : {};
    return {
      selectedRooms: Array.isArray(src.selectedRooms) ? src.selectedRooms.slice() : [],
      aggregate: src.aggregate && typeof src.aggregate === 'object' ? src.aggregate : { byMaterial:{}, materials:[], groups:{}, selectedRooms:[] },
      materialScope: src.materialScope && typeof src.materialScope === 'object'
        ? Object.assign({}, src.materialScope)
        : { kind:'all', material:'', includeFronts:true, includeCorpus:true },
    };
  }

  function buildDefaultAggregate(selectedRooms){
    return { byMaterial:{}, materials:[], groups:{}, selectedRooms: Array.isArray(selectedRooms) ? selectedRooms.slice() : [] };
  }

  function createStore(initial){
    const state = {
      selection: cloneSelection(initial),
      options: Object.assign({}, initial && initial.options || {}),
      ui: Object.assign({ buttonMode:'idle', running:false }, initial && initial.ui || {}),
      cache: Object.assign({ lastAutoRenderHit:false, lastScopeKey:'' }, initial && initial.cache || {}),
    };

    function getSelection(){
      return cloneSelection(state.selection);
    }

    function getSelectedRooms(){
      return getSelection().selectedRooms;
    }

    function setSelectedRooms(rooms){
      state.selection.selectedRooms = Array.isArray(rooms) ? rooms.slice() : [];
      if(state.selection.aggregate && typeof state.selection.aggregate === 'object'){
        state.selection.aggregate = Object.assign({}, state.selection.aggregate, { selectedRooms: state.selection.selectedRooms.slice() });
      }
      return getSelectedRooms();
    }

    function getAggregate(){
      return getSelection().aggregate;
    }

    function setAggregate(aggregate){
      state.selection.aggregate = aggregate && typeof aggregate === 'object'
        ? Object.assign(buildDefaultAggregate(state.selection.selectedRooms), aggregate, { selectedRooms: state.selection.selectedRooms.slice() })
        : buildDefaultAggregate(state.selection.selectedRooms);
      return getAggregate();
    }

    function getMaterialScope(){
      return Object.assign({}, state.selection.materialScope || {});
    }

    function setMaterialScope(scope){
      state.selection.materialScope = scope && typeof scope === 'object'
        ? Object.assign({}, scope)
        : { kind:'all', material:'', includeFronts:true, includeCorpus:true };
      return getMaterialScope();
    }

    function setOptionState(nextState){
      state.options = Object.assign({}, nextState || {});
      return getOptionState();
    }

    function patchOptionState(patch){
      state.options = Object.assign({}, state.options, patch || {});
      return getOptionState();
    }

    function getOptionState(){
      return Object.assign({}, state.options || {});
    }

    function setUiState(patch){
      state.ui = Object.assign({}, state.ui, patch || {});
      return getUiState();
    }

    function getUiState(){
      return Object.assign({}, state.ui || {});
    }

    function setCacheState(patch){
      state.cache = Object.assign({}, state.cache, patch || {});
      return getCacheState();
    }

    function getCacheState(){
      return Object.assign({}, state.cache || {});
    }

    function resolveActiveMaterial(){
      const aggregate = getAggregate();
      const scope = getMaterialScope();
      if(scope.kind === 'material' && scope.material) return String(scope.material || '');
      return Array.isArray(aggregate && aggregate.materials) && aggregate.materials.length ? String(aggregate.materials[0] || '') : '';
    }

    return {
      getSelection,
      getSelectedRooms,
      setSelectedRooms,
      getAggregate,
      setAggregate,
      getMaterialScope,
      setMaterialScope,
      setOptionState,
      patchOptionState,
      getOptionState,
      setUiState,
      getUiState,
      setCacheState,
      getCacheState,
      resolveActiveMaterial,
    };
  }

  function buildBaseStateFromControls(controls, deps){
    const cfg = Object.assign({ normalizeCutDirection:null }, deps || {});
    const unit = controls && controls.unitSel && controls.unitSel.value === 'cm' ? 'cm' : 'mm';
    const normalizeDirection = typeof cfg.normalizeCutDirection === 'function'
      ? cfg.normalizeCutDirection
      : ((v)=> String(v || 'start-optimax'));
    return {
      unit,
      edgeSubMm: Math.max(0, Number(controls && controls.edgeSel && controls.edgeSel.value) || 0),
      boardW: Number(controls && controls.inW && controls.inW.value) || (unit === 'mm' ? 2800 : 280),
      boardH: Number(controls && controls.inH && controls.inH.value) || (unit === 'mm' ? 2070 : 207),
      kerf: Number(controls && controls.inK && controls.inK.value) || (unit === 'mm' ? 4 : 0.4),
      edgeTrim: Number(controls && controls.inTrim && controls.inTrim.value) || (unit === 'mm' ? 10 : 1),
      minScrapW: Math.max(0, Number(controls && controls.inMinW && controls.inMinW.value) || 0),
      minScrapH: Math.max(0, Number(controls && controls.inMinH && controls.inMinH.value) || 0),
      heur: 'optimax',
      optimaxProfile: controls && controls.heurSel ? String(controls.heurSel.value || 'max') : 'max',
      direction: normalizeDirection(controls && controls.dirSel ? controls.dirSel.value : 'start-optimax'),
    };
  }

  FC.rozrysState = {
    createStore,
    buildBaseStateFromControls,
  };
})();

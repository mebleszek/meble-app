// js/app/ui-state.js
// Single source of truth for UI state (uiState) with safe defaults and persistence.
// Load after js/app/storage.js and before js/app.js.

(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const STORAGE_KEYS =
    (FC.constants && FC.constants.STORAGE_KEYS) ? FC.constants.STORAGE_KEYS :
    { ui: 'fc_ui_v1' };

  const DEFAULTS = {
    entry: 'home',
    activeTab: 'wywiad',
    roomType: null,
    showPriceList: null,
    expanded: {},
    matExpandedId: null,
    searchTerm: '',
    editingId: null,
    selectedCabinetId: null,
    currentInvestorId: null
  };

  function normalize(state){
    const s = Object.assign({}, DEFAULTS, state || {});
    if(!s.expanded || typeof s.expanded !== 'object') s.expanded = {};
    return s;
  }

  function load(){
    const raw = (FC.storage && FC.storage.getJSON) ? FC.storage.getJSON(STORAGE_KEYS.ui, DEFAULTS) : null;
    return normalize(raw);
  }

  function save(state){
    const s = normalize(state);
    if(FC.storage && FC.storage.setJSON) FC.storage.setJSON(STORAGE_KEYS.ui, s);
    return s;
  }

  // Public API
  FC.uiState = FC.uiState || {};
  FC.uiState.defaults = () => normalize(DEFAULTS);
  FC.uiState.get = () => load();
  FC.uiState.set = (patch) => {
    const cur = load();
    const next = normalize(Object.assign({}, cur, patch || {}));
    return save(next);
  };
  FC.uiState.save = (state) => save(state);

})();

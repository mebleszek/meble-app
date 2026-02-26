// js/app/validate.js
// Lightweight runtime validation + self-healing for persisted data.
// Loaded before js/app.js.

(function(){
  'use strict';
  try{
    window.FC = window.FC || {};
    const utils = window.FC.utils;
    const KEYS  = window.FC.constants && window.FC.constants.STORAGE_KEYS;

    function clone(x){
      return (utils && utils.clone) ? utils.clone(x) : JSON.parse(JSON.stringify(x));
    }

    function ensureArray(v, fallback){
      return Array.isArray(v) ? v : clone(fallback || []);
    }

    function ensureObj(v, fallback){
      return (utils && utils.isPlainObject && utils.isPlainObject(v)) ? v : clone(fallback || {});
    }

    function ensureString(v, fallback){
      return (typeof v === 'string') ? v : (fallback || '');
    }

    function ensureFiniteNumber(v, fallback){
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    }

    function validateUIState(raw){
      const defaults = { activeTab:'wywiad', roomType:null, showPriceList:null, expanded:{}, matExpandedId:null, searchTerm:'', editingId:null, selectedCabinetId:null };
      const s = Object.assign({}, defaults, ensureObj(raw, {}));
      s.activeTab = ensureString(s.activeTab, defaults.activeTab);
      s.roomType  = (s.roomType == null) ? null : ensureString(s.roomType, null);
      s.showPriceList = (s.showPriceList == null) ? null : ensureString(s.showPriceList, null);
      s.searchTerm = ensureString(s.searchTerm, '');
      s.editingId = (s.editingId == null) ? null : ensureString(s.editingId, null);
      s.selectedCabinetId = (s.selectedCabinetId == null) ? null : ensureString(s.selectedCabinetId, null);
      s.matExpandedId = (s.matExpandedId == null) ? null : ensureString(s.matExpandedId, null);
      s.expanded = ensureObj(s.expanded, {});
      return s;
    }

    function validateMaterials(raw){
      const arr = ensureArray(raw, []);
      return arr
        .map(m => ensureObj(m, {}))
        .map(m => ({
          id: ensureString(m.id, (utils && utils.uid) ? utils.uid() : ('m_' + Date.now())),
          materialType: ensureString(m.materialType, ''),
          manufacturer: ensureString(m.manufacturer, ''),
          symbol: ensureString(m.symbol, ''),
          name: ensureString(m.name, ''),
          price: ensureFiniteNumber(m.price, 0),
        }));
    }

    function validateServices(raw){
      const arr = ensureArray(raw, []);
      return arr
        .map(s => ensureObj(s, {}))
        .map(s => ({
          id: ensureString(s.id, (utils && utils.uid) ? utils.uid() : ('s_' + Date.now())),
          category: ensureString(s.category, ''),
          name: ensureString(s.name, ''),
          price: ensureFiniteNumber(s.price, 0),
        }));
    }

    function validateProject(raw){
      // Delegate to the existing normalizer if present.
      const proj = window.FC.project;
      if (proj && typeof proj.normalize === 'function'){
        return proj.normalize(raw);
      }
      return ensureObj(raw, {});
    }

    function persistIfPossible(key, value){
      if (!KEYS || !key) return;
      try{
        if (window.FC.storage && typeof window.FC.storage.setJSON === 'function'){
          window.FC.storage.setJSON(key, value);
        }
      }catch(_){ }
    }

    window.FC.validate = window.FC.validate || {
      validateUIState,
      validateMaterials,
      validateServices,
      validateProject,
      persistIfPossible,
    };
  }catch(_){ }
})();

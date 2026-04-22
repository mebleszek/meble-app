/* ===== Storage keys and defaults ===== */
const STORAGE_KEYS = (window.FC && window.FC.constants && window.FC.constants.STORAGE_KEYS) || {
  materials: 'fc_materials_v1',
  services: 'fc_services_v1',
  sheetMaterials: 'fc_sheet_materials_v1',
  accessories: 'fc_accessories_v1',
  quoteRates: 'fc_quote_rates_v1',
  workshopServices: 'fc_workshop_services_v1',
  serviceOrders: 'fc_service_orders_v1',
  quoteSnapshots: 'fc_quote_snapshots_v1',
  quoteOfferDrafts: 'fc_quote_offer_drafts_v1',
  projects: 'fc_projects_v1',
  currentProjectId: 'fc_current_project_id_v1',
  projectData: 'fc_project_v1',
  projectBackup: 'fc_project_backup_v1',
  projectBackupMeta: 'fc_project_backup_meta_v1',
  ui: 'fc_ui_v1',
};



function validateRequiredDOM(){
  try{
    const guard = window.FC && window.FC.domGuard && window.FC.domGuard.validateRequiredDOM;
    if(typeof guard === 'function') return guard();
  }catch(_){ }
}


/** App namespace to reduce globals and keep concerns separated. */
const FC = (function(){
  'use strict';

  /* ===== Module aliases: utils + storage ===== */
  const utils = (window.FC && window.FC.utils) || {
    uid(){
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      return 'id_' + Date.now() + '_' + Math.floor(Math.random() * 1e9);
    },
    clone(x){
      if (typeof structuredClone === 'function') return structuredClone(x);
      return JSON.parse(JSON.stringify(x));
    },
    num(v, fallback){
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    },
    isPlainObject(v){
      return !!v && typeof v === 'object' && (v.constructor === Object || Object.getPrototypeOf(v) === null);
    }
  };

  const storage = (window.FC && window.FC.storage) || {
    getJSON(key, fallback){
      try{
        const raw = localStorage.getItem(key);
        if (!raw) return utils.clone(fallback);
        return JSON.parse(raw);
      }catch(e){
        return utils.clone(fallback);
      }
    },
    setJSON(key, value){
      try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){}
    },
    getRaw(key){
      try{ return localStorage.getItem(key); }catch(e){ return null; }
    },
    setRaw(key, raw){
      try{ localStorage.setItem(key, raw); }catch(e){}
    }
  };

  /* ===== Module: project schema + migrations ===== */
  const schema = (window.FC && window.FC.schema) || null;
  const CURRENT_SCHEMA_VERSION = (schema && Number(schema.CURRENT_SCHEMA_VERSION)) || 9;
  const DEFAULT_PROJECT = (schema && schema.DEFAULT_PROJECT) || {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    kuchnia: { cabinets: [], fronts: [], sets: [], settings: { roomHeight: 250, bottomHeight: 82, legHeight: 10, counterThickness: 3.8, gapHeight: 60, ceilingBlende: 10 } },
    szafa: { cabinets: [], fronts: [], sets: [], settings: { roomHeight: 250, bottomHeight: 82, legHeight: 10, counterThickness: 1.8, gapHeight: 0, ceilingBlende: 5 } },
    pokoj: { cabinets: [], fronts: [], sets: [], settings: { roomHeight: 250, bottomHeight: 82, legHeight: 5, counterThickness: 1.8, gapHeight: 0, ceilingBlende: 0 } },
    lazienka: { cabinets: [], fronts: [], sets: [], settings: { roomHeight: 220, bottomHeight: 82, legHeight: 15, counterThickness: 2, gapHeight: 0, ceilingBlende: 0 } }
  };
  const ROOMS = (schema && Array.isArray(schema.ROOMS) && schema.ROOMS.length) ? schema.ROOMS : ['kuchnia','szafa','pokoj','lazienka'];

  function normalizeRoom(roomRaw, roomDefault){
    if(schema && typeof schema.normalizeRoom === 'function'){
      return schema.normalizeRoom(roomRaw, roomDefault);
    }
    const room = utils.isPlainObject(roomRaw) ? utils.clone(roomRaw) : {};
    const def = utils.isPlainObject(roomDefault) ? utils.clone(roomDefault) : {};
    const settings = Object.assign({}, def.settings || {}, utils.isPlainObject(room.settings) ? room.settings : {});
    return Object.assign(def, room, {
      cabinets: Array.isArray(room.cabinets) ? room.cabinets : [],
      fronts: Array.isArray(room.fronts) ? room.fronts : [],
      sets: Array.isArray(room.sets) ? room.sets : [],
      settings,
    });
  }

  function normalizeProject(raw){
    if(schema && typeof schema.normalizeProject === 'function'){
      return schema.normalizeProject(raw);
    }
    const data = utils.isPlainObject(raw) ? raw : {};
    const out = Object.assign(utils.clone(DEFAULT_PROJECT), data, { schemaVersion: CURRENT_SCHEMA_VERSION });
    for (const r of ROOMS) out[r] = normalizeRoom(data[r], DEFAULT_PROJECT[r]);
    return out;
  }

  const project = (window.FC && window.FC.project && typeof window.FC.project.load === 'function' && typeof window.FC.project.save === 'function')
    ? window.FC.project
    : {
        CURRENT_SCHEMA_VERSION,
        DEFAULT_PROJECT,
        load(){
          // Robust load: try primary; if corrupted/empty, fall back to backup.
          const rawPrimary = storage.getRaw(STORAGE_KEYS.projectData);
          const rawBackup  = storage.getRaw(STORAGE_KEYS.projectBackup);

          function parseOrNull(raw){
            if (!raw) return null;
            try{ return JSON.parse(raw); }catch(e){ return null; }
          }

          const primaryObj = parseOrNull(rawPrimary);
          const backupObj  = parseOrNull(rawBackup);

          // If primary is missing/corrupt but backup exists, restore from backup.
          const chosen = primaryObj || backupObj || DEFAULT_PROJECT;

          // If we had to fall back to backup, try to repair primary storage.
          if (!primaryObj && backupObj){
            storage.setRaw(STORAGE_KEYS.projectData, rawBackup);
          }

          return normalizeProject(chosen);
        },
        save(data){
          // Robust save: keep last-good backup before overwriting.
          const normalized = normalizeProject(data);

          // Backup current primary (if any) before overwriting.
          const currentRaw = storage.getRaw(STORAGE_KEYS.projectData);
          if (currentRaw){
            storage.setRaw(STORAGE_KEYS.projectBackup, currentRaw);
            storage.setJSON(STORAGE_KEYS.projectBackupMeta, { savedAt: Date.now() });
          }

          // Write new state.
          storage.setJSON(STORAGE_KEYS.projectData, normalized);
          return normalized;
        },
        normalize: normalizeProject,
      };

  try{ window.FC.project = project; }catch(_){ }
  return { utils, storage, project };
})();
const DEFAULT_PROJECT = FC.project.DEFAULT_PROJECT;

// Wystaw init jak najwcześniej, zanim niższe sekcje pliku dotkną storage / stanu projektu.
// Dzięki temu boot nie zgłasza fałszywie „brak init”, jeśli później wyłoży się np. niepełny stan danych.
try{
  window.FC = Object.assign(window.FC || {}, FC, { init: initApp });
  window.App = Object.assign(window.App || {}, { init: initApp });
  window.initApp = initApp;
  window.initUI = initUI;
}catch(_){ }

/* ===== State initialization ===== */
const __initialAppState = callExtracted('appStateBootstrap', 'createInitialState', [{
  FC,
  storageKeys: STORAGE_KEYS,
  defaultProject: DEFAULT_PROJECT,
}]) || {};

let materials = __initialAppState.materials;
let services = __initialAppState.services;
let projectData = __initialAppState.projectData;
const __uiDefaults = (__initialAppState.uiDefaults && typeof __initialAppState.uiDefaults === 'object')
  ? __initialAppState.uiDefaults
  : {};
var uiState = __initialAppState.uiState || {};
uiState = Object.assign({}, __uiDefaults, uiState || {});
if (!uiState.expanded || typeof uiState.expanded !== 'object') uiState.expanded = {};
FC.storage.setJSON(STORAGE_KEYS.ui, uiState);

function readReloadRestore(){ return callExtracted('reloadRestore', 'read', [], function(){ return null; }); }
function clearReloadRestore(){ return callExtracted('reloadRestore', 'clear', [], function(){}); }
function persistReloadRestore(){
  return callExtracted('reloadRestore', 'persist', [{
    getUiState: function(){
      try{
        if(window.FC && window.FC.uiState && typeof window.FC.uiState.get === 'function') return window.FC.uiState.get();
      }catch(_){ }
      return uiState;
    },
  }], function(){});
}
function applyReloadRestoreSnapshot(){ return callExtracted('reloadRestore', 'applySnapshot', [], function(){ return null; }); }
function restoreReloadScroll(){ return callExtracted('reloadRestore', 'restoreScroll', [], function(){}); }

try{
  window.FC = window.FC || {};
  window.FC.reloadRestore = Object.assign(window.FC.reloadRestore || {}, {
    read: readReloadRestore,
    clear: clearReloadRestore,
    persist: persistReloadRestore,
  });
}catch(_){ }

try{
  callExtracted('reloadRestore', 'installPersistence', [{
    getUiState: function(){
      try{
        if(window.FC && window.FC.uiState && typeof window.FC.uiState.get === 'function') return window.FC.uiState.get();
      }catch(_){ }
      return uiState;
    },
  }]);
}catch(_){ }

/* ===== Runtime validation moved to app-state-bootstrap.js (single source of truth for startup self-healing) ===== */
/* ===== Normalize (backward compatibility) ===== */
function normalizeProjectData(data, defaults){
  const pd = (typeof data === 'undefined' || data === null) ? projectData : data;
  const defs = (typeof defaults === 'undefined' || defaults === null) ? DEFAULT_PROJECT : defaults;
  return callExtracted('projectBootstrap','normalizeProjectData',[pd, defs], function(localPd){
    if(!localPd) return localPd;
    const normalized = (FC.project && typeof FC.project.normalize === 'function') ? FC.project.normalize(localPd) : localPd;
    const out = (FC.project && typeof FC.project.save === 'function') ? FC.project.save(normalized) : normalized;
    try{ if(localPd === projectData) projectData = out; }catch(_){ }
    return out;
  });
}
projectData = normalizeProjectData(projectData, DEFAULT_PROJECT);

/* ===== Modal state ===== */
const cabinetModalState = {
  mode: 'add',          // 'add' | 'edit'
  editingId: null,
  draft: null,
  chosen: null,         // 'stojąca' | 'wisząca' | 'moduł' | 'zestaw'
  setPreset: null,
  setEditId: null       // setId when editing a set
};

/* ===== Utility & core functions ===== */
function calculateAvailableTopHeight(){
  return callExtracted('calc', 'calculateAvailableTopHeight', [projectData], function(){
    const s = projectData && projectData.kuchnia && projectData.kuchnia.settings ? projectData.kuchnia.settings : {};
    const h = (Number(s.roomHeight)||0) - (Number(s.bottomHeight)||0) - (Number(s.counterThickness)||0) - (Number(s.gapHeight)||0) - (Number(s.ceilingBlende)||0);
    return h>0?Math.round(h*10)/10:0;
  });
}
function renderTopHeight(){
  return callExtracted('settingsUI', 'renderTopHeight', arguments, function(){
    const el = document.getElementById('autoTopHeight');
    if(el) el.textContent = calculateAvailableTopHeight();
  });
}

function calcTopForSet(room, blende, sumLowerHeights){
  return callExtracted('calc', 'calcTopForSet', [projectData, room, blende, sumLowerHeights], function(){
    const s = projectData && projectData[room] && projectData[room].settings ? projectData[room].settings : {};
    const h = (Number(s.roomHeight)||0) - (Number(sumLowerHeights)||0) - (Number(blende)||0);
    return h>0?Math.round(h*10)/10:0;
  });
}

// ZESTAWY: top = roomHeight - suma niższych - blenda
function toggleExpandAll(id){
  return callExtracted('settingsUI', 'toggleExpandAll', arguments, function(id){
    const key = String(id);
    uiState.expanded = {};
    uiState.expanded[key] = true;
    uiState.selectedCabinetId = key;
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    renderCabinets();
  });
}

/* Settings changes */
function handleSettingChange(field, value){
  return callExtracted('settingsUI', 'handleSettingChange', arguments, function(field, value){
    const room = uiState.roomType; if(!room) return;
    projectData[room].settings[field] = value === '' ? 0 : parseFloat(value);
    projectData = FC.project.save(projectData);
    renderTopHeight();
    renderCabinets();
  });
}

/* --- Variant lists --- */

// Extracted implementation delegator for modules loaded after app.js.
function callExtracted(nsName, fnName, args, fallback){
  try{
    const mod = window.FC && window.FC[nsName];
    const impl = mod && mod[fnName];
    if(typeof impl === 'function') return impl.apply(null, args || []);
  }catch(_){ }
  if(typeof fallback === 'function') return fallback.apply(null, args || []);
}

/* ===== Cabinet/front rules moved to js/app/cabinet/cabinet-fronts.js ===== */
function getSubTypeOptionsForType(typeVal){ return callExtracted('cabinetFronts','getSubTypeOptionsForType',[typeVal]); }
function applyTypeRules(room, updated, typeVal){ return callExtracted('cabinetFronts','applyTypeRules',[room, updated, typeVal]); }
function applySubTypeRules(room, updated, subTypeVal){ return callExtracted('cabinetFronts','applySubTypeRules',[room, updated, subTypeVal]); }
function addFront(room, front){ return callExtracted('cabinetFronts','addFront',[room, front]); }
function removeFrontsForSet(room, setId){ return callExtracted('cabinetFronts','removeFrontsForSet',[room, setId]); }
function removeFrontsForCab(room, cabId){ return callExtracted('cabinetFronts','removeFrontsForCab',[room, cabId]); }
function getFrontsForSet(room, setId){ return callExtracted('cabinetFronts','getFrontsForSet',[room, setId]); }
function getFrontsForCab(room, cabId){ return callExtracted('cabinetFronts','getFrontsForCab',[room, cabId]); }
function cabinetAllowsFrontCount(cab){ return callExtracted('cabinetFronts','cabinetAllowsFrontCount',[cab]); }
function getFlapFrontCount(cab){ return callExtracted('cabinetFronts','getFlapFrontCount',[cab]); }
function getFlapFrontCountFromDetails(details){ return callExtracted('cabinetFronts','getFlapFrontCountFromDetails',[details]); }
function ensureFrontCountRules(cab){ return callExtracted('cabinetFronts','ensureFrontCountRules',[cab]); }
function validateAventosForDraft(room, draft){ return callExtracted('cabinetFronts','validateAventosForDraft',[room, draft]); }
function applyAventosValidationUI(room, draft){ return callExtracted('cabinetFronts','applyAventosValidationUI',[room, draft]); }
function syncDraftFromCabinetModalForm(d){ return callExtracted('cabinetFronts','syncDraftFromCabinetModalForm',[d]); }
function generateFrontsForCabinet(room, cab){ return callExtracted('cabinetFronts','generateFrontsForCabinet',[room, cab]); }

/* ===== Cabinet modal + set wizard moved to js/app/cabinet/cabinet-modal.js ===== */
function makeDefaultCabinetDraftForRoom(room){ return callExtracted('cabinetModal','makeDefaultCabinetDraftForRoom',[room]); }
function openCabinetModalForAdd(){ return callExtracted('cabinetModal','openCabinetModalForAdd',[]); }
function lockModalScroll(){ return callExtracted('cabinetModal','lockModalScroll',[]); }
function unlockModalScroll(){ return callExtracted('cabinetModal','unlockModalScroll',[]); }
function openCabinetModalForEdit(cabId){ return callExtracted('cabinetModal','openCabinetModalForEdit',[cabId]); }
function openSetWizardForEdit(setId){ return callExtracted('cabinetModal','openSetWizardForEdit',[setId]); }
function closeCabinetModal(){ return callExtracted('cabinetModal','closeCabinetModal',[]); }
function renderCabinetTypeChoices(){ return callExtracted('cabinetModal','renderCabinetTypeChoices',[]); }
function populateSelect(el, options, selected){ return callExtracted('cabinetModal','populateSelect',[el, options, selected]); }
function populateFrontColorsTo(selectEl, typeVal, selected){ return callExtracted('cabinetModal','populateFrontColorsTo',[selectEl, typeVal, selected]); }
function populateBodyColorsTo(selectEl, selected){ return callExtracted('cabinetModal','populateBodyColorsTo',[selectEl, selected]); }
function populateOpeningOptionsTo(selectEl, typeVal, selected){ return callExtracted('cabinetModal','populateOpeningOptionsTo',[selectEl, typeVal, selected]); }
function renderCabinetExtraDetailsInto(container, draft){ return callExtracted('cabinetModal','renderCabinetExtraDetailsInto',[container, draft]); }
function renderSetTiles(){ return callExtracted('cabinetModal','renderSetTiles',[]); }
function renderSetParamsUI(presetId){ return callExtracted('cabinetModal','renderSetParamsUI',[presetId]); }
function wireSetParamsLiveUpdate(presetId){ return callExtracted('cabinetModal','wireSetParamsLiveUpdate',[presetId]); }
function renderCabinetModal(){ return callExtracted('cabinetModal','renderCabinetModal',[]); }
function getSetParamsFromUI(presetId){ return callExtracted('cabinetModal','getSetParamsFromUI',[presetId]); }
function fillSetParamsUIFromSet(set){ return callExtracted('cabinetModal','fillSetParamsUIFromSet',[set]); }
function getNextSetNumber(room){ return callExtracted('cabinetModal','getNextSetNumber',[room]); }
function createOrUpdateSetFromWizard(){ return callExtracted('cabinetModal','createOrUpdateSetFromWizard',[]); }
function drawCornerSketch(opts){
  return callExtracted('cornerSketch', 'drawCornerSketch', arguments, function(){ return; });
}


/* ===== add/delete cabinet actions extracted to js/app/cabinet/cabinet-actions.js ===== */
function addCabinet(){
  return callExtracted('cabinetActions', 'addCabinet', []);
}


/* ===== Delete cabinet by id (used by per-card delete) ===== */
function deleteCabinetById(cabId){
  return callExtracted('cabinetActions', 'deleteCabinetById', [cabId]);
}


/* ===== Price modal functions ===== */
function closePriceModal(){ return callExtracted('priceModal','closePriceModal',[]); }

function saveMaterialFromForm(){ return callExtracted('priceModal','saveMaterialFromForm',[]); }

function saveServiceFromForm(){ return callExtracted('priceModal','saveServiceFromForm',[]); }

function deletePriceItem(item){ return callExtracted('priceModal','deletePriceItem',[item]); }
function closePriceItemModal(){ return callExtracted('priceModal','closePriceItemModal',[]); }

/* ===== Cabinet Modal helpers ===== */
function getCabinetExtraSummary(room, cab){
  return callExtracted('cabinetSummary', 'getCabinetExtraSummary', arguments, function(){ return ''; });
}


/* ===== Materiały: rozpiska mebli (korpusy/plecy/trawersy) ===== */
const FC_BOARD_THICKNESS_CM = (window.FC && window.FC.materialCommon && window.FC.materialCommon.FC_BOARD_THICKNESS_CM) || 1.8; // domyślnie płyta 18mm
const FC_TOP_TRAVERSE_DEPTH_CM = (window.FC && window.FC.materialCommon && window.FC.materialCommon.FC_TOP_TRAVERSE_DEPTH_CM) || 9; // trawersy górne

function fmtCm(v){ return callExtracted('materialCommon','fmtCm',[v], function(x){ const n = Number(x); return Number.isFinite(n) ? (Math.round(n * 10) / 10).toString() : String(x ?? ''); }); }
function formatM2(v){ return callExtracted('materialCommon','formatM2',[v], function(){ return '0.000'; }); }
function escapeHtml(str){ return callExtracted('materialCommon','escapeHtml',[str], function(s){ return String(s ?? ''); }); }
function calcPartAreaM2(p){ return callExtracted('materialCommon','calcPartAreaM2',[p], function(){ return 0; }); }
function addArea(map, material, area){ return callExtracted('materialCommon','addArea',[map, material, area], function(dst){ return dst; }); }
function totalsFromParts(parts){ return callExtracted('materialCommon','totalsFromParts',[parts], function(){ return {}; }); }
function mergeTotals(target, src){ return callExtracted('materialCommon','mergeTotals',[target, src], function(dst){ return dst || {}; }); }
function totalsToRows(totals){ return callExtracted('materialCommon','totalsToRows',[totals], function(){ return []; }); }
function renderTotals(container, totals){ return callExtracted('materialCommon','renderTotals',[container, totals], function(el){ if(el) el.innerHTML = ''; }); }
function getCabinetAssemblyRuleText(cab){ return callExtracted('materialCommon','getCabinetAssemblyRuleText',[cab], function(){ return 'Skręcanie: —'; }); }

function getCabinetFrontCutListForMaterials(room, cab){ return callExtracted('frontHardware','getCabinetFrontCutListForMaterials',[room, cab], function(){ return []; }); }
function cabinetHasHandle(cab){ return callExtracted('frontHardware','cabinetHasHandle',[cab], function(){ return true; }); }
function getFrontWeightKgM2(frontMaterial){ return callExtracted('frontHardware','getFrontWeightKgM2',[frontMaterial], function(){ return 13.0; }); }
function estimateFrontWeightKg(wCm, hCm, frontMaterial, hasHandle){ return callExtracted('frontHardware','estimateFrontWeightKg',[wCm, hCm, frontMaterial, hasHandle], function(){ return 0; }); }
function blumHingesPerDoor(wCm, hCm, frontMaterial, hasHandle){ return callExtracted('frontHardware','blumHingesPerDoor',[wCm, hCm, frontMaterial, hasHandle], function(){ return 0; }); }
function getDoorFrontPanelsForHinges(room, cab){ return callExtracted('frontHardware','getDoorFrontPanelsForHinges',[room, cab], function(){ return []; }); }
function getHingeCountForCabinet(room, cab){ return callExtracted('frontHardware','getHingeCountForCabinet',[room, cab], function(){ return 0; }); }
function estimateFlapWeightKg(cab, room){ return callExtracted('frontHardware','estimateFlapWeightKg',[cab, room], function(){ return 0; }); }
function blumAventosPowerFactor(cab, room){ return callExtracted('frontHardware','blumAventosPowerFactor',[cab, room], function(){ return 0; }); }
function getBlumAventosInfo(cab, room){ return callExtracted('frontHardware','getBlumAventosInfo',[cab, room], function(){ return null; }); }

function getCabinetCutList(cab, room){
  return callExtracted('cabinetCutlist','getCabinetCutList',[cab, room], _getCabinetCutListFallback);
}

function _getCabinetCutListFallback(cab, room){
  // Fallback awaryjny celowo minimalny: właściwa logika siedzi w js/app/cabinet/cabinet-cutlist.js.
  // Zwracamy pustą listę zamiast dublować setki linii w app.js.
  return [];
}




function renderMaterialsTab(listEl, room){
  try{
    const impl = window.FC && window.FC.tabsMaterial && window.FC.tabsMaterial.renderMaterialsTab;
    if(typeof impl === 'function') return impl(listEl, room);
  }catch(_){ }
}


/* ===== Render UI: cabinets (NO inline editing) ===== */
// RYZYKO REGRESJI: centralny render szafek.
// Każda zmiana tutaj może psuć kilka widoków naraz, więc testować dodawanie/edycję/usuwanie oraz przełączanie zakładek.
function renderCabinets(){
  const list = document.getElementById('cabinetsList');
  if(!list) return;
  list.innerHTML = '';
  const requestedRoom = String((uiState && uiState.roomType) || '').trim();
  const roomData = requestedRoom && projectData && projectData[requestedRoom] && typeof projectData[requestedRoom] === 'object'
    ? projectData[requestedRoom]
    : null;
  const room = roomData ? requestedRoom : '';
  const roomSettingsCardEl = document.getElementById('roomSettingsCard');
  if(roomSettingsCardEl) roomSettingsCardEl.style.display = shouldHideRoomSettingsForTab(uiState && uiState.activeTab) ? 'none' : '';
  const roomTitleEl = document.getElementById('roomTitle');
  if(roomTitleEl){
    roomTitleEl.textContent = room
      ? ((window.FC && window.FC.roomRegistry && typeof window.FC.roomRegistry.getRoomLabel === 'function')
          ? window.FC.roomRegistry.getRoomLabel(room)
          : room.charAt(0).toUpperCase()+room.slice(1))
      : 'Pomieszczenie';
  }
  if(!room){
    const roomlessTab = String(uiState && uiState.activeTab || '').trim().toLowerCase();
    if(roomlessTab === 'wycena'){
      try{
        if(window.FC && window.FC.tabsRouter && typeof window.FC.tabsRouter.switchTo === 'function'){
          window.FC.tabsRouter.switchTo('wycena', { listEl: list, room:'' });
          try{ window.FC && window.FC.listScrollMemory && window.FC.listScrollMemory.restorePending && window.FC.listScrollMemory.restorePending(); }catch(_){ }
          return;
        }
      }catch(_){ }
    }
    if(requestedRoom){
      const hasInvestorContext = !!((uiState && uiState.currentInvestorId)
        || (window.FC && window.FC.investors && typeof window.FC.investors.getCurrentId === 'function' && window.FC.investors.getCurrentId()));
      const nextState = Object.assign({}, uiState || {}, {
        roomType: null,
        selectedCabinetId: null,
        expanded: {},
        entry: hasInvestorContext ? 'rooms' : ((uiState && uiState.workMode) ? 'modeHub' : 'home'),
      });
      if(nextState.activeTab === 'wywiad' || nextState.activeTab === 'rysunek' || nextState.activeTab === 'material') nextState.activeTab = 'pokoje';
      uiState = nextState;
      try{
        if(window.FC && window.FC.uiState && typeof window.FC.uiState.set === 'function') uiState = window.FC.uiState.set(nextState);
        else FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      }catch(_){ }
      try{ if(window.FC && window.FC.views && typeof window.FC.views.applyFromState === 'function') window.FC.views.applyFromState(uiState); }catch(_){ }
    }
    return;
  }

  const s = roomData.settings || {};
  renderTopHeight();
  try{
    if(window.FC && window.FC.wywiadRoomSettings){
      if(typeof window.FC.wywiadRoomSettings.renderSummary === 'function') window.FC.wywiadRoomSettings.renderSummary(room);
      if(typeof window.FC.wywiadRoomSettings.bindTriggerButtons === 'function') window.FC.wywiadRoomSettings.bindTriggerButtons(document);
    }
  }catch(_){ }

  // Zakładki — routing przez moduły (js/app/ui/tabs-router.js + js/tabs/*)
  // Dzięki temu każda zakładka ma osobny plik i minimalizujemy ryzyko psucia innych sekcji.
  try{
    if(window.FC && window.FC.tabsRouter && typeof window.FC.tabsRouter.switchTo === 'function'){
      window.FC.tabsRouter.switchTo(uiState.activeTab, { listEl: list, room });
      try{ window.FC && window.FC.listScrollMemory && window.FC.listScrollMemory.restorePending && window.FC.listScrollMemory.restorePending(); }catch(_){ }
      return;
    }
  }catch(_){ }

  // Fallback (gdyby router nie był dostępny): zachowaj minimalne działanie.
  if(uiState.activeTab === 'material'){
    renderMaterialsTab(list, room);
    try{ window.FC && window.FC.listScrollMemory && window.FC.listScrollMemory.restorePending && window.FC.listScrollMemory.restorePending(); }catch(_){ }
    return;
  }
  if(uiState.activeTab === 'rysunek'){
    renderDrawingTab(list, room);
    try{ window.FC && window.FC.listScrollMemory && window.FC.listScrollMemory.restorePending && window.FC.listScrollMemory.restorePending(); }catch(_){ }
    return;
  }
  renderWywiadTab(list, room);
  try{ window.FC && window.FC.listScrollMemory && window.FC.listScrollMemory.restorePending && window.FC.listScrollMemory.restorePending(); }catch(_){ }
  return;
}

// Wydzielony renderer WYWIAD — aktywny render listy szafek i szczegółów
function renderWywiadTab(list, room){
  // grupowanie: zestawy renderujemy jako blok: korpusy + fronty zestawu pod spodem
  const cabinets = projectData[room].cabinets || [];
  const renderedSets = new Set();

  list.innerHTML = '';

  cabinets.forEach((cab, idx) => {
    if(cab.setId && !renderedSets.has(cab.setId)){
      const setId = cab.setId;
      renderedSets.add(setId);
      const setCabs = cabinets.filter(c => c.setId === setId);
      setCabs.forEach((sc, jdx) => {
        renderSingleCabinetCard(list, room, sc, idx + jdx + 1);
      });
      return;
    }

    if(cab.setId && renderedSets.has(cab.setId)) return;

    renderSingleCabinetCard(list, room, cab, idx+1);
  });
}

function renderSingleCabinetCard(list, room, cab, displayIndex){
  const cabEl = document.createElement('div');
  cabEl.className = 'cabinet cabinet-card-shell';
  cabEl.id = `cab-${cab.id}`;
  if(uiState.selectedCabinetId === cab.id) cabEl.classList.add('selected');

  const header = document.createElement('div');
  header.className = 'cabinet-header cabinet-header--stacked cabinet-card-shell__header';

  const badge = cab.setId && typeof cab.setNumber === 'number'
    ? `<span class="badge">Zestaw ${cab.setNumber}</span>`
    : '';
  const bodyMeta = [cab.bodyColor || '', cab.backMaterial || ''].filter(Boolean).join(' • ') || '—';
  const frontMeta = [cab.frontMaterial || '', cab.frontColor || ''].filter(Boolean).join(' • ') || '—';
  const copy = document.createElement('div');
  copy.className = 'cabinet-header__copy cabinet-card-shell__copy';
  copy.innerHTML = `
    <div class="cabinet-header__title">#${displayIndex} • ${cab.type} • ${cab.subType||''}${badge}</div>
    <div class="cabinet-header__meta">Korpus: ${bodyMeta}</div>
    <div class="cabinet-header__meta">Front: ${frontMeta}</div>
    <div class="cabinet-header__meta">${cab.width} × ${cab.height} × ${cab.depth}</div>
  `;

  const actions = document.createElement('div');
  actions.className = 'cab-actions cabinet-header__actions cabinet-card-shell__actions';
  actions.innerHTML = `<button class="btn" data-act="edit" type="button">Edytuj</button> <button class="btn" data-act="mat" type="button">Materiały</button> <button class="btn btn-danger" data-act="del" type="button">Usuń</button>`;

  header.appendChild(copy);
  header.appendChild(actions);
  cabEl.appendChild(header);
  cabEl.setAttribute('data-cabinet-kind', String(cab.type || ''));

  actions.addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.target && e.target.closest ? e.target.closest('button') : null;
    if(!btn) return;
    const act = btn.getAttribute('data-act');
    if(act === 'edit'){
      openCabinetModalForEdit(cab.id);
      return;
    }
    if(act === 'mat'){
      jumpToMaterialsForCabinet(cab.id);
      return;
    }
    if(act === 'del'){
      deleteCabinetById(cab.id);
      return;
    }
  });

  if(uiState.expanded[cab.id]){
    const body = document.createElement('div');
    body.className = 'cabinet-body';

    const summary = getCabinetExtraSummary(room, cab);

    const ro = document.createElement('div');
    ro.className = 'ro-grid';
    ro.innerHTML = `
      <div class="ro-box"><div class="muted xs">Rodzaj</div><div class="ro-val">${cab.type || ''}</div></div>
      <div class="ro-box"><div class="muted xs">Wariant</div><div class="ro-val">${cab.subType || ''}</div></div>
      <div class="ro-box"><div class="muted xs">Szczegóły</div><div class="ro-val">${summary || '—'}</div></div>

      <div class="ro-box"><div class="muted xs">Wymiary</div><div class="ro-val">${cab.width} × ${cab.height} × ${cab.depth}</div></div>
      <div class="ro-box"><div class="muted xs">Front</div><div class="ro-val">${cab.frontMaterial || ''}</div><div class="muted xs">${cab.frontColor || ''}</div></div>
      <div class="ro-box"><div class="muted xs">Korpus / Plecy</div><div class="ro-val">${cab.bodyColor || ''}</div><div class="muted xs">${cab.backMaterial || ''}</div></div>

      <div class="ro-box"><div class="muted xs">Otwieranie</div><div class="ro-val">${cab.openingSystem || ''}</div></div>
    `;
    body.appendChild(ro);

    const frontsForThis = cab.setId ? getFrontsForSet(room, cab.setId) : getFrontsForCab(room, cab.id);
    if(frontsForThis && frontsForThis.length){
      const fb = document.createElement('div');
      fb.className = 'front-block';
      const title = cab.setId
        ? `Fronty zestawu <span class="badge">Zestaw ${cab.setNumber}</span>`
        : 'Fronty szafki';
      fb.innerHTML = `
        <div class="head">
          <div>${title}</div>
          <div class="front-meta">${frontsForThis.length} szt.</div>
        </div>
      `;
      frontsForThis.forEach((f) => {
        const row = document.createElement('div');
        row.className = 'front-row';
        row.innerHTML = `
          <div>
            <div style="font-weight:900">Front: ${f.width} × ${f.height}</div>
            <div class="front-meta">${(f.material||'')}${(f.color ? ' • ' + f.color : '')}${(f.note ? ' • ' + f.note : '')}</div>
          </div>
          <div style="font-weight:900">${Number(f.width)||0}×${Number(f.height)||0}</div>
        `;
        fb.appendChild(row);
      });
      body.appendChild(fb);
    }

    const hint = document.createElement('div');
    hint.className = 'muted xs';
    hint.style.marginTop = '10px';
    hint.style.padding = '10px';
    hint.style.border = '1px solid #eef6fb';
    hint.style.borderRadius = '10px';
    hint.style.background = '#fbfdff';
    hint.textContent = 'Edycja tylko przez przycisk „Edytuj”.';
    body.appendChild(hint);

    cabEl.appendChild(body);
  }

  header.addEventListener('click', (e) => {
    if(e.target && e.target.closest && e.target.closest('button')) return;

    if(uiState.activeTab === 'wywiad'){
      uiState.selectedCabinetId = (uiState.selectedCabinetId === cab.id) ? null : cab.id;
    }
    toggleExpandAll(cab.id);
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    renderCabinets();
  });

  list.appendChild(cabEl);
}

/* ===== Price modal render ===== */
function renderPriceModal(){ return callExtracted('priceModal','renderPriceModal',[]); }


// Tab/navigation helpers extracted to js/app/ui/tab-navigation.js
function jumpToMaterialsForCabinet(cabId){ return callExtracted('tabNavigation','jumpToMaterialsForCabinet',[cabId]); }

function jumpToCabinetFromMaterials(cabId){ return callExtracted('tabNavigation','jumpToCabinetFromMaterials',[cabId]); }

// Centralne przełączanie zakładek (używane też przez przyciski "skoku")
// RYZYKO REGRESJI: przełączanie zakładek wpływa też na odświeżanie danych i render.
// Nie zmieniać kolejności efektów ubocznych bez testu całego przepływu projektu.
function setActiveTab(tabName){ return callExtracted('tabNavigation','setActiveTab',[tabName]); }

function shouldHideRoomSettingsForTab(tabName){
  return String(tabName || '') === 'wycena';
}

try{
  window.FC = window.FC || {};
  window.FC.appView = window.FC.appView || {};
  window.FC.appView.shouldHideRoomSettingsForTab = shouldHideRoomSettingsForTab;
}catch(_){ }


/* ===== UI wiring & init ===== */

function registerCoreActions(){
  return callExtracted('appUiBootstrap', 'registerCoreActions', [{
    FC,
    closePriceModal,
    closePriceItemModal,
    closeCabinetModal,
  }]);
}

function initApp(){
  return callExtracted('appUiBootstrap', 'initApp', [{
    FC,
    document,
    validateRequiredDOM,
    registerCoreActions,
    initUI,
  }]);
}

// RYZYKO REGRESJI: główny start aplikacji.
// Tu spinają się fallbacki, modale, walidacja akcji i inicjalizacja widoków.

function scheduleProjectAutosave(){ return callExtracted('projectAutosave','scheduleProjectAutosave',[], function(){}); }
function installProjectAutosave(){ return callExtracted('projectAutosave','installProjectAutosave',[], function(){}); }

function initUI(){
  return callExtracted('appUiBootstrap', 'initUI', [{
    FC,
    document,
    storageKeys: STORAGE_KEYS,
    uiDefaults: __uiDefaults,
    getUiState: function(){ return uiState; },
    setUiState: function(nextState){ uiState = nextState; return uiState; },
    applyReloadRestoreSnapshot,
    installBindings: function(){ return callExtracted('appUiRuntimeServices', 'installBindings', [], function(){}); },
    installProjectAutosave,
    renderTopHeight,
    renderCabinets,
    restoreReloadScroll,
    scheduleRozrysWarmup: function(){
      return callExtracted('appUiRuntimeServices', 'scheduleRozrysWarmup', [{
        reason:'post-init-ui',
        delayMs: 900,
        idleTimeoutMs: 3500,
      }], function(){});
    },
  }]);
}

/* ===== Set wizard minimal (reuse existing from previous version) ===== */
/* Layout/state helpers for RYSUNEK moved to js/app/ui/layout-state.js.
   Global bridge is preserved there for tabs/rysunek.js and any legacy callers. */

// Wydzielony renderer RYSUNEK — używany przez js/tabs/rysunek.js
function renderDrawingTab(list, room){
  try{
    const mod = window.FC && window.FC.tabsRysunek;
    if(mod && typeof mod.renderDrawingTab === 'function'){
      return mod.renderDrawingTab(list, room);
    }
  }catch(_){ }

  // Fallback: zachowaj minimalne działanie, jeśli moduł zakładki nie załadował się poprawnie.
  try{
    list.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'build-card';
    card.innerHTML = '<h3>Rysunek</h3><p class="muted">Moduł rysunku nie został załadowany. Odśwież stronę.</p>';
    list.appendChild(card);
  }catch(_){ }
}



/* initUI removed: duplicate listener-based version deleted (delegation is the single source of truth). */


/* init moved to boot.js (safe init) */

// Expose base FC namespace; public safe APIs are attached in js/app/shared/public-api.js
try{
  window.FC = Object.assign(window.FC || {}, FC, { init: initApp });
  window.App = Object.assign(window.App || {}, { init: initApp });
  window.initApp = initApp;
  window.initUI = initUI;
}catch(e){}

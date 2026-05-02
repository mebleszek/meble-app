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
  sheets: 'fc_sheets_v1',
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
const FC = (window.FC && window.FC.appCoreNamespace && typeof window.FC.appCoreNamespace.createAppCore === 'function')
  ? window.FC.appCoreNamespace.createAppCore({ storageKeys: STORAGE_KEYS })
  : (window.FC || {});
const DEFAULT_PROJECT = (FC.project && FC.project.DEFAULT_PROJECT) || ((window.FC && window.FC.schema && window.FC.schema.DEFAULT_PROJECT) || { schemaVersion: 9 });

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

function applyReloadRestoreSnapshot(){
  const mod = window.FC && window.FC.reloadRestore;
  return mod && typeof mod.applySnapshot === 'function' ? mod.applySnapshot() : null;
}

function restoreReloadScroll(){
  const mod = window.FC && window.FC.reloadRestore;
  if(mod && typeof mod.restoreScroll === 'function') return mod.restoreScroll();
}

/* ===== Runtime validation (self-healing persisted state) ===== */
try{
  if (window.FC && window.FC.validate){
    const V = window.FC.validate;
    materials = V.validateMaterials ? V.validateMaterials(materials) : materials;
    services  = V.validateServices ? V.validateServices(services) : services;
    projectData = V.validateProject ? V.validateProject(projectData) : projectData;
    uiState   = V.validateUIState ? V.validateUIState(uiState) : uiState;

    if (V.persistIfPossible){
      V.persistIfPossible(STORAGE_KEYS.materials, materials);
      V.persistIfPossible(STORAGE_KEYS.services, services);
      V.persistIfPossible(STORAGE_KEYS.projectData, projectData);
      V.persistIfPossible(STORAGE_KEYS.ui, uiState);
    } else {
      if(window.FC && window.FC.catalogStore){
        try{ if(typeof window.FC.catalogStore.setSheetMaterials === 'function') materials = window.FC.catalogStore.setSheetMaterials(materials); }catch(_){ FC.storage.setJSON(STORAGE_KEYS.materials, materials); }
        try{ if(typeof window.FC.catalogStore.setQuoteRates === 'function') services = window.FC.catalogStore.setQuoteRates(services); }catch(_){ FC.storage.setJSON(STORAGE_KEYS.services, services); }
      } else {
        FC.storage.setJSON(STORAGE_KEYS.materials, materials);
        FC.storage.setJSON(STORAGE_KEYS.services, services);
      }
      FC.storage.setJSON(STORAGE_KEYS.projectData, projectData);
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    }
  }
}catch(_){ }

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
function calculateAvailableTopHeight(room){
  const roomKey = String(room || (uiState && uiState.roomType) || '').trim() || 'kuchnia';
  return callExtracted('calc', 'calculateAvailableTopHeight', [projectData, roomKey], function(){
    const s = projectData && projectData[roomKey] && projectData[roomKey].settings ? projectData[roomKey].settings : {};
    const h = (Number(s.roomHeight)||0) - (Number(s.bottomHeight)||0) - (Number(s.counterThickness)||0) - (Number(s.gapHeight)||0) - (Number(s.ceilingBlende)||0);
    return h>0?Math.round(h*10)/10:0;
  });
}
function renderTopHeight(room){
  return callExtracted('settingsUI', 'renderTopHeight', arguments, function(roomArg){
    const el = document.getElementById('autoTopHeight');
    if(el) el.textContent = calculateAvailableTopHeight(roomArg);
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

/* ===== Legacy global delegates moved to js/app/bootstrap/app-legacy-bridges.js ===== */





function renderMaterialsTab(listEl, room){
  try{
    const impl = window.FC && window.FC.tabsMaterial && window.FC.tabsMaterial.renderMaterialsTab;
    if(typeof impl === 'function') return impl(listEl, room);
  }catch(_){ }
}


/* ===== Render UI: cabinets (delegated) ===== */
// Aktywny render szkieletu listy przeniesiony do js/app/ui/cabinets-render.js.
// app.js zostaje cienkim mostem, żeby stare wywołania renderCabinets() nadal działały.
function renderCabinets(){
  return callExtracted('cabinetsRender', 'renderCabinets', [{
    document,
    storageKeys: STORAGE_KEYS,
    getUiState: function(){ return uiState; },
    setUiState: function(nextState){ uiState = nextState || {}; return uiState; },
    getProjectData: function(){ return projectData; },
    renderTopHeight,
    renderMaterialsTab,
    renderDrawingTab,
    renderWywiadTab,
    shouldHideRoomSettingsForTab,
  }], function(ctx){
    const doc = ctx && ctx.document ? ctx.document : document;
    const list = doc.getElementById('cabinetsList');
    if(!list) return;
    const st = (ctx && typeof ctx.getUiState === 'function') ? ctx.getUiState() : uiState;
    const pd = (ctx && typeof ctx.getProjectData === 'function') ? ctx.getProjectData() : projectData;
    const room = String((st && st.roomType) || '').trim();
    if(!room || !pd || !pd[room]) return;
    if(st && st.activeTab === 'material') return renderMaterialsTab(list, room);
    if(st && st.activeTab === 'rysunek') return renderDrawingTab(list, room);
    return renderWywiadTab(list, room);
  });
}

// Wydzielony renderer WYWIAD — aktywny render listy szafek i szczegółów.
function renderWywiadTab(list, room){
  return callExtracted('tabsWywiad', 'renderWywiadTab', [list, room], function(listEl){
    if(listEl) listEl.innerHTML = '';
  });
}

function renderSingleCabinetCard(list, room, cab, displayIndex){
  return callExtracted('tabsWywiad', 'renderSingleCabinetCard', [list, room, cab, displayIndex]);
}

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
    installBindings: function(){
      try{ window.FC && window.FC.bindings && typeof window.FC.bindings.install === 'function' && window.FC.bindings.install(); }
      catch(_){ }
    },
    installProjectAutosave,
    renderTopHeight,
    renderCabinets,
    restoreReloadScroll,
    scheduleRozrysWarmup: function(){
      try{
        if(window.FC && window.FC.rozrysLazy && typeof window.FC.rozrysLazy.scheduleWarmup === 'function'){
          window.FC.rozrysLazy.scheduleWarmup({
            reason:'post-init-ui',
            delayMs: 900,
            idleTimeoutMs: 3500,
          });
        }
      }catch(_){ }
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

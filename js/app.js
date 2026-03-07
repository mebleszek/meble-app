/* ===== Storage keys and defaults ===== */
const STORAGE_KEYS = {
  materials: 'fc_materials_v1',
  services: 'fc_services_v1',
  projectData: 'fc_project_v1',
  projectBackup: 'fc_project_backup_v1',
  projectBackupMeta: 'fc_project_backup_meta_v1',
  ui: 'fc_ui_v1',
};



// ===== CORE FALLBACKS (fail-soft) =====
// If for any reason core modules (js/core/actions.js, js/core/modals.js) fail to execute,
// provide minimal implementations so the app can still start.
// RYZYKO REGRESJI: fallbacki FC.actions / FC.modal tylko awaryjnie.
// Jeśli moduły core są załadowane poprawnie, prawdziwym źródłem powinny być js/core/actions.js i js/core/modals.js.
// This prevents "FC.actions not loaded" from hard-killing the app during development/deploy.
try{
  window.FC = window.FC || {};

  if(!window.FC.actions){
    (function(){
      const registry = Object.create(null);
      const locks = Object.create(null);
      function register(map){ Object.keys(map||{}).forEach(k=>registry[k]=map[k]); }
      function has(a){ return typeof registry[a]==='function'; }
      function lock(a,ms){ locks[a]=Date.now()+(ms||800); }
      function isLocked(a){ return (locks[a]||0) > Date.now(); }
      function dispatch(action, ctx){
        const fn = registry[action];
        if(typeof fn!=='function') return false;
        return !!fn(ctx||{});
      }
      function validateDOMActions(){
        // fallback: do not enforce, to avoid blocking start if registry is incomplete
        return true;
      }
      window.FC.actions = { register, dispatch, has, validateDOMActions, lock, isLocked };
    })();
  }

  if(!window.FC.modal){
    (function(){
      const stack = [];
      const closeMap = Object.create(null);
      function register(id, closeFn){ if(id) closeMap[id]=closeFn; }
      function open(id){ if(id) stack.push(id); }
      function close(id){
        const key = id || stack.pop();
        const fn = closeMap[key];
        try{ if(typeof fn==='function') fn(); }catch(_){}
      }
      function top(){ return stack.length? stack[stack.length-1]: null; }
      function closeTop(){ close(); }
      window.FC.modal = { register, open, close, top, closeTop };
    })();
  }
}catch(_){}


try{ window.APP_REQUIRED_SELECTORS = ['#roomsView','#appView','#topTabs','#backToRooms','#floatingAdd','#openMaterialsBtn','#openServicesBtn','#priceModal','#closePriceModal','#cabinetModal','#closeCabinetModal']; }catch(e){}

function validateRequiredDOM(){
  const req = Array.isArray(window.APP_REQUIRED_SELECTORS) ? window.APP_REQUIRED_SELECTORS : [];
  const missing = [];
  for(const sel of req){
    try{ if(!document.querySelector(sel)) missing.push(sel); }
    catch(_){ missing.push(sel); }
  }
  if(missing.length){
    throw new Error(
      'Brak wymaganych elementów DOM: ' + missing.join(', ') +
      '\nNajczęściej: zmieniłeś ID/strukturę w index.html albo wgrałeś niepełne pliki.'
    );
  }
}


/** App namespace to reduce globals and keep concerns separated. */
const FC = (function(){
  'use strict';

  /* ===== Module: utils ===== */
  const utils = {
    uid(){
      // Prefer cryptographically strong UUIDs when available.
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      // Fallback: time + random (kept for older browsers).
      return 'id_' + Date.now() + '_' + Math.floor(Math.random() * 1e9);
    },
    clone(x){
      // Prefer structuredClone when available; fallback to JSON for plain data.
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

  /* ===== Module: storage ===== */
  const storage = {
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
      try{
        localStorage.setItem(key, JSON.stringify(value));
      }catch(e){}
    },
    getRaw(key){
      try{ return localStorage.getItem(key); }catch(e){ return null; }
    },
    setRaw(key, raw){
      try{ localStorage.setItem(key, raw); }catch(e){}
    }
  };

  /* ===== Module: project schema + migrations ===== */
  const CURRENT_SCHEMA_VERSION = 9;

  const DEFAULT_PROJECT = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    kuchnia: { cabinets: [], fronts: [], sets: [], settings: { roomHeight: 250, bottomHeight: 82, legHeight: 10, counterThickness: 3.8, gapHeight: 60, ceilingBlende: 10 } },
    szafa: { cabinets: [], fronts: [], sets: [], settings: { roomHeight: 250, bottomHeight: 82, legHeight: 10, counterThickness: 1.8, gapHeight: 0, ceilingBlende: 5 } },
    pokoj: { cabinets: [], fronts: [], sets: [], settings: { roomHeight: 250, bottomHeight: 82, legHeight: 5, counterThickness: 1.8, gapHeight: 0, ceilingBlende: 0 } },
    lazienka: { cabinets: [], fronts: [], sets: [], settings: { roomHeight: 220, bottomHeight: 82, legHeight: 15, counterThickness: 2, gapHeight: 0, ceilingBlende: 0 } }
  };

  const ROOMS = ['kuchnia','szafa','pokoj','lazienka'];


  function migrateV1toV2(data){
    const fn = window.FC && window.FC.migrations && window.FC.migrations.migrateV1toV2;
    return (typeof fn === 'function') ? fn(data) : Object.assign(utils.clone(data || {}), { schemaVersion: 2 });
  }

  function migrateV2toV3(data){
    const fn = window.FC && window.FC.migrations && window.FC.migrations.migrateV2toV3;
    return (typeof fn === 'function') ? fn(data) : utils.clone(data || {});
  }

  function migrateV3toV4(data){
    const fn = window.FC && window.FC.migrations && window.FC.migrations.migrateV3toV4;
    return (typeof fn === 'function') ? fn(data) : utils.clone(data || {});
  }

  function migrateV4toV5(data){
    const fn = window.FC && window.FC.migrations && window.FC.migrations.migrateV4toV5;
    return (typeof fn === 'function') ? fn(data) : utils.clone(data || {});
  }

  function normalizeRoom(roomRaw, roomDefault){
    const fn = window.FC && window.FC.migrations && window.FC.migrations.normalizeRoom;
    return (typeof fn === 'function') ? fn(roomRaw, roomDefault) : {
      cabinets: Array.isArray(roomRaw && roomRaw.cabinets) ? roomRaw.cabinets : [],
      fronts: Array.isArray(roomRaw && roomRaw.fronts) ? roomRaw.fronts : [],
      sets: Array.isArray(roomRaw && roomRaw.sets) ? roomRaw.sets : [],
      settings: utils.isPlainObject(roomRaw && roomRaw.settings) ? roomRaw.settings : utils.clone(roomDefault && roomDefault.settings || {})
    };
  }

  function migrateV5toV6(data){
    const fn = window.FC && window.FC.migrations && window.FC.migrations.migrateV5toV6;
    return (typeof fn === 'function') ? fn(data) : utils.clone(data || {});
  }

  function migrateV6toV7(data){
    const fn = window.FC && window.FC.migrations && window.FC.migrations.migrateV6toV7;
    return (typeof fn === 'function') ? fn(data) : utils.clone(data || {});
  }

  function migrateV7toV8(data){
    const fn = window.FC && window.FC.migrations && window.FC.migrations.migrateV7toV8;
    return (typeof fn === 'function') ? fn(data) : utils.clone(data || {});
  }

  function normalizeProject(raw){
    const fn = window.FC && window.FC.migrations && window.FC.migrations.normalizeProject;
    return (typeof fn === 'function')
      ? fn(raw, DEFAULT_PROJECT, CURRENT_SCHEMA_VERSION)
      : utils.clone(raw || DEFAULT_PROJECT);
  }

function normalizeProjectData(data, defaults){
  return callExtracted('projectBootstrap','normalizeProjectData',[data, defaults], function(pd, defs){
    ['kuchnia','szafa','pokoj','lazienka'].forEach(r=>{
      if(!pd[r]) pd[r] = utils.clone(defs[r]);
      if(!Array.isArray(pd[r].cabinets)) pd[r].cabinets = [];
      if(!pd[r].settings) pd[r].settings = utils.clone(defs[r].settings);
      if(!Array.isArray(pd[r].fronts)) pd[r].fronts = [];
      if(!Array.isArray(pd[r].sets)) pd[r].sets = [];

      // numeracja zestawów jeśli brak
      let n = 1;
      pd[r].sets.forEach(s=>{
        if(typeof s.number !== 'number'){
          s.number = n;
        }
        n = Math.max(n, s.number + 1);
      });

      const map = new Map(pd[r].sets.map(s=>[s.id, s.number]));
      pd[r].cabinets.forEach(c=>{
        if(c.setId && typeof c.setNumber !== 'number'){
          const num = map.get(c.setId);
          if(typeof num === 'number') c.setNumber = num;
        }
        if(typeof c.frontCount !== 'number') c.frontCount = 2; // domyślnie 2 (dla standardów)
        if(!c.details) c.details = {};
      });
    });
    return normalizeProject(pd);
  });
}
let projectData = (function(){
  const rawPrimary = storage.getRaw(STORAGE_KEYS.projectData);
  const rawBackup  = storage.getRaw(STORAGE_KEYS.projectBackup);
  function parseOrNull(raw){
    if (!raw) return null;
    try{ return JSON.parse(raw); }catch(_){ return null; }
  }
  const primaryObj = parseOrNull(rawPrimary);
  const backupObj  = parseOrNull(rawBackup);
  const chosen = primaryObj || backupObj || DEFAULT_PROJECT;
  if (!primaryObj && backupObj){
    storage.setRaw(STORAGE_KEYS.projectData, rawBackup);
  }
  return normalizeProject(chosen);
})();

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
  try{
    const mod = window.FC && window.FC.calc;
    if(mod && typeof mod.calculateAvailableTopHeight === 'function'){
      return mod.calculateAvailableTopHeight(projectData);
    }
  }catch(_){ }
  const s = projectData.kuchnia.settings;
  const h = (Number(s.roomHeight)||0) - (Number(s.bottomHeight)||0) - (Number(s.counterThickness)||0) - (Number(s.gapHeight)||0) - (Number(s.ceilingBlende)||0);
  return h>0?Math.round(h*10)/10:0;
}
function renderTopHeight(){
  return callExtracted('settingsUI', 'renderTopHeight', arguments, function(){
    const el = document.getElementById('autoTopHeight');
    if(el) el.textContent = calculateAvailableTopHeight();
  });
}

function calcTopForSet(room, blende, sumLowerHeights){
  try{
    const mod = window.FC && window.FC.calc;
    if(mod && typeof mod.calcTopForSet === 'function'){
      return mod.calcTopForSet(projectData, room, blende, sumLowerHeights);
    }
  }catch(_){ }
  const s = projectData && projectData[room] && projectData[room].settings ? projectData[room].settings : {};
  const h = (Number(s.roomHeight)||0) - (Number(sumLowerHeights)||0) - (Number(blende)||0);
  return h>0?Math.round(h*10)/10:0;
}

// ZESTAWY: top = roomHeight - suma niższych - blenda
function toggleExpandAll(id){
  return callExtracted('settingsUI', 'toggleExpandAll', arguments, function(id){
    const key = String(id);
    const isOpen = !!(uiState.expanded && uiState.expanded[key]);
    uiState.expanded = {};
    if(!isOpen){
      uiState.expanded[key] = true;
      uiState.selectedCabinetId = key;
    }
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    const activeTab = String(uiState.activeTab || '');
    if(activeTab !== 'pokoje' && activeTab !== 'inwestor' && activeTab !== 'rozrys' && activeTab !== 'magazyn'){
      renderCabinets();
    }
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

/* ===== Cabinet/front rules moved to js/app/cabinet-fronts.js ===== */
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

/* ===== Cabinet modal + set wizard moved to js/app/cabinet-modal.js ===== */
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


/* ===== add cabinet (opens modal) ===== */
function addCabinet(){
  if(!uiState.roomType){ alert('Wybierz pomieszczenie najpierw'); return; }
  openCabinetModalForAdd();
}


/* ===== Delete cabinet by id (used by per-card delete) ===== */
function deleteCabinetById(cabId){
  const room = uiState.roomType; if(!room) return;
  if(!cabId){ alert('Wybierz szafkę do usunięcia'); return; }

  const cab = (projectData[room].cabinets || []).find(c => c.id === cabId);
  const label = cab ? `${cab.type || 'szafka'} ${cab.subType ? '('+cab.subType+')' : ''} ${cab.width}×${cab.height}×${cab.depth}` : 'szafkę';
  if(!confirm(`Usunąć ${label}?`)) return;

  // usuń powiązane fronty
  removeFrontsForCab(room, cabId);

  projectData[room].cabinets = (projectData[room].cabinets || []).filter(c => c.id !== cabId);

  if(uiState.selectedCabinetId === cabId) uiState.selectedCabinetId = null;

  FC.storage.setJSON(STORAGE_KEYS.projectData, projectData);
  FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
  renderCabinets();
}


/* ===== Price modal functions ===== */
function closePriceModal(){ return callExtracted('priceModal','closePriceModal',[]); }

function saveMaterialFromForm(){ return callExtracted('priceModal','saveMaterialFromForm',[]); }

function saveServiceFromForm(){ return callExtracted('priceModal','saveServiceFromForm',[]); }

function deletePriceItem(item){ return callExtracted('priceModal','deletePriceItem',[item]); }

/* ===== Cabinet Modal helpers ===== */
function getCabinetExtraSummary(room, cab){
  return callExtracted('cabinetSummary', 'getCabinetExtraSummary', arguments, function(){ return ''; });
}


/* ===== Materiały: rozpiska mebli (korpusy/plecy/trawersy) ===== */
const FC_BOARD_THICKNESS_CM = (window.FC && window.FC.materialCommon && window.FC.materialCommon.FC_BOARD_THICKNESS_CM) || 1.8; // domyślnie płyta 18mm
const FC_TOP_TRAVERSE_DEPTH_CM = (window.FC && window.FC.materialCommon && window.FC.materialCommon.FC_TOP_TRAVERSE_DEPTH_CM) || 9; // trawersy górne

function fmtCm(v){ return callExtracted('materialCommon','fmtCm',[v], function(x){ const n = Number(x); return Number.isFinite(n) ? (Math.round(n * 10) / 10).toString() : String(x ?? ''); }); }
function formatM2(v){ return callExtracted('materialCommon','formatM2',[v], function(x){ const n = Number(x); return Number.isFinite(n) ? (Math.round(n * 1000) / 1000).toFixed(3) : '0.000'; }); }
function escapeHtml(str){ return callExtracted('materialCommon','escapeHtml',[str], function(s){ return String(s ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch] || ch)); }); }
function calcPartAreaM2(p){ return callExtracted('materialCommon','calcPartAreaM2',[p], function(part){ const a = Number(part && part.a) || 0; const b = Number(part && part.b) || 0; const qty = Number(part && part.qty) || 0; return qty * (a * b) / 10000; }); }
function addArea(map, material, area){ return callExtracted('materialCommon','addArea',[map, material, area], function(dst, mat, val){ const key = String(mat || ''); if(!key) return; dst[key] = (dst[key] || 0) + (Number(val) || 0); }); }
function totalsFromParts(parts){ return callExtracted('materialCommon','totalsFromParts',[parts], function(list){ const totals = {}; (list || []).forEach(p => addArea(totals, p.material, calcPartAreaM2(p))); return totals; }); }
function mergeTotals(target, src){ return callExtracted('materialCommon','mergeTotals',[target, src], function(dst, from){ for(const k in (from || {})){ dst[k] = (dst[k] || 0) + (from[k] || 0); } return dst; }); }
function totalsToRows(totals){ return callExtracted('materialCommon','totalsToRows',[totals], function(sum){ return Object.entries(sum || {}).map(([material, m2]) => ({ material, m2 })).filter(r => r.m2 > 0).sort((a,b) => b.m2 - a.m2); }); }
function renderTotals(container, totals){ return callExtracted('materialCommon','renderTotals',[container, totals], function(el){ if(el) el.innerHTML = ''; }); }
function getCabinetAssemblyRuleText(cab){ return callExtracted('materialCommon','getCabinetAssemblyRuleText',[cab], function(obj){ if(obj && obj.type === 'wisząca' || obj && obj.type === 'moduł') return 'Skręcanie: wieniec górny i dolny między bokami.'; if(obj && obj.type === 'stojąca') return `Skręcanie: wieniec dolny pod bokami (boki niższe o ${FC_BOARD_THICKNESS_CM} cm); góra na trawersach 2×${FC_TOP_TRAVERSE_DEPTH_CM} cm (przód+tył).`; return 'Skręcanie: —'; }); }

function getCabinetFrontCutListForMaterials(room, cab){ return callExtracted('frontHardware','getCabinetFrontCutListForMaterials',[room, cab], function(){ return []; }); }
function cabinetHasHandle(cab){ return callExtracted('frontHardware','cabinetHasHandle',[cab], function(obj){ const os = String(obj?.openingSystem || '').toLowerCase(); return !(os.includes('tip-on') || os.includes('podchwyt')); }); }
function getFrontWeightKgM2(frontMaterial){ return callExtracted('frontHardware','getFrontWeightKgM2',[frontMaterial], function(material){ const m = String(material || 'laminat').toLowerCase(); return ({ laminat:13.0, akryl:14.44, lakier:14.44 })[m] || 13.0; }); }
function estimateFrontWeightKg(wCm, hCm, frontMaterial, hasHandle){ return callExtracted('frontHardware','estimateFrontWeightKg',[wCm, hCm, frontMaterial, hasHandle], function(w, h, material, handle){ const area = (Math.max(0, Number(w) || 0) / 100) * (Math.max(0, Number(h) || 0) / 100); return area * getFrontWeightKgM2(material) + (handle ? 0.2 : 0); }); }
function blumHingesPerDoor(wCm, hCm, frontMaterial, hasHandle){ return callExtracted('frontHardware','blumHingesPerDoor',[wCm, hCm, frontMaterial, hasHandle], function(w, h, material, handle){ const weightKg = estimateFrontWeightKg(w, h, material, handle); const weightLb = weightKg * 2.20462; if(weightLb <= 15) return 2; if(weightLb <= 30) return 3; if(weightLb <= 45) return 4; if(weightLb <= 60) return 5; return 5 + Math.ceil((weightLb - 60) / 15); }); }
function getDoorFrontPanelsForHinges(room, cab){ return callExtracted('frontHardware','getDoorFrontPanelsForHinges',[room, cab], function(){ return []; }); }
function getHingeCountForCabinet(room, cab){ return callExtracted('frontHardware','getHingeCountForCabinet',[room, cab], function(){ return 0; }); }
function estimateFlapWeightKg(cab, room){ return callExtracted('frontHardware','estimateFlapWeightKg',[cab, room], function(){ return 0; }); }
function blumAventosPowerFactor(cab, room){ return callExtracted('frontHardware','blumAventosPowerFactor',[cab, room], function(){ return 0; }); }
function getBlumAventosInfo(cab, room){ return callExtracted('frontHardware','getBlumAventosInfo',[cab, room], function(){ return null; }); }

function getCabinetCutList(cab, room){
  return callExtracted('cabinetCutlist','getCabinetCutList',[cab, room], _getCabinetCutListFallback);
}

function _getCabinetCutListFallback(cab, room){
  // Fallback awaryjny celowo minimalny: właściwa logika siedzi w js/app/cabinet-cutlist.js.
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
  const list = document.getElementById('cabinetsList'); list.innerHTML = '';
  const room = uiState.roomType;
  document.getElementById('roomTitle').textContent = room ? room.charAt(0).toUpperCase()+room.slice(1) : 'Pomieszczenie';
  if(!room) return;

  const s = projectData[room].settings;
  document.getElementById('roomHeight').value = s.roomHeight;
  document.getElementById('bottomHeight').value = s.bottomHeight;
  document.getElementById('legHeight').value = s.legHeight;
  document.getElementById('counterThickness').value = s.counterThickness;
  document.getElementById('gapHeight').value = s.gapHeight;
  document.getElementById('ceilingBlende').value = s.ceilingBlende;
  renderTopHeight();

  // Zakładki — routing przez moduły (js/app/tabs-router.js + js/tabs/*)
  // Dzięki temu każda zakładka ma osobny plik i minimalizujemy ryzyko psucia innych sekcji.
  try{
    if(window.FC && window.FC.tabsRouter && typeof window.FC.tabsRouter.switchTo === 'function'){
      window.FC.tabsRouter.switchTo(uiState.activeTab, { listEl: list, room });
      return;
    }
  }catch(_){ }

  // Fallback (gdyby router nie był dostępny): zachowaj minimalne działanie.
  if(uiState.activeTab === 'material') return renderMaterialsTab(list, room);
  if(uiState.activeTab === 'rysunek') return renderDrawingTab(list, room);
  return renderWywiadTab(list, room);
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
  cabEl.className = 'cabinet';
  cabEl.id = `cab-${cab.id}`;
  if(uiState.selectedCabinetId === cab.id) cabEl.classList.add('selected');

  const header = document.createElement('div');
  header.className = 'cabinet-header';

  const left = document.createElement('div');
  const badge = cab.setId && typeof cab.setNumber === 'number'
    ? `<span class="badge">Zestaw ${cab.setNumber}</span>`
    : '';
  left.innerHTML = `<div style="font-weight:900">#${displayIndex} • ${cab.type} • ${cab.subType||''}${badge}</div>
                    <div class="muted xs">${cab.frontMaterial || ''} • ${cab.frontColor || ''}</div>`;

  const right = document.createElement('div');
  right.style.display = 'flex';
  right.style.gap = '10px';
  right.style.alignItems = 'center';

  const dims = document.createElement('div');
  dims.className = 'muted xs';
  dims.textContent = `${cab.width} × ${cab.height} × ${cab.depth}`;

  const actions = document.createElement('div');
  actions.className = 'cab-actions';
  actions.innerHTML = `<button class="btn" data-act="edit" type="button">Edytuj</button> <button class="btn" data-act="mat" type="button">Materiały</button> <button class="btn btn-danger" data-act="del" type="button">Usuń</button>`;

  right.appendChild(dims);
  right.appendChild(actions);

  header.appendChild(left);
  header.appendChild(right);
  cabEl.appendChild(header);

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
function renderPriceModal(){
  try{
    const mod = window.FC && window.FC.priceModal;
    if(mod && typeof mod.renderPriceModal === 'function'){
      return mod.renderPriceModal();
    }
  }catch(_){ }
}


// Tab/navigation helpers extracted to js/app/tab-navigation.js
function jumpToMaterialsForCabinet(cabId){
  try{
    const mod = window.FC && window.FC.tabNavigation;
    if(mod && typeof mod.jumpToMaterialsForCabinet === 'function'){
      return mod.jumpToMaterialsForCabinet(cabId);
    }
  }catch(_){ }
}

function jumpToCabinetFromMaterials(cabId){
  try{
    const mod = window.FC && window.FC.tabNavigation;
    if(mod && typeof mod.jumpToCabinetFromMaterials === 'function'){
      return mod.jumpToCabinetFromMaterials(cabId);
    }
  }catch(_){ }
}

// Centralne przełączanie zakładek (używane też przez przyciski "skoku")
// RYZYKO REGRESJI: przełączanie zakładek wpływa też na odświeżanie danych i render.
// Nie zmieniać kolejności efektów ubocznych bez testu całego przepływu projektu.
function setActiveTab(tabName){
  try{
    const mod = window.FC && window.FC.tabNavigation;
    if(mod && typeof mod.setActiveTab === 'function'){
      return mod.setActiveTab(tabName);
    }
  }catch(_){ }
}


/* ===== UI wiring & init ===== */

function registerCoreActions(){
  // Core modules are optional at runtime (GitHub Pages/cache can temporarily serve stale assets).
  // We always provide fail-soft fallbacks at the top of this file.
  window.FC = window.FC || {};
  if(!window.FC.actions){
    // Fallback should have created this already; keep a defensive guard.
    window.FC.actions = window.FC.actions || {
      register(){},
      dispatch(){ return false; },
      has(){ return false; },
      validateDOMActions(){ return true; },
      lock(){},
      isLocked(){ return false; }
    };
  }
  if(!window.FC.modal){
    window.FC.modal = window.FC.modal || {
      register(){},
      open(){},
      close(){},
      top(){ return null; },
      closeTop(){}
    };
  }
  // Bridge core modules into local FC namespace used in this file
  FC.actions = window.FC.actions;
  FC.modal = window.FC.modal;

  // Register modal close functions for ESC/overlay stack handling
  try{
    FC.modal.register('priceModal', () => { try{ closePriceModal(); }catch(_){ } });
    FC.modal.register('cabinetModal', () => { try{ closeCabinetModal(); }catch(_){ } });
  }catch(_){}

  /* Actions moved to js/app/actions-register.js */

}

function initApp(){
  // Fail fast if HTML is missing required elements
  validateRequiredDOM();

  // Register actions + modals and validate that DOM doesn't reference unknown actions
  registerCoreActions();
  FC.actions.validateDOMActions(document);

  return initUI();
}

// RYZYKO REGRESJI: główny start aplikacji.
// Tu spinają się fallbacki, modale, walidacja akcji i inicjalizacja widoków.

let __autosaveTimer = null;
function scheduleProjectAutosave(){
  try{
    clearTimeout(__autosaveTimer);
  }catch(_){ }
  __autosaveTimer = setTimeout(function(){
    try{
      if(window.FC && FC.project && typeof FC.project.save === 'function'){
        projectData = FC.project.save(projectData);
      }
    }catch(_){ }
  }, 180);
}

function installProjectAutosave(){
  if(window.__fcProjectAutosaveInstalled) return;
  window.__fcProjectAutosaveInstalled = true;
  const root = document.getElementById('appView') || document;
  const handler = function(ev){
    try{
      const t = ev && ev.target;
      if(!t || !t.closest) return;
      if(t.closest('#priceModal')) return;
      if(t.closest('#investorRoot')) return;
      scheduleProjectAutosave();
    }catch(_){ }
  };
  root.addEventListener('change', handler, true);
  root.addEventListener('input', handler, true);
  root.addEventListener('click', function(ev){
    try{
      const t = ev && ev.target;
      if(!t || !t.closest) return;
      if(t.closest('#priceModal')) return;
      if(t.closest('#investorRoot')) return;
      if(t.closest('[data-action]') || t.closest('[data-act]') || t.closest('.tab-btn') || t.closest('.room-card') || t.closest('button')){
        scheduleProjectAutosave();
      }
    }catch(_){ }
  }, true);
}

function initUI(){
  uiState = uiState || __uiDefaults;

  // Event wiring extracted to js/app/bindings.js
  try{ window.FC && window.FC.bindings && typeof window.FC.bindings.install === 'function' && window.FC.bindings.install(); }
  catch(_){ /* keep UI alive even if bindings fail */ }

  try{ installProjectAutosave(); }catch(_){ }

  // Views (home/rooms/app/placeholders)
  try{
    if(!uiState.entry) uiState.entry = 'home';
    // Restore sensible working context after refresh: if a room is already selected,
    // do not fall back to home just because persisted entry stayed as 'home'.
    if(uiState.roomType && (!uiState.entry || uiState.entry === 'home')){
      uiState.entry = 'app';
      try{ FC.storage.setJSON(STORAGE_KEYS.ui, uiState); }catch(_){ }
    }
    if(window.FC && window.FC.views && window.FC.views.applyFromState) window.FC.views.applyFromState(uiState);
  }catch(_){
    // fallback legacy behavior
    if(uiState.roomType){
      document.getElementById('roomsView').style.display='none';
      document.getElementById('appView').style.display='block';
      document.getElementById('topTabs').style.display = 'grid';
    } else {
      document.getElementById('roomsView').style.display='block';
      document.getElementById('appView').style.display='none';
      document.getElementById('topTabs').style.display = 'none';
    }
  }

  document.querySelectorAll('.tab-btn').forEach(t=> t.style.background = (t.getAttribute('data-tab') === uiState.activeTab) ? '#e6f7ff' : 'var(--card)');

  renderTopHeight();
  renderCabinets();
}



/* ===== Set wizard minimal (reuse existing from previous version) ===== */
/* Layout/state helpers for RYSUNEK moved to js/app/layout-state.js.
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

// --- Expose stable entrypoint for boot.js ---
try{
  FC.init = initApp;
  // Expose safe helpers for external scripts / hotfixes
  FC.openRoom = function(room){
    uiState.roomType = room;
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    const rv = document.getElementById('roomsView');
    const av = document.getElementById('appView');
    const tabs = document.getElementById('topTabs');
    if(rv) rv.style.display='none';
    if(av) av.style.display='block';
    if(tabs) tabs.style.display = 'inline-block';
    uiState.activeTab = uiState.activeTab || 'wywiad';
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    try{ document.querySelectorAll('.tab-btn').forEach(tbtn => tbtn.style.background = (tbtn.getAttribute('data-tab') === uiState.activeTab) ? '#e6f7ff' : 'var(--card)'); }catch(_){}
    try{ renderTopHeight(); }catch(_){}
    try{ renderCabinets(); }catch(_){}
    try{ window.scrollTo({top:0, behavior:'smooth'}); } catch(_){ window.scrollTo(0,0); }
  };
  FC.setActiveTabSafe = function(tab){
    try{ setActiveTab(tab); }catch(_){}
  };
  // ===== Public safe APIs (used by hotfix / delegation) =====
// Open price modal for 'materials' or 'services'
FC.openPriceListSafe = function(kind){
  try{
    if(kind !== 'materials' && kind !== 'services') kind = 'materials';
    uiState.showPriceList = kind;
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    renderPriceModal();
    const pm = document.getElementById('priceModal');
    if(pm) pm.style.display = 'flex';
  }catch(e){}
};
FC.closePriceModalSafe = function(){
  try{
    const pm = document.getElementById('priceModal');
    if(pm) pm.style.display = 'none';
    uiState.showPriceList = null;
    uiState.editingId = null;
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
  }catch(e){}
};
FC.addCabinetSafe = function(){
  try{ addCabinet(); }catch(e){}
};
FC.closeCabinetModalSafe = function(){
  try{ closeCabinetModal(); }catch(e){}
};
  window.FC = Object.assign(window.FC || {}, FC);
  window.App = window.App || { init: initUI };
}catch(e){}
// ===== INIT ADAPTER (makes boot.js always able to start the app) =====
try {
  window.FC = window.FC || {};
  window.App = window.App || {};

  // If your app has initUI() function, expose it as FC.init/App.init
  if (typeof window.FC.init !== 'function' && typeof initUI === 'function') window.FC.init = initApp;
  if (typeof window.App.init !== 'function' && typeof initUI === 'function') window.App.init = initUI;

  // If your app uses initApp(), also expose it
  if (typeof window.FC.init !== 'function' && typeof initApp === 'function') window.FC.init = initApp;
  if (typeof window.App.init !== 'function' && typeof initApp === 'function') window.App.init = initApp;
} catch (e) {}

})();

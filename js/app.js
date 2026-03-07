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
    // v1 had no schemaVersion. v2 introduces schemaVersion at root.
    const out = utils.clone(data || {});
    out.schemaVersion = 2;
    return out;
  }


  function migrateV2toV3(data){
    // v3: sensible defaults for base cabinet height & kitchen legs
    const out = utils.clone(data || {});
    for (const r of ROOMS){
      const room = out[r] = utils.isPlainObject(out[r]) ? out[r] : {};
      const settings = room.settings = utils.isPlainObject(room.settings) ? room.settings : {};
      const bh = Number(settings.bottomHeight);
      if (!Number.isFinite(bh) || bh <= 0) settings.bottomHeight = 82;

      if (r === 'kuchnia'){
        const lh = Number(settings.legHeight);
        if (!Number.isFinite(lh) || lh <= 0) settings.legHeight = 10;
      }
    }
    out.schemaVersion = 3;
    return out;
  }

  
  function migrateV3toV4(data){
    // v4: standing standard cabinets get explicit inside mode + internal drawer defaults
    const out = utils.clone(data || {});
    for (const r of ROOMS){
      const room = out[r] = utils.isPlainObject(out[r]) ? out[r] : {};
      const cabinets = Array.isArray(room.cabinets) ? room.cabinets : [];
      for (const cab of cabinets){
        if(!cab || typeof cab !== 'object') continue;
        if(cab.type === 'stojąca' && (cab.subType || 'standardowa') === 'standardowa'){
          cab.details = utils.isPlainObject(cab.details) ? cab.details : {};
          if(!('insideMode' in cab.details)) cab.details.insideMode = 'polki';
          if(!('innerDrawerCount' in cab.details)) cab.details.innerDrawerCount = '1';
          if(!('innerDrawerType' in cab.details)) cab.details.innerDrawerType = 'blum';
        }
        if(cab.type === 'stojąca' && (cab.subType || '') === 'piekarnikowa'){
          cab.details = utils.isPlainObject(cab.details) ? cab.details : {};
          if(!('ovenOption' in cab.details)) cab.details.ovenOption = 'szuflada_dol';
          const oh = Number(cab.details.ovenHeight);
          if(!('ovenHeight' in cab.details) || !isFinite(oh) || oh <= 0) cab.details.ovenHeight = '60';
          const tc = parseInt(cab.details.techShelfCount, 10);
          if(!('techShelfCount' in cab.details) || !Number.isFinite(tc) || tc <= 0) cab.details.techShelfCount = '1';
          const sh = Number(cab.details.shelves);
          if(!('shelves' in cab.details) || !isFinite(sh) || sh < 0) cab.details.shelves = 0;
        }
      }
    }
    out.schemaVersion = 4;
    return out;
  }


  function migrateV4toV5(data){
    // v5: standing oven cabinets shouldn't default to 1 shelf in summaries; set shelves to 0 unless explicitly meaningful.
    const out = utils.clone(data || {});
    for (const r of ROOMS){
      const room = utils.isPlainObject(out[r]) ? out[r] : {};
      const cabs = Array.isArray(room.cabinets) ? room.cabinets : [];
      for (const cab of cabs){
        if(!cab || typeof cab !== 'object') continue;
        if(cab.type === 'stojąca' && (cab.subType || '') === 'piekarnikowa'){
          cab.details = utils.isPlainObject(cab.details) ? cab.details : {};
          // If shelves is missing or equals 1 (legacy default), normalize to 0 to avoid misleading UI.
          const sh = Number(cab.details.shelves);
          if(!('shelves' in cab.details) || !isFinite(sh) || sh === 1){
            cab.details.shelves = 0;
          }
        }
      }
    }
    out.schemaVersion = 5;
    return out;
  }

function normalizeRoom(roomRaw, roomDefault){
    const room = utils.isPlainObject(roomRaw) ? roomRaw : {};
    const def = roomDefault;

    const cabinets = Array.isArray(room.cabinets) ? room.cabinets : [];
    const fronts   = Array.isArray(room.fronts)   ? room.fronts   : [];
    const sets     = Array.isArray(room.sets)     ? room.sets     : [];

    const sRaw = utils.isPlainObject(room.settings) ? room.settings : {};
    const sDef = def.settings;

    const settings = {
      roomHeight: utils.num(sRaw.roomHeight, sDef.roomHeight),
      bottomHeight: utils.num(sRaw.bottomHeight, sDef.bottomHeight),
      legHeight: utils.num(sRaw.legHeight, sDef.legHeight),
      counterThickness: utils.num(sRaw.counterThickness, sDef.counterThickness),
      gapHeight: utils.num(sRaw.gapHeight, sDef.gapHeight),
      ceilingBlende: utils.num(sRaw.ceilingBlende, sDef.ceilingBlende),
    };

    // Derived/normalized cabinet fields that depend on room settings.
    const calcTechDividers = (frontH) => {
      const fh = Number(frontH) || 0;
      if(!(fh > 74.5)) return 0;
      // 74.6–76.5 => 1; 76.6–78.5 => 2; ...
      return Math.max(0, Math.ceil(((fh - 74.5) / 2) - 1e-9));
    };

    const leg = Number(settings.legHeight) || 0;
    const bottomFrontH = Math.max(0, (Number(settings.bottomHeight) || 0) - leg);

    const normCabinets = cabinets.map((c) => {
      if(!utils.isPlainObject(c)) return c;
      const cab = { ...c };
      const d = utils.isPlainObject(cab.details) ? { ...cab.details } : {};

      if(cab.subType === 'zmywarkowa'){
        const frontH = (Number(cab.height) || 0) - leg;
        d.techDividerCount = String(calcTechDividers(frontH));
        d.shelves = 0;
        cab.frontCount = 1;
      }

      if(cab.subType === 'lodowkowa'){
        const opt = d.fridgeOption ? String(d.fridgeOption) : 'zabudowa';
        if(opt === 'zabudowa'){
          const div = calcTechDividers(bottomFrontH);
          d.techDividerCount = String(div);
          d.shelves = 0;
          const bh = Number(settings.bottomHeight) || 0;
          const lh = Number(settings.legHeight) || 0;
          const nh = Number(d.fridgeNicheHeight) || 0;
          // Wysokość lodówkowej (zabudowa): nisza + (przegrody*1.8) + 3.6 + nóżki
          if(nh > 0){
            cab.height = nh + (div * 1.8) + 3.6 + lh;
          }
        } else {
          d.techDividerCount = '0';
          d.shelves = 0;
        }
      }

      
      if(cab.subType === 'szuflady'){
        // ujednolicenie pól dla szuflad stojących
        let lay = String(d.drawerLayout || '');
        if(!lay){
          const legacy = String(d.drawerCount || '3');
          if(legacy === '1') lay = '1_big';
          else if(legacy === '2') lay = '2_equal';
          else if(legacy === '3') lay = '3_1_2_2';
          else if(legacy === '5') lay = '5_equal';
          else lay = '3_equal';
        }
        d.drawerLayout = lay;
        if(!d.drawerSystem) d.drawerSystem = 'skrzynkowe';
      if(!d.drawerBrand) d.drawerBrand = 'blum';
      if(!d.drawerModel) d.drawerModel = 'tandembox';
        if(!('innerDrawerType' in d)) d.innerDrawerType = 'brak';
        if(!('innerDrawerCount' in d) || d.innerDrawerCount == null){
          d.innerDrawerCount = (lay === '3_equal') ? '3' : '2';
        }
        // limity: max 2 (dla 1/2/1:2:2), max 3 (dla 3_equal), brak (dla 5_equal)
        if(lay === '5_equal'){
          d.innerDrawerType = 'brak';
          d.innerDrawerCount = '0';
        } else if(lay === '3_equal'){
          const n = Math.min(3, Math.max(0, parseInt(d.innerDrawerCount, 10) || 0));
          d.innerDrawerCount = String(n > 0 ? n : 3);
        } else {
          const n = Math.min(2, Math.max(0, parseInt(d.innerDrawerCount, 10) || 0));
          d.innerDrawerCount = String(n > 0 ? n : 2);
        }

        // ustaw frontCount zgodnie z układem
        let fc = 3;
        if(lay === '1_big') fc = 1;
        else if(lay === '2_equal') fc = 2;
        else if(lay === '3_equal') fc = 3;
        else if(lay === '5_equal') fc = 5;
        else if(lay === '3_1_2_2') fc = 3;
        cab.frontCount = fc;
      }
cab.details = d;
      return cab;
    });

    return { cabinets: normCabinets, fronts, sets, settings };
  }

  
  function migrateV5toV6(data){
    // v6: add technical shelf for standing oven cabinets (piekarnikowa)
    // Legacy "shelves" (often default 1) is treated as technical shelf count, and user shelves are reset to 0.
    const out = utils.clone(data || {});
    for (const r of ROOMS){
      const room = utils.isPlainObject(out[r]) ? out[r] : {};
      const cabs = Array.isArray(room.cabinets) ? room.cabinets : [];
      for (const cab of cabs){
        if(!cab || typeof cab !== 'object') continue;
        if(cab.type === 'stojąca' && (cab.subType || '') === 'piekarnikowa'){
          cab.details = utils.isPlainObject(cab.details) ? cab.details : {};
          const sh = Number(cab.details.shelves);
          // move legacy shelves -> techShelfCount (default 1)
          if(!('techShelfCount' in cab.details)){
            if(isFinite(sh) && sh > 0){
              cab.details.techShelfCount = String(Math.round(sh));
            } else {
              cab.details.techShelfCount = '1';
            }
          }
          // user shelves for oven cabinet default to 0 (separate from tech shelf)
          cab.details.shelves = 0;
        }
      }
    }
    out.schemaVersion = 6;
    return out;
  }

  function migrateV6toV7(data){
    // v7: zlewowa — replace legacy sinkOption with structured fields (sinkFront/sinkDoorCount/sinkExtra)
    const out = utils.clone(data);
    for (const r of ROOMS){
      const room = utils.isPlainObject(out[r]) ? out[r] : {};
      const cabs = Array.isArray(room.cabinets) ? room.cabinets : [];
      cabs.forEach(c => {
        if(!c || c.type !== 'stojąca' || c.subType !== 'zlewowa') return;
        c.details = utils.isPlainObject(c.details) ? c.details : {};
        const d = c.details;

        if(!d.sinkFront){
          if(d.sinkOption === 'zwykle_drzwi') d.sinkFront = 'drzwi';
          else if(d.sinkOption === 'szuflada') d.sinkFront = 'szuflada';
          else if(d.sinkOption === 'szuflada_i_polka'){ d.sinkFront = 'szuflada'; d.sinkExtra = d.sinkExtra || 'polka'; }
          else d.sinkFront = 'drzwi';
        }
        if(!d.sinkDoorCount) d.sinkDoorCount = String([1,2].includes(Number(c.frontCount)) ? Number(c.frontCount) : 2);
        if(!d.sinkExtra) d.sinkExtra = 'brak';
        if(d.sinkExtraCount == null) d.sinkExtraCount = 1;
        if(!d.sinkInnerDrawerType) d.sinkInnerDrawerType = 'skrzynkowe';
      if(!d.sinkInnerDrawerBrand) d.sinkInnerDrawerBrand = 'blum';
      if(!d.sinkInnerDrawerModel) d.sinkInnerDrawerModel = 'tandembox';

        // ustaw frontCount zgodnie z wyborem
        if(d.sinkFront === 'szuflada'){
          c.frontCount = 1;
        } else {
          const dc = Number(d.sinkDoorCount) || 2;
          c.frontCount = (dc === 1 ? 1 : 2);
        }
      });
      room.cabinets = cabs;
      out[r] = room;
    }
    out.schemaVersion = 7;
    return out;
  }

function migrateV7toV8(data){
  // v8: zmywarkowa — width selector sync + technical divider count for tall fronts
  const out = utils.clone(data);
  for (const r of ROOMS){
    const room = utils.isPlainObject(out[r]) ? out[r] : {};
    const cabs = Array.isArray(room.cabinets) ? room.cabinets : [];
    const leg = utils.num(room.settings && room.settings.legHeight, utils.num(DEFAULT_PROJECT[r]?.settings?.legHeight, 0));

    cabs.forEach(c => {
      if(!c || c.type !== 'stojąca' || c.subType !== 'zmywarkowa') return;
      c.details = utils.isPlainObject(c.details) ? c.details : {};
      const d = c.details;

      // Width selector default
      let w = d.dishWasherWidth;
      const cw = utils.num(c.width, 0);
      if(!w){
        if(cw === 45) w = '45';
        else if(cw === 60) w = '60';
        else w = '60';
        d.dishWasherWidth = w;
      }
      // Sync cabinet width to selector
      const wn = utils.num(d.dishWasherWidth, 60);
      if(wn) c.width = wn;

      // Technical dividers: 74.6–76.5 => 1; 76.6–78.5 => 2; itd.
      const frontH = utils.num(c.height, 0) - leg;
      const div = (frontH > 74.5) ? Math.max(0, Math.ceil(((frontH - 74.5) / 2) - 1e-9)) : 0;
      d.techDividerCount = String(div);
      // Dishwasher cabinet has no standard shelves
      if(d.shelves == null || utils.num(d.shelves, 0) !== 0) d.shelves = 0;
    });
  }
  out.schemaVersion = 9;
  return out;
}


function normalizeProject(raw){
    let data = utils.isPlainObject(raw) ? raw : {};
    let ver = utils.num(data.schemaVersion, 1);
    if (ver < 1) ver = 1;

    // Stepwise migrations.
    if (ver < 2) data = migrateV1toV2(data);
    if (ver < 3) data = migrateV2toV3(data);
    if (ver < 4) data = migrateV3toV4(data);
    if (ver < 5) data = migrateV4toV5(data);
    if (ver < 6) data = migrateV5toV6(data);
    if (ver < 7) data = migrateV6toV7(data);
    if (ver < 8) data = migrateV7toV8(data);

    const out = { schemaVersion: CURRENT_SCHEMA_VERSION };
    for (const r of ROOMS){
      out[r] = normalizeRoom(data[r], DEFAULT_PROJECT[r]);
    }

    // Keep unknown root-level fields for forward compatibility.
    for (const k of Object.keys(data)){
      if (!(k in out)) out[k] = data[k];
    }
    return out;
  }

  const project = {
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

  return { utils, storage, project };
})();
const DEFAULT_PROJECT = FC.project.DEFAULT_PROJECT;

/* ===== State initialization ===== */
let materials = FC.storage.getJSON(STORAGE_KEYS.materials, [
  { id: 'm1', materialType: 'laminat', manufacturer: 'Egger', symbol: 'W1100', name: 'Egger W1100 ST9 Biały Alpejski', price: 35, hasGrain: false },
  { id: 'm2', materialType: 'akryl', manufacturer: 'Rehau', symbol: 'A01', name: 'Akryl Biały', price: 180, hasGrain: false },
  { id: 'm3', materialType: 'akcesoria', manufacturer: 'blum', symbol: 'B1', name: 'Zawias Blum', price: 18, hasGrain: false }
]);

// Helper: ROZRYS and other modules can ask whether a material has grain direction.
// Matching is done by the displayed material name.
window.FC = window.FC || {};
window.FC.materialHasGrain = function(materialName){
  const name = String(materialName||'').trim();
  if(!name) return false;
  try{
    const it = (Array.isArray(materials) ? materials : []).find(m => String(m.name||'').trim() === name);
    return !!(it && it.hasGrain);
  }catch(_){
    return false;
  }
};
let services = FC.storage.getJSON(STORAGE_KEYS.services, [ { id: 's1', category: 'Montaż', name: 'Montaż Express', price: 120 } ]);
let projectData = FC.project.load();
const __uiDefaults = { activeTab:'wywiad', roomType:null, showPriceList:null, expanded:{}, matExpandedId:null, searchTerm:'', editingId:null, selectedCabinetId:null, lastAddedAt:null, lastAddedCabinetId:null, lastAddedCabinetType:null };
var uiState = FC.storage.getJSON(STORAGE_KEYS.ui, __uiDefaults) || {};
uiState = Object.assign({}, __uiDefaults, uiState);
if (!uiState.expanded || typeof uiState.expanded !== 'object') uiState.expanded = {};
FC.storage.setJSON(STORAGE_KEYS.ui, uiState);

/* ===== Runtime validation (self-healing persisted state) ===== */
try{
  if (window.FC && window.FC.validate){
    const V = window.FC.validate;
    // Validate & repair lists.
    materials = V.validateMaterials ? V.validateMaterials(materials) : materials;
    services  = V.validateServices ? V.validateServices(services) : services;
    projectData = V.validateProject ? V.validateProject(projectData) : projectData;
    uiState   = V.validateUIState ? V.validateUIState(uiState) : uiState;

    // Persist repairs back to storage.
    if (V.persistIfPossible){
      V.persistIfPossible(STORAGE_KEYS.materials, materials);
      V.persistIfPossible(STORAGE_KEYS.services, services);
      V.persistIfPossible(STORAGE_KEYS.projectData, projectData);
      V.persistIfPossible(STORAGE_KEYS.ui, uiState);
    } else {
      FC.storage.setJSON(STORAGE_KEYS.materials, materials);
      FC.storage.setJSON(STORAGE_KEYS.services, services);
      FC.storage.setJSON(STORAGE_KEYS.projectData, projectData);
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
  // Special top-level tabs (available even before selecting a room)
  if(tabName === 'pokoje'){
    uiState.entry = 'rooms';
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    if(window.FC && window.FC.views && window.FC.views.applyFromState) window.FC.views.applyFromState(uiState);
  }
  if(tabName === 'inwestor' || tabName === 'rozrys'){
    // keep entry out of home
    if(uiState.entry === 'home') uiState.entry = 'rooms';
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    if(window.FC && window.FC.views && window.FC.views.applyFromState) window.FC.views.applyFromState(uiState);
  }
    }
  }
}catch(_){ }

const MANUFACTURERS = {
  laminat: ['Egger','KronoSpan','Swiss Krono','Woodeco'],
  akryl: ['Rehau','manufaktura Łomża'],
  lakier: ['elektronowa','Pol-wiór'],
  blat: ['Egger','KronoSpan','Swiss Krono','Woodeco'],
  akcesoria: ['blum','GTV','Peka','Rejs','Nomet','Häfele','Sevroll','Laguna','Hettich']
};

/* ===== Normalize (backward compatibility) ===== */
function normalizeProjectData(data, defaults){
  return callExtracted('projectBootstrap','normalizeProjectData',[data, defaults], function(pd, defs){
    ['kuchnia','szafa','pokoj','lazienka'].forEach(r=>{
      if(!pd[r]) pd[r] = FC.utils.clone(defs[r]);
      if(!Array.isArray(pd[r].cabinets)) pd[r].cabinets = [];
      if(!pd[r].settings) pd[r].settings = FC.utils.clone(defs[r].settings);
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
    return FC.project.save(pd);
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
  return callExtracted('cornerSketch', 'drawCornerSketch', arguments, function(opts){
      const c = document.getElementById('cornerPreview');
      if(!c) return;
      const ctx = c.getContext('2d');

      const GL = Number(opts?.GL) || 0;
      const GP = Number(opts?.GP) || 0;
      const ST = Number(opts?.ST) || 0;
      const SP = Number(opts?.SP) || 0;
      const t  = Number(opts?.t ?? 1.8) || 1.8; // cm
      const flip = !!opts?.flip;

      // computed fronts (Twoje zasady)
      const FL = Math.abs(GL - GP);
      const FP = Math.abs(ST - SP - t);

      // pomocniczo dla podpisów / strzałek
      // Po FLIP chcemy, żeby "lewa strona rysunku" pokazywała dawną prawą głębokość (GP)
      // i odwrotnie – bez lustrzanego odwracania tekstu.
      const yLeftSide  = flip ? GP : GL;
      const yRightSide = flip ? GL : GP;
      const yFrontLine = Math.max(GL, GP);

      const W = c.width, H = c.height;
      ctx.clearRect(0,0,W,H);

      // marginesy
      const m = 55;
      const drawW = W - 2*m;
      const drawH = H - 2*m;

      const maxDepth = Math.max(GL, GP, 1);
      const sx = drawW / Math.max(1, ST);
      const sy = drawH / maxDepth;
      const s = Math.min(sx, sy);

      const ox = m, oy = m;
      const X = (v) => ox + v*s;
      const Y = (v) => oy + v*s;

      // Geometria poglądowa (top‑down) zgodna z Twoimi parametrami.
      // Kluczowe: przy flip rysunek jest LUSTROWANY, a nie tylko "przestawiany" punkt schodka.
      // Dzięki temu odcinek czerwony odpowiada zawsze FP = |ST − SP − t|.

      const notchX0 = Math.max(0, Math.min(ST, SP + t)); // oś "schodka" w bazowej orientacji
      const tx = (x) => (flip ? (ST - x) : x);

      // Punkty obrysu w bazie (bez flip), potem ewentualne lustrzane odbicie w osi pionowej.
      const ptsBase = [
        {x:0,    y:0},
        {x:ST,   y:0},
        {x:ST,   y:GP},
        {x:notchX0, y:GP},
        {x:notchX0, y:GL},
        {x:0,    y:GL}
      ];
      const pts = ptsBase.map(p => ({ x: tx(p.x), y: p.y }));

      // obrys korpusu (czarny)
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#111";
      ctx.beginPath();
      ctx.moveTo(X(pts[0].x), Y(pts[0].y));
      for(let i=1;i<pts.length;i++) ctx.lineTo(X(pts[i].x), Y(pts[i].y));
      ctx.closePath();
      ctx.stroke();

      // fronty (czerwony):
      // FL = |GL−GP| to pion schodka (pomiędzy y=GP i y=GL),
      // FP = |ST−SP−t| to poziom schodka (pomiędzy x=notch a skrajem).
      const pNotchTop = { x: tx(notchX0), y: GP };
      const pNotchBot = { x: tx(notchX0), y: GL };
      const pEdgeTop  = { x: tx(ST),      y: GP }; // po flip to będzie x=0

      ctx.lineWidth = 4;
      ctx.strokeStyle = "#d11";
      ctx.beginPath();
      // pion (FL)
      ctx.moveTo(X(pNotchTop.x), Y(pNotchTop.y));
      ctx.lineTo(X(pNotchBot.x), Y(pNotchBot.y));
      // poziom (FP)
      ctx.moveTo(X(pNotchTop.x), Y(pNotchTop.y));
      ctx.lineTo(X(pEdgeTop.x),  Y(pEdgeTop.y));
      ctx.stroke();

      // plecy/HDF (zielony) – poglądowo przy tylnej krawędzi
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#0a7";
      ctx.beginPath();
      // przy flip tx(0)=ST, tx(ST)=0, więc bierzemy min/max żeby nie wyjść poza rysunek
      const hdfX1 = Math.min(tx(0), tx(ST)) + 1;
      const hdfX2 = Math.max(tx(0), tx(ST)) - 1;
      ctx.moveTo(X(hdfX1), Y(1));
      ctx.lineTo(X(Math.max(hdfX1, hdfX2)), Y(1));
      ctx.stroke();

      function arrow(x1,y1,x2,y2,label){
        const head = 9;
        const ang = Math.atan2(y2-y1, x2-x1);
        ctx.strokeStyle = "#1e4b8f";
        ctx.fillStyle = "#1e4b8f";
        ctx.lineWidth = 2;

        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();

        const hx1 = x2 - head*Math.cos(ang) + head*0.6*Math.cos(ang+Math.PI/2);
        const hy1 = y2 - head*Math.sin(ang) + head*0.6*Math.sin(ang+Math.PI/2);
        const hx2 = x2 - head*Math.cos(ang) + head*0.6*Math.cos(ang-Math.PI/2);
        const hy2 = y2 - head*Math.sin(ang) + head*0.6*Math.sin(ang-Math.PI/2);

        ctx.beginPath();
        ctx.moveTo(x2,y2); ctx.lineTo(hx1,hy1); ctx.lineTo(hx2,hy2); ctx.closePath();
        ctx.fill();

        ctx.font = "bold 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, (x1+x2)/2, (y1+y2)/2 - 14);
      }

      // opisy wymiarów (cm)
      // SP rysujemy jako odcinek na "dole" (front dolny). Przy flip ląduje po prawej.
      const spClamped = Math.max(0, Math.min(ST, SP));
      const spA1 = flip ? (ST - spClamped) : 0;
      const spA2 = flip ? ST : spClamped;
      arrow(X(0), Y(-1.4), X(ST), Y(-1.4), `ST = ${ST} cm`);
      arrow(X(spA1), Y(yFrontLine+1.6), X(spA2), Y(yFrontLine+1.6), `SP = ${SP} cm`);

      // Etykiety GL/GP przechodzą na strony zgodnie z FLIP.
      // (Wartości wejściowe GL/GP nie muszą się zamieniać – liczymy fronty z |...|.)
      const leftLabel  = flip ? `GP = ${GP} cm` : `GL = ${GL} cm`;
      const rightLabel = flip ? `GL = ${GL} cm` : `GP = ${GP} cm`;
      arrow(X(-1.4), Y(0), X(-1.4), Y(yLeftSide), leftLabel);
      arrow(X(ST+1.4), Y(0), X(ST+1.4), Y(yRightSide), rightLabel);

      const legend = document.getElementById('cornerPreviewLegend');
      if(legend){
        legend.textContent = `Fronty: FL=|GL−GP|=${Math.round(FL*10)/10} cm, FP=|ST−SP−1,8|=${Math.round(FP*10)/10} cm`;
      }
  });
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
  return callExtracted('cabinetSummary', 'getCabinetExtraSummary', arguments, function(room, cab){

  const d = cab.details || {};
  const parts = [];

  // wisząca: dolna_podblatowa ma osobny model (front + wnętrze)
  if(cab.type === 'wisząca' && cab.subType === 'dolna_podblatowa'){
    const mode = d.podFrontMode || (d.subTypeOption && String(d.subTypeOption).startsWith('szuflada') ? 'szuflady' : ((Number(cab.frontCount)||0) ? 'drzwi' : 'brak'));
    const inside = d.podInsideMode || 'polki';

    const getInnerCount = ()=>{
      const v = (d.podInnerDrawerCount ?? d.podInsideDrawerCount ?? d.podInsideDrawersCount);
      const n = parseInt(v, 10);
      return (Number.isFinite(n) && n > 0) ? n : 1;
    };

    if(mode === 'brak' || (Number(cab.frontCount)||0) === 0){
      parts.push('Front: brak');
    } else if(mode === 'szuflady'){
      parts.push(`Front: szuflady ${Number(cab.frontCount)||1}`);
    } else {
      parts.push(`Front: drzwi ${Number(cab.frontCount)||1}`);
    }

    if(mode !== 'szuflady'){
      // Nie pokazuj półek dla wariantów, gdzie to myli (np. zmywarka/lodówka)
      const skipShelves = (cab.subType === 'zmywarkowa' || cab.subType === 'lodowkowa');
      if(inside === 'polki'){
        if(!skipShelves && ((d.shelves ?? 0) > 0)) parts.push(`Półki: ${d.shelves}`);
      } else if(inside === 'szuflady_wew' || inside === 'szuflady_wewn'){
        parts.push(`Szuflady wew.: ${getInnerCount()}`);
      } else if(inside === 'mieszane'){
        if(((d.shelves ?? 0) > 0)) parts.push(`Półki: ${d.shelves}`);
        parts.push(`Szuflady wew.: ${getInnerCount()}`);
      }
    }

    // Plecy (tak/nie) — krótko w szczegółach
    const hasBack = String(d.hasBack) !== '0';
    parts.push('Plecy: ' + (hasBack ? 'tak' : 'nie'));


    return parts.join(' • ');
  }

  // pozostałe wiszące
  if(cab.type === 'wisząca'){
    if(cab.subType === 'uchylne'){
      const vendor = String(d.flapVendor || 'blum');
      const kind = String(d.flapKind || (vendor === 'hafele' ? 'DUO' : 'HKI'));

      const vendorLabel = (vendor === 'blum') ? 'BLUM'
                        : (vendor === 'gtv') ? 'GTV'
                        : 'Häfele';

      const blumKindLabel = ({
        'HKI':'HKI – zintegrowany',
        'HF_top':'HF top – składany (2 fronty)',
        'HS_top':'HS top – uchylno‑nachodzący',
        'HL_top':'HL top – podnoszony ponad korpus',
        'HK_top':'HK top – uchylny',
        'HK-S':'HK‑S – mały uchylny',
        'HK-XS':'HK‑XS – mały uchylny (z zawiasami)'
      })[kind] || kind;

      const kindLabel = (vendor === 'blum') ? blumKindLabel
                      : (vendor === 'hafele') ? 'Rozwórka nożycowa DUO.'
                      : '(w budowie)';

      parts.push(`Podnośniki: ${vendorLabel} • ${kindLabel}`);
    }
    if(((d.shelves ?? 0) > 0)) parts.push(`Półki: ${d.shelves}`);
    if(cab.frontCount) parts.push(`Fronty: ${cab.frontCount}`);
    return parts.join(' • ');
  }

  // moduł
  if(cab.type === 'moduł'){
    // standardowa: wnętrze (półki / szuflady wewnętrzne)
    if(cab.subType === 'standardowa'){
      const inside = String(d.insideMode || 'polki');
      if(inside === 'szuflady_wew'){
        const n = parseInt(d.innerDrawerCount, 10);
        const cnt = (Number.isFinite(n) && n > 0) ? n : 1;
        const it = String(d.innerDrawerType || 'skrzynkowe');
        parts.push(`Szuflady wew.: ${cnt}${it === 'blum' ? ' (BLUM)' : ''}`);
      } else {
        const n = parseInt(d.shelves, 10);
        const cnt = (Number.isFinite(n) && n > 0) ? n : 0;
        if(cnt > 0) parts.push(`Półki: ${cnt}`);
      }
    }
    if(cab.subType === 'uchylne'){
      const vendor = String(d.flapVendor || 'blum');
      const kind = String(d.flapKind || (vendor === 'hafele' ? 'DUO' : 'HKI'));

      const vendorLabel = (vendor === 'blum') ? 'BLUM'
                        : (vendor === 'gtv') ? 'GTV'
                        : 'Häfele';

      const blumKindLabel = ({
        'HKI':'HKI – zintegrowany',
        'HF_top':'HF top – składany (2 fronty)',
        'HS_top':'HS top – uchylno‑nachodzący',
        'HL_top':'HL top – podnoszony ponad korpus',
        'HK_top':'HK top – uchylny',
        'HK-S':'HK‑S – mały uchylny',
        'HK-XS':'HK‑XS – mały uchylny (z zawiasami)'
      })[kind] || kind;

      const kindLabel = (vendor === 'blum') ? blumKindLabel
                      : (vendor === 'hafele') ? 'Rozwórka nożycowa DUO.'
                      : '(w budowie)';

      parts.push(`Podnośniki: ${vendorLabel} • ${kindLabel}`);
    }
    if(cab.subType === 'szuflady'){
      const lay = String(d.drawerLayout || '');
      let label = '';
      if(lay === '1_big') label = '1 duża';
      else if(lay === '2_equal') label = '2 równe';
      else if(lay === '3_equal') label = '3 równe';
      else if(lay === '5_equal') label = '5 równych';
      else if(lay === '3_1_2_2') label = '1 mała + 2 duże (1:2:2)';
      else {
        const lc = String(d.drawerCount || '3');
        if(lc === '1') label = '1 duża';
        else if(lc === '2') label = '2 równe';
        else if(lc === '5') label = '5 równych';
        else if(lc === '3') label = '1 mała + 2 duże (1:2:2)';
        else label = '3 równe';
      }
      const sys = String(d.drawerSystem || 'skrzynkowe');
      let sysLabel = 'Skrzynkowe';
      if(sys === 'systemowe'){
        const br = String(d.drawerBrand || 'blum');
        if(br !== 'blum'){
          sysLabel = br.toUpperCase() + ' (w budowie)';
        } else {
          const mdl = String(d.drawerModel || 'tandembox');
          const map = {tandembox:'TANDEMBOX', legrabox:'LEGRABOX', merivobox:'MERIVOBOX', metabox:'METABOX'};
          sysLabel = 'BLUM ' + (map[mdl] || mdl.toUpperCase());
        }
      }
      parts.push(`Szuflady: ${label} • ${sysLabel}`);

      const innerType = String(d.innerDrawerType || 'brak');
      const innerCnt = parseInt(d.innerDrawerCount, 10);
      if(innerType !== 'brak' && Number.isFinite(innerCnt) && innerCnt > 0){
        parts.push(`Szuflady wew.: ${innerCnt}${innerType === 'blum' ? ' (BLUM)' : ''}`);
      }
    }
    if(((d.shelves ?? 0) > 0)) parts.push(`Półki: ${d.shelves}`);
    if(cab.subType !== 'szuflady' && cab.frontCount) parts.push(`Fronty: ${cab.frontCount}`);
    return parts.join(' • ');
  }

  // stojące
  if(cab.type === 'stojąca'){
    if(cab.subType === 'szuflady'){
      const lay = String(d.drawerLayout || '');
      let label = '';
      if(lay === '1_big') label = '1 duża';
      else if(lay === '2_equal') label = '2 równe';
      else if(lay === '3_equal') label = '3 równe';
      else if(lay === '5_equal') label = '5 równych';
      else if(lay === '3_1_2_2') label = '1 mała + 2 duże (1:2:2)';
      else {
        // kompatybilność wstecz
        const lc = String(d.drawerCount || '3');
        if(lc === '1') label = '1 duża';
        else if(lc === '2') label = '2 równe';
        else if(lc === '5') label = '5 równych';
        else if(lc === '3') label = '1 mała + 2 duże (1:2:2)';
        else label = '3 równe';
      }
      const sys = String(d.drawerSystem || 'skrzynkowe');
      let sysLabel = 'Skrzynkowe';
      if(sys === 'systemowe'){
        const br = String(d.drawerBrand || 'blum');
        if(br !== 'blum'){
          sysLabel = br.toUpperCase() + ' (w budowie)';
        } else {
          const mdl = String(d.drawerModel || 'tandembox');
          const map = {tandembox:'TANDEMBOX', legrabox:'LEGRABOX', merivobox:'MERIVOBOX', metabox:'METABOX'};
          sysLabel = 'BLUM ' + (map[mdl] || mdl.toUpperCase());
        }
      }
      parts.push(`Szuflady: ${label} • ${sysLabel}`);

      const innerType = String(d.innerDrawerType || 'brak');
      const innerCnt = parseInt(d.innerDrawerCount, 10);
      if(innerType !== 'brak' && Number.isFinite(innerCnt) && innerCnt > 0){
        parts.push(`Szuflady wew.: ${innerCnt}${innerType === 'blum' ? ' (BLUM)' : ''}`);
      }
    }
    if(cab.subType === 'zlewowa'){
      // zgodność wstecz: stare pole sinkOption
      let front = d.sinkFront;
      let extra = d.sinkExtra;
      let extraCount = d.sinkExtraCount;
      let innerType = d.sinkInnerDrawerType;

      if(!front && d.sinkOption){
        if(d.sinkOption === 'zwykle_drzwi') front = 'drzwi';
        else if(d.sinkOption === 'szuflada') front = 'szuflada';
        else if(d.sinkOption === 'szuflada_i_polka'){ front = 'szuflada'; extra = extra || 'polka'; extraCount = (extraCount != null ? extraCount : 1); }
      }

      if(front === 'szuflada'){
        parts.push('Zlew: szuflada (1 front)');
        const sys = String(d.drawerSystem || 'skrzynkowe');
        let sysLabel = 'Skrzynkowe';
        if(sys === 'systemowe'){
          const br = String(d.drawerBrand || 'blum');
          if(br !== 'blum') sysLabel = br.toUpperCase() + ' (w budowie)';
          else {
            const mdl = String(d.drawerModel || 'tandembox');
            const map = {tandembox:'TANDEMBOX', legrabox:'LEGRABOX', merivobox:'MERIVOBOX', metabox:'METABOX'};
            sysLabel = 'BLUM ' + (map[mdl] || mdl.toUpperCase());
          }
        }
        parts.push(`Szuflada: ${sysLabel}`);
      } else {
        const dc = Number(d.sinkDoorCount || cab.frontCount || 2) || 2;
        parts.push(`Zlew: drzwi ${dc}`);
      }

      const ex = (extra || 'brak');
      const ec = (extraCount != null ? extraCount : 1);
      if(ex === 'polka'){
        parts.push(`Dodatkowo: półka ${ec}`);
      } else if(ex === 'szuflada_wew'){
        const t = (innerType || 'skrzynkowe');
        { 
        const t = String(innerType || 'skrzynkowe');
        if(t === 'systemowe'){
          const br = String(d.sinkInnerDrawerBrand || 'blum');
          if(br !== 'blum'){
            parts.push(`Szuflady wew.: ${ec} • ${br.toUpperCase()} (w budowie)`);
          } else {
            const mdl = String(d.sinkInnerDrawerModel || 'tandembox');
            const map = {tandembox:'TANDEMBOX', legrabox:'LEGRABOX', merivobox:'MERIVOBOX', metabox:'METABOX'};
            parts.push(`Szuflady wew.: ${ec} • BLUM ${(map[mdl]||mdl.toUpperCase())}`);
          }
        } else {
          parts.push(`Szuflady wew.: ${ec} • Skrzynkowe`);
        }
      }
      }
    }
if(cab.subType === 'zmywarkowa'){
  const dw = (d.dishWasherWidth || '60');
  parts.push(`Zmywarka: ${dw} cm`);
  const td = parseInt(d.techDividerCount, 10);
  if(Number.isFinite(td) && td > 0) parts.push(`Przegroda techn.: ${td}`);
}
    if(cab.subType === 'lodowkowa'){
      const fo = (d.fridgeOption || 'zabudowa');
      if(fo === 'zabudowa'){
        const nh = d.fridgeNicheHeight || '178';
        parts.push(`Lodówka: zabudowa • nisza ${nh}cm`);
      } else {
        const ff = (d.fridgeFreeOption || 'brak');
        parts.push(`Lodówka: wolnostojąca • ${ff}`);
      }
      const td = parseInt(d.techDividerCount, 10);
      if(fo === 'zabudowa' && Number.isFinite(td) && td > 0) parts.push(`Przegroda techn.: ${td}`);
    }
    if(cab.subType === 'piekarnikowa'){
      parts.push(`Piekarnik: ${(d.ovenOption || 'szuflada_dol')} • H=${d.ovenHeight || '60'}cm`);
      const tc = parseInt(d.techShelfCount, 10);
      parts.push(`Przegroda techn.: ${Number.isFinite(tc) && tc>0 ? tc : 1}`);

      const oo = String(d.ovenOption || 'szuflada_dol');
      if(oo.indexOf('szuflada') !== -1){
        const sys = String(d.drawerSystem || 'skrzynkowe');
        let sysLabel = 'Skrzynkowe';
        if(sys === 'systemowe'){
          const br = String(d.drawerBrand || 'blum');
          if(br !== 'blum') sysLabel = br.toUpperCase() + ' (w budowie)';
          else {
            const mdl = String(d.drawerModel || 'tandembox');
            const map = {tandembox:'TANDEMBOX', legrabox:'LEGRABOX', merivobox:'MERIVOBOX', metabox:'METABOX'};
            sysLabel = 'BLUM ' + (map[mdl] || mdl.toUpperCase());
          }
        }
        parts.push(`Szuflada: ${sysLabel}`);
      }
    }
    const isCorner = ['rogowa_slepa','narozna_l'].includes(cab.subType || '');
    const cornerOption = (d.cornerOption || 'polki');

    if(isCorner){
      parts.push(`Narożna: ${cornerOption}`);
    }

    // STANDARDOWA: półki albo szuflady wewnętrzne
    const insideMode = (d.insideMode || 'polki');
    const wantsInnerDrawers = (cab.subType === 'standardowa') && (
      insideMode === 'szuflady_wew' || insideMode === 'szuflady_wewn' || insideMode === 'szuflady_wewnetrzne'
    );

    if(wantsInnerDrawers){
      const cnt = (d.innerDrawerCount != null) ? d.innerDrawerCount : 1;
      const t = (d.innerDrawerType || 'skrzynkowe');
      parts.push(`Szuflady wew.: ${cnt}${t === 'blum' ? ' (BLUM)' : ''}`);
    } else {
      const shelvesN = parseInt(d.shelves, 10);
      const hasShelves = Number.isFinite(shelvesN) && shelvesN > 0;
      const skipShelvesFor = ['szuflady','zlewowa','zmywarkowa','lodowkowa','piekarnikowa'];
      const showShelves = hasShelves && !skipShelvesFor.includes(cab.subType) && !(isCorner && cornerOption !== 'polki');
      if(showShelves && shelvesN > 0) parts.push(`Półki: ${shelvesN}`);
    }

    // FRONTY: niektóre warianty mają sztywne zasady
    let frontCountForSummary = cab.frontCount || 0;
    if(cab.subType === 'lodowkowa'){
      const fo = (d.fridgeOption || 'zabudowa');
      if(fo === 'zabudowa'){
        // w tej wersji lodówkowa-zabudowa generuje zawsze 2 fronty: dolny + górny (nisza)
        frontCountForSummary = 2;
      } else {
        // wolnostojąca: bez frontów
        frontCountForSummary = 0;
      }
    }
    if(frontCountForSummary > 0) parts.push(`Fronty: ${frontCountForSummary}`);
    return parts.join(' • ');
  }

  // moduł
  if(cab.type === 'moduł'){
    // standardowa: wnętrze (półki / szuflady wewnętrzne)
    if(cab.subType === 'standardowa'){
      const inside = String(d.insideMode || 'polki');
      if(inside === 'szuflady_wew'){
        const n = parseInt(d.innerDrawerCount, 10);
        const cnt = (Number.isFinite(n) && n > 0) ? n : 1;
        const it = String(d.innerDrawerType || 'skrzynkowe');
        parts.push(`Szuflady wew.: ${cnt}${it === 'blum' ? ' (BLUM)' : ''}`);
      }
    }
    if(((d.shelves ?? 0) > 0)) parts.push(`Półki: ${d.shelves}`);
    if(cab.frontCount) parts.push(`Fronty: ${cab.frontCount}`);
    return parts.join(' • ');
  }

  return '';

  });
}


/* ===== Materiały: rozpiska mebli (korpusy/plecy/trawersy) ===== */
const FC_BOARD_THICKNESS_CM = (window.FC && window.FC.materialCommon && window.FC.materialCommon.FC_BOARD_THICKNESS_CM) || 1.8; // domyślnie płyta 18mm
const FC_TOP_TRAVERSE_DEPTH_CM = (window.FC && window.FC.materialCommon && window.FC.materialCommon.FC_TOP_TRAVERSE_DEPTH_CM) || 9; // trawersy górne

function fmtCm(v){
  try{
    const mod = window.FC && window.FC.materialCommon;
    if(mod && typeof mod.fmtCm === 'function') return mod.fmtCm(v);
  }catch(_){ }
  const n = Number(v);
  if(!Number.isFinite(n)) return String(v ?? '');
  return (Math.round(n * 10) / 10).toString();
}

function formatM2(v){
  try{
    const mod = window.FC && window.FC.materialCommon;
    if(mod && typeof mod.formatM2 === 'function') return mod.formatM2(v);
  }catch(_){ }
  const n = Number(v);
  if(!Number.isFinite(n)) return '0.000';
  return (Math.round(n * 1000) / 1000).toFixed(3);
}

function escapeHtml(str){
  try{
    const mod = window.FC && window.FC.materialCommon;
    if(mod && typeof mod.escapeHtml === 'function') return mod.escapeHtml(str);
  }catch(_){ }
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch] || ch));
}

function calcPartAreaM2(p){
  try{
    const mod = window.FC && window.FC.materialCommon;
    if(mod && typeof mod.calcPartAreaM2 === 'function') return mod.calcPartAreaM2(p);
  }catch(_){ }
  const a = Number(p.a) || 0;
  const b = Number(p.b) || 0;
  const qty = Number(p.qty) || 0;
  return qty * (a * b) / 10000;
}

function addArea(map, material, area){
  try{
    const mod = window.FC && window.FC.materialCommon;
    if(mod && typeof mod.addArea === 'function') return mod.addArea(map, material, area);
  }catch(_){ }
  const key = String(material || '');
  if(!key) return;
  map[key] = (map[key] || 0) + (Number(area) || 0);
}

function totalsFromParts(parts){
  try{
    const mod = window.FC && window.FC.materialCommon;
    if(mod && typeof mod.totalsFromParts === 'function') return mod.totalsFromParts(parts);
  }catch(_){ }
  const totals = {};
  (parts || []).forEach(p => addArea(totals, p.material, calcPartAreaM2(p)));
  return totals;
}

function mergeTotals(target, src){
  try{
    const mod = window.FC && window.FC.materialCommon;
    if(mod && typeof mod.mergeTotals === 'function') return mod.mergeTotals(target, src);
  }catch(_){ }
  for(const k in (src || {})) target[k] = (target[k] || 0) + (src[k] || 0);
  return target;
}

function totalsToRows(totals){
  try{
    const mod = window.FC && window.FC.materialCommon;
    if(mod && typeof mod.totalsToRows === 'function') return mod.totalsToRows(totals);
  }catch(_){ }
  return Object.entries(totals || {}).map(([material, m2]) => ({ material, m2 })).filter(r => r.m2 > 0).sort((a,b) => b.m2 - a.m2);
}

function renderTotals(container, totals){
  try{
    const mod = window.FC && window.FC.materialCommon;
    if(mod && typeof mod.renderTotals === 'function') return mod.renderTotals(container, totals);
  }catch(_){ }
  container.innerHTML = '';
}

function getCabinetAssemblyRuleText(cab){
  try{
    const mod = window.FC && window.FC.materialCommon;
    if(mod && typeof mod.getCabinetAssemblyRuleText === 'function') return mod.getCabinetAssemblyRuleText(cab);
  }catch(_){ }
  if(cab.type === 'wisząca' || cab.type === 'moduł') return 'Skręcanie: wieniec górny i dolny między bokami.';
  if(cab.type === 'stojąca') return `Skręcanie: wieniec dolny pod bokami (boki niższe o ${FC_BOARD_THICKNESS_CM} cm); góra na trawersach 2×${FC_TOP_TRAVERSE_DEPTH_CM} cm (przód+tył).`;
  return 'Skręcanie: —';
}


function getCabinetFrontCutListForMaterials(room, cab){
  try{
    const mod = window.FC && window.FC.frontHardware;
    if(mod && typeof mod.getCabinetFrontCutListForMaterials === 'function') return mod.getCabinetFrontCutListForMaterials(room, cab);
  }catch(_){ }
  return [];
}

function cabinetHasHandle(cab){
  try{
    const mod = window.FC && window.FC.frontHardware;
    if(mod && typeof mod.cabinetHasHandle === 'function') return mod.cabinetHasHandle(cab);
  }catch(_){ }
  const os = String(cab?.openingSystem || '').toLowerCase();
  if(!os) return true;
  if(os.includes('tip-on')) return false;
  if(os.includes('podchwyt')) return false;
  return true;
}

function getFrontWeightKgM2(frontMaterial){
  try{
    const mod = window.FC && window.FC.frontHardware;
    if(mod && typeof mod.getFrontWeightKgM2 === 'function') return mod.getFrontWeightKgM2(frontMaterial);
  }catch(_){ }
  return 13.0;
}

function estimateFrontWeightKg(wCm, hCm, frontMaterial, hasHandle){
  try{
    const mod = window.FC && window.FC.frontHardware;
    if(mod && typeof mod.estimateFrontWeightKg === 'function') return mod.estimateFrontWeightKg(wCm, hCm, frontMaterial, hasHandle);
  }catch(_){ }
  return 0;
}

function blumHingesPerDoor(wCm, hCm, frontMaterial, hasHandle){
  try{
    const mod = window.FC && window.FC.frontHardware;
    if(mod && typeof mod.blumHingesPerDoor === 'function') return mod.blumHingesPerDoor(wCm, hCm, frontMaterial, hasHandle);
  }catch(_){ }
  return 0;
}

function getDoorFrontPanelsForHinges(room, cab){
  try{
    const mod = window.FC && window.FC.frontHardware;
    if(mod && typeof mod.getDoorFrontPanelsForHinges === 'function') return mod.getDoorFrontPanelsForHinges(room, cab);
  }catch(_){ }
  return [];
}

function getHingeCountForCabinet(room, cab){
  try{
    const mod = window.FC && window.FC.frontHardware;
    if(mod && typeof mod.getHingeCountForCabinet === 'function') return mod.getHingeCountForCabinet(room, cab);
  }catch(_){ }
  return 0;
}

function estimateFlapWeightKg(cab, room){
  try{
    const mod = window.FC && window.FC.frontHardware;
    if(mod && typeof mod.estimateFlapWeightKg === 'function') return mod.estimateFlapWeightKg(cab, room);
  }catch(_){ }
  return 0;
}

function blumAventosPowerFactor(cab, room){
  try{
    const mod = window.FC && window.FC.frontHardware;
    if(mod && typeof mod.blumAventosPowerFactor === 'function') return mod.blumAventosPowerFactor(cab, room);
  }catch(_){ }
  return 0;
}

function getBlumAventosInfo(cab, room){
  try{
    const mod = window.FC && window.FC.frontHardware;
    if(mod && typeof mod.getBlumAventosInfo === 'function') return mod.getBlumAventosInfo(cab, room);
  }catch(_){ }
  return null;
}

function getCabinetCutList(cab, room){
  return callExtracted('cabinetCutlist','getCabinetCutList',[cab, room], _getCabinetCutListFallback);
}

function _getCabinetCutListFallback(cab, room){
  const t = FC_BOARD_THICKNESS_CM;
  const w = Number(cab.width) || 0;
  const h = Number(cab.height) || 0;
  const d = Number(cab.depth) || 0;
  const bodyMat = cab.bodyColor || 'laminat';
  // Plecy: "Brak" traktujemy jak brak materiału (nie dodajemy pozycji do Materiałów ani ROZRYS)
  const backMatRaw = cab.backMaterial || 'HDF';
  const backMat = (String(backMatRaw).trim().toLowerCase() === 'brak' || String(backMatRaw).trim() === '— brak —') ? '' : backMatRaw;

  const subType = String(cab.subType || '');
  // Wisząca podblatowa ma być liczona w materiałach jak stojąca
  const isUnderCounterWall = (String(cab.type || '') === 'wisząca' && subType === 'dolna_podblatowa');
  const effType = isUnderCounterWall ? 'stojąca' : String(cab.type || '');

  // Plecy: dla "wisząca podblatowa" użytkownik może wyłączyć plecy (tak/nie w modalu)
  const hasBack = !(isUnderCounterWall && String((cab.details || {}).hasBack) === '0');

  const parts = [];

  // Stojące: boki stoją na wieńcu dolnym => boki niższe o grubość płyty
  // Wyjątek: wisząca dolna podblatowa – boki mają wysokość korpusu
  const sideH = (effType === 'stojąca' && !isUnderCounterWall) ? Math.max(0, h - t) : h;

  // Boki: zawsze 2 szt.
  parts.push({ name:'Bok', qty:2, a: sideH, b: d, dims:`${fmtCm(sideH)} × ${fmtCm(d)}`, material: bodyMat });
  // Rogowa L: 1 bok duży, 1 bok mały + bok zaślepiający (zamiast 2x bok duży)
  if(String(cab.subType || '') === 'narozna_l'){
    // usuń domyślne 2 boki
    parts.pop();

    const det = cab.details || {};
    const GL = Number(det.gl) || 0; // głębokość lewa (duży bok)
    const GP = Number(det.gp) || 0; // głębokość małego boku
    const ST = Number(det.st) || 0; // (fallback) głębokość prawa, gdy GL=0
    const SP = Number(det.sp) || 0; // szerokość boku zaślepiającego (przed korektą)

    // Zasady:
    // - Bok mały: szerokości GP
    // - Bok zaślepiający: szerokości SP - 1,8
    // - Bok duży: przyjmij GL (jeśli brak, to ST; jeśli brak, to d)
    const bigDepth = (GL > 0 ? GL : (ST > 0 ? ST : d));
    const smallDepth = (GP > 0 ? GP : Math.max(0, Math.min(bigDepth, d)));
    const blindDepth = Math.max(0, SP - t);

    parts.push({ name:'Bok duży', qty:1, a: sideH, b: bigDepth, dims:`${fmtCm(sideH)} × ${fmtCm(bigDepth)}`, material: bodyMat });
    parts.push({ name:'Bok mały', qty:1, a: sideH, b: smallDepth, dims:`${fmtCm(sideH)} × ${fmtCm(smallDepth)}`, material: bodyMat });

    if(blindDepth > 0){
      parts.push({ name:'Bok zaślepiający', qty:1, a: sideH, b: blindDepth, dims:`${fmtCm(sideH)} × ${fmtCm(blindDepth)}`, material: bodyMat });
    }
  }

  const wIn = Math.max(0, w - 2*t);

  // Wisząca rogowa ślepa: zaślepka + blenda w kolorze frontu
  if(effType === 'wisząca' && String(cab.subType || '') === 'rogowa_slepa'){
    const blind = Math.max(0, Number(cab.details?.blindPart) || 0);
    // Zaślepka: szerokość (blindPart - (1,8 + 9)), wysokość jak korpus
    const zA = Math.max(0, blind - (t + 9));
    const zB = h;
    if(zA > 0 && zB > 0){
      parts.push({ name:'Zaślepka', qty:1, a:zA, b:zB, dims:`${fmtCm(zA)} × ${fmtCm(zB)}`, material: bodyMat });
    }

    // Blenda: 15 cm szerokości, wysokość jak korpus, materiał jak front
    const fMat = cab.frontMaterial || 'laminat';
    const fCol = cab.frontColor || '';
    const frontMatKey = `Front: ${fMat}${fCol ? ` • ${fCol}` : ''}`;
    parts.push({ name:'Blenda', qty:1, a:15, b:h, dims:`${fmtCm(15)} × ${fmtCm(h)}`, material: frontMatKey });
  }

  // Wieńce
  if(effType === 'wisząca' || effType === 'moduł'){
    // Wiszące: wieńce płytsze o 2cm od korpusu; moduły: bez tej korekty (tylko jak wiszące w skręcaniu)
    const crownDepth = (effType === 'wisząca') ? Math.max(0, d - 2) : d;
    parts.push({ name:'Wieniec górny', qty:1, a:wIn, b:crownDepth, dims:`${fmtCm(wIn)} × ${fmtCm(crownDepth)}`, material: bodyMat });
    parts.push({ name:'Wieniec dolny', qty:1, a:wIn, b:crownDepth, dims:`${fmtCm(wIn)} × ${fmtCm(crownDepth)}`, material: bodyMat });
  }

  if(effType === 'stojąca'){
    if(isUnderCounterWall){
      // Wisząca dolna podblatowa: wieniec dolny MIĘDZY bokami, boki pełnej wysokości korpusu
      parts.push({ name:'Wieniec dolny', qty:1, a:wIn, b:d, dims:`${fmtCm(wIn)} × ${fmtCm(d)}`, material: bodyMat });
    } else {
      // Stojące: wieniec dolny POD bokami => szer. zewn.
      parts.push({ name:'Wieniec dolny', qty:1, a:w, b:d, dims:`${fmtCm(w)} × ${fmtCm(d)}`, material: bodyMat });
    }

    // Trawersy górne (2 szt.) między bokami, głębokość 9cm
    parts.push({ name:`Trawers górny (${fmtCm(FC_TOP_TRAVERSE_DEPTH_CM)} cm)`, qty:2, a:wIn, b:FC_TOP_TRAVERSE_DEPTH_CM, dims:`${fmtCm(wIn)} × ${fmtCm(FC_TOP_TRAVERSE_DEPTH_CM)}`, material: bodyMat });
  }

  // Półki (jeśli są w szczegółach)
  const shelves = parseInt((cab.details && cab.details.shelves) ?? 0, 10);
  // Stojące szuflady: w "Materiały" nie rozpisujemy szuflad jako półek.
  const isStandingDrawerCabinet = (effType === 'stojąca' && String(cab.subType || '') === 'szuflady');
  if(!isStandingDrawerCabinet && Number.isFinite(shelves) && shelves > 0){
    let shelfDepth = d;

    // 1) Stojące: półki płytsze o 0,5cm od korpusu
    // 2) Moduły: tak samo jak stojące
    if(effType === 'stojąca' || effType === 'moduł'){
      shelfDepth = Math.max(0, d - 0.5);
    }

    // 3) Wiszące: półki płytsze o 0,5cm od wieńców; a wieńce są płytsze o 2cm od korpusu
    if(effType === 'wisząca'){
      shelfDepth = Math.max(0, (d - 2) - 0.5); // d - 2,5
    }

    parts.push({ name:'Półka', qty:shelves, a:wIn, b:shelfDepth, dims:`${fmtCm(wIn)} × ${fmtCm(shelfDepth)}`, material: bodyMat });
  }

  // Plecy (HDF / płyta)
  if(backMat && hasBack){
    let backW = w;
    let backH = h;

    // 1) Stojące: plecy mniejsze o 0,5cm względem korpusu
    // 2) Moduły: tak samo jak stojące
    if(effType === 'stojąca' || effType === 'moduł'){
      backW = Math.max(0, w - 0.5);
      backH = Math.max(0, h - 0.5);
    }

    // 3) Wiszące:
    //   A) niższe o 0,5cm od korpusu
    //   B) szersze o 2cm względem wieńca (wieniec = szerokość wewnętrzna)
    if(effType === 'wisząca'){
      backW = Math.max(0, wIn + 2);
      backH = Math.max(0, h - 0.5);
    }

    parts.push({ name:'Plecy', qty:1, a:backW, b:backH, dims:`${fmtCm(backW)} × ${fmtCm(backH)}`, material: backMat });
  }

  // Fronty (materiały)
  const frontParts = getCabinetFrontCutListForMaterials(room, cab);
  frontParts.forEach(p => parts.push(p));

  

  // Zawiasy BLUM (okucia) — dodaj do materiałów jako ilość sztuk (bez wpływu na sumy m²)
// UWAGA: dla klap z AVENTOS HK‑XS ilość zawiasów wynika z tabel (KB/LF) i dodajemy je poniżej jako osobną pozycję.
let hingeQty = getHingeCountForCabinet(room, cab);
try{
  const det = cab.details || {};
  const isHKXS = (String(cab.subType||'') === 'uchylne'
    && String(det.flapVendor||'blum') === 'blum'
    && String(det.flapKind||'HK-XS') === 'HK-XS');
  if(isHKXS) hingeQty = 0;
}catch(e){ /* noop */ }

if(hingeQty > 0){
  parts.push({ name:'Zawias BLUM', qty:hingeQty, a:0, b:0, dims:'—', material:'Okucia: zawiasy BLUM' });
}


  
// Podnośniki BLUM AVENTOS (dla klap uchylnych) — model + zakres LF + opis "mocy"
// Ostrzeganie/przerwanie dodawania robimy na etapie MODALA (przy dodawaniu/edycji),
// więc w materiałach pokazujemy tylko poprawnie dobrane okucia.
if(String(cab.subType || '') === 'uchylne'){
  const info = getBlumAventosInfo(cab, room);
  if(info && (!info.status || info.status === 'ok' || info.status === 'needs_more_lifts')){
      const nameSuffix = (info.model ? ` ${info.model}` : '');
      const strengthSuffix = (info.strength ? ` (${info.strength})` : '');
      const rangeTxt = (info.rangeStr
        ? (String(info.rangeStr).includes('kg') ? `zakres wagi ${info.rangeStr}` : `zakres LF ${info.rangeStr}`)
        : 'zakres —');
      const qtyLift = (info.liftQty && info.liftQty > 0) ? info.liftQty : 2;
      parts.push({
        name:`Podnośnik BLUM AVENTOS ${info.label}${nameSuffix}${strengthSuffix}`,
        qty: qtyLift,
        a:0, b:0,
        dims:`LF=${info.powerFactor} • ${rangeTxt}${(info.status === 'needs_more_lifts' ? ` • UWAGA: przyjęto ${qtyLift} szt.` : '')}`,
        material:'Okucia: podnośniki BLUM'
      });

      if(info.status === 'needs_more_lifts'){
        parts[parts.length-1].tone = 'orange';
      }

      // HK-XS: zawiasy wg tabel (liczymy oddzielnie od drzwi)
      if(info.hkxsHinges && info.hkxsHinges > 0){
        parts.push({ name:'Zawias BLUM (HK‑XS)', qty:info.hkxsHinges, a:0, b:0, dims:'—', material:'Okucia: zawiasy BLUM' });
      }
  }
}

return parts;
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

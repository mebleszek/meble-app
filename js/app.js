/* ===== Storage keys and defaults ===== */
// Prefer external constants module (js/app/constants.js). Keep a local fallback to avoid hard failures.
const STORAGE_KEYS = (
  (window.FC && window.FC.constants && window.FC.constants.STORAGE_KEYS) ||
  {
    materials: 'fc_materials_v1',
    services: 'fc_services_v1',
    projectData: 'fc_project_v1',
    projectBackup: 'fc_project_backup_v1',
    projectBackupMeta: 'fc_project_backup_meta_v1',
    ui: 'fc_ui_v1',
  }
);
try{
  window.FC = window.FC || {};
  window.FC.constants = window.FC.constants || {};
  if(!window.FC.constants.STORAGE_KEYS) window.FC.constants.STORAGE_KEYS = STORAGE_KEYS;
}catch(_){ }



// ===== CORE FALLBACKS (fail-soft) =====
// If for any reason core modules (js/core/actions.js, js/core/modals.js) fail to execute,
// provide minimal implementations so the app can still start.
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
  // Prefer external utils module (js/app/utils.js). Keep a local fallback to avoid hard failures.
  const utils = (window.FC && window.FC.utils) ? window.FC.utils : {
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
  try{ window.FC = window.FC || {}; if(!window.FC.utils) window.FC.utils = utils; }catch(_){ }

  /* ===== Module: storage ===== */
  // Prefer external storage module (js/app/storage.js). Keep a local fallback to avoid hard failures.
  const storage = (window.FC && window.FC.storage) ? window.FC.storage : {
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
  try{ window.FC = window.FC || {}; if(!window.FC.storage) window.FC.storage = storage; }catch(_){ }

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
  { id: 'm1', materialType: 'laminat', manufacturer: 'Egger', symbol: 'W1100', name: 'Egger W1100 ST9 Biały Alpejski', price: 35 },
  { id: 'm2', materialType: 'akryl', manufacturer: 'Rehau', symbol: 'A01', name: 'Akryl Biały', price: 180 },
  { id: 'm3', materialType: 'akcesoria', manufacturer: 'blum', symbol: 'B1', name: 'Zawias Blum', price: 18 }
]);
let services = FC.storage.getJSON(STORAGE_KEYS.services, [ { id: 's1', category: 'Montaż', name: 'Montaż Express', price: 120 } ]);
let projectData = FC.project.load();
const __uiDefaults = { activeTab:'wywiad', roomType:null, showPriceList:null, expanded:{}, matExpandedId:null, searchTerm:'', editingId:null, selectedCabinetId:null };
let uiState = FC.storage.getJSON(STORAGE_KEYS.ui, __uiDefaults) || {};
uiState = Object.assign({}, __uiDefaults, uiState);
if (!uiState.expanded || typeof uiState.expanded !== 'object') uiState.expanded = {};
FC.storage.setJSON(STORAGE_KEYS.ui, uiState);

const MANUFACTURERS = {
  laminat: ['Egger','KronoSpan','Swiss Krono','Woodeco'],
  akryl: ['Rehau','manufaktura Łomża'],
  lakier: ['elektronowa','Pol-wiór'],
  blat: ['Egger','KronoSpan','Swiss Krono','Woodeco'],
  akcesoria: ['blum','GTV','Peka','Rejs','Nomet','Häfele','Sevroll','Laguna','Hettich']
};

/* ===== Normalize (backward compatibility) ===== */
function normalizeProjectData(){
  ['kuchnia','szafa','pokoj','lazienka'].forEach(r=>{
    if(!projectData[r]) projectData[r] = FC.utils.clone(DEFAULT_PROJECT[r]);
    if(!Array.isArray(projectData[r].cabinets)) projectData[r].cabinets = [];
    if(!projectData[r].settings) projectData[r].settings = FC.utils.clone(DEFAULT_PROJECT[r].settings);
    if(!Array.isArray(projectData[r].fronts)) projectData[r].fronts = [];
    if(!Array.isArray(projectData[r].sets)) projectData[r].sets = [];

    // numeracja zestawów jeśli brak
    let n = 1;
    projectData[r].sets.forEach(s=>{
      if(typeof s.number !== 'number'){
        s.number = n;
      }
      n = Math.max(n, s.number + 1);
    });

    const map = new Map(projectData[r].sets.map(s=>[s.id, s.number]));
    projectData[r].cabinets.forEach(c=>{
      if(c.setId && typeof c.setNumber !== 'number'){
        const num = map.get(c.setId);
        if(typeof num === 'number') c.setNumber = num;
      }
      if(typeof c.frontCount !== 'number') c.frontCount = 2; // domyślnie 2 (dla standardów)
      if(!c.details) c.details = {};
    });
  });
  projectData = FC.project.save(projectData);
}
normalizeProjectData();

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
  const s = projectData.kuchnia.settings;
  const h = (Number(s.roomHeight)||0) - (Number(s.bottomHeight)||0) - (Number(s.counterThickness)||0) - (Number(s.gapHeight)||0) - (Number(s.ceilingBlende)||0);
  return h>0?Math.round(h*10)/10:0;
}
// ZESTAWY: top = roomHeight - suma niższych - blenda
function calcTopForSet(room, blende, sumLowerHeights){
  const s = projectData[room].settings;
  const h = (Number(s.roomHeight)||0) - (Number(sumLowerHeights)||0) - (Number(blende)||0);
  return h>0 ? Math.round(h*10)/10 : 0;
}

/* Toggle expansion (single-open accordion) */
function toggleExpandAll(id){
  const key = String(id);
  const isOpen = !!(uiState.expanded && uiState.expanded[key]);
  // only one cabinet expanded at a time
  uiState.expanded = {};
  if(!isOpen){
    uiState.expanded[key] = true;
    uiState.selectedCabinetId = key;
  }
  FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
  renderCabinets();
}

/* Settings changes */
function handleSettingChange(field, value){
  const room = uiState.roomType; if(!room) return;
  projectData[room].settings[field] = value === '' ? 0 : parseFloat(value);
  projectData = FC.project.save(projectData);
  renderTopHeight();
  renderCabinets();
}

/* --- Variant lists --- */
function getSubTypeOptionsForType(typeVal){
  if(typeVal === 'wisząca'){
    return [
      { v:'standardowa', t:'Standardowa' },
      { v:'rogowa_slepa', t:'Rogowa ślepa' },
      { v:'narozna_l', t:'Narożna L' },
      { v:'dolna_podblatowa', t:'Dolna podblatowa' },
      { v:'okap', t:'Okapowa' },
      { v:'uchylne', t:'Uchylne (klapa)' }
    ];
  }
  if(typeVal === 'stojąca'){
    return [
      { v:'standardowa', t:'Standardowa' },
      { v:'rogowa_slepa', t:'Rogowa ślepa' },
      { v:'narozna_l', t:'Narożna L' },
      { v:'piekarnikowa', t:'Piekarnikowa' },
      { v:'zlewowa', t:'Zlewowa' },
      { v:'zmywarkowa', t:'Zmywarkowa' },
      { v:'lodowkowa', t:'Lodówkowa' },
      { v:'szuflady', t:'Szuflady' }
    ];
  }
  if(typeVal === 'moduł'){
    return [
      { v:'standardowa', t:'Standardowa' },
      { v:'szuflady', t:'Szufladowa' },
      { v:'uchylne', t:'Uchylna' }
    ];
  }
  return [{ v:'standardowa', t:'Standardowa' }];
}

/* Apply rules */
function applyTypeRules(room, updated, typeVal){
  if(typeVal === 'wisząca'){
    updated.subType = 'standardowa';
    updated.height = calculateAvailableTopHeight();
    updated.depth = 36;
    updated.details = Object.assign({}, updated.details || {}, { shelves: 2 });
    if(!['TIP-ON','podchwyt','uchwyt klienta','krawędziowy HEXA GTV','korytkowy','UKW'].includes(updated.openingSystem)){
      updated.openingSystem = 'uchwyt klienta';
    }
    if(typeof updated.frontCount !== 'number') updated.frontCount = 2;
  } else if(typeVal === 'stojąca'){
    updated.subType = 'standardowa';
    updated.height = projectData[room].settings.bottomHeight;
    updated.depth = 51;
    if(!['TIP-ON','uchwyt klienta','krawędziowy HEXA GTV','korytkowy','UKW'].includes(updated.openingSystem)){
      updated.openingSystem = 'uchwyt klienta';
    }
    if(typeof updated.frontCount !== 'number') updated.frontCount = 2;
  } else if(typeVal === 'moduł'){
    // Moduł: korpus jak stojąca (bez nóżek), domyślnie szer. 60, gł. 51, wys. wg obecnej logiki (gap + blat + 18mm)
    updated.subType = 'standardowa';
    const gap = Number(projectData[room].settings.gapHeight) || 0;
    const counter = Number(projectData[room].settings.counterThickness) || 0;
    updated.width = 60;
    updated.depth = 51;
    updated.height = Math.round((gap + counter + 1.8) * 10) / 10;
    updated.details = Object.assign({}, updated.details || {}, { shelves: (updated.details && updated.details.shelves != null ? updated.details.shelves : 2) });
    if(!['TIP-ON','uchwyt klienta','krawędziowy HEXA GTV','korytkowy','UKW'].includes(updated.openingSystem)){
      updated.openingSystem = 'uchwyt klienta';
    }
    // Moduł standardowy domyślnie jak drzwi (1/2 do wyboru)
    if(typeof updated.frontCount !== 'number' || ![1,2].includes(Number(updated.frontCount))) updated.frontCount = 2;
  }
  updated.type = typeVal;
  return updated;
}

function applySubTypeRules(room, updated, subTypeVal){
  if(updated.type === 'wisząca'){
    if(subTypeVal === 'dolna_podblatowa'){
      updated.depth = 57;
      updated.height = projectData[room].settings.bottomHeight;
      updated.details = Object.assign({}, updated.details || {}, { podFrontMode: 'drzwi', podInsideMode: 'polki', podInnerDrawerCount: '1', shelves: 1 });
    } else {
      updated.depth = 36;
      updated.height = calculateAvailableTopHeight();
    }
  } else if(updated.type === 'stojąca'){
    if(subTypeVal === 'zlewowa'){
      updated.depth = 56;
    } else if(['standardowa','rogowa_slepa','narozna_l','szuflady','piekarnikowa'].includes(subTypeVal)){
      updated.depth = 51;
    } else if(['zmywarkowa','lodowkowa'].includes(subTypeVal)){
      updated.depth = 57;
    }

    if(subTypeVal === 'piekarnikowa'){
      updated.details = FC.utils.isPlainObject(updated.details) ? updated.details : {};
      // Oven cabinet: do not treat legacy default shelf=1 as a real shelf.
      updated.details.shelves = 0;
      if(!('ovenOption' in updated.details)) updated.details.ovenOption = 'szuflada_dol';
      if(!('ovenHeight' in updated.details)) updated.details.ovenHeight = '60';
    }
  } else if(updated.type === 'moduł'){
    // Moduł: warianty jak stojąca (bez nóżek) + uchylna jak wisząca, ale głębokość zawsze 51, szerokość domyślnie 60
    updated.depth = 51;
    if(!Number(updated.width)) updated.width = 60;

    if(subTypeVal === 'szuflady'){
      const cur = (updated.details || {});
      // ustaw domyślne wartości szuflad (jak w stojącej)
      updated.details = Object.assign({}, cur, {
        drawerLayout: (cur.drawerLayout || (cur.drawerCount ? null : '3_1_2_2') || '3_1_2_2'),
        drawerSystem: (cur.drawerSystem || 'skrzynkowe'),
        innerDrawerType: (cur.innerDrawerType || 'brak'),
        innerDrawerCount: (cur.innerDrawerCount != null ? cur.innerDrawerCount : 0),
        shelves: (cur.shelves != null ? cur.shelves : 0)
      });
      updated.frontCount = 0;
    } else if(subTypeVal === 'uchylne'){
      const cur = (updated.details || {});
      const vendor = (cur.flapVendor || 'blum');
      let kind = cur.flapKind;
      if(!kind){
        kind = (vendor === 'hafele') ? 'DUO' : 'HKI';
      }

      // Usuń ślady po szufladach, żeby UI nie pokazywało pól "szufladowych"
      const clean = Object.assign({}, cur);
      delete clean.drawerLayout;
      delete clean.drawerSystem;
      delete clean.drawerCount;
      delete clean.innerDrawerType;
      delete clean.innerDrawerCount;

      updated.details = Object.assign({}, clean, {
        flapVendor: vendor,
        flapKind: kind,
        shelves: (cur.shelves != null ? cur.shelves : 2)
      });
      updated.frontCount = getFlapFrontCount(updated);
    } else {
      // standardowa
      const cur = (updated.details || {});
      updated.details = Object.assign({}, cur, { shelves: (cur.shelves != null ? cur.shelves : 2) });
      if(![1,2].includes(Number(updated.frontCount))) updated.frontCount = 2;
    }
  }

  updated.subType = subTypeVal;

  // piekarnikowa: parametry piekarnika + półka techniczna
  if(updated.type === 'stojąca' && subTypeVal === 'piekarnikowa'){
    const cur = (updated.details || {});
    updated.details = Object.assign({}, cur, {
      ovenOption: (cur.ovenOption || 'szuflada_dol'),
      ovenHeight: (cur.ovenHeight || '60'),
      techShelfCount: (cur.techShelfCount || '1'),
      shelves: (cur.shelves != null ? cur.shelves : 0)
    });
  }

  
  // szuflady (stojąca): układ + typ + opcjonalne szuflady wewnętrzne
  if(updated.type === 'stojąca' && subTypeVal === 'szuflady'){
    const cur = FC.utils.isPlainObject(updated.details) ? updated.details : {};
    let lay = cur.drawerLayout;
    if(!lay){
      const legacy = String(cur.drawerCount || '3');
      if(legacy === '1') lay = '1_big';
      else if(legacy === '2') lay = '2_equal';
      else if(legacy === '3') lay = '3_1_2_2';
      else if(legacy === '5') lay = '5_equal';
      else lay = '3_equal';
    }
    const innerDef = (lay === '3_equal') ? '3' : '2';
    updated.details = Object.assign({}, cur, {
      drawerLayout: lay,
      drawerSystem: (cur.drawerSystem || 'skrzynkowe'),
      innerDrawerType: (cur.innerDrawerType || 'brak'),
      innerDrawerCount: (cur.innerDrawerCount != null ? String(cur.innerDrawerCount) : innerDef),
      // zachowaj legacy dla kompatybilności
      drawerCount: (cur.drawerCount != null ? String(cur.drawerCount) : (lay === '1_big' ? '1' : lay === '2_equal' ? '2' : lay === '5_equal' ? '5' : '3'))
    });
    // układ 5 szuflad: brak wewnętrznych
    if(lay === '5_equal'){
      updated.details.innerDrawerType = 'brak';
      updated.details.innerDrawerCount = '0';
    }
  }

// zlewowa: wybór frontu (drzwi/szuflada) + opcje dodatkowe (półka / szuflada wewn.)
  if(updated.type === 'stojąca' && subTypeVal === 'zlewowa'){
    const cur = (updated.details || {});
    // migracja z poprzedniego pola sinkOption, jeśli istnieje
    let sinkFront = cur.sinkFront

// zmywarkowa: wybór szerokości zmywarki synchronizuje wymiar szafki + przegrody techniczne dla wysokich frontów
if(updated.type === 'stojąca' && subTypeVal === 'zmywarkowa'){
  const cur = FC.utils.isPlainObject(updated.details) ? updated.details : {};
  let dw = cur.dishWasherWidth;
  const cw = Number(updated.width) || 0;
  if(!dw){
    if(cw === 45) dw = '45';
    else if(cw === 60) dw = '60';
    else dw = '60';
  }
  updated.details = Object.assign({}, cur, { dishWasherWidth: dw });
  updated.width = Number(dw) || 60;

  const leg = Number(projectData[room]?.settings?.legHeight) || 0;
  const frontH = (Number(updated.height) || 0) - leg;
  // Przegroda techniczna: 74.6–76.5 => 1; 76.6–78.5 => 2; itd.
  const div = (frontH > 74.5) ? Math.max(0, Math.ceil(((frontH - 74.5) / 2) - 1e-9)) : 0;
  updated.details = Object.assign({}, updated.details, { techDividerCount: String(div), shelves: 0 });

  updated.frontCount = 1;
}

;
    let sinkDoorCount = cur.sinkDoorCount;
    let sinkExtra = cur.sinkExtra;
    let sinkExtraCount = cur.sinkExtraCount;
    let sinkInnerDrawerType = cur.sinkInnerDrawerType;

    if(!sinkFront && cur.sinkOption){
      if(cur.sinkOption === 'zwykle_drzwi'){
        sinkFront = 'drzwi';
      } else if(cur.sinkOption === 'szuflada'){
        sinkFront = 'szuflada';
      } else if(cur.sinkOption === 'szuflada_i_polka'){
        sinkFront = 'szuflada';
        sinkExtra = 'polka';
        sinkExtraCount = sinkExtraCount || 1;
      }
    }

    updated.details = Object.assign({}, cur, {
      sinkFront: (sinkFront || 'drzwi'),
      sinkDoorCount: (sinkDoorCount || '2'),
      sinkExtra: (sinkExtra || 'brak'),
      sinkExtraCount: (sinkExtraCount != null ? sinkExtraCount : 1),
      sinkInnerDrawerType: (sinkInnerDrawerType || 'skrzynkowe')
    });

    // półki użytkowe dla zlewowej domyślnie 0 (opcjonalne przez sinkExtra)
    if(updated.details.shelves == null) updated.details.shelves = 0;

    // jeżeli szuflada z przodu -> 1 duży front
    if(updated.details.sinkFront === 'szuflada'){
      updated.frontCount = 1;
    } else {
      const dc = Number(updated.details.sinkDoorCount) || 2;
      updated.frontCount = (dc === 1 ? 1 : 2);
    }
  }

  // rogowa_slepa: dodatkowy wymiar "część zaślepiona" (cm)
  if(subTypeVal === 'rogowa_slepa'){
    const cur = (updated.details || {});
    updated.details = Object.assign({}, cur, { blindPart: (cur.blindPart ?? 30), cornerOption: (cur.cornerOption || 'polki') });
  }

  // frontCount defaults per subtype (tam gdzie logiczne)
  if(updated.type === 'stojąca'){
    if(subTypeVal === 'zmywarkowa' || subTypeVal === 'piekarnikowa'){
      updated.frontCount = 1;
    } else if(subTypeVal === 'szuflady'){
      const d = FC.utils.isPlainObject(updated.details) ? updated.details : {};
      const lay = String(d.drawerLayout || '');
      let n = 3;
      if(lay === '1_big') n = 1;
      else if(lay === '2_equal') n = 2;
      else if(lay === '3_equal') n = 3;
      else if(lay === '5_equal') n = 5;
      else if(lay === '3_1_2_2') n = 3;
      updated.frontCount = n;
    } else if(typeof updated.frontCount !== 'number' || updated.frontCount === 0){
      updated.frontCount = 2;
    }
    if(subTypeVal === 'lodowkowa'){
      // domyślnie: lodówka w zabudowie, nisza 178, 2 fronty
      const cur = (updated.details && FC.utils.isPlainObject(updated.details)) ? updated.details : {};
      const opt = cur.fridgeOption ? String(cur.fridgeOption) : 'zabudowa';
      const niche = cur.fridgeNicheHeight ? String(cur.fridgeNicheHeight) : '178';
      const freeOpt = cur.fridgeFreeOption ? String(cur.fridgeFreeOption) : 'brak';
      const fc = cur.fridgeFrontCount ? String(cur.fridgeFrontCount) : '2';

      // szerokość: standard 60 (użytkownik może zmienić w polu szerokości)
      if(!Number.isFinite(Number(updated.width)) || Number(updated.width) <= 0){
        updated.width = 60;
      }

      // wysokość: dla zabudowy = wysokość dołu (z nogami) + nisza + (przegrody techn. * 1.8) + 3.6
      if(opt === 'zabudowa'){
        const s = projectData[room] ? projectData[room].settings : null;
        const bh = s ? (Number(s.bottomHeight) || 0) : 0;
        const leg = s ? (Number(s.legHeight) || 0) : 0;
        const bottomFrontH = Math.max(0, bh - leg);
        const div = (bottomFrontH > 74.5) ? Math.max(0, Math.ceil(((bottomFrontH - 74.5) / 2) - 1e-9)) : 0;
        const nh = Number(niche) || 0;
        if(nh > 0){
          updated.height = nh + (div * 1.8) + 3.6 + leg;
        }
      }

      // Przegroda techniczna: zależne od dolnego frontu (wys. dołu bez nóg), jak w zmywarce
      const s2 = projectData[room] ? projectData[room].settings : null;
      const leg = s2 ? (Number(s2.legHeight) || 0) : 0;
      const bottomFrontH = s2 ? Math.max(0, (Number(s2.bottomHeight) || 0) - leg) : 0;
      const div = (opt === 'zabudowa' && bottomFrontH > 74.5) ? Math.max(0, Math.ceil(((bottomFrontH - 74.5) / 2) - 1e-9)) : 0;

      updated.details = Object.assign({}, cur, {
        fridgeOption: opt,
        fridgeNicheHeight: niche,
        fridgeFreeOption: freeOpt,
        fridgeFrontCount: fc,
        techDividerCount: String(div)
      });

      // frontCount na kabinie nie używane dla lodówkowej (obsługa jest przez fridgeFrontCount),
      // ale zostawiamy niezerowe aby nie psuć UI w innych miejscach.
      if(typeof updated.frontCount !== 'number' || updated.frontCount === 0) updated.frontCount = 2;
    }
  }
  if(updated.type === 'wisząca'){
    if(typeof updated.frontCount !== 'number' || updated.frontCount === 0) updated.frontCount = 2;
  }

  return updated;
}

/* ===== Fronts storage helpers ===== */
function addFront(room, front){
  const f = Object.assign({
    id: FC.utils.uid(),
    material: 'laminat',
    color: '',
    width: 0,
    height: 0,
    note: '',
    setId: null,
    setNumber: null,
    cabId: null
  }, front);
  if(!projectData[room]) return;
  projectData[room].fronts = projectData[room].fronts || [];
  projectData[room].fronts.push(f);
}

function removeFrontsForSet(room, setId){
  projectData[room].fronts = (projectData[room].fronts || []).filter(f => f.setId !== setId);
}
function removeFrontsForCab(room, cabId){
  projectData[room].fronts = (projectData[room].fronts || []).filter(f => f.cabId !== cabId);
}
function getFrontsForSet(room, setId){
  return (projectData[room].fronts || []).filter(f => f.setId === setId);
}
function getFrontsForCab(room, cabId){
  return (projectData[room].fronts || []).filter(f => f.cabId === cabId);
}

/* ===== Front generation for cabinets (point 2 + 3) ===== */
function cabinetAllowsFrontCount(cab){
  if(cab.type !== 'stojąca' && cab.type !== 'wisząca' && cab.type !== 'moduł') return false;
  const st = cab.subType;
  if(st === 'narozna_l') return false; // narożna L: stała ilość frontów (2)
  if(st === 'uchylne') return false; // klapa: ilość frontów zależy od rodzaju
  if(st === 'szuflady') return false;
  if(st === 'zmywarkowa' || st === 'piekarnikowa') return false; // 1 front
  // reszta: pozwalamy 1/2
  return true;
}


function getFlapFrontCount(cab){
  const vendor = (cab.details && cab.details.flapVendor) ? String(cab.details.flapVendor) : 'blum';
  const kind = (cab.details && cab.details.flapKind) ? String(cab.details.flapKind) : 'HKI';
  // 2 fronty tylko dla Aventos HF top (uchylno‑składany)
  if(vendor === 'blum' && kind === 'HF_top') return 2;
  return 1;
}

// Backward-compat helper: older code may call this name.
function getFlapFrontCountFromDetails(details){
  return getFlapFrontCount({ details: details || {} });
}


function ensureFrontCountRules(cab){
  // Narożna L zawsze ma 2 fronty (liczone osobno: FL/FP)
  if(cab.subType === 'narozna_l'){
    cab.frontCount = 2;
    return;
  }

  // Uchylne (klapy): ilość frontów zależy od rodzaju podnośnika (HF top = 2, reszta = 1)
  if((cab.type === 'wisząca' || cab.type === 'moduł') && cab.subType === 'uchylne'){
    cab.frontCount = getFlapFrontCount(cab);
    return;
  }

  // Moduł: szuflady nie mają osobnego wyboru ilości frontów (fronty wynikają z układu)
  if(cab.type === 'moduł'){
    if(cab.subType === 'szuflady'){
      cab.frontCount = 0;
      return;
    }
    if(![1,2].includes(Number(cab.frontCount))) cab.frontCount = 2;
    return;
  }

  // Wisząca: domyślnie 2 fronty (chyba że specjalne tryby)
  if(cab.type === 'wisząca'){
    const isPod = (cab.subType === 'dolna_podblatowa');
    const mode = cab.details && cab.details.podFrontMode ? cab.details.podFrontMode : null;

    if(isPod && mode === 'brak'){
      cab.frontCount = 0;
      return;
    }
    if(isPod && mode === 'szuflady'){
      if(![1,2].includes(Number(cab.frontCount))) cab.frontCount = 2;
      return;
    }
    if(!cab.frontCount || cab.frontCount < 1) cab.frontCount = 2;
    return;
  }

  // Stojąca: domyślnie 2 fronty, wyjątki
  if(cab.type === 'stojąca'){
    if(cab.subType === 'rogowa_slepa'){
      const co = cab.details?.cornerOption || 'polki';
      if(co === 'magic_corner') cab.frontCount = 1;
    }
    if(!cab.frontCount || cab.frontCount < 1) cab.frontCount = 2;
    return;
  }
}


// ===== Walidacja AVENTOS (klapy uchylne) na etapie dodawania/edycji szafki =====
// Cel: jeśli KH/LF poza zakresem – nie pozwól zapisać szafki (zamiast ostrzeżeń w "Materiały").
// Używa istniejącego #cmFlapInfo (bez dodawania nowych elementów UI).
function validateAventosForDraft(room, draft){
  if(!room || !draft) return { ok:true };
  if(String(draft.subType || '') !== 'uchylne') return { ok:true };

  const info = getBlumAventosInfo(draft, room);
  if(!info) return { ok:true };

  if(info.status && info.status !== 'ok'){
    // jeśli da się dobrać poprzez zwiększenie liczby podnośników — to NIE jest błąd blokujący
    if(info.status === 'needs_more_lifts'){
      return { ok:true, warning:true, info, msg: String(info.message || '') };
    }
    let extra = '';
    if(info.status === 'out_pf' && info.neededLiftQty){
      extra = ` Potrzeba ok. ${info.neededLiftQty} podnośników.`;
    }
    const msg = String(info.message || `Poza zakresem: LF=${info.powerFactor}`) + extra;
    return { ok:false, info, msg };
  }

  // Ostrzeżenia informacyjne (np. zalecenia warsztatowe) przy status='ok'
  if(info.status === 'ok' && info.message && String(info.message).trim() && info.messageTone === 'orange'){
    return { ok:true, warning:true, info, msg: String(info.message) };
  }


  return { ok:true, info };
}

function applyAventosValidationUI(room, draft){
  const saveBtn = document.getElementById('cabinetModalSave');
  const infoEl = document.getElementById('cmFlapInfo');
  if(!saveBtn || !infoEl) return;

  const res = validateAventosForDraft(room, draft);

  // reset
  saveBtn.disabled = false;

  // domyślnie chowamy
  infoEl.style.display = 'none';
  infoEl.textContent = '';

  if(res.ok && !res.warning){
    return;
  }

  // pokaż komunikat (ostrzeżenie lub błąd)
  infoEl.style.display = 'block';
  infoEl.textContent = res.msg || '';

  if(!res.ok){
    // błąd blokujący
    saveBtn.disabled = true;
  }

  // Kolory tła: czerwony (blokuje) / pomarańczowy (ostrzeżenie lub za wysoki front)
  const tone = res.warning ? 'orange' : ((res.info && res.info.messageTone) ? res.info.messageTone : 'red');
  if(tone === 'orange'){
    infoEl.style.background = '#fff3cd';
    infoEl.style.border = '1px solid #ffecb5';
    infoEl.style.color = '#7a4b00';
  }else{
    infoEl.style.background = '#f8d7da';
    infoEl.style.border = '1px solid #f5c2c7';
    infoEl.style.color = '#7a0000';
  }
  infoEl.style.padding = '10px';
  infoEl.style.borderRadius = '8px';
}


function syncDraftFromCabinetModalForm(d){
  if(!d) return;
  const num = (id) => {
    const el = document.getElementById(id);
    if(!el) return null;
    const raw = String(el.value ?? '').trim().replace(',', '.');
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };
  const str = (id) => {
    const el = document.getElementById(id);
    if(!el) return null;
    const v = String(el.value ?? '').trim();
    return v;
  };

  const w = num('cmWidth');  if(w !== null) d.width = w;
  const h = num('cmHeight'); if(h !== null) d.height = h;
  const dep = num('cmDepth'); if(dep !== null) d.depth = dep;

  const fc = num('cmFrontCount'); // może nie istnieć (np. klapa/narożna L)
  if(fc !== null) d.frontCount = fc;

  // półki
  // UWAGA: cmShelves istnieje w DOM zawsze (ukryty wrap), ale nie każda szafka używa tego pola.
  // Żeby nie nadpisywać wartości ustawianych w dynamicznych polach (np. Moduł→Standardowa),
  // czytamy cmShelves tylko wtedy, gdy jego wrap jest widoczny.
  const shWrap = document.getElementById('cmShelvesWrap');
  const shWrapVisible = !!(shWrap && shWrap.style.display !== 'none' && shWrap.offsetParent !== null);
  if(shWrapVisible){
    const sh = num('cmShelves');
    if(sh !== null){
      // store as integer number for consistency across cabinet types
      d.details = Object.assign({}, d.details || {}, { shelves: Math.max(0, Math.round(sh)) });
    }
  }

  // narożna L (GL/GP/ST/SP)
  const gl = num('cmGL'), gp = num('cmGP'), st = num('cmST'), sp = num('cmSP');
  if([gl,gp,st,sp].some(v => v !== null)){
    d.details = Object.assign({}, d.details || {}, {
      gl: gl !== null ? String(gl) : (d.details?.gl ?? ''),
      gp: gp !== null ? String(gp) : (d.details?.gp ?? ''),
      st: st !== null ? String(st) : (d.details?.st ?? ''),
      sp: sp !== null ? String(sp) : (d.details?.sp ?? '')
    });
    // pomocniczo: szerokość=ST, głębokość=max(GL,GP) – tak jak w sync narożnej
    if(st !== null) d.width = st;
    if(gl !== null || gp !== null) d.depth = Math.max(gl ?? 0, gp ?? 0);
  }

  // klapa (uchylne)
  const flapVendor = str('cmFlapVendor');
  const flapKind = str('cmFlapKind');
  if((d.type === 'wisząca' || d.type === 'moduł') && d.subType === 'uchylne'){
    const det = Object.assign({}, d.details || {});
    if(flapVendor) det.flapVendor = flapVendor;
    if(flapKind) det.flapKind = flapKind;
    d.details = det;
  }
}


function generateFrontsForCabinet(room, cab){
  // czyścimy stare
  removeFrontsForCab(room, cab.id);

  // tylko jeśli ma sens
  if(!(cab.type === 'stojąca' || cab.type === 'wisząca' || cab.type === 'moduł')) return;

  // wysokość frontów: dla szafek stojących odejmujemy wysokość nóżek (ustawienia pomieszczenia)
  function getFrontHeightForCab(){
    let h = Number(cab.height) || 0;
    if(cab.type === 'stojąca'){
      const s = (projectData[room] && projectData[room].settings) ? projectData[room].settings : {};
      const leg = Number(s.legHeight) || 0;
      if(leg > 0) h = Math.max(0, h - leg);
    }
    return h;
  }
  if(cab.subType === 'szuflady'){
    const d = cab.details || {};
    // układ szuflad (kompatybilność wstecz: drawerCount)
    let lay = String(d.drawerLayout || '');
    if(!lay){
      const legacy = String(d.drawerCount || '3');
      if(legacy === '1') lay = '1_big';
      else if(legacy === '2') lay = '2_equal';
      else if(legacy === '3') lay = '3_1_2_2';
      else if(legacy === '5') lay = '5_equal';
      else lay = '3_equal';
    }

    let ratios = [1,2,2];
    if(lay === '1_big') ratios = [1];
    else if(lay === '2_equal') ratios = [1,1];
    else if(lay === '3_equal') ratios = [1,1,1];
    else if(lay === '5_equal') ratios = [1,1,1,1,1];
    else if(lay === '3_1_2_2') ratios = [1,2,2];

    const cabW = Number(cab.width) || 0;
    const cabH = getFrontHeightForCab();
    const sum = ratios.reduce((a,b)=>a+b,0) || 1;

    // wylicz wysokości z zaokrągleniem do 0.1 i korektą ostatniego
    const heights = [];
    let acc = 0;
    for(let i=0;i<ratios.length;i++){
      let h = (cabH * ratios[i]) / sum;
      h = Math.round(h*10)/10;
      if(i === ratios.length-1){
        h = Math.round((cabH - acc)*10)/10;
      }
      acc += h;
      heights.push(h);
    }

    const mat = cab.frontMaterial || 'laminat';
    const col = cab.frontColor || '';
    // zapisujemy też poprawną ilość frontów dla podsumowania
    cab.frontCount = ratios.length;

    for(let i=0;i<heights.length;i++){
      addFront(room, { id: FC.utils.uid(), cabId: cab.id, setId: cab.setId||null, setNumber: cab.setNumber||null, material: mat, color: col, width: cabW, height: heights[i], note: `Szuflada ${i+1}` });
    }
    return;
  }

  const mat = cab.frontMaterial || 'laminat';
  const col = cab.frontColor || '';

  // effectiveW: szerokość używana do frontów (niektóre typy mają zaślepienia)
  let effectiveW = Number(cab.width)||0;
  if(cab.subType === 'rogowa_slepa'){
    const blind = Math.max(0, Number(cab.details?.blindPart)||0);
    effectiveW = Math.max(0, effectiveW - blind);
  }

  // dolna_podblatowa (wisząca): tryb frontu (brak / drzwi / szuflady)
  if(cab.type === 'wisząca' && cab.subType === 'dolna_podblatowa'){
    const d = cab.details || {};
    const mode = d.podFrontMode || (d.subTypeOption && String(d.subTypeOption).startsWith('szuflada') ? 'szuflady' : ((Number(cab.frontCount)||0) ? 'drzwi' : 'brak'));

    // brak frontu
    if(mode === 'brak' || (Number(cab.frontCount)||0) === 0){
      return;
    }

    // szuflady zamiast drzwi: fronty poziome na pełną szerokość
    if(mode === 'szuflady'){
      const n = Math.max(1, Number(cab.frontCount)||1);
      const cabW = Number(cab.width) || 0;
      const cabH = getFrontHeightForCab();
      const hEach = n ? Math.round((cabH / n) * 10) / 10 : 0;

      for(let i=0;i<n;i++){
        addFront(room, { id: FC.utils.uid(), cabId: cab.id, setId: cab.setId||null, setNumber: cab.setNumber||null, material: mat, color: col, width: cabW, height: hEach, note: `Szuflada ${i+1}/${n}` });
      }
      return;
    }
    // drzwi -> normalna logika poniżej (szerokość dzielona przez ilość frontów)
  }

// uchylne (klapa) – 1 front lub 2 fronty (Aventos HF)
if((cab.type === 'wisząca' || cab.type === 'moduł') && cab.subType === 'uchylne'){
  const fcFlap = getFlapFrontCount(cab);
  cab.frontCount = fcFlap; // informacyjnie + do podsumowań
  const fhFull = getFrontHeightForCab();
  const noteBase = (cab.details && cab.details.flapVendor) ? `Klapa (${cab.details.flapVendor})` : 'Klapa';
  if(fcFlap === 1){
    addFront(room, { cabId: cab.id, material: mat, color: col, width: effectiveW, height: fhFull, note: noteBase });
  } else {
    const h1 = Math.round((fhFull/2)*10)/10;
    const h2 = Math.max(0, Math.round((fhFull - h1)*10)/10);
    addFront(room, { cabId: cab.id, material: mat, color: col, width: effectiveW, height: h1, note: `${noteBase} – front 1/2` });
    addFront(room, { cabId: cab.id, material: mat, color: col, width: effectiveW, height: h2, note: `${noteBase} – front 2/2` });
  }
  return;
}

  // lodówkowa w zabudowie — specjalna logika (point 3)
  if(cab.type === 'stojąca' && cab.subType === 'lodowkowa'){
    const opt = (cab.details && cab.details.fridgeOption) ? cab.details.fridgeOption : 'zabudowa';
    

const fc = (cab.details && cab.details.fridgeFrontCount) ? String(cab.details.fridgeFrontCount) : '2';

    if(opt === 'zabudowa'){
      const s = projectData[room].settings;
      const legH = (Number(s.legHeight)||0);
      const bottomFront = Math.max(0, (Number(s.bottomHeight)||0) - legH); // dolny front bez nóg
      const totalFrontH = Math.max(0, (Number(cab.height)||0) - legH); // suma wysokości frontów (bez nóg)
      if(fc === '1'){
        addFront(room, { cabId: cab.id, material: mat, color: col, width: Number(cab.width)||0, height: getFrontHeightForCab(), note: `Lodówkowa (1 front)` });
      } else {
        const topFront = Math.max(0, totalFrontH - bottomFront);
        addFront(room, { cabId: cab.id, material: mat, color: col, width: Number(cab.width)||0, height: bottomFront, note: `Lodówkowa (dolny front)` });
        addFront(room, { cabId: cab.id, material: mat, color: col, width: Number(cab.width)||0, height: topFront, note: `Lodówkowa (górny front)` });
      }
      return;
    }
    // wolnostojąca: brak frontów (obudowa/podest to elementy korpusu, nie fronty)
    return;
  }

  // zmywarkowa: 1 front
  if(cab.type === 'stojąca' && cab.subType === 'zmywarkowa'){
    addFront(room, { cabId: cab.id, material: mat, color: col, width: Number(cab.width)||0, height: getFrontHeightForCab(), note: `zmywarkowa (1 front)` });
    return;
  }

  // piekarnikowa: front = wysokość szafki (bez nóżek) minus wysokość piekarnika
  if(cab.type === 'stojąca' && cab.subType === 'piekarnikowa'){
    const ovenH = Number(cab.details?.ovenHeight) || 60;
    const h = Math.max(0, getFrontHeightForCab() - ovenH);
    addFront(room, { cabId: cab.id, material: mat, color: col, width: Number(cab.width)||0, height: h, note: `piekarnikowa (front bez piekarnika)` });
    return;
  }

  // reszta: 1 lub 2 fronty (drzwi)


  // narożna L (wisząca / stojąca): fronty liczone z GL/GP/ST/SP (cm)
  if((cab.type === 'wisząca' || cab.type === 'stojąca') && cab.subType === 'narozna_l'){
    const d = cab.details || {};
    const GL = Number(d.gl) || 0;
    const GP = Number(d.gp) || 0;
    const ST = Number(d.st) || 0;
    const SP = Number(d.sp) || 0;
    const t = 1.8; // cm (płyta 18mm)

    const FL = Math.abs(GL - GP);
    const FP = Math.abs(ST - SP - t);

    const fh = getFrontHeightForCab();
    addFront(room, { cabId: cab.id, material: mat, color: col, width: FL, height: fh, note: `Narożna L (front A)` });
    addFront(room, { cabId: cab.id, material: mat, color: col, width: FP, height: fh, note: `Narożna L (front B)` });
    // wymuszamy 2 dla spójności podsumowania
    cab.frontCount = 2;
    return;
  }

  const fc = Math.max(1, Number(cab.frontCount||2));
  if(fc === 1){
    addFront(room, { cabId: cab.id, material: mat, color: col, width: effectiveW, height: getFrontHeightForCab(), note: `1 front` });
  } else {
    const w = effectiveW;
    const left = Math.round((w/2)*10)/10;
    const right = Math.max(0, w - left);
    addFront(room, { cabId: cab.id, material: mat, color: col, width: left, height: getFrontHeightForCab(), note: `Front 1/2` });
    addFront(room, { cabId: cab.id, material: mat, color: col, width: right, height: getFrontHeightForCab(), note: `Front 2/2` });
  }
}



function drawCornerSketch(opts){
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

/* delete selected cabinet or last if none selected */
function deleteSelectedCabinet(){
  const room = uiState.roomType; if(!room) return;
  let sel = uiState.selectedCabinetId;
  if(!sel){
    const arr = projectData[room].cabinets || [];
    if(arr.length === 0){ alert('Brak szafek do usunięcia'); return; }
    sel = arr[arr.length-1].id;
  }
  deleteCabinetById(sel);
}

/* ===== Price modal functions ===== */
function closePriceModal(){ unlockModalScroll(); uiState.showPriceList = null; uiState.editingId = null; FC.storage.setJSON(STORAGE_KEYS.ui, uiState); document.getElementById('priceModal').style.display = 'none'; }

function saveMaterialFromForm(){
  const type = document.getElementById('formMaterialType').value;
  const manufacturer = document.getElementById('formManufacturer').value;
  const symbol = document.getElementById('formSymbol').value.trim();
  const name = document.getElementById('formName').value.trim();
  const price = parseFloat(document.getElementById('formPrice').value || 0);
  if(!name){ alert('Wprowadź nazwę'); return; }
  const data = { materialType: type, manufacturer, symbol, name, price };
  if(uiState.editingId){
    materials = materials.map(m => m.id === uiState.editingId ? Object.assign({}, m, data) : m);
    uiState.editingId = null;
  } else {
    const id = FC.utils.uid();
    materials.push(Object.assign({ id }, data));
  }
  FC.storage.setJSON(STORAGE_KEYS.materials, materials);
  renderPriceModal();
  renderCabinetModal();
}

function saveServiceFromForm(){
  const category = document.getElementById('formCategory').value.trim() || 'Montaż';
  const name = document.getElementById('formServiceName').value.trim();
  const price = parseFloat(document.getElementById('formServicePrice').value || 0);
  if(!name){ alert('Wprowadź nazwę'); return; }
  const data = { category, name, price };
  if(uiState.editingId){
    services = services.map(s => s.id === uiState.editingId ? Object.assign({}, s, data) : s);
    uiState.editingId = null;
  } else {
    const id = FC.utils.uid();
    services.push(Object.assign({ id }, data));
  }
  FC.storage.setJSON(STORAGE_KEYS.services, services);
  renderPriceModal();
}

function deletePriceItem(item){
  if(!confirm('Usunąć pozycję?')) return;
  if(uiState.showPriceList === 'materials'){ materials = materials.filter(m => m.id !== item.id); FC.storage.setJSON(STORAGE_KEYS.materials, materials); }
  else { services = services.filter(s => s.id !== item.id); FC.storage.setJSON(STORAGE_KEYS.services, services); }
  renderPriceModal();
  renderCabinetModal();
}

/* ===== Cabinet Modal helpers ===== */
function makeDefaultCabinetDraftForRoom(room){
  const arr = projectData[room].cabinets;
  const last = arr[arr.length - 1];

  // powiel poprzednią ze wszystkimi ustawieniami
  if(last){
    const cloned = FC.utils.clone(last);
    cloned.id = null;
    delete cloned.setId;
    delete cloned.setPreset;
    delete cloned.setRole;
    delete cloned.setName;
    delete cloned.setNumber;
    return cloned;
  }

  const isKitchen = room === 'kuchnia';
  const baseLaminat = (materials.find(m=>m.materialType==='laminat')?.name || '');
  return {
    id: null,
    width: 60,
    height: isKitchen ? projectData.kuchnia.settings.bottomHeight : 200,
    depth: isKitchen ? 51 : 60,
    type: isKitchen ? 'stojąca' : 'moduł',
    subType: 'standardowa',
    bodyColor: baseLaminat,
    frontMaterial: 'laminat',
    frontColor: baseLaminat,
    openingSystem: 'uchwyt klienta',
    backMaterial: 'HDF 3mm biała',
    frontCount: 2,
    details: { insideMode: 'polki', innerDrawerCount: '1', innerDrawerType: 'blum', shelves: 1, cornerOption: 'polki', dishWasherWidth: '60', ovenOption: 'szuflada_dol', ovenHeight: '60', sinkOption: 'zwykle_drzwi', fridgeOption: 'zabudowa', fridgeWidth: '60', drawerCount: '3', subTypeOption: 'polki', fridgeFrontCount: '2' }
  };
}

function openCabinetModalForAdd(){
  cabinetModalState.mode = 'add';
  cabinetModalState.editingId = null;
  cabinetModalState.setEditId = null;
  cabinetModalState.chosen = null;
  cabinetModalState.setPreset = null;
  cabinetModalState.draft = makeDefaultCabinetDraftForRoom(uiState.roomType);
  renderCabinetModal();
  document.getElementById('cabinetModal').style.display = 'flex';
  lockModalScroll();
}


function lockModalScroll(){
  document.documentElement.classList.add('modal-lock');
  document.body.classList.add('modal-lock');
}
function unlockModalScroll(){
  document.documentElement.classList.remove('modal-lock');
  document.body.classList.remove('modal-lock');
}

function openCabinetModalForEdit(cabId){
  cabId = String(cabId);
  const room = uiState.roomType; if(!room) return;
  const cab = projectData[room].cabinets.find(c => String(c.id) === cabId);
  if(!cab) return;

  if(cab.setId){
    openSetWizardForEdit(cab.setId);
    return;
  }

  cabinetModalState.mode = 'edit';
  cabinetModalState.editingId = cabId;
  cabinetModalState.setEditId = null;
  cabinetModalState.chosen = cab.type;
  cabinetModalState.setPreset = null;
  cabinetModalState.draft = FC.utils.clone(cab);
  renderCabinetModal();
  document.getElementById('cabinetModal').style.display = 'flex';
  lockModalScroll();
}

function openSetWizardForEdit(setId){
  setId = String(setId);
  const room = uiState.roomType; if(!room) return;
  const set = projectData[room].sets.find(s => String(s.id) === setId);
  if(!set){ alert('Nie znaleziono zestawu'); return; }

  cabinetModalState.mode = 'add';
  cabinetModalState.editingId = null;
  cabinetModalState.setEditId = setId;
  cabinetModalState.chosen = 'zestaw';
  cabinetModalState.setPreset = set.presetId;
  cabinetModalState.draft = null;

  renderCabinetModal();
  fillSetParamsUIFromSet(set);
  document.getElementById('cabinetModal').style.display = 'flex';
  lockModalScroll();
}

function closeCabinetModal(){
  unlockModalScroll();
  document.getElementById('cabinetModal').style.display = 'none';
}

/* ===== Cabinet Modal rendering ===== */
function populateSelect(el, options, selected){
  el.innerHTML = '';
  options.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.v; opt.textContent = o.t;
    if(selected === o.v) opt.selected = true;
    el.appendChild(opt);
  });
}

function populateFrontColorsTo(selectEl, typeVal, selected){
  selectEl.innerHTML = '';
  materials.filter(m => m.materialType === typeVal).forEach(m => {
    const o = document.createElement('option');
    o.value = m.name; o.textContent = m.name;
    if(m.name === selected) o.selected = true;
    selectEl.appendChild(o);
  });
  if(selectEl.options.length === 0){
    const o = document.createElement('option'); o.value=''; o.textContent='— brak —';
    selectEl.appendChild(o);
  }
}

function populateBodyColorsTo(selectEl, selected){
  selectEl.innerHTML = '';
  materials.filter(m => m.materialType === 'laminat').forEach(m => {
    const o = document.createElement('option');
    o.value = m.name; o.textContent = m.name;
    if(m.name === selected) o.selected = true;
    selectEl.appendChild(o);
  });
  if(selectEl.options.length === 0){
    const o = document.createElement('option'); o.value=''; o.textContent='— brak —';
    selectEl.appendChild(o);
  }
}

function populateOpeningOptionsTo(selectEl, typeVal, selected){
  selectEl.innerHTML = '';
  const isHanging = typeVal === 'wisząca';
  const options = isHanging
    ? ['uchwyt klienta','podchwyt','TIP-ON','krawędziowy HEXA GTV','korytkowy','UKW']
    : ['uchwyt klienta','TIP-ON','krawędziowy HEXA GTV','UKW','korytkowy'];
  options.forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    if(v === selected) o.selected = true;
    selectEl.appendChild(o);
  });
}

/* ===== Zestawy (presety) ===== */
function wireSetParamsLiveUpdate(presetId){
  const room = uiState.roomType;
  const s = projectData[room].settings;

  function val(id, fallback=0){
    const el = document.getElementById(id);
    if(!el) return fallback;
    return Number(el.value || fallback);
  }

  function update(){
    const bl = val('setBlende', Number(s.ceilingBlende)||0);

    if(presetId === 'A'){
      const db = val('setDBottom', 51);
      const hB = val('setHBottom', Number(s.bottomHeight)||82);
      const ht = calcTopForSet(room, bl, hB);
      const dt = Math.max(0, Math.round((db - 1) * 10)/10);
      const htEl = document.getElementById('setHTopResult');
      const dtEl = document.getElementById('setDTopResult');
      if(htEl) htEl.value = ht;
      if(dtEl) dtEl.value = dt;
    }

    if(presetId === 'C'){
      const db = val('setDBottom', 51);
      const hB = val('setHBottom', Number(s.bottomHeight)||82);
      const ht = calcTopForSet(room, bl, hB);
      const dt = Math.max(0, Math.round((db - 1) * 10)/10);
      const htEl = document.getElementById('setHTopResult');
      const dtEl = document.getElementById('setDTopResult');
      if(htEl) htEl.value = ht;
      if(dtEl) dtEl.value = dt;
    }

    if(presetId === 'D'){
      const db = val('setDBottom', 51);
      const hb = val('setHBottom', Number(s.bottomHeight)||82);
      const hm = val('setHMiddle', 100);
      const ht = calcTopForSet(room, bl, (hb + hm));
      const dt = Math.max(0, Math.round((db - 1) * 10)/10);
      const htEl = document.getElementById('setHTopResult');
      const dtEl = document.getElementById('setDTopResult');
      if(htEl) htEl.value = ht;
      if(dtEl) dtEl.value = dt;
    }
  }

  ['setDBottom','setBlende','setHBottom','setHMiddle'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', update);
  });

  update();
}

/* ===== Cabinet modal render ===== */
/* ===== create fronts for sets ===== */
function createFrontsForSet(room, presetId, frontCount, frontMaterial, frontColor, dims, setId, setNumber){
  const fc = Number(frontCount||1);

  if(presetId === 'A'){
    const { w1, w2, hB, hTop } = dims;
    const totalH = (Number(hB)||0) + (Number(hTop)||0);
    if(fc === 1){
      addFront(room, { setId, setNumber, material: frontMaterial, color: frontColor, width: (Number(w1)||0) + (Number(w2)||0), height: totalH, note: `Zestaw ${setNumber}: 1 front` });
    } else {
      addFront(room, { setId, setNumber, material: frontMaterial, color: frontColor, width: (Number(w1)||0), height: totalH, note: `Zestaw ${setNumber}: front lewy` });
      addFront(room, { setId, setNumber, material: frontMaterial, color: frontColor, width: (Number(w2)||0), height: totalH, note: `Zestaw ${setNumber}: front prawy` });
    }
    return;
  }

  if(presetId === 'C'){
    const { w, hB, hTop } = dims;
    const totalH = (Number(hB)||0) + (Number(hTop)||0);
    if(fc === 1){
      addFront(room, { setId, setNumber, material: frontMaterial, color: frontColor, width: (Number(w)||0), height: totalH, note: `Zestaw ${setNumber}: 1 front` });
    } else {
      const half = Math.round(((Number(w)||0) / 2) * 10)/10;
      addFront(room, { setId, setNumber, material: frontMaterial, color: frontColor, width: half, height: totalH, note: `Zestaw ${setNumber}: front 1/2` });
      addFront(room, { setId, setNumber, material: frontMaterial, color: frontColor, width: (Number(w)||0) - half, height: totalH, note: `Zestaw ${setNumber}: front 2/2` });
    }
    return;
  }

  if(presetId === 'D'){
    const { w, hB, hM, hTop } = dims;
    const totalH = (Number(hB)||0) + (Number(hM)||0) + (Number(hTop)||0);
    if(fc === 1){
      addFront(room, { setId, setNumber, material: frontMaterial, color: frontColor, width: (Number(w)||0), height: totalH, note: `Zestaw ${setNumber}: 1 front` });
    } else {
      const half = Math.round(((Number(w)||0) / 2) * 10)/10;
      addFront(room, { setId, setNumber, material: frontMaterial, color: frontColor, width: half, height: totalH, note: `Zestaw ${setNumber}: front 1/2` });
      addFront(room, { setId, setNumber, material: frontMaterial, color: frontColor, width: (Number(w)||0) - half, height: totalH, note: `Zestaw ${setNumber}: front 2/2` });
    }
    return;
  }
}

/* ===== Zestaw: odczyt/wpis parametrów UI ===== */
function getSetParamsFromUI(presetId){
  const room = uiState.roomType;
  const s = projectData[room].settings;

  function num(id, fallback=0){
    const el = document.getElementById(id);
    if(!el) return fallback;
    return Number(el.value || fallback);
  }

  const blende = num('setBlende', Number(s.ceilingBlende)||0);
  const dBottom = num('setDBottom', 51);
  const dModule = Math.max(0, Math.round((dBottom - 1)*10)/10);

  if(presetId === 'A'){
    const w1 = num('setW1', 60);
    const w2 = num('setW2', 60);
    const hB = num('setHBottom', Number(s.bottomHeight)||82);
    const hTop = calcTopForSet(room, blende, hB);
    return { presetId, w1,w2, hB, hTop, dBottom, dModule, blende };
  }
  if(presetId === 'C'){
    const w = num('setW', 60);
    const hB = num('setHBottom', Number(s.bottomHeight)||82);
    const hTop = calcTopForSet(room, blende, hB);
    return { presetId, w, hB, hTop, dBottom, dModule, blende };
  }
  if(presetId === 'D'){
    const w = num('setW', 60);
    const hB = num('setHBottom', Number(s.bottomHeight)||82);
    const hM = num('setHMiddle', 100);
    const hTop = calcTopForSet(room, blende, (hB + hM));
    return { presetId, w, hB, hM, hTop, dBottom, dModule, blende };
  }
  return null;
}

function fillSetParamsUIFromSet(set){
  renderSetParamsUI(set.presetId);

  const p = set.params || {};
  function setVal(id,v){
    const el = document.getElementById(id);
    if(el && v != null && !el.disabled) el.value = v;
  }

  if(set.presetId === 'A'){
    setVal('setW1', p.w1);
    setVal('setW2', p.w2);
    setVal('setHBottom', p.hB);
    setVal('setDBottom', p.dBottom);
    setVal('setBlende', p.blende);
  }
  if(set.presetId === 'C'){
    setVal('setW', p.w);
    setVal('setHBottom', p.hB);
    setVal('setDBottom', p.dBottom);
    setVal('setBlende', p.blende);
  }
  if(set.presetId === 'D'){
    setVal('setW', p.w);
    setVal('setHBottom', p.hB);
    setVal('setHMiddle', p.hM);
    setVal('setDBottom', p.dBottom);
    setVal('setBlende', p.blende);
  }

  const cntSel = document.getElementById('setFrontCount');
  const matSel = document.getElementById('setFrontMaterial');
  const colSel = document.getElementById('setFrontColor');

  if(cntSel && set.frontCount) cntSel.value = String(set.frontCount);
  if(matSel && set.frontMaterial) matSel.value = set.frontMaterial;
  if(colSel){
    populateFrontColorsTo(colSel, (matSel ? matSel.value : 'laminat'), set.frontColor || '');
    colSel.value = set.frontColor || colSel.value;
  }

  wireSetParamsLiveUpdate(set.presetId);
}

/* ===== Create/Update set ===== */
function getNextSetNumber(room){
  const arr = projectData[room].sets || [];
  let max = 0;
  arr.forEach(s=>{ if(typeof s.number === 'number') max = Math.max(max, s.number); });
  return max + 1;
}

function createOrUpdateSetFromWizard(){
  const room = uiState.roomType; if(!room){ alert('Wybierz pomieszczenie'); return; }
  const presetId = cabinetModalState.setPreset;
  if(!presetId){ alert('Wybierz zestaw'); return; }

  const params = getSetParamsFromUI(presetId);
  if(!params){ alert('Brak parametrów'); return; }

  const frontCount = Number(document.getElementById('setFrontCount').value || 1);
  const frontMaterial = document.getElementById('setFrontMaterial').value;
  const frontColor = document.getElementById('setFrontColor').value || '';

  const isEdit = !!cabinetModalState.setEditId;
  const setId = isEdit ? cabinetModalState.setEditId : FC.utils.uid();

  let setNumber;
  if(isEdit){
    const old = projectData[room].sets.find(s=>s.id===setId);
    setNumber = old && typeof old.number === 'number' ? old.number : getNextSetNumber(room);
  } else {
    setNumber = getNextSetNumber(room);
  }

  const base = makeDefaultCabinetDraftForRoom(room);

  function finalizeCab(c){
    c.id = c.id || FC.utils.uid();
    if(!c.details) c.details = FC.utils.clone(base.details || {});
    if(!c.bodyColor) c.bodyColor = base.bodyColor;
    if(!c.frontMaterial) c.frontMaterial = base.frontMaterial || 'laminat';
    if(!c.frontColor){
      const first = materials.find(m => m.materialType === c.frontMaterial);
      c.frontColor = first ? first.name : '';
    }
    if(!c.openingSystem) c.openingSystem = base.openingSystem || 'uchwyt klienta';
    if(!c.backMaterial) c.backMaterial = base.backMaterial || 'HDF 3mm biała';
    c.setId = setId;
    c.setPreset = presetId;
    c.setNumber = setNumber;
    c.setName = `Zestaw ${setNumber}`;
    return c;
  }

  if(isEdit){
    projectData[room].cabinets = projectData[room].cabinets.filter(c => c.setId !== setId);
    removeFrontsForSet(room, setId);
  }

  const created = [];

  if(presetId === 'A'){
    const cab1 = finalizeCab(Object.assign({}, FC.utils.clone(base), { type:'stojąca', subType:'standardowa', width:params.w1, height:params.hB, depth:params.dBottom, setRole:'dolny_lewy', frontCount:2 }));
    const cab2 = finalizeCab(Object.assign({}, FC.utils.clone(base), { type:'stojąca', subType:'standardowa', width:params.w2, height:params.hB, depth:params.dBottom, setRole:'dolny_prawy', frontCount:2 }));
    const top = finalizeCab(Object.assign({}, FC.utils.clone(base), { type:'moduł', subType:'standardowa', width:(params.w1+params.w2), height:params.hTop, depth:params.dModule, setRole:'gorny_modul', frontCount:0 }));
    created.push(cab1, cab2, top);

    createFrontsForSet(room, 'A', frontCount, frontMaterial, frontColor, {w1:params.w1,w2:params.w2,hB:params.hB,hTop:params.hTop}, setId, setNumber);
  }

  if(presetId === 'C'){
    const bottom = finalizeCab(Object.assign({}, FC.utils.clone(base), { type:'stojąca', subType:'standardowa', width:params.w, height:params.hB, depth:params.dBottom, setRole:'dolny', frontCount:2 }));
    const top = finalizeCab(Object.assign({}, FC.utils.clone(base), { type:'moduł', subType:'standardowa', width:params.w, height:params.hTop, depth:params.dModule, setRole:'gorny_modul', frontCount:0 }));
    created.push(bottom, top);

    createFrontsForSet(room, 'C', frontCount, frontMaterial, frontColor, {w:params.w,hB:params.hB,hTop:params.hTop}, setId, setNumber);
  }

  if(presetId === 'D'){
    const bottom = finalizeCab(Object.assign({}, FC.utils.clone(base), { type:'stojąca', subType:'standardowa', width:params.w, height:params.hB, depth:params.dBottom, setRole:'dolny', frontCount:2 }));
    const middle = finalizeCab(Object.assign({}, FC.utils.clone(base), { type:'moduł', subType:'standardowa', width:params.w, height:params.hM, depth:params.dModule, setRole:'srodkowy_modul', frontCount:0 }));
    const top = finalizeCab(Object.assign({}, FC.utils.clone(base), { type:'moduł', subType:'standardowa', width:params.w, height:params.hTop, depth:params.dModule, setRole:'gorny_modul', frontCount:0 }));
    created.push(bottom, middle, top);

    createFrontsForSet(room, 'D', frontCount, frontMaterial, frontColor, {w:params.w,hB:params.hB,hM:params.hM,hTop:params.hTop}, setId, setNumber);
  }

  created.forEach(c => {
    projectData[room].cabinets.push(c);
    // domyślnie zwinięte
    
  });

  const setRecord = {
    id: setId,
    presetId,
    number: setNumber,
    params,
    frontCount,
    frontMaterial,
    frontColor
  };

  if(isEdit){
    projectData[room].sets = projectData[room].sets.map(s => s.id===setId ? setRecord : s);
  } else {
    projectData[room].sets.push(setRecord);
  }

  projectData = FC.project.save(projectData);
  FC.storage.setJSON(STORAGE_KEYS.ui, uiState);

  closeCabinetModal();
  renderCabinets();
}

/* ===== Read-only: cabinet details summary ===== */
function getCabinetExtraSummary(room, cab){
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
}


/* ===== Materiały: rozpiska mebli (korpusy/plecy/trawersy) ===== */
const FC_BOARD_THICKNESS_CM = 1.8; // domyślnie płyta 18mm (do obliczeń wymiarów "między bokami")
const FC_TOP_TRAVERSE_DEPTH_CM = 9; // trawersy górne mają głębokość 9cm

function fmtCm(v){
  const n = Number(v);
  if(!Number.isFinite(n)) return String(v ?? '');
  return (Math.round(n * 10) / 10).toString();
}

function formatM2(v){
  const n = Number(v);
  if(!Number.isFinite(n)) return '0.000';
  return (Math.round(n * 1000) / 1000).toFixed(3);
}

function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[ch] || ch));
}

function calcPartAreaM2(p){
  const a = Number(p.a) || 0;
  const b = Number(p.b) || 0;
  const qty = Number(p.qty) || 0;
  return qty * (a * b) / 10000; // cm^2 -> m^2
}

function addArea(map, material, area){
  const key = String(material || '');
  if(!key) return;
  map[key] = (map[key] || 0) + (Number(area) || 0);
}

function totalsFromParts(parts){
  const totals = {};
  (parts || []).forEach(p => addArea(totals, p.material, calcPartAreaM2(p)));
  return totals;
}

function mergeTotals(target, src){
  for(const k in (src || {})){
    target[k] = (target[k] || 0) + (src[k] || 0);
  }
  return target;
}

function totalsToRows(totals){
  return Object.entries(totals || {})
    .map(([material, m2]) => ({ material, m2 }))
    .filter(r => r.m2 > 0)
    .sort((a,b) => b.m2 - a.m2);
}

function getCabinetAssemblyRuleText(cab){
  if(cab.type === 'wisząca' || cab.type === 'moduł'){
    return 'Skręcanie: wieniec górny i dolny między bokami.';
  }
  if(cab.type === 'stojąca'){
    return `Skręcanie: wieniec dolny pod bokami (boki niższe o ${FC_BOARD_THICKNESS_CM} cm); góra na trawersach 2×${FC_TOP_TRAVERSE_DEPTH_CM} cm (przód+tył).`;
  }
  return 'Skręcanie: —';
}




function getCabinetFrontCutListForMaterials(room, cab){
  // Zwraca listę elementów "Front" do zakładki Materiały.
  // Ważne: bez komentarzy w polu wymiarów oraz z agregacją identycznych frontów (qty zamiast duplikatów).
  const out = [];
  if(!cab || !(cab.type === 'stojąca' || cab.type === 'wisząca' || cab.type === 'moduł')) return out;

  const mat = cab.frontMaterial || 'laminat';
  const col = cab.frontColor || '';

  // Agregator: klucz = material|W|H (W/H zaokrąglone do 0,1cm)
  const acc = new Map();
  function addFront(w, h){
    const W = Math.max(0, Number(w) || 0);
    const H = Math.max(0, Number(h) || 0);
    if(W <= 0 || H <= 0) return;

    const Wr = Math.round(W * 10) / 10;
    const Hr = Math.round(H * 10) / 10;
    const materialKey = `Front: ${mat}${col ? ` • ${col}` : ''}`;
    const key = `${materialKey}|${Wr}|${Hr}`;

    if(acc.has(key)){
      acc.get(key).qty += 1;
      return;
    }
    acc.set(key, {
      name: 'Front',
      qty: 1,
      a: Wr,
      b: Hr,
      // Bez komentarzy w wymiarach
      dims: `${fmtCm(Wr)} × ${fmtCm(Hr)}`,
      material: materialKey
    });
  }
  function finalize(){ return Array.from(acc.values()); }

  // wysokość frontów: dla stojących odejmujemy wysokość nóżek (ustawienia pomieszczenia)
  function getFrontHeightForCab(){
    let h = Number(cab.height) || 0;
    if(cab.type === 'stojąca'){
      const s = (projectData[room] && projectData[room].settings) ? projectData[room].settings : {};
      const leg = Number(s.legHeight) || 0;
      if(leg > 0) h = Math.max(0, h - leg);
    }
    return h;
  }

  // effectiveW: szerokość używana do frontów (niektóre typy mają zaślepienia)
  let effectiveW = Number(cab.width)||0;
  if(cab.subType === 'rogowa_slepa'){
    const blind = Number(cab.details?.blindPart) || 0;
    // fronty w rogowej ślepej liczone jak wcześniej (fronty bazują na szerokości, a zaślepki liczone w korpusie)
    if(blind > 0) effectiveW = Math.max(0, effectiveW - blind);
  }

  // Szuflady: licz fronty szuflad wg zadeklarowanej ilości
  if(cab.type === 'stojąca' && cab.subType === 'szuflady'){
    const drawers = Math.max(1, Number(cab.details?.drawers) || 1);
    const fh = getFrontHeightForCab();
    const hEach = drawers ? (fh / drawers) : 0;
    for(let i=0;i<drawers;i++) addFront(Number(cab.width)||0, hEach);
    cab.frontCount = drawers;
    return finalize();
  }

  // Stojąca z szufladą + drzwi
  if(cab.type === 'stojąca' && cab.subType === 'szuflada_drzwi'){
    const fh = getFrontHeightForCab();
    const drawerH = Number(cab.details?.drawerHeight) || Math.min(20, fh);
    const doorH = Math.max(0, fh - drawerH);
    addFront(Number(cab.width)||0, drawerH);
    if(doorH > 0){
      const fc = Math.max(1, Number(cab.frontCount||2));
      const wEach = fc ? (effectiveW / fc) : 0;
      for(let i=0;i<fc;i++) addFront(wEach, doorH);
      cab.frontCount = 1 + fc;
    } else {
      cab.frontCount = 1;
    }
    return finalize();
  }

  // Zmywarkowa: 1 front (wysokość wg ustawień)
  if(cab.type === 'stojąca' && cab.subType === 'zmywarkowa'){
    addFront(Number(cab.width)||0, getFrontHeightForCab());
    cab.frontCount = 1;
    return finalize();
  }

  // Lodówkowa: 2 fronty (góra + dół)
  if(cab.type === 'stojąca' && cab.subType === 'lodowkowa'){
    const topH = Number(cab.details?.topFrontHeight) || 60;
    const fh = getFrontHeightForCab();
    const bottomH = Math.max(0, fh - topH);
    addFront(Number(cab.width)||0, topH);
    if(bottomH > 0) addFront(Number(cab.width)||0, bottomH);
    cab.frontCount = bottomH > 0 ? 2 : 1;
    return finalize();
  }

  // Piekarnikowa: front nad piekarnikiem (reszta to piekarnik)
  if(cab.type === 'stojąca' && cab.subType === 'piekarnikowa'){
    const ovenH = Number(cab.details?.ovenHeight) || 60;
    const hRest = Math.max(0, getFrontHeightForCab() - ovenH);
    if(hRest > 0) addFront(Number(cab.width)||0, hRest);
    cab.frontCount = hRest > 0 ? 1 : 0;
    return finalize();
  }

  // Uchylna (wisząca / moduł): 1 lub 2 fronty wg HF
  if((cab.type === 'wisząca' || cab.type === 'moduł') && cab.subType === 'uchylna'){
    const fc = Math.max(1, Number(cab.frontCount||1));
    const fh = getFrontHeightForCab();
    const wEach = fc ? (effectiveW / fc) : 0;
    for(let i=0;i<fc;i++) addFront(wEach, fh);
    cab.frontCount = fc;
    return finalize();
  }

  // Narożna L (wisząca / stojąca): 2 fronty wg GL/GP/ST/SP
  if((cab.type === 'wisząca' || cab.type === 'stojąca') && cab.subType === 'narozna_l'){
    const d = cab.details || {};
    const GL = Number(d.gl) || 0;
    const GP = Number(d.gp) || 0;
    const ST = Number(d.st) || 0;
    const SP = Number(d.sp) || 0;
    const t = 1.8; // cm (płyta 18mm)
    const FL = Math.abs(GL - GP);
    const FP = Math.abs(ST - SP - t);
    const fh = getFrontHeightForCab();
    addFront(FL, fh);
    addFront(FP, fh);
    cab.frontCount = 2;
    return finalize();
  }

  // Reszta: 1 lub 2 drzwiowe
  const fcDoors = Math.max(1, Number(cab.frontCount||2));
  const fh = getFrontHeightForCab();
  const wEach = fcDoors ? Math.round((effectiveW / fcDoors) * 10) / 10 : 0;
  for(let i=0;i<fcDoors;i++) addFront(wEach, fh);
  cab.frontCount = fcDoors;

  return finalize();
}


/* ===== Okucia: zawiasy BLUM (wg zaleceń z katalogu/quick reference) =====
   Uwaga: BLUM zaleca dobór głównie wg wagi frontu; szerokość ma wpływ (dla >600 mm często potrzebny dodatkowy zawias).
   Ponieważ w projekcie nie mamy wagi z konfiguratora BLUM, szacujemy wagę frontu z wymiarów oraz grubości płyty 18 mm.
*/
const FC_HANDLE_WEIGHT_KG = 0.2; // orientacyjna masa uchwytu/gałki (na 1 front)

// Czy w danej szafce jest faktycznie uchwyt (dla obliczeń okuć BLUM)?
// TIP-ON oraz podchwyt traktujemy jako "bez uchwytu".
function cabinetHasHandle(cab){
  const os = String(cab?.openingSystem || '').toLowerCase();
  if(!os) return true; // domyślnie: jest uchwyt
  if(os.includes('tip-on')) return false;
  if(os.includes('podchwyt')) return false;
  return true;
}


// Wagi frontów liczone po m² (źródła: SEVROLL – tabela "Wagi wypełnień")
const FC_FRONT_WEIGHT_KG_M2 = {
  laminat: 13.0,   // płyta wiórowa 18 mm ≈ 13 kg/m²
  akryl:   14.44,  // MDF 18 mm ≈ 14,44 kg/m² (typowy rdzeń frontu akrylowego)
  lakier:  14.44   // MDF 18 mm ≈ 14,44 kg/m² (typowy rdzeń frontu lakierowanego)
};

function getFrontWeightKgM2(frontMaterial){
  const m = String(frontMaterial || 'laminat').toLowerCase();
  return (m in FC_FRONT_WEIGHT_KG_M2) ? FC_FRONT_WEIGHT_KG_M2[m] : FC_FRONT_WEIGHT_KG_M2.laminat;
}

function estimateFrontWeightKg(wCm, hCm, frontMaterial, hasHandle){
  const wM = Math.max(0, Number(wCm) || 0) / 100;
  const hM = Math.max(0, Number(hCm) || 0) / 100;
  const area = wM * hM;
  const handleKg = hasHandle ? FC_HANDLE_WEIGHT_KG : 0;
  return area * getFrontWeightKgM2(frontMaterial) + handleKg;
}

function blumHingesPerDoor(wCm, hCm, frontMaterial, hasHandle){
  const weightKg = estimateFrontWeightKg(wCm, hCm, frontMaterial, hasHandle);
  const weightLb = weightKg * 2.20462;
  const heightIn = (Math.max(0, Number(hCm) || 0)) / 2.54;
  const widthMm = (Math.max(0, Number(wCm) || 0)) * 10;

  // Bazowo wg wagi (quick reference: <15 lb, 15–30, 30–45, 45–60 => 2–5 zawiasów)
  let hinges = 2;
  if(weightLb <= 15) hinges = 2;
  else if(weightLb <= 30) hinges = 3;
  else if(weightLb <= 45) hinges = 4;
  else if(weightLb <= 60) hinges = 5;
  else hinges = 5 + Math.ceil((weightLb - 60) / 15);

  // Korekta wg wysokości (konserwatywnie, w duchu BLUM: wyższe fronty często potrzebują dodatkowego zawiasu)
  if(hinges <= 2 && heightIn > 40) hinges = 3;
  if(hinges <= 3 && heightIn > 60) hinges = 4;
  if(hinges <= 4 && heightIn > 80) hinges = 5;
  if(hinges <= 5 && heightIn > 100) hinges = 6;

  // Korekta wg szerokości (BLUM: wartości bazowe dla szer. do 600 mm; do ~650 mm zwykle +1 zawias)
  if(widthMm > 600){
    hinges += Math.ceil((widthMm - 600) / 50);
  }

  return Math.max(0, Math.round(hinges));
}


function getDoorFrontPanelsForHinges(room, cab){
  const out = [];
  if(!cab) return out;
  const type = String(cab.type || '');
  const sub = String(cab.subType || '');

  // brak zawiasów dla klap (AVENTOS) i frontów urządzeń
  if(sub === 'uchylne') return out;
  if(type !== 'stojąca' && type !== 'wisząca' && type !== 'moduł') return out;
  if(sub === 'szuflady' || sub === 'zmywarkowa' || sub === 'lodowkowa') return out;
  const hasHandle = cabinetHasHandle(cab);


  const w = Number(cab.width) || 0;
  const d = Number(cab.depth) || 0;

  // szerokość efektywna (np. rogowa ślepa)
  let effectiveW = w;
  if(sub === 'rogowa_slepa'){
    const blind = Number(cab.details?.blindPart) || 0;
    if(blind > 0) effectiveW = Math.max(0, effectiveW - blind);
  }

  // wysokość frontu dla stojących = korpus - nóżki
  function frontHeight(){
    let hh = Number(cab.height) || 0;
    if(type === 'stojąca'){
      const s = (projectData[room] && projectData[room].settings) ? projectData[room].settings : {};
      const leg = Number(s.legHeight) || 0;
      if(leg > 0) hh = Math.max(0, hh - leg);
    }
    return hh;
  }

  // stojąca z szufladą + drzwi
  if(type === 'stojąca' && sub === 'szuflada_drzwi'){
    const fh = frontHeight();
    const drawerH = Number(cab.details?.drawerHeight) || Math.min(20, fh);
    const doorH = Math.max(0, fh - drawerH);
    if(doorH <= 0) return out;
    const fc = Math.max(1, Number(cab.details?.doorCount || cab.frontCount || 2));
    const wEach = fc ? (effectiveW / fc) : 0;
    for(let i=0;i<fc;i++) out.push({ w: wEach, h: doorH , material: (cab.frontMaterial || 'laminat') , hasHandle: hasHandle });
    return out;
  }

  // piekarnikowa: tylko front nad piekarnikiem
  if(type === 'stojąca' && sub === 'piekarnikowa'){
    const ovenH = Number(cab.details?.ovenHeight) || 60;
    const doorH = Math.max(0, frontHeight() - ovenH);
    if(doorH <= 0) return out;
    const fc = Math.max(1, Number(cab.details?.doorCount || cab.frontCount || 1));
    const wEach = fc ? (effectiveW / fc) : 0;
    for(let i=0;i<fc;i++) out.push({ w: wEach, h: doorH , material: (cab.frontMaterial || 'laminat') , hasHandle: hasHandle });
    return out;
  }

  // standard: drzwi wg frontCount
  const fc = Math.max(0, Number(cab.frontCount || 0));
  if(fc <= 0) return out;

  const wEach = effectiveW / fc;
  const hEach = (type === 'stojąca') ? frontHeight() : (Number(cab.height) || 0);
  for(let i=0;i<fc;i++) out.push({ w: wEach, h: hEach , material: (cab.frontMaterial || 'laminat') , hasHandle: hasHandle });
  return out;
}

function getHingeCountForCabinet(room, cab){
  const doors = getDoorFrontPanelsForHinges(room, cab);
  if(!doors.length) return 0;
  let total = 0;
  doors.forEach(d => { total += blumHingesPerDoor(d.w, d.h, d.material, d.hasHandle); });
  return Math.max(0, Math.round(total));
}

/* ===== Okucia: podnośniki BLUM AVENTOS (klapy uchylne) =====
   BLUM: współczynnik mocy (LF / power factor) = wysokość korpusu (mm) × waga frontu z uchwytem (kg).
   Źródła: dokumenty BLUM (AVENTOS) / publikacje techniczne.
   Uwaga: w wielu opracowaniach przyjmuje się podwójną masę uchwytu dla klap (bezpieczniej).
*/

const FC_BLUM_FLAP_KIND_LABEL = {
  'HKI':'HKI',
  'HF_top':'HF top (składany)',
  'HS_top':'HS top (uchylno‑nachodzący)',
  'HL_top':'HL top (ponad korpus)',
  'HK_top':'HK top',
  'HK-S':'HK‑S',
  'HK-XS':'HK‑XS'
};

function estimateFlapWeightKg(cab, room){
  if(!cab) return 0;
  // wysokość frontu dla stojących odejmujemy nogi; dla wiszących/modułów bierzemy pełną wysokość
  let hFront = Number(cab.height) || 0;
  if(cab.type === 'stojąca'){
    const s = (projectData[room] && projectData[room].settings) ? projectData[room].settings : {};
    const leg = Number(s.legHeight) || 0;
    if(leg > 0) hFront = Math.max(0, hFront - leg);
  }

  // szerokość efektywna (rogowa ślepa: odjęcie blindPart)
  let wFront = Number(cab.width) || 0;
  if(String(cab.subType||'') === 'rogowa_slepa'){
    const blind = Number(cab.details?.blindPart) || 0;
    if(blind > 0) wFront = Math.max(0, wFront - blind);
  }

  const mat = cab.frontMaterial || 'laminat';
  const wM = Math.max(0, wFront) / 100;
  const hM = Math.max(0, hFront) / 100;
  const area = wM * hM;

  // Uchwyt: BLUM liczy różnie w zależności od systemu:
  // HF/HS/HL: + masa uchwytu (1×)
  // HK/HK-S/HK-XS/HKi: + podwójna masa uchwytu (2×)
  // Tu dobieramy mnożnik na podstawie wybranego rodzaju podnośnika.
  const kind = String((cab.details || {}).flapKind || 'HK-XS');
  const singleHandleKinds = new Set(['HF_top','HS_top','HL_top']);
  const handleMul = singleHandleKinds.has(kind) ? 1 : 2;
  return area * getFrontWeightKgM2(mat) + (cabinetHasHandle(cab) ? (FC_HANDLE_WEIGHT_KG * handleMul) : 0);
}

function blumAventosPowerFactor(cab, room){
  const khMm = Math.max(0, Number(cab.height) || 0) * 10; // cm -> mm
  const fgKg = estimateFlapWeightKg(cab, room);
  return Math.round(khMm * fgKg);
}

function getBlumAventosInfo(cab, room){
  const d = (cab && cab.details) ? cab.details : {};
  const vendor = String(d.flapVendor || 'blum');
  if(vendor !== 'blum') return null;

  const kind = String(d.flapKind || 'HK-XS'); // default to HK-XS for "uchylne"
  const label = FC_BLUM_FLAP_KIND_LABEL[kind] || kind;

  const khMm = Math.max(0, Number(cab.height) || 0) * 10; // cm -> mm
  const pf = blumAventosPowerFactor(cab, room); // LF
  const widthMm = Math.round((Number(cab.width) || 0) * 10);
  const depthMm = Math.round((Number(cab.depth) || 0) * 10);

  // Uwaga o jednostkach:
  // W kodzie liczymy LF = KH(mm) × waga frontu(kg) (z uchwytem).
  // Część materiałów BLUM podaje PF w inch×lb. Wtedy przeliczamy na mm×kg:
  const INLB_TO_MMKg = 25.4 * 0.45359237; // ≈ 11.521

  // Zakresy (HK-XS) – PF/LF w mm×kg
  const HKXS_RANGES = [
    { model:'20K1101', min:200, max:1000, strength:'słaby' },
    { model:'20K1301', min:500, max:1500, strength:'średni' },
    { model:'20K1501', min:800, max:1800, strength:'mocny' }
  ];

  // Zakresy (HK top) – źródła BLUM zwykle w inch×lb -> przeliczamy
  const HKTOP_RANGES = [
    { model:'22K2300', min:Math.round(36*INLB_TO_MMKg),  max:Math.round(139*INLB_TO_MMKg), strength:'słaby' },
    { model:'22K2500', min:Math.round(80*INLB_TO_MMKg),  max:Math.round(240*INLB_TO_MMKg), strength:'średni' },
    { model:'22K2700', min:Math.round(150*INLB_TO_MMKg), max:Math.round(450*INLB_TO_MMKg), strength:'mocny' },
    { model:'22K2900', min:Math.round(270*INLB_TO_MMKg), max:Math.round(781*INLB_TO_MMKg), strength:'bardzo mocny' }
  ];

  // Zakresy (HK‑S) – PF/LF w mm×kg
  const HKS_RANGES = [
    { model:'20K2A00', min:220, max:500, strength:'słaby' },
    { model:'20K2C00', min:400, max:1000, strength:'średni' },
    { model:'20K2E00', min:960, max:2215, strength:'mocny' }
  ];

  // Zakresy (HF top) – PF/LF w mm×kg (podawane dla 2 szt. w zestawie)
  const HFTOP_RANGES = [
    { model:'22F2500', min:2700, max:13500, strength:'słaby/średni' },
    { model:'22F2800', min:10000, max:19300, strength:'mocny' }
  ];

  // Zakresy (HKi) – PF w inch×lb -> przeliczamy
  const HKI_RANGES = [
    { model:'24K2300', min:Math.round(37*INLB_TO_MMKg),  max:Math.round(142*INLB_TO_MMKg), strength:'słaby' },
    { model:'24K2500', min:Math.round(82*INLB_TO_MMKg),  max:Math.round(246*INLB_TO_MMKg), strength:'średni' },
    { model:'24K2700', min:Math.round(152*INLB_TO_MMKg), max:Math.round(458*INLB_TO_MMKg), strength:'mocny' },
    { model:'24K2800', min:Math.round(229*INLB_TO_MMKg), max:Math.round(686*INLB_TO_MMKg), strength:'bardzo mocny' }
  ];

  // HS top – dobór po tabeli „KH / waga frontu” (kg). Dane z opisów katalogowych.
  // Sprawdzamy 3 „siłowniki”: 22S2200, 22S2500, 22S2800.
  const HSTOP_TABLE = [
    { model:'22S2200', khMin:350, khMax:540, wMin0:2.0,   wMin1:3.0,  wMax0:10.25, wMax1:12.5, strength:'słaby' },
    { model:'22S2500', khMin:480, khMax:660, wMin0:2.75,  wMin1:3.0,  wMax0:12.75, wMax1:15.25, strength:'średni' },
    { model:'22S2800', khMin:650, khMax:800, wMin0:3.5,   wMin1:4.0,  wMax0:16.5,  wMax1:18.5,  strength:'mocny' }
  ];

  // HL top – dobór po tabeli „KH / waga frontu” (kg) (przedziały stałe).
  const HLTOP_TABLE = [
    { model:'22L2200', khMin:300, khMax:340, wMin:0.8, wMax:5.6,  strength:'słaby' },
    { model:'22L2500', khMin:340, khMax:390, wMin:1.1, wMax:7.5,  strength:'średni' },
    { model:'22L2800', khMin:390, khMax:580, wMin:1.3, wMax:10.3, strength:'mocny' }
  ];

  // Limity wysokości frontu (KH) dla systemów AVENTOS (wg danych katalogowych/strony BLUM)
  const MAX_FRONT_HEIGHT_BY_KIND_MM = {
    'HK-XS': 0,
    'HK_top': 600,
    'HK-S': 600,
    'HKI': 610,
    'HL_top': 580,
    'HS_top': 800,
    'HF_top': 1200
  };

  const MIN_FRONT_HEIGHT_BY_KIND_MM = {
    // źródła (BLUM):
    // HK-XS: 240–600 mm
    // HK top: 205–600 mm
    // HK-S: 180–600 mm
    // HKi: 162–610 mm
    // HL top: 300–580 mm
    // HS top: 350–800 mm
    // HF top: 480–1200 mm
    'HK-XS': 240,
    'HK_top': 205,
    'HK-S': 180,
    'HKI': 162,
    'HL_top': 300,
    'HS_top': 350,
    'HF_top': 480
  };

  // Ograniczenia szerokości frontu/korpusu dla systemów AVENTOS (typowe wartości katalogowe BLUM)
  // Uwaga: tu walidujemy szerokość korpusu (LW) w mm.
  const MAX_FRONT_WIDTH_BY_KIND_MM = {
    'HK-XS': 0,
    'HK_top': 1800,
    'HK-S': 1800,
    'HKI': 1800,
    'HL_top': 1800,
    'HS_top': 1800,
    'HF_top': 1800
  };

  const MIN_FRONT_WIDTH_BY_KIND_MM = {
    // zwykle brak twardego minimum; zostawiamy 0
    'HK-XS': 0,
    'HK_top': 0,
    'HK-S': 0,
    'HKI': 0,
    'HL_top': 0,
    'HS_top': 0,
    'HF_top': 0
  };

// Minimalna głębokość wewnętrzna korpusu (LT) dla AVENTOS (wg katalogu/BLUM)
// Walidujemy tutaj głębokość korpusu (cm -> mm). Jeśli projektujesz z plecami we wpuszczanym rowku,
// a zależy Ci na ultra-precyzji, dodaj sobie korektę o grubość pleców / cofnięcie – tu trzymamy prostą regułę "czy się zmieści".
const MIN_INTERNAL_DEPTH_BY_KIND_MM = {
  // źródła BLUM (min. głębokość wewnętrzna LT):
  // HK-XS: ≥100 mm (dla specjalnej pozycji wiercenia; standardowo często 125 mm)
  // HK-S: 163 mm
  // HK top: 187 mm (bez SERVO-DRIVE)
  // HL top / HS top / HF top: 264 mm
  // HKi: 270 mm
  'HK-XS': 100,
  'HK-S': 163,
  'HK_top': 187,
  'HL_top': 264,
  'HS_top': 264,
  'HF_top': 264,
  'HKI': 270
};

// Zalecana (bezpieczna warsztatowo) minimalna głębokość wewnętrzna korpusu (LT).
// Dla HK‑XS katalog dopuszcza LT≥100 mm przy specyficznej pozycji montażu, ale w praktyce łatwiej i bezpieczniej przyjąć ≥125 mm.
const REC_INTERNAL_DEPTH_BY_KIND_MM = {
  'HK-XS': 125
};


function suggestKindsForDepth(lt){
  const out = [];
  Object.keys(MIN_INTERNAL_DEPTH_BY_KIND_MM).forEach(k=>{
    const minD = MIN_INTERNAL_DEPTH_BY_KIND_MM[k] || 0;
    if(!lt) return;
    if(minD && lt < minD) return;
    const lbl = FC_BLUM_FLAP_KIND_LABEL[k] || k;
    out.push(lbl);
  });
  return out;
}


  function suggestKindsForWidth(lw){
    const out = [];
    Object.keys(MAX_FRONT_WIDTH_BY_KIND_MM).forEach(k=>{
      const maxW = MAX_FRONT_WIDTH_BY_KIND_MM[k] || 0;
      const minW = MIN_FRONT_WIDTH_BY_KIND_MM[k] || 0;
      if(!lw) return;
      if(minW && lw < minW) return;
      if(maxW && lw > maxW) return;
      const lbl = FC_BLUM_FLAP_KIND_LABEL[k] || k;
      out.push(lbl);
    });
    return out;
  }




  function suggestKindsForHeight(kh){
    const out = [];
    Object.keys(MAX_FRONT_HEIGHT_BY_KIND_MM).forEach(k=>{
      const maxH = MAX_FRONT_HEIGHT_BY_KIND_MM[k];
      const minH = MIN_FRONT_HEIGHT_BY_KIND_MM[k] || 0;
      if(!kh) return;
      if(minH && kh < minH) return;
      if(maxH && kh > maxH) return;
      const lbl = FC_BLUM_FLAP_KIND_LABEL[k] || k;
      out.push(lbl);
    });
    return out;
  }

  function listAllKindsHeightInfo(kh){
    const order = ['HK-XS','HK_top','HK-S','HKI','HL_top','HS_top','HF_top'];
    return order.map(k=>{
      const lbl = FC_BLUM_FLAP_KIND_LABEL[k] || k;
      const minH = MIN_FRONT_HEIGHT_BY_KIND_MM[k] || 0;
      const maxH = MAX_FRONT_HEIGHT_BY_KIND_MM[k] || 0;
      const minTxt = minH ? `${minH}` : '—';
      const maxTxt = maxH ? `${maxH}` : '—';
      const ok = kh ? ((minH ? kh >= minH : true) && (maxH ? kh <= maxH : true)) : false;
      return `${lbl} (${minTxt}–${maxTxt} mm)${kh ? (ok ? ' – pasuje' : ' – nie pasuje') : ''}`;
    });
  }




  let model = '';
  let rangeMin = 0;
  let rangeMax = 0;
  let rangeStr = '';
  let strength = '';
  let status = 'ok'; // ok | needs_more_lifts | out_pf | out_height | out_width | out_depth
  let message = '';
  let messageTone = ''; // red | orange
  let neededLiftQty = 0;

  // Dodatkowe notatki (np. zalecenia warsztatowe)
  let depthAdvisory = '';
  let depthAdvisoryTone = '';


  // Ilość mechanizmów: standardowo 2 szt. (lewy+prawy).
  // Dopuszczamy 3/4 szt. (np. szerokie fronty) — BLUM często podaje +50% dla 3. mechanizmu.
  let liftQty = 2;
  if(kind === 'HK-XS'){
    // HK‑XS może być montowany jednostronnie lub obustronnie – dobór ilości robimy niżej na podstawie LF.
    liftQty = 1;
  }


  // Ilość zawiasów dla HK-XS (wg typowych tabel: szerokość i/lub LF)
  let hkxsHinges = 0;
  if(kind === 'HK-XS'){
    hkxsHinges = 2;
    if(widthMm >= 900 || pf >= 1800) hkxsHinges = 3;
    if(widthMm >= 1200 || pf >= 2700) hkxsHinges = 4;
  }

  // Informacyjna uwaga: katalog BLUM podaje progi doboru 3/4 zawiasów. Przy bardzo szerokich lub ciężkich frontach
  // można rozważyć zastosowanie większej liczby zawiasów (nie zmienia to doboru podnośników HK‑XS).
  if(kind === 'HK-XS' && hkxsHinges === 4 && (widthMm > 1200 || pf > 2700)){
    if(!message || messageTone !== 'red'){
      messageTone = messageTone || 'orange';
      message = message || `HK‑XS: zalecane min. 4 zawiasy (KB≥1200 mm lub LF≥2700). Przy bardzo szerokich frontach możesz dać więcej zawiasów dla sztywności.`;
      status = status || 'ok';
    }
  }

  // 1) Ostrzeżenie wysokości (front za wysoki / za niski)
  const maxH = MAX_FRONT_HEIGHT_BY_KIND_MM[kind] || 0;
  const minH = MIN_FRONT_HEIGHT_BY_KIND_MM[kind] || 0;

  if(maxH && khMm > maxH){
    status = 'out_height';
    messageTone = 'red';
    message = `Za wysoki front: wysokość korpusu ${khMm} mm (dla ${label} max ${maxH} mm).`;
    const sug = suggestKindsForHeight(khMm).filter(x=>x!==label);
    if(sug.length) message += ` Pasujące rodzaje dla tej wysokości: ${sug.join(', ')}.`;  }else if(minH && khMm > 0 && khMm < minH){
    status = 'out_height';
    messageTone = 'red';
    message = `Za niski front: wysokość korpusu ${khMm} mm (dla ${label} min ${minH} mm).`;
    const sug = suggestKindsForHeight(khMm).filter(x=>x!==label);
    if(sug.length) message += ` Pasujące rodzaje dla tej wysokości: ${sug.join(', ')}.`;  }



  // 1b) Ostrzeżenie szerokości (front za szeroki)
  const maxW = MAX_FRONT_WIDTH_BY_KIND_MM[kind] || 0;
  const minW = MIN_FRONT_WIDTH_BY_KIND_MM[kind] || 0;

  if(maxW && widthMm > maxW){
    status = 'out_width';
    messageTone = 'red';
    message = `Za szeroki front: szerokość korpusu ${widthMm} mm (dla ${label} max ${maxW} mm).`;
    const sug = suggestKindsForWidth(widthMm).filter(x=>x!==label);
    if(sug.length) message += ` Pasujące rodzaje dla tej szerokości: ${sug.join(', ')}.`;
  }else if(minW && widthMm > 0 && widthMm < minW){
    status = 'out_width';
    messageTone = 'red';
    message = `Za wąski front: szerokość korpusu ${widthMm} mm (dla ${label} min ${minW} mm).`;
    const sug = suggestKindsForWidth(widthMm).filter(x=>x!==label);
    if(sug.length) message += ` Pasujące rodzaje dla tej szerokości: ${sug.join(', ')}.`;
  }

  

// 1c) Ostrzeżenie głębokości (korpus za płytki)
  const minD = MIN_INTERNAL_DEPTH_BY_KIND_MM[kind] || 0;
  const recD = REC_INTERNAL_DEPTH_BY_KIND_MM[kind] || 0;

  if(status === 'ok' && minD && depthMm > 0 && depthMm < minD){
    status = 'out_depth';
    messageTone = 'red';
    message = `Za płytki korpus: głębokość ${depthMm} mm (dla ${label} min ${minD} mm).`;
    const sug = suggestKindsForDepth(depthMm).filter(x=>x!==label);
    if(sug.length) message += ` Pasujące rodzaje dla tej głębokości: ${sug.join(', ')}.`;
  }

  // Zalecenie warsztatowe (nie blokuje): HK‑XS katalogowo bywa możliwy od LT≥100 mm, ale bezpieczniej przyjąć ≥125 mm
  if(status === 'ok' && kind === 'HK-XS' && recD && depthMm > 0 && depthMm < recD){
    depthAdvisoryTone = 'orange';
    depthAdvisory = `HK‑XS: katalogowo można zejść do LT≥${minD} mm (specyficzna pozycja montażu), ale warsztatowo bezpieczniej przyjąć ≥${recD} mm (mniej kolizji, łatwiejszy montaż).`;
  }

// Jeśli wysokość, szerokość lub głębokość jest poza zakresem — nie pokazujemy komunikatów o mocy (LF) i blokujemy zapis
  if(status === 'out_height' || status === 'out_width' || status === 'out_depth'){
    return {
      kind, label,
      status,
      message,
      messageTone: (messageTone || 'red'),
      powerFactor: pf,
      liftQty,
      hkxsHinges
    };
  }

  // 2) Dobór modelu i kontrola współczynnika mocy / wagi
  const fgKg = estimateFlapWeightKg(cab, room);

  function pickByRange(ranges){
    return ranges.find(r => pf >= r.min && pf <= r.max) || null;
  }

  function allowMoreLiftsIfPossible(maxFor2){
    if(pf <= maxFor2) return { ok:true, qty:2, tone:'' };
    if(pf <= Math.round(maxFor2 * 1.5)) return { ok:true, qty:3, tone:'orange' };
    if(pf <= Math.round(maxFor2 * 2.0)) return { ok:true, qty:4, tone:'orange' };
    return { ok:false, qty:0, tone:'red', need: Math.max(2, Math.ceil((pf / maxFor2) * 2)) };
  }

  if(kind === 'HK-XS'){
    // HK‑XS: siłownik jest symetryczny i może być stosowany z jednej lub z obu stron.
    // Przy obustronnym zastosowaniu współczynnik mocy LF (PF) się podwaja (wg katalogu BLUM 2024/2025).
    const maxPer = HKXS_RANGES[HKXS_RANGES.length - 1].max;
    const minPer = HKXS_RANGES[0].min;

    function pickForPer(pfPer){
      return HKXS_RANGES.find(r => pfPer >= r.min && pfPer <= r.max) || null;
    }

    // Preferuj minimalną liczbę mechanizmów, która mieści się w zakresie:
    // q=1 (jednostronnie), q=2 (obustronnie).
    let picked = null;
    let pickedQty = 0;

    if(pf < minPer){
      status = (status === 'out_height') ? status : 'out_pf';
      messageTone = (messageTone || 'red');
      message = message || `Poza zakresem współczynnika mocy: ${pf} (min ${minPer}). Front zbyt lekki dla HK‑XS.`;
      neededLiftQty = 0;
    } else {
      for(const q of [1, 2]){
        const pfPer = Math.ceil(pf / q);
        const p = pickForPer(pfPer);
        if(p){
          picked = p;
          pickedQty = q;
          break;
        }
      }

      if(!picked){
        // Poza zakresem nawet przy 2 mechanizmach (obustronnie)
        status = (status === 'out_height') ? status : 'out_pf';
        messageTone = 'red';
        neededLiftQty = 2;
        message = `Poza zakresem współczynnika mocy dla HK‑XS nawet przy montażu obustronnym (HK‑XS przewiduje maks. 2 mechanizmy): ${pf} (max ${maxPer} na mechanizm, razem max ${maxPer*2}). Rozważ zmianę na HK top / HK‑S (tam można dobrać większą liczbę podnośników).`;
      } else {
        liftQty = pickedQty;
        if(pickedQty === 2){
          // Informacyjnie (nie blokuje): montaż obustronny
          if(!message || messageTone !== 'red'){
            status = status || 'ok';
            messageTone = messageTone || 'green';
            message = message || `Dla tej klapy zalecany montaż obustronny (2 mechanizmy) – współczynnik mocy LF podwaja się.`;
          }
        }
      }
    }

    if(picked){
      model = picked.model;
      rangeMin = picked.min;
      rangeMax = picked.max;
      strength = picked.strength;
    }
  }
 else if(kind === 'HK_top'){
    const picked = pickByRange(HKTOP_RANGES);
    if(!picked){
      status = (status === 'out_height') ? status : 'out_pf';
      messageTone = (messageTone || 'red');
      const max2 = HKTOP_RANGES[HKTOP_RANGES.length - 1].max;
      const okMore = allowMoreLiftsIfPossible(max2);
      if(okMore.ok){
        status = (status === 'out_height') ? status : 'needs_more_lifts';
        messageTone = 'orange';
        liftQty = okMore.qty;
        model = HKTOP_RANGES[HKTOP_RANGES.length - 1].model;
        rangeMin = HKTOP_RANGES[HKTOP_RANGES.length - 1].min;
        rangeMax = max2;
        strength = HKTOP_RANGES[HKTOP_RANGES.length - 1].strength;
        message = `Wymagana większa liczba podnośników: przyjęto ${liftQty} szt. (na bazie najmocniejszego HK top).`;
      }else{
        neededLiftQty = okMore.need;
        message = `Poza zakresem współczynnika mocy: ${pf} (max ${max2} dla 2 szt.).`;
      }
    }else{
      model = picked.model;
      rangeMin = picked.min;
      rangeMax = picked.max;
      strength = picked.strength;
    }
  } else if(kind === 'HK-S'){
    const picked = pickByRange(HKS_RANGES);
    if(!picked){
      status = (status === 'out_height') ? status : 'out_pf';
      messageTone = (messageTone || 'red');
      const max2 = HKS_RANGES[HKS_RANGES.length - 1].max;
      const okMore = allowMoreLiftsIfPossible(max2);
      if(okMore.ok){
        status = (status === 'out_height') ? status : 'needs_more_lifts';
        messageTone = 'orange';
        liftQty = okMore.qty;
        model = HKS_RANGES[HKS_RANGES.length - 1].model;
        rangeMin = HKS_RANGES[HKS_RANGES.length - 1].min;
        rangeMax = max2;
        strength = HKS_RANGES[HKS_RANGES.length - 1].strength;
        message = `Wymagana większa liczba podnośników: przyjęto ${liftQty} szt. (na bazie najmocniejszego HK‑S).`;
      }else{
        neededLiftQty = okMore.need;
        message = `Poza zakresem współczynnika mocy: ${pf} (max ${max2} dla 2 szt.).`;
      }
    }else{
      model = picked.model;
      rangeMin = picked.min;
      rangeMax = picked.max;
      strength = picked.strength;
    }
  } else if(kind === 'HF_top'){
    const picked = pickByRange(HFTOP_RANGES);
    if(!picked){
      status = (status === 'out_height') ? status : 'out_pf';
      messageTone = (messageTone || 'red');
      const max2 = HFTOP_RANGES[HFTOP_RANGES.length - 1].max;
      const okMore = allowMoreLiftsIfPossible(max2);
      if(okMore.ok){
        status = (status === 'out_height') ? status : 'needs_more_lifts';
        messageTone = 'orange';
        liftQty = okMore.qty;
        model = HFTOP_RANGES[HFTOP_RANGES.length - 1].model;
        rangeMin = HFTOP_RANGES[HFTOP_RANGES.length - 1].min;
        rangeMax = max2;
        strength = HFTOP_RANGES[HFTOP_RANGES.length - 1].strength;
        message = `Wymagana większa liczba podnośników: przyjęto ${liftQty} szt. (na bazie najmocniejszego HF top).`;
      }else{
        neededLiftQty = okMore.need;
        message = `Poza zakresem współczynnika mocy: ${pf} (max ${max2} dla 2 szt.).`;
      }
    }else{
      model = picked.model;
      rangeMin = picked.min;
      rangeMax = picked.max;
      strength = picked.strength;
    }
  } else if(kind === 'HKI'){
    const picked = pickByRange(HKI_RANGES);
    if(!picked){
      status = (status === 'out_height') ? status : 'out_pf';
      messageTone = (messageTone || 'red');
      const max2 = HKI_RANGES[HKI_RANGES.length - 1].max;
      const okMore = allowMoreLiftsIfPossible(max2);
      if(okMore.ok){
        status = (status === 'out_height') ? status : 'needs_more_lifts';
        messageTone = 'orange';
        liftQty = okMore.qty;
        model = HKI_RANGES[HKI_RANGES.length - 1].model;
        rangeMin = HKI_RANGES[HKI_RANGES.length - 1].min;
        rangeMax = max2;
        strength = HKI_RANGES[HKI_RANGES.length - 1].strength;
        message = `Wymagana większa liczba podnośników: przyjęto ${liftQty} szt. (na bazie najmocniejszego HKi).`;
      }else{
        neededLiftQty = okMore.need;
        message = `Poza zakresem współczynnika mocy: ${pf} (max ${max2} dla 2 szt.).`;
      }
    }else{
      model = picked.model;
      rangeMin = picked.min;
      rangeMax = picked.max;
      strength = picked.strength;
    }
  } else if(kind === 'HS_top'){
    const row = HSTOP_TABLE.find(r => khMm >= r.khMin && khMm <= r.khMax) || null;
    if(!row){
      status = (status === 'out_height') ? status : 'out_pf';
      messageTone = (messageTone || 'red');
      message = message || `Poza zakresem wysokości dla HS top: KH=${khMm} mm.`;
    }else{
      const t = (khMm - row.khMin) / (row.khMax - row.khMin);
      const wMin = row.wMin0 + (row.wMin1 - row.wMin0) * t;
      const wMax = row.wMax0 + (row.wMax1 - row.wMax0) * t;
      if(fgKg < wMin || fgKg > wMax){
        status = (status === 'out_height') ? status : 'out_pf';
        messageTone = (messageTone || 'red');
        message = message || `Poza zakresem wagi frontu dla HS top (${row.model}) przy KH=${khMm} mm: waga ${fgKg.toFixed(2)} kg (dopuszczalne ok. ${wMin.toFixed(2)}–${wMax.toFixed(2)} kg).`;
      }else{
        model = row.model;
        strength = row.strength;
        rangeStr = `${wMin.toFixed(2)}–${wMax.toFixed(2)} kg (dla KH=${khMm} mm)`;
      }
    }
  } else if(kind === 'HL_top'){
    const row = HLTOP_TABLE.find(r => khMm >= r.khMin && khMm <= r.khMax) || null;
    if(!row){
      status = (status === 'out_height') ? status : 'out_pf';
      messageTone = (messageTone || 'red');
      message = message || `Poza zakresem wysokości dla HL top: KH=${khMm} mm.`;
    }else{
      if(fgKg < row.wMin || fgKg > row.wMax){
        status = (status === 'out_height') ? status : 'out_pf';
        messageTone = (messageTone || 'red');
        message = message || `Poza zakresem wagi frontu dla HL top (${row.model}) przy KH=${khMm} mm: waga ${fgKg.toFixed(2)} kg (dopuszczalne ${row.wMin}–${row.wMax} kg).`;
      }else{
        model = row.model;
        strength = row.strength;
        rangeStr = `${row.wMin}–${row.wMax} kg`;
      }
    }
  }

  let rangeStrFinal = '';
  if(rangeStr){
    rangeStrFinal = rangeStr;
  }else{
    rangeStrFinal = (rangeMin && rangeMax) ? `${rangeMin}–${rangeMax}` : '';
  }

    let finalMessage = message || '';
  let finalTone = messageTone || '';
  if(depthAdvisory){
    if(finalMessage){
      finalMessage = `${finalMessage} ${depthAdvisory}`;
      if(!finalTone) finalTone = depthAdvisoryTone || 'orange';
    }else{
      finalMessage = depthAdvisory;
      finalTone = depthAdvisoryTone || 'orange';
    }
  }

  return { kind, label, powerFactor: pf, model, rangeStr: rangeStrFinal, strength, liftQty, hkxsHinges, status, message: finalMessage, messageTone: finalTone, neededLiftQty };
}




function getCabinetCutList(cab, room){
  const t = FC_BOARD_THICKNESS_CM;
  const w = Number(cab.width) || 0;
  const h = Number(cab.height) || 0;
  const d = Number(cab.depth) || 0;
  const bodyMat = cab.bodyColor || 'laminat';
  const backMat = cab.backMaterial || 'HDF';

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




/* ===== Render UI: cabinets (NO inline editing) ===== */
/* ===== Price modal render ===== */

// Jump helpers: per-cabinet navigation between SZAFKI and MATERIAŁ
function _scrollToAndFlash(el){
  if(!el) return;
  try{ el.scrollIntoView({behavior:'smooth', block:'start'}); } catch(_){ el.scrollIntoView(true); }
  el.classList.remove('focus-flash'); // reset if repeated
  // force reflow
  void el.offsetWidth;
  el.classList.add('focus-flash');
  window.setTimeout(()=> el.classList.remove('focus-flash'), 1300);
}

function jumpToMaterialsForCabinet(cabId){
  if(!cabId) return;
  uiState.matExpandedId = String(cabId);
  uiState._focusCabAfterRender = { tab:'material', id: String(cabId) };
  FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
  setActiveTab('material');
  // after render
  window.setTimeout(() => {
    const el = document.getElementById(`mat-${cabId}`);
    _scrollToAndFlash(el);
  }, 80);
}

function jumpToCabinetFromMaterials(cabId){
  if(!cabId) return;
  // select + expand to show details
  uiState.selectedCabinetId = String(cabId);
  uiState.expanded = {};
  uiState.expanded[String(cabId)] = true;
  uiState._focusCabAfterRender = { tab:'wywiad', id: String(cabId) };
  FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
  setActiveTab('wywiad');
  window.setTimeout(() => {
    const el = document.getElementById(`cab-${cabId}`);
    _scrollToAndFlash(el);
  }, 80);
}

// Centralne przełączanie zakładek (używane też przez przyciski "skoku")
function setActiveTab(tabName){
  uiState.activeTab = tabName;
  FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
  document.querySelectorAll('.tab-btn').forEach(t=>t.style.background='var(--card)');
  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if(activeBtn) activeBtn.style.background = '#e6f7ff';
  renderCabinets();
  try{ window.scrollTo({top:0, behavior:'smooth'}); } catch(_){ window.scrollTo(0,0); }
}

/* ===== UI wiring & init ===== */
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

  FC.actions.register({
    'close-price': ({event}) => { closePriceModal(); return true; },
    'close-cabinet': ({event}) => { closeCabinetModal(); return true; },
    'cancel-cabinet': ({event}) => { closeCabinetModal(); return true; },
    'create-set': ({event}) => { createOrUpdateSetFromWizard(); return true; },

    'save-material': ({event}) => {
      const btn = document.getElementById('savePriceBtn');
      if(btn && typeof btn.onclick === 'function') { btn.onclick(); return true; }
      if(typeof saveMaterialFromForm === 'function') { saveMaterialFromForm(); return true; }
      return false;
    },
    'cancel-material-edit': ({event}) => {
      const btn = document.getElementById('cancelEditBtn');
      if(btn && typeof btn.onclick === 'function') { btn.onclick(); return true; }
      uiState.editingId = null; FC.storage.setJSON(STORAGE_KEYS.ui, uiState); try{ renderPriceModal(); }catch(_){}
      return true;
    },
    'save-service': ({event}) => {
      const btn = document.getElementById('saveServiceBtn');
      if(btn && typeof btn.onclick === 'function') { btn.onclick(); return true; }
      if(typeof saveServiceFromForm === 'function') { saveServiceFromForm(); return true; }
      return false;
    },
    'cancel-service-edit': ({event}) => {
      const btn = document.getElementById('cancelServiceEditBtn');
      if(btn && typeof btn.onclick === 'function') { btn.onclick(); return true; }
      uiState.editingId = null; FC.storage.setJSON(STORAGE_KEYS.ui, uiState); try{ renderPriceModal(); }catch(_){}
      return true;
    },

    'open-materials': ({event}) => {
      uiState.showPriceList='materials';
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      renderPriceModal();
      FC.modal.open('priceModal');
      return true;
    },
    'open-services': ({event}) => {
      uiState.showPriceList='services';
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      renderPriceModal();
      FC.modal.open('priceModal');
      return true;
    },

    'add-cabinet': ({event}) => {
      // Hard guard against duplicate pointerup->click replays (mobile) and alert-induced delays
      if(FC.actions.isLocked('add-cabinet')) return true;
      FC.actions.lock('add-cabinet');
      if(!uiState.roomType){
        alert('Wybierz pomieszczenie najpierw');
        return true;
      }
      openCabinetModalForAdd();
      FC.modal.open('cabinetModal');
      return true;
    },

    'back-rooms': ({event}) => {
      uiState.roomType = null;
      uiState.selectedCabinetId = null;
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      document.getElementById('roomsView').style.display='block';
      document.getElementById('appView').style.display='none';
      document.getElementById('topTabs').style.display = 'none';
      return true;
    },

    'new-project': ({event}) => {
      if(!confirm('Utworzyć NOWY projekt? Wszystkie pomieszczenia zostaną wyczyszczone.')) return true;
      projectData = FC.utils.clone(DEFAULT_PROJECT);
      uiState.roomType = null;
      uiState.selectedCabinetId = null;
      uiState.expanded = {};
      projectData = FC.project.save(projectData);
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      document.getElementById('roomsView').style.display='block';
      document.getElementById('appView').style.display='none';
      document.getElementById('topTabs').style.display='none';
      renderCabinets();
      return true;
    },

    'open-room': ({event, element}) => {
      const room = element.getAttribute('data-room');
      uiState.roomType = room;
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      document.getElementById('roomsView').style.display='none';
      document.getElementById('appView').style.display='block';
      document.getElementById('topTabs').style.display = 'inline-block';
      uiState.activeTab = 'wywiad';
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      document.querySelectorAll('.tab-btn').forEach(tbtn => tbtn.style.background = (tbtn.getAttribute('data-tab') === uiState.activeTab) ? '#e6f7ff' : 'var(--card)');
      renderCabinets();
      return true;
    },

    'tab': ({event, element}) => {
      const tab = element.getAttribute('data-tab');
      setActiveTab(tab);
      return true;
    },
  });
}

function initApp(){
  // Fail fast if HTML is missing required elements
  validateRequiredDOM();

  // Register actions + modals and validate that DOM doesn't reference unknown actions
  registerCoreActions();
  FC.actions.validateDOMActions(document);

  return initUI();
}

function initUI(){
  // Delegated clicks (robust against DOM re-renders / new buttons)
  if(!window.__FC_DELEGATION__){
    window.__FC_DELEGATION__ = true;

    let __fcSuppressNextClick = false;

    const __fcHandle = (e) => {
      const t = e.target;
      if(!t || !t.closest) return false;

      const actEl = t.closest('[data-action]');
      if(!actEl) return false;

      const action = actEl.getAttribute('data-action');
      if(!action) return false;

      // Unknown actions are a hard error (prevents silent broken buttons)
      if(!FC.actions.has(action)){
        throw new Error(`Nieznana akcja data-action="${action}". Dodaj handler w Actions registry.`);
      }

      // Always stop default/propa for handled actions to prevent click-through
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      return !!FC.actions.dispatch(action, { event: e, element: actEl, target: t });
    };

    // Mobile-safe: handle pointerup, suppress exactly one subsequent click if pointerup handled something
    document.addEventListener('pointerup', (e) => {
      const handled = __fcHandle(e);
      if(handled) __fcSuppressNextClick = true;
    }, { capture:true, passive:false });

    document.addEventListener('click', (e) => {
      if(__fcSuppressNextClick){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        __fcSuppressNextClick = false;
        return;
      }
      __fcHandle(e);
    }, { capture:true, passive:false });
  }

  // Form inputs (change/input events are fine as direct listeners)
  const roomHeightEl = document.getElementById('roomHeight');
  if(roomHeightEl) roomHeightEl.addEventListener('change', e => handleSettingChange('roomHeight', e.target.value));
  const bottomHeightEl = document.getElementById('bottomHeight');
  if(bottomHeightEl) bottomHeightEl.addEventListener('change', e => handleSettingChange('bottomHeight', e.target.value));
  const legHeightEl = document.getElementById('legHeight');
  if(legHeightEl) legHeightEl.addEventListener('change', e => handleSettingChange('legHeight', e.target.value));
  const counterThicknessEl = document.getElementById('counterThickness');
  if(counterThicknessEl) counterThicknessEl.addEventListener('change', e => handleSettingChange('counterThickness', e.target.value));
  const gapHeightEl = document.getElementById('gapHeight');
  if(gapHeightEl) gapHeightEl.addEventListener('change', e => handleSettingChange('gapHeight', e.target.value));
  const ceilingBlendeEl = document.getElementById('ceilingBlende');
  if(ceilingBlendeEl) ceilingBlendeEl.addEventListener('change', e => handleSettingChange('ceilingBlende', e.target.value));

  const priceSearchEl = document.getElementById('priceSearch');
  if(priceSearchEl) priceSearchEl.addEventListener('input', renderPriceModal);

  if(uiState.roomType){
    document.getElementById('roomsView').style.display='none';
    document.getElementById('appView').style.display='block';
    document.getElementById('topTabs').style.display = 'inline-block';
  } else {
    document.getElementById('roomsView').style.display='block';
    document.getElementById('appView').style.display='none';
    document.getElementById('topTabs').style.display = 'none';
  }

  document.querySelectorAll('.tab-btn').forEach(t=> t.style.background = (t.getAttribute('data-tab') === uiState.activeTab) ? '#e6f7ff' : 'var(--card)');

  renderTopHeight();
  renderCabinets();
}



/* ===== Set wizard minimal (reuse existing from previous version) ===== */


/* =========================================================
   RYSUNEK: Layout + interaktywne dodawanie wykończeń
   Model danych (w projekcie):
   projectData[room].layout = { segments:[ {id,name,anchor,offsets, rows:{base:[],wall:[],tall:[]} } ] }
   - element w rows: { kind:'cabinet', id:'<cabId>' } lub { kind:'gap', id:'gap_x', width:<cm>, label:'PRZERWA' }
   projectData[room].finishes = [ {id,type,segmentId,row, ... } ]
========================================================= */
function ensureLayout(room){
  const pd = projectData[room];
  if(!pd.layout || !Array.isArray(pd.layout.segments) || pd.layout.segments.length === 0){
    const segId = 'segA';
    const seg = {
      id: segId,
      name: 'Segment A',
      anchor: 'left',
      offsets: { base: 0, module: 0, wall: 0 },
      rows: { base: [], module: [], wall: [] }
    };
    const cabs = pd.cabinets || [];
    cabs.forEach(c=>{
      const row = (c.type === 'wisząca') ? 'wall' : (c.type === 'moduł' ? 'module' : 'base');
      seg.rows[row].push({ kind:'cabinet', id:c.id });
    });
    pd.layout = { segments:[seg], activeSegmentId: segId, zOrderRows: ['base','module','wall'] };
  } else {
    // migracja starych układów: zapewnij base/module/wall
    if(!pd.layout.zOrderRows || !Array.isArray(pd.layout.zOrderRows)) pd.layout.zOrderRows = ['base','module','wall'];
    pd.layout.segments.forEach(seg=>{
      if(seg.rows && seg.rows.tall){ delete seg.rows.tall; }
      if(!seg.rows) seg.rows = { base:[], module:[], wall:[] };
      if(!seg.rows.base) seg.rows.base = [];
      if(!seg.rows.module) seg.rows.module = [];
      if(!seg.rows.wall) seg.rows.wall = [];
      if(seg.offsets && seg.offsets.tall !== undefined){ delete seg.offsets.tall; }
      if(!seg.offsets) seg.offsets = { base:0, module:0, wall:0 };
      if(seg.offsets.base === undefined) seg.offsets.base = 0;
      if(seg.offsets.module === undefined) seg.offsets.module = 0;
      if(seg.offsets.wall === undefined) seg.offsets.wall = 0;
    });
  }
  if(!Array.isArray(pd.finishes)) pd.finishes = [];
  const act = pd.layout.activeSegmentId;
  if(act && !pd.layout.segments.find(s=>s.id===act)){
    pd.layout.activeSegmentId = pd.layout.segments[0].id;
  }
}

function getActiveSegment(room){
  ensureLayout(room);
  const pd = projectData[room];
  const segId = pd.layout.activeSegmentId || (pd.layout.segments[0] && pd.layout.segments[0].id);
  return pd.layout.segments.find(s=>s.id===segId) || pd.layout.segments[0];
}

function saveProject(){
  projectData = FC.project.save(projectData);
  FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
}

function humanRow(row){
  if(row==='base') return 'DOLNE';
  if(row==='module') return 'MODUŁY';
  if(row==='wall') return 'GÓRNE';
  return row;
}

function getCabById(room, id){
  return (projectData[room].cabinets || []).find(c=>c.id===id);
}

function layoutRowTotalWidthCm(room, seg, row){
  const arr = (seg.rows[row] || []);
  let sum = 0;
  arr.forEach(el=>{
    if(el.kind==='gap') sum += Number(el.width)||0;
    else if(el.kind==='cabinet'){
      const c = getCabById(room, el.id);
      sum += (c ? Number(c.width)||0 : 0);
    }
  });
  return sum;
}

function computeXPositionsCm(room, seg, row){
  const arr = (seg.rows[row] || []);
  let x = Number(seg.offsets?.[row] || 0);
  const out = [];
  for(let i=0;i<arr.length;i++){
    const el = arr[i];
    const w = (el.kind==='gap') ? (Number(el.width)||0) : (getCabById(room, el.id)?.width || 0);
    out.push({ i, el, x0:x, x1:x + (Number(w)||0), w:Number(w)||0 });
    x += (Number(w)||0);
  }
  return out;
}

function cmToPx(cm, scale){ return cm*scale; }

function defaultFinishDims(room, finish){
  const s = projectData[room].settings || {};
  if(finish.type === 'cokol'){
    return { h: Number(s.legHeight)||10 };
  }
  if(finish.type === 'blenda_gorna'){
    return { h: Number(s.ceilingBlende)||0 };
  }
  return {};
}

function addFinish(room, finish){
  finish.id = finish.id || FC.utils.uid();
  projectData[room].finishes.push(finish);
  saveProject();
}

function removeFinish(room, finishId){
  projectData[room].finishes = (projectData[room].finishes||[]).filter(f=>f.id!==finishId);
  saveProject();
}

function insertGapAfter(room, seg, row, index, widthCm){
  const arr = seg.rows[row];
  const gap = { kind:'gap', id:'gap_'+FC.utils.uid(), width: Number(widthCm)||0, label:'PRZERWA' };
  arr.splice(index+1, 0, gap);
  saveProject();
}

function finishLabel(f){
  if(f.type==='panel') return `Panel ${f.side==='L'?'lewy':'prawy'}`;
  if(f.type==='blenda_pion') return `Blenda pion ${f.side==='L'?'lewa':'prawa'}`;
  if(f.type==='blenda_pion_full') return `Blenda pion pełna ${f.side==='L'?'lewa':'prawa'}`;
  if(f.type==='panel_pion_full') return `Panel pełny ${f.side==='L'?'lewy':'prawy'}`;
  if(f.type==='cokol') return `Cokół (${humanRow(f.row)})`;
  if(f.type==='blenda_gorna') return `Blenda górna (${humanRow(f.row)})`;
  return f.type;
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
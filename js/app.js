/* ===== Storage keys and defaults ===== */
const STORAGE_KEYS = {
  materials: 'fc_materials_v1',
  services: 'fc_services_v1',
  projectData: 'fc_project_v1',
  projectBackup: 'fc_project_backup_v1',
  projectBackupMeta: 'fc_project_backup_meta_v1',
  ui: 'fc_ui_v1',
};

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
function renderTopHeight(){
  const el = document.getElementById('autoTopHeight');
  if(el) el.textContent = calculateAvailableTopHeight();
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
function renderCabinetTypeChoices(){
  const wrap = document.getElementById('cabinetTypeChoices');
  wrap.innerHTML = '';
  const choices = [
    { key:'stojąca', title:'Szafka dolna', sub:'Standardowy dół', ico:'⬇️' },
    { key:'wisząca', title:'Szafka wisząca', sub:'Standardowa góra', ico:'⬆️' },
    { key:'moduł', title:'Moduł', sub:'Wkład / segment', ico:'🧱' },
    { key:'zestaw', title:'Zestaw', sub:'Standardy na ikonkach', ico:'🧩' }
  ];

  choices.forEach(ch => {
    const tile = document.createElement('div');
    tile.className = 'choice-tile' + (cabinetModalState.chosen === ch.key ? ' selected' : '');
    tile.innerHTML = `
      <div class="choice-ico">${ch.ico}</div>
      <div>
        <div class="choice-title">${ch.title}</div>
        <div class="choice-sub">${ch.sub}</div>
      </div>
    `;
    tile.addEventListener('click', () => {
      cabinetModalState.chosen = ch.key;

      if(ch.key !== 'zestaw'){
        const room = uiState.roomType;
    projectData[room].cabinets = projectData[room].cabinets || [];
        if(!cabinetModalState.draft) cabinetModalState.draft = makeDefaultCabinetDraftForRoom(room);

        applyTypeRules(room, cabinetModalState.draft, ch.key);
        const opts = getSubTypeOptionsForType(ch.key).map(o=>o.v);
        if(!opts.includes(cabinetModalState.draft.subType)) cabinetModalState.draft.subType = opts[0];
        applySubTypeRules(room, cabinetModalState.draft, cabinetModalState.draft.subType);
        ensureFrontCountRules(cabinetModalState.draft);
      }
      renderCabinetModal();
    });
    wrap.appendChild(tile);
  });
}

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

function renderCabinetExtraDetailsInto(container, draft){
  container.innerHTML = '';
  const t = draft.type;
  const st = draft.subType;
  const d = draft.details || {};

  function addSelect(labelText, key, options, onChangeExtra){
    const div = document.createElement('div'); div.style.marginBottom='10px';
    div.innerHTML = `<label>${labelText}</label><select></select>`;
    const sel = div.querySelector('select');
    options.forEach(opt => {
      const o = document.createElement('option'); o.value=opt.v; o.textContent=opt.t; sel.appendChild(o);
    });
    sel.value = (draft.details && draft.details[key]) ? draft.details[key] : options[0].v;
    sel.addEventListener('change', e => {
      draft.details = Object.assign({}, draft.details || {}, { [key]: e.target.value });
      if(onChangeExtra) onChangeExtra(e.target.value);
      renderCabinetModal();
    });
    container.appendChild(div);
  }

  function addNumber(labelText, key, fallback){
    const div = document.createElement('div'); div.style.marginBottom='10px';
    const raw = (draft.details && draft.details[key] != null) ? draft.details[key] : fallback;
    const existingShelves = document.getElementById('cmShelves');
    const idAttr = (!existingShelves && key === 'shelves') ? ' id="cmShelves"' : '';
    div.innerHTML = `<label>${labelText}</label><input type="number"${idAttr} value="${raw}" />`;
    const inp = div.querySelector('input');

    const apply = () => {
      // zapisuj od razu (żeby nie wymagało "odkliknięcia" pola)
      draft.details = Object.assign({}, draft.details || {}, { [key]: inp.value });
    };

    inp.addEventListener('input', apply);
    inp.addEventListener('change', apply);
    container.appendChild(div);
  }


  // narożna L (wisząca / stojąca): własne wymiary + szkic (bez grafik zewnętrznych)
  if((t === 'wisząca' || t === 'stojąca') && st === 'narozna_l'){
    const d0 = FC.utils.isPlainObject(draft.details) ? draft.details : {};
    // domyślne wymiary zależnie od typu
    const isStanding = (t === 'stojąca');
    const defaults = {
      gl: (d0.gl != null ? d0.gl : (isStanding ? '110' : '70')),
      gp: (d0.gp != null ? d0.gp : (isStanding ? '50'  : '36')),
      st: (d0.st != null ? d0.st : (isStanding ? '100' : '60')),
      sp: (d0.sp != null ? d0.sp : (isStanding ? '47'  : '33')),
      shelves: (d0.shelves != null ? d0.shelves : 2)
    ,
      cornerFlip: (d0.cornerFlip != null ? d0.cornerFlip : false)
    };
    draft.details = Object.assign({}, d0, defaults);

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
        <div>
          <label>GL</label>
          <input id="cmGL" type="number" step="0.1" />
          <div class="muted xs" style="margin-top:4px">Głębokość lewa (cm)</div>
        </div>
        <div>
          <label>GP</label>
          <input id="cmGP" type="number" step="0.1" />
          <div class="muted xs" style="margin-top:4px">Głębokość prawa (cm)</div>
        </div>
        <div>
          <label>ST</label>
          <input id="cmST" type="number" step="0.1" />
          <div class="muted xs" style="margin-top:4px">Szerokość tyłu (cm)</div>
        </div>
        <div>
          <label>SP</label>
          <input id="cmSP" type="number" step="0.1" />
          <div class="muted xs" style="margin-top:4px">Szerokość przodu (cm)</div>
        </div>
      </div>

      <div class="flex" style="margin-top:10px;justify-content:space-between;flex-wrap:wrap">
        <button id="flipCornerBtn" class="btn" type="button">Odwróć narożnik</button>
        <div id="cornerWarn" class="warn-orange xs"></div>
      </div>

      <div class="muted xs" style="margin-top:8px">
        Widok z góry. Fronty liczone: <b>FL = |GL−GP|</b> oraz <b>FP = |ST−SP−1,8|</b> (płyta 18&nbsp;mm).
      </div>

      <div style="margin-top:10px">
        <canvas id="cornerPreview" width="520" height="360" style="width:100%;max-width:520px;border:1px solid #ddd;border-radius:10px;"></canvas>
        <div class="muted xs" id="cornerPreviewLegend" style="margin-top:6px"></div>
      </div>
    `;
    container.appendChild(wrap);

    const iGL = wrap.querySelector('#cmGL');
    const iGP = wrap.querySelector('#cmGP');
    const iST = wrap.querySelector('#cmST');
    const iSP = wrap.querySelector('#cmSP');
    const warnEl = wrap.querySelector('#cornerWarn');
    const flipBtn = wrap.querySelector('#flipCornerBtn');

    iGL.value = draft.details.gl;
    iGP.value = draft.details.gp;
    iST.value = draft.details.st;
    iSP.value = draft.details.sp;

    const widthInput = document.getElementById('cmWidth');
    const depthInput = document.getElementById('cmDepth');

    const sync = () => {
      const GL = Number(iGL.value) || 0;
      const GP = Number(iGP.value) || 0;
      const ST = Number(iST.value) || 0;
      const SP = Number(iSP.value) || 0;
      const flip = !!(draft.details && draft.details.cornerFlip);

      // Twoje zasady na fronty (cm)
      const FL = Math.abs(GL - GP);
      const FP = Math.abs(ST - SP - 1.8);

      draft.details = Object.assign({}, draft.details || {}, {
        gl: String(GL),
        gp: String(GP),
        st: String(ST),
        sp: String(SP)
      });

      // pomocniczo: uzupełnij "Szerokość" i "Głębokość" w głównych polach (żeby wycena/listy miały sens)
      // szerokość = ST, głębokość = max(GL, GP)
      draft.width = ST;
      draft.depth = Math.max(GL, GP);

      if(widthInput) widthInput.value = String(draft.width);
      if(depthInput) depthInput.value = String(draft.depth);

      drawCornerSketch({ GL, GP, ST, SP, t: 1.8, flip });

      // Ostrzeżenie: front < 15 cm
      if(warnEl){
        const msgs = [];
        if(FL > 0 && FL < 15) msgs.push('Front (FL) < 15 cm');
        if(FP > 0 && FP < 15) msgs.push('Front (FP) < 15 cm');
        if(msgs.length){
          warnEl.style.display = 'block';
          warnEl.textContent = '⚠ ' + msgs.join(' • ');
        } else {
          warnEl.style.display = 'none';
          warnEl.textContent = '';
        }
      }
    };

    [iGL,iGP,iST,iSP].filter(Boolean).forEach(inp => {
      inp.addEventListener('input', sync);
      inp.addEventListener('change', sync);
    });

    if(flipBtn){
      flipBtn.addEventListener('click', () => {
        // Odwróć tylko "stronę" narożnika (rysunek + opisy), bez zamiany wpisanych wartości.
        // Fronty i tak liczymy z wartości bezwzględnych, a GL/GP w formularzu zostają tym,
        // co wpisał operator.
        draft.details = Object.assign({}, draft.details || {}, {
          cornerFlip: !(draft.details && draft.details.cornerFlip)
        });
        sync();
      });
    }

    sync();
    return;
  }

  if(t === 'wisząca'){
    if(st === 'dolna_podblatowa'){
      // PODBLATOWA: fronty mogą być brak/drzwi/szuflady, a wnętrze: półki lub szuflady wewnętrzne
      if(!d.podFrontMode){
        // kompatybilność wstecz: jeśli stary zapis miał subTypeOption szuflady_1/2
        if(d.subTypeOption === 'szuflada_1'){ d.podFrontMode = 'szuflady'; cabinetModalState.draft.frontCount = 1; }
        else if(d.subTypeOption === 'szuflada_2'){ d.podFrontMode = 'szuflady'; cabinetModalState.draft.frontCount = 2; }
        else d.podFrontMode = (Number(cabinetModalState.draft.frontCount) === 0 ? 'brak' : 'drzwi');
      }
      if(!d.podInsideMode) d.podInsideMode = 'polki';
      if(!d.podInnerDrawerCount) d.podInnerDrawerCount = '1';

      addSelect('Front', 'podFrontMode', [
        {v:'brak', t:'Otwarta (brak frontów)'},
        {v:'drzwi', t:'Drzwi (fronty)'},
        {v:'szuflady', t:'Szuflady (zamiast drzwi)'}
      ], (val)=>{
        // synchronizacja z ilością frontów/szuflad
        if(val === 'brak'){
          cabinetModalState.draft.frontCount = 0;
        } else {
          const fc = Number(cabinetModalState.draft.frontCount);
          if(![1,2].includes(fc)) cabinetModalState.draft.frontCount = 2;
        }
      });

      if(d.podFrontMode !== 'szuflady'){
        addSelect('Wnętrze', 'podInsideMode', [
          {v:'polki', t:'Półki'},
          {v:'szuflady_wewn', t:'Szuflady wewnętrzne'}
        ]);

        if(d.podInsideMode === 'polki'){
          addNumber('Ilość półek', 'shelves', 2);
        } else {
          addSelect('Ilość szuflad wewnętrznych', 'podInnerDrawerCount', [
            {v:'1', t:'1'},
            {v:'2', t:'2'}
          ]);
        }

      // Plecy (tak/nie) – tylko dla szafki: wisząca podblatowa
      if(!(draft.details && (draft.details.hasBack !== undefined))){
        draft.details = Object.assign({}, draft.details || {}, { hasBack: '1' });
      }
      addSelect('Plecy', 'hasBack', [
        {v:'1', t:'Tak'},
        {v:'0', t:'Nie'}
      ]);
      }
    } else {
      if(st === 'rogowa_slepa') addNumber('Część zaślepiona (cm)', 'blindPart', 30);
      if(st !== 'uchylne') addNumber('Ilość półek', 'shelves', 2);
    }
  }

  if(t === 'stojąca' || t === 'moduł'){
    if(st === 'szuflady'){
      // Szafka stojąca szufladowa: układ + typ szuflad + opcjonalne szuflady wewnętrzne
      if(!d.drawerLayout){
        // kompatybilność wstecz: drawerCount 1/2/3/4/5
        const legacy = String(d.drawerCount || '3');
        if(legacy === '1') d.drawerLayout = '1_big';
        else if(legacy === '2') d.drawerLayout = '2_equal';
        else if(legacy === '3') d.drawerLayout = '3_1_2_2';
        else if(legacy === '5') d.drawerLayout = '5_equal';
        else d.drawerLayout = '3_equal';
      }
      if(!d.drawerSystem) d.drawerSystem = 'skrzynkowe';
      if(!('innerDrawerType' in d)) d.innerDrawerType = 'brak';
      if(!('innerDrawerCount' in d) || d.innerDrawerCount == null) d.innerDrawerCount = '0';
addSelect('Układ szuflad (fronty)', 'drawerLayout', [
        {v:'1_big', t:'1 duża (1:1)'},
        {v:'3_1_2_2', t:'1 mała + 2 duże (1:2:2)'},
        {v:'2_equal', t:'2 równe (1:1)'},
        {v:'3_equal', t:'3 równe (1:1:1)'},
        {v:'5_equal', t:'5 równych (1:1:1:1:1)'}
      ], () => {
        // dostosuj domyślne limity dla szuflad wewnętrznych
        const lay = String(draft.details?.drawerLayout || '3_1_2_2');
        if(lay === '5_equal'){
          draft.details = Object.assign({}, draft.details || {}, { innerDrawerType: 'brak', innerDrawerCount: '0' });
        } else if(lay === '3_equal'){
          if(String(draft.details?.innerDrawerCount || '') === '0' || !draft.details?.innerDrawerCount) draft.details = Object.assign({}, draft.details || {}, { innerDrawerCount: '3' });
        } else {
          if(String(draft.details?.innerDrawerCount || '') === '0' || !draft.details?.innerDrawerCount) draft.details = Object.assign({}, draft.details || {}, { innerDrawerCount: '2' });
        }
        renderCabinetModal();
      });

      // domyślne ustawienia dla szafki szufladowej
      draft.details = Object.assign({}, draft.details || {});
      const isAdd = (cabinetModalState.mode === 'add' || !cabinetModalState.editingId);

      // UWAGA: nie nadpisuj wyborów użytkownika przy każdym renderze.
      // drawerSystem przyjmuje tylko: 'skrzynkowe' | 'systemowe'
      if(!draft.details.drawerSystem || !['skrzynkowe','systemowe'].includes(String(draft.details.drawerSystem))){
        draft.details.drawerSystem = 'skrzynkowe';
      }
      if(!draft.details.innerDrawerType) draft.details.innerDrawerType = 'brak';
      if(draft.details.innerDrawerType === 'brak'){
        draft.details.innerDrawerCount = '0';
      } else if(!draft.details.innerDrawerCount){
        // domyślnie 2, dalsze ograniczenia liczy istniejąca logika układu
        draft.details.innerDrawerCount = '2';
      }
addSelect('Typ szuflad (frontowych)', 'drawerSystem', [
        {v:'skrzynkowe', t:'Skrzynkowe'},
        {v:'systemowe', t:'Systemowe'}
      ], ()=>{ renderCabinetModal(); });

      const ds = String((draft.details && draft.details.drawerSystem) ? draft.details.drawerSystem : 'skrzynkowe');
      if(ds === 'systemowe'){
        // domyślne wartości
        if(!draft.details.drawerBrand) draft.details.drawerBrand = 'blum';
        if(draft.details.drawerBrand === 'blum' && !draft.details.drawerModel) draft.details.drawerModel = 'tandembox';

        addSelect('Firma systemu', 'drawerBrand', [
          {v:'blum', t:'BLUM'},
          {v:'gtv', t:'GTV'},
          {v:'rejs', t:'Rejs'}
        ], ()=>{ renderCabinetModal(); });

        const br = String(draft.details.drawerBrand || 'blum');
        if(br === 'blum'){
          addSelect('Typ szuflady BLUM', 'drawerModel', [
            {v:'tandembox', t:'TANDEMBOX (domyślnie)'},
            {v:'legrabox', t:'LEGRABOX'},
            {v:'merivobox', t:'MERIVOBOX'},
            {v:'metabox', t:'METABOX'}
          ]);
        } else {
          const warn = document.createElement('div');
          warn.className = 'muted xs';
          warn.style.marginTop = '6px';
          warn.textContent = 'GTV/Rejs – w budowie. Nie można zatwierdzić.';
          container.appendChild(warn);
        }
      }

      const lay = String(d.drawerLayout || '3_1_2_2');
      if(lay === '5_equal'){
        // Brak szuflad wewnętrznych dla 5 szuflad
        draft.details = Object.assign({}, draft.details || {}, { innerDrawerType: 'brak', innerDrawerCount: '0' });
        const note = document.createElement('div');
        note.className = 'muted xs';
        note.style.marginTop = '6px';
        note.textContent = 'Dla układu 5 szuflad nie dodajemy szuflad wewnętrznych.';
        container.appendChild(note);
      } else {
        addSelect('Szuflady wewnętrzne', 'innerDrawerType', [
          {v:'brak', t:'Brak'},
          {v:'skrzynkowe', t:'Skrzynkowe'},
          {v:'blum', t:'Systemowe BLUM'}
        ], () => renderCabinetModal());

        const mode = String((draft.details && draft.details.innerDrawerType) ? draft.details.innerDrawerType : 'brak');
        const max = (lay === '3_equal') ? 3 : 2;
        const def = (lay === '3_equal') ? 3 : 2;

        if(mode !== 'brak'){
          // ilość z listy (limit)
          (function(){
            const div = document.createElement('div'); div.style.marginBottom='10px';
            div.innerHTML = `<label>Ilość szuflad wewnętrznych (max ${max})</label><select></select>`;
            const sel = div.querySelector('select');

            const raw = (draft.details && draft.details.innerDrawerCount != null) ? draft.details.innerDrawerCount : String(def);
            let cur = parseInt(raw || '0', 10);
            if(!Number.isFinite(cur) || cur < 1) cur = def;
            if(cur > max) cur = max;

            sel.innerHTML = Array.from({length:max}, (_,i)=>i+1).map(n=>`<option value="${n}">${n}</option>`).join('');
            sel.value = String(cur);

            sel.addEventListener('change', e => {
              let v = parseInt(e.target.value || '1', 10);
              if(!Number.isFinite(v) || v < 1) v = 1;
              if(v > max) v = max;
              draft.details = Object.assign({}, draft.details || {}, { innerDrawerCount: String(v) });
              renderCabinetModal();
            });

            container.appendChild(div);
          })();
        } else {
          // utrzymuj sensowną domyślną wartość "na start"
          const cur = parseInt(d.innerDrawerCount, 10);
          if(!Number.isFinite(cur) || cur <= 0){
            draft.details = Object.assign({}, draft.details || {}, { innerDrawerCount: String(def) });
          }
        }
      }
    }

    if(st === 'zlewowa'){
      // FRONT: drzwi lub szuflada
      if(!d.sinkFront) d.sinkFront = 'drzwi';
      if(!d.sinkDoorCount) d.sinkDoorCount = '2';
      if(!d.sinkExtra) d.sinkExtra = 'brak';
      if(d.sinkExtraCount == null) d.sinkExtraCount = 1;
      if(!d.sinkInnerDrawerType) d.sinkInnerDrawerType = 'skrzynkowe';

      addSelect('Front szafki zlewowej', 'sinkFront', [
        {v:'drzwi', t:'Drzwi'},
        {v:'szuflada', t:'Szuflada (1 duży front)'}
      ], () => {
        // wymuszenia frontów
        const curFront = (draft.details && draft.details.sinkFront) ? draft.details.sinkFront : 'drzwi';
        if(curFront === 'szuflada'){
          draft.frontCount = 1;
        } else {
          const dc = Number((draft.details && draft.details.sinkDoorCount) ? draft.details.sinkDoorCount : '2') || 2;
          draft.frontCount = (dc === 1 ? 1 : 2);
        }
        renderCabinetModal();
      });

      const curFront = (draft.details && draft.details.sinkFront) ? draft.details.sinkFront : 'drzwi';

      if(curFront === 'drzwi'){
        addSelect('Ilość drzwi', 'sinkDoorCount', [
          {v:'1', t:'1 drzwi'},
          {v:'2', t:'2 drzwi'}
        ], () => {
          const dc = Number((draft.details && draft.details.sinkDoorCount) ? draft.details.sinkDoorCount : '2') || 2;
          draft.frontCount = (dc === 1 ? 1 : 2);
        });
      } else {
        // szuflada: 1 front
        draft.frontCount = 1;
      }

      if(curFront === 'szuflada'){
        if(!draft.details.drawerSystem) draft.details.drawerSystem = 'skrzynkowe';
        if(!draft.details.drawerBrand) draft.details.drawerBrand = 'blum';
        if(!draft.details.drawerModel) draft.details.drawerModel = 'tandembox';

        addSelect('Typ szuflady (zlewowa)', 'drawerSystem', [
          {v:'skrzynkowe', t:'Skrzynkowe'},
          {v:'systemowe', t:'Systemowe'}
        ], ()=>{ renderCabinetModal(); });

        const ds3 = String(draft.details.drawerSystem || 'skrzynkowe');
        if(ds3 === 'systemowe'){
          addSelect('Firma systemu', 'drawerBrand', [
            {v:'blum', t:'BLUM'},
            {v:'gtv', t:'GTV'},
            {v:'rejs', t:'Rejs'}
          ], ()=>{ renderCabinetModal(); });
          const br3 = String(draft.details.drawerBrand || 'blum');
          if(br3 === 'blum'){
            addSelect('Typ szuflady BLUM', 'drawerModel', [
              {v:'tandembox', t:'TANDEMBOX (domyślnie)'},
              {v:'legrabox', t:'LEGRABOX'},
              {v:'merivobox', t:'MERIVOBOX'},
              {v:'metabox', t:'METABOX'}
            ]);
          } else {
            const warn3 = document.createElement('div');
            warn3.className = 'muted xs';
            warn3.style.marginTop = '6px';
            warn3.textContent = 'GTV/Rejs – w budowie. Nie można zatwierdzić.';
            container.appendChild(warn3);
          }
        }
      }

      // DODATKOWE WNĘTRZE
      addSelect('Dodatkowo w środku', 'sinkExtra', [
        {v:'brak', t:'Brak'},
        {v:'polka', t:'Dodatkowa półka'},
        {v:'szuflada_wew', t:'Szuflada wewnętrzna'}
      ], ()=>{ renderCabinetModal(); });

      const extra = (draft.details && draft.details.sinkExtra) ? draft.details.sinkExtra : 'brak';
      if(extra === 'polka'){
        addNumber('Ilość dodatkowych półek', 'sinkExtraCount', 1);
      } else if(extra === 'szuflada_wew'){
        addNumber('Ilość szuflad wewnętrznych', 'sinkExtraCount', 1);
        addSelect('Typ szuflad wewnętrznych', 'sinkInnerDrawerType', [
          {v:'skrzynkowe', t:'Skrzynkowe'},
          {v:'systemowe', t:'Systemowe'}
        ], ()=>{ renderCabinetModal(); });

        const stt = String((draft.details && draft.details.sinkInnerDrawerType) ? draft.details.sinkInnerDrawerType : 'skrzynkowe');
        if(stt === 'systemowe'){
          if(!draft.details.sinkInnerDrawerBrand) draft.details.sinkInnerDrawerBrand = 'blum';
          if(draft.details.sinkInnerDrawerBrand === 'blum' && !draft.details.sinkInnerDrawerModel) draft.details.sinkInnerDrawerModel = 'tandembox';

          addSelect('Firma systemu', 'sinkInnerDrawerBrand', [
            {v:'blum', t:'BLUM'},
            {v:'gtv', t:'GTV'},
            {v:'rejs', t:'Rejs'}
          ], ()=>{ renderCabinetModal(); });

          const br2 = String(draft.details.sinkInnerDrawerBrand || 'blum');
          if(br2 === 'blum'){
            addSelect('Typ szuflady BLUM', 'sinkInnerDrawerModel', [
              {v:'tandembox', t:'TANDEMBOX (domyślnie)'},
              {v:'legrabox', t:'LEGRABOX'},
              {v:'merivobox', t:'MERIVOBOX'},
              {v:'metabox', t:'METABOX'}
            ]);
          } else {
            const warn2 = document.createElement('div');
            warn2.className = 'muted xs';
            warn2.style.marginTop = '6px';
            warn2.textContent = 'GTV/Rejs – w budowie. Nie można zatwierdzić.';
            container.appendChild(warn2);
          }
        }
      }
    }
    if(st === 'zmywarkowa'){
      addSelect('Szerokość zmywarki', 'dishWasherWidth', [
        {v:'45', t:'45 cm'},
        {v:'60', t:'60 cm'}
      ], (val) => {
        draft.frontCount = 1;
        draft.width = Number(val) || draft.width;
      });
    }
    if(st === 'lodowkowa'){
      // Lodówkowa: zabudowa / wolnostojąca
      const grid = document.createElement('div');
      grid.className = 'grid-2';
      grid.style.gap = '12px';
      grid.style.marginBottom = '10px';

      const cur = (draft.details && FC.utils.isPlainObject(draft.details)) ? draft.details : {};
      const opt = cur.fridgeOption ? String(cur.fridgeOption) : 'zabudowa';
      const niche = cur.fridgeNicheHeight ? String(cur.fridgeNicheHeight) : '178';
      const freeOpt = cur.fridgeFreeOption ? String(cur.fridgeFreeOption) : 'brak';

      grid.innerHTML = `
        <div>
          <label>Typ lodówki</label>
          <select id="cmFridgeOption">
            <option value="zabudowa">W zabudowie</option>
            <option value="wolnostojaca">Wolnostojąca</option>
          </select>
        </div>
        <div id="cmFridgeNicheWrap">
          <label>Wysokość niszy (cm)</label>
          <select id="cmFridgeNiche">
            <option value="82">82</option>
            <option value="122">122</option>
            <option value="158">158</option>
            <option value="178">178</option>
            <option value="194">194</option>
            <option value="204">204</option>
          </select>
        </div>
        <div id="cmFridgeFreeWrap" style="display:none">
          <label>Opcja</label>
          <select id="cmFridgeFree">
            <option value="brak">Brak</option>
            <option value="podest">Podest</option>
            <option value="obudowa">Obudowa</option>
          </select>
        </div>
      `;

      const fo = grid.querySelector('#cmFridgeOption');
      const fn = grid.querySelector('#cmFridgeNiche');
      const fw = grid.querySelector('#cmFridgeFree');
      const nicheWrap = grid.querySelector('#cmFridgeNicheWrap');
      const freeWrap = grid.querySelector('#cmFridgeFreeWrap');

      fo.value = opt;
      fn.value = niche;
      fw.value = freeOpt;

      function applyFridgeDims(){
        const room = uiState.roomType;
        const s = projectData[room] ? projectData[room].settings : null;
        const bh = s ? (Number(s.bottomHeight) || 0) : 0;
        const leg = s ? (Number(s.legHeight) || 0) : 0;

        const curOpt = (draft.details && draft.details.fridgeOption) ? String(draft.details.fridgeOption) : (fo ? fo.value : 'zabudowa');
        const curFree = (draft.details && draft.details.fridgeFreeOption) ? String(draft.details.fridgeFreeOption) : (fw ? fw.value : 'brak');
        const nh = Number((draft.details && draft.details.fridgeNicheHeight) ? draft.details.fridgeNicheHeight : (fn ? fn.value : 0)) || 0;

        // zawsze utrzymuj spójne details
        draft.details = Object.assign({}, draft.details || {}, {
          fridgeOption: curOpt,
          fridgeFreeOption: curFree,
          fridgeNicheHeight: String(nh)
        });

        if(curOpt === 'zabudowa'){
          // ilość przegród technicznych liczona jak w zmywarce: od dolnego frontu (wys. dołu - nóżki)
          const bottomFrontH = Math.max(0, bh - leg);
          const div = (bottomFrontH > 74.5)
            ? Math.max(0, Math.ceil(((bottomFrontH - 74.5) / 2) - 1e-9))
            : 0;

          draft.details = Object.assign({}, draft.details, { techDividerCount: String(div) });

          // wysokość słupka lodówkowego: nisza + (przegrody * 1.8) + 3.6 + nóżki
          draft.height = nh + (div * 1.8) + 3.6 + leg;
          return;
        }

        // wolnostojąca: auto-wymiary zależnie od opcji
        if(curFree === 'podest'){
          draft.width = 60;
          draft.depth = 60;
          draft.height = 3.6 + leg;
        } else if(curFree === 'obudowa'){
          draft.width = 65;
          draft.depth = 59.2;
          draft.height = 207;
        }
      }

      function toggleFridgeUI(){
        const o = (draft.details && draft.details.fridgeOption) ? draft.details.fridgeOption : fo.value;
        const isBuiltIn = (o === 'zabudowa');
        nicheWrap.style.display = isBuiltIn ? 'block' : 'none';
        freeWrap.style.display = isBuiltIn ? 'none' : 'block';
      }

      fo.addEventListener('change', e => {
        draft.details = Object.assign({}, draft.details || {}, { fridgeOption: e.target.value });
        applyFridgeDims();
        // dla zmiany typu nie tracimy danych, ale aktualizujemy UI
        renderCabinetModal();
      });

      fn.addEventListener('change', e => {
        draft.details = Object.assign({}, draft.details || {}, { fridgeNicheHeight: e.target.value });
        applyFridgeDims();
        // odświeżamy wartości pól
        renderCabinetModal();
      });

      fw.addEventListener('change', e => {
        draft.details = Object.assign({}, draft.details || {}, { fridgeFreeOption: e.target.value });
        applyFridgeDims();
        renderCabinetModal();
      });

      container.appendChild(grid);

      // FRONTY lodówkowej: 1 lub 2 (tylko zabudowa)
      const builtInNow = (opt === 'zabudowa');
      if(builtInNow){
        addSelect('Fronty lodówki (zabudowa)', 'fridgeFrontCount', [
          {v:'1', t:'1 duży front'},
          {v:'2', t:'2 fronty (dolny + górny)'}
        ]);
      }

      toggleFridgeUI();
      // ustaw wysokość przy wejściu (zabudowa)
      draft.details = Object.assign({}, draft.details || {}, {
        fridgeOption: opt,
        fridgeNicheHeight: niche,
        fridgeFreeOption: freeOpt
      });
      applyFridgeDims();
    }
    if(st === 'piekarnikowa'){
      addSelect('Opcja piekarnika', 'ovenOption', [
        {v:'szuflada_dol', t:'Szuflada na dole'},
        {v:'szuflada_gora', t:'Szuflada na górze'},
        {v:'klapka_dol', t:'Klapka na dole'},
        {v:'klapka_gora', t:'Klapka na górze'}
      ], () => {
        draft.frontCount = 1;
      });
      addNumber('Wysokość piekarnika (cm)', 'ovenHeight', 60);
      addNumber('Przegroda techniczna (szt)', 'techShelfCount', 1);
      const oo = String((draft.details && draft.details.ovenOption) ? draft.details.ovenOption : 'szuflada_dol');
      if(oo.indexOf('szuflada') !== -1){
        if(!draft.details.drawerSystem) draft.details.drawerSystem = 'skrzynkowe';
        if(!draft.details.drawerBrand) draft.details.drawerBrand = 'blum';
        if(!draft.details.drawerModel) draft.details.drawerModel = 'tandembox';

        addSelect('Typ szuflady (piekarnikowa)', 'drawerSystem', [
          {v:'skrzynkowe', t:'Skrzynkowe'},
          {v:'systemowe', t:'Systemowe'}
        ], ()=>{ renderCabinetModal(); });

        const ds2 = String(draft.details.drawerSystem || 'skrzynkowe');
        if(ds2 === 'systemowe'){
          addSelect('Firma systemu', 'drawerBrand', [
            {v:'blum', t:'BLUM'},
            {v:'gtv', t:'GTV'},
            {v:'rejs', t:'Rejs'}
          ], ()=>{ renderCabinetModal(); });

          const br = String(draft.details.drawerBrand || 'blum');
          if(br === 'blum'){
            addSelect('Typ szuflady BLUM', 'drawerModel', [
              {v:'tandembox', t:'TANDEMBOX (domyślnie)'},
              {v:'legrabox', t:'LEGRABOX'},
              {v:'merivobox', t:'MERIVOBOX'},
              {v:'metabox', t:'METABOX'}
            ]);
          } else {
            const warn = document.createElement('div');
            warn.className = 'muted xs';
            warn.style.marginTop = '6px';
            warn.textContent = 'GTV/Rejs – w budowie. Nie można zatwierdzić.';
            container.appendChild(warn);
          }
        }
      }
    }
    if(['standardowa','rogowa_slepa','narozna_l'].includes(st)){
      if(st !== 'standardowa'){
        const opt = (st === 'narozna_l') ? {v:'karuzela', t:'Karuzela'} : {v:'magic_corner', t:'Magic Corner'};
        if(st === 'rogowa_slepa') addNumber('Część zaślepiona (cm)', 'blindPart', 30);
        addSelect('System narożny', 'cornerOption', [
          {v:'polki', t:'Półki'},
          opt
        ], () => {
          if(st === 'rogowa_slepa' && (draft.details?.cornerOption || 'polki') === 'magic_corner'){
            draft.frontCount = 1;
          }
        });
      }
      const corner = d.cornerOption ? d.cornerOption : 'polki';

      // STANDARDOWA: wnętrze półki lub szuflady wewnętrzne
      if(st === 'standardowa'){
        if(!d.insideMode) d.insideMode = 'polki';
        if(!d.innerDrawerCount) d.innerDrawerCount = '1';
        if(!d.innerDrawerType) d.innerDrawerType = 'blum';

        addSelect('Wnętrze', 'insideMode', [
          {v:'polki', t:'Półki'},
          {v:'szuflady_wew', t:'Szuflady wewnętrzne'}
        ], (val)=>{
          // utrzymuj spójne dane: jeśli wybierasz szuflady wew., półki powinny być 0 (żeby nie mieszać w szczegółach)
          const dv = FC.utils.isPlainObject(draft.details) ? draft.details : {};
          if(String(val) === 'szuflady_wew'){
            dv.shelves = 0;
            if(!dv.innerDrawerCount) dv.innerDrawerCount = '1';
            if(!dv.innerDrawerType) dv.innerDrawerType = 'blum';
          } else {
            // półki
            if(dv.shelves == null || dv.shelves === '' || Number(dv.shelves) <= 0) dv.shelves = 1;
          }
          draft.details = dv;
        });

        const inside = (draft.details && draft.details.insideMode) ? draft.details.insideMode : 'polki';
        if(inside === 'polki'){
          addNumber('Ilość półek', 'shelves', 1);
        } else {
          addNumber('Ilość szuflad wewnętrznych', 'innerDrawerCount', 1);
          addSelect('Typ szuflad wewnętrznych', 'innerDrawerType', [
            {v:'skrzynkowe', t:'Skrzynkowe'},
            {v:'blum', t:'Systemowe BLUM'}
          ]);
        }
      } else if(corner === 'polki'){
        addNumber('Ilość półek', 'shelves', 1);
      }
    }
  }
}

/* ===== Zestawy (presety) ===== */
function renderSetTiles(){
  const wrap = document.getElementById('setTiles');
  wrap.innerHTML = '';

  const presets = [
    {
      id:'A',
      title:'2 dolne + górny moduł',
      desc:'Dwa dolne korpusy obok siebie + górny moduł. Wysokość górnego = pomieszczenie - dół - blenda.',
      svg: `
        <svg class="mini-svg" viewBox="0 0 56 40" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="18" width="24" height="20" rx="3" fill="#eaf6ff" stroke="#0ea5e9" />
          <rect x="30" y="18" width="24" height="20" rx="3" fill="#eaf6ff" stroke="#0ea5e9" />
          <rect x="2" y="2" width="52" height="14" rx="3" fill="#ffffff" stroke="#94a3b8" />
        </svg>
      `
    },
    {
      id:'C',
      title:'1 pion: dół + górny moduł',
      desc:'Jeden pion (dół + górny moduł). Wysokość górnego = pomieszczenie - dół - blenda.',
      svg: `
        <svg class="mini-svg" viewBox="0 0 56 40" xmlns="http://www.w3.org/2000/svg">
          <rect x="18" y="2" width="20" height="36" rx="3" fill="#eaf6ff" stroke="#0ea5e9" />
          <line x1="18" y1="22" x2="38" y2="22" stroke="#0ea5e9" stroke-width="2"/>
        </svg>
      `
    },
    {
      id:'D',
      title:'1 pion: dół + środek + góra',
      desc:'Trzy segmenty w pionie. Środkowy i górny to moduły (głębokość = dół - 1). Wysokość górnego = pomieszczenie - dół - środek - blenda.',
      svg: `
        <svg class="mini-svg" viewBox="0 0 56 40" xmlns="http://www.w3.org/2000/svg">
          <rect x="18" y="2" width="20" height="36" rx="3" fill="#ffffff" stroke="#0ea5e9" />
          <line x1="18" y1="15" x2="38" y2="15" stroke="#0ea5e9" stroke-width="2"/>
          <line x1="18" y1="26" x2="38" y2="26" stroke="#0ea5e9" stroke-width="2"/>
          <rect x="18" y="26" width="20" height="12" rx="0" fill="#eaf6ff" opacity="0.65" />
        </svg>
      `
    }
  ];

  presets.forEach(p => {
    const tile = document.createElement('div');
    tile.className = 'mini-tile' + (cabinetModalState.setPreset === p.id ? ' selected' : '');
    tile.innerHTML = `
      <div class="mini-head">
        ${p.svg}
        <div>
          <div class="mini-title">${p.title}</div>
          <div class="muted-tag xs">Zestaw standardowy</div>
        </div>
      </div>
      <div class="mini-desc">${p.desc}</div>
    `;
    tile.addEventListener('click', () => {
      cabinetModalState.setPreset = p.id;
      renderCabinetModal();
    });
    wrap.appendChild(tile);
  });
}

function renderSetParamsUI(presetId){
  const room = uiState.roomType;
  const s = projectData[room].settings;
  const paramsWrap = document.getElementById('setParams');
  paramsWrap.innerHTML = '';
  if(!presetId){ paramsWrap.style.display='none'; return; }

  paramsWrap.style.display='grid';

  function addInput(id,label,value,extra=''){
    const d = document.createElement('div');
    d.innerHTML = `<label>${label}</label><input id="${id}" type="number" value="${value}" ${extra}/>`;
    paramsWrap.appendChild(d);
  }
  function addReadonly(id,label,value){
    const d = document.createElement('div');
    d.innerHTML = `<label>${label}</label><input id="${id}" type="number" value="${value}" disabled />`;
    paramsWrap.appendChild(d);
  }

  const defaultBlende = Number(s.ceilingBlende) || 0;

  if(presetId === 'A'){
    addInput('setW1','Szer. lewa (cm)', 60);
    addInput('setW2','Szer. prawa (cm)', 60);
    addInput('setHBottom','Wys. dolnych (cm)', Number(s.bottomHeight)||82);
    addInput('setDBottom','Głębokość dolnych (cm)', 51);
    addInput('setBlende','Blenda (cm)', defaultBlende);

    const hTop = calcTopForSet(room, defaultBlende, Number(s.bottomHeight)||82);
    addReadonly('setHTopResult','Wys. górnego (wynikowa)', hTop);
    addReadonly('setDTopResult','Głęb. górnego (dół-1)', Math.max(0, 51-1));
  }

  if(presetId === 'C'){
    addInput('setW','Szerokość (cm)', 60);
    addInput('setHBottom','Wys. dolnego z nogami (cm)', Number(s.bottomHeight)||82);
    addInput('setDBottom','Głębokość dolnego (cm)', 51);
    addInput('setBlende','Blenda (cm)', defaultBlende);

    const hTop = calcTopForSet(room, defaultBlende, Number(s.bottomHeight)||82);
    addReadonly('setHTopResult','Wys. górnego (wynikowa)', hTop);
    addReadonly('setDTopResult','Głęb. górnego (dół-1)', Math.max(0, 51-1));
  }

  if(presetId === 'D'){
    addInput('setW','Szerokość (cm)', 60);
    addInput('setHBottom','Wys. dolnego z nogami (cm)', Number(s.bottomHeight)||82);
    addInput('setHMiddle','Wys. środkowego (cm)', 100);
    addInput('setDBottom','Głębokość dolnego (cm)', 51);
    addInput('setBlende','Blenda (cm)', defaultBlende);

    const hTop = calcTopForSet(room, defaultBlende, (Number(s.bottomHeight)||82) + 100);
    addReadonly('setHTopResult','Wys. górnego (wynikowa)', hTop);
    addReadonly('setDTopResult','Głęb. modułów (dół-1)', Math.max(0, 51-1));
  }

  wireSetParamsLiveUpdate(presetId);
}

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
function renderCabinetModal(){
  const isSetEdit = !!cabinetModalState.setEditId;

  // Zatwierdź w nagłówku: widoczne tylko gdy pokazujemy formularz szafki (nie przy wyborze typu i nie w zestawie)
  const saveTopBtn = document.getElementById('cabinetModalSave');
  if(saveTopBtn){
    saveTopBtn.style.display = 'none';
    saveTopBtn.disabled = true;
  }

  document.getElementById('cabinetModalIcon').textContent = isSetEdit ? '✏️' : (cabinetModalState.mode === 'edit' ? '✏️' : '➕');
  document.getElementById('cabinetModalTitle').textContent = isSetEdit ? 'Edytuj zestaw' : (cabinetModalState.mode === 'edit' ? 'Edytuj szafkę' : 'Dodaj');

  const choiceCard = document.getElementById('cabinetChoiceCard');
  choiceCard.style.display = isSetEdit ? 'none' : 'block';

  if(!isSetEdit){
    renderCabinetTypeChoices();
  } else {
    cabinetModalState.chosen = 'zestaw';
  }

  const formArea = document.getElementById('cabinetFormArea');
  const setArea = document.getElementById('setWizardArea');

  formArea.style.display = 'none';
  setArea.style.display = 'none';

  if(cabinetModalState.chosen === 'zestaw'){
    setArea.style.display = 'block';
    renderSetTiles();

    // W trybie zestawu pokaż \"Zatwierdź\" w nagłówku (działa jak Dodaj zestaw / Zapisz zmiany)
    if(saveTopBtn){
      const _btn = document.getElementById('setWizardCreate');
      saveTopBtn.style.display = 'inline-flex';
      saveTopBtn.disabled = false;
      saveTopBtn.textContent = _btn ? _btn.textContent : (isSetEdit ? 'Zapisz zmiany' : 'Dodaj zestaw');
    }

    if(isSetEdit){
      document.querySelectorAll('#setTiles .mini-tile').forEach(tile=>{
        tile.style.pointerEvents = 'none';
        tile.style.opacity = '0.8';
      });
      document.getElementById('setWizardCreate').textContent = 'Zapisz zmiany';
      document.getElementById('setWizardTitle').textContent = 'Zestaw (edycja)';
      document.getElementById('setWizardDesc').textContent = 'Zmieniasz parametry zestawu. Program przeliczy korpusy i fronty.';
    } else {
      document.getElementById('setWizardCreate').textContent = 'Dodaj zestaw';
      document.getElementById('setWizardTitle').textContent = 'Zestaw';
      document.getElementById('setWizardDesc').textContent = 'Wybierz standardowy układ. Program doda kilka korpusów oraz fronty.';
    }

    const hasPreset = !!cabinetModalState.setPreset;
    renderSetParamsUI(cabinetModalState.setPreset);
    document.getElementById('setParams').style.display = hasPreset ? 'grid' : 'none';

    const frontBlock = document.getElementById('setFrontBlock');
    frontBlock.style.display = hasPreset ? 'block' : 'none';

    if(hasPreset){
      const cntSel = document.getElementById('setFrontCount');
      const matSel = document.getElementById('setFrontMaterial');
      const colSel = document.getElementById('setFrontColor');

      if(!cntSel.value) cntSel.value = '2';
      if(!matSel.value) matSel.value = 'laminat';
      populateFrontColorsTo(colSel, matSel.value, colSel.value || '');

      matSel.onchange = () => { populateFrontColorsTo(colSel, matSel.value, ''); };

      const hint = document.getElementById('setFrontHint');
      const updateHint = () => {
        const c = Number(cntSel.value || 1);
        if(c === 1){
          hint.textContent = 'Powstanie 1 front (na całą szerokość zestawu) o wysokości sumy segmentów.';
        } else {
          hint.textContent = 'Powstaną 2 fronty. Dla zestawu A: lewy/prawy. Dla pionów: po 1/2 szerokości każdy.';
        }
      };
      cntSel.onchange = updateHint;
      updateHint();
    }

    return;
  }

  if(!cabinetModalState.chosen) return;

  formArea.style.display = 'block';

  if(saveTopBtn){
    saveTopBtn.style.display = 'inline-flex';
    saveTopBtn.disabled = false;
  }

  // pokazujemy Zatwierdź w nagłówku dopiero gdy jest formularz
  if(saveTopBtn){
    saveTopBtn.style.display = 'inline-flex';
    saveTopBtn.disabled = false;
  }

  const draft = cabinetModalState.draft;
  const room = uiState.roomType;

  // Rodzaj z kafelka
  draft.type = cabinetModalState.chosen;

  const cmSubType = document.getElementById('cmSubType');
  populateSelect(cmSubType, getSubTypeOptionsForType(draft.type), draft.subType);

  renderCabinetExtraDetailsInto(document.getElementById('cmExtraDetails'), draft);

  document.getElementById('cmWidth').value = draft.width;
  document.getElementById('cmHeight').value = draft.height;
  document.getElementById('cmDepth').value = draft.depth;

  document.getElementById('cmFrontMaterial').value = draft.frontMaterial || 'laminat';
  document.getElementById('cmBackMaterial').value = draft.backMaterial || 'HDF 3mm biała';

  populateFrontColorsTo(document.getElementById('cmFrontColor'), draft.frontMaterial || 'laminat', draft.frontColor || '');
  populateBodyColorsTo(document.getElementById('cmBodyColor'), draft.bodyColor || '');
  populateOpeningOptionsTo(document.getElementById('cmOpeningSystem'), draft.type, draft.openingSystem || 'uchwyt klienta');

  // FRONT COUNT UI
  const fcSel = document.getElementById('cmFrontCount');
  const fcStatic = document.getElementById('cmFrontCountStatic');
  const fcHint = document.getElementById('cmFrontCountHint');
  const fcWrap = document.getElementById('cmFrontCountWrap');
  const shelvesWrap = document.getElementById('cmShelvesWrap');
  const shelvesInput = document.getElementById('cmShelves');

const flapWrap = document.getElementById('cmFlapWrap');
const flapVendorSel = document.getElementById('cmFlapVendor');
const flapKindWrap = document.getElementById('cmFlapKindWrap');
const flapKindSel = document.getElementById('cmFlapKind');
const flapInfo = document.getElementById('cmFlapInfo');
const flapFrontInfo = document.getElementById('cmFlapFrontInfo');

const isFlapDraft = ((draft.type === 'wisząca' || draft.type === 'moduł') && draft.subType === 'uchylne');

const BLUM_KINDS = [
  { v:'HKI', t:'HKI – zintegrowany' },
  { v:'HF_top', t:'HF top – składany (2 fronty)' },
  { v:'HS_top', t:'HS top – uchylno‑nachodzący' },
  { v:'HL_top', t:'HL top – podnoszony ponad korpus' },
  { v:'HK_top', t:'HK top – uchylny' },
  { v:'HK-S', t:'HK‑S – mały uchylny' },
  { v:'HK-XS', t:'HK‑XS – mały uchylny (z zawiasami)' }
];
const HAFELE_KINDS = [
  { v:'DUO', t:'Rozwórka nożycowa DUO.' }
];

function syncFlapUI(){
  // UI dla klap (uchylne) tylko dla: wisząca + uchylne
  if(!isFlapDraft){
    if(flapWrap) flapWrap.style.display = 'none';
    return;
  }
  if(flapWrap) flapWrap.style.display = 'block';

  const d = FC.utils.isPlainObject(draft.details) ? draft.details : {};
  let vendor = String(d.flapVendor || 'blum');
  if(!['blum','gtv','hafele'].includes(vendor)) vendor = 'blum';
  d.flapVendor = vendor;

  // vendor select
  if(flapVendorSel){
    flapVendorSel.value = vendor;
    flapVendorSel.onchange = () => {
      const dv = FC.utils.isPlainObject(draft.details) ? draft.details : {};
      const v = String(flapVendorSel.value || 'blum');
      dv.flapVendor = (['blum','gtv','hafele'].includes(v) ? v : 'blum');

      // domyślne rodzaje po zmianie firmy
      if(dv.flapVendor === 'hafele') dv.flapKind = 'DUO';
      else if(dv.flapVendor === 'gtv') dv.flapKind = '';
      else dv.flapKind = 'HKI';

      draft.details = dv;
      ensureFrontCountRules(draft);
      renderCabinetModal();
    };
  }

  // vendor specific UI
  if(vendor === 'gtv'){
    if(flapKindWrap) flapKindWrap.style.display = 'none';
    if(flapInfo){
      flapInfo.style.display = 'block';
      flapInfo.textContent = 'GTV – w budowie.';
    }
    draft.details = d;
    ensureFrontCountRules(draft);
    return;
  }

  if(flapInfo) flapInfo.style.display = 'none';
  if(flapKindWrap) flapKindWrap.style.display = 'block';

  const kindOptions = (vendor === 'hafele') ? HAFELE_KINDS : BLUM_KINDS;
  const defaultKind = (vendor === 'hafele') ? 'DUO' : 'HKI';
  const selectedKind = String(d.flapKind || defaultKind);
  d.flapKind = selectedKind;

  if(flapKindSel){
    populateSelect(flapKindSel, kindOptions, selectedKind);
    flapKindSel.onchange = () => {
      const dv = FC.utils.isPlainObject(draft.details) ? draft.details : {};
      dv.flapKind = String(flapKindSel.value || defaultKind);
      draft.details = dv;
      ensureFrontCountRules(draft);
      renderCabinetModal();
    };
  }

  draft.details = d;
  ensureFrontCountRules(draft);
}

  // Podblatowa (wisząca dolna): pozwól na brak frontów oraz rozróżnij drzwi vs szuflady
  const isPodblatowaDraft = (draft.type === 'wisząca' && draft.subType === 'dolna_podblatowa');
  const fcLabelEl = document.getElementById('cmFrontCountLabel');
  const setFcOptions = (arr) => {
    fcSel.innerHTML = arr.map(n => `<option value="${n}">${n}</option>`).join('');
  };

  if(isPodblatowaDraft){
    const d = draft.details || {};
    // domyślne wartości + kompatybilność wstecz
    if(!d.podFrontMode){
      if(d.subTypeOption === 'szuflada_1'){ d.podFrontMode = 'szuflady'; draft.frontCount = 1; }
      else if(d.subTypeOption === 'szuflada_2'){ d.podFrontMode = 'szuflady'; draft.frontCount = 2; }
      else d.podFrontMode = (Number(draft.frontCount) === 0 ? 'brak' : 'drzwi');
      draft.details = Object.assign({}, d, { podFrontMode: d.podFrontMode });
    }
    if(fcLabelEl){
      fcLabelEl.textContent = (d.podFrontMode === 'szuflady') ? 'Ilość szuflad' : 'Ilość frontów';
    }
    if(d.podFrontMode === 'brak'){
      setFcOptions([0]);
      draft.frontCount = 0;
      fcSel.disabled = true;
      if(fcHint) fcHint.textContent = 'Otwarta szafka (bez frontów).';
    } else {
      setFcOptions([1,2]);
      if(![1,2].includes(Number(draft.frontCount))) draft.frontCount = 2;
      fcSel.disabled = false;
      if(fcHint) fcHint.textContent = (d.podFrontMode === 'szuflady') ? 'Ilość szuflad = ilość frontów szuflad.' : 'Ilość drzwi/frontów.';
    }
  } else {
    // standardowe opcje: 1 lub 2 fronty
    if(fcLabelEl) fcLabelEl.textContent = 'Ilość frontów';
    setFcOptions([1,2]);
  }

  ensureFrontCountRules(draft);
  syncFlapUI();

  // Domyślnie pokazuj select, a statyczne info ukrywaj (wyjątek: klapy)
  if(fcSel) fcSel.style.display = '';
  if(fcStatic){
    fcStatic.style.display = 'none';
    fcStatic.textContent = '';
  }

  // czy pokazujemy wybór 1/2?
  const canPick = cabinetAllowsFrontCount(draft);
  const fixedOne = (draft.type === 'stojąca' && (draft.subType === 'zmywarkowa' || draft.subType === 'piekarnikowa' || (draft.subType === 'rogowa_slepa' && (draft.details?.cornerOption||'polki') === 'magic_corner'))) || (draft.type === 'stojąca' && draft.subType === 'zlewowa' && (draft.details?.sinkFront||'drzwi') === 'szuflada');
  const isFridge = (draft.type === 'stojąca' && draft.subType === 'lodowkowa');

  // lodówkowa w zabudowie — zamiast frontCount używamy details.fridgeFrontCount (1/2)
  const isCornerL = (draft.subType === 'narozna_l');

  if(isFridge){
    // frontCount select ukrywamy (bo fronty lodówki wybiera się w szczegółach lodówki)
    if(fcWrap) fcWrap.style.display = 'none';
    fcHint.style.display = 'none';
    if(shelvesWrap) shelvesWrap.style.display = 'none';
  } else if(isCornerL){
    // narożna L: zawsze 2 fronty, zamiast wyboru frontów pokazujemy ilość półek
    draft.frontCount = 2;

    if(fcWrap) fcWrap.style.display = 'none';
    fcHint.style.display = 'none';

    if(shelvesWrap){
      shelvesWrap.style.display = 'block';
      const d = FC.utils.isPlainObject(draft.details) ? draft.details : {};
      const sh = (d.shelves == null ? 2 : Number(d.shelves));
      draft.details = Object.assign({}, d, { shelves: Math.max(0, Math.round(Number.isFinite(sh) ? sh : 0)) });

      if(shelvesInput){
        shelvesInput.value = String(draft.details.shelves);
        const onShelvesChange = () => {
          const v = Math.max(0, Math.round(Number(shelvesInput.value) || 0));
          draft.details = Object.assign({}, draft.details || {}, { shelves: v });
          shelvesInput.value = String(v);
        };
        shelvesInput.oninput = onShelvesChange;
        shelvesInput.onchange = onShelvesChange;
      }
    }
  } else if(isFlapDraft){
    // Klapa: ilość frontów jest automatyczna (1 lub 2 zależnie od rodzaju)
    // Półki: użytkownik może wpisać (do wyceny i rozrysu)
    if(shelvesWrap) shelvesWrap.style.display = 'block';
    if(!draft.details) draft.details = {};
    if(draft.details.shelves === undefined || draft.details.shelves === null) draft.details.shelves = 0;
    if(shelvesInput){
      shelvesInput.value = String(Math.max(0, Math.round(Number(draft.details.shelves) || 0)));
      const onShelvesChange = () => {
        const v = Math.max(0, Math.round(Number(shelvesInput.value) || 0));
        draft.details = Object.assign({}, draft.details || {}, { shelves: v });
        shelvesInput.value = String(v);
      };
      shelvesInput.oninput = onShelvesChange;
      shelvesInput.onchange = onShelvesChange;
    }


    const fcAuto = getFlapFrontCount(draft);
    // dla klap ilość frontów jest automatyczna i pokazujemy ją pod wyborem podnośnika
    if(fcWrap) fcWrap.style.display = 'none';
    if(fcSel){
      fcSel.style.display = 'none';
      fcSel.innerHTML = `<option value="${fcAuto}">${fcAuto}</option>`;
      fcSel.value = String(fcAuto);
      fcSel.disabled = true;
    }
    if(fcStatic) fcStatic.style.display = 'none';
    if(fcHint) fcHint.style.display = 'none';
    if(flapFrontInfo){
      flapFrontInfo.style.display = 'inline-block';
      flapFrontInfo.textContent = `Ilość frontów: ${fcAuto}` + ((fcAuto === 2) ? ' (HF top)' : '');
    }
  } else if(!canPick){
    if(fcWrap) fcWrap.style.display = 'none';
    fcHint.style.display = 'none';
    if(shelvesWrap) shelvesWrap.style.display = 'none';
  } else if(fixedOne){
    if(fcWrap) fcWrap.style.display = 'block';
    if(shelvesWrap) shelvesWrap.style.display = 'none';

    fcSel.value = '1';
    fcSel.disabled = true;
    fcHint.style.display = 'block';
    fcHint.textContent = 'Dla tej szafki ilość frontów jest stała: 1.';
  } else {
    if(fcWrap) fcWrap.style.display = 'block';
    if(shelvesWrap) shelvesWrap.style.display = 'none';

    const podBrak = (isPodblatowaDraft && draft.details && draft.details.podFrontMode === 'brak');
    fcSel.disabled = podBrak ? true : false;
    const fcVal = (draft.frontCount === 0 ? 0 : (draft.frontCount || 2));
    fcSel.value = String(fcVal);
    if(podBrak){
      fcHint.style.display = 'block';
      fcHint.textContent = 'Otwarta szafka (bez frontów).';
    } else {
      fcHint.style.display = 'none';
    }
  }

  cmSubType.onchange = () => {
    applySubTypeRules(room, draft, cmSubType.value);
ensureFrontCountRules(draft);

// Moduł → Uchylna: wymuś tryb klapy i wyczyść ewentualne dane po szufladach
if(draft.type === 'moduł' && cmSubType.value === 'uchylne'){
  draft.subType = 'uchylne';
  draft.details = FC.utils.isPlainObject(draft.details) ? draft.details : {};
  // fronty dla klapy wynikają z rodzaju podnośnika (HF top = 2)
  draft.frontCount = getFlapFrontCount(draft);
}

// zmywarkowa: szerokość szafki = szerokość zmywarki + przegrody techniczne dla wysokich frontów
if(draft.type === 'stojąca' && draft.subType === 'zmywarkowa'){
  const leg = Number(projectData[room]?.settings?.legHeight) || 0;
  const dw = (draft.details && draft.details.dishWasherWidth) ? draft.details.dishWasherWidth : (String(draft.width || '60'));
  draft.details = Object.assign({}, draft.details || {}, { dishWasherWidth: dw });
  draft.width = Number(dw) || 60;

  const frontH = (Number(draft.height) || 0) - leg;
  // Przegroda techniczna: 74.6–76.5 => 1; 76.6–78.5 => 2; itd.
  const div = (frontH > 74.5) ? Math.max(0, Math.ceil(((frontH - 74.5) / 2) - 1e-9)) : 0;
  draft.details = Object.assign({}, draft.details, { techDividerCount: String(div) });
}

    renderCabinetModal();
  };

  fcSel.onchange = () => {
    draft.frontCount = Number(fcSel.value || 2);
  };

  document.getElementById('cmWidth').onchange = e => { draft.width = parseFloat(e.target.value || 0); };

  // Live re-check dla uchylnych: po zmianie wysokości od razu przelicz LF i sprawdź zakresy
  const _liveAventosCheck = () => {
    try{
      const room = uiState.roomType;
      syncDraftFromCabinetModalForm(draft);
      ensureFrontCountRules(draft);

      // Walidacja szuflad systemowych (GTV/Rejs – w budowie -> blokada zapisu)
      const _drawerBlockMsg = (function(){
        const dd = draft.details || {};
        const checkSystem = (sys, brand, ctx) => {
          if(String(sys||'') !== 'systemowe') return null;
          const b = String(brand||'blum');
          if(b !== 'blum') return `Szuflady ${ctx}: ${b.toUpperCase()} – w budowie. Nie można zatwierdzić.`;
          return null;
        };
        // główna szuflada (szufladowa / moduł / zlewowa front / piekarnikowa)
        let m = checkSystem(dd.drawerSystem, dd.drawerBrand, 'frontowe');
        if(m) return m;
        // zlewowa: szuflada wewnętrzna
        m = checkSystem(dd.sinkInnerDrawerType, dd.sinkInnerDrawerBrand, 'wewnętrzne (zlewowa)');
        if(m) return m;
        return null;
      })();
      if(_drawerBlockMsg){ alert(_drawerBlockMsg); return; }
      applyAventosValidationUI(room, draft);
    }catch(_e){ /* nie psuj modala */ }
  };
  const _cmHeightEl = document.getElementById('cmHeight');
  if(_cmHeightEl){
    _cmHeightEl.oninput = _liveAventosCheck;
    _cmHeightEl.onchange = _liveAventosCheck;
  }

  const _cmWidthEl = document.getElementById('cmWidth');
  if(_cmWidthEl){
    _cmWidthEl.oninput = _liveAventosCheck;
    _cmWidthEl.onchange = _liveAventosCheck;
  }
  const _cmDepthEl = document.getElementById('cmDepth');
  if(_cmDepthEl){
    _cmDepthEl.oninput = _liveAventosCheck;
    _cmDepthEl.onchange = _liveAventosCheck;
  }

  document.getElementById('cmFrontMaterial').onchange = e => {
    draft.frontMaterial = e.target.value;
    const first = materials.find(m => m.materialType === draft.frontMaterial);
    draft.frontColor = first ? first.name : '';
    renderCabinetModal();
  };
  document.getElementById('cmFrontColor').onchange = e => { draft.frontColor = e.target.value; };
  document.getElementById('cmBackMaterial').onchange = e => { draft.backMaterial = e.target.value; };
  document.getElementById('cmBodyColor').onchange = e => { draft.bodyColor = e.target.value; };
  document.getElementById('cmOpeningSystem').onchange = e => { draft.openingSystem = e.target.value; };

  const _cabCancel = document.getElementById('cabinetModalCancel');
  if(_cabCancel) _cabCancel.onclick = closeCabinetModal;
  document.getElementById('cabinetModalSave').onclick = (e) => {
    // twarde zabezpieczenie: żadnego "przebicia" kliknięcia do innych handlerów
    if(e){ e.preventDefault(); e.stopPropagation(); }

    // Tryb zestawu: Zatwierdź działa jak "Dodaj zestaw / Zapisz zmiany"
    const _setArea = document.getElementById('setWizardArea');
    const inSetMode = (cabinetModalState && cabinetModalState.chosen === 'zestaw') ||
                      (cabinetModalState && cabinetModalState.setEditId) ||
                      (_setArea && _setArea.style.display === 'block');
    if(inSetMode){
      try{
        createOrUpdateSetFromWizard();
      } catch(err){
        console.error(err);
        alert('Błąd zapisu zestawu: ' + (err && (err.message || err) ? (err.message || err) : 'nieznany błąd'));
      }
      return;
    }
    try{
      if(!uiState.roomType){ alert('Wybierz pomieszczenie'); return; }
      const room = uiState.roomType;

      syncDraftFromCabinetModalForm(draft);
      ensureFrontCountRules(draft);

      // Walidacja podnośników (AVENTOS) na etapie zapisu – jeśli poza zakresem, nie dodawaj/nie zapisuj
      const _av = validateAventosForDraft(room, draft);
      if(_av && _av.ok === false){
        applyAventosValidationUI(room, draft);
        return;
      }

      const beforeCount = (projectData[room].cabinets || []).length;

      const isAdd = (cabinetModalState.mode === 'add' || !cabinetModalState.editingId);
      if(isAdd){
        const newCab = FC.utils.clone(draft);
        newCab.id = FC.utils.uid();
        projectData[room].cabinets.push(newCab);
        uiState.expanded = {};
        // domyślnie zwinięte
        
        uiState.selectedCabinetId = newCab.id;

        // generuj fronty jeśli trzeba (lodówkowa też)
        generateFrontsForCabinet(room, newCab);
      } else {
        const id = cabinetModalState.editingId;
        projectData[room].cabinets = projectData[room].cabinets.map(c => c.id === id ? Object.assign({}, FC.utils.clone(draft), { id }) : c);

        const updated = projectData[room].cabinets.find(c => c.id === id);
        if(updated) generateFrontsForCabinet(room, updated);
      }

      projectData = FC.project.save(projectData);
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);

      // najpierw odśwież widok — jeśli coś się wysypie, modal ma zostać otwarty
      renderCabinets();

      const afterCount = (projectData[room].cabinets || []).length;
      if(isAdd && afterCount <= beforeCount){
        alert('Nie udało się dodać szafki (błąd logiki zapisu).');
        return;
      }

      closeCabinetModal();
    }catch(err){
      console.error('Błąd zapisu szafki:', err);
      alert('Błąd podczas zapisu (sprawdź konsolę). Modal pozostaje otwarty.');
    }
  };

  // Walidacja klapy (AVENTOS) – blokuj zapis jeśli poza zakresem
  applyAventosValidationUI(room, draft);
}

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

function renderTotals(container, totals){
  container.innerHTML = '';
  const rows = totalsToRows(totals);
  if(!rows.length){
    const em = document.createElement('div');
    em.className = 'muted xs';
    em.textContent = '—';
    container.appendChild(em);
    return;
  }
  rows.forEach(r => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.gap = '10px';
    row.style.padding = '2px 0';

    const left = document.createElement('div');
    left.className = 'muted xs';
    left.style.fontWeight = '900';
    left.textContent = r.material;

    const right = document.createElement('div');
    right.className = 'muted xs';
    right.style.fontWeight = '900';
    right.textContent = `${formatM2(r.m2)} m²`;

    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  });
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



function renderMaterialsTab(listEl, room){
  const cabinets = projectData[room].cabinets || [];

  // Suma projektu
  const projectTotals = {};
  cabinets.forEach(cab => {
    const parts = getCabinetCutList(cab, room);
    mergeTotals(projectTotals, totalsFromParts(parts));
  });

  const top = document.createElement('div');
  top.className = 'card';
  top.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <h3 style="margin:0">Materiały — rozpiska mebli</h3>
</div>
    <p class="muted" style="margin:6px 0 0">
      Poniżej jest rozpisany każdy dodany mebel (korpus). Wymiary są liczone "na czysto" z założeniem płyty 18&nbsp;mm.
      Nie uwzględnia to oklein, wpustów pod plecy ani luzów technologicznych.
    </p>

    <div class="hr"></div>
    <div class="muted xs" style="line-height:1.55">
      <div><strong>Zasady skręcania:</strong></div>
      <div>• Wiszące: wieniec górny i dolny między boki.</div>
      <div>• Modułowe: jak wiszące.</div>
      <div>• Stojące: wieniec dolny pod boki (boki niższe o ${FC_BOARD_THICKNESS_CM} cm); trawersy górne: głębokość ${FC_TOP_TRAVERSE_DEPTH_CM} cm.</div>
    </div>

    <div class="hr"></div>
    <div>
      <div class="muted xs" style="font-weight:900; margin-bottom:6px">Suma m² materiałów — cały projekt</div>
      <div id="projectMatTotals"></div>
      <div class="muted xs" style="margin-top:8px;line-height:1.45">
        <div><strong>Założenia do obliczeń zawiasów/podnośników (waga frontów):</strong></div>
        <div>• Laminat 18&nbsp;mm: <span id="wLam"></span> kg/m²</div>
        <div>• Akryl (MDF 18&nbsp;mm): <span id="wAkr"></span> kg/m²</div>
        <div>• Lakier (MDF 18&nbsp;mm): <span id="wLak"></span> kg/m²</div>
        <div>• Uchwyt (zawiasy): ${FC_HANDLE_WEIGHT_KG} kg / front; (podnośniki klap): ${FC_HANDLE_WEIGHT_KG*2} kg / klapa</div>
        <div style="font-size:12px;color:#5b6b7c;margin-top:6px">Uchwyty doliczane tylko gdy wybrany system z uchwytem (TIP-ON/podchwyt = 0 kg).</div>
      </div>
    </div>
  `;
  listEl.appendChild(top);

  // wypełnij sumy projektu
  const projTotalsEl = top.querySelector('#projectMatTotals');
  if(projTotalsEl) renderTotals(projTotalsEl, projectTotals);

  // wagi założone (kg/m²) — do informacji na górze
  const wLamEl = top.querySelector('#wLam');
  const wAkrEl = top.querySelector('#wAkr');
  const wLakEl = top.querySelector('#wLak');
  if(wLamEl) wLamEl.textContent = String(FC_FRONT_WEIGHT_KG_M2.laminat);
  if(wAkrEl) wAkrEl.textContent = String(FC_FRONT_WEIGHT_KG_M2.akryl);
  if(wLakEl) wLakEl.textContent = String(FC_FRONT_WEIGHT_KG_M2.lakier);


  if(!cabinets.length){
    const empty = document.createElement('div');
    empty.className = 'build-card';
    empty.innerHTML = '<h3>Brak mebli</h3><p class="muted">Dodaj szafki, żeby pojawiła się rozpiska materiałów.</p>';
    listEl.appendChild(empty);
    return;
  }

  cabinets.forEach((cab, idx) => {
    const card = document.createElement('div');
    card.className = 'card';

    card.id = `mat-${cab.id}`;

    const badge = cab.setId && typeof cab.setNumber === 'number'
      ? `<span class="badge">Zestaw ${cab.setNumber}</span>`
      : '';

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.alignItems = 'baseline';
    head.style.gap = '12px';
    head.innerHTML = `
      <div>
        <div style="font-weight:900">#${idx+1} • ${cab.type || ''} • ${cab.subType || ''} ${badge}</div>
        <div class="muted xs">${cab.width} × ${cab.height} × ${cab.depth} • korpus: ${cab.bodyColor || ''} • plecy: ${cab.backMaterial || ''}</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap">
        <div class="muted xs" style="white-space:nowrap">${getCabinetAssemblyRuleText(cab)}</div>
        <button class="btn" type="button" data-act="editCab" data-cab="${cab.id}">Edytuj</button>
        <button class="btn" type="button" data-act="jumpCab" data-cab="${cab.id}">← Szafka</button>
      </div>
    `;
    card.appendChild(head);

    const isOpen = String(uiState.matExpandedId || '') === String(cab.id);
    if(isOpen) card.classList.add('selected');

    head.style.cursor = 'pointer';
    head.addEventListener('click', (e) => {
      if(e && e.target && e.target.closest && e.target.closest('button')) return;
      const nowOpen = String(uiState.matExpandedId || '') === String(cab.id);
      uiState.matExpandedId = nowOpen ? null : String(cab.id);
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      renderCabinets();
    });

    const _editCabBtn = head.querySelector('[data-act="editCab"]');
    if(_editCabBtn){
      _editCabBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        openCabinetModalForEdit(_editCabBtn.getAttribute('data-cab'));
      });
    }

    const _jumpCabBtn = head.querySelector('[data-act=\"jumpCab\"]');
    if(_jumpCabBtn){
      _jumpCabBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        jumpToCabinetFromMaterials(_jumpCabBtn.getAttribute('data-cab'));
      });
    }

    if(!isOpen){
      const collapsedHint = document.createElement('div');
      collapsedHint.className = 'muted xs';
      collapsedHint.style.marginTop = '10px';
      collapsedHint.textContent = 'Kliknij nagłówek, aby rozwinąć rozpis materiałów tej szafki.';
      card.appendChild(collapsedHint);
      listEl.appendChild(card);
      return;
    }

    const parts = getCabinetCutList(cab, room);

    // SUMA m² dla szafki
    const cabTotalsBox = document.createElement('div');
    cabTotalsBox.style.marginTop = '10px';
    cabTotalsBox.style.paddingTop = '10px';
    cabTotalsBox.style.borderTop = '1px solid #eef6fb';
    cabTotalsBox.innerHTML = `<div class="muted xs" style="font-weight:900; margin-bottom:6px">Suma m² materiałów — ta szafka</div>`;
    const cabTotalsEl = document.createElement('div');
    cabTotalsBox.appendChild(cabTotalsEl);
    card.appendChild(cabTotalsBox);
    renderTotals(cabTotalsEl, totalsFromParts(parts));

    const table = document.createElement('div');
    table.style.marginTop = '12px';
    table.style.border = '1px solid #eef6fb';
    table.style.borderRadius = '12px';
    table.style.overflow = 'hidden';

    const tHead = document.createElement('div');
    tHead.className = 'front-row';
    tHead.style.background = '#f8fbff';
    tHead.innerHTML = `
      <div style="font-weight:900">Element</div>
      <div class="front-meta">Ilość</div>
      <div class="front-meta">Wymiar (cm)</div>
      <div class="front-meta">Materiał</div>
    `;
    tHead.style.display = 'grid';
    tHead.style.gridTemplateColumns = '1.4fr 0.4fr 0.7fr 1fr';
    tHead.style.gap = '10px';
    table.appendChild(tHead);

    
parts.forEach(p => {
      const row = document.createElement('div');
      row.className = 'front-row';
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '1.4fr 0.4fr 0.7fr 1fr';
      row.style.gap = '10px';

      if(p.tone === 'red'){
        row.style.background = '#ffe1e1';
        row.style.borderLeft = '6px solid #d33';
      }else if(p.tone === 'orange'){
        row.style.background = '#fff0d6';
        row.style.borderLeft = '6px solid #f0a000';
      }

      row.innerHTML = `
        <div style="font-weight:900">${p.name}</div>
        <div style="font-weight:900">${p.qty}</div>
        <div style="font-weight:900">${p.dims}</div>
        <div class="front-meta">${p.material || ''}</div>
      `;
      table.appendChild(row);
    });

    card.appendChild(table);

    // najpierw dodaj kartę (żeby nawet przy błędzie w rysunku nie zniknęły materiały)
    listEl.appendChild(card);
  });
}


/* ===== Render UI: cabinets (NO inline editing) ===== */
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
  // zakładki
  if(uiState.activeTab === 'material'){
    renderMaterialsTab(list, room);
    return;
  }
  if(uiState.activeTab === 'rysunek'){
    renderDrawingTab(list, room);
    return;
  }

  if(uiState.activeTab !== 'wywiad'){
    const buildCard = document.createElement('div');
    buildCard.className='build-card';
    buildCard.innerHTML = '<h3>Strona w budowie</h3><p class="muted">Sekcja jest w trakcie przygotowania.</p>';
    list.appendChild(buildCard);
    return;
  }

  // grupowanie: zestawy renderujemy jako blok: korpusy + fronty zestawu pod spodem
  const cabinets = projectData[room].cabinets || [];
  const renderedSets = new Set();

  cabinets.forEach((cab, idx) => {
    // jeśli element zestawu i nie renderowaliśmy jeszcze zestawu -> render cały zestaw blokiem
    if(cab.setId && !renderedSets.has(cab.setId)){
      const setId = cab.setId;
      renderedSets.add(setId);
      const setNumber = cab.setNumber;

      // wszystkie korpusy zestawu w kolejności jak w tablicy
      const setCabs = cabinets.filter(c => c.setId === setId);
      setCabs.forEach((sc, jdx) => {
        renderSingleCabinetCard(list, room, sc, idx + jdx + 1);
      });
      return;
    }

    // jeśli to element zestawu, ale zestaw już wyrenderowany — pomijamy
    if(cab.setId && renderedSets.has(cab.setId)) return;

    // normalna szafka
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
  left.innerHTML = (() => {
    const base = `<div style="font-weight:900">#${displayIndex} • ${cab.type} • ${cab.subType||''}${badge}</div>
                    <div class="muted xs">${cab.frontMaterial || ''} • ${cab.frontColor || ''}</div>`;
    return base;
  })();

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

  // actions: edit/delete per-cabinet
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

  header.addEventListener('click', (e) => {
    if(e.target && e.target.closest && e.target.closest('button')) return;

    if(uiState.activeTab === 'wywiad'){
      uiState.selectedCabinetId = (uiState.selectedCabinetId === cab.id) ? null : cab.id;
    }
    toggleExpandAll(cab.id);
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    renderCabinets();
  });

  actions.querySelector('[data-act="edit"]').addEventListener('click', (e) => {
    e.stopPropagation();
    openCabinetModalForEdit(cab.id);
  });

  

    const _matBtn = actions.querySelector('[data-act="mat"]');
  if(_matBtn){
    _matBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      jumpToMaterialsForCabinet(cab.id);
    });
  }

  actions.querySelector('[data-act=\"del\"]').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteCabinetById(cab.id);
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

    // FRONTY (wewnątrz tej samej szafki / zestawu — zwijają się razem)
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

  list.appendChild(cabEl);
}

/* ===== Price modal render ===== */
function renderPriceModal(){
  const modal = document.getElementById('priceModal'); const type = uiState.showPriceList;
  if(!type){ modal.style.display = 'none'; return; }
  modal.style.display = 'flex';
  const isMat = type === 'materials';
  document.getElementById('priceModalTitle').textContent = isMat ? 'Cennik Materiałów' : 'Cennik Usług';
  document.getElementById('priceModalSubtitle').textContent = isMat ? 'Dodaj/edytuj materiały' : 'Dodaj/edytuj usługi';
  document.getElementById('priceModalIcon').textContent = isMat ? '🧩' : '🔧';
  document.getElementById('materialFormFields').style.display = isMat ? 'block' : 'none';
  document.getElementById('serviceFormFields').style.display = isMat ? 'none' : 'block';
  document.getElementById('editingIndicator').style.display = uiState.editingId ? 'inline-block' : 'none';

  const formMaterialType = document.getElementById('formMaterialType'); formMaterialType.innerHTML = '';
  ['laminat','akryl','lakier','blat','akcesoria'].forEach(t => { const o=document.createElement('option'); o.value=t; o.textContent=t; formMaterialType.appendChild(o); });
  const formManufacturer = document.getElementById('formManufacturer');
  function populateManufacturersFor(typeVal){ formManufacturer.innerHTML=''; (MANUFACTURERS[typeVal]||[]).forEach(m=>{const o=document.createElement('option'); o.value=m; o.textContent=m; formManufacturer.appendChild(o)}); }
  populateManufacturersFor(formMaterialType.value);
  formMaterialType.onchange = () => populateManufacturersFor(formMaterialType.value);

  if(uiState.editingId){
    if(isMat){
      const item = materials.find(m => m.id === uiState.editingId);
      if(item){
        formMaterialType.value = item.materialType || 'laminat';
        populateManufacturersFor(formMaterialType.value);
        document.getElementById('formManufacturer').value = item.manufacturer || '';
        document.getElementById('formSymbol').value = item.symbol || '';
        document.getElementById('formName').value = item.name || '';
        document.getElementById('formPrice').value = item.price || '';
      }
    } else {
      const item = services.find(s => s.id === uiState.editingId);
      if(item){
        document.getElementById('formCategory').value = item.category || 'Montaż';
        document.getElementById('formServiceName').value = item.name || '';
        document.getElementById('formServicePrice').value = item.price || '';
      }
    }
    document.getElementById('cancelEditBtn').style.display = isMat ? 'inline-block' : 'none';
    document.getElementById('cancelServiceEditBtn').style.display = isMat ? 'none' : 'inline-block';
  } else {
    formMaterialType.value = 'laminat'; populateManufacturersFor('laminat');
    document.getElementById('formSymbol').value = '';
    document.getElementById('formName').value = '';
    document.getElementById('formPrice').value = '';
    document.getElementById('formCategory').value = 'Montaż';
    document.getElementById('formServiceName').value = '';
    document.getElementById('formServicePrice').value = '';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('cancelServiceEditBtn').style.display = 'none';
  }

  const q = document.getElementById('priceSearch').value.trim().toLowerCase();
  const list = isMat ? materials : services;
  const filtered = list.filter(item => {
    const name = (item.name||'').toLowerCase(); const symbol=(item.symbol||'').toLowerCase(); const manu=(item.manufacturer||'').toLowerCase();
    const mt=(item.materialType||'').toLowerCase(); const cat=(item.category||'').toLowerCase();
    return name.includes(q) || symbol.includes(q) || manu.includes(q) || mt.includes(q) || cat.includes(q);
  });

  const container = document.getElementById('priceListItems'); container.innerHTML = '';
  filtered.forEach(item => {
    const row = document.createElement('div'); row.className='list-item';
    const left = document.createElement('div');
    left.innerHTML = `<div style="font-weight:900">${item.name}</div><div class="muted-tag xs">${isMat ? (item.materialType + ' • ' + (item.manufacturer||'') + (item.symbol ? ' • SYM: '+item.symbol : '')) : (item.category || '')}</div>`;
    const right = document.createElement('div'); right.style.display='flex'; right.style.gap='8px'; right.style.alignItems='center';
    const price = document.createElement('div'); price.style.fontWeight='900'; price.textContent = (Number(item.price)||0).toFixed(2) + ' PLN';
    const editBtn = document.createElement('button'); editBtn.className='btn'; editBtn.textContent='Edytuj';
    const delBtn = document.createElement('button'); delBtn.className='btn-danger'; delBtn.textContent='Usuń';
    right.appendChild(price); right.appendChild(editBtn); right.appendChild(delBtn);
    row.appendChild(left); row.appendChild(right); container.appendChild(row);

    editBtn.addEventListener('click', () => { uiState.editingId = item.id; FC.storage.setJSON(STORAGE_KEYS.ui, uiState); renderPriceModal(); });
    delBtn.addEventListener('click', () => deletePriceItem(item));
  });

  document.getElementById('savePriceBtn').onclick = saveMaterialFromForm;
  document.getElementById('saveServiceBtn').onclick = saveServiceFromForm;
  document.getElementById('cancelEditBtn').onclick = () => { uiState.editingId = null; FC.storage.setJSON(STORAGE_KEYS.ui, uiState); renderPriceModal(); };
  document.getElementById('cancelServiceEditBtn').onclick = () => { uiState.editingId = null; FC.storage.setJSON(STORAGE_KEYS.ui, uiState); renderPriceModal(); };
}


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
function initApp(){
  // Fail fast if HTML is missing required elements
  validateRequiredDOM();
  return initUI();
}

function initUI(){
  // Delegated clicks (robust against DOM re-renders / new buttons)
  if(!window.__FC_DELEGATION__){
    window.__FC_DELEGATION__ = true;

    let __fcSuppressNextClick = false;
    const __fcActionLocks = (window.__fcActionLocks ||= Object.create(null));

    const __fcHandle = (e) => {
      const t = e.target;
      if(!t || !t.closest) return;

      let handled = false;

      // Click on modal overlay closes it (prevents click-through bugs)
      if(t.id === 'priceModal'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); try{ closePriceModal(); }catch(_){ } return true; }
      if(t.id === 'cabinetModal'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); try{ closeCabinetModal(); }catch(_){ } return true; }

      // ==== CLOSE buttons (highest priority) ====
      // ==== Actions via data-action (single source of truth) ====
      const actEl = t.closest('[data-action]');
      const action = actEl ? actEl.getAttribute('data-action') : null;

      // CLOSES (highest priority)
      if(action === 'close-price'){
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        try{ closePriceModal(); }catch(_){ }
        handled = true;
        return handled;
      }
      if(action === 'close-cabinet'){
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        try{ closeCabinetModal(); }catch(_){ }
        handled = true;
        return handled;
      }

      // ==== Cabinet modal cancel / wizard cancel ====

      if(action === 'cancel-cabinet'){
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        try{ closeCabinetModal(); }catch(_){}
        handled = true;
        return handled;
      }

      // ==== Cabinet wizard create ====
      if(action === 'create-set'){
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        try{ createOrUpdateSetFromWizard(); }catch(_){}
        handled = true;
        return handled;
      }

      // ==== Price list open ====
      if(action === 'open-materials'){
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        uiState.showPriceList='materials';
        FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
        renderPriceModal();
        document.getElementById('priceModal').style.display='flex';
        lockModalScroll();
        handled = true;
        return handled;
      }
      if(action === 'open-services'){
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        uiState.showPriceList='services';
        FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
        renderPriceModal();
        document.getElementById('priceModal').style.display='flex';
        lockModalScroll();
        handled = true;
        return handled;
      }


      // ==== Floating add (+) ====
      const plus = (action === 'add-cabinet') ? actEl : null;
      if(plus){
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if(__fcActionLocks['add-cabinet']){ handled = true; return handled; }
        __fcActionLocks['add-cabinet'] = true;
        setTimeout(()=>{ __fcActionLocks['add-cabinet'] = false; }, 0);
        // IMPORTANT: mark as handled even when we show an alert.
        // Otherwise on mobile the synthetic click after pointerup will re-fire the same action.
        if(!uiState.roomType){
          handled = true;
          alert('Wybierz pomieszczenie najpierw');
          return handled;
        }
        openCabinetModalForAdd();
        handled = true;
        return handled;
      }

      

      // ==== Back to rooms (home) ====
      if(action === 'back-rooms'){
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        uiState.roomType = null;
        uiState.selectedCabinetId = null;
        FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
        document.getElementById('roomsView').style.display='block';
        document.getElementById('appView').style.display='none';
        document.getElementById('topTabs').style.display = 'none';
        handled = true;
        return handled;
      }

      // ==== New project ====
      if(action === 'new-project'){
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if(!confirm('Utworzyć NOWY projekt? Wszystkie pomieszczenia zostaną wyczyszczone.')){
          handled = true;
          return handled;
        }
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
        handled = true;
        return handled;
      }
// ==== Room tile ====
      const roomEl = t.closest('[data-action="open-room"][data-room], .room-btn[data-room]');
      if(roomEl){
        uiState.roomType = roomEl.getAttribute('data-room');
        FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
        document.getElementById('roomsView').style.display='none';
        document.getElementById('appView').style.display='block';
        document.getElementById('topTabs').style.display = 'inline-block';
        uiState.activeTab = 'wywiad'; FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
        document.querySelectorAll('.tab-btn').forEach(tbtn => tbtn.style.background = (tbtn.getAttribute('data-tab') === uiState.activeTab) ? '#e6f7ff' : 'var(--card)');
        renderCabinets();
        handled = true;
        return handled;
      }

      // ==== Tab button ====
      const tabEl = t.closest('[data-action="tab"][data-tab], .tab-btn[data-tab]');
      if(tabEl){
        setActiveTab(tabEl.getAttribute('data-tab'));
        handled = true;
        return handled;
      }
    };

    // Mobile-safe: handle pointerup, ignore the synthetic click right after
    document.addEventListener('pointerup', (e) => {
      const handled = !!__fcHandle(e);
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

  // ESC closes the top-most modal
  if(!window.__FC_ESC__){
    window.__FC_ESC__ = true;
    document.addEventListener('keydown', (ev)=>{
      if(ev.key !== 'Escape') return;
      const pm = document.getElementById('priceModal');
      const cm = document.getElementById('cabinetModal');
      const pmOpen = pm && pm.style.display && pm.style.display !== 'none';
      const cmOpen = cm && cm.style.display && cm.style.display !== 'none';
      if(pmOpen){ try{ closePriceModal(); }catch(_){ } ev.preventDefault(); }
      else if(cmOpen){ try{ closeCabinetModal(); }catch(_){ } ev.preventDefault(); }
    }, {capture:true});
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
  if(uiState.showPriceList && !window.__FORCE_HOME__){ renderPriceModal(); document.getElementById('priceModal').style.display = 'flex'; }
  // once initialized, allow normal persistence for next navigation
  try{ window.__FORCE_HOME__ = false; }catch(e){}
  try{ window.__APP_INIT_DONE__ = true; }catch(e){}
}

/* ===== Set wizard minimal (reuse existing from previous version) ===== */
function renderCabinetTypeChoicesPlaceholder(){}



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

function renderFinishList(container, room){
  const seg = getActiveSegment(room);
  const finishes = (projectData[room].finishes||[]).filter(f=>f.segmentId===seg.id);
  const wrap = document.createElement('div');
  wrap.className='finish-list';
  if(finishes.length===0){
    const empty = document.createElement('div');
    empty.className='muted xs';
    empty.textContent = 'Brak dodanych wykończeń w tym segmencie.';
    wrap.appendChild(empty);
  } else {
    finishes.forEach(f=>{
      const item = document.createElement('div');
      item.className='finish-item';
      const meta = document.createElement('div');
      meta.className='meta';
      const b = document.createElement('b'); b.textContent = finishLabel(f);
      const p = document.createElement('p'); p.className='muted xs'; p.style.margin='0';
      let extra = [];
      if(f.type==='panel'){
        const cabId = f.cabinetId || null;
        const c = cabId ? getCabById(room, cabId) : null;
        const fbH = (f.row==='base') ? (Math.max(40, Number(s.bottomHeight)||90) - Math.max(0, Number(s.legHeight)||0)) : (f.row==='wall') ? defaultWallH : defaultModuleH;
        const korpusH = c ? (Number(c.height)||fbH) : fbH;

        // GŁĘBOKOŚĆ panelu: wg zasad
        const cabDepth = c && c.depth!=null ? Number(c.depth)||0 : (f.row==='wall' ? 32 : 59.2);
        const isModuleLikeWall = (f.row==='module') && (cabDepth <= 40); // moduły płytkie traktujemy jak górne
        let depth = 0;

        if(f.row==='wall' || isModuleLikeWall){
          depth = cabDepth + 2.2; // górne: +2,2cm
        } else {
          // dolne (i moduły głębokie): jeśli <=57 -> 59,2; jeśli >57 -> depth + 2,5
          depth = (cabDepth > 57) ? (cabDepth + 2.5) : 59.2;
        }

        // WYSOKOŚĆ panelu: korpus + cokół/blenda zależnie od rzędu
        let height = korpusH;
        if(f.row==='wall') height += Math.max(0, Number(s.ceilingBlende)||0);
        if(f.row==='base') height += Math.max(0, Number(s.legHeight)||0);
        // moduły: bez dodatków wysokości

        extra.push(`wymiar: ${depth.toFixed(1)}×${height.toFixed(1)}cm (gł.×wys.)`);
        if(f.width!=null) extra.push(`gr.: ${Number(f.width).toFixed(1)}cm`);
      } else if(f.type==='blenda_pion'){
        extra.push(`Szafka: ${f.cabinetId || '-'}`);
        if(f.width != null) extra.push(`szer.: ${f.width}cm`);
      }
            if(f.type==='blenda_pion_full' || f.type==='panel_pion_full'){
        const wcm = Number(f.width)||2;
        const topRow = f.topRow || 'wall';
        const bottomRow = f.bottomRow || 'base';
        const order = ['wall','module','base'];
        const i0 = Math.min(order.indexOf(topRow), order.indexOf(bottomRow));
        const i1 = Math.max(order.indexOf(topRow), order.indexOf(bottomRow));
        const segRows = (Array.isArray(f.rows) && f.rows.length) ? f.rows : order.slice(i0, i1+1);

        let hcm = 0;
        for(const rk of segRows){ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); }
        // dodatki wysokości wg zasad: jeśli w zakresie jest górna -> + blenda; jeśli dolna -> + cokół
        if(segRows.includes('wall')) hcm += Math.max(0, Number(s.ceilingBlende)||0);
        if(segRows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);

        if(f.type==='blenda_pion_full'){
          extra.push(`wymiar: ${wcm.toFixed(1)}×${hcm.toFixed(1)}cm (szer.×wys.)`);
        } else {
          // PANEL pełny: głębokość wg zasad (bazujemy na najgłębszej szafce w kolumnie)
          const x0 = Math.min(Number(f.x0cm)||0, Number(f.x1cm)||0);
          const x1 = Math.max(Number(f.x0cm)||0, Number(f.x1cm)||0);
          let maxDepth = 0;
          for(const rk of segRows){
            const pos = computeXPositionsCm(room, seg, rk);
            for(const pp of pos){
              if(!pp || !pp.el || pp.el.kind!=='cabinet') continue;
              if(pp.x1<=x0 || pp.x0>=x1) continue;
              const cab = getCabById(room, pp.el.id);
              if(!cab) continue;
              const d = (cab.depth!=null) ? Number(cab.depth)||0 : (rk==='wall'?32:59.2);
              maxDepth = Math.max(maxDepth, d);
            }
          }
          const depth = (maxDepth > 57) ? (maxDepth + 2.5) : 59.2;
          extra.push(`wymiar: ${depth.toFixed(1)}×${hcm.toFixed(1)}cm (gł.×wys.)`);
          if(f.width!=null) extra.push(`gr.: ${Number(f.width).toFixed(1)}cm`);
        }
        extra.push((f.side||'R')==='L' ? 'lewa' : 'prawa');
      }

            if(f.type==='blenda_pion_full' || f.type==='panel_pion_full'){
        const x0cm = Number(f.x0cm)||0;
        const x1cm = Number(f.x1cm)||0;
        const wcm = Number(f.width)||2;
        const side = f.side || 'R';
        const x0 = PAD_L + x0cm*SCALE;
        const x1 = PAD_L + x1cm*SCALE;
        const w = Math.max(8, wcm*SCALE);
        const x = (side==='L') ? (x0 - w) : x1;

        const topRow = f.topRow || 'wall';
        const bottomRow = f.bottomRow || 'base';
        const order = ['wall','module','base'];
        const i0 = Math.min(order.indexOf(topRow), order.indexOf(bottomRow));
        const i1 = Math.max(order.indexOf(topRow), order.indexOf(bottomRow));
        const segRows = (Array.isArray(f.rows) && f.rows.length) ? f.rows : order.slice(i0, i1+1);

        // y start = górna krawędź topRow, y end = dolna krawędź bottomRow
        if(rowY[topRow]==null || rowY[bottomRow]==null) return;

        let topY = rowY[topRow] + LABEL_H;
        let bottomY = rowY[bottomRow] + LABEL_H;
        const botHcm = (bottomRow==='wall'?wallH:(bottomRow==='module'?moduleH:baseH));
        bottomY += botHcm*SCALE;

        // dodatki: jeśli w zakresie jest wall -> blenda; jeśli base -> cokół
        if(segRows.includes('wall')) topY -= Math.max(0, Number(s.ceilingBlende)||0)*SCALE;
        if(segRows.includes('base')) bottomY += Math.max(0, Number(s.legHeight)||0)*SCALE;

        const y = Math.min(topY, bottomY);
        const h = Math.max(10, Math.abs(bottomY - topY));

        const rr = document.createElementNS(svgNS,'rect');
        rr.setAttribute('x', x);
        rr.setAttribute('y', y);
        rr.setAttribute('width', w);
        rr.setAttribute('height', h);
        rr.setAttribute('rx', 10); rr.setAttribute('ry', 10);

        if(f.type==='blenda_pion_full'){
          rr.setAttribute('fill', 'rgba(14,165,233,0.18)');
          rr.setAttribute('stroke', 'rgba(14,165,233,0.85)');
          rr.setAttribute('stroke-width', '3');
        } else {
          rr.setAttribute('fill', 'rgba(148,163,184,0.22)');
          rr.setAttribute('stroke', 'rgba(100,116,139,0.9)');
          rr.setAttribute('stroke-width', '3');
        }
        finG.appendChild(rr);
      }

      if(f.type==='cokol' || f.type==='blenda_gorna'){
        const x0 = (f.x0cm!=null) ? Number(f.x0cm) : null;
        const x1 = (f.x1cm!=null) ? Number(f.x1cm) : null;
        if(x0!=null && x1!=null){
          extra.push(`dł.: ${((f.lengthCm!=null)?Number(f.lengthCm):Math.abs(x1-x0)).toFixed(1)}cm`);
        } else if(f.startIndex!=null && f.endIndex!=null){
          extra.push(`Zakres: ${f.startIndex+1}→${f.endIndex+1}`);
        }
        if(f.height != null) extra.push(`wys.: ${f.height}cm`);
      }
      p.textContent = extra.join(' • ');
      meta.appendChild(b); meta.appendChild(p);

      const btns = document.createElement('div');
      const del = document.createElement('button');
      del.className='btn-danger';
      del.textContent='Usuń';
      del.onclick = ()=>{ if(confirm('Usunąć to wykończenie?')){ removeFinish(room, f.id); renderCabinets(); } };
      btns.appendChild(del);

      item.appendChild(meta);
      item.appendChild(btns);
      wrap.appendChild(item);
    });
  }
  container.appendChild(wrap);
}

function renderDrawingTab(list, room){
  ensureLayout(room);
  const pd = projectData[room];
  const seg = getActiveSegment(room);

  // ephemeral UI state
  if(!uiState.drawing){
    uiState.drawing = {
      selected: null,        // {row, index}
      zoom: 6,            // px per cm (skalowanie rysunku)
      rangeStart: null,
      hRange: null,          // {row, x0cm, x1cm}
      vRange: null,          // {x0cm,x1cm, topRow, bottomRow, rows}
      drag: null             // internal
    };
  }
  const st = uiState.drawing;

  list.innerHTML = '';

  const outer = document.createElement('div');
  outer.className = 'drawing-wrap';

  // toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'drawing-toolbar';
  toolbar.innerHTML = `
    <div class="group">
      <span class="pill">Rysunek 2D (drag & drop)</span>
      <span class="muted xs">Przeciągnij kafelki aby zmienić kolejność. Kliknij, aby dodać panel/blendę/przerwę. Shift+klik zaznacza zakres (cokół / blenda górna).</span>
    </div>
    
    <div class="group" style="margin-left:auto">
      <span class="muted xs" style="margin-right:6px">Zoom:</span>
      <button id="zoomOut" class="btn" title="Pomniejsz">−</button>
      <input id="zoomSlider" type="range" min="1" max="16" step="1" style="width:140px" />
      <button id="zoomIn" class="btn" title="Powiększ">+</button>
      <span id="zoomVal" class="pill" style="min-width:64px;text-align:center">10px/cm</span>
      <button id="drawRebuild" class="btn">↻ Odbuduj z listy szafek</button>
          </div>

  `;
  outer.appendChild(toolbar);

  // layout: stage + inspector
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = '1fr';
  grid.style.gap = '12px';

  const stage = document.createElement('div');
  stage.className = 'drawing-stage';
  stage.style.position = 'relative';
  stage.style.overflowX = 'auto';
  stage.style.overflowY = 'hidden';
  stage.style.webkitOverflowScrolling = 'touch';

  const svgHost = document.createElement('div');
  svgHost.id = 'svgHost';
  stage.appendChild(svgHost);

  const inspector = document.createElement('div');
  inspector.className = 'card';
  inspector.style.margin = '0';
  inspector.style.maxWidth = '520px';
  inspector.style.justifySelf='center';
  inspector.innerHTML = `
    <h3 class="section-title" style="margin:0 0 10px 0">Inspektor</h3>
    <div id="insBody" class="muted xs">Kliknij kafelek (szafkę lub przerwę).</div>
    <div class="hr"></div>
    <h3 class="section-title" style="margin:0 0 10px 0">Wykończenia (segment)</h3>
    <div id="finList"></div>
  `;

  grid.appendChild(stage);
  grid.appendChild(inspector);
  outer.appendChild(grid);
  list.appendChild(outer);

  // toolbar actions
  toolbar.querySelector('#drawRebuild').onclick = ()=>{
    if(!confirm('Odbudować układ segmentu z aktualnej listy szafek? (Uwaga: usuwa PRZERWY w układzie, NIE usuwa wykończeń)')) return;
    seg.rows.base = [];
    seg.rows.module = [];
    seg.rows.wall = [];
    (pd.cabinets||[]).forEach(c=>{
      const row = (c.type === 'wisząca') ? 'wall' : (c.type === 'moduł' ? 'module' : 'base');
      seg.rows[row].push({ kind:'cabinet', id:c.id });
    });
    st.selected = null;
    st.rangeStart = null;
    st.hRange = null;
    st.vRange = null;
    saveProject();
    renderCabinets();
  };
  // zoom controls
  const zoomSlider = toolbar.querySelector('#zoomSlider');
  const zoomVal = toolbar.querySelector('#zoomVal');
  const zoomOut = toolbar.querySelector('#zoomOut');
  const zoomIn = toolbar.querySelector('#zoomIn');
  zoomSlider.value = String(Math.max(1, Math.min(16, Number(st.zoom)||10)));
  zoomVal.textContent = `${zoomSlider.value}px/cm`;

  function setZoom(val){
    st.zoom = Math.max(1, Math.min(16, Number(val)||10));
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    renderCabinets(); // prze-renderuje rysunek z nową skalą
  }
  zoomSlider.addEventListener('input', ()=>{ zoomVal.textContent = `${zoomSlider.value}px/cm`; });
  zoomSlider.addEventListener('change', ()=> setZoom(zoomSlider.value));
  zoomOut.addEventListener('click', ()=> setZoom((Number(st.zoom)||10) - 1));
  zoomIn.addEventListener('click', ()=> setZoom((Number(st.zoom)||10) + 1));


  // helpers
  const s = pd.settings || {};
  const autoTopHeight = Math.max(0,
    (Number(s.roomHeight)||0)
    - (Number(s.bottomHeight)||0)
    - (Number(s.legHeight)||0) // w Twoim UI bottomHeight jest "z nogami", ale zostawiamy to symbolicznie
    - (Number(s.counterThickness)||0)
    - (Number(s.gapHeight)||0)
    - (Number(s.ceilingBlende)||0)
  );
  const defaultBaseH = Math.max(40, Number(s.bottomHeight)||90);
const defaultWallH = Math.max(40, autoTopHeight || 70);
const defaultModuleH = 60;

function cabHeightCm(el, fallback){
  if(!el || el.kind!=='cabinet') return fallback;
  const c = getCabById(room, el.id);
  const h = c ? Number(c.height)||0 : 0;
  return (h>0) ? h : fallback;
}
function maxRowHeightCm(rowKey, fallback){
  const arr = seg.rows[rowKey] || [];
  let mx = fallback;
  arr.forEach(el=>{
    if(el.kind==='cabinet'){
      const h = cabHeightCm(el, fallback);
      if(h>mx) mx=h;
    }
  });
  return Math.max(40, mx);
}
function elHeightCm(rowKey, el){
  const fb = (rowKey==='base') ? defaultBaseH : (rowKey==='wall') ? defaultWallH : defaultModuleH;
  if(!el) return fb;
  if(el.kind==='gap') return fb;
  return cabHeightCm(el, fb);
}

const baseH = maxRowHeightCm('base', defaultBaseH);
const wallH = maxRowHeightCm('wall', defaultWallH);
const moduleH = maxRowHeightCm('module', defaultModuleH);

// rysunek w proporcji: 1cm = SCALE px (w pionie i poziomie)
  const SCALE = Math.max(1, Math.min(16, Number(st.zoom)||10)); // px/cm (skalowanie rysunku)
  const PAD_L = 20, PAD_T = 18, PAD_R = 20, PAD_B = 18;
  const ROW_GAP = 0;
  const LABEL_H = 0; 

  const rows = [
    { key:'wall', label:'GÓRNE', hCm: wallH },
    { key:'module', label:'MODUŁY', hCm: moduleH },
    { key:'base', label:'DOLNE', hCm: baseH }
  ];

  function elWidthCm(rowKey, el){
    if(el.kind==='gap') return Number(el.width)||0;
    const c = getCabById(room, el.id);
    return c ? Number(c.width)||0 : 0;
  }
  function elLabel(rowKey, el){
    if(el.kind==='gap') return `PRZERWA ${Number(el.width)||0}cm`;
    const c = getCabById(room, el.id);
    if(!c) return `SZAFKA`;
    const t = (c.subType || c.type || 'szafka');
    return `${t} ${Number(c.width)||0}cm`;
  }

  function computePositions(rowKey){
    const arr = seg.rows[rowKey] || [];
    let x = Number(seg.offsets?.[rowKey]||0);
    const pos = [];
    for(let i=0;i<arr.length;i++){
      const w = elWidthCm(rowKey, arr[i]);
      pos.push({ index:i, el:arr[i], x0:x, x1:x+w, w });
      x += w;
    }
    return pos;
  }

  const totals = rows.map(r=>{
    const pos = computePositions(r.key);
    const last = pos[pos.length-1];
    return (last ? last.x1 : 0) + Number(seg.offsets?.[r.key]||0);
  });
  const totalCm = Math.max(60, ...totals);

  // SVG sizing
  const contentW = totalCm*SCALE;
  const contentH = rows.reduce((acc,r)=>acc + (r.hCm*SCALE) + LABEL_H, 0) + ROW_GAP*(rows.length-1);
  const vbW = PAD_L + contentW + PAD_R;
  const vbH = PAD_T + contentH + PAD_B;

  // extra left space so left-side finishes (e.g., left blend/panel) are visible
  const finishesAll = (projectData[room].finishes||[]).filter(f=>f.segmentId===seg.id);
  const maxLeftCm = finishesAll.reduce((m,f)=>{
    if((f.side==='L') && (f.type==='panel' || f.type==='blenda_pion' || f.type==='blenda_pion_full')){
      return Math.max(m, Number(f.width)||0);
    }
    return m;
  }, 0);
  const EXTRA_L = Math.max(0, Math.round(maxLeftCm*SCALE + 40));

  // widen viewport to include left overhang
  const vbW2 = vbW + EXTRA_L;


  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox', `${-EXTRA_L} 0 ${vbW2} ${vbH}`);
  svg.setAttribute('preserveAspectRatio','xMinYMin meet');
  svg.style.width = `${vbW2}px`;
  svg.style.height = `${vbH}px`;
  svg.style.display = 'block';

  // defs (subtle grid)
  const defs = document.createElementNS(svgNS,'defs');
  defs.innerHTML = `
    <pattern id="gridSmall" width="${SCALE*10}" height="${SCALE*10}" patternUnits="userSpaceOnUse">
      <path d="M ${SCALE*10} 0 L 0 0 0 ${SCALE*10}" fill="none" stroke="#eef2f7" stroke-width="1"/>
    </pattern>
  `;
  svg.appendChild(defs);
  const bg = document.createElementNS(svgNS,'rect');
  bg.setAttribute('x', -EXTRA_L); bg.setAttribute('y', 0);
  bg.setAttribute('width', vbW2); bg.setAttribute('height', vbH);
  bg.setAttribute('fill', 'url(#gridSmall)');
  bg.setAttribute('rx', 12); bg.setAttribute('ry', 12);
  bg.style.opacity = '0.7';
  svg.appendChild(bg);

  function mkText(x,y,txt,cls){
    const t = document.createElementNS(svgNS,'text');
    t.setAttribute('x',x); t.setAttribute('y',y);
    t.setAttribute('class', cls||'svg-label');
    t.textContent = txt;
    svg.appendChild(t);
    return t;
  }
  function mkRect(x,y,w,h,cls,attrs){
    const r = document.createElementNS(svgNS,'rect');
    r.setAttribute('x',x); r.setAttribute('y',y);
    r.setAttribute('width',w); r.setAttribute('height',h);
    r.setAttribute('rx',10); r.setAttribute('ry',10);
    r.setAttribute('class', cls);
    if(attrs){ Object.keys(attrs).forEach(k=>r.setAttribute(k, attrs[k])); }
    svg.appendChild(r);
    return r;
  }
  function mkGroup(attrs){
    const g = document.createElementNS(svgNS,'g');
    if(attrs){ Object.keys(attrs).forEach(k=>g.setAttribute(k, attrs[k])); }
    svg.appendChild(g);
    return g;
  }

  // range highlight (non-interactive)
  const rangeG = document.createElementNS(svgNS,'g');
  rangeG.style.pointerEvents = 'none';

  // finishes overlay (non-interactive)
  const finG = document.createElementNS(svgNS,'g');
  finG.style.pointerEvents = 'none';

  // interactive elements group
  const elG = document.createElementNS(svgNS,'g');
  svg.appendChild(elG);
  svg.appendChild(finG);
  svg.appendChild(rangeG);

  

  // Ensure overlays (range highlight + finishes) render ABOVE cabinets.
  // (Appending moves existing nodes to the end of SVG children list.)
  svg.appendChild(rangeG);
  svg.appendChild(finG);
// row y mapping (anchor countertop/reference line at default base height; taller base can extend upward)
  const rowY = {};
  // floorY = bottom of BASE row when base height == defaultBaseH
  // NOTE: keep module zone anchored; do NOT shift floorY based on tallest wall cabinet.
  const wallRefH = Number((pd.settings||{}).wallRefH)||60;
  let floorY = PAD_T
    + (LABEL_H + wallRefH*SCALE + ROW_GAP)
    + (LABEL_H + moduleH*SCALE + ROW_GAP)
    + (LABEL_H + defaultBaseH*SCALE);

  // Place BASE so its bottom stays at floorY
  rowY['base'] = floorY - (LABEL_H + baseH*SCALE);
  // Countertop/reference line is based on the ROOM default base height (not the tallest base cabinet)
  const counterY = floorY - (LABEL_H + defaultBaseH*SCALE);
  // Place MODULE so its bottom sits on the countertop/reference line
  rowY['module'] = counterY - (ROW_GAP + LABEL_H + moduleH*SCALE);
// Stack WALL above MODULE
  rowY['wall'] = rowY['module'] - (ROW_GAP + LABEL_H + wallH*SCALE);

  // If anything would go above the top padding, shift everything down
  const minY = Math.min(rowY['wall'], rowY['module'], rowY['base']);
  if(minY < PAD_T){
    const shift = PAD_T - minY;
    rowY['base'] += shift;
    rowY['module'] += shift;
    rowY['wall'] += shift;
    floorY += shift;
  }

  // Render rows
  function renderAll(){
    // clear groups
    while(elG.firstChild) elG.removeChild(elG.firstChild);
    while(rangeG.firstChild) rangeG.removeChild(rangeG.firstChild);
    while(finG.firstChild) finG.removeChild(finG.firstChild);
    // (row labels hidden)
    // range highlight
    if(st.hRange && st.hRange.row){
      const row = st.hRange.row;
      const x0cm = Number(st.hRange.x0cm)||0;
      const x1cm = Number(st.hRange.x1cm)||0;
      const x0 = PAD_L + Math.min(x0cm,x1cm)*SCALE;
      const x1 = PAD_L + Math.max(x0cm,x1cm)*SCALE;
      const hcm = (row==='wall'?wallH:(row==='module'?moduleH:baseH));
      const y = rowY[row] + LABEL_H - 6;
      const h = hcm*SCALE + 12;
      const rr = document.createElementNS(svgNS,'rect');
      rr.setAttribute('x', x0);
      rr.setAttribute('y', y);
      rr.setAttribute('width', Math.max(8, x1-x0));
      rr.setAttribute('height', h);
      rr.setAttribute('rx', 14); rr.setAttribute('ry', 14);
      rr.setAttribute('class','svg-range');
      rangeG.appendChild(rr);
    }
// vertical range highlight (od dołu do góry)
if(st.vRange && st.vRange.x1cm > st.vRange.x0cm){
  const x0 = PAD_L + st.vRange.x0cm*SCALE;
  const x1 = PAD_L + st.vRange.x1cm*SCALE;
  const topRow = st.vRange.topRow || 'wall';
  const bottomRow = st.vRange.bottomRow || 'base';
  const y0 = rowY[topRow] + LABEL_H - 6;
  const y1 = rowY[bottomRow] + LABEL_H + ((rows.find(rr=>rr.key===bottomRow)?.hCm)||60)*SCALE + 6;
  const rr = document.createElementNS(svgNS,'rect');
  rr.setAttribute('x', x0);
  rr.setAttribute('y', Math.min(y0,y1));
  rr.setAttribute('width', Math.max(8, x1-x0));
  rr.setAttribute('height', Math.max(10, Math.abs(y1-y0)));
  rr.setAttribute('rx', 14); rr.setAttribute('ry', 14);
  rr.setAttribute('fill', 'rgba(14,165,233,0.08)');
  rr.setAttribute('stroke', 'rgba(14,165,233,0.65)');
  rr.setAttribute('stroke-width', '2');
  rangeG.appendChild(rr);
}
    // elements
    const drawOrder = (projectData[room].layout && Array.isArray(projectData[room].layout.zOrderRows)) ? projectData[room].layout.zOrderRows : ['base','module','wall'];
    drawOrder.forEach(rowKey=>{
      const r = rows.find(rr=>rr.key===rowKey);
      if(!r) return;
      const row = r.key;
      const pos = computePositions(row);
      pos.forEach(p=>{
        const x = PAD_L + p.x0*SCALE;
        const elHcm = elHeightCm(row, p.el);
        let y = rowY[row] + LABEL_H;
        if(row!=='wall') y += Math.max(0, (r.hCm - elHcm))*SCALE;
        const w = Math.max(24, p.w*SCALE);
        const h = Math.max(10, elHcm*SCALE);
        const g = document.createElementNS(svgNS,'g');
        g.setAttribute('data-row', row);
        g.setAttribute('data-index', String(p.index));
        g.setAttribute('data-kind', p.el.kind);
        g.setAttribute('data-id', p.el.id || '');
        g.style.cursor = 'grab';

        const isSel = st.selected && st.selected.row===row && st.selected.index===p.index;
        const rect = document.createElementNS(svgNS,'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('rx', 12); rect.setAttribute('ry', 12);
        rect.setAttribute('fill', p.el.kind==='gap' ? '#fff' : '#eaf6ff');
        rect.setAttribute('stroke', isSel ? '#0ea5e9' : (p.el.kind==='gap' ? '#94a3b8' : '#8fd3ff'));
        rect.setAttribute('stroke-width', isSel ? '3' : '2');
        if(p.el.kind==='gap'){
          rect.setAttribute('stroke-dasharray', '6 4');
        }

        g.appendChild(rect);

        // drag handle (mobile)
        if(p.el.kind!=='gap'){
          const grip = document.createElementNS(svgNS,'rect');
          grip.setAttribute('x', x + w - 20);
          grip.setAttribute('y', y + 6);
          grip.setAttribute('width', 14);
          grip.setAttribute('height', 14);
          grip.setAttribute('rx', 3); grip.setAttribute('ry', 3);
          grip.setAttribute('fill', '#0ea5e9');
          grip.setAttribute('data-grip','1');
          grip.style.cursor = 'grab';
          grip.style.touchAction = 'none';
          g.appendChild(grip);

          const gripTxt = document.createElementNS(svgNS,'text');
          gripTxt.setAttribute('x', x + w - 17);
          gripTxt.setAttribute('y', y + 17);
          gripTxt.setAttribute('fill', '#fff');
          gripTxt.setAttribute('font-size','12');
          gripTxt.setAttribute('font-weight','900');
          gripTxt.setAttribute('pointer-events','none');
          gripTxt.textContent = '≡';
          g.appendChild(gripTxt);
        }

        const text = document.createElementNS(svgNS,'text');
        text.setAttribute('x', x + 8);
        text.setAttribute('y', y + 18);
        text.setAttribute('class', 'svg-label');
        text.textContent = elLabel(row, p.el);

        g.appendChild(text);
        elG.appendChild(g);

        // pointer handlers for drag & click
        g.addEventListener('pointerdown', (ev)=>{
          const isGrip = (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-grip')==='1');
          const isMouse = (ev.pointerType === 'mouse');
          const isTouch = !isMouse;
          // Drag only from grip on touch; mouse can drag from anywhere
          if(!isGrip && !isMouse){
            return;
          }

          try{ ev.preventDefault(); }catch(_){}
          g.setPointerCapture(ev.pointerId);
          st.drag = {
            pointerId: ev.pointerId,
            row,
            startIndex: p.index,
            startClientX: ev.clientX,
            moved: false,
            startPxX: x,
            gEl: g
          };
          g.style.cursor = 'grabbing';
        });

        g.addEventListener('pointermove', (ev)=>{
          // cancel long-press if user moves finger
          if(st._lp && st._lp.pointerId === ev.pointerId && !st._lp.fired){
            const dx0 = ev.clientX - st._lp.startX;
            const dy0 = ev.clientY - st._lp.startY;
            if(Math.abs(dx0) > 6 || Math.abs(dy0) > 6){
              clearTimeout(st._lp.timer);
              st._lp = null;
            }
          }

          if(!st.drag || st.drag.pointerId !== ev.pointerId) return;
          const dx = ev.clientX - st.drag.startClientX;
          if(Math.abs(dx) > 4) st.drag.moved = true;
          // translate group visually
          g.setAttribute('transform', `translate(${dx},0)`);
        });

        g.addEventListener('pointerup', (ev)=>{
          // clear long-press timer (if any)
          if(st._lp && st._lp.pointerId === ev.pointerId){
            const fired = st._lp.fired;
            clearTimeout(st._lp.timer);
            st._lp = null;
            // if long-press fired, do not also treat this as a click
            if(fired) return;
          }

          // TAP without drag context (common on mobile because we only start drag from the grip)
          if(!st.drag || st.drag.pointerId !== ev.pointerId){
            // prevent accidental "tap after drag" triggering click
            if(st._justDragged && (Date.now() - st._justDragged) < 220) return;
            handleClick(row, p.index, ev.shiftKey);
            return;
          }

          const drag = st.drag;
          g.releasePointerCapture(ev.pointerId);
          g.style.cursor = 'grab';
          const dx = ev.clientX - drag.startClientX;
          g.removeAttribute('transform');
          st.drag = null;
          st._justDragged = drag.moved ? Date.now() : 0;

          if(!drag.moved){
            handleClick(row, p.index, ev.shiftKey);
            return;
          }

          // commit reorder
          commitReorder(row, drag.startIndex, dx);
        });

        g.addEventListener('pointercancel', ()=>{
          if(st._lp){
            try{ clearTimeout(st._lp.timer); }catch(_){}
            st._lp = null;
          }
          if(st.drag && st.drag.gEl === g){
            g.removeAttribute('transform');
            g.style.cursor='grab';
            st.drag = null;
          }
        });

        // Fallback click handler (some Android viewers are flaky with pointerup on SVG)
        g.addEventListener('click', (ev)=>{
          if(st._justDragged && (Date.now() - st._justDragged) < 250) return;
          handleClick(row, p.index, !!ev.shiftKey);
        });

        // Touch fallback for drag & drop on mobile (when PointerEvents are not delivered properly)
        let _touchActive = false;
        g.addEventListener('touchstart', (ev)=>{
          const t = ev.touches && ev.touches[0];
          if(!t) return;
          const isGrip = (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-grip')==='1');
          if(!isGrip) return; // drag only from grip to keep horizontal scroll usable
          _touchActive = true;
          try{ ev.preventDefault(); }catch(_){}
          st.drag = {
            pointerId: 'touch',
            row,
            startIndex: p.index,
            startClientX: t.clientX,
            moved: false,
            startPxX: x,
            gEl: g
          };
          g.style.cursor = 'grabbing';
        }, {passive:false});

        g.addEventListener('touchmove', (ev)=>{
          if(!_touchActive || !st.drag || st.drag.pointerId !== 'touch' || st.drag.gEl !== g) return;
          const t = ev.touches && ev.touches[0];
          if(!t) return;
          try{ ev.preventDefault(); }catch(_){}
          const dx = t.clientX - st.drag.startClientX;
          if(Math.abs(dx) > 4) st.drag.moved = true;
          g.setAttribute('transform', `translate(${dx},0)`);
        }, {passive:false});

        function _touchEnd(ev){
          if(!_touchActive) return;
          _touchActive = false;
          if(!st.drag || st.drag.pointerId !== 'touch' || st.drag.gEl !== g) return;
          try{ ev.preventDefault(); }catch(_){}
          const drag = st.drag;
          const t = (ev.changedTouches && ev.changedTouches[0]) || null;
          const clientX = t ? t.clientX : drag.startClientX;
          const dx = clientX - drag.startClientX;
          g.removeAttribute('transform');
          g.style.cursor = 'grab';
          st.drag = null;
          st._justDragged = drag.moved ? Date.now() : 0;

          if(!drag.moved){
            handleClick(row, p.index, false);
            return;
          }
          commitReorder(row, drag.startIndex, dx);
        }
        g.addEventListener('touchend', _touchEnd, {passive:false});
        g.addEventListener('touchcancel', _touchEnd, {passive:false});
      });
    });


    // gap marks overlay (X) — keep gaps visible even if covered by another row
    rows.forEach(rr=>{
      const row = rr.key;
      const pos = computePositions(row);
      pos.forEach(p=>{
        if(p.el.kind!=='gap') return;
        const x = PAD_L + p.x0*SCALE;
        const elHcm = elHeightCm(row, p.el);
        let y = rowY[row] + LABEL_H;
        if(row!=='wall') y += Math.max(0, (rr.hCm - elHcm))*SCALE;
        const w = Math.max(24, p.w*SCALE);
        const h = Math.max(10, elHcm*SCALE);
        const inset = 8;
        const x0 = x + inset, x1 = x + w - inset;
        const y0 = y + inset, y1 = y + h - inset;

        const l1 = document.createElementNS(svgNS,'line');
        l1.setAttribute('x1', x0); l1.setAttribute('y1', y0);
        l1.setAttribute('x2', x1); l1.setAttribute('y2', y1);
        l1.setAttribute('stroke', '#94a3b8');
        l1.setAttribute('stroke-width', '2');
        finG.appendChild(l1);

        const l2 = document.createElementNS(svgNS,'line');
        l2.setAttribute('x1', x0); l2.setAttribute('y1', y1);
        l2.setAttribute('x2', x1); l2.setAttribute('y2', y0);
        l2.setAttribute('stroke', '#94a3b8');
        l2.setAttribute('stroke-width', '2');
        finG.appendChild(l2);
      });
    });

    // finishes overlays (after elements so they appear on top, but non-interactive)
    const finishes = (pd.finishes||[]).filter(f=>f.segmentId===seg.id);
    finishes.forEach(f=>{
      if(f.type==='panel' || f.type==='blenda_pion'){
        const row = f.row;
        const idx = f.index;
        const pos = computePositions(row);
        const p = pos[idx];
        if(!p) return;
        const baseX0 = PAD_L + p.x0*SCALE;
        const baseX1 = PAD_L + p.x1*SCALE;
        const rowCfg = rows.find(rr=>rr.key===row);
        const elHcm = elHeightCm(row, p.el);
        let y = rowY[row] + LABEL_H;
        if(row!=='wall') y += Math.max(0, (((rowCfg?.hCm||elHcm) - elHcm)))*SCALE;

        // Panele boczne: wydłuż o cokół (dolne) lub blendę górną (górne)
        const s = (pd.settings || {});
        let addHcm = 0;
        if(f.type==='panel'){
          if(row==='base') addHcm = Number(s.legHeight)||0;
          if(row==='wall') addHcm = Number(s.ceilingBlende)||0;
        }

        // dla górnych panel wydłużamy do góry (odejmujemy od y)
        if(f.type==='panel' && row==='wall' && addHcm>0){
          y = Math.max(0, y - addHcm*SCALE);
        }

        const h = Math.max(10, (elHcm + (addHcm||0))*SCALE);
        const w = Math.max(8, (Number(f.width)||2)*SCALE);
        const x = (f.side==='L') ? (baseX0 - w) : baseX1;
        const rr = document.createElementNS(svgNS,'rect');
        rr.setAttribute('x', x);
        rr.setAttribute('y', y);
        rr.setAttribute('width', w);
        rr.setAttribute('height', h);
        rr.setAttribute('rx', 10); rr.setAttribute('ry', 10);
        rr.setAttribute('fill', f.type==='panel' ? 'rgba(2,132,199,0.35)' : 'rgba(14,165,233,0.18)');
        rr.setAttribute('stroke', f.type==='panel' ? 'rgba(2,132,199,0.85)' : 'rgba(14,165,233,0.55)');
        rr.setAttribute('stroke-width', '2');
        finG.appendChild(rr);
      }

      if(f.type==='blenda_pion_full'){
        const x0cm = Number(f.x0cm)||0;
        const x1cm = Number(f.x1cm)||0;
        const wcm = Number(f.width)||2;
        const side = f.side || 'R';
        const x0 = PAD_L + x0cm*SCALE;
        const x1 = PAD_L + x1cm*SCALE;
        const w = Math.max(8, wcm*SCALE);
        const x = (side==='L') ? (x0 - w) : x1;

        const topRow = f.topRow || 'wall';
        const bottomRow = f.bottomRow || 'base';
        if(rowY[topRow]==null || rowY[bottomRow]==null) return;

        const topY = rowY[topRow] + LABEL_H;
        const botHcm = (bottomRow==='wall'?wallH:(bottomRow==='module'?moduleH:baseH));
        const bottomY = rowY[bottomRow] + LABEL_H + botHcm*SCALE;

        const y = Math.min(topY, bottomY);
        const h = Math.max(10, Math.abs(bottomY - topY));

        const rr = document.createElementNS(svgNS,'rect');
        rr.setAttribute('x', x);
        rr.setAttribute('y', y);
        rr.setAttribute('width', w);
        rr.setAttribute('height', h);
        rr.setAttribute('rx', 10); rr.setAttribute('ry', 10);
        rr.setAttribute('fill', 'rgba(14,165,233,0.18)');
        rr.setAttribute('stroke', 'rgba(14,165,233,0.85)');
        rr.setAttribute('stroke-width', '3');
        finG.appendChild(rr);
      }

      if(f.type==='cokol' || f.type==='blenda_gorna'){
        const row = f.row;
        const pos = computePositions(row);

        let x0cm = (f.x0cm!=null) ? Number(f.x0cm) : null;
        let x1cm = (f.x1cm!=null) ? Number(f.x1cm) : null;

        // fallback: legacy indices
        if(x0cm==null || x1cm==null){
          const a = Math.max(0, Math.min(f.startIndex, f.endIndex));
          const b = Math.min(pos.length-1, Math.max(f.startIndex, f.endIndex));
          if(!pos[a] || !pos[b]) return;
          x0cm = pos[a].x0;
          x1cm = pos[b].x1;
        }

        const span0 = Math.min(x0cm,x1cm);
        const span1 = Math.max(x0cm,x1cm);

        let lenCm = (f.lengthCm!=null) ? Number(f.lengthCm)||0 : (span1 - span0);
        if(f.lengthCm==null && f.includeGaps === false){
          lenCm = 0;
          pos.forEach(pp=>{
            if(pp.el.kind!=='cabinet') return;
            const ov = Math.min(pp.x1, span1) - Math.max(pp.x0, span0);
            if(ov>0) lenCm += ov;
          });
        }

        const px0 = PAD_L + span0*SCALE;
        const pxW = Math.max(10, lenCm*SCALE);
        const isCokol = (f.type==='cokol');
        const yBase = rowY[row] + LABEL_H + (row==='wall' ? wallH : baseH)*SCALE;
        const y = isCokol ? (yBase + 8) : Math.max(2, (rowY[row] + LABEL_H - 14));
        const rr = document.createElementNS(svgNS,'rect');
        rr.setAttribute('x', px0);
        rr.setAttribute('y', y);
        rr.setAttribute('width', pxW);
        rr.setAttribute('height', 10);
        rr.setAttribute('rx', 8); rr.setAttribute('ry', 8);
        rr.setAttribute('fill', isCokol ? 'rgba(2,132,199,0.35)' : 'rgba(14,165,233,0.18)');
        rr.setAttribute('stroke', isCokol ? 'rgba(2,132,199,0.85)' : 'rgba(14,165,233,0.55)');
        rr.setAttribute('stroke-width', '2');
        finG.appendChild(rr);
      }
    });
  }

  function handleClick(row, index, isShift){
    const arr = seg.rows[row] || [];
    if(!arr[index]) return;
    st.selected = { row, index };
    // Zakresy są sterowane przyciskami START/KONIEC + "Wyczyść zakres"
    // Nie kasujemy ich automatycznie przy zwykłym kliknięciu (mobile UX).
    saveProject();
    renderCabinets();
  }


function commitReorder(row, fromIndex, dxPx){
    const arr = seg.rows[row] || [];
    if(fromIndex < 0 || fromIndex >= arr.length) return;
    const pos = computePositions(row);
    const item = arr[fromIndex];
    const w = (pos[fromIndex] ? pos[fromIndex].w : elWidthCm(row, item));
    const startX0 = pos[fromIndex] ? pos[fromIndex].x0 : 0;
    const newCenterCm = (startX0 + w/2) + (dxPx / SCALE);

    // remove item
    arr.splice(fromIndex, 1);

    // compute insertion index by scanning midpoints
    let insertAt = arr.length;
    let x = Number(seg.offsets?.[row]||0);
    for(let i=0;i<arr.length;i++){
      const wi = elWidthCm(row, arr[i]);
      const mid = x + wi/2;
      if(newCenterCm < mid){
        insertAt = i;
        break;
      }
      x += wi;
    }
    arr.splice(insertAt, 0, item);

    // after reorder, keep selection on the moved item
    st.selected = { row, index: insertAt };
    st.hRange = null;

    saveProject();
    renderCabinets();
  }

  // Inspector rendering
  const insBody = inspector.querySelector('#insBody');
  const finList = inspector.querySelector('#finList');

  function renderInspector(){
    const sel = st.selected;
    if(!sel){
      insBody.innerHTML = `<div class="muted xs">Kliknij kafelek (szafkę lub przerwę).<br/>Zaznacz zakres: Ustaw START i KONIEC.</div>`;
      return;
    }
    const row = sel.row;
    const el = (seg.rows[row]||[])[sel.index];
    if(!el){
      insBody.innerHTML = `<div class="muted xs">Brak elementu.</div>`;
      return;
    }

    const title = document.createElement('div');
    title.style.fontWeight = '900';
    title.style.marginBottom = '8px';
    title.textContent = (el.kind==='gap')
      ? `PRZERWA • ${Number(el.width)||0}cm • ${humanRow(row)}`
      : `${(getCabById(room, el.id)?.subType || getCabById(room, el.id)?.type || 'Szafka')} • ${Number(getCabById(room, el.id)?.width)||0}cm • ${humanRow(row)}`;

    const box = document.createElement('div');
    box.innerHTML = '';
    box.appendChild(title);

    // Layer order controls (row z-order)
    const zWrap = document.createElement('div');
    zWrap.style.display='flex';
    zWrap.style.gap='8px';
    zWrap.style.alignItems='center';
    zWrap.style.margin='0 0 10px 0';
    const zLbl = document.createElement('div');
    zLbl.className='muted xs';
    zLbl.textContent = 'Warstwa: ' + humanRow(row);
    const btnUp = document.createElement('button');
    btnUp.className='btn';
    btnUp.textContent='▲ wyżej';
    const btnDn = document.createElement('button');
    btnDn.className='btn';
    btnDn.textContent='▼ niżej';
    btnUp.onclick = ()=>{
      const lo = projectData[room].layout;
      const arr = (lo && Array.isArray(lo.zOrderRows)) ? lo.zOrderRows.slice() : ['base','module','wall'];
      const i = arr.indexOf(row);
      // wyżej = bardziej na wierzch (rysowane później)
      if(i>=0 && i < arr.length-1){ const t=arr[i+1]; arr[i+1]=arr[i]; arr[i]=t; }
      if(lo) lo.zOrderRows = arr;
      saveProject();
      renderCabinets();
    };
    btnDn.onclick = ()=>{
      const lo = projectData[room].layout;
      const arr = (lo && Array.isArray(lo.zOrderRows)) ? lo.zOrderRows.slice() : ['base','module','wall'];
      const i = arr.indexOf(row);
      // niżej = bardziej pod spodem (rysowane wcześniej)
      if(i>0){ const t=arr[i-1]; arr[i-1]=arr[i]; arr[i]=t; }
      if(lo) lo.zOrderRows = arr;
      saveProject();
      renderCabinets();
    };
    zWrap.appendChild(zLbl);
    zWrap.appendChild(btnUp);
    zWrap.appendChild(btnDn);
    box.appendChild(zWrap);

    // Zakres (START/END) — mobile-friendly
    const rSel = document.createElement('div');
    rSel.style.display='flex';
    rSel.style.flexDirection='column';
    rSel.style.gap='8px';
    rSel.style.margin='0 0 12px 0';

    const rInfo = document.createElement('div');
    rInfo.className='muted xs';
    const rs = st.rangeStart;
    const rTxt = [];
    if(rs){
      const aEl = (seg.rows[rs.row]||[])[rs.index];
      const aLbl = aEl ? (aEl.kind==='gap' ? 'PRZERWA' : (getCabById(room, aEl.id)?.subType || getCabById(room, aEl.id)?.type || 'Szafka')) : '—';
      rTxt.push('START: ' + aLbl + ' (' + humanRow(rs.row) + ')');
    }
    if(st.hRange){
      const len = Math.abs((Number(st.hRange.x1cm)||0) - (Number(st.hRange.x0cm)||0));
      rTxt.push('ZAKRES: ' + humanRow(st.hRange.row) + ' • dł.: ' + len.toFixed(1) + 'cm');
    }
    if(st.vRange){
      rTxt.push('ZAKRES PION: ' + humanRow(st.vRange.topRow) + '→' + humanRow(st.vRange.bottomRow));
    }
    rInfo.textContent = rTxt.length ? rTxt.join(' • ') : 'Zakres: ustaw START i KONIEC.';

    const rBtns = document.createElement('div');
    rBtns.style.display='flex';
    rBtns.style.gap='8px';
    rBtns.style.flexWrap='wrap';

    const bStart = document.createElement('button');
    bStart.className='btn';
    bStart.textContent='Ustaw START';
    bStart.onclick = ()=>{
      if(el.kind==='gap'){ alert('START nie może być przerwą. Wybierz szafkę.'); return; }
      st.rangeStart = { row, index: sel.index };
      st.hRange = null;
      st.vRange = null;
      saveProject();
      renderCabinets();
    };

    const bEnd = document.createElement('button');
    bEnd.className='btn-primary';
    bEnd.textContent='Ustaw KONIEC';
    bEnd.onclick = ()=>{
      if(el.kind==='gap'){ alert('KONIEC nie może być przerwą. Wybierz szafkę.'); return; }
      if(!st.rangeStart){
        st.rangeStart = { row, index: sel.index };
        st.hRange = null;
        st.vRange = null;
        saveProject();
        renderCabinets();
        return;
      }
      const a = st.rangeStart;
      // same row => horizontal range (tak jak pion: po X)
      if(a.row === row){
        const pos = computePositions(row);
        const pa = pos[a.index];
        const pb = pos[sel.index];
        if(pa && pb){
          const x0cm = Math.min(pa.x0, pb.x0);
          const x1cm = Math.max(pa.x1, pb.x1);
          // Blendy/cokół tylko po ciągłych szafkach – bez przerw w środku
          const i0 = Math.min(a.index, sel.index);
          const i1 = Math.max(a.index, sel.index);
          const rowEls = (seg.rows[row]||[]);
          let hasGap = false;
          for(let i=i0;i<=i1;i++){ if(rowEls[i] && rowEls[i].kind==='gap'){ hasGap=true; break; } }
          if(hasGap){
            alert('Zakres zawiera przerwę. Blendy/cokół można dodać tylko na ciągłych szafkach.');
            st.rangeStart = { row, index: sel.index };
            st.hRange = null; st.vRange = null;
            saveProject(); renderCabinets();
            return;
          }
          st.hRange = { row, x0cm, x1cm, startIndex: a.index, endIndex: sel.index };
          st.vRange = null;
        } else {
          st.rangeStart = { row, index: sel.index };
          st.hRange = null;
          st.vRange = null;
          saveProject();
          renderCabinets();
          return;
        }
      } else {
        const posA = computePositions(a.row);
        const posB = computePositions(row);
        const pa = posA[a.index];
        const pb = posB[sel.index];
        if(pa && pb){
          const x0cm = Math.max(pa.x0, pb.x0);
          const x1cm = Math.min(pa.x1, pb.x1);
          if(x1cm > x0cm){
            const order = ['wall','module','base']; // top -> bottom
            const ia = order.indexOf(a.row);
            const ib = order.indexOf(row);
            const topRow = order[Math.min(ia, ib)];
            const bottomRow = order[Math.max(ia, ib)];
            const rowsIncl = order.slice(Math.min(ia, ib), Math.max(ia, ib)+1);
            // Blenda pion pełna tylko jeżeli w kolumnie nie ma przerw w żadnym z rzędów
            let hasGapV = false;
            for(const rk of rowsIncl){
              const posR = computePositions(rk);
              const elsR = (seg.rows[rk]||[]);
              for(let i=0;i<elsR.length;i++){
                if(elsR[i].kind==='gap'){
                  const pr = posR[i];
                  if(pr && pr.x1 > x0cm && pr.x0 < x1cm){ hasGapV = true; break; }
                }
              }
              if(hasGapV) break;
            }
            if(hasGapV){
              alert('Zakres pionowy przechodzi przez przerwę. Blendy można dodać tylko na ciągłych szafkach.');
              st.rangeStart = { row, index: sel.index };
              st.hRange = null; st.vRange = null;
              saveProject(); renderCabinets();
              return;
            }
            st.vRange = { x0cm, x1cm, topRow, bottomRow, rows: rowsIncl };
            st.hRange = null;
          } else {
            // no overlap => reset start to this
            st.rangeStart = { row, index: sel.index };
            st.hRange = null;
            st.vRange = null;
            saveProject();
            renderCabinets();
            return;
          }
        }
      }
      st.rangeStart = null;
      saveProject();
      renderCabinets();
    };

    const bClear = document.createElement('button');
    bClear.className='btn';
    bClear.textContent='Wyczyść zakres';
    bClear.onclick = ()=>{
      st.rangeStart = null;
      st.hRange = null;
      st.vRange = null;
      saveProject();
      renderCabinets();
    };

    rBtns.appendChild(bStart);
    rBtns.appendChild(bEnd);
    rBtns.appendChild(bClear);

    rSel.appendChild(rInfo);
    rSel.appendChild(rBtns);
    box.appendChild(rSel);


// Vertical range actions (od dołu do góry)
if(st.vRange && st.vRange.x1cm > st.vRange.x0cm){
  const vr = st.vRange;
  const rowDiv = document.createElement('div');
  rowDiv.style.display='flex';
  rowDiv.style.flexDirection='column';
  rowDiv.style.gap='8px';
  rowDiv.style.marginBottom='10px';

  const info = document.createElement('div');
  info.className='muted xs';
  info.textContent = `Zakres pionowy: ${humanRow(vr.topRow)} → ${humanRow(vr.bottomRow)} (kolumna)`;
  rowDiv.appendChild(info);

  // Opcje zakresu pionowego (mobile-friendly): co doliczać do wysokości
  if(vr.includeTopBlende === undefined){
    // domyślnie: jeśli w kolumnie są GÓRNE, dolicz blendę górną
    vr.includeTopBlende = true;
  }
  if(vr.includePlinth === undefined){
    // domyślnie: jeśli zakres obejmuje DOLNE, dolicz cokół
    vr.includePlinth = (Array.isArray(vr.rows)? vr.rows.includes('base') : (vr.bottomRow==='base' || vr.topRow==='base'));
  }
  const optWrap = document.createElement('div');
  optWrap.style.display='flex';
  optWrap.style.flexWrap='wrap';
  optWrap.style.gap='8px';

  const btnTopOpt = document.createElement('button');
  btnTopOpt.className='btn';
  const paintTop = ()=>{ btnTopOpt.textContent = 'Blenda górna: ' + (vr.includeTopBlende ? 'TAK' : 'NIE'); };
  paintTop();
  btnTopOpt.onclick = ()=>{ vr.includeTopBlende = !vr.includeTopBlende; paintTop(); saveProject(); renderCabinets(); };

  const btnPlOpt = document.createElement('button');
  btnPlOpt.className='btn';
  const paintPl = ()=>{ btnPlOpt.textContent = 'Cokół: ' + (vr.includePlinth ? 'TAK' : 'NIE'); };
  paintPl();
  btnPlOpt.onclick = ()=>{ vr.includePlinth = !vr.includePlinth; paintPl(); saveProject(); renderCabinets(); };

  optWrap.appendChild(btnTopOpt);
  optWrap.appendChild(btnPlOpt);
  rowDiv.appendChild(optWrap);

  const btnL = document.createElement('button');
  btnL.className='btn-primary';
  btnL.textContent='Dodaj blendę pion pełna (lewa)';
  btnL.onclick = ()=>{
    const w = parseFloat(prompt('Szerokość blendy (cm):','5')||'0');
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'blenda_pion_full', segmentId:seg.id, side:'L', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };

  const btnR = document.createElement('button');
  btnR.className='btn-primary';
  btnR.textContent='Dodaj blendę pion pełna (prawa)';
  btnR.onclick = ()=>{
    const w = parseFloat(prompt('Szerokość blendy (cm):','5')||'0');
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'blenda_pion_full', segmentId:seg.id, side:'R', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };

  const btnC = document.createElement('button');
  btnC.className='btn';
  btnC.textContent='Wyczyść zakres pionowy';
  btnC.onclick = ()=>{ st.vRange=null; saveProject(); renderCabinets(); };

    const btnPL = document.createElement('button');
  btnPL.className='btn';
  btnPL.textContent='Dodaj panel pełny (lewy)';
  btnPL.onclick = ()=>{
    const w = parseFloat(prompt('Grubość panela (cm):','1.8')||'0');
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'panel_pion_full', segmentId:seg.id, side:'L', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };

  const btnPR = document.createElement('button');
  btnPR.className='btn';
  btnPR.textContent='Dodaj panel pełny (prawy)';
  btnPR.onclick = ()=>{
    const w = parseFloat(prompt('Grubość panela (cm):','1.8')||'0');
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'panel_pion_full', segmentId:seg.id, side:'R', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };
rowDiv.appendChild(btnL);
  rowDiv.appendChild(btnR);
  rowDiv.appendChild(btnC);

  box.appendChild(rowDiv);
}
    // Range actions
    if(st.hRange && st.hRange.row===row){
      const r = st.hRange;
      const btn1 = document.createElement('button');
      btn1.className='btn-primary';
      btn1.textContent = (row==='base') ? 'Dodaj cokół na zakresie' : (row==='wall') ? 'Dodaj blendę górną na zakresie' : 'Zakres w modułach: brak akcji';
      if(row==='module'){ btn1.disabled = true; btn1.className='btn'; }
      btn1.onclick = ()=>{
        // długość zakresu liczona jako suma szerokości SZAFEK w zakresie (bez przerw)
        const x0 = Math.min(Number(r.x0cm)||0, Number(r.x1cm)||0);
        const x1 = Math.max(Number(r.x0cm)||0, Number(r.x1cm)||0);
        let lenCm = 0;
        if(r.startIndex!=null && r.endIndex!=null){
          const i0 = Math.min(r.startIndex, r.endIndex);
          const i1 = Math.max(r.startIndex, r.endIndex);
          const rowEls = (seg.rows[row]||[]);
          for(let i=i0;i<=i1;i++){
            const e = rowEls[i];
            if(!e || e.kind!=='cabinet') continue;
            const c = getCabById(room, e.id);
            lenCm += (c ? Number(c.width)||0 : 0);
          }
        } else {
          const pos = computePositions(row);
          pos.forEach(pp=>{
            if(!pp || !pp.el || pp.el.kind!=='cabinet') return;
            const ov = Math.min(pp.x1, x1) - Math.max(pp.x0, x0);
            if(ov>0) lenCm += ov;
          });
        }
addFinish(room, {
          type: (row==='base') ? 'cokol' : 'blenda_gorna',
          segmentId: seg.id,
          row,
          startIndex: r.startIndex,
          endIndex: r.endIndex,
          x0cm: x0,
          x1cm: x1,
          lengthCm: Number(lenCm.toFixed(1)),
          includeGaps: false
        });
        st.hRange = null;
        saveProject();
        renderCabinets();
      };
      const btn2 = document.createElement('button');
      btn2.className='btn';
      btn2.textContent='Wyczyść zakres';
      btn2.onclick = ()=>{ st.hRange=null; saveProject(); renderCabinets(); };

      const rowDiv = document.createElement('div');
      rowDiv.style.display='flex';
      rowDiv.style.flexDirection='column';
      rowDiv.style.gap='8px';
      rowDiv.appendChild(btn1);
      rowDiv.appendChild(btn2);
      box.appendChild(rowDiv);

      insBody.innerHTML = '';
      insBody.appendChild(box);
      return;
    }

    // Element actions

    const actions = document.createElement('div');
    actions.style.display='flex';
    actions.style.flexDirection='column';
    actions.style.gap='8px';

    function askWidth(def){ return parseFloat(prompt('Szerokość (cm):', String(def)) || '0'); }

    if(el.kind==='cabinet'){
      const btnPL = document.createElement('button');
      btnPL.className='btn';
      btnPL.textContent='Dodaj panel lewy';
      btnPL.onclick = ()=>{
        const w = askWidth(1.8); if(!(w>0)) return;
        addFinish(room, { type:'panel', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'L', width:w });
        renderCabinets();
      };
      const btnPR = document.createElement('button');
      btnPR.className='btn';
      btnPR.textContent='Dodaj panel prawy';
      btnPR.onclick = ()=>{
        const w = askWidth(1.8); if(!(w>0)) return;
        addFinish(room, { type:'panel', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'R', width:w });
        renderCabinets();
      };
      const btnBL = document.createElement('button');
      btnBL.className='btn';
      btnBL.textContent='Dodaj blendę pion lewa';
      btnBL.onclick = ()=>{
        const w = askWidth(5); if(!(w>0)) return;
        addFinish(room, { type:'blenda_pion', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'L', width:w });
        renderCabinets();
      };
      const btnBR = document.createElement('button');
      btnBR.className='btn';
      btnBR.textContent='Dodaj blendę pion prawa';
      btnBR.onclick = ()=>{
        const w = askWidth(5); if(!(w>0)) return;
        addFinish(room, { type:'blenda_pion', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'R', width:w });
        renderCabinets();
      };
      const btnGapA = document.createElement('button');
      btnGapA.className='btn';
      btnGapA.textContent='Wstaw przerwę po prawej';
      btnGapA.onclick = ()=>{
        const w = askWidth(5); if(!(w>0)) return;
        insertGapAfter(room, seg, row, sel.index, w);
        renderCabinets();
      };

      actions.appendChild(btnPL);
      actions.appendChild(btnPR);
      actions.appendChild(btnBL);
      actions.appendChild(btnBR);
      actions.appendChild(btnGapA);
    } else {
      // gap
      const btnEdit = document.createElement('button');
      btnEdit.className='btn';
      btnEdit.textContent='Zmień szerokość przerwy';
      btnEdit.onclick = ()=>{
        const w = askWidth(Number(el.width)||5);
        if(!(w>0)) return;
        el.width = w;
        saveProject();
        renderCabinets();
      };
      const btnDel = document.createElement('button');
      btnDel.className='btn-danger';
      btnDel.textContent='Usuń przerwę';
      btnDel.onclick = ()=>{
        if(!confirm('Usunąć przerwę?')) return;
        (seg.rows[row]||[]).splice(sel.index,1);
        st.selected = null;
        saveProject();
        renderCabinets();
      };
      actions.appendChild(btnEdit);
      actions.appendChild(btnDel);
    }

    box.appendChild(actions);
    insBody.innerHTML = '';
    insBody.appendChild(box);
  }

  function renderFinishListPanel(){
    const segFin = (pd.finishes||[]).filter(f=>f.segmentId===seg.id);
    finList.innerHTML = '';
    if(segFin.length===0){
      finList.innerHTML = `<div class="muted xs">Brak.</div>`;
      return;
    }
    segFin.forEach(f=>{
      const row = document.createElement('div');
      row.className = 'finish-item';
      const meta = document.createElement('div');
      meta.className = 'meta';
      const b = document.createElement('b');
      b.textContent = finishLabel(f);
      const p = document.createElement('p');
      p.className = 'muted xs';
      p.style.margin='0';
      let extra = [];
      const s = pd.settings || {};

      const fmt = (n)=> {
        const v = Number(n);
        if(!isFinite(v)) return '0';
        // keep one decimal if needed
        return (Math.round(v*10)/10).toString();
      };

      if(f.type==='panel' || f.type==='blenda_pion'){
        const rowKey = f.row;
        const idx = Number(f.index)||0;
        const arr = seg.rows[rowKey] || [];
        const el = arr[idx] || null;
        const hCm = elHeightCm(rowKey, el);
        const wCm = Number(f.width)||0;
        extra.push(`${humanRow(rowKey)} • #${idx+1} • ${f.side} • szer ${fmt(wCm)}cm • wys ${fmt(hCm)}cm`);
      } else if(f.type==='blenda_pion_full'){
        const topRow = f.topRow || 'wall';
        const bottomRow = f.bottomRow || 'base';
        const side = f.side || 'R';
        const wCm = Number(f.width)||0;

        const topY = rowY[topRow] + LABEL_H;
        const botHcm = (bottomRow==='wall'?wallH:(bottomRow==='module'?moduleH:baseH));
        const bottomY = rowY[bottomRow] + LABEL_H + botHcm*SCALE;
        const hCm = Math.abs(bottomY - topY)/SCALE;

        extra.push(`kolumna ${humanRow(topRow)}→${humanRow(bottomRow)} • ${side} • szer ${fmt(wCm)}cm • wys ${fmt(hCm)}cm`);
      } else if(f.type==='cokol' || f.type==='blenda_gorna'){
        const rowKey = f.row;
        const pos = computePositions(rowKey);
        const a = Math.max(0, Math.min(Number(f.startIndex)||0, Number(f.endIndex)||0));
        const b = Math.min(pos.length-1, Math.max(Number(f.startIndex)||0, Number(f.endIndex)||0));

        let lenCm = (isFinite(Number(f.lengthCm)) && Number(f.lengthCm)>0) ? Number(f.lengthCm) : NaN;
        if(pos[a] && pos[b]){
          if(!isFinite(lenCm)){
            if(f.includeGaps === false){
              lenCm = 0;
              for(let i=a;i<=b;i++){
                if(pos[i].el && pos[i].el.kind==='cabinet') lenCm += Number(pos[i].w)||0;
              }
            } else {
              lenCm = (Number(pos[b].x1)||0) - (Number(pos[a].x0)||0);
            }
          }
        }
        const hCm = (f.type==='cokol') ? (Number(s.legHeight)||0) : (Number(s.ceilingBlende)||0);
        extra.push(`${humanRow(rowKey)} • zakres ${a+1}-${b+1} • dł ${fmt(lenCm)}cm • wys ${fmt(hCm)}cm`);
      }

      p.textContent = extra.join(' | ');
      meta.appendChild(b);
      meta.appendChild(p);

      const del = document.createElement('button');
      del.className='btn-danger';
      del.textContent='Usuń';
      del.onclick = ()=>{ removeFinish(room, f.id); renderCabinets(); };

      row.appendChild(meta);
      row.appendChild(del);
      finList.appendChild(row);
    });
  }

  // mount svg and render
  svgHost.innerHTML = '';
  svgHost.appendChild(svg);

  renderAll();
  renderInspector();
  renderFinishListPanel();
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
  window.FC = FC;
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

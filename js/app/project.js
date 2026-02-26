// js/app/project.js
// Project schema + migrations + robust load/save (extracted from js/app.js).
// Load BEFORE js/app.js.

(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  // Don't override if already present.
  if (FC.project) return;

  // Minimal utils/storage needed by the project module.
  const utils = FC.utils || {
    uid(){
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      return 'id_' + Date.now() + '_' + Math.floor(Math.random() * 1e9);
    },
    clone(x){
      if (typeof structuredClone === 'function') return structuredClone(x);
      return JSON.parse(JSON.stringify(x));
    },
    isPlainObject(v){
      return !!v && typeof v === 'object' && (v.constructor === Object || Object.getPrototypeOf(v) === null);
    }
  };

  const storage = FC.storage || {
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


  FC.project = project;
})();

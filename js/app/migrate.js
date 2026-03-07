// AKTYWNY moduł migracji i normalizacji projektu. Ładowany przed js/app.js.
// js/app/migrate.js
// Project schema migrations. Loaded before js/app.js

(function(){
  'use strict';
  try{
    window.FC = window.FC || {};
    const utils = window.FC.utils;
    const schema = window.FC.schema || {};
    const ROOMS = Array.isArray(schema.ROOMS) ? schema.ROOMS : ['kuchnia','szafa','pokoj','lazienka'];

    if(!window.FC.migrations){
      function clone(obj){
        try{ return (utils && utils.clone) ? utils.clone(obj) : JSON.parse(JSON.stringify(obj)); }
        catch(e){ return JSON.parse(JSON.stringify(obj || {})); }
      }
      function isPlainObject(v){
        return (utils && typeof utils.isPlainObject === 'function') ? utils.isPlainObject(v) : (!!v && typeof v === 'object' && (v.constructor === Object || Object.getPrototypeOf(v) === null));
      }

      function migrateV1toV2(data){
        // v1 had no schemaVersion. v2 introduces schemaVersion at root.
        const out = clone(data || {});
        out.schemaVersion = 2;
        return out;
      }

      function migrateV2toV3(data){
        // v3: sensible defaults for base cabinet height & kitchen legs
        const out = clone(data || {});
        for (const r of ROOMS){
          const room = out[r] = isPlainObject(out[r]) ? out[r] : (out[r] || {});
          const settings = room.settings = isPlainObject(room.settings) ? room.settings : (room.settings || {});
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
        // v4: introduce roomHeight and countertop thickness; normalize numeric settings.
        const out = clone(data || {});
        for (const r of ROOMS){
          const room = out[r] = isPlainObject(out[r]) ? out[r] : (out[r] || {});
          const settings = room.settings = isPlainObject(room.settings) ? room.settings : (room.settings || {});
          if (!Number.isFinite(Number(settings.roomHeight))) settings.roomHeight = (r === 'lazienka') ? 220 : 250;
          if (!Number.isFinite(Number(settings.counterThickness))) settings.counterThickness = (r === 'kuchnia') ? 3.8 : 1.8;
          if (!Number.isFinite(Number(settings.gapHeight))) settings.gapHeight = (r === 'kuchnia') ? 60 : 0;
          if (!Number.isFinite(Number(settings.ceilingBlende))) settings.ceilingBlende = (r === 'kuchnia') ? 10 : (r === 'szafa' ? 5 : 0);
        }
        out.schemaVersion = 4;
        return out;
      }

      function migrateV4toV5(data){
        // v5: normalize standing oven cabinet shelves defaults.
        const out = clone(data || {});
        for (const r of ROOMS){
          const room = out[r] = isPlainObject(out[r]) ? out[r] : (out[r] || {});
          const cabinets = Array.isArray(room.cabinets) ? room.cabinets : [];
          for (const cab of cabinets){
            if(!cab || typeof cab !== 'object') continue;
            if(cab.type === 'stojąca' && (cab.subType || '') === 'piekarnikowa'){
              cab.details = isPlainObject(cab.details) ? cab.details : (cab.details || {});
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

      function migrateV5toV6(data){
        // v6: drawer system defaults.
        const out = clone(data || {});
        for (const r of ROOMS){
          const room = out[r] = isPlainObject(out[r]) ? out[r] : (out[r] || {});
          const cabinets = Array.isArray(room.cabinets) ? room.cabinets : [];
          for (const cab of cabinets){
            if(!cab || typeof cab !== 'object') continue;
            cab.details = isPlainObject(cab.details) ? cab.details : (cab.details || {});
            const d = cab.details;
            if(cab.subType === 'szuflady'){
              if(!d.drawerSystem) d.drawerSystem = 'skrzynkowe';
              if(!d.drawerBrand) d.drawerBrand = 'blum';
              if(!d.drawerModel) d.drawerModel = 'tandembox';
            }
          }
        }
        out.schemaVersion = 6;
        return out;
      }

      function migrateV6toV7(data){
        // v7: normalize drawer layout + inner drawers limits.
        const out = clone(data || {});
        for (const r of ROOMS){
          const room = out[r] = isPlainObject(out[r]) ? out[r] : (out[r] || {});
          const cabinets = Array.isArray(room.cabinets) ? room.cabinets : [];
          for (const cab of cabinets){
            if(!cab || typeof cab !== 'object') continue;
            cab.details = isPlainObject(cab.details) ? cab.details : (cab.details || {});
            const d = cab.details;
            if(cab.subType === 'szuflady'){
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
            }
          }
        }
        out.schemaVersion = 7;
        return out;
      }

      function migrateV7toV8(data){
        // v8: normalize dishwasher width and tech divider counts.
        const out = clone(data || {});
        for (const r of ROOMS){
          const room = out[r] = isPlainObject(out[r]) ? out[r] : (out[r] || {});
          const settings = room.settings = isPlainObject(room.settings) ? room.settings : (room.settings || {});
          const leg = Number(settings.legHeight) || 0;
          const cabinets = Array.isArray(room.cabinets) ? room.cabinets : [];
          cabinets.forEach((c)=>{
            if(!c || typeof c !== 'object') return;
            if(c.subType !== 'zmywarkowa') return;
            c.details = isPlainObject(c.details) ? c.details : (c.details || {});
            const d = c.details;
            if(!d.dishWasherWidth){
              const cw = Number(c.width) || 60;
              let w;
              if(cw === 45) w = '45';
              else if(cw === 60) w = '60';
              else w = '60';
              d.dishWasherWidth = w;
            }
            const wn = Number(d.dishWasherWidth) || 60;
            if(wn) c.width = wn;

            const frontH = (Number(c.height) || 0) - leg;
            const div = (frontH > 74.5) ? Math.max(0, Math.ceil(((frontH - 74.5) / 2) - 1e-9)) : 0;
            d.techDividerCount = String(div);
            if(d.shelves == null || (Number(d.shelves) || 0) !== 0) d.shelves = 0;
          });
        }
        out.schemaVersion = 8;
        return out;
      }

      function migrateV8toV9(data){
        // v9: ensure fridge defaults.
        const out = clone(data || {});
        for (const r of ROOMS){
          const room = out[r] = isPlainObject(out[r]) ? out[r] : (out[r] || {});
          const cabinets = Array.isArray(room.cabinets) ? room.cabinets : [];
          cabinets.forEach((c)=>{
            if(!c || typeof c !== 'object') return;
            c.details = isPlainObject(c.details) ? c.details : (c.details || {});
            const d = c.details;
            if(c.subType === 'lodowkowa'){
              if(!d.fridgeOption) d.fridgeOption = 'zabudowa';
              if(!d.techDividerCount) d.techDividerCount = '0';
              if(d.shelves == null) d.shelves = 0;
            }
          });
        }
        out.schemaVersion = 9;
        return out;
      }



      function normalizeRoom(roomRaw, roomDefault){
        const room = isPlainObject(roomRaw) ? roomRaw : {};
        const def = roomDefault || { settings:{} };

        const cabinets = Array.isArray(room.cabinets) ? room.cabinets : [];
        const fronts   = Array.isArray(room.fronts)   ? room.fronts   : [];
        const sets     = Array.isArray(room.sets)     ? room.sets     : [];

        const sRaw = isPlainObject(room.settings) ? room.settings : {};
        const sDef = isPlainObject(def.settings) ? def.settings : {};

        const settings = {
          roomHeight: Number.isFinite(Number(sRaw.roomHeight)) ? Number(sRaw.roomHeight) : Number(sDef.roomHeight)||250,
          bottomHeight: Number.isFinite(Number(sRaw.bottomHeight)) ? Number(sRaw.bottomHeight) : Number(sDef.bottomHeight)||82,
          legHeight: Number.isFinite(Number(sRaw.legHeight)) ? Number(sRaw.legHeight) : Number(sDef.legHeight)||0,
          counterThickness: Number.isFinite(Number(sRaw.counterThickness)) ? Number(sRaw.counterThickness) : Number(sDef.counterThickness)||1.8,
          gapHeight: Number.isFinite(Number(sRaw.gapHeight)) ? Number(sRaw.gapHeight) : Number(sDef.gapHeight)||0,
          ceilingBlende: Number.isFinite(Number(sRaw.ceilingBlende)) ? Number(sRaw.ceilingBlende) : Number(sDef.ceilingBlende)||0,
        };

        const calcTechDividers = (frontH) => {
          const fh = Number(frontH) || 0;
          if(!(fh > 74.5)) return 0;
          return Math.max(0, Math.ceil(((fh - 74.5) / 2) - 1e-9));
        };

        const leg = Number(settings.legHeight) || 0;
        const bottomFrontH = Math.max(0, (Number(settings.bottomHeight) || 0) - leg);

        const normCabinets = cabinets.map((c) => {
          if(!isPlainObject(c)) return c;
          const cab = { ...c };
          const d = isPlainObject(cab.details) ? { ...cab.details } : {};

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
              const lh = Number(settings.legHeight) || 0;
              const nh = Number(d.fridgeNicheHeight) || 0;
              if(nh > 0) cab.height = nh + (div * 1.8) + 3.6 + lh;
            } else {
              d.techDividerCount = '0';
              d.shelves = 0;
            }
          }

          if(cab.subType === 'szuflady'){
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

      function normalizeProject(raw, DEFAULT_PROJECT, CURRENT_SCHEMA_VERSION){
        let data = isPlainObject(raw) ? raw : {};
        let ver = Number(data.schemaVersion);
        if (!Number.isFinite(ver) || ver < 1) ver = 1;

        if (ver < 2) data = migrateV1toV2(data);
        if (ver < 3) data = migrateV2toV3(data);
        if (ver < 4) data = migrateV3toV4(data);
        if (ver < 5) data = migrateV4toV5(data);
        if (ver < 6) data = migrateV5toV6(data);
        if (ver < 7) data = migrateV6toV7(data);
        if (ver < 8) data = migrateV7toV8(data);
        if (ver < 9) data = migrateV8toV9(data);

        const out = { schemaVersion: CURRENT_SCHEMA_VERSION || 9 };
        for (const r of ROOMS){
          out[r] = normalizeRoom(data[r], DEFAULT_PROJECT && DEFAULT_PROJECT[r]);
        }
        for (const k of Object.keys(data)){
          if (!(k in out)) out[k] = data[k];
        }
        return out;
      }

      window.FC.migrations = {
        migrateV1toV2,
        migrateV2toV3,
        migrateV3toV4,
        migrateV4toV5,
        migrateV5toV6,
        migrateV6toV7,
        migrateV7toV8,
        migrateV8toV9,
        normalizeRoom,
        normalizeProject,
      };
    }
  }catch(_){ }
})();

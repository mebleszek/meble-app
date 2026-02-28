// js/app/schema.js
// Project schema (defaults + normalization). Loaded before js/app.js

(function(){
  'use strict';
  try{
    window.FC = window.FC || {};
    const utils = window.FC.utils;

    if(!window.FC.schema){
      const CURRENT_SCHEMA_VERSION = 9;

      const DEFAULT_PROJECT = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        meta: { assignedInvestorId: null },
        kuchnia: { cabinets: [], fronts: [], sets: [], settings: { roomHeight: 250, bottomHeight: 82, legHeight: 10, counterThickness: 3.8, gapHeight: 60, ceilingBlende: 10 } },
        szafa: { cabinets: [], fronts: [], sets: [], settings: { roomHeight: 250, bottomHeight: 82, legHeight: 10, counterThickness: 1.8, gapHeight: 0, ceilingBlende: 5 } },
        pokoj: { cabinets: [], fronts: [], sets: [], settings: { roomHeight: 250, bottomHeight: 82, legHeight: 5, counterThickness: 1.8, gapHeight: 0, ceilingBlende: 0 } },
        lazienka: { cabinets: [], fronts: [], sets: [], settings: { roomHeight: 220, bottomHeight: 82, legHeight: 15, counterThickness: 2, gapHeight: 0, ceilingBlende: 0 } }
      };

      const ROOMS = ['kuchnia','szafa','pokoj','lazienka'];

      function clone(obj){
        try{ return (utils && utils.clone) ? utils.clone(obj) : JSON.parse(JSON.stringify(obj)); }
        catch(e){ return JSON.parse(JSON.stringify(obj || {})); }
      }
      function isPlainObject(v){
        return (utils && typeof utils.isPlainObject === 'function') ? utils.isPlainObject(v) : (!!v && typeof v === 'object' && (v.constructor === Object || Object.getPrototypeOf(v) === null));
      }
      function num(v, fallback){
        return (utils && typeof utils.num === 'function') ? utils.num(v, fallback) : (Number.isFinite(Number(v)) ? Number(v) : fallback);
      }

      function normalizeRoom(roomRaw, roomDefault){
        const room = isPlainObject(roomRaw) ? roomRaw : {};
        const def = roomDefault;

        const cabinets = Array.isArray(room.cabinets) ? room.cabinets : [];
        const fronts   = Array.isArray(room.fronts)   ? room.fronts   : [];
        const sets     = Array.isArray(room.sets)     ? room.sets     : [];

        const sRaw = isPlainObject(room.settings) ? room.settings : {};
        const sDef = def.settings;

        const settings = {
          roomHeight: num(sRaw.roomHeight, sDef.roomHeight),
          bottomHeight: num(sRaw.bottomHeight, sDef.bottomHeight),
          legHeight: num(sRaw.legHeight, sDef.legHeight),
          counterThickness: num(sRaw.counterThickness, sDef.counterThickness),
          gapHeight: num(sRaw.gapHeight, sDef.gapHeight),
          ceilingBlende: num(sRaw.ceilingBlende, sDef.ceilingBlende),
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
              if(nh > 0){
                cab.height = nh + (div * 1.8) + 3.6 + lh;
              }
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
            else if(lay === '5_equal') fc = 5;
            cab.frontCount = fc;
          }

          return { ...cab, details: d };
        });

        return {
          cabinets: normCabinets,
          fronts: clone(fronts),
          sets: clone(sets),
          settings
        };
      }

      function normalizeProject(raw){
        let data = isPlainObject(raw) ? raw : {};
        let ver = num(data.schemaVersion, 1);
        if (ver < 1) ver = 1;

        const mig = window.FC.migrations || {};
        if (ver < 2 && typeof mig.migrateV1toV2 === 'function') data = mig.migrateV1toV2(data);
        if (ver < 3 && typeof mig.migrateV2toV3 === 'function') data = mig.migrateV2toV3(data);
        if (ver < 4 && typeof mig.migrateV3toV4 === 'function') data = mig.migrateV3toV4(data);
        if (ver < 5 && typeof mig.migrateV4toV5 === 'function') data = mig.migrateV4toV5(data);
        if (ver < 6 && typeof mig.migrateV5toV6 === 'function') data = mig.migrateV5toV6(data);
        if (ver < 7 && typeof mig.migrateV6toV7 === 'function') data = mig.migrateV6toV7(data);
        if (ver < 8 && typeof mig.migrateV7toV8 === 'function') data = mig.migrateV7toV8(data);
        if (ver < 9 && typeof mig.migrateV8toV9 === 'function') data = mig.migrateV8toV9(data);

        const out = { schemaVersion: CURRENT_SCHEMA_VERSION };
        for (const r of ROOMS){
          out[r] = normalizeRoom(data[r], DEFAULT_PROJECT[r]);
        }
        for (const k of Object.keys(data)){
          if (!(k in out)) out[k] = data[k];
        }
        return out;
      }

      window.FC.schema = {
        CURRENT_SCHEMA_VERSION,
        DEFAULT_PROJECT,
        ROOMS,
        normalizeProject,
        normalizeRoom,
      };
    }
  }catch(_){ }
})();

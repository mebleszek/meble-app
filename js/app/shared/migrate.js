// js/app/shared/migrate.js
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
              let lay = String(d.drawerLayout || '3_1_2_2');
              d.drawerLayout = lay;
              delete d.drawerCount;
              delete d.drawers;
              if(!d.drawerSystem) d.drawerSystem = 'skrzynkowe';
              if(!d.drawerBrand) d.drawerBrand = 'blum';
              if(!d.drawerModel) d.drawerModel = 'tandembox';
              if(!('innerDrawerType' in d)) d.innerDrawerType = 'brak';
              if(String(d.innerDrawerType || 'brak') === 'brak' || lay === '5_equal'){
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


      function migrateV9toV10(data){
        // v10: preferencje standardu przy konkretnym pomieszczeniu.
        const out = clone(data || {});
        const defaults = {
          finishStandard: '',
          blendStandard: '',
          bodyColor: '',
          frontMaterial: '',
          frontColor: '',
          backMaterial: '',
          openingSystemStanding: '',
          openingSystemHanging: '',
          openingSystemModule: '',
          hardwareManufacturer: ''
        };
        for (const r of ROOMS){
          const room = out[r] = isPlainObject(out[r]) ? out[r] : (out[r] || {});
          const raw = isPlainObject(room.preferences) ? room.preferences : {};
          const legacyOpening = String(raw.openingSystem || '').trim();
          room.preferences = Object.assign({}, defaults, {
            finishStandard: String(raw.finishStandard || '').trim(),
            blendStandard: String(raw.blendStandard || '').trim(),
            bodyColor: String(raw.bodyColor || '').trim(),
            frontMaterial: String(raw.frontMaterial || '').trim(),
            frontColor: String(raw.frontColor || '').trim(),
            backMaterial: String(raw.backMaterial || '').trim(),
            openingSystemStanding: String(raw.openingSystemStanding || raw.openingSystemLower || legacyOpening || '').trim(),
            openingSystemHanging: String(raw.openingSystemHanging || legacyOpening || '').trim(),
            openingSystemModule: String(raw.openingSystemModule || legacyOpening || '').trim(),
            hardwareManufacturer: String(raw.hardwareManufacturer || '').trim()
          });
        }
        out.schemaVersion = 10;
        return out;
      }


      function migrateV10toV11(data){
        // v11: preferencje pomieszczenia są strefowe, bez sekcji domyślnej w WYWIADZIE.
        const out = clone(data || {});
        function clean(v){ return String(v == null ? '' : v).trim(); }
        function zone(raw, opening){
          return {
            bodyColor: clean(raw.bodyColor),
            frontMaterial: clean(raw.frontMaterial),
            frontColor: clean(raw.frontColor),
            backMaterial: clean(raw.backMaterial),
            openingSystem: clean(opening)
          };
        }
        for (const r of ROOMS){
          const room = out[r] = isPlainObject(out[r]) ? out[r] : (out[r] || {});
          const raw = isPlainObject(room.preferences) ? room.preferences : {};
          const zones = isPlainObject(raw.zones) ? raw.zones : {};
          const legacyOpening = clean(raw.openingSystem);
          room.preferences = {
            finishStandard: clean(raw.finishStandard),
            blendStandard: clean(raw.blendStandard),
            zones: {
              lower: zone(isPlainObject(zones.lower) ? zones.lower : raw, clean((zones.lower && zones.lower.openingSystem) || raw.openingSystemStanding || raw.openingSystemLower || legacyOpening)),
              middle: zone(isPlainObject(zones.middle) ? zones.middle : raw, clean((zones.middle && zones.middle.openingSystem) || raw.openingSystemModule || legacyOpening)),
              upper: zone(isPlainObject(zones.upper) ? zones.upper : raw, clean((zones.upper && zones.upper.openingSystem) || raw.openingSystemHanging || legacyOpening))
            },
            hardwareManufacturer: clean(raw.hardwareManufacturer)
          };
        }
        out.schemaVersion = 11;
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
        migrateV9toV10,
        migrateV10toV11,
      };
    }
  }catch(_){ }
})();

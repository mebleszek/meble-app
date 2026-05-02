// js/app/bootstrap/app-core-namespace.js
// Core namespace bootstrap extracted from app.js.
// Keeps app.js as runtime shell while preserving the legacy fallback contract.

(function(){
  'use strict';
  try{
    window.FC = window.FC || {};
    const ns = window.FC.appCoreNamespace = window.FC.appCoreNamespace || {};

    const DEFAULT_STORAGE_KEYS = {
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

    if(!ns.DEFAULT_STORAGE_KEYS) ns.DEFAULT_STORAGE_KEYS = DEFAULT_STORAGE_KEYS;
    const fallbackStorageMemory = ns.__fallbackStorageMemory || Object.create(null);
    ns.__fallbackStorageMemory = fallbackStorageMemory;

    function createFallbackUtils(){
      return {
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
    }

    function createFallbackStorage(utils){
      return {
        getJSON(key, fallback){
          try{
            const raw = Object.prototype.hasOwnProperty.call(fallbackStorageMemory, key) ? fallbackStorageMemory[key] : null;
            if (!raw) return utils.clone(fallback);
            return JSON.parse(raw);
          }catch(e){
            return utils.clone(fallback);
          }
        },
        setJSON(key, value){
          try{ fallbackStorageMemory[key] = JSON.stringify(value); }catch(e){}
        },
        getRaw(key){
          try{ return Object.prototype.hasOwnProperty.call(fallbackStorageMemory, key) ? fallbackStorageMemory[key] : null; }catch(e){ return null; }
        },
        setRaw(key, raw){
          try{ fallbackStorageMemory[key] = String(raw); }catch(e){}
        }
      };
    }

    function createFallbackProject(cfg, utils, storage){
      const storageKeys = cfg.storageKeys || DEFAULT_STORAGE_KEYS;
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

      return {
        CURRENT_SCHEMA_VERSION,
        DEFAULT_PROJECT,
        load(){
          const rawPrimary = storage.getRaw(storageKeys.projectData);
          const rawBackup  = storage.getRaw(storageKeys.projectBackup);

          function parseOrNull(raw){
            if (!raw) return null;
            try{ return JSON.parse(raw); }catch(e){ return null; }
          }

          const primaryObj = parseOrNull(rawPrimary);
          const backupObj  = parseOrNull(rawBackup);
          const chosen = primaryObj || backupObj || DEFAULT_PROJECT;

          if (!primaryObj && backupObj){
            storage.setRaw(storageKeys.projectData, rawBackup);
          }

          return normalizeProject(chosen);
        },
        save(data){
          const normalized = normalizeProject(data);
          const currentRaw = storage.getRaw(storageKeys.projectData);
          if (currentRaw){
            storage.setRaw(storageKeys.projectBackup, currentRaw);
            storage.setJSON(storageKeys.projectBackupMeta, { savedAt: Date.now() });
          }
          storage.setJSON(storageKeys.projectData, normalized);
          return normalized;
        },
        normalize: normalizeProject,
      };
    }

    if(typeof ns.createAppCore !== 'function'){
      ns.createAppCore = function createAppCore(cfg){
        cfg = cfg || {};
        const currentFC = window.FC || {};
        const utils = currentFC.utils || createFallbackUtils();
        const storage = currentFC.storage || createFallbackStorage(utils);
        const project = (currentFC.project && typeof currentFC.project.load === 'function' && typeof currentFC.project.save === 'function')
          ? currentFC.project
          : createFallbackProject(cfg, utils, storage);

        try{
          window.FC.utils = currentFC.utils || utils;
          window.FC.storage = currentFC.storage || storage;
          window.FC.project = project;
        }catch(_){ }

        return { utils, storage, project };
      };
    }
  }catch(_){ }
})();

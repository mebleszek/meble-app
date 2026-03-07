// js/app/project-state.js
// Extracted robust project load/save logic.
// Safe to load before js/app.js. App keeps local fallbacks if this module is unavailable.

(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function parseOrNull(raw){
    if (!raw) return null;
    try{ return JSON.parse(raw); }catch(_){ return null; }
  }

  function load(storage, normalizeProject, STORAGE_KEYS, DEFAULT_PROJECT){
    const rawPrimary = storage.getRaw(STORAGE_KEYS.projectData);
    const rawBackup  = storage.getRaw(STORAGE_KEYS.projectBackup);
    const primaryObj = parseOrNull(rawPrimary);
    const backupObj  = parseOrNull(rawBackup);
    const chosen = primaryObj || backupObj || DEFAULT_PROJECT;

    if (!primaryObj && backupObj){
      storage.setRaw(STORAGE_KEYS.projectData, rawBackup);
    }

    return normalizeProject(chosen);
  }

  function save(storage, normalizeProject, STORAGE_KEYS, data){
    const normalized = normalizeProject(data);
    const currentRaw = storage.getRaw(STORAGE_KEYS.projectData);
    if (currentRaw){
      storage.setRaw(STORAGE_KEYS.projectBackup, currentRaw);
      storage.setJSON(STORAGE_KEYS.projectBackupMeta, { savedAt: Date.now() });
    }
    storage.setJSON(STORAGE_KEYS.projectData, normalized);
    return normalized;
  }

  FC.projectState = { load, save };
})();

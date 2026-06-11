(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const keys = (FC.constants && FC.constants.STORAGE_KEYS) || {};
  const storage = FC.storage || {
    getJSON(_key, fallback){ return JSON.parse(JSON.stringify(fallback)); },
    setJSON(){}
  };

  const SNAPSHOT_KEY = keys.quoteSnapshots || 'fc_quote_snapshots_v1';
  const FINAL_STATUSES = new Set(['zaakceptowany','umowa','produkcja','montaz','zakonczone']);
  const SNAPSHOT_STORAGE_VERSION = 7;
  const SNAPSHOT_STORAGE_SCHEMA = 'quote-snapshot-slim-v1';
  const MAX_SNAPSHOTS_PER_PROJECT = 30;
  const MAX_SNAPSHOTS_TOTAL = 240;

  // Odpowiedzialność modułu: historia i exact-scope dane ofertowe.
  // Snapshot store przechowuje oraz filtruje snapshoty ofert, ale nie powinien
  // być miejscem finalnego liczenia biznesowego statusu projektu.

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function uid(){
    try{ return FC.utils && typeof FC.utils.uid === 'function' ? FC.utils.uid() : ('qs_' + Date.now()); }
    catch(_){ return 'qs_' + Date.now(); }
  }


  function rawSnapshotStorage(){
    try{ return storage && typeof storage.getRaw === 'function' ? storage.getRaw(SNAPSHOT_KEY) : localStorage.getItem(SNAPSHOT_KEY); }
    catch(_){ return null; }
  }
  function bytes(value){ return value == null ? 0 : String(value).length; }
  function safeParseRows(raw){
    try{ const parsed = JSON.parse(String(raw || '[]')); return Array.isArray(parsed) ? parsed : []; }
    catch(err){ return { __error:true, message:String(err && err.message || err || 'parse error') }; }
  }
  function snapshotId(row){ return String(row && (row.id || row.snapshotId) || '').trim(); }
  function summarizeStoreRows(rows, limit){
    const list = Array.isArray(rows) ? rows : [];
    return list.slice(0, Number(limit) > 0 ? Number(limit) : 8).map((row)=> ({
      id:snapshotId(row),
      projectId:String(row && (row.projectId || row.project && row.project.id || row.meta && row.meta.projectId) || ''),
      investorId:String(row && (row.investorId || row.investor && row.investor.id || row.project && row.project.investorId || row.meta && row.meta.investorId) || ''),
      versionName:String(row && (row.commercial && row.commercial.versionName || row.meta && row.meta.versionName) || ''),
      preliminary:!!(row && (row.meta && row.meta.preliminary || row.commercial && row.commercial.preliminary)),
      generatedAt:row && row.generatedAt || null,
    }));
  }
  function recordStoreEvent(label, value){
    try{
      if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.recordSnapshotStoreEvent === 'function') FC.wycenaDiagnostics.recordSnapshotStoreEvent(label, value);
    }catch(_){ }
  }

  function currentStorageVersion(){
    try{ return Number(FC.quoteSnapshot && FC.quoteSnapshot.SNAPSHOT_STORAGE_VERSION) || SNAPSHOT_STORAGE_VERSION; }catch(_){ return SNAPSHOT_STORAGE_VERSION; }
  }
  function currentStorageSchema(){
    try{ return String(FC.quoteSnapshot && FC.quoteSnapshot.SNAPSHOT_STORAGE_SCHEMA || SNAPSHOT_STORAGE_SCHEMA); }catch(_){ return SNAPSHOT_STORAGE_SCHEMA; }
  }
  function isCurrentStoredSnapshot(row){
    const src = row && typeof row === 'object' ? row : null;
    if(!src) return false;
    const meta = src.meta && typeof src.meta === 'object' ? src.meta : {};
    if(Number(src.version || 0) < currentStorageVersion()) return false;
    if(String(meta.storageSchema || '') !== currentStorageSchema()) return false;
    if(Object.prototype.hasOwnProperty.call(src, 'catalogs')) return false;
    return true;
  }
  function createStorageWriteError(message, details, originalError){
    const error = new Error(message || 'Nie udało się zapisać snapshotu WYCENY.');
    error.code = 'quote_snapshot_storage_write_failed';
    error.details = details && typeof details === 'object' ? details : {};
    if(originalError) error.originalError = originalError;
    return error;
  }
  function invalidateDirtyCache(){
    try{ if(FC.session && typeof FC.session.invalidateDirtyCache === 'function') FC.session.invalidateDirtyCache(); }catch(_){ }
  }
  function runStorageMaintenance(reason, rows, aggressive, err){
    try{
      const api = FC.quoteSnapshotStorageMaintenance;
      if(api && typeof api.prepareForSnapshotWrite === 'function'){
        const result = api.prepareForSnapshotWrite({ reason:String(reason || ''), rows:Array.isArray(rows) ? rows : [], aggressive:!!aggressive, error:String(err && err.message || err || '') });
        recordStoreEvent('storage-maintenance:' + (aggressive ? 'aggressive' : 'normal'), result);
        return result;
      }
    }catch(maintenanceErr){
      recordStoreEvent('storage-maintenance:error', { reason:String(reason || ''), aggressive:!!aggressive, message:String(maintenanceErr && maintenanceErr.message || maintenanceErr || 'błąd') });
    }
    return null;
  }

  function tryWriteRawSnapshot(raw){
    localStorage.setItem(SNAPSHOT_KEY, raw);
    invalidateDirtyCache();
  }

  function cleanupStaleEditSessionBeforeWrite(reason){
    try{
      const api = FC.quoteSnapshotStorageMaintenance;
      if(api && typeof api.cleanupStaleEditSession === 'function'){
        const result = api.cleanupStaleEditSession({ reason:String(reason || 'writeAll') });
        if(result && (result.removed || result.wouldRemove)) recordStoreEvent('edit-session:cleanup-before-write', result);
        return result;
      }
    }catch(err){
      recordStoreEvent('edit-session:cleanup-error', { reason:String(reason || ''), message:String(err && err.message || err || 'błąd') });
    }
    return null;
  }

  function writeSnapshotRowsStrict(rows, reason){
    const list = Array.isArray(rows) ? rows : [];
    cleanupStaleEditSessionBeforeWrite(reason || 'writeAll');
    const raw = JSON.stringify(list);
    let firstError = null;
    try{ tryWriteRawSnapshot(raw); }
    catch(err){ firstError = err; }
    if(firstError){
      const normalMaintenance = runStorageMaintenance(reason || 'writeAll', list, false, firstError);
      try{ localStorage.removeItem(SNAPSHOT_KEY); invalidateDirtyCache(); }catch(_){ }
      try{ tryWriteRawSnapshot(raw); firstError = null; }
      catch(secondErr){
        const aggressiveMaintenance = runStorageMaintenance(reason || 'writeAll', list, true, secondErr);
        try{ localStorage.removeItem(SNAPSHOT_KEY); invalidateDirtyCache(); }catch(_){ }
        try{ tryWriteRawSnapshot(raw); firstError = null; }
        catch(err){
          recordStoreEvent('write:error', { reason:String(reason || ''), count:list.length, bytes:bytes(raw), message:String(err && err.message || err || 'błąd'), firstMessage:String(firstError && firstError.message || firstError || ''), normalMaintenance, aggressiveMaintenance });
          throw createStorageWriteError('Nie udało się zapisać historii WYCENY. Magazyn przeglądarki nadal jest pełny po odchudzeniu cache, starych backupów i ciężkich danych technicznych.', { reason:String(reason || ''), count:list.length, bytes:bytes(raw), normalMaintenance, aggressiveMaintenance }, err || firstError);
        }
      }
    }
    const stored = rawSnapshotStorage();
    const parsed = safeParseRows(stored);
    const parsedRows = Array.isArray(parsed) ? parsed : [];
    const ids = list.map(snapshotId).filter(Boolean);
    const missingIds = ids.filter((id)=> !parsedRows.some((row)=> snapshotId(row) === id));
    if(!Array.isArray(parsed) || parsedRows.length !== list.length || missingIds.length){
      recordStoreEvent('write:verify-failed', { reason:String(reason || ''), requestedCount:list.length, storedCount:Array.isArray(parsed) ? parsedRows.length : null, parseError:parsed && parsed.__error ? parsed.message : '', missingIds, requestedBytes:bytes(raw), storedBytes:bytes(stored) });
      throw createStorageWriteError('Historia WYCENY nie została poprawnie zapisana w przeglądarce.', { reason:String(reason || ''), requestedCount:list.length, storedCount:Array.isArray(parsed) ? parsedRows.length : null, missingIds }, null);
    }
    return list;
  }
  function readStoredCurrentRows(){
    const parsed = safeParseRows(rawSnapshotStorage());
    if(!Array.isArray(parsed)) return [];
    return parsed.filter(isCurrentStoredSnapshot);
  }
  function purgeLegacyStoredRows(reason){
    const parsed = safeParseRows(rawSnapshotStorage());
    if(!Array.isArray(parsed)) return { changed:false, beforeCount:0, afterCount:0 };
    const kept = parsed.filter(isCurrentStoredSnapshot);
    if(kept.length === parsed.length) return { changed:false, beforeCount:parsed.length, afterCount:kept.length };
    try{
      writeSnapshotRowsStrict(kept, reason || 'purge-legacy-snapshots');
      recordStoreEvent('legacy:purged', { reason:String(reason || ''), beforeCount:parsed.length, afterCount:kept.length, removed:parsed.length - kept.length });
      return { changed:true, beforeCount:parsed.length, afterCount:kept.length, removed:parsed.length - kept.length };
    }catch(err){
      recordStoreEvent('legacy:purge-error', { reason:String(reason || ''), message:String(err && err.message || err || 'błąd') });
      return { changed:false, error:String(err && err.message || err || 'błąd'), beforeCount:parsed.length, afterCount:kept.length };
    }
  }

  function normalizeStatus(value){
    return String(value || '').trim().toLowerCase();
  }

  const quoteSnapshotScope = FC.quoteSnapshotScope || null;

  function requireScopeHelper(name){
    const fn = quoteSnapshotScope && quoteSnapshotScope[name];
    if(typeof fn !== 'function') throw new Error('Brak FC.quoteSnapshotScope.' + name);
    return fn;
  }

  const normalizeMaterialScope = requireScopeHelper('normalizeMaterialScope');
  const materialScopeMode = requireScopeHelper('materialScopeMode');
  const isPreliminarySnapshot = requireScopeHelper('isPreliminarySnapshot');
  const normalizeRoomIds = requireScopeHelper('normalizeRoomIds');
  const getScopeRoomLabels = requireScopeHelper('getScopeRoomLabels');
  const buildScopedVersionName = requireScopeHelper('buildScopedVersionName');
  const buildCanonicalScope = requireScopeHelper('buildCanonicalScope');
  const getCanonicalDefaultVersionName = requireScopeHelper('getCanonicalDefaultVersionName');
  const parseAutoVersionName = requireScopeHelper('parseAutoVersionName');
  const coerceAutoVersionNameForScope = requireScopeHelper('coerceAutoVersionNameForScope');
  const getSnapshotRoomIds = requireScopeHelper('getSnapshotRoomIds');
  const sameRoomScope = requireScopeHelper('sameRoomScope');
  const normalizeComparableVersionName = requireScopeHelper('normalizeComparableVersionName');
  const escapeRegExp = requireScopeHelper('escapeRegExp');
  const matchesOwnAutoVersionName = requireScopeHelper('matchesOwnAutoVersionName');
  const snapshotScopeOverlaps = requireScopeHelper('snapshotScopeOverlaps');
  const resolveSelectionScopeRoomIds = requireScopeHelper('resolveSelectionScopeRoomIds');
  const listSelectionImpactedRows = requireScopeHelper('listSelectionImpactedRows');
  const isRejectedSnapshot = requireScopeHelper('isRejectedSnapshot');
  const shouldRejectPreviousSelection = requireScopeHelper('shouldRejectPreviousSelection');
  const getRejectReason = requireScopeHelper('getRejectReason');
  const filterRowsByRoomScope = requireScopeHelper('filterRowsByRoomScope');
  const filterRowsByQuoteType = requireScopeHelper('filterRowsByQuoteType');


  function roundFingerprintNumber(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return 0;
    return Math.round(n * 10000) / 10000;
  }

  function compactText(value){ return String(value == null ? '' : value).trim().replace(/\s+/g, ' '); }

  function stableCanonical(value){
    if(value == null) return null;
    if(typeof value === 'number') return roundFingerprintNumber(value);
    if(typeof value === 'boolean') return !!value;
    if(typeof value === 'string') return compactText(value);
    if(Array.isArray(value)) return value.map(stableCanonical);
    if(typeof value === 'object'){
      const out = {};
      Object.keys(value).sort().forEach((key)=>{ out[key] = stableCanonical(value[key]); });
      return out;
    }
    return compactText(value);
  }


  function hasValue(value){ return value != null && value !== '' && value !== false; }
  function addText(out, key, value){ const v = compactText(value); if(v) out[key] = v; }
  function addNumber(out, key, value, opts){
    const cfg = opts && typeof opts === 'object' ? opts : {};
    const n = Number(value);
    if(!Number.isFinite(n)){
      if(cfg.always) out[key] = 0;
      return;
    }
    const rounded = roundFingerprintNumber(n);
    if(cfg.always || rounded !== 0) out[key] = rounded;
  }
  function addBool(out, key, value){ if(value === true) out[key] = true; }
  function compactWarnings(value){
    const rows = Array.isArray(value) ? value : [];
    return rows.map((row)=> compactText(row && row.message || row)).filter(Boolean).slice(0, 20);
  }
  function assignWarnings(out, value){ const warnings = compactWarnings(value); if(warnings.length) out.warnings = warnings; }

  function compactQuoteLine(row, opts){
    const src = row && typeof row === 'object' ? row : {};
    const cfg = opts && typeof opts === 'object' ? opts : {};
    const out = {};
    addText(out, 'key', src.key || src.id);
    addText(out, 'type', src.type || cfg.type);
    addText(out, 'category', src.category);
    addText(out, 'subsection', src.subsection);
    addText(out, 'name', src.name || cfg.defaultName);
    addNumber(out, 'qty', src.qty != null ? src.qty : src.quantity, { always: cfg.keepMoney !== false });
    addText(out, 'unit', src.unit || cfg.unit);
    if(cfg.keepMoney !== false){
      addNumber(out, 'unitPrice', src.unitPrice != null ? src.unitPrice : src.price, { always:true });
      addNumber(out, 'total', src.total, { always:true });
      addText(out, 'priceUnit', src.priceUnit);
      addText(out, 'pricingMode', src.pricingMode);
      addBool(out, 'starterPrice', src.starterPrice === true);
      addText(out, 'priceUserEditedAt', src.priceUserEditedAt || src.userEditedAt);
    }
    addText(out, 'rooms', src.rooms);
    addText(out, 'note', src.note);
    addText(out, 'source', src.source);
    addText(out, 'sourceType', src.sourceType);
    addText(out, 'sourceLabel', src.sourceLabel);
    addText(out, 'sourceId', src.sourceId);
    addText(out, 'sourceRole', src.sourceRole);
    addText(out, 'sourceKind', src.sourceKind);
    addText(out, 'quantitySource', src.quantitySource);
    addNumber(out, 'quantitySourceValue', src.quantitySourceValue);
    addText(out, 'quantitySourceDisplay', src.quantitySourceDisplay);
    addText(out, 'calculation', src.calculation || src.calculationNote);
    addNumber(out, 'width', src.width);
    addNumber(out, 'height', src.height);
    addText(out, 'materialLabel', src.materialLabel);
    assignWarnings(out, src.warnings);
    return out;
  }

  function compactElementLine(row){
    const src = row && typeof row === 'object' ? row : {};
    const out = {};
    addText(out, 'key', src.key || src.id);
    addText(out, 'type', src.type || 'element');
    addText(out, 'category', src.category || 'Element');
    addText(out, 'name', src.name || 'Element');
    addNumber(out, 'qty', src.qty != null ? src.qty : src.quantity, { always:true });
    addText(out, 'unit', src.unit || 'szt.');
    addText(out, 'rooms', src.rooms);
    addNumber(out, 'width', src.width);
    addNumber(out, 'height', src.height);
    addText(out, 'materialLabel', src.materialLabel);
    assignWarnings(out, src.warnings);
    return out;
  }

  function compactConditionList(rows){
    return (Array.isArray(rows) ? rows : []).map((row)=>{
      const src = row && typeof row === 'object' ? row : {};
      const out = {};
      addText(out, 'source', src.source || src.code || src.key);
      addText(out, 'label', src.label || src.name);
      addText(out, 'operator', src.operator || src.op);
      if(hasValue(src.value)) out.value = typeof src.value === 'number' ? roundFingerprintNumber(src.value) : compactText(src.value);
      if(hasValue(src.min)) out.min = typeof src.min === 'number' ? roundFingerprintNumber(src.min) : compactText(src.min);
      if(hasValue(src.max)) out.max = typeof src.max === 'number' ? roundFingerprintNumber(src.max) : compactText(src.max);
      addText(out, 'displayValue', src.displayValue || src.display);
      return Object.keys(out).length ? out : null;
    }).filter(Boolean).slice(0, 12);
  }

  function compactLaborComponent(component){
    const src = component && typeof component === 'object' ? component : {};
    const out = {};
    addText(out, 'key', src.key || src.id);
    addText(out, 'name', src.name);
    addText(out, 'category', src.category);
    addNumber(out, 'quantity', src.quantity, { always:true });
    addText(out, 'unit', src.unit);
    addText(out, 'rateType', src.rateType);
    addNumber(out, 'hourlyRate', src.hourlyRate);
    addNumber(out, 'hours', src.hours);
    addNumber(out, 'baseHours', src.baseHours);
    addNumber(out, 'volumeHours', src.volumeHours);
    addNumber(out, 'multiplier', src.multiplier);
    addNumber(out, 'volumeM3', src.volumeM3);
    addNumber(out, 'volumePrice', src.volumePrice);
    addNumber(out, 'fixedPrice', src.fixedPrice);
    addNumber(out, 'unitPrice', src.unitPrice);
    addNumber(out, 'total', src.total, { always:true });
    addText(out, 'quantitySource', src.quantitySource);
    addText(out, 'quantitySourceLabel', src.quantitySourceLabel);
    addNumber(out, 'quantitySourceValue', src.quantitySourceValue);
    addText(out, 'quantitySourceDisplay', src.quantitySourceDisplay);
    if(src.quantitySourceUsed === true) out.quantitySourceUsed = true;
    addText(out, 'quantityMode', src.quantityMode);
    addNumber(out, 'timeBlockHours', src.timeBlockHours);
    addText(out, 'rateType', src.rateType);
    addNumber(out, 'hourlyRate', src.hourlyRate);
    addNumber(out, 'hours', src.hours);
    addNumber(out, 'baseHours', src.baseHours);
    addNumber(out, 'volumeHours', src.volumeHours);
    addNumber(out, 'multiplier', src.multiplier);
    addNumber(out, 'volumeM3', src.volumeM3);
    addNumber(out, 'volumePrice', src.volumePrice);
    addNumber(out, 'fixedPrice', src.fixedPrice);
    addText(out, 'sourceRole', src.sourceRole);
    addText(out, 'sourceKind', src.sourceKind);
    addText(out, 'skippedReason', src.skippedReason);
    addText(out, 'sourceType', src.sourceType);
    addText(out, 'sourceLabel', src.sourceLabel);
    addText(out, 'sourceId', src.sourceId);
    addText(out, 'sourceRole', src.sourceRole);
    addText(out, 'sourceKind', src.sourceKind);
    addText(out, 'note', src.note);
    addText(out, 'calculation', src.calculation || src.calculationNote);
    addBool(out, 'starterPrice', src.starterPrice === true && !compactText(src.priceUserEditedAt || src.userEditedAt));
    addText(out, 'priceUserEditedAt', src.priceUserEditedAt || src.userEditedAt);
    assignWarnings(out, src.warnings);
    const matched = compactConditionList(src.matchedConditions);
    if(matched.length) out.matchedConditions = matched;
    return out;
  }

  function compactLaborLine(row){
    const src = row && typeof row === 'object' ? row : {};
    const out = compactQuoteLine(src, { type:src.type || 'labor-cabinet', defaultName:'Robocizna szafki' });
    addNumber(out, 'cabinetNumber', src.cabinetNumber);
    addText(out, 'cabinetId', src.cabinetId);
    addText(out, 'roomId', src.roomId);
    addText(out, 'dimensions', src.dimensions);
    addNumber(out, 'volumeM3', src.volumeM3);
    addNumber(out, 'hours', src.hours);
    const details = (Array.isArray(src.details) ? src.details : []).map(compactLaborComponent).filter((item)=> item && Object.keys(item).length);
    if(details.length) out.details = details;
    return out;
  }

  function compactRegisterLine(row){
    const src = row && typeof row === 'object' ? row : {};
    const out = {};
    addText(out, 'id', src.id || src.key);
    addText(out, 'section', src.section);
    addText(out, 'sectionLabel', src.sectionLabel);
    addText(out, 'subsection', src.subsection);
    addText(out, 'sourceType', src.sourceType);
    addText(out, 'sourceLabel', src.sourceLabel);
    addText(out, 'sourceId', src.sourceId);
    addText(out, 'quantitySource', src.quantitySource);
    addText(out, 'quantitySourceLabel', src.quantitySourceLabel);
    addNumber(out, 'quantitySourceValue', src.quantitySourceValue);
    addText(out, 'quantitySourceDisplay', src.quantitySourceDisplay);
    if(src.quantitySourceUsed === true) out.quantitySourceUsed = true;
    const conditions = compactConditionList(src.conditions);
    if(conditions.length) out.conditions = conditions;
    const matchedConditions = compactConditionList(src.matchedConditions);
    if(matchedConditions.length) out.matchedConditions = matchedConditions;
    addText(out, 'skippedReason', src.skippedReason);
    addNumber(out, 'timeBlockHours', src.timeBlockHours);
    addText(out, 'quantityMode', src.quantityMode);
    addText(out, 'name', src.name || 'Pozycja');
    addNumber(out, 'quantity', src.quantity, { always:true });
    addText(out, 'unit', src.unit);
    addNumber(out, 'unitPrice', src.unitPrice, { always:true });
    addNumber(out, 'total', src.total, { always:true });
    addText(out, 'rooms', src.rooms);
    addText(out, 'note', src.note);
    addText(out, 'calculation', src.calculation || src.calculationNote);
    addBool(out, 'starterPrice', src.starterPrice === true);
    addText(out, 'priceUserEditedAt', src.priceUserEditedAt || src.userEditedAt);
    assignWarnings(out, src.warnings);
    return out;
  }

  function compactCalculationRegister(register, lines, commercial){
    let src = register && typeof register === 'object' ? register : null;
    try{
      if(!src && FC.quoteCalculationRegister && typeof FC.quoteCalculationRegister.buildRegister === 'function') src = FC.quoteCalculationRegister.buildRegister(lines || {}, commercial || {});
      if(src && FC.quoteCalculationRegister && typeof FC.quoteCalculationRegister.normalizeRegister === 'function') src = FC.quoteCalculationRegister.normalizeRegister(src);
    }catch(_){ }
    if(!src || typeof src !== 'object') return null;
    const out = {
      schema:compactText(src.schema || 'quote-calculation-register-v1'),
      generatedAt:Number(src.generatedAt) > 0 ? Number(src.generatedAt) : Date.now(),
      lines:(Array.isArray(src.lines) ? src.lines : []).map(compactRegisterLine).filter((row)=> compactText(row.section)),
      totals:clone(src.totals || {}),
    };
    if(src.sections && typeof src.sections === 'object') out.sections = clone(src.sections);
    const warnings = Array.isArray(src.warnings) ? src.warnings.map((row)=> ({
      key:compactText(row && row.key),
      section:compactText(row && row.section),
      sectionLabel:compactText(row && row.sectionLabel),
      message:compactText(row && row.message || row),
    })).filter((row)=> row.message).slice(0, 40) : [];
    if(warnings.length) out.warnings = warnings;
    return out;
  }

  function compactSnapshotLines(lines){
    const src = lines && typeof lines === 'object' ? lines : {};
    return {
      materials:(Array.isArray(src.materials) ? src.materials : []).map((row)=> compactQuoteLine(row, { type:'material', defaultName:'Materiał' })),
      elements:(Array.isArray(src.elements) ? src.elements : []).map(compactElementLine),
      accessories:(Array.isArray(src.accessories) ? src.accessories : []).map((row)=> compactQuoteLine(row, { type:'accessory', defaultName:'Akcesorium' })),
      agdServices:(Array.isArray(src.agdServices) ? src.agdServices : []).map((row)=> compactQuoteLine(row, { type:'agd-service', defaultName:'Montaż AGD' })),
      quoteRates:(Array.isArray(src.quoteRates) ? src.quoteRates : []).map((row)=> compactQuoteLine(row, { type:'quote-rate', defaultName:'Robocizna / stawka' })),
      labor:(Array.isArray(src.labor) ? src.labor : []).map(compactLaborLine),
    };
  }

  function jsonBytes(value){ try{ return JSON.stringify(value == null ? null : value).length; }catch(_){ return 0; } }
  function snapshotSizeBreakdown(snapshot){
    const src = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const normalized = normalizeSnapshot(src, { preserveExplicitLabels:true });
    const lines = normalized.lines || {};
    return {
      rawBytes:jsonBytes(src),
      storageBytes:jsonBytes(normalized),
      estimate30StorageBytes:jsonBytes(normalized) * 30,
      storageSchema:compactText(normalized.meta && normalized.meta.storageSchema),
      lineCounts:normalized.meta && normalized.meta.lineCounts || {},
      parts:{
        investor:jsonBytes(normalized.investor),
        project:jsonBytes(normalized.project),
        scope:jsonBytes(normalized.scope),
        commercial:jsonBytes(normalized.commercial),
        totals:jsonBytes(normalized.totals),
        meta:jsonBytes(normalized.meta),
        calculationRegister:jsonBytes(normalized.calculationRegister),
        linesMaterials:jsonBytes(lines.materials),
        linesElements:jsonBytes(lines.elements),
        linesAccessories:jsonBytes(lines.accessories),
        linesAgdServices:jsonBytes(lines.agdServices),
        linesQuoteRates:jsonBytes(lines.quoteRates),
        linesLabor:jsonBytes(lines.labor),
      },
    };
  }

  function lineFingerprint(row){
    const src = row && typeof row === 'object' ? row : {};
    const out = {
      key:compactText(src.key || ''),
      type:compactText(src.type || ''),
      category:compactText(src.category || ''),
      name:compactText(src.name || ''),
      qty:roundFingerprintNumber(src.qty),
      unit:compactText(src.unit || ''),
      unitPrice:roundFingerprintNumber(src.unitPrice),
      total:roundFingerprintNumber(src.total),
      rooms:compactText(src.rooms || ''),
      note:compactText(src.note || ''),
      source:compactText(src.source || ''),
      width:roundFingerprintNumber(src.width),
      height:roundFingerprintNumber(src.height),
      materialLabel:compactText(src.materialLabel || ''),
    };
    if(src.cabinetNumber != null) out.cabinetNumber = roundFingerprintNumber(src.cabinetNumber);
    if(src.cabinetId != null) out.cabinetId = compactText(src.cabinetId || '');
    if(src.roomId != null) out.roomId = compactText(src.roomId || '');
    if(src.dimensions != null) out.dimensions = compactText(src.dimensions || '');
    if(src.volumeM3 != null) out.volumeM3 = roundFingerprintNumber(src.volumeM3);
    if(src.hours != null) out.hours = roundFingerprintNumber(src.hours);
    if(Array.isArray(src.details)){
      out.details = src.details.map((detail)=> stableCanonical(detail)).sort((a,b)=> JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    return out;
  }

  function linesFingerprint(rows){
    return (Array.isArray(rows) ? rows : [])
      .map(lineFingerprint)
      .sort((a,b)=> JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }

  function hashString32(value, seed){
    const textValue = String(value == null ? '' : value);
    let h = (Number(seed) >>> 0) || 2166136261;
    for(let i = 0; i < textValue.length; i += 1){
      h ^= textValue.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  function quoteFingerprintPayload(snapshot){
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const scope = buildCanonicalScope(snap.scope || {}, { preserveExplicitLabels:true });
    const commercial = snap.commercial && typeof snap.commercial === 'object' ? snap.commercial : {};
    const totals = snap.totals && typeof snap.totals === 'object' ? snap.totals : {};
    const lines = snap.lines && typeof snap.lines === 'object' ? snap.lines : {};
    return {
      projectId: compactText(snap.project && snap.project.id || ''),
      investorId: compactText(snap.investor && snap.investor.id || snap.project && snap.project.investorId || ''),
      preliminary: isPreliminarySnapshot(snap),
      scope: {
        selectedRooms: normalizeRoomIds(scope.selectedRooms).sort(),
        materialScope: normalizeMaterialScope(scope.materialScope),
        materialScopeMode: compactText(scope.materialScopeMode || materialScopeMode(scope.materialScope)),
      },
      commercial: {
        discountPercent: roundFingerprintNumber(commercial.discountPercent),
        discountAmount: roundFingerprintNumber(commercial.discountAmount),
        offerValidity: compactText(commercial.offerValidity || ''),
        leadTime: compactText(commercial.leadTime || ''),
        deliveryTerms: compactText(commercial.deliveryTerms || ''),
        customerNote: compactText(commercial.customerNote || ''),
      },
      totals: {
        materials: roundFingerprintNumber(totals.materials),
        accessories: roundFingerprintNumber(totals.accessories),
        services: roundFingerprintNumber(totals.services),
        quoteRates: roundFingerprintNumber(totals.quoteRates),
        transport: roundFingerprintNumber(totals.transport),
        labor: roundFingerprintNumber(totals.labor),
        subtotal: roundFingerprintNumber(totals.subtotal),
        discount: roundFingerprintNumber(totals.discount),
        grand: roundFingerprintNumber(totals.grand),
      },
      lines: {
        materials: linesFingerprint(lines.materials),
        elements: linesFingerprint(lines.elements),
        accessories: linesFingerprint(lines.accessories),
        agdServices: linesFingerprint(lines.agdServices),
        quoteRates: linesFingerprint(lines.quoteRates),
        labor: linesFingerprint(lines.labor),
      },
      calculationRegister: linesFingerprint(snapshot && snapshot.calculationRegister && snapshot.calculationRegister.lines),
    };
  }

  function quoteFingerprint(snapshot){
    const canonical = JSON.stringify(stableCanonical(quoteFingerprintPayload(snapshot)));
    // Nie zapisujemy pełnego JSON-a porównawczego w meta snapshotu.
    // Pełny payload miał kilkadziesiąt KB i puchł przy 30 ofertach; do porównania wariantów wystarcza stabilny odcisk.
    return 'qfp2:' + canonical.length + ':' + hashString32(canonical, 2166136261) + ':' + hashString32(canonical, 2654435769);
  }

  function isCompactQuoteFingerprint(value){
    return /^qfp2:\d+:[0-9a-f]{8}:[0-9a-f]{8}$/.test(compactText(value));
  }

  function getQuoteFingerprint(snapshot){
    try{ return quoteFingerprint(snapshot); }
    catch(_){ return ''; }
  }

  function sameQuoteFingerprint(left, right){
    const a = getQuoteFingerprint(left);
    const b = getQuoteFingerprint(right);
    return !!a && !!b && a === b;
  }

  function defaultVersionName(preliminary, options){
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.defaultVersionName === 'function') return FC.quoteSnapshot.defaultVersionName(preliminary, options || {});
    }catch(_){ }
    return preliminary ? 'Wstępna oferta' : 'Oferta';
  }

  function normalizeSnapshot(snapshot, options){
    const src = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const srcMeta = src.meta && typeof src.meta === 'object' ? src.meta : {};
    const preliminary = isPreliminarySnapshot(src);
    const acceptedStage = String(src.meta && src.meta.acceptedStage || (src.meta && src.meta.selectedByClient ? (preliminary ? 'pomiar' : 'zaakceptowany') : '') || '');
    const opts = options && typeof options === 'object' ? options : {};
    const scope = buildCanonicalScope(src.scope || {}, opts);
    const versionName = String(src.meta && src.meta.versionName || src.commercial && src.commercial.versionName || '').trim() || getCanonicalDefaultVersionName({ scope, commercial:{ preliminary }, meta:{ preliminary } }, opts);
    const rawLines = src.lines && typeof src.lines === 'object' ? src.lines : {};
    const commercial = Object.assign({}, clone(src.commercial || {}), { versionName });
    const lines = compactSnapshotLines(rawLines);
    const calculationRegister = compactCalculationRegister(src.calculationRegister || rawLines.calculationRegister, rawLines, commercial);
    const out = {
      version: SNAPSHOT_STORAGE_VERSION,
      id: String(src.id || uid()),
      generatedAt: Number(src.generatedAt) > 0 ? Number(src.generatedAt) : Date.now(),
      investor: src.investor ? clone(src.investor) : null,
      project: src.project ? clone(src.project) : null,
      scope,
      lines,
      calculationRegister,
      commercial,
      totals: clone(src.totals || (calculationRegister && calculationRegister.totals) || {}),
      meta: {
        source:String(src.meta && src.meta.source || 'quote-snapshot-slim'),
        storageSchema: SNAPSHOT_STORAGE_SCHEMA,
        versionName,
        selectedByClient: !!(src.meta && src.meta.selectedByClient),
        acceptedAt: Number(src.meta && src.meta.acceptedAt) > 0 ? Number(src.meta.acceptedAt) : 0,
        acceptedStage,
        rejectedAt: Number(src.meta && src.meta.rejectedAt) > 0 ? Number(src.meta.rejectedAt) : 0,
        rejectedReason: String(src.meta && src.meta.rejectedReason || '').trim().toLowerCase(),
        preliminary,
        lineCounts: {
          materials: lines.materials.length,
          elements: lines.elements.length,
          accessories: lines.accessories.length,
          agdServices: lines.agdServices.length,
          quoteRates: lines.quoteRates.length,
          labor: lines.labor.length,
          calculationRegister: calculationRegister && Array.isArray(calculationRegister.lines) ? calculationRegister.lines.length : 0,
        },
        unsavedDueToStorage: !!(srcMeta.unsavedDueToStorage || srcMeta.unsavedStorage || srcMeta.unsavedPreview || src.__unsavedDueToStorage),
        storageWarning: String(srcMeta.storageWarning || srcMeta.unsavedStorageWarning || '').trim(),
        storageErrorCode: String(srcMeta.storageErrorCode || '').trim(),
        storageErrorMessage: String(srcMeta.storageErrorMessage || src.__storageErrorMessage || '').trim(),
        quoteFingerprint:'',
      }
    };
    const storedFingerprint = compactText(srcMeta.quoteFingerprint || src.meta && src.meta.quoteFingerprint || '');
    out.meta.quoteFingerprint = isCompactQuoteFingerprint(storedFingerprint) ? storedFingerprint : getQuoteFingerprint(out);
    if(src.__test === true || srcMeta.__test === true || srcMeta.testData){
      out.__test = true;
      out.__testRunId = String(src.__testRunId || srcMeta.__testRunId || srcMeta.testRunId || '');
      out.meta.__test = true;
      out.meta.__testRunId = out.__testRunId;
      out.meta.testData = true;
      out.meta.testOwner = String(srcMeta.testOwner || 'dev-tests');
      out.meta.testRunId = out.__testRunId;
    }
    return out;
  }

  function readAll(){
    const rows = readStoredCurrentRows();
    return rows.map((row)=> normalizeSnapshot(row, { canonicalizeLabels:true })).sort((a,b)=> Number(b.generatedAt || 0) - Number(a.generatedAt || 0));
  }

  function limitSnapshotHistory(rows){
    const src = (Array.isArray(rows) ? rows : []).slice().sort((a,b)=> Number(b && b.generatedAt || 0) - Number(a && a.generatedAt || 0));
    const groups = new Map();
    src.forEach((row)=>{
      const pid = String(row && row.project && row.project.id || row && row.projectId || 'bez-projektu');
      if(!groups.has(pid)) groups.set(pid, []);
      groups.get(pid).push(row);
    });
    const kept = [];
    groups.forEach((groupRows)=>{
      const selected = groupRows.filter((row)=> !!(row && row.meta && row.meta.selectedByClient));
      const selectedIds = new Set(selected.map((row)=> String(row && row.id || '')).filter(Boolean));
      const newest = groupRows.filter((row)=> !selectedIds.has(String(row && row.id || ''))).slice(0, MAX_SNAPSHOTS_PER_PROJECT);
      selected.concat(newest).forEach((row)=>{
        const id = String(row && row.id || '');
        if(id && !kept.some((item)=> String(item && item.id || '') === id)) kept.push(row);
      });
    });
    const sorted = kept.sort((a,b)=> Number(b && b.generatedAt || 0) - Number(a && a.generatedAt || 0));
    if(sorted.length <= MAX_SNAPSHOTS_TOTAL) return sorted;
    const selected = sorted.filter((row)=> !!(row && row.meta && row.meta.selectedByClient));
    const selectedIds = new Set(selected.map((row)=> String(row && row.id || '')).filter(Boolean));
    return selected.concat(sorted.filter((row)=> !selectedIds.has(String(row && row.id || ''))).slice(0, Math.max(0, MAX_SNAPSHOTS_TOTAL - selected.length)));
  }

  function writeAll(list){
    const rows = limitSnapshotHistory(Array.isArray(list) ? list.map((row)=> normalizeSnapshot(row, { preserveExplicitLabels:true })) : []);
    writeSnapshotRowsStrict(rows, 'writeAll');
    return rows;
  }

  function getById(id){
    const key = String(id || '');
    if(!key) return null;
    return readAll().find((row)=> String(row && row.id || '') === key) || null;
  }

  function save(snapshot){
    const beforeRaw = rawSnapshotStorage();
    const beforeParsed = safeParseRows(beforeRaw);
    const list = readAll();
    const normalized = normalizeSnapshot(snapshot, { preserveExplicitLabels:true });
    const normalizedId = String(normalized && normalized.id || '');
    const normalizedProjectId = String(normalized && normalized.project && normalized.project.id || '');
    const projectRows = list.filter((row)=> String(row && row.project && row.project.id || '') === normalizedProjectId);
    const beforeProjectRows = projectRows.length;
    recordStoreEvent('save:before', {
      id:normalizedId,
      projectId:normalizedProjectId,
      beforeBytes:bytes(beforeRaw),
      beforeRawCount:Array.isArray(beforeParsed) ? beforeParsed.length : null,
      beforeParseError:beforeParsed && beforeParsed.__error ? beforeParsed.message : '',
      beforeReadAllCount:list.length,
      beforeProjectRows,
      beforeHasId:list.some((row)=> String(row && row.id || '') === normalizedId),
      versionName:String(normalized && normalized.commercial && normalized.commercial.versionName || normalized && normalized.meta && normalized.meta.versionName || ''),
    });
    const coercedVersionName = coerceAutoVersionNameForScope(normalized, projectRows);
    if(coercedVersionName){
      normalized.commercial = Object.assign({}, normalized.commercial || {}, { versionName:coercedVersionName });
      normalized.meta = Object.assign({}, normalized.meta || {}, { versionName:coercedVersionName });
    }
    const next = list.filter((row)=> String(row.id || '') !== String(normalized.id || ''));
    next.unshift(normalized);
    const writtenRows = writeAll(next);
    const afterRaw = rawSnapshotStorage();
    const afterParsed = safeParseRows(afterRaw);
    const afterRows = readAll();
    const visible = afterRows.some((row)=> String(row && row.id || '') === normalizedId);
    recordStoreEvent('save:after', {
      id:normalizedId,
      projectId:normalizedProjectId,
      coercedVersionName:String(coercedVersionName || ''),
      returnedVersionName:String(normalized && normalized.commercial && normalized.commercial.versionName || normalized && normalized.meta && normalized.meta.versionName || ''),
      requestedWriteCount:Array.isArray(writtenRows) ? writtenRows.length : null,
      afterBytes:bytes(afterRaw),
      afterRawCount:Array.isArray(afterParsed) ? afterParsed.length : null,
      afterParseError:afterParsed && afterParsed.__error ? afterParsed.message : '',
      afterReadAllCount:afterRows.length,
      afterProjectRows:afterRows.filter((row)=> String(row && row.project && row.project.id || '') === normalizedProjectId).length,
      visible,
      rawChanged:String(beforeRaw || '') !== String(afterRaw || ''),
      firstRows:summarizeStoreRows(afterRows, 5),
    });
    if(!visible){
      throw createStorageWriteError('Snapshot WYCENY został zbudowany, ale nie jest widoczny w historii po zapisie.', { id:normalizedId, projectId:normalizedProjectId, afterReadAllCount:afterRows.length, afterRawCount:Array.isArray(afterParsed) ? afterParsed.length : null }, null);
    }
    return normalized;
  }

  function cleanupRemovedSnapshotReferences(snapshotId){
    const sid = String(snapshotId || '').trim();
    if(!sid) return false;
    let changed = false;
    try{
      if(FC.session && typeof FC.session.cleanupSnapshotReferences === 'function'){
        changed = !!FC.session.cleanupSnapshotReferences(sid) || changed;
      }
    }catch(_){ }
    return changed;
  }

  function remove(id){
    const key = String(id || '');
    if(!key) return false;
    const beforeRaw = rawSnapshotStorage();
    const list = readAll();
    const next = list.filter((row)=> String(row && row.id || '') !== key);
    recordStoreEvent('remove:before', {
      id:key,
      beforeBytes:bytes(beforeRaw),
      beforeCount:list.length,
      beforeHasId:list.some((row)=> String(row && row.id || '') === key),
      beforeRows:summarizeStoreRows(list, 6),
    });
    if(next.length === list.length){
      recordStoreEvent('remove:noop', { id:key, count:list.length });
      return false;
    }
    writeAll(next);
    cleanupRemovedSnapshotReferences(key);
    const afterRaw = rawSnapshotStorage();
    const afterRows = readAll();
    const stillVisible = afterRows.some((row)=> String(row && row.id || '') === key);
    recordStoreEvent('remove:after', {
      id:key,
      afterBytes:bytes(afterRaw),
      afterCount:afterRows.length,
      stillVisible,
      rawChanged:String(beforeRaw || '') !== String(afterRaw || ''),
      afterRows:summarizeStoreRows(afterRows, 6),
    });
    return true;
  }


  function findDuplicateSnapshot(snapshot, options){
    const opts = options && typeof options === 'object' ? options : {};
    const candidate = normalizeSnapshot(snapshot, { preserveExplicitLabels:true });
    const fingerprint = getQuoteFingerprint(candidate);
    if(!fingerprint) return null;
    const projectId = String(candidate && candidate.project && candidate.project.id || '').trim();
    if(!projectId) return null;
    const ignoreId = String(opts.ignoreId || candidate.id || '').trim();
    const includeRejected = opts.includeRejected === true;
    const rows = listForProject(projectId);
    return rows.find((row)=> {
      if(!row) return false;
      if(ignoreId && String(row.id || '') === ignoreId) return false;
      if(!includeRejected && isRejectedSnapshot(row)) return false;
      if(isPreliminarySnapshot(row) !== isPreliminarySnapshot(candidate)) return false;
      return sameQuoteFingerprint(row, candidate);
    }) || null;
  }

  function replaceSnapshot(existingId, snapshot){
    const key = String(existingId || '').trim();
    if(!key) throw new Error('Brak ID oferty do zamiany.');
    const existing = getById(key);
    if(!existing) throw new Error('Nie znaleziono istniejącej oferty do zamiany.');
    const next = normalizeSnapshot(snapshot, { preserveExplicitLabels:true });
    const existingVersionName = String(existing && existing.commercial && existing.commercial.versionName || existing && existing.meta && existing.meta.versionName || '').trim();
    next.id = key;
    next.generatedAt = Date.now();
    try{ next.generatedDate = new Date(next.generatedAt).toISOString(); }catch(_){ next.generatedDate = ''; }
    next.commercial = Object.assign({}, next.commercial || {}, { versionName: existingVersionName || String(next.commercial && next.commercial.versionName || '') });
    next.meta = Object.assign({}, next.meta || {}, {
      versionName: existingVersionName || String(next.meta && next.meta.versionName || next.commercial && next.commercial.versionName || ''),
      selectedByClient: !!(existing && existing.meta && existing.meta.selectedByClient),
      acceptedAt: Number(existing && existing.meta && existing.meta.acceptedAt) > 0 ? Number(existing.meta.acceptedAt) : 0,
      acceptedStage: String(existing && existing.meta && existing.meta.acceptedStage || ''),
      rejectedAt: Number(existing && existing.meta && existing.meta.rejectedAt) > 0 ? Number(existing.meta.rejectedAt) : 0,
      rejectedReason: String(existing && existing.meta && existing.meta.rejectedReason || '').trim().toLowerCase(),
    });
    next.meta.quoteFingerprint = getQuoteFingerprint(next);
    return save(next);
  }

  function listForProject(projectId){
    const key = String(projectId || '');
    if(!key) return [];
    return readAll().filter((row)=> String(row && row.project && row.project.id || '') === key);
  }

  function listForInvestor(investorId){
    const key = String(investorId || '');
    if(!key) return [];
    return readAll().filter((row)=> String(row && row.investor && row.investor.id || '') === key);
  }

  function getLatestForProject(projectId){
    return listForProject(projectId)[0] || null;
  }

  function getSelectedForProject(projectId, options){
    const pid = String(projectId || '');
    if(!pid) return null;
    const opts = options && typeof options === 'object' ? options : {};
    const rows = listForProject(pid);
    const targetRoomIds = normalizeRoomIds(opts.roomIds);
    if(targetRoomIds.length){
      const exact = filterRowsByRoomScope(rows, targetRoomIds, { matchMode:'exact', allowProjectWideExact: !!opts.allowProjectWideExact });
      return exact.find((row)=> !!(row && row.meta && row.meta.selectedByClient)) || null;
    }
    return rows.find((row)=> !!(row && row.meta && row.meta.selectedByClient)) || null;
  }

  function hasFinalQuote(projectId){
    return listForProject(projectId).some((row)=> !isPreliminarySnapshot(row));
  }

  function getEffectiveVersionName(snapshot){
    const snap = normalizeSnapshot(snapshot);
    const current = String(snap && snap.commercial && snap.commercial.versionName || snap && snap.meta && snap.meta.versionName || '').trim();
    const fallback = getCanonicalDefaultVersionName(snap);
    if(!current) return fallback;
    if(matchesOwnAutoVersionName(snap, current)) return current;
    const projectId = String(snap && snap.project && snap.project.id || '').trim();
    const rows = projectId ? listForProject(projectId) : [];
    return coerceAutoVersionNameForScope(snap, rows) || fallback || current;
  }

  function listExactScopeSnapshots(projectId, roomIds, options){
    const pid = String(projectId || '');
    const ids = normalizeRoomIds(roomIds);
    const opts = options && typeof options === 'object' ? options : {};
    if(!pid || !ids.length) return [];
    const projectRows = listForProject(pid);
    const scopedRows = filterRowsByRoomScope(projectRows, ids, { matchMode:'exact', allowProjectWideExact: !!opts.allowProjectWideExact });
    return filterRowsByQuoteType(scopedRows, opts);
  }

  function findExactScopeSnapshot(projectId, roomIds, options){
    const rows = listExactScopeSnapshots(projectId, roomIds, options);
    return rows.find((row)=> !!(row && row.meta && row.meta.selectedByClient)) || rows[0] || null;
  }

  function listOverlappingScopeSnapshots(projectId, roomIds, options){
    const pid = String(projectId || '');
    const ids = normalizeRoomIds(roomIds);
    const opts = options && typeof options === 'object' ? options : {};
    if(!pid || !ids.length) return [];
    const projectRows = listForProject(pid);
    const overlapped = projectRows.filter((row)=> snapshotScopeOverlaps(row, ids));
    return filterRowsByQuoteType(overlapped, opts);
  }

  function removeSnapshotsForProjectRooms(projectId, roomIds, options){
    const pid = String(projectId || '');
    const ids = normalizeRoomIds(roomIds);
    const opts = options && typeof options === 'object' ? options : {};
    if(!pid || !ids.length) return [];
    const includeRejected = opts.includeRejected !== false;
    const list = readAll();
    const removed = [];
    const next = list.filter((row)=>{
      const sameProject = String(row && row.project && row.project.id || '') === pid;
      if(!sameProject) return true;
      if(!snapshotScopeOverlaps(row, ids)) return true;
      if(!includeRejected && isRejectedSnapshot(row)) return true;
      removed.push(row);
      return false;
    });
    if(removed.length) writeAll(next);
    return removed;
  }

  const quoteSnapshotSelection = FC.quoteSnapshotSelection || null;

  function requireSelectionFactory(){
    const factory = quoteSnapshotSelection && quoteSnapshotSelection.createApi;
    if(typeof factory !== 'function') throw new Error('Brak FC.quoteSnapshotSelection.createApi');
    return factory;
  }

  const selectionApi = requireSelectionFactory()({
    FINAL_STATUSES,
    normalizeStatus,
    readAll,
    writeAll,
    getById,
    listForProject,
    defaultVersionName,
    isPreliminarySnapshot,
    normalizeRoomIds,
    getSnapshotRoomIds,
    filterRowsByRoomScope,
    resolveSelectionScopeRoomIds,
    listSelectionImpactedRows,
    isRejectedSnapshot,
    shouldRejectPreviousSelection,
    getRejectReason,
    getCanonicalDefaultVersionName,
    buildScopedVersionName,
  });

  const markSelectedForProject = selectionApi.markSelectedForProject;
  const syncSelectionForProjectStatus = selectionApi.syncSelectionForProjectStatus;
  const getRecommendedStatusForProject = selectionApi.getRecommendedStatusForProject;
  const getRecommendedStatusMapForProject = selectionApi.getRecommendedStatusMapForProject;
  const convertPreliminaryToFinal = selectionApi.convertPreliminaryToFinal;

  FC.quoteSnapshotStore = {
    SNAPSHOT_KEY,
    FINAL_STATUSES,
    normalizeSnapshot,
    readAll,
    writeAll,
    getById,
    save,
    remove,
    findDuplicateSnapshot,
    replaceSnapshot,
    snapshotSizeBreakdown,
    getQuoteFingerprint,
    cleanupRemovedSnapshotReferences,
    purgeLegacyStoredRows,
    isCurrentStoredSnapshot,
    limitSnapshotHistory,
    markSelectedForProject,
    syncSelectionForProjectStatus,
    getRecommendedStatusForProject,
    getRecommendedStatusMapForProject,
    convertPreliminaryToFinal,
    listForProject,
    listForInvestor,
    getLatestForProject,
    getSelectedForProject,
    hasFinalQuote,
    defaultVersionName,
    isPreliminarySnapshot,
    normalizeRoomIds,
    getScopeRoomLabels,
    getSnapshotRoomIds,
    filterRowsByRoomScope,
    listExactScopeSnapshots,
    findExactScopeSnapshot,
    listOverlappingScopeSnapshots,
    removeSnapshotsForProjectRooms,
    sameRoomScope,
    snapshotScopeOverlaps,
    isRejectedSnapshot,
    getEffectiveVersionName,
  };

  try{ purgeLegacyStoredRows('module-load-current-snapshot-schema'); }catch(_){ }
})();

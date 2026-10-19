// js/app/investor/session.js
// Minimal "session" layer: snapshot + restore localStorage keys.
// Used for Anuluj/Zapisz workflow (leave without saving vs commit).

(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const PROJECTS_KEY = 'fc_projects_v1';
  const UNSCOPED_PART_KEYS = ['fc_edge_v1', 'fc_material_part_options_v1'];
  // These are monitored; only the owner's project record may actually be restored.
  const SNAPSHOT_KEYS = new Set([PROJECTS_KEY, ...UNSCOPED_PART_KEYS]);
  const SESSION_STORAGE_KEY = 'fc_edit_session_v1';
  const SESSION_SCHEMA_VERSION = 4;
  const DIRTY_CACHE_WINDOW_MS = 120;
  let beginFailureNotified = false;
  let rollbackRestored = false;
  let writeUnconfirmed = false;
  // RAM-only evidence: this document attempted the initial baseline write.
  // A restored/contradictory payload must never acquire this retry permission.
  let initialBeginPending = false;

  function canSnapshotKey(key){ return SNAPSHOT_KEYS.has(key); }
  function getKeysToSnapshot(){ return Array.from(SNAPSHOT_KEYS); }

  const UNCONFIRMED_MESSAGE = 'Dane projektu mogły zostać zapisane, ale nie potwierdzono sesji. Dalszy zapis został wstrzymany, aby chronić dane. Zachowano formularz i snapshot.';

  function fail(code, message, details){ session.lastError = Object.assign({ code, message }, details || {}); invalidateDirtyCache(); return false; }
  function notifyBlocked(message){
    try{ if(FC.infoBox && FC.infoBox.open) FC.infoBox.open({ title:'Sesja edycji wymaga zakończenia', message, okOnly:true }); }catch(_){ }
  }

  function projectRows(raw){
    const rows = raw === null ? [] : JSON.parse(raw);
    if(!Array.isArray(rows)) throw new Error('Niepoprawny magazyn projektów.');
    const ids = new Set();
    for(const row of rows){
      if(!row || typeof row !== 'object' || !String(row.id || '').trim() || ids.has(String(row.id))) throw new Error('Niejednoznaczne rekordy projektów.');
      ids.add(String(row.id));
    }
    return rows;
  }
  function ownerRaw(raw){
    if(!session.projectId) throw new Error('Brak właściciela sesji.');
    const row = projectRows(raw).find(row=>String(row.id) === session.projectId);
    return row ? JSON.stringify(row) : null;
  }
  // Scope v4: an editing session owns one functional room, not every room of its investor.
  // Legacy sessions without a room keep C2.0's fail-closed whole-record contract.
  function scopeRaw(raw){
    const owner = ownerRaw(raw);
    if(owner === null || !session.roomId) return owner;
    const record = JSON.parse(owner);
    const data = record.projectData || {};
    const defs = data.meta && data.meta.roomDefs || {};
    const roomId = session.roomId;
    return JSON.stringify({
      roomPresent:hasOwn(data,roomId),
      room:hasOwn(data,roomId) ? data[roomId] : null,
      definitionPresent:hasOwn(defs,roomId),
      definition:hasOwn(defs,roomId) ? defs[roomId] : null
    });
  }
  function canSwitchRoom(id){
    if(!session.active || (session.roomId && String(id || '') === session.roomId)) return true;
    notifyBlocked('Najpierw zakończ sesję przyciskiem Zapisz lub Anuluj. Pomieszczenie nie zostało przełączone.');
    return false;
  }
  function resolveOwner(context, snapshot, explicitId){
    const id = String(explicitId || context && context.projectId || snapshot && snapshot.fc_current_project_id_v1 || '').trim();
    if(!id || (explicitId && context && context.projectId && String(context.projectId) !== id)) return '';
    const rows = projectRows(snapshot && snapshot[PROJECTS_KEY]);
    const row = rows.find(row=>String(row.id) === id);
    if(!row || (context && context.investorId && row.investorId && String(context.investorId) !== String(row.investorId))) return '';
    return id;
  }

  function canSwitchProject(id){
    if(!session.active || (session.projectId && String(id || '') === session.projectId)) return true;
    notifyBlocked('Najpierw zakończ sesję przyciskiem Zapisz lub Anuluj. Projekt nie został przełączony.');
    return false;
  }
  function canSwitchInvestor(id){
    if(!session.active) return true;
    let ownerInvestor = session.context && session.context.investorId || '';
    try{ ownerInvestor = JSON.parse(ownerRaw(session.snapshot[PROJECTS_KEY])).investorId || ownerInvestor; }catch(_){ }
    if(ownerInvestor && String(id || '') === String(ownerInvestor)) return true;
    notifyBlocked('Najpierw zakończ sesję przyciskiem Zapisz lub Anuluj. Inwestor nie został przełączony.');
    return false;
  }
  function canUseSessionOwner(openingRoom, options){
    if(!session.active) return true;
    if(FC.projectDomainOperations && FC.projectDomainOperations.hasPending(session.projectId)) return fail('PENDING_DOMAIN_OPERATION','Najpierw dokończ operację projektu.');
    const current = resolveSessionContext();
    if(openingRoom) current.roomId = String(openingRoom);
    if(session.projectId && ((options && options.checkContext === false)
      || (current.projectId === session.projectId && (!session.roomId || current.roomId === session.roomId)
        && !(session.context && session.context.investorId && current.investorId && current.investorId !== session.context.investorId)))){
      try{
        const raw = localStorage.getItem(PROJECTS_KEY);
        const owner = JSON.parse(ownerRaw(raw));
        if(owner && owner.meta && owner.meta.pendingDomainOperation) return fail('PENDING_DOMAIN_OPERATION','Najpierw dokończ operację projektu.');
        const record = scopeRaw(raw);
        const before = scopeRaw(session.snapshot[PROJECTS_KEY]);
        if(record === before || (session.expectedOwnerKnown && record === session.expectedOwnerRaw)) return true;
      }catch(_){ }
      fail('PROJECT_WRITE_CONFLICT', 'Nie potwierdzono aktualnej wersji właściciela sesji. Zapis został wstrzymany; zachowano snapshot.');
      notifyBlocked(session.lastError.message);
      return false;
    }
    fail('SESSION_OWNER_MISMATCH', 'Nie można zapisać projektu w sesji należącej do innego lub nieustalonego projektu. Wróć do właściciela sesji; zachowano snapshot.');
    notifyBlocked(session.lastError.message);
    return false;
  }

  function keyChanged(key, raw){
    const before = hasOwn(session.snapshot, key) ? session.snapshot[key] : null;
    if(key !== PROJECTS_KEY) return before !== raw;
    try{ return scopeRaw(before) !== scopeRaw(raw); }catch(_){ return true; }
  }

  // Shared read-only proof. It never calls canSaveProject (no validation cycle).
  // A restored baseline is also valid after Cancel's durable cleanup failed.
  function inspectDurableSession(openingRoom, options){
    const opts = options || {};
    try{
      if(writeUnconfirmed || !session.active || (!session.durable && !opts.allowUndurable) || !session.projectId || !session.snapshot) return null;
      const raws = {};
      for(const key of [SESSION_STORAGE_KEY, ...getKeysToSnapshot()]) raws[key] = localStorage.getItem(key);
      const payload = JSON.parse(raws[SESSION_STORAGE_KEY]);
      if(!payload || payload.schemaVersion !== SESSION_SCHEMA_VERSION || payload.active !== true
        || payload.projectId !== session.projectId || payload.roomId !== session.roomId
        || payload.startedAt !== session.startedAt || !payload.snapshot
        || !payload.context || !session.context
        || payload.context.projectId !== session.projectId || payload.context.roomId !== session.roomId
        || payload.context.investorId !== session.context.investorId
        || payload.expectedOwnerKnown !== true || session.expectedOwnerKnown !== true) return null;
      for(const key of getKeysToSnapshot()){
        if(!hasOwn(payload.snapshot,key) || !hasOwn(session.snapshot,key)
          || payload.snapshot[key] !== session.snapshot[key]) return null;
      }
      const owner = JSON.parse(ownerRaw(raws[PROJECTS_KEY]));
      const original = JSON.parse(ownerRaw(session.snapshot[PROJECTS_KEY]));
      if(opts.checkContext !== false){
        const current = resolveSessionContext();
        if(openingRoom) current.roomId = String(openingRoom);
        if(current.projectId !== session.projectId || (session.roomId && current.roomId !== session.roomId)
          || String(current.investorId || '') !== String(session.context.investorId || '')) return null;
      }
      const currentScope = scopeRaw(raws[PROJECTS_KEY]);
      const baselineScope = scopeRaw(session.snapshot[PROJECTS_KEY]);
      if(!original || String(original.investorId || '') !== String(session.context.investorId || '')
        || (owner && String(owner.investorId || '') !== String(session.context.investorId || ''))
        || (session.roomId && (!owner || !owner.projectData || !hasOwn(owner.projectData,session.roomId)
          || !original.projectData || !hasOwn(original.projectData,session.roomId)))) return null;
      if(payload.expectedOwnerRaw !== session.expectedOwnerRaw
        && !(currentScope === baselineScope && rollbackRestored)) return null;
      if(currentScope !== baselineScope && currentScope !== payload.expectedOwnerRaw) return null;
      if(Object.keys(raws).some(key=>localStorage.getItem(key) !== raws[key])) return null;
      return { dirty:getKeysToSnapshot().some(key=>keyChanged(key,raws[key])), raws };
    }catch(_){ return null; }
  }

  function unconfirmedSession(){
    let projectSaved = writeUnconfirmed;
    try{
      const current = scopeRaw(localStorage.getItem(PROJECTS_KEY));
      projectSaved = projectSaved || (session.expectedOwnerKnown && current === session.expectedOwnerRaw
        && current !== scopeRaw(session.snapshot[PROJECTS_KEY]));
    }catch(_){ }
    fail('SESSION_UNCONFIRMED', UNCONFIRMED_MESSAGE, projectSaved ? {projectSaved:true} : null);
    notifyBlocked(UNCONFIRMED_MESSAGE);
    return false;
  }

  // Only latches failure; no API to adopt a newer revision or reset its baseline.
  function markUnconfirmedProjectWrite(){
    writeUnconfirmed = true;
    return unconfirmedSession();
  }

  function retryInitialBegin(){
    if(!session.active || session.durable) return true;
    if(!initialBeginPending || writeUnconfirmed) return unconfirmedSession();
    // begin verifies the original owner/context, unchanged canonical baseline
    // and any existing payload. It does not adopt a post-write revision.
    return session.begin();
  }

  function canSaveProject(openingRoom){
    if(!session.active){
      if(writeUnconfirmed) return unconfirmedSession();
      try{
        const raw = localStorage.getItem(SESSION_STORAGE_KEY);
        if(raw !== null && !isLegacyOrphanPayload(JSON.parse(raw))) return unconfirmedSession();
      }catch(_){ return unconfirmedSession(); }
      return true;
    }
    if(!canUseSessionOwner(openingRoom)) return false;
    return inspectDurableSession(openingRoom) ? true : unconfirmedSession();
  }

  // CLOUD-1B only observes existing evidence. Even a clean editing session is
  // not an exportable committed state. Never notify, recover or clean payloads.
  function inspectExportState(){
    try{
      if(writeUnconfirmed) return {ok:false,code:'EXPORT_SESSION_UNCONFIRMED'};
      if(session.active) return {ok:false,code:'EXPORT_ACTIVE_SESSION'};
      if(session.snapshot || session.durable || session.projectId || session.roomId
        || localStorage.getItem(SESSION_STORAGE_KEY) !== null) return {ok:false,code:'EXPORT_SESSION_UNCONFIRMED'};
      return {ok:true};
    }catch(_){ return {ok:false,code:'EXPORT_READ_FAILED'}; }
  }

  // Navigation requires the same proof, additionally bound to an editing room.
  function inspectNavigationState(){
    if(!session.roomId || !canUseSessionOwner()) return null;
    return inspectDurableSession();
  }

  function restoreOwnerProject(){
    try{
      const before = scopeRaw(session.snapshot[PROJECTS_KEY]);
      if(before === null) return fail('SESSION_OWNER_MISSING', 'Snapshot nie zawiera jednoznacznego rekordu właściciela sesji.');
      const observed = localStorage.getItem(PROJECTS_KEY);
      const current = scopeRaw(observed);
      if(current !== before && (!session.expectedOwnerKnown || current !== session.expectedOwnerRaw)){
        return fail('PROJECT_WRITE_CONFLICT', 'Edytowany zakres zmienił się poza potwierdzonymi zapisami tej sesji. Nie cofnięto danych. Sesja i snapshot zostały zachowane.');
      }
      if(current === before) return true;
      const rows = projectRows(observed);
      const index = rows.findIndex(row=>String(row.id) === session.projectId);
      if(index >= 0 && rows[index].meta && rows[index].meta.pendingDomainOperation) return fail('PENDING_DOMAIN_OPERATION','Nie cofnięto niedokończonej operacji projektu.');
      if(session.roomId){
        // Never restore an entire investor record from a room-scoped snapshot.
        if(index < 0) return fail('SESSION_OWNER_MISSING', 'Rekord centralny zniknął. Nie przywrócono go starszą kopią.');
        const baseline = JSON.parse(ownerRaw(session.snapshot[PROJECTS_KEY]));
        const fresh = rows[index];
        const roomId = session.roomId;
        const original = baseline.projectData || {};
        const data = fresh.projectData && typeof fresh.projectData === 'object' ? fresh.projectData : (fresh.projectData = {});
        if(hasOwn(original,roomId)) data[roomId] = original[roomId];
        else delete data[roomId];
        const oldDefs = original.meta && original.meta.roomDefs || {};
        if(hasOwn(oldDefs,roomId)){
          const meta = data.meta && typeof data.meta === 'object' ? data.meta : (data.meta = {});
          const defs = meta.roomDefs && typeof meta.roomDefs === 'object' ? meta.roomDefs : (meta.roomDefs = {});
          defs[roomId] = oldDefs[roomId];
        }else if(data.meta && data.meta.roomDefs && hasOwn(data.meta.roomDefs,roomId)){
          delete data.meta.roomDefs[roomId];
        }
      }else if(index >= 0) rows[index] = JSON.parse(before);
      else rows.push(JSON.parse(before));
      if(session.roomId && FC.projectModel && typeof FC.projectModel.summarizeProjectData === 'function'){
        Object.assign(rows[index], FC.projectModel.summarizeProjectData(rows[index].projectData));
      }
      const next = JSON.stringify(rows);
      // Optimistic conflict check: never write a merge built from a stale container.
      if(localStorage.getItem(PROJECTS_KEY) !== observed) return fail('PROJECT_WRITE_CONFLICT', 'Magazyn projektów zmienił się podczas przygotowania cofnięcia. Spróbuj ponownie.');
      if(!writeRaw(PROJECTS_KEY, next)) return fail('PROJECT_ROLLBACK_WRITE_FAILED', 'Nie potwierdzono cofnięcia projektu. Sesja edycji została zachowana. Spróbuj ponownie.');
      session.expectedOwnerRaw = before;
      session.expectedOwnerKnown = true;
      rollbackRestored = true;
      return true;
    }catch(_){ return fail('PROJECT_ROLLBACK_INVALID', 'Nie można bezpiecznie odczytać lub scalić magazynu projektów. Sesja i snapshot zostały zachowane.'); }
  }

  function readRaw(key){
    try{ return localStorage.getItem(key); }catch(_){ return null; }
  }

  function writeRaw(key, raw){
    try{
      if(raw === null || typeof raw === 'undefined'){
        if(localStorage.removeItem(key) === false) return false;
        return localStorage.getItem(key) === null;
      }
      if(localStorage.setItem(key, raw) === false) return false;
      return localStorage.getItem(key) === String(raw);
    }catch(_){ return false; }
  }

  function invalidateDirtyCache(){
    session.lastDirtyCheckAt = 0;
    session.lastDirtyValue = false;
    session.changedKeys = new Set();
  }


  function nowStamp(){
    try{ return Date.now(); }catch(_){ return 0; }
  }

  function resolveSessionContext(){
    const ctx = {};
    try{ ctx.investorId = FC.investors && typeof FC.investors.getCurrentId === 'function' ? String(FC.investors.getCurrentId() || '') : String(localStorage.getItem('fc_current_investor_v1') || ''); }catch(_){ ctx.investorId = ''; }
    try{ ctx.projectId = FC.projectStore && typeof FC.projectStore.getCurrentProjectId === 'function' ? String(FC.projectStore.getCurrentProjectId() || '') : String(localStorage.getItem('fc_current_project_id_v1') || ''); }catch(_){ ctx.projectId = ''; }
    try{ ctx.activeTab = typeof uiState !== 'undefined' && uiState ? String(uiState.activeTab || '') : ''; }catch(_){ ctx.activeTab = ''; }
    try{ ctx.roomId = typeof uiState !== 'undefined' && uiState ? String(uiState.roomType || '') : ''; }catch(_){ ctx.roomId = ''; }
    return ctx;
  }

  function hasOwn(obj, key){
    return !!(obj && Object.prototype.hasOwnProperty.call(obj, key));
  }

  function isLegacyOrphanPayload(payload){
    // Missing owner metadata is not evidence that an active snapshot may be discarded.
    return !!(payload && payload.active === false && !payload.snapshot);
  }

  function removeSnapshotIdFromRaw(raw, snapshotId){
    const key = String(snapshotId || '').trim();
    if(!key || typeof raw !== 'string' || !raw.trim()) return { changed:false, raw };
    try{
      const rows = JSON.parse(raw);
      if(!Array.isArray(rows)) return { changed:false, raw };
      const next = rows.filter((row)=> String(row && (row.id || row.snapshotId) || '').trim() !== key);
      if(next.length === rows.length) return { changed:false, raw };
      return { changed:true, raw:JSON.stringify(next) };
    }catch(_){ return { changed:false, raw }; }
  }

  function cleanupSnapshotReferenceInSnapshotMap(snapshotMap, snapshotId){
    if(!(snapshotMap && typeof snapshotMap === 'object')) return false;
    let changed = false;
    ['fc_quote_snapshots_v1'].forEach((key)=> {
      if(!hasOwn(snapshotMap, key)) return;
      const result = removeSnapshotIdFromRaw(snapshotMap[key], snapshotId);
      if(result.changed){
        snapshotMap[key] = result.raw;
        changed = true;
      }
    });
    return changed;
  }

  function cleanupSnapshotReferences(snapshotId){
    const key = String(snapshotId || '').trim();
    if(!key) return false;
    let changed = false;
    try{
      if(session.snapshot && cleanupSnapshotReferenceInSnapshotMap(session.snapshot, key)){
        changed = true;
      }
    }catch(_){ }
    try{
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed && parsed.snapshot && cleanupSnapshotReferenceInSnapshotMap(parsed.snapshot, key)){
          parsed.updatedAt = nowStamp();
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
          changed = true;
        }
      }
    }catch(_){ }
    if(changed) invalidateDirtyCache();
    return changed;
  }

  function shouldTrackKey(key){
    const normalizedKey = String(key || '');
    if(!canSnapshotKey(normalizedKey)) return false;
    if(!session.active || !session.snapshot || session.suspendTracking) return false;
    return true;
  }

  function trackKeyMutation(key, nextRaw, previousRaw){
    const normalizedKey = String(key || '');
    if(!shouldTrackKey(normalizedKey)) return;
    if(keyChanged(normalizedKey, nextRaw)) session.changedKeys.add(normalizedKey);
    else session.changedKeys.delete(normalizedKey);
    if(normalizedKey === PROJECTS_KEY && session.projectId){
      try{
        const previous = scopeRaw(previousRaw);
        const next = scopeRaw(nextRaw);
        if(previous !== next && session.expectedOwnerKnown && previous === session.expectedOwnerRaw){
          rollbackRestored = false;
          session.expectedOwnerRaw = next;
          // Persist only a witnessed local owner update, never adopt an external version
          // merely because an unrelated project was saved in this tab.
          if(!persistSession()){
            writeUnconfirmed = true;
            fail('SESSION_UNCONFIRMED', UNCONFIRMED_MESSAGE, {projectSaved:true});
          }
        }
      }catch(_){ session.expectedOwnerKnown = false; }
    }
    session.lastDirtyCheckAt = Date.now();
    session.lastDirtyValue = session.changedKeys.size > 0;
  }

  function withTrackingSuspended(work){
    const previous = !!session.suspendTracking;
    session.suspendTracking = true;
    try{ return typeof work === 'function' ? work() : undefined; }
    finally{ session.suspendTracking = previous; }
  }

  function installStorageTracking(){
    try{
      const storage = localStorage;
      if(!storage) return;
      const proto = (typeof Storage !== 'undefined' && Storage.prototype)
        ? Storage.prototype
        : Object.getPrototypeOf(storage);
      const protoHasStorageMethods = !!(proto && typeof proto.setItem === 'function');
      const target = protoHasStorageMethods ? proto : storage;
      if(!target || target.__fcSessionTrackingInstalled) return;
      const rawSetItem = typeof target.setItem === 'function' ? target.setItem : (typeof storage.setItem === 'function' ? storage.setItem : null);
      const rawRemoveItem = typeof target.removeItem === 'function' ? target.removeItem : (typeof storage.removeItem === 'function' ? storage.removeItem : null);
      const rawClear = typeof target.clear === 'function' ? target.clear : (typeof storage.clear === 'function' ? storage.clear : null);
      const isLocalStorageCall = (ctx)=>{
        try{ return !protoHasStorageMethods || ctx === storage || ctx === localStorage; }catch(_){ return true; }
      };
      if(rawSetItem){
        target.setItem = function(key, value){
          const previousRaw = isLocalStorageCall(this) && shouldTrackKey(key) && String(key) === PROJECTS_KEY ? storage.getItem(key) : undefined;
          const result = rawSetItem.call(this === target && !protoHasStorageMethods ? storage : this, key, value);
          if(result !== false && isLocalStorageCall(this) && shouldTrackKey(key)) trackKeyMutation(key, storage.getItem(key), previousRaw);
          return result;
        };
      }
      if(rawRemoveItem){
        target.removeItem = function(key){
          const previousRaw = isLocalStorageCall(this) && shouldTrackKey(key) && String(key) === PROJECTS_KEY ? storage.getItem(key) : undefined;
          const result = rawRemoveItem.call(this === target && !protoHasStorageMethods ? storage : this, key);
          if(result !== false && isLocalStorageCall(this) && shouldTrackKey(key)) trackKeyMutation(key, storage.getItem(key), previousRaw);
          return result;
        };
      }
      if(rawClear){
        target.clear = function(){
          rawClear.call(this === target && !protoHasStorageMethods ? storage : this);
          if(isLocalStorageCall(this)){
            try{ getComparableKeys().forEach((key)=> trackKeyMutation(key, null)); }catch(_){ }
          }
        };
      }
      target.__fcSessionTrackingInstalled = true;
    }catch(_){ }
  }

  function getComparableKeys(){
    if(Array.isArray(session.comparableKeys) && session.comparableKeys.length){
      session.comparableKeys = session.comparableKeys.filter(canSnapshotKey);
      return session.comparableKeys;
    }
    const keys = new Set(Object.keys(session.snapshot || {}));
    try{ getKeysToSnapshot().forEach((k)=> keys.add(k)); }catch(_){ }
    session.comparableKeys = Array.from(keys).filter(canSnapshotKey);
    return session.comparableKeys;
  }

  function isDirty(){
    if(!session.active || !session.snapshot) return false;
    for(const key of session.changedKeys){
      if(!canSnapshotKey(key)){
        session.changedKeys.delete(key);
        session.lastDirtyCheckAt = 0;
        session.lastDirtyValue = false;
      }
    }
    if(session.changedKeys && session.changedKeys.size) return true;
    const now = Date.now();
    if(session.lastDirtyCheckAt && (now - session.lastDirtyCheckAt) < DIRTY_CACHE_WINDOW_MS){
      return !!session.lastDirtyValue;
    }
    let dirty = false;
    try{
      for(const k of getComparableKeys()){
        const current = readRaw(k);
        if(keyChanged(k, current)){
          dirty = true;
          if(session.changedKeys) session.changedKeys.add(k);
          break;
        }
      }
    }catch(_){ }
    session.lastDirtyCheckAt = now;
    session.lastDirtyValue = dirty;
    return dirty;
  }

  function persistSession(){
    try{
      return withTrackingSuspended(()=> {
        const payload = {
          schemaVersion: SESSION_SCHEMA_VERSION,
          active: !!session.active,
          projectId:session.projectId,
          roomId:session.roomId,
          expectedOwnerRaw:session.expectedOwnerRaw,
          expectedOwnerKnown:session.expectedOwnerKnown,
          startedAt: Number(session.startedAt || 0),
          updatedAt: nowStamp(),
          context: session.context && typeof session.context === 'object' ? session.context : resolveSessionContext(),
          snapshot: session.snapshot || null
        };
        if(!payload.active && !payload.snapshot){
          return writeRaw(SESSION_STORAGE_KEY, null);
        }
        return writeRaw(SESSION_STORAGE_KEY, JSON.stringify(payload));
      });
    }catch(_){ return false; }
  }

  function notifyBeginFailure(){
    if(beginFailureNotified) return;
    beginFailureNotified = true;
    try{
      if(FC.infoBox && typeof FC.infoBox.open === 'function'){
        FC.infoBox.open({
          title:'Nie udało się zabezpieczyć sesji edycji',
          message:'Nie udało się zapisać stanu potrzebnego do bezpiecznego cofnięcia zmian. Zapis zmian został wstrzymany. Nie zamykaj programu i spróbuj ponownie.',
          okOnly:true,
        });
      }
    }catch(_){ }
  }

  function restoreSession(){
    try{
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if(!raw) return;
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object') return;
      if(isLegacyOrphanPayload(parsed)){
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
      session.active = !!parsed.active;
      session.snapshot = parsed.snapshot && typeof parsed.snapshot === 'object' ? parsed.snapshot : null;
      const context = parsed.context && typeof parsed.context === 'object' ? parsed.context : {};
      try{ session.projectId = resolveOwner(context, session.snapshot, parsed.projectId); }catch(_){ session.projectId = ''; }
      // Old v3 snapshots cannot be silently reinterpreted as room-scoped.
      session.roomId = Number(parsed.schemaVersion || 0) >= SESSION_SCHEMA_VERSION ? String(parsed.roomId || '') : '';
      if(session.roomId){
        try{
          const owner = JSON.parse(ownerRaw(session.snapshot[PROJECTS_KEY]));
          if(String(context.roomId || '') !== session.roomId || !hasOwn(owner.projectData, session.roomId)) session.projectId = '';
        }catch(_){ session.projectId = ''; }
      }
      if(session.snapshot) session.snapshot = Object.fromEntries(Object.entries(session.snapshot).filter(([key])=> canSnapshotKey(key)));
      session.expectedOwnerKnown = Number(parsed.schemaVersion || 0) >= SESSION_SCHEMA_VERSION && parsed.expectedOwnerKnown === true;
      session.expectedOwnerRaw = session.expectedOwnerKnown ? parsed.expectedOwnerRaw : null;
      session.durable = !!(session.active && session.snapshot);
      session.startedAt = Number(parsed.startedAt || parsed.createdAt || 0);
      session.updatedAt = Number(parsed.updatedAt || 0);
      session.context = context;
      if(session.projectId) session.context.projectId = session.projectId;
      session.comparableKeys = session.snapshot ? Array.from(new Set(Object.keys(session.snapshot))) : null;
      session.changedKeys = new Set();
      if(!session.active && !session.snapshot){
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }catch(_){ }
    invalidateDirtyCache();
  }

  const session = {
    active: false,
    durable: false,
    projectId:'',
    roomId:'',
    expectedOwnerRaw:null,
    expectedOwnerKnown:false,
    lastError:null,
    snapshot: null,
    startedAt: 0,
    updatedAt: 0,
    context: null,
    comparableKeys: null,
    changedKeys: new Set(),
    suspendTracking: false,
    lastDirtyCheckAt: 0,
    lastDirtyValue: false,
    begin(openingRoom){
      if(!session.active && !canSaveProject(openingRoom)) return false;
      if(FC.projectDomainOperations && FC.projectDomainOperations.hasPending(session.projectId || resolveSessionContext().projectId)){
        notifyBlocked('Najpierw dokończ odzyskiwanie operacji projektu. Edytor nie został otwarty.');
        return false;
      }
      if(session.active){
        if(session.durable){
          if(!canSaveProject(openingRoom)) return false;
        }else{
          // Retry an initial failed begin only, never adopt a post-write revision.
          if(!canUseSessionOwner(openingRoom)) return false;
          try{
            if(scopeRaw(localStorage.getItem(PROJECTS_KEY)) !== scopeRaw(session.snapshot[PROJECTS_KEY])
              || (localStorage.getItem(SESSION_STORAGE_KEY) !== null
                && !inspectDurableSession(openingRoom, {allowUndurable:true}))) return unconfirmedSession();
          }catch(_){ return unconfirmedSession(); }
        }
      }
      // Idempotent: once we started an edit session, do not overwrite the snapshot.
      if(!(session.active && session.snapshot)){
        const keys = getKeysToSnapshot();
        const snap = {};
        const context = resolveSessionContext();
        if(openingRoom) context.roomId = String(openingRoom);
        try{
          keys.forEach((k)=> { snap[k] = localStorage.getItem(k); });
          session.projectId = resolveOwner(context, snap);
        }catch(_){ session.projectId = ''; }
        if(!session.projectId){
          fail('SESSION_OWNER_MISSING', 'Nie można ustalić jednoznacznego właściciela sesji. Zapis zmian został wstrzymany. Otwórz poprawny projekt i spróbuj ponownie.');
          notifyBlocked(session.lastError.message);
          return false;
        }
        // Only bind room ownership when the room exists in the durable baseline.
        // Structural room creation/deletion remains outside this edit scope.
        const owner = JSON.parse(ownerRaw(snap[PROJECTS_KEY]));
        if(owner.meta && owner.meta.pendingDomainOperation) return fail('PENDING_DOMAIN_OPERATION','Najpierw dokończ operację projektu.');
        const candidateRoom = String(context.roomId || '');
        if(candidateRoom && !hasOwn(owner.projectData, candidateRoom)){
          fail('SESSION_ROOM_MISSING', 'Pomieszczenie nie istnieje w trwałym projekcie. Wstrzymano edycję; nie utworzono sesji całego inwestora.');
          notifyBlocked(session.lastError.message);
          return false;
        }
        session.roomId = candidateRoom && owner.projectData && hasOwn(owner.projectData,candidateRoom) ? candidateRoom : '';
        session.snapshot = snap;
        session.expectedOwnerRaw = scopeRaw(snap[PROJECTS_KEY]);
        session.expectedOwnerKnown = true;
        session.comparableKeys = keys.slice();
        session.startedAt = nowStamp();
        session.updatedAt = session.startedAt;
        session.context = context;
        session.context.projectId = session.projectId;
        session.context.roomId = session.roomId;
        session.active = true;
        session.durable = false;
        rollbackRestored = false;
        writeUnconfirmed = false;
        initialBeginPending = false;
        invalidateDirtyCache();
      }
      if(session.durable) return true;
      session.durable = persistSession();
      initialBeginPending = !session.durable;
      if(!session.durable) notifyBeginFailure();
      else beginFailureNotified = false;
      return session.durable;
    },
    commit(){
      if(!canSaveProject()) return false;
      return withTrackingSuspended(()=> {
        if(!writeRaw(SESSION_STORAGE_KEY, null)){
          session.active = true;
          return false;
        }
        if(FC.sessionNavigation && FC.sessionNavigation.sessionFinished) FC.sessionNavigation.sessionFinished({projectId:session.projectId,roomId:session.roomId});
        session.snapshot = null;
        session.comparableKeys = null;
        session.startedAt = 0;
        session.updatedAt = 0;
        session.context = null;
        session.projectId = '';
        session.roomId = '';
        session.expectedOwnerRaw = null;
        session.expectedOwnerKnown = false;
        session.lastError = null;
        session.active = false;
        session.durable = false;
        beginFailureNotified = false;
        rollbackRestored = false;
        writeUnconfirmed = false;
        initialBeginPending = false;
        invalidateDirtyCache();
        return true;
      });
    },
    cancel(){
      if(writeUnconfirmed) return unconfirmedSession();
      // Legacy owner-only snapshots retain their existing baseline-only rollback.
      // Modern sessions must prove their revision before any rollback or cleanup.
      if(!session.active && !canSaveProject()) return false;
      if(session.active && !session.snapshot) return unconfirmedSession();
      if(session.active && session.expectedOwnerKnown){
        if(!canUseSessionOwner(null, {checkContext:false})) return false;
        if(!inspectDurableSession(null, {checkContext:false})) return unconfirmedSession();
      }
      return withTrackingSuspended(()=> {
        session.lastError = null;
        if(FC.projectDomainOperations && FC.projectDomainOperations.hasPending(session.projectId)) return fail('PENDING_DOMAIN_OPERATION','Nie cofnięto niedokończonej operacji projektu.');
        if(session.snapshot){
          if(!session.projectId) return fail('SESSION_OWNER_MISSING', 'Nie ustalono właściciela starego snapshotu. Automatyczne cofnięcie zostało zablokowane; zachowano sesję i dane.');
          try{
            for(const key of UNSCOPED_PART_KEYS){
              const before = hasOwn(session.snapshot, key) ? session.snapshot[key] : null;
              if(localStorage.getItem(key) !== before){
                return fail('UNSCOPED_PART_ROLLBACK_BLOCKED', 'Nie można bezpiecznie cofnąć globalnych opcji formatek, ponieważ nie mają właściciela projektu. Anuluj zostało wstrzymane; sesja i dane pozostały zachowane. Zapisz zachowa bieżące ustawienia; bezpieczne cofanie wymaga ich przypisania do projektu.');
              }
            }
          }catch(_){ return fail('SESSION_READ_FAILED', 'Nie można sprawdzić bezpieczeństwa cofnięcia. Sesja została zachowana.'); }
        }
        const restored = !session.snapshot || restoreOwnerProject();
        // Finish durably before discarding RAM state, also when there is no snapshot.
        if(!restored || !writeRaw(SESSION_STORAGE_KEY, null)){
          if(!session.lastError) fail('SESSION_CLEANUP_FAILED', 'Nie udało się trwale zakończyć sesji. Sesja edycji została zachowana. Spróbuj ponownie.');
          // Keep the original RAM and persisted snapshot for another cancel attempt.
          session.active = true;
          invalidateDirtyCache();
          return false;
        }
        if(FC.sessionNavigation && FC.sessionNavigation.sessionFinished) FC.sessionNavigation.sessionFinished({projectId:session.projectId,roomId:session.roomId});
        session.snapshot = null;
        session.comparableKeys = null;
        session.startedAt = 0;
        session.updatedAt = 0;
        session.context = null;
        session.projectId = '';
        session.roomId = '';
        session.expectedOwnerRaw = null;
        session.expectedOwnerKnown = false;
        session.lastError = null;
        session.active = false;
        session.durable = false;
        beginFailureNotified = false;
        rollbackRestored = false;
        writeUnconfirmed = false;
        initialBeginPending = false;
        invalidateDirtyCache();
        return true;
      });
    },
    canSwitchProject,
    canSwitchInvestor,
    canSwitchRoom,
    canSaveProject,
    retryInitialBegin,
    markUnconfirmedProjectWrite,
    inspectNavigationState,
    inspectExportState,
    invalidateDirtyCache,
    isDirty,
    trackKeyMutation,
    cleanupSnapshotReferences,
    isLegacyOrphanPayload,
    withTrackingSuspended
  };

  restoreSession();
  installStorageTracking();
  FC.session = session;
})();

(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const BUILD = '20260610_labor_drawer_count_context_fix_v1';
  const EVENT_LIMIT = 60;
  let lastGenerateTrace = null;
  let lastGenerateButtonEvent = null;
  const renderEvents = [];
  const snapshotStoreEvents = [];
  const versionNameEvents = [];
  const snapshotDeleteEvents = [];

  function now(){ return Date.now(); }
  function text(value){ return String(value == null ? '' : value).trim(); }
  function bool(value){ return !!value; }
  function clone(value){
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(_){ return value; }
  }
  function money(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return String(value == null ? '' : value);
    return n.toFixed(2);
  }
  function safeCall(label, fn, fallback){
    try{ return typeof fn === 'function' ? fn() : fallback; }
    catch(err){ return { __error:true, label, message:String(err && err.message || err || 'błąd') }; }
  }
  function safeJson(raw){
    if(raw == null || raw === '') return { ok:false, empty:true, value:null, bytes:0 };
    try{ return { ok:true, empty:false, value:JSON.parse(raw), bytes:String(raw).length }; }
    catch(err){ return { ok:false, empty:false, value:null, bytes:String(raw).length, error:String(err && err.message || err || 'parse error') }; }
  }
  function storageRaw(key){ try{ return localStorage.getItem(key); }catch(_){ return null; } }
  function storageJson(key){ return safeJson(storageRaw(key)); }
  function listStorageKeys(){
    const keys = [];
    try{
      for(let i = 0; i < localStorage.length; i += 1){
        const key = localStorage.key(i);
        if(key) keys.push(key);
      }
    }catch(_){ }
    return keys.sort();
  }
  function redactId(value){ return text(value); }
  function shallowKeys(value){ return value && typeof value === 'object' ? Object.keys(value).sort() : []; }


  function pushEvent(bucket, label, value){
    const arr = Array.isArray(bucket) ? bucket : [];
    try{
      arr.push({ at:new Date().toISOString(), label:text(label), value:clone(value == null ? null : value) });
      while(arr.length > EVENT_LIMIT) arr.shift();
    }catch(_){ }
  }
  function summarizeEventList(list){
    return Array.isArray(list) ? list.slice(-EVENT_LIMIT).map(clone) : [];
  }
  function getSnapshotId(row){
    return text(row && (row.id || row.snapshotId));
  }
  function getSnapshotProjectId(row){
    return text(row && (row.projectId || row.project && row.project.id || row.meta && row.meta.projectId));
  }
  function getSnapshotInvestorId(row){
    return text(row && (row.investorId || row.investor && row.investor.id || row.project && row.project.investorId || row.meta && row.meta.investorId));
  }
  function getVersionName(row){
    return text(row && (row.commercial && row.commercial.versionName || row.meta && row.meta.versionName));
  }
  function countRows(value){ return Array.isArray(value) ? value.length : 0; }
  function storageBytes(key){ const raw = storageRaw(key); return raw == null ? 0 : String(raw).length; }
  function summarizeSnapshotList(rows, limit){
    const list = Array.isArray(rows) ? rows : [];
    return list.slice(0, Number(limit) > 0 ? Number(limit) : 12).map(summarizeSnapshot);
  }
  function summarizeSnapshotStoreForId(snapshotId){
    const sid = text(snapshotId);
    const raw = storageRaw('fc_quote_snapshots_v1');
    const parsed = safeJson(raw);
    const rawRows = Array.isArray(parsed.value) ? parsed.value : [];
    const readRows = safeCall('quoteSnapshotStore.readAll', function(){ return FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.readAll === 'function' ? FC.quoteSnapshotStore.readAll() : []; }, []);
    const normalizedRows = Array.isArray(readRows) ? readRows : [];
    const rawMatch = rawRows.find(function(row){ return getSnapshotId(row) === sid; }) || null;
    const normalizedMatch = normalizedRows.find(function(row){ return getSnapshotId(row) === sid; }) || null;
    const getById = safeCall('quoteSnapshotStore.getById', function(){ return FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getById === 'function' ? FC.quoteSnapshotStore.getById(sid) : null; }, null);
    return {
      id:sid,
      storageBytes:raw == null ? 0 : String(raw).length,
      storageJsonOk:!!parsed.ok,
      storageJsonError:parsed.error || '',
      rawCount:rawRows.length,
      normalizedCount:normalizedRows.length,
      rawHasId:!!rawMatch,
      normalizedHasId:!!normalizedMatch,
      getByIdExists:!!getById,
      rawMatch:rawMatch ? summarizeSnapshot(rawMatch) : null,
      normalizedMatch:normalizedMatch ? summarizeSnapshot(normalizedMatch) : null,
    };
  }

  function roomLabel(roomId, projectData){
    const id = text(roomId);
    try{
      const meta = projectData && projectData.meta && typeof projectData.meta === 'object' ? projectData.meta : {};
      const def = meta.roomDefs && meta.roomDefs[id] || null;
      return text(def && (def.label || def.name)) || id;
    }catch(_){ return id; }
  }
  function roomIdsFromProject(projectData){
    try{
      if(FC.wycenaContextRepair && typeof FC.wycenaContextRepair.projectDataRoomIds === 'function') return FC.wycenaContextRepair.projectDataRoomIds(projectData);
    }catch(_){ }
    const data = projectData && typeof projectData === 'object' ? projectData : {};
    const ids = [];
    const push = function(id){ const key = text(id); if(key && ids.indexOf(key) < 0) ids.push(key); };
    try{
      const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
      const defs = meta.roomDefs && typeof meta.roomDefs === 'object' ? meta.roomDefs : {};
      (Array.isArray(meta.roomOrder) ? meta.roomOrder : []).forEach(push);
      Object.keys(defs).forEach(push);
    }catch(_){ }
    Object.keys(data).forEach(function(key){
      if(key === 'schemaVersion' || key === 'meta') return;
      const room = data[key];
      if(room && typeof room === 'object' && (Array.isArray(room.cabinets) || Array.isArray(room.fronts) || Array.isArray(room.sets) || room.settings)) push(key);
    });
    return ids;
  }
  function projectScore(projectData){
    try{
      if(FC.wycenaContextRepair && typeof FC.wycenaContextRepair.roomContentScore === 'function') return FC.wycenaContextRepair.roomContentScore(projectData);
    }catch(_){ }
    const ids = roomIdsFromProject(projectData);
    let score = 0;
    ids.forEach(function(roomId){
      const room = projectData && projectData[roomId] || {};
      score += (Array.isArray(room.cabinets) ? room.cabinets.length : 0) * 100;
      score += (Array.isArray(room.sets) ? room.sets.length : 0) * 80;
      score += (Array.isArray(room.fronts) ? room.fronts.length : 0) * 30;
      if(room.settings) score += 1;
      if(room.preferences) score += 1;
    });
    return score;
  }
  function summarizeProjectData(projectData){
    const data = projectData && typeof projectData === 'object' ? projectData : null;
    if(!data) return { exists:false, rooms:[], totals:{ rooms:0, cabinets:0, sets:0, fronts:0 }, score:0 };
    const ids = roomIdsFromProject(data);
    const rooms = ids.map(function(roomId){
      const room = data[roomId] && typeof data[roomId] === 'object' ? data[roomId] : {};
      return {
        id:roomId,
        label:roomLabel(roomId, data),
        cabinets:Array.isArray(room.cabinets) ? room.cabinets.length : 0,
        sets:Array.isArray(room.sets) ? room.sets.length : 0,
        fronts:Array.isArray(room.fronts) ? room.fronts.length : 0,
        hasSettings:!!room.settings,
        hasPreferences:!!room.preferences,
      };
    });
    return {
      exists:true,
      schemaVersion:data.schemaVersion || null,
      assignedInvestorId:text(data.meta && data.meta.assignedInvestorId),
      roomOrder:Array.isArray(data.meta && data.meta.roomOrder) ? data.meta.roomOrder.map(text).filter(Boolean) : [],
      roomDefCount:data.meta && data.meta.roomDefs && typeof data.meta.roomDefs === 'object' ? Object.keys(data.meta.roomDefs).length : 0,
      rooms,
      totals:{
        rooms:rooms.length,
        cabinets:rooms.reduce(function(sum, row){ return sum + row.cabinets; }, 0),
        sets:rooms.reduce(function(sum, row){ return sum + row.sets; }, 0),
        fronts:rooms.reduce(function(sum, row){ return sum + row.fronts; }, 0),
      },
      score:projectScore(data),
    };
  }
  function summarizeProjectRecord(record){
    const row = record && typeof record === 'object' ? record : null;
    if(!row) return { exists:false };
    return {
      exists:true,
      id:redactId(row.id),
      investorId:redactId(row.investorId),
      title:text(row.title),
      status:text(row.status),
      updatedAt:row.updatedAt || null,
      metaSource:text(row.meta && row.meta.source),
      projectData:summarizeProjectData(row.projectData),
    };
  }
  function summarizeDraft(draft){
    const row = draft && typeof draft === 'object' ? draft : null;
    if(!row) return { exists:false };
    const selection = row.selection && typeof row.selection === 'object' ? row.selection : {};
    const commercial = row.commercial && typeof row.commercial === 'object' ? row.commercial : {};
    return {
      exists:true,
      id:redactId(row.id),
      projectId:redactId(row.projectId),
      investorId:redactId(row.investorId),
      selectedRooms:Array.isArray(selection.selectedRooms) ? selection.selectedRooms.map(text).filter(Boolean) : [],
      materialScope:selection.materialScope || null,
      preliminary:!!commercial.preliminary,
      versionName:text(commercial.versionName),
      rateSelections:Array.isArray(row.rateSelections) ? row.rateSelections.length : 0,
      updatedAt:row.updatedAt || null,
    };
  }
  function summarizeSnapshot(row){
    const snap = row && typeof row === 'object' ? row : {};
    return {
      id:redactId(snap.id || snap.snapshotId),
      projectId:redactId(snap.projectId || snap.project && snap.project.id || snap.meta && snap.meta.projectId),
      investorId:redactId(snap.investorId || snap.investor && snap.investor.id || snap.project && snap.project.investorId || snap.meta && snap.meta.investorId),
      selectedRooms:Array.isArray(snap.scope && snap.scope.selectedRooms) ? snap.scope.selectedRooms.map(text).filter(Boolean) : [],
      roomLabels:Array.isArray(snap.scope && snap.scope.roomLabels) ? snap.scope.roomLabels.map(text).filter(Boolean) : [],
      versionName:text(snap.commercial && snap.commercial.versionName || snap.meta && snap.meta.versionName),
      preliminary:!!(snap.commercial && snap.commercial.preliminary || snap.meta && snap.meta.preliminary),
      rejected:!!(snap.meta && (snap.meta.rejectedAt || snap.meta.rejectedReason)),
      accepted:!!(snap.meta && snap.meta.acceptedAt),
      grand:snap.totals && snap.totals.grand,
      generatedAt:snap.generatedAt || null,
      source:text(snap.meta && snap.meta.source || snap.source),
    };
  }
  function summarizeStorageKey(key){
    const raw = storageRaw(key);
    const parsed = safeJson(raw);
    return { key, exists:raw != null, bytes:raw == null ? 0 : String(raw).length, jsonOk:!!parsed.ok, jsonError:parsed.error || '' };
  }
  function currentProjectId(){
    try{ return FC.projectStore && typeof FC.projectStore.getCurrentProjectId === 'function' ? text(FC.projectStore.getCurrentProjectId()) : text(storageRaw('fc_current_project_id_v1')); }
    catch(_){ return text(storageRaw('fc_current_project_id_v1')); }
  }
  function currentInvestorId(){
    try{ return FC.investors && typeof FC.investors.getCurrentId === 'function' ? text(FC.investors.getCurrentId()) : text(storageRaw('fc_current_investor_v1')); }
    catch(_){ return text(storageRaw('fc_current_investor_v1')); }
  }
  function getInvestorById(id){
    const key = text(id);
    if(!key) return null;
    try{ if(FC.investors && typeof FC.investors.getById === 'function') return FC.investors.getById(key); }catch(_){ }
    const parsed = storageJson('fc_investors_v1');
    const rows = Array.isArray(parsed.value) ? parsed.value : [];
    return rows.find(function(row){ return text(row && row.id) === key; }) || null;
  }
  function summarizeInvestor(inv){
    const row = inv && typeof inv === 'object' ? inv : null;
    if(!row) return { exists:false };
    return {
      exists:true,
      id:redactId(row.id),
      display:text(row.companyName) || text(row.name) || text(row.title) || '(bez nazwy)',
      rooms:Array.isArray(row.rooms) ? row.rooms.map(function(room){ return { id:text(room && room.id), label:text(room && (room.label || room.name || room.type || room.baseType)), status:text(room && room.projectStatus) }; }) : [],
      createdAt:row.createdAt || null,
      updatedAt:row.updatedAt || null,
      source:text(row.source || row.meta && row.meta.source),
    };
  }
  function parseEditSession(){
    const parsed = storageJson('fc_edit_session_v1');
    const value = parsed.value;
    return {
      exists:storageRaw('fc_edit_session_v1') != null,
      jsonOk:!!parsed.ok,
      bytes:parsed.bytes,
      keys:value && typeof value === 'object' ? shallowKeys(value) : [],
      summary:value && typeof value === 'object' ? {
        active:!!(value.active || value.isActive || value.editing || value.mode || value.roomId || value.projectId || value.investorId),
        schemaVersion:value.schemaVersion || null,
        legacyOrphan:!!(FC.session && typeof FC.session.isLegacyOrphanPayload === 'function' && FC.session.isLegacyOrphanPayload(value)),
        mode:text(value.mode || value.type || value.kind),
        roomId:text(value.roomId || value.currentRoomId || value.editedRoomId || value.context && value.context.roomId),
        projectId:text(value.projectId || value.context && value.context.projectId),
        investorId:text(value.investorId || value.context && value.context.investorId),
        updatedAt:value.updatedAt || value.startedAt || null,
      } : null,
    };
  }
  function collectStorageSection(){
    const keys = listStorageKeys();
    const important = [
      'fc_current_investor_v1',
      'fc_current_project_id_v1',
      'fc_project_v1',
      'fc_projects_v1',
      'fc_investors_v1',
      'fc_quote_snapshots_v1',
      'fc_quote_offer_drafts_v1',
      'fc_ui_v1',
      'fc_edit_session_v1',
      'fc_reload_restore_v1'
    ];
    const legacySlots = keys.filter(function(key){ return /^fc_project_inv_.+_v1$/.test(key); });
    return {
      totalKeys:keys.length,
      fcKeys:keys.filter(function(key){ return key.indexOf('fc_') === 0; }).length,
      important:important.map(summarizeStorageKey),
      legacyProjectSlots:legacySlots.map(summarizeStorageKey),
      legacyProjectSlotCount:legacySlots.length,
    };
  }
  function collectRuntimeSection(){
    const pid = currentProjectId();
    const iid = currentInvestorId();
    const ui = safeCall('uiState', function(){ return FC.uiState && typeof FC.uiState.get === 'function' ? FC.uiState.get() : storageJson('fc_ui_v1').value; }, {});
    const projectRecords = safeCall('projectStore.readAll', function(){ return FC.projectStore && typeof FC.projectStore.readAll === 'function' ? FC.projectStore.readAll() : (storageJson('fc_projects_v1').value || []); }, []);
    const records = Array.isArray(projectRecords) ? projectRecords : [];
    const currentRecord = records.find(function(row){ return text(row && row.id) === pid; }) || null;
    const byInvestorRecord = records.find(function(row){ return text(row && row.investorId) === iid; }) || null;
    const activeProject = safeCall('fc_project_v1', function(){ return storageJson('fc_project_v1').value; }, null);
    const legacySlotKey = iid ? ('fc_project_inv_' + iid + '_v1') : '';
    const legacySlot = legacySlotKey ? storageJson(legacySlotKey).value : null;
    const safeProject = safeCall('rozrys.safeGetProject', function(){ return FC.rozrys && typeof FC.rozrys.safeGetProject === 'function' ? FC.rozrys.safeGetProject() : (typeof projectData !== 'undefined' ? projectData : window.projectData); }, null);
    return {
      build:BUILD,
      href:safeCall('location.href', function(){ return window.location && window.location.href; }, ''),
      userAgent:safeCall('navigator.userAgent', function(){ return navigator && navigator.userAgent; }, ''),
      activeTab:text(ui && ui.activeTab),
      currentInvestorId:iid,
      currentProjectId:pid,
      uiCurrentInvestorId:text(ui && ui.currentInvestorId),
      investor:summarizeInvestor(getInvestorById(iid)),
      projectRecordCurrent:summarizeProjectRecord(currentRecord),
      projectRecordByInvestor:summarizeProjectRecord(byInvestorRecord),
      activeFcProject:summarizeProjectData(activeProject),
      legacySlotKey,
      legacyProjectSlot:summarizeProjectData(legacySlot),
      runtimeProjectData:summarizeProjectData(safeProject),
      editSession:parseEditSession(),
    };
  }
  function collectRoomsAndSelection(){
    const getArray = function(label, fn){
      const out = safeCall(label, fn, []);
      return Array.isArray(out) ? out.map(text).filter(Boolean) : out;
    };
    const draft = safeCall('quoteOfferStore.getCurrentDraft', function(){ return FC.quoteOfferStore && typeof FC.quoteOfferStore.getCurrentDraft === 'function' ? FC.quoteOfferStore.getCurrentDraft() : {}; }, {});
    const normalizedDraftSelection = safeCall('wycenaCoreSelection.normalizeQuoteSelection', function(){ return FC.wycenaCoreSelection && typeof FC.wycenaCoreSelection.normalizeQuoteSelection === 'function' ? FC.wycenaCoreSelection.normalizeQuoteSelection(draft && draft.selection) : null; }, null);
    const decodedRooms = safeCall('wycenaCoreSelection.decodeSelectedRooms', function(){ return FC.wycenaCoreSelection && typeof FC.wycenaCoreSelection.decodeSelectedRooms === 'function' ? FC.wycenaCoreSelection.decodeSelectedRooms(normalizedDraftSelection || (draft && draft.selection)) : []; }, []);
    return {
      roomRegistryActive:getArray('roomRegistry.getActiveRoomIds', function(){ return FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function' ? FC.roomRegistry.getActiveRoomIds() : []; }),
      roomScopeResolverActive:getArray('roomScopeResolver.getActiveRoomIds', function(){ return FC.roomScopeResolver && typeof FC.roomScopeResolver.getActiveRoomIds === 'function' ? FC.roomScopeResolver.getActiveRoomIds() : []; }),
      wycenaCoreActive:getArray('wycenaCoreSelection.getActiveRooms', function(){ return FC.wycenaCoreSelection && typeof FC.wycenaCoreSelection.getActiveRooms === 'function' ? FC.wycenaCoreSelection.getActiveRooms() : []; }),
      currentDraft:summarizeDraft(draft),
      normalizedSelection:normalizedDraftSelection,
      decodedSelectedRooms:Array.isArray(decodedRooms) ? decodedRooms.map(text).filter(Boolean) : decodedRooms,
    };
  }
  function collectSnapshots(){
    const pid = currentProjectId();
    const iid = currentInvestorId();
    const byProject = safeCall('quoteSnapshotStore.listForProject', function(){ return FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listForProject === 'function' ? FC.quoteSnapshotStore.listForProject(pid) : []; }, []);
    const byInvestor = safeCall('quoteSnapshotStore.listForInvestor', function(){ return FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listForInvestor === 'function' ? FC.quoteSnapshotStore.listForInvestor(iid) : []; }, []);
    const all = safeCall('quoteSnapshotStore.readAll', function(){ return FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.readAll === 'function' ? FC.quoteSnapshotStore.readAll() : (storageJson('fc_quote_snapshots_v1').value || []); }, []);
    const projectRows = Array.isArray(byProject) ? byProject : [];
    const investorRows = Array.isArray(byInvestor) ? byInvestor : [];
    const allRows = Array.isArray(all) ? all : [];
    return {
      projectCount:projectRows.length,
      investorCount:investorRows.length,
      allCount:allRows.length,
      firstProjectRows:projectRows.slice(0, 8).map(summarizeSnapshot),
      firstInvestorRows:investorRows.slice(0, 8).map(summarizeSnapshot),
    };
  }
  function collectStaticModuleHealth(){
    const names = [
      ['FC.wycenaCore', FC.wycenaCore],
      ['FC.wycenaCoreSelection', FC.wycenaCoreSelection],
      ['FC.wycenaCoreSource', FC.wycenaCoreSource],
      ['FC.wycenaCoreMaterialPlan', FC.wycenaCoreMaterialPlan],
      ['FC.wycenaCoreLines', FC.wycenaCoreLines],
      ['FC.quoteSnapshotStore', FC.quoteSnapshotStore],
      ['FC.quoteSnapshot', FC.quoteSnapshot],
      ['FC.quoteOfferStore', FC.quoteOfferStore],
      ['FC.wycenaContextRepair', FC.wycenaContextRepair],
      ['FC.roomRegistry', FC.roomRegistry],
      ['FC.roomScopeResolver', FC.roomScopeResolver],
      ['FC.rozrys', FC.rozrys],
      ['FC.projectStore', FC.projectStore],
      ['FC.investors', FC.investors]
    ];
    return names.map(function(row){ return { name:row[0], exists:!!row[1], keys:row[1] && typeof row[1] === 'object' ? shallowKeys(row[1]).slice(0, 24) : [] }; });
  }

  function elementText(el){
    try{ return text(el && el.textContent); }catch(_){ return ''; }
  }
  function elementClasses(el){
    try{ return text(el && (el.className || el.getAttribute && el.getAttribute('class'))); }catch(_){ return ''; }
  }
  function oneText(root, selector){
    try{ const el = root && typeof root.querySelector === 'function' ? root.querySelector(selector) : null; return elementText(el); }catch(_){ return ''; }
  }
  function collectDomRenderSources(){
    const out = { exists: false, historyItems:[], preview:null, counts:{ historyDom:0, previewBadges:0 } };
    try{
      const root = document && document.getElementById ? (document.getElementById('quoteActivePreview') || document.querySelector('.quote-root')) : null;
      out.exists = !!root;
      if(root){
        out.rootTextHead = elementText(root).slice(0, 500);
        out.rootClasses = elementClasses(root);
      }
      const items = Array.prototype.slice.call(document.querySelectorAll ? document.querySelectorAll('[data-quote-history-id]') : []);
      out.counts.historyDom = items.length;
      out.historyItems = items.slice(0, 12).map(function(item){
        return {
          id:text(item && item.getAttribute && item.getAttribute('data-quote-history-id')),
          classes:elementClasses(item),
          title:oneText(item, '.quote-history__title'),
          meta:oneText(item, '.quote-history__meta'),
          badges:Array.prototype.slice.call(item.querySelectorAll ? item.querySelectorAll('.quote-history__badge') : []).map(elementText),
          buttons:Array.prototype.slice.call(item.querySelectorAll ? item.querySelectorAll('button') : []).map(function(btn){ return { text:elementText(btn), disabled:!!btn.disabled, classes:elementClasses(btn) }; }),
        };
      });
      const previewStart = document.getElementById ? document.getElementById('quotePreviewStart') : null;
      const badges = Array.prototype.slice.call(document.querySelectorAll ? document.querySelectorAll('.quote-preview-badge') : []);
      out.counts.previewBadges = badges.length;
      out.preview = {
        exists:!!previewStart || badges.length > 0,
        badgeTexts:badges.map(elementText),
        scopeTexts:Array.prototype.slice.call(document.querySelectorAll ? document.querySelectorAll('.quote-scope') : []).map(elementText).slice(0, 8),
        totalsText:elementText(document.querySelector ? document.querySelector('.quote-totals') : null).slice(0, 500),
      };
    }catch(err){ out.error = String(err && err.message || err || 'błąd DOM'); }
    return out;
  }

  function collectRendererRuntimeSources(){
    const dbg = FC.wycenaTabDebug || {};
    const history = safeCall('wycenaTabDebug.getSnapshotHistory', function(){ return typeof dbg.getSnapshotHistory === 'function' ? dbg.getSnapshotHistory() : []; }, []);
    const histRows = Array.isArray(history) ? history : [];
    const previewState = safeCall('wycenaTabDebug.getHistoryPreviewState', function(){ return typeof dbg.getHistoryPreviewState === 'function' ? dbg.getHistoryPreviewState() : {}; }, {});
    const shellState = safeCall('wycenaTabDebug.getTabShellState', function(){ return typeof dbg.getTabShellState === 'function' ? dbg.getTabShellState() : {}; }, {});
    const currentDraft = safeCall('wycenaTabDebug.getOfferDraft', function(){ return typeof dbg.getOfferDraft === 'function' ? dbg.getOfferDraft() : (FC.quoteOfferStore && FC.quoteOfferStore.getCurrentDraft ? FC.quoteOfferStore.getCurrentDraft() : {}); }, {});
    const resolved = safeCall('wycenaTabDebug.resolveDisplayedQuote', function(){ return typeof dbg.resolveDisplayedQuote === 'function' ? dbg.resolveDisplayedQuote() : null; }, null);
    return {
      debugApiExists:!!FC.wycenaTabDebug,
      historyCount:histRows.length,
      historyRows:summarizeSnapshotList(histRows, 12),
      previewState:clone(previewState || {}),
      shellState:clone(shellState || {}),
      currentDraft:summarizeDraft(currentDraft),
      resolvedDisplayedQuote:resolved ? summarizeSnapshot(resolved) : null,
      dom:collectDomRenderSources(),
      recentRenderEvents:summarizeEventList(renderEvents),
      recentSnapshotStoreEvents:summarizeEventList(snapshotStoreEvents),
      recentVersionNameEvents:summarizeEventList(versionNameEvents),
      recentSnapshotDeleteEvents:summarizeEventList(snapshotDeleteEvents),
    };
  }

  function collectVersionNameDiagnostics(){
    const draft = safeCall('quoteOfferStore.getCurrentDraft', function(){ return FC.quoteOfferStore && typeof FC.quoteOfferStore.getCurrentDraft === 'function' ? FC.quoteOfferStore.getCurrentDraft() : {}; }, {});
    const selection = safeCall('wycenaCoreSelection.normalizeQuoteSelection', function(){ return FC.wycenaCoreSelection && typeof FC.wycenaCoreSelection.normalizeQuoteSelection === 'function' ? FC.wycenaCoreSelection.normalizeQuoteSelection(draft && draft.selection) : {}; }, {});
    const selectedRooms = selection && Array.isArray(selection.selectedRooms) ? selection.selectedRooms.map(text).filter(Boolean) : [];
    const commercial = draft && draft.commercial && typeof draft.commercial === 'object' ? draft.commercial : {};
    const preliminary = !!commercial.preliminary;
    const pid = currentProjectId();
    const currentName = text(commercial.versionName);
    const defaultName = safeCall('quoteSnapshot.defaultVersionName', function(){ return FC.quoteSnapshot && typeof FC.quoteSnapshot.defaultVersionName === 'function' ? FC.quoteSnapshot.defaultVersionName(preliminary, { selection, roomIds:selectedRooms }) : (preliminary ? 'Wstępna oferta' : 'Oferta'); }, preliminary ? 'Wstępna oferta' : 'Oferta');
    const suggested = safeCall('quoteScopeEntry.buildSuggestedVersionName', function(){ return FC.quoteScopeEntry && typeof FC.quoteScopeEntry.buildSuggestedVersionName === 'function' ? FC.quoteScopeEntry.buildSuggestedVersionName(pid, selectedRooms, preliminary) : defaultName; }, defaultName);
    const exactRows = safeCall('quoteSnapshotStore.listExactScopeSnapshots', function(){ return FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listExactScopeSnapshots === 'function' ? FC.quoteSnapshotStore.listExactScopeSnapshots(pid, selectedRooms, { preliminary, includeRejected:false }) : []; }, []);
    const exactList = Array.isArray(exactRows) ? exactRows : [];
    const currentNameTaken = safeCall('quoteScopeEntry.isVersionNameTaken.current', function(){ return FC.quoteScopeEntry && typeof FC.quoteScopeEntry.isVersionNameTaken === 'function' ? FC.quoteScopeEntry.isVersionNameTaken(pid, selectedRooms, preliminary, currentName) : false; }, false);
    const defaultNameTaken = safeCall('quoteScopeEntry.isVersionNameTaken.default', function(){ return FC.quoteScopeEntry && typeof FC.quoteScopeEntry.isVersionNameTaken === 'function' ? FC.quoteScopeEntry.isVersionNameTaken(pid, selectedRooms, preliminary, defaultName) : false; }, false);
    return {
      projectId:pid,
      selectedRooms,
      preliminary,
      draftVersionName:currentName,
      defaultName,
      suggestedName:suggested,
      currentNameTaken:!!currentNameTaken,
      defaultNameTaken:!!defaultNameTaken,
      exactScopeCount:exactList.length,
      exactScopeRows:summarizeSnapshotList(exactList, 12),
      recentVersionNameEvents:summarizeEventList(versionNameEvents),
    };
  }

  function collectSnapshotStorageDeepDive(){
    const raw = storageRaw('fc_quote_snapshots_v1');
    const parsed = safeJson(raw);
    const rawRows = Array.isArray(parsed.value) ? parsed.value : [];
    const normalizedRows = safeCall('quoteSnapshotStore.readAll', function(){ return FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.readAll === 'function' ? FC.quoteSnapshotStore.readAll() : []; }, []);
    const pid = currentProjectId();
    const iid = currentInvestorId();
    const ids = new Set();
    const duplicateIds = [];
    rawRows.forEach(function(row){ const id = getSnapshotId(row); if(!id) return; if(ids.has(id)) duplicateIds.push(id); ids.add(id); });
    return {
      storageKey:'fc_quote_snapshots_v1',
      bytes:raw == null ? 0 : String(raw).length,
      jsonOk:!!parsed.ok,
      jsonError:parsed.error || '',
      rawCount:rawRows.length,
      normalizedCount:Array.isArray(normalizedRows) ? normalizedRows.length : null,
      duplicateIds,
      rawRows:summarizeSnapshotList(rawRows, 12),
      normalizedRows:summarizeSnapshotList(Array.isArray(normalizedRows) ? normalizedRows : [], 12),
      rowsForCurrentProject:summarizeSnapshotList(rawRows.filter(function(row){ return getSnapshotProjectId(row) === pid; }), 12),
      rowsForCurrentInvestor:summarizeSnapshotList(rawRows.filter(function(row){ return getSnapshotInvestorId(row) === iid; }), 12),
      recentSnapshotStoreEvents:summarizeEventList(snapshotStoreEvents),
    };
  }

  async function runDryQuoteCollect(){
    const out = { ok:false, steps:[] };
    const mark = function(step, value){ out.steps.push({ step, value:value == null ? null : clone(value) }); };
    try{
      mark('start', { at:now() });
      let repair = null;
      if(FC.wycenaContextRepair && typeof FC.wycenaContextRepair.repairActiveQuoteContext === 'function'){
        repair = FC.wycenaContextRepair.repairActiveQuoteContext({ reason:'diagnostics-dry-run' });
        mark('contextRepair', repair && { ok:repair.ok, code:repair.code, investorId:repair.investorId, projectId:repair.projectId, activeRoomIds:repair.activeRoomIds, selectedRooms:repair.selectedRooms, repairs:repair.repairs, hadProjectContent:repair.hadProjectContent });
      }else{
        mark('contextRepair', { skipped:true, reason:'missing-module' });
      }
      const draft = FC.quoteOfferStore && typeof FC.quoteOfferStore.getCurrentDraft === 'function' ? FC.quoteOfferStore.getCurrentDraft() : {};
      mark('draftBeforeCollect', summarizeDraft(draft));
      const selection = FC.wycenaCoreSelection && typeof FC.wycenaCoreSelection.normalizeQuoteSelection === 'function'
        ? FC.wycenaCoreSelection.normalizeQuoteSelection(draft && draft.selection)
        : (draft && draft.selection || {});
      mark('normalizedSelection', selection);
      if(FC.wycenaCore && typeof FC.wycenaCore.collectQuoteData === 'function'){
        const quote = await FC.wycenaCore.collectQuoteData({ selection });
        out.ok = true;
        out.quote = {
          selectedRooms:Array.isArray(quote && quote.selectedRooms) ? quote.selectedRooms : [],
          roomLabels:Array.isArray(quote && quote.roomLabels) ? quote.roomLabels : [],
          materialLines:Array.isArray(quote && quote.materialLines) ? quote.materialLines.length : 0,
          accessoryLines:Array.isArray(quote && quote.accessoryLines) ? quote.accessoryLines.length : 0,
          agdLines:Array.isArray(quote && quote.agdLines) ? quote.agdLines.length : 0,
          quoteRateLines:Array.isArray(quote && quote.quoteRateLines) ? quote.quoteRateLines.length : 0,
          laborLines:Array.isArray(quote && quote.laborLines) ? quote.laborLines.length : 0,
          elementLines:Array.isArray(quote && quote.elementLines) ? quote.elementLines.length : 0,
          totals:quote && quote.totals || null,
        };
        mark('collectQuoteDataResult', out.quote);
      }else{
        out.error = { message:'Brak FC.wycenaCore.collectQuoteData' };
        mark('collectQuoteDataResult', out.error);
      }
    }catch(err){
      out.ok = false;
      out.error = {
        message:String(err && err.message || err || 'błąd'),
        name:String(err && err.name || ''),
        code:String(err && err.code || ''),
        title:String(err && err.title || ''),
        quoteValidation:!!(err && err.quoteValidation),
        details:err && err.details || null,
        stack:String(err && err.stack || '').split('\n').slice(0, 8),
      };
      mark('error', out.error);
    }
    return out;
  }
  function collectReportBase(){
    const report = {
      kind:'meble-app-wycena-diagnostics',
      build:BUILD,
      createdAt:new Date().toISOString(),
      runtime:collectRuntimeSection(),
      roomsAndSelection:collectRoomsAndSelection(),
      snapshots:collectSnapshots(),
      renderSources:collectRendererRuntimeSources(),
      versionNameDiagnostics:collectVersionNameDiagnostics(),
      snapshotStorageDeepDive:collectSnapshotStorageDeepDive(),
      storage:collectStorageSection(),
      moduleHealth:collectStaticModuleHealth(),
      lastGenerateTrace:lastGenerateTrace ? clone(lastGenerateTrace) : null,
      lastGenerateButtonEvent:lastGenerateButtonEvent ? clone(lastGenerateButtonEvent) : null,
    };
    return report;
  }
  async function buildReport(options){
    const opts = options && typeof options === 'object' ? options : {};
    const report = collectReportBase();
    if(opts.dryRun !== false) report.dryRun = await runDryQuoteCollect();
    return report;
  }
  function stringifyReport(report){
    const rep = report && typeof report === 'object' ? report : {};
    const lines = [];
    lines.push('=== RAPORT DIAGNOSTYCZNY WYCENA ===');
    lines.push('build: ' + text(rep.build));
    lines.push('createdAt: ' + text(rep.createdAt));
    lines.push('href: ' + text(rep.runtime && rep.runtime.href));
    lines.push('');
    lines.push('--- KONTEKST ---');
    const runtime = rep.runtime || {};
    lines.push('activeTab: ' + text(runtime.activeTab));
    lines.push('currentInvestorId: ' + text(runtime.currentInvestorId));
    lines.push('uiCurrentInvestorId: ' + text(runtime.uiCurrentInvestorId));
    lines.push('currentProjectId: ' + text(runtime.currentProjectId));
    lines.push('investor: ' + JSON.stringify(runtime.investor || {}));
    lines.push('editSession: ' + JSON.stringify(runtime.editSession || {}));
    lines.push('');
    lines.push('--- PROJEKTY / ŹRÓDŁA ---');
    lines.push('projectRecordCurrent: ' + JSON.stringify(runtime.projectRecordCurrent || {}));
    lines.push('projectRecordByInvestor: ' + JSON.stringify(runtime.projectRecordByInvestor || {}));
    lines.push('activeFcProject: ' + JSON.stringify(runtime.activeFcProject || {}));
    lines.push('legacySlotKey: ' + text(runtime.legacySlotKey));
    lines.push('legacyProjectSlot: ' + JSON.stringify(runtime.legacyProjectSlot || {}));
    lines.push('runtimeProjectData: ' + JSON.stringify(runtime.runtimeProjectData || {}));
    lines.push('');
    lines.push('--- POKOJE / WYBÓR ---');
    lines.push(JSON.stringify(rep.roomsAndSelection || {}, null, 2));
    lines.push('');
    lines.push('--- SNAPSHOTY ---');
    lines.push(JSON.stringify(rep.snapshots || {}, null, 2));
    lines.push('');
    lines.push('--- ŹRÓDŁA EKRANU WYCENA ---');
    lines.push(JSON.stringify(rep.renderSources || {}, null, 2));
    lines.push('');
    lines.push('--- NAZWA / WARIANT OFERTY ---');
    lines.push(JSON.stringify(rep.versionNameDiagnostics || {}, null, 2));
    lines.push('');
    lines.push('--- SNAPSHOT STORAGE DEEP DIVE ---');
    lines.push(JSON.stringify(rep.snapshotStorageDeepDive || {}, null, 2));
    lines.push('');
    lines.push('--- DRY RUN collectQuoteData BEZ ZAPISU ---');
    lines.push(JSON.stringify(rep.dryRun || {}, null, 2));
    lines.push('');
    lines.push('--- OSTATNI KLIK WYCEN ---');
    lines.push(JSON.stringify({ buttonEvent:rep.lastGenerateButtonEvent || null, generateTrace:rep.lastGenerateTrace || null }, null, 2));
    lines.push('');
    lines.push('--- STORAGE ---');
    lines.push(JSON.stringify(rep.storage || {}, null, 2));
    lines.push('');
    lines.push('--- MODUŁY ---');
    lines.push(JSON.stringify(rep.moduleHealth || [], null, 2));
    return lines.join('\n');
  }
  function h(tag, attrs, children){
    const el = document.createElement(tag);
    const a = attrs && typeof attrs === 'object' ? attrs : {};
    Object.keys(a).forEach(function(key){
      const value = a[key];
      if(value == null) return;
      if(key === 'class') el.className = String(value);
      else if(key === 'text') el.textContent = String(value);
      else if(key === 'html') el.innerHTML = String(value);
      else el.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : []).forEach(function(child){ if(child) el.appendChild(child); });
    return el;
  }
  function modalLock(on){
    try{ document.documentElement.classList.toggle('modal-lock', !!on); document.body.classList.toggle('modal-lock', !!on); }catch(_){ }
  }
  function copyText(value, textarea, statusEl){
    const textValue = String(value || '');
    const done = function(ok){ if(statusEl) statusEl.textContent = ok ? 'Skopiowano raport.' : 'Nie udało się skopiować. Zaznacz tekst raportu i skopiuj ręcznie.'; };
    try{
      if(navigator.clipboard && typeof navigator.clipboard.writeText === 'function'){
        navigator.clipboard.writeText(textValue).then(function(){ done(true); }, function(){ throw new Error('clipboard rejected'); });
        return;
      }
    }catch(_){ }
    try{
      if(textarea){ textarea.focus(); textarea.select(); }
      const ok = document.execCommand && document.execCommand('copy');
      done(!!ok);
    }catch(_){ done(false); }
  }
  function openReportModal(){
    let currentText = 'Buduję raport…';
    const overlay = h('div', { class:'quote-diagnostics-backdrop' });
    const dialog = h('div', { class:'quote-diagnostics-modal panel-box panel-box--rozrys', role:'dialog', 'aria-modal':'true' });
    const title = h('div', { class:'panel-box__title', text:'Diagnostyka WYCENY' });
    const closeBtn = h('button', { class:'panel-box__close', type:'button', 'aria-label':'Zamknij', text:'×' });
    const head = h('div', { class:'panel-box__head' }, [title, closeBtn]);
    const body = h('div', { class:'panel-box__body quote-diagnostics-body' });
    const lead = h('div', { class:'quote-diagnostics-lead', text:'Uruchom ten raport w normalnym trybie i w incognito, skopiuj oba wyniki i wklej je w rozmowie. Raport nie czyści danych, pokazuje źródła renderu ekranu, nazwę wariantu, snapshot storage i test wyceny bez zapisu snapshotu.' });
    const textarea = h('textarea', { class:'quote-diagnostics-textarea', readonly:'readonly', spellcheck:'false' });
    textarea.value = currentText;
    const status = h('div', { class:'quote-diagnostics-status muted', text:'Buduję raport…' });
    const footer = h('div', { class:'panel-box-form__footer quote-diagnostics-footer rozrys-picker-footer rozrys-picker-footer--material' });
    const actions = h('div', { class:'quote-diagnostics-actions rozrys-picker-footer-actions' });
    const refreshBtn = h('button', { class:'btn', type:'button', text:'Odśwież raport' });
    const copyBtn = h('button', { class:'btn-success', type:'button', text:'Kopiuj raport' });
    const closeFooterBtn = h('button', { class:'btn-primary', type:'button', text:'Zamknij' });
    actions.appendChild(refreshBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(closeFooterBtn);
    footer.appendChild(actions);
    body.appendChild(lead);
    body.appendChild(status);
    body.appendChild(textarea);
    dialog.appendChild(head);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    modalLock(true);
    const close = function(){
      try{ document.removeEventListener('keydown', onKey, true); }catch(_){ }
      try{ overlay.remove(); }catch(_){ }
      modalLock(false);
    };
    const onKey = function(event){ if(event.key === 'Escape'){ event.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('pointerdown', function(event){ if(event.target === overlay) close(); });
    closeBtn.addEventListener('click', close);
    closeFooterBtn.addEventListener('click', close);
    copyBtn.addEventListener('click', function(){ copyText(currentText, textarea, status); });
    async function refresh(){
      status.textContent = 'Buduję raport…';
      textarea.value = 'Buduję raport…';
      try{
        const report = await buildReport({ dryRun:true });
        currentText = stringifyReport(report);
        textarea.value = currentText;
        status.textContent = 'Raport gotowy. Skopiuj i wklej w rozmowie.';
      }catch(err){
        currentText = 'BŁĄD BUDOWANIA RAPORTU: ' + String(err && err.message || err || 'błąd') + '\n' + String(err && err.stack || '');
        textarea.value = currentText;
        status.textContent = 'Raport diagnostyczny sam zgłosił błąd — skopiuj ten tekst.';
      }
    }
    refreshBtn.addEventListener('click', function(){ void refresh(); });
    setTimeout(function(){ void refresh(); }, 0);
  }

  function recordGenerateButtonEvent(source){
    lastGenerateButtonEvent = {
      source:text(source || 'generate-button'),
      at:new Date().toISOString(),
      href:safeCall('location.href', function(){ return window.location && window.location.href; }, ''),
    };
    return lastGenerateButtonEvent;
  }

  function beginGenerateTrace(label){
    lastGenerateTrace = { label:text(label || 'generateQuote'), startedAt:new Date().toISOString(), steps:[] };
    return lastGenerateTrace;
  }
  function markGenerateTrace(step, value){
    if(!lastGenerateTrace) beginGenerateTrace('generateQuote');
    try{ lastGenerateTrace.steps.push({ at:new Date().toISOString(), step:text(step), value:clone(value) }); }catch(_){ }
  }
  function endGenerateTrace(result){
    if(!lastGenerateTrace) beginGenerateTrace('generateQuote');
    lastGenerateTrace.endedAt = new Date().toISOString();
    lastGenerateTrace.result = clone(result || {});
  }
  function renderTopbarButton(actions){
    if(!actions || typeof actions.appendChild !== 'function') return;
    const btn = h('button', { class:'btn quote-diagnostics-btn', type:'button', text:'Diag' });
    btn.title = 'Diagnostyka WYCENY — raport do porównania normalnie/incognito';
    btn.addEventListener('click', function(){ openReportModal(); });
    actions.appendChild(btn);
  }

  FC.wycenaDiagnostics = {
    BUILD,
    buildReport,
    stringifyReport,
    openReportModal,
    renderTopbarButton,
    beginGenerateTrace,
    markGenerateTrace,
    endGenerateTrace,
    summarizeProjectData,
    summarizeProjectRecord,
    runDryQuoteCollect,
    recordGenerateButtonEvent,
    recordRenderEvent(label, value){ pushEvent(renderEvents, label, value); },
    recordSnapshotStoreEvent(label, value){ pushEvent(snapshotStoreEvents, label, value); },
    recordVersionNameEvent(label, value){ pushEvent(versionNameEvents, label, value); },
    recordSnapshotDeleteEvent(label, value){ pushEvent(snapshotDeleteEvents, label, value); },
    summarizeSnapshot,
    summarizeSnapshotStoreForId,
    collectDomRenderSources,
    collectRendererRuntimeSources,
    collectVersionNameDiagnostics,
    collectSnapshotStorageDeepDive,
  };
})();
